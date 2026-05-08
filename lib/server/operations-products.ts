import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ProductLineItem } from "@/lib/operations-data";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import { listLots } from "@/lib/server/inventory-lots";
import { listInventoryMovements } from "@/lib/server/inventory-movements";
import {
  ErpResourceValidationError,
  sanitizeStoredErpResourceItemData,
  validateErpResourceItemData,
} from "@/lib/server/erp-resource-schema";
import { readErpResource } from "@/lib/server/erp-state";
import { getServerPersistenceProvider } from "@/lib/server/server-persistence";

const OPERATIONS_PRODUCTS_COLLECTION = "operationsProducts";
const PRODUCTS_RESOURCE_ID = "operations.products";
const DEFAULT_OPERATIONS_PRODUCTS_FILE = path.join(
  process.cwd(),
  ".data",
  "operations-products.json",
);

let fileWriteQueue = Promise.resolve();

type ProductVersion = number;

type StoredOperationsProductDocument = ProductLineItem & {
  version: ProductVersion;
  updatedAt: string | null;
  deleted?: false;
};

type DeletedOperationsProductDocument = {
  sku: string;
  deleted: true;
  deletedAt: string;
  version: ProductVersion;
  updatedAt: string | null;
};

type OperationsProductItemRecord = {
  product: OperationsProductRecord | null;
  exists: boolean;
  deleted?: boolean;
};

type OperationsProductMergeEntry =
  | { type: "product"; product: StoredOperationsProductDocument }
  | { type: "deleted"; product: DeletedOperationsProductDocument };

type StoredOperationsProductEntry =
  | StoredOperationsProductDocument
  | DeletedOperationsProductDocument;

type DeleteOperationsProductResult = {
  sku: string;
  version: ProductVersion;
  deletedAt: string;
};

type OperationsProductsFileStore = {
  items?: Record<string, StoredOperationsProductEntry>;
};

export type OperationsProductRecord = ProductLineItem & {
  version: ProductVersion;
  updatedAt: string | null;
};

export type ListOperationsProductsResult = {
  items: OperationsProductRecord[];
  count: number;
};

export type UpdateOperationsProductOptions = {
  baseVersion: number;
};

type ProductDocumentMutationResult =
  | { type: "set"; value: ProductLineItem }
  | { type: "noop"; value: OperationsProductRecord }
  | { type: "delete"; value: OperationsProductRecord };

export class OperationsProductConflictError extends Error {
  status: number;
  currentVersion: number;
  currentUpdatedAt: string | null;

  constructor(
    message: string,
    currentVersion: number,
    currentUpdatedAt: string | null,
  ) {
    super(message);
    this.status = 409;
    this.currentVersion = currentVersion;
    this.currentUpdatedAt = currentUpdatedAt;
  }
}

export class OperationsProductNotFoundError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.status = 404;
  }
}

export class OperationsProductInUseError extends Error {
  status: number;
  reasons: string[];

  constructor(message: string, reasons: string[]) {
    super(message);
    this.status = 409;
    this.reasons = reasons;
  }
}

export function requireOperationsProductBaseVersion(
  value: unknown,
  operation: string,
) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ErpResourceValidationError(
      `baseVersion obrigatorio para ${operation} o produto.`,
      400,
    );
  }

  return value;
}

export function getOperationsProductVersionConflictPayload(
  error: OperationsProductConflictError,
) {
  return {
    error: "VERSION_CONFLICT" as const,
    currentVersion: error.currentVersion,
  };
}

function normalizeSku(value: string) {
  return value.trim().toUpperCase();
}

function normalizeProductReference(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function getOperationsProductsFilePath() {
  return process.env.OPERATIONS_PRODUCTS_FILE_PATH
    ? path.resolve(process.cwd(), process.env.OPERATIONS_PRODUCTS_FILE_PATH)
    : DEFAULT_OPERATIONS_PRODUCTS_FILE;
}

function queueFileWrite<T>(operation: () => Promise<T>) {
  const nextOperation = fileWriteQueue.then(operation, operation);
  fileWriteQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );
  return nextOperation;
}

async function readOperationsProductsFileStore() {
  try {
    const raw = await readFile(getOperationsProductsFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        items: {},
      } satisfies Required<OperationsProductsFileStore>;
    }

    const value = parsed as OperationsProductsFileStore;

    return {
      items: normalizeFileItems(value.items),
    } satisfies Required<OperationsProductsFileStore>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        items: {},
      } satisfies Required<OperationsProductsFileStore>;
    }

    throw error;
  }
}

function normalizeStoredProductDocument(
  sku: string,
  value: unknown,
): StoredOperationsProductDocument | null {
  const normalizedSku = normalizeSku(sku);
  const sanitized = sanitizeStoredErpResourceItemData(PRODUCTS_RESOURCE_ID, value);
  const item = sanitized.item;

  if (!item || item.sku !== normalizedSku) {
    return null;
  }

  const candidate = value as Partial<StoredOperationsProductDocument>;

  return {
    ...item,
    updatedAt:
      typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    version:
      typeof candidate.version === "number" &&
      Number.isInteger(candidate.version) &&
      candidate.version >= 1
        ? candidate.version
        : 1,
  };
}

function normalizeDeletedProductDocument(
  sku: string,
  value: unknown,
): DeletedOperationsProductDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const normalizedSku = normalizeSku(sku);
  const candidate = value as Partial<DeletedOperationsProductDocument>;

  if (
    candidate.deleted !== true ||
    candidate.sku !== normalizedSku ||
    typeof candidate.deletedAt !== "string"
  ) {
    return null;
  }

  return {
    sku: normalizedSku,
    deleted: true,
    deletedAt: candidate.deletedAt,
    updatedAt:
      typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    version:
      typeof candidate.version === "number" &&
      Number.isInteger(candidate.version) &&
      candidate.version >= 1
        ? candidate.version
        : 1,
  };
}

function normalizeStoredProductEntry(
  sku: string,
  value: unknown,
): OperationsProductMergeEntry | null {
  const deletedProduct = normalizeDeletedProductDocument(sku, value);

  if (deletedProduct) {
    return {
      type: "deleted",
      product: deletedProduct,
    };
  }

  const product = normalizeStoredProductDocument(sku, value);

  if (!product) {
    return null;
  }

  return {
    type: "product",
    product,
  };
}

function toStoredProductEntry(
  entry: OperationsProductMergeEntry,
): StoredOperationsProductEntry {
  return entry.product;
}

function toProductMergeEntry(
  document: StoredOperationsProductEntry,
): OperationsProductMergeEntry {
  if ("deleted" in document && document.deleted === true) {
    return {
      type: "deleted",
      product: document,
    };
  }

  return {
    type: "product",
    product: document,
  };
}

function normalizeFileItems(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, StoredOperationsProductEntry>;
  }

  const items: Record<string, StoredOperationsProductEntry> = {};

  for (const [sku, candidate] of Object.entries(value)) {
    const normalized = normalizeStoredProductEntry(sku, candidate);

    if (normalized) {
      items[normalizeSku(sku)] = toStoredProductEntry(normalized);
    }
  }

  return items;
}

function sortProducts<TValue extends ProductLineItem>(items: TValue[]) {
  return [...items].sort((left, right) => left.sku.localeCompare(right.sku));
}

function areProductPayloadsEqual(
  left: ProductLineItem,
  right: ProductLineItem,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toProductPayload(
  product: OperationsProductRecord | null,
): ProductLineItem | null {
  if (!product) {
    return null;
  }

  const payload = { ...product } as Partial<OperationsProductRecord>;
  delete payload.version;
  delete payload.updatedAt;
  return payload as ProductLineItem;
}

function validateProductWritePayload(value: unknown, sku?: string) {
  const normalized = validateErpResourceItemData(PRODUCTS_RESOURCE_ID, value);
  const normalizedSku = sku ? normalizeSku(sku) : undefined;

  if (normalizedSku && normalized.sku !== normalizedSku) {
    throw new ErpResourceValidationError(
      "O sku do produto precisa corresponder ao sku da rota.",
    );
  }

  return normalized;
}

function assertBaseVersion(
  current: OperationsProductRecord | null,
  baseVersion: number,
): asserts current is OperationsProductRecord {
  if (!Number.isInteger(baseVersion) || baseVersion < 1) {
    throw new ErpResourceValidationError(
      "Versao base invalida para o produto.",
    );
  }

  if (!current) {
    throw new OperationsProductNotFoundError("Produto nao encontrado.");
  }

  if (current.version === baseVersion) {
    return;
  }

  throw new OperationsProductConflictError(
    "O produto foi alterado por outra sessao. Recarregue os dados antes de salvar novamente.",
    current.version,
    current.updatedAt,
  );
}

function assertProductWriteResult(
  value: OperationsProductRecord | DeletedOperationsProductDocument,
): asserts value is OperationsProductRecord {
  if ("deleted" in value && value.deleted === true) {
    throw new Error("Operacao de produto retornou um marcador de exclusao inesperado.");
  }
}

function assertProductDeleteResult(
  value: OperationsProductRecord | DeletedOperationsProductDocument,
): asserts value is DeletedOperationsProductDocument {
  if (!("deleted" in value) || value.deleted !== true) {
    throw new Error("Operacao de exclusao do produto nao gerou marcador de exclusao.");
  }
}

async function assertProductCanBeDeleted(product: OperationsProductRecord) {
  const [movementsPayload, lotsPayload] = await Promise.all([
    listInventoryMovements(),
    listLots(),
  ]);
  const reasons = new Set<string>();
  const normalizedSku = normalizeSku(product.sku);
  const normalizedProductName = normalizeProductReference(product.product);

  if (
    movementsPayload.items.some(
      (movement) =>
        (movement.productId && normalizeSku(movement.productId) === normalizedSku) ||
        (!movement.productId &&
          normalizeProductReference(movement.product) === normalizedProductName),
    )
  ) {
    reasons.add("MOVEMENTS");
  }

  if (
    lotsPayload.items.some(
      (lot) =>
        (lot.productId && normalizeSku(lot.productId) === normalizedSku) ||
        (!lot.productId &&
          normalizeProductReference(lot.product) === normalizedProductName),
    )
  ) {
    reasons.add("LOTS");
  }

  if (reasons.size === 0) {
    return;
  }

  throw new OperationsProductInUseError(
    "O produto possui vinculos operacionais e nao pode ser excluido.",
    [...reasons],
  );
}

function buildLegacyProductRecord(
  product: ProductLineItem,
  updatedAt: string | null,
): OperationsProductRecord {
  return {
    ...product,
    version: 1,
    updatedAt,
  };
}

async function readLegacyProductsSnapshot() {
  return readErpResource(PRODUCTS_RESOURCE_ID);
}

function mergeOperationsProducts(
  itemizedProducts: readonly OperationsProductMergeEntry[],
  legacyProducts: readonly ProductLineItem[],
  legacyUpdatedAt: string | null,
) {
  const merged = new Map<string, OperationsProductRecord>();
  const deletedSkus = new Set<string>();

  for (const entry of itemizedProducts) {
    if (entry.type === "deleted") {
      deletedSkus.add(entry.product.sku);
      merged.delete(entry.product.sku);
      continue;
    }

    merged.set(entry.product.sku, entry.product);
  }

  for (const legacyProduct of legacyProducts) {
    const sku = normalizeSku(legacyProduct.sku);

    if (!deletedSkus.has(sku) && !merged.has(sku)) {
      merged.set(
        sku,
        buildLegacyProductRecord(
          {
            ...legacyProduct,
            sku,
          },
          legacyUpdatedAt,
        ),
      );
    }
  }

  return sortProducts([...merged.values()]);
}

async function listFirebaseOperationsProducts() {
  const [snapshot, legacyResource] = await Promise.all([
    getFirebaseAdminDb()
      .collection<StoredOperationsProductEntry>(OPERATIONS_PRODUCTS_COLLECTION)
      .get(),
    readLegacyProductsSnapshot(),
  ]);

  const itemizedProducts = snapshot.docs
    .map((document) =>
      normalizeStoredProductEntry(document.id, document.data()),
    )
    .filter(
      (document): document is OperationsProductMergeEntry => document !== null,
    );

  return mergeOperationsProducts(
    itemizedProducts,
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

async function listFileOperationsProducts() {
  const [store, legacyResource] = await Promise.all([
    readOperationsProductsFileStore(),
    readLegacyProductsSnapshot(),
  ]);

  return mergeOperationsProducts(
    Object.values(store.items).map(toProductMergeEntry),
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

async function readFirebaseOperationsProduct(
  sku: string,
): Promise<OperationsProductItemRecord> {
  const normalizedSku = normalizeSku(sku);
  const snapshot = await getFirebaseAdminDb()
    .collection<StoredOperationsProductEntry>(OPERATIONS_PRODUCTS_COLLECTION)
    .doc(normalizedSku)
    .get();

  if (snapshot.exists) {
    const deletedProduct = normalizeDeletedProductDocument(
      normalizedSku,
      snapshot.data(),
    );

    if (deletedProduct) {
      return {
        product: null,
        exists: false,
        deleted: true,
      };
    }

    const product = normalizeStoredProductDocument(
      normalizedSku,
      snapshot.data(),
    );

    if (product) {
      return {
        product,
        exists: true,
      };
    }
  }

  const legacyResource = await readLegacyProductsSnapshot();
  const legacyProduct = legacyResource.data.find(
    (candidate) => candidate.sku === normalizedSku,
  );

  if (!legacyProduct) {
    return {
      product: null,
      exists: false,
    };
  }

  return {
    product: buildLegacyProductRecord(legacyProduct, legacyResource.updatedAt),
    exists: true,
  };
}

async function readFileOperationsProduct(
  sku: string,
): Promise<OperationsProductItemRecord> {
  const normalizedSku = normalizeSku(sku);
  const store = await readOperationsProductsFileStore();
  const document = store.items[normalizedSku] ?? null;

  if (document && "deleted" in document && document.deleted === true) {
    return {
      product: null,
      exists: false,
      deleted: true,
    };
  }

  if (document) {
    return {
      product: document,
      exists: true,
    };
  }

  const legacyResource = await readLegacyProductsSnapshot();
  const legacyProduct = legacyResource.data.find(
    (candidate) => candidate.sku === normalizedSku,
  );

  if (!legacyProduct) {
    return {
      product: null,
      exists: false,
    };
  }

  return {
    product: buildLegacyProductRecord(legacyProduct, legacyResource.updatedAt),
    exists: true,
  };
}

async function writeFirebaseProductDocument(
  sku: string,
  update: (
    current: OperationsProductRecord | null,
  ) => Promise<ProductDocumentMutationResult>,
) {
  const normalizedSku = normalizeSku(sku);
  const database = getFirebaseAdminDb();
  const legacyResource = await readLegacyProductsSnapshot();
  const legacyProduct = legacyResource.data.find(
    (candidate) => candidate.sku === normalizedSku,
  );
  const collectionRef =
    database.collection<StoredOperationsProductEntry>(
      OPERATIONS_PRODUCTS_COLLECTION,
    );
  const documentRef = collectionRef.doc(normalizedSku);

  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(documentRef);
    const deletedProduct = snapshot.exists
      ? normalizeDeletedProductDocument(normalizedSku, snapshot.data())
      : null;
    const current = snapshot.exists
      ? deletedProduct
        ? null
        : normalizeStoredProductDocument(normalizedSku, snapshot.data())
      : legacyProduct
        ? buildLegacyProductRecord(legacyProduct, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    if (next.type === "delete") {
      const deletedAt = new Date().toISOString();
      const deletedDocument: DeletedOperationsProductDocument = {
        sku: normalizedSku,
        deleted: true,
        deletedAt,
        updatedAt: deletedAt,
        version: next.value.version + 1,
      };

      transaction.set(documentRef, deletedDocument, { merge: false });
      return deletedDocument;
    }

    const nextDocument: StoredOperationsProductDocument = {
      ...next.value,
      updatedAt: new Date().toISOString(),
      version: current ? current.version + 1 : 1,
    };

    transaction.set(documentRef, nextDocument, { merge: false });
    return nextDocument;
  });
}

async function writeFileProductDocument(
  sku: string,
  update: (
    current: OperationsProductRecord | null,
  ) => Promise<ProductDocumentMutationResult>,
) {
  return queueFileWrite(async () => {
    const normalizedSku = normalizeSku(sku);
    const filePath = getOperationsProductsFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });

    const [store, legacyResource] = await Promise.all([
      readOperationsProductsFileStore(),
      readLegacyProductsSnapshot(),
    ]);
    const legacyProduct = legacyResource.data.find(
      (candidate) => candidate.sku === normalizedSku,
    );
    const existingDocument = store.items[normalizedSku] ?? null;
    const current: OperationsProductRecord | null = existingDocument
      ? "deleted" in existingDocument && existingDocument.deleted === true
        ? null
        : existingDocument
      : legacyProduct
        ? buildLegacyProductRecord(legacyProduct, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    if (next.type === "delete") {
      const deletedAt = new Date().toISOString();
      const deletedDocument: DeletedOperationsProductDocument = {
        sku: normalizedSku,
        deleted: true,
        deletedAt,
        updatedAt: deletedAt,
        version: next.value.version + 1,
      };

      store.items[normalizedSku] = deletedDocument;
      await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
      return deletedDocument;
    }

    const nextDocument: StoredOperationsProductDocument = {
      ...next.value,
      updatedAt: new Date().toISOString(),
      version: current ? current.version + 1 : 1,
    };

    store.items[normalizedSku] = nextDocument;
    await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
    return nextDocument;
  });
}

async function writeProductDocument(
  sku: string,
  update: (
    current: OperationsProductRecord | null,
  ) => Promise<ProductDocumentMutationResult>,
) {
  if (getOperationsProductsPersistenceProvider() === "firebase") {
    return writeFirebaseProductDocument(sku, update);
  }

  return writeFileProductDocument(sku, update);
}

export function getOperationsProductsPersistenceProvider() {
  return getServerPersistenceProvider("produtos de operacoes");
}

export async function listProducts(): Promise<ListOperationsProductsResult> {
  const items =
    getOperationsProductsPersistenceProvider() === "firebase"
      ? await listFirebaseOperationsProducts()
      : await listFileOperationsProducts();

  return {
    items,
    count: items.length,
  };
}

export async function getProductBySku(sku: string) {
  const normalizedSku = normalizeSku(sku);
  const result =
    getOperationsProductsPersistenceProvider() === "firebase"
      ? await readFirebaseOperationsProduct(normalizedSku)
      : await readFileOperationsProduct(normalizedSku);

  if (!result.exists || !result.product) {
    throw new OperationsProductNotFoundError("Produto nao encontrado.");
  }

  return result.product;
}

export async function createProduct(
  product: unknown,
): Promise<OperationsProductRecord> {
  const normalized = validateProductWritePayload(product);

  const createdProduct = await writeProductDocument(
    normalized.sku,
    async (current) => {
      if (current) {
        throw new ErpResourceValidationError(
          "Ja existe um produto com o sku informado.",
          409,
        );
      }

      return {
        type: "set",
        value: normalized,
      };
    },
  );

  assertProductWriteResult(createdProduct);
  return createdProduct;
}

export async function updateProduct(
  sku: string,
  productPatch: unknown,
  baseVersion: number,
) {
  const normalizedSku = normalizeSku(sku);
  const updatedProduct = await writeProductDocument(
    normalizedSku,
    async (current) => {
      assertBaseVersion(current, baseVersion);

      if (
        !productPatch ||
        typeof productPatch !== "object" ||
        Array.isArray(productPatch)
      ) {
        throw new ErpResourceValidationError("Carga invalida para o produto.");
      }

      const candidateSku = (productPatch as { sku?: unknown }).sku;

      if (
        candidateSku !== undefined &&
        (typeof candidateSku !== "string" ||
          normalizeSku(candidateSku) !== normalizedSku)
      ) {
        throw new ErpResourceValidationError(
          "O sku do produto precisa corresponder ao sku da rota.",
        );
      }

      const merged = validateProductWritePayload(
        {
          ...toProductPayload(current),
          ...productPatch,
          sku: normalizedSku,
        },
        normalizedSku,
      );

      const currentPayload = toProductPayload(current);

      if (currentPayload && areProductPayloadsEqual(currentPayload, merged)) {
        return {
          type: "noop",
          value: current,
        } satisfies ProductDocumentMutationResult;
      }

      return {
        type: "set",
        value: merged,
      } satisfies ProductDocumentMutationResult;
    },
  );

  assertProductWriteResult(updatedProduct);
  return updatedProduct;
}

export async function deleteProduct(
  sku: string,
  baseVersion: number,
): Promise<DeleteOperationsProductResult> {
  const normalizedSku = normalizeSku(sku);
  const deletedProduct = await writeProductDocument(
    normalizedSku,
    async (current) => {
      assertBaseVersion(current, baseVersion);
      await assertProductCanBeDeleted(current);

      return {
        type: "delete",
        value: current,
      } satisfies ProductDocumentMutationResult;
    },
  );

  assertProductDeleteResult(deletedProduct);

  return {
    sku: deletedProduct.sku,
    version: deletedProduct.version,
    deletedAt: deletedProduct.deletedAt,
  };
}
