"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { USER_ACCOUNTS_EVENT } from "@/lib/app-events";
import { hasActiveUserSession } from "@/lib/user-accounts";

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const syncSession = () => {
      const authorized = hasActiveUserSession();

      setIsAuthorized(authorized);
      setIsReady(true);

      if (!authorized) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      }
    };

    syncSession();
    window.addEventListener("storage", syncSession);
    window.addEventListener(USER_ACCOUNTS_EVENT, syncSession);

    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener(USER_ACCOUNTS_EVENT, syncSession);
    };
  }, [pathname, router]);

  if (!isReady || !isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6">
        <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] px-6 py-5 text-center shadow-[0_18px_42px_var(--shadow-color)]">
          <p className="text-sm font-semibold text-[var(--foreground)]">Validando sessao...</p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">Redirecionando para a tela de login.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
