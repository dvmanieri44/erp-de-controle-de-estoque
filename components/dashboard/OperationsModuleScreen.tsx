"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useLocale } from "@/components/providers/LocaleProvider";
import { ERP_DATA_EVENT } from "@/lib/app-events";
import type { DashboardSection } from "@/lib/dashboard-sections";
import { getSectionById } from "@/lib/dashboard-sections";
import {
  CALENDAR_EVENTS,
  type CalendarItem,
  CATEGORIES,
  type CategoryItem,
  DISTRIBUTORS,
  type DistributorItem,
  DOCUMENTS,
  type DocumentItem,
  INCIDENTS,
  type IncidentItem,
  LOTS,
  type LotItem,
  NOTIFICATIONS,
  type NotificationItem,
  PENDING_ITEMS,
  type PendingItem,
  PLANNING_ITEMS,
  type PlanningItem,
  PRODUCT_LINES,
  type ProductLineItem,
  QUALITY_EVENTS,
  type QualityEventItem,
  REPORTS,
  type ReportItem,
  SUPPLIERS,
  type SupplierItem,
  TASKS,
  type TaskItem,
} from "@/lib/operations-data";
import {
  formatDateTime,
  formatUnits,
  getLocationUsedCapacity,
  getMovementTypeLabel,
  loadLocations,
  loadMovements,
  normalizeText,
  type LocationItem,
  type MovementItem,
} from "@/lib/inventory";
import {
  loadCalendarEvents,
  loadCategories,
  loadDistributors,
  loadDocuments,
  loadIncidents,
  loadLots,
  loadNotifications,
  loadPendingItems,
  loadPlanningItems,
  loadProductLines,
  loadQualityEvents,
  loadReports,
  loadSuppliers,
  loadTasks,
  saveCalendarEvents,
  saveCategories,
  saveDistributors,
  saveDocuments,
  saveIncidents,
  saveLots,
  saveNotifications,
  savePendingItems,
  savePlanningItems,
  saveProductLines,
  saveQualityEvents,
  saveReports,
  saveSuppliers,
  saveTasks,
} from "@/lib/operations-store";

function Hero({
  section,
  eyebrow,
  actions,
}: {
  section: DashboardSection;
  eyebrow: string;
  actions?: React.ReactNode;
}) {
  const { locale } = useLocale();
  const localizedSection = getSectionById(section.id, locale) ?? section;

  return (
    <header className="overflow-hidden rounded-[32px] border border-[var(--panel-border)] bg-[var(--panel)] shadow-[0_14px_32px_var(--shadow-color)]">
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.14),transparent_38%),linear-gradient(135deg,rgba(15,23,42,0.02),transparent_65%)] px-6 py-7 md:px-8 md:py-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">{eyebrow}</p>
            <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-[var(--navy-900)]">{localizedSection.label}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">{localizedSection.description}</p>
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
  onClick,
}: {
  children: React.ReactNode;
  tone?: "primary" | "secondary";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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

function exportCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</span>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] ${props.className ?? ""}`.trim()}
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-11 w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] ${props.className ?? ""}`.trim()}
    />
  );
}

function TextareaInput(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-28 w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] ${props.className ?? ""}`.trim()}
    />
  );
}

function InlineFormPanel({
  title,
  description,
  error,
  submitLabel,
  onSubmit,
  onCancel,
  children,
}: {
  title: string;
  description: string;
  error?: string;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_10px_28px_var(--shadow-color)]">
      <div className="flex flex-col gap-4 border-b border-[var(--panel-border)] pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Cadastro</p>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[var(--navy-900)]">{title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>
        </div>
        <button type="button" onClick={onCancel} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]">
          Cancelar
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {children}
        {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
        <div className="flex justify-end">
          <button type="button" onClick={onSubmit} className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:opacity-95">
            {submitLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

function useOperationsCollection<T>(loader: () => T[]) {
  const [items, setItems] = useState<T[]>([]);

  useEffect(() => {
    const sync = () => {
      setItems(loader());
    };

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(ERP_DATA_EVENT, sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(ERP_DATA_EVENT, sync);
    };
  }, [loader]);

  return [items, setItems] as const;
}

const PRODUCT_SPECIES_DOGS = "C\u00e3es" as ProductLineItem["species"];
const PRODUCT_SPECIES_CATS = "Gatos" as ProductLineItem["species"];
const PRODUCT_STATUS_STABLE = "Est\u00e1vel" as ProductLineItem["status"];
const PRODUCT_STATUS_ATTENTION = "Aten\u00e7\u00e3o" as ProductLineItem["status"];
const PRODUCT_STATUS_CRITICAL = "Cr\u00edtico" as ProductLineItem["status"];
const LOT_STATUS_RELEASED = "Liberado" as LotItem["status"];
const LOT_STATUS_IN_REVIEW = "Em an\u00e1lise" as LotItem["status"];
const LOT_STATUS_HELD = "Retido" as LotItem["status"];
const SUPPLIER_STATUS_APPROVED = "Homologado" as SupplierItem["status"];
const SUPPLIER_STATUS_MONITORED = "Monitorado" as SupplierItem["status"];
const SUPPLIER_STATUS_CRITICAL = "Cr\u00edtico" as SupplierItem["status"];
const NOTIFICATION_STATUS_DONE = "Conclu\u00edda" as NotificationItem["status"];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function resolveProductStatus(stock: number, target: number, coverageDays: number): string {
  if (coverageDays <= 7 || stock <= target * 0.5) {
    return "Critico";
  }

  if (coverageDays <= 14 || stock < target) {
    return "Atencao";
  }

  return "Estavel";
}

function resolveOperationalProductStatus(stock: number, target: number, coverageDays: number): ProductLineItem["status"] {
  if (coverageDays <= 7 || stock <= target * 0.5) {
    return PRODUCT_STATUS_CRITICAL;
  }

  if (coverageDays <= 14 || stock < target) {
    return PRODUCT_STATUS_ATTENTION;
  }

  return PRODUCT_STATUS_STABLE;
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
    window.addEventListener(ERP_DATA_EVENT, sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(ERP_DATA_EVENT, sync);
    };
  }, []);

  return { locations, movements };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyProductsModule({ section }: { section: DashboardSection }) {
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

function ProductsModule({ section }: { section: DashboardSection }) {
  const [products, setProducts] = useOperationsCollection(loadProductLines);
  const [query, setQuery] = useState("");
  const [statusFilterIndex, setStatusFilterIndex] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    sku: "",
    product: "",
    line: "",
    species: PRODUCT_LINES[0]?.species ?? PRODUCT_SPECIES_DOGS,
    stage: "",
    package: "",
    stock: "",
    target: "",
    coverageDays: "",
  });

  const statusFilters = [
    { label: "Todos os status", value: "all" },
    { label: "Apenas em atenção", value: PRODUCT_STATUS_ATTENTION },
    { label: "Apenas críticos", value: PRODUCT_STATUS_CRITICAL },
  ] as const;

  const activeStatusFilter = statusFilters[statusFilterIndex];

  const filtered = useMemo(() => {
    const normalized = normalizeText(query);
    return products.filter((item) => {
      const matchesQuery = normalizeText([item.product, item.sku, item.line, item.species, item.stage].join(" ")).includes(normalized);
      const matchesStatus = activeStatusFilter.value === "all" || item.status === activeStatusFilter.value;
      return matchesQuery && matchesStatus;
    });
  }, [activeStatusFilter.value, products, query]);

  const totalStock = filtered.reduce((sum, item) => sum + item.stock, 0);
  const critical = filtered.filter((item) => item.status === PRODUCT_STATUS_CRITICAL).length;
  const avgCoverage =
    filtered.length > 0 ? Math.round(filtered.reduce((sum, item) => sum + item.coverageDays, 0) / filtered.length) : 0;

  function resetForm() {
    setForm({
      sku: "",
      product: "",
      line: "",
      species: PRODUCT_LINES[0]?.species ?? PRODUCT_SPECIES_DOGS,
      stage: "",
      package: "",
      stock: "",
      target: "",
      coverageDays: "",
    });
    setError("");
    setIsFormOpen(false);
  }

  function handleCreateProduct() {
    const stock = Number(form.stock);
    const target = Number(form.target);
    const coverageDays = Number(form.coverageDays);

    if (!form.sku.trim() || !form.product.trim() || !form.line.trim() || !form.stage.trim() || !form.package.trim()) {
      setError("Preencha SKU, produto, linha, categoria e embalagem.");
      return;
    }

    if ([stock, target, coverageDays].some((value) => Number.isNaN(value) || value < 0)) {
      setError("Informe estoque, meta e cobertura com numeros validos.");
      return;
    }

    if (products.some((item) => item.sku.toLowerCase() === form.sku.trim().toLowerCase())) {
      setError("Ja existe um produto com esse SKU.");
      return;
    }

    const nextProducts: ProductLineItem[] = [
      {
        sku: form.sku.trim(),
        product: form.product.trim(),
        line: form.line.trim(),
        species: form.species,
        stage: form.stage.trim(),
        package: form.package.trim(),
        stock,
        target,
        coverageDays,
        status: resolveOperationalProductStatus(stock, target, coverageDays),
      },
      ...products,
    ];

    setProducts(nextProducts);
    saveProductLines(nextProducts);
    resetForm();
  }

  function handleExportProducts() {
    exportCsv("produtos-operacionais.csv", [
      ["SKU", "Produto", "Linha", "Especie", "Categoria", "Embalagem", "Estoque", "Meta", "Cobertura", "Status"],
      ...filtered.map((item) => [
        item.sku,
        item.product,
        item.line,
        item.species,
        item.stage,
        item.package,
        String(item.stock),
        String(item.target),
        String(item.coverageDays),
        item.status,
      ]),
    ]);
  }

  return (
    <section className="space-y-8">
      <Hero
        section={section}
        eyebrow="Portfolio"
        actions={
          <>
            <ActionButton onClick={handleExportProducts}>Exportar</ActionButton>
            <ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>Novo Produto</ActionButton>
          </>
        }
      />

      {isFormOpen ? (
        <InlineFormPanel
          title="Novo produto"
          description="Cadastre um SKU operacional para refletir o portfolio do sistema."
          error={error}
          submitLabel="Salvar produto"
          onSubmit={handleCreateProduct}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="SKU">
              <TextInput value={form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} placeholder="Ex.: PF-AD-MINI-25" />
            </FormField>
            <FormField label="Produto">
              <TextInput value={form.product} onChange={(event) => setForm((current) => ({ ...current, product: event.target.value }))} placeholder="Ex.: PremieR Formula Caes Adultos" />
            </FormField>
            <FormField label="Linha">
              <TextInput value={form.line} onChange={(event) => setForm((current) => ({ ...current, line: event.target.value }))} placeholder="Ex.: PremieR Formula" />
            </FormField>
            <FormField label="Especie">
              <SelectInput value={form.species} onChange={(event) => setForm((current) => ({ ...current, species: event.target.value as ProductLineItem["species"] }))}>
                <option value={PRODUCT_SPECIES_DOGS}>{PRODUCT_SPECIES_DOGS}</option>
                <option value={PRODUCT_SPECIES_CATS}>{PRODUCT_SPECIES_CATS}</option>
              </SelectInput>
            </FormField>
            <FormField label="Categoria">
              <TextInput value={form.stage} onChange={(event) => setForm((current) => ({ ...current, stage: event.target.value }))} placeholder="Ex.: Adulto" />
            </FormField>
            <FormField label="Embalagem">
              <TextInput value={form.package} onChange={(event) => setForm((current) => ({ ...current, package: event.target.value }))} placeholder="Ex.: 10,1 kg" />
            </FormField>
            <FormField label="Estoque atual">
              <TextInput value={form.stock} onChange={(event) => setForm((current) => ({ ...current, stock: event.target.value }))} inputMode="numeric" placeholder="Ex.: 22000" />
            </FormField>
            <FormField label="Meta">
              <TextInput value={form.target} onChange={(event) => setForm((current) => ({ ...current, target: event.target.value }))} inputMode="numeric" placeholder="Ex.: 18000" />
            </FormField>
            <FormField label="Cobertura em dias">
              <TextInput value={form.coverageDays} onChange={(event) => setForm((current) => ({ ...current, coverageDays: event.target.value }))} inputMode="numeric" placeholder="Ex.: 18" />
            </FormField>
          </div>
        </InlineFormPanel>
      ) : null}

      <FilterBar
        placeholder="Buscar por nome, SKU, linha ou especie..."
        query={query}
        onQueryChange={setQuery}
        trailing={
          <ActionButton onClick={() => setStatusFilterIndex((current) => (current + 1) % statusFilters.length)}>
            {activeStatusFilter.label}
          </ActionButton>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total de Produtos" value={String(filtered.length)} helper="SKUs ativos dentro do recorte atual" />
        <SummaryCard title="Volume em Estoque" value={formatUnits(totalStock)} helper="Saldo consolidado das linhas visiveis" />
        <SummaryCard title="Cobertura Media" value={`${avgCoverage} dias`} helper="Media de cobertura do mix selecionado" />
        <SummaryCard title="Produtos Criticos" value={String(critical)} helper="Itens abaixo da meta de abastecimento" tone="danger" />
      </div>

      <Panel title="Inventario de produtos" eyebrow="Estoque">
        <Table columns={["Produto", "SKU", "Linha", "Cobertura", "Estoque", "Status"]}>
          {filtered.map((item) => (
            <TableRow key={item.sku} columns={6}>
              <div>
                <p className="font-semibold text-[var(--foreground)]">{item.product}</p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {item.species} Â· {item.stage} Â· {item.package}
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

function LowStockModule({ section }: { section: DashboardSection }) {
  const [products] = useOperationsCollection(loadProductLines);
  const criticalItems = products.filter((item) => item.status !== "Estável");

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyLotsModule({ section }: { section: DashboardSection }) {
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

function LotsModule({ section }: { section: DashboardSection }) {
  const [lots, setLots] = useOperationsCollection(loadLots);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    code: "",
    product: "",
    location: "",
    expiration: "",
    quantity: "",
    status: LOTS[0]?.status ?? LOT_STATUS_RELEASED,
  });

  function resetForm() {
    setForm({
      code: "",
      product: "",
      location: "",
      expiration: "",
      quantity: "",
      status: LOTS[0]?.status ?? LOT_STATUS_RELEASED,
    });
    setError("");
    setIsFormOpen(false);
  }

  function handleCreateLot() {
    const quantity = Number(form.quantity);

    if (!form.code.trim() || !form.product.trim() || !form.location.trim() || !form.expiration.trim()) {
      setError("Preencha codigo, produto, localizacao e validade.");
      return;
    }

    if (Number.isNaN(quantity) || quantity <= 0) {
      setError("Informe uma quantidade valida para o lote.");
      return;
    }

    if (lots.some((item) => item.code.toLowerCase() === form.code.trim().toLowerCase())) {
      setError("Ja existe um lote com esse codigo.");
      return;
    }

    const nextLots: LotItem[] = [
      {
        code: form.code.trim(),
        product: form.product.trim(),
        location: form.location.trim(),
        expiration: form.expiration,
        quantity,
        status: form.status,
      },
      ...lots,
    ];

    setLots(nextLots);
    saveLots(nextLots);
    resetForm();
  }

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Rastreabilidade" actions={<ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>Novo Lote</ActionButton>} />

      {isFormOpen ? (
        <InlineFormPanel
          title="Novo lote"
          description="Registre lotes com validade e status para manter a rastreabilidade da operacao."
          error={error}
          submitLabel="Salvar lote"
          onSubmit={handleCreateLot}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Codigo">
              <TextInput value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder="Ex.: PFM260327" />
            </FormField>
            <FormField label="Produto">
              <TextInput value={form.product} onChange={(event) => setForm((current) => ({ ...current, product: event.target.value }))} placeholder="Ex.: PremieR Formula Caes Adultos" />
            </FormField>
            <FormField label="Localizacao">
              <TextInput value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Ex.: CD Sudeste" />
            </FormField>
            <FormField label="Validade">
              <TextInput value={form.expiration} onChange={(event) => setForm((current) => ({ ...current, expiration: event.target.value }))} type="date" />
            </FormField>
            <FormField label="Quantidade">
              <TextInput value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} inputMode="numeric" placeholder="Ex.: 4200" />
            </FormField>
            <FormField label="Status">
              <SelectInput value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as LotItem["status"] }))}>
                <option value={LOT_STATUS_RELEASED}>{LOT_STATUS_RELEASED}</option>
                <option value={LOT_STATUS_IN_REVIEW}>{LOT_STATUS_IN_REVIEW}</option>
                <option value={LOT_STATUS_HELD}>{LOT_STATUS_HELD}</option>
              </SelectInput>
            </FormField>
          </div>
        </InlineFormPanel>
      ) : null}

      <Panel title="Lotes e validade" eyebrow="Controle">
        <Table columns={["Lote", "Produto", "Quantidade", "Localização", "Validade", "Status"]}>
          {lots.map((item) => (
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacySuppliersModule({ section }: { section: DashboardSection }) {
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

function SuppliersModule({ section }: { section: DashboardSection }) {
  const [suppliers, setSuppliers] = useOperationsCollection(loadSuppliers);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    category: "",
    city: "",
    leadTimeDays: "",
    score: "",
    status: SUPPLIERS[0]?.status ?? SUPPLIER_STATUS_APPROVED,
  });

  function resetForm() {
    setForm({
      name: "",
      category: "",
      city: "",
      leadTimeDays: "",
      score: "",
      status: SUPPLIERS[0]?.status ?? SUPPLIER_STATUS_APPROVED,
    });
    setEditingName(null);
    setError("");
    setIsFormOpen(false);
  }

  function handleEditSupplier(item: SupplierItem) {
    setForm({
      name: item.name,
      category: item.category,
      city: item.city,
      leadTimeDays: String(item.leadTimeDays),
      score: String(item.score),
      status: item.status,
    });
    setEditingName(item.name);
    setError("");
    setIsFormOpen(true);
  }

  function handleDeleteSupplier(name: string) {
    if (!window.confirm(`Excluir o fornecedor ${name}?`)) {
      return;
    }

    const nextSuppliers = suppliers.filter((item) => item.name !== name);
    setSuppliers(nextSuppliers);
    saveSuppliers(nextSuppliers);
  }

  function handleSaveSupplier() {
    const leadTimeDays = Number(form.leadTimeDays);
    const score = Number(form.score);

    if (!form.name.trim() || !form.category.trim() || !form.city.trim()) {
      setError("Preencha nome, categoria e cidade.");
      return;
    }

    if ([leadTimeDays, score].some((value) => Number.isNaN(value) || value < 0)) {
      setError("Informe lead time e score com numeros validos.");
      return;
    }

    if (
      suppliers.some(
        (item) => item.name.toLowerCase() === form.name.trim().toLowerCase() && item.name !== editingName,
      )
    ) {
      setError("Ja existe um fornecedor com esse nome.");
      return;
    }

    const nextSupplier: SupplierItem = {
      name: form.name.trim(),
      category: form.category.trim(),
      city: form.city.trim(),
      leadTimeDays,
      score,
      status: form.status,
    };

    const nextSuppliers =
      editingName === null
        ? [nextSupplier, ...suppliers]
        : suppliers.map((item) => (item.name === editingName ? nextSupplier : item));

    setSuppliers(nextSuppliers);
    saveSuppliers(nextSuppliers);
    resetForm();
  }

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Suprimentos" actions={<ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>Novo Fornecedor</ActionButton>} />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingName ? "Editar fornecedor" : "Novo fornecedor"}
          description="Centralize os parceiros homologados e mantenha o score da operacao atualizado."
          error={error}
          submitLabel={editingName ? "Salvar alteracoes" : "Salvar fornecedor"}
          onSubmit={handleSaveSupplier}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Nome">
              <TextInput value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: PackFlex Embalagens" />
            </FormField>
            <FormField label="Categoria">
              <TextInput value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Ex.: Embalagens" />
            </FormField>
            <FormField label="Cidade">
              <TextInput value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} placeholder="Ex.: Campinas/SP" />
            </FormField>
            <FormField label="Lead time (dias)">
              <TextInput value={form.leadTimeDays} onChange={(event) => setForm((current) => ({ ...current, leadTimeDays: event.target.value }))} inputMode="numeric" placeholder="Ex.: 7" />
            </FormField>
            <FormField label="Score">
              <TextInput value={form.score} onChange={(event) => setForm((current) => ({ ...current, score: event.target.value }))} inputMode="numeric" placeholder="Ex.: 89" />
            </FormField>
            <FormField label="Status">
              <SelectInput value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as SupplierItem["status"] }))}>
                <option value={SUPPLIER_STATUS_APPROVED}>{SUPPLIER_STATUS_APPROVED}</option>
                <option value={SUPPLIER_STATUS_MONITORED}>{SUPPLIER_STATUS_MONITORED}</option>
                <option value={SUPPLIER_STATUS_CRITICAL}>{SUPPLIER_STATUS_CRITICAL}</option>
              </SelectInput>
            </FormField>
          </div>
        </InlineFormPanel>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {suppliers.map((item) => (
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
                <button type="button" onClick={() => handleEditSupplier(item)} className="rounded-xl p-2 transition hover:bg-[var(--accent-soft)]">✎</button>
                <button type="button" onClick={() => handleDeleteSupplier(item.name)} className="rounded-xl p-2 text-rose-500 transition hover:bg-rose-50">✕</button>
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyCategoriesModule({ section }: { section: DashboardSection }) {
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

function CategoriesModule({ section }: { section: DashboardSection }) {
  const tones = [
    "bg-blue-50 text-blue-600",
    "bg-emerald-50 text-emerald-600",
    "bg-amber-50 text-amber-600",
    "bg-violet-50 text-violet-600",
  ];
  const [categories, setCategories] = useOperationsCollection(loadCategories);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    portfolio: "",
    skus: "",
    share: "",
    focus: "",
  });

  function resetForm() {
    setForm({
      name: "",
      portfolio: "",
      skus: "",
      share: "",
      focus: "",
    });
    setEditingName(null);
    setError("");
    setIsFormOpen(false);
  }

  function handleEditCategory(item: CategoryItem) {
    setForm({
      name: item.name,
      portfolio: item.portfolio,
      skus: String(item.skus),
      share: item.share,
      focus: item.focus,
    });
    setEditingName(item.name);
    setError("");
    setIsFormOpen(true);
  }

  function handleDeleteCategory(name: string) {
    if (!window.confirm(`Excluir a categoria ${name}?`)) {
      return;
    }

    const nextCategories = categories.filter((item) => item.name !== name);
    setCategories(nextCategories);
    saveCategories(nextCategories);
  }

  function handleSaveCategory() {
    const skus = Number(form.skus);

    if (!form.name.trim() || !form.portfolio.trim() || !form.share.trim() || !form.focus.trim()) {
      setError("Preencha nome, portfolio, share e foco.");
      return;
    }

    if (Number.isNaN(skus) || skus < 0) {
      setError("Informe um total de SKUs valido.");
      return;
    }

    if (
      categories.some(
        (item) => item.name.toLowerCase() === form.name.trim().toLowerCase() && item.name !== editingName,
      )
    ) {
      setError("Ja existe uma categoria com esse nome.");
      return;
    }

    const nextCategory: CategoryItem = {
      name: form.name.trim(),
      portfolio: form.portfolio.trim(),
      skus,
      share: form.share.trim(),
      focus: form.focus.trim(),
    };

    const nextCategories =
      editingName === null
        ? [nextCategory, ...categories]
        : categories.map((item) => (item.name === editingName ? nextCategory : item));

    setCategories(nextCategories);
    saveCategories(nextCategories);
    resetForm();
  }

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Estrutura" actions={<ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>Nova Categoria</ActionButton>} />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingName ? "Editar categoria" : "Nova categoria"}
          description="Mantenha a estrutura comercial e industrial alinhada com o portfolio real do ERP."
          error={error}
          submitLabel={editingName ? "Salvar alteracoes" : "Salvar categoria"}
          onSubmit={handleSaveCategory}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Nome">
              <TextInput value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Super Premium Caes" />
            </FormField>
            <FormField label="Portfolio">
              <TextInput value={form.portfolio} onChange={(event) => setForm((current) => ({ ...current, portfolio: event.target.value }))} placeholder="Ex.: PremieR Formula" />
            </FormField>
            <FormField label="SKUs">
              <TextInput value={form.skus} onChange={(event) => setForm((current) => ({ ...current, skus: event.target.value }))} inputMode="numeric" placeholder="Ex.: 42" />
            </FormField>
            <FormField label="Share">
              <TextInput value={form.share} onChange={(event) => setForm((current) => ({ ...current, share: event.target.value }))} placeholder="Ex.: 38%" />
            </FormField>
          </div>
          <FormField label="Foco">
            <TextareaInput value={form.focus} onChange={(event) => setForm((current) => ({ ...current, focus: event.target.value }))} placeholder="Descreva o papel da categoria na operacao." />
          </FormField>
        </InlineFormPanel>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        {categories.map((item, index) => (
          <article key={item.name} className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_10px_24px_var(--shadow-color)]">
            <div className="flex items-start justify-between gap-3">
              <div className={`flex h-16 w-16 items-center justify-center rounded-3xl text-2xl ${tones[index % tones.length]}`}>⌂</div>
              <div className="flex gap-2 text-[var(--accent)]">
                <button type="button" onClick={() => handleEditCategory(item)} className="rounded-xl p-2 transition hover:bg-[var(--accent-soft)]">✎</button>
                <button type="button" onClick={() => handleDeleteCategory(item.name)} className="rounded-xl p-2 text-rose-500 transition hover:bg-rose-50">✕</button>
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyHistoryModule({ section }: { section: DashboardSection }) {
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyQualityModule({ section }: { section: DashboardSection }) {
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyPlanningModule({ section }: { section: DashboardSection }) {
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

function QualityModule({ section }: { section: DashboardSection }) {
  const [events, setEvents] = useOperationsCollection(loadQualityEvents);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    lot: "",
    area: "",
    owner: "",
    status: QUALITY_EVENTS[0]?.status ?? ("Em análise" as QualityEventItem["status"]),
  });
  const statusOptions = useMemo(
    () => Array.from(new Set(QUALITY_EVENTS.map((item) => item.status))) as QualityEventItem["status"][],
    [],
  );

  function resetForm() {
    setForm({
      title: "",
      lot: "",
      area: "",
      owner: "",
      status: QUALITY_EVENTS[0]?.status ?? statusOptions[0],
    });
    setEditingTitle(null);
    setError("");
    setIsFormOpen(false);
  }

  function handleEditEvent(item: QualityEventItem) {
    setForm({ ...item });
    setEditingTitle(item.title);
    setError("");
    setIsFormOpen(true);
  }

  function handleDeleteEvent(title: string) {
    if (!window.confirm(`Excluir o evento de qualidade "${title}"?`)) {
      return;
    }

    const nextEvents = events.filter((item) => item.title !== title);
    setEvents(nextEvents);
    saveQualityEvents(nextEvents);
  }

  function handleSaveEvent() {
    if (!form.title.trim() || !form.lot.trim() || !form.area.trim() || !form.owner.trim()) {
      setError("Preencha titulo, lote, area e responsavel.");
      return;
    }

    if (
      events.some(
        (item) => item.title.toLowerCase() === form.title.trim().toLowerCase() && item.title !== editingTitle,
      )
    ) {
      setError("Ja existe um evento com esse titulo.");
      return;
    }

    const nextItem: QualityEventItem = {
      title: form.title.trim(),
      lot: form.lot.trim(),
      area: form.area.trim(),
      owner: form.owner.trim(),
      status: form.status,
    };

    const nextEvents =
      editingTitle === null
        ? [nextItem, ...events]
        : events.map((item) => (item.title === editingTitle ? nextItem : item));

    setEvents(nextEvents);
    saveQualityEvents(nextEvents);
    resetForm();
  }

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Quality" actions={<ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>Novo evento</ActionButton>} />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingTitle ? "Editar evento de qualidade" : "Novo evento de qualidade"}
          description="Registre liberacoes, reanalises e desvios com acompanhamento local."
          error={error}
          submitLabel={editingTitle ? "Salvar alteracoes" : "Salvar evento"}
          onSubmit={handleSaveEvent}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Titulo">
              <TextInput value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Reanalise de granulometria" />
            </FormField>
            <FormField label="Lote">
              <TextInput value={form.lot} onChange={(event) => setForm((current) => ({ ...current, lot: event.target.value }))} placeholder="Ex.: PFF310326" />
            </FormField>
            <FormField label="Area">
              <TextInput value={form.area} onChange={(event) => setForm((current) => ({ ...current, area: event.target.value }))} placeholder="Ex.: Quality Hold" />
            </FormField>
            <FormField label="Responsavel">
              <TextInput value={form.owner} onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))} placeholder="Ex.: Luciana Prado" />
            </FormField>
            <FormField label="Status">
              <SelectInput value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as QualityEventItem["status"] }))}>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </SelectInput>
            </FormField>
          </div>
        </InlineFormPanel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Eventos em aberto" value={String(events.filter((item) => item.status !== "Liberado").length)} helper="Ocorrencias que ainda pedem acompanhamento" tone="warning" />
        <SummaryCard title="Lotes liberados" value={String(events.filter((item) => item.status === "Liberado").length)} helper="Pareceres concluidos com liberacao" tone="success" />
        <SummaryCard title="Desvios" value={String(events.filter((item) => item.status === "Desvio").length)} helper="Casos com tratativa formal" tone="danger" />
      </div>

      <Panel title="Fila de qualidade" eyebrow="Laboratorio">
        <div className="space-y-4">
          {events.map((event) => (
            <article key={event.title} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{event.title}</p>
                    <StatusPill label={event.status} tone={toneByLabel(event.status)} />
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">Lote {event.lot} · {event.area}</p>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">Responsavel: {event.owner}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleEditEvent(event)} className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]">Editar</button>
                  <button type="button" onClick={() => handleDeleteEvent(event.title)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Excluir</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function PlanningModule({ section }: { section: DashboardSection }) {
  const [plans, setPlans] = useOperationsCollection(loadPlanningItems);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    route: "",
    window: "",
    priority: PLANNING_ITEMS[0]?.priority ?? ("Alta" as PlanningItem["priority"]),
    demand: "",
    coverage: "",
  });
  const priorityOptions = useMemo(
    () => Array.from(new Set(PLANNING_ITEMS.map((item) => item.priority))) as PlanningItem["priority"][],
    [],
  );

  function resetForm() {
    setForm({
      route: "",
      window: "",
      priority: PLANNING_ITEMS[0]?.priority ?? priorityOptions[0],
      demand: "",
      coverage: "",
    });
    setEditingRoute(null);
    setError("");
    setIsFormOpen(false);
  }

  function handleEditPlan(item: PlanningItem) {
    setForm({
      route: item.route,
      window: item.window,
      priority: item.priority,
      demand: String(item.demand),
      coverage: item.coverage,
    });
    setEditingRoute(item.route);
    setError("");
    setIsFormOpen(true);
  }

  function handleDeletePlan(route: string) {
    if (!window.confirm(`Excluir o planejamento "${route}"?`)) {
      return;
    }

    const nextPlans = plans.filter((item) => item.route !== route);
    setPlans(nextPlans);
    savePlanningItems(nextPlans);
  }

  function handleSavePlan() {
    const demand = Number(form.demand);

    if (!form.route.trim() || !form.window.trim() || !form.coverage.trim()) {
      setError("Preencha rota, janela e cobertura.");
      return;
    }

    if (Number.isNaN(demand) || demand <= 0) {
      setError("Informe uma demanda valida.");
      return;
    }

    if (
      plans.some(
        (item) => item.route.toLowerCase() === form.route.trim().toLowerCase() && item.route !== editingRoute,
      )
    ) {
      setError("Ja existe um planejamento com essa rota.");
      return;
    }

    const nextItem: PlanningItem = {
      route: form.route.trim(),
      window: form.window.trim(),
      priority: form.priority,
      demand,
      coverage: form.coverage.trim(),
    };

    const nextPlans =
      editingRoute === null
        ? [nextItem, ...plans]
        : plans.map((item) => (item.route === editingRoute ? nextItem : item));

    setPlans(nextPlans);
    savePlanningItems(nextPlans);
    resetForm();
  }

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Planejamento" actions={<ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>Nova rota</ActionButton>} />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingRoute ? "Editar planejamento" : "Novo planejamento"}
          description="Mantenha o plano mestre atualizado com demandas, prioridades e janelas."
          error={error}
          submitLabel={editingRoute ? "Salvar alteracoes" : "Salvar planejamento"}
          onSubmit={handleSavePlan}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Rota">
              <TextInput value={form.route} onChange={(event) => setForm((current) => ({ ...current, route: event.target.value }))} placeholder="Ex.: Dourado -> CD Sudeste" />
            </FormField>
            <FormField label="Janela">
              <TextInput value={form.window} onChange={(event) => setForm((current) => ({ ...current, window: event.target.value }))} placeholder="Ex.: Hoje, 18:00" />
            </FormField>
            <FormField label="Prioridade">
              <SelectInput value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as PlanningItem["priority"] }))}>
                {priorityOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Demanda">
              <TextInput value={form.demand} onChange={(event) => setForm((current) => ({ ...current, demand: event.target.value }))} inputMode="numeric" placeholder="Ex.: 12000" />
            </FormField>
          </div>
          <FormField label="Cobertura">
            <TextInput value={form.coverage} onChange={(event) => setForm((current) => ({ ...current, coverage: event.target.value }))} placeholder="Ex.: Cobertura projetada de 8 dias" />
          </FormField>
        </InlineFormPanel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Rotas planejadas" value={String(plans.length)} helper="Fluxos com previsao operacional ativa" />
        <SummaryCard title="Demanda priorizada" value={formatUnits(plans.reduce((sum, item) => sum + item.demand, 0))} helper="Volume em programacao para abastecimento" />
        <SummaryCard title="Prioridade alta" value={String(plans.filter((item) => item.priority === "Alta").length)} helper="Acoes criticas para hoje e amanha" tone="danger" />
      </div>

      <Panel title="Plano mestre de abastecimento" eyebrow="Execucao">
        <div className="space-y-4">
          {plans.map((item) => (
            <article key={item.route} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{item.route}</p>
                    <StatusPill label={`Prioridade ${item.priority}`} tone={toneByLabel(item.priority)} />
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.window} · {item.coverage}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-semibold text-[var(--navy-900)]">{formatUnits(item.demand)}</p>
                  <button type="button" onClick={() => handleEditPlan(item)} className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]">Editar</button>
                  <button type="button" onClick={() => handleDeletePlan(item.route)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Excluir</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function HistoryModule({ section }: { section: DashboardSection }) {
  const { locations, movements } = useInventoryData();
  const [query, setQuery] = useState("");
  const [filterIndex, setFilterIndex] = useState(0);
  const totalUsed = locations.reduce((sum, location) => sum + Math.max(0, getLocationUsedCapacity(location.id, movements)), 0);
  const typeFilters = [
    { label: "Todas as acoes", value: "all" },
    { label: getMovementTypeLabel("entrada"), value: "entrada" as MovementItem["type"] },
    { label: getMovementTypeLabel("saida"), value: "saida" as MovementItem["type"] },
    { label: getMovementTypeLabel("transferencia"), value: "transferencia" as MovementItem["type"] },
  ] as const;
  const activeFilter = typeFilters[filterIndex];

  const recent = useMemo(
    () =>
      [...movements]
        .sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt))
        .filter((event) => activeFilter.value === "all" || event.type === activeFilter.value)
        .filter((event) =>
          normalizeText([event.product, event.reason, event.user, event.type].join(" ")).includes(normalizeText(query)),
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
          <ActionButton onClick={() => setFilterIndex((current) => (current + 1) % typeFilters.length)}>
            {activeFilter.label}
          </ActionButton>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Eventos Recentes" value={String(recent.length)} helper="Ultimos registros consolidados do sistema" />
        <SummaryCard title="Volume Monitorado" value={formatUnits(totalUsed)} helper="Ocupacao total derivada do historico atual" />
        <SummaryCard title="Ultimo Evento" value={recent[0] ? formatDateTime(recent[0].createdAt) : "-"} helper="Momento do registro mais recente disponivel" />
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
                  <StatusPill label={getMovementTypeLabel(event.type)} tone="bg-violet-50 text-violet-700" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyReportsModule({ section }: { section: DashboardSection }) {
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

function ReportsModule({ section }: { section: DashboardSection }) {
  const { locations, movements } = useInventoryData();
  const [reports, setReports] = useOperationsCollection(loadReports);
  const [products] = useOperationsCollection(loadProductLines);
  const [lots] = useOperationsCollection(loadLots);
  const [notifications] = useOperationsCollection(loadNotifications);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    owner: "",
    cadence: REPORTS[0]?.cadence ?? "Diario",
    lastRun: "",
    summary: "",
  });

  function resetForm() {
    setForm({
      title: "",
      owner: "",
      cadence: REPORTS[0]?.cadence ?? "Diario",
      lastRun: "",
      summary: "",
    });
    setEditingTitle(null);
    setError("");
    setIsFormOpen(false);
  }

  function handleEdit(item: ReportItem) {
    setForm({
      title: item.title,
      owner: item.owner,
      cadence: item.cadence,
      lastRun: item.lastRun,
      summary: item.summary,
    });
    setEditingTitle(item.title);
    setError("");
    setIsFormOpen(true);
  }

  function handleDelete(title: string) {
    if (!window.confirm(`Excluir o relatorio "${title}"?`)) return;
    const nextReports = reports.filter((item) => item.title !== title);
    setReports(nextReports);
    saveReports(nextReports);
  }

  function handleSave() {
    if (!form.title.trim() || !form.owner.trim() || !form.cadence.trim() || !form.summary.trim()) {
      setError("Preencha titulo, responsavel, cadencia e resumo.");
      return;
    }

    if (
      reports.some(
        (item) => item.title.toLowerCase() === form.title.trim().toLowerCase() && item.title !== editingTitle,
      )
    ) {
      setError("Ja existe um relatorio com esse titulo.");
      return;
    }

    const nextItem: ReportItem = {
      title: form.title.trim(),
      owner: form.owner.trim(),
      cadence: form.cadence.trim(),
      lastRun: form.lastRun.trim() || "Ainda nao executado",
      summary: form.summary.trim(),
    };

    const nextReports =
      editingTitle === null
        ? [nextItem, ...reports]
        : reports.map((item) => (item.title === editingTitle ? nextItem : item));

    setReports(nextReports);
    saveReports(nextReports);
    resetForm();
  }

  function handleGenerateReport() {
    const totalCapacityUsed = locations.reduce(
      (sum, location) => sum + Math.max(0, getLocationUsedCapacity(location.id, movements)),
      0,
    );

    exportCsv("relatorio-operacional.csv", [
      ["Indicador", "Valor"],
      ["Produtos cadastrados", String(products.length)],
      ["Lotes em monitoramento", String(lots.length)],
      ["Alertas em aberto", String(notifications.filter((item) => !item.status.toLowerCase().includes("concl")).length)],
      ["Localizacoes ativas", String(locations.length)],
      ["Eventos operacionais", String(movements.length)],
      ["Volume ocupado", String(totalCapacityUsed)],
      [""],
      ["Relatorio", "Cadencia", "Responsavel", "Ultima execucao"],
      ...reports.map((item) => [item.title, item.cadence, item.owner, item.lastRun]),
    ]);
  }

  return (
    <section className="space-y-8">
      <Hero
        section={section}
        eyebrow="Inteligencia"
        actions={
          <>
            <Link href="/dashboard/calendario" className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]">
              Agenda de envios
            </Link>
            <ActionButton onClick={() => setIsFormOpen(true)}>Novo relatorio</ActionButton>
            <ActionButton tone="primary" onClick={handleGenerateReport}>Gerar Relatorio</ActionButton>
          </>
        }
      />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingTitle ? "Editar relatorio" : "Novo relatorio"}
          description="Cadastre relatorios operacionais, donos da rotina e a janela de execucao."
          error={error}
          submitLabel={editingTitle ? "Salvar alteracoes" : "Salvar relatorio"}
          onSubmit={handleSave}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Titulo">
              <TextInput value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Giro por linha e especie" />
            </FormField>
            <FormField label="Responsavel">
              <TextInput value={form.owner} onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))} placeholder="Ex.: Controladoria industrial" />
            </FormField>
            <FormField label="Cadencia">
              <TextInput value={form.cadence} onChange={(event) => setForm((current) => ({ ...current, cadence: event.target.value }))} placeholder="Ex.: Diario" />
            </FormField>
            <FormField label="Ultima execucao">
              <TextInput value={form.lastRun} onChange={(event) => setForm((current) => ({ ...current, lastRun: event.target.value }))} placeholder="Ex.: Hoje, 07:10" />
            </FormField>
          </div>
          <FormField label="Resumo">
            <TextareaInput value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} placeholder="Descreva o objetivo e os indicadores principais." />
          </FormField>
        </InlineFormPanel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Relatorios ativos" value={String(reports.length)} helper="Rotinas cadastradas na torre de controle" />
        <SummaryCard title="Cadencia diaria" value={String(reports.filter((item) => normalizeText(item.cadence).includes("diar")).length)} helper="Visoes executadas diariamente" />
        <SummaryCard title="Alertas em aberto" value={String(notifications.filter((item) => !item.status.toLowerCase().includes("concl")).length)} helper="Contexto operacional para leitura rapida" tone="warning" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {reports.map((item) => (
          <article key={item.title} className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_10px_24px_var(--shadow-color)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xl font-semibold text-[var(--foreground)]">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{item.summary}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill label={item.cadence} tone="bg-[var(--accent-soft)] text-[var(--accent)]" />
                <button type="button" onClick={() => handleEdit(item)} className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]">Editar</button>
                <button type="button" onClick={() => handleDelete(item.title)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Excluir</button>
              </div>
            </div>
            <div className="mt-5 grid gap-3 text-sm text-[var(--muted-foreground)] sm:grid-cols-2">
              <p>Responsavel: {item.owner}</p>
              <p>Ultima execucao: {item.lastRun}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyNotificationsModule({ section }: { section: DashboardSection }) {
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

function NotificationsModule({ section }: { section: DashboardSection }) {
  const [notifications, setNotifications] = useOperationsCollection(loadNotifications);

  function handleMarkAllAsRead() {
    const nextNotifications = notifications.map((item) =>
      item.status === NOTIFICATION_STATUS_DONE ? item : { ...item, status: NOTIFICATION_STATUS_DONE },
    );

    setNotifications(nextNotifications);
    saveNotifications(nextNotifications);
  }

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Central" actions={<ActionButton onClick={handleMarkAllAsRead}>Marcar tudo como lido</ActionButton>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total de Alertas" value={String(notifications.length)} helper="Itens registrados na central operacional" />
        <SummaryCard title="Alta Prioridade" value={String(notifications.filter((item) => item.priority === "Alta").length)} helper="Demandam acao imediata ou aprovacao" tone="danger" />
        <SummaryCard title="Em Andamento" value={String(notifications.filter((item) => item.status === "Em andamento").length)} helper="Alertas ja assumidos por uma area" tone="warning" />
        <SummaryCard title="Pendentes" value={String(notifications.filter((item) => item.status !== "Em andamento" && item.status !== NOTIFICATION_STATUS_DONE).length)} helper="Ainda nao consumidos pela operacao" tone="warning" />
      </div>

      <Panel title="Caixa de entrada operacional" eyebrow="Alertas">
        <div className="space-y-4">
          {notifications.map((item) => (
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyPendingModule({ section }: { section: DashboardSection }) {
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyTasksModule({ section }: { section: DashboardSection }) {
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyDistributorsModule({ section }: { section: DashboardSection }) {
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyCalendarModule({ section }: { section: DashboardSection }) {
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyIncidentsModule({ section }: { section: DashboardSection }) {
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyDocumentsModule({ section }: { section: DashboardSection }) {
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

function PendingModule({ section }: { section: DashboardSection }) {
  const [items, setItems] = useOperationsCollection(loadPendingItems);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [error, setError] = useState("");
  const priorityOptions = useMemo(() => Array.from(new Set(PENDING_ITEMS.map((item) => item.priority))) as PendingItem["priority"][], []);
  const [form, setForm] = useState({
    title: "",
    owner: "",
    area: "",
    due: "",
    priority: PENDING_ITEMS[0]?.priority ?? priorityOptions[0],
  });

  function resetForm() {
    setForm({
      title: "",
      owner: "",
      area: "",
      due: "",
      priority: PENDING_ITEMS[0]?.priority ?? priorityOptions[0],
    });
    setEditingTitle(null);
    setError("");
    setIsFormOpen(false);
  }

  function handleEdit(item: PendingItem) {
    setForm({ ...item });
    setEditingTitle(item.title);
    setError("");
    setIsFormOpen(true);
  }

  function handleDelete(title: string) {
    if (!window.confirm(`Excluir a pendencia "${title}"?`)) return;
    const nextItems = items.filter((item) => item.title !== title);
    setItems(nextItems);
    savePendingItems(nextItems);
  }

  function handleSave() {
    if (!form.title.trim() || !form.owner.trim() || !form.area.trim() || !form.due.trim()) {
      setError("Preencha titulo, responsavel, area e prazo.");
      return;
    }

    if (items.some((item) => item.title.toLowerCase() === form.title.trim().toLowerCase() && item.title !== editingTitle)) {
      setError("Ja existe uma pendencia com esse titulo.");
      return;
    }

    const nextItem: PendingItem = {
      title: form.title.trim(),
      owner: form.owner.trim(),
      area: form.area.trim(),
      due: form.due.trim(),
      priority: form.priority,
    };

    const nextItems =
      editingTitle === null ? [nextItem, ...items] : items.map((item) => (item.title === editingTitle ? nextItem : item));

    setItems(nextItems);
    savePendingItems(nextItems);
    resetForm();
  }

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Execucao" actions={<ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>Nova pendencia</ActionButton>} />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingTitle ? "Editar pendencia" : "Nova pendencia"}
          description="Controle os itens que ainda dependem de acao operacional."
          error={error}
          submitLabel={editingTitle ? "Salvar alteracoes" : "Salvar pendencia"}
          onSubmit={handleSave}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Titulo">
              <TextInput value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Confirmar recebimento do TRF" />
            </FormField>
            <FormField label="Responsavel">
              <TextInput value={form.owner} onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))} placeholder="Ex.: Carlos Menezes" />
            </FormField>
            <FormField label="Area">
              <TextInput value={form.area} onChange={(event) => setForm((current) => ({ ...current, area: event.target.value }))} placeholder="Ex.: CD Sudeste" />
            </FormField>
            <FormField label="Prazo">
              <TextInput value={form.due} onChange={(event) => setForm((current) => ({ ...current, due: event.target.value }))} placeholder="Ex.: Hoje, 17:30" />
            </FormField>
            <FormField label="Prioridade">
              <SelectInput value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as PendingItem["priority"] }))}>
                {priorityOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </SelectInput>
            </FormField>
          </div>
        </InlineFormPanel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Pendencias abertas" value={String(items.length)} helper="Itens aguardando algum tipo de follow-up" />
        <SummaryCard title="Alta prioridade" value={String(items.filter((item) => item.priority === "Alta").length)} helper="Demandam acao mais imediata" tone="danger" />
        <SummaryCard title="Demais itens" value={String(items.filter((item) => item.priority !== "Alta").length)} helper="Pendencias em acompanhamento" tone="warning" />
      </div>

      <Panel title="Painel de pendencias" eyebrow="Follow-up">
        <div className="space-y-4">
          {items.map((item) => (
            <article key={item.title} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
                    <StatusPill label={item.priority} tone={toneByLabel(item.priority)} />
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.area} · Responsavel: {item.owner}</p>
                  <p className="mt-1 text-sm font-medium text-[var(--navy-900)]">{item.due}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleEdit(item)} className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]">Editar</button>
                  <button type="button" onClick={() => handleDelete(item.title)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Excluir</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function TasksModule({ section }: { section: DashboardSection }) {
  const [tasks, setTasks] = useOperationsCollection(loadTasks);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [error, setError] = useState("");
  const statusOptions = useMemo(() => Array.from(new Set(TASKS.map((item) => item.status))) as TaskItem["status"][], []);
  const waitingStatus = useMemo(() => statusOptions.find((item) => normalizeText(item).includes("aguard")) ?? statusOptions[0], [statusOptions]);
  const runningStatus = useMemo(() => statusOptions.find((item) => normalizeText(item).includes("execu")) ?? statusOptions[0], [statusOptions]);
  const doneStatus = useMemo(() => statusOptions.find((item) => normalizeText(item).includes("conclu")) ?? statusOptions[0], [statusOptions]);
  const [form, setForm] = useState({
    title: "",
    shift: "",
    owner: "",
    checklist: "",
    completed: "",
    status: TASKS[0]?.status ?? statusOptions[0],
  });

  function resolveTaskStatus(completed: number, checklist: number): TaskItem["status"] {
    if (completed >= checklist) return doneStatus;
    if (completed > 0) return runningStatus;
    return waitingStatus;
  }

  function resetForm() {
    setForm({
      title: "",
      shift: "",
      owner: "",
      checklist: "",
      completed: "",
      status: TASKS[0]?.status ?? statusOptions[0],
    });
    setEditingTitle(null);
    setError("");
    setIsFormOpen(false);
  }

  function handleEdit(item: TaskItem) {
    setForm({
      title: item.title,
      shift: item.shift,
      owner: item.owner,
      checklist: String(item.checklist),
      completed: String(item.completed),
      status: item.status,
    });
    setEditingTitle(item.title);
    setError("");
    setIsFormOpen(true);
  }

  function handleDelete(title: string) {
    if (!window.confirm(`Excluir a tarefa "${title}"?`)) return;
    const nextTasks = tasks.filter((item) => item.title !== title);
    setTasks(nextTasks);
    saveTasks(nextTasks);
  }

  function handleAdvance(title: string) {
    const nextTasks = tasks.map((item) => {
      if (item.title !== title) return item;
      const completed = Math.min(item.checklist, item.completed + 1);
      return { ...item, completed, status: resolveTaskStatus(completed, item.checklist) };
    });

    setTasks(nextTasks);
    saveTasks(nextTasks);
  }

  function handleSave() {
    const checklist = Number(form.checklist);
    const completedRaw = Number(form.completed);

    if (!form.title.trim() || !form.shift.trim() || !form.owner.trim()) {
      setError("Preencha titulo, turno e responsavel.");
      return;
    }

    if ([checklist, completedRaw].some((value) => Number.isNaN(value) || value < 0)) {
      setError("Informe checklist e concluido com numeros validos.");
      return;
    }

    if (completedRaw > checklist) {
      setError("Concluido nao pode ser maior que o checklist.");
      return;
    }

    if (tasks.some((item) => item.title.toLowerCase() === form.title.trim().toLowerCase() && item.title !== editingTitle)) {
      setError("Ja existe uma tarefa com esse titulo.");
      return;
    }

    const completed = Math.min(checklist, completedRaw);
    const nextItem: TaskItem = {
      title: form.title.trim(),
      shift: form.shift.trim(),
      owner: form.owner.trim(),
      checklist,
      completed,
      status: resolveTaskStatus(completed, checklist),
    };

    const nextTasks =
      editingTitle === null ? [nextItem, ...tasks] : tasks.map((item) => (item.title === editingTitle ? nextItem : item));

    setTasks(nextTasks);
    saveTasks(nextTasks);
    resetForm();
  }

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Execucao" actions={<ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>Nova tarefa</ActionButton>} />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingTitle ? "Editar tarefa" : "Nova tarefa"}
          description="Organize a rotina por turno e acompanhe o progresso das checklists."
          error={error}
          submitLabel={editingTitle ? "Salvar alteracoes" : "Salvar tarefa"}
          onSubmit={handleSave}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Titulo">
              <TextInput value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Conferencia de pallets" />
            </FormField>
            <FormField label="Turno">
              <TextInput value={form.shift} onChange={(event) => setForm((current) => ({ ...current, shift: event.target.value }))} placeholder="Ex.: Turno A" />
            </FormField>
            <FormField label="Responsavel">
              <TextInput value={form.owner} onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))} placeholder="Ex.: Diego Paiva" />
            </FormField>
            <FormField label="Checklist">
              <TextInput value={form.checklist} onChange={(event) => setForm((current) => ({ ...current, checklist: event.target.value }))} inputMode="numeric" placeholder="Ex.: 8" />
            </FormField>
            <FormField label="Concluido">
              <TextInput value={form.completed} onChange={(event) => setForm((current) => ({ ...current, completed: event.target.value }))} inputMode="numeric" placeholder="Ex.: 5" />
            </FormField>
          </div>
        </InlineFormPanel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Tarefas ativas" value={String(tasks.filter((item) => item.status !== doneStatus).length)} helper="Fluxos ainda em andamento no dia" />
        <SummaryCard title="Checklists concluidos" value={`${tasks.reduce((sum, item) => sum + item.completed, 0)}`} helper="Itens ja executados nas rotinas abertas" />
        <SummaryCard title="Turnos monitorados" value={String(new Set(tasks.map((item) => item.shift)).size)} helper="Cobertura operacional por janela de trabalho" />
      </div>

      <Panel title="Rotina operacional por turno" eyebrow="Task board">
        <div className="space-y-4">
          {tasks.map((item) => {
            const percent = item.checklist > 0 ? (item.completed / item.checklist) * 100 : 0;

            return (
              <article key={item.title} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
                      <StatusPill label={item.status} tone={toneByLabel(item.status)} />
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.shift} · Responsavel: {item.owner}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-[var(--navy-900)]">{item.completed}/{item.checklist} etapas</p>
                    <button type="button" onClick={() => handleAdvance(item.title)} className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]">Avancar</button>
                    <button type="button" onClick={() => handleEdit(item)} className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]">Editar</button>
                    <button type="button" onClick={() => handleDelete(item.title)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Excluir</button>
                  </div>
                </div>
                <div className="mt-4 h-2.5 rounded-full bg-[var(--panel)]">
                  <div className={`h-2.5 rounded-full ${item.status === doneStatus ? "bg-emerald-500" : item.status === runningStatus ? "bg-[var(--accent)]" : "bg-amber-500"}`} style={{ width: `${Math.max(8, percent)}%` }} />
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
    </section>
  );
}

function DistributorsModule({ section }: { section: DashboardSection }) {
  const [distributors, setDistributors] = useOperationsCollection(loadDistributors);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [error, setError] = useState("");
  const priorityOptions = useMemo(
    () => Array.from(new Set(DISTRIBUTORS.map((item) => item.priority))) as DistributorItem["priority"][],
    [],
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(DISTRIBUTORS.map((item) => item.status))) as DistributorItem["status"][],
    [],
  );
  const attentionStatus = useMemo(
    () => statusOptions.find((item) => normalizeText(item).includes("atenc")) ?? statusOptions[0],
    [statusOptions],
  );
  const [form, setForm] = useState({
    name: "",
    region: "",
    channel: "",
    priority: DISTRIBUTORS[0]?.priority ?? ("Alta" as DistributorItem["priority"]),
    lastSupply: "",
    status: DISTRIBUTORS[0]?.status ?? ("Ativo" as DistributorItem["status"]),
  });

  function resetForm() {
    setForm({
      name: "",
      region: "",
      channel: "",
      priority: DISTRIBUTORS[0]?.priority ?? priorityOptions[0],
      lastSupply: "",
      status: DISTRIBUTORS[0]?.status ?? statusOptions[0],
    });
    setEditingName(null);
    setError("");
    setIsFormOpen(false);
  }

  function handleEdit(item: DistributorItem) {
    setForm({
      name: item.name,
      region: item.region,
      channel: item.channel,
      priority: item.priority,
      lastSupply: item.lastSupply,
      status: item.status,
    });
    setEditingName(item.name);
    setError("");
    setIsFormOpen(true);
  }

  function handleDelete(name: string) {
    if (!window.confirm(`Excluir o distribuidor "${name}"?`)) return;
    const nextDistributors = distributors.filter((item) => item.name !== name);
    setDistributors(nextDistributors);
    saveDistributors(nextDistributors);
  }

  function handleSave() {
    if (!form.name.trim() || !form.region.trim() || !form.channel.trim() || !form.lastSupply.trim()) {
      setError("Preencha nome, regiao, canal e ultimo abastecimento.");
      return;
    }

    if (
      distributors.some(
        (item) => item.name.toLowerCase() === form.name.trim().toLowerCase() && item.name !== editingName,
      )
    ) {
      setError("Ja existe um distribuidor com esse nome.");
      return;
    }

    const nextItem: DistributorItem = {
      name: form.name.trim(),
      region: form.region.trim(),
      channel: form.channel.trim(),
      priority: form.priority,
      lastSupply: form.lastSupply.trim(),
      status: form.status,
    };

    const nextDistributors =
      editingName === null
        ? [nextItem, ...distributors]
        : distributors.map((item) => (item.name === editingName ? nextItem : item));

    setDistributors(nextDistributors);
    saveDistributors(nextDistributors);
    resetForm();
  }

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Clientes" actions={<ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>Novo distribuidor</ActionButton>} />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingName ? "Editar distribuidor" : "Novo distribuidor"}
          description="Cadastre parceiros de distribuicao e acompanhe criticidade, canal e ultima reposicao."
          error={error}
          submitLabel={editingName ? "Salvar alteracoes" : "Salvar distribuidor"}
          onSubmit={handleSave}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Nome">
              <TextInput value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Distribuidora Pet Sul" />
            </FormField>
            <FormField label="Regiao">
              <TextInput value={form.region} onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))} placeholder="Ex.: Sul" />
            </FormField>
            <FormField label="Canal">
              <TextInput value={form.channel} onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))} placeholder="Ex.: Especializado" />
            </FormField>
            <FormField label="Prioridade">
              <SelectInput value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as DistributorItem["priority"] }))}>
                {priorityOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Ultimo abastecimento">
              <TextInput value={form.lastSupply} onChange={(event) => setForm((current) => ({ ...current, lastSupply: event.target.value }))} placeholder="Ex.: Hoje, 08:50" />
            </FormField>
            <FormField label="Status">
              <SelectInput value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as DistributorItem["status"] }))}>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </SelectInput>
            </FormField>
          </div>
        </InlineFormPanel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Base de distribuidores" value={String(distributors.length)} helper="Parceiros ativos no ciclo de atendimento" />
        <SummaryCard title="Alta prioridade" value={String(distributors.filter((item) => item.priority === "Alta").length)} helper="Contas com prioridade comercial elevada" tone="danger" />
        <SummaryCard title="Em atencao" value={String(distributors.filter((item) => item.status === attentionStatus).length)} helper="Operacoes que pedem acompanhamento mais proximo" tone="warning" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {distributors.map((item) => (
          <article key={item.name} className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_10px_24px_var(--shadow-color)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xl font-semibold text-[var(--foreground)]">{item.name}</p>
                <StatusPill label={item.priority} tone={toneByLabel(item.priority)} />
                <StatusPill label={item.status} tone={toneByLabel(item.status)} />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleEdit(item)} className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]">Editar</button>
                <button type="button" onClick={() => handleDelete(item.name)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Excluir</button>
              </div>
            </div>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">{item.region} · {item.channel}</p>
            <p className="mt-4 text-sm text-[var(--muted-foreground)]">Ultimo abastecimento: {item.lastSupply}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function CalendarModule({ section }: { section: DashboardSection }) {
  const [events, setEvents] = useOperationsCollection(loadCalendarEvents);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [error, setError] = useState("");
  const typeOptions = useMemo(
    () => Array.from(new Set(CALENDAR_EVENTS.map((item) => item.type))) as CalendarItem["type"][],
    [],
  );
  const [form, setForm] = useState({
    title: "",
    slot: "",
    area: "",
    type: CALENDAR_EVENTS[0]?.type ?? ("Expedi\u00e7\u00e3o" as CalendarItem["type"]),
  });

  function resetForm() {
    setForm({
      title: "",
      slot: "",
      area: "",
      type: CALENDAR_EVENTS[0]?.type ?? typeOptions[0],
    });
    setEditingTitle(null);
    setError("");
    setIsFormOpen(false);
  }

  function handleEdit(item: CalendarItem) {
    setForm({
      title: item.title,
      slot: item.slot,
      area: item.area,
      type: item.type,
    });
    setEditingTitle(item.title);
    setError("");
    setIsFormOpen(true);
  }

  function handleDelete(title: string) {
    if (!window.confirm(`Excluir o evento "${title}"?`)) return;
    const nextEvents = events.filter((item) => item.title !== title);
    setEvents(nextEvents);
    saveCalendarEvents(nextEvents);
  }

  function handleSave() {
    if (!form.title.trim() || !form.slot.trim() || !form.area.trim()) {
      setError("Preencha titulo, horario e area.");
      return;
    }

    if (events.some((item) => item.title.toLowerCase() === form.title.trim().toLowerCase() && item.title !== editingTitle)) {
      setError("Ja existe um evento com esse titulo.");
      return;
    }

    const nextItem: CalendarItem = {
      title: form.title.trim(),
      slot: form.slot.trim(),
      area: form.area.trim(),
      type: form.type,
    };

    const nextEvents =
      editingTitle === null ? [nextItem, ...events] : events.map((item) => (item.title === editingTitle ? nextItem : item));

    setEvents(nextEvents);
    saveCalendarEvents(nextEvents);
    resetForm();
  }

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Agenda" actions={<ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>Novo evento</ActionButton>} />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingTitle ? "Editar evento" : "Novo evento"}
          description="Mantenha a agenda operacional atualizada com janelas, inspeções e recebimentos."
          error={error}
          submitLabel={editingTitle ? "Salvar alteracoes" : "Salvar evento"}
          onSubmit={handleSave}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Titulo">
              <TextInput value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Janela de carregamento do CD Sudeste" />
            </FormField>
            <FormField label="Horario">
              <TextInput value={form.slot} onChange={(event) => setForm((current) => ({ ...current, slot: event.target.value }))} placeholder="Ex.: Hoje, 18:00" />
            </FormField>
            <FormField label="Area">
              <TextInput value={form.area} onChange={(event) => setForm((current) => ({ ...current, area: event.target.value }))} placeholder="Ex.: Expedicao Dourado" />
            </FormField>
            <FormField label="Tipo">
              <SelectInput value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as CalendarItem["type"] }))}>
                {typeOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </SelectInput>
            </FormField>
          </div>
        </InlineFormPanel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Eventos agendados" value={String(events.length)} helper="Rotina operacional consolidada em um unico lugar" />
        <SummaryCard title="Areas cobertas" value={String(new Set(events.map((item) => item.area)).size)} helper="Times com compromisso registrado na agenda" />
        <SummaryCard title="Tipos ativos" value={String(new Set(events.map((item) => item.type)).size)} helper="Frentes diferentes da operacao monitoradas" />
      </div>

      <Panel title="Proximos eventos" eyebrow="Calendario operacional">
        <div className="space-y-4">
          {events.map((event) => (
            <article key={event.title} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{event.title}</p>
                    <StatusPill label={event.type} tone="bg-[var(--accent-soft)] text-[var(--accent)]" />
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{event.area}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[var(--navy-900)]">{event.slot}</p>
                  <button type="button" onClick={() => handleEdit(event)} className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]">Editar</button>
                  <button type="button" onClick={() => handleDelete(event.title)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Excluir</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function IncidentsModule({ section }: { section: DashboardSection }) {
  const [incidents, setIncidents] = useOperationsCollection(loadIncidents);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [error, setError] = useState("");
  const severityOptions = useMemo(
    () => Array.from(new Set(INCIDENTS.map((item) => item.severity))) as IncidentItem["severity"][],
    [],
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(INCIDENTS.map((item) => item.status))) as IncidentItem["status"][],
    [],
  );
  const closedStatus = useMemo(
    () => statusOptions.find((item) => normalizeText(item).includes("encerr")) ?? statusOptions[statusOptions.length - 1],
    [statusOptions],
  );
  const [form, setForm] = useState({
    title: "",
    area: "",
    severity: INCIDENTS[0]?.severity ?? ("Alta" as IncidentItem["severity"]),
    owner: "",
    status: INCIDENTS[0]?.status ?? ("Aberto" as IncidentItem["status"]),
  });

  function resetForm() {
    setForm({
      title: "",
      area: "",
      severity: INCIDENTS[0]?.severity ?? severityOptions[0],
      owner: "",
      status: INCIDENTS[0]?.status ?? statusOptions[0],
    });
    setEditingTitle(null);
    setError("");
    setIsFormOpen(false);
  }

  function handleEdit(item: IncidentItem) {
    setForm({
      title: item.title,
      area: item.area,
      severity: item.severity,
      owner: item.owner,
      status: item.status,
    });
    setEditingTitle(item.title);
    setError("");
    setIsFormOpen(true);
  }

  function handleDelete(title: string) {
    if (!window.confirm(`Excluir o incidente "${title}"?`)) return;
    const nextIncidents = incidents.filter((item) => item.title !== title);
    setIncidents(nextIncidents);
    saveIncidents(nextIncidents);
  }

  function handleClose(title: string) {
    const nextIncidents = incidents.map((item) => (item.title === title ? { ...item, status: closedStatus } : item));
    setIncidents(nextIncidents);
    saveIncidents(nextIncidents);
  }

  function handleSave() {
    if (!form.title.trim() || !form.area.trim() || !form.owner.trim()) {
      setError("Preencha titulo, area e responsavel.");
      return;
    }

    if (incidents.some((item) => item.title.toLowerCase() === form.title.trim().toLowerCase() && item.title !== editingTitle)) {
      setError("Ja existe um incidente com esse titulo.");
      return;
    }

    const nextItem: IncidentItem = {
      title: form.title.trim(),
      area: form.area.trim(),
      severity: form.severity,
      owner: form.owner.trim(),
      status: form.status,
    };

    const nextIncidents =
      editingTitle === null ? [nextItem, ...incidents] : incidents.map((item) => (item.title === editingTitle ? nextItem : item));

    setIncidents(nextIncidents);
    saveIncidents(nextIncidents);
    resetForm();
  }

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Ocorrencias" actions={<ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>Novo incidente</ActionButton>} />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingTitle ? "Editar incidente" : "Novo incidente"}
          description="Registre ocorrencias, nivel de severidade e o dono da tratativa para a operacao."
          error={error}
          submitLabel={editingTitle ? "Salvar alteracoes" : "Salvar incidente"}
          onSubmit={handleSave}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Titulo">
              <TextInput value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Divergencia de embalagem secundaria" />
            </FormField>
            <FormField label="Area">
              <TextInput value={form.area} onChange={(event) => setForm((current) => ({ ...current, area: event.target.value }))} placeholder="Ex.: Qualidade" />
            </FormField>
            <FormField label="Severidade">
              <SelectInput value={form.severity} onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value as IncidentItem["severity"] }))}>
                {severityOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Responsavel">
              <TextInput value={form.owner} onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))} placeholder="Ex.: Marina Azevedo" />
            </FormField>
            <FormField label="Status">
              <SelectInput value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as IncidentItem["status"] }))}>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </SelectInput>
            </FormField>
          </div>
        </InlineFormPanel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Incidentes abertos" value={String(incidents.filter((item) => item.status !== closedStatus).length)} helper="Casos que ainda precisam de tratativa" tone="danger" />
        <SummaryCard title="Severidade alta" value={String(incidents.filter((item) => item.severity === "Alta").length)} helper="Ocorrencias com maior impacto operacional" tone="danger" />
        <SummaryCard title="Encerrados" value={String(incidents.filter((item) => item.status === closedStatus).length)} helper="Casos fechados e rastreados no sistema" tone="success" />
      </div>

      <Panel title="Registro de incidentes" eyebrow="Tratativa">
        <div className="space-y-4">
          {incidents.map((item) => (
            <article key={item.title} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
                    <StatusPill label={item.severity} tone={toneByLabel(item.severity)} />
                    <StatusPill label={item.status} tone={toneByLabel(item.status)} />
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.area} · Responsavel: {item.owner}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleClose(item.title)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100">Encerrar</button>
                  <button type="button" onClick={() => handleEdit(item)} className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]">Editar</button>
                  <button type="button" onClick={() => handleDelete(item.title)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Excluir</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function DocumentsModule({ section }: { section: DashboardSection }) {
  const [documents, setDocuments] = useOperationsCollection(loadDocuments);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    type: "",
    area: "",
    updatedAt: "",
    owner: "",
  });

  function resetForm() {
    setForm({
      title: "",
      type: "",
      area: "",
      updatedAt: "",
      owner: "",
    });
    setEditingTitle(null);
    setError("");
    setIsFormOpen(false);
  }

  function handleEdit(item: DocumentItem) {
    setForm({
      title: item.title,
      type: item.type,
      area: item.area,
      updatedAt: item.updatedAt,
      owner: item.owner,
    });
    setEditingTitle(item.title);
    setError("");
    setIsFormOpen(true);
  }

  function handleDelete(title: string) {
    if (!window.confirm(`Excluir o documento "${title}"?`)) return;
    const nextDocuments = documents.filter((item) => item.title !== title);
    setDocuments(nextDocuments);
    saveDocuments(nextDocuments);
  }

  function handleSave() {
    if (!form.title.trim() || !form.type.trim() || !form.area.trim() || !form.owner.trim()) {
      setError("Preencha titulo, tipo, area e responsavel.");
      return;
    }

    if (documents.some((item) => item.title.toLowerCase() === form.title.trim().toLowerCase() && item.title !== editingTitle)) {
      setError("Ja existe um documento com esse titulo.");
      return;
    }

    const nextItem: DocumentItem = {
      title: form.title.trim(),
      type: form.type.trim(),
      area: form.area.trim(),
      updatedAt: form.updatedAt.trim() || "Atualizado agora",
      owner: form.owner.trim(),
    };

    const nextDocuments =
      editingTitle === null ? [nextItem, ...documents] : documents.map((item) => (item.title === editingTitle ? nextItem : item));

    setDocuments(nextDocuments);
    saveDocuments(nextDocuments);
    resetForm();
  }

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Documentacao" actions={<ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>Novo documento</ActionButton>} />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingTitle ? "Editar documento" : "Novo documento"}
          description="Cadastre laudos, comprovantes e checklists com ownership claro para a operacao."
          error={error}
          submitLabel={editingTitle ? "Salvar alteracoes" : "Salvar documento"}
          onSubmit={handleSave}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Titulo">
              <TextInput value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Laudo microbiologico do lote PFM260327" />
            </FormField>
            <FormField label="Tipo">
              <TextInput value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} placeholder="Ex.: Laudo" />
            </FormField>
            <FormField label="Area">
              <TextInput value={form.area} onChange={(event) => setForm((current) => ({ ...current, area: event.target.value }))} placeholder="Ex.: Qualidade" />
            </FormField>
            <FormField label="Atualizado em">
              <TextInput value={form.updatedAt} onChange={(event) => setForm((current) => ({ ...current, updatedAt: event.target.value }))} placeholder="Ex.: Hoje, 10:30" />
            </FormField>
            <FormField label="Responsavel">
              <TextInput value={form.owner} onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))} placeholder="Ex.: Tatiane Freitas" />
            </FormField>
          </div>
        </InlineFormPanel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Documentos ativos" value={String(documents.length)} helper="Arquivos e evidencias registrados na operacao" />
        <SummaryCard title="Areas documentadas" value={String(new Set(documents.map((item) => item.area)).size)} helper="Setores com rastreabilidade disponivel" />
        <SummaryCard title="Tipos diferentes" value={String(new Set(documents.map((item) => item.type)).size)} helper="Variedade de artefatos cadastrados" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {documents.map((item) => (
          <article key={item.title} className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_10px_24px_var(--shadow-color)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xl font-semibold text-[var(--foreground)]">{item.title}</p>
                <StatusPill label={item.type} tone="bg-[var(--accent-soft)] text-[var(--accent)]" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleEdit(item)} className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]">Editar</button>
                <button type="button" onClick={() => handleDelete(item.title)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Excluir</button>
              </div>
            </div>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">{item.area}</p>
            <div className="mt-5 grid gap-3 text-sm text-[var(--muted-foreground)] sm:grid-cols-2">
              <p>Atualizado em: {item.updatedAt}</p>
              <p>Responsavel: {item.owner}</p>
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
