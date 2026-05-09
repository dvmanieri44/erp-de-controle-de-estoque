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
  createPendingItem,
  getPendingItemsPersistenceProvider,
  listPendingItems,
} from "@/lib/server/pending-items";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

const PENDING_RESOURCE_ID = "operations.pending";

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    assertCanReadErpResource(session, PENDING_RESOURCE_ID);
    const payload = await listPendingItems();

    return NextResponse.json({
      ...payload,
      provider: getPendingItemsPersistenceProvider(),
    });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar as pendencias.",
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
    assertCanCreateErpResource(session, PENDING_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const item = await createPendingItem(body.item);

    await writeErpMutationAuditLog({
      action: "erp.pending.created",
      session,
      resource: PENDING_RESOURCE_ID,
      entityId: item.id,
      request: requestMetadata,
      after: item,
      version: item.version,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.pending.created",
      outcome,
      session,
      resource: PENDING_RESOURCE_ID,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para criacao da pendencia.",
      fallbackErrorMessage: "Falha ao criar a pendencia.",
    });
  }
}
