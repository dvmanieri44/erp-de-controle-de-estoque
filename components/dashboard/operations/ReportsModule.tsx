"use client";

import Link from "next/link";
import { useState } from "react";

import {
  exportCsv,
  TextareaInput,
  useInventoryData,
} from "@/components/dashboard/operations/module-helpers";
import {
  ActionButton,
  FormField,
  Hero,
  InlineFormPanel,
  StatusPill,
  SummaryCard,
  TextInput,
} from "@/components/dashboard/operations/ui";
import { useOperationsCollection } from "@/components/dashboard/operations/useOperationsCollection";
import { confirmAction } from "@/lib/client-feedback";
import type { DashboardSection } from "@/lib/dashboard-sections";
import { getLocationUsedCapacity, normalizeText } from "@/lib/inventory";
import { REPORTS, type ReportItem } from "@/lib/operations-data";
import {
  createReport as createReportRecord,
  deleteReport as deleteReportRecord,
  loadLots,
  loadNotifications,
  loadProductLines,
  loadReports,
  refreshReports,
  ReportRequestError,
  ReportVersionConflictError,
  updateReport as updateReportRecord,
  type VersionedReportItem,
} from "@/lib/operations-store";
import { useErpMutation } from "@/lib/use-erp-mutation";
import { useErpPermissions } from "@/lib/use-erp-permissions";

const REPORTS_CONFLICT_MESSAGE =
  "Conflito de versao: este relatorio foi alterado por outra sessao. Recarreguei a lista e nao salvei sua alteracao para evitar sobrescrita. Revise os dados e tente novamente.";

function isReportMutationConflict(error: unknown) {
  return (
    error instanceof ReportVersionConflictError ||
    (error instanceof ReportRequestError && error.status === 409)
  );
}

function getReportMutationErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  return error instanceof ReportRequestError ? error.message : fallbackMessage;
}

export function ReportsModule({ section }: { section: DashboardSection }) {
  const { canDelete } = useErpPermissions();
  const canDeleteReports = canDelete("operations.reports");
  const { locations, movements } = useInventoryData();
  const [reports, setReports] = useOperationsCollection(loadReports);
  const [products] = useOperationsCollection(loadProductLines);
  const [lots] = useOperationsCollection(loadLots);
  const [notifications] = useOperationsCollection(loadNotifications);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VersionedReportItem | null>(null);
  const [error, setError] = useState("");
  const reportsMutation = useErpMutation();
  const [form, setForm] = useState({
    title: "",
    owner: "",
    cadence: REPORTS[0]?.cadence ?? "Diario",
    lastRun: "",
    summary: "",
  });

  function resetForm() {
    setForm({
      title: "",
      owner: "",
      cadence: REPORTS[0]?.cadence ?? "Diario",
      lastRun: "",
      summary: "",
    });
    setEditingItem(null);
    setError("");
    reportsMutation.resetMutation();
    setIsFormOpen(false);
  }

  function handleEdit(item: VersionedReportItem) {
    setForm({
      title: item.title,
      owner: item.owner,
      cadence: item.cadence,
      lastRun: item.lastRun,
      summary: item.summary,
    });
    setEditingItem(item);
    setError("");
    reportsMutation.resetMutation();
    setIsFormOpen(true);
  }

  async function reloadReportsAfterConflict() {
    try {
      setReports(await refreshReports());
    } catch {
      setReports(loadReports());
    }
  }

  async function handleDelete(item: VersionedReportItem) {
    if (!canDeleteReports) {
      setError("Seu perfil nao pode excluir relatorios.");
      return;
    }

    if (reportsMutation.isLoading) {
      return;
    }

    if (!item.id || !item.version) {
      await reloadReportsAfterConflict();
      setError("Recarreguei os relatorios. Tente excluir novamente.");
      return;
    }

    if (!confirmAction(`Excluir o relatorio "${item.title}"?`)) {
      return;
    }

    const reportId = item.id;
    const baseVersion = item.version;
    setError("");
    await reportsMutation.runMutation(
      () => deleteReportRecord(reportId, baseVersion),
      {
        fallbackErrorMessage: "Nao foi possivel excluir o relatorio.",
        conflictMessage: REPORTS_CONFLICT_MESSAGE,
        isVersionConflict: isReportMutationConflict,
        reloadOnConflict: reloadReportsAfterConflict,
        getErrorMessage: getReportMutationErrorMessage,
        onSuccess: () => {
          setReports((currentReports) =>
            currentReports.filter((currentItem) => currentItem.id !== reportId),
          );
        },
      },
    );
  }

  async function handleSave() {
    if (reportsMutation.isLoading) {
      return;
    }

    if (
      !form.title.trim() ||
      !form.owner.trim() ||
      !form.cadence.trim() ||
      !form.summary.trim()
    ) {
      setError("Preencha titulo, responsavel, cadencia e resumo.");
      return;
    }

    if (
      reports.some(
        (item) =>
          item.title.toLowerCase() === form.title.trim().toLowerCase() &&
          item.id !== editingItem?.id,
      )
    ) {
      setError("Ja existe um relatorio com esse titulo.");
      return;
    }

    const nextItem: ReportItem = {
      title: form.title.trim(),
      owner: form.owner.trim(),
      cadence: form.cadence.trim(),
      lastRun: form.lastRun.trim() || "Ainda nao executado",
      summary: form.summary.trim(),
    };

    setError("");

    if (editingItem) {
      if (!editingItem.id || !editingItem.version) {
        await reloadReportsAfterConflict();
        setError("Recarreguei os relatorios. Tente salvar novamente.");
        return;
      }

      const reportId = editingItem.id;
      const baseVersion = editingItem.version;
      await reportsMutation.runMutation(
        () => updateReportRecord(reportId, nextItem, baseVersion),
        {
          fallbackErrorMessage: "Nao foi possivel salvar o relatorio.",
          conflictMessage: REPORTS_CONFLICT_MESSAGE,
          isVersionConflict: isReportMutationConflict,
          reloadOnConflict: reloadReportsAfterConflict,
          getErrorMessage: getReportMutationErrorMessage,
          onSuccess: (updatedItem) => {
            setReports((currentReports) =>
              currentReports.map((item) =>
                item.id === updatedItem.id ? updatedItem : item,
              ),
            );
            resetForm();
          },
        },
      );
      return;
    }

    await reportsMutation.runMutation(() => createReportRecord(nextItem), {
      fallbackErrorMessage: "Nao foi possivel salvar o relatorio.",
      conflictMessage: REPORTS_CONFLICT_MESSAGE,
      isVersionConflict: isReportMutationConflict,
      reloadOnConflict: reloadReportsAfterConflict,
      getErrorMessage: getReportMutationErrorMessage,
      onSuccess: (createdItem) => {
        setReports((currentReports) => [
          createdItem,
          ...currentReports.filter((item) => item.id !== createdItem.id),
        ]);
        resetForm();
      },
    });
  }

  function handleGenerateReport() {
    const totalCapacityUsed = locations.reduce(
      (sum, location) =>
        sum + Math.max(0, getLocationUsedCapacity(location.id, movements)),
      0,
    );

    exportCsv("relatorio-operacional.csv", [
      ["Indicador", "Valor"],
      ["Produtos cadastrados", String(products.length)],
      ["Lotes em monitoramento", String(lots.length)],
      [
        "Alertas em aberto",
        String(
          notifications.filter((item) =>
            !item.status.toLowerCase().includes("concl"),
          ).length,
        ),
      ],
      ["Localizacoes ativas", String(locations.length)],
      ["Eventos operacionais", String(movements.length)],
      ["Volume ocupado", String(totalCapacityUsed)],
      [""],
      ["Relatorio", "Cadencia", "Responsavel", "Ultima execucao"],
      ...reports.map((item) => [
        item.title,
        item.cadence,
        item.owner,
        item.lastRun,
      ]),
    ]);
  }

  return (
    <section className="space-y-8">
      <Hero
        section={section}
        eyebrow="Inteligencia"
        actions={
          <>
            <Link
              href="/dashboard/calendario"
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]"
            >
              Agenda de envios
            </Link>
            <ActionButton onClick={() => setIsFormOpen(true)}>
              Novo relatorio
            </ActionButton>
            <ActionButton tone="primary" onClick={handleGenerateReport}>
              Gerar Relatorio
            </ActionButton>
          </>
        }
      />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingItem ? "Editar relatorio" : "Novo relatorio"}
          description="Cadastre relatorios operacionais, donos da rotina e a janela de execucao."
          error={error || reportsMutation.error}
          submitLabel={editingItem ? "Salvar alteracoes" : "Salvar relatorio"}
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
                placeholder="Ex.: Giro por linha e especie"
              />
            </FormField>
            <FormField label="Responsavel">
              <TextInput
                value={form.owner}
                onChange={(event) =>
                  setForm((current) => ({ ...current, owner: event.target.value }))
                }
                placeholder="Ex.: Controladoria industrial"
              />
            </FormField>
            <FormField label="Cadencia">
              <TextInput
                value={form.cadence}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    cadence: event.target.value,
                  }))
                }
                placeholder="Ex.: Diario"
              />
            </FormField>
            <FormField label="Ultima execucao">
              <TextInput
                value={form.lastRun}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    lastRun: event.target.value,
                  }))
                }
                placeholder="Ex.: Hoje, 07:10"
              />
            </FormField>
          </div>
          <FormField label="Resumo">
            <TextareaInput
              value={form.summary}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  summary: event.target.value,
                }))
              }
              placeholder="Descreva o objetivo e os indicadores principais."
            />
          </FormField>
        </InlineFormPanel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Relatorios ativos"
          value={String(reports.length)}
          helper="Rotinas cadastradas na torre de controle"
        />
        <SummaryCard
          title="Cadencia diaria"
          value={String(
            reports.filter((item) => normalizeText(item.cadence).includes("diar"))
              .length,
          )}
          helper="Visoes executadas diariamente"
        />
        <SummaryCard
          title="Alertas em aberto"
          value={String(
            notifications.filter((item) =>
              !item.status.toLowerCase().includes("concl"),
            ).length,
          )}
          helper="Contexto operacional para leitura rapida"
          tone="warning"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {reports.map((item) => (
          <article
            key={item.id ?? item.title}
            className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_10px_24px_var(--shadow-color)]"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xl font-semibold text-[var(--foreground)]">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                  {item.summary}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill
                  label={item.cadence}
                  tone="bg-[var(--accent-soft)] text-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => handleEdit(item)}
                  className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]"
                >
                  Editar
                </button>
                {canDeleteReports ? (
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
            <div className="mt-5 grid gap-3 text-sm text-[var(--muted-foreground)] sm:grid-cols-2">
              <p>Responsavel: {item.owner}</p>
              <p>Ultima execucao: {item.lastRun}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
