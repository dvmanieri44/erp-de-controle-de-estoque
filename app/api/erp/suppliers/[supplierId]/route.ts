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
import { getRequestMetadata } from "@/lib/server/request-metadata";
import {
  deleteSupplier,
  getSupplierById,
  getSupplierVersionConflictPayload,
  requireSupplierBaseVersion,
  SupplierConflictError,
  SupplierNotFoundError,
  updateSupplier,
} from "@/lib/server/suppliers";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    supplierId: string;
  }>;
};

const SUPPLIERS_RESOURCE_ID = "operations.suppliers";

const getSupplierNotFoundResponse = createStatusMessageErrorHandler(
  (error): error is SupplierNotFoundError =>
    error instanceof SupplierNotFoundError,
);
const getSupplierConflictResponse = createPayloadErrorHandler(
  (error): error is SupplierConflictError =>
    error instanceof SupplierConflictError,
  getSupplierVersionConflictPayload,
);

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    const { supplierId } = await context.params;
    assertCanReadErpResource(session, SUPPLIERS_RESOURCE_ID);
    const item = await getSupplierById(supplierId);
    return NextResponse.json({ item });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar o fornecedor.",
      handlers: [getSupplierNotFoundResponse],
    });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { supplierId } = await context.params;

  try {
    assertCanUpdateErpResource(session, SUPPLIERS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireSupplierBaseVersion(body.baseVersion, "atualizar");
    const before = await getSupplierById(supplierId);
    const item = await updateSupplier(supplierId, body.item, {
      baseVersion,
    });

    await writeErpMutationAuditLog({
      action: "erp.suppliers.updated",
      session,
      resource: SUPPLIERS_RESOURCE_ID,
      entityId: supplierId,
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
      action: "erp.suppliers.updated",
      outcome,
      session,
      resource: SUPPLIERS_RESOURCE_ID,
      entityId: supplierId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para atualizacao do fornecedor.",
      fallbackErrorMessage: "Falha ao atualizar o fornecedor.",
      handlers: [getSupplierNotFoundResponse, getSupplierConflictResponse],
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { supplierId } = await context.params;

  try {
    assertCanDeleteErpResource(session, SUPPLIERS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireSupplierBaseVersion(body.baseVersion, "excluir");
    const before = await getSupplierById(supplierId);
    const deletedItem = await deleteSupplier(supplierId, baseVersion);

    await writeErpMutationAuditLog({
      action: "erp.suppliers.deleted",
      session,
      resource: SUPPLIERS_RESOURCE_ID,
      entityId: supplierId,
      request: requestMetadata,
      before,
      version: deletedItem.version,
      metadata: {
        deletedAt: deletedItem.deletedAt,
      },
    });

    return NextResponse.json({
      supplierId: deletedItem.id,
      version: deletedItem.version,
      deletedAt: deletedItem.deletedAt,
    });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.suppliers.deleted",
      outcome,
      session,
      resource: SUPPLIERS_RESOURCE_ID,
      entityId: supplierId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para exclusao do fornecedor.",
      fallbackErrorMessage: "Falha ao excluir o fornecedor.",
      handlers: [getSupplierNotFoundResponse, getSupplierConflictResponse],
    });
  }
}
