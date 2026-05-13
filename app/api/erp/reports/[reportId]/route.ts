import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanDeleteErpResource,
  assertCanReadErpResource,
  assertCanUpdateErpResource,
} from "@/lib/server/erp-access-control";
import {
  getAuditErrorMetadata,
  writeErpMutationAuditLog,
} from "@/lib/server/erp-audit";
import { readServerSession } from "@/lib/server/auth-session";
import {
  createPayloadErrorHandler,
  createStatusMessageErrorHandler,
  getErpApiErrorResponse,
  getUnauthorizedErpResponse,
  readJsonObjectBody,
} from "@/lib/server/erp-api-errors";
import { getRequestMetadata } from "@/lib/server/request-metadata";
import {
  deleteReport,
  getReportById,
  getReportVersionConflictPayload,
  ReportConflictError,
  ReportNotFoundError,
  requireReportBaseVersion,
  updateReport,
} from "@/lib/server/reports";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    reportId: string;
  }>;
};

const REPORTS_RESOURCE_ID = "operations.reports";

const getReportNotFoundResponse = createStatusMessageErrorHandler(
  (error): error is ReportNotFoundError =>
    error instanceof ReportNotFoundError,
);
const getReportConflictResponse = createPayloadErrorHandler(
  (error): error is ReportConflictError =>
    error instanceof ReportConflictError,
  getReportVersionConflictPayload,
);

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    const { reportId } = await context.params;
    assertCanReadErpResource(session, REPORTS_RESOURCE_ID);
    const item = await getReportById(reportId);
    return NextResponse.json({ item });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar o relatorio.",
      handlers: [getReportNotFoundResponse],
    });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { reportId } = await context.params;

  try {
    assertCanUpdateErpResource(session, REPORTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireReportBaseVersion(body.baseVersion, "atualizar");
    const before = await getReportById(reportId);
    const item = await updateReport(reportId, body.item, {
      baseVersion,
    });

    await writeErpMutationAuditLog({
      action: "erp.reports.updated",
      session,
      resource: REPORTS_RESOURCE_ID,
      entityId: reportId,
      request: requestMetadata,
      before,
      after: item,
      version: item.version,
    });

    return NextResponse.json({ item });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.reports.updated",
      outcome,
      session,
      resource: REPORTS_RESOURCE_ID,
      entityId: reportId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para atualizacao do relatorio.",
      fallbackErrorMessage: "Falha ao atualizar o relatorio.",
      handlers: [getReportNotFoundResponse, getReportConflictResponse],
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { reportId } = await context.params;

  try {
    assertCanDeleteErpResource(session, REPORTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireReportBaseVersion(body.baseVersion, "excluir");
    const before = await getReportById(reportId);
    const deletedItem = await deleteReport(reportId, baseVersion);

    await writeErpMutationAuditLog({
      action: "erp.reports.deleted",
      session,
      resource: REPORTS_RESOURCE_ID,
      entityId: reportId,
      request: requestMetadata,
      before,
      version: deletedItem.version,
      metadata: {
        deletedAt: deletedItem.deletedAt,
      },
    });

    return NextResponse.json({
      reportId: deletedItem.id,
      version: deletedItem.version,
      deletedAt: deletedItem.deletedAt,
    });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.reports.deleted",
      outcome,
      session,
      resource: REPORTS_RESOURCE_ID,
      entityId: reportId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para exclusao do relatorio.",
      fallbackErrorMessage: "Falha ao excluir o relatorio.",
      handlers: [getReportNotFoundResponse, getReportConflictResponse],
    });
  }
}
