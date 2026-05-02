"use client";

import { useEffect, useMemo, useState } from "react";

import type { ErpResourceId } from "@/lib/erp-data-resources";
import type { UserAccount, UserRole } from "@/lib/user-accounts";

type ResourceAccessPolicy = {
  read: readonly UserRole[];
  write: readonly UserRole[];
  create?: readonly UserRole[];
  update?: readonly UserRole[];
  delete?: readonly UserRole[];
};

type ErpSessionState = {
  authenticated: boolean;
  account: UserAccount | null;
  username: string | null;
  role: UserRole | null;
  expiresAt: string | null;
  isLoading: boolean;
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

const ERP_CLIENT_RESOURCE_ACCESS: Record<ErpResourceId, ResourceAccessPolicy> = {
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

const EMPTY_SESSION: ErpSessionState = {
  authenticated: false,
  account: null,
  username: null,
  role: null,
  expiresAt: null,
  isLoading: true,
};

function isRoleAllowed(role: UserRole | null, allowedRoles: readonly UserRole[]) {
  return role ? allowedRoles.includes(role) : false;
}

function canUseAction(
  role: UserRole | null,
  resource: ErpResourceId,
  action: "create" | "update" | "delete",
) {
  const policy = ERP_CLIENT_RESOURCE_ACCESS[resource];
  return isRoleAllowed(role, policy[action] ?? policy.write);
}

export function canCreate(role: UserRole | null, resource: ErpResourceId) {
  return canUseAction(role, resource, "create");
}

export function canUpdate(role: UserRole | null, resource: ErpResourceId) {
  return canUseAction(role, resource, "update");
}

export function canDelete(role: UserRole | null, resource: ErpResourceId) {
  return canUseAction(role, resource, "delete");
}

export function useErpSession() {
  const [session, setSession] = useState<ErpSessionState>(EMPTY_SESSION);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const payload = (await response.json()) as Partial<ErpSessionState>;

        if (!isMounted) {
          return;
        }

        if (!response.ok || !payload.authenticated) {
          setSession({ ...EMPTY_SESSION, isLoading: false });
          return;
        }

        setSession({
          authenticated: true,
          account: payload.account ?? null,
          username: payload.username ?? null,
          role: payload.role ?? null,
          expiresAt: payload.expiresAt ?? null,
          isLoading: false,
        });
      } catch {
        if (isMounted) {
          setSession({ ...EMPTY_SESSION, isLoading: false });
        }
      }
    }

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  return session;
}

export function useErpPermissions() {
  const session = useErpSession();

  return useMemo(
    () => ({
      ...session,
      canCreate: (resource: ErpResourceId) => canCreate(session.role, resource),
      canUpdate: (resource: ErpResourceId) => canUpdate(session.role, resource),
      canDelete: (resource: ErpResourceId) => canDelete(session.role, resource),
    }),
    [session],
  );
}
