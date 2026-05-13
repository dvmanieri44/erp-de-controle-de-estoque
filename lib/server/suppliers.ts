import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { SupplierItem } from "@/lib/operations-data";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import {
  ErpResourceValidationError,
  sanitizeStoredErpResourceItemData,
  validateErpResourceItemData,
} from "@/lib/server/erp-resource-schema";
import { readErpResource } from "@/lib/server/erp-state";
import { getServerPersistenceProvider } from "@/lib/server/server-persistence";

const SUPPLIERS_COLLECTION = "suppliers";
const SUPPLIERS_RESOURCE_ID = "operations.suppliers";
const DEFAULT_SUPPLIERS_FILE = path.join(
  process.cwd(),
  ".data",
  "suppliers-items.json",
);

let fileWriteQueue = Promise.resolve();

type SupplierVersion = number;

type StoredSupplierDocument = SupplierItem & {
  id: string;
  version: SupplierVersion;
  updatedAt: string | null;
  deleted?: false;
};

type DeletedSupplierDocument = {
  id: string;
  deleted: true;
  deletedAt: string;
  version: SupplierVersion;
  updatedAt: string | null;
};

type SupplierRecordLookup = {
  item: SupplierRecord | null;
  exists: boolean;
};

type SupplierMergeEntry =
  | { type: "item"; item: StoredSupplierDocument }
  | { type: "deleted"; item: DeletedSupplierDocument };

type StoredSupplierEntry =
  | StoredSupplierDocument
  | DeletedSupplierDocument;

type DeleteSupplierResult = {
  id: string;
  version: SupplierVersion;
  deletedAt: string;
};

type SuppliersFileStore = {
  items?: Record<string, StoredSupplierEntry>;
};

export type SupplierRecord = SupplierItem & {
  id: string;
  version: SupplierVersion;
  updatedAt: string | null;
};

export type ListSuppliersResult = {
  items: SupplierRecord[];
  count: number;
};

export type UpdateSupplierOptions = {
  baseVersion: number;
};

type SupplierMutationResult =
  | { type: "set"; value: SupplierItem & { id: string } }
  | { type: "noop"; value: SupplierRecord }
  | { type: "delete"; value: SupplierRecord };

export class SupplierConflictError extends Error {
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

export class SupplierNotFoundError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.status = 404;
  }
}

export function requireSupplierBaseVersion(
  value: unknown,
  operation: string,
) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ErpResourceValidationError(
      `baseVersion obrigatorio para ${operation} o fornecedor.`,
      400,
    );
  }

  return value;
}

export function getSupplierVersionConflictPayload(
  error: SupplierConflictError,
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

function normalizeSupplierId(value: string) {
  return value.trim();
}

function getLegacySupplierId(item: Pick<SupplierItem, "name">) {
  const key = normalizeReference(item.name);
  const digest = createHash("sha1").update(key).digest("hex").slice(0, 16);
  return `supplier_${digest}`;
}

function getSupplierId(item: SupplierItem) {
  return typeof item.id === "string" && item.id.trim()
    ? normalizeSupplierId(item.id)
    : getLegacySupplierId(item);
}

function getSuppliersFilePath() {
  return process.env.SUPPLIERS_FILE_PATH
    ? path.resolve(process.cwd(), process.env.SUPPLIERS_FILE_PATH)
    : DEFAULT_SUPPLIERS_FILE;
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

function normalizeStoredSupplierDocument(
  supplierId: string,
  value: unknown,
): StoredSupplierDocument | null {
  const sanitized = sanitizeStoredErpResourceItemData(
    SUPPLIERS_RESOURCE_ID,
    value,
  );
  const item = sanitized.item;

  if (!item) {
    return null;
  }

  const resolvedId = getSupplierId(item);

  if (resolvedId !== supplierId) {
    return null;
  }

  const candidate = value as Partial<StoredSupplierDocument>;

  return {
    ...item,
    id: supplierId,
    version: normalizeVersion(candidate.version),
    updatedAt: normalizeUpdatedAt(candidate.updatedAt),
  };
}

function normalizeDeletedSupplierDocument(
  supplierId: string,
  value: unknown,
): DeletedSupplierDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<DeletedSupplierDocument>;

  if (
    candidate.deleted !== true ||
    candidate.id !== supplierId ||
    typeof candidate.deletedAt !== "string"
  ) {
    return null;
  }

  return {
    id: supplierId,
    deleted: true,
    deletedAt: candidate.deletedAt,
    version: normalizeVersion(candidate.version),
    updatedAt: normalizeUpdatedAt(candidate.updatedAt),
  };
}

function normalizeStoredSupplierEntry(
  supplierId: string,
  value: unknown,
): SupplierMergeEntry | null {
  const deletedSupplier = normalizeDeletedSupplierDocument(
    supplierId,
    value,
  );

  if (deletedSupplier) {
    return {
      type: "deleted",
      item: deletedSupplier,
    };
  }

  const item = normalizeStoredSupplierDocument(supplierId, value);

  if (!item) {
    return null;
  }

  return {
    type: "item",
    item,
  };
}

function toStoredSupplierEntry(
  entry: SupplierMergeEntry,
): StoredSupplierEntry {
  return entry.item;
}

function toSupplierMergeEntry(
  document: StoredSupplierEntry,
): SupplierMergeEntry {
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
    return {} as Record<string, StoredSupplierEntry>;
  }

  const items: Record<string, StoredSupplierEntry> = {};

  for (const [supplierId, candidate] of Object.entries(value)) {
    const normalized = normalizeStoredSupplierEntry(supplierId, candidate);

    if (normalized) {
      items[supplierId] = toStoredSupplierEntry(normalized);
    }
  }

  return items;
}

async function readSuppliersFileStore() {
  try {
    const raw = await readFile(getSuppliersFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        items: {},
      } satisfies Required<SuppliersFileStore>;
    }

    const value = parsed as SuppliersFileStore;

    return {
      items: normalizeFileItems(value.items),
    } satisfies Required<SuppliersFileStore>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        items: {},
      } satisfies Required<SuppliersFileStore>;
    }

    throw error;
  }
}

function areSupplierPayloadsEqual(left: SupplierItem, right: SupplierItem) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toSupplierPayload(
  item: SupplierRecord | null,
): (SupplierItem & { id: string }) | null {
  if (!item) {
    return null;
  }

  const payload = { ...item } as Partial<SupplierRecord>;
  delete payload.version;
  delete payload.updatedAt;
  return payload as SupplierItem & { id: string };
}

function validateSupplierWritePayload(
  value: unknown,
  supplierId?: string,
) {
  const normalized = validateErpResourceItemData(SUPPLIERS_RESOURCE_ID, value);
  const candidateId =
    typeof normalized.id === "string" && normalized.id.trim()
      ? normalizeSupplierId(normalized.id)
      : undefined;

  if (supplierId && candidateId && candidateId !== supplierId) {
    throw new ErpResourceValidationError(
      "O id do fornecedor precisa corresponder ao id da rota.",
    );
  }

  return {
    ...normalized,
    id: supplierId ?? candidateId ?? getLegacySupplierId(normalized),
  };
}

function assertBaseVersion(
  current: SupplierRecord | null,
  baseVersion: number,
): asserts current is SupplierRecord {
  if (!Number.isInteger(baseVersion) || baseVersion < 1) {
    throw new ErpResourceValidationError(
      "Versao base invalida para o fornecedor.",
    );
  }

  if (!current) {
    throw new SupplierNotFoundError("Fornecedor nao encontrado.");
  }

  if (current.version === baseVersion) {
    return;
  }

  throw new SupplierConflictError(
    "O fornecedor foi alterado por outra sessao. Recarregue os dados antes de salvar novamente.",
    current.version,
    current.updatedAt,
  );
}

function assertSupplierWriteResult(
  value: SupplierRecord | DeletedSupplierDocument,
): asserts value is SupplierRecord {
  if ("deleted" in value && value.deleted === true) {
    throw new Error(
      "Operacao de fornecedor retornou um marcador de exclusao inesperado.",
    );
  }
}

function assertSupplierDeleteResult(
  value: SupplierRecord | DeletedSupplierDocument,
): asserts value is DeletedSupplierDocument {
  if (!("deleted" in value) || value.deleted !== true) {
    throw new Error(
      "Operacao de exclusao do fornecedor nao gerou marcador de exclusao.",
    );
  }
}

function buildLegacySupplierRecord(
  item: SupplierItem,
  updatedAt: string | null,
): SupplierRecord {
  return {
    ...item,
    id: getSupplierId(item),
    version: 1,
    updatedAt,
  };
}

async function readLegacySuppliersSnapshot() {
  return readErpResource(SUPPLIERS_RESOURCE_ID);
}

function mergeSuppliers(
  itemizedEntries: readonly SupplierMergeEntry[],
  legacyItems: readonly SupplierItem[],
  legacyUpdatedAt: string | null,
) {
  const activeEntries = new Map<string, SupplierRecord>();
  const deletedSupplierIds = new Set<string>();
  const consumedIds = new Set<string>();

  for (const entry of itemizedEntries) {
    if (entry.type === "deleted") {
      deletedSupplierIds.add(entry.item.id);
      activeEntries.delete(entry.item.id);
      continue;
    }

    activeEntries.set(entry.item.id, entry.item);
  }

  const mergedLegacyItems: SupplierRecord[] = [];

  for (const legacyItem of legacyItems) {
    const supplierId = getSupplierId(legacyItem);

    if (deletedSupplierIds.has(supplierId)) {
      continue;
    }

    const itemizedEntry = activeEntries.get(supplierId);

    if (itemizedEntry) {
      mergedLegacyItems.push(itemizedEntry);
      consumedIds.add(supplierId);
      continue;
    }

    mergedLegacyItems.push(
      buildLegacySupplierRecord(legacyItem, legacyUpdatedAt),
    );
  }

  const createdSuppliers = [...activeEntries.values()]
    .filter((item) => !consumedIds.has(item.id))
    .sort((left, right) => {
      const leftUpdatedAt = left.updatedAt ?? "";
      const rightUpdatedAt = right.updatedAt ?? "";

      if (leftUpdatedAt !== rightUpdatedAt) {
        return rightUpdatedAt.localeCompare(leftUpdatedAt);
      }

      return left.name.localeCompare(right.name);
    });

  return [...createdSuppliers, ...mergedLegacyItems];
}

async function assertSupplierNameUnique(name: string, currentId?: string) {
  const normalizedName = normalizeReference(name);
  const payload = await listSuppliers();
  const conflictingItem = payload.items.find(
    (item) =>
      normalizeReference(item.name) === normalizedName &&
      item.id !== currentId,
  );

  if (conflictingItem) {
    throw new ErpResourceValidationError(
      "Ja existe um fornecedor com esse nome.",
      409,
    );
  }
}

async function listFirebaseSuppliers() {
  const [snapshot, legacyResource] = await Promise.all([
    getFirebaseAdminDb()
      .collection<StoredSupplierEntry>(SUPPLIERS_COLLECTION)
      .get(),
    readLegacySuppliersSnapshot(),
  ]);

  const itemizedEntries = snapshot.docs
    .map((document) =>
      normalizeStoredSupplierEntry(document.id, document.data()),
    )
    .filter((document): document is SupplierMergeEntry => document !== null)
    .sort((left, right) => left.item.id.localeCompare(right.item.id));

  return mergeSuppliers(
    itemizedEntries,
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

async function listFileSuppliers() {
  const [store, legacyResource] = await Promise.all([
    readSuppliersFileStore(),
    readLegacySuppliersSnapshot(),
  ]);

  return mergeSuppliers(
    Object.values(store.items)
      .map((document) => toSupplierMergeEntry(document))
      .sort((left, right) => left.item.id.localeCompare(right.item.id)),
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

function findLegacySupplier(
  items: readonly SupplierItem[],
  supplierId: string,
) {
  return items.find((candidate) => getSupplierId(candidate) === supplierId);
}

async function readFirebaseSupplier(
  supplierId: string,
): Promise<SupplierRecordLookup> {
  const snapshot = await getFirebaseAdminDb()
    .collection<StoredSupplierEntry>(SUPPLIERS_COLLECTION)
    .doc(supplierId)
    .get();

  if (snapshot.exists) {
    const deletedItem = normalizeDeletedSupplierDocument(
      supplierId,
      snapshot.data(),
    );

    if (deletedItem) {
      return {
        item: null,
        exists: false,
      };
    }

    const item = normalizeStoredSupplierDocument(
      supplierId,
      snapshot.data(),
    );

    if (item) {
      return {
        item,
        exists: true,
      };
    }
  }

  const legacyResource = await readLegacySuppliersSnapshot();
  const legacyItem = findLegacySupplier(legacyResource.data, supplierId);

  if (!legacyItem) {
    return {
      item: null,
      exists: false,
    };
  }

  return {
    item: buildLegacySupplierRecord(legacyItem, legacyResource.updatedAt),
    exists: true,
  };
}

async function readFileSupplier(
  supplierId: string,
): Promise<SupplierRecordLookup> {
  const store = await readSuppliersFileStore();
  const existingDocument = store.items[supplierId] ?? null;

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

  const legacyResource = await readLegacySuppliersSnapshot();
  const legacyItem = findLegacySupplier(legacyResource.data, supplierId);

  if (!legacyItem) {
    return {
      item: null,
      exists: false,
    };
  }

  return {
    item: buildLegacySupplierRecord(legacyItem, legacyResource.updatedAt),
    exists: true,
  };
}

async function writeFirebaseSupplier(
  supplierId: string,
  update: (
    current: SupplierRecord | null,
  ) => Promise<SupplierMutationResult>,
) {
  const database = getFirebaseAdminDb();
  const legacyResource = await readLegacySuppliersSnapshot();
  const legacyItem = findLegacySupplier(legacyResource.data, supplierId);
  const collectionRef =
    database.collection<StoredSupplierEntry>(SUPPLIERS_COLLECTION);
  const documentRef = collectionRef.doc(supplierId);

  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(documentRef);
    const deletedItem = snapshot.exists
      ? normalizeDeletedSupplierDocument(supplierId, snapshot.data())
      : null;
    const current = snapshot.exists
      ? deletedItem
        ? null
        : normalizeStoredSupplierDocument(supplierId, snapshot.data())
      : legacyItem
        ? buildLegacySupplierRecord(legacyItem, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    const now = new Date().toISOString();

    if (next.type === "delete") {
      const deletedSupplier: DeletedSupplierDocument = {
        id: supplierId,
        deleted: true,
        deletedAt: now,
        version: next.value.version + 1,
        updatedAt: now,
      };

      transaction.set(documentRef, deletedSupplier, { merge: false });
      return deletedSupplier;
    }

    const nextDocument: StoredSupplierDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
      updatedAt: now,
    };

    transaction.set(documentRef, nextDocument, { merge: false });
    return nextDocument;
  });
}

async function writeFileSupplier(
  supplierId: string,
  update: (
    current: SupplierRecord | null,
  ) => Promise<SupplierMutationResult>,
) {
  return queueFileWrite(async () => {
    const filePath = getSuppliersFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });

    const [store, legacyResource] = await Promise.all([
      readSuppliersFileStore(),
      readLegacySuppliersSnapshot(),
    ]);
    const legacyItem = findLegacySupplier(legacyResource.data, supplierId);
    const existingDocument = store.items[supplierId] ?? null;
    const current: SupplierRecord | null = existingDocument
      ? "deleted" in existingDocument && existingDocument.deleted === true
        ? null
        : existingDocument
      : legacyItem
        ? buildLegacySupplierRecord(legacyItem, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    const now = new Date().toISOString();

    if (next.type === "delete") {
      const deletedSupplier: DeletedSupplierDocument = {
        id: supplierId,
        deleted: true,
        deletedAt: now,
        version: next.value.version + 1,
        updatedAt: now,
      };

      store.items[supplierId] = deletedSupplier;
      await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
      return deletedSupplier;
    }

    const nextDocument: StoredSupplierDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
      updatedAt: now,
    };

    store.items[supplierId] = nextDocument;
    await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
    return nextDocument;
  });
}

async function writeSupplier(
  supplierId: string,
  update: (
    current: SupplierRecord | null,
  ) => Promise<SupplierMutationResult>,
) {
  if (getSuppliersPersistenceProvider() === "firebase") {
    return writeFirebaseSupplier(supplierId, update);
  }

  return writeFileSupplier(supplierId, update);
}

export function getSuppliersPersistenceProvider() {
  return getServerPersistenceProvider("fornecedores");
}

export async function listSuppliers(): Promise<ListSuppliersResult> {
  const items =
    getSuppliersPersistenceProvider() === "firebase"
      ? await listFirebaseSuppliers()
      : await listFileSuppliers();

  return {
    items,
    count: items.length,
  };
}

export async function getSupplierById(supplierId: string) {
  const result =
    getSuppliersPersistenceProvider() === "firebase"
      ? await readFirebaseSupplier(supplierId)
      : await readFileSupplier(supplierId);

  if (!result.exists || !result.item) {
    throw new SupplierNotFoundError("Fornecedor nao encontrado.");
  }

  return result.item;
}

export async function createSupplier(
  item: unknown,
): Promise<SupplierRecord> {
  const normalized = validateSupplierWritePayload(item);
  await assertSupplierNameUnique(normalized.name);

  const createdItem = await writeSupplier(
    normalized.id,
    async (current) => {
      if (current) {
        throw new ErpResourceValidationError(
          "Ja existe um fornecedor com o id informado.",
          409,
        );
      }

      return {
        type: "set",
        value: normalized,
      };
    },
  );

  assertSupplierWriteResult(createdItem);
  return createdItem;
}

export async function updateSupplier(
  supplierId: string,
  itemPatch: unknown,
  options: UpdateSupplierOptions,
) {
  const currentItem = await getSupplierById(supplierId);
  const nextName =
    itemPatch &&
    typeof itemPatch === "object" &&
    !Array.isArray(itemPatch) &&
    typeof (itemPatch as { name?: unknown }).name === "string"
      ? (itemPatch as { name: string }).name
      : currentItem.name;

  await assertSupplierNameUnique(nextName, supplierId);

  const updatedItem = await writeSupplier(
    supplierId,
    async (current) => {
      assertBaseVersion(current, options.baseVersion);

      if (!itemPatch || typeof itemPatch !== "object" || Array.isArray(itemPatch)) {
        throw new ErpResourceValidationError(
          "Carga invalida para o fornecedor.",
        );
      }

      const candidateId = (itemPatch as { id?: unknown }).id;

      if (
        candidateId !== undefined &&
        (typeof candidateId !== "string" ||
          normalizeSupplierId(candidateId) !== supplierId)
      ) {
        throw new ErpResourceValidationError(
          "O id do fornecedor precisa corresponder ao id da rota.",
        );
      }

      const merged = validateSupplierWritePayload(
        {
          ...toSupplierPayload(current),
          ...itemPatch,
          id: supplierId,
        },
        supplierId,
      );

      const currentPayload = toSupplierPayload(current);

      if (
        currentPayload &&
        areSupplierPayloadsEqual(currentPayload, merged)
      ) {
        return {
          type: "noop",
          value: current,
        } satisfies SupplierMutationResult;
      }

      return {
        type: "set",
        value: merged,
      } satisfies SupplierMutationResult;
    },
  );

  assertSupplierWriteResult(updatedItem);
  return updatedItem;
}

export async function deleteSupplier(
  supplierId: string,
  baseVersion: number,
): Promise<DeleteSupplierResult> {
  const deletedItem = await writeSupplier(
    supplierId,
    async (current) => {
      assertBaseVersion(current, baseVersion);

      return {
        type: "delete",
        value: current,
      } satisfies SupplierMutationResult;
    },
  );

  assertSupplierDeleteResult(deletedItem);

  return {
    id: deletedItem.id,
    version: deletedItem.version,
    deletedAt: deletedItem.deletedAt,
  };
}
