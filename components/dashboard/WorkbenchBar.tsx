"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DASHBOARD_SECTIONS } from "@/lib/dashboard-sections";
import { LOTS, NOTIFICATIONS, PRODUCT_LINES } from "@/lib/operations-data";
import { loadLocations, loadMovements } from "@/lib/inventory";

type SearchItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function WorkbenchBar() {
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
    const sections = DASHBOARD_SECTIONS.map((section) => ({
      id: `section-${section.id}`,
      title: section.label,
      subtitle: "Módulo do sistema",
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
  }, []);

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
          <span className="truncate">Buscar por módulo, SKU, lote ou item operacional</span>
          <span className="ml-auto rounded-lg bg-[var(--panel)] px-2 py-1 text-[11px] font-semibold text-[var(--muted-foreground)]">
            Ctrl K
          </span>
        </button>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-2xl bg-[var(--panel-soft)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Alertas</p>
            <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{NOTIFICATIONS.filter((item) => item.status !== "Concluída").length} em aberto</p>
          </div>
          <div className="rounded-2xl bg-[var(--panel-soft)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Base</p>
            <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{locationsCount} localizações · {movementsCount} eventos</p>
          </div>
          <div className="rounded-2xl bg-[var(--panel-soft)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Ambiente</p>
            <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">Modo demo operacional</p>
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
                placeholder="Buscar módulos, SKUs, lotes e itens"
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
                  Nenhum item encontrado para essa busca.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
