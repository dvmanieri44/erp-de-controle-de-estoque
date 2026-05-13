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
import {
  createReport,
  getReportsPersistenceProvider,
  listReports,
} from "@/lib/server/reports";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

const REPORTS_RESOURCE_ID = "operations.reports";

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    assertCanReadErpResource(session, REPORTS_RESOURCE_ID);
    const payload = await listReports();

    return NextResponse.json({
      ...payload,
      provider: getReportsPersistenceProvider(),
    });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar os relatorios.",
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
    assertCanCreateErpResource(session, REPORTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const item = await createReport(body.item);

    await writeErpMutationAuditLog({
      action: "erp.reports.created",
      session,
      resource: REPORTS_RESOURCE_ID,
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
      action: "erp.reports.created",
      outcome,
      session,
      resource: REPORTS_RESOURCE_ID,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para criacao do relatorio.",
      fallbackErrorMessage: "Falha ao criar o relatorio.",
    });
  }
}
