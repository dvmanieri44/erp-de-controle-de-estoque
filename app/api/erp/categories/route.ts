import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanCreateErpResource,
  assertCanReadErpResource,
} from "@/lib/server/erp-access-control";
import {
  createCategory,
  getCategoriesPersistenceProvider,
  listCategories,
} from "@/lib/server/categories";
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
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

const CATEGORIES_RESOURCE_ID = "operations.categories";

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    assertCanReadErpResource(session, CATEGORIES_RESOURCE_ID);
    const payload = await listCategories();

    return NextResponse.json({
      ...payload,
      provider: getCategoriesPersistenceProvider(),
    });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar as categorias.",
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
    assertCanCreateErpResource(session, CATEGORIES_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const item = await createCategory(body.item);

    await writeErpMutationAuditLog({
      action: "erp.categories.created",
      session,
      resource: CATEGORIES_RESOURCE_ID,
      entityId: item.id,
      request: requestMetadata,
      after: item,
      version: item.version,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.categories.created",
      outcome,
      session,
      resource: CATEGORIES_RESOURCE_ID,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para criacao da categoria.",
      fallbackErrorMessage: "Falha ao criar a categoria.",
    });
  }
}
