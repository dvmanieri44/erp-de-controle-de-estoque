import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanReadErpResource,
  assertCanWriteErpResource,
} from "@/lib/server/erp-access-control";
import { writeAuditLog } from "@/lib/server/audit-log";
import { readServerSession } from "@/lib/server/auth-session";
import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import {
  createProduct,
  getOperationsProductsPersistenceProvider,
  listProducts,
} from "@/lib/server/operations-products";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

const PRODUCTS_RESOURCE_ID = "operations.products";

function getUnauthorizedResponse() {
  return NextResponse.json(
    { error: "Sessao obrigatoria para acessar o ERP." },
    { status: 401 },
  );
}

async function readJsonBody(request: Request) {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return {};
  }

  return JSON.parse(rawBody) as Record<string, unknown>;
}

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedResponse();
  }

  try {
    assertCanReadErpResource(session, PRODUCTS_RESOURCE_ID);
    const payload = await listProducts();

    return NextResponse.json({
      ...payload,
      provider: getOperationsProductsPersistenceProvider(),
    });
  } catch (error) {
    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: "Falha ao carregar os produtos.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedResponse();
  }

  try {
    assertCanWriteErpResource(session, PRODUCTS_RESOURCE_ID);
    const body = await readJsonBody(request);
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

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "JSON invalido para criacao do produto." },
        { status: 400 },
      );
    }

    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof ErpResourceValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: "Falha ao criar o produto.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}
