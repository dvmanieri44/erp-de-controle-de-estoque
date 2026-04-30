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

function getIncidentTarget(incidentId: string) {
  return {
    accountId: null,
    resource: `${INCIDENTS_RESOURCE_ID}:${incidentId}`,
  };
}

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
    const incident = await updateIncident(incidentId, body.incident, {
      baseVersion,
    });

    await writeAuditLog({
      category: "erp",
      action: "erp.incident.updated",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getIncidentTarget(incidentId),
      request: requestMetadata,
      metadata: {
        version: incident.version,
      },
    });

    return NextResponse.json({ incident });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.incident.updated",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getIncidentTarget(incidentId),
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
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
    const deletedIncident = await deleteIncident(incidentId, baseVersion);

    await writeAuditLog({
      category: "erp",
      action: "erp.incident.deleted",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getIncidentTarget(incidentId),
      request: requestMetadata,
      metadata: {
        version: deletedIncident.version,
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

    await writeAuditLog({
      category: "erp",
      action: "erp.incident.deleted",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getIncidentTarget(incidentId),
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para exclusao do incidente.",
      fallbackErrorMessage: "Falha ao excluir o incidente.",
      handlers: [getIncidentNotFoundResponse, getIncidentConflictResponse],
    });
  }
}
