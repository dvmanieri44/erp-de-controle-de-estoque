import type { ReactNode } from "react";

import { SidebarMenu } from "@/components/dashboard/SidebarMenu";

type DashboardShellProps = {
  children: ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-[var(--background)] md:flex">
      <SidebarMenu />
      <main className="flex-1 bg-[var(--panel)] p-6 md:p-10">{children}</main>
    </div>
  );
}
