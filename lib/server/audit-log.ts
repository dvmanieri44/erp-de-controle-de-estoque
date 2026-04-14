import "server-only";

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { getFirebaseAdminDb, isFirebaseConfigured } from "@/lib/server/firebase-admin";
import type { RequestMetadata } from "@/lib/server/request-metadata";

const AUDIT_LOG_COLLECTION = "auditLogs";
const DEFAULT_AUDIT_LOG_FILE = path.join(process.cwd(), ".data", "audit-log.ndjson");

let fileWriteQueue = Promise.resolve();

export type AuditLogCategory = "auth" | "accounts" | "erp" | "security" | "operations";
export type AuditLogOutcome = "success" | "failure" | "denied";

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  category: AuditLogCategory;
  action: string;
  outcome: AuditLogOutcome;
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
  metadata: Record<string, string | number | boolean | null>;
};

type WriteAuditLogInput = Omit<AuditLogEntry, "id" | "timestamp" | "metadata"> & {
  timestamp?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
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

function sanitizeMetadata(metadata?: Record<string, string | number | boolean | null | undefined>) {
  if (!metadata) {
    return {};
  }

  return Object.entries(metadata).reduce<Record<string, string | number | boolean | null>>((result, [key, value]) => {
    if (value !== undefined) {
      result[key] = value;
    }

    return result;
  }, {});
}

export function getAuditLogProvider() {
  return isFirebaseConfigured() ? "firebase" : "file";
}

export async function writeAuditLog(input: WriteAuditLogInput) {
  const entry: AuditLogEntry = {
    id: randomUUID(),
    timestamp: input.timestamp ?? new Date().toISOString(),
    category: input.category,
    action: input.action,
    outcome: input.outcome,
    actor: input.actor,
    target: input.target,
    request: input.request,
    metadata: sanitizeMetadata(input.metadata),
  };

  if (isFirebaseConfigured()) {
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

  if (isFirebaseConfigured()) {
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
