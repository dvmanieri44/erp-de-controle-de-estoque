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
  deletePlanningItem,
  getPlanningItemById,
  getPlanningVersionConflictPayload,
  PlanningConflictError,
  PlanningNotFoundError,
  requirePlanningBaseVersion,
  updatePlanningItem,
} from "@/lib/server/planning";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    planningId: string;
  }>;
};

const PLANNING_RESOURCE_ID = "operations.planning";

const getPlanningNotFoundResponse = createStatusMessageErrorHandler(
  (error): error is PlanningNotFoundError =>
    error instanceof PlanningNotFoundError,
);
const getPlanningConflictResponse = createPayloadErrorHandler(
  (error): error is PlanningConflictError =>
    error instanceof PlanningConflictError,
  getPlanningVersionConflictPayload,
);

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    const { planningId } = await context.params;
    assertCanReadErpResource(session, PLANNING_RESOURCE_ID);
    const item = await getPlanningItemById(planningId);
    return NextResponse.json({ item });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar o planejamento.",
      handlers: [getPlanningNotFoundResponse],
    });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { planningId } = await context.params;

  try {
    assertCanUpdateErpResource(session, PLANNING_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requirePlanningBaseVersion(
      body.baseVersion,
      "atualizar",
    );
    const before = await getPlanningItemById(planningId);
    const item = await updatePlanningItem(planningId, body.item, {
      baseVersion,
    });

    await writeErpMutationAuditLog({
      action: "erp.planning.updated",
      session,
      resource: PLANNING_RESOURCE_ID,
      entityId: planningId,
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
      action: "erp.planning.updated",
      outcome,
      session,
      resource: PLANNING_RESOURCE_ID,
      entityId: planningId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para atualizacao do planejamento.",
      fallbackErrorMessage: "Falha ao atualizar o planejamento.",
      handlers: [getPlanningNotFoundResponse, getPlanningConflictResponse],
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { planningId } = await context.params;

  try {
    assertCanDeleteErpResource(session, PLANNING_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requirePlanningBaseVersion(body.baseVersion, "excluir");
    const before = await getPlanningItemById(planningId);
    const deletedItem = await deletePlanningItem(planningId, baseVersion);

    await writeErpMutationAuditLog({
      action: "erp.planning.deleted",
      session,
      resource: PLANNING_RESOURCE_ID,
      entityId: planningId,
      request: requestMetadata,
      before,
      version: deletedItem.version,
      metadata: {
        deletedAt: deletedItem.deletedAt,
      },
    });

    return NextResponse.json({
      planningId: deletedItem.id,
      version: deletedItem.version,
      deletedAt: deletedItem.deletedAt,
    });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.planning.deleted",
      outcome,
      session,
      resource: PLANNING_RESOURCE_ID,
      entityId: planningId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para exclusao do planejamento.",
      fallbackErrorMessage: "Falha ao excluir o planejamento.",
      handlers: [getPlanningNotFoundResponse, getPlanningConflictResponse],
    });
  }
}
