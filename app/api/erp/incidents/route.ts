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
  createIncident,
  getIncidentsPersistenceProvider,
  listIncidents,
} from "@/lib/server/incidents";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

const INCIDENTS_RESOURCE_ID = "operations.incidents";

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    assertCanReadErpResource(session, INCIDENTS_RESOURCE_ID);
    const payload = await listIncidents();

    return NextResponse.json({
      ...payload,
      provider: getIncidentsPersistenceProvider(),
    });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar os incidentes.",
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
    assertCanCreateErpResource(session, INCIDENTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const incident = await createIncident(body.incident);

    await writeErpMutationAuditLog({
      action: "erp.incident.created",
      session,
      resource: INCIDENTS_RESOURCE_ID,
      entityId: incident.id,
      request: requestMetadata,
      after: incident,
      version: incident.version,
    });

    return NextResponse.json({ incident }, { status: 201 });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.incident.created",
      outcome,
      session,
      resource: INCIDENTS_RESOURCE_ID,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para criacao do incidente.",
      fallbackErrorMessage: "Falha ao criar o incidente.",
    });
  }
}
