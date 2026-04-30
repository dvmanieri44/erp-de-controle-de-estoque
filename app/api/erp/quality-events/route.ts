import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanReadErpResource,
  assertCanWriteErpResource,
} from "@/lib/server/erp-access-control";
import { writeAuditLog } from "@/lib/server/audit-log";
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
    assertCanWriteErpResource(session, QUALITY_EVENTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const event = await createQualityEvent(body.event);

    await writeAuditLog({
      category: "erp",
      action: "erp.quality_event.created",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: null,
        resource: `${QUALITY_EVENTS_RESOURCE_ID}:${event.id}`,
      },
      request: requestMetadata,
      metadata: {
        version: event.version,
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.quality_event.created",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: null,
        resource: QUALITY_EVENTS_RESOURCE_ID,
      },
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para criacao do evento de qualidade.",
      fallbackErrorMessage: "Falha ao criar o evento de qualidade.",
    });
  }
}
