"use client";

import { useMemo } from "react";

import {
  getProductsWithDerivedStock,
  PRODUCT_STATUS_ATTENTION,
  PRODUCT_STATUS_CRITICAL,
  PRODUCT_STATUS_STABLE,
  toneByLabel,
  useInventoryData,
} from "@/components/dashboard/operations/module-helpers";
import {
  Hero,
  Panel,
  StatusPill,
  SummaryCard,
} from "@/components/dashboard/operations/ui";
import { useOperationsCollection } from "@/components/dashboard/operations/useOperationsCollection";
import type { DashboardSection } from "@/lib/dashboard-sections";
import { loadProductLines } from "@/lib/operations-store";

export function LowStockModule({ section }: { section: DashboardSection }) {
  const [storedProducts] = useOperationsCollection(loadProductLines);
  const { movements } = useInventoryData();
  const products = useMemo(
    () => getProductsWithDerivedStock(storedProducts, movements),
    [movements, storedProducts],
  );
  const criticalItems = products.filter(
    (item) => item.status !== PRODUCT_STATUS_STABLE,
  );

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Alertas" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Total em Alerta"
          value={String(criticalItems.length)}
          helper="Produtos com necessidade de reposicao"
          tone="warning"
        />
        <SummaryCard
          title="Critico"
          value={String(
            criticalItems.filter(
              (item) => item.status === PRODUCT_STATUS_CRITICAL,
            ).length,
          )}
          helper="Necessitam acao imediata"
          tone="danger"
        />
        <SummaryCard
          title="Atencao"
          value={String(
            criticalItems.filter(
              (item) => item.status === PRODUCT_STATUS_ATTENTION,
            ).length,
          )}
          helper="Planejar reabastecimento em breve"
          tone="warning"
        />
      </div>

      <Panel title="Estoque critico" eyebrow="Prioridade">
        <div className="space-y-4">
          {criticalItems.map((item) => {
            const suggested =
              Math.max(0, item.target - item.stock) + Math.round(item.target * 0.3);
            const tone =
              item.status === PRODUCT_STATUS_CRITICAL
                ? "border-l-4 border-l-rose-500"
                : "border-l-4 border-l-amber-500";

            return (
              <article
                key={item.sku}
                className={`rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-5 ${tone}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xl font-semibold text-[var(--foreground)]">
                        {item.product}
                      </p>
                      <StatusPill
                        label={item.status}
                        tone={toneByLabel(item.status)}
                      />
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      SKU {item.sku}
                    </p>
                  </div>
                  <div className="text-left lg:text-right">
                    <p
                      className={`text-4xl font-semibold tracking-[-0.04em] ${
                        item.status === PRODUCT_STATUS_CRITICAL
                          ? "text-rose-600"
                          : "text-amber-600"
                      }`}
                    >
                      {item.stock}
                    </p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Quantidade atual
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 text-sm md:grid-cols-4">
                  <div>
                    <p className="text-[var(--muted-foreground)]">Minimo</p>
                    <p className="mt-1 font-semibold text-[var(--foreground)]">
                      {item.target}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--muted-foreground)]">Cobertura</p>
                    <p className="mt-1 font-semibold text-[var(--foreground)]">
                      {item.coverageDays} dias
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--muted-foreground)]">Linha</p>
                    <p className="mt-1 font-semibold text-[var(--foreground)]">
                      {item.line}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--muted-foreground)]">Categoria</p>
                    <p className="mt-1 font-semibold text-[var(--foreground)]">
                      {item.stage}
                    </p>
                  </div>
                </div>

                <div
                  className={`mt-5 rounded-2xl px-4 py-3 text-sm ${
                    item.status === PRODUCT_STATUS_CRITICAL
                      ? "bg-rose-50 text-rose-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  <span className="font-semibold">Acao recomendada:</span>{" "}
                  {item.status === PRODUCT_STATUS_CRITICAL
                    ? "reabastecer imediatamente."
                    : "planejar reabastecimento em breve."}{" "}
                  Quantidade sugerida: {suggested} unidades.
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
    </section>
  );
}
