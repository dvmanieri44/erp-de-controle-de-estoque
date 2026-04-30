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
  createProduct,
  getOperationsProductsPersistenceProvider,
  listProducts,
} from "@/lib/server/operations-products";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

const PRODUCTS_RESOURCE_ID = "operations.products";

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    assertCanReadErpResource(session, PRODUCTS_RESOURCE_ID);
    const payload = await listProducts();

    return NextResponse.json({
      ...payload,
      provider: getOperationsProductsPersistenceProvider(),
    });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar os produtos.",
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
    assertCanWriteErpResource(session, PRODUCTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const product = await createProduct(body.product);

    await writeAuditLog({
      category: "erp",
      action: "erp.product.created",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: null,
        resource: `${PRODUCTS_RESOURCE_ID}:${product.sku}`,
      },
      request: requestMetadata,
      metadata: {
        version: product.version,
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.product.created",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: null,
        resource: PRODUCTS_RESOURCE_ID,
      },
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para criacao do produto.",
      fallbackErrorMessage: "Falha ao criar o produto.",
    });
  }
}
