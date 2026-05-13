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
import { getRequestMetadata } from "@/lib/server/request-metadata";
import {
  createSupplier,
  getSuppliersPersistenceProvider,
  listSuppliers,
} from "@/lib/server/suppliers";

export const runtime = "nodejs";

const SUPPLIERS_RESOURCE_ID = "operations.suppliers";

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    assertCanReadErpResource(session, SUPPLIERS_RESOURCE_ID);
    const payload = await listSuppliers();

    return NextResponse.json({
      ...payload,
      provider: getSuppliersPersistenceProvider(),
    });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar os fornecedores.",
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
    assertCanCreateErpResource(session, SUPPLIERS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const item = await createSupplier(body.item);

    await writeErpMutationAuditLog({
      action: "erp.suppliers.created",
      session,
      resource: SUPPLIERS_RESOURCE_ID,
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
      action: "erp.suppliers.created",
      outcome,
      session,
      resource: SUPPLIERS_RESOURCE_ID,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para criacao do fornecedor.",
      fallbackErrorMessage: "Falha ao criar o fornecedor.",
    });
  }
}
