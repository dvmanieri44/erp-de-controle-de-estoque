import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { cloneErpResourceDefault, type ErpResourceId, type ErpResourceMap } from "@/lib/erp-data-resources";
import { getFirebaseAdminDb, isFirebaseConfigured } from "@/lib/server/firebase-admin";

const ERP_STATE_COLLECTION = "erpState";
const DEFAULT_ERP_STATE_FILE = path.join(process.cwd(), ".data", "erp-state.json");

let fileWriteQueue = Promise.resolve();

type StoredErpDocument<TKey extends ErpResourceId> = {
  resource: TKey;
  data: ErpResourceMap[TKey];
  updatedAt: string;
};

type AnyStoredErpDocument = {
  [TKey in ErpResourceId]: StoredErpDocument<TKey>;
}[ErpResourceId];

type StoredErpStateFile = Partial<Record<ErpResourceId, AnyStoredErpDocument>>;

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

function normalizeStoredDocument<TKey extends ErpResourceId>(resource: TKey, value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<StoredErpDocument<TKey>>;

  if (candidate.resource !== resource || !Array.isArray(candidate.data) || typeof candidate.updatedAt !== "string") {
    return null;
  }

  return {
    resource,
    data: candidate.data as ErpResourceMap[TKey],
    updatedAt: candidate.updatedAt,
  } satisfies StoredErpDocument<TKey>;
}

async function readFirebaseErpResource<TKey extends ErpResourceId>(resource: TKey) {
  const snapshot = await getFirebaseAdminDb().collection(ERP_STATE_COLLECTION).doc(resource).get();

  if (!snapshot.exists) {
    return {
      resource,
      data: cloneErpResourceDefault(resource),
      exists: false,
      updatedAt: null,
    };
  }

  const document = snapshot.data() as Partial<StoredErpDocument<TKey>> | undefined;

  return {
    resource,
    data: Array.isArray(document?.data)
      ? (document.data as ErpResourceMap[TKey])
      : cloneErpResourceDefault(resource),
    exists: true,
    updatedAt: typeof document?.updatedAt === "string" ? document.updatedAt : null,
  };
}

async function readFileErpResource<TKey extends ErpResourceId>(resource: TKey) {
  const state = await readFileStateStore();
  const document = normalizeStoredDocument(resource, state[resource]);

  if (!document) {
    return {
      resource,
      data: cloneErpResourceDefault(resource),
      exists: false,
      updatedAt: null,
    };
  }

  return {
    resource,
    data: document.data,
    exists: true,
    updatedAt: document.updatedAt,
  };
}

async function writeFirebaseErpResource<TKey extends ErpResourceId>(resource: TKey, data: ErpResourceMap[TKey]) {
  const updatedAt = new Date().toISOString();

  await getFirebaseAdminDb()
    .collection(ERP_STATE_COLLECTION)
    .doc(resource)
    .set(
      {
        resource,
        data,
        updatedAt,
      } satisfies StoredErpDocument<TKey>,
      { merge: true },
    );

  return {
    resource,
    data,
    exists: true,
    updatedAt,
  };
}

async function writeFileErpResource<TKey extends ErpResourceId>(resource: TKey, data: ErpResourceMap[TKey]) {
  const updatedAt = new Date().toISOString();

  await queueFileWrite(async () => {
    const filePath = getErpStateFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });

    const state = await readFileStateStore();
    state[resource] = {
      resource,
      data,
      updatedAt,
    } as AnyStoredErpDocument;

    await writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
  });

  return {
    resource,
    data,
    exists: true,
    updatedAt,
  };
}

export function getErpPersistenceProvider() {
  return isFirebaseConfigured() ? "firebase" : "file";
}

export async function readErpResource<TKey extends ErpResourceId>(resource: TKey) {
  if (getErpPersistenceProvider() === "firebase") {
    return readFirebaseErpResource(resource);
  }

  return readFileErpResource(resource);
}

export async function writeErpResource<TKey extends ErpResourceId>(resource: TKey, data: ErpResourceMap[TKey]) {
  if (getErpPersistenceProvider() === "firebase") {
    return writeFirebaseErpResource(resource, data);
  }

  return writeFileErpResource(resource, data);
}
