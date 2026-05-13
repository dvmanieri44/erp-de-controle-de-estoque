import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanCreateErpResource,
  assertCanReadErpResource,
} from "@/lib/server/erp-access-control";
import {
  getAuditErrorMetadata,
  writeErpMutationAuditLog,
} from "@/lib/server/erp-audit";
import { readServerSession } from "@/lib/server/auth-session";
import {
  getErpApiErrorResponse,
  getUnauthorizedErpResponse,
  readJsonObjectBody,
} from "@/lib/server/erp-api-errors";
import {
  createNotification,
  getNotificationsPersistenceProvider,
  listNotifications,
} from "@/lib/server/notifications";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

const NOTIFICATIONS_RESOURCE_ID = "operations.notifications";

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    assertCanReadErpResource(session, NOTIFICATIONS_RESOURCE_ID);
    const payload = await listNotifications();

    return NextResponse.json({
      ...payload,
      provider: getNotificationsPersistenceProvider(),
    });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar as notificacoes.",
    });
  }
}

export async function POST(request: Request) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    assertCanCreateErpResource(session, NOTIFICATIONS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const item = await createNotification(body.item);

    await writeErpMutationAuditLog({
      action: "erp.notifications.created",
      session,
      resource: NOTIFICATIONS_RESOURCE_ID,
      entityId: item.id,
      request: requestMetadata,
      after: item,
      version: item.version,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.notifications.created",
      outcome,
      session,
      resource: NOTIFICATIONS_RESOURCE_ID,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para criacao da notificacao.",
      fallbackErrorMessage: "Falha ao criar a notificacao.",
    });
  }
}
