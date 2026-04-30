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
  createLocation,
  getInventoryLocationsPersistenceProvider,
  listLocations,
} from "@/lib/server/inventory-locations";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

const LOCATIONS_RESOURCE_ID = "inventory.locations";

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    assertCanReadErpResource(session, LOCATIONS_RESOURCE_ID);
    const payload = await listLocations();

    return NextResponse.json({
      ...payload,
      provider: getInventoryLocationsPersistenceProvider(),
    });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar as localizacoes.",
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
    assertCanWriteErpResource(session, LOCATIONS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const location = await createLocation(body.location);

    await writeAuditLog({
      category: "erp",
      action: "erp.location.created",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: null,
        resource: `${LOCATIONS_RESOURCE_ID}:${location.id}`,
      },
      request: requestMetadata,
      metadata: {
        version: location.version,
      },
    });

    return NextResponse.json({ location }, { status: 201 });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.location.created",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: null,
        resource: LOCATIONS_RESOURCE_ID,
      },
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para criacao da localizacao.",
      fallbackErrorMessage: "Falha ao criar a localizacao.",
    });
  }
}
