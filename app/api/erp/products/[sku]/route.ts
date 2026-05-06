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
  createInUseErrorHandler,
  createPayloadErrorHandler,
  createStatusMessageErrorHandler,
  getErpApiErrorResponse,
  getUnauthorizedErpResponse,
  readJsonObjectBody,
} from "@/lib/server/erp-api-errors";
import {
  deleteProduct,
  getOperationsProductVersionConflictPayload,
  getProductBySku,
  OperationsProductConflictError,
  OperationsProductInUseError,
  OperationsProductNotFoundError,
  requireOperationsProductBaseVersion,
  updateProduct,
} from "@/lib/server/operations-products";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    sku: string;
  }>;
};

const PRODUCTS_RESOURCE_ID = "operations.products";

const getProductNotFoundResponse = createStatusMessageErrorHandler(
  (error): error is OperationsProductNotFoundError =>
    error instanceof OperationsProductNotFoundError,
);
const getProductConflictResponse = createPayloadErrorHandler(
  (error): error is OperationsProductConflictError =>
    error instanceof OperationsProductConflictError,
  getOperationsProductVersionConflictPayload,
);
const getProductInUseResponse = createInUseErrorHandler(
  (error): error is OperationsProductInUseError =>
    error instanceof OperationsProductInUseError,
  "PRODUCT_IN_USE",
);

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    const { sku } = await context.params;
    assertCanReadErpResource(session, PRODUCTS_RESOURCE_ID);
    const product = await getProductBySku(sku);
    return NextResponse.json({ product });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar o produto.",
      handlers: [getProductNotFoundResponse],
    });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { sku } = await context.params;

  try {
    assertCanUpdateErpResource(session, PRODUCTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireOperationsProductBaseVersion(
      body.baseVersion,
      "atualizar",
    );
    const before = await getProductBySku(sku);
    const product = await updateProduct(sku, body.product, baseVersion);

    await writeErpMutationAuditLog({
      action: "erp.product.updated",
      session,
      resource: PRODUCTS_RESOURCE_ID,
      entityId: sku,
      request: requestMetadata,
      before,
      after: product,
      version: product.version,
    });

    return NextResponse.json({ product });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.product.updated",
      outcome,
      session,
      resource: PRODUCTS_RESOURCE_ID,
      entityId: sku,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para atualizacao do produto.",
      fallbackErrorMessage: "Falha ao atualizar o produto.",
      handlers: [getProductNotFoundResponse, getProductConflictResponse],
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { sku } = await context.params;

  try {
    assertCanDeleteErpResource(session, PRODUCTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireOperationsProductBaseVersion(
      body.baseVersion,
      "excluir",
    );
    const before = await getProductBySku(sku);
    const deletedProduct = await deleteProduct(sku, baseVersion);

    await writeErpMutationAuditLog({
      action: "erp.product.deleted",
      session,
      resource: PRODUCTS_RESOURCE_ID,
      entityId: sku,
      request: requestMetadata,
      before,
      version: deletedProduct.version,
      metadata: {
        deletedAt: deletedProduct.deletedAt,
      },
    });

    return NextResponse.json({
      sku: deletedProduct.sku,
      version: deletedProduct.version,
      deletedAt: deletedProduct.deletedAt,
    });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.product.deleted",
      outcome,
      session,
      resource: PRODUCTS_RESOURCE_ID,
      entityId: sku,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para exclusao do produto.",
      fallbackErrorMessage: "Falha ao excluir o produto.",
      handlers: [
        getProductNotFoundResponse,
        getProductConflictResponse,
        getProductInUseResponse,
      ],
    });
  }
}
