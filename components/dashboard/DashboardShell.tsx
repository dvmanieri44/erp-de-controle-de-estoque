"use client";

import { useEffect, useState, type ReactNode } from "react";

import { SidebarMenu } from "@/components/dashboard/SidebarMenu";
import {
  isNavigationBehavior,
  isNavigationLayout,
  NAVIGATION_BEHAVIOR_KEY,
  NAVIGATION_LAYOUT_KEY,
  UI_PREFERENCES_EVENT,
  type NavigationBehavior,
  type NavigationLayout,
} from "@/lib/ui-preferences";

type DashboardShellProps = {
  children: ReactNode;
};


var teste = 1

export function DashboardShell({ children }: DashboardShellProps) {
  const [navigationLayout, setNavigationLayout] = useState<NavigationLayout>("lateral");
  const [navigationBehavior, setNavigationBehavior] = useState<NavigationBehavior>("fixo");

  useEffect(() => {
    const syncNavigationPreferences = () => {
      const storedLayout = window.localStorage.getItem(NAVIGATION_LAYOUT_KEY);
      const storedBehavior = window.localStorage.getItem(NAVIGATION_BEHAVIOR_KEY);

      setNavigationLayout(isNavigationLayout(storedLayout) ? storedLayout : "lateral");
      setNavigationBehavior(isNavigationBehavior(storedBehavior) ? storedBehavior : "fixo");
    };

    syncNavigationPreferences();

    window.addEventListener("storage", syncNavigationPreferences);
    window.addEventListener(UI_PREFERENCES_EVENT, syncNavigationPreferences);

    return () => {
      window.removeEventListener("storage", syncNavigationPreferences);
      window.removeEventListener(UI_PREFERENCES_EVENT, syncNavigationPreferences);
    };
  }, []);

  return (
    <div className={`min-h-screen bg-[var(--background)] ${navigationLayout === "lateral" ? "md:flex" : ""}`}>
      <SidebarMenu orientation={navigationLayout} behavior={navigationBehavior} />
      <main className="flex-1 p-4 md:p-5">
        <div className="min-h-[calc(100vh-2.5rem)] rounded-[26px] border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_6px_18px_var(--shadow-color)] transition-colors md:p-5">
          {children}
        </div>
      </main>
    </div>
  );
}
