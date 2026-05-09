"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DocumentsModule } from "@/components/dashboard/operations/DocumentsModule";
import { IncidentsModule } from "@/components/dashboard/operations/IncidentsModule";
import { PendingModule } from "@/components/dashboard/operations/PendingModule";
import { QualityEventsModule } from "@/components/dashboard/operations/QualityEventsModule";
import { TasksModule } from "@/components/dashboard/operations/TasksModule";
import {
  ActionButton,
  FormField,
  Hero,
  InlineFormPanel,
  Panel,
  SelectInput,
  StatusPill,
  SummaryCard,
  TextInput,
} from "@/components/dashboard/operations/ui";
import { useOperationsCollection } from "@/components/dashboard/operations/useOperationsCollection";
import { ERP_DATA_EVENT } from "@/lib/app-events";
import type { DashboardSection } from "@/lib/dashboard-sections";
import {
  CALENDAR_EVENTS,
  type CalendarItem,
  CATEGORIES,
  type CategoryItem,
  DISTRIBUTORS,
  type DistributorItem,
  LOTS,
  type LotItem,
  NOTIFICATIONS,
  type NotificationItem,
  PLANNING_ITEMS,
  type PlanningItem,
  PRODUCT_LINES,
  type ProductLineItem,
  REPORTS,
  type ReportItem,
  SUPPLIERS,
  type SupplierItem,
} from "@/lib/operations-data";
import {
  findMatchingProductReference,
  formatDateTime,
  formatUnits,
  getLocationUsedCapacity,
  getMovementTypeLabel,
  loadLocations,
  loadMovements,
  normalizeReferenceText,
  normalizeSkuIdentifier,
  normalizeText,
  type LocationItem,
  type MovementItem,
} from "@/lib/inventory";
import {
  createProductLine as createProductRecord,
  createLot as createLotRecord,
  loadCalendarEvents,
  loadCategories,
  loadDistributors,
  loadLots,
  loadNotifications,
  loadPlanningItems,
  loadProductLines,
  loadReports,
  loadSuppliers,
  LotRequestError,
  ProductRequestError,
  ProductVersionConflictError,
  refreshLots,
  refreshProductLines,
  saveCalendarEvents,
  saveCategories,
  saveDistributors,
  saveNotifications,
  savePlanningItems,
  saveReports,
  saveSuppliers,
} from "@/lib/operations-store";
import { useErpPermissions } from "@/lib/use-erp-permissions";

const PRODUCT_CONFLICT_MESSAGE =
  "Conflito de versao: os produtos foram alterados por outra sessao. Recarreguei a lista e nao salvei sua alteracao para evitar sobrescrita. Revise os dados e tente novamente.";
const PRODUCT_CREATE_CONFLICT_MESSAGE =
  "Nao foi possivel salvar porque houve conflito no cadastro do produto. Recarreguei a lista e nao sobrescrevi nada. Revise o SKU e tente novamente.";
const LOT_CONFLICT_MESSAGE =
  "Nao foi possivel salvar porque houve conflito no cadastro do lote. Recarreguei a lista e nao sobrescrevi nada. Revise o codigo do lote e tente novamente.";

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

function TextareaInput(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-28 w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] ${props.className ?? ""}`.trim()}
    />
  );
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

function getDerivedProductMovementDelta(movement: MovementItem) {
  if (movement.type === "transferencia") {
    const transferStatus = movement.transferStatus ?? "recebida";

    if (transferStatus === "cancelada" || transferStatus === "solicitada" || transferStatus === "em_separacao") {
      return 0;
    }

    if (transferStatus === "em_transito") {
      return -movement.quantity;
    }

    return 0;
  }

  if ((movement.status ?? "concluida") === "cancelada") {
    return 0;
  }

  return movement.type === "entrada" ? movement.quantity : -movement.quantity;
}

function getDerivedProductStock(products: ProductLineItem[], movements: MovementItem[]) {
  if (movements.length === 0) {
    return new Map(products.map((product) => [product.sku, product.stock] as const));
  }

  const totalsByProductId = new Map<string, { stock: number; hasEffectiveMovement: boolean }>();
  const totalsByProductName = new Map<string, { stock: number; hasEffectiveMovement: boolean }>();

  for (const movement of movements) {
    const delta = getDerivedProductMovementDelta(movement);

    if (delta !== 0) {
      if (movement.productId) {
        const normalizedProductId = normalizeSkuIdentifier(movement.productId);
        const currentById = totalsByProductId.get(normalizedProductId) ?? { stock: 0, hasEffectiveMovement: false };
        currentById.stock += delta;
        currentById.hasEffectiveMovement = true;
        totalsByProductId.set(normalizedProductId, currentById);
        continue;
      }

      const normalizedProductName = normalizeReferenceText(movement.product);

      if (!normalizedProductName) {
        continue;
      }

      const currentByName = totalsByProductName.get(normalizedProductName) ?? { stock: 0, hasEffectiveMovement: false };
      currentByName.stock += delta;
      currentByName.hasEffectiveMovement = true;
      totalsByProductName.set(normalizedProductName, currentByName);
    }
  }

  return new Map(
    products.map((product) => {
      const derivedById = totalsByProductId.get(normalizeSkuIdentifier(product.sku));

      if (derivedById?.hasEffectiveMovement) {
        return [product.sku, derivedById.stock] as const;
      }

      const derivedByName = totalsByProductName.get(normalizeReferenceText(product.product));

      if (!derivedByName?.hasEffectiveMovement) {
        return [product.sku, product.stock] as const;
      }

      return [product.sku, derivedByName.stock] as const;
    }),
  );
}

function getProductsWithDerivedStock(products: ProductLineItem[], movements: MovementItem[]) {
  const derivedStockBySku = getDerivedProductStock(products, movements);

  return products.map((product) => {
    const derivedStock = derivedStockBySku.get(product.sku) ?? product.stock;

    return {
      ...product,
      stock: derivedStock,
      status: resolveOperationalProductStatus(derivedStock, product.target, product.coverageDays),
    };
  });
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
  const { movements } = useInventoryData();
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
  const derivedProducts = useMemo(() => getProductsWithDerivedStock(products, movements), [movements, products]);

  const filtered = useMemo(() => {
    const normalized = normalizeText(query);
    return derivedProducts.filter((item) => {
      const matchesQuery = normalizeText([item.product, item.sku, item.line, item.species, item.stage].join(" ")).includes(normalized);
      const matchesStatus = activeStatusFilter.value === "all" || item.status === activeStatusFilter.value;
      return matchesQuery && matchesStatus;
    });
  }, [activeStatusFilter.value, derivedProducts, query]);

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

  async function reloadProductsAfterConflict() {
    try {
      setProducts(await refreshProductLines());
    } catch {
      setProducts(loadProductLines());
    }
  }

  async function handleCreateProduct() {
    const sku = normalizeSkuIdentifier(form.sku);
    const stock = Number(form.stock);
    const target = Number(form.target);
    const coverageDays = Number(form.coverageDays);

    if (!sku || !form.product.trim() || !form.line.trim() || !form.stage.trim() || !form.package.trim()) {
      setError("Preencha SKU, produto, linha, categoria e embalagem.");
      return;
    }

    if ([stock, target, coverageDays].some((value) => Number.isNaN(value) || value < 0)) {
      setError("Informe estoque, meta e cobertura com numeros validos.");
      return;
    }

    if (products.some((item) => normalizeSkuIdentifier(item.sku) === sku)) {
      setError("Ja existe um produto com esse SKU.");
      return;
    }

    const product: ProductLineItem = {
      sku,
      product: form.product.trim(),
      line: form.line.trim(),
      species: form.species,
      stage: form.stage.trim(),
      package: form.package.trim(),
      stock,
      target,
      coverageDays,
      status: resolveOperationalProductStatus(stock, target, coverageDays),
    };

    try {
      const createdProduct = await createProductRecord(product);
      setProducts((currentProducts) => [
        createdProduct,
        ...currentProducts.filter(
          (item) => normalizeSkuIdentifier(item.sku) !== createdProduct.sku,
        ),
      ]);
      resetForm();
    } catch (error) {
      if (
        error instanceof ProductVersionConflictError ||
        (error instanceof ProductRequestError && error.status === 409)
      ) {
        await reloadProductsAfterConflict();
        setError(
          error instanceof ProductVersionConflictError
            ? PRODUCT_CONFLICT_MESSAGE
            : PRODUCT_CREATE_CONFLICT_MESSAGE,
        );
        return;
      }

      setError(
        error instanceof ProductRequestError
          ? error.message
          : "Nao foi possivel salvar o produto.",
      );
    }
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
  const [storedProducts] = useOperationsCollection(loadProductLines);
  const { movements } = useInventoryData();
  const products = useMemo(() => getProductsWithDerivedStock(storedProducts, movements), [movements, storedProducts]);
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

  async function reloadLotsAfterConflict() {
    try {
      setLots(await refreshLots());
    } catch {
      setLots(loadLots());
    }
  }

  async function handleCreateLot() {
    const quantity = Number(form.quantity);
    const matchedProduct = findMatchingProductReference(
      loadProductLines(),
      form.product,
    );
    const canonicalProductName = matchedProduct?.product ?? form.product.trim();
    const canonicalProductId = matchedProduct?.sku;

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

    try {
      await createLotRecord({
        code: form.code.trim(),
        product: canonicalProductName,
        productId: canonicalProductId,
        location: form.location.trim(),
        expiration: form.expiration,
        quantity,
        status: form.status,
      });
      resetForm();
    } catch (creationError) {
      if (creationError instanceof LotRequestError && creationError.status === 409) {
        await reloadLotsAfterConflict();
        setError(LOT_CONFLICT_MESSAGE);
        return;
      }

      setError(
        creationError instanceof Error
          ? creationError.message
          : "Nao foi possivel salvar o lote.",
      );
    }
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
  const { canDelete } = useErpPermissions();
  const canDeleteSuppliers = canDelete("operations.suppliers");
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
    if (!canDeleteSuppliers) {
      setError("Seu perfil nao pode excluir fornecedores.");
      return;
    }

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
                {canDeleteSuppliers ? (
                  <button type="button" onClick={() => handleDeleteSupplier(item.name)} className="rounded-xl p-2 text-rose-500 transition hover:bg-rose-50">✕</button>
                ) : null}
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
  const { canDelete } = useErpPermissions();
  const canDeleteCategories = canDelete("operations.categories");
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
    if (!canDeleteCategories) {
      setError("Seu perfil nao pode excluir categorias.");
      return;
    }

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
                {canDeleteCategories ? (
                  <button type="button" onClick={() => handleDeleteCategory(item.name)} className="rounded-xl p-2 text-rose-500 transition hover:bg-rose-50">✕</button>
                ) : null}
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

function PlanningModule({ section }: { section: DashboardSection }) {
  const { canDelete } = useErpPermissions();
  const canDeletePlanning = canDelete("operations.planning");
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
    if (!canDeletePlanning) {
      setError("Seu perfil nao pode excluir planejamentos.");
      return;
    }

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
                  {canDeletePlanning ? (
                    <button type="button" onClick={() => handleDeletePlan(item.route)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Excluir</button>
                  ) : null}
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
  const { canDelete } = useErpPermissions();
  const canDeleteReports = canDelete("operations.reports");
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
    if (!canDeleteReports) {
      setError("Seu perfil nao pode excluir relatorios.");
      return;
    }

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
                {canDeleteReports ? (
                  <button type="button" onClick={() => handleDelete(item.title)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Excluir</button>
                ) : null}
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
  const { canUpdate } = useErpPermissions();
  const canUpdateNotifications = canUpdate("operations.notifications");
  const [notifications, setNotifications] = useOperationsCollection(loadNotifications);

  function handleMarkAllAsRead() {
    if (!canUpdateNotifications) {
      return;
    }

    const nextNotifications = notifications.map((item) =>
      item.status === NOTIFICATION_STATUS_DONE ? item : { ...item, status: NOTIFICATION_STATUS_DONE },
    );

    setNotifications(nextNotifications);
    saveNotifications(nextNotifications);
  }

  return (
    <section className="space-y-8">
      <Hero
        section={section}
        eyebrow="Central"
        actions={canUpdateNotifications ? <ActionButton onClick={handleMarkAllAsRead}>Marcar tudo como lido</ActionButton> : null}
      />

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

function DistributorsModule({ section }: { section: DashboardSection }) {
  const { canDelete } = useErpPermissions();
  const canDeleteDistributors = canDelete("operations.distributors");
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
    if (!canDeleteDistributors) {
      setError("Seu perfil nao pode excluir distribuidores.");
      return;
    }

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
                {canDeleteDistributors ? (
                  <button type="button" onClick={() => handleDelete(item.name)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Excluir</button>
                ) : null}
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
  const { canDelete } = useErpPermissions();
  const canDeleteCalendarEvents = canDelete("operations.calendar");
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
    if (!canDeleteCalendarEvents) {
      setError("Seu perfil nao pode excluir eventos do calendario.");
      return;
    }

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
                  {canDeleteCalendarEvents ? (
                    <button type="button" onClick={() => handleDelete(event.title)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Excluir</button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

export function OperationsModuleScreen({ section }: { section: DashboardSection }) {
  if (section.id === "notificacoes") return <NotificationsModule section={section} />;
  if (section.id === "pendencias") return <PendingModule section={section} />;
  if (section.id === "produtos") return <ProductsModule section={section} />;
  if (section.id === "estoque-baixo") return <LowStockModule section={section} />;
  if (section.id === "lotes") return <LotsModule section={section} />;
  if (section.id === "qualidade") return <QualityEventsModule section={section} />;
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
      <Hero section={section} eyebrow="Fluxy" />
    </section>
  );
}
