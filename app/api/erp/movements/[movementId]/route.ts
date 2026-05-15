import { NextResponse } from "next/server";

import {
  assertCanCancelErpResource,
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
  createPayloadErrorHandler,
  createStatusMessageErrorHandler,
  getErpApiErrorResponse,
  getUnauthorizedErpResponse,
  readJsonObjectBody,
} from "@/lib/server/erp-api-errors";
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

const getMovementInvalidProductIdResponse = createPayloadErrorHandler(
  (error): error is InventoryMovementInvalidProductIdError =>
    error instanceof InventoryMovementInvalidProductIdError,
  () => getInventoryMovementInvalidProductIdPayload(),
);
const getMovementInvalidLotCodeResponse = createPayloadErrorHandler(
  (error): error is InventoryMovementInvalidLotCodeError =>
    error instanceof InventoryMovementInvalidLotCodeError,
  () => getInventoryMovementInvalidLotCodePayload(),
);
const getMovementInvalidLotProductResponse = createPayloadErrorHandler(
  (error): error is InventoryMovementInvalidLotProductError =>
    error instanceof InventoryMovementInvalidLotProductError,
  () => getInventoryMovementInvalidLotProductPayload(),
);
const getMovementInvalidLotLocationResponse = createPayloadErrorHandler(
  (error): error is InventoryMovementInvalidLotLocationError =>
    error instanceof InventoryMovementInvalidLotLocationError,
  () => getInventoryMovementInvalidLotLocationPayload(),
);
const getMovementNotFoundResponse = createStatusMessageErrorHandler(
  (error): error is InventoryMovementNotFoundError =>
    error instanceof InventoryMovementNotFoundError,
);
const getMovementConflictResponse = createPayloadErrorHandler(
  (error): error is InventoryMovementConflictError =>
    error instanceof InventoryMovementConflictError,
  getInventoryMovementVersionConflictPayload,
);

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    const { movementId } = await context.params;
    assertCanReadErpResource(session, MOVEMENTS_RESOURCE_ID);
    const movement = await getInventoryMovementById(movementId);
    return NextResponse.json({ movement });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar a movimentacao.",
      handlers: [getMovementNotFoundResponse],
    });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { movementId } = await context.params;

  try {
    assertCanUpdateErpResource(session, MOVEMENTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireInventoryMovementBaseVersion(
      body.baseVersion,
      "atualizar",
    );

    const before = await getInventoryMovementById(movementId);
    const movement = await updateInventoryMovement(
      movementId,
      body.movement,
      { baseVersion },
    );

    await writeErpMutationAuditLog({
      action: "erp.movement.updated",
      session,
      resource: MOVEMENTS_RESOURCE_ID,
      entityId: movementId,
      request: requestMetadata,
      before,
      after: movement,
      version: movement.version,
    });

    return NextResponse.json({ movement });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.movement.updated",
      outcome,
      session,
      resource: MOVEMENTS_RESOURCE_ID,
      entityId: movementId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para atualizacao da movimentacao.",
      fallbackErrorMessage: "Falha ao atualizar a movimentacao.",
      handlers: [
        getMovementInvalidProductIdResponse,
        getMovementInvalidLotCodeResponse,
        getMovementInvalidLotProductResponse,
        getMovementInvalidLotLocationResponse,
        getMovementNotFoundResponse,
        getMovementConflictResponse,
      ],
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { movementId } = await context.params;

  try {
    const body = await readJsonObjectBody(request);
    const baseVersion = requireInventoryMovementBaseVersion(
      body.baseVersion,
      "excluir ou cancelar",
    );

    const mode = parseDeleteMode(request, body);
    if (mode === "cancel") {
      assertCanCancelErpResource(session, MOVEMENTS_RESOURCE_ID);
    } else {
      assertCanDeleteErpResource(session, MOVEMENTS_RESOURCE_ID);
    }

    const before = await getInventoryMovementById(movementId);
    const movement = await deleteOrCancelInventoryMovement(movementId, {
      baseVersion,
      mode,
    });

    await writeErpMutationAuditLog({
      action:
        mode === "cancel"
          ? "erp.movement.cancelled"
          : "erp.movement.deleted",
      session,
      resource: MOVEMENTS_RESOURCE_ID,
      entityId: movementId,
      request: requestMetadata,
      before,
      after: mode === "cancel" ? movement : null,
      version: movement?.version ?? before?.version ?? null,
      metadata: {
        mode,
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

    await writeErpMutationAuditLog({
      action: "erp.movement.deleted",
      outcome,
      session,
      resource: MOVEMENTS_RESOURCE_ID,
      entityId: movementId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para exclusao da movimentacao.",
      fallbackErrorMessage: "Falha ao excluir ou cancelar a movimentacao.",
      handlers: [getMovementNotFoundResponse, getMovementConflictResponse],
    });
  }
}
