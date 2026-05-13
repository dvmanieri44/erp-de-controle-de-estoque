"use client";

import { useMemo, useState } from "react";

import { toneByLabel } from "@/components/dashboard/operations/module-helpers";
import {
  ActionButton,
  FormField,
  Hero,
  InlineFormPanel,
  SelectInput,
  StatusPill,
  SummaryCard,
  TextInput,
} from "@/components/dashboard/operations/ui";
import { useErpResourceCollection } from "@/components/dashboard/operations/useErpResourceCollection";
import { confirmAction } from "@/lib/client-feedback";
import type { DashboardSection } from "@/lib/dashboard-sections";
import { normalizeText } from "@/lib/inventory";
import {
  DISTRIBUTOR_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  type DistributorItem,
} from "@/lib/operations-data";
import {
  createDistributor as createDistributorRecord,
  deleteDistributor as deleteDistributorRecord,
  DistributorRequestError,
  DistributorVersionConflictError,
  loadDistributors,
  refreshDistributors,
  updateDistributor as updateDistributorRecord,
  type VersionedDistributorItem,
} from "@/lib/operations-store";
import { useErpMutation } from "@/lib/use-erp-mutation";
import { useErpPermissions } from "@/lib/use-erp-permissions";

const DISTRIBUTORS_CONFLICT_MESSAGE =
  "Conflito de versao: este distribuidor foi alterado por outra sessao. Recarreguei a lista e nao salvei sua alteracao para evitar sobrescrita. Revise os dados e tente novamente.";

function isDistributorMutationConflict(error: unknown) {
  return (
    error instanceof DistributorVersionConflictError ||
    (error instanceof DistributorRequestError && error.status === 409)
  );
}

function getDistributorMutationErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  return error instanceof DistributorRequestError
    ? error.message
    : fallbackMessage;
}

export function DistributorsModule({
  section,
}: {
  section: DashboardSection;
}) {
  const { canDelete } = useErpPermissions();
  const canDeleteDistributors = canDelete("operations.distributors");
  const [distributors, setDistributors] = useErpResourceCollection(
    "operations.distributors",
    loadDistributors,
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VersionedDistributorItem | null>(
    null,
  );
  const [error, setError] = useState("");
  const distributorsMutation = useErpMutation();
  const priorityOptions = useMemo(
    () => [...PRIORITY_OPTIONS] as DistributorItem["priority"][],
    [],
  );
  const statusOptions = useMemo(
    () => [...DISTRIBUTOR_STATUS_OPTIONS] as DistributorItem["status"][],
    [],
  );
  const attentionStatus = useMemo(
    () =>
      statusOptions.find((item) => normalizeText(item).includes("atenc")) ??
      statusOptions[0],
    [statusOptions],
  );
  const [form, setForm] = useState({
    name: "",
    region: "",
    channel: "",
    priority: priorityOptions[0],
    lastSupply: "",
    status: statusOptions[0],
  });

  function resetForm() {
    setForm({
      name: "",
      region: "",
      channel: "",
      priority: priorityOptions[0],
      lastSupply: "",
      status: statusOptions[0],
    });
    setEditingItem(null);
    setError("");
    distributorsMutation.resetMutation();
    setIsFormOpen(false);
  }

  function handleEdit(item: VersionedDistributorItem) {
    setForm({
      name: item.name,
      region: item.region,
      channel: item.channel,
      priority: item.priority,
      lastSupply: item.lastSupply,
      status: item.status,
    });
    setEditingItem(item);
    setError("");
    distributorsMutation.resetMutation();
    setIsFormOpen(true);
  }

  async function reloadDistributorsAfterConflict() {
    try {
      setDistributors(await refreshDistributors());
    } catch {
      setDistributors(loadDistributors());
    }
  }

  async function handleDelete(item: VersionedDistributorItem) {
    if (!canDeleteDistributors) {
      setError("Seu perfil nao pode excluir distribuidores.");
      return;
    }

    if (distributorsMutation.isLoading) {
      return;
    }

    if (!item.id || !item.version) {
      await reloadDistributorsAfterConflict();
      setError("Recarreguei os distribuidores. Tente excluir novamente.");
      return;
    }

    if (!confirmAction(`Excluir o distribuidor "${item.name}"?`)) {
      return;
    }

    const distributorId = item.id;
    const baseVersion = item.version;
    setError("");
    await distributorsMutation.runMutation(
      () => deleteDistributorRecord(distributorId, baseVersion),
      {
        fallbackErrorMessage: "Nao foi possivel excluir o distribuidor.",
        conflictMessage: DISTRIBUTORS_CONFLICT_MESSAGE,
        isVersionConflict: isDistributorMutationConflict,
        reloadOnConflict: reloadDistributorsAfterConflict,
        getErrorMessage: getDistributorMutationErrorMessage,
        onSuccess: () => {
          setDistributors((currentItems) =>
            currentItems.filter((currentItem) => currentItem.id !== distributorId),
          );
        },
      },
    );
  }

  async function handleSave() {
    if (distributorsMutation.isLoading) {
      return;
    }

    if (
      !form.name.trim() ||
      !form.region.trim() ||
      !form.channel.trim() ||
      !form.lastSupply.trim()
    ) {
      setError("Preencha nome, regiao, canal e ultimo abastecimento.");
      return;
    }

    if (
      distributors.some(
        (item) =>
          item.name.toLowerCase() === form.name.trim().toLowerCase() &&
          item.id !== editingItem?.id,
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

    setError("");

    if (editingItem) {
      if (!editingItem.id || !editingItem.version) {
        await reloadDistributorsAfterConflict();
        setError("Recarreguei os distribuidores. Tente salvar novamente.");
        return;
      }

      const distributorId = editingItem.id;
      const baseVersion = editingItem.version;
      await distributorsMutation.runMutation(
        () => updateDistributorRecord(distributorId, nextItem, baseVersion),
        {
          fallbackErrorMessage: "Nao foi possivel salvar o distribuidor.",
          conflictMessage: DISTRIBUTORS_CONFLICT_MESSAGE,
          isVersionConflict: isDistributorMutationConflict,
          reloadOnConflict: reloadDistributorsAfterConflict,
          getErrorMessage: getDistributorMutationErrorMessage,
          onSuccess: (updatedItem) => {
            setDistributors((currentItems) =>
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

    await distributorsMutation.runMutation(
      () => createDistributorRecord(nextItem),
      {
        fallbackErrorMessage: "Nao foi possivel salvar o distribuidor.",
        conflictMessage: DISTRIBUTORS_CONFLICT_MESSAGE,
        isVersionConflict: isDistributorMutationConflict,
        reloadOnConflict: reloadDistributorsAfterConflict,
        getErrorMessage: getDistributorMutationErrorMessage,
        onSuccess: (createdItem) => {
          setDistributors((currentItems) => [
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
        eyebrow="Clientes"
        actions={
          <ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>
            Novo distribuidor
          </ActionButton>
        }
      />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingItem ? "Editar distribuidor" : "Novo distribuidor"}
          description="Cadastre parceiros de distribuicao e acompanhe criticidade, canal e ultima reposicao."
          error={error || distributorsMutation.error}
          submitLabel={
            editingItem ? "Salvar alteracoes" : "Salvar distribuidor"
          }
          onSubmit={() => {
            void handleSave();
          }}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Nome">
              <TextInput
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Ex.: Distribuidora Pet Sul"
              />
            </FormField>
            <FormField label="Regiao">
              <TextInput
                value={form.region}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    region: event.target.value,
                  }))
                }
                placeholder="Ex.: Sul"
              />
            </FormField>
            <FormField label="Canal">
              <TextInput
                value={form.channel}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    channel: event.target.value,
                  }))
                }
                placeholder="Ex.: Especializado"
              />
            </FormField>
            <FormField label="Prioridade">
              <SelectInput
                value={form.priority}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priority: event.target.value as DistributorItem["priority"],
                  }))
                }
              >
                {priorityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Ultimo abastecimento">
              <TextInput
                value={form.lastSupply}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    lastSupply: event.target.value,
                  }))
                }
                placeholder="Ex.: Hoje, 08:50"
              />
            </FormField>
            <FormField label="Status">
              <SelectInput
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as DistributorItem["status"],
                  }))
                }
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </SelectInput>
            </FormField>
          </div>
        </InlineFormPanel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Base de distribuidores"
          value={String(distributors.length)}
          helper="Parceiros ativos no ciclo de atendimento"
        />
        <SummaryCard
          title="Alta prioridade"
          value={String(
            distributors.filter((item) => item.priority === "Alta").length,
          )}
          helper="Contas com prioridade comercial elevada"
          tone="danger"
        />
        <SummaryCard
          title="Em atencao"
          value={String(
            distributors.filter((item) => item.status === attentionStatus).length,
          )}
          helper="Operacoes que pedem acompanhamento mais proximo"
          tone="warning"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {distributors.map((item) => (
          <article
            key={item.id ?? item.name}
            className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_10px_24px_var(--shadow-color)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xl font-semibold text-[var(--foreground)]">
                  {item.name}
                </p>
                <StatusPill
                  label={item.priority}
                  tone={toneByLabel(item.priority)}
                />
                <StatusPill
                  label={item.status}
                  tone={toneByLabel(item.status)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(item)}
                  className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]"
                >
                  Editar
                </button>
                {canDeleteDistributors ? (
                  <button
                    type="button"
                    onClick={() => {
                      void handleDelete(item);
                    }}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    Excluir
                  </button>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              {item.region} Â· {item.channel}
            </p>
            <p className="mt-4 text-sm text-[var(--muted-foreground)]">
              Ultimo abastecimento: {item.lastSupply}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
