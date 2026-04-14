import "server-only";

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { UserAccount } from "@/lib/user-accounts";
import { normalizeLoginUsername } from "@/lib/user-accounts";
import { getFirebaseAdminDb, isFirebaseConfigured } from "@/lib/server/firebase-admin";

const scrypt = promisify(scryptCallback);
const AUTH_CREDENTIALS_COLLECTION = "authCredentials";
const DEFAULT_AUTH_CREDENTIALS_FILE = path.join(process.cwd(), ".data", "auth-credentials.json");
const PRIMARY_ADMIN_ACCOUNT_ID = "conta-admin-premierpet";

const DEV_BOOTSTRAP_PASSWORDS: Record<string, string> = {
  admin: "admin123",
  joao: "123456",
  maria: "123456",
  auditoria: "123456",
};

export const MIN_PASSWORD_LENGTH = 8;

export type StoredAuthCredential = {
  accountId: string;
  username: string;
  passwordHash: string;
  salt: string;
  updatedAt: string;
};

type StoredAuthCredentialState = Record<string, StoredAuthCredential>;

let fileWriteQueue = Promise.resolve();

function getAuthCredentialsFilePath() {
  return process.env.AUTH_CREDENTIALS_FILE_PATH
    ? path.resolve(process.cwd(), process.env.AUTH_CREDENTIALS_FILE_PATH)
    : DEFAULT_AUTH_CREDENTIALS_FILE;
}

export function getAuthCredentialsProvider() {
  return isFirebaseConfigured() ? "firebase" : "file";
}

function normalizeCredentialRecord(accountId: string, value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<StoredAuthCredential>;
  const username =
    typeof candidate.username === "string" ? normalizeLoginUsername(candidate.username) : "";

  if (
    candidate.accountId !== accountId ||
    !username ||
    typeof candidate.passwordHash !== "string" ||
    typeof candidate.salt !== "string" ||
    typeof candidate.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    accountId,
    username,
    passwordHash: candidate.passwordHash,
    salt: candidate.salt,
    updatedAt: candidate.updatedAt,
  } satisfies StoredAuthCredential;
}

async function readFileCredentialState() {
  try {
    const raw = await readFile(getAuthCredentialsFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {} satisfies StoredAuthCredentialState;
    }

    return Object.entries(parsed).reduce<StoredAuthCredentialState>((result, [accountId, value]) => {
      const normalized = normalizeCredentialRecord(accountId, value);

      if (normalized) {
        result[accountId] = normalized;
      }

      return result;
    }, {});
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {} satisfies StoredAuthCredentialState;
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

async function readFirebaseCredentialState() {
  const snapshot = await getFirebaseAdminDb().collection(AUTH_CREDENTIALS_COLLECTION).get();
  const credentials: StoredAuthCredentialState = {};

  snapshot.forEach((document) => {
    const normalized = normalizeCredentialRecord(document.id, document.data());

    if (normalized) {
      credentials[document.id] = normalized;
    }
  });

  return credentials;
}

async function readCredentialState() {
  if (isFirebaseConfigured()) {
    return readFirebaseCredentialState();
  }

  return readFileCredentialState();
}

async function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

  return {
    passwordHash: derivedKey.toString("hex"),
    salt,
  };
}

export async function verifyAuthCredentialPassword(credential: StoredAuthCredential, password: string) {
  const derivedKey = (await scrypt(password, credential.salt, 64)) as Buffer;
  const expectedBuffer = Buffer.from(credential.passwordHash, "hex");

  return (
    derivedKey.length === expectedBuffer.length &&
    timingSafeEqual(derivedKey, expectedBuffer)
  );
}

async function updateFileCredentialState(
  updater: (currentState: StoredAuthCredentialState) => StoredAuthCredentialState | Promise<StoredAuthCredentialState>,
) {
  await queueFileWrite(async () => {
    const filePath = getAuthCredentialsFilePath();
    const currentState = await readFileCredentialState();
    const nextState = await updater(currentState);

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(nextState, null, 2), "utf8");
  });
}

async function persistCredential(credential: StoredAuthCredential) {
  if (isFirebaseConfigured()) {
    await getFirebaseAdminDb()
      .collection(AUTH_CREDENTIALS_COLLECTION)
      .doc(credential.accountId)
      .set(credential, { merge: true });
    return;
  }

  await updateFileCredentialState((nextState) => ({
    ...nextState,
    [credential.accountId]: credential,
  }));
}

export async function upsertAuthCredential(input: {
  accountId: string;
  username: string;
  password: string;
}) {
  const normalizedUsername = normalizeLoginUsername(input.username);

  if (!normalizedUsername) {
    throw new Error("Usuario de acesso invalido.");
  }

  const { passwordHash, salt } = await hashPassword(input.password.trim());
  const credential: StoredAuthCredential = {
    accountId: input.accountId,
    username: normalizedUsername,
    passwordHash,
    salt,
    updatedAt: new Date().toISOString(),
  };

  await persistCredential(credential);
  return credential;
}

export async function renameAuthCredentialUsername(input: {
  accountId: string;
  username: string;
}) {
  const currentCredentials = await readCredentialState();
  const currentCredential = currentCredentials[input.accountId];

  if (!currentCredential) {
    return null;
  }

  const normalizedUsername = normalizeLoginUsername(input.username);

  if (!normalizedUsername) {
    throw new Error("Usuario de acesso invalido.");
  }

  const updatedCredential: StoredAuthCredential = {
    ...currentCredential,
    username: normalizedUsername,
    updatedAt: new Date().toISOString(),
  };

  await persistCredential(updatedCredential);
  return updatedCredential;
}

export async function deleteAuthCredential(accountId: string) {
  if (isFirebaseConfigured()) {
    await getFirebaseAdminDb().collection(AUTH_CREDENTIALS_COLLECTION).doc(accountId).delete();
    return;
  }

  await updateFileCredentialState((currentState) => {
    if (!(accountId in currentState)) {
      return currentState;
    }

    const nextState = { ...currentState };
    delete nextState[accountId];
    return nextState;
  });
}

function getBootstrapCredentials(accounts: UserAccount[]) {
  if (process.env.NODE_ENV !== "production") {
    return accounts
      .map((account) => {
        const password = DEV_BOOTSTRAP_PASSWORDS[account.username];

        return password
          ? {
              accountId: account.id,
              username: account.username,
              password,
            }
          : null;
      })
      .filter(
        (
          item,
        ): item is {
          accountId: string;
          username: string;
          password: string;
        } => item !== null,
      );
  }

  const adminAccount = accounts.find((account) => account.id === PRIMARY_ADMIN_ACCOUNT_ID) ?? null;
  const bootstrapAdminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();

  if (!adminAccount || !bootstrapAdminPassword) {
    return [];
  }

  return [
    {
      accountId: adminAccount.id,
      username: adminAccount.username,
      password: bootstrapAdminPassword,
    },
  ];
}

export async function loadAuthCredentialsForAccounts(accounts: UserAccount[]) {
  let credentials = await readCredentialState();
  const bootstrapCredentials = getBootstrapCredentials(accounts);
  const missingBootstrapCredentials = bootstrapCredentials.filter((item) => !credentials[item.accountId]);

  if (missingBootstrapCredentials.length > 0) {
    for (const credential of missingBootstrapCredentials) {
      await upsertAuthCredential(credential);
    }

    credentials = await readCredentialState();
  }

  return credentials;
}
