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
    assertCanUpdateErpResource(session, QUALITY_EVENTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireQualityEventBaseVersion(
      body.baseVersion,
      "atualizar",
    );
    const before = await getQualityEventById(eventId);
    const event = await updateQualityEvent(eventId, body.event, {
      baseVersion,
    });

    await writeErpMutationAuditLog({
      action: "erp.quality_event.updated",
      session,
      resource: QUALITY_EVENTS_RESOURCE_ID,
      entityId: eventId,
      request: requestMetadata,
      before,
      after: event,
      version: event.version,
    });

    return NextResponse.json({ event });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.quality_event.updated",
      outcome,
      session,
      resource: QUALITY_EVENTS_RESOURCE_ID,
      entityId: eventId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
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
    assertCanDeleteErpResource(session, QUALITY_EVENTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireQualityEventBaseVersion(
      body.baseVersion,
      "excluir",
    );
    const before = await getQualityEventById(eventId);
    const deletedEvent = await deleteQualityEvent(eventId, baseVersion);

    await writeErpMutationAuditLog({
      action: "erp.quality_event.deleted",
      session,
      resource: QUALITY_EVENTS_RESOURCE_ID,
      entityId: eventId,
      request: requestMetadata,
      before,
      version: deletedEvent.version,
      metadata: {
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

    await writeErpMutationAuditLog({
      action: "erp.quality_event.deleted",
      outcome,
      session,
      resource: QUALITY_EVENTS_RESOURCE_ID,
      entityId: eventId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
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
