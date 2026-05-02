import "server-only";

import type { ErpResourceId } from "@/lib/erp-data-resources";
import type { ServerSession } from "@/lib/server/auth-session";
import type { UserRole } from "@/lib/user-accounts";

type ResourceAccessPolicy = {
  read: readonly UserRole[];
  write: readonly UserRole[];
  create?: readonly UserRole[];
  update?: readonly UserRole[];
  delete?: readonly UserRole[];
};

const ALL_AUTHENTICATED_ROLES = [
  "administrador",
  "gestor",
  "operador",
  "consulta",
] as const satisfies readonly UserRole[];

const ADMIN_AND_MANAGER = [
  "administrador",
  "gestor",
] as const satisfies readonly UserRole[];

const OPERATIONAL_WRITERS = [
  "administrador",
  "gestor",
  "operador",
] as const satisfies readonly UserRole[];

export class ErpAccessDeniedError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

export const ERP_RESOURCE_ACCESS: Record<ErpResourceId, ResourceAccessPolicy> = {
  "inventory.locations": {
    read: ALL_AUTHENTICATED_ROLES,
    write: ADMIN_AND_MANAGER,
  },
  "inventory.movements": {
    read: ALL_AUTHENTICATED_ROLES,
    write: OPERATIONAL_WRITERS,
    delete: ADMIN_AND_MANAGER,
  },
  "operations.products": {
    read: ALL_AUTHENTICATED_ROLES,
    write: ADMIN_AND_MANAGER,
  },
  "operations.lots": {
    read: ALL_AUTHENTICATED_ROLES,
    write: OPERATIONAL_WRITERS,
    delete: ADMIN_AND_MANAGER,
  },
  "operations.suppliers": {
    read: ALL_AUTHENTICATED_ROLES,
    write: ADMIN_AND_MANAGER,
  },
  "operations.categories": {
    read: ALL_AUTHENTICATED_ROLES,
    write: ADMIN_AND_MANAGER,
  },
  "operations.notifications": {
    read: ALL_AUTHENTICATED_ROLES,
    write: OPERATIONAL_WRITERS,
  },
  "operations.quality-events": {
    read: ALL_AUTHENTICATED_ROLES,
    write: OPERATIONAL_WRITERS,
    delete: ADMIN_AND_MANAGER,
  },
  "operations.planning": {
    read: ALL_AUTHENTICATED_ROLES,
    write: ADMIN_AND_MANAGER,
  },
  "operations.reports": {
    read: ALL_AUTHENTICATED_ROLES,
    write: ADMIN_AND_MANAGER,
  },
  "operations.pending": {
    read: ALL_AUTHENTICATED_ROLES,
    write: OPERATIONAL_WRITERS,
  },
  "operations.tasks": {
    read: ALL_AUTHENTICATED_ROLES,
    write: OPERATIONAL_WRITERS,
  },
  "operations.distributors": {
    read: ALL_AUTHENTICATED_ROLES,
    write: ADMIN_AND_MANAGER,
  },
  "operations.incidents": {
    read: ALL_AUTHENTICATED_ROLES,
    write: OPERATIONAL_WRITERS,
  },
  "operations.documents": {
    read: ALL_AUTHENTICATED_ROLES,
    write: OPERATIONAL_WRITERS,
    delete: ADMIN_AND_MANAGER,
  },
  "operations.calendar": {
    read: ALL_AUTHENTICATED_ROLES,
    write: OPERATIONAL_WRITERS,
  },
  "user.accounts": {
    read: ADMIN_AND_MANAGER,
    write: ["administrador"],
  },
};

function isRoleAllowed(role: UserRole, allowedRoles: readonly UserRole[]) {
  return allowedRoles.includes(role);
}

export function assertCanReadErpResource(session: ServerSession, resource: ErpResourceId) {
  const policy = ERP_RESOURCE_ACCESS[resource];

  if (!isRoleAllowed(session.role, policy.read)) {
    throw new ErpAccessDeniedError("Seu perfil nao pode consultar esse recurso do ERP.");
  }
}

export function assertCanWriteErpResource(session: ServerSession, resource: ErpResourceId) {
  const policy = ERP_RESOURCE_ACCESS[resource];

  if (!isRoleAllowed(session.role, policy.write)) {
    throw new ErpAccessDeniedError("Seu perfil nao pode alterar esse recurso do ERP.");
  }
}

export function assertCanCreateErpResource(session: ServerSession, resource: ErpResourceId) {
  const policy = ERP_RESOURCE_ACCESS[resource];

  if (!isRoleAllowed(session.role, policy.create ?? policy.write)) {
    throw new ErpAccessDeniedError("Seu perfil nao pode criar esse recurso do ERP.");
  }
}

export function assertCanUpdateErpResource(session: ServerSession, resource: ErpResourceId) {
  const policy = ERP_RESOURCE_ACCESS[resource];

  if (!isRoleAllowed(session.role, policy.update ?? policy.write)) {
    throw new ErpAccessDeniedError("Seu perfil nao pode atualizar esse recurso do ERP.");
  }
}

export function assertCanDeleteErpResource(session: ServerSession, resource: ErpResourceId) {
  const policy = ERP_RESOURCE_ACCESS[resource];

  if (!isRoleAllowed(session.role, policy.delete ?? policy.write)) {
    throw new ErpAccessDeniedError("Seu perfil nao pode excluir esse recurso do ERP.");
  }
}
