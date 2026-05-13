import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { CategoryItem } from "@/lib/operations-data";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import {
  ErpResourceValidationError,
  sanitizeStoredErpResourceItemData,
  validateErpResourceItemData,
} from "@/lib/server/erp-resource-schema";
import { readErpResource } from "@/lib/server/erp-state";
import { getServerPersistenceProvider } from "@/lib/server/server-persistence";

const CATEGORIES_COLLECTION = "categories";
const CATEGORIES_RESOURCE_ID = "operations.categories";
const DEFAULT_CATEGORIES_FILE = path.join(
  process.cwd(),
  ".data",
  "categories-items.json",
);

let fileWriteQueue = Promise.resolve();

type CategoryVersion = number;

type StoredCategoryDocument = CategoryItem & {
  id: string;
  version: CategoryVersion;
  updatedAt: string | null;
  deleted?: false;
};

type DeletedCategoryDocument = {
  id: string;
  deleted: true;
  deletedAt: string;
  version: CategoryVersion;
  updatedAt: string | null;
};

type CategoryRecordLookup = {
  item: CategoryRecord | null;
  exists: boolean;
};

type CategoryMergeEntry =
  | { type: "item"; item: StoredCategoryDocument }
  | { type: "deleted"; item: DeletedCategoryDocument };

type StoredCategoryEntry =
  | StoredCategoryDocument
  | DeletedCategoryDocument;

type DeleteCategoryResult = {
  id: string;
  version: CategoryVersion;
  deletedAt: string;
};

type CategoriesFileStore = {
  items?: Record<string, StoredCategoryEntry>;
};

export type CategoryRecord = CategoryItem & {
  id: string;
  version: CategoryVersion;
  updatedAt: string | null;
};

export type ListCategoriesResult = {
  items: CategoryRecord[];
  count: number;
};

export type UpdateCategoryOptions = {
  baseVersion: number;
};

type CategoryMutationResult =
  | { type: "set"; value: CategoryItem & { id: string } }
  | { type: "noop"; value: CategoryRecord }
  | { type: "delete"; value: CategoryRecord };

export class CategoryConflictError extends Error {
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

export class CategoryNotFoundError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.status = 404;
  }
}

export function requireCategoryBaseVersion(
  value: unknown,
  operation: string,
) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ErpResourceValidationError(
      `baseVersion obrigatorio para ${operation} a categoria.`,
      400,
    );
  }

  return value;
}

export function getCategoryVersionConflictPayload(
  error: CategoryConflictError,
) {
  return {
    error: "VERSION_CONFLICT" as const,
    currentVersion: error.currentVersion,
  };
}

function normalizeReference(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeCategoryId(value: string) {
  return value.trim();
}

function getLegacyCategoryId(item: Pick<CategoryItem, "name">) {
  const key = normalizeReference(item.name);
  const digest = createHash("sha1").update(key).digest("hex").slice(0, 16);
  return `category_${digest}`;
}

function getCategoryId(item: CategoryItem) {
  return typeof item.id === "string" && item.id.trim()
    ? normalizeCategoryId(item.id)
    : getLegacyCategoryId(item);
}

function getCategoriesFilePath() {
  return process.env.CATEGORIES_FILE_PATH
    ? path.resolve(process.cwd(), process.env.CATEGORIES_FILE_PATH)
    : DEFAULT_CATEGORIES_FILE;
}

function queueFileWrite<T>(operation: () => Promise<T>) {
  const nextOperation = fileWriteQueue.then(operation, operation);
  fileWriteQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );
  return nextOperation;
}

function normalizeVersion(value: unknown) {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1
    ? value
    : 1;
}

function normalizeUpdatedAt(value: unknown) {
  return typeof value === "string" ? value : null;
}

function normalizeStoredCategoryDocument(
  categoryId: string,
  value: unknown,
): StoredCategoryDocument | null {
  const sanitized = sanitizeStoredErpResourceItemData(
    CATEGORIES_RESOURCE_ID,
    value,
  );
  const item = sanitized.item;

  if (!item) {
    return null;
  }

  const resolvedId = getCategoryId(item);

  if (resolvedId !== categoryId) {
    return null;
  }

  const candidate = value as Partial<StoredCategoryDocument>;

  return {
    ...item,
    id: categoryId,
    version: normalizeVersion(candidate.version),
    updatedAt: normalizeUpdatedAt(candidate.updatedAt),
  };
}

function normalizeDeletedCategoryDocument(
  categoryId: string,
  value: unknown,
): DeletedCategoryDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<DeletedCategoryDocument>;

  if (
    candidate.deleted !== true ||
    candidate.id !== categoryId ||
    typeof candidate.deletedAt !== "string"
  ) {
    return null;
  }

  return {
    id: categoryId,
    deleted: true,
    deletedAt: candidate.deletedAt,
    version: normalizeVersion(candidate.version),
    updatedAt: normalizeUpdatedAt(candidate.updatedAt),
  };
}

function normalizeStoredCategoryEntry(
  categoryId: string,
  value: unknown,
): CategoryMergeEntry | null {
  const deletedCategory = normalizeDeletedCategoryDocument(categoryId, value);

  if (deletedCategory) {
    return {
      type: "deleted",
      item: deletedCategory,
    };
  }

  const item = normalizeStoredCategoryDocument(categoryId, value);

  if (!item) {
    return null;
  }

  return {
    type: "item",
    item,
  };
}

function toStoredCategoryEntry(
  entry: CategoryMergeEntry,
): StoredCategoryEntry {
  return entry.item;
}

function toCategoryMergeEntry(
  document: StoredCategoryEntry,
): CategoryMergeEntry {
  if ("deleted" in document && document.deleted === true) {
    return {
      type: "deleted",
      item: document,
    };
  }

  return {
    type: "item",
    item: document,
  };
}

function normalizeFileItems(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, StoredCategoryEntry>;
  }

  const items: Record<string, StoredCategoryEntry> = {};

  for (const [categoryId, candidate] of Object.entries(value)) {
    const normalized = normalizeStoredCategoryEntry(categoryId, candidate);

    if (normalized) {
      items[categoryId] = toStoredCategoryEntry(normalized);
    }
  }

  return items;
}

async function readCategoriesFileStore() {
  try {
    const raw = await readFile(getCategoriesFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        items: {},
      } satisfies Required<CategoriesFileStore>;
    }

    const value = parsed as CategoriesFileStore;

    return {
      items: normalizeFileItems(value.items),
    } satisfies Required<CategoriesFileStore>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        items: {},
      } satisfies Required<CategoriesFileStore>;
    }

    throw error;
  }
}

function areCategoryPayloadsEqual(left: CategoryItem, right: CategoryItem) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toCategoryPayload(
  item: CategoryRecord | null,
): (CategoryItem & { id: string }) | null {
  if (!item) {
    return null;
  }

  const payload = { ...item } as Partial<CategoryRecord>;
  delete payload.version;
  delete payload.updatedAt;
  return payload as CategoryItem & { id: string };
}

function validateCategoryWritePayload(
  value: unknown,
  categoryId?: string,
) {
  const normalized = validateErpResourceItemData(CATEGORIES_RESOURCE_ID, value);
  const candidateId =
    typeof normalized.id === "string" && normalized.id.trim()
      ? normalizeCategoryId(normalized.id)
      : undefined;

  if (categoryId && candidateId && candidateId !== categoryId) {
    throw new ErpResourceValidationError(
      "O id da categoria precisa corresponder ao id da rota.",
    );
  }

  return {
    ...normalized,
    id: categoryId ?? candidateId ?? getLegacyCategoryId(normalized),
  };
}

function assertBaseVersion(
  current: CategoryRecord | null,
  baseVersion: number,
): asserts current is CategoryRecord {
  if (!Number.isInteger(baseVersion) || baseVersion < 1) {
    throw new ErpResourceValidationError(
      "Versao base invalida para a categoria.",
    );
  }

  if (!current) {
    throw new CategoryNotFoundError("Categoria nao encontrada.");
  }

  if (current.version === baseVersion) {
    return;
  }

  throw new CategoryConflictError(
    "A categoria foi alterada por outra sessao. Recarregue os dados antes de salvar novamente.",
    current.version,
    current.updatedAt,
  );
}

function assertCategoryWriteResult(
  value: CategoryRecord | DeletedCategoryDocument,
): asserts value is CategoryRecord {
  if ("deleted" in value && value.deleted === true) {
    throw new Error(
      "Operacao de categoria retornou um marcador de exclusao inesperado.",
    );
  }
}

function assertCategoryDeleteResult(
  value: CategoryRecord | DeletedCategoryDocument,
): asserts value is DeletedCategoryDocument {
  if (!("deleted" in value) || value.deleted !== true) {
    throw new Error(
      "Operacao de exclusao da categoria nao gerou marcador de exclusao.",
    );
  }
}

function buildLegacyCategoryRecord(
  item: CategoryItem,
  updatedAt: string | null,
): CategoryRecord {
  return {
    ...item,
    id: getCategoryId(item),
    version: 1,
    updatedAt,
  };
}

async function readLegacyCategoriesSnapshot() {
  return readErpResource(CATEGORIES_RESOURCE_ID);
}

function mergeCategories(
  itemizedEntries: readonly CategoryMergeEntry[],
  legacyItems: readonly CategoryItem[],
  legacyUpdatedAt: string | null,
) {
  const activeEntries = new Map<string, CategoryRecord>();
  const deletedCategoryIds = new Set<string>();
  const consumedIds = new Set<string>();

  for (const entry of itemizedEntries) {
    if (entry.type === "deleted") {
      deletedCategoryIds.add(entry.item.id);
      activeEntries.delete(entry.item.id);
      continue;
    }

    activeEntries.set(entry.item.id, entry.item);
  }

  const mergedLegacyItems: CategoryRecord[] = [];

  for (const legacyItem of legacyItems) {
    const categoryId = getCategoryId(legacyItem);

    if (deletedCategoryIds.has(categoryId)) {
      continue;
    }

    const itemizedEntry = activeEntries.get(categoryId);

    if (itemizedEntry) {
      mergedLegacyItems.push(itemizedEntry);
      consumedIds.add(categoryId);
      continue;
    }

    mergedLegacyItems.push(
      buildLegacyCategoryRecord(legacyItem, legacyUpdatedAt),
    );
  }

  const createdCategories = [...activeEntries.values()]
    .filter((item) => !consumedIds.has(item.id))
    .sort((left, right) => {
      const leftUpdatedAt = left.updatedAt ?? "";
      const rightUpdatedAt = right.updatedAt ?? "";

      if (leftUpdatedAt !== rightUpdatedAt) {
        return rightUpdatedAt.localeCompare(leftUpdatedAt);
      }

      return left.name.localeCompare(right.name);
    });

  return [...createdCategories, ...mergedLegacyItems];
}

async function assertCategoryNameUnique(name: string, currentId?: string) {
  const normalizedName = normalizeReference(name);
  const payload = await listCategories();
  const conflictingItem = payload.items.find(
    (item) =>
      normalizeReference(item.name) === normalizedName &&
      item.id !== currentId,
  );

  if (conflictingItem) {
    throw new ErpResourceValidationError(
      "Ja existe uma categoria com esse nome.",
      409,
    );
  }
}

async function listFirebaseCategories() {
  const [snapshot, legacyResource] = await Promise.all([
    getFirebaseAdminDb()
      .collection<StoredCategoryEntry>(CATEGORIES_COLLECTION)
      .get(),
    readLegacyCategoriesSnapshot(),
  ]);

  const itemizedEntries = snapshot.docs
    .map((document) =>
      normalizeStoredCategoryEntry(document.id, document.data()),
    )
    .filter((document): document is CategoryMergeEntry => document !== null)
    .sort((left, right) => left.item.id.localeCompare(right.item.id));

  return mergeCategories(
    itemizedEntries,
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

async function listFileCategories() {
  const [store, legacyResource] = await Promise.all([
    readCategoriesFileStore(),
    readLegacyCategoriesSnapshot(),
  ]);

  return mergeCategories(
    Object.values(store.items)
      .map((document) => toCategoryMergeEntry(document))
      .sort((left, right) => left.item.id.localeCompare(right.item.id)),
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

function findLegacyCategory(
  items: readonly CategoryItem[],
  categoryId: string,
) {
  return items.find((candidate) => getCategoryId(candidate) === categoryId);
}

async function readFirebaseCategory(
  categoryId: string,
): Promise<CategoryRecordLookup> {
  const snapshot = await getFirebaseAdminDb()
    .collection<StoredCategoryEntry>(CATEGORIES_COLLECTION)
    .doc(categoryId)
    .get();

  if (snapshot.exists) {
    const deletedItem = normalizeDeletedCategoryDocument(
      categoryId,
      snapshot.data(),
    );

    if (deletedItem) {
      return {
        item: null,
        exists: false,
      };
    }

    const item = normalizeStoredCategoryDocument(
      categoryId,
      snapshot.data(),
    );

    if (item) {
      return {
        item,
        exists: true,
      };
    }
  }

  const legacyResource = await readLegacyCategoriesSnapshot();
  const legacyItem = findLegacyCategory(legacyResource.data, categoryId);

  if (!legacyItem) {
    return {
      item: null,
      exists: false,
    };
  }

  return {
    item: buildLegacyCategoryRecord(legacyItem, legacyResource.updatedAt),
    exists: true,
  };
}

async function readFileCategory(
  categoryId: string,
): Promise<CategoryRecordLookup> {
  const store = await readCategoriesFileStore();
  const existingDocument = store.items[categoryId] ?? null;

  if (existingDocument) {
    if ("deleted" in existingDocument && existingDocument.deleted === true) {
      return {
        item: null,
        exists: false,
      };
    }

    return {
      item: existingDocument,
      exists: true,
    };
  }

  const legacyResource = await readLegacyCategoriesSnapshot();
  const legacyItem = findLegacyCategory(legacyResource.data, categoryId);

  if (!legacyItem) {
    return {
      item: null,
      exists: false,
    };
  }

  return {
    item: buildLegacyCategoryRecord(legacyItem, legacyResource.updatedAt),
    exists: true,
  };
}

async function writeFirebaseCategory(
  categoryId: string,
  update: (
    current: CategoryRecord | null,
  ) => Promise<CategoryMutationResult>,
) {
  const database = getFirebaseAdminDb();
  const legacyResource = await readLegacyCategoriesSnapshot();
  const legacyItem = findLegacyCategory(legacyResource.data, categoryId);
  const collectionRef =
    database.collection<StoredCategoryEntry>(CATEGORIES_COLLECTION);
  const documentRef = collectionRef.doc(categoryId);

  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(documentRef);
    const deletedItem = snapshot.exists
      ? normalizeDeletedCategoryDocument(categoryId, snapshot.data())
      : null;
    const current = snapshot.exists
      ? deletedItem
        ? null
        : normalizeStoredCategoryDocument(categoryId, snapshot.data())
      : legacyItem
        ? buildLegacyCategoryRecord(legacyItem, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    const now = new Date().toISOString();

    if (next.type === "delete") {
      const deletedCategory: DeletedCategoryDocument = {
        id: categoryId,
        deleted: true,
        deletedAt: now,
        version: next.value.version + 1,
        updatedAt: now,
      };

      transaction.set(documentRef, deletedCategory, { merge: false });
      return deletedCategory;
    }

    const nextDocument: StoredCategoryDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
      updatedAt: now,
    };

    transaction.set(documentRef, nextDocument, { merge: false });
    return nextDocument;
  });
}

async function writeFileCategory(
  categoryId: string,
  update: (
    current: CategoryRecord | null,
  ) => Promise<CategoryMutationResult>,
) {
  return queueFileWrite(async () => {
    const filePath = getCategoriesFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });

    const [store, legacyResource] = await Promise.all([
      readCategoriesFileStore(),
      readLegacyCategoriesSnapshot(),
    ]);
    const legacyItem = findLegacyCategory(legacyResource.data, categoryId);
    const existingDocument = store.items[categoryId] ?? null;
    const current: CategoryRecord | null = existingDocument
      ? "deleted" in existingDocument && existingDocument.deleted === true
        ? null
        : existingDocument
      : legacyItem
        ? buildLegacyCategoryRecord(legacyItem, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    const now = new Date().toISOString();

    if (next.type === "delete") {
      const deletedCategory: DeletedCategoryDocument = {
        id: categoryId,
        deleted: true,
        deletedAt: now,
        version: next.value.version + 1,
        updatedAt: now,
      };

      store.items[categoryId] = deletedCategory;
      await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
      return deletedCategory;
    }

    const nextDocument: StoredCategoryDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
      updatedAt: now,
    };

    store.items[categoryId] = nextDocument;
    await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
    return nextDocument;
  });
}

async function writeCategory(
  categoryId: string,
  update: (
    current: CategoryRecord | null,
  ) => Promise<CategoryMutationResult>,
) {
  if (getCategoriesPersistenceProvider() === "firebase") {
    return writeFirebaseCategory(categoryId, update);
  }

  return writeFileCategory(categoryId, update);
}

export function getCategoriesPersistenceProvider() {
  return getServerPersistenceProvider("categorias");
}

export async function listCategories(): Promise<ListCategoriesResult> {
  const items =
    getCategoriesPersistenceProvider() === "firebase"
      ? await listFirebaseCategories()
      : await listFileCategories();

  return {
    items,
    count: items.length,
  };
}

export async function getCategoryById(categoryId: string) {
  const result =
    getCategoriesPersistenceProvider() === "firebase"
      ? await readFirebaseCategory(categoryId)
      : await readFileCategory(categoryId);

  if (!result.exists || !result.item) {
    throw new CategoryNotFoundError("Categoria nao encontrada.");
  }

  return result.item;
}

export async function createCategory(
  item: unknown,
): Promise<CategoryRecord> {
  const normalized = validateCategoryWritePayload(item);
  await assertCategoryNameUnique(normalized.name);

  const createdItem = await writeCategory(
    normalized.id,
    async (current) => {
      if (current) {
        throw new ErpResourceValidationError(
          "Ja existe uma categoria com o id informado.",
          409,
        );
      }

      return {
        type: "set",
        value: normalized,
      };
    },
  );

  assertCategoryWriteResult(createdItem);
  return createdItem;
}

export async function updateCategory(
  categoryId: string,
  itemPatch: unknown,
  options: UpdateCategoryOptions,
) {
  const currentItem = await getCategoryById(categoryId);
  const nextName =
    itemPatch &&
    typeof itemPatch === "object" &&
    !Array.isArray(itemPatch) &&
    typeof (itemPatch as { name?: unknown }).name === "string"
      ? (itemPatch as { name: string }).name
      : currentItem.name;

  await assertCategoryNameUnique(nextName, categoryId);

  const updatedItem = await writeCategory(
    categoryId,
    async (current) => {
      assertBaseVersion(current, options.baseVersion);

      if (!itemPatch || typeof itemPatch !== "object" || Array.isArray(itemPatch)) {
        throw new ErpResourceValidationError(
          "Carga invalida para a categoria.",
        );
      }

      const candidateId = (itemPatch as { id?: unknown }).id;

      if (
        candidateId !== undefined &&
        (typeof candidateId !== "string" ||
          normalizeCategoryId(candidateId) !== categoryId)
      ) {
        throw new ErpResourceValidationError(
          "O id da categoria precisa corresponder ao id da rota.",
        );
      }

      const merged = validateCategoryWritePayload(
        {
          ...toCategoryPayload(current),
          ...itemPatch,
          id: categoryId,
        },
        categoryId,
      );

      const currentPayload = toCategoryPayload(current);

      if (
        currentPayload &&
        areCategoryPayloadsEqual(currentPayload, merged)
      ) {
        return {
          type: "noop",
          value: current,
        } satisfies CategoryMutationResult;
      }

      return {
        type: "set",
        value: merged,
      } satisfies CategoryMutationResult;
    },
  );

  assertCategoryWriteResult(updatedItem);
  return updatedItem;
}

export async function deleteCategory(
  categoryId: string,
  baseVersion: number,
): Promise<DeleteCategoryResult> {
  const deletedItem = await writeCategory(
    categoryId,
    async (current) => {
      assertBaseVersion(current, baseVersion);

      return {
        type: "delete",
        value: current,
      } satisfies CategoryMutationResult;
    },
  );

  assertCategoryDeleteResult(deletedItem);

  return {
    id: deletedItem.id,
    version: deletedItem.version,
    deletedAt: deletedItem.deletedAt,
  };
}
