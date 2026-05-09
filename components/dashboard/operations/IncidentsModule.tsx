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
  INCIDENT_SEVERITY_OPTIONS,
  INCIDENT_STATUS_OPTIONS,
  type IncidentItem,
} from "@/lib/operations-data";
import {
  createIncident as createIncidentRecord,
  deleteIncident as deleteIncidentRecord,
  IncidentRequestError,
  IncidentVersionConflictError,
  loadIncidents,
  refreshIncidents,
  updateIncident as updateIncidentRecord,
  type VersionedIncidentItem,
} from "@/lib/operations-store";
import { useErpMutation } from "@/lib/use-erp-mutation";
import { useErpPermissions } from "@/lib/use-erp-permissions";

const INCIDENT_CONFLICT_MESSAGE =
  "Conflito de versao: este incidente foi alterado por outra sessao. Recarreguei a lista e nao salvei sua alteracao para evitar sobrescrita. Revise os dados e tente novamente.";

function isIncidentMutationConflict(error: unknown) {
  return (
    error instanceof IncidentVersionConflictError ||
    (error instanceof IncidentRequestError && error.status === 409)
  );
}

function getIncidentMutationErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  return error instanceof IncidentRequestError
    ? error.message
    : fallbackMessage;
}

function toneByLabel(label: string) {
  const normalized = normalizeText(label);
  if (normalized.includes("critico") || normalized.includes("desvio") || normalized.includes("retido") || normalized.includes("alta") || normalized.includes("aberto")) return "bg-rose-50 text-rose-700";
  if (normalized.includes("atencao") || normalized.includes("em analise") || normalized.includes("monitorado") || normalized.includes("media") || normalized.includes("em andamento") || normalized.includes("aguardando")) return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

export function IncidentsModule({ section }: { section: DashboardSection }) {
  const { canDelete, canUpdate } = useErpPermissions();
  const canDeleteIncidents = canDelete("operations.incidents");
  const canUpdateIncidents = canUpdate("operations.incidents");
  const [incidents, setIncidents] = useOperationsCollection(loadIncidents);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIncident, setEditingIncident] = useState<VersionedIncidentItem | null>(null);
  const [error, setError] = useState("");
  const incidentMutation = useErpMutation();
  const severityOptions = useMemo(
    () => [...INCIDENT_SEVERITY_OPTIONS] as IncidentItem["severity"][],
    [],
  );
  const statusOptions = useMemo(
    () => [...INCIDENT_STATUS_OPTIONS] as IncidentItem["status"][],
    [],
  );
  const closedStatus = useMemo(
    () => statusOptions.find((item) => normalizeText(item).includes("encerr")) ?? statusOptions[statusOptions.length - 1],
    [statusOptions],
  );
  const [form, setForm] = useState({
    title: "",
    area: "",
    severity: severityOptions[0] as IncidentItem["severity"],
    owner: "",
    status: statusOptions[0] as IncidentItem["status"],
  });

  function resetForm() {
    setForm({
      title: "",
      area: "",
      severity: severityOptions[0] as IncidentItem["severity"],
      owner: "",
      status: statusOptions[0] as IncidentItem["status"],
    });
    setEditingIncident(null);
    setError("");
    incidentMutation.resetMutation();
    setIsFormOpen(false);
  }

  function handleEdit(item: VersionedIncidentItem) {
    setForm({
      title: item.title,
      area: item.area,
      severity: item.severity,
      owner: item.owner,
      status: item.status,
    });
    setEditingIncident(item);
    setError("");
    incidentMutation.resetMutation();
    setIsFormOpen(true);
  }

  async function reloadIncidentsAfterConflict() {
    try {
      setIncidents(await refreshIncidents());
    } catch {
      setIncidents(loadIncidents());
    }
  }

  async function handleDelete(item: VersionedIncidentItem) {
    if (!canDeleteIncidents) {
      setError("Seu perfil nao pode excluir incidentes.");
      return;
    }

    if (incidentMutation.isLoading) {
      return;
    }

    if (!item.id || !item.version) {
      await reloadIncidentsAfterConflict();
      setError("Recarreguei os incidentes. Tente excluir novamente.");
      return;
    }

    if (!window.confirm(`Excluir o incidente "${item.title}"?`)) return;

    const incidentId = item.id;
    const baseVersion = item.version;
    setError("");
    await incidentMutation.runMutation(
      () => deleteIncidentRecord(incidentId, baseVersion),
      {
        fallbackErrorMessage: "Nao foi possivel excluir o incidente.",
        conflictMessage: INCIDENT_CONFLICT_MESSAGE,
        isVersionConflict: isIncidentMutationConflict,
        reloadOnConflict: reloadIncidentsAfterConflict,
        getErrorMessage: getIncidentMutationErrorMessage,
        onSuccess: () => {
          setIncidents((currentIncidents) =>
            currentIncidents.filter((incident) => incident.id !== incidentId),
          );
        },
      },
    );
  }

  async function handleClose(item: VersionedIncidentItem) {
    if (!canUpdateIncidents) {
      setError("Seu perfil nao pode encerrar incidentes.");
      return;
    }

    if (incidentMutation.isLoading) {
      return;
    }

    if (!item.id || !item.version) {
      await reloadIncidentsAfterConflict();
      setError("Recarreguei os incidentes. Tente encerrar novamente.");
      return;
    }

    const incidentId = item.id;
    const baseVersion = item.version;
    setError("");
    await incidentMutation.runMutation(
      () => updateIncidentRecord(incidentId, { status: closedStatus }, baseVersion),
      {
        fallbackErrorMessage: "Nao foi possivel encerrar o incidente.",
        conflictMessage: INCIDENT_CONFLICT_MESSAGE,
        isVersionConflict: isIncidentMutationConflict,
        reloadOnConflict: reloadIncidentsAfterConflict,
        getErrorMessage: getIncidentMutationErrorMessage,
        onSuccess: (updatedIncident) => {
          setIncidents((currentIncidents) =>
            currentIncidents.map((incident) =>
              incident.id === updatedIncident.id ? updatedIncident : incident,
            ),
          );
        },
      },
    );
  }

  async function handleSave() {
    if (incidentMutation.isLoading) {
      return;
    }

    if (!form.title.trim() || !form.area.trim() || !form.owner.trim()) {
      setError("Preencha titulo, area e responsavel.");
      return;
    }

    if (
      incidents.some(
        (item) =>
          item.title.toLowerCase() === form.title.trim().toLowerCase() &&
          item.id !== editingIncident?.id,
      )
    ) {
      setError("Ja existe um incidente com esse titulo.");
      return;
    }

    const nextItem: IncidentItem = {
      id: editingIncident?.id,
      title: form.title.trim(),
      area: form.area.trim(),
      severity: form.severity,
      owner: form.owner.trim(),
      status: form.status,
    };

    setError("");

    if (editingIncident) {
      if (!editingIncident.id || !editingIncident.version) {
        await reloadIncidentsAfterConflict();
        setError("Recarreguei os incidentes. Tente salvar novamente.");
        return;
      }

      const incidentId = editingIncident.id;
      const baseVersion = editingIncident.version;
      await incidentMutation.runMutation(
        () => updateIncidentRecord(incidentId, nextItem, baseVersion),
        {
          fallbackErrorMessage: "Nao foi possivel salvar o incidente.",
          conflictMessage: INCIDENT_CONFLICT_MESSAGE,
          isVersionConflict: isIncidentMutationConflict,
          reloadOnConflict: reloadIncidentsAfterConflict,
          getErrorMessage: getIncidentMutationErrorMessage,
          onSuccess: (updatedIncident) => {
            setIncidents((currentIncidents) =>
              currentIncidents.map((item) =>
                item.id === updatedIncident.id ? updatedIncident : item,
              ),
            );
            resetForm();
          },
        },
      );
      return;
    }

    await incidentMutation.runMutation(
      () => createIncidentRecord(nextItem),
      {
        fallbackErrorMessage: "Nao foi possivel salvar o incidente.",
        conflictMessage: INCIDENT_CONFLICT_MESSAGE,
        isVersionConflict: isIncidentMutationConflict,
        reloadOnConflict: reloadIncidentsAfterConflict,
        getErrorMessage: getIncidentMutationErrorMessage,
        onSuccess: (createdIncident) => {
          setIncidents((currentIncidents) => [
            createdIncident,
            ...currentIncidents.filter((item) => item.id !== createdIncident.id),
          ]);
          resetForm();
        },
      },
    );
  }

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Ocorrencias" actions={<ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>Novo incidente</ActionButton>} />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingIncident ? "Editar incidente" : "Novo incidente"}
          description="Registre ocorrencias, nivel de severidade e o dono da tratativa para a operacao."
          error={error || incidentMutation.error}
          submitLabel={editingIncident ? "Salvar alteracoes" : "Salvar incidente"}
          onSubmit={handleSave}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Titulo">
              <TextInput value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Divergencia de embalagem secundaria" />
            </FormField>
            <FormField label="Area">
              <TextInput value={form.area} onChange={(event) => setForm((current) => ({ ...current, area: event.target.value }))} placeholder="Ex.: Qualidade" />
            </FormField>
            <FormField label="Severidade">
              <SelectInput value={form.severity} onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value as IncidentItem["severity"] }))}>
                {severityOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Responsável">
              <TextInput value={form.owner} onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))} placeholder="Ex.: Marina Azevedo" />
            </FormField>
            <FormField label="Status">
              <SelectInput value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as IncidentItem["status"] }))}>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </SelectInput>
            </FormField>
          </div>
        </InlineFormPanel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Incidentes abertos" value={String(incidents.filter((item) => item.status !== closedStatus).length)} helper="Casos que ainda precisam de tratativa" tone="danger" />
        <SummaryCard title="Severidade alta" value={String(incidents.filter((item) => item.severity === "Alta").length)} helper="Ocorrencias com maior impacto operacional" tone="danger" />
        <SummaryCard title="Encerrados" value={String(incidents.filter((item) => item.status === closedStatus).length)} helper="Casos fechados e rastreados no sistema" tone="success" />
      </div>

      <Panel title="Registro de incidentes" eyebrow="Tratativa">
        <div className="space-y-4">
          {incidents.map((item) => (
            <article key={item.id ?? item.title} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
                    <StatusPill label={item.severity} tone={toneByLabel(item.severity)} />
                    <StatusPill label={item.status} tone={toneByLabel(item.status)} />
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.area} · Responsável: {item.owner}</p>
                </div>
                <div className="flex gap-2">
                  {canUpdateIncidents ? (
                    <button type="button" onClick={() => void handleClose(item)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100">Encerrar</button>
                  ) : null}
                  <button type="button" onClick={() => handleEdit(item)} className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]">Editar</button>
                  {canDeleteIncidents ? (
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
