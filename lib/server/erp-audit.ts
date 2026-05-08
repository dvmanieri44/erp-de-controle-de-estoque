import "server-only";

import {
  writeAuditLog,
  type AuditLogJsonValue,
  type AuditLogOutcome,
} from "@/lib/server/audit-log";
import type { ServerSession } from "@/lib/server/auth-session";
import type { RequestMetadata } from "@/lib/server/request-metadata";

type ErpAuditMetadata = Record<string, AuditLogJsonValue | undefined>;

type WriteErpMutationAuditLogInput = {
  action: string;
  outcome?: AuditLogOutcome;
  session: ServerSession;
  resource: string;
  request: RequestMetadata;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  version?: number | null;
  metadata?: ErpAuditMetadata;
};

export async function writeErpMutationAuditLog({
  action,
  outcome = "success",
  session,
  resource,
  request,
  entityId = null,
  before = null,
  after = null,
  version = null,
  metadata,
}: WriteErpMutationAuditLogInput) {
  await writeAuditLog({
    category: "erp",
    action,
    outcome,
    actor: {
      accountId: session.account.id,
      username: session.username,
      role: session.role,
    },
    target: {
      accountId: null,
      resource: entityId ? `${resource}:${entityId}` : resource,
    },
    request,
    entityId,
    before,
    after,
    version,
    metadata: {
      entityId,
      version,
      ...metadata,
    },
  });
}

export function getAuditErrorMetadata(error: unknown): ErpAuditMetadata {
  return {
    error: error instanceof Error ? error.message : "Erro desconhecido",
  };
}
