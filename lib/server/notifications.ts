import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { NotificationItem } from "@/lib/operations-data";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import {
  ErpResourceValidationError,
  sanitizeStoredErpResourceItemData,
  validateErpResourceItemData,
} from "@/lib/server/erp-resource-schema";
import { readErpResource } from "@/lib/server/erp-state";
import { getServerPersistenceProvider } from "@/lib/server/server-persistence";

const NOTIFICATIONS_COLLECTION = "notifications";
const NOTIFICATIONS_RESOURCE_ID = "operations.notifications";
const DEFAULT_NOTIFICATIONS_FILE = path.join(
  process.cwd(),
  ".data",
  "notifications.json",
);

let fileWriteQueue = Promise.resolve();

type NotificationVersion = number;

type StoredNotificationDocument = NotificationItem & {
  id: string;
  version: NotificationVersion;
  updatedAt: string | null;
  deleted?: false;
};

type DeletedNotificationDocument = {
  id: string;
  deleted: true;
  deletedAt: string;
  version: NotificationVersion;
  updatedAt: string | null;
};

type NotificationRecordLookup = {
  item: NotificationRecord | null;
  exists: boolean;
};

type NotificationMergeEntry =
  | { type: "item"; item: StoredNotificationDocument }
  | { type: "deleted"; item: DeletedNotificationDocument };

type StoredNotificationEntry =
  | StoredNotificationDocument
  | DeletedNotificationDocument;

type DeleteNotificationResult = {
  id: string;
  version: NotificationVersion;
  deletedAt: string;
};

type NotificationsFileStore = {
  items?: Record<string, StoredNotificationEntry>;
};

export type NotificationRecord = NotificationItem & {
  id: string;
  version: NotificationVersion;
  updatedAt: string | null;
};

export type ListNotificationsResult = {
  items: NotificationRecord[];
  count: number;
};

export type UpdateNotificationOptions = {
  baseVersion: number;
};

type NotificationMutationResult =
  | { type: "set"; value: NotificationItem & { id: string } }
  | { type: "noop"; value: NotificationRecord }
  | { type: "delete"; value: NotificationRecord };

export class NotificationConflictError extends Error {
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

export class NotificationNotFoundError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.status = 404;
  }
}

export function requireNotificationBaseVersion(
  value: unknown,
  operation: string,
) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ErpResourceValidationError(
      `baseVersion obrigatorio para ${operation} a notificacao.`,
      400,
    );
  }

  return value;
}

export function getNotificationVersionConflictPayload(
  error: NotificationConflictError,
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

function normalizeNotificationId(value: string) {
  return value.trim();
}

function getLegacyNotificationId(
  item: Pick<NotificationItem, "title" | "area">,
) {
  const key = `${normalizeReference(item.title)}::${normalizeReference(item.area)}`;
  const digest = createHash("sha1").update(key).digest("hex").slice(0, 16);
  return `notification_${digest}`;
}

function getNotificationId(item: NotificationItem) {
  return typeof item.id === "string" && item.id.trim()
    ? normalizeNotificationId(item.id)
    : getLegacyNotificationId(item);
}

function getNotificationsFilePath() {
  return process.env.NOTIFICATIONS_FILE_PATH
    ? path.resolve(process.cwd(), process.env.NOTIFICATIONS_FILE_PATH)
    : DEFAULT_NOTIFICATIONS_FILE;
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

function normalizeStoredNotificationDocument(
  notificationId: string,
  value: unknown,
): StoredNotificationDocument | null {
  const sanitized = sanitizeStoredErpResourceItemData(
    NOTIFICATIONS_RESOURCE_ID,
    value,
  );
  const item = sanitized.item;

  if (!item) {
    return null;
  }

  const resolvedId = getNotificationId(item);

  if (resolvedId !== notificationId) {
    return null;
  }

  const candidate = value as Partial<StoredNotificationDocument>;

  return {
    ...item,
    id: notificationId,
    version: normalizeVersion(candidate.version),
    updatedAt: normalizeUpdatedAt(candidate.updatedAt),
  };
}

function normalizeDeletedNotificationDocument(
  notificationId: string,
  value: unknown,
): DeletedNotificationDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<DeletedNotificationDocument>;

  if (
    candidate.deleted !== true ||
    candidate.id !== notificationId ||
    typeof candidate.deletedAt !== "string"
  ) {
    return null;
  }

  return {
    id: notificationId,
    deleted: true,
    deletedAt: candidate.deletedAt,
    version: normalizeVersion(candidate.version),
    updatedAt: normalizeUpdatedAt(candidate.updatedAt),
  };
}

function normalizeStoredNotificationEntry(
  notificationId: string,
  value: unknown,
): NotificationMergeEntry | null {
  const deletedNotification = normalizeDeletedNotificationDocument(
    notificationId,
    value,
  );

  if (deletedNotification) {
    return {
      type: "deleted",
      item: deletedNotification,
    };
  }

  const item = normalizeStoredNotificationDocument(notificationId, value);

  if (!item) {
    return null;
  }

  return {
    type: "item",
    item,
  };
}

function toStoredNotificationEntry(
  entry: NotificationMergeEntry,
): StoredNotificationEntry {
  return entry.item;
}

function toNotificationMergeEntry(
  document: StoredNotificationEntry,
): NotificationMergeEntry {
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
    return {} as Record<string, StoredNotificationEntry>;
  }

  const items: Record<string, StoredNotificationEntry> = {};

  for (const [notificationId, candidate] of Object.entries(value)) {
    const normalized = normalizeStoredNotificationEntry(
      notificationId,
      candidate,
    );

    if (normalized) {
      items[notificationId] = toStoredNotificationEntry(normalized);
    }
  }

  return items;
}

async function readNotificationsFileStore() {
  try {
    const raw = await readFile(getNotificationsFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        items: {},
      } satisfies Required<NotificationsFileStore>;
    }

    const value = parsed as NotificationsFileStore;

    return {
      items: normalizeFileItems(value.items),
    } satisfies Required<NotificationsFileStore>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        items: {},
      } satisfies Required<NotificationsFileStore>;
    }

    throw error;
  }
}

function sortNotifications<
  TValue extends Pick<NotificationItem, "priority" | "title" | "area">,
>(items: TValue[]) {
  return [...items].sort((left, right) => {
    const byPriority = left.priority.localeCompare(right.priority);

    if (byPriority !== 0) {
      return byPriority;
    }

    const byTitle = left.title.localeCompare(right.title);
    return byTitle === 0 ? left.area.localeCompare(right.area) : byTitle;
  });
}

function areNotificationPayloadsEqual(
  left: NotificationItem,
  right: NotificationItem,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toNotificationPayload(
  item: NotificationRecord | null,
): (NotificationItem & { id: string }) | null {
  if (!item) {
    return null;
  }

  const payload = { ...item } as Partial<NotificationRecord>;
  delete payload.version;
  delete payload.updatedAt;
  return payload as NotificationItem & { id: string };
}

function validateNotificationWritePayload(
  value: unknown,
  notificationId?: string,
) {
  const normalized = validateErpResourceItemData(
    NOTIFICATIONS_RESOURCE_ID,
    value,
  );
  const candidateId =
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === "string" &&
    (value as { id: string }).id.trim()
      ? normalizeNotificationId((value as { id: string }).id)
      : undefined;

  if (notificationId && candidateId && candidateId !== notificationId) {
    throw new ErpResourceValidationError(
      "O id da notificacao precisa corresponder ao id da rota.",
    );
  }

  return {
    ...normalized,
    id: notificationId ?? candidateId ?? getLegacyNotificationId(normalized),
  };
}

function assertBaseVersion(
  current: NotificationRecord | null,
  baseVersion: number,
): asserts current is NotificationRecord {
  if (!Number.isInteger(baseVersion) || baseVersion < 1) {
    throw new ErpResourceValidationError(
      "Versao base invalida para a notificacao.",
    );
  }

  if (!current) {
    throw new NotificationNotFoundError("Notificacao nao encontrada.");
  }

  if (current.version === baseVersion) {
    return;
  }

  throw new NotificationConflictError(
    "A notificacao foi alterada por outra sessao. Recarregue os dados antes de salvar novamente.",
    current.version,
    current.updatedAt,
  );
}

function assertNotificationWriteResult(
  value: NotificationRecord | DeletedNotificationDocument,
): asserts value is NotificationRecord {
  if ("deleted" in value && value.deleted === true) {
    throw new Error(
      "Operacao de notificacao retornou um marcador de exclusao inesperado.",
    );
  }
}

function assertNotificationDeleteResult(
  value: NotificationRecord | DeletedNotificationDocument,
): asserts value is DeletedNotificationDocument {
  if (!("deleted" in value) || value.deleted !== true) {
    throw new Error(
      "Operacao de exclusao da notificacao nao gerou marcador de exclusao.",
    );
  }
}

function buildLegacyNotificationRecord(
  item: NotificationItem,
  updatedAt: string | null,
): NotificationRecord {
  return {
    ...item,
    id: getNotificationId(item),
    version: 1,
    updatedAt,
  };
}

async function readLegacyNotificationsSnapshot() {
  return readErpResource(NOTIFICATIONS_RESOURCE_ID);
}

function mergeNotifications(
  itemizedEntries: readonly NotificationMergeEntry[],
  legacyItems: readonly NotificationItem[],
  legacyUpdatedAt: string | null,
) {
  const merged = new Map<string, NotificationRecord>();
  const deletedNotificationIds = new Set<string>();

  for (const entry of itemizedEntries) {
    if (entry.type === "deleted") {
      deletedNotificationIds.add(entry.item.id);
      merged.delete(entry.item.id);
      continue;
    }

    merged.set(entry.item.id, entry.item);
  }

  for (const legacyItem of legacyItems) {
    const notificationId = getNotificationId(legacyItem);

    if (
      !deletedNotificationIds.has(notificationId) &&
      !merged.has(notificationId)
    ) {
      merged.set(
        notificationId,
        buildLegacyNotificationRecord(legacyItem, legacyUpdatedAt),
      );
    }
  }

  return sortNotifications([...merged.values()]);
}

async function listFirebaseNotifications() {
  const [snapshot, legacyResource] = await Promise.all([
    getFirebaseAdminDb()
      .collection<StoredNotificationEntry>(NOTIFICATIONS_COLLECTION)
      .get(),
    readLegacyNotificationsSnapshot(),
  ]);

  const itemizedEntries = snapshot.docs
    .map((document) =>
      normalizeStoredNotificationEntry(document.id, document.data()),
    )
    .filter(
      (document): document is NotificationMergeEntry => document !== null,
    )
    .sort((left, right) => left.item.id.localeCompare(right.item.id));

  return mergeNotifications(
    itemizedEntries,
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

async function listFileNotifications() {
  const [store, legacyResource] = await Promise.all([
    readNotificationsFileStore(),
    readLegacyNotificationsSnapshot(),
  ]);

  return mergeNotifications(
    Object.values(store.items)
      .map((document) => toNotificationMergeEntry(document))
      .sort((left, right) => left.item.id.localeCompare(right.item.id)),
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

function findLegacyNotificationItem(
  items: readonly NotificationItem[],
  notificationId: string,
) {
  return items.find((candidate) => getNotificationId(candidate) === notificationId);
}

async function readFirebaseNotification(
  notificationId: string,
): Promise<NotificationRecordLookup> {
  const snapshot = await getFirebaseAdminDb()
    .collection<StoredNotificationEntry>(NOTIFICATIONS_COLLECTION)
    .doc(notificationId)
    .get();

  if (snapshot.exists) {
    const deletedItem = normalizeDeletedNotificationDocument(
      notificationId,
      snapshot.data(),
    );

    if (deletedItem) {
      return {
        item: null,
        exists: false,
      };
    }

    const item = normalizeStoredNotificationDocument(
      notificationId,
      snapshot.data(),
    );

    if (item) {
      return {
        item,
        exists: true,
      };
    }
  }

  const legacyResource = await readLegacyNotificationsSnapshot();
  const legacyItem = findLegacyNotificationItem(
    legacyResource.data,
    notificationId,
  );

  if (!legacyItem) {
    return {
      item: null,
      exists: false,
    };
  }

  return {
    item: buildLegacyNotificationRecord(legacyItem, legacyResource.updatedAt),
    exists: true,
  };
}

async function readFileNotification(
  notificationId: string,
): Promise<NotificationRecordLookup> {
  const store = await readNotificationsFileStore();
  const existingDocument = store.items[notificationId] ?? null;

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

  const legacyResource = await readLegacyNotificationsSnapshot();
  const legacyItem = findLegacyNotificationItem(
    legacyResource.data,
    notificationId,
  );

  if (!legacyItem) {
    return {
      item: null,
      exists: false,
    };
  }

  return {
    item: buildLegacyNotificationRecord(legacyItem, legacyResource.updatedAt),
    exists: true,
  };
}

async function writeFirebaseNotification(
  notificationId: string,
  update: (
    current: NotificationRecord | null,
  ) => Promise<NotificationMutationResult>,
) {
  const database = getFirebaseAdminDb();
  const legacyResource = await readLegacyNotificationsSnapshot();
  const legacyItem = findLegacyNotificationItem(
    legacyResource.data,
    notificationId,
  );
  const collectionRef =
    database.collection<StoredNotificationEntry>(NOTIFICATIONS_COLLECTION);
  const documentRef = collectionRef.doc(notificationId);

  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(documentRef);
    const deletedItem = snapshot.exists
      ? normalizeDeletedNotificationDocument(notificationId, snapshot.data())
      : null;
    const current = snapshot.exists
      ? deletedItem
        ? null
        : normalizeStoredNotificationDocument(notificationId, snapshot.data())
      : legacyItem
        ? buildLegacyNotificationRecord(legacyItem, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    const now = new Date().toISOString();

    if (next.type === "delete") {
      const deletedNotification: DeletedNotificationDocument = {
        id: notificationId,
        deleted: true,
        deletedAt: now,
        version: next.value.version + 1,
        updatedAt: now,
      };

      transaction.set(documentRef, deletedNotification, { merge: false });
      return deletedNotification;
    }

    const nextDocument: StoredNotificationDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
      updatedAt: now,
    };

    transaction.set(documentRef, nextDocument, { merge: false });
    return nextDocument;
  });
}

async function writeFileNotification(
  notificationId: string,
  update: (
    current: NotificationRecord | null,
  ) => Promise<NotificationMutationResult>,
) {
  return queueFileWrite(async () => {
    const filePath = getNotificationsFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });

    const [store, legacyResource] = await Promise.all([
      readNotificationsFileStore(),
      readLegacyNotificationsSnapshot(),
    ]);
    const legacyItem = findLegacyNotificationItem(
      legacyResource.data,
      notificationId,
    );
    const existingDocument = store.items[notificationId] ?? null;
    const current: NotificationRecord | null = existingDocument
      ? "deleted" in existingDocument && existingDocument.deleted === true
        ? null
        : existingDocument
      : legacyItem
        ? buildLegacyNotificationRecord(legacyItem, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    const now = new Date().toISOString();

    if (next.type === "delete") {
      const deletedNotification: DeletedNotificationDocument = {
        id: notificationId,
        deleted: true,
        deletedAt: now,
        version: next.value.version + 1,
        updatedAt: now,
      };

      store.items[notificationId] = deletedNotification;
      await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
      return deletedNotification;
    }

    const nextDocument: StoredNotificationDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
      updatedAt: now,
    };

    store.items[notificationId] = nextDocument;
    await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
    return nextDocument;
  });
}

async function writeNotification(
  notificationId: string,
  update: (
    current: NotificationRecord | null,
  ) => Promise<NotificationMutationResult>,
) {
  if (getNotificationsPersistenceProvider() === "firebase") {
    return writeFirebaseNotification(notificationId, update);
  }

  return writeFileNotification(notificationId, update);
}

export function getNotificationsPersistenceProvider() {
  return getServerPersistenceProvider("notificacoes");
}

export async function listNotifications(): Promise<ListNotificationsResult> {
  const items =
    getNotificationsPersistenceProvider() === "firebase"
      ? await listFirebaseNotifications()
      : await listFileNotifications();

  return {
    items,
    count: items.length,
  };
}

export async function getNotificationById(notificationId: string) {
  const result =
    getNotificationsPersistenceProvider() === "firebase"
      ? await readFirebaseNotification(notificationId)
      : await readFileNotification(notificationId);

  if (!result.exists || !result.item) {
    throw new NotificationNotFoundError("Notificacao nao encontrada.");
  }

  return result.item;
}

export async function createNotification(
  item: unknown,
): Promise<NotificationRecord> {
  const normalized = validateNotificationWritePayload(item);

  const createdItem = await writeNotification(
    normalized.id,
    async (current) => {
      if (current) {
        throw new ErpResourceValidationError(
          "Ja existe uma notificacao com o id informado.",
          409,
        );
      }

      return {
        type: "set",
        value: normalized,
      };
    },
  );

  assertNotificationWriteResult(createdItem);
  return createdItem;
}

export async function updateNotification(
  notificationId: string,
  itemPatch: unknown,
  options: UpdateNotificationOptions,
) {
  const updatedItem = await writeNotification(
    notificationId,
    async (current) => {
      assertBaseVersion(current, options.baseVersion);

      if (!itemPatch || typeof itemPatch !== "object" || Array.isArray(itemPatch)) {
        throw new ErpResourceValidationError(
          "Carga invalida para a notificacao.",
        );
      }

      const candidateId = (itemPatch as { id?: unknown }).id;

      if (
        candidateId !== undefined &&
        (typeof candidateId !== "string" ||
          normalizeNotificationId(candidateId) !== notificationId)
      ) {
        throw new ErpResourceValidationError(
          "O id da notificacao precisa corresponder ao id da rota.",
        );
      }

      const merged = validateNotificationWritePayload(
        {
          ...toNotificationPayload(current),
          ...itemPatch,
          id: notificationId,
        },
        notificationId,
      );

      const currentPayload = toNotificationPayload(current);

      if (
        currentPayload &&
        areNotificationPayloadsEqual(currentPayload, merged)
      ) {
        return {
          type: "noop",
          value: current,
        } satisfies NotificationMutationResult;
      }

      return {
        type: "set",
        value: merged,
      } satisfies NotificationMutationResult;
    },
  );

  assertNotificationWriteResult(updatedItem);
  return updatedItem;
}

export async function deleteNotification(
  notificationId: string,
  baseVersion: number,
): Promise<DeleteNotificationResult> {
  const deletedItem = await writeNotification(
    notificationId,
    async (current) => {
      assertBaseVersion(current, baseVersion);

      return {
        type: "delete",
        value: current,
      } satisfies NotificationMutationResult;
    },
  );

  assertNotificationDeleteResult(deletedItem);

  return {
    id: deletedItem.id,
    version: deletedItem.version,
    deletedAt: deletedItem.deletedAt,
  };
}
