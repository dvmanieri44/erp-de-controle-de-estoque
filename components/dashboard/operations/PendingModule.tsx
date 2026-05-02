"use client";

import { useEffect, useMemo, useState } from "react";

import { useLocale } from "@/components/providers/LocaleProvider";
import { ERP_DATA_EVENT } from "@/lib/app-events";
import type { DashboardSection } from "@/lib/dashboard-sections";
import { getSectionById } from "@/lib/dashboard-sections";
import {
  PENDING_ITEMS,
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

function StatusPill({ label, tone }: { label: string; tone: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function toneByLabel(label: string) {
  if (label.includes("Critico") || label.includes("Desvio") || label.includes("Retido") || label.includes("Alta") || label.includes("Aberto")) return "bg-rose-50 text-rose-700";
  if (label.includes("Atencao") || label.includes("Em analise") || label.includes("Monitorado") || label.includes("Media") || label.includes("Em andamento") || label.includes("Aguardando")) return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
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

export function PendingModule({ section }: { section: DashboardSection }) {
  const { canDelete } = useErpPermissions();
  const canDeletePending = canDelete("operations.pending");
  const [items, setItems] = useOperationsCollection(loadPendingItems);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VersionedPendingItem | null>(null);
  const [error, setError] = useState("");
  const pendingMutation = useErpMutation();
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
      <Hero section={section} eyebrow="Execucao" actions={<ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>Nova pendencia</ActionButton>} />

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
            <article key={item.id ?? item.title} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
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
