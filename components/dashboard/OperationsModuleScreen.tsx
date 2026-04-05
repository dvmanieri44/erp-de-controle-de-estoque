"use client";

import { useEffect, useMemo, useState } from "react";

import type { DashboardSection } from "@/lib/dashboard-sections";
import {
  CALENDAR_EVENTS,
  CATEGORIES,
  DISTRIBUTORS,
  DOCUMENTS,
  INCIDENTS,
  LOTS,
  NOTIFICATIONS,
  PENDING_ITEMS,
  PLANNING_ITEMS,
  PRODUCT_LINES,
  QUALITY_EVENTS,
  REPORTS,
  SUPPLIERS,
  TASKS,
} from "@/lib/operations-data";
import {
  formatDateTime,
  formatUnits,
  getLocationUsedCapacity,
  loadLocations,
  loadMovements,
  normalizeText,
  type LocationItem,
  type MovementItem,
} from "@/lib/inventory";

function Hero({
  section,
  eyebrow,
  actions,
}: {
  section: DashboardSection;
  eyebrow: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="overflow-hidden rounded-[32px] border border-[var(--panel-border)] bg-[var(--panel)] shadow-[0_14px_32px_var(--shadow-color)]">
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.14),transparent_38%),linear-gradient(135deg,rgba(15,23,42,0.02),transparent_65%)] px-6 py-7 md:px-8 md:py-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">{eyebrow}</p>
            <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-[var(--navy-900)]">{section.label}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">{section.description}</p>
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      </div>
    </header>
  );
}

function ActionButton({
  children,
  tone = "secondary",
}: {
  children: React.ReactNode;
  tone?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      className={
        tone === "primary"
          ? "rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:opacity-95"
          : "rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]"
      }
    >
      {children}
    </button>
  );
}

function FilterBar({
  placeholder,
  query,
  onQueryChange,
  trailing,
}: {
  placeholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_10px_24px_var(--shadow-color)]">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative block">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted-foreground)]">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={placeholder}
            className="h-12 w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-12 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
          />
        </label>
        {trailing ? <div className="flex flex-wrap gap-3">{trailing}</div> : null}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  helper,
  tone = "default",
}: {
  title: string;
  value: string;
  helper: string;
  tone?: "default" | "success" | "danger" | "warning";
}) {
  const valueTone =
    tone === "success"
      ? "text-emerald-600"
      : tone === "danger"
        ? "text-rose-600"
        : tone === "warning"
          ? "text-amber-600"
          : "text-[var(--navy-900)]";

  return (
    <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-[0_10px_24px_var(--shadow-color)]">
      <p className="text-sm text-[var(--muted-foreground)]">{title}</p>
      <p className={`mt-3 text-3xl font-semibold tracking-[-0.03em] ${valueTone}`}>{value}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{helper}</p>
    </article>
  );
}

function Panel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_10px_28px_var(--shadow-color)]">
      {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{eyebrow}</p> : null}
      <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[var(--navy-900)]">{title}</h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Table({ columns, children }: { columns: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel)]">
      <div className="hidden border-b border-[var(--panel-border)] bg-[var(--panel-soft)] px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)] lg:grid" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      <div className="divide-y divide-[var(--panel-border)]">{children}</div>
    </div>
  );
}

function TableRow({ columns, children }: { columns: number; children: React.ReactNode }) {
  return (
    <article className="grid gap-3 px-5 py-4 lg:items-center" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {children}
    </article>
  );
}

function StatusPill({ label, tone }: { label: string; tone: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function toneByLabel(label: string) {
  if (label.includes("Crítico") || label.includes("Desvio") || label.includes("Retido") || label.includes("Alta") || label.includes("Aberto")) return "bg-rose-50 text-rose-700";
  if (label.includes("Atenção") || label.includes("Em análise") || label.includes("Monitorado") || label.includes("Média") || label.includes("Em andamento") || label.includes("Aguardando")) return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

function useInventoryData() {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [movements, setMovements] = useState<MovementItem[]>([]);

  useEffect(() => {
    const sync = () => {
      setLocations(loadLocations());
      setMovements(loadMovements());
    };

    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  return { locations, movements };
}

function ProductsModule(section: DashboardSection) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = normalizeText(query);
    return PRODUCT_LINES.filter((item) =>
      normalizeText([item.product, item.sku, item.line, item.species, item.stage].join(" ")).includes(normalized),
    );
  }, [query]);

  const totalStock = filtered.reduce((sum, item) => sum + item.stock, 0);
  const critical = filtered.filter((item) => item.status === "Crítico").length;
  const avgCoverage =
    filtered.length > 0 ? Math.round(filtered.reduce((sum, item) => sum + item.coverageDays, 0) / filtered.length) : 0;

  return (
    <section className="space-y-8">
      <Hero
        section={section}
        eyebrow="Portfólio"
        actions={
          <>
            <ActionButton>Exportar</ActionButton>
            <ActionButton tone="primary">Novo Produto</ActionButton>
          </>
        }
      />

      <FilterBar
        placeholder="Buscar por nome, SKU, linha ou espécie..."
        query={query}
        onQueryChange={setQuery}
        trailing={<ActionButton>Filtros</ActionButton>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total de Produtos" value={String(filtered.length)} helper="SKUs ativos dentro do recorte atual" />
        <SummaryCard title="Volume em Estoque" value={formatUnits(totalStock)} helper="Saldo consolidado das linhas visíveis" />
        <SummaryCard title="Cobertura Média" value={`${avgCoverage} dias`} helper="Média de cobertura do mix selecionado" />
        <SummaryCard title="Produtos Críticos" value={String(critical)} helper="Itens abaixo da meta de abastecimento" tone="danger" />
      </div>

      <Panel title="Inventário de produtos" eyebrow="Estoque">
        <Table columns={["Produto", "SKU", "Linha", "Cobertura", "Estoque", "Status"]}>
          {filtered.map((item) => (
            <TableRow key={item.sku} columns={6}>
              <div>
                <p className="font-semibold text-[var(--foreground)]">{item.product}</p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {item.species} · {item.stage} · {item.package}
                </p>
              </div>
              <p className="text-sm text-[var(--foreground)]">{item.sku}</p>
              <p className="text-sm text-[var(--foreground)]">{item.line}</p>
              <p className="text-sm text-[var(--foreground)]">{item.coverageDays} dias</p>
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{formatUnits(item.stock)}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">Meta {formatUnits(item.target)}</p>
              </div>
              <div>
                <StatusPill label={item.status} tone={toneByLabel(item.status)} />
              </div>
            </TableRow>
          ))}
        </Table>
      </Panel>
    </section>
  );
}

function LowStockModule(section: DashboardSection) {
  const criticalItems = PRODUCT_LINES.filter((item) => item.status !== "Estável");

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Alertas" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Total em Alerta" value={String(criticalItems.length)} helper="Produtos com necessidade de reposição" tone="warning" />
        <SummaryCard title="Crítico" value={String(criticalItems.filter((item) => item.status === "Crítico").length)} helper="Necessitam ação imediata" tone="danger" />
        <SummaryCard title="Atenção" value={String(criticalItems.filter((item) => item.status === "Atenção").length)} helper="Planejar reabastecimento em breve" tone="warning" />
      </div>

      <Panel title="Estoque crítico" eyebrow="Prioridade">
        <div className="space-y-4">
          {criticalItems.map((item) => {
            const suggested = Math.max(0, item.target - item.stock) + Math.round(item.target * 0.3);
            const tone = item.status === "Crítico" ? "border-l-4 border-l-rose-500" : "border-l-4 border-l-amber-500";

            return (
              <article key={item.sku} className={`rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-5 ${tone}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xl font-semibold text-[var(--foreground)]">{item.product}</p>
                      <StatusPill label={item.status} tone={toneByLabel(item.status)} />
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">SKU {item.sku}</p>
                  </div>
                  <div className="text-left lg:text-right">
                    <p className={`text-4xl font-semibold tracking-[-0.04em] ${item.status === "Crítico" ? "text-rose-600" : "text-amber-600"}`}>{item.stock}</p>
                    <p className="text-sm text-[var(--muted-foreground)]">Quantidade atual</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-4 text-sm">
                  <div>
                    <p className="text-[var(--muted-foreground)]">Mínimo</p>
                    <p className="mt-1 font-semibold text-[var(--foreground)]">{item.target}</p>
                  </div>
                  <div>
                    <p className="text-[var(--muted-foreground)]">Cobertura</p>
                    <p className="mt-1 font-semibold text-[var(--foreground)]">{item.coverageDays} dias</p>
                  </div>
                  <div>
                    <p className="text-[var(--muted-foreground)]">Linha</p>
                    <p className="mt-1 font-semibold text-[var(--foreground)]">{item.line}</p>
                  </div>
                  <div>
                    <p className="text-[var(--muted-foreground)]">Categoria</p>
                    <p className="mt-1 font-semibold text-[var(--foreground)]">{item.stage}</p>
                  </div>
                </div>

                <div className={`mt-5 rounded-2xl px-4 py-3 text-sm ${item.status === "Crítico" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
                  <span className="font-semibold">Ação recomendada:</span>{" "}
                  {item.status === "Crítico" ? "reabastecer imediatamente." : "planejar reabastecimento em breve."} Quantidade sugerida: {suggested} unidades.
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
    </section>
  );
}

function LotsModule(section: DashboardSection) {
  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Rastreabilidade" actions={<ActionButton tone="primary">Novo Lote</ActionButton>} />

      <Panel title="Lotes e validade" eyebrow="Controle">
        <Table columns={["Lote", "Produto", "Quantidade", "Localização", "Validade", "Status"]}>
          {LOTS.map((item) => (
            <TableRow key={item.code} columns={6}>
              <div>
                <p className="font-semibold text-[var(--foreground)]">{item.code}</p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.location}</p>
              </div>
              <p className="text-sm text-[var(--foreground)]">{item.product}</p>
              <p className="text-sm text-[var(--foreground)]">{formatUnits(item.quantity)}</p>
              <p className="text-sm text-[var(--foreground)]">{item.location}</p>
              <p className="text-sm text-[var(--foreground)]">{item.expiration}</p>
              <div>
                <StatusPill label={item.status} tone={toneByLabel(item.status)} />
              </div>
            </TableRow>
          ))}
        </Table>
      </Panel>
    </section>
  );
}

function SuppliersModule(section: DashboardSection) {
  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Suprimentos" actions={<ActionButton tone="primary">Novo Fornecedor</ActionButton>} />

      <div className="grid gap-4 xl:grid-cols-2">
        {SUPPLIERS.map((item) => (
          <article key={item.name} className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_10px_24px_var(--shadow-color)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-2xl font-semibold tracking-[-0.03em] text-[var(--navy-900)]">{item.name}</p>
                  <StatusPill label={item.status} tone={toneByLabel(item.status)} />
                </div>
                <div className="mt-3 flex gap-1 text-amber-400">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <span key={index}>{index < Math.round(item.score / 20) ? "★" : "☆"}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 text-[var(--accent)]">
                <button type="button" className="rounded-xl p-2 transition hover:bg-[var(--accent-soft)]">✎</button>
                <button type="button" className="rounded-xl p-2 text-rose-500 transition hover:bg-rose-50">🗑</button>
              </div>
            </div>
            <div className="mt-5 space-y-2 text-sm text-[var(--muted-foreground)]">
              <p>{item.category}</p>
              <p>{item.city}</p>
              <p>Lead time: {item.leadTimeDays} dias</p>
            </div>
            <div className="mt-5 border-t border-[var(--panel-border)] pt-4">
              <p className="text-lg font-semibold text-emerald-600">Score {item.score}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CategoriesModule(section: DashboardSection) {
  const tones = [
    "bg-blue-50 text-blue-600",
    "bg-emerald-50 text-emerald-600",
    "bg-amber-50 text-amber-600",
    "bg-violet-50 text-violet-600",
  ];

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Estrutura" actions={<ActionButton tone="primary">Nova Categoria</ActionButton>} />

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        {CATEGORIES.map((item, index) => (
          <article key={item.name} className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_10px_24px_var(--shadow-color)]">
            <div className="flex items-start justify-between gap-3">
              <div className={`flex h-16 w-16 items-center justify-center rounded-3xl text-2xl ${tones[index % tones.length]}`}>⌂</div>
              <div className="flex gap-2 text-[var(--accent)]">
                <button type="button" className="rounded-xl p-2 transition hover:bg-[var(--accent-soft)]">✎</button>
                <button type="button" className="rounded-xl p-2 text-rose-500 transition hover:bg-rose-50">🗑</button>
              </div>
            </div>
            <p className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-[var(--navy-900)]">{item.name}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{item.focus}</p>
            <div className="mt-5 border-t border-[var(--panel-border)] pt-4">
              <p className="text-3xl font-semibold text-[var(--navy-900)]">{item.skus}</p>
              <p className="text-sm text-[var(--muted-foreground)]">SKUs · share {item.share}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function HistoryModule(section: DashboardSection) {
  const { locations, movements } = useInventoryData();
  const [query, setQuery] = useState("");
  const totalUsed = locations.reduce((sum, location) => sum + Math.max(0, getLocationUsedCapacity(location.id, movements)), 0);
  const recent = useMemo(
    () =>
      [...movements]
        .sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt))
        .filter((event) =>
          normalizeText([event.product, event.reason, event.user, event.type].join(" ")).includes(normalizeText(query)),
        )
        .slice(0, 12),
    [movements, query],
  );

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Auditoria" />

      <FilterBar
        placeholder="Buscar no histórico..."
        query={query}
        onQueryChange={setQuery}
        trailing={<ActionButton>Todas as ações</ActionButton>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Eventos Recentes" value={String(recent.length)} helper="Últimos registros consolidados do sistema" />
        <SummaryCard title="Volume Monitorado" value={formatUnits(totalUsed)} helper="Ocupação total derivada do histórico atual" />
        <SummaryCard title="Último Evento" value={recent[0] ? formatDateTime(recent[0].createdAt) : "-"} helper="Momento do registro mais recente disponível" />
      </div>

      <Panel title="Linha do tempo" eyebrow="Timeline">
        <div className="space-y-1">
          {recent.map((event, index) => (
            <article key={event.id} className={`flex gap-4 px-1 py-4 ${index > 0 ? "border-t border-[var(--panel-border)]" : ""}`}>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">◔</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xl font-semibold text-[var(--foreground)]">{event.reason}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                      {event.product} · {formatUnits(event.quantity)}
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                      Por {event.user} · {formatDateTime(event.createdAt)}
                    </p>
                  </div>
                  <StatusPill label={event.type} tone="bg-violet-50 text-violet-700" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function QualityModule(section: DashboardSection) {
  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Quality" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Eventos em Aberto" value={String(QUALITY_EVENTS.filter((item) => item.status !== "Liberado").length)} helper="Ocorrências com ação pendente" tone="warning" />
        <SummaryCard title="Lotes Liberados" value={String(QUALITY_EVENTS.filter((item) => item.status === "Liberado").length)} helper="Pareceres finalizados com liberação" tone="success" />
        <SummaryCard title="Desvios" value={String(QUALITY_EVENTS.filter((item) => item.status === "Desvio").length)} helper="Casos com tratativa formal" tone="danger" />
      </div>

      <Panel title="Fila de qualidade" eyebrow="Laboratório">
        <div className="space-y-4">
          {QUALITY_EVENTS.map((event) => (
            <article key={event.title} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{event.title}</p>
                    <StatusPill label={event.status} tone={toneByLabel(event.status)} />
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">Lote {event.lot} · {event.area}</p>
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">Responsável: {event.owner}</p>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function PlanningModule(section: DashboardSection) {
  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Planejamento" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Rotas Planejadas" value={String(PLANNING_ITEMS.length)} helper="Fluxos com previsão operacional ativa" />
        <SummaryCard title="Demanda Priorizada" value={formatUnits(PLANNING_ITEMS.reduce((sum, item) => sum + item.demand, 0))} helper="Volume em programação para abastecimento" />
        <SummaryCard title="Prioridade Alta" value={String(PLANNING_ITEMS.filter((item) => item.priority === "Alta").length)} helper="Ações críticas para hoje e amanhã" tone="danger" />
      </div>

      <Panel title="Plano mestre de abastecimento" eyebrow="Execução">
        <div className="space-y-4">
          {PLANNING_ITEMS.map((item) => (
            <article key={item.route} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{item.route}</p>
                    <StatusPill label={`Prioridade ${item.priority}`} tone={toneByLabel(item.priority)} />
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.window} · {item.coverage}</p>
                </div>
                <p className="text-lg font-semibold text-[var(--navy-900)]">{formatUnits(item.demand)}</p>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function ReportsModule(section: DashboardSection) {
  return (
    <section className="space-y-8">
      <Hero
        section={section}
        eyebrow="Inteligência"
        actions={
          <>
            <ActionButton>Agenda de envios</ActionButton>
            <ActionButton tone="primary">Gerar Relatório</ActionButton>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {REPORTS.map((item) => (
          <article key={item.title} className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_10px_24px_var(--shadow-color)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xl font-semibold text-[var(--foreground)]">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{item.summary}</p>
              </div>
              <StatusPill label={item.cadence} tone="bg-[var(--accent-soft)] text-[var(--accent)]" />
            </div>
            <div className="mt-5 grid gap-3 text-sm text-[var(--muted-foreground)] sm:grid-cols-2">
              <p>Responsável: {item.owner}</p>
              <p>Última execução: {item.lastRun}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function NotificationsModule(section: DashboardSection) {
  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Central" actions={<ActionButton>Marcar tudo como lido</ActionButton>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total de Alertas" value={String(NOTIFICATIONS.length)} helper="Itens registrados na central operacional" />
        <SummaryCard title="Alta Prioridade" value={String(NOTIFICATIONS.filter((item) => item.priority === "Alta").length)} helper="Demandam ação imediata ou aprovação" tone="danger" />
        <SummaryCard title="Em Andamento" value={String(NOTIFICATIONS.filter((item) => item.status === "Em andamento").length)} helper="Alertas já assumidos por uma área" tone="warning" />
        <SummaryCard title="Pendentes" value={String(NOTIFICATIONS.filter((item) => item.status === "Não lida").length)} helper="Ainda não consumidos pela operação" tone="warning" />
      </div>

      <Panel title="Caixa de entrada operacional" eyebrow="Alertas">
        <div className="space-y-4">
          {NOTIFICATIONS.map((item) => (
            <article key={item.title} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
                    <StatusPill label={item.priority} tone={toneByLabel(item.priority)} />
                    <StatusPill label={item.type} tone="bg-[var(--accent-soft)] text-[var(--accent)]" />
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.area}</p>
                </div>
                <StatusPill label={item.status} tone={toneByLabel(item.status)} />
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function PendingModule(section: DashboardSection) {
  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Execução" />

      <Panel title="Painel de pendências" eyebrow="Follow-up">
        <div className="space-y-4">
          {PENDING_ITEMS.map((item) => (
            <article key={item.title} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
                    <StatusPill label={item.priority} tone={toneByLabel(item.priority)} />
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.area} · Responsável: {item.owner}</p>
                </div>
                <p className="text-sm font-medium text-[var(--navy-900)]">{item.due}</p>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function TasksModule(section: DashboardSection) {
  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Execução" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Tarefas Ativas" value={String(TASKS.filter((item) => item.status !== "Concluída").length)} helper="Fluxos ainda em andamento no dia" />
        <SummaryCard title="Checklists Concluídos" value={`${TASKS.reduce((sum, item) => sum + item.completed, 0)}`} helper="Itens já executados nas rotinas abertas" />
        <SummaryCard title="Turnos Monitorados" value={String(new Set(TASKS.map((item) => item.shift)).size)} helper="Cobertura operacional por janela de trabalho" />
      </div>

      <Panel title="Rotina operacional por turno" eyebrow="Task board">
        <div className="space-y-4">
          {TASKS.map((item) => {
            const percent = (item.completed / item.checklist) * 100;

            return (
              <article key={item.title} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
                      <StatusPill label={item.status} tone={toneByLabel(item.status)} />
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.shift} · Responsável: {item.owner}</p>
                  </div>
                  <p className="text-sm font-medium text-[var(--navy-900)]">{item.completed}/{item.checklist} etapas</p>
                </div>
                <div className="mt-4 h-2.5 rounded-full bg-[var(--panel)]">
                  <div className={`h-2.5 rounded-full ${item.status === "Concluída" ? "bg-emerald-500" : item.status === "Em execução" ? "bg-[var(--accent)]" : "bg-amber-500"}`} style={{ width: `${Math.max(8, percent)}%` }} />
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
    </section>
  );
}

function DistributorsModule(section: DashboardSection) {
  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Clientes" />
      <div className="grid gap-4 xl:grid-cols-2">
        {DISTRIBUTORS.map((item) => (
          <article key={item.name} className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_10px_24px_var(--shadow-color)]">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-semibold text-[var(--foreground)]">{item.name}</p>
              <StatusPill label={item.priority} tone={toneByLabel(item.priority)} />
              <StatusPill label={item.status} tone={toneByLabel(item.status)} />
            </div>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">{item.region} · {item.channel}</p>
            <p className="mt-4 text-sm text-[var(--muted-foreground)]">Último abastecimento: {item.lastSupply}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function CalendarModule(section: DashboardSection) {
  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Agenda" />
      <Panel title="Próximos eventos" eyebrow="Calendário operacional">
        <div className="space-y-4">
          {CALENDAR_EVENTS.map((event) => (
            <article key={event.title} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{event.title}</p>
                    <StatusPill label={event.type} tone="bg-[var(--accent-soft)] text-[var(--accent)]" />
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{event.area}</p>
                </div>
                <p className="text-sm font-medium text-[var(--navy-900)]">{event.slot}</p>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function IncidentsModule(section: DashboardSection) {
  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Ocorrências" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Incidentes Abertos" value={String(INCIDENTS.filter((item) => item.status !== "Encerrado").length)} helper="Itens que ainda precisam de tratativa" tone="danger" />
        <SummaryCard title="Severidade Alta" value={String(INCIDENTS.filter((item) => item.severity === "Alta").length)} helper="Ocorrências com maior impacto operacional" tone="danger" />
        <SummaryCard title="Encerrados" value={String(INCIDENTS.filter((item) => item.status === "Encerrado").length)} helper="Casos concluídos e documentados" tone="success" />
      </div>

      <Panel title="Registro de incidentes" eyebrow="Tratativa">
        <div className="space-y-4">
          {INCIDENTS.map((item) => (
            <article key={item.title} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
                    <StatusPill label={item.severity} tone={toneByLabel(item.severity)} />
                    <StatusPill label={item.status} tone={toneByLabel(item.status)} />
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.area} · Responsável: {item.owner}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function DocumentsModule(section: DashboardSection) {
  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Documentação" />
      <div className="grid gap-4 xl:grid-cols-2">
        {DOCUMENTS.map((item) => (
          <article key={item.title} className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_10px_24px_var(--shadow-color)]">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-semibold text-[var(--foreground)]">{item.title}</p>
              <StatusPill label={item.type} tone="bg-[var(--accent-soft)] text-[var(--accent)]" />
            </div>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">{item.area}</p>
            <div className="mt-5 grid gap-3 text-sm text-[var(--muted-foreground)] sm:grid-cols-2">
              <p>Atualizado em: {item.updatedAt}</p>
              <p>Responsável: {item.owner}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function OperationsModuleScreen({ section }: { section: DashboardSection }) {
  if (section.id === "notificacoes") return <NotificationsModule section={section} />;
  if (section.id === "pendencias") return <PendingModule section={section} />;
  if (section.id === "produtos") return <ProductsModule section={section} />;
  if (section.id === "estoque-baixo") return <LowStockModule section={section} />;
  if (section.id === "lotes") return <LotsModule section={section} />;
  if (section.id === "qualidade") return <QualityModule section={section} />;
  if (section.id === "fornecedores") return <SuppliersModule section={section} />;
  if (section.id === "categorias") return <CategoriesModule section={section} />;
  if (section.id === "planejamento") return <PlanningModule section={section} />;
  if (section.id === "tarefas") return <TasksModule section={section} />;
  if (section.id === "distribuidores") return <DistributorsModule section={section} />;
  if (section.id === "calendario") return <CalendarModule section={section} />;
  if (section.id === "relatorios") return <ReportsModule section={section} />;
  if (section.id === "incidentes") return <IncidentsModule section={section} />;
  if (section.id === "documentos") return <DocumentsModule section={section} />;
  if (section.id === "historico") return <HistoryModule section={section} />;

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="PremieRpet Operations" />
    </section>
  );
}
