import "server-only";

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import type { RequestMetadata } from "@/lib/server/request-metadata";
import { getServerPersistenceProvider } from "@/lib/server/server-persistence";

const AUDIT_LOG_COLLECTION = "auditLogs";
const DEFAULT_AUDIT_LOG_FILE = path.join(process.cwd(), ".data", "audit-log.ndjson");

let fileWriteQueue = Promise.resolve();

export type AuditLogCategory = "auth" | "accounts" | "erp" | "security" | "operations";
export type AuditLogOutcome = "success" | "failure" | "denied";

export type AuditLogJsonValue =
  | string
  | number
  | boolean
  | null
  | AuditLogJsonValue[]
  | { [key: string]: AuditLogJsonValue };

export type AuditLogMetadata = Record<string, AuditLogJsonValue>;

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  category: AuditLogCategory;
  action: string;
  outcome: AuditLogOutcome;
  entityId: string | null;
  before: AuditLogJsonValue | null;
  after: AuditLogJsonValue | null;
  version: number | null;
  actor: {
    accountId: string | null;
    username: string | null;
    role: string | null;
  };
  target: {
    accountId: string | null;
    resource: string | null;
  };
  request: RequestMetadata;
  metadata: AuditLogMetadata;
};

type WriteAuditLogInput = Omit<
  AuditLogEntry,
  "id" | "timestamp" | "entityId" | "before" | "after" | "version" | "metadata"
> & {
  timestamp?: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  version?: number | null;
  metadata?: Record<string, unknown>;
};

function getAuditLogFilePath() {
  return process.env.AUDIT_LOG_FILE_PATH
    ? path.resolve(process.cwd(), process.env.AUDIT_LOG_FILE_PATH)
    : DEFAULT_AUDIT_LOG_FILE;
}

function queueFileWrite<T>(operation: () => Promise<T>) {
  const nextOperation = fileWriteQueue.then(operation, operation);
  fileWriteQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );
  return nextOperation;
}

function sanitizeAuditValue(value: unknown): AuditLogJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item) ?? null);
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, AuditLogJsonValue>>(
      (result, [key, entryValue]) => {
        const sanitizedValue = sanitizeAuditValue(entryValue);

        if (sanitizedValue !== undefined) {
          result[key] = sanitizedValue;
        }

        return result;
      },
      {},
    );
  }

  return String(value);
}

function sanitizeMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) {
    return {};
  }

  return Object.entries(metadata).reduce<AuditLogMetadata>((result, [key, value]) => {
    const sanitizedValue = sanitizeAuditValue(value);

    if (sanitizedValue !== undefined) {
      result[key] = sanitizedValue;
    }

    return result;
  }, {});
}

export function getAuditLogProvider() {
  return getServerPersistenceProvider("auditoria");
}

export async function writeAuditLog(input: WriteAuditLogInput) {
  const entry: AuditLogEntry = {
    id: randomUUID(),
    timestamp: input.timestamp ?? new Date().toISOString(),
    category: input.category,
    action: input.action,
    outcome: input.outcome,
    entityId: input.entityId ?? null,
    before: sanitizeAuditValue(input.before) ?? null,
    after: sanitizeAuditValue(input.after) ?? null,
    version:
      typeof input.version === "number" && Number.isFinite(input.version)
        ? input.version
        : null,
    actor: input.actor,
    target: input.target,
    request: input.request,
    metadata: sanitizeMetadata(input.metadata),
  };

  if (getAuditLogProvider() === "firebase") {
    await getFirebaseAdminDb().collection(AUDIT_LOG_COLLECTION).doc(entry.id).set(entry);
    return entry;
  }

  await queueFileWrite(async () => {
    const filePath = getAuditLogFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });
    await appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
  });

  return entry;
}

export async function listAuditLogs(options?: {
  limit?: number;
  category?: AuditLogCategory;
}) {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);

  if (getAuditLogProvider() === "firebase") {
    let query = getFirebaseAdminDb().collection(AUDIT_LOG_COLLECTION).orderBy("timestamp", "desc").limit(limit);

    if (options?.category) {
      query = query.where("category", "==", options.category);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((document) => document.data() as AuditLogEntry);
  }

  try {
    const raw = await readFile(getAuditLogFilePath(), "utf8");

    return raw
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as AuditLogEntry)
      .filter((entry) => (options?.category ? entry.category === options.category : true))
      .slice(-limit)
      .reverse();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [] as AuditLogEntry[];
    }

    throw error;
  }
}
