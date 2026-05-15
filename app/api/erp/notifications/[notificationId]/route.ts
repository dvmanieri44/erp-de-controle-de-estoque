import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanDeleteErpResource,
  assertCanReadErpResource,
  assertCanUpdateErpResource,
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
  deleteNotification,
  getNotificationById,
  getNotificationVersionConflictPayload,
  NotificationConflictError,
  NotificationNotFoundError,
  requireNotificationBaseVersion,
  updateNotification,
} from "@/lib/server/notifications";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    notificationId: string;
  }>;
};

const NOTIFICATIONS_RESOURCE_ID = "operations.notifications";

const getNotificationNotFoundResponse = createStatusMessageErrorHandler(
  (error): error is NotificationNotFoundError =>
    error instanceof NotificationNotFoundError,
);
const getNotificationConflictResponse = createPayloadErrorHandler(
  (error): error is NotificationConflictError =>
    error instanceof NotificationConflictError,
  getNotificationVersionConflictPayload,
);

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    const { notificationId } = await context.params;
    assertCanReadErpResource(session, NOTIFICATIONS_RESOURCE_ID);
    const item = await getNotificationById(notificationId);
    return NextResponse.json({ item });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar a notificacao.",
      handlers: [getNotificationNotFoundResponse],
    });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { notificationId } = await context.params;

  try {
    assertCanUpdateErpResource(session, NOTIFICATIONS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireNotificationBaseVersion(
      body.baseVersion,
      "atualizar",
    );
    const before = await getNotificationById(notificationId);
    const item = await updateNotification(notificationId, body.item, {
      baseVersion,
    });

    await writeErpMutationAuditLog({
      action: "erp.notifications.updated",
      session,
      resource: NOTIFICATIONS_RESOURCE_ID,
      entityId: notificationId,
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
      action: "erp.notifications.updated",
      outcome,
      session,
      resource: NOTIFICATIONS_RESOURCE_ID,
      entityId: notificationId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para atualizacao da notificacao.",
      fallbackErrorMessage: "Falha ao atualizar a notificacao.",
      handlers: [getNotificationNotFoundResponse, getNotificationConflictResponse],
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { notificationId } = await context.params;

  try {
    assertCanDeleteErpResource(session, NOTIFICATIONS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireNotificationBaseVersion(
      body.baseVersion,
      "excluir",
    );
    const before = await getNotificationById(notificationId);
    const deletedItem = await deleteNotification(notificationId, baseVersion);

    await writeErpMutationAuditLog({
      action: "erp.notifications.deleted",
      session,
      resource: NOTIFICATIONS_RESOURCE_ID,
      entityId: notificationId,
      request: requestMetadata,
      before,
      version: deletedItem.version,
      metadata: {
        deletedAt: deletedItem.deletedAt,
      },
    });

    return NextResponse.json({
      notificationId: deletedItem.id,
      version: deletedItem.version,
      deletedAt: deletedItem.deletedAt,
    });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.notifications.deleted",
      outcome,
      session,
      resource: NOTIFICATIONS_RESOURCE_ID,
      entityId: notificationId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para exclusao da notificacao.",
      fallbackErrorMessage: "Falha ao excluir a notificacao.",
      handlers: [getNotificationNotFoundResponse, getNotificationConflictResponse],
    });
  }
}
