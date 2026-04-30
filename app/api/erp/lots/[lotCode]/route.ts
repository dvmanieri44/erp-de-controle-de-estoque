import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanReadErpResource,
  assertCanWriteErpResource,
} from "@/lib/server/erp-access-control";
import { writeAuditLog } from "@/lib/server/audit-log";
import { readServerSession } from "@/lib/server/auth-session";
import {
  createInUseErrorHandler,
  createPayloadErrorHandler,
  createStatusMessageErrorHandler,
  getErpApiErrorResponse,
  getUnauthorizedErpResponse,
  readJsonObjectBody,
} from "@/lib/server/erp-api-errors";
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
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    lotCode: string;
  }>;
};

const LOTS_RESOURCE_ID = "operations.lots";

function getLotTarget(lotCode: string) {
  return {
    accountId: null,
    resource: `${LOTS_RESOURCE_ID}:${lotCode}`,
  };
}

const getLotNotFoundResponse = createStatusMessageErrorHandler(
  (error): error is InventoryLotNotFoundError =>
    error instanceof InventoryLotNotFoundError,
);
const getLotConflictResponse = createPayloadErrorHandler(
  (error): error is InventoryLotConflictError =>
    error instanceof InventoryLotConflictError,
  getInventoryLotVersionConflictPayload,
);
const getLotInUseResponse = createInUseErrorHandler(
  (error): error is InventoryLotInUseError =>
    error instanceof InventoryLotInUseError,
  "LOT_IN_USE",
);

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    const { lotCode } = await context.params;
    assertCanReadErpResource(session, LOTS_RESOURCE_ID);
    const lot = await getLotByCode(lotCode);
    return NextResponse.json({ lot });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar o lote.",
      handlers: [getLotNotFoundResponse],
    });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { lotCode } = await context.params;

  try {
    assertCanWriteErpResource(session, LOTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
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

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para atualizacao do lote.",
      fallbackErrorMessage: "Falha ao atualizar o lote.",
      handlers: [getLotNotFoundResponse, getLotConflictResponse],
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { lotCode } = await context.params;

  try {
    assertCanWriteErpResource(session, LOTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
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

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para exclusao do lote.",
      fallbackErrorMessage: "Falha ao excluir o lote.",
      handlers: [
        getLotNotFoundResponse,
        getLotConflictResponse,
        getLotInUseResponse,
      ],
    });
  }
}
