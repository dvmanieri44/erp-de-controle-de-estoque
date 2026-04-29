import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { QualityEventItem } from "@/lib/operations-data";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import {
  ErpResourceValidationError,
  sanitizeStoredErpResourceItemData,
  validateErpResourceItemData,
} from "@/lib/server/erp-resource-schema";
import { readErpResource } from "@/lib/server/erp-state";
import { getServerPersistenceProvider } from "@/lib/server/server-persistence";

const QUALITY_EVENTS_COLLECTION = "qualityEvents";
const QUALITY_EVENTS_RESOURCE_ID = "operations.quality-events";
const DEFAULT_QUALITY_EVENTS_FILE = path.join(
  process.cwd(),
  ".data",
  "quality-events.json",
);

let fileWriteQueue = Promise.resolve();

type QualityEventVersion = number;

type StoredQualityEventDocument = QualityEventItem & {
  id: string;
  version: QualityEventVersion;
  updatedAt: string | null;
  deleted?: false;
};

type DeletedQualityEventDocument = {
  id: string;
  deleted: true;
  deletedAt: string;
  version: QualityEventVersion;
  updatedAt: string | null;
};

type QualityEventItemRecord = {
  event: QualityEventRecord | null;
  exists: boolean;
};

type QualityEventMergeEntry =
  | { type: "event"; event: StoredQualityEventDocument }
  | { type: "deleted"; event: DeletedQualityEventDocument };

type StoredQualityEventEntry =
  | StoredQualityEventDocument
  | DeletedQualityEventDocument;

type DeleteQualityEventResult = {
  id: string;
  version: QualityEventVersion;
  deletedAt: string;
};

type QualityEventsFileStore = {
  items?: Record<string, StoredQualityEventEntry>;
};

export type QualityEventRecord = QualityEventItem & {
  id: string;
  version: QualityEventVersion;
  updatedAt: string | null;
};

export type ListQualityEventsResult = {
  items: QualityEventRecord[];
  count: number;
};

export type UpdateQualityEventOptions = {
  baseVersion: number;
};

type QualityEventDocumentMutationResult =
  | { type: "set"; value: QualityEventItem & { id: string } }
  | { type: "noop"; value: QualityEventRecord }
  | { type: "delete"; value: QualityEventRecord };

export class QualityEventConflictError extends Error {
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

export class QualityEventNotFoundError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.status = 404;
  }
}

export function requireQualityEventBaseVersion(
  value: unknown,
  operation: string,
) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ErpResourceValidationError(
      `baseVersion obrigatorio para ${operation} o evento de qualidade.`,
      400,
    );
  }

  return value;
}

export function getQualityEventVersionConflictPayload(
  error: QualityEventConflictError,
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

function normalizeQualityEventId(value: string) {
  return value.trim();
}

function getLegacyQualityEventId(
  event: Pick<QualityEventItem, "title" | "lot">,
) {
  const key = `${normalizeReference(event.title)}::${normalizeReference(event.lot)}`;
  const digest = createHash("sha1").update(key).digest("hex").slice(0, 16);
  return `qe_${digest}`;
}

function getQualityEventId(event: QualityEventItem) {
  return typeof event.id === "string" && event.id.trim()
    ? normalizeQualityEventId(event.id)
    : getLegacyQualityEventId(event);
}

function getQualityEventsFilePath() {
  return process.env.QUALITY_EVENTS_FILE_PATH
    ? path.resolve(process.cwd(), process.env.QUALITY_EVENTS_FILE_PATH)
    : DEFAULT_QUALITY_EVENTS_FILE;
}

function queueFileWrite<T>(operation: () => Promise<T>) {
  const nextOperation = fileWriteQueue.then(operation, operation);
  fileWriteQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );
  return nextOperation;
}

async function readQualityEventsFileStore() {
  try {
    const raw = await readFile(getQualityEventsFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        items: {},
      } satisfies Required<QualityEventsFileStore>;
    }

    const value = parsed as QualityEventsFileStore;

    return {
      items: normalizeFileItems(value.items),
    } satisfies Required<QualityEventsFileStore>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        items: {},
      } satisfies Required<QualityEventsFileStore>;
    }

    throw error;
  }
}

function normalizeStoredQualityEventDocument(
  eventId: string,
  value: unknown,
): StoredQualityEventDocument | null {
  const sanitized = sanitizeStoredErpResourceItemData(
    QUALITY_EVENTS_RESOURCE_ID,
    value,
  );
  const item = sanitized.item;

  if (!item) {
    return null;
  }

  const resolvedId = getQualityEventId(item);

  if (resolvedId !== eventId) {
    return null;
  }

  const candidate = value as Partial<StoredQualityEventDocument>;

  return {
    ...item,
    id: eventId,
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

function normalizeDeletedQualityEventDocument(
  eventId: string,
  value: unknown,
): DeletedQualityEventDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<DeletedQualityEventDocument>;

  if (
    candidate.deleted !== true ||
    candidate.id !== eventId ||
    typeof candidate.deletedAt !== "string"
  ) {
    return null;
  }

  return {
    id: eventId,
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

function normalizeStoredQualityEventEntry(
  eventId: string,
  value: unknown,
): QualityEventMergeEntry | null {
  const deletedEvent = normalizeDeletedQualityEventDocument(eventId, value);

  if (deletedEvent) {
    return {
      type: "deleted",
      event: deletedEvent,
    };
  }

  const event = normalizeStoredQualityEventDocument(eventId, value);

  if (!event) {
    return null;
  }

  return {
    type: "event",
    event,
  };
}

function toStoredQualityEventEntry(
  entry: QualityEventMergeEntry,
): StoredQualityEventEntry {
  return entry.event;
}

function toQualityEventMergeEntry(
  document: StoredQualityEventEntry,
): QualityEventMergeEntry {
  if ("deleted" in document && document.deleted === true) {
    return {
      type: "deleted",
      event: document,
    };
  }

  return {
    type: "event",
    event: document,
  };
}

function normalizeFileItems(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, StoredQualityEventEntry>;
  }

  const items: Record<string, StoredQualityEventEntry> = {};

  for (const [eventId, candidate] of Object.entries(value)) {
    const normalized = normalizeStoredQualityEventEntry(eventId, candidate);

    if (normalized) {
      items[eventId] = toStoredQualityEventEntry(normalized);
    }
  }

  return items;
}

function sortQualityEvents<TValue extends Pick<QualityEventItem, "title" | "lot">>(
  items: TValue[],
) {
  return [...items].sort((left, right) => {
    const byLot = left.lot.localeCompare(right.lot);
    return byLot === 0 ? left.title.localeCompare(right.title) : byLot;
  });
}

function areQualityEventPayloadsEqual(
  left: QualityEventItem,
  right: QualityEventItem,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toQualityEventPayload(
  event: QualityEventRecord | null,
): (QualityEventItem & { id: string }) | null {
  if (!event) {
    return null;
  }

  const payload = { ...event } as Partial<QualityEventRecord>;
  delete payload.version;
  delete payload.updatedAt;
  return payload as QualityEventItem & { id: string };
}

function validateQualityEventWritePayload(value: unknown, eventId?: string) {
  const normalized = validateErpResourceItemData(
    QUALITY_EVENTS_RESOURCE_ID,
    value,
  );
  const candidateId =
    typeof normalized.id === "string" && normalized.id.trim()
      ? normalizeQualityEventId(normalized.id)
      : undefined;

  if (eventId && candidateId && candidateId !== eventId) {
    throw new ErpResourceValidationError(
      "O id do evento de qualidade precisa corresponder ao id da rota.",
    );
  }

  return {
    ...normalized,
    id: eventId ?? candidateId ?? getLegacyQualityEventId(normalized),
  };
}

function assertBaseVersion(
  current: QualityEventRecord | null,
  baseVersion: number,
): asserts current is QualityEventRecord {
  if (!Number.isInteger(baseVersion) || baseVersion < 1) {
    throw new ErpResourceValidationError(
      "Versao base invalida para o evento de qualidade.",
    );
  }

  if (!current) {
    throw new QualityEventNotFoundError("Evento de qualidade nao encontrado.");
  }

  if (current.version === baseVersion) {
    return;
  }

  throw new QualityEventConflictError(
    "O evento de qualidade foi alterado por outra sessao. Recarregue os dados antes de salvar novamente.",
    current.version,
    current.updatedAt,
  );
}

function assertQualityEventWriteResult(
  value: QualityEventRecord | DeletedQualityEventDocument,
): asserts value is QualityEventRecord {
  if ("deleted" in value && value.deleted === true) {
    throw new Error("Operacao de evento de qualidade retornou um marcador de exclusao inesperado.");
  }
}

function assertQualityEventDeleteResult(
  value: QualityEventRecord | DeletedQualityEventDocument,
): asserts value is DeletedQualityEventDocument {
  if (!("deleted" in value) || value.deleted !== true) {
    throw new Error("Operacao de exclusao do evento de qualidade nao gerou marcador de exclusao.");
  }
}

function buildLegacyQualityEventRecord(
  event: QualityEventItem,
  updatedAt: string | null,
): QualityEventRecord {
  return {
    ...event,
    id: getQualityEventId(event),
    version: 1,
    updatedAt,
  };
}

async function readLegacyQualityEventsSnapshot() {
  return readErpResource(QUALITY_EVENTS_RESOURCE_ID);
}

function mergeQualityEvents(
  itemizedEntries: readonly QualityEventMergeEntry[],
  legacyEvents: readonly QualityEventItem[],
  legacyUpdatedAt: string | null,
) {
  const merged = new Map<string, QualityEventRecord>();
  const deletedEventIds = new Set<string>();

  for (const entry of itemizedEntries) {
    if (entry.type === "deleted") {
      deletedEventIds.add(entry.event.id);
      merged.delete(entry.event.id);
      continue;
    }

    merged.set(entry.event.id, entry.event);
  }

  for (const legacyEvent of legacyEvents) {
    const eventId = getQualityEventId(legacyEvent);

    if (!deletedEventIds.has(eventId) && !merged.has(eventId)) {
      merged.set(
        eventId,
        buildLegacyQualityEventRecord(legacyEvent, legacyUpdatedAt),
      );
    }
  }

  return sortQualityEvents([...merged.values()]);
}

async function listFirebaseQualityEvents() {
  const [snapshot, legacyResource] = await Promise.all([
    getFirebaseAdminDb()
      .collection<StoredQualityEventEntry>(QUALITY_EVENTS_COLLECTION)
      .get(),
    readLegacyQualityEventsSnapshot(),
  ]);

  const itemizedEntries = snapshot.docs
    .map((document) =>
      normalizeStoredQualityEventEntry(document.id, document.data()),
    )
    .filter(
      (document): document is QualityEventMergeEntry => document !== null,
    )
    .sort((left, right) => left.event.id.localeCompare(right.event.id));

  return mergeQualityEvents(
    itemizedEntries,
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

async function listFileQualityEvents() {
  const [store, legacyResource] = await Promise.all([
    readQualityEventsFileStore(),
    readLegacyQualityEventsSnapshot(),
  ]);

  return mergeQualityEvents(
    Object.values(store.items)
      .map((document) => toQualityEventMergeEntry(document))
      .sort((left, right) => left.event.id.localeCompare(right.event.id)),
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

function findLegacyQualityEvent(
  events: readonly QualityEventItem[],
  eventId: string,
) {
  return events.find((candidate) => getQualityEventId(candidate) === eventId);
}

async function readFirebaseQualityEvent(
  eventId: string,
): Promise<QualityEventItemRecord> {
  const snapshot = await getFirebaseAdminDb()
    .collection<StoredQualityEventEntry>(QUALITY_EVENTS_COLLECTION)
    .doc(eventId)
    .get();

  if (snapshot.exists) {
    const deletedEvent = normalizeDeletedQualityEventDocument(
      eventId,
      snapshot.data(),
    );

    if (deletedEvent) {
      return {
        event: null,
        exists: false,
      };
    }

    const event = normalizeStoredQualityEventDocument(
      eventId,
      snapshot.data(),
    );

    if (event) {
      return {
        event,
        exists: true,
      };
    }
  }

  const legacyResource = await readLegacyQualityEventsSnapshot();
  const legacyEvent = findLegacyQualityEvent(legacyResource.data, eventId);

  if (!legacyEvent) {
    return {
      event: null,
      exists: false,
    };
  }

  return {
    event: buildLegacyQualityEventRecord(
      legacyEvent,
      legacyResource.updatedAt,
    ),
    exists: true,
  };
}

async function readFileQualityEvent(
  eventId: string,
): Promise<QualityEventItemRecord> {
  const store = await readQualityEventsFileStore();
  const existingDocument = store.items[eventId] ?? null;

  if (existingDocument) {
    if ("deleted" in existingDocument && existingDocument.deleted === true) {
      return {
        event: null,
        exists: false,
      };
    }

    return {
      event: existingDocument,
      exists: true,
    };
  }

  const legacyResource = await readLegacyQualityEventsSnapshot();
  const legacyEvent = findLegacyQualityEvent(legacyResource.data, eventId);

  if (!legacyEvent) {
    return {
      event: null,
      exists: false,
    };
  }

  return {
    event: buildLegacyQualityEventRecord(
      legacyEvent,
      legacyResource.updatedAt,
    ),
    exists: true,
  };
}

async function writeFirebaseQualityEventDocument(
  eventId: string,
  update: (
    current: QualityEventRecord | null,
  ) => Promise<QualityEventDocumentMutationResult>,
) {
  const database = getFirebaseAdminDb();
  const legacyResource = await readLegacyQualityEventsSnapshot();
  const legacyEvent = findLegacyQualityEvent(legacyResource.data, eventId);
  const collectionRef =
    database.collection<StoredQualityEventEntry>(QUALITY_EVENTS_COLLECTION);
  const documentRef = collectionRef.doc(eventId);

  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(documentRef);
    const deletedEvent = snapshot.exists
      ? normalizeDeletedQualityEventDocument(eventId, snapshot.data())
      : null;
    const current = snapshot.exists
      ? deletedEvent
        ? null
        : normalizeStoredQualityEventDocument(eventId, snapshot.data())
      : legacyEvent
        ? buildLegacyQualityEventRecord(legacyEvent, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    if (next.type === "delete") {
      const deletedAt = new Date().toISOString();
      const deletedDocument: DeletedQualityEventDocument = {
        id: eventId,
        deleted: true,
        deletedAt,
        updatedAt: deletedAt,
        version: next.value.version + 1,
      };

      transaction.set(documentRef, deletedDocument, { merge: false });
      return deletedDocument;
    }

    const nextDocument: StoredQualityEventDocument = {
      ...next.value,
      updatedAt: new Date().toISOString(),
      version: current ? current.version + 1 : 1,
    };

    transaction.set(documentRef, nextDocument, { merge: false });
    return nextDocument;
  });
}

async function writeFileQualityEventDocument(
  eventId: string,
  update: (
    current: QualityEventRecord | null,
  ) => Promise<QualityEventDocumentMutationResult>,
) {
  return queueFileWrite(async () => {
    const filePath = getQualityEventsFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });

    const [store, legacyResource] = await Promise.all([
      readQualityEventsFileStore(),
      readLegacyQualityEventsSnapshot(),
    ]);
    const legacyEvent = findLegacyQualityEvent(legacyResource.data, eventId);
    const existingDocument = store.items[eventId] ?? null;
    const current: QualityEventRecord | null = existingDocument
      ? "deleted" in existingDocument && existingDocument.deleted === true
        ? null
        : existingDocument
      : legacyEvent
        ? buildLegacyQualityEventRecord(legacyEvent, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    if (next.type === "delete") {
      const deletedAt = new Date().toISOString();
      const deletedDocument: DeletedQualityEventDocument = {
        id: eventId,
        deleted: true,
        deletedAt,
        updatedAt: deletedAt,
        version: next.value.version + 1,
      };

      store.items[eventId] = deletedDocument;
      await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
      return deletedDocument;
    }

    const nextDocument: StoredQualityEventDocument = {
      ...next.value,
      updatedAt: new Date().toISOString(),
      version: current ? current.version + 1 : 1,
    };

    store.items[eventId] = nextDocument;
    await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
    return nextDocument;
  });
}

async function writeQualityEventDocument(
  eventId: string,
  update: (
    current: QualityEventRecord | null,
  ) => Promise<QualityEventDocumentMutationResult>,
) {
  if (getQualityEventsPersistenceProvider() === "firebase") {
    return writeFirebaseQualityEventDocument(eventId, update);
  }

  return writeFileQualityEventDocument(eventId, update);
}

export function getQualityEventsPersistenceProvider() {
  return getServerPersistenceProvider("eventos de qualidade");
}

export async function listQualityEvents(): Promise<ListQualityEventsResult> {
  const items =
    getQualityEventsPersistenceProvider() === "firebase"
      ? await listFirebaseQualityEvents()
      : await listFileQualityEvents();

  return {
    items,
    count: items.length,
  };
}

export async function getQualityEventById(eventId: string) {
  const result =
    getQualityEventsPersistenceProvider() === "firebase"
      ? await readFirebaseQualityEvent(eventId)
      : await readFileQualityEvent(eventId);

  if (!result.exists || !result.event) {
    throw new QualityEventNotFoundError("Evento de qualidade nao encontrado.");
  }

  return result.event;
}

export async function createQualityEvent(
  event: unknown,
): Promise<QualityEventRecord> {
  const normalized = validateQualityEventWritePayload(event);

  const createdEvent = await writeQualityEventDocument(
    normalized.id,
    async (current) => {
      if (current) {
        throw new ErpResourceValidationError(
          "Ja existe um evento de qualidade com o id informado.",
          409,
        );
      }

      return {
        type: "set",
        value: normalized,
      };
    },
  );

  assertQualityEventWriteResult(createdEvent);
  return createdEvent;
}

export async function updateQualityEvent(
  eventId: string,
  eventPatch: unknown,
  options: UpdateQualityEventOptions,
) {
  const updatedEvent = await writeQualityEventDocument(eventId, async (current) => {
    assertBaseVersion(current, options.baseVersion);

    if (
      !eventPatch ||
      typeof eventPatch !== "object" ||
      Array.isArray(eventPatch)
    ) {
      throw new ErpResourceValidationError(
        "Carga invalida para o evento de qualidade.",
      );
    }

    const candidateId = (eventPatch as { id?: unknown }).id;

    if (
      candidateId !== undefined &&
      (typeof candidateId !== "string" ||
        normalizeQualityEventId(candidateId) !== eventId)
    ) {
      throw new ErpResourceValidationError(
        "O id do evento de qualidade precisa corresponder ao id da rota.",
      );
    }

    const merged = validateQualityEventWritePayload(
      {
        ...toQualityEventPayload(current),
        ...eventPatch,
        id: eventId,
      },
      eventId,
    );

    const currentPayload = toQualityEventPayload(current);

    if (currentPayload && areQualityEventPayloadsEqual(currentPayload, merged)) {
      return {
        type: "noop",
        value: current,
      } satisfies QualityEventDocumentMutationResult;
    }

    return {
      type: "set",
      value: merged,
    } satisfies QualityEventDocumentMutationResult;
  });

  assertQualityEventWriteResult(updatedEvent);
  return updatedEvent;
}

export async function deleteQualityEvent(
  eventId: string,
  baseVersion: number,
): Promise<DeleteQualityEventResult> {
  const deletedEvent = await writeQualityEventDocument(eventId, async (current) => {
    assertBaseVersion(current, baseVersion);

    return {
      type: "delete",
      value: current,
    } satisfies QualityEventDocumentMutationResult;
  });

  assertQualityEventDeleteResult(deletedEvent);

  return {
    id: deletedEvent.id,
    version: deletedEvent.version,
    deletedAt: deletedEvent.deletedAt,
  };
}
