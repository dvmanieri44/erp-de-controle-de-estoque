"use client";

import { useEffect, useMemo, useState } from "react";

import { useLocale } from "@/components/providers/LocaleProvider";
import { ERP_DATA_EVENT } from "@/lib/app-events";
import type { DashboardSection } from "@/lib/dashboard-sections";
import { getSectionById } from "@/lib/dashboard-sections";
import { normalizeText } from "@/lib/inventory";
import {
  TASKS,
  type TaskItem,
} from "@/lib/operations-data";
import {
  createTask as createTaskRecord,
  deleteTask as deleteTaskRecord,
  loadTasks,
  refreshTasks,
  TaskRequestError,
  TaskVersionConflictError,
  updateTask as updateTaskRecord,
  type VersionedTaskItem,
} from "@/lib/operations-store";
import { useErpMutation } from "@/lib/use-erp-mutation";
import { useErpPermissions } from "@/lib/use-erp-permissions";

const TASK_CONFLICT_MESSAGE =
  "Conflito de versao: esta tarefa foi alterada por outra sessao. Recarreguei a lista e nao salvei sua alteracao para evitar sobrescrita. Revise os dados e tente novamente.";

function isTaskMutationConflict(error: unknown) {
  return (
    error instanceof TaskVersionConflictError ||
    (error instanceof TaskRequestError && error.status === 409)
  );
}

function getTaskMutationErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  return error instanceof TaskRequestError ? error.message : fallbackMessage;
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

export function TasksModule({ section }: { section: DashboardSection }) {
  const { canDelete } = useErpPermissions();
  const canDeleteTasks = canDelete("operations.tasks");
  const [tasks, setTasks] = useOperationsCollection(loadTasks);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<VersionedTaskItem | null>(null);
  const [error, setError] = useState("");
  const taskMutation = useErpMutation();
  const statusOptions = useMemo(() => Array.from(new Set(TASKS.map((item) => item.status))) as TaskItem["status"][], []);
  const waitingStatus = useMemo(() => statusOptions.find((item) => normalizeText(item).includes("aguard")) ?? statusOptions[0], [statusOptions]);
  const runningStatus = useMemo(() => statusOptions.find((item) => normalizeText(item).includes("execu")) ?? statusOptions[0], [statusOptions]);
  const doneStatus = useMemo(() => statusOptions.find((item) => normalizeText(item).includes("conclu")) ?? statusOptions[0], [statusOptions]);
  const [form, setForm] = useState({
    title: "",
    shift: "",
    owner: "",
    checklist: "",
    completed: "",
    status: TASKS[0]?.status ?? statusOptions[0],
  });

  function resolveTaskStatus(completed: number, checklist: number): TaskItem["status"] {
    if (completed >= checklist) return doneStatus;
    if (completed > 0) return runningStatus;
    return waitingStatus;
  }

  function resetForm() {
    setForm({
      title: "",
      shift: "",
      owner: "",
      checklist: "",
      completed: "",
      status: TASKS[0]?.status ?? statusOptions[0],
    });
    setEditingTask(null);
    setError("");
    taskMutation.resetMutation();
    setIsFormOpen(false);
  }

  function handleEdit(item: VersionedTaskItem) {
    setForm({
      title: item.title,
      shift: item.shift,
      owner: item.owner,
      checklist: String(item.checklist),
      completed: String(item.completed),
      status: item.status,
    });
    setEditingTask(item);
    setError("");
    taskMutation.resetMutation();
    setIsFormOpen(true);
  }

  async function reloadTasksAfterConflict() {
    try {
      setTasks(await refreshTasks());
    } catch {
      setTasks(loadTasks());
    }
  }

  async function handleDelete(item: VersionedTaskItem) {
    if (!canDeleteTasks) {
      setError("Seu perfil nao pode excluir tarefas.");
      return;
    }

    if (taskMutation.isLoading) {
      return;
    }

    if (!item.id || !item.version) {
      await reloadTasksAfterConflict();
      setError("Recarreguei as tarefas. Tente excluir novamente.");
      return;
    }

    if (!window.confirm(`Excluir a tarefa "${item.title}"?`)) return;

    const taskId = item.id;
    const baseVersion = item.version;
    setError("");
    await taskMutation.runMutation(
      () => deleteTaskRecord(taskId, baseVersion),
      {
        fallbackErrorMessage: "Nao foi possivel excluir a tarefa.",
        conflictMessage: TASK_CONFLICT_MESSAGE,
        isVersionConflict: isTaskMutationConflict,
        reloadOnConflict: reloadTasksAfterConflict,
        getErrorMessage: getTaskMutationErrorMessage,
        onSuccess: () => {
          setTasks((currentTasks) =>
            currentTasks.filter((task) => task.id !== taskId),
          );
        },
      },
    );
  }

  async function handleAdvance(item: VersionedTaskItem) {
    if (taskMutation.isLoading) {
      return;
    }

    if (!item.id || !item.version) {
      await reloadTasksAfterConflict();
      setError("Recarreguei as tarefas. Tente avancar novamente.");
      return;
    }

    const completed = Math.min(item.checklist, item.completed + 1);
    const nextItem: Partial<TaskItem> = {
      completed,
      status: resolveTaskStatus(completed, item.checklist),
    };
    const taskId = item.id;
    const baseVersion = item.version;
    setError("");
    await taskMutation.runMutation(
      () => updateTaskRecord(taskId, nextItem, baseVersion),
      {
        fallbackErrorMessage: "Nao foi possivel avancar a tarefa.",
        conflictMessage: TASK_CONFLICT_MESSAGE,
        isVersionConflict: isTaskMutationConflict,
        reloadOnConflict: reloadTasksAfterConflict,
        getErrorMessage: getTaskMutationErrorMessage,
        onSuccess: (updatedTask) => {
          setTasks((currentTasks) =>
            currentTasks.map((task) =>
              task.id === updatedTask.id ? updatedTask : task,
            ),
          );
        },
      },
    );
  }

  async function handleSave() {
    if (taskMutation.isLoading) {
      return;
    }

    const checklist = Number(form.checklist);
    const completedRaw = Number(form.completed);

    if (!form.title.trim() || !form.shift.trim() || !form.owner.trim()) {
      setError("Preencha titulo, turno e responsavel.");
      return;
    }

    if ([checklist, completedRaw].some((value) => Number.isNaN(value) || value < 0)) {
      setError("Informe checklist e concluido com numeros validos.");
      return;
    }

    if (completedRaw > checklist) {
      setError("Concluido nao pode ser maior que o checklist.");
      return;
    }

    if (
      tasks.some(
        (item) =>
          item.title.toLowerCase() === form.title.trim().toLowerCase() &&
          item.id !== editingTask?.id,
      )
    ) {
      setError("Ja existe uma tarefa com esse titulo.");
      return;
    }

    const completed = Math.min(checklist, completedRaw);
    const nextItem: TaskItem = {
      title: form.title.trim(),
      shift: form.shift.trim(),
      owner: form.owner.trim(),
      checklist,
      completed,
      status: resolveTaskStatus(completed, checklist),
    };

    setError("");

    if (editingTask) {
      if (!editingTask.id || !editingTask.version) {
        await reloadTasksAfterConflict();
        setError("Recarreguei as tarefas. Tente salvar novamente.");
        return;
      }

      const taskId = editingTask.id;
      const baseVersion = editingTask.version;
      await taskMutation.runMutation(
        () => updateTaskRecord(taskId, nextItem, baseVersion),
        {
          fallbackErrorMessage: "Nao foi possivel salvar a tarefa.",
          conflictMessage: TASK_CONFLICT_MESSAGE,
          isVersionConflict: isTaskMutationConflict,
          reloadOnConflict: reloadTasksAfterConflict,
          getErrorMessage: getTaskMutationErrorMessage,
          onSuccess: (updatedTask) => {
            setTasks((currentTasks) =>
              currentTasks.map((item) =>
                item.id === updatedTask.id ? updatedTask : item,
              ),
            );
            resetForm();
          },
        },
      );
      return;
    }

    await taskMutation.runMutation(
      () => createTaskRecord(nextItem),
      {
        fallbackErrorMessage: "Nao foi possivel salvar a tarefa.",
        conflictMessage: TASK_CONFLICT_MESSAGE,
        isVersionConflict: isTaskMutationConflict,
        reloadOnConflict: reloadTasksAfterConflict,
        getErrorMessage: getTaskMutationErrorMessage,
        onSuccess: (createdTask) => {
          setTasks((currentTasks) => [
            createdTask,
            ...currentTasks.filter((item) => item.id !== createdTask.id),
          ]);
          resetForm();
        },
      },
    );
  }

  return (
    <section className="space-y-8">
      <Hero section={section} eyebrow="Execucao" actions={<ActionButton tone="primary" onClick={() => setIsFormOpen(true)}>Nova tarefa</ActionButton>} />

      {isFormOpen ? (
        <InlineFormPanel
          title={editingTask ? "Editar tarefa" : "Nova tarefa"}
          description="Organize a rotina por turno e acompanhe o progresso das checklists."
          error={error || taskMutation.error}
          submitLabel={editingTask ? "Salvar alteracoes" : "Salvar tarefa"}
          onSubmit={handleSave}
          onCancel={resetForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Titulo">
              <TextInput value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Conferencia de pallets" />
            </FormField>
            <FormField label="Turno">
              <TextInput value={form.shift} onChange={(event) => setForm((current) => ({ ...current, shift: event.target.value }))} placeholder="Ex.: Turno A" />
            </FormField>
            <FormField label="Responsavel">
              <TextInput value={form.owner} onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))} placeholder="Ex.: Diego Paiva" />
            </FormField>
            <FormField label="Checklist">
              <TextInput value={form.checklist} onChange={(event) => setForm((current) => ({ ...current, checklist: event.target.value }))} inputMode="numeric" placeholder="Ex.: 8" />
            </FormField>
            <FormField label="Concluido">
              <TextInput value={form.completed} onChange={(event) => setForm((current) => ({ ...current, completed: event.target.value }))} inputMode="numeric" placeholder="Ex.: 5" />
            </FormField>
          </div>
        </InlineFormPanel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Tarefas ativas" value={String(tasks.filter((item) => item.status !== doneStatus).length)} helper="Fluxos ainda em andamento no dia" />
        <SummaryCard title="Checklists concluidos" value={`${tasks.reduce((sum, item) => sum + item.completed, 0)}`} helper="Itens ja executados nas rotinas abertas" />
        <SummaryCard title="Turnos monitorados" value={String(new Set(tasks.map((item) => item.shift)).size)} helper="Cobertura operacional por janela de trabalho" />
      </div>

      <Panel title="Rotina operacional por turno" eyebrow="Task board">
        <div className="space-y-4">
          {tasks.map((item) => {
            const percent = item.checklist > 0 ? (item.completed / item.checklist) * 100 : 0;

            return (
              <article key={item.id ?? item.title} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
                      <StatusPill label={item.status} tone={toneByLabel(item.status)} />
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.shift} Â· Responsavel: {item.owner}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-[var(--navy-900)]">{item.completed}/{item.checklist} etapas</p>
                    <button type="button" onClick={() => void handleAdvance(item)} className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]">Avancar</button>
                    <button type="button" onClick={() => handleEdit(item)} className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]">Editar</button>
                    {canDeleteTasks ? (
                      <button type="button" onClick={() => void handleDelete(item)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Excluir</button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 h-2.5 rounded-full bg-[var(--panel)]">
                  <div className={`h-2.5 rounded-full ${item.status === doneStatus ? "bg-emerald-500" : item.status === runningStatus ? "bg-[var(--accent)]" : "bg-amber-500"}`} style={{ width: `${Math.max(8, percent)}%` }} />
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
    </section>
  );
}
