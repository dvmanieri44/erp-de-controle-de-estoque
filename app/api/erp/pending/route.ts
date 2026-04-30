import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanReadErpResource,
  assertCanWriteErpResource,
} from "@/lib/server/erp-access-control";
import { writeAuditLog } from "@/lib/server/audit-log";
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
    assertCanWriteErpResource(session, PENDING_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const item = await createPendingItem(body.item);

    await writeAuditLog({
      category: "erp",
      action: "erp.pending.created",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: null,
        resource: `${PENDING_RESOURCE_ID}:${item.id}`,
      },
      request: requestMetadata,
      metadata: {
        version: item.version,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.pending.created",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: null,
        resource: PENDING_RESOURCE_ID,
      },
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para criacao da pendencia.",
      fallbackErrorMessage: "Falha ao criar a pendencia.",
    });
  }
}
