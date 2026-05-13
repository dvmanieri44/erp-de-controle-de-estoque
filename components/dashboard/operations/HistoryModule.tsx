"use client";

import { useMemo, useState } from "react";

import {
  FilterBar,
  useInventoryData,
} from "@/components/dashboard/operations/module-helpers";
import {
  ActionButton,
  Hero,
  Panel,
  StatusPill,
  SummaryCard,
} from "@/components/dashboard/operations/ui";
import type { DashboardSection } from "@/lib/dashboard-sections";
import {
  formatDateTime,
  formatUnits,
  getLocationUsedCapacity,
  getMovementTypeLabel,
  normalizeText,
  type MovementItem,
} from "@/lib/inventory";

export function HistoryModule({ section }: { section: DashboardSection }) {
  const { locations, movements } = useInventoryData();
  const [query, setQuery] = useState("");
  const [filterIndex, setFilterIndex] = useState(0);
  const totalUsed = locations.reduce(
    (sum, location) =>
      sum + Math.max(0, getLocationUsedCapacity(location.id, movements)),
    0,
  );
  const typeFilters = [
    { label: "Todas as acoes", value: "all" },
    { label: getMovementTypeLabel("entrada"), value: "entrada" as MovementItem["type"] },
    { label: getMovementTypeLabel("saida"), value: "saida" as MovementItem["type"] },
    {
      label: getMovementTypeLabel("transferencia"),
      value: "transferencia" as MovementItem["type"],
    },
  ] as const;
  const activeFilter = typeFilters[filterIndex];

  const recent = useMemo(
    () =>
      [...movements]
        .sort(
          (left, right) =>
            +new Date(right.createdAt) - +new Date(left.createdAt),
        )
        .filter(
          (event) =>
            activeFilter.value === "all" || event.type === activeFilter.value,
        )
        .filter((event) =>
          normalizeText(
            [event.product, event.reason, event.user, event.type].join(" "),
          ).includes(normalizeText(query)),
        )
        .slice(0, 12),
    [activeFilter.value, movements, query],
  );

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Auditoria" />

      <FilterBar
        placeholder="Buscar no historico..."
        query={query}
        onQueryChange={setQuery}
        trailing={
          <ActionButton
            onClick={() =>
              setFilterIndex((current) => (current + 1) % typeFilters.length)
            }
          >
            {activeFilter.label}
          </ActionButton>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Eventos Recentes"
          value={String(recent.length)}
          helper="Ultimos registros consolidados do sistema"
        />
        <SummaryCard
          title="Volume Monitorado"
          value={formatUnits(totalUsed)}
          helper="Ocupacao total derivada do historico atual"
        />
        <SummaryCard
          title="Ultimo Evento"
          value={recent[0] ? formatDateTime(recent[0].createdAt) : "-"}
          helper="Momento do registro mais recente disponivel"
        />
      </div>

      <Panel title="Linha do tempo" eyebrow="Timeline">
        <div className="space-y-1">
          {recent.map((event, index) => (
            <article
              key={event.id}
              className={`flex gap-4 px-1 py-4 ${
                index > 0 ? "border-t border-[var(--panel-border)]" : ""
              }`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                o
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xl font-semibold text-[var(--foreground)]">
                      {event.reason}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                      {event.product} · {formatUnits(event.quantity)}
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                      Por {event.user} · {formatDateTime(event.createdAt)}
                    </p>
                  </div>
                  <StatusPill
                    label={getMovementTypeLabel(event.type)}
                    tone="bg-violet-50 text-violet-700"
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}
