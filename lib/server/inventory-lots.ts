import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { LotItem } from "@/lib/operations-data";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import { listInventoryMovements } from "@/lib/server/inventory-movements";
import {
  ErpResourceValidationError,
  sanitizeStoredErpResourceItemData,
  validateErpResourceItemData,
} from "@/lib/server/erp-resource-schema";
import { readErpResource } from "@/lib/server/erp-state";
import { getServerPersistenceProvider } from "@/lib/server/server-persistence";

const INVENTORY_LOTS_COLLECTION = "inventoryLots";
const LOTS_RESOURCE_ID = "operations.lots";
const DEFAULT_INVENTORY_LOTS_FILE = path.join(
  process.cwd(),
  ".data",
  "inventory-lots.json",
);

let fileWriteQueue = Promise.resolve();

type LotVersion = number;

type StoredInventoryLotDocument = LotItem & {
  version: LotVersion;
  updatedAt: string | null;
  deleted?: false;
};

type DeletedInventoryLotDocument = {
  code: string;
  deleted: true;
  deletedAt: string;
  version: LotVersion;
  updatedAt: string | null;
};

type InventoryLotItemRecord = {
  lot: InventoryLotRecord | null;
  exists: boolean;
};

type InventoryLotMergeEntry =
  | { type: "lot"; lot: StoredInventoryLotDocument }
  | { type: "deleted"; lot: DeletedInventoryLotDocument };

type StoredInventoryLotEntry =
  | StoredInventoryLotDocument
  | DeletedInventoryLotDocument;

type DeleteInventoryLotResult = {
  code: string;
  version: LotVersion;
  deletedAt: string;
};

type InventoryLotsFileStore = {
  items?: Record<string, StoredInventoryLotEntry>;
};

export type InventoryLotRecord = LotItem & {
  version: LotVersion;
  updatedAt: string | null;
};

export type ListInventoryLotsResult = {
  items: InventoryLotRecord[];
  count: number;
};

export type UpdateInventoryLotOptions = {
  baseVersion: number;
};

type LotDocumentMutationResult =
  | { type: "set"; value: LotItem }
  | { type: "noop"; value: InventoryLotRecord }
  | { type: "delete"; value: InventoryLotRecord };

export class InventoryLotConflictError extends Error {
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

export class InventoryLotNotFoundError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.status = 404;
  }
}

export class InventoryLotInUseError extends Error {
  status: number;
  reasons: string[];

  constructor(message: string, reasons: string[]) {
    super(message);
    this.status = 409;
    this.reasons = reasons;
  }
}

export function requireInventoryLotBaseVersion(
  value: unknown,
  operation: string,
) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ErpResourceValidationError(
      `baseVersion obrigatorio para ${operation} o lote.`,
      400,
    );
  }

  return value;
}

export function getInventoryLotVersionConflictPayload(
  error: InventoryLotConflictError,
) {
  return {
    error: "VERSION_CONFLICT" as const,
    currentVersion: error.currentVersion,
  };
}

function getInventoryLotsFilePath() {
  return process.env.INVENTORY_LOTS_FILE_PATH
    ? path.resolve(process.cwd(), process.env.INVENTORY_LOTS_FILE_PATH)
    : DEFAULT_INVENTORY_LOTS_FILE;
}

function queueFileWrite<T>(operation: () => Promise<T>) {
  const nextOperation = fileWriteQueue.then(operation, operation);
  fileWriteQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );
  return nextOperation;
}

async function readInventoryLotsFileStore() {
  try {
    const raw = await readFile(getInventoryLotsFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        items: {},
      } satisfies Required<InventoryLotsFileStore>;
    }

    const value = parsed as InventoryLotsFileStore;

    return {
      items: normalizeFileItems(value.items),
    } satisfies Required<InventoryLotsFileStore>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        items: {},
      } satisfies Required<InventoryLotsFileStore>;
    }

    throw error;
  }
}

function normalizeStoredLotDocument(
  lotCode: string,
  value: unknown,
): StoredInventoryLotDocument | null {
  const sanitized = sanitizeStoredErpResourceItemData(LOTS_RESOURCE_ID, value);
  const item = sanitized.item;

  if (!item || item.code !== lotCode) {
    return null;
  }

  const candidate = value as Partial<StoredInventoryLotDocument>;

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

function normalizeDeletedLotDocument(
  lotCode: string,
  value: unknown,
): DeletedInventoryLotDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<DeletedInventoryLotDocument>;

  if (
    candidate.deleted !== true ||
    candidate.code !== lotCode ||
    typeof candidate.deletedAt !== "string"
  ) {
    return null;
  }

  return {
    code: lotCode,
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

function normalizeStoredLotEntry(
  lotCode: string,
  value: unknown,
): InventoryLotMergeEntry | null {
  const deletedLot = normalizeDeletedLotDocument(lotCode, value);

  if (deletedLot) {
    return {
      type: "deleted",
      lot: deletedLot,
    };
  }

  const lot = normalizeStoredLotDocument(lotCode, value);

  if (!lot) {
    return null;
  }

  return {
    type: "lot",
    lot,
  };
}

function toStoredLotEntry(
  entry: InventoryLotMergeEntry,
): StoredInventoryLotEntry {
  return entry.lot;
}

function toLotMergeEntry(
  document: StoredInventoryLotEntry,
): InventoryLotMergeEntry {
  if ("deleted" in document && document.deleted === true) {
    return {
      type: "deleted",
      lot: document,
    };
  }

  return {
    type: "lot",
    lot: document,
  };
}

function normalizeFileItems(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, StoredInventoryLotEntry>;
  }

  const items: Record<string, StoredInventoryLotEntry> = {};

  for (const [lotCode, candidate] of Object.entries(value)) {
    const normalized = normalizeStoredLotEntry(lotCode, candidate);

    if (normalized) {
      items[lotCode] = toStoredLotEntry(normalized);
    }
  }

  return items;
}

function sortLots<TValue extends LotItem>(items: TValue[]) {
  return [...items].sort((left, right) => left.code.localeCompare(right.code));
}

function areLotPayloadsEqual(left: LotItem, right: LotItem) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toLotPayload(lot: InventoryLotRecord | null): LotItem | null {
  if (!lot) {
    return null;
  }

  const payload = { ...lot } as Partial<InventoryLotRecord>;
  delete payload.version;
  delete payload.updatedAt;
  return payload as LotItem;
}

function validateLotWritePayload(value: unknown, lotCode?: string) {
  const normalized = validateErpResourceItemData(LOTS_RESOURCE_ID, value);

  if (lotCode && normalized.code !== lotCode) {
    throw new ErpResourceValidationError(
      "O code do lote precisa corresponder ao code da rota.",
    );
  }

  return normalized;
}

function assertBaseVersion(
  current: InventoryLotRecord | null,
  baseVersion: number,
): asserts current is InventoryLotRecord {
  if (!Number.isInteger(baseVersion) || baseVersion < 1) {
    throw new ErpResourceValidationError(
      "Versao base invalida para o lote.",
    );
  }

  if (!current) {
    throw new InventoryLotNotFoundError("Lote nao encontrado.");
  }

  if (current.version === baseVersion) {
    return;
  }

  throw new InventoryLotConflictError(
    "O lote foi alterado por outra sessao. Recarregue os dados antes de salvar novamente.",
    current.version,
    current.updatedAt,
  );
}

function assertLotWriteResult(
  value: InventoryLotRecord | DeletedInventoryLotDocument,
): asserts value is InventoryLotRecord {
  if ("deleted" in value && value.deleted === true) {
    throw new Error("Operacao de lote retornou um marcador de exclusao inesperado.");
  }
}

function assertLotDeleteResult(
  value: InventoryLotRecord | DeletedInventoryLotDocument,
): asserts value is DeletedInventoryLotDocument {
  if (!("deleted" in value) || value.deleted !== true) {
    throw new Error("Operacao de exclusao do lote nao gerou marcador de exclusao.");
  }
}

async function assertLotCanBeDeleted(lot: InventoryLotRecord) {
  const movementsPayload = await listInventoryMovements();

  if (
    !movementsPayload.items.some((movement) => movement.lotCode === lot.code)
  ) {
    return;
  }

  throw new InventoryLotInUseError(
    "O lote possui movimentacoes vinculadas e nao pode ser excluido.",
    ["MOVEMENTS"],
  );
}

function buildLegacyLotRecord(
  lot: LotItem,
  updatedAt: string | null,
): InventoryLotRecord {
  return {
    ...lot,
    version: 1,
    updatedAt,
  };
}

async function readLegacyLotsSnapshot() {
  return readErpResource(LOTS_RESOURCE_ID);
}

function mergeInventoryLots(
  itemizedEntries: readonly InventoryLotMergeEntry[],
  legacyLots: readonly LotItem[],
  legacyUpdatedAt: string | null,
) {
  const merged = new Map<string, InventoryLotRecord>();
  const deletedLotCodes = new Set<string>();

  for (const entry of itemizedEntries) {
    if (entry.type === "deleted") {
      deletedLotCodes.add(entry.lot.code);
      merged.delete(entry.lot.code);
      continue;
    }

    merged.set(entry.lot.code, entry.lot);
  }

  for (const legacyLot of legacyLots) {
    if (!deletedLotCodes.has(legacyLot.code) && !merged.has(legacyLot.code)) {
      merged.set(
        legacyLot.code,
        buildLegacyLotRecord(legacyLot, legacyUpdatedAt),
      );
    }
  }

  return sortLots([...merged.values()]);
}

async function listFirebaseInventoryLots() {
  const [snapshot, legacyResource] = await Promise.all([
    getFirebaseAdminDb()
      .collection<StoredInventoryLotEntry>(INVENTORY_LOTS_COLLECTION)
      .get(),
    readLegacyLotsSnapshot(),
  ]);

  const itemizedEntries = snapshot.docs
    .map((document) =>
      normalizeStoredLotEntry(document.id, document.data()),
    )
    .filter(
      (document): document is InventoryLotMergeEntry => document !== null,
    )
    .sort((left, right) => left.lot.code.localeCompare(right.lot.code));

  return mergeInventoryLots(
    itemizedEntries,
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

async function listFileInventoryLots() {
  const [store, legacyResource] = await Promise.all([
    readInventoryLotsFileStore(),
    readLegacyLotsSnapshot(),
  ]);

  return mergeInventoryLots(
    Object.values(store.items)
      .map((document) => toLotMergeEntry(document))
      .sort((left, right) => left.lot.code.localeCompare(right.lot.code)),
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

async function readFirebaseInventoryLot(
  lotCode: string,
): Promise<InventoryLotItemRecord> {
  const snapshot = await getFirebaseAdminDb()
    .collection<StoredInventoryLotEntry>(INVENTORY_LOTS_COLLECTION)
    .doc(lotCode)
    .get();

  if (snapshot.exists) {
    const deletedLot = normalizeDeletedLotDocument(lotCode, snapshot.data());

    if (deletedLot) {
      return {
        lot: null,
        exists: false,
      };
    }

    const lot = normalizeStoredLotDocument(lotCode, snapshot.data());

    if (lot) {
      return {
        lot,
        exists: true,
      };
    }
  }

  const legacyResource = await readLegacyLotsSnapshot();
  const legacyLot = legacyResource.data.find((candidate) => candidate.code === lotCode);

  if (!legacyLot) {
    return {
      lot: null,
      exists: false,
    };
  }

  return {
    lot: buildLegacyLotRecord(legacyLot, legacyResource.updatedAt),
    exists: true,
  };
}

async function readFileInventoryLot(
  lotCode: string,
): Promise<InventoryLotItemRecord> {
  const store = await readInventoryLotsFileStore();
  const existingDocument = store.items[lotCode] ?? null;

  if (existingDocument) {
    if ("deleted" in existingDocument && existingDocument.deleted === true) {
      return {
        lot: null,
        exists: false,
      };
    }

    return {
      lot: existingDocument,
      exists: true,
    };
  }

  const legacyResource = await readLegacyLotsSnapshot();
  const legacyLot = legacyResource.data.find((candidate) => candidate.code === lotCode);

  if (!legacyLot) {
    return {
      lot: null,
      exists: false,
    };
  }

  return {
    lot: buildLegacyLotRecord(legacyLot, legacyResource.updatedAt),
    exists: true,
  };
}

async function writeFirebaseLotDocument(
  lotCode: string,
  update: (current: InventoryLotRecord | null) => Promise<LotDocumentMutationResult>,
) {
  const database = getFirebaseAdminDb();
  const legacyResource = await readLegacyLotsSnapshot();
  const legacyLot = legacyResource.data.find((candidate) => candidate.code === lotCode);
  const collectionRef =
    database.collection<StoredInventoryLotEntry>(INVENTORY_LOTS_COLLECTION);
  const documentRef = collectionRef.doc(lotCode);

  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(documentRef);
    const deletedLot = snapshot.exists
      ? normalizeDeletedLotDocument(lotCode, snapshot.data())
      : null;
    const current = snapshot.exists
      ? deletedLot
        ? null
        : normalizeStoredLotDocument(lotCode, snapshot.data())
      : legacyLot
        ? buildLegacyLotRecord(legacyLot, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    if (next.type === "delete") {
      const deletedAt = new Date().toISOString();
      const deletedDocument: DeletedInventoryLotDocument = {
        code: lotCode,
        deleted: true,
        deletedAt,
        updatedAt: deletedAt,
        version: next.value.version + 1,
      };

      transaction.set(documentRef, deletedDocument, { merge: false });
      return deletedDocument;
    }

    const nextDocument: StoredInventoryLotDocument = {
      ...next.value,
      updatedAt: new Date().toISOString(),
      version: current ? current.version + 1 : 1,
    };

    transaction.set(documentRef, nextDocument, { merge: false });
    return nextDocument;
  });
}

async function writeFileLotDocument(
  lotCode: string,
  update: (current: InventoryLotRecord | null) => Promise<LotDocumentMutationResult>,
) {
  return queueFileWrite(async () => {
    const filePath = getInventoryLotsFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });

    const [store, legacyResource] = await Promise.all([
      readInventoryLotsFileStore(),
      readLegacyLotsSnapshot(),
    ]);
    const legacyLot = legacyResource.data.find((candidate) => candidate.code === lotCode);
    const existingDocument = store.items[lotCode] ?? null;
    const current: InventoryLotRecord | null = existingDocument
      ? "deleted" in existingDocument && existingDocument.deleted === true
        ? null
        : existingDocument
      : legacyLot
        ? buildLegacyLotRecord(legacyLot, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    if (next.type === "delete") {
      const deletedAt = new Date().toISOString();
      const deletedDocument: DeletedInventoryLotDocument = {
        code: lotCode,
        deleted: true,
        deletedAt,
        updatedAt: deletedAt,
        version: next.value.version + 1,
      };

      store.items[lotCode] = deletedDocument;
      await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
      return deletedDocument;
    }

    const nextDocument: StoredInventoryLotDocument = {
      ...next.value,
      updatedAt: new Date().toISOString(),
      version: current ? current.version + 1 : 1,
    };

    store.items[lotCode] = nextDocument;
    await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
    return nextDocument;
  });
}

async function writeLotDocument(
  lotCode: string,
  update: (current: InventoryLotRecord | null) => Promise<LotDocumentMutationResult>,
) {
  if (getInventoryLotsPersistenceProvider() === "firebase") {
    return writeFirebaseLotDocument(lotCode, update);
  }

  return writeFileLotDocument(lotCode, update);
}

export function getInventoryLotsPersistenceProvider() {
  return getServerPersistenceProvider("lotes do inventario");
}

export async function listLots(): Promise<ListInventoryLotsResult> {
  const items =
    getInventoryLotsPersistenceProvider() === "firebase"
      ? await listFirebaseInventoryLots()
      : await listFileInventoryLots();

  return {
    items,
    count: items.length,
  };
}

export async function getLotByCode(lotCode: string) {
  const result =
    getInventoryLotsPersistenceProvider() === "firebase"
      ? await readFirebaseInventoryLot(lotCode)
      : await readFileInventoryLot(lotCode);

  if (!result.exists || !result.lot) {
    throw new InventoryLotNotFoundError("Lote nao encontrado.");
  }

  return result.lot;
}

export async function createLot(
  lot: unknown,
): Promise<InventoryLotRecord> {
  const normalized = validateLotWritePayload(lot);

  const createdLot = await writeLotDocument(normalized.code, async (current) => {
    if (current) {
      throw new ErpResourceValidationError(
        "Ja existe um lote com o code informado.",
        409,
      );
    }

    return {
      type: "set",
      value: normalized,
    };
  });

  assertLotWriteResult(createdLot);
  return createdLot;
}

export async function updateLot(
  lotCode: string,
  lotPatch: unknown,
  options: UpdateInventoryLotOptions,
) {
  const updatedLot = await writeLotDocument(lotCode, async (current) => {
    assertBaseVersion(current, options.baseVersion);

    if (!lotPatch || typeof lotPatch !== "object" || Array.isArray(lotPatch)) {
      throw new ErpResourceValidationError("Carga invalida para o lote.");
    }

    const candidateCode = (lotPatch as { code?: unknown }).code;

    if (candidateCode !== undefined && candidateCode !== lotCode) {
      throw new ErpResourceValidationError(
        "O code do lote precisa corresponder ao code da rota.",
      );
    }

    const merged = validateLotWritePayload(
      {
        ...toLotPayload(current),
        ...lotPatch,
        code: lotCode,
      },
      lotCode,
    );

    const currentPayload = toLotPayload(current);

    if (currentPayload && areLotPayloadsEqual(currentPayload, merged)) {
      return {
        type: "noop",
        value: current,
      } satisfies LotDocumentMutationResult;
    }

    return {
      type: "set",
      value: merged,
    } satisfies LotDocumentMutationResult;
  });

  assertLotWriteResult(updatedLot);
  return updatedLot;
}

export async function deleteLot(
  lotCode: string,
  baseVersion: number,
): Promise<DeleteInventoryLotResult> {
  const deletedLot = await writeLotDocument(lotCode, async (current) => {
    assertBaseVersion(current, baseVersion);
    await assertLotCanBeDeleted(current);

    return {
      type: "delete",
      value: current,
    } satisfies LotDocumentMutationResult;
  });

  assertLotDeleteResult(deletedLot);

  return {
    code: deletedLot.code,
    version: deletedLot.version,
    deletedAt: deletedLot.deletedAt,
  };
}
