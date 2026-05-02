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
  createInUseErrorHandler,
  createPayloadErrorHandler,
  createStatusMessageErrorHandler,
  getErpApiErrorResponse,
  getUnauthorizedErpResponse,
  readJsonObjectBody,
} from "@/lib/server/erp-api-errors";
import {
  deleteLocation,
  getInventoryLocationVersionConflictPayload,
  getLocationById,
  InventoryLocationConflictError,
  InventoryLocationInUseError,
  InventoryLocationNotFoundError,
  requireInventoryLocationBaseVersion,
  updateLocation,
} from "@/lib/server/inventory-locations";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    locationId: string;
  }>;
};

const LOCATIONS_RESOURCE_ID = "inventory.locations";

const getLocationNotFoundResponse = createStatusMessageErrorHandler(
  (error): error is InventoryLocationNotFoundError =>
    error instanceof InventoryLocationNotFoundError,
);
const getLocationConflictResponse = createPayloadErrorHandler(
  (error): error is InventoryLocationConflictError =>
    error instanceof InventoryLocationConflictError,
  getInventoryLocationVersionConflictPayload,
);
const getLocationInUseResponse = createInUseErrorHandler(
  (error): error is InventoryLocationInUseError =>
    error instanceof InventoryLocationInUseError,
  "LOCATION_IN_USE",
);

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    const { locationId } = await context.params;
    assertCanReadErpResource(session, LOCATIONS_RESOURCE_ID);
    const location = await getLocationById(locationId);
    return NextResponse.json({ location });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar a localizacao.",
      handlers: [getLocationNotFoundResponse],
    });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { locationId } = await context.params;

  try {
    assertCanWriteErpResource(session, LOCATIONS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireInventoryLocationBaseVersion(
      body.baseVersion,
      "atualizar",
    );
    const before = await getLocationById(locationId);
    const location = await updateLocation(
      locationId,
      body.location,
      { baseVersion },
    );

    await writeErpMutationAuditLog({
      action: "erp.location.updated",
      session,
      resource: LOCATIONS_RESOURCE_ID,
      entityId: locationId,
      request: requestMetadata,
      before,
      after: location,
      version: location.version,
    });

    return NextResponse.json({ location });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.location.updated",
      outcome,
      session,
      resource: LOCATIONS_RESOURCE_ID,
      entityId: locationId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para atualizacao da localizacao.",
      fallbackErrorMessage: "Falha ao atualizar a localizacao.",
      handlers: [getLocationNotFoundResponse, getLocationConflictResponse],
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { locationId } = await context.params;

  try {
    assertCanWriteErpResource(session, LOCATIONS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireInventoryLocationBaseVersion(
      body.baseVersion,
      "excluir",
    );
    const before = await getLocationById(locationId);
    const deletedLocation = await deleteLocation(locationId, baseVersion);

    await writeErpMutationAuditLog({
      action: "erp.location.deleted",
      session,
      resource: LOCATIONS_RESOURCE_ID,
      entityId: locationId,
      request: requestMetadata,
      before,
      version: deletedLocation.version,
      metadata: {
        deletedAt: deletedLocation.deletedAt,
      },
    });

    return NextResponse.json({
      locationId: deletedLocation.id,
      version: deletedLocation.version,
      deletedAt: deletedLocation.deletedAt,
    });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.location.deleted",
      outcome,
      session,
      resource: LOCATIONS_RESOURCE_ID,
      entityId: locationId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para exclusao da localizacao.",
      fallbackErrorMessage: "Falha ao excluir a localizacao.",
      handlers: [
        getLocationNotFoundResponse,
        getLocationConflictResponse,
        getLocationInUseResponse,
      ],
    });
  }
}
