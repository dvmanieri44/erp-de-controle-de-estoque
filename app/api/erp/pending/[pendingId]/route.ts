import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanReadErpResource,
  assertCanWriteErpResource,
} from "@/lib/server/erp-access-control";
import {
  getAuditErrorMetadata,
  writeErpMutationAuditLog,
} from "@/lib/server/erp-audit";
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
    const before = await getPendingItemById(pendingId);
    const item = await updatePendingItem(pendingId, body.item, {
      baseVersion,
    });

    await writeErpMutationAuditLog({
      action: "erp.pending.updated",
      session,
      resource: PENDING_RESOURCE_ID,
      entityId: pendingId,
      request: requestMetadata,
      before,
      after: item,
      version: item.version,
    });

    return NextResponse.json({ item });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.pending.updated",
      outcome,
      session,
      resource: PENDING_RESOURCE_ID,
      entityId: pendingId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
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
    const before = await getPendingItemById(pendingId);
    const deletedItem = await deletePendingItem(pendingId, baseVersion);

    await writeErpMutationAuditLog({
      action: "erp.pending.deleted",
      session,
      resource: PENDING_RESOURCE_ID,
      entityId: pendingId,
      request: requestMetadata,
      before,
      version: deletedItem.version,
      metadata: {
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

    await writeErpMutationAuditLog({
      action: "erp.pending.deleted",
      outcome,
      session,
      resource: PENDING_RESOURCE_ID,
      entityId: pendingId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para exclusao da pendencia.",
      fallbackErrorMessage: "Falha ao excluir a pendencia.",
      handlers: [getPendingNotFoundResponse, getPendingConflictResponse],
    });
  }
}
