import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { CalendarItem } from "@/lib/operations-data";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import {
  ErpResourceValidationError,
  sanitizeStoredErpResourceItemData,
  validateErpResourceItemData,
} from "@/lib/server/erp-resource-schema";
import { readErpResource } from "@/lib/server/erp-state";
import { getServerPersistenceProvider } from "@/lib/server/server-persistence";

const CALENDAR_COLLECTION = "calendar";
const CALENDAR_RESOURCE_ID = "operations.calendar";
const DEFAULT_CALENDAR_FILE = path.join(
  process.cwd(),
  ".data",
  "calendar-events.json",
);

let fileWriteQueue = Promise.resolve();

type CalendarVersion = number;

type StoredCalendarEventDocument = CalendarItem & {
  id: string;
  version: CalendarVersion;
  updatedAt: string | null;
  deleted?: false;
};

type DeletedCalendarEventDocument = {
  id: string;
  deleted: true;
  deletedAt: string;
  version: CalendarVersion;
  updatedAt: string | null;
};

type CalendarEventLookup = {
  item: CalendarEventRecord | null;
  exists: boolean;
};

type CalendarMergeEntry =
  | { type: "item"; item: StoredCalendarEventDocument }
  | { type: "deleted"; item: DeletedCalendarEventDocument };

type StoredCalendarEntry =
  | StoredCalendarEventDocument
  | DeletedCalendarEventDocument;

type DeleteCalendarEventResult = {
  id: string;
  version: CalendarVersion;
  deletedAt: string;
};

type CalendarFileStore = {
  items?: Record<string, StoredCalendarEntry>;
};

export type CalendarEventRecord = CalendarItem & {
  id: string;
  version: CalendarVersion;
  updatedAt: string | null;
};

export type ListCalendarEventsResult = {
  items: CalendarEventRecord[];
  count: number;
};

export type UpdateCalendarEventOptions = {
  baseVersion: number;
};

type CalendarMutationResult =
  | { type: "set"; value: CalendarItem & { id: string } }
  | { type: "noop"; value: CalendarEventRecord }
  | { type: "delete"; value: CalendarEventRecord };

export class CalendarConflictError extends Error {
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

export class CalendarNotFoundError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.status = 404;
  }
}

export function requireCalendarBaseVersion(value: unknown, operation: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ErpResourceValidationError(
      `baseVersion obrigatorio para ${operation} o evento do calendario.`,
      400,
    );
  }

  return value;
}

export function getCalendarVersionConflictPayload(error: CalendarConflictError) {
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

function normalizeCalendarEventId(value: string) {
  return value.trim();
}

function getLegacyCalendarEventId(item: Pick<CalendarItem, "title" | "slot">) {
  const key = `${normalizeReference(item.title)}::${normalizeReference(item.slot)}`;
  const digest = createHash("sha1").update(key).digest("hex").slice(0, 16);
  return `calendar_${digest}`;
}

function getCalendarEventId(item: CalendarItem) {
  return typeof item.id === "string" && item.id.trim()
    ? normalizeCalendarEventId(item.id)
    : getLegacyCalendarEventId(item);
}

function getCalendarFilePath() {
  return process.env.CALENDAR_FILE_PATH
    ? path.resolve(process.cwd(), process.env.CALENDAR_FILE_PATH)
    : DEFAULT_CALENDAR_FILE;
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

function normalizeStoredCalendarEventDocument(
  calendarEventId: string,
  value: unknown,
): StoredCalendarEventDocument | null {
  const sanitized = sanitizeStoredErpResourceItemData(CALENDAR_RESOURCE_ID, value);
  const item = sanitized.item;

  if (!item) {
    return null;
  }

  const resolvedId = getCalendarEventId(item);

  if (resolvedId !== calendarEventId) {
    return null;
  }

  const candidate = value as Partial<StoredCalendarEventDocument>;

  return {
    ...item,
    id: calendarEventId,
    version: normalizeVersion(candidate.version),
    updatedAt: normalizeUpdatedAt(candidate.updatedAt),
  };
}

function normalizeDeletedCalendarEventDocument(
  calendarEventId: string,
  value: unknown,
): DeletedCalendarEventDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<DeletedCalendarEventDocument>;

  if (
    candidate.deleted !== true ||
    candidate.id !== calendarEventId ||
    typeof candidate.deletedAt !== "string"
  ) {
    return null;
  }

  return {
    id: calendarEventId,
    deleted: true,
    deletedAt: candidate.deletedAt,
    version: normalizeVersion(candidate.version),
    updatedAt: normalizeUpdatedAt(candidate.updatedAt),
  };
}

function normalizeStoredCalendarEntry(
  calendarEventId: string,
  value: unknown,
): CalendarMergeEntry | null {
  const deletedEvent = normalizeDeletedCalendarEventDocument(
    calendarEventId,
    value,
  );

  if (deletedEvent) {
    return {
      type: "deleted",
      item: deletedEvent,
    };
  }

  const item = normalizeStoredCalendarEventDocument(calendarEventId, value);

  if (!item) {
    return null;
  }

  return {
    type: "item",
    item,
  };
}

function toStoredCalendarEntry(entry: CalendarMergeEntry): StoredCalendarEntry {
  return entry.item;
}

function toCalendarMergeEntry(document: StoredCalendarEntry): CalendarMergeEntry {
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
    return {} as Record<string, StoredCalendarEntry>;
  }

  const items: Record<string, StoredCalendarEntry> = {};

  for (const [calendarEventId, candidate] of Object.entries(value)) {
    const normalized = normalizeStoredCalendarEntry(calendarEventId, candidate);

    if (normalized) {
      items[calendarEventId] = toStoredCalendarEntry(normalized);
    }
  }

  return items;
}

async function readCalendarFileStore() {
  try {
    const raw = await readFile(getCalendarFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        items: {},
      } satisfies Required<CalendarFileStore>;
    }

    const value = parsed as CalendarFileStore;

    return {
      items: normalizeFileItems(value.items),
    } satisfies Required<CalendarFileStore>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        items: {},
      } satisfies Required<CalendarFileStore>;
    }

    throw error;
  }
}

function areCalendarPayloadsEqual(left: CalendarItem, right: CalendarItem) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toCalendarEventPayload(
  item: CalendarEventRecord | null,
): (CalendarItem & { id: string }) | null {
  if (!item) {
    return null;
  }

  const payload = { ...item } as Partial<CalendarEventRecord>;
  delete payload.version;
  delete payload.updatedAt;
  return payload as CalendarItem & { id: string };
}

function validateCalendarWritePayload(value: unknown, calendarEventId?: string) {
  const normalized = validateErpResourceItemData(CALENDAR_RESOURCE_ID, value);
  const candidateId =
    typeof normalized.id === "string" && normalized.id.trim()
      ? normalizeCalendarEventId(normalized.id)
      : undefined;

  if (calendarEventId && candidateId && candidateId !== calendarEventId) {
    throw new ErpResourceValidationError(
      "O id do evento do calendario precisa corresponder ao id da rota.",
    );
  }

  return {
    ...normalized,
    id:
      calendarEventId ??
      candidateId ??
      getLegacyCalendarEventId(normalized),
  };
}

function assertBaseVersion(
  current: CalendarEventRecord | null,
  baseVersion: number,
): asserts current is CalendarEventRecord {
  if (!Number.isInteger(baseVersion) || baseVersion < 1) {
    throw new ErpResourceValidationError(
      "Versao base invalida para o evento do calendario.",
    );
  }

  if (!current) {
    throw new CalendarNotFoundError("Evento do calendario nao encontrado.");
  }

  if (current.version === baseVersion) {
    return;
  }

  throw new CalendarConflictError(
    "O evento do calendario foi alterado por outra sessao. Recarregue os dados antes de salvar novamente.",
    current.version,
    current.updatedAt,
  );
}

function assertCalendarWriteResult(
  value: CalendarEventRecord | DeletedCalendarEventDocument,
): asserts value is CalendarEventRecord {
  if ("deleted" in value && value.deleted === true) {
    throw new Error(
      "Operacao de calendario retornou um marcador de exclusao inesperado.",
    );
  }
}

function assertCalendarDeleteResult(
  value: CalendarEventRecord | DeletedCalendarEventDocument,
): asserts value is DeletedCalendarEventDocument {
  if (!("deleted" in value) || value.deleted !== true) {
    throw new Error(
      "Operacao de exclusao do calendario nao gerou marcador de exclusao.",
    );
  }
}

function buildLegacyCalendarEventRecord(
  item: CalendarItem,
  updatedAt: string | null,
): CalendarEventRecord {
  return {
    ...item,
    id: getCalendarEventId(item),
    version: 1,
    updatedAt,
  };
}

async function readLegacyCalendarSnapshot() {
  return readErpResource(CALENDAR_RESOURCE_ID);
}

function mergeCalendarEvents(
  itemizedEntries: readonly CalendarMergeEntry[],
  legacyItems: readonly CalendarItem[],
  legacyUpdatedAt: string | null,
) {
  const activeEntries = new Map<string, CalendarEventRecord>();
  const deletedIds = new Set<string>();
  const consumedIds = new Set<string>();

  for (const entry of itemizedEntries) {
    if (entry.type === "deleted") {
      deletedIds.add(entry.item.id);
      activeEntries.delete(entry.item.id);
      continue;
    }

    activeEntries.set(entry.item.id, entry.item);
  }

  const mergedLegacyItems: CalendarEventRecord[] = [];

  for (const legacyItem of legacyItems) {
    const calendarEventId = getCalendarEventId(legacyItem);

    if (deletedIds.has(calendarEventId)) {
      continue;
    }

    const itemizedEntry = activeEntries.get(calendarEventId);

    if (itemizedEntry) {
      mergedLegacyItems.push(itemizedEntry);
      consumedIds.add(calendarEventId);
      continue;
    }

    mergedLegacyItems.push(
      buildLegacyCalendarEventRecord(legacyItem, legacyUpdatedAt),
    );
  }

  const createdCalendarEvents = [...activeEntries.values()]
    .filter((item) => !consumedIds.has(item.id))
    .sort((left, right) => {
      const leftUpdatedAt = left.updatedAt ?? "";
      const rightUpdatedAt = right.updatedAt ?? "";

      if (leftUpdatedAt !== rightUpdatedAt) {
        return rightUpdatedAt.localeCompare(leftUpdatedAt);
      }

      return left.title.localeCompare(right.title);
    });

  return [...createdCalendarEvents, ...mergedLegacyItems];
}

async function assertCalendarTitleUnique(title: string, currentId?: string) {
  const normalizedTitle = normalizeReference(title);
  const payload = await listCalendarEvents();
  const conflictingItem = payload.items.find(
    (item) =>
      normalizeReference(item.title) === normalizedTitle &&
      item.id !== currentId,
  );

  if (conflictingItem) {
    throw new ErpResourceValidationError(
      "Ja existe um evento com esse titulo.",
      409,
    );
  }
}

async function listFirebaseCalendarEvents() {
  const [snapshot, legacyResource] = await Promise.all([
    getFirebaseAdminDb()
      .collection<StoredCalendarEntry>(CALENDAR_COLLECTION)
      .get(),
    readLegacyCalendarSnapshot(),
  ]);

  const itemizedEntries = snapshot.docs
    .map((document) =>
      normalizeStoredCalendarEntry(document.id, document.data()),
    )
    .filter((document): document is CalendarMergeEntry => document !== null)
    .sort((left, right) => left.item.id.localeCompare(right.item.id));

  return mergeCalendarEvents(
    itemizedEntries,
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

async function listFileCalendarEvents() {
  const [store, legacyResource] = await Promise.all([
    readCalendarFileStore(),
    readLegacyCalendarSnapshot(),
  ]);

  return mergeCalendarEvents(
    Object.values(store.items)
      .map((document) => toCalendarMergeEntry(document))
      .sort((left, right) => left.item.id.localeCompare(right.item.id)),
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

function findLegacyCalendarEvent(
  items: readonly CalendarItem[],
  calendarEventId: string,
) {
  return items.find((candidate) => getCalendarEventId(candidate) === calendarEventId);
}

async function readFirebaseCalendarEvent(
  calendarEventId: string,
): Promise<CalendarEventLookup> {
  const snapshot = await getFirebaseAdminDb()
    .collection<StoredCalendarEntry>(CALENDAR_COLLECTION)
    .doc(calendarEventId)
    .get();

  if (snapshot.exists) {
    const deletedItem = normalizeDeletedCalendarEventDocument(
      calendarEventId,
      snapshot.data(),
    );

    if (deletedItem) {
      return {
        item: null,
        exists: false,
      };
    }

    const item = normalizeStoredCalendarEventDocument(
      calendarEventId,
      snapshot.data(),
    );

    if (item) {
      return {
        item,
        exists: true,
      };
    }
  }

  const legacyResource = await readLegacyCalendarSnapshot();
  const legacyItem = findLegacyCalendarEvent(
    legacyResource.data,
    calendarEventId,
  );

  if (!legacyItem) {
    return {
      item: null,
      exists: false,
    };
  }

  return {
    item: buildLegacyCalendarEventRecord(legacyItem, legacyResource.updatedAt),
    exists: true,
  };
}

async function readFileCalendarEvent(
  calendarEventId: string,
): Promise<CalendarEventLookup> {
  const store = await readCalendarFileStore();
  const existingDocument = store.items[calendarEventId] ?? null;

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

  const legacyResource = await readLegacyCalendarSnapshot();
  const legacyItem = findLegacyCalendarEvent(
    legacyResource.data,
    calendarEventId,
  );

  if (!legacyItem) {
    return {
      item: null,
      exists: false,
    };
  }

  return {
    item: buildLegacyCalendarEventRecord(legacyItem, legacyResource.updatedAt),
    exists: true,
  };
}

async function writeFirebaseCalendarEvent(
  calendarEventId: string,
  update: (
    current: CalendarEventRecord | null,
  ) => Promise<CalendarMutationResult>,
) {
  const database = getFirebaseAdminDb();
  const legacyResource = await readLegacyCalendarSnapshot();
  const legacyItem = findLegacyCalendarEvent(
    legacyResource.data,
    calendarEventId,
  );
  const collectionRef =
    database.collection<StoredCalendarEntry>(CALENDAR_COLLECTION);
  const documentRef = collectionRef.doc(calendarEventId);

  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(documentRef);
    const deletedItem = snapshot.exists
      ? normalizeDeletedCalendarEventDocument(calendarEventId, snapshot.data())
      : null;
    const current = snapshot.exists
      ? deletedItem
        ? null
        : normalizeStoredCalendarEventDocument(calendarEventId, snapshot.data())
      : legacyItem
        ? buildLegacyCalendarEventRecord(legacyItem, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    const now = new Date().toISOString();

    if (next.type === "delete") {
      const deletedEvent: DeletedCalendarEventDocument = {
        id: calendarEventId,
        deleted: true,
        deletedAt: now,
        version: next.value.version + 1,
        updatedAt: now,
      };

      transaction.set(documentRef, deletedEvent, { merge: false });
      return deletedEvent;
    }

    const nextDocument: StoredCalendarEventDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
      updatedAt: now,
    };

    transaction.set(documentRef, nextDocument, { merge: false });
    return nextDocument;
  });
}

async function writeFileCalendarEvent(
  calendarEventId: string,
  update: (
    current: CalendarEventRecord | null,
  ) => Promise<CalendarMutationResult>,
) {
  return queueFileWrite(async () => {
    const filePath = getCalendarFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });

    const [store, legacyResource] = await Promise.all([
      readCalendarFileStore(),
      readLegacyCalendarSnapshot(),
    ]);
    const legacyItem = findLegacyCalendarEvent(
      legacyResource.data,
      calendarEventId,
    );
    const existingDocument = store.items[calendarEventId] ?? null;
    const current: CalendarEventRecord | null = existingDocument
      ? "deleted" in existingDocument && existingDocument.deleted === true
        ? null
        : existingDocument
      : legacyItem
        ? buildLegacyCalendarEventRecord(legacyItem, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    const now = new Date().toISOString();

    if (next.type === "delete") {
      const deletedEvent: DeletedCalendarEventDocument = {
        id: calendarEventId,
        deleted: true,
        deletedAt: now,
        version: next.value.version + 1,
        updatedAt: now,
      };

      store.items[calendarEventId] = deletedEvent;
      await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
      return deletedEvent;
    }

    const nextDocument: StoredCalendarEventDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
      updatedAt: now,
    };

    store.items[calendarEventId] = nextDocument;
    await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
    return nextDocument;
  });
}

async function writeCalendarEvent(
  calendarEventId: string,
  update: (
    current: CalendarEventRecord | null,
  ) => Promise<CalendarMutationResult>,
) {
  if (getCalendarEventsPersistenceProvider() === "firebase") {
    return writeFirebaseCalendarEvent(calendarEventId, update);
  }

  return writeFileCalendarEvent(calendarEventId, update);
}

export function getCalendarEventsPersistenceProvider() {
  return getServerPersistenceProvider("calendario");
}

export async function listCalendarEvents(): Promise<ListCalendarEventsResult> {
  const items =
    getCalendarEventsPersistenceProvider() === "firebase"
      ? await listFirebaseCalendarEvents()
      : await listFileCalendarEvents();

  return {
    items,
    count: items.length,
  };
}

export async function getCalendarEventById(calendarEventId: string) {
  const result =
    getCalendarEventsPersistenceProvider() === "firebase"
      ? await readFirebaseCalendarEvent(calendarEventId)
      : await readFileCalendarEvent(calendarEventId);

  if (!result.exists || !result.item) {
    throw new CalendarNotFoundError("Evento do calendario nao encontrado.");
  }

  return result.item;
}

export async function createCalendarEvent(
  item: unknown,
): Promise<CalendarEventRecord> {
  const normalized = validateCalendarWritePayload(item);
  await assertCalendarTitleUnique(normalized.title);

  const createdItem = await writeCalendarEvent(
    normalized.id,
    async (current) => {
      if (current) {
        throw new ErpResourceValidationError(
          "Ja existe um evento do calendario com o id informado.",
          409,
        );
      }

      return {
        type: "set",
        value: normalized,
      };
    },
  );

  assertCalendarWriteResult(createdItem);
  return createdItem;
}

export async function updateCalendarEvent(
  calendarEventId: string,
  itemPatch: unknown,
  options: UpdateCalendarEventOptions,
) {
  const currentItem = await getCalendarEventById(calendarEventId);
  const nextTitle =
    itemPatch &&
    typeof itemPatch === "object" &&
    !Array.isArray(itemPatch) &&
    typeof (itemPatch as { title?: unknown }).title === "string"
      ? (itemPatch as { title: string }).title
      : currentItem.title;

  await assertCalendarTitleUnique(nextTitle, calendarEventId);

  const updatedItem = await writeCalendarEvent(
    calendarEventId,
    async (current) => {
      assertBaseVersion(current, options.baseVersion);

      if (!itemPatch || typeof itemPatch !== "object" || Array.isArray(itemPatch)) {
        throw new ErpResourceValidationError(
          "Carga invalida para o evento do calendario.",
        );
      }

      const candidateId = (itemPatch as { id?: unknown }).id;

      if (
        candidateId !== undefined &&
        (typeof candidateId !== "string" ||
          normalizeCalendarEventId(candidateId) !== calendarEventId)
      ) {
        throw new ErpResourceValidationError(
          "O id do evento do calendario precisa corresponder ao id da rota.",
        );
      }

      const merged = validateCalendarWritePayload(
        {
          ...toCalendarEventPayload(current),
          ...itemPatch,
          id: calendarEventId,
        },
        calendarEventId,
      );

      const currentPayload = toCalendarEventPayload(current);

      if (currentPayload && areCalendarPayloadsEqual(currentPayload, merged)) {
        return {
          type: "noop",
          value: current,
        } satisfies CalendarMutationResult;
      }

      return {
        type: "set",
        value: merged,
      } satisfies CalendarMutationResult;
    },
  );

  assertCalendarWriteResult(updatedItem);
  return updatedItem;
}

export async function deleteCalendarEvent(
  calendarEventId: string,
  baseVersion: number,
): Promise<DeleteCalendarEventResult> {
  const deletedItem = await writeCalendarEvent(
    calendarEventId,
    async (current) => {
      assertBaseVersion(current, baseVersion);

      return {
        type: "delete",
        value: current,
      } satisfies CalendarMutationResult;
    },
  );

  assertCalendarDeleteResult(deletedItem);

  return {
    id: deletedItem.id,
    version: deletedItem.version,
    deletedAt: deletedItem.deletedAt,
  };
}
