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
  createQualityEvent,
  getQualityEventsPersistenceProvider,
  listQualityEvents,
} from "@/lib/server/quality-events";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

const QUALITY_EVENTS_RESOURCE_ID = "operations.quality-events";

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    assertCanReadErpResource(session, QUALITY_EVENTS_RESOURCE_ID);
    const payload = await listQualityEvents();

    return NextResponse.json({
      ...payload,
      provider: getQualityEventsPersistenceProvider(),
    });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar os eventos de qualidade.",
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
    assertCanCreateErpResource(session, QUALITY_EVENTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const event = await createQualityEvent(body.event);

    await writeErpMutationAuditLog({
      action: "erp.quality_event.created",
      session,
      resource: QUALITY_EVENTS_RESOURCE_ID,
      entityId: event.id,
      request: requestMetadata,
      after: event,
      version: event.version,
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.quality_event.created",
      outcome,
      session,
      resource: QUALITY_EVENTS_RESOURCE_ID,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para criacao do evento de qualidade.",
      fallbackErrorMessage: "Falha ao criar o evento de qualidade.",
    });
  }
}
