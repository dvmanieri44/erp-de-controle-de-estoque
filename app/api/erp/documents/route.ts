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
  createDocument,
  getDocumentsPersistenceProvider,
  listDocuments,
} from "@/lib/server/documents";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

const DOCUMENTS_RESOURCE_ID = "operations.documents";

export async function GET() {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    assertCanReadErpResource(session, DOCUMENTS_RESOURCE_ID);
    const payload = await listDocuments();

    return NextResponse.json({
      ...payload,
      provider: getDocumentsPersistenceProvider(),
    });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar os documentos.",
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
    assertCanCreateErpResource(session, DOCUMENTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const document = await createDocument(body.document);

    await writeErpMutationAuditLog({
      action: "erp.document.created",
      session,
      resource: DOCUMENTS_RESOURCE_ID,
      entityId: document.id,
      request: requestMetadata,
      after: document,
      version: document.version,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.document.created",
      outcome,
      session,
      resource: DOCUMENTS_RESOURCE_ID,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para criacao do documento.",
      fallbackErrorMessage: "Falha ao criar o documento.",
    });
  }
}
