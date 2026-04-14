import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { LocaleProvider } from "@/components/providers/LocaleProvider";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <LocaleProvider>
      <DashboardShell>{children}</DashboardShell>
    </LocaleProvider>
  );
}
