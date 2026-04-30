import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanReadErpResource,
  assertCanWriteErpResource,
} from "@/lib/server/erp-access-control";
import { writeAuditLog } from "@/lib/server/audit-log";
import { readServerSession } from "@/lib/server/auth-session";
import {
  createPayloadErrorHandler,
  createStatusMessageErrorHandler,
  getErpApiErrorResponse,
  getUnauthorizedErpResponse,
  readJsonObjectBody,
} from "@/lib/server/erp-api-errors";
import {
  deletePendingItem,
  getPendingItemById,
  getPendingVersionConflictPayload,
  PendingConflictError,
  PendingNotFoundError,
  requirePendingBaseVersion,
  updatePendingItem,
} from "@/lib/server/pending-items";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    pendingId: string;
  }>;
};

const PENDING_RESOURCE_ID = "operations.pending";

function getPendingTarget(pendingId: string) {
  return {
    accountId: null,
    resource: `${PENDING_RESOURCE_ID}:${pendingId}`,
  };
}

const getPendingNotFoundResponse = createStatusMessageErrorHandler(
  (error): error is PendingNotFoundError =>
    error instanceof PendingNotFoundError,
);
const getPendingConflictResponse = createPayloadErrorHandler(
  (error): error is PendingConflictError =>
    error instanceof PendingConflictError,
  getPendingVersionConflictPayload,
);

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    const { pendingId } = await context.params;
    assertCanReadErpResource(session, PENDING_RESOURCE_ID);
    const item = await getPendingItemById(pendingId);
    return NextResponse.json({ item });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar a pendencia.",
      handlers: [getPendingNotFoundResponse],
    });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { pendingId } = await context.params;

  try {
    assertCanWriteErpResource(session, PENDING_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requirePendingBaseVersion(
      body.baseVersion,
      "atualizar",
    );
    const item = await updatePendingItem(pendingId, body.item, {
      baseVersion,
    });

    await writeAuditLog({
      category: "erp",
      action: "erp.pending.updated",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getPendingTarget(pendingId),
      request: requestMetadata,
      metadata: {
        version: item.version,
      },
    });

    return NextResponse.json({ item });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.pending.updated",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getPendingTarget(pendingId),
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para atualizacao da pendencia.",
      fallbackErrorMessage: "Falha ao atualizar a pendencia.",
      handlers: [getPendingNotFoundResponse, getPendingConflictResponse],
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { pendingId } = await context.params;

  try {
    assertCanWriteErpResource(session, PENDING_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requirePendingBaseVersion(body.baseVersion, "excluir");
    const deletedItem = await deletePendingItem(pendingId, baseVersion);

    await writeAuditLog({
      category: "erp",
      action: "erp.pending.deleted",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getPendingTarget(pendingId),
      request: requestMetadata,
      metadata: {
        version: deletedItem.version,
        deletedAt: deletedItem.deletedAt,
      },
    });

    return NextResponse.json({
      pendingId: deletedItem.id,
      version: deletedItem.version,
      deletedAt: deletedItem.deletedAt,
    });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.pending.deleted",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getPendingTarget(pendingId),
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para exclusao da pendencia.",
      fallbackErrorMessage: "Falha ao excluir a pendencia.",
      handlers: [getPendingNotFoundResponse, getPendingConflictResponse],
    });
  }
}
