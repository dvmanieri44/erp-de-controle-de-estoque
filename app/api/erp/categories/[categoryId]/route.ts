import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanDeleteErpResource,
  assertCanReadErpResource,
  assertCanUpdateErpResource,
} from "@/lib/server/erp-access-control";
import {
  CategoryConflictError,
  CategoryNotFoundError,
  deleteCategory,
  getCategoryById,
  getCategoryVersionConflictPayload,
  requireCategoryBaseVersion,
  updateCategory,
} from "@/lib/server/categories";
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
    categoryId: string;
  }>;
};

const CATEGORIES_RESOURCE_ID = "operations.categories";

const getCategoryNotFoundResponse = createStatusMessageErrorHandler(
  (error): error is CategoryNotFoundError =>
    error instanceof CategoryNotFoundError,
);
const getCategoryConflictResponse = createPayloadErrorHandler(
  (error): error is CategoryConflictError =>
    error instanceof CategoryConflictError,
  getCategoryVersionConflictPayload,
);

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    const { categoryId } = await context.params;
    assertCanReadErpResource(session, CATEGORIES_RESOURCE_ID);
    const item = await getCategoryById(categoryId);
    return NextResponse.json({ item });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar a categoria.",
      handlers: [getCategoryNotFoundResponse],
    });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { categoryId } = await context.params;

  try {
    assertCanUpdateErpResource(session, CATEGORIES_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireCategoryBaseVersion(
      body.baseVersion,
      "atualizar",
    );
    const before = await getCategoryById(categoryId);
    const item = await updateCategory(categoryId, body.item, {
      baseVersion,
    });

    await writeErpMutationAuditLog({
      action: "erp.categories.updated",
      session,
      resource: CATEGORIES_RESOURCE_ID,
      entityId: categoryId,
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
      action: "erp.categories.updated",
      outcome,
      session,
      resource: CATEGORIES_RESOURCE_ID,
      entityId: categoryId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para atualizacao da categoria.",
      fallbackErrorMessage: "Falha ao atualizar a categoria.",
      handlers: [getCategoryNotFoundResponse, getCategoryConflictResponse],
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { categoryId } = await context.params;

  try {
    assertCanDeleteErpResource(session, CATEGORIES_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireCategoryBaseVersion(body.baseVersion, "excluir");
    const before = await getCategoryById(categoryId);
    const deletedItem = await deleteCategory(categoryId, baseVersion);

    await writeErpMutationAuditLog({
      action: "erp.categories.deleted",
      session,
      resource: CATEGORIES_RESOURCE_ID,
      entityId: categoryId,
      request: requestMetadata,
      before,
      version: deletedItem.version,
      metadata: {
        deletedAt: deletedItem.deletedAt,
      },
    });

    return NextResponse.json({
      categoryId: deletedItem.id,
      version: deletedItem.version,
      deletedAt: deletedItem.deletedAt,
    });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.categories.deleted",
      outcome,
      session,
      resource: CATEGORIES_RESOURCE_ID,
      entityId: categoryId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para exclusao da categoria.",
      fallbackErrorMessage: "Falha ao excluir a categoria.",
      handlers: [getCategoryNotFoundResponse, getCategoryConflictResponse],
    });
  }
}
