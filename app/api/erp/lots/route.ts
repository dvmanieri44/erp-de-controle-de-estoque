import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanCreateErpResource,
  assertCanReadErpResource,
} from "@/lib/server/erp-access-control";
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
import {
  createLot,
  getInventoryLotsPersistenceProvider,
  listLots,
} from "@/lib/server/inventory-lots";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

const LOTS_RESOURCE_ID = "operations.lots";

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    assertCanReadErpResource(session, LOTS_RESOURCE_ID);
    const payload = await listLots();

    return NextResponse.json({
      ...payload,
      provider: getInventoryLotsPersistenceProvider(),
    });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar os lotes.",
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
    assertCanCreateErpResource(session, LOTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const lot = await createLot(body.lot);

    await writeErpMutationAuditLog({
      action: "erp.lot.created",
      session,
      resource: LOTS_RESOURCE_ID,
      entityId: lot.code,
      request: requestMetadata,
      after: lot,
      version: lot.version,
    });

    return NextResponse.json({ lot }, { status: 201 });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.lot.created",
      outcome,
      session,
      resource: LOTS_RESOURCE_ID,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para criacao do lote.",
      fallbackErrorMessage: "Falha ao criar o lote.",
    });
  }
}
