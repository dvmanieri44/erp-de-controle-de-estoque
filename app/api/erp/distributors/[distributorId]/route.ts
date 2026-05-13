import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanDeleteErpResource,
  assertCanReadErpResource,
  assertCanUpdateErpResource,
} from "@/lib/server/erp-access-control";
import {
  deleteDistributor,
  DistributorConflictError,
  DistributorNotFoundError,
  getDistributorById,
  getDistributorVersionConflictPayload,
  requireDistributorBaseVersion,
  updateDistributor,
} from "@/lib/server/distributors";
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
    distributorId: string;
  }>;
};

const DISTRIBUTORS_RESOURCE_ID = "operations.distributors";

const getDistributorNotFoundResponse = createStatusMessageErrorHandler(
  (error): error is DistributorNotFoundError =>
    error instanceof DistributorNotFoundError,
);
const getDistributorConflictResponse = createPayloadErrorHandler(
  (error): error is DistributorConflictError =>
    error instanceof DistributorConflictError,
  getDistributorVersionConflictPayload,
);

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    const { distributorId } = await context.params;
    assertCanReadErpResource(session, DISTRIBUTORS_RESOURCE_ID);
    const item = await getDistributorById(distributorId);
    return NextResponse.json({ item });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar o distribuidor.",
      handlers: [getDistributorNotFoundResponse],
    });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { distributorId } = await context.params;

  try {
    assertCanUpdateErpResource(session, DISTRIBUTORS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireDistributorBaseVersion(
      body.baseVersion,
      "atualizar",
    );
    const before = await getDistributorById(distributorId);
    const item = await updateDistributor(distributorId, body.item, {
      baseVersion,
    });

    await writeErpMutationAuditLog({
      action: "erp.distributors.updated",
      session,
      resource: DISTRIBUTORS_RESOURCE_ID,
      entityId: distributorId,
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
      action: "erp.distributors.updated",
      outcome,
      session,
      resource: DISTRIBUTORS_RESOURCE_ID,
      entityId: distributorId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para atualizacao do distribuidor.",
      fallbackErrorMessage: "Falha ao atualizar o distribuidor.",
      handlers: [getDistributorNotFoundResponse, getDistributorConflictResponse],
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { distributorId } = await context.params;

  try {
    assertCanDeleteErpResource(session, DISTRIBUTORS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireDistributorBaseVersion(body.baseVersion, "excluir");
    const before = await getDistributorById(distributorId);
    const deletedItem = await deleteDistributor(distributorId, baseVersion);

    await writeErpMutationAuditLog({
      action: "erp.distributors.deleted",
      session,
      resource: DISTRIBUTORS_RESOURCE_ID,
      entityId: distributorId,
      request: requestMetadata,
      before,
      version: deletedItem.version,
      metadata: {
        deletedAt: deletedItem.deletedAt,
      },
    });

    return NextResponse.json({
      distributorId: deletedItem.id,
      version: deletedItem.version,
      deletedAt: deletedItem.deletedAt,
    });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.distributors.deleted",
      outcome,
      session,
      resource: DISTRIBUTORS_RESOURCE_ID,
      entityId: distributorId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para exclusao do distribuidor.",
      fallbackErrorMessage: "Falha ao excluir o distribuidor.",
      handlers: [getDistributorNotFoundResponse, getDistributorConflictResponse],
    });
  }
}
