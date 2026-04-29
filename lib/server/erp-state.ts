import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ErpResourceId, ErpResourceMap } from "@/lib/erp-data-resources";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import {
  getFallbackErpResourceData,
  sanitizeStoredErpResourceData,
  validateErpResourceData,
} from "@/lib/server/erp-resource-schema";
import { getServerPersistenceProvider } from "@/lib/server/server-persistence";

const ERP_STATE_COLLECTION = "erpState";
const DEFAULT_ERP_STATE_FILE = path.join(process.cwd(), ".data", "erp-state.json");

let fileWriteQueue = Promise.resolve();

type StoredErpDocument<TKey extends ErpResourceId> = {
  resource: TKey;
  data: ErpResourceMap[TKey];
  updatedAt: string | null;
  version: number;
};

type AnyStoredErpDocument = {
  [TKey in ErpResourceId]: StoredErpDocument<TKey>;
}[ErpResourceId];

type StoredErpStateFile = Partial<Record<ErpResourceId, AnyStoredErpDocument>>;

export type ReadErpResourceResult<TKey extends ErpResourceId> = {
  resource: TKey;
  data: ErpResourceMap[TKey];
  exists: boolean;
  updatedAt: string | null;
  version: number;
};

export type WriteErpResourceOptions = {
  baseVersion?: number | null;
};

export class ErpResourceConflictError extends Error {
  status: number;
  currentVersion: number;
  currentUpdatedAt: string | null;

  constructor(message: string, currentVersion: number, currentUpdatedAt: string | null) {
    super(message);
    this.status = 409;
    this.currentVersion = currentVersion;
    this.currentUpdatedAt = currentUpdatedAt;
  }
}

function getErpStateFilePath() {
  return process.env.ERP_STATE_FILE_PATH
    ? path.resolve(process.cwd(), process.env.ERP_STATE_FILE_PATH)
    : DEFAULT_ERP_STATE_FILE;
}

async function readFileStateStore() {
  try {
    const raw = await readFile(getErpStateFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {} satisfies StoredErpStateFile;
    }

    return parsed as StoredErpStateFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {} satisfies StoredErpStateFile;
    }

    throw error;
  }
}

function queueFileWrite<T>(operation: () => Promise<T>) {
  const nextOperation = fileWriteQueue.then(operation, operation);
  fileWriteQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );
  return nextOperation;
}

function buildMissingResourceResult<TKey extends ErpResourceId>(resource: TKey): ReadErpResourceResult<TKey> {
  return {
    resource,
    data: getFallbackErpResourceData(resource),
    exists: false,
    updatedAt: null,
    version: 0,
  };
}

function normalizeStoredDocument<TKey extends ErpResourceId>(resource: TKey, value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<StoredErpDocument<TKey>>;
  const storedResource = candidate.resource ?? resource;

  if (storedResource !== resource || !Array.isArray(candidate.data)) {
    return null;
  }

  return {
    resource,
    data: candidate.data as ErpResourceMap[TKey],
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    version:
      typeof candidate.version === "number" &&
      Number.isInteger(candidate.version) &&
      candidate.version >= 1
        ? candidate.version
        : 1,
  } satisfies StoredErpDocument<TKey>;
}

function toReadResourceResult<TKey extends ErpResourceId>(
  resource: TKey,
  document: StoredErpDocument<TKey>,
): ReadErpResourceResult<TKey> {
  const sanitized = sanitizeStoredErpResourceData(resource, document.data);

  return {
    resource,
    data: sanitized.data,
    exists: true,
    updatedAt: document.updatedAt,
    version: document.version,
  };
}

function assertWriteVersion(
  currentResource: ReadErpResourceResult<ErpResourceId>,
  baseVersion: number | null | undefined,
) {
  if (!currentResource.exists) {
    if (baseVersion === undefined || baseVersion === null || baseVersion === 0) {
      return;
    }

    throw new ErpResourceConflictError(
      "O recurso ainda nao existe no servidor na versao informada.",
      currentResource.version,
      currentResource.updatedAt,
    );
  }

  if (baseVersion === currentResource.version) {
    return;
  }

  throw new ErpResourceConflictError(
    "O recurso foi alterado por outra sessao. Recarregue os dados antes de salvar novamente.",
    currentResource.version,
    currentResource.updatedAt,
  );
}

function areResourcePayloadsEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function readFirebaseErpResource<TKey extends ErpResourceId>(
  resource: TKey,
): Promise<ReadErpResourceResult<TKey>> {
  const snapshot = await getFirebaseAdminDb().collection(ERP_STATE_COLLECTION).doc(resource).get();

  if (!snapshot.exists) {
    return buildMissingResourceResult(resource);
  }

  const document = normalizeStoredDocument(resource, snapshot.data());

  if (!document) {
    return {
      resource,
      data: [] as ErpResourceMap[TKey],
      exists: true,
      updatedAt: null,
      version: 1,
    };
  }

  return toReadResourceResult(resource, document);
}

async function readFileErpResource<TKey extends ErpResourceId>(
  resource: TKey,
): Promise<ReadErpResourceResult<TKey>> {
  const state = await readFileStateStore();
  const document = normalizeStoredDocument(resource, state[resource]);

  if (!document) {
    return buildMissingResourceResult(resource);
  }

  return toReadResourceResult(resource, document);
}

async function writeFirebaseErpResource<TKey extends ErpResourceId>(
  resource: TKey,
  data: ErpResourceMap[TKey],
  options?: WriteErpResourceOptions,
) {
  const normalizedData = validateErpResourceData(resource, data);
  const documentRef = getFirebaseAdminDb().collection(ERP_STATE_COLLECTION).doc(resource);

  return getFirebaseAdminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(documentRef);
    const currentResource = !snapshot.exists
      ? buildMissingResourceResult(resource)
      : (() => {
          const document = normalizeStoredDocument(resource, snapshot.data());

          if (!document) {
            return {
              resource,
              data: [] as ErpResourceMap[TKey],
              exists: true,
              updatedAt: null,
              version: 1,
            } satisfies ReadErpResourceResult<TKey>;
          }

          return toReadResourceResult(resource, document);
        })();

    assertWriteVersion(
      currentResource as ReadErpResourceResult<ErpResourceId>,
      options?.baseVersion,
    );

    if (currentResource.exists && areResourcePayloadsEqual(currentResource.data, normalizedData)) {
      return currentResource;
    }

    const nextVersion = currentResource.exists ? currentResource.version + 1 : 1;
    const updatedAt = new Date().toISOString();
    const nextDocument: StoredErpDocument<TKey> = {
      resource,
      data: normalizedData,
      updatedAt,
      version: nextVersion,
    };

    transaction.set(documentRef, nextDocument, { merge: false });

    return {
      resource,
      data: normalizedData,
      exists: true,
      updatedAt,
      version: nextVersion,
    } satisfies ReadErpResourceResult<TKey>;
  });
}

async function writeFileErpResource<TKey extends ErpResourceId>(
  resource: TKey,
  data: ErpResourceMap[TKey],
  options?: WriteErpResourceOptions,
) {
  const normalizedData = validateErpResourceData(resource, data);

  return queueFileWrite(async () => {
    const filePath = getErpStateFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });

    const state = await readFileStateStore();
    const currentDocument = normalizeStoredDocument(resource, state[resource]);
    const currentResource = currentDocument
      ? toReadResourceResult(resource, currentDocument)
      : buildMissingResourceResult(resource);

    assertWriteVersion(
      currentResource as ReadErpResourceResult<ErpResourceId>,
      options?.baseVersion,
    );

    if (currentResource.exists && areResourcePayloadsEqual(currentResource.data, normalizedData)) {
      return currentResource;
    }

    const nextVersion = currentResource.exists ? currentResource.version + 1 : 1;
    const updatedAt = new Date().toISOString();

    state[resource] = {
      resource,
      data: normalizedData,
      updatedAt,
      version: nextVersion,
    } as AnyStoredErpDocument;

    await writeFile(filePath, JSON.stringify(state, null, 2), "utf8");

    return {
      resource,
      data: normalizedData,
      exists: true,
      updatedAt,
      version: nextVersion,
    } satisfies ReadErpResourceResult<TKey>;
  });
}

export function getErpPersistenceProvider() {
  return getServerPersistenceProvider("erp");
}

export async function readErpResource<TKey extends ErpResourceId>(resource: TKey) {
  if (getErpPersistenceProvider() === "firebase") {
    return readFirebaseErpResource(resource);
  }

  return readFileErpResource(resource);
}

export async function writeErpResource<TKey extends ErpResourceId>(
  resource: TKey,
  data: ErpResourceMap[TKey],
  options?: WriteErpResourceOptions,
) {
  if (getErpPersistenceProvider() === "firebase") {
    return writeFirebaseErpResource(resource, data, options);
  }

  return writeFileErpResource(resource, data, options);
}
