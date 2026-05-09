import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { IncidentItem } from "@/lib/operations-data";
import {
  ErpResourceValidationError,
  sanitizeStoredErpResourceItemData,
  validateErpResourceItemData,
} from "@/lib/server/erp-resource-schema";
import { readErpResource } from "@/lib/server/erp-state";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import { getServerPersistenceProvider } from "@/lib/server/server-persistence";

const INCIDENTS_COLLECTION = "incidents";
const INCIDENTS_RESOURCE_ID = "operations.incidents";
const DEFAULT_INCIDENTS_FILE = path.join(
  process.cwd(),
  ".data",
  "incidents.json",
);

let fileWriteQueue = Promise.resolve();

type IncidentVersion = number;

type StoredIncidentDocument = IncidentItem & {
  id: string;
  version: IncidentVersion;
  updatedAt: string | null;
  deleted?: false;
};

type DeletedIncidentDocument = {
  id: string;
  deleted: true;
  deletedAt: string;
  version: IncidentVersion;
  updatedAt: string | null;
};

type IncidentItemRecord = {
  incident: IncidentRecord | null;
  exists: boolean;
};

type IncidentMergeEntry =
  | { type: "incident"; incident: StoredIncidentDocument }
  | { type: "deleted"; incident: DeletedIncidentDocument };

type StoredIncidentEntry = StoredIncidentDocument | DeletedIncidentDocument;

type DeleteIncidentResult = {
  id: string;
  version: IncidentVersion;
  deletedAt: string;
};

type IncidentsFileStore = {
  items?: Record<string, StoredIncidentEntry>;
};

export type IncidentRecord = IncidentItem & {
  id: string;
  version: IncidentVersion;
  updatedAt: string | null;
};

export type ListIncidentsResult = {
  items: IncidentRecord[];
  count: number;
};

export type UpdateIncidentOptions = {
  baseVersion: number;
};

type IncidentDocumentMutationResult =
  | { type: "set"; value: IncidentItem & { id: string } }
  | { type: "noop"; value: IncidentRecord }
  | { type: "delete"; value: IncidentRecord };

export class IncidentConflictError extends Error {
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

export class IncidentNotFoundError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.status = 404;
  }
}

export function requireIncidentBaseVersion(value: unknown, operation: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ErpResourceValidationError(
      `baseVersion obrigatorio para ${operation} o incidente.`,
      400,
    );
  }

  return value;
}

export function getIncidentVersionConflictPayload(
  error: IncidentConflictError,
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

function normalizeIncidentId(value: string) {
  return value.trim();
}

function getLegacyIncidentId(
  incident: Pick<IncidentItem, "title" | "owner">,
) {
  const key = `${normalizeReference(incident.title)}::${normalizeReference(incident.owner)}`;
  const digest = createHash("sha1").update(key).digest("hex").slice(0, 16);
  return `inc_${digest}`;
}

function getIncidentId(incident: IncidentItem) {
  return typeof incident.id === "string" && incident.id.trim()
    ? normalizeIncidentId(incident.id)
    : getLegacyIncidentId(incident);
}

function getIncidentsFilePath() {
  return process.env.INCIDENTS_FILE_PATH
    ? path.resolve(process.cwd(), process.env.INCIDENTS_FILE_PATH)
    : DEFAULT_INCIDENTS_FILE;
}

function queueFileWrite<T>(operation: () => Promise<T>) {
  const nextOperation = fileWriteQueue.then(operation, operation);
  fileWriteQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );
  return nextOperation;
}

async function readIncidentsFileStore() {
  try {
    const raw = await readFile(getIncidentsFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        items: {},
      } satisfies Required<IncidentsFileStore>;
    }

    const value = parsed as IncidentsFileStore;

    return {
      items: normalizeFileItems(value.items),
    } satisfies Required<IncidentsFileStore>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        items: {},
      } satisfies Required<IncidentsFileStore>;
    }

    throw error;
  }
}

function normalizeStoredIncidentDocument(
  incidentId: string,
  value: unknown,
): StoredIncidentDocument | null {
  const sanitized = sanitizeStoredErpResourceItemData(
    INCIDENTS_RESOURCE_ID,
    value,
  );
  const item = sanitized.item;

  if (!item) {
    return null;
  }

  const resolvedId = getIncidentId(item);

  if (resolvedId !== incidentId) {
    return null;
  }

  const candidate = value as Partial<StoredIncidentDocument>;

  return {
    ...item,
    id: incidentId,
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

function normalizeDeletedIncidentDocument(
  incidentId: string,
  value: unknown,
): DeletedIncidentDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<DeletedIncidentDocument>;

  if (
    candidate.deleted !== true ||
    candidate.id !== incidentId ||
    typeof candidate.deletedAt !== "string"
  ) {
    return null;
  }

  return {
    id: incidentId,
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

function normalizeStoredIncidentEntry(
  incidentId: string,
  value: unknown,
): IncidentMergeEntry | null {
  const deletedIncident = normalizeDeletedIncidentDocument(incidentId, value);

  if (deletedIncident) {
    return {
      type: "deleted",
      incident: deletedIncident,
    };
  }

  const incident = normalizeStoredIncidentDocument(incidentId, value);

  if (!incident) {
    return null;
  }

  return {
    type: "incident",
    incident,
  };
}

function toStoredIncidentEntry(entry: IncidentMergeEntry): StoredIncidentEntry {
  return entry.incident;
}

function toIncidentMergeEntry(
  document: StoredIncidentEntry,
): IncidentMergeEntry {
  if ("deleted" in document && document.deleted === true) {
    return {
      type: "deleted",
      incident: document,
    };
  }

  return {
    type: "incident",
    incident: document,
  };
}

function normalizeFileItems(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, StoredIncidentEntry>;
  }

  const items: Record<string, StoredIncidentEntry> = {};

  for (const [incidentId, candidate] of Object.entries(value)) {
    const normalized = normalizeStoredIncidentEntry(incidentId, candidate);

    if (normalized) {
      items[incidentId] = toStoredIncidentEntry(normalized);
    }
  }

  return items;
}

function sortIncidents<TValue extends Pick<IncidentItem, "severity" | "title">>(
  items: TValue[],
) {
  return [...items].sort((left, right) => {
    const bySeverity = left.severity.localeCompare(right.severity);
    return bySeverity === 0 ? left.title.localeCompare(right.title) : bySeverity;
  });
}

function areIncidentPayloadsEqual(left: IncidentItem, right: IncidentItem) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toIncidentPayload(
  incident: IncidentRecord | null,
): (IncidentItem & { id: string }) | null {
  if (!incident) {
    return null;
  }

  const payload = { ...incident } as Partial<IncidentRecord>;
  delete payload.version;
  delete payload.updatedAt;
  return payload as IncidentItem & { id: string };
}

function validateIncidentWritePayload(value: unknown, incidentId?: string) {
  const normalized = validateErpResourceItemData(INCIDENTS_RESOURCE_ID, value);
  const candidateId =
    typeof normalized.id === "string" && normalized.id.trim()
      ? normalizeIncidentId(normalized.id)
      : undefined;

  if (incidentId && candidateId && candidateId !== incidentId) {
    throw new ErpResourceValidationError(
      "O id do incidente precisa corresponder ao id da rota.",
    );
  }

  return {
    ...normalized,
    id: incidentId ?? candidateId ?? getLegacyIncidentId(normalized),
  };
}

function assertBaseVersion(
  current: IncidentRecord | null,
  baseVersion: number,
): asserts current is IncidentRecord {
  if (!Number.isInteger(baseVersion) || baseVersion < 1) {
    throw new ErpResourceValidationError(
      "Versao base invalida para o incidente.",
    );
  }

  if (!current) {
    throw new IncidentNotFoundError("Incidente nao encontrado.");
  }

  if (current.version === baseVersion) {
    return;
  }

  throw new IncidentConflictError(
    "O incidente foi alterado por outra sessao. Recarregue os dados antes de salvar novamente.",
    current.version,
    current.updatedAt,
  );
}

function assertIncidentWriteResult(
  value: IncidentRecord | DeletedIncidentDocument,
): asserts value is IncidentRecord {
  if ("deleted" in value && value.deleted === true) {
    throw new Error("Operacao de incidente retornou um marcador de exclusao inesperado.");
  }
}

function assertIncidentDeleteResult(
  value: IncidentRecord | DeletedIncidentDocument,
): asserts value is DeletedIncidentDocument {
  if (!("deleted" in value) || value.deleted !== true) {
    throw new Error("Operacao de exclusao do incidente nao gerou marcador de exclusao.");
  }
}

function buildLegacyIncidentRecord(
  incident: IncidentItem,
  updatedAt: string | null,
): IncidentRecord {
  return {
    ...incident,
    id: getIncidentId(incident),
    version: 1,
    updatedAt,
  };
}

async function readLegacyIncidentsSnapshot() {
  return readErpResource(INCIDENTS_RESOURCE_ID);
}

function mergeIncidents(
  itemizedEntries: readonly IncidentMergeEntry[],
  legacyIncidents: readonly IncidentItem[],
  legacyUpdatedAt: string | null,
) {
  const merged = new Map<string, IncidentRecord>();
  const deletedIncidentIds = new Set<string>();

  for (const entry of itemizedEntries) {
    if (entry.type === "deleted") {
      deletedIncidentIds.add(entry.incident.id);
      merged.delete(entry.incident.id);
      continue;
    }

    merged.set(entry.incident.id, entry.incident);
  }

  for (const legacyIncident of legacyIncidents) {
    const incidentId = getIncidentId(legacyIncident);

    if (!deletedIncidentIds.has(incidentId) && !merged.has(incidentId)) {
      merged.set(
        incidentId,
        buildLegacyIncidentRecord(legacyIncident, legacyUpdatedAt),
      );
    }
  }

  return sortIncidents([...merged.values()]);
}

async function listFirebaseIncidents() {
  const [snapshot, legacyResource] = await Promise.all([
    getFirebaseAdminDb()
      .collection<StoredIncidentEntry>(INCIDENTS_COLLECTION)
      .get(),
    readLegacyIncidentsSnapshot(),
  ]);

  const itemizedEntries = snapshot.docs
    .map((document) =>
      normalizeStoredIncidentEntry(document.id, document.data()),
    )
    .filter((document): document is IncidentMergeEntry => document !== null)
    .sort((left, right) => left.incident.id.localeCompare(right.incident.id));

  return mergeIncidents(
    itemizedEntries,
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

async function listFileIncidents() {
  const [store, legacyResource] = await Promise.all([
    readIncidentsFileStore(),
    readLegacyIncidentsSnapshot(),
  ]);

  return mergeIncidents(
    Object.values(store.items)
      .map((document) => toIncidentMergeEntry(document))
      .sort((left, right) => left.incident.id.localeCompare(right.incident.id)),
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

function findLegacyIncident(
  incidents: readonly IncidentItem[],
  incidentId: string,
) {
  return incidents.find((candidate) => getIncidentId(candidate) === incidentId);
}

async function readFirebaseIncident(
  incidentId: string,
): Promise<IncidentItemRecord> {
  const snapshot = await getFirebaseAdminDb()
    .collection<StoredIncidentEntry>(INCIDENTS_COLLECTION)
    .doc(incidentId)
    .get();

  if (snapshot.exists) {
    const deletedIncident = normalizeDeletedIncidentDocument(
      incidentId,
      snapshot.data(),
    );

    if (deletedIncident) {
      return {
        incident: null,
        exists: false,
      };
    }

    const incident = normalizeStoredIncidentDocument(
      incidentId,
      snapshot.data(),
    );

    if (incident) {
      return {
        incident,
        exists: true,
      };
    }
  }

  const legacyResource = await readLegacyIncidentsSnapshot();
  const legacyIncident = findLegacyIncident(legacyResource.data, incidentId);

  if (!legacyIncident) {
    return {
      incident: null,
      exists: false,
    };
  }

  return {
    incident: buildLegacyIncidentRecord(
      legacyIncident,
      legacyResource.updatedAt,
    ),
    exists: true,
  };
}

async function readFileIncident(
  incidentId: string,
): Promise<IncidentItemRecord> {
  const store = await readIncidentsFileStore();
  const existingDocument = store.items[incidentId] ?? null;

  if (existingDocument) {
    if ("deleted" in existingDocument && existingDocument.deleted === true) {
      return {
        incident: null,
        exists: false,
      };
    }

    return {
      incident: existingDocument,
      exists: true,
    };
  }

  const legacyResource = await readLegacyIncidentsSnapshot();
  const legacyIncident = findLegacyIncident(legacyResource.data, incidentId);

  if (!legacyIncident) {
    return {
      incident: null,
      exists: false,
    };
  }

  return {
    incident: buildLegacyIncidentRecord(
      legacyIncident,
      legacyResource.updatedAt,
    ),
    exists: true,
  };
}

async function writeFirebaseIncidentDocument(
  incidentId: string,
  update: (
    current: IncidentRecord | null,
  ) => Promise<IncidentDocumentMutationResult>,
) {
  const database = getFirebaseAdminDb();
  const legacyResource = await readLegacyIncidentsSnapshot();
  const legacyIncident = findLegacyIncident(legacyResource.data, incidentId);
  const collectionRef =
    database.collection<StoredIncidentEntry>(INCIDENTS_COLLECTION);
  const documentRef = collectionRef.doc(incidentId);

  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(documentRef);
    const deletedIncident = snapshot.exists
      ? normalizeDeletedIncidentDocument(incidentId, snapshot.data())
      : null;
    const current = snapshot.exists
      ? deletedIncident
        ? null
        : normalizeStoredIncidentDocument(incidentId, snapshot.data())
      : legacyIncident
        ? buildLegacyIncidentRecord(legacyIncident, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    if (next.type === "delete") {
      const deletedAt = new Date().toISOString();
      const deletedDocument: DeletedIncidentDocument = {
        id: incidentId,
        deleted: true,
        deletedAt,
        updatedAt: deletedAt,
        version: next.value.version + 1,
      };

      transaction.set(documentRef, deletedDocument, { merge: false });
      return deletedDocument;
    }

    const nextDocument: StoredIncidentDocument = {
      ...next.value,
      updatedAt: new Date().toISOString(),
      version: current ? current.version + 1 : 1,
    };

    transaction.set(documentRef, nextDocument, { merge: false });
    return nextDocument;
  });
}

async function writeFileIncidentDocument(
  incidentId: string,
  update: (
    current: IncidentRecord | null,
  ) => Promise<IncidentDocumentMutationResult>,
) {
  return queueFileWrite(async () => {
    const filePath = getIncidentsFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });

    const [store, legacyResource] = await Promise.all([
      readIncidentsFileStore(),
      readLegacyIncidentsSnapshot(),
    ]);
    const legacyIncident = findLegacyIncident(legacyResource.data, incidentId);
    const existingDocument = store.items[incidentId] ?? null;
    const current: IncidentRecord | null = existingDocument
      ? "deleted" in existingDocument && existingDocument.deleted === true
        ? null
        : existingDocument
      : legacyIncident
        ? buildLegacyIncidentRecord(legacyIncident, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    if (next.type === "delete") {
      const deletedAt = new Date().toISOString();
      const deletedDocument: DeletedIncidentDocument = {
        id: incidentId,
        deleted: true,
        deletedAt,
        updatedAt: deletedAt,
        version: next.value.version + 1,
      };

      store.items[incidentId] = deletedDocument;
      await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
      return deletedDocument;
    }

    const nextDocument: StoredIncidentDocument = {
      ...next.value,
      updatedAt: new Date().toISOString(),
      version: current ? current.version + 1 : 1,
    };

    store.items[incidentId] = nextDocument;
    await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
    return nextDocument;
  });
}

async function writeIncidentDocument(
  incidentId: string,
  update: (
    current: IncidentRecord | null,
  ) => Promise<IncidentDocumentMutationResult>,
) {
  if (getIncidentsPersistenceProvider() === "firebase") {
    return writeFirebaseIncidentDocument(incidentId, update);
  }

  return writeFileIncidentDocument(incidentId, update);
}

export function getIncidentsPersistenceProvider() {
  return getServerPersistenceProvider("incidentes");
}

export async function listIncidents(): Promise<ListIncidentsResult> {
  const items =
    getIncidentsPersistenceProvider() === "firebase"
      ? await listFirebaseIncidents()
      : await listFileIncidents();

  return {
    items,
    count: items.length,
  };
}

export async function getIncidentById(incidentId: string) {
  const result =
    getIncidentsPersistenceProvider() === "firebase"
      ? await readFirebaseIncident(incidentId)
      : await readFileIncident(incidentId);

  if (!result.exists || !result.incident) {
    throw new IncidentNotFoundError("Incidente nao encontrado.");
  }

  return result.incident;
}

export async function createIncident(
  incident: unknown,
): Promise<IncidentRecord> {
  const normalized = validateIncidentWritePayload(incident);

  const createdIncident = await writeIncidentDocument(
    normalized.id,
    async (current) => {
      if (current) {
        throw new ErpResourceValidationError(
          "Ja existe um incidente com o id informado.",
          409,
        );
      }

      return {
        type: "set",
        value: normalized,
      };
    },
  );

  assertIncidentWriteResult(createdIncident);
  return createdIncident;
}

export async function updateIncident(
  incidentId: string,
  incidentPatch: unknown,
  options: UpdateIncidentOptions,
) {
  const updatedIncident = await writeIncidentDocument(
    incidentId,
    async (current) => {
      assertBaseVersion(current, options.baseVersion);

      if (
        !incidentPatch ||
        typeof incidentPatch !== "object" ||
        Array.isArray(incidentPatch)
      ) {
        throw new ErpResourceValidationError(
          "Carga invalida para o incidente.",
        );
      }

      const candidateId = (incidentPatch as { id?: unknown }).id;

      if (
        candidateId !== undefined &&
        (typeof candidateId !== "string" ||
          normalizeIncidentId(candidateId) !== incidentId)
      ) {
        throw new ErpResourceValidationError(
          "O id do incidente precisa corresponder ao id da rota.",
        );
      }

      const merged = validateIncidentWritePayload(
        {
          ...toIncidentPayload(current),
          ...incidentPatch,
          id: incidentId,
        },
        incidentId,
      );

      const currentPayload = toIncidentPayload(current);

      if (currentPayload && areIncidentPayloadsEqual(currentPayload, merged)) {
        return {
          type: "noop",
          value: current,
        } satisfies IncidentDocumentMutationResult;
      }

      return {
        type: "set",
        value: merged,
      } satisfies IncidentDocumentMutationResult;
    },
  );

  assertIncidentWriteResult(updatedIncident);
  return updatedIncident;
}

export async function deleteIncident(
  incidentId: string,
  baseVersion: number,
): Promise<DeleteIncidentResult> {
  const deletedIncident = await writeIncidentDocument(
    incidentId,
    async (current) => {
      assertBaseVersion(current, baseVersion);

      return {
        type: "delete",
        value: current,
      } satisfies IncidentDocumentMutationResult;
    },
  );

  assertIncidentDeleteResult(deletedIncident);

  return {
    id: deletedIncident.id,
    version: deletedIncident.version,
    deletedAt: deletedIncident.deletedAt,
  };
}
