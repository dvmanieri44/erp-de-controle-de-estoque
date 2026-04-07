"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useLocale } from "@/components/providers/LocaleProvider";
import { getDashboardSections } from "@/lib/dashboard-sections";
import { LOTS, NOTIFICATIONS, PRODUCT_LINES } from "@/lib/operations-data";
import { loadLocations, loadMovements } from "@/lib/inventory";

type SearchItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

const COPY = {
  "pt-BR": {
    sectionSubtitle: "Módulo do sistema",
    searchPrompt: "Buscar por módulo, SKU, lote ou item operacional",
    searchPlaceholder: "Buscar módulos, SKUs, lotes e itens",
    alerts: "Alertas",
    openAlerts: "em aberto",
    base: "Base",
    baseSummary: "{locations} localizações · {movements} eventos",
    environment: "Ambiente",
    demoMode: "Modo demo operacional",
    noResults: "Nenhum item encontrado para essa busca.",
  },
  "en-US": {
    sectionSubtitle: "System module",
    searchPrompt: "Search by module, SKU, lot or operational item",
    searchPlaceholder: "Search modules, SKUs, lots and items",
    alerts: "Alerts",
    openAlerts: "open",
    base: "Base",
    baseSummary: "{locations} locations · {movements} events",
    environment: "Environment",
    demoMode: "Operational demo mode",
    noResults: "No items found for this search.",
  },
  "es-ES": {
    sectionSubtitle: "Módulo del sistema",
    searchPrompt: "Buscar por módulo, SKU, lote o ítem operativo",
    searchPlaceholder: "Buscar módulos, SKUs, lotes e ítems",
    alerts: "Alertas",
    openAlerts: "abiertas",
    base: "Base",
    baseSummary: "{locations} ubicaciones · {movements} eventos",
    environment: "Entorno",
    demoMode: "Modo demo operativo",
    noResults: "No se encontró ningún elemento para esta búsqueda.",
  },
} as const;

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function WorkbenchBar() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [locationsCount, setLocationsCount] = useState(0);
  const [movementsCount, setMovementsCount] = useState(0);

  useEffect(() => {
    const sync = () => {
      setLocationsCount(loadLocations().length);
      setMovementsCount(loadMovements().length);
    };

    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const items = useMemo<SearchItem[]>(() => {
    const sections = getDashboardSections(locale).map((section) => ({
      id: `section-${section.id}`,
      title: section.label,
      subtitle: copy.sectionSubtitle,
      href: section.id === "dashboard" ? "/dashboard" : `/dashboard/${section.id}`,
    }));

    const products = PRODUCT_LINES.map((item) => ({
      id: `product-${item.sku}`,
      title: item.product,
      subtitle: `SKU ${item.sku}`,
      href: "/dashboard/produtos",
    }));

    const lots = LOTS.map((item) => ({
      id: `lot-${item.code}`,
      title: item.code,
      subtitle: item.product,
      href: "/dashboard/lotes",
    }));

    return [...sections, ...products, ...lots];
  }, [copy.sectionSubtitle, locale]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items.slice(0, 8);
    }

    return items
      .filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(normalized))
      .slice(0, 10);
  }, [items, query]);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 shadow-[0_6px_18px_var(--shadow-color)] md:flex-row md:items-center md:justify-between">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-3 text-left text-sm text-[var(--muted-foreground)] transition hover:bg-[var(--panel)] md:min-w-[360px]"
        >
          <SearchIcon />
          <span className="truncate">{copy.searchPrompt}</span>
          <span className="ml-auto rounded-lg bg-[var(--panel)] px-2 py-1 text-[11px] font-semibold text-[var(--muted-foreground)]">
            Ctrl K
          </span>
        </button>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-2xl bg-[var(--panel-soft)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{copy.alerts}</p>
            <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
              {NOTIFICATIONS.filter((item) => !item.status.toLowerCase().includes("concl")).length} {copy.openAlerts}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--panel-soft)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{copy.base}</p>
            <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{copy.baseSummary.replace("{locations}", String(locationsCount)).replace("{movements}", String(movementsCount))}</p>
          </div>
          <div className="rounded-2xl bg-[var(--panel-soft)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{copy.environment}</p>
            <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{copy.demoMode}</p>
          </div>
        </div>
      </div>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-12"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div className="w-full max-w-3xl rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-3">
              <SearchIcon />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
                className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none"
                autoFocus
              />
            </div>

            <div className="mt-4 space-y-3">
              {filtered.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="block rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-3 transition hover:bg-[var(--panel)]"
                >
                  <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.subtitle}</p>
                </Link>
              ))}
              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-6 text-sm text-[var(--muted-foreground)]">
                  {copy.noResults}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
