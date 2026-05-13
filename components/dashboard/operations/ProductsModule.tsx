"use client";

import { useMemo, useState } from "react";

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
import {
  exportCsv,
  FilterBar,
  getProductsWithDerivedStock,
  PRODUCT_SPECIES_CATS,
  PRODUCT_SPECIES_DOGS,
  PRODUCT_STATUS_ATTENTION,
  PRODUCT_STATUS_CRITICAL,
  resolveOperationalProductStatus,
  Table,
  TableRow,
  toneByLabel,
  useInventoryData,
} from "@/components/dashboard/operations/module-helpers";
import { useOperationsCollection } from "@/components/dashboard/operations/useOperationsCollection";
import type { DashboardSection } from "@/lib/dashboard-sections";
import { formatUnits, normalizeSkuIdentifier, normalizeText } from "@/lib/inventory";
import type { ProductLineItem } from "@/lib/operations-data";
import {
  createProductLine as createProductRecord,
  loadProductLines,
  ProductRequestError,
  ProductVersionConflictError,
  refreshProductLines,
} from "@/lib/operations-store";
import { useErpMutation } from "@/lib/use-erp-mutation";

const PRODUCT_CONFLICT_MESSAGE =
  "Conflito de versao: os produtos foram alterados por outra sessao. Recarreguei a lista e nao salvei sua alteracao para evitar sobrescrita. Revise os dados e tente novamente.";
const PRODUCT_CREATE_CONFLICT_MESSAGE =
  "Nao foi possivel salvar porque houve conflito no cadastro do produto. Recarreguei a lista e nao sobrescrevi nada. Revise o SKU e tente novamente.";

function isProductVersionConflict(error: unknown) {
  return error instanceof ProductVersionConflictError;
}

function getProductMutationErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof ProductRequestError && error.status === 409) {
    return PRODUCT_CREATE_CONFLICT_MESSAGE;
  }

  return error instanceof ProductRequestError ? error.message : fallbackMessage;
}

export function ProductsModule({ section }: { section: DashboardSection }) {
  const [products, setProducts] = useOperationsCollection(loadProductLines);
  const { movements } = useInventoryData();
  const [query, setQuery] = useState("");
  const [statusFilterIndex, setStatusFilterIndex] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState("");
  const productMutation = useErpMutation();
  const [form, setForm] = useState({
    sku: "",
    product: "",
    line: "",
    species: PRODUCT_SPECIES_DOGS,
    stage: "",
    package: "",
    stock: "",
    target: "",
    coverageDays: "",
  });

  const statusFilters = [
    { label: "Todos os status", value: "all" },
    { label: "Apenas em atenÃ§Ã£o", value: PRODUCT_STATUS_ATTENTION },
    { label: "Apenas crÃ­ticos", value: PRODUCT_STATUS_CRITICAL },
  ] as const;

  const activeStatusFilter = statusFilters[statusFilterIndex];
  const derivedProducts = useMemo(
    () => getProductsWithDerivedStock(products, movements),
    [movements, products],
  );

  const filtered = useMemo(() => {
    const normalized = normalizeText(query);
    return derivedProducts.filter((item) => {
      const matchesQuery = normalizeText(
        [item.product, item.sku, item.line, item.species, item.stage].join(" "),
      ).includes(normalized);
      const matchesStatus =
        activeStatusFilter.value === "all" || item.status === activeStatusFilter.value;
      return matchesQuery && matchesStatus;
    });
  }, [activeStatusFilter.value, derivedProducts, query]);

  const totalStock = filtered.reduce((sum, item) => sum + item.stock, 0);
  const critical = filtered.filter((item) => item.status === PRODUCT_STATUS_CRITICAL).length;
  const avgCoverage =
    filtered.length > 0
      ? Math.round(
          filtered.reduce((sum, item) => sum + item.coverageDays, 0) /
            filtered.length,
        )
      : 0;

  function resetForm() {
    setForm({
      sku: "",
      product: "",
      line: "",
      species: PRODUCT_SPECIES_DOGS,
      stage: "",
      package: "",
      stock: "",
      target: "",
      coverageDays: "",
    });
    setError("");
    productMutation.resetMutation();
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
    if (productMutation.isLoading) {
      return;
    }

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

    setError("");
    await productMutation.runMutation(() => createProductRecord(product), {
      fallbackErrorMessage: "Nao foi possivel salvar o produto.",
      conflictMessage: PRODUCT_CONFLICT_MESSAGE,
      isVersionConflict: isProductVersionConflict,
      reloadOnConflict: reloadProductsAfterConflict,
      getErrorMessage: getProductMutationErrorMessage,
      onSuccess: (createdProduct) => {
        setProducts((currentProducts) => [
          createdProduct,
          ...currentProducts.filter(
            (item) => normalizeSkuIdentifier(item.sku) !== createdProduct.sku,
          ),
        ]);
        setForm({
          sku: "",
          product: "",
          line: "",
          species: PRODUCT_SPECIES_DOGS,
          stage: "",
          package: "",
          stock: "",
          target: "",
          coverageDays: "",
        });
        setIsFormOpen(false);
      },
      onError: async (mutationError) => {
        if (mutationError instanceof ProductRequestError && mutationError.status === 409) {
          await reloadProductsAfterConflict();
        }
      },
    });
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
            <ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>
              Novo Produto
            </ActionButton>
          </>
        }
      />

      {isFormOpen ? (
        <InlineFormPanel
          title="Novo produto"
          description="Cadastre um SKU operacional para refletir o portfolio do sistema."
          error={error || productMutation.error}
          submitLabel="Salvar produto"
          onSubmit={() => {
            void handleCreateProduct();
          }}
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
        <SummaryCard title="Cobertura MÃ©dia" value={`${avgCoverage} dias`} helper="MÃ©dia de cobertura do mix selecionado" />
        <SummaryCard title="Produtos CrÃ­ticos" value={String(critical)} helper="Itens abaixo da meta de abastecimento" tone="danger" />
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
