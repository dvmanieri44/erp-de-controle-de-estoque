import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanReadErpResource,
  assertCanWriteErpResource,
} from "@/lib/server/erp-access-control";
import { writeAuditLog } from "@/lib/server/audit-log";
import { readServerSession } from "@/lib/server/auth-session";
import {
  createPayloadErrorHandler,
  getErpApiErrorResponse,
  getUnauthorizedErpResponse,
  readJsonObjectBody,
} from "@/lib/server/erp-api-errors";
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
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

const MOVEMENTS_RESOURCE_ID = "inventory.movements";

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    assertCanReadErpResource(session, MOVEMENTS_RESOURCE_ID);
    const payload = await listInventoryMovements();

    return NextResponse.json({
      ...payload,
      provider: getInventoryMovementsPersistenceProvider(),
    });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar as movimentacoes.",
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
    assertCanWriteErpResource(session, MOVEMENTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
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

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para criacao da movimentacao.",
      fallbackErrorMessage: "Falha ao criar a movimentacao.",
      handlers: [
        createPayloadErrorHandler(
          (error): error is InventoryMovementInvalidProductIdError =>
            error instanceof InventoryMovementInvalidProductIdError,
          () => getInventoryMovementInvalidProductIdPayload(),
        ),
        createPayloadErrorHandler(
          (error): error is InventoryMovementInvalidLotCodeError =>
            error instanceof InventoryMovementInvalidLotCodeError,
          () => getInventoryMovementInvalidLotCodePayload(),
        ),
        createPayloadErrorHandler(
          (error): error is InventoryMovementInvalidLotProductError =>
            error instanceof InventoryMovementInvalidLotProductError,
          () => getInventoryMovementInvalidLotProductPayload(),
        ),
        createPayloadErrorHandler(
          (error): error is InventoryMovementInvalidLotLocationError =>
            error instanceof InventoryMovementInvalidLotLocationError,
          () => getInventoryMovementInvalidLotLocationPayload(),
        ),
        createPayloadErrorHandler(
          (error): error is InventoryMovementConflictError =>
            error instanceof InventoryMovementConflictError,
          getInventoryMovementVersionConflictPayload,
        ),
      ],
    });
  }
}
