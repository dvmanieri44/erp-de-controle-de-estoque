import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanCreateErpResource,
  assertCanReadErpResource,
} from "@/lib/server/erp-access-control";
import {
  createDistributor,
  getDistributorsPersistenceProvider,
  listDistributors,
} from "@/lib/server/distributors";
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

export const runtime = "nodejs";

const DISTRIBUTORS_RESOURCE_ID = "operations.distributors";

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    assertCanReadErpResource(session, DISTRIBUTORS_RESOURCE_ID);
    const payload = await listDistributors();

    return NextResponse.json({
      ...payload,
      provider: getDistributorsPersistenceProvider(),
    });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar os distribuidores.",
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
    assertCanCreateErpResource(session, DISTRIBUTORS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const item = await createDistributor(body.item);

    await writeErpMutationAuditLog({
      action: "erp.distributors.created",
      session,
      resource: DISTRIBUTORS_RESOURCE_ID,
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
      action: "erp.distributors.created",
      outcome,
      session,
      resource: DISTRIBUTORS_RESOURCE_ID,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para criacao do distribuidor.",
      fallbackErrorMessage: "Falha ao criar o distribuidor.",
    });
  }
}
