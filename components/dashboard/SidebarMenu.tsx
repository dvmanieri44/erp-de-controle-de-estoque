"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DASHBOARD_SECTIONS, DEFAULT_SECTION_ID } from "@/lib/dashboard-sections";

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

function EntryIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M6 20h12a2 2 0 0 0 2-2V9l-6-6H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      <path d="M12 16V9" />
      <path d="m9 12 3-3 3 3" />
    </svg>
  );
}

function OutputIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M6 20h12a2 2 0 0 0 2-2V9l-6-6H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      <path d="M12 9v7" />
      <path d="m9 13 3 3 3-3" />
    </svg>
  );
}

function LotsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 12h8M8 15h5" />
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

function ReportsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M6 20h12a2 2 0 0 0 2-2V9l-6-6H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      <path d="M9 15h6M9 11h6" />
    </svg>
  );
}

const SECTION_ICONS = {
  dashboard: DashboardIcon,
  produtos: ProductsIcon,
  entradas: EntryIcon,
  saidas: OutputIcon,
  lotes: LotsIcon,
  movimentacoes: MovesIcon,
  relatorios: ReportsIcon,
} as const;

export function SidebarMenu() {
  const pathname = usePathname();

  return (
    <aside className="flex w-full flex-col bg-[var(--navy-900)] p-6 text-white md:min-h-screen md:w-72">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-100)]">
          ERP
        </p>
        <h1 className="mt-2 text-2xl font-bold">
          <span className="text-white">Good</span>
          <span className="text-sky-300">Stock</span>
        </h1>
      </div>

      <nav aria-label="Menu principal">
        <ul className="space-y-2">
          {DASHBOARD_SECTIONS.map((section) => {
            const href = getSectionHref(section.id);
            const isActive = pathname === href;
            const Icon = SECTION_ICONS[section.id as keyof typeof SECTION_ICONS] ?? DashboardIcon;

            return (
              <li key={section.id}>
                <Link
                  href={href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-white text-[var(--navy-900)]"
                      : "text-[var(--navy-100)] hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {section.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className="mt-8 border-t border-white/15 pt-4 text-xs font-medium tracking-wide text-sky-300/90 md:mt-auto">
        v1.001 | UNIVESP PI
      </p>
    </aside>
  );
}
