"use client";

import { useEffect, useState } from "react";

import { useLocale } from "@/components/providers/LocaleProvider";
import { ERP_DATA_EVENT } from "@/lib/app-events";
import type { DashboardSection } from "@/lib/dashboard-sections";
import { getSectionById } from "@/lib/dashboard-sections";
import type { DocumentItem } from "@/lib/operations-data";
import {
  createDocument as createDocumentRecord,
  deleteDocument as deleteDocumentRecord,
  DocumentRequestError,
  DocumentVersionConflictError,
  loadDocuments,
  refreshDocuments,
  updateDocument as updateDocumentRecord,
  type VersionedDocumentItem,
} from "@/lib/operations-store";
import { useErpMutation } from "@/lib/use-erp-mutation";
import { useErpPermissions } from "@/lib/use-erp-permissions";

const DOCUMENT_CONFLICT_MESSAGE =
  "Conflito de versao: este documento foi alterado por outra sessao. Recarreguei a lista e nao salvei sua alteracao para evitar sobrescrita. Revise os dados e tente novamente.";

function isDocumentMutationConflict(error: unknown) {
  return (
    error instanceof DocumentVersionConflictError ||
    (error instanceof DocumentRequestError && error.status === 409)
  );
}

function getDocumentMutationErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  return error instanceof DocumentRequestError
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

function StatusPill({ label, tone }: { label: string; tone: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
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

export function DocumentsModule({ section }: { section: DashboardSection }) {
  const { canDelete } = useErpPermissions();
  const canDeleteDocuments = canDelete("operations.documents");
  const [documents, setDocuments] = useOperationsCollection(loadDocuments);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<VersionedDocumentItem | null>(null);
  const [error, setError] = useState("");
  const documentMutation = useErpMutation();
  const [form, setForm] = useState({
    title: "",
    type: "",
    area: "",
    updatedAt: "",
    owner: "",
  });

  function resetForm() {
    setForm({
      title: "",
      type: "",
      area: "",
      updatedAt: "",
      owner: "",
    });
    setEditingDocument(null);
    setError("");
    documentMutation.resetMutation();
    setIsFormOpen(false);
  }

  function handleEdit(item: VersionedDocumentItem) {
    setForm({
      title: item.title,
      type: item.type,
      area: item.area,
      updatedAt: item.updatedAt,
      owner: item.owner,
    });
    setEditingDocument(item);
    setError("");
    documentMutation.resetMutation();
    setIsFormOpen(true);
  }

  async function reloadDocumentsAfterConflict() {
    try {
      setDocuments(await refreshDocuments());
    } catch {
      setDocuments(loadDocuments());
    }
  }

  async function handleDelete(item: VersionedDocumentItem) {
    if (!canDeleteDocuments) {
      setError("Seu perfil nao pode excluir documentos.");
      return;
    }

    if (documentMutation.isLoading) {
      return;
    }

    if (!item.id || !item.version) {
      await reloadDocumentsAfterConflict();
      setError("Recarreguei os documentos. Tente excluir novamente.");
      return;
    }

    if (!window.confirm(`Excluir o documento "${item.title}"?`)) return;

    const documentId = item.id;
    const baseVersion = item.version;
    setError("");
    await documentMutation.runMutation(
      () => deleteDocumentRecord(documentId, baseVersion),
      {
        fallbackErrorMessage: "Nao foi possivel excluir o documento.",
        conflictMessage: DOCUMENT_CONFLICT_MESSAGE,
        isVersionConflict: isDocumentMutationConflict,
        reloadOnConflict: reloadDocumentsAfterConflict,
        getErrorMessage: getDocumentMutationErrorMessage,
        onSuccess: () => {
          setDocuments((currentDocuments) =>
            currentDocuments.filter((document) => document.id !== documentId),
          );
        },
      },
    );
  }

  async function handleSave() {
    if (documentMutation.isLoading) {
      return;
    }

    if (!form.title.trim() || !form.type.trim() || !form.area.trim() || !form.owner.trim()) {
      setError("Preencha titulo, tipo, area e responsavel.");
      return;
    }

    if (
      documents.some(
        (item) =>
          item.title.toLowerCase() === form.title.trim().toLowerCase() &&
          item.id !== editingDocument?.id,
      )
    ) {
      setError("Ja existe um documento com esse titulo.");
      return;
    }

    const nextItem: DocumentItem = {
      title: form.title.trim(),
      type: form.type.trim(),
      area: form.area.trim(),
      updatedAt: form.updatedAt.trim() || "Atualizado agora",
      owner: form.owner.trim(),
    };

    setError("");

    if (editingDocument) {
      if (!editingDocument.id || !editingDocument.version) {
        await reloadDocumentsAfterConflict();
        setError("Recarreguei os documentos. Tente salvar novamente.");
        return;
      }

      const documentId = editingDocument.id;
      const baseVersion = editingDocument.version;
      await documentMutation.runMutation(
        () => updateDocumentRecord(documentId, nextItem, baseVersion),
        {
          fallbackErrorMessage: "Nao foi possivel salvar o documento.",
          conflictMessage: DOCUMENT_CONFLICT_MESSAGE,
          isVersionConflict: isDocumentMutationConflict,
          reloadOnConflict: reloadDocumentsAfterConflict,
          getErrorMessage: getDocumentMutationErrorMessage,
          onSuccess: (updatedDocument) => {
            setDocuments((currentDocuments) =>
              currentDocuments.map((item) =>
                item.id === updatedDocument.id ? updatedDocument : item,
              ),
            );
            resetForm();
          },
        },
      );
      return;
    }

    await documentMutation.runMutation(
      () => createDocumentRecord(nextItem),
      {
        fallbackErrorMessage: "Nao foi possivel salvar o documento.",
        conflictMessage: DOCUMENT_CONFLICT_MESSAGE,
        isVersionConflict: isDocumentMutationConflict,
        reloadOnConflict: reloadDocumentsAfterConflict,
        getErrorMessage: getDocumentMutationErrorMessage,
        onSuccess: (createdDocument) => {
          setDocuments((currentDocuments) => [
            createdDocument,
            ...currentDocuments.filter((item) => item.id !== createdDocument.id),
          ]);
          resetForm();
        },
      },
    );
  }

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Documentacao" actions={<ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>Novo documento</ActionButton>} />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingDocument ? "Editar documento" : "Novo documento"}
          description="Cadastre laudos, comprovantes e checklists com ownership claro para a operacao."
          error={error || documentMutation.error}
          submitLabel={editingDocument ? "Salvar alteracoes" : "Salvar documento"}
          onSubmit={() => {
            void handleSave();
          }}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Titulo">
              <TextInput value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Laudo microbiologico do lote PFM260327" />
            </FormField>
            <FormField label="Tipo">
              <TextInput value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} placeholder="Ex.: Laudo" />
            </FormField>
            <FormField label="Area">
              <TextInput value={form.area} onChange={(event) => setForm((current) => ({ ...current, area: event.target.value }))} placeholder="Ex.: Qualidade" />
            </FormField>
            <FormField label="Atualizado em">
              <TextInput value={form.updatedAt} onChange={(event) => setForm((current) => ({ ...current, updatedAt: event.target.value }))} placeholder="Ex.: Hoje, 10:30" />
            </FormField>
            <FormField label="Responsavel">
              <TextInput value={form.owner} onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))} placeholder="Ex.: Tatiane Freitas" />
            </FormField>
          </div>
        </InlineFormPanel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Documentos ativos" value={String(documents.length)} helper="Arquivos e evidencias registrados na operacao" />
        <SummaryCard title="Areas documentadas" value={String(new Set(documents.map((item) => item.area)).size)} helper="Setores com rastreabilidade disponivel" />
        <SummaryCard title="Tipos diferentes" value={String(new Set(documents.map((item) => item.type)).size)} helper="Variedade de artefatos cadastrados" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {documents.map((item) => (
          <article key={item.id ?? item.title} className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_10px_24px_var(--shadow-color)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xl font-semibold text-[var(--foreground)]">{item.title}</p>
                <StatusPill label={item.type} tone="bg-[var(--accent-soft)] text-[var(--accent)]" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleEdit(item)} className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]">Editar</button>
                {canDeleteDocuments ? (
                  <button type="button" onClick={() => { void handleDelete(item); }} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Excluir</button>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">{item.area}</p>
            <div className="mt-5 grid gap-3 text-sm text-[var(--muted-foreground)] sm:grid-cols-2">
              <p>Atualizado em: {item.updatedAt}</p>
              <p>Responsavel: {item.owner}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
