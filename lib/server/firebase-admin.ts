import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

type FirebaseCredentialConfig = {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  storageBucket?: string;
};

export type FirebaseDocumentSnapshotLike<TData = Record<string, unknown>> = {
  exists: boolean;
  id: string;
  ref: FirebaseDocumentReferenceLike<TData>;
  data(): TData | undefined;
};

export type FirebaseQuerySnapshotLike<TData = Record<string, unknown>> = {
  docs: Array<FirebaseDocumentSnapshotLike<TData>>;
  forEach(
    callback: (document: FirebaseDocumentSnapshotLike<TData>) => void,
  ): void;
};

export type FirebaseDocumentReferenceLike<TData = Record<string, unknown>> = {
  id: string;
  get(): Promise<FirebaseDocumentSnapshotLike<TData>>;
  set(data: Partial<TData> | TData, options?: { merge?: boolean }): Promise<void>;
  delete(): Promise<void>;
};

export type FirebaseQueryLike<TData = Record<string, unknown>> = {
  get(): Promise<FirebaseQuerySnapshotLike<TData>>;
  where(
    fieldPath: string,
    opStr: string,
    value: unknown,
  ): FirebaseQueryLike<TData>;
  orderBy(
    fieldPath: string,
    directionStr?: "asc" | "desc",
  ): FirebaseQueryLike<TData>;
  limit(limit: number): FirebaseQueryLike<TData>;
};

export type FirebaseCollectionLike<TData = Record<string, unknown>> =
  FirebaseQueryLike<TData> & {
    doc(id: string): FirebaseDocumentReferenceLike<TData>;
  };

export type FirebaseTransactionLike = {
  get<TData = Record<string, unknown>>(
    documentReference: FirebaseDocumentReferenceLike<TData>,
  ): Promise<FirebaseDocumentSnapshotLike<TData>>;
  get<TData = Record<string, unknown>>(
    query: FirebaseQueryLike<TData>,
  ): Promise<FirebaseQuerySnapshotLike<TData>>;
  set<TData = Record<string, unknown>>(
    documentReference: FirebaseDocumentReferenceLike<TData>,
    data: Partial<TData> | TData,
    options?: { merge?: boolean },
  ): void;
  delete<TData = Record<string, unknown>>(
    documentReference: FirebaseDocumentReferenceLike<TData>,
  ): void;
};

export type FirebaseAdminDbLike = {
  collection<TData = Record<string, unknown>>(
    name: string,
  ): FirebaseCollectionLike<TData>;
  runTransaction<TValue>(
    updateFunction: (transaction: FirebaseTransactionLike) => Promise<TValue>,
  ): Promise<TValue>;
};

let firebaseAdminDbOverride: FirebaseAdminDbLike | null = null;
let firebaseConfiguredOverride: boolean | null = null;

function normalizePrivateKey(value?: string) {
  return value?.replace(/\\n/g, "\n");
}

function getFirebaseConfigFromJsonEnv() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const base64Json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  const source =
    rawJson ||
    (base64Json
      ? Buffer.from(base64Json, "base64").toString("utf8")
      : "");

  if (!source) {
    return null;
  }

  const parsed = JSON.parse(source) as FirebaseCredentialConfig;

  return {
    projectId: parsed.projectId,
    clientEmail: parsed.clientEmail,
    privateKey: normalizePrivateKey(parsed.privateKey),
    storageBucket:
      parsed.storageBucket ?? process.env.FIREBASE_STORAGE_BUCKET,
  };
}

function getFirebaseConfig() {
  const jsonConfig = getFirebaseConfigFromJsonEnv();

  if (jsonConfig) {
    return jsonConfig;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  return {
    projectId,
    clientEmail,
    privateKey,
    storageBucket,
  };
}

export function isFirebaseConfigured() {
  if (firebaseConfiguredOverride !== null) {
    return firebaseConfiguredOverride;
  }

  if (firebaseAdminDbOverride) {
    return true;
  }

  const config = getFirebaseConfig();
  return Boolean(config.projectId && config.clientEmail && config.privateKey);
}

function getFirebaseAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const config = getFirebaseConfig();

  if (!config.projectId || !config.clientEmail || !config.privateKey) {
    throw new Error("Firebase Admin nao configurado.");
  }

  return initializeApp({
    credential: cert({
      projectId: config.projectId,
      clientEmail: config.clientEmail,
      privateKey: config.privateKey,
    }),
    storageBucket: config.storageBucket,
  });
}

export function getFirebaseAdminDb(): FirebaseAdminDbLike {
  if (firebaseAdminDbOverride) {
    return firebaseAdminDbOverride;
  }

  return getFirestore(getFirebaseAdminApp()) as unknown as FirebaseAdminDbLike;
}

export function setFirebaseAdminDbForTests(db: FirebaseAdminDbLike | null) {
  firebaseAdminDbOverride = db;
  firebaseConfiguredOverride = db ? true : null;
}

export function setFirebaseConfiguredForTests(value: boolean | null) {
  firebaseConfiguredOverride = value;
}

export function resetFirebaseAdminTestOverrides() {
  firebaseAdminDbOverride = null;
  firebaseConfiguredOverride = null;
}
