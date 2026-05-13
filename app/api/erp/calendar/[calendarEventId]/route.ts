import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanDeleteErpResource,
  assertCanReadErpResource,
  assertCanUpdateErpResource,
} from "@/lib/server/erp-access-control";
import {
  CalendarConflictError,
  CalendarNotFoundError,
  deleteCalendarEvent,
  getCalendarEventById,
  getCalendarVersionConflictPayload,
  requireCalendarBaseVersion,
  updateCalendarEvent,
} from "@/lib/server/calendar";
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
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    calendarEventId: string;
  }>;
};

const CALENDAR_RESOURCE_ID = "operations.calendar";

const getCalendarNotFoundResponse = createStatusMessageErrorHandler(
  (error): error is CalendarNotFoundError =>
    error instanceof CalendarNotFoundError,
);
const getCalendarConflictResponse = createPayloadErrorHandler(
  (error): error is CalendarConflictError =>
    error instanceof CalendarConflictError,
  getCalendarVersionConflictPayload,
);

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    const { calendarEventId } = await context.params;
    assertCanReadErpResource(session, CALENDAR_RESOURCE_ID);
    const item = await getCalendarEventById(calendarEventId);
    return NextResponse.json({ item });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar o evento do calendario.",
      handlers: [getCalendarNotFoundResponse],
    });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { calendarEventId } = await context.params;

  try {
    assertCanUpdateErpResource(session, CALENDAR_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireCalendarBaseVersion(
      body.baseVersion,
      "atualizar",
    );
    const before = await getCalendarEventById(calendarEventId);
    const item = await updateCalendarEvent(calendarEventId, body.item, {
      baseVersion,
    });

    await writeErpMutationAuditLog({
      action: "erp.calendar.updated",
      session,
      resource: CALENDAR_RESOURCE_ID,
      entityId: calendarEventId,
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
      action: "erp.calendar.updated",
      outcome,
      session,
      resource: CALENDAR_RESOURCE_ID,
      entityId: calendarEventId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage:
        "JSON invalido para atualizacao do evento do calendario.",
      fallbackErrorMessage: "Falha ao atualizar o evento do calendario.",
      handlers: [getCalendarNotFoundResponse, getCalendarConflictResponse],
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { calendarEventId } = await context.params;

  try {
    assertCanDeleteErpResource(session, CALENDAR_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireCalendarBaseVersion(body.baseVersion, "excluir");
    const before = await getCalendarEventById(calendarEventId);
    const deletedItem = await deleteCalendarEvent(calendarEventId, baseVersion);

    await writeErpMutationAuditLog({
      action: "erp.calendar.deleted",
      session,
      resource: CALENDAR_RESOURCE_ID,
      entityId: calendarEventId,
      request: requestMetadata,
      before,
      version: deletedItem.version,
      metadata: {
        deletedAt: deletedItem.deletedAt,
      },
    });

    return NextResponse.json({
      calendarEventId: deletedItem.id,
      version: deletedItem.version,
      deletedAt: deletedItem.deletedAt,
    });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.calendar.deleted",
      outcome,
      session,
      resource: CALENDAR_RESOURCE_ID,
      entityId: calendarEventId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage:
        "JSON invalido para exclusao do evento do calendario.",
      fallbackErrorMessage: "Falha ao excluir o evento do calendario.",
      handlers: [getCalendarNotFoundResponse, getCalendarConflictResponse],
    });
  }
}
