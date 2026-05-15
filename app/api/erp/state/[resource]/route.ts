import { NextResponse } from "next/server";

import { isErpResourceId } from "@/lib/erp-data-resources";
import { ErpAccessDeniedError, assertCanReadErpResource, assertCanWriteErpResource } from "@/lib/server/erp-access-control";
import {
  getAuditErrorMetadata,
  writeErpMutationAuditLog,
} from "@/lib/server/erp-audit";
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
const NOTIFICATIONS_RESOURCE_ID = "operations.notifications";
const PLANNING_RESOURCE_ID = "operations.planning";
const CALENDAR_RESOURCE_ID = "operations.calendar";
const REPORTS_RESOURCE_ID = "operations.reports";
const DISTRIBUTORS_RESOURCE_ID = "operations.distributors";
const SUPPLIERS_RESOURCE_ID = "operations.suppliers";
const CATEGORIES_RESOURCE_ID = "operations.categories";

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

function getRestrictedNotificationsWriteResponse() {
  return getRestrictedResourceResponse(
    "As notificacoes devem ser alteradas apenas pelas rotas dedicadas /api/erp/notifications e /api/erp/notifications/[notificationId].",
  );
}

function getRestrictedPlanningWriteResponse() {
  return getRestrictedResourceResponse(
    "Os planejamentos devem ser alterados apenas pelas rotas dedicadas /api/erp/planning e /api/erp/planning/[planningId].",
  );
}

function getRestrictedCalendarWriteResponse() {
  return getRestrictedResourceResponse(
    "Os eventos do calendario devem ser alterados apenas pelas rotas dedicadas /api/erp/calendar e /api/erp/calendar/[calendarEventId].",
  );
}

function getRestrictedReportsWriteResponse() {
  return getRestrictedResourceResponse(
    "Os relatorios devem ser alterados apenas pelas rotas dedicadas /api/erp/reports e /api/erp/reports/[reportId].",
  );
}

function getRestrictedDistributorsWriteResponse() {
  return getRestrictedResourceResponse(
    "Os distribuidores devem ser alterados apenas pelas rotas dedicadas /api/erp/distributors e /api/erp/distributors/[distributorId].",
  );
}

function getRestrictedSuppliersWriteResponse() {
  return getRestrictedResourceResponse(
    "Os fornecedores devem ser alterados apenas pelas rotas dedicadas /api/erp/suppliers e /api/erp/suppliers/[supplierId].",
  );
}

function getRestrictedCategoriesWriteResponse() {
  return getRestrictedResourceResponse(
    "As categorias devem ser alteradas apenas pelas rotas dedicadas /api/erp/categories e /api/erp/categories/[categoryId].",
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

  if (resource === NOTIFICATIONS_RESOURCE_ID) {
    return getRestrictedNotificationsWriteResponse();
  }

  if (resource === PLANNING_RESOURCE_ID) {
    return getRestrictedPlanningWriteResponse();
  }

  if (resource === CALENDAR_RESOURCE_ID) {
    return getRestrictedCalendarWriteResponse();
  }

  if (resource === REPORTS_RESOURCE_ID) {
    return getRestrictedReportsWriteResponse();
  }

  if (resource === DISTRIBUTORS_RESOURCE_ID) {
    return getRestrictedDistributorsWriteResponse();
  }

  if (resource === SUPPLIERS_RESOURCE_ID) {
    return getRestrictedSuppliersWriteResponse();
  }

  if (resource === CATEGORIES_RESOURCE_ID) {
    return getRestrictedCategoriesWriteResponse();
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

    const before = await readErpResource(resource);
    const payload = await writeErpResource(resource, body.data, {
      baseVersion:
        typeof body.baseVersion === "number" ? body.baseVersion : null,
    });
    await writeErpMutationAuditLog({
      action: "erp.resource.updated",
      session,
      resource,
      entityId: resource,
      request: requestMetadata,
      before: before.data,
      after: payload.data,
      version: payload.version,
      metadata: {
        items: body.data.length,
      },
    });
    return NextResponse.json(payload);
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.resource.updated",
      outcome,
      session,
      resource,
      entityId: resource,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
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

  if (resource === NOTIFICATIONS_RESOURCE_ID) {
    return getRestrictedNotificationsWriteResponse();
  }

  if (resource === PLANNING_RESOURCE_ID) {
    return getRestrictedPlanningWriteResponse();
  }

  if (resource === CALENDAR_RESOURCE_ID) {
    return getRestrictedCalendarWriteResponse();
  }

  if (resource === REPORTS_RESOURCE_ID) {
    return getRestrictedReportsWriteResponse();
  }

  if (resource === DISTRIBUTORS_RESOURCE_ID) {
    return getRestrictedDistributorsWriteResponse();
  }

  if (resource === SUPPLIERS_RESOURCE_ID) {
    return getRestrictedSuppliersWriteResponse();
  }

  if (resource === CATEGORIES_RESOURCE_ID) {
    return getRestrictedCategoriesWriteResponse();
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
