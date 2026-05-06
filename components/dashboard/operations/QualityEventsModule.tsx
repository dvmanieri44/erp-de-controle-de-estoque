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

function toneByLabel(label: string) {
  if (label.includes("Crítico") || label.includes("Desvio") || label.includes("Retido") || label.includes("Alta") || label.includes("Aberto")) return "bg-rose-50 text-rose-700";
  if (label.includes("Atenção") || label.includes("Em análise") || label.includes("Monitorado") || label.includes("Média") || label.includes("Em andamento") || label.includes("Aguardando")) return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
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
