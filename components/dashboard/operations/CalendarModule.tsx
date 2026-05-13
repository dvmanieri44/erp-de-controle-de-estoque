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
import { CALENDAR_TYPE_OPTIONS, type CalendarItem } from "@/lib/operations-data";
import {
  CalendarEventRequestError,
  CalendarEventVersionConflictError,
  createCalendarEvent as createCalendarEventRecord,
  deleteCalendarEvent as deleteCalendarEventRecord,
  loadCalendarEvents,
  refreshCalendarEvents,
  updateCalendarEvent as updateCalendarEventRecord,
  type VersionedCalendarEventItem,
} from "@/lib/operations-store";
import { useErpMutation } from "@/lib/use-erp-mutation";
import { useErpPermissions } from "@/lib/use-erp-permissions";

const CALENDAR_CONFLICT_MESSAGE =
  "Conflito de versao: este evento do calendario foi alterado por outra sessao. Recarreguei a lista e nao salvei sua alteracao para evitar sobrescrita. Revise os dados e tente novamente.";

function isCalendarMutationConflict(error: unknown) {
  return (
    error instanceof CalendarEventVersionConflictError ||
    (error instanceof CalendarEventRequestError && error.status === 409)
  );
}

function getCalendarMutationErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  return error instanceof CalendarEventRequestError
    ? error.message
    : fallbackMessage;
}

export function CalendarModule({ section }: { section: DashboardSection }) {
  const { canDelete } = useErpPermissions();
  const canDeleteCalendarEvents = canDelete("operations.calendar");
  const [events, setEvents] = useOperationsCollection(loadCalendarEvents);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VersionedCalendarEventItem | null>(
    null,
  );
  const [error, setError] = useState("");
  const calendarMutation = useErpMutation();
  const typeOptions = useMemo(
    () => [...CALENDAR_TYPE_OPTIONS] as CalendarItem["type"][],
    [],
  );
  const [form, setForm] = useState({
    title: "",
    slot: "",
    area: "",
    type: typeOptions[0],
  });

  function resetForm() {
    setForm({
      title: "",
      slot: "",
      area: "",
      type: typeOptions[0],
    });
    setEditingItem(null);
    setError("");
    calendarMutation.resetMutation();
    setIsFormOpen(false);
  }

  function handleEdit(item: VersionedCalendarEventItem) {
    setForm({
      title: item.title,
      slot: item.slot,
      area: item.area,
      type: item.type,
    });
    setEditingItem(item);
    setError("");
    calendarMutation.resetMutation();
    setIsFormOpen(true);
  }

  async function reloadCalendarEventsAfterConflict() {
    try {
      setEvents(await refreshCalendarEvents());
    } catch {
      setEvents(loadCalendarEvents());
    }
  }

  async function handleDelete(item: VersionedCalendarEventItem) {
    if (!canDeleteCalendarEvents) {
      setError("Seu perfil nao pode excluir eventos do calendario.");
      return;
    }

    if (calendarMutation.isLoading) {
      return;
    }

    if (!item.id || !item.version) {
      await reloadCalendarEventsAfterConflict();
      setError("Recarreguei os eventos. Tente excluir novamente.");
      return;
    }

    if (!confirmAction(`Excluir o evento "${item.title}"?`)) {
      return;
    }

    const calendarEventId = item.id;
    const baseVersion = item.version;
    setError("");
    await calendarMutation.runMutation(
      () => deleteCalendarEventRecord(calendarEventId, baseVersion),
      {
        fallbackErrorMessage: "Nao foi possivel excluir o evento do calendario.",
        conflictMessage: CALENDAR_CONFLICT_MESSAGE,
        isVersionConflict: isCalendarMutationConflict,
        reloadOnConflict: reloadCalendarEventsAfterConflict,
        getErrorMessage: getCalendarMutationErrorMessage,
        onSuccess: () => {
          setEvents((currentEvents) =>
            currentEvents.filter((currentItem) => currentItem.id !== calendarEventId),
          );
        },
      },
    );
  }

  async function handleSave() {
    if (calendarMutation.isLoading) {
      return;
    }

    if (!form.title.trim() || !form.slot.trim() || !form.area.trim()) {
      setError("Preencha titulo, horario e area.");
      return;
    }

    if (
      events.some(
        (item) =>
          item.title.toLowerCase() === form.title.trim().toLowerCase() &&
          item.id !== editingItem?.id,
      )
    ) {
      setError("Ja existe um evento com esse titulo.");
      return;
    }

    const nextItem: CalendarItem = {
      title: form.title.trim(),
      slot: form.slot.trim(),
      area: form.area.trim(),
      type: form.type,
    };

    setError("");

    if (editingItem) {
      if (!editingItem.id || !editingItem.version) {
        await reloadCalendarEventsAfterConflict();
        setError("Recarreguei os eventos. Tente salvar novamente.");
        return;
      }

      const calendarEventId = editingItem.id;
      const baseVersion = editingItem.version;
      await calendarMutation.runMutation(
        () => updateCalendarEventRecord(calendarEventId, nextItem, baseVersion),
        {
          fallbackErrorMessage:
            "Nao foi possivel salvar o evento do calendario.",
          conflictMessage: CALENDAR_CONFLICT_MESSAGE,
          isVersionConflict: isCalendarMutationConflict,
          reloadOnConflict: reloadCalendarEventsAfterConflict,
          getErrorMessage: getCalendarMutationErrorMessage,
          onSuccess: (updatedItem) => {
            setEvents((currentEvents) =>
              currentEvents.map((item) =>
                item.id === updatedItem.id ? updatedItem : item,
              ),
            );
            resetForm();
          },
        },
      );
      return;
    }

    await calendarMutation.runMutation(
      () => createCalendarEventRecord(nextItem),
      {
        fallbackErrorMessage: "Nao foi possivel salvar o evento do calendario.",
        conflictMessage: CALENDAR_CONFLICT_MESSAGE,
        isVersionConflict: isCalendarMutationConflict,
        reloadOnConflict: reloadCalendarEventsAfterConflict,
        getErrorMessage: getCalendarMutationErrorMessage,
        onSuccess: (createdItem) => {
          setEvents((currentEvents) => [
            createdItem,
            ...currentEvents.filter((item) => item.id !== createdItem.id),
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
        eyebrow="Agenda"
        actions={
          <ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>
            Novo evento
          </ActionButton>
        }
      />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingItem ? "Editar evento" : "Novo evento"}
          description="Mantenha a agenda operacional atualizada com janelas, inspecoes e recebimentos."
          error={error || calendarMutation.error}
          submitLabel={editingItem ? "Salvar alteracoes" : "Salvar evento"}
          onSubmit={() => {
            void handleSave();
          }}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Titulo">
              <TextInput
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Ex.: Janela de carregamento do CD Sudeste"
              />
            </FormField>
            <FormField label="Horario">
              <TextInput
                value={form.slot}
                onChange={(event) =>
                  setForm((current) => ({ ...current, slot: event.target.value }))
                }
                placeholder="Ex.: Hoje, 18:00"
              />
            </FormField>
            <FormField label="Area">
              <TextInput
                value={form.area}
                onChange={(event) =>
                  setForm((current) => ({ ...current, area: event.target.value }))
                }
                placeholder="Ex.: Expedicao Dourado"
              />
            </FormField>
            <FormField label="Tipo">
              <SelectInput
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value as CalendarItem["type"],
                  }))
                }
              >
                {typeOptions.map((option) => (
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
          title="Eventos agendados"
          value={String(events.length)}
          helper="Rotina operacional consolidada em um unico lugar"
        />
        <SummaryCard
          title="Areas cobertas"
          value={String(new Set(events.map((item) => item.area)).size)}
          helper="Times com compromisso registrado na agenda"
        />
        <SummaryCard
          title="Tipos ativos"
          value={String(new Set(events.map((item) => item.type)).size)}
          helper="Frentes diferentes da operacao monitoradas"
        />
      </div>

      <Panel title="Proximos eventos" eyebrow="Calendario operacional">
        <div className="space-y-4">
          {events.map((event) => (
            <article
              key={event.id ?? `${event.title}::${event.slot}`}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--foreground)]">
                      {event.title}
                    </p>
                    <StatusPill
                      label={event.type}
                      tone="bg-[var(--accent-soft)] text-[var(--accent)]"
                    />
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {event.area}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[var(--navy-900)]">
                    {event.slot}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleEdit(event)}
                    className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]"
                  >
                    Editar
                  </button>
                  {canDeleteCalendarEvents ? (
                    <button
                      type="button"
                      onClick={() => {
                        void handleDelete(event);
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
