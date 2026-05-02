import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanReadErpResource,
  assertCanWriteErpResource,
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

    await writeErpMutationAuditLog({
      action: "erp.location.created",
      session,
      resource: LOCATIONS_RESOURCE_ID,
      entityId: location.id,
      request: requestMetadata,
      after: location,
      version: location.version,
    });

    return NextResponse.json({ location }, { status: 201 });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.location.created",
      outcome,
      session,
      resource: LOCATIONS_RESOURCE_ID,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para criacao da localizacao.",
      fallbackErrorMessage: "Falha ao criar a localizacao.",
    });
  }
}
