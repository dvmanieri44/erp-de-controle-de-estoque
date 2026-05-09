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
import type { DashboardSection } from "@/lib/dashboard-sections";
import { normalizeText } from "@/lib/inventory";
import {
  PRIORITY_OPTIONS,
  type PendingItem,
} from "@/lib/operations-data";
import {
  createPendingItem as createPendingItemRecord,
  deletePendingItem as deletePendingItemRecord,
  loadPendingItems,
  PendingItemRequestError,
  PendingItemVersionConflictError,
  refreshPendingItems,
  updatePendingItem as updatePendingItemRecord,
  type VersionedPendingItem,
} from "@/lib/operations-store";
import { useErpMutation } from "@/lib/use-erp-mutation";
import { useErpPermissions } from "@/lib/use-erp-permissions";

const PENDING_CONFLICT_MESSAGE =
  "Conflito de versao: esta pendencia foi alterada por outra sessao. Recarreguei a lista e nao salvei sua alteracao para evitar sobrescrita. Revise os dados e tente novamente.";

function isPendingMutationConflict(error: unknown) {
  return (
    error instanceof PendingItemVersionConflictError ||
    (error instanceof PendingItemRequestError && error.status === 409)
  );
}

function getPendingMutationErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  return error instanceof PendingItemRequestError
    ? error.message
    : fallbackMessage;
}

function toneByLabel(label: string) {
  const normalized = normalizeText(label);
  if (normalized.includes("critico") || normalized.includes("desvio") || normalized.includes("retido") || normalized.includes("alta") || normalized.includes("aberto")) return "bg-rose-50 text-rose-700";
  if (normalized.includes("atencao") || normalized.includes("em analise") || normalized.includes("monitorado") || normalized.includes("media") || normalized.includes("em andamento") || normalized.includes("aguardando")) return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

export function PendingModule({ section }: { section: DashboardSection }) {
  const { canDelete } = useErpPermissions();
  const canDeletePending = canDelete("operations.pending");
  const [items, setItems] = useOperationsCollection(loadPendingItems);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VersionedPendingItem | null>(null);
  const [error, setError] = useState("");
  const pendingMutation = useErpMutation();
  const priorityOptions = useMemo(() => [...PRIORITY_OPTIONS] as PendingItem["priority"][], []);
  const [form, setForm] = useState({
    title: "",
    owner: "",
    area: "",
    due: "",
    priority: priorityOptions[0] as PendingItem["priority"],
  });

  function resetForm() {
    setForm({
      title: "",
      owner: "",
      area: "",
      due: "",
      priority: priorityOptions[0] as PendingItem["priority"],
    });
    setEditingItem(null);
    setError("");
    pendingMutation.resetMutation();
    setIsFormOpen(false);
  }

  function handleEdit(item: VersionedPendingItem) {
    setForm({ ...item });
    setEditingItem(item);
    setError("");
    pendingMutation.resetMutation();
    setIsFormOpen(true);
  }

  async function reloadPendingItemsAfterConflict() {
    try {
      setItems(await refreshPendingItems());
    } catch {
      setItems(loadPendingItems());
    }
  }

  async function handleDelete(item: VersionedPendingItem) {
    if (!canDeletePending) {
      setError("Seu perfil nao pode excluir pendencias.");
      return;
    }

    if (pendingMutation.isLoading) {
      return;
    }

    if (!item.id || !item.version) {
      await reloadPendingItemsAfterConflict();
      setError("Recarreguei as pendencias. Tente excluir novamente.");
      return;
    }

    if (!window.confirm(`Excluir a pendencia "${item.title}"?`)) return;

    const pendingId = item.id;
    const baseVersion = item.version;
    setError("");
    await pendingMutation.runMutation(
      () => deletePendingItemRecord(pendingId, baseVersion),
      {
        fallbackErrorMessage: "Nao foi possivel excluir a pendencia.",
        conflictMessage: PENDING_CONFLICT_MESSAGE,
        isVersionConflict: isPendingMutationConflict,
        reloadOnConflict: reloadPendingItemsAfterConflict,
        getErrorMessage: getPendingMutationErrorMessage,
        onSuccess: () => {
          setItems((currentItems) =>
            currentItems.filter((currentItem) => currentItem.id !== pendingId),
          );
        },
      },
    );
  }

  async function handleSave() {
    if (pendingMutation.isLoading) {
      return;
    }

    if (!form.title.trim() || !form.owner.trim() || !form.area.trim() || !form.due.trim()) {
      setError("Preencha titulo, responsavel, area e prazo.");
      return;
    }

    if (
      items.some(
        (item) =>
          item.title.toLowerCase() === form.title.trim().toLowerCase() &&
          item.id !== editingItem?.id,
      )
    ) {
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

    setError("");

    if (editingItem) {
      if (!editingItem.id || !editingItem.version) {
        await reloadPendingItemsAfterConflict();
        setError("Recarreguei as pendencias. Tente salvar novamente.");
        return;
      }

      const pendingId = editingItem.id;
      const baseVersion = editingItem.version;
      await pendingMutation.runMutation(
        () => updatePendingItemRecord(pendingId, nextItem, baseVersion),
        {
          fallbackErrorMessage: "Nao foi possivel salvar a pendencia.",
          conflictMessage: PENDING_CONFLICT_MESSAGE,
          isVersionConflict: isPendingMutationConflict,
          reloadOnConflict: reloadPendingItemsAfterConflict,
          getErrorMessage: getPendingMutationErrorMessage,
          onSuccess: (updatedItem) => {
            setItems((currentItems) =>
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

    await pendingMutation.runMutation(
      () => createPendingItemRecord(nextItem),
      {
        fallbackErrorMessage: "Nao foi possivel salvar a pendencia.",
        conflictMessage: PENDING_CONFLICT_MESSAGE,
        isVersionConflict: isPendingMutationConflict,
        reloadOnConflict: reloadPendingItemsAfterConflict,
        getErrorMessage: getPendingMutationErrorMessage,
        onSuccess: (createdItem) => {
          setItems((currentItems) => [
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
      <Hero section={section} eyebrow="Execução" actions={<ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>Nova pendência</ActionButton>} />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingItem ? "Editar pendencia" : "Nova pendencia"}
          description="Controle os itens que ainda dependem de acao operacional."
          error={error || pendingMutation.error}
          submitLabel={editingItem ? "Salvar alteracoes" : "Salvar pendencia"}
          onSubmit={handleSave}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Titulo">
              <TextInput value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Confirmar recebimento do TRF" />
            </FormField>
            <FormField label="Responsável">
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
            <article key={item.id ?? item.title} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
                    <StatusPill label={item.priority} tone={toneByLabel(item.priority)} />
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.area} · Responsável: {item.owner}</p>
                  <p className="mt-1 text-sm font-medium text-[var(--navy-900)]">{item.due}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleEdit(item)} className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]">Editar</button>
                  {canDeletePending ? (
                    <button type="button" onClick={() => void handleDelete(item)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Excluir</button>
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
