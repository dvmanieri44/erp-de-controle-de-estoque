import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { normalizeLoginUsername } from "@/lib/user-accounts";
import { MIN_PASSWORD_LENGTH, upsertAuthCredential } from "@/lib/server/auth-credentials";
import { loadServerUserAccounts } from "@/lib/server/auth-session";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import type { RequestMetadata } from "@/lib/server/request-metadata";
import { getServerPersistenceProvider } from "@/lib/server/server-persistence";

const PASSWORD_RESET_COLLECTION = "passwordResetTokens";
const DEFAULT_PASSWORD_RESET_FILE = path.join(process.cwd(), ".data", "password-reset-tokens.json");
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 15;

let fileWriteQueue = Promise.resolve();

type StoredPasswordResetToken = {
  id: string;
  tokenHash: string;
  accountId: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  request: RequestMetadata;
};

type PasswordResetState = Record<string, StoredPasswordResetToken>;

export class PasswordResetError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getPasswordResetFilePath() {
  return process.env.PASSWORD_RESET_FILE_PATH
    ? path.resolve(process.cwd(), process.env.PASSWORD_RESET_FILE_PATH)
    : DEFAULT_PASSWORD_RESET_FILE;
}

function queueFileWrite<T>(operation: () => Promise<T>) {
  const nextOperation = fileWriteQueue.then(operation, operation);
  fileWriteQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );
  return nextOperation;
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function readFilePasswordResetState() {
  try {
    const raw = await readFile(getPasswordResetFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {} satisfies PasswordResetState;
    }

    return parsed as PasswordResetState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {} satisfies PasswordResetState;
    }

    throw error;
  }
}

async function updateFilePasswordResetState(
  updater: (currentState: PasswordResetState) => PasswordResetState | Promise<PasswordResetState>,
) {
  await queueFileWrite(async () => {
    const currentState = await readFilePasswordResetState();
    const nextState = await updater(currentState);
    const filePath = getPasswordResetFilePath();

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(nextState, null, 2), "utf8");
  });
}

function buildResetTokenUrl(token: string) {
  const pathSuffix = `/login?resetToken=${encodeURIComponent(token)}`;
  const baseUrl = process.env.PASSWORD_RESET_BASE_URL?.trim();

  if (baseUrl) {
    return `${baseUrl.replace(/\/$/, "")}${pathSuffix}`;
  }

  return pathSuffix;
}

function canExposeDebugResetUrl() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_DEBUG_RESET_LINKS === "true"
  );
}

export function getPasswordResetProvider() {
  return getServerPersistenceProvider("tokens de redefinicao de senha");
}

export async function requestPasswordReset(identifier: string, request: RequestMetadata) {
  const normalizedIdentifier = normalizeLoginUsername(identifier);
  const normalizedEmail = identifier.trim().toLowerCase();
  const accounts = await loadServerUserAccounts();
  const account =
    accounts.find(
      (item) =>
        item.status === "ativo" &&
        (item.username === normalizedIdentifier || item.email.toLowerCase() === normalizedEmail),
    ) ?? null;

  if (!account) {
    return {
      requested: true,
      accountId: null,
      debugResetUrl: undefined as string | undefined,
    };
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(token);
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();
  const entry: StoredPasswordResetToken = {
    id: tokenHash,
    tokenHash,
    accountId: account.id,
    createdAt,
    expiresAt,
    usedAt: null,
    request,
  };

  if (getPasswordResetProvider() === "firebase") {
    const collection = getFirebaseAdminDb().collection(PASSWORD_RESET_COLLECTION);
    const existingTokens = await collection.where("accountId", "==", account.id).where("usedAt", "==", null).get();

    await Promise.all(existingTokens.docs.map((document) => document.ref.delete()));
    await collection.doc(entry.id).set(entry);
  } else {
    await updateFilePasswordResetState((currentState) => {
      const nextState: PasswordResetState = {};

      for (const [entryId, currentEntry] of Object.entries(currentState)) {
        if (!(currentEntry.accountId === account.id && currentEntry.usedAt === null)) {
          nextState[entryId] = currentEntry;
        }
      }

      nextState[entry.id] = entry;
      return nextState;
    });
  }

  return {
    requested: true,
    accountId: account.id,
    debugResetUrl: canExposeDebugResetUrl() ? buildResetTokenUrl(token) : undefined,
  };
}

async function readStoredPasswordResetToken(tokenHash: string) {
  if (getPasswordResetProvider() === "firebase") {
    const snapshot = await getFirebaseAdminDb().collection(PASSWORD_RESET_COLLECTION).doc(tokenHash).get();
    return snapshot.exists ? (snapshot.data() as StoredPasswordResetToken) : null;
  }

  const state = await readFilePasswordResetState();
  return state[tokenHash] ?? null;
}

async function markPasswordResetTokenAsUsed(tokenHash: string) {
  const usedAt = new Date().toISOString();

  if (getPasswordResetProvider() === "firebase") {
    await getFirebaseAdminDb()
      .collection(PASSWORD_RESET_COLLECTION)
      .doc(tokenHash)
      .set({ usedAt }, { merge: true });
    return;
  }

  await updateFilePasswordResetState((currentState) => {
    const currentEntry = currentState[tokenHash];

    if (!currentEntry) {
      return currentState;
    }

    return {
      ...currentState,
      [tokenHash]: {
        ...currentEntry,
        usedAt,
      },
    };
  });
}

export async function resetPasswordWithToken(token: string, password: string) {
  const trimmedPassword = password.trim();

  if (trimmedPassword.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordResetError(
      `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      400,
    );
  }

  const tokenHash = hashResetToken(token);
  const entry = await readStoredPasswordResetToken(tokenHash);

  if (!entry) {
    throw new PasswordResetError("Token de redefinicao invalido ou expirado.", 400);
  }

  if (entry.usedAt) {
    throw new PasswordResetError("Esse link de redefinicao ja foi utilizado.", 400);
  }

  if (new Date(entry.expiresAt).getTime() <= Date.now()) {
    throw new PasswordResetError("O token de redefinicao expirou. Solicite um novo link.", 400);
  }

  const accounts = await loadServerUserAccounts();
  const account = accounts.find((item) => item.id === entry.accountId && item.status === "ativo") ?? null;

  if (!account) {
    throw new PasswordResetError("Conta indisponivel para redefinicao de senha.", 404);
  }

  await upsertAuthCredential({
    accountId: account.id,
    username: account.username,
    password: trimmedPassword,
  });
  await markPasswordResetTokenAsUsed(tokenHash);

  return {
    accountId: account.id,
  };
}
