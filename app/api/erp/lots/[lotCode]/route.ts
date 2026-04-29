import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanReadErpResource,
  assertCanWriteErpResource,
} from "@/lib/server/erp-access-control";
import { writeAuditLog } from "@/lib/server/audit-log";
import { readServerSession } from "@/lib/server/auth-session";
import {
  deleteLot,
  getLotByCode,
  getInventoryLotVersionConflictPayload,
  InventoryLotConflictError,
  InventoryLotInUseError,
  InventoryLotNotFoundError,
  requireInventoryLotBaseVersion,
  updateLot,
} from "@/lib/server/inventory-lots";
import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    lotCode: string;
  }>;
};

const LOTS_RESOURCE_ID = "operations.lots";

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

function getLotTarget(lotCode: string) {
  return {
    accountId: null,
    resource: `${LOTS_RESOURCE_ID}:${lotCode}`,
  };
}

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedResponse();
  }

  try {
    const { lotCode } = await context.params;
    assertCanReadErpResource(session, LOTS_RESOURCE_ID);
    const lot = await getLotByCode(lotCode);
    return NextResponse.json({ lot });
  } catch (error) {
    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof InventoryLotNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: "Falha ao carregar o lote.",
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

  const { lotCode } = await context.params;

  try {
    assertCanWriteErpResource(session, LOTS_RESOURCE_ID);
    const body = await readJsonBody(request);
    const baseVersion = requireInventoryLotBaseVersion(
      body.baseVersion,
      "atualizar",
    );
    const lot = await updateLot(
      lotCode,
      body.lot,
      { baseVersion },
    );

    await writeAuditLog({
      category: "erp",
      action: "erp.lot.updated",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getLotTarget(lotCode),
      request: requestMetadata,
      metadata: {
        version: lot.version,
      },
    });

    return NextResponse.json({ lot });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.lot.updated",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getLotTarget(lotCode),
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "JSON invalido para atualizacao do lote." },
        { status: 400 },
      );
    }

    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof ErpResourceValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof InventoryLotNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof InventoryLotConflictError) {
      return NextResponse.json(
        getInventoryLotVersionConflictPayload(error),
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error: "Falha ao atualizar o lote.",
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

  const { lotCode } = await context.params;

  try {
    assertCanWriteErpResource(session, LOTS_RESOURCE_ID);
    const body = await readJsonBody(request);
    const baseVersion = requireInventoryLotBaseVersion(
      body.baseVersion,
      "excluir",
    );
    const deletedLot = await deleteLot(lotCode, baseVersion);

    await writeAuditLog({
      category: "erp",
      action: "erp.lot.deleted",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getLotTarget(lotCode),
      request: requestMetadata,
      metadata: {
        version: deletedLot.version,
        deletedAt: deletedLot.deletedAt,
      },
    });

    return NextResponse.json({
      lotCode: deletedLot.code,
      version: deletedLot.version,
      deletedAt: deletedLot.deletedAt,
    });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.lot.deleted",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getLotTarget(lotCode),
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "JSON invalido para exclusao do lote." },
        { status: 400 },
      );
    }

    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof ErpResourceValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof InventoryLotNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof InventoryLotConflictError) {
      return NextResponse.json(
        getInventoryLotVersionConflictPayload(error),
        { status: error.status },
      );
    }

    if (error instanceof InventoryLotInUseError) {
      return NextResponse.json(
        {
          error: "LOT_IN_USE",
          reasons: error.reasons,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error: "Falha ao excluir o lote.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}
