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

function getProductTarget(sku: string) {
  return {
    accountId: null,
    resource: `${PRODUCTS_RESOURCE_ID}:${sku}`,
  };
}

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedResponse();
  }

  try {
    const { sku } = await context.params;
    assertCanReadErpResource(session, PRODUCTS_RESOURCE_ID);
    const product = await getProductBySku(sku);
    return NextResponse.json({ product });
  } catch (error) {
    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof OperationsProductNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: "Falha ao carregar o produto.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedResponse();
  }

  const { sku } = await context.params;

  try {
    assertCanWriteErpResource(session, PRODUCTS_RESOURCE_ID);
    const body = await readJsonBody(request);
    const baseVersion = requireOperationsProductBaseVersion(
      body.baseVersion,
      "atualizar",
    );
    const product = await updateProduct(sku, body.product, baseVersion);

    await writeAuditLog({
      category: "erp",
      action: "erp.product.updated",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getProductTarget(sku),
      request: requestMetadata,
      metadata: {
        version: product.version,
      },
    });

    return NextResponse.json({ product });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.product.updated",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getProductTarget(sku),
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "JSON invalido para atualizacao do produto." },
        { status: 400 },
      );
    }

    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof ErpResourceValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof OperationsProductNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof OperationsProductConflictError) {
      return NextResponse.json(
        getOperationsProductVersionConflictPayload(error),
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error: "Falha ao atualizar o produto.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedResponse();
  }

  const { sku } = await context.params;

  try {
    assertCanWriteErpResource(session, PRODUCTS_RESOURCE_ID);
    const body = await readJsonBody(request);
    const baseVersion = requireOperationsProductBaseVersion(
      body.baseVersion,
      "excluir",
    );
    const deletedProduct = await deleteProduct(sku, baseVersion);

    await writeAuditLog({
      category: "erp",
      action: "erp.product.deleted",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getProductTarget(sku),
      request: requestMetadata,
      metadata: {
        version: deletedProduct.version,
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

    await writeAuditLog({
      category: "erp",
      action: "erp.product.deleted",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getProductTarget(sku),
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "JSON invalido para exclusao do produto." },
        { status: 400 },
      );
    }

    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof ErpResourceValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof OperationsProductNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof OperationsProductConflictError) {
      return NextResponse.json(
        getOperationsProductVersionConflictPayload(error),
        { status: error.status },
      );
    }

    if (error instanceof OperationsProductInUseError) {
      return NextResponse.json(
        {
          error: "PRODUCT_IN_USE",
          reasons: error.reasons,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error: "Falha ao excluir o produto.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}
