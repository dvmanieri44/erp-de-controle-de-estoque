import "server-only";

import type { ErpResourceId } from "@/lib/erp-data-resources";
import {
  canRoleAccessErpResource,
  ERP_RESOURCE_ACCESS,
  type ErpResourceDerivedAction,
} from "@/lib/erp-resource-access";
import type { ServerSession } from "@/lib/server/auth-session";

export class ErpAccessDeniedError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

function assertCanUseErpResourceAction(
  session: ServerSession,
  resource: ErpResourceId,
  action: ErpResourceDerivedAction,
  message: string,
) {
  if (!canRoleAccessErpResource(session.role, resource, action)) {
    throw new ErpAccessDeniedError(message);
  }
}

export { ERP_RESOURCE_ACCESS };

export function assertCanReadErpResource(
  session: ServerSession,
  resource: ErpResourceId,
) {
  assertCanUseErpResourceAction(
    session,
    resource,
    "read",
    "Seu perfil nao pode consultar esse recurso do ERP.",
  );
}

export function assertCanWriteErpResource(
  session: ServerSession,
  resource: ErpResourceId,
) {
  assertCanUseErpResourceAction(
    session,
    resource,
    "write",
    "Seu perfil nao pode alterar esse recurso do ERP.",
  );
}

export function assertCanCreateErpResource(
  session: ServerSession,
  resource: ErpResourceId,
) {
  assertCanUseErpResourceAction(
    session,
    resource,
    "create",
    "Seu perfil nao pode criar esse recurso do ERP.",
  );
}

export function assertCanUpdateErpResource(
  session: ServerSession,
  resource: ErpResourceId,
) {
  assertCanUseErpResourceAction(
    session,
    resource,
    "update",
    "Seu perfil nao pode atualizar esse recurso do ERP.",
  );
}

export function assertCanDeleteErpResource(
  session: ServerSession,
  resource: ErpResourceId,
) {
  assertCanUseErpResourceAction(
    session,
    resource,
    "delete",
    "Seu perfil nao pode excluir esse recurso do ERP.",
  );
}

export function assertCanCancelErpResource(
  session: ServerSession,
  resource: ErpResourceId,
) {
  assertCanUseErpResourceAction(
    session,
    resource,
    "cancel",
    "Seu perfil nao pode cancelar esse recurso do ERP.",
  );
}

export function assertCanCloseErpResource(
  session: ServerSession,
  resource: ErpResourceId,
) {
  assertCanUseErpResourceAction(
    session,
    resource,
    "close",
    "Seu perfil nao pode encerrar esse recurso do ERP.",
  );
}

export function assertCanBackfillErpResource(
  session: ServerSession,
  resource: ErpResourceId,
) {
  assertCanUseErpResourceAction(
    session,
    resource,
    "backfill",
    "Seu perfil nao pode executar o backfill desse recurso do ERP.",
  );
}
