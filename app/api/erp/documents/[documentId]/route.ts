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
    assertCanUpdateErpResource(session, DOCUMENTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireDocumentBaseVersion(
      body.baseVersion,
      "atualizar",
    );
    const before = await getDocumentById(documentId);
    const document = await updateDocument(documentId, body.document, {
      baseVersion,
    });

    await writeErpMutationAuditLog({
      action: "erp.document.updated",
      session,
      resource: DOCUMENTS_RESOURCE_ID,
      entityId: documentId,
      request: requestMetadata,
      before,
      after: document,
      version: document.version,
    });

    return NextResponse.json({ document });
  } catch (error) {
    const outcome =
      error instanceof ErpAccessDeniedError ? "denied" : "failure";

    await writeErpMutationAuditLog({
      action: "erp.document.updated",
      outcome,
      session,
      resource: DOCUMENTS_RESOURCE_ID,
      entityId: documentId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
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
    assertCanDeleteErpResource(session, DOCUMENTS_RESOURCE_ID);
    const body = await readJsonObjectBody(request);
    const baseVersion = requireDocumentBaseVersion(
      body.baseVersion,
      "excluir",
    );
    const before = await getDocumentById(documentId);
    const deletedDocument = await deleteDocument(documentId, baseVersion);

    await writeErpMutationAuditLog({
      action: "erp.document.deleted",
      session,
      resource: DOCUMENTS_RESOURCE_ID,
      entityId: documentId,
      request: requestMetadata,
      before,
      version: deletedDocument.version,
      metadata: {
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

    await writeErpMutationAuditLog({
      action: "erp.document.deleted",
      outcome,
      session,
      resource: DOCUMENTS_RESOURCE_ID,
      entityId: documentId,
      request: requestMetadata,
      metadata: getAuditErrorMetadata(error),
    });

    return getErpApiErrorResponse(error, {
      syntaxErrorMessage: "JSON invalido para exclusao do documento.",
      fallbackErrorMessage: "Falha ao excluir o documento.",
      handlers: [getDocumentNotFoundResponse, getDocumentConflictResponse],
    });
  }
}
