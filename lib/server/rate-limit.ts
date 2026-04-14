import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getFirebaseAdminDb, isFirebaseConfigured } from "@/lib/server/firebase-admin";

const RATE_LIMIT_COLLECTION = "rateLimits";
const DEFAULT_RATE_LIMIT_FILE = path.join(process.cwd(), ".data", "rate-limits.json");

let fileWriteQueue = Promise.resolve();

type StoredRateLimitEntry = {
  id: string;
  scope: string;
  keyHash: string;
  attempts: number;
  windowStartedAt: string;
  blockedUntil: string | null;
  updatedAt: string;
};

type StoredRateLimitState = Record<string, StoredRateLimitEntry>;

export type RateLimitPolicy = {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
  blockDurationMs: number;
};

export type RateLimitStatus = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

function getRateLimitFilePath() {
  return process.env.RATE_LIMIT_FILE_PATH
    ? path.resolve(process.cwd(), process.env.RATE_LIMIT_FILE_PATH)
    : DEFAULT_RATE_LIMIT_FILE;
}

function queueFileWrite<T>(operation: () => Promise<T>) {
  const nextOperation = fileWriteQueue.then(operation, operation);
  fileWriteQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );
  return nextOperation;
}

function createRateLimitId(scope: string, key: string) {
  return `${scope}:${createHash("sha256").update(key).digest("hex")}`;
}

async function readFileRateLimitState() {
  try {
    const raw = await readFile(getRateLimitFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {} satisfies StoredRateLimitState;
    }

    return parsed as StoredRateLimitState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {} satisfies StoredRateLimitState;
    }

    throw error;
  }
}

async function updateFileRateLimitState(
  updater: (currentState: StoredRateLimitState) => StoredRateLimitState | Promise<StoredRateLimitState>,
) {
  await queueFileWrite(async () => {
    const filePath = getRateLimitFilePath();
    const currentState = await readFileRateLimitState();
    const nextState = await updater(currentState);

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(nextState, null, 2), "utf8");
  });
}

function getWindowBaseState() {
  return {
    attempts: 0,
    windowStartedAt: new Date().toISOString(),
    blockedUntil: null as string | null,
  };
}

function resolveEntryState(policy: RateLimitPolicy, entry: StoredRateLimitEntry | null, now = Date.now()) {
  if (!entry) {
    return getWindowBaseState();
  }

  const windowStartedAt = new Date(entry.windowStartedAt).getTime();
  const blockedUntil = entry.blockedUntil ? new Date(entry.blockedUntil).getTime() : null;

  if (blockedUntil && blockedUntil > now) {
    return {
      attempts: entry.attempts,
      windowStartedAt: entry.windowStartedAt,
      blockedUntil: entry.blockedUntil,
    };
  }

  if (!Number.isFinite(windowStartedAt) || now - windowStartedAt >= policy.windowMs) {
    return getWindowBaseState();
  }

  return {
    attempts: entry.attempts,
    windowStartedAt: entry.windowStartedAt,
    blockedUntil: null,
  };
}

function toRateLimitStatus(policy: RateLimitPolicy, state: ReturnType<typeof resolveEntryState>, now = Date.now()): RateLimitStatus {
  const blockedUntil = state.blockedUntil ? new Date(state.blockedUntil).getTime() : null;

  if (blockedUntil && blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil - now) / 1000)),
      remaining: 0,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, policy.limit - state.attempts),
  };
}

async function readRateLimitEntry(policy: RateLimitPolicy) {
  const id = createRateLimitId(policy.scope, policy.key);

  if (isFirebaseConfigured()) {
    const snapshot = await getFirebaseAdminDb().collection(RATE_LIMIT_COLLECTION).doc(id).get();
    return snapshot.exists ? (snapshot.data() as StoredRateLimitEntry) : null;
  }

  const state = await readFileRateLimitState();
  return state[id] ?? null;
}

export function getRateLimitProvider() {
  return isFirebaseConfigured() ? "firebase" : "file";
}

export async function getRateLimitStatus(policy: RateLimitPolicy) {
  const entry = await readRateLimitEntry(policy);
  return toRateLimitStatus(policy, resolveEntryState(policy, entry));
}

export async function registerRateLimitFailure(policy: RateLimitPolicy) {
  const id = createRateLimitId(policy.scope, policy.key);
  const now = Date.now();

  if (isFirebaseConfigured()) {
    const currentEntry = await readRateLimitEntry(policy);
    const currentState = resolveEntryState(policy, currentEntry, now);
    const attempts = currentState.attempts + 1;
    const blockedUntil =
      attempts >= policy.limit ? new Date(now + policy.blockDurationMs).toISOString() : null;

    const nextEntry: StoredRateLimitEntry = {
      id,
      scope: policy.scope,
      keyHash: id,
      attempts,
      windowStartedAt: currentState.windowStartedAt,
      blockedUntil,
      updatedAt: new Date(now).toISOString(),
    };

    await getFirebaseAdminDb().collection(RATE_LIMIT_COLLECTION).doc(id).set(nextEntry, { merge: true });
    return toRateLimitStatus(policy, resolveEntryState(policy, nextEntry, now), now);
  }

  let nextStatus: RateLimitStatus = {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: policy.limit,
  };

  await updateFileRateLimitState((currentState) => {
    const currentEntry = currentState[id] ?? null;
    const currentResolvedState = resolveEntryState(policy, currentEntry, now);
    const attempts = currentResolvedState.attempts + 1;
    const blockedUntil =
      attempts >= policy.limit ? new Date(now + policy.blockDurationMs).toISOString() : null;
    const nextEntry: StoredRateLimitEntry = {
      id,
      scope: policy.scope,
      keyHash: id,
      attempts,
      windowStartedAt: currentResolvedState.windowStartedAt,
      blockedUntil,
      updatedAt: new Date(now).toISOString(),
    };

    nextStatus = toRateLimitStatus(policy, resolveEntryState(policy, nextEntry, now), now);

    return {
      ...currentState,
      [id]: nextEntry,
    };
  });

  return nextStatus;
}

export async function clearRateLimit(policy: RateLimitPolicy) {
  const id = createRateLimitId(policy.scope, policy.key);

  if (isFirebaseConfigured()) {
    await getFirebaseAdminDb().collection(RATE_LIMIT_COLLECTION).doc(id).delete();
    return;
  }

  await updateFileRateLimitState((currentState) => {
    if (!(id in currentState)) {
      return currentState;
    }

    const nextState = { ...currentState };
    delete nextState[id];
    return nextState;
  });
}
