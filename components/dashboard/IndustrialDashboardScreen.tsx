"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useLocale } from "@/components/providers/LocaleProvider";
import {
  formatDateTime,
  formatUnits,
  getLocationTypeLabel,
  getLocationUsedCapacity,
  getMovementStatusLabel,
  getMovementTypeLabel,
  getTransferPriorityLabel,
  isMovementCancelled,
  loadLocations,
  loadMovements,
  type LocationItem,
  type MovementItem,
} from "@/lib/inventory";

const COPY = {
  "pt-BR": {
    eyebrow: "Fluxy",
    title: "Painel Industrial",
    description: "Visão consolidada da produção liberada, ocupação de áreas, transferências internas e fluxo entre fábrica, expedição, quality hold e centros de distribuição.",
    recordMovement: "Registrar movimentação",
    trackTransfers: "Acompanhar transferências",
    reviewCapacities: "Revisar capacidades",
    openRoadmap: "Abrir roadmap",
    usedCapacity: "Capacidade ocupada",
    usedCapacityHelper: "{rate}% da capacidade industrial monitorada",
    availableCapacity: "Capacidade disponível",
    availableCapacityHelper: "Espaço livre somando fábrica, CD, expedição e quality hold",
    openTransfers: "Transferências em aberto",
    openTransfersHelper: "{count} registradas hoje no fluxo interno",
    qualityHold: "Quality hold",
    qualityHoldHelper: "{count} entradas concluídas hoje",
    occupancyMap: "Mapa de ocupação por área",
    capacity: "Capacidade",
    manager: "Responsável",
    currentOccupancy: "ocupação atual",
    occupied: "Ocupado",
    available: "Disponível",
    totalCapacity: "Capacidade",
    transferPipeline: "Pipeline de transferências",
    flow: "Fluxo",
    requested: "Solicitadas",
    picking: "Em separação",
    inTransit: "Em trânsito",
    received: "Recebidas",
    attentionPoints: "Pontos de atenção",
    overLimitAreas: "{count} áreas acima de 80% de ocupação.",
    retainedVolume: "Existe volume retido em quality hold para acompanhamento.",
    noRetainedVolume: "Sem volume retido em quality hold neste momento.",
    pendingTransfers: "{count} transferências ainda dependem de conclusão operacional.",
    criticalAreas: "Áreas críticas",
    alerts: "Alertas",
    noneCritical: "Nenhuma área está acima do limite de atenção neste momento.",
    latestMovements: "Últimas movimentações",
    traceability: "Rastreabilidade",
    priority: "Prioridade",
    byUser: "Por",
  },
  "en-US": {
    eyebrow: "Fluxy",
    title: "Industrial Dashboard",
    description: "Consolidated view of released production, area occupancy, internal transfers and flow between factory, shipping, quality hold and distribution centers.",
    recordMovement: "Record movement",
    trackTransfers: "Track transfers",
    reviewCapacities: "Review capacities",
    openRoadmap: "Open roadmap",
    usedCapacity: "Used capacity",
    usedCapacityHelper: "{rate}% of monitored industrial capacity",
    availableCapacity: "Available capacity",
    availableCapacityHelper: "Free space across factory, DC, shipping and quality hold",
    openTransfers: "Open transfers",
    openTransfersHelper: "{count} recorded today in the internal flow",
    qualityHold: "Quality hold",
    qualityHoldHelper: "{count} inbound entries completed today",
    occupancyMap: "Occupancy map by area",
    capacity: "Capacity",
    manager: "Owner",
    currentOccupancy: "current occupancy",
    occupied: "Used",
    available: "Available",
    totalCapacity: "Capacity",
    transferPipeline: "Transfer pipeline",
    flow: "Flow",
    requested: "Requested",
    picking: "Picking",
    inTransit: "In transit",
    received: "Received",
    attentionPoints: "Attention points",
    overLimitAreas: "{count} areas above 80% occupancy.",
    retainedVolume: "There is retained volume in quality hold for follow-up.",
    noRetainedVolume: "No retained volume in quality hold at the moment.",
    pendingTransfers: "{count} transfers still depend on operational completion.",
    criticalAreas: "Critical areas",
    alerts: "Alerts",
    noneCritical: "No area is above the attention threshold at the moment.",
    latestMovements: "Latest movements",
    traceability: "Traceability",
    priority: "Priority",
    byUser: "By",
  },
  "es-ES": {
    eyebrow: "Fluxy",
    title: "Panel Industrial",
    description: "Vista consolidada de la producción liberada, ocupación de áreas, transferencias internas y flujo entre fábrica, expedición, quality hold y centros de distribución.",
    recordMovement: "Registrar movimiento",
    trackTransfers: "Acompañar transferencias",
    reviewCapacities: "Revisar capacidades",
    openRoadmap: "Abrir roadmap",
    usedCapacity: "Capacidad ocupada",
    usedCapacityHelper: "{rate}% de la capacidad industrial monitoreada",
    availableCapacity: "Capacidad disponible",
    availableCapacityHelper: "Espacio libre sumando fábrica, CD, expedición y quality hold",
    openTransfers: "Transferencias abiertas",
    openTransfersHelper: "{count} registradas hoy en el flujo interno",
    qualityHold: "Quality hold",
    qualityHoldHelper: "{count} entradas concluidas hoy",
    occupancyMap: "Mapa de ocupación por área",
    capacity: "Capacidad",
    manager: "Responsable",
    currentOccupancy: "ocupación actual",
    occupied: "Ocupado",
    available: "Disponible",
    totalCapacity: "Capacidad",
    transferPipeline: "Pipeline de transferencias",
    flow: "Flujo",
    requested: "Solicitadas",
    picking: "En preparación",
    inTransit: "En tránsito",
    received: "Recibidas",
    attentionPoints: "Puntos de atención",
    overLimitAreas: "{count} áreas por encima del 80% de ocupación.",
    retainedVolume: "Hay volumen retenido en quality hold para seguimiento.",
    noRetainedVolume: "No hay volumen retenido en quality hold por el momento.",
    pendingTransfers: "{count} transferencias todavía dependen de la conclusión operativa.",
    criticalAreas: "Áreas críticas",
    alerts: "Alertas",
    noneCritical: "Ninguna área está por encima del límite de atención en este momento.",
    latestMovements: "Últimos movimientos",
    traceability: "Trazabilidad",
    priority: "Prioridad",
    byUser: "Por",
  },
} as const;

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
      {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{eyebrow}</p> : null}
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
  const { locale } = useLocale();
  const copy = COPY[locale];
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

  const activeMovements = useMemo(() => movements.filter((movement) => !isMovementCancelled(movement)), [movements]);

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
    const qualityHoldUnits = qualityLocation ? Math.max(0, getLocationUsedCapacity(qualityLocation.id, activeMovements)) : 0;
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">{copy.eyebrow}</p>
              <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-[var(--navy-900)]">{copy.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">{copy.description}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Link href="/dashboard/movimentacoes" className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]">{copy.recordMovement}</Link>
              <Link href="/dashboard/transferencias" className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]">{copy.trackTransfers}</Link>
              <Link href="/dashboard/localizacoes" className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:opacity-95">{copy.reviewCapacities}</Link>
              <Link href="/dashboard/roadmap" className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]">{copy.openRoadmap}</Link>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard title={copy.usedCapacity} value={formatUnits(summary.totalUsed, locale)} helper={copy.usedCapacityHelper.replace("{rate}", summary.fillRate.toFixed(1))} />
        <DashboardMetricCard title={copy.availableCapacity} value={formatUnits(summary.totalAvailable, locale)} helper={copy.availableCapacityHelper} tone="success" />
        <DashboardMetricCard title={copy.openTransfers} value={String(summary.activeTransfers)} helper={copy.openTransfersHelper.replace("{count}", String(summary.transfersToday))} tone="warning" />
        <DashboardMetricCard title={copy.qualityHold} value={formatUnits(summary.qualityHoldUnits, locale)} helper={copy.qualityHoldHelper.replace("{count}", String(summary.entriesToday))} />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
        <DashboardPanel title={copy.occupancyMap} eyebrow={copy.capacity}>
          <div className="space-y-4">
            {locationsByLoad.map(({ location, used, available, percent }) => {
              const tone = percent >= 90 ? "bg-red-500" : percent >= 75 ? "bg-amber-500" : "bg-emerald-500";

              return (
                <article key={location.id} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-semibold text-[var(--navy-900)]">{location.name}</h4>
                        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">
                          {getLocationTypeLabel(location.type, locale)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                        {location.address} · {copy.manager}: {location.manager}
                      </p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-lg font-semibold text-[var(--navy-900)]">{percent.toFixed(0)}%</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{copy.currentOccupancy}</p>
                    </div>
                  </div>

                  <div className="mt-4 h-2.5 rounded-full bg-[var(--panel)]">
                    <div className={`h-2.5 rounded-full ${tone}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                  </div>

                  <div className="mt-3 grid gap-3 text-sm text-[var(--muted-foreground)] sm:grid-cols-3">
                    <p><span className="font-semibold text-[var(--foreground)]">{copy.occupied}:</span> {formatUnits(used, locale)}</p>
                    <p><span className="font-semibold text-[var(--foreground)]">{copy.available}:</span> {formatUnits(available, locale)}</p>
                    <p><span className="font-semibold text-[var(--foreground)]">{copy.totalCapacity}:</span> {formatUnits(location.capacityTotal, locale)}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </DashboardPanel>

        <div className="space-y-6">
          <DashboardPanel title={copy.transferPipeline} eyebrow={copy.flow}>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: copy.requested, value: transferPipeline.solicitada },
                { label: copy.picking, value: transferPipeline.em_separacao },
                { label: copy.inTransit, value: transferPipeline.em_transito },
                { label: copy.received, value: transferPipeline.recebida },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--navy-900)]">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">{copy.attentionPoints}</p>
              <div className="mt-3 space-y-2 text-sm text-[var(--muted-foreground)]">
                <p>{copy.overLimitAreas.replace("{count}", String(summary.criticalLocations.length))}</p>
                <p>{summary.qualityHoldUnits > 0 ? copy.retainedVolume : copy.noRetainedVolume}</p>
                <p>{copy.pendingTransfers.replace("{count}", String(summary.activeTransfers))}</p>
              </div>
            </div>
          </DashboardPanel>

          <DashboardPanel title={copy.criticalAreas} eyebrow={copy.alerts}>
            <div className="space-y-3">
              {summary.criticalLocations.length > 0 ? (
                summary.criticalLocations.map((location) => {
                  const fill = getLocationFillRate(location, activeMovements);

                  return (
                    <div key={location.id} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[var(--foreground)]">{location.name}</p>
                          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{getLocationTypeLabel(location.type, locale)}</p>
                        </div>
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">{fill.percent.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4 text-sm text-[var(--muted-foreground)]">{copy.noneCritical}</div>
              )}
            </div>
          </DashboardPanel>
        </div>
      </div>

      <DashboardPanel title={copy.latestMovements} eyebrow={copy.traceability}>
        <div className="space-y-3">
          {recentMovements.map((movement) => (
            <article key={movement.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[var(--foreground)]">{movement.product}</p>
                  <span className="rounded-full bg-[var(--panel)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                    {getMovementTypeLabel(movement.type, locale)}
                  </span>
                  {movement.priority ? (
                    <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                      {copy.priority} {getTransferPriorityLabel(movement.priority, locale)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{movement.reason}</p>
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                  {formatDateTime(movement.createdAt, locale)} · {copy.byUser} {movement.user}
                </p>
              </div>

              <div className="flex flex-col items-start gap-2 text-left lg:items-end lg:text-right">
                <p className="text-lg font-semibold text-[var(--navy-900)]">{formatUnits(movement.quantity, locale)}</p>
                <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">
                  {getMovementStatusLabel(movement, locale)}
                </span>
              </div>
            </article>
          ))}
        </div>
      </DashboardPanel>
    </section>
  );
}
