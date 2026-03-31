"use client";

import { type ReactNode } from "react";

import { SidebarMenu } from "@/components/dashboard/SidebarMenu";

type DashboardShellProps = {
  children: ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-[var(--background)] md:flex">
      <SidebarMenu orientation="lateral" behavior="fixo" />
      <main className="min-w-0 flex-1 p-4 md:p-5">
        <div className="min-h-[calc(100vh-2.5rem)] rounded-[26px] border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_6px_18px_var(--shadow-color)] transition-colors md:p-5">
          {children}
        </div>
      </main>
    </div>
  );
}
