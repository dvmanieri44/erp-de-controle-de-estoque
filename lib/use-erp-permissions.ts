"use client";

import { useEffect, useMemo, useState } from "react";

import type { ErpResourceId } from "@/lib/erp-data-resources";
import { canRoleAccessErpResource } from "@/lib/erp-resource-access";
import type { UserAccount, UserRole } from "@/lib/user-accounts";

type ErpSessionState = {
  authenticated: boolean;
  account: UserAccount | null;
  username: string | null;
  role: UserRole | null;
  expiresAt: string | null;
  isLoading: boolean;
};

const EMPTY_SESSION: ErpSessionState = {
  authenticated: false,
  account: null,
  username: null,
  role: null,
  expiresAt: null,
  isLoading: true,
};

function canUseAction(
  role: UserRole | null,
  resource: ErpResourceId,
  action: "create" | "update" | "delete" | "cancel" | "close" | "backfill",
) {
  return canRoleAccessErpResource(role, resource, action);
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

export function canCancel(role: UserRole | null, resource: ErpResourceId) {
  return canUseAction(role, resource, "cancel");
}

export function canClose(role: UserRole | null, resource: ErpResourceId) {
  return canUseAction(role, resource, "close");
}

export function canBackfill(role: UserRole | null, resource: ErpResourceId) {
  return canUseAction(role, resource, "backfill");
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
      canCancel: (resource: ErpResourceId) => canCancel(session.role, resource),
      canClose: (resource: ErpResourceId) => canClose(session.role, resource),
      canBackfill: (resource: ErpResourceId) =>
        canBackfill(session.role, resource),
    }),
    [session],
  );
}
