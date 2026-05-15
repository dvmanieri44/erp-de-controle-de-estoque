"use client";

import { useState } from "react";

import { TextareaInput } from "@/components/dashboard/operations/module-helpers";
import {
  ActionButton,
  FormField,
  Hero,
  InlineFormPanel,
  TextInput,
} from "@/components/dashboard/operations/ui";
import { useErpResourceCollection } from "@/components/dashboard/operations/useErpResourceCollection";
import type { DashboardSection } from "@/lib/dashboard-sections";
import { confirmAction } from "@/lib/client-feedback";
import type { CategoryItem } from "@/lib/operations-data";
import {
  CategoryRequestError,
  CategoryVersionConflictError,
  createCategory as createCategoryRecord,
  deleteCategory as deleteCategoryRecord,
  loadCategories,
  refreshCategories,
  updateCategory as updateCategoryRecord,
  type VersionedCategoryItem,
} from "@/lib/operations-store";
import { useErpMutation } from "@/lib/use-erp-mutation";
import { useErpPermissions } from "@/lib/use-erp-permissions";

const CATEGORY_CARD_TONES = [
  "bg-blue-50 text-blue-600",
  "bg-emerald-50 text-emerald-600",
  "bg-amber-50 text-amber-600",
  "bg-violet-50 text-violet-600",
];

const CATEGORIES_CONFLICT_MESSAGE =
  "Conflito de versao: esta categoria foi alterada por outra sessao. Recarreguei a lista e nao salvei sua alteracao para evitar sobrescrita. Revise os dados e tente novamente.";

function isCategoryMutationConflict(error: unknown) {
  return (
    error instanceof CategoryVersionConflictError ||
    (error instanceof CategoryRequestError && error.status === 409)
  );
}

function getCategoryMutationErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  return error instanceof CategoryRequestError ? error.message : fallbackMessage;
}

export function CategoriesModule({ section }: { section: DashboardSection }) {
  const { canDelete } = useErpPermissions();
  const canDeleteCategories = canDelete("operations.categories");
  const [categories, setCategories] = useErpResourceCollection(
    "operations.categories",
    loadCategories,
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VersionedCategoryItem | null>(
    null,
  );
  const [error, setError] = useState("");
  const categoriesMutation = useErpMutation();
  const [form, setForm] = useState({
    name: "",
    portfolio: "",
    skus: "",
    share: "",
    focus: "",
  });

  function resetForm() {
    setForm({
      name: "",
      portfolio: "",
      skus: "",
      share: "",
      focus: "",
    });
    setEditingItem(null);
    setError("");
    categoriesMutation.resetMutation();
    setIsFormOpen(false);
  }

  function handleEditCategory(item: VersionedCategoryItem) {
    setForm({
      name: item.name,
      portfolio: item.portfolio,
      skus: String(item.skus),
      share: item.share,
      focus: item.focus,
    });
    setEditingItem(item);
    setError("");
    categoriesMutation.resetMutation();
    setIsFormOpen(true);
  }

  async function reloadCategoriesAfterConflict() {
    try {
      setCategories(await refreshCategories());
    } catch {
      setCategories(loadCategories());
    }
  }

  async function handleDeleteCategory(item: VersionedCategoryItem) {
    if (!canDeleteCategories) {
      setError("Seu perfil nao pode excluir categorias.");
      return;
    }

    if (categoriesMutation.isLoading) {
      return;
    }

    if (!item.id || !item.version) {
      await reloadCategoriesAfterConflict();
      setError("Recarreguei as categorias. Tente excluir novamente.");
      return;
    }

    if (!confirmAction(`Excluir a categoria ${item.name}?`)) {
      return;
    }

    const categoryId = item.id;
    const baseVersion = item.version;
    setError("");
    await categoriesMutation.runMutation(
      () => deleteCategoryRecord(categoryId, baseVersion),
      {
        fallbackErrorMessage: "Nao foi possivel excluir a categoria.",
        conflictMessage: CATEGORIES_CONFLICT_MESSAGE,
        isVersionConflict: isCategoryMutationConflict,
        reloadOnConflict: reloadCategoriesAfterConflict,
        getErrorMessage: getCategoryMutationErrorMessage,
        onSuccess: () => {
          setCategories((currentItems) =>
            currentItems.filter((currentItem) => currentItem.id !== categoryId),
          );
        },
      },
    );
  }

  async function handleSaveCategory() {
    if (categoriesMutation.isLoading) {
      return;
    }

    const skus = Number(form.skus);

    if (
      !form.name.trim() ||
      !form.portfolio.trim() ||
      !form.share.trim() ||
      !form.focus.trim()
    ) {
      setError("Preencha nome, portfolio, share e foco.");
      return;
    }

    if (Number.isNaN(skus) || skus < 0) {
      setError("Informe um total de SKUs valido.");
      return;
    }

    if (
      categories.some(
        (item) =>
          item.name.toLowerCase() === form.name.trim().toLowerCase() &&
          item.id !== editingItem?.id,
      )
    ) {
      setError("Ja existe uma categoria com esse nome.");
      return;
    }

    const nextCategory: CategoryItem = {
      name: form.name.trim(),
      portfolio: form.portfolio.trim(),
      skus,
      share: form.share.trim(),
      focus: form.focus.trim(),
    };

    setError("");

    if (editingItem) {
      if (!editingItem.id || !editingItem.version) {
        await reloadCategoriesAfterConflict();
        setError("Recarreguei as categorias. Tente salvar novamente.");
        return;
      }

      const categoryId = editingItem.id;
      const baseVersion = editingItem.version;
      await categoriesMutation.runMutation(
        () => updateCategoryRecord(categoryId, nextCategory, baseVersion),
        {
          fallbackErrorMessage: "Nao foi possivel salvar a categoria.",
          conflictMessage: CATEGORIES_CONFLICT_MESSAGE,
          isVersionConflict: isCategoryMutationConflict,
          reloadOnConflict: reloadCategoriesAfterConflict,
          getErrorMessage: getCategoryMutationErrorMessage,
          onSuccess: (updatedItem) => {
            setCategories((currentItems) =>
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

    await categoriesMutation.runMutation(() => createCategoryRecord(nextCategory), {
      fallbackErrorMessage: "Nao foi possivel salvar a categoria.",
      conflictMessage: CATEGORIES_CONFLICT_MESSAGE,
      isVersionConflict: isCategoryMutationConflict,
      reloadOnConflict: reloadCategoriesAfterConflict,
      getErrorMessage: getCategoryMutationErrorMessage,
      onSuccess: (createdItem) => {
        setCategories((currentItems) => [
          createdItem,
          ...currentItems.filter((item) => item.id !== createdItem.id),
        ]);
        resetForm();
      },
    });
  }

  return (
    <section className="space-y-8">
      <Hero
        section={section}
        eyebrow="Estrutura"
        actions={
          <ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>
            Nova Categoria
          </ActionButton>
        }
      />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingItem ? "Editar categoria" : "Nova categoria"}
          description="Mantenha a estrutura comercial e industrial alinhada com o portfolio real do ERP."
          error={error}
          submitLabel={editingItem ? "Salvar alteracoes" : "Salvar categoria"}
          onSubmit={() => {
            void handleSaveCategory();
          }}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Nome">
              <TextInput
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Ex.: Super Premium Caes"
              />
            </FormField>
            <FormField label="Portfolio">
              <TextInput
                value={form.portfolio}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    portfolio: event.target.value,
                  }))
                }
                placeholder="Ex.: PremieR Formula"
              />
            </FormField>
            <FormField label="SKUs">
              <TextInput
                value={form.skus}
                onChange={(event) =>
                  setForm((current) => ({ ...current, skus: event.target.value }))
                }
                inputMode="numeric"
                placeholder="Ex.: 42"
              />
            </FormField>
            <FormField label="Share">
              <TextInput
                value={form.share}
                onChange={(event) =>
                  setForm((current) => ({ ...current, share: event.target.value }))
                }
                placeholder="Ex.: 38%"
              />
            </FormField>
          </div>
          <FormField label="Foco">
            <TextareaInput
              value={form.focus}
              onChange={(event) =>
                setForm((current) => ({ ...current, focus: event.target.value }))
              }
              placeholder="Descreva o papel da categoria na operacao."
            />
          </FormField>
        </InlineFormPanel>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        {categories.map((item, index) => (
          <article
            key={item.id ?? item.name}
            className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_10px_24px_var(--shadow-color)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-3xl text-2xl ${CATEGORY_CARD_TONES[index % CATEGORY_CARD_TONES.length]}`}
              >
                âŒ‚
              </div>
              <div className="flex gap-2 text-[var(--accent)]">
                <button
                  type="button"
                  onClick={() => handleEditCategory(item)}
                  className="rounded-xl p-2 transition hover:bg-[var(--accent-soft)]"
                >
                  âœŽ
                </button>
                {canDeleteCategories ? (
                  <button
                    type="button"
                    onClick={() => void handleDeleteCategory(item)}
                    className="rounded-xl p-2 text-rose-500 transition hover:bg-rose-50"
                  >
                    âœ•
                  </button>
                ) : null}
              </div>
            </div>
            <p className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-[var(--navy-900)]">
              {item.name}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              {item.focus}
            </p>
            <div className="mt-5 border-t border-[var(--panel-border)] pt-4">
              <p className="text-3xl font-semibold text-[var(--navy-900)]">
                {item.skus}
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">
                SKUs Â· share {item.share}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
