import type { ErpResourceId } from "@/lib/erp-data-resources";
import type { UserRole } from "@/lib/user-accounts";

export type ResourceAccessPolicy = {
  read: readonly UserRole[];
  write: readonly UserRole[];
  create?: readonly UserRole[];
  update?: readonly UserRole[];
  delete?: readonly UserRole[];
};

export type ErpResourceAccessAction =
  | "read"
  | "write"
  | "create"
  | "update"
  | "delete";

export type ErpResourceDerivedAction =
  | ErpResourceAccessAction
  | "cancel"
  | "close"
  | "backfill";

export const ALL_AUTHENTICATED_ROLES = [
  "administrador",
  "gestor",
  "operador",
  "consulta",
] as const satisfies readonly UserRole[];

export const ADMIN_AND_MANAGER = [
  "administrador",
  "gestor",
] as const satisfies readonly UserRole[];

export const OPERATIONAL_WRITERS = [
  "administrador",
  "gestor",
  "operador",
] as const satisfies readonly UserRole[];

export const ERP_RESOURCE_ACCESS: Record<ErpResourceId, ResourceAccessPolicy> = {
  "inventory.locations": {
    read: ALL_AUTHENTICATED_ROLES,
    write: ADMIN_AND_MANAGER,
    create: ADMIN_AND_MANAGER,
    update: ADMIN_AND_MANAGER,
    delete: ADMIN_AND_MANAGER,
  },
  "inventory.movements": {
    read: ALL_AUTHENTICATED_ROLES,
    write: OPERATIONAL_WRITERS,
    create: OPERATIONAL_WRITERS,
    update: OPERATIONAL_WRITERS,
    delete: ADMIN_AND_MANAGER,
  },
  "operations.products": {
    read: ALL_AUTHENTICATED_ROLES,
    write: ADMIN_AND_MANAGER,
    create: ADMIN_AND_MANAGER,
    update: ADMIN_AND_MANAGER,
    delete: ADMIN_AND_MANAGER,
  },
  "operations.lots": {
    read: ALL_AUTHENTICATED_ROLES,
    write: OPERATIONAL_WRITERS,
    create: OPERATIONAL_WRITERS,
    update: OPERATIONAL_WRITERS,
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
    create: OPERATIONAL_WRITERS,
    update: OPERATIONAL_WRITERS,
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
    create: OPERATIONAL_WRITERS,
    update: OPERATIONAL_WRITERS,
    delete: ADMIN_AND_MANAGER,
  },
  "operations.tasks": {
    read: ALL_AUTHENTICATED_ROLES,
    write: OPERATIONAL_WRITERS,
    create: OPERATIONAL_WRITERS,
    update: OPERATIONAL_WRITERS,
    delete: ADMIN_AND_MANAGER,
  },
  "operations.distributors": {
    read: ALL_AUTHENTICATED_ROLES,
    write: ADMIN_AND_MANAGER,
  },
  "operations.incidents": {
    read: ALL_AUTHENTICATED_ROLES,
    write: OPERATIONAL_WRITERS,
    create: OPERATIONAL_WRITERS,
    update: OPERATIONAL_WRITERS,
    delete: ADMIN_AND_MANAGER,
  },
  "operations.documents": {
    read: ALL_AUTHENTICATED_ROLES,
    write: OPERATIONAL_WRITERS,
    create: OPERATIONAL_WRITERS,
    update: OPERATIONAL_WRITERS,
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

export function resolveErpResourceAction(
  action: ErpResourceDerivedAction,
): ErpResourceAccessAction {
  if (action === "cancel" || action === "close") {
    return "update";
  }

  if (action === "backfill") {
    return "delete";
  }

  return action;
}

export function isErpRoleAllowed(
  role: UserRole | null | undefined,
  allowedRoles: readonly UserRole[],
) {
  return role ? allowedRoles.includes(role) : false;
}

export function getErpResourceAccessPolicy(resource: ErpResourceId) {
  return ERP_RESOURCE_ACCESS[resource];
}

export function canRoleAccessErpResource(
  role: UserRole | null | undefined,
  resource: ErpResourceId,
  action: ErpResourceDerivedAction,
) {
  const policy = getErpResourceAccessPolicy(resource);
  const resolvedAction = resolveErpResourceAction(action);

  if (resolvedAction === "read") {
    return isErpRoleAllowed(role, policy.read);
  }

  if (resolvedAction === "write") {
    return isErpRoleAllowed(role, policy.write);
  }

  return isErpRoleAllowed(role, policy[resolvedAction] ?? policy.write);
}
