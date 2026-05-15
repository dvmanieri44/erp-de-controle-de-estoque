import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ReportItem } from "@/lib/operations-data";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import {
  ErpResourceValidationError,
  sanitizeStoredErpResourceItemData,
  validateErpResourceItemData,
} from "@/lib/server/erp-resource-schema";
import { readErpResource } from "@/lib/server/erp-state";
import { getServerPersistenceProvider } from "@/lib/server/server-persistence";

const REPORTS_COLLECTION = "reports";
const REPORTS_RESOURCE_ID = "operations.reports";
const DEFAULT_REPORTS_FILE = path.join(
  process.cwd(),
  ".data",
  "reports-items.json",
);

let fileWriteQueue = Promise.resolve();

type ReportVersion = number;

type StoredReportDocument = ReportItem & {
  id: string;
  version: ReportVersion;
  updatedAt: string | null;
  deleted?: false;
};

type DeletedReportDocument = {
  id: string;
  deleted: true;
  deletedAt: string;
  version: ReportVersion;
  updatedAt: string | null;
};

type ReportRecordLookup = {
  item: ReportRecord | null;
  exists: boolean;
};

type ReportMergeEntry =
  | { type: "item"; item: StoredReportDocument }
  | { type: "deleted"; item: DeletedReportDocument };

type StoredReportEntry = StoredReportDocument | DeletedReportDocument;

type DeleteReportResult = {
  id: string;
  version: ReportVersion;
  deletedAt: string;
};

type ReportsFileStore = {
  items?: Record<string, StoredReportEntry>;
};

export type ReportRecord = ReportItem & {
  id: string;
  version: ReportVersion;
  updatedAt: string | null;
};

export type ListReportsResult = {
  items: ReportRecord[];
  count: number;
};

export type UpdateReportOptions = {
  baseVersion: number;
};

type ReportMutationResult =
  | { type: "set"; value: ReportItem & { id: string } }
  | { type: "noop"; value: ReportRecord }
  | { type: "delete"; value: ReportRecord };

export class ReportConflictError extends Error {
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

export class ReportNotFoundError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.status = 404;
  }
}

export function requireReportBaseVersion(value: unknown, operation: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ErpResourceValidationError(
      `baseVersion obrigatorio para ${operation} o relatorio.`,
      400,
    );
  }

  return value;
}

export function getReportVersionConflictPayload(error: ReportConflictError) {
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

function normalizeReportId(value: string) {
  return value.trim();
}

function getLegacyReportId(item: Pick<ReportItem, "title">) {
  const key = normalizeReference(item.title);
  const digest = createHash("sha1").update(key).digest("hex").slice(0, 16);
  return `report_${digest}`;
}

function getReportId(item: ReportItem) {
  return typeof item.id === "string" && item.id.trim()
    ? normalizeReportId(item.id)
    : getLegacyReportId(item);
}

function getReportsFilePath() {
  return process.env.REPORTS_FILE_PATH
    ? path.resolve(process.cwd(), process.env.REPORTS_FILE_PATH)
    : DEFAULT_REPORTS_FILE;
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

function normalizeStoredReportDocument(
  reportId: string,
  value: unknown,
): StoredReportDocument | null {
  const sanitized = sanitizeStoredErpResourceItemData(REPORTS_RESOURCE_ID, value);
  const item = sanitized.item;

  if (!item) {
    return null;
  }

  const resolvedId = getReportId(item);

  if (resolvedId !== reportId) {
    return null;
  }

  const candidate = value as Partial<StoredReportDocument>;

  return {
    ...item,
    id: reportId,
    version: normalizeVersion(candidate.version),
    updatedAt: normalizeUpdatedAt(candidate.updatedAt),
  };
}

function normalizeDeletedReportDocument(
  reportId: string,
  value: unknown,
): DeletedReportDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<DeletedReportDocument>;

  if (
    candidate.deleted !== true ||
    candidate.id !== reportId ||
    typeof candidate.deletedAt !== "string"
  ) {
    return null;
  }

  return {
    id: reportId,
    deleted: true,
    deletedAt: candidate.deletedAt,
    version: normalizeVersion(candidate.version),
    updatedAt: normalizeUpdatedAt(candidate.updatedAt),
  };
}

function normalizeStoredReportEntry(
  reportId: string,
  value: unknown,
): ReportMergeEntry | null {
  const deletedReport = normalizeDeletedReportDocument(reportId, value);

  if (deletedReport) {
    return {
      type: "deleted",
      item: deletedReport,
    };
  }

  const item = normalizeStoredReportDocument(reportId, value);

  if (!item) {
    return null;
  }

  return {
    type: "item",
    item,
  };
}

function toStoredReportEntry(entry: ReportMergeEntry): StoredReportEntry {
  return entry.item;
}

function toReportMergeEntry(document: StoredReportEntry): ReportMergeEntry {
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
    return {} as Record<string, StoredReportEntry>;
  }

  const items: Record<string, StoredReportEntry> = {};

  for (const [reportId, candidate] of Object.entries(value)) {
    const normalized = normalizeStoredReportEntry(reportId, candidate);

    if (normalized) {
      items[reportId] = toStoredReportEntry(normalized);
    }
  }

  return items;
}

async function readReportsFileStore() {
  try {
    const raw = await readFile(getReportsFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        items: {},
      } satisfies Required<ReportsFileStore>;
    }

    const value = parsed as ReportsFileStore;

    return {
      items: normalizeFileItems(value.items),
    } satisfies Required<ReportsFileStore>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        items: {},
      } satisfies Required<ReportsFileStore>;
    }

    throw error;
  }
}

function areReportPayloadsEqual(left: ReportItem, right: ReportItem) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toReportPayload(
  item: ReportRecord | null,
): (ReportItem & { id: string }) | null {
  if (!item) {
    return null;
  }

  const payload = { ...item } as Partial<ReportRecord>;
  delete payload.version;
  delete payload.updatedAt;
  return payload as ReportItem & { id: string };
}

function validateReportWritePayload(value: unknown, reportId?: string) {
  const normalized = validateErpResourceItemData(REPORTS_RESOURCE_ID, value);
  const candidateId =
    typeof normalized.id === "string" && normalized.id.trim()
      ? normalizeReportId(normalized.id)
      : undefined;

  if (reportId && candidateId && candidateId !== reportId) {
    throw new ErpResourceValidationError(
      "O id do relatorio precisa corresponder ao id da rota.",
    );
  }

  return {
    ...normalized,
    id: reportId ?? candidateId ?? getLegacyReportId(normalized),
  };
}

function assertBaseVersion(
  current: ReportRecord | null,
  baseVersion: number,
): asserts current is ReportRecord {
  if (!Number.isInteger(baseVersion) || baseVersion < 1) {
    throw new ErpResourceValidationError(
      "Versao base invalida para o relatorio.",
    );
  }

  if (!current) {
    throw new ReportNotFoundError("Relatorio nao encontrado.");
  }

  if (current.version === baseVersion) {
    return;
  }

  throw new ReportConflictError(
    "O relatorio foi alterado por outra sessao. Recarregue os dados antes de salvar novamente.",
    current.version,
    current.updatedAt,
  );
}

function assertReportWriteResult(
  value: ReportRecord | DeletedReportDocument,
): asserts value is ReportRecord {
  if ("deleted" in value && value.deleted === true) {
    throw new Error(
      "Operacao de relatorio retornou um marcador de exclusao inesperado.",
    );
  }
}

function assertReportDeleteResult(
  value: ReportRecord | DeletedReportDocument,
): asserts value is DeletedReportDocument {
  if (!("deleted" in value) || value.deleted !== true) {
    throw new Error(
      "Operacao de exclusao do relatorio nao gerou marcador de exclusao.",
    );
  }
}

function buildLegacyReportRecord(
  item: ReportItem,
  updatedAt: string | null,
): ReportRecord {
  return {
    ...item,
    id: getReportId(item),
    version: 1,
    updatedAt,
  };
}

async function readLegacyReportsSnapshot() {
  return readErpResource(REPORTS_RESOURCE_ID);
}

function mergeReports(
  itemizedEntries: readonly ReportMergeEntry[],
  legacyItems: readonly ReportItem[],
  legacyUpdatedAt: string | null,
) {
  const activeEntries = new Map<string, ReportRecord>();
  const deletedReportIds = new Set<string>();
  const consumedIds = new Set<string>();

  for (const entry of itemizedEntries) {
    if (entry.type === "deleted") {
      deletedReportIds.add(entry.item.id);
      activeEntries.delete(entry.item.id);
      continue;
    }

    activeEntries.set(entry.item.id, entry.item);
  }

  const mergedLegacyItems: ReportRecord[] = [];

  for (const legacyItem of legacyItems) {
    const reportId = getReportId(legacyItem);

    if (deletedReportIds.has(reportId)) {
      continue;
    }

    const itemizedEntry = activeEntries.get(reportId);

    if (itemizedEntry) {
      mergedLegacyItems.push(itemizedEntry);
      consumedIds.add(reportId);
      continue;
    }

    mergedLegacyItems.push(
      buildLegacyReportRecord(legacyItem, legacyUpdatedAt),
    );
  }

  const createdReports = [...activeEntries.values()]
    .filter((item) => !consumedIds.has(item.id))
    .sort((left, right) => {
      const leftUpdatedAt = left.updatedAt ?? "";
      const rightUpdatedAt = right.updatedAt ?? "";

      if (leftUpdatedAt !== rightUpdatedAt) {
        return rightUpdatedAt.localeCompare(leftUpdatedAt);
      }

      return left.title.localeCompare(right.title);
    });

  return [...createdReports, ...mergedLegacyItems];
}

async function assertReportTitleUnique(title: string, currentId?: string) {
  const normalizedTitle = normalizeReference(title);
  const payload = await listReports();
  const conflictingItem = payload.items.find(
    (item) =>
      normalizeReference(item.title) === normalizedTitle && item.id !== currentId,
  );

  if (conflictingItem) {
    throw new ErpResourceValidationError(
      "Ja existe um relatorio com esse titulo.",
      409,
    );
  }
}

async function listFirebaseReports() {
  const [snapshot, legacyResource] = await Promise.all([
    getFirebaseAdminDb()
      .collection<StoredReportEntry>(REPORTS_COLLECTION)
      .get(),
    readLegacyReportsSnapshot(),
  ]);

  const itemizedEntries = snapshot.docs
    .map((document) =>
      normalizeStoredReportEntry(document.id, document.data()),
    )
    .filter((document): document is ReportMergeEntry => document !== null)
    .sort((left, right) => left.item.id.localeCompare(right.item.id));

  return mergeReports(
    itemizedEntries,
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

async function listFileReports() {
  const [store, legacyResource] = await Promise.all([
    readReportsFileStore(),
    readLegacyReportsSnapshot(),
  ]);

  return mergeReports(
    Object.values(store.items)
      .map((document) => toReportMergeEntry(document))
      .sort((left, right) => left.item.id.localeCompare(right.item.id)),
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

function findLegacyReport(items: readonly ReportItem[], reportId: string) {
  return items.find((candidate) => getReportId(candidate) === reportId);
}

async function readFirebaseReport(
  reportId: string,
): Promise<ReportRecordLookup> {
  const snapshot = await getFirebaseAdminDb()
    .collection<StoredReportEntry>(REPORTS_COLLECTION)
    .doc(reportId)
    .get();

  if (snapshot.exists) {
    const deletedItem = normalizeDeletedReportDocument(reportId, snapshot.data());

    if (deletedItem) {
      return {
        item: null,
        exists: false,
      };
    }

    const item = normalizeStoredReportDocument(reportId, snapshot.data());

    if (item) {
      return {
        item,
        exists: true,
      };
    }
  }

  const legacyResource = await readLegacyReportsSnapshot();
  const legacyItem = findLegacyReport(legacyResource.data, reportId);

  if (!legacyItem) {
    return {
      item: null,
      exists: false,
    };
  }

  return {
    item: buildLegacyReportRecord(legacyItem, legacyResource.updatedAt),
    exists: true,
  };
}

async function readFileReport(reportId: string): Promise<ReportRecordLookup> {
  const store = await readReportsFileStore();
  const existingDocument = store.items[reportId] ?? null;

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

  const legacyResource = await readLegacyReportsSnapshot();
  const legacyItem = findLegacyReport(legacyResource.data, reportId);

  if (!legacyItem) {
    return {
      item: null,
      exists: false,
    };
  }

  return {
    item: buildLegacyReportRecord(legacyItem, legacyResource.updatedAt),
    exists: true,
  };
}

async function writeFirebaseReport(
  reportId: string,
  update: (current: ReportRecord | null) => Promise<ReportMutationResult>,
) {
  const database = getFirebaseAdminDb();
  const legacyResource = await readLegacyReportsSnapshot();
  const legacyItem = findLegacyReport(legacyResource.data, reportId);
  const collectionRef = database.collection<StoredReportEntry>(REPORTS_COLLECTION);
  const documentRef = collectionRef.doc(reportId);

  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(documentRef);
    const deletedItem = snapshot.exists
      ? normalizeDeletedReportDocument(reportId, snapshot.data())
      : null;
    const current = snapshot.exists
      ? deletedItem
        ? null
        : normalizeStoredReportDocument(reportId, snapshot.data())
      : legacyItem
        ? buildLegacyReportRecord(legacyItem, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    const now = new Date().toISOString();

    if (next.type === "delete") {
      const deletedReport: DeletedReportDocument = {
        id: reportId,
        deleted: true,
        deletedAt: now,
        version: next.value.version + 1,
        updatedAt: now,
      };

      transaction.set(documentRef, deletedReport, { merge: false });
      return deletedReport;
    }

    const nextDocument: StoredReportDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
      updatedAt: now,
    };

    transaction.set(documentRef, nextDocument, { merge: false });
    return nextDocument;
  });
}

async function writeFileReport(
  reportId: string,
  update: (current: ReportRecord | null) => Promise<ReportMutationResult>,
) {
  return queueFileWrite(async () => {
    const filePath = getReportsFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });

    const [store, legacyResource] = await Promise.all([
      readReportsFileStore(),
      readLegacyReportsSnapshot(),
    ]);
    const legacyItem = findLegacyReport(legacyResource.data, reportId);
    const existingDocument = store.items[reportId] ?? null;
    const current: ReportRecord | null = existingDocument
      ? "deleted" in existingDocument && existingDocument.deleted === true
        ? null
        : existingDocument
      : legacyItem
        ? buildLegacyReportRecord(legacyItem, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    const now = new Date().toISOString();

    if (next.type === "delete") {
      const deletedReport: DeletedReportDocument = {
        id: reportId,
        deleted: true,
        deletedAt: now,
        version: next.value.version + 1,
        updatedAt: now,
      };

      store.items[reportId] = deletedReport;
      await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
      return deletedReport;
    }

    const nextDocument: StoredReportDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
      updatedAt: now,
    };

    store.items[reportId] = nextDocument;
    await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
    return nextDocument;
  });
}

async function writeReport(
  reportId: string,
  update: (current: ReportRecord | null) => Promise<ReportMutationResult>,
) {
  if (getReportsPersistenceProvider() === "firebase") {
    return writeFirebaseReport(reportId, update);
  }

  return writeFileReport(reportId, update);
}

export function getReportsPersistenceProvider() {
  return getServerPersistenceProvider("relatorios");
}

export async function listReports(): Promise<ListReportsResult> {
  const items =
    getReportsPersistenceProvider() === "firebase"
      ? await listFirebaseReports()
      : await listFileReports();

  return {
    items,
    count: items.length,
  };
}

export async function getReportById(reportId: string) {
  const result =
    getReportsPersistenceProvider() === "firebase"
      ? await readFirebaseReport(reportId)
      : await readFileReport(reportId);

  if (!result.exists || !result.item) {
    throw new ReportNotFoundError("Relatorio nao encontrado.");
  }

  return result.item;
}

export async function createReport(item: unknown): Promise<ReportRecord> {
  const normalized = validateReportWritePayload(item);
  await assertReportTitleUnique(normalized.title);

  const createdItem = await writeReport(normalized.id, async (current) => {
    if (current) {
      throw new ErpResourceValidationError(
        "Ja existe um relatorio com o id informado.",
        409,
      );
    }

    return {
      type: "set",
      value: normalized,
    };
  });

  assertReportWriteResult(createdItem);
  return createdItem;
}

export async function updateReport(
  reportId: string,
  itemPatch: unknown,
  options: UpdateReportOptions,
) {
  const currentItem = await getReportById(reportId);
  const nextTitle =
    itemPatch &&
    typeof itemPatch === "object" &&
    !Array.isArray(itemPatch) &&
    typeof (itemPatch as { title?: unknown }).title === "string"
      ? (itemPatch as { title: string }).title
      : currentItem.title;

  await assertReportTitleUnique(nextTitle, reportId);

  const updatedItem = await writeReport(reportId, async (current) => {
    assertBaseVersion(current, options.baseVersion);

    if (!itemPatch || typeof itemPatch !== "object" || Array.isArray(itemPatch)) {
      throw new ErpResourceValidationError("Carga invalida para o relatorio.");
    }

    const candidateId = (itemPatch as { id?: unknown }).id;

    if (
      candidateId !== undefined &&
      (typeof candidateId !== "string" ||
        normalizeReportId(candidateId) !== reportId)
    ) {
      throw new ErpResourceValidationError(
        "O id do relatorio precisa corresponder ao id da rota.",
      );
    }

    const merged = validateReportWritePayload(
      {
        ...toReportPayload(current),
        ...itemPatch,
        id: reportId,
      },
      reportId,
    );

    const currentPayload = toReportPayload(current);

    if (currentPayload && areReportPayloadsEqual(currentPayload, merged)) {
      return {
        type: "noop",
        value: current,
      } satisfies ReportMutationResult;
    }

    return {
      type: "set",
      value: merged,
    } satisfies ReportMutationResult;
  });

  assertReportWriteResult(updatedItem);
  return updatedItem;
}

export async function deleteReport(
  reportId: string,
  baseVersion: number,
): Promise<DeleteReportResult> {
  const deletedItem = await writeReport(reportId, async (current) => {
    assertBaseVersion(current, baseVersion);

    return {
      type: "delete",
      value: current,
    } satisfies ReportMutationResult;
  });

  assertReportDeleteResult(deletedItem);

  return {
    id: deletedItem.id,
    version: deletedItem.version,
    deletedAt: deletedItem.deletedAt,
  };
}
