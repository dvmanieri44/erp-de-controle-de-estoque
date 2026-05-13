"use client";

import { useState } from "react";

import {
  ActionButton,
  FormField,
  Hero,
  InlineFormPanel,
  SelectInput,
  StatusPill,
  TextInput,
} from "@/components/dashboard/operations/ui";
import {
  SUPPLIER_STATUS_APPROVED,
  SUPPLIER_STATUS_CRITICAL,
  SUPPLIER_STATUS_MONITORED,
  toneByLabel,
} from "@/components/dashboard/operations/module-helpers";
import { useErpResourceCollection } from "@/components/dashboard/operations/useErpResourceCollection";
import { confirmAction } from "@/lib/client-feedback";
import type { DashboardSection } from "@/lib/dashboard-sections";
import type { SupplierItem } from "@/lib/operations-data";
import {
  createSupplier as createSupplierRecord,
  deleteSupplier as deleteSupplierRecord,
  loadSuppliers,
  refreshSuppliers,
  SupplierRequestError,
  SupplierVersionConflictError,
  updateSupplier as updateSupplierRecord,
  type VersionedSupplierItem,
} from "@/lib/operations-store";
import { useErpMutation } from "@/lib/use-erp-mutation";
import { useErpPermissions } from "@/lib/use-erp-permissions";

const SUPPLIERS_CONFLICT_MESSAGE =
  "Conflito de versao: este fornecedor foi alterado por outra sessao. Recarreguei a lista e nao salvei sua alteracao para evitar sobrescrita. Revise os dados e tente novamente.";

function isSupplierMutationConflict(error: unknown) {
  return (
    error instanceof SupplierVersionConflictError ||
    (error instanceof SupplierRequestError && error.status === 409)
  );
}

function getSupplierMutationErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  return error instanceof SupplierRequestError
    ? error.message
    : fallbackMessage;
}

export function SuppliersModule({ section }: { section: DashboardSection }) {
  const { canDelete } = useErpPermissions();
  const canDeleteSuppliers = canDelete("operations.suppliers");
  const [suppliers, setSuppliers] = useErpResourceCollection(
    "operations.suppliers",
    loadSuppliers,
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VersionedSupplierItem | null>(
    null,
  );
  const [error, setError] = useState("");
  const suppliersMutation = useErpMutation();
  const [form, setForm] = useState({
    name: "",
    category: "",
    city: "",
    leadTimeDays: "",
    score: "",
    status: SUPPLIER_STATUS_APPROVED,
  });

  function resetForm() {
    setForm({
      name: "",
      category: "",
      city: "",
      leadTimeDays: "",
      score: "",
      status: SUPPLIER_STATUS_APPROVED,
    });
    setEditingItem(null);
    setError("");
    suppliersMutation.resetMutation();
    setIsFormOpen(false);
  }

  function handleEditSupplier(item: VersionedSupplierItem) {
    setForm({
      name: item.name,
      category: item.category,
      city: item.city,
      leadTimeDays: String(item.leadTimeDays),
      score: String(item.score),
      status: item.status,
    });
    setEditingItem(item);
    setError("");
    suppliersMutation.resetMutation();
    setIsFormOpen(true);
  }

  async function reloadSuppliersAfterConflict() {
    try {
      setSuppliers(await refreshSuppliers());
    } catch {
      setSuppliers(loadSuppliers());
    }
  }

  async function handleDeleteSupplier(item: VersionedSupplierItem) {
    if (!canDeleteSuppliers) {
      setError("Seu perfil nao pode excluir fornecedores.");
      return;
    }

    if (suppliersMutation.isLoading) {
      return;
    }

    if (!item.id || !item.version) {
      await reloadSuppliersAfterConflict();
      setError("Recarreguei os fornecedores. Tente excluir novamente.");
      return;
    }

    if (!confirmAction(`Excluir o fornecedor ${item.name}?`)) {
      return;
    }

    const supplierId = item.id;
    const baseVersion = item.version;
    setError("");
    await suppliersMutation.runMutation(
      () => deleteSupplierRecord(supplierId, baseVersion),
      {
        fallbackErrorMessage: "Nao foi possivel excluir o fornecedor.",
        conflictMessage: SUPPLIERS_CONFLICT_MESSAGE,
        isVersionConflict: isSupplierMutationConflict,
        reloadOnConflict: reloadSuppliersAfterConflict,
        getErrorMessage: getSupplierMutationErrorMessage,
        onSuccess: () => {
          setSuppliers((currentItems) =>
            currentItems.filter((currentItem) => currentItem.id !== supplierId),
          );
        },
      },
    );
  }

  async function handleSaveSupplier() {
    if (suppliersMutation.isLoading) {
      return;
    }

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
        (item) =>
          item.name.toLowerCase() === form.name.trim().toLowerCase() &&
          item.id !== editingItem?.id,
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

    setError("");

    if (editingItem) {
      if (!editingItem.id || !editingItem.version) {
        await reloadSuppliersAfterConflict();
        setError("Recarreguei os fornecedores. Tente salvar novamente.");
        return;
      }

      const supplierId = editingItem.id;
      const baseVersion = editingItem.version;
      await suppliersMutation.runMutation(
        () => updateSupplierRecord(supplierId, nextSupplier, baseVersion),
        {
          fallbackErrorMessage: "Nao foi possivel salvar o fornecedor.",
          conflictMessage: SUPPLIERS_CONFLICT_MESSAGE,
          isVersionConflict: isSupplierMutationConflict,
          reloadOnConflict: reloadSuppliersAfterConflict,
          getErrorMessage: getSupplierMutationErrorMessage,
          onSuccess: (updatedItem) => {
            setSuppliers((currentItems) =>
              currentItems.map((item) =>
                item.id === updatedItem.id ? updatedItem : item,
              ),
            );
            resetForm();
          },
        },
      );
      return;
    }

    await suppliersMutation.runMutation(
      () => createSupplierRecord(nextSupplier),
      {
        fallbackErrorMessage: "Nao foi possivel salvar o fornecedor.",
        conflictMessage: SUPPLIERS_CONFLICT_MESSAGE,
        isVersionConflict: isSupplierMutationConflict,
        reloadOnConflict: reloadSuppliersAfterConflict,
        getErrorMessage: getSupplierMutationErrorMessage,
        onSuccess: (createdItem) => {
          setSuppliers((currentItems) => [
            createdItem,
            ...currentItems.filter((item) => item.id !== createdItem.id),
          ]);
          resetForm();
        },
      },
    );
  }

  return (
    <section className="space-y-8">
      <Hero
        section={section}
        eyebrow="Suprimentos"
        actions={
          <ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>
            Novo Fornecedor
          </ActionButton>
        }
      />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingItem ? "Editar fornecedor" : "Novo fornecedor"}
          description="Centralize os parceiros homologados e mantenha o score da operacao atualizado."
          error={error}
          submitLabel={editingItem ? "Salvar alteracoes" : "Salvar fornecedor"}
          onSubmit={handleSaveSupplier}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Nome">
              <TextInput
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Ex.: PackFlex Embalagens"
              />
            </FormField>
            <FormField label="Categoria">
              <TextInput
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                placeholder="Ex.: Embalagens"
              />
            </FormField>
            <FormField label="Cidade">
              <TextInput
                value={form.city}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
                placeholder="Ex.: Campinas/SP"
              />
            </FormField>
            <FormField label="Lead time (dias)">
              <TextInput
                value={form.leadTimeDays}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    leadTimeDays: event.target.value,
                  }))
                }
                inputMode="numeric"
                placeholder="Ex.: 7"
              />
            </FormField>
            <FormField label="Score">
              <TextInput
                value={form.score}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    score: event.target.value,
                  }))
                }
                inputMode="numeric"
                placeholder="Ex.: 89"
              />
            </FormField>
            <FormField label="Status">
              <SelectInput
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as SupplierItem["status"],
                  }))
                }
              >
                <option value={SUPPLIER_STATUS_APPROVED}>
                  {SUPPLIER_STATUS_APPROVED}
                </option>
                <option value={SUPPLIER_STATUS_MONITORED}>
                  {SUPPLIER_STATUS_MONITORED}
                </option>
                <option value={SUPPLIER_STATUS_CRITICAL}>
                  {SUPPLIER_STATUS_CRITICAL}
                </option>
              </SelectInput>
            </FormField>
          </div>
        </InlineFormPanel>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {suppliers.map((item) => (
          <article
            key={item.id ?? item.name}
            className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_10px_24px_var(--shadow-color)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-2xl font-semibold tracking-[-0.03em] text-[var(--navy-900)]">
                    {item.name}
                  </p>
                  <StatusPill label={item.status} tone={toneByLabel(item.status)} />
                </div>
                <div className="mt-3 flex gap-1 text-amber-400">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <span key={index}>
                      {index < Math.round(item.score / 20)
                        ? "Ã¢Ëœâ€¦"
                        : "Ã¢Ëœâ€ "}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 text-[var(--accent)]">
                <button
                  type="button"
                  onClick={() => handleEditSupplier(item)}
                  className="rounded-xl p-2 transition hover:bg-[var(--accent-soft)]"
                >
                  Ã¢Å“Å½
                </button>
                {canDeleteSuppliers ? (
                  <button
                    type="button"
                    onClick={() => void handleDeleteSupplier(item)}
                    className="rounded-xl p-2 text-rose-500 transition hover:bg-rose-50"
                  >
                    Ã¢Å“â€¢
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-5 space-y-2 text-sm text-[var(--muted-foreground)]">
              <p>{item.category}</p>
              <p>{item.city}</p>
              <p>Lead time: {item.leadTimeDays} dias</p>
            </div>
            <div className="mt-5 border-t border-[var(--panel-border)] pt-4">
              <p className="text-lg font-semibold text-emerald-600">
                Score {item.score}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
