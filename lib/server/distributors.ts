import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DistributorItem } from "@/lib/operations-data";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import {
  ErpResourceValidationError,
  sanitizeStoredErpResourceItemData,
  validateErpResourceItemData,
} from "@/lib/server/erp-resource-schema";
import { readErpResource } from "@/lib/server/erp-state";
import { getServerPersistenceProvider } from "@/lib/server/server-persistence";

const DISTRIBUTORS_COLLECTION = "distributors";
const DISTRIBUTORS_RESOURCE_ID = "operations.distributors";
const DEFAULT_DISTRIBUTORS_FILE = path.join(
  process.cwd(),
  ".data",
  "distributors-items.json",
);

let fileWriteQueue = Promise.resolve();

type DistributorVersion = number;

type StoredDistributorDocument = DistributorItem & {
  id: string;
  version: DistributorVersion;
  updatedAt: string | null;
  deleted?: false;
};

type DeletedDistributorDocument = {
  id: string;
  deleted: true;
  deletedAt: string;
  version: DistributorVersion;
  updatedAt: string | null;
};

type DistributorRecordLookup = {
  item: DistributorRecord | null;
  exists: boolean;
};

type DistributorMergeEntry =
  | { type: "item"; item: StoredDistributorDocument }
  | { type: "deleted"; item: DeletedDistributorDocument };

type StoredDistributorEntry =
  | StoredDistributorDocument
  | DeletedDistributorDocument;

type DeleteDistributorResult = {
  id: string;
  version: DistributorVersion;
  deletedAt: string;
};

type DistributorsFileStore = {
  items?: Record<string, StoredDistributorEntry>;
};

export type DistributorRecord = DistributorItem & {
  id: string;
  version: DistributorVersion;
  updatedAt: string | null;
};

export type ListDistributorsResult = {
  items: DistributorRecord[];
  count: number;
};

export type UpdateDistributorOptions = {
  baseVersion: number;
};

type DistributorMutationResult =
  | { type: "set"; value: DistributorItem & { id: string } }
  | { type: "noop"; value: DistributorRecord }
  | { type: "delete"; value: DistributorRecord };

export class DistributorConflictError extends Error {
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

export class DistributorNotFoundError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.status = 404;
  }
}

export function requireDistributorBaseVersion(
  value: unknown,
  operation: string,
) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ErpResourceValidationError(
      `baseVersion obrigatorio para ${operation} o distribuidor.`,
      400,
    );
  }

  return value;
}

export function getDistributorVersionConflictPayload(
  error: DistributorConflictError,
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

function normalizeDistributorId(value: string) {
  return value.trim();
}

function getLegacyDistributorId(item: Pick<DistributorItem, "name">) {
  const key = normalizeReference(item.name);
  const digest = createHash("sha1").update(key).digest("hex").slice(0, 16);
  return `distributor_${digest}`;
}

function getDistributorId(item: DistributorItem) {
  return typeof item.id === "string" && item.id.trim()
    ? normalizeDistributorId(item.id)
    : getLegacyDistributorId(item);
}

function getDistributorsFilePath() {
  return process.env.DISTRIBUTORS_FILE_PATH
    ? path.resolve(process.cwd(), process.env.DISTRIBUTORS_FILE_PATH)
    : DEFAULT_DISTRIBUTORS_FILE;
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

function normalizeStoredDistributorDocument(
  distributorId: string,
  value: unknown,
): StoredDistributorDocument | null {
  const sanitized = sanitizeStoredErpResourceItemData(
    DISTRIBUTORS_RESOURCE_ID,
    value,
  );
  const item = sanitized.item;

  if (!item) {
    return null;
  }

  const resolvedId = getDistributorId(item);

  if (resolvedId !== distributorId) {
    return null;
  }

  const candidate = value as Partial<StoredDistributorDocument>;

  return {
    ...item,
    id: distributorId,
    version: normalizeVersion(candidate.version),
    updatedAt: normalizeUpdatedAt(candidate.updatedAt),
  };
}

function normalizeDeletedDistributorDocument(
  distributorId: string,
  value: unknown,
): DeletedDistributorDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<DeletedDistributorDocument>;

  if (
    candidate.deleted !== true ||
    candidate.id !== distributorId ||
    typeof candidate.deletedAt !== "string"
  ) {
    return null;
  }

  return {
    id: distributorId,
    deleted: true,
    deletedAt: candidate.deletedAt,
    version: normalizeVersion(candidate.version),
    updatedAt: normalizeUpdatedAt(candidate.updatedAt),
  };
}

function normalizeStoredDistributorEntry(
  distributorId: string,
  value: unknown,
): DistributorMergeEntry | null {
  const deletedDistributor = normalizeDeletedDistributorDocument(
    distributorId,
    value,
  );

  if (deletedDistributor) {
    return {
      type: "deleted",
      item: deletedDistributor,
    };
  }

  const item = normalizeStoredDistributorDocument(distributorId, value);

  if (!item) {
    return null;
  }

  return {
    type: "item",
    item,
  };
}

function toStoredDistributorEntry(
  entry: DistributorMergeEntry,
): StoredDistributorEntry {
  return entry.item;
}

function toDistributorMergeEntry(
  document: StoredDistributorEntry,
): DistributorMergeEntry {
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
    return {} as Record<string, StoredDistributorEntry>;
  }

  const items: Record<string, StoredDistributorEntry> = {};

  for (const [distributorId, candidate] of Object.entries(value)) {
    const normalized = normalizeStoredDistributorEntry(distributorId, candidate);

    if (normalized) {
      items[distributorId] = toStoredDistributorEntry(normalized);
    }
  }

  return items;
}

async function readDistributorsFileStore() {
  try {
    const raw = await readFile(getDistributorsFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        items: {},
      } satisfies Required<DistributorsFileStore>;
    }

    const value = parsed as DistributorsFileStore;

    return {
      items: normalizeFileItems(value.items),
    } satisfies Required<DistributorsFileStore>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        items: {},
      } satisfies Required<DistributorsFileStore>;
    }

    throw error;
  }
}

function areDistributorPayloadsEqual(left: DistributorItem, right: DistributorItem) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toDistributorPayload(
  item: DistributorRecord | null,
): (DistributorItem & { id: string }) | null {
  if (!item) {
    return null;
  }

  const payload = { ...item } as Partial<DistributorRecord>;
  delete payload.version;
  delete payload.updatedAt;
  return payload as DistributorItem & { id: string };
}

function validateDistributorWritePayload(
  value: unknown,
  distributorId?: string,
) {
  const normalized = validateErpResourceItemData(DISTRIBUTORS_RESOURCE_ID, value);
  const candidateId =
    typeof normalized.id === "string" && normalized.id.trim()
      ? normalizeDistributorId(normalized.id)
      : undefined;

  if (distributorId && candidateId && candidateId !== distributorId) {
    throw new ErpResourceValidationError(
      "O id do distribuidor precisa corresponder ao id da rota.",
    );
  }

  return {
    ...normalized,
    id: distributorId ?? candidateId ?? getLegacyDistributorId(normalized),
  };
}

function assertBaseVersion(
  current: DistributorRecord | null,
  baseVersion: number,
): asserts current is DistributorRecord {
  if (!Number.isInteger(baseVersion) || baseVersion < 1) {
    throw new ErpResourceValidationError(
      "Versao base invalida para o distribuidor.",
    );
  }

  if (!current) {
    throw new DistributorNotFoundError("Distribuidor nao encontrado.");
  }

  if (current.version === baseVersion) {
    return;
  }

  throw new DistributorConflictError(
    "O distribuidor foi alterado por outra sessao. Recarregue os dados antes de salvar novamente.",
    current.version,
    current.updatedAt,
  );
}

function assertDistributorWriteResult(
  value: DistributorRecord | DeletedDistributorDocument,
): asserts value is DistributorRecord {
  if ("deleted" in value && value.deleted === true) {
    throw new Error(
      "Operacao de distribuidor retornou um marcador de exclusao inesperado.",
    );
  }
}

function assertDistributorDeleteResult(
  value: DistributorRecord | DeletedDistributorDocument,
): asserts value is DeletedDistributorDocument {
  if (!("deleted" in value) || value.deleted !== true) {
    throw new Error(
      "Operacao de exclusao do distribuidor nao gerou marcador de exclusao.",
    );
  }
}

function buildLegacyDistributorRecord(
  item: DistributorItem,
  updatedAt: string | null,
): DistributorRecord {
  return {
    ...item,
    id: getDistributorId(item),
    version: 1,
    updatedAt,
  };
}

async function readLegacyDistributorsSnapshot() {
  return readErpResource(DISTRIBUTORS_RESOURCE_ID);
}

function mergeDistributors(
  itemizedEntries: readonly DistributorMergeEntry[],
  legacyItems: readonly DistributorItem[],
  legacyUpdatedAt: string | null,
) {
  const activeEntries = new Map<string, DistributorRecord>();
  const deletedDistributorIds = new Set<string>();
  const consumedIds = new Set<string>();

  for (const entry of itemizedEntries) {
    if (entry.type === "deleted") {
      deletedDistributorIds.add(entry.item.id);
      activeEntries.delete(entry.item.id);
      continue;
    }

    activeEntries.set(entry.item.id, entry.item);
  }

  const mergedLegacyItems: DistributorRecord[] = [];

  for (const legacyItem of legacyItems) {
    const distributorId = getDistributorId(legacyItem);

    if (deletedDistributorIds.has(distributorId)) {
      continue;
    }

    const itemizedEntry = activeEntries.get(distributorId);

    if (itemizedEntry) {
      mergedLegacyItems.push(itemizedEntry);
      consumedIds.add(distributorId);
      continue;
    }

    mergedLegacyItems.push(
      buildLegacyDistributorRecord(legacyItem, legacyUpdatedAt),
    );
  }

  const createdDistributors = [...activeEntries.values()]
    .filter((item) => !consumedIds.has(item.id))
    .sort((left, right) => {
      const leftUpdatedAt = left.updatedAt ?? "";
      const rightUpdatedAt = right.updatedAt ?? "";

      if (leftUpdatedAt !== rightUpdatedAt) {
        return rightUpdatedAt.localeCompare(leftUpdatedAt);
      }

      return left.name.localeCompare(right.name);
    });

  return [...createdDistributors, ...mergedLegacyItems];
}

async function assertDistributorNameUnique(name: string, currentId?: string) {
  const normalizedName = normalizeReference(name);
  const payload = await listDistributors();
  const conflictingItem = payload.items.find(
    (item) =>
      normalizeReference(item.name) === normalizedName &&
      item.id !== currentId,
  );

  if (conflictingItem) {
    throw new ErpResourceValidationError(
      "Ja existe um distribuidor com esse nome.",
      409,
    );
  }
}

async function listFirebaseDistributors() {
  const [snapshot, legacyResource] = await Promise.all([
    getFirebaseAdminDb()
      .collection<StoredDistributorEntry>(DISTRIBUTORS_COLLECTION)
      .get(),
    readLegacyDistributorsSnapshot(),
  ]);

  const itemizedEntries = snapshot.docs
    .map((document) =>
      normalizeStoredDistributorEntry(document.id, document.data()),
    )
    .filter((document): document is DistributorMergeEntry => document !== null)
    .sort((left, right) => left.item.id.localeCompare(right.item.id));

  return mergeDistributors(
    itemizedEntries,
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

async function listFileDistributors() {
  const [store, legacyResource] = await Promise.all([
    readDistributorsFileStore(),
    readLegacyDistributorsSnapshot(),
  ]);

  return mergeDistributors(
    Object.values(store.items)
      .map((document) => toDistributorMergeEntry(document))
      .sort((left, right) => left.item.id.localeCompare(right.item.id)),
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

function findLegacyDistributor(
  items: readonly DistributorItem[],
  distributorId: string,
) {
  return items.find((candidate) => getDistributorId(candidate) === distributorId);
}

async function readFirebaseDistributor(
  distributorId: string,
): Promise<DistributorRecordLookup> {
  const snapshot = await getFirebaseAdminDb()
    .collection<StoredDistributorEntry>(DISTRIBUTORS_COLLECTION)
    .doc(distributorId)
    .get();

  if (snapshot.exists) {
    const deletedItem = normalizeDeletedDistributorDocument(
      distributorId,
      snapshot.data(),
    );

    if (deletedItem) {
      return {
        item: null,
        exists: false,
      };
    }

    const item = normalizeStoredDistributorDocument(
      distributorId,
      snapshot.data(),
    );

    if (item) {
      return {
        item,
        exists: true,
      };
    }
  }

  const legacyResource = await readLegacyDistributorsSnapshot();
  const legacyItem = findLegacyDistributor(legacyResource.data, distributorId);

  if (!legacyItem) {
    return {
      item: null,
      exists: false,
    };
  }

  return {
    item: buildLegacyDistributorRecord(legacyItem, legacyResource.updatedAt),
    exists: true,
  };
}

async function readFileDistributor(
  distributorId: string,
): Promise<DistributorRecordLookup> {
  const store = await readDistributorsFileStore();
  const existingDocument = store.items[distributorId] ?? null;

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

  const legacyResource = await readLegacyDistributorsSnapshot();
  const legacyItem = findLegacyDistributor(legacyResource.data, distributorId);

  if (!legacyItem) {
    return {
      item: null,
      exists: false,
    };
  }

  return {
    item: buildLegacyDistributorRecord(legacyItem, legacyResource.updatedAt),
    exists: true,
  };
}

async function writeFirebaseDistributor(
  distributorId: string,
  update: (
    current: DistributorRecord | null,
  ) => Promise<DistributorMutationResult>,
) {
  const database = getFirebaseAdminDb();
  const legacyResource = await readLegacyDistributorsSnapshot();
  const legacyItem = findLegacyDistributor(legacyResource.data, distributorId);
  const collectionRef =
    database.collection<StoredDistributorEntry>(DISTRIBUTORS_COLLECTION);
  const documentRef = collectionRef.doc(distributorId);

  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(documentRef);
    const deletedItem = snapshot.exists
      ? normalizeDeletedDistributorDocument(distributorId, snapshot.data())
      : null;
    const current = snapshot.exists
      ? deletedItem
        ? null
        : normalizeStoredDistributorDocument(distributorId, snapshot.data())
      : legacyItem
        ? buildLegacyDistributorRecord(legacyItem, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    const now = new Date().toISOString();

    if (next.type === "delete") {
      const deletedDistributor: DeletedDistributorDocument = {
        id: distributorId,
        deleted: true,
        deletedAt: now,
        version: next.value.version + 1,
        updatedAt: now,
      };

      transaction.set(documentRef, deletedDistributor, { merge: false });
      return deletedDistributor;
    }

    const nextDocument: StoredDistributorDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
      updatedAt: now,
    };

    transaction.set(documentRef, nextDocument, { merge: false });
    return nextDocument;
  });
}

async function writeFileDistributor(
  distributorId: string,
  update: (
    current: DistributorRecord | null,
  ) => Promise<DistributorMutationResult>,
) {
  return queueFileWrite(async () => {
    const filePath = getDistributorsFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });

    const [store, legacyResource] = await Promise.all([
      readDistributorsFileStore(),
      readLegacyDistributorsSnapshot(),
    ]);
    const legacyItem = findLegacyDistributor(legacyResource.data, distributorId);
    const existingDocument = store.items[distributorId] ?? null;
    const current: DistributorRecord | null = existingDocument
      ? "deleted" in existingDocument && existingDocument.deleted === true
        ? null
        : existingDocument
      : legacyItem
        ? buildLegacyDistributorRecord(legacyItem, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    const now = new Date().toISOString();

    if (next.type === "delete") {
      const deletedDistributor: DeletedDistributorDocument = {
        id: distributorId,
        deleted: true,
        deletedAt: now,
        version: next.value.version + 1,
        updatedAt: now,
      };

      store.items[distributorId] = deletedDistributor;
      await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
      return deletedDistributor;
    }

    const nextDocument: StoredDistributorDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
      updatedAt: now,
    };

    store.items[distributorId] = nextDocument;
    await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
    return nextDocument;
  });
}

async function writeDistributor(
  distributorId: string,
  update: (
    current: DistributorRecord | null,
  ) => Promise<DistributorMutationResult>,
) {
  if (getDistributorsPersistenceProvider() === "firebase") {
    return writeFirebaseDistributor(distributorId, update);
  }

  return writeFileDistributor(distributorId, update);
}

export function getDistributorsPersistenceProvider() {
  return getServerPersistenceProvider("distribuidores");
}

export async function listDistributors(): Promise<ListDistributorsResult> {
  const items =
    getDistributorsPersistenceProvider() === "firebase"
      ? await listFirebaseDistributors()
      : await listFileDistributors();

  return {
    items,
    count: items.length,
  };
}

export async function getDistributorById(distributorId: string) {
  const result =
    getDistributorsPersistenceProvider() === "firebase"
      ? await readFirebaseDistributor(distributorId)
      : await readFileDistributor(distributorId);

  if (!result.exists || !result.item) {
    throw new DistributorNotFoundError("Distribuidor nao encontrado.");
  }

  return result.item;
}

export async function createDistributor(
  item: unknown,
): Promise<DistributorRecord> {
  const normalized = validateDistributorWritePayload(item);
  await assertDistributorNameUnique(normalized.name);

  const createdItem = await writeDistributor(
    normalized.id,
    async (current) => {
      if (current) {
        throw new ErpResourceValidationError(
          "Ja existe um distribuidor com o id informado.",
          409,
        );
      }

      return {
        type: "set",
        value: normalized,
      };
    },
  );

  assertDistributorWriteResult(createdItem);
  return createdItem;
}

export async function updateDistributor(
  distributorId: string,
  itemPatch: unknown,
  options: UpdateDistributorOptions,
) {
  const currentItem = await getDistributorById(distributorId);
  const nextName =
    itemPatch &&
    typeof itemPatch === "object" &&
    !Array.isArray(itemPatch) &&
    typeof (itemPatch as { name?: unknown }).name === "string"
      ? (itemPatch as { name: string }).name
      : currentItem.name;

  await assertDistributorNameUnique(nextName, distributorId);

  const updatedItem = await writeDistributor(
    distributorId,
    async (current) => {
      assertBaseVersion(current, options.baseVersion);

      if (!itemPatch || typeof itemPatch !== "object" || Array.isArray(itemPatch)) {
        throw new ErpResourceValidationError(
          "Carga invalida para o distribuidor.",
        );
      }

      const candidateId = (itemPatch as { id?: unknown }).id;

      if (
        candidateId !== undefined &&
        (typeof candidateId !== "string" ||
          normalizeDistributorId(candidateId) !== distributorId)
      ) {
        throw new ErpResourceValidationError(
          "O id do distribuidor precisa corresponder ao id da rota.",
        );
      }

      const merged = validateDistributorWritePayload(
        {
          ...toDistributorPayload(current),
          ...itemPatch,
          id: distributorId,
        },
        distributorId,
      );

      const currentPayload = toDistributorPayload(current);

      if (
        currentPayload &&
        areDistributorPayloadsEqual(currentPayload, merged)
      ) {
        return {
          type: "noop",
          value: current,
        } satisfies DistributorMutationResult;
      }

      return {
        type: "set",
        value: merged,
      } satisfies DistributorMutationResult;
    },
  );

  assertDistributorWriteResult(updatedItem);
  return updatedItem;
}

export async function deleteDistributor(
  distributorId: string,
  baseVersion: number,
): Promise<DeleteDistributorResult> {
  const deletedItem = await writeDistributor(
    distributorId,
    async (current) => {
      assertBaseVersion(current, baseVersion);

      return {
        type: "delete",
        value: current,
      } satisfies DistributorMutationResult;
    },
  );

  assertDistributorDeleteResult(deletedItem);

  return {
    id: deletedItem.id,
    version: deletedItem.version,
    deletedAt: deletedItem.deletedAt,
  };
}
