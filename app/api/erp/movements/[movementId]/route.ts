import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanReadErpResource,
  assertCanWriteErpResource,
} from "@/lib/server/erp-access-control";
import { writeAuditLog } from "@/lib/server/audit-log";
import { readServerSession } from "@/lib/server/auth-session";
import {
  deleteOrCancelInventoryMovement,
  getInventoryMovementById,
  getInventoryMovementInvalidProductIdPayload,
  getInventoryMovementInvalidLotCodePayload,
  getInventoryMovementInvalidLotLocationPayload,
  getInventoryMovementInvalidLotProductPayload,
  getInventoryMovementVersionConflictPayload,
  InventoryMovementConflictError,
  InventoryMovementInvalidProductIdError,
  InventoryMovementInvalidLotCodeError,
  InventoryMovementInvalidLotLocationError,
  InventoryMovementInvalidLotProductError,
  InventoryMovementNotFoundError,
  requireInventoryMovementBaseVersion,
  updateInventoryMovement,
} from "@/lib/server/inventory-movements";
import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    movementId: string;
  }>;
};

const MOVEMENTS_RESOURCE_ID = "inventory.movements";

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

function parseDeleteMode(request: Request, body: Record<string, unknown>) {
  const url = new URL(request.url);
  const queryMode = url.searchParams.get("mode");
  const bodyMode = typeof body.mode === "string" ? body.mode : null;
  const mode = bodyMode ?? queryMode ?? "delete";

  if (mode !== "delete" && mode !== "cancel") {
    throw new ErpResourceValidationError(
      "Modo invalido para exclusao da movimentacao.",
    );
  }

  return mode;
}

function getMovementTarget(movementId: string) {
  return {
    accountId: null,
    resource: `${MOVEMENTS_RESOURCE_ID}:${movementId}`,
  };
}

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedResponse();
  }

  try {
    const { movementId } = await context.params;
    assertCanReadErpResource(session, MOVEMENTS_RESOURCE_ID);
    const movement = await getInventoryMovementById(movementId);
    return NextResponse.json({ movement });
  } catch (error) {
    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof InventoryMovementNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: "Falha ao carregar a movimentacao.",
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

  const { movementId } = await context.params;

  try {
    assertCanWriteErpResource(session, MOVEMENTS_RESOURCE_ID);
    const body = await readJsonBody(request);
    const baseVersion = requireInventoryMovementBaseVersion(
      body.baseVersion,
      "atualizar",
    );

    const movement = await updateInventoryMovement(
      movementId,
      body.movement,
      { baseVersion },
    );

    await writeAuditLog({
      category: "erp",
      action: "erp.movement.updated",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getMovementTarget(movementId),
      request: requestMetadata,
      metadata: {
        version: movement.version,
      },
    });

    return NextResponse.json({ movement });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.movement.updated",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getMovementTarget(movementId),
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "JSON invalido para atualizacao da movimentacao." },
        { status: 400 },
      );
    }

    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof ErpResourceValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof InventoryMovementInvalidProductIdError) {
      return NextResponse.json(
        getInventoryMovementInvalidProductIdPayload(),
        { status: error.status },
      );
    }

    if (error instanceof InventoryMovementInvalidLotCodeError) {
      return NextResponse.json(
        getInventoryMovementInvalidLotCodePayload(),
        { status: error.status },
      );
    }

    if (error instanceof InventoryMovementInvalidLotProductError) {
      return NextResponse.json(
        getInventoryMovementInvalidLotProductPayload(),
        { status: error.status },
      );
    }

    if (error instanceof InventoryMovementInvalidLotLocationError) {
      return NextResponse.json(
        getInventoryMovementInvalidLotLocationPayload(),
        { status: error.status },
      );
    }

    if (error instanceof InventoryMovementNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof InventoryMovementConflictError) {
      return NextResponse.json(
        getInventoryMovementVersionConflictPayload(error),
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error: "Falha ao atualizar a movimentacao.",
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

  const { movementId } = await context.params;

  try {
    assertCanWriteErpResource(session, MOVEMENTS_RESOURCE_ID);
    const body = await readJsonBody(request);
    const baseVersion = requireInventoryMovementBaseVersion(
      body.baseVersion,
      "excluir ou cancelar",
    );

    const mode = parseDeleteMode(request, body);
    const movement = await deleteOrCancelInventoryMovement(movementId, {
      baseVersion,
      mode,
    });

    await writeAuditLog({
      category: "erp",
      action:
        mode === "cancel"
          ? "erp.movement.cancelled"
          : "erp.movement.deleted",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getMovementTarget(movementId),
      request: requestMetadata,
      metadata: {
        mode,
        version: movement?.version ?? null,
      },
    });

    return NextResponse.json(
      mode === "cancel"
        ? {
            cancelled: true,
            movement,
          }
        : {
            deleted: true,
            movementId,
          },
    );
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.movement.deleted",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getMovementTarget(movementId),
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "JSON invalido para exclusao da movimentacao." },
        { status: 400 },
      );
    }

    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof ErpResourceValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof InventoryMovementNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof InventoryMovementConflictError) {
      return NextResponse.json(
        getInventoryMovementVersionConflictPayload(error),
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error: "Falha ao excluir ou cancelar a movimentacao.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}
