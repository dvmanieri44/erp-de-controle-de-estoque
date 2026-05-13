"use client";

import { useState } from "react";

import {
  ActionButton,
  FormField,
  Hero,
  InlineFormPanel,
  Panel,
  SelectInput,
  StatusPill,
  TextInput,
} from "@/components/dashboard/operations/ui";
import {
  LOT_STATUS_HELD,
  LOT_STATUS_IN_REVIEW,
  LOT_STATUS_RELEASED,
  Table,
  TableRow,
  toneByLabel,
} from "@/components/dashboard/operations/module-helpers";
import { useOperationsCollection } from "@/components/dashboard/operations/useOperationsCollection";
import type { DashboardSection } from "@/lib/dashboard-sections";
import {
  findMatchingProductReference,
  formatUnits,
} from "@/lib/inventory";
import { LOT_STATUS_OPTIONS, type LotItem } from "@/lib/operations-data";
import {
  createLot as createLotRecord,
  loadLots,
  loadProductLines,
  LotRequestError,
  refreshLots,
} from "@/lib/operations-store";
import { useErpMutation } from "@/lib/use-erp-mutation";

const LOT_CONFLICT_MESSAGE =
  "Nao foi possivel salvar porque houve conflito no cadastro do lote. Recarreguei a lista e nao sobrescrevi nada. Revise o codigo do lote e tente novamente.";

function getLotMutationErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof LotRequestError && error.status === 409) {
    return LOT_CONFLICT_MESSAGE;
  }

  return error instanceof Error ? error.message : fallbackMessage;
}

export function LotsModule({ section }: { section: DashboardSection }) {
  const [lots, setLots] = useOperationsCollection(loadLots);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState("");
  const lotMutation = useErpMutation();
  const [form, setForm] = useState<{
    code: string;
    product: string;
    location: string;
    expiration: string;
    quantity: string;
    status: LotItem["status"];
  }>({
    code: "",
    product: "",
    location: "",
    expiration: "",
    quantity: "",
    status: LOT_STATUS_OPTIONS[0] ?? LOT_STATUS_RELEASED,
  });

  function resetForm() {
    setForm({
      code: "",
      product: "",
      location: "",
      expiration: "",
      quantity: "",
      status: LOT_STATUS_OPTIONS[0] ?? LOT_STATUS_RELEASED,
    });
    setError("");
    lotMutation.resetMutation();
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
    if (lotMutation.isLoading) {
      return;
    }

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

    setError("");
    await lotMutation.runMutation(
      () =>
        createLotRecord({
        code: form.code.trim(),
        product: canonicalProductName,
        productId: canonicalProductId,
        location: form.location.trim(),
        expiration: form.expiration,
        quantity,
        status: form.status,
        }),
      {
        fallbackErrorMessage: "Nao foi possivel salvar o lote.",
        getErrorMessage: getLotMutationErrorMessage,
        onSuccess: resetForm,
        onError: async (creationError) => {
          if (creationError instanceof LotRequestError && creationError.status === 409) {
            await reloadLotsAfterConflict();
          }
        },
      },
    );
  }

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Rastreabilidade" actions={<ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>Novo Lote</ActionButton>} />

      {isFormOpen ? (
        <InlineFormPanel
          title="Novo lote"
          description="Registre lotes com validade e status para manter a rastreabilidade da operacao."
          error={error || lotMutation.error}
          submitLabel="Salvar lote"
          onSubmit={() => {
            void handleCreateLot();
          }}
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
        <Table columns={["Lote", "Produto", "Quantidade", "LocalizaÃ§Ã£o", "Validade", "Status"]}>
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
