import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PendingItem } from "@/lib/operations-data";
import {
  ErpResourceValidationError,
  sanitizeStoredErpResourceItemData,
  validateErpResourceItemData,
} from "@/lib/server/erp-resource-schema";
import { readErpResource } from "@/lib/server/erp-state";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import { getServerPersistenceProvider } from "@/lib/server/server-persistence";

const PENDING_COLLECTION = "pending";
const PENDING_RESOURCE_ID = "operations.pending";
const DEFAULT_PENDING_FILE = path.join(process.cwd(), ".data", "pending.json");

let fileWriteQueue = Promise.resolve();

type PendingVersion = number;

type StoredPendingDocument = PendingItem & {
  id: string;
  version: PendingVersion;
  updatedAt: string | null;
  deleted?: false;
};

type DeletedPendingDocument = {
  id: string;
  deleted: true;
  deletedAt: string;
  version: PendingVersion;
  updatedAt: string | null;
};

type PendingRecordLookup = {
  item: PendingRecord | null;
  exists: boolean;
};

type PendingMergeEntry =
  | { type: "item"; item: StoredPendingDocument }
  | { type: "deleted"; item: DeletedPendingDocument };

type StoredPendingEntry = StoredPendingDocument | DeletedPendingDocument;

type DeletePendingResult = {
  id: string;
  version: PendingVersion;
  deletedAt: string;
};

type PendingFileStore = {
  items?: Record<string, StoredPendingEntry>;
};

export type PendingRecord = PendingItem & {
  id: string;
  version: PendingVersion;
  updatedAt: string | null;
};

export type ListPendingItemsResult = {
  items: PendingRecord[];
  count: number;
};

export type UpdatePendingItemOptions = {
  baseVersion: number;
};

type PendingMutationResult =
  | { type: "set"; value: PendingItem & { id: string } }
  | { type: "noop"; value: PendingRecord }
  | { type: "delete"; value: PendingRecord };

export class PendingConflictError extends Error {
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

export class PendingNotFoundError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.status = 404;
  }
}

export function requirePendingBaseVersion(value: unknown, operation: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ErpResourceValidationError(
      `baseVersion obrigatorio para ${operation} a pendencia.`,
      400,
    );
  }

  return value;
}

export function getPendingVersionConflictPayload(error: PendingConflictError) {
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

function normalizePendingId(value: string) {
  return value.trim();
}

function getLegacyPendingId(
  item: Pick<PendingItem, "title" | "owner" | "due">,
) {
  const key = `${normalizeReference(item.title)}::${normalizeReference(item.owner)}::${normalizeReference(item.due)}`;
  const digest = createHash("sha1").update(key).digest("hex").slice(0, 16);
  return `pending_${digest}`;
}

function getPendingId(item: PendingItem) {
  return typeof item.id === "string" && item.id.trim()
    ? normalizePendingId(item.id)
    : getLegacyPendingId(item);
}

function getPendingFilePath() {
  return process.env.PENDING_FILE_PATH
    ? path.resolve(process.cwd(), process.env.PENDING_FILE_PATH)
    : DEFAULT_PENDING_FILE;
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

function normalizeStoredPendingDocument(
  pendingId: string,
  value: unknown,
): StoredPendingDocument | null {
  const sanitized = sanitizeStoredErpResourceItemData(
    PENDING_RESOURCE_ID,
    value,
  );
  const item = sanitized.item;

  if (!item) {
    return null;
  }

  const resolvedId = getPendingId(item);

  if (resolvedId !== pendingId) {
    return null;
  }

  const candidate = value as Partial<StoredPendingDocument>;

  return {
    ...item,
    id: pendingId,
    version: normalizeVersion(candidate.version),
    updatedAt: normalizeUpdatedAt(candidate.updatedAt),
  };
}

function normalizeDeletedPendingDocument(
  pendingId: string,
  value: unknown,
): DeletedPendingDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<DeletedPendingDocument>;

  if (
    candidate.deleted !== true ||
    candidate.id !== pendingId ||
    typeof candidate.deletedAt !== "string"
  ) {
    return null;
  }

  return {
    id: pendingId,
    deleted: true,
    deletedAt: candidate.deletedAt,
    version: normalizeVersion(candidate.version),
    updatedAt: normalizeUpdatedAt(candidate.updatedAt),
  };
}

function normalizeStoredPendingEntry(
  pendingId: string,
  value: unknown,
): PendingMergeEntry | null {
  const deletedItem = normalizeDeletedPendingDocument(pendingId, value);

  if (deletedItem) {
    return {
      type: "deleted",
      item: deletedItem,
    };
  }

  const item = normalizeStoredPendingDocument(pendingId, value);

  if (!item) {
    return null;
  }

  return {
    type: "item",
    item,
  };
}

function toStoredPendingEntry(entry: PendingMergeEntry): StoredPendingEntry {
  return entry.item;
}

function toPendingMergeEntry(document: StoredPendingEntry): PendingMergeEntry {
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
    return {} as Record<string, StoredPendingEntry>;
  }

  const items: Record<string, StoredPendingEntry> = {};

  for (const [pendingId, candidate] of Object.entries(value)) {
    const normalized = normalizeStoredPendingEntry(pendingId, candidate);

    if (normalized) {
      items[pendingId] = toStoredPendingEntry(normalized);
    }
  }

  return items;
}

async function readPendingFileStore() {
  try {
    const raw = await readFile(getPendingFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        items: {},
      } satisfies Required<PendingFileStore>;
    }

    const value = parsed as PendingFileStore;

    return {
      items: normalizeFileItems(value.items),
    } satisfies Required<PendingFileStore>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        items: {},
      } satisfies Required<PendingFileStore>;
    }

    throw error;
  }
}

function sortPendingItems<TValue extends Pick<PendingItem, "priority" | "title">>(
  items: TValue[],
) {
  return [...items].sort((left, right) => {
    const byPriority = left.priority.localeCompare(right.priority);
    return byPriority === 0 ? left.title.localeCompare(right.title) : byPriority;
  });
}

function arePendingPayloadsEqual(left: PendingItem, right: PendingItem) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toPendingPayload(
  item: PendingRecord | null,
): (PendingItem & { id: string }) | null {
  if (!item) {
    return null;
  }

  const payload = { ...item } as Partial<PendingRecord>;
  delete payload.version;
  delete payload.updatedAt;
  return payload as PendingItem & { id: string };
}

function validatePendingWritePayload(value: unknown, pendingId?: string) {
  const normalized = validateErpResourceItemData(PENDING_RESOURCE_ID, value);
  const candidateId =
    typeof normalized.id === "string" && normalized.id.trim()
      ? normalizePendingId(normalized.id)
      : undefined;

  if (pendingId && candidateId && candidateId !== pendingId) {
    throw new ErpResourceValidationError(
      "O id da pendencia precisa corresponder ao id da rota.",
    );
  }

  return {
    ...normalized,
    id: pendingId ?? candidateId ?? getLegacyPendingId(normalized),
  };
}

function assertBaseVersion(
  current: PendingRecord | null,
  baseVersion: number,
): asserts current is PendingRecord {
  if (!Number.isInteger(baseVersion) || baseVersion < 1) {
    throw new ErpResourceValidationError(
      "Versao base invalida para a pendencia.",
    );
  }

  if (!current) {
    throw new PendingNotFoundError("Pendencia nao encontrada.");
  }

  if (current.version === baseVersion) {
    return;
  }

  throw new PendingConflictError(
    "A pendencia foi alterada por outra sessao. Recarregue os dados antes de salvar novamente.",
    current.version,
    current.updatedAt,
  );
}

function assertPendingWriteResult(
  value: PendingRecord | DeletedPendingDocument,
): asserts value is PendingRecord {
  if ("deleted" in value && value.deleted === true) {
    throw new Error("Operacao de pendencia retornou um marcador de exclusao inesperado.");
  }
}

function assertPendingDeleteResult(
  value: PendingRecord | DeletedPendingDocument,
): asserts value is DeletedPendingDocument {
  if (!("deleted" in value) || value.deleted !== true) {
    throw new Error("Operacao de exclusao da pendencia nao gerou marcador de exclusao.");
  }
}

function buildLegacyPendingRecord(
  item: PendingItem,
  updatedAt: string | null,
): PendingRecord {
  return {
    ...item,
    id: getPendingId(item),
    version: 1,
    updatedAt,
  };
}

async function readLegacyPendingSnapshot() {
  return readErpResource(PENDING_RESOURCE_ID);
}

function mergePendingItems(
  itemizedEntries: readonly PendingMergeEntry[],
  legacyItems: readonly PendingItem[],
  legacyUpdatedAt: string | null,
) {
  const merged = new Map<string, PendingRecord>();
  const deletedItemIds = new Set<string>();

  for (const entry of itemizedEntries) {
    if (entry.type === "deleted") {
      deletedItemIds.add(entry.item.id);
      merged.delete(entry.item.id);
      continue;
    }

    merged.set(entry.item.id, entry.item);
  }

  for (const legacyItem of legacyItems) {
    const pendingId = getPendingId(legacyItem);

    if (!deletedItemIds.has(pendingId) && !merged.has(pendingId)) {
      merged.set(pendingId, buildLegacyPendingRecord(legacyItem, legacyUpdatedAt));
    }
  }

  return sortPendingItems([...merged.values()]);
}

async function listFirebasePendingItems() {
  const [snapshot, legacyResource] = await Promise.all([
    getFirebaseAdminDb()
      .collection<StoredPendingEntry>(PENDING_COLLECTION)
      .get(),
    readLegacyPendingSnapshot(),
  ]);

  const itemizedEntries = snapshot.docs
    .map((document) =>
      normalizeStoredPendingEntry(document.id, document.data()),
    )
    .filter((document): document is PendingMergeEntry => document !== null)
    .sort((left, right) => left.item.id.localeCompare(right.item.id));

  return mergePendingItems(
    itemizedEntries,
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

async function listFilePendingItems() {
  const [store, legacyResource] = await Promise.all([
    readPendingFileStore(),
    readLegacyPendingSnapshot(),
  ]);

  return mergePendingItems(
    Object.values(store.items)
      .map((document) => toPendingMergeEntry(document))
      .sort((left, right) => left.item.id.localeCompare(right.item.id)),
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

function findLegacyPendingItem(
  items: readonly PendingItem[],
  pendingId: string,
) {
  return items.find((candidate) => getPendingId(candidate) === pendingId);
}

async function readFirebasePendingItem(
  pendingId: string,
): Promise<PendingRecordLookup> {
  const snapshot = await getFirebaseAdminDb()
    .collection<StoredPendingEntry>(PENDING_COLLECTION)
    .doc(pendingId)
    .get();

  if (snapshot.exists) {
    const deletedItem = normalizeDeletedPendingDocument(pendingId, snapshot.data());

    if (deletedItem) {
      return {
        item: null,
        exists: false,
      };
    }

    const item = normalizeStoredPendingDocument(pendingId, snapshot.data());

    if (item) {
      return {
        item,
        exists: true,
      };
    }
  }

  const legacyResource = await readLegacyPendingSnapshot();
  const legacyItem = findLegacyPendingItem(legacyResource.data, pendingId);

  if (!legacyItem) {
    return {
      item: null,
      exists: false,
    };
  }

  return {
    item: buildLegacyPendingRecord(legacyItem, legacyResource.updatedAt),
    exists: true,
  };
}

async function readFilePendingItem(
  pendingId: string,
): Promise<PendingRecordLookup> {
  const store = await readPendingFileStore();
  const existingDocument = store.items[pendingId] ?? null;

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

  const legacyResource = await readLegacyPendingSnapshot();
  const legacyItem = findLegacyPendingItem(legacyResource.data, pendingId);

  if (!legacyItem) {
    return {
      item: null,
      exists: false,
    };
  }

  return {
    item: buildLegacyPendingRecord(legacyItem, legacyResource.updatedAt),
    exists: true,
  };
}

async function writeFirebasePendingItem(
  pendingId: string,
  update: (current: PendingRecord | null) => Promise<PendingMutationResult>,
) {
  const database = getFirebaseAdminDb();
  const legacyResource = await readLegacyPendingSnapshot();
  const legacyItem = findLegacyPendingItem(legacyResource.data, pendingId);
  const collectionRef =
    database.collection<StoredPendingEntry>(PENDING_COLLECTION);
  const documentRef = collectionRef.doc(pendingId);

  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(documentRef);
    const deletedItem = snapshot.exists
      ? normalizeDeletedPendingDocument(pendingId, snapshot.data())
      : null;
    const current = snapshot.exists
      ? deletedItem
        ? null
        : normalizeStoredPendingDocument(pendingId, snapshot.data())
      : legacyItem
        ? buildLegacyPendingRecord(legacyItem, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    const now = new Date().toISOString();

    if (next.type === "delete") {
      const deletedItemRecord: DeletedPendingDocument = {
        id: pendingId,
        deleted: true,
        deletedAt: now,
        version: next.value.version + 1,
        updatedAt: now,
      };

      transaction.set(documentRef, deletedItemRecord, { merge: false });
      return deletedItemRecord;
    }

    const nextDocument: StoredPendingDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
      updatedAt: now,
    };

    transaction.set(documentRef, nextDocument, { merge: false });
    return nextDocument;
  });
}

async function writeFilePendingItem(
  pendingId: string,
  update: (current: PendingRecord | null) => Promise<PendingMutationResult>,
) {
  return queueFileWrite(async () => {
    const filePath = getPendingFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });

    const [store, legacyResource] = await Promise.all([
      readPendingFileStore(),
      readLegacyPendingSnapshot(),
    ]);
    const legacyItem = findLegacyPendingItem(legacyResource.data, pendingId);
    const existingDocument = store.items[pendingId] ?? null;
    const current: PendingRecord | null = existingDocument
      ? "deleted" in existingDocument && existingDocument.deleted === true
        ? null
        : existingDocument
      : legacyItem
        ? buildLegacyPendingRecord(legacyItem, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    const now = new Date().toISOString();

    if (next.type === "delete") {
      const deletedItemRecord: DeletedPendingDocument = {
        id: pendingId,
        deleted: true,
        deletedAt: now,
        version: next.value.version + 1,
        updatedAt: now,
      };

      store.items[pendingId] = deletedItemRecord;
      await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
      return deletedItemRecord;
    }

    const nextDocument: StoredPendingDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
      updatedAt: now,
    };

    store.items[pendingId] = nextDocument;
    await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
    return nextDocument;
  });
}

async function writePendingItem(
  pendingId: string,
  update: (current: PendingRecord | null) => Promise<PendingMutationResult>,
) {
  if (getPendingItemsPersistenceProvider() === "firebase") {
    return writeFirebasePendingItem(pendingId, update);
  }

  return writeFilePendingItem(pendingId, update);
}

export function getPendingItemsPersistenceProvider() {
  return getServerPersistenceProvider("pendencias");
}

export async function listPendingItems(): Promise<ListPendingItemsResult> {
  const items =
    getPendingItemsPersistenceProvider() === "firebase"
      ? await listFirebasePendingItems()
      : await listFilePendingItems();

  return {
    items,
    count: items.length,
  };
}

export async function getPendingItemById(pendingId: string) {
  const result =
    getPendingItemsPersistenceProvider() === "firebase"
      ? await readFirebasePendingItem(pendingId)
      : await readFilePendingItem(pendingId);

  if (!result.exists || !result.item) {
    throw new PendingNotFoundError("Pendencia nao encontrada.");
  }

  return result.item;
}

export async function createPendingItem(
  item: unknown,
): Promise<PendingRecord> {
  const normalized = validatePendingWritePayload(item);

  const createdItem = await writePendingItem(normalized.id, async (current) => {
    if (current) {
      throw new ErpResourceValidationError(
        "Ja existe uma pendencia com o id informado.",
        409,
      );
    }

    return {
      type: "set",
      value: normalized,
    };
  });

  assertPendingWriteResult(createdItem);
  return createdItem;
}

export async function updatePendingItem(
  pendingId: string,
  itemPatch: unknown,
  options: UpdatePendingItemOptions,
) {
  const updatedItem = await writePendingItem(pendingId, async (current) => {
    assertBaseVersion(current, options.baseVersion);

    if (!itemPatch || typeof itemPatch !== "object" || Array.isArray(itemPatch)) {
      throw new ErpResourceValidationError("Carga invalida para a pendencia.");
    }

    const candidateId = (itemPatch as { id?: unknown }).id;

    if (
      candidateId !== undefined &&
      (typeof candidateId !== "string" ||
        normalizePendingId(candidateId) !== pendingId)
    ) {
      throw new ErpResourceValidationError(
        "O id da pendencia precisa corresponder ao id da rota.",
      );
    }

    const merged = validatePendingWritePayload(
      {
        ...toPendingPayload(current),
        ...itemPatch,
        id: pendingId,
      },
      pendingId,
    );

    const currentPayload = toPendingPayload(current);

    if (currentPayload && arePendingPayloadsEqual(currentPayload, merged)) {
      return {
        type: "noop",
        value: current,
      } satisfies PendingMutationResult;
    }

    return {
      type: "set",
      value: merged,
    } satisfies PendingMutationResult;
  });

  assertPendingWriteResult(updatedItem);
  return updatedItem;
}

export async function deletePendingItem(
  pendingId: string,
  baseVersion: number,
): Promise<DeletePendingResult> {
  const deletedItem = await writePendingItem(pendingId, async (current) => {
    assertBaseVersion(current, baseVersion);

    return {
      type: "delete",
      value: current,
    } satisfies PendingMutationResult;
  });

  assertPendingDeleteResult(deletedItem);

  return {
    id: deletedItem.id,
    version: deletedItem.version,
    deletedAt: deletedItem.deletedAt,
  };
}
