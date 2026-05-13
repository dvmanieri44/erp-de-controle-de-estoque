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
  createCalendarEvent,
  getCalendarEventsPersistenceProvider,
  listCalendarEvents,
} from "@/lib/server/calendar";
import {
  getErpApiErrorResponse,
  getUnauthorizedErpResponse,
  readJsonObjectBody,
} from "@/lib/server/erp-api-errors";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

const CALENDAR_RESOURCE_ID = "operations.calendar";

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    assertCanReadErpResource(session, CALENDAR_RESOURCE_ID);
    const payload = await listCalendarEvents();

    return NextResponse.json({
      ...payload,
      provider: getCalendarEventsPersistenceProvider(),
    });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar os eventos do calendario.",
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
    assertCanCreateErpResource(session, CALENDAR_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const item = await createCalendarEvent(body.item);

    await writeErpMutationAuditLog({
      action: "erp.calendar.created",
      session,
      resource: CALENDAR_RESOURCE_ID,
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
      action: "erp.calendar.created",
      outcome,
      session,
      resource: CALENDAR_RESOURCE_ID,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para criacao do evento do calendario.",
      fallbackErrorMessage: "Falha ao criar o evento do calendario.",
    });
  }
}
