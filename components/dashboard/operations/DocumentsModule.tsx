"use client";

import { useState } from "react";

import {
  ActionButton,
  FormField,
  Hero,
  InlineFormPanel,
  StatusPill,
  SummaryCard,
  TextInput,
} from "@/components/dashboard/operations/ui";
import { useErpResourceCollection } from "@/components/dashboard/operations/useErpResourceCollection";
import { confirmAction } from "@/lib/client-feedback";
import type { DashboardSection } from "@/lib/dashboard-sections";
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

export function DocumentsModule({ section }: { section: DashboardSection }) {
  const { canDelete } = useErpPermissions();
  const canDeleteDocuments = canDelete("operations.documents");
  const [documents, setDocuments] = useErpResourceCollection(
    "operations.documents",
    loadDocuments,
  );
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

    if (!confirmAction(`Excluir o documento "${item.title}"?`)) return;

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
            <FormField label="Responsável">
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
              <p>Responsável: {item.owner}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
