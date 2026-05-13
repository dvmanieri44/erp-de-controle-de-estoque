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
import { useOperationsCollection } from "@/components/dashboard/operations/useOperationsCollection";
import { confirmAction } from "@/lib/client-feedback";
import type { DashboardSection } from "@/lib/dashboard-sections";
import { formatUnits } from "@/lib/inventory";
import { PRIORITY_OPTIONS, type PlanningItem } from "@/lib/operations-data";
import {
  createPlanningItem as createPlanningItemRecord,
  deletePlanningItem as deletePlanningItemRecord,
  loadPlanningItems,
  PlanningItemRequestError,
  PlanningItemVersionConflictError,
  refreshPlanningItems,
  updatePlanningItem as updatePlanningItemRecord,
  type VersionedPlanningItem,
} from "@/lib/operations-store";
import { useErpMutation } from "@/lib/use-erp-mutation";
import { useErpPermissions } from "@/lib/use-erp-permissions";

const PLANNING_CONFLICT_MESSAGE =
  "Conflito de versao: este planejamento foi alterado por outra sessao. Recarreguei a lista e nao salvei sua alteracao para evitar sobrescrita. Revise os dados e tente novamente.";

function isPlanningMutationConflict(error: unknown) {
  return (
    error instanceof PlanningItemVersionConflictError ||
    (error instanceof PlanningItemRequestError && error.status === 409)
  );
}

function getPlanningMutationErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  return error instanceof PlanningItemRequestError
    ? error.message
    : fallbackMessage;
}

function toneByPriority(priority: PlanningItem["priority"]) {
  if (priority === "Alta") {
    return "bg-rose-50 text-rose-700";
  }

  if (priority === "M\u00e9dia") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-emerald-50 text-emerald-700";
}

export function PlanningModule({ section }: { section: DashboardSection }) {
  const { canDelete } = useErpPermissions();
  const canDeletePlanning = canDelete("operations.planning");
  const [plans, setPlans] = useOperationsCollection(loadPlanningItems);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VersionedPlanningItem | null>(null);
  const [error, setError] = useState("");
  const planningMutation = useErpMutation();
  const priorityOptions = useMemo(
    () => [...PRIORITY_OPTIONS] as PlanningItem["priority"][],
    [],
  );
  const [form, setForm] = useState({
    route: "",
    window: "",
    priority: priorityOptions[0],
    demand: "",
    coverage: "",
  });

  function resetForm() {
    setForm({
      route: "",
      window: "",
      priority: priorityOptions[0],
      demand: "",
      coverage: "",
    });
    setEditingItem(null);
    setError("");
    planningMutation.resetMutation();
    setIsFormOpen(false);
  }

  function handleEditPlan(item: VersionedPlanningItem) {
    setForm({
      route: item.route,
      window: item.window,
      priority: item.priority,
      demand: String(item.demand),
      coverage: item.coverage,
    });
    setEditingItem(item);
    setError("");
    planningMutation.resetMutation();
    setIsFormOpen(true);
  }

  async function reloadPlanningItemsAfterConflict() {
    try {
      setPlans(await refreshPlanningItems());
    } catch {
      setPlans(loadPlanningItems());
    }
  }

  async function handleDeletePlan(item: VersionedPlanningItem) {
    if (!canDeletePlanning) {
      setError("Seu perfil nao pode excluir planejamentos.");
      return;
    }

    if (planningMutation.isLoading) {
      return;
    }

    if (!item.id || !item.version) {
      await reloadPlanningItemsAfterConflict();
      setError("Recarreguei os planejamentos. Tente excluir novamente.");
      return;
    }

    if (!confirmAction(`Excluir o planejamento "${item.route}"?`)) {
      return;
    }

    const planningId = item.id;
    const baseVersion = item.version;
    setError("");
    await planningMutation.runMutation(
      () => deletePlanningItemRecord(planningId, baseVersion),
      {
        fallbackErrorMessage: "Nao foi possivel excluir o planejamento.",
        conflictMessage: PLANNING_CONFLICT_MESSAGE,
        isVersionConflict: isPlanningMutationConflict,
        reloadOnConflict: reloadPlanningItemsAfterConflict,
        getErrorMessage: getPlanningMutationErrorMessage,
        onSuccess: () => {
          setPlans((currentPlans) =>
            currentPlans.filter((currentItem) => currentItem.id !== planningId),
          );
        },
      },
    );
  }

  async function handleSavePlan() {
    if (planningMutation.isLoading) {
      return;
    }

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
        (item) =>
          item.route.toLowerCase() === form.route.trim().toLowerCase() &&
          item.id !== editingItem?.id,
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

    setError("");

    if (editingItem) {
      if (!editingItem.id || !editingItem.version) {
        await reloadPlanningItemsAfterConflict();
        setError("Recarreguei os planejamentos. Tente salvar novamente.");
        return;
      }

      const planningId = editingItem.id;
      const baseVersion = editingItem.version;
      await planningMutation.runMutation(
        () => updatePlanningItemRecord(planningId, nextItem, baseVersion),
        {
          fallbackErrorMessage: "Nao foi possivel salvar o planejamento.",
          conflictMessage: PLANNING_CONFLICT_MESSAGE,
          isVersionConflict: isPlanningMutationConflict,
          reloadOnConflict: reloadPlanningItemsAfterConflict,
          getErrorMessage: getPlanningMutationErrorMessage,
          onSuccess: (updatedItem) => {
            setPlans((currentPlans) =>
              currentPlans.map((item) =>
                item.id === updatedItem.id ? updatedItem : item,
              ),
            );
            resetForm();
          },
        },
      );
      return;
    }

    await planningMutation.runMutation(
      () => createPlanningItemRecord(nextItem),
      {
        fallbackErrorMessage: "Nao foi possivel salvar o planejamento.",
        conflictMessage: PLANNING_CONFLICT_MESSAGE,
        isVersionConflict: isPlanningMutationConflict,
        reloadOnConflict: reloadPlanningItemsAfterConflict,
        getErrorMessage: getPlanningMutationErrorMessage,
        onSuccess: (createdItem) => {
          setPlans((currentPlans) => [
            createdItem,
            ...currentPlans.filter((item) => item.id !== createdItem.id),
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
        eyebrow="Planejamento"
        actions={
          <ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>
            Nova rota
          </ActionButton>
        }
      />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingItem ? "Editar planejamento" : "Novo planejamento"}
          description="Mantenha o plano mestre atualizado com demandas, prioridades e janelas."
          error={error || planningMutation.error}
          submitLabel={editingItem ? "Salvar alteracoes" : "Salvar planejamento"}
          onSubmit={() => {
            void handleSavePlan();
          }}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Rota">
              <TextInput
                value={form.route}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    route: event.target.value,
                  }))
                }
                placeholder="Ex.: Dourado -> CD Sudeste"
              />
            </FormField>
            <FormField label="Janela">
              <TextInput
                value={form.window}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    window: event.target.value,
                  }))
                }
                placeholder="Ex.: Hoje, 18:00"
              />
            </FormField>
            <FormField label="Prioridade">
              <SelectInput
                value={form.priority}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priority: event.target.value as PlanningItem["priority"],
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
            <FormField label="Demanda">
              <TextInput
                value={form.demand}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    demand: event.target.value,
                  }))
                }
                inputMode="numeric"
                placeholder="Ex.: 12000"
              />
            </FormField>
          </div>
          <FormField label="Cobertura">
            <TextInput
              value={form.coverage}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  coverage: event.target.value,
                }))
              }
              placeholder="Ex.: Cobertura projetada de 8 dias"
            />
          </FormField>
        </InlineFormPanel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Rotas planejadas"
          value={String(plans.length)}
          helper="Fluxos com previsao operacional ativa"
        />
        <SummaryCard
          title="Demanda priorizada"
          value={formatUnits(plans.reduce((sum, item) => sum + item.demand, 0))}
          helper="Volume em programacao para abastecimento"
        />
        <SummaryCard
          title="Prioridade alta"
          value={String(
            plans.filter((item) => item.priority === "Alta").length,
          )}
          helper="Acoes criticas para hoje e amanha"
          tone="danger"
        />
      </div>

      <Panel title="Plano mestre de abastecimento" eyebrow="Execucao">
        <div className="space-y-4">
          {plans.map((item) => (
            <article
              key={item.id ?? `${item.route}::${item.window}`}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--foreground)]">
                      {item.route}
                    </p>
                    <StatusPill
                      label={`Prioridade ${item.priority}`}
                      tone={toneByPriority(item.priority)}
                    />
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {item.window} | {item.coverage}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-semibold text-[var(--navy-900)]">
                    {formatUnits(item.demand)}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleEditPlan(item)}
                    className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]"
                  >
                    Editar
                  </button>
                  {canDeletePlanning ? (
                    <button
                      type="button"
                      onClick={() => {
                        void handleDeletePlan(item);
                      }}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      Excluir
                    </button>
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
