"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  formatDateTime,
  formatUnits,
  getLocationUsedCapacity,
  getMovementStatusLabel,
  getTransferPriorityLabel,
  isMovementCancelled,
  loadLocations,
  loadMovements,
  type LocationItem,
  type MovementItem,
} from "@/lib/inventory";

type DashboardMetricCardProps = {
  title: string;
  value: string;
  helper: string;
  tone?: "default" | "success" | "warning";
};

type DashboardPanelProps = {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
};

function DashboardMetricCard({ title, value, helper, tone = "default" }: DashboardMetricCardProps) {
  const toneClasses =
    tone === "success"
      ? "from-emerald-500/12 to-emerald-500/0"
      : tone === "warning"
        ? "from-amber-500/12 to-amber-500/0"
        : "from-[var(--accent-soft)] to-transparent";

  return (
    <article className="relative overflow-hidden rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-[0_10px_24px_var(--shadow-color)]">
      <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${toneClasses}`} />
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{title}</p>
        <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[var(--navy-900)]">{value}</p>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{helper}</p>
      </div>
    </article>
  );
}

function DashboardPanel({ title, eyebrow, children }: DashboardPanelProps) {
  return (
    <section className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_10px_28px_var(--shadow-color)]">
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{eyebrow}</p>
      ) : null}
      <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[var(--navy-900)]">{title}</h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function getLocationFillRate(location: LocationItem, movements: MovementItem[]) {
  const used = Math.max(0, getLocationUsedCapacity(location.id, movements));
  const percent = location.capacityTotal > 0 ? (used / location.capacityTotal) * 100 : 0;

  return {
    used,
    percent,
    available: Math.max(0, location.capacityTotal - used),
  };
}

export function IndustrialDashboardScreen() {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [movements, setMovements] = useState<MovementItem[]>([]);

  useEffect(() => {
    const syncData = () => {
      setLocations(loadLocations());
      setMovements(loadMovements());
    };

    syncData();
    window.addEventListener("storage", syncData);

    return () => window.removeEventListener("storage", syncData);
  }, []);

  const activeMovements = useMemo(
    () => movements.filter((movement) => !isMovementCancelled(movement)),
    [movements],
  );

  const summary = useMemo(() => {
    const todayKey = new Date().toDateString();
    const totalCapacity = locations.reduce((sum, location) => sum + location.capacityTotal, 0);
    const totalUsed = locations.reduce(
      (sum, location) => sum + Math.max(0, getLocationUsedCapacity(location.id, activeMovements)),
      0,
    );
    const activeTransfers = activeMovements.filter(
      (movement) =>
        movement.type === "transferencia" &&
        movement.transferStatus !== "recebida" &&
        movement.transferStatus !== "cancelada",
    );
    const transfersToday = activeMovements.filter(
      (movement) => movement.type === "transferencia" && new Date(movement.createdAt).toDateString() === todayKey,
    );
    const entriesToday = activeMovements.filter(
      (movement) => movement.type === "entrada" && new Date(movement.createdAt).toDateString() === todayKey,
    );
    const qualityLocation = locations.find((location) => location.name.toLowerCase().includes("quality"));
    const qualityHoldUnits = qualityLocation
      ? Math.max(0, getLocationUsedCapacity(qualityLocation.id, activeMovements))
      : 0;
    const criticalLocations = locations.filter((location) => getLocationFillRate(location, activeMovements).percent >= 80);

    return {
      totalCapacity,
      totalUsed,
      totalAvailable: Math.max(0, totalCapacity - totalUsed),
      fillRate: totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0,
      activeTransfers: activeTransfers.length,
      transfersToday: transfersToday.length,
      entriesToday: entriesToday.length,
      qualityHoldUnits,
      criticalLocations,
    };
  }, [activeMovements, locations]);

  const locationsByLoad = useMemo(
    () =>
      [...locations]
        .map((location) => ({
          location,
          ...getLocationFillRate(location, activeMovements),
        }))
        .sort((left, right) => right.percent - left.percent),
    [activeMovements, locations],
  );

  const recentMovements = useMemo(
    () => [...movements].sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt)).slice(0, 6),
    [movements],
  );

  const transferPipeline = useMemo(() => {
    const base = {
      solicitada: 0,
      em_separacao: 0,
      em_transito: 0,
      recebida: 0,
      cancelada: 0,
    };

    movements.forEach((movement) => {
      if (movement.type !== "transferencia") {
        return;
      }

      const status = movement.transferStatus ?? "recebida";
      base[status] += 1;
    });

    return base;
  }, [movements]);

  return (
    <section className="space-y-8 pb-8">
      <header className="overflow-hidden rounded-[32px] border border-[var(--panel-border)] bg-[var(--panel)] shadow-[0_14px_32px_var(--shadow-color)]">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_38%),linear-gradient(135deg,rgba(15,23,42,0.02),transparent_65%)] px-6 py-7 md:px-8 md:py-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                PremieRpet Operations
              </p>
              <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-[var(--navy-900)]">
                Painel Industrial
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">
                Visão consolidada da produção liberada, ocupação de áreas, transferências internas e fluxo entre
                fábrica, expedição, quality hold e centros de distribuição.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Link
                href="/dashboard/movimentacoes"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]"
              >
                Registrar movimentação
              </Link>
              <Link
                href="/dashboard/transferencias"
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]"
              >
                Acompanhar transferências
              </Link>
              <Link
                href="/dashboard/localizacoes"
                className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:opacity-95"
              >
                Revisar capacidades
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          title="Capacidade ocupada"
          value={formatUnits(summary.totalUsed)}
          helper={`${summary.fillRate.toFixed(1)}% da capacidade industrial monitorada`}
        />
        <DashboardMetricCard
          title="Capacidade disponível"
          value={formatUnits(summary.totalAvailable)}
          helper="Espaço livre somando fábrica, CD, expedição e quality hold"
          tone="success"
        />
        <DashboardMetricCard
          title="Transferências em aberto"
          value={String(summary.activeTransfers)}
          helper={`${summary.transfersToday} registradas hoje no fluxo interno`}
          tone="warning"
        />
        <DashboardMetricCard
          title="Quality hold"
          value={formatUnits(summary.qualityHoldUnits)}
          helper={`${summary.entriesToday} entradas concluídas hoje`}
        />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
        <DashboardPanel title="Mapa de ocupação por área" eyebrow="Capacidade">
          <div className="space-y-4">
            {locationsByLoad.map(({ location, used, available, percent }) => {
              const tone =
                percent >= 90 ? "bg-red-500" : percent >= 75 ? "bg-amber-500" : "bg-emerald-500";

              return (
                <article key={location.id} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-semibold text-[var(--navy-900)]">{location.name}</h4>
                        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">
                          {location.type}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                        {location.address} · Responsável: {location.manager}
                      </p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-lg font-semibold text-[var(--navy-900)]">{percent.toFixed(0)}%</p>
                      <p className="text-xs text-[var(--muted-foreground)]">ocupação atual</p>
                    </div>
                  </div>

                  <div className="mt-4 h-2.5 rounded-full bg-[var(--panel)]">
                    <div className={`h-2.5 rounded-full ${tone}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                  </div>

                  <div className="mt-3 grid gap-3 text-sm text-[var(--muted-foreground)] sm:grid-cols-3">
                    <p>
                      <span className="font-semibold text-[var(--foreground)]">Ocupado:</span> {formatUnits(used)}
                    </p>
                    <p>
                      <span className="font-semibold text-[var(--foreground)]">Disponível:</span> {formatUnits(available)}
                    </p>
                    <p>
                      <span className="font-semibold text-[var(--foreground)]">Capacidade:</span>{" "}
                      {formatUnits(location.capacityTotal)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </DashboardPanel>

        <div className="space-y-6">
          <DashboardPanel title="Pipeline de transferências" eyebrow="Fluxo">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Solicitadas", value: transferPipeline.solicitada },
                { label: "Em separação", value: transferPipeline.em_separacao },
                { label: "Em trânsito", value: transferPipeline.em_transito },
                { label: "Recebidas", value: transferPipeline.recebida },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--navy-900)]">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">Pontos de atenção</p>
              <div className="mt-3 space-y-2 text-sm text-[var(--muted-foreground)]">
                <p>{summary.criticalLocations.length} áreas acima de 80% de ocupação.</p>
                <p>
                  {summary.qualityHoldUnits > 0
                    ? "Existe volume retido em quality hold para acompanhamento."
                    : "Sem volume retido em quality hold neste momento."}
                </p>
                <p>{summary.activeTransfers} transferências ainda dependem de conclusão operacional.</p>
              </div>
            </div>
          </DashboardPanel>

          <DashboardPanel title="Áreas críticas" eyebrow="Alertas">
            <div className="space-y-3">
              {summary.criticalLocations.length > 0 ? (
                summary.criticalLocations.map((location) => {
                  const fill = getLocationFillRate(location, activeMovements);

                  return (
                    <div key={location.id} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[var(--foreground)]">{location.name}</p>
                          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{location.type}</p>
                        </div>
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          {fill.percent.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4 text-sm text-[var(--muted-foreground)]">
                  Nenhuma área está acima do limite de atenção neste momento.
                </div>
              )}
            </div>
          </DashboardPanel>
        </div>
      </div>

      <DashboardPanel title="Últimas movimentações" eyebrow="Rastreabilidade">
        <div className="space-y-3">
          {recentMovements.map((movement) => (
            <article
              key={movement.id}
              className="flex flex-col gap-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[var(--foreground)]">{movement.product}</p>
                  <span className="rounded-full bg-[var(--panel)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                    {movement.type}
                  </span>
                  {movement.priority ? (
                    <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                      Prioridade {getTransferPriorityLabel(movement.priority)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{movement.reason}</p>
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                  {formatDateTime(movement.createdAt)} · Por {movement.user}
                </p>
              </div>

              <div className="flex flex-col items-start gap-2 text-left lg:items-end lg:text-right">
                <p className="text-lg font-semibold text-[var(--navy-900)]">{formatUnits(movement.quantity)}</p>
                <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">
                  {getMovementStatusLabel(movement)}
                </span>
              </div>
            </article>
          ))}
        </div>
      </DashboardPanel>
    </section>
  );
}
