"use client";

import { useEffect, useMemo, useState } from "react";

import { useLocale } from "@/components/providers/LocaleProvider";
import { ERP_DATA_EVENT } from "@/lib/app-events";
import type { DashboardSection } from "@/lib/dashboard-sections";
import { getSectionById } from "@/lib/dashboard-sections";
import {
  QUALITY_EVENTS,
  type QualityEventItem,
} from "@/lib/operations-data";
import {
  createQualityEvent as createQualityEventRecord,
  deleteQualityEvent as deleteQualityEventRecord,
  loadQualityEvents,
  QualityEventRequestError,
  QualityEventVersionConflictError,
  refreshQualityEvents,
  updateQualityEvent as updateQualityEventRecord,
  type VersionedQualityEventItem,
} from "@/lib/operations-store";
import { useErpMutation } from "@/lib/use-erp-mutation";
import { useErpPermissions } from "@/lib/use-erp-permissions";

const QUALITY_EVENT_CONFLICT_MESSAGE =
  "Conflito de versao: este evento de qualidade foi alterado por outra sessao. Recarreguei a lista e nao salvei sua alteracao para evitar sobrescrita. Revise os dados e tente novamente.";

function isQualityEventMutationConflict(error: unknown) {
  return (
    error instanceof QualityEventVersionConflictError ||
    (error instanceof QualityEventRequestError && error.status === 409)
  );
}

function getQualityEventMutationErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  return error instanceof QualityEventRequestError
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
  if (label.includes("Crítico") || label.includes("Desvio") || label.includes("Retido") || label.includes("Alta") || label.includes("Aberto")) return "bg-rose-50 text-rose-700";
  if (label.includes("Atenção") || label.includes("Em análise") || label.includes("Monitorado") || label.includes("Média") || label.includes("Em andamento") || label.includes("Aguardando")) return "bg-amber-50 text-amber-700";
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

export function QualityEventsModule({ section }: { section: DashboardSection }) {
  const { canDelete } = useErpPermissions();
  const canDeleteQualityEvents = canDelete("operations.quality-events");
  const [events, setEvents] = useOperationsCollection(loadQualityEvents);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<VersionedQualityEventItem | null>(null);
  const [error, setError] = useState("");
  const qualityEventMutation = useErpMutation();
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
    setEditingEvent(null);
    setError("");
    qualityEventMutation.resetMutation();
    setIsFormOpen(false);
  }

  function handleEditEvent(item: VersionedQualityEventItem) {
    setForm({
      title: item.title,
      lot: item.lot,
      area: item.area,
      owner: item.owner,
      status: item.status,
    });
    setEditingEvent(item);
    setError("");
    qualityEventMutation.resetMutation();
    setIsFormOpen(true);
  }

  async function reloadQualityEventsAfterConflict() {
    try {
      setEvents(await refreshQualityEvents());
    } catch {
      setEvents(loadQualityEvents());
    }
  }

  async function handleDeleteEvent(item: VersionedQualityEventItem) {
    if (!canDeleteQualityEvents) {
      setError("Seu perfil nao pode excluir eventos de qualidade.");
      return;
    }

    if (qualityEventMutation.isLoading) {
      return;
    }

    if (!item.id || !item.version) {
      await reloadQualityEventsAfterConflict();
      setError("Recarreguei os eventos de qualidade. Tente excluir novamente.");
      return;
    }

    if (!window.confirm(`Excluir o evento de qualidade "${item.title}"?`)) {
      return;
    }

    const eventId = item.id;
    const baseVersion = item.version;
    setError("");
    await qualityEventMutation.runMutation(
      () => deleteQualityEventRecord(eventId, baseVersion),
      {
        fallbackErrorMessage: "Nao foi possivel excluir o evento de qualidade.",
        conflictMessage: QUALITY_EVENT_CONFLICT_MESSAGE,
        successMessage: "Evento de qualidade excluido com sucesso.",
        isVersionConflict: isQualityEventMutationConflict,
        reloadOnConflict: reloadQualityEventsAfterConflict,
        getErrorMessage: getQualityEventMutationErrorMessage,
        onSuccess: () => {
          setEvents((currentEvents) =>
            currentEvents.filter((event) => event.id !== eventId),
          );
        },
      },
    );
  }

  async function handleSaveEvent() {
    if (qualityEventMutation.isLoading) {
      return;
    }

    if (!form.title.trim() || !form.lot.trim() || !form.area.trim() || !form.owner.trim()) {
      setError("Preencha titulo, lote, area e responsavel.");
      return;
    }

    if (
      events.some(
        (item) =>
          item.title.toLowerCase() === form.title.trim().toLowerCase() &&
          item.lot.toLowerCase() === form.lot.trim().toLowerCase() &&
          item.id !== editingEvent?.id,
      )
    ) {
      setError("Ja existe um evento com esse titulo para esse lote.");
      return;
    }

    const nextItem: QualityEventItem = {
      id: editingEvent?.id,
      title: form.title.trim(),
      lot: form.lot.trim(),
      area: form.area.trim(),
      owner: form.owner.trim(),
      status: form.status,
    };

    setError("");

    if (editingEvent) {
      if (!editingEvent.id || !editingEvent.version) {
        await reloadQualityEventsAfterConflict();
        setError("Recarreguei os eventos de qualidade. Tente salvar novamente.");
        return;
      }

      const eventId = editingEvent.id;
      const baseVersion = editingEvent.version;
      await qualityEventMutation.runMutation(
        () =>
          updateQualityEventRecord(
            eventId,
            nextItem,
            baseVersion,
          ),
        {
          fallbackErrorMessage: "Nao foi possivel salvar o evento de qualidade.",
          conflictMessage: QUALITY_EVENT_CONFLICT_MESSAGE,
          successMessage: "Evento de qualidade atualizado com sucesso.",
          isVersionConflict: isQualityEventMutationConflict,
          reloadOnConflict: reloadQualityEventsAfterConflict,
          getErrorMessage: getQualityEventMutationErrorMessage,
          onSuccess: (updatedEvent) => {
            setEvents((currentEvents) =>
              currentEvents.map((item) =>
                item.id === updatedEvent.id ? updatedEvent : item,
              ),
            );
            resetForm();
          },
        },
      );
      return;
    }

    await qualityEventMutation.runMutation(
      () => createQualityEventRecord(nextItem),
      {
        fallbackErrorMessage: "Nao foi possivel salvar o evento de qualidade.",
        conflictMessage: QUALITY_EVENT_CONFLICT_MESSAGE,
        successMessage: "Evento de qualidade criado com sucesso.",
        isVersionConflict: isQualityEventMutationConflict,
        reloadOnConflict: reloadQualityEventsAfterConflict,
        getErrorMessage: getQualityEventMutationErrorMessage,
        onSuccess: (createdEvent) => {
          setEvents((currentEvents) => [
            createdEvent,
            ...currentEvents.filter((item) => item.id !== createdEvent.id),
          ]);
          resetForm();
        },
      },
    );
  }

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Quality" actions={<ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>Novo evento</ActionButton>} />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingEvent ? "Editar evento de qualidade" : "Novo evento de qualidade"}
          description="Registre liberacoes, reanalises e desvios com acompanhamento local."
          error={error || qualityEventMutation.error}
          submitLabel={editingEvent ? "Salvar alteracoes" : "Salvar evento"}
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
            <article key={event.id ?? `${event.title}:${event.lot}`} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
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
                  {canDeleteQualityEvents ? (
                    <button type="button" onClick={() => handleDeleteEvent(event)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Excluir</button>
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
