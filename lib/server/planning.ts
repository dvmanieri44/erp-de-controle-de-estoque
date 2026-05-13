import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PlanningItem } from "@/lib/operations-data";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import {
  ErpResourceValidationError,
  sanitizeStoredErpResourceItemData,
  validateErpResourceItemData,
} from "@/lib/server/erp-resource-schema";
import { readErpResource } from "@/lib/server/erp-state";
import { getServerPersistenceProvider } from "@/lib/server/server-persistence";

const PLANNING_COLLECTION = "planning";
const PLANNING_RESOURCE_ID = "operations.planning";
const DEFAULT_PLANNING_FILE = path.join(
  process.cwd(),
  ".data",
  "planning-items.json",
);

let fileWriteQueue = Promise.resolve();

type PlanningVersion = number;

type StoredPlanningDocument = PlanningItem & {
  id: string;
  version: PlanningVersion;
  updatedAt: string | null;
  deleted?: false;
};

type DeletedPlanningDocument = {
  id: string;
  deleted: true;
  deletedAt: string;
  version: PlanningVersion;
  updatedAt: string | null;
};

type PlanningRecordLookup = {
  item: PlanningRecord | null;
  exists: boolean;
};

type PlanningMergeEntry =
  | { type: "item"; item: StoredPlanningDocument }
  | { type: "deleted"; item: DeletedPlanningDocument };

type StoredPlanningEntry = StoredPlanningDocument | DeletedPlanningDocument;

type DeletePlanningResult = {
  id: string;
  version: PlanningVersion;
  deletedAt: string;
};

type PlanningFileStore = {
  items?: Record<string, StoredPlanningEntry>;
};

export type PlanningRecord = PlanningItem & {
  id: string;
  version: PlanningVersion;
  updatedAt: string | null;
};

export type ListPlanningItemsResult = {
  items: PlanningRecord[];
  count: number;
};

export type UpdatePlanningItemOptions = {
  baseVersion: number;
};

type PlanningMutationResult =
  | { type: "set"; value: PlanningItem & { id: string } }
  | { type: "noop"; value: PlanningRecord }
  | { type: "delete"; value: PlanningRecord };

export class PlanningConflictError extends Error {
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

export class PlanningNotFoundError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.status = 404;
  }
}

export function requirePlanningBaseVersion(value: unknown, operation: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ErpResourceValidationError(
      `baseVersion obrigatorio para ${operation} o planejamento.`,
      400,
    );
  }

  return value;
}

export function getPlanningVersionConflictPayload(error: PlanningConflictError) {
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

function normalizePlanningId(value: string) {
  return value.trim();
}

function getLegacyPlanningId(item: Pick<PlanningItem, "route" | "window">) {
  const key = `${normalizeReference(item.route)}::${normalizeReference(item.window)}`;
  const digest = createHash("sha1").update(key).digest("hex").slice(0, 16);
  return `planning_${digest}`;
}

function getPlanningId(item: PlanningItem) {
  return typeof item.id === "string" && item.id.trim()
    ? normalizePlanningId(item.id)
    : getLegacyPlanningId(item);
}

function getPlanningFilePath() {
  return process.env.PLANNING_FILE_PATH
    ? path.resolve(process.cwd(), process.env.PLANNING_FILE_PATH)
    : DEFAULT_PLANNING_FILE;
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

function normalizeStoredPlanningDocument(
  planningId: string,
  value: unknown,
): StoredPlanningDocument | null {
  const sanitized = sanitizeStoredErpResourceItemData(PLANNING_RESOURCE_ID, value);
  const item = sanitized.item;

  if (!item) {
    return null;
  }

  const resolvedId = getPlanningId(item);

  if (resolvedId !== planningId) {
    return null;
  }

  const candidate = value as Partial<StoredPlanningDocument>;

  return {
    ...item,
    id: planningId,
    version: normalizeVersion(candidate.version),
    updatedAt: normalizeUpdatedAt(candidate.updatedAt),
  };
}

function normalizeDeletedPlanningDocument(
  planningId: string,
  value: unknown,
): DeletedPlanningDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<DeletedPlanningDocument>;

  if (
    candidate.deleted !== true ||
    candidate.id !== planningId ||
    typeof candidate.deletedAt !== "string"
  ) {
    return null;
  }

  return {
    id: planningId,
    deleted: true,
    deletedAt: candidate.deletedAt,
    version: normalizeVersion(candidate.version),
    updatedAt: normalizeUpdatedAt(candidate.updatedAt),
  };
}

function normalizeStoredPlanningEntry(
  planningId: string,
  value: unknown,
): PlanningMergeEntry | null {
  const deletedPlanning = normalizeDeletedPlanningDocument(planningId, value);

  if (deletedPlanning) {
    return {
      type: "deleted",
      item: deletedPlanning,
    };
  }

  const item = normalizeStoredPlanningDocument(planningId, value);

  if (!item) {
    return null;
  }

  return {
    type: "item",
    item,
  };
}

function toStoredPlanningEntry(entry: PlanningMergeEntry): StoredPlanningEntry {
  return entry.item;
}

function toPlanningMergeEntry(document: StoredPlanningEntry): PlanningMergeEntry {
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
    return {} as Record<string, StoredPlanningEntry>;
  }

  const items: Record<string, StoredPlanningEntry> = {};

  for (const [planningId, candidate] of Object.entries(value)) {
    const normalized = normalizeStoredPlanningEntry(planningId, candidate);

    if (normalized) {
      items[planningId] = toStoredPlanningEntry(normalized);
    }
  }

  return items;
}

async function readPlanningFileStore() {
  try {
    const raw = await readFile(getPlanningFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        items: {},
      } satisfies Required<PlanningFileStore>;
    }

    const value = parsed as PlanningFileStore;

    return {
      items: normalizeFileItems(value.items),
    } satisfies Required<PlanningFileStore>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        items: {},
      } satisfies Required<PlanningFileStore>;
    }

    throw error;
  }
}

function arePlanningPayloadsEqual(left: PlanningItem, right: PlanningItem) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toPlanningPayload(
  item: PlanningRecord | null,
): (PlanningItem & { id: string }) | null {
  if (!item) {
    return null;
  }

  const payload = { ...item } as Partial<PlanningRecord>;
  delete payload.version;
  delete payload.updatedAt;
  return payload as PlanningItem & { id: string };
}

function validatePlanningWritePayload(value: unknown, planningId?: string) {
  const normalized = validateErpResourceItemData(PLANNING_RESOURCE_ID, value);
  const candidateId =
    typeof normalized.id === "string" && normalized.id.trim()
      ? normalizePlanningId(normalized.id)
      : undefined;

  if (planningId && candidateId && candidateId !== planningId) {
    throw new ErpResourceValidationError(
      "O id do planejamento precisa corresponder ao id da rota.",
    );
  }

  return {
    ...normalized,
    id: planningId ?? candidateId ?? getLegacyPlanningId(normalized),
  };
}

function assertBaseVersion(
  current: PlanningRecord | null,
  baseVersion: number,
): asserts current is PlanningRecord {
  if (!Number.isInteger(baseVersion) || baseVersion < 1) {
    throw new ErpResourceValidationError(
      "Versao base invalida para o planejamento.",
    );
  }

  if (!current) {
    throw new PlanningNotFoundError("Planejamento nao encontrado.");
  }

  if (current.version === baseVersion) {
    return;
  }

  throw new PlanningConflictError(
    "O planejamento foi alterado por outra sessao. Recarregue os dados antes de salvar novamente.",
    current.version,
    current.updatedAt,
  );
}

function assertPlanningWriteResult(
  value: PlanningRecord | DeletedPlanningDocument,
): asserts value is PlanningRecord {
  if ("deleted" in value && value.deleted === true) {
    throw new Error(
      "Operacao de planejamento retornou um marcador de exclusao inesperado.",
    );
  }
}

function assertPlanningDeleteResult(
  value: PlanningRecord | DeletedPlanningDocument,
): asserts value is DeletedPlanningDocument {
  if (!("deleted" in value) || value.deleted !== true) {
    throw new Error(
      "Operacao de exclusao do planejamento nao gerou marcador de exclusao.",
    );
  }
}

function buildLegacyPlanningRecord(
  item: PlanningItem,
  updatedAt: string | null,
): PlanningRecord {
  return {
    ...item,
    id: getPlanningId(item),
    version: 1,
    updatedAt,
  };
}

async function readLegacyPlanningSnapshot() {
  return readErpResource(PLANNING_RESOURCE_ID);
}

function mergePlanningItems(
  itemizedEntries: readonly PlanningMergeEntry[],
  legacyItems: readonly PlanningItem[],
  legacyUpdatedAt: string | null,
) {
  const activeEntries = new Map<string, PlanningRecord>();
  const deletedPlanningIds = new Set<string>();
  const consumedIds = new Set<string>();

  for (const entry of itemizedEntries) {
    if (entry.type === "deleted") {
      deletedPlanningIds.add(entry.item.id);
      activeEntries.delete(entry.item.id);
      continue;
    }

    activeEntries.set(entry.item.id, entry.item);
  }

  const mergedLegacyItems: PlanningRecord[] = [];

  for (const legacyItem of legacyItems) {
    const planningId = getPlanningId(legacyItem);

    if (deletedPlanningIds.has(planningId)) {
      continue;
    }

    const itemizedEntry = activeEntries.get(planningId);

    if (itemizedEntry) {
      mergedLegacyItems.push(itemizedEntry);
      consumedIds.add(planningId);
      continue;
    }

    mergedLegacyItems.push(
      buildLegacyPlanningRecord(legacyItem, legacyUpdatedAt),
    );
  }

  const createdPlanningItems = [...activeEntries.values()]
    .filter((item) => !consumedIds.has(item.id))
    .sort((left, right) => {
      const leftUpdatedAt = left.updatedAt ?? "";
      const rightUpdatedAt = right.updatedAt ?? "";

      if (leftUpdatedAt !== rightUpdatedAt) {
        return rightUpdatedAt.localeCompare(leftUpdatedAt);
      }

      return left.route.localeCompare(right.route);
    });

  return [...createdPlanningItems, ...mergedLegacyItems];
}

async function assertPlanningRouteUnique(route: string, currentId?: string) {
  const normalizedRoute = normalizeReference(route);
  const payload = await listPlanningItems();
  const conflictingItem = payload.items.find(
    (item) =>
      normalizeReference(item.route) === normalizedRoute && item.id !== currentId,
  );

  if (conflictingItem) {
    throw new ErpResourceValidationError(
      "Ja existe um planejamento com essa rota.",
      409,
    );
  }
}

async function listFirebasePlanningItems() {
  const [snapshot, legacyResource] = await Promise.all([
    getFirebaseAdminDb()
      .collection<StoredPlanningEntry>(PLANNING_COLLECTION)
      .get(),
    readLegacyPlanningSnapshot(),
  ]);

  const itemizedEntries = snapshot.docs
    .map((document) =>
      normalizeStoredPlanningEntry(document.id, document.data()),
    )
    .filter((document): document is PlanningMergeEntry => document !== null)
    .sort((left, right) => left.item.id.localeCompare(right.item.id));

  return mergePlanningItems(
    itemizedEntries,
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

async function listFilePlanningItems() {
  const [store, legacyResource] = await Promise.all([
    readPlanningFileStore(),
    readLegacyPlanningSnapshot(),
  ]);

  return mergePlanningItems(
    Object.values(store.items)
      .map((document) => toPlanningMergeEntry(document))
      .sort((left, right) => left.item.id.localeCompare(right.item.id)),
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

function findLegacyPlanningItem(
  items: readonly PlanningItem[],
  planningId: string,
) {
  return items.find((candidate) => getPlanningId(candidate) === planningId);
}

async function readFirebasePlanningItem(
  planningId: string,
): Promise<PlanningRecordLookup> {
  const snapshot = await getFirebaseAdminDb()
    .collection<StoredPlanningEntry>(PLANNING_COLLECTION)
    .doc(planningId)
    .get();

  if (snapshot.exists) {
    const deletedItem = normalizeDeletedPlanningDocument(
      planningId,
      snapshot.data(),
    );

    if (deletedItem) {
      return {
        item: null,
        exists: false,
      };
    }

    const item = normalizeStoredPlanningDocument(planningId, snapshot.data());

    if (item) {
      return {
        item,
        exists: true,
      };
    }
  }

  const legacyResource = await readLegacyPlanningSnapshot();
  const legacyItem = findLegacyPlanningItem(legacyResource.data, planningId);

  if (!legacyItem) {
    return {
      item: null,
      exists: false,
    };
  }

  return {
    item: buildLegacyPlanningRecord(legacyItem, legacyResource.updatedAt),
    exists: true,
  };
}

async function readFilePlanningItem(
  planningId: string,
): Promise<PlanningRecordLookup> {
  const store = await readPlanningFileStore();
  const existingDocument = store.items[planningId] ?? null;

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

  const legacyResource = await readLegacyPlanningSnapshot();
  const legacyItem = findLegacyPlanningItem(legacyResource.data, planningId);

  if (!legacyItem) {
    return {
      item: null,
      exists: false,
    };
  }

  return {
    item: buildLegacyPlanningRecord(legacyItem, legacyResource.updatedAt),
    exists: true,
  };
}

async function writeFirebasePlanningItem(
  planningId: string,
  update: (current: PlanningRecord | null) => Promise<PlanningMutationResult>,
) {
  const database = getFirebaseAdminDb();
  const legacyResource = await readLegacyPlanningSnapshot();
  const legacyItem = findLegacyPlanningItem(legacyResource.data, planningId);
  const collectionRef = database.collection<StoredPlanningEntry>(PLANNING_COLLECTION);
  const documentRef = collectionRef.doc(planningId);

  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(documentRef);
    const deletedItem = snapshot.exists
      ? normalizeDeletedPlanningDocument(planningId, snapshot.data())
      : null;
    const current = snapshot.exists
      ? deletedItem
        ? null
        : normalizeStoredPlanningDocument(planningId, snapshot.data())
      : legacyItem
        ? buildLegacyPlanningRecord(legacyItem, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    const now = new Date().toISOString();

    if (next.type === "delete") {
      const deletedPlanning: DeletedPlanningDocument = {
        id: planningId,
        deleted: true,
        deletedAt: now,
        version: next.value.version + 1,
        updatedAt: now,
      };

      transaction.set(documentRef, deletedPlanning, { merge: false });
      return deletedPlanning;
    }

    const nextDocument: StoredPlanningDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
      updatedAt: now,
    };

    transaction.set(documentRef, nextDocument, { merge: false });
    return nextDocument;
  });
}

async function writeFilePlanningItem(
  planningId: string,
  update: (current: PlanningRecord | null) => Promise<PlanningMutationResult>,
) {
  return queueFileWrite(async () => {
    const filePath = getPlanningFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });

    const [store, legacyResource] = await Promise.all([
      readPlanningFileStore(),
      readLegacyPlanningSnapshot(),
    ]);
    const legacyItem = findLegacyPlanningItem(legacyResource.data, planningId);
    const existingDocument = store.items[planningId] ?? null;
    const current: PlanningRecord | null = existingDocument
      ? "deleted" in existingDocument && existingDocument.deleted === true
        ? null
        : existingDocument
      : legacyItem
        ? buildLegacyPlanningRecord(legacyItem, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    const now = new Date().toISOString();

    if (next.type === "delete") {
      const deletedPlanning: DeletedPlanningDocument = {
        id: planningId,
        deleted: true,
        deletedAt: now,
        version: next.value.version + 1,
        updatedAt: now,
      };

      store.items[planningId] = deletedPlanning;
      await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
      return deletedPlanning;
    }

    const nextDocument: StoredPlanningDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
      updatedAt: now,
    };

    store.items[planningId] = nextDocument;
    await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
    return nextDocument;
  });
}

async function writePlanningItem(
  planningId: string,
  update: (current: PlanningRecord | null) => Promise<PlanningMutationResult>,
) {
  if (getPlanningItemsPersistenceProvider() === "firebase") {
    return writeFirebasePlanningItem(planningId, update);
  }

  return writeFilePlanningItem(planningId, update);
}

export function getPlanningItemsPersistenceProvider() {
  return getServerPersistenceProvider("planejamento");
}

export async function listPlanningItems(): Promise<ListPlanningItemsResult> {
  const items =
    getPlanningItemsPersistenceProvider() === "firebase"
      ? await listFirebasePlanningItems()
      : await listFilePlanningItems();

  return {
    items,
    count: items.length,
  };
}

export async function getPlanningItemById(planningId: string) {
  const result =
    getPlanningItemsPersistenceProvider() === "firebase"
      ? await readFirebasePlanningItem(planningId)
      : await readFilePlanningItem(planningId);

  if (!result.exists || !result.item) {
    throw new PlanningNotFoundError("Planejamento nao encontrado.");
  }

  return result.item;
}

export async function createPlanningItem(item: unknown): Promise<PlanningRecord> {
  const normalized = validatePlanningWritePayload(item);
  await assertPlanningRouteUnique(normalized.route);

  const createdItem = await writePlanningItem(normalized.id, async (current) => {
    if (current) {
      throw new ErpResourceValidationError(
        "Ja existe um planejamento com o id informado.",
        409,
      );
    }

    return {
      type: "set",
      value: normalized,
    };
  });

  assertPlanningWriteResult(createdItem);
  return createdItem;
}

export async function updatePlanningItem(
  planningId: string,
  itemPatch: unknown,
  options: UpdatePlanningItemOptions,
) {
  const currentItem = await getPlanningItemById(planningId);
  const nextRoute =
    itemPatch &&
    typeof itemPatch === "object" &&
    !Array.isArray(itemPatch) &&
    typeof (itemPatch as { route?: unknown }).route === "string"
      ? (itemPatch as { route: string }).route
      : currentItem.route;

  await assertPlanningRouteUnique(nextRoute, planningId);

  const updatedItem = await writePlanningItem(planningId, async (current) => {
    assertBaseVersion(current, options.baseVersion);

    if (!itemPatch || typeof itemPatch !== "object" || Array.isArray(itemPatch)) {
      throw new ErpResourceValidationError(
        "Carga invalida para o planejamento.",
      );
    }

    const candidateId = (itemPatch as { id?: unknown }).id;

    if (
      candidateId !== undefined &&
      (typeof candidateId !== "string" ||
        normalizePlanningId(candidateId) !== planningId)
    ) {
      throw new ErpResourceValidationError(
        "O id do planejamento precisa corresponder ao id da rota.",
      );
    }

    const merged = validatePlanningWritePayload(
      {
        ...toPlanningPayload(current),
        ...itemPatch,
        id: planningId,
      },
      planningId,
    );

    const currentPayload = toPlanningPayload(current);

    if (currentPayload && arePlanningPayloadsEqual(currentPayload, merged)) {
      return {
        type: "noop",
        value: current,
      } satisfies PlanningMutationResult;
    }

    return {
      type: "set",
      value: merged,
    } satisfies PlanningMutationResult;
  });

  assertPlanningWriteResult(updatedItem);
  return updatedItem;
}

export async function deletePlanningItem(
  planningId: string,
  baseVersion: number,
): Promise<DeletePlanningResult> {
  const deletedItem = await writePlanningItem(planningId, async (current) => {
    assertBaseVersion(current, baseVersion);

    return {
      type: "delete",
      value: current,
    } satisfies PlanningMutationResult;
  });

  assertPlanningDeleteResult(deletedItem);

  return {
    id: deletedItem.id,
    version: deletedItem.version,
    deletedAt: deletedItem.deletedAt,
  };
}
