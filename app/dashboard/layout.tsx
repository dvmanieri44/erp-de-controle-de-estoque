import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthGate } from "@/components/providers/AuthGate";
import { LocaleProvider } from "@/components/providers/LocaleProvider";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <LocaleProvider>
      <AuthGate>
        <DashboardShell>{children}</DashboardShell>
      </AuthGate>
    </LocaleProvider>
  );
}
