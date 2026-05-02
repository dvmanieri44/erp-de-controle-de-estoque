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
  deleteIncident,
  getIncidentById,
  getIncidentVersionConflictPayload,
  IncidentConflictError,
  IncidentNotFoundError,
  requireIncidentBaseVersion,
  updateIncident,
} from "@/lib/server/incidents";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    incidentId: string;
  }>;
};

const INCIDENTS_RESOURCE_ID = "operations.incidents";

const getIncidentNotFoundResponse = createStatusMessageErrorHandler(
  (error): error is IncidentNotFoundError =>
    error instanceof IncidentNotFoundError,
);
const getIncidentConflictResponse = createPayloadErrorHandler(
  (error): error is IncidentConflictError =>
    error instanceof IncidentConflictError,
  getIncidentVersionConflictPayload,
);

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    const { incidentId } = await context.params;
    assertCanReadErpResource(session, INCIDENTS_RESOURCE_ID);
    const incident = await getIncidentById(incidentId);
    return NextResponse.json({ incident });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar o incidente.",
      handlers: [getIncidentNotFoundResponse],
    });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { incidentId } = await context.params;

  try {
    assertCanWriteErpResource(session, INCIDENTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireIncidentBaseVersion(
      body.baseVersion,
      "atualizar",
    );
    const before = await getIncidentById(incidentId);
    const incident = await updateIncident(incidentId, body.incident, {
      baseVersion,
    });

    await writeErpMutationAuditLog({
      action: "erp.incident.updated",
      session,
      resource: INCIDENTS_RESOURCE_ID,
      entityId: incidentId,
      request: requestMetadata,
      before,
      after: incident,
      version: incident.version,
    });

    return NextResponse.json({ incident });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.incident.updated",
      outcome,
      session,
      resource: INCIDENTS_RESOURCE_ID,
      entityId: incidentId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para atualizacao do incidente.",
      fallbackErrorMessage: "Falha ao atualizar o incidente.",
      handlers: [getIncidentNotFoundResponse, getIncidentConflictResponse],
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { incidentId } = await context.params;

  try {
    assertCanWriteErpResource(session, INCIDENTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireIncidentBaseVersion(
      body.baseVersion,
      "excluir",
    );
    const before = await getIncidentById(incidentId);
    const deletedIncident = await deleteIncident(incidentId, baseVersion);

    await writeErpMutationAuditLog({
      action: "erp.incident.deleted",
      session,
      resource: INCIDENTS_RESOURCE_ID,
      entityId: incidentId,
      request: requestMetadata,
      before,
      version: deletedIncident.version,
      metadata: {
        deletedAt: deletedIncident.deletedAt,
      },
    });

    return NextResponse.json({
      incidentId: deletedIncident.id,
      version: deletedIncident.version,
      deletedAt: deletedIncident.deletedAt,
    });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.incident.deleted",
      outcome,
      session,
      resource: INCIDENTS_RESOURCE_ID,
      entityId: incidentId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para exclusao do incidente.",
      fallbackErrorMessage: "Falha ao excluir o incidente.",
      handlers: [getIncidentNotFoundResponse, getIncidentConflictResponse],
    });
  }
}
