import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanReadErpResource,
  assertCanWriteErpResource,
} from "@/lib/server/erp-access-control";
import { writeAuditLog } from "@/lib/server/audit-log";
import { readServerSession } from "@/lib/server/auth-session";
import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
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

function getUnauthorizedResponse() {
  return NextResponse.json(
    { error: "Sessao obrigatoria para acessar o ERP." },
    { status: 401 },
  );
}

async function readJsonBody(request: Request) {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return {};
  }

  return JSON.parse(rawBody) as Record<string, unknown>;
}

function getLocationTarget(locationId: string) {
  return {
    accountId: null,
    resource: `${LOCATIONS_RESOURCE_ID}:${locationId}`,
  };
}

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedResponse();
  }

  try {
    const { locationId } = await context.params;
    assertCanReadErpResource(session, LOCATIONS_RESOURCE_ID);
    const location = await getLocationById(locationId);
    return NextResponse.json({ location });
  } catch (error) {
    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof InventoryLocationNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: "Falha ao carregar a localizacao.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedResponse();
  }

  const { locationId } = await context.params;

  try {
    assertCanWriteErpResource(session, LOCATIONS_RESOURCE_ID);
    const body = await readJsonBody(request);
    const baseVersion = requireInventoryLocationBaseVersion(
      body.baseVersion,
      "atualizar",
    );
    const location = await updateLocation(
      locationId,
      body.location,
      { baseVersion },
    );

    await writeAuditLog({
      category: "erp",
      action: "erp.location.updated",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getLocationTarget(locationId),
      request: requestMetadata,
      metadata: {
        version: location.version,
      },
    });

    return NextResponse.json({ location });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.location.updated",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getLocationTarget(locationId),
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "JSON invalido para atualizacao da localizacao." },
        { status: 400 },
      );
    }

    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof ErpResourceValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof InventoryLocationNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof InventoryLocationConflictError) {
      return NextResponse.json(
        getInventoryLocationVersionConflictPayload(error),
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error: "Falha ao atualizar a localizacao.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedResponse();
  }

  const { locationId } = await context.params;

  try {
    assertCanWriteErpResource(session, LOCATIONS_RESOURCE_ID);
    const body = await readJsonBody(request);
    const baseVersion = requireInventoryLocationBaseVersion(
      body.baseVersion,
      "excluir",
    );
    const deletedLocation = await deleteLocation(locationId, baseVersion);

    await writeAuditLog({
      category: "erp",
      action: "erp.location.deleted",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getLocationTarget(locationId),
      request: requestMetadata,
      metadata: {
        version: deletedLocation.version,
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

    await writeAuditLog({
      category: "erp",
      action: "erp.location.deleted",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getLocationTarget(locationId),
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "JSON invalido para exclusao da localizacao." },
        { status: 400 },
      );
    }

    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof ErpResourceValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof InventoryLocationNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof InventoryLocationConflictError) {
      return NextResponse.json(
        getInventoryLocationVersionConflictPayload(error),
        { status: error.status },
      );
    }

    if (error instanceof InventoryLocationInUseError) {
      return NextResponse.json(
        {
          error: "LOCATION_IN_USE",
          reasons: error.reasons,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error: "Falha ao excluir a localizacao.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}
