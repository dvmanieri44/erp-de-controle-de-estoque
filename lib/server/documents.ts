import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DocumentItem } from "@/lib/operations-data";
import {
  ErpResourceValidationError,
  sanitizeStoredErpResourceItemData,
  validateErpResourceItemData,
} from "@/lib/server/erp-resource-schema";
import { readErpResource } from "@/lib/server/erp-state";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import { getServerPersistenceProvider } from "@/lib/server/server-persistence";

const DOCUMENTS_COLLECTION = "documents";
const DOCUMENTS_RESOURCE_ID = "operations.documents";
const DEFAULT_DOCUMENTS_FILE = path.join(
  process.cwd(),
  ".data",
  "documents.json",
);

let fileWriteQueue = Promise.resolve();

type DocumentVersion = number;

type StoredDocumentDocument = DocumentItem & {
  id: string;
  version: DocumentVersion;
  versionUpdatedAt: string | null;
  deleted?: false;
};

type DeletedDocumentDocument = {
  id: string;
  deleted: true;
  deletedAt: string;
  version: DocumentVersion;
  versionUpdatedAt: string | null;
};

type DocumentItemRecord = {
  document: DocumentRecord | null;
  exists: boolean;
};

type DocumentMergeEntry =
  | { type: "document"; document: StoredDocumentDocument }
  | { type: "deleted"; document: DeletedDocumentDocument };

type StoredDocumentEntry = StoredDocumentDocument | DeletedDocumentDocument;

type DeleteDocumentResult = {
  id: string;
  version: DocumentVersion;
  deletedAt: string;
};

type DocumentsFileStore = {
  items?: Record<string, StoredDocumentEntry>;
};

export type DocumentRecord = DocumentItem & {
  id: string;
  version: DocumentVersion;
  versionUpdatedAt: string | null;
};

export type ListDocumentsResult = {
  items: DocumentRecord[];
  count: number;
};

export type UpdateDocumentOptions = {
  baseVersion: number;
};

type DocumentMutationResult =
  | { type: "set"; value: DocumentItem & { id: string } }
  | { type: "noop"; value: DocumentRecord }
  | { type: "delete"; value: DocumentRecord };

export class DocumentConflictError extends Error {
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

export class DocumentNotFoundError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.status = 404;
  }
}

export function requireDocumentBaseVersion(value: unknown, operation: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ErpResourceValidationError(
      `baseVersion obrigatorio para ${operation} o documento.`,
      400,
    );
  }

  return value;
}

export function getDocumentVersionConflictPayload(error: DocumentConflictError) {
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

function normalizeDocumentId(value: string) {
  return value.trim();
}

function getLegacyDocumentId(document: Pick<DocumentItem, "title" | "type">) {
  const key = `${normalizeReference(document.title)}::${normalizeReference(document.type)}`;
  const digest = createHash("sha1").update(key).digest("hex").slice(0, 16);
  return `doc_${digest}`;
}

function getDocumentId(document: DocumentItem) {
  return typeof document.id === "string" && document.id.trim()
    ? normalizeDocumentId(document.id)
    : getLegacyDocumentId(document);
}

function getDocumentsFilePath() {
  return process.env.DOCUMENTS_FILE_PATH
    ? path.resolve(process.cwd(), process.env.DOCUMENTS_FILE_PATH)
    : DEFAULT_DOCUMENTS_FILE;
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

function normalizeVersionUpdatedAt(value: unknown) {
  return typeof value === "string" ? value : null;
}

function normalizeStoredDocumentDocument(
  documentId: string,
  value: unknown,
): StoredDocumentDocument | null {
  const sanitized = sanitizeStoredErpResourceItemData(
    DOCUMENTS_RESOURCE_ID,
    value,
  );
  const item = sanitized.item;

  if (!item) {
    return null;
  }

  const resolvedId = getDocumentId(item);

  if (resolvedId !== documentId) {
    return null;
  }

  const candidate = value as Partial<StoredDocumentDocument>;

  return {
    ...item,
    id: documentId,
    version: normalizeVersion(candidate.version),
    versionUpdatedAt: normalizeVersionUpdatedAt(candidate.versionUpdatedAt),
  };
}

function normalizeDeletedDocumentDocument(
  documentId: string,
  value: unknown,
): DeletedDocumentDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<DeletedDocumentDocument>;

  if (
    candidate.deleted !== true ||
    candidate.id !== documentId ||
    typeof candidate.deletedAt !== "string"
  ) {
    return null;
  }

  return {
    id: documentId,
    deleted: true,
    deletedAt: candidate.deletedAt,
    version: normalizeVersion(candidate.version),
    versionUpdatedAt: normalizeVersionUpdatedAt(candidate.versionUpdatedAt),
  };
}

function normalizeStoredDocumentEntry(
  documentId: string,
  value: unknown,
): DocumentMergeEntry | null {
  const deletedDocument = normalizeDeletedDocumentDocument(documentId, value);

  if (deletedDocument) {
    return {
      type: "deleted",
      document: deletedDocument,
    };
  }

  const document = normalizeStoredDocumentDocument(documentId, value);

  if (!document) {
    return null;
  }

  return {
    type: "document",
    document,
  };
}

function toStoredDocumentEntry(entry: DocumentMergeEntry): StoredDocumentEntry {
  return entry.document;
}

function toDocumentMergeEntry(
  document: StoredDocumentEntry,
): DocumentMergeEntry {
  if ("deleted" in document && document.deleted === true) {
    return {
      type: "deleted",
      document,
    };
  }

  return {
    type: "document",
    document,
  };
}

function normalizeFileItems(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, StoredDocumentEntry>;
  }

  const items: Record<string, StoredDocumentEntry> = {};

  for (const [documentId, candidate] of Object.entries(value)) {
    const normalized = normalizeStoredDocumentEntry(documentId, candidate);

    if (normalized) {
      items[documentId] = toStoredDocumentEntry(normalized);
    }
  }

  return items;
}

async function readDocumentsFileStore() {
  try {
    const raw = await readFile(getDocumentsFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        items: {},
      } satisfies Required<DocumentsFileStore>;
    }

    const value = parsed as DocumentsFileStore;

    return {
      items: normalizeFileItems(value.items),
    } satisfies Required<DocumentsFileStore>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        items: {},
      } satisfies Required<DocumentsFileStore>;
    }

    throw error;
  }
}

function sortDocuments<TValue extends Pick<DocumentItem, "title" | "type">>(
  items: TValue[],
) {
  return [...items].sort((left, right) => {
    const byType = left.type.localeCompare(right.type);
    return byType === 0 ? left.title.localeCompare(right.title) : byType;
  });
}

function areDocumentPayloadsEqual(left: DocumentItem, right: DocumentItem) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toDocumentPayload(
  document: DocumentRecord | null,
): (DocumentItem & { id: string }) | null {
  if (!document) {
    return null;
  }

  const payload = { ...document } as Partial<DocumentRecord>;
  delete payload.version;
  delete payload.versionUpdatedAt;
  return payload as DocumentItem & { id: string };
}

function validateDocumentWritePayload(value: unknown, documentId?: string) {
  const normalized = validateErpResourceItemData(DOCUMENTS_RESOURCE_ID, value);
  const candidateId =
    typeof normalized.id === "string" && normalized.id.trim()
      ? normalizeDocumentId(normalized.id)
      : undefined;

  if (documentId && candidateId && candidateId !== documentId) {
    throw new ErpResourceValidationError(
      "O id do documento precisa corresponder ao id da rota.",
    );
  }

  return {
    ...normalized,
    id: documentId ?? candidateId ?? getLegacyDocumentId(normalized),
  };
}

function assertBaseVersion(
  current: DocumentRecord | null,
  baseVersion: number,
): asserts current is DocumentRecord {
  if (!Number.isInteger(baseVersion) || baseVersion < 1) {
    throw new ErpResourceValidationError(
      "Versao base invalida para o documento.",
    );
  }

  if (!current) {
    throw new DocumentNotFoundError("Documento nao encontrado.");
  }

  if (current.version === baseVersion) {
    return;
  }

  throw new DocumentConflictError(
    "O documento foi alterado por outra sessao. Recarregue os dados antes de salvar novamente.",
    current.version,
    current.versionUpdatedAt,
  );
}

function assertDocumentWriteResult(
  value: DocumentRecord | DeletedDocumentDocument,
): asserts value is DocumentRecord {
  if ("deleted" in value && value.deleted === true) {
    throw new Error("Operacao de documento retornou um marcador de exclusao inesperado.");
  }
}

function assertDocumentDeleteResult(
  value: DocumentRecord | DeletedDocumentDocument,
): asserts value is DeletedDocumentDocument {
  if (!("deleted" in value) || value.deleted !== true) {
    throw new Error("Operacao de exclusao do documento nao gerou marcador de exclusao.");
  }
}

function buildLegacyDocumentRecord(
  document: DocumentItem,
  versionUpdatedAt: string | null,
): DocumentRecord {
  return {
    ...document,
    id: getDocumentId(document),
    version: 1,
    versionUpdatedAt,
  };
}

async function readLegacyDocumentsSnapshot() {
  return readErpResource(DOCUMENTS_RESOURCE_ID);
}

function mergeDocuments(
  itemizedEntries: readonly DocumentMergeEntry[],
  legacyDocuments: readonly DocumentItem[],
  legacyUpdatedAt: string | null,
) {
  const merged = new Map<string, DocumentRecord>();
  const deletedDocumentIds = new Set<string>();

  for (const entry of itemizedEntries) {
    if (entry.type === "deleted") {
      deletedDocumentIds.add(entry.document.id);
      merged.delete(entry.document.id);
      continue;
    }

    merged.set(entry.document.id, entry.document);
  }

  for (const legacyDocument of legacyDocuments) {
    const documentId = getDocumentId(legacyDocument);

    if (!deletedDocumentIds.has(documentId) && !merged.has(documentId)) {
      merged.set(
        documentId,
        buildLegacyDocumentRecord(legacyDocument, legacyUpdatedAt),
      );
    }
  }

  return sortDocuments([...merged.values()]);
}

async function listFirebaseDocuments() {
  const [snapshot, legacyResource] = await Promise.all([
    getFirebaseAdminDb()
      .collection<StoredDocumentEntry>(DOCUMENTS_COLLECTION)
      .get(),
    readLegacyDocumentsSnapshot(),
  ]);

  const itemizedEntries = snapshot.docs
    .map((document) =>
      normalizeStoredDocumentEntry(document.id, document.data()),
    )
    .filter((document): document is DocumentMergeEntry => document !== null)
    .sort((left, right) => left.document.id.localeCompare(right.document.id));

  return mergeDocuments(
    itemizedEntries,
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

async function listFileDocuments() {
  const [store, legacyResource] = await Promise.all([
    readDocumentsFileStore(),
    readLegacyDocumentsSnapshot(),
  ]);

  return mergeDocuments(
    Object.values(store.items)
      .map((document) => toDocumentMergeEntry(document))
      .sort((left, right) => left.document.id.localeCompare(right.document.id)),
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

function findLegacyDocument(
  documents: readonly DocumentItem[],
  documentId: string,
) {
  return documents.find((candidate) => getDocumentId(candidate) === documentId);
}

async function readFirebaseDocument(
  documentId: string,
): Promise<DocumentItemRecord> {
  const snapshot = await getFirebaseAdminDb()
    .collection<StoredDocumentEntry>(DOCUMENTS_COLLECTION)
    .doc(documentId)
    .get();

  if (snapshot.exists) {
    const deletedDocument = normalizeDeletedDocumentDocument(
      documentId,
      snapshot.data(),
    );

    if (deletedDocument) {
      return {
        document: null,
        exists: false,
      };
    }

    const document = normalizeStoredDocumentDocument(
      documentId,
      snapshot.data(),
    );

    if (document) {
      return {
        document,
        exists: true,
      };
    }
  }

  const legacyResource = await readLegacyDocumentsSnapshot();
  const legacyDocument = findLegacyDocument(legacyResource.data, documentId);

  if (!legacyDocument) {
    return {
      document: null,
      exists: false,
    };
  }

  return {
    document: buildLegacyDocumentRecord(
      legacyDocument,
      legacyResource.updatedAt,
    ),
    exists: true,
  };
}

async function readFileDocument(
  documentId: string,
): Promise<DocumentItemRecord> {
  const store = await readDocumentsFileStore();
  const existingDocument = store.items[documentId] ?? null;

  if (existingDocument) {
    if ("deleted" in existingDocument && existingDocument.deleted === true) {
      return {
        document: null,
        exists: false,
      };
    }

    return {
      document: existingDocument,
      exists: true,
    };
  }

  const legacyResource = await readLegacyDocumentsSnapshot();
  const legacyDocument = findLegacyDocument(legacyResource.data, documentId);

  if (!legacyDocument) {
    return {
      document: null,
      exists: false,
    };
  }

  return {
    document: buildLegacyDocumentRecord(
      legacyDocument,
      legacyResource.updatedAt,
    ),
    exists: true,
  };
}

async function writeFirebaseDocument(
  documentId: string,
  update: (current: DocumentRecord | null) => Promise<DocumentMutationResult>,
) {
  const database = getFirebaseAdminDb();
  const legacyResource = await readLegacyDocumentsSnapshot();
  const legacyDocument = findLegacyDocument(legacyResource.data, documentId);
  const collectionRef =
    database.collection<StoredDocumentEntry>(DOCUMENTS_COLLECTION);
  const documentRef = collectionRef.doc(documentId);

  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(documentRef);
    const deletedDocument = snapshot.exists
      ? normalizeDeletedDocumentDocument(documentId, snapshot.data())
      : null;
    const current = snapshot.exists
      ? deletedDocument
        ? null
        : normalizeStoredDocumentDocument(documentId, snapshot.data())
      : legacyDocument
        ? buildLegacyDocumentRecord(legacyDocument, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    const now = new Date().toISOString();

    if (next.type === "delete") {
      const deletedDocumentRecord: DeletedDocumentDocument = {
        id: documentId,
        deleted: true,
        deletedAt: now,
        version: next.value.version + 1,
        versionUpdatedAt: now,
      };

      transaction.set(documentRef, deletedDocumentRecord, { merge: false });
      return deletedDocumentRecord;
    }

    const nextDocument: StoredDocumentDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
      versionUpdatedAt: now,
    };

    transaction.set(documentRef, nextDocument, { merge: false });
    return nextDocument;
  });
}

async function writeFileDocument(
  documentId: string,
  update: (current: DocumentRecord | null) => Promise<DocumentMutationResult>,
) {
  return queueFileWrite(async () => {
    const filePath = getDocumentsFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });

    const [store, legacyResource] = await Promise.all([
      readDocumentsFileStore(),
      readLegacyDocumentsSnapshot(),
    ]);
    const legacyDocument = findLegacyDocument(legacyResource.data, documentId);
    const existingDocument = store.items[documentId] ?? null;
    const current: DocumentRecord | null = existingDocument
      ? "deleted" in existingDocument && existingDocument.deleted === true
        ? null
        : existingDocument
      : legacyDocument
        ? buildLegacyDocumentRecord(legacyDocument, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    const now = new Date().toISOString();

    if (next.type === "delete") {
      const deletedDocumentRecord: DeletedDocumentDocument = {
        id: documentId,
        deleted: true,
        deletedAt: now,
        version: next.value.version + 1,
        versionUpdatedAt: now,
      };

      store.items[documentId] = deletedDocumentRecord;
      await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
      return deletedDocumentRecord;
    }

    const nextDocument: StoredDocumentDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
      versionUpdatedAt: now,
    };

    store.items[documentId] = nextDocument;
    await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
    return nextDocument;
  });
}

async function writeDocument(
  documentId: string,
  update: (current: DocumentRecord | null) => Promise<DocumentMutationResult>,
) {
  if (getDocumentsPersistenceProvider() === "firebase") {
    return writeFirebaseDocument(documentId, update);
  }

  return writeFileDocument(documentId, update);
}

export function getDocumentsPersistenceProvider() {
  return getServerPersistenceProvider("documentos");
}

export async function listDocuments(): Promise<ListDocumentsResult> {
  const items =
    getDocumentsPersistenceProvider() === "firebase"
      ? await listFirebaseDocuments()
      : await listFileDocuments();

  return {
    items,
    count: items.length,
  };
}

export async function getDocumentById(documentId: string) {
  const result =
    getDocumentsPersistenceProvider() === "firebase"
      ? await readFirebaseDocument(documentId)
      : await readFileDocument(documentId);

  if (!result.exists || !result.document) {
    throw new DocumentNotFoundError("Documento nao encontrado.");
  }

  return result.document;
}

export async function createDocument(
  document: unknown,
): Promise<DocumentRecord> {
  const normalized = validateDocumentWritePayload(document);

  const createdDocument = await writeDocument(
    normalized.id,
    async (current) => {
      if (current) {
        throw new ErpResourceValidationError(
          "Ja existe um documento com o id informado.",
          409,
        );
      }

      return {
        type: "set",
        value: normalized,
      };
    },
  );

  assertDocumentWriteResult(createdDocument);
  return createdDocument;
}

export async function updateDocument(
  documentId: string,
  documentPatch: unknown,
  options: UpdateDocumentOptions,
) {
  const updatedDocument = await writeDocument(documentId, async (current) => {
    assertBaseVersion(current, options.baseVersion);

    if (
      !documentPatch ||
      typeof documentPatch !== "object" ||
      Array.isArray(documentPatch)
    ) {
      throw new ErpResourceValidationError(
        "Carga invalida para o documento.",
      );
    }

    const candidateId = (documentPatch as { id?: unknown }).id;

    if (
      candidateId !== undefined &&
      (typeof candidateId !== "string" ||
        normalizeDocumentId(candidateId) !== documentId)
    ) {
      throw new ErpResourceValidationError(
        "O id do documento precisa corresponder ao id da rota.",
      );
    }

    const merged = validateDocumentWritePayload(
      {
        ...toDocumentPayload(current),
        ...documentPatch,
        id: documentId,
      },
      documentId,
    );

    const currentPayload = toDocumentPayload(current);

    if (currentPayload && areDocumentPayloadsEqual(currentPayload, merged)) {
      return {
        type: "noop",
        value: current,
      } satisfies DocumentMutationResult;
    }

    return {
      type: "set",
      value: merged,
    } satisfies DocumentMutationResult;
  });

  assertDocumentWriteResult(updatedDocument);
  return updatedDocument;
}

export async function deleteDocument(
  documentId: string,
  baseVersion: number,
): Promise<DeleteDocumentResult> {
  const deletedDocument = await writeDocument(documentId, async (current) => {
    assertBaseVersion(current, baseVersion);

    return {
      type: "delete",
      value: current,
    } satisfies DocumentMutationResult;
  });

  assertDocumentDeleteResult(deletedDocument);

  return {
    id: deletedDocument.id,
    version: deletedDocument.version,
    deletedAt: deletedDocument.deletedAt,
  };
}
