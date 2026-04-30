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
  deleteQualityEvent,
  getQualityEventById,
  getQualityEventVersionConflictPayload,
  QualityEventConflictError,
  QualityEventNotFoundError,
  requireQualityEventBaseVersion,
  updateQualityEvent,
} from "@/lib/server/quality-events";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

const QUALITY_EVENTS_RESOURCE_ID = "operations.quality-events";

function getQualityEventTarget(eventId: string) {
  return {
    accountId: null,
    resource: `${QUALITY_EVENTS_RESOURCE_ID}:${eventId}`,
  };
}

const getQualityEventNotFoundResponse = createStatusMessageErrorHandler(
  (error): error is QualityEventNotFoundError =>
    error instanceof QualityEventNotFoundError,
);
const getQualityEventConflictResponse = createPayloadErrorHandler(
  (error): error is QualityEventConflictError =>
    error instanceof QualityEventConflictError,
  getQualityEventVersionConflictPayload,
);

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    const { eventId } = await context.params;
    assertCanReadErpResource(session, QUALITY_EVENTS_RESOURCE_ID);
    const event = await getQualityEventById(eventId);
    return NextResponse.json({ event });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar o evento de qualidade.",
      handlers: [getQualityEventNotFoundResponse],
    });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { eventId } = await context.params;

  try {
    assertCanWriteErpResource(session, QUALITY_EVENTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireQualityEventBaseVersion(
      body.baseVersion,
      "atualizar",
    );
    const event = await updateQualityEvent(eventId, body.event, {
      baseVersion,
    });

    await writeAuditLog({
      category: "erp",
      action: "erp.quality_event.updated",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getQualityEventTarget(eventId),
      request: requestMetadata,
      metadata: {
        version: event.version,
      },
    });

    return NextResponse.json({ event });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.quality_event.updated",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getQualityEventTarget(eventId),
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para atualizacao do evento de qualidade.",
      fallbackErrorMessage: "Falha ao atualizar o evento de qualidade.",
      handlers: [
        getQualityEventNotFoundResponse,
        getQualityEventConflictResponse,
      ],
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { eventId } = await context.params;

  try {
    assertCanWriteErpResource(session, QUALITY_EVENTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireQualityEventBaseVersion(
      body.baseVersion,
      "excluir",
    );
    const deletedEvent = await deleteQualityEvent(eventId, baseVersion);

    await writeAuditLog({
      category: "erp",
      action: "erp.quality_event.deleted",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getQualityEventTarget(eventId),
      request: requestMetadata,
      metadata: {
        version: deletedEvent.version,
        deletedAt: deletedEvent.deletedAt,
      },
    });

    return NextResponse.json({
      eventId: deletedEvent.id,
      version: deletedEvent.version,
      deletedAt: deletedEvent.deletedAt,
    });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.quality_event.deleted",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getQualityEventTarget(eventId),
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para exclusao do evento de qualidade.",
      fallbackErrorMessage: "Falha ao excluir o evento de qualidade.",
      handlers: [
        getQualityEventNotFoundResponse,
        getQualityEventConflictResponse,
      ],
    });
  }
}
