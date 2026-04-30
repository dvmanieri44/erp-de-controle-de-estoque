import { NextResponse } from "next/server";

import { isErpResourceId } from "@/lib/erp-data-resources";
import { ErpAccessDeniedError, assertCanReadErpResource, assertCanWriteErpResource } from "@/lib/server/erp-access-control";
import { writeAuditLog } from "@/lib/server/audit-log";
import { readServerSession } from "@/lib/server/auth-session";
import { ErpResourceConflictError, readErpResource, writeErpResource } from "@/lib/server/erp-state";
import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

const MOVEMENTS_RESOURCE_ID = "inventory.movements";
const LOTS_RESOURCE_ID = "operations.lots";
const LOCATIONS_RESOURCE_ID = "inventory.locations";
const PRODUCTS_RESOURCE_ID = "operations.products";
const QUALITY_EVENTS_RESOURCE_ID = "operations.quality-events";
const INCIDENTS_RESOURCE_ID = "operations.incidents";
const DOCUMENTS_RESOURCE_ID = "operations.documents";
const TASKS_RESOURCE_ID = "operations.tasks";
const PENDING_RESOURCE_ID = "operations.pending";

type RouteContext = {
  params: Promise<{
    resource: string;
  }>;
};

function getUnauthorizedResponse() {
  return NextResponse.json({ error: "Sessao obrigatoria para acessar o ERP." }, { status: 401 });
}

function getRestrictedResourceResponse(message?: string) {
  return NextResponse.json(
    {
      error:
        message ??
        "Esse recurso sensivel deve ser acessado pelas rotas dedicadas de autenticacao.",
    },
    { status: 403 },
  );
}

function getRestrictedMovementsWriteResponse() {
  return getRestrictedResourceResponse(
    "As movimentacoes devem ser alteradas apenas pelas rotas dedicadas /api/erp/movements e /api/erp/movements/[movementId].",
  );
}

function getRestrictedLotsWriteResponse() {
  return getRestrictedResourceResponse(
    "Os lotes devem ser alterados apenas pelas rotas dedicadas /api/erp/lots e /api/erp/lots/[lotCode].",
  );
}

function getRestrictedLocationsWriteResponse() {
  return getRestrictedResourceResponse(
    "As localizacoes devem ser alteradas apenas pelas rotas dedicadas /api/erp/locations e /api/erp/locations/[locationId].",
  );
}

function getRestrictedProductsWriteResponse() {
  return getRestrictedResourceResponse(
    "Os produtos devem ser alterados apenas pelas rotas dedicadas /api/erp/products e /api/erp/products/[sku].",
  );
}

function getRestrictedQualityEventsWriteResponse() {
  return getRestrictedResourceResponse(
    "Os eventos de qualidade devem ser alterados apenas pelas rotas dedicadas /api/erp/quality-events e /api/erp/quality-events/[eventId].",
  );
}

function getRestrictedIncidentsWriteResponse() {
  return getRestrictedResourceResponse(
    "Os incidentes devem ser alterados apenas pelas rotas dedicadas /api/erp/incidents e /api/erp/incidents/[incidentId].",
  );
}

function getRestrictedDocumentsWriteResponse() {
  return getRestrictedResourceResponse(
    "Os documentos devem ser alterados apenas pelas rotas dedicadas /api/erp/documents e /api/erp/documents/[documentId].",
  );
}

function getRestrictedTasksWriteResponse() {
  return getRestrictedResourceResponse(
    "As tarefas devem ser alteradas apenas pelas rotas dedicadas /api/erp/tasks e /api/erp/tasks/[taskId].",
  );
}

function getRestrictedPendingWriteResponse() {
  return getRestrictedResourceResponse(
    "As pendencias devem ser alteradas apenas pelas rotas dedicadas /api/erp/pending e /api/erp/pending/[pendingId].",
  );
}

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedResponse();
  }

  const { resource } = await context.params;

  if (!isErpResourceId(resource)) {
    return NextResponse.json({ error: "Recurso nao encontrado." }, { status: 404 });
  }

  if (resource === "user.accounts") {
    return getRestrictedResourceResponse();
  }

  try {
    assertCanReadErpResource(session, resource);
    const payload = await readErpResource(resource);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: "Falha ao carregar o recurso do ERP.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { resource } = await context.params;

  if (resource === MOVEMENTS_RESOURCE_ID) {
    return getRestrictedMovementsWriteResponse();
  }

  if (resource === LOTS_RESOURCE_ID) {
    return getRestrictedLotsWriteResponse();
  }

  if (resource === LOCATIONS_RESOURCE_ID) {
    return getRestrictedLocationsWriteResponse();
  }

  if (resource === PRODUCTS_RESOURCE_ID) {
    return getRestrictedProductsWriteResponse();
  }

  if (resource === QUALITY_EVENTS_RESOURCE_ID) {
    return getRestrictedQualityEventsWriteResponse();
  }

  if (resource === INCIDENTS_RESOURCE_ID) {
    return getRestrictedIncidentsWriteResponse();
  }

  if (resource === DOCUMENTS_RESOURCE_ID) {
    return getRestrictedDocumentsWriteResponse();
  }

  if (resource === TASKS_RESOURCE_ID) {
    return getRestrictedTasksWriteResponse();
  }

  if (resource === PENDING_RESOURCE_ID) {
    return getRestrictedPendingWriteResponse();
  }

  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedResponse();
  }

  if (!isErpResourceId(resource)) {
    return NextResponse.json({ error: "Recurso nao encontrado." }, { status: 404 });
  }

  if (resource === "user.accounts") {
    return getRestrictedResourceResponse();
  }

  try {
    assertCanWriteErpResource(session, resource);

    const body = (await request.json()) as {
      data?: unknown;
      baseVersion?: unknown;
    };

    if (!Array.isArray(body.data)) {
      return NextResponse.json({ error: "Carga invalida para persistencia." }, { status: 400 });
    }

    if (
      body.baseVersion !== undefined &&
      body.baseVersion !== null &&
      (typeof body.baseVersion !== "number" ||
        !Number.isInteger(body.baseVersion) ||
        body.baseVersion < 0)
    ) {
      return NextResponse.json(
        { error: "Versao base invalida para persistencia." },
        { status: 400 },
      );
    }

    const payload = await writeErpResource(resource, body.data, {
      baseVersion:
        typeof body.baseVersion === "number" ? body.baseVersion : null,
    });
    await writeAuditLog({
      category: "erp",
      action: "erp.resource.updated",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: null,
        resource,
      },
      request: requestMetadata,
      metadata: {
        items: body.data.length,
        version: payload.version,
      },
    });
    return NextResponse.json(payload);
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.resource.updated",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: null,
        resource,
      },
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    if (error instanceof ErpAccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof ErpResourceValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof ErpResourceConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "resource_version_conflict",
          currentVersion: error.currentVersion,
          updatedAt: error.currentUpdatedAt,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error: "Falha ao salvar o recurso do ERP.",
        details: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 },
    );
  }
}

async function handleUnsupportedWriteMethod(context: RouteContext) {
  const { resource } = await context.params;

  if (resource === MOVEMENTS_RESOURCE_ID) {
    return getRestrictedMovementsWriteResponse();
  }

  if (resource === LOTS_RESOURCE_ID) {
    return getRestrictedLotsWriteResponse();
  }

  if (resource === LOCATIONS_RESOURCE_ID) {
    return getRestrictedLocationsWriteResponse();
  }

  if (resource === PRODUCTS_RESOURCE_ID) {
    return getRestrictedProductsWriteResponse();
  }

  if (resource === QUALITY_EVENTS_RESOURCE_ID) {
    return getRestrictedQualityEventsWriteResponse();
  }

  if (resource === INCIDENTS_RESOURCE_ID) {
    return getRestrictedIncidentsWriteResponse();
  }

  if (resource === DOCUMENTS_RESOURCE_ID) {
    return getRestrictedDocumentsWriteResponse();
  }

  if (resource === TASKS_RESOURCE_ID) {
    return getRestrictedTasksWriteResponse();
  }

  if (resource === PENDING_RESOURCE_ID) {
    return getRestrictedPendingWriteResponse();
  }

  return new NextResponse(null, {
    status: 405,
    headers: {
      Allow: "GET, PUT",
    },
  });
}

export async function POST(_: Request, context: RouteContext) {
  return handleUnsupportedWriteMethod(context);
}

export async function PATCH(_: Request, context: RouteContext) {
  return handleUnsupportedWriteMethod(context);
}

export async function DELETE(_: Request, context: RouteContext) {
  return handleUnsupportedWriteMethod(context);
}
