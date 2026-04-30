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
    assertCanWriteErpResource(session, DOCUMENTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const document = await createDocument(body.document);

    await writeAuditLog({
      category: "erp",
      action: "erp.document.created",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: null,
        resource: `${DOCUMENTS_RESOURCE_ID}:${document.id}`,
      },
      request: requestMetadata,
      metadata: {
        version: document.version,
      },
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.document.created",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: {
        accountId: null,
        resource: DOCUMENTS_RESOURCE_ID,
      },
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para criacao do documento.",
      fallbackErrorMessage: "Falha ao criar o documento.",
    });
  }
}
