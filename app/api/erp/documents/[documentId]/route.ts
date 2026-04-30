import { NextResponse } from "next/server";

import {
  ErpAccessDeniedError,
  assertCanReadErpResource,
  assertCanWriteErpResource,
} from "@/lib/server/erp-access-control";
import { writeAuditLog } from "@/lib/server/audit-log";
import { readServerSession } from "@/lib/server/auth-session";
import {
  createPayloadErrorHandler,
  createStatusMessageErrorHandler,
  getErpApiErrorResponse,
  getUnauthorizedErpResponse,
  readJsonObjectBody,
} from "@/lib/server/erp-api-errors";
import {
  deleteDocument,
  DocumentConflictError,
  DocumentNotFoundError,
  getDocumentById,
  getDocumentVersionConflictPayload,
  requireDocumentBaseVersion,
  updateDocument,
} from "@/lib/server/documents";
import { getRequestMetadata } from "@/lib/server/request-metadata";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

const DOCUMENTS_RESOURCE_ID = "operations.documents";

function getDocumentTarget(documentId: string) {
  return {
    accountId: null,
    resource: `${DOCUMENTS_RESOURCE_ID}:${documentId}`,
  };
}

const getDocumentNotFoundResponse = createStatusMessageErrorHandler(
  (error): error is DocumentNotFoundError =>
    error instanceof DocumentNotFoundError,
);
const getDocumentConflictResponse = createPayloadErrorHandler(
  (error): error is DocumentConflictError =>
    error instanceof DocumentConflictError,
  getDocumentVersionConflictPayload,
);

export async function GET(_: Request, context: RouteContext) {
  const session = await readServerSession();

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  try {
    const { documentId } = await context.params;
    assertCanReadErpResource(session, DOCUMENTS_RESOURCE_ID);
    const document = await getDocumentById(documentId);
    return NextResponse.json({ document });
  } catch (error) {
    return getErpApiErrorResponse(error, {
      fallbackErrorMessage: "Falha ao carregar o documento.",
      handlers: [getDocumentNotFoundResponse],
    });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { documentId } = await context.params;

  try {
    assertCanWriteErpResource(session, DOCUMENTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireDocumentBaseVersion(
      body.baseVersion,
      "atualizar",
    );
    const document = await updateDocument(documentId, body.document, {
      baseVersion,
    });

    await writeAuditLog({
      category: "erp",
      action: "erp.document.updated",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getDocumentTarget(documentId),
      request: requestMetadata,
      metadata: {
        version: document.version,
      },
    });

    return NextResponse.json({ document });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.document.updated",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getDocumentTarget(documentId),
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para atualizacao do documento.",
      fallbackErrorMessage: "Falha ao atualizar o documento.",
      handlers: [getDocumentNotFoundResponse, getDocumentConflictResponse],
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await readServerSession();
  const requestMetadata = getRequestMetadata(request);

  if (!session) {
    return getUnauthorizedErpResponse();
  }

  const { documentId } = await context.params;

  try {
    assertCanWriteErpResource(session, DOCUMENTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireDocumentBaseVersion(
      body.baseVersion,
      "excluir",
    );
    const deletedDocument = await deleteDocument(documentId, baseVersion);

    await writeAuditLog({
      category: "erp",
      action: "erp.document.deleted",
      outcome: "success",
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getDocumentTarget(documentId),
      request: requestMetadata,
      metadata: {
        version: deletedDocument.version,
        deletedAt: deletedDocument.deletedAt,
      },
    });

    return NextResponse.json({
      documentId: deletedDocument.id,
      version: deletedDocument.version,
      deletedAt: deletedDocument.deletedAt,
    });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeAuditLog({
      category: "erp",
      action: "erp.document.deleted",
      outcome,
      actor: {
        accountId: session.account.id,
        username: session.username,
        role: session.role,
      },
      target: getDocumentTarget(documentId),
      request: requestMetadata,
      metadata: {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para exclusao do documento.",
      fallbackErrorMessage: "Falha ao excluir o documento.",
      handlers: [getDocumentNotFoundResponse, getDocumentConflictResponse],
    });
  }
}
