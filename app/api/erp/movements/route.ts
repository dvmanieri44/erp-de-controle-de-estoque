import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanReadErpResource,
  assertCanWriteErpResource,
} from "@/lib/server/erp-access-control";
import { writeAuditLog } from "@/lib/server/audit-log";
import { readServerSession } from "@/lib/server/auth-session";
import {
  createInventoryMovement,
  getInventoryMovementInvalidProductIdPayload,
  getInventoryMovementInvalidLotCodePayload,
  getInventoryMovementInvalidLotLocationPayload,
  getInventoryMovementInvalidLotProductPayload,
  getInventoryMovementsPersistenceProvider,
  getInventoryMovementVersionConflictPayload,
  InventoryMovementConflictError,
  InventoryMovementInvalidProductIdError,
  InventoryMovementInvalidLotCodeError,
  InventoryMovementInvalidLotLocationError,
  InventoryMovementInvalidLotProductError,
  listInventoryMovements,
} from "@/lib/server/inventory-movements";
import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

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

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedResponse();
  }

  try {
    assertCanReadErpResource(session, MOVEMENTS_RESOURCE_ID);
    const payload = await listInventoryMovements();

    return NextResponse.json({
      ...payload,
      provider: getInventoryMovementsPersistenceProvider(),
    });
  } catch (error) {
    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: "Falha ao carregar as movimentacoes.",
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
    assertCanWriteErpResource(session, MOVEMENTS_RESOURCE_ID);
    const body = await readJsonBody(request);
    const movement = await createInventoryMovement(body.movement);

    await writeAuditLog({
      category: "erp",
      action: "erp.movement.created",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: null,
        resource: MOVEMENTS_RESOURCE_ID,
      },
      request: requestMetadata,
      metadata: {
        movementId: movement.id,
        version: movement.version,
      },
    });

    return NextResponse.json({ movement }, { status: 201 });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.movement.created",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: null,
        resource: MOVEMENTS_RESOURCE_ID,
      },
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "JSON invalido para criacao da movimentacao." },
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

    if (error instanceof InventoryMovementConflictError) {
      return NextResponse.json(
        getInventoryMovementVersionConflictPayload(error),
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error: "Falha ao criar a movimentacao.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}
