"use client";

import { useEffect, useMemo, useState } from "react";

import { useLocale } from "@/components/providers/LocaleProvider";
import { ERP_DATA_EVENT } from "@/lib/app-events";
import type { DashboardSection } from "@/lib/dashboard-sections";
import { getSectionById } from "@/lib/dashboard-sections";
import { normalizeText } from "@/lib/inventory";
import {
  INCIDENTS,
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
    () => Array.from(new Set(INCIDENTS.map((item) => item.severity))) as IncidentItem["severity"][],
    [],
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(INCIDENTS.map((item) => item.status))) as IncidentItem["status"][],
    [],
  );
  const closedStatus = useMemo(
    () => statusOptions.find((item) => normalizeText(item).includes("encerr")) ?? statusOptions[statusOptions.length - 1],
    [statusOptions],
  );
  const [form, setForm] = useState({
    title: "",
    area: "",
    severity: INCIDENTS[0]?.severity ?? ("Alta" as IncidentItem["severity"]),
    owner: "",
    status: INCIDENTS[0]?.status ?? ("Aberto" as IncidentItem["status"]),
  });

  function resetForm() {
    setForm({
      title: "",
      area: "",
      severity: INCIDENTS[0]?.severity ?? severityOptions[0],
      owner: "",
      status: INCIDENTS[0]?.status ?? statusOptions[0],
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
            <FormField label="Responsavel">
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
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.area} · Responsavel: {item.owner}</p>
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
