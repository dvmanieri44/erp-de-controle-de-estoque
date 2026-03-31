"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  DASHBOARD_GROUPS,
  DASHBOARD_SECTIONS,
  DEFAULT_SECTION_ID,
  type DashboardSection,
} from "@/lib/dashboard-sections";
import type { NavigationBehavior, NavigationLayout } from "@/lib/ui-preferences";

function getSectionHref(sectionId: string) {
  return sectionId === DEFAULT_SECTION_ID ? "/dashboard" : `/dashboard/${sectionId}`;
}

type IconProps = {
  className?: string;
};

function DashboardIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" />
      <rect x="13" y="10" width="8" height="11" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}

function ProductsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 8.5 12 4l8 4.5-8 4.5L4 8.5Z" />
      <path d="M4 8.5V16l8 4 8-4V8.5" />
      <path d="M12 13v7" />
    </svg>
  );
}

function MovesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 7h12" />
      <path d="m13 4 3 3-3 3" />
      <path d="M20 17H8" />
      <path d="m11 14-3 3 3 3" />
    </svg>
  );
}

function AlertIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 4 4 19h16L12 4Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="16.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LotsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M3.5 8.5 12 4l8.5 4.5L12 13 3.5 8.5Z" />
      <path d="M3.5 8.5V16L12 20l8.5-4V8.5" />
      <path d="M12 13v7" />
    </svg>
  );
}

function SuppliersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="9" cy="9" r="3" />
      <path d="M4 18a5 5 0 0 1 10 0" />
      <path d="M16 8h4M18 6v4" />
    </svg>
  );
}

function CategoriesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5v8A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-10Z" />
    </svg>
  );
}

function LocationsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 20s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function TransferIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M7 7h11" />
      <path d="m15 4 3 3-3 3" />
      <path d="M17 17H6" />
      <path d="m9 14-3 3 3 3" />
    </svg>
  );
}

function ReportsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M6 20h12a2 2 0 0 0 2-2V9l-6-6H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      <path d="M9 15h6M9 11h6" />
    </svg>
  );
}

function AnalyticsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 16 9 11l3 3 6-7" />
      <path d="M4 20h16" />
    </svg>
  );
}

function HistoryIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function SettingsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 3.75a2.25 2.25 0 0 1 2.21 1.82l.1.49a1.5 1.5 0 0 0 2.12 1.05l.46-.22a2.25 2.25 0 0 1 2.8.74 2.25 2.25 0 0 1-.28 2.88l-.36.35a1.5 1.5 0 0 0 0 2.12l.36.35a2.25 2.25 0 0 1 .28 2.88 2.25 2.25 0 0 1-2.8.74l-.46-.22a1.5 1.5 0 0 0-2.12 1.05l-.1.49a2.25 2.25 0 0 1-4.42 0l-.1-.49a1.5 1.5 0 0 0-2.12-1.05l-.46.22a2.25 2.25 0 0 1-2.8-.74 2.25 2.25 0 0 1 .28-2.88l.36-.35a1.5 1.5 0 0 0 0-2.12l-.36-.35a2.25 2.25 0 0 1-.28-2.88 2.25 2.25 0 0 1 2.8-.74l.46.22a1.5 1.5 0 0 0 2.12-1.05l.1-.49A2.25 2.25 0 0 1 12 3.75Z" />
      <circle cx="12" cy="12" r="3.25" />
    </svg>
  );
}

function LogoutIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M10 17v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2" />
      <path d="M21 12H9" />
      <path d="m18 9 3 3-3 3" />
    </svg>
  );
}

function MenuIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

const SECTION_ICONS = {
  dashboard: DashboardIcon,
  produtos: ProductsIcon,
  movimentacoes: MovesIcon,
  "estoque-baixo": AlertIcon,
  lotes: LotsIcon,
  fornecedores: SuppliersIcon,
  categorias: CategoriesIcon,
  localizacoes: LocationsIcon,
  transferencias: TransferIcon,
  relatorios: ReportsIcon,
  analytics: AnalyticsIcon,
  historico: HistoryIcon,
  configuracoes: SettingsIcon,
} as const;

function NavigationLink({
  section,
  pathname,
  compact = false,
  collapsed = false,
}: {
  section: DashboardSection;
  pathname: string;
  compact?: boolean;
  collapsed?: boolean;
}) {
  const href = getSectionHref(section.id);
  const isActive = pathname === href;
  const Icon = SECTION_ICONS[section.id as keyof typeof SECTION_ICONS] ?? DashboardIcon;

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl transition ${
        compact
          ? "px-3 py-2 text-xs font-medium"
          : collapsed
            ? "justify-center px-3 py-3 text-sm font-medium"
            : "px-3 py-2.5 text-sm font-medium"
      } ${
        isActive
          ? "bg-[var(--sidebar-active)] text-[var(--sidebar-active-text)]"
          : "text-[var(--muted-foreground)] hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)]"
      }`}
      title={collapsed ? section.label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {collapsed ? null : <span>{section.label}</span>}
    </Link>
  );
}

function SideNavigation({
  pathname,
  behavior,
}: {
  pathname: string;
  behavior: NavigationBehavior;
}) {
  const [isExpanded, setIsExpanded] = useState(behavior === "fixo");
  const collapsed = behavior === "expansivel" && !isExpanded;

  useEffect(() => {
    setIsExpanded(behavior === "fixo");
  }, [behavior]);

  return (
    <aside
      className={`flex w-full flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] px-3 py-5 transition-all transition-colors md:sticky md:top-0 md:h-screen md:self-start ${
        collapsed ? "md:w-[92px]" : "md:w-[258px]"
      }`}
    >
      <div className={`mb-6 flex items-center px-2 ${collapsed ? "justify-center" : "justify-between"}`}>
        {collapsed ? null : (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">GoodStock</p>
        )}
        {behavior === "expansivel" ? (
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] text-[var(--muted-foreground)]"
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            <MenuIcon className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <nav aria-label="Menu principal" className="flex-1 overflow-y-auto pr-1">
        <div className="space-y-5">
          {DASHBOARD_GROUPS.map((group) => {
            const sections = DASHBOARD_SECTIONS.filter((section) => section.group === group.id);

            return (
              <section key={group.id}>
                {collapsed ? null : (
                  <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                    {group.label}
                  </p>
                )}
                <div className="space-y-1">
                  {sections.map((section) => (
                    <NavigationLink key={section.id} section={section} pathname={pathname} collapsed={collapsed} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </nav>

      <div className="mt-4 border-t border-[var(--sidebar-border)] pt-4">
        <div className="space-y-1">
          {DASHBOARD_SECTIONS.filter((section) => section.group === "configuracoes").map((section) => (
            <NavigationLink key={section.id} section={section} pathname={pathname} collapsed={collapsed} />
          ))}
        </div>

        <div className={`mt-4 flex rounded-2xl bg-[var(--panel-soft)] px-3 py-3 ${collapsed ? "justify-center" : "items-center gap-3"}`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)]/15 text-sm font-semibold text-[var(--accent)]">
            JS
          </div>
          {collapsed ? null : (
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">João Silva</p>
              <p className="text-xs text-[var(--muted-foreground)]">Usuário ativo</p>
            </div>
          )}
        </div>

        <button
          type="button"
          className={`mt-3 inline-flex items-center text-sm font-semibold text-[#d74b4b] transition hover:opacity-80 ${
            collapsed ? "justify-center px-3 py-2" : "gap-2 px-3 py-2"
          }`}
          title={collapsed ? "Sair" : undefined}
        >
          <LogoutIcon className="h-4 w-4" />
          {collapsed ? null : "Sair"}
        </button>
      </div>
    </aside>
  );
}

function TopNavigation({
  pathname,
  behavior,
}: {
  pathname: string;
  behavior: NavigationBehavior;
}) {
  const mainSections = DASHBOARD_SECTIONS.filter((section) => section.group !== "configuracoes");
  const configSection = DASHBOARD_SECTIONS.find((section) => section.group === "configuracoes");
  const [isExpanded, setIsExpanded] = useState(behavior === "fixo");
  const showMenu = behavior === "fixo" || isExpanded;

  useEffect(() => {
    setIsExpanded(behavior === "fixo");
  }, [behavior]);

  return (
    <header className="border-b border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] px-4 py-4 transition-colors md:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          {behavior === "expansivel" ? (
            <button
              type="button"
              onClick={() => setIsExpanded((current) => !current)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] text-[var(--muted-foreground)]"
              title={showMenu ? "Recolher menu" : "Expandir menu"}
            >
              <MenuIcon className="h-4 w-4" />
            </button>
          ) : null}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">GoodStock</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">ERP de controle de estoque</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-[var(--panel-soft)] px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)]/15 text-sm font-semibold text-[var(--accent)]">
            JS
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">João Silva</p>
            <p className="text-xs text-[var(--muted-foreground)]">Usuário ativo</p>
          </div>
        </div>
      </div>

      {showMenu ? (
        <nav aria-label="Menu superior" className="mt-4 flex flex-wrap gap-2">
          {mainSections.map((section) => (
            <div key={section.id} className="min-w-fit">
              <NavigationLink section={section} pathname={pathname} compact />
            </div>
          ))}
          {configSection ? <NavigationLink section={configSection} pathname={pathname} compact /> : null}
        </nav>
      ) : null}
    </header>
  );
}

export function SidebarMenu({
  orientation = "lateral",
  behavior = "fixo",
}: {
  orientation?: NavigationLayout;
  behavior?: NavigationBehavior;
}) {
  const pathname = usePathname();

  if (orientation === "superior") {
    return <TopNavigation pathname={pathname} behavior={behavior} />;
  }

  return <SideNavigation pathname={pathname} behavior={behavior} />;
}
