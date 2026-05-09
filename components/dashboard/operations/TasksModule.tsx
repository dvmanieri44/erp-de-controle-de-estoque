"use client";

import { useMemo, useState } from "react";

import {
  ActionButton,
  FormField,
  Hero,
  InlineFormPanel,
  Panel,
  StatusPill,
  SummaryCard,
  TextInput,
} from "@/components/dashboard/operations/ui";
import { useOperationsCollection } from "@/components/dashboard/operations/useOperationsCollection";
import type { DashboardSection } from "@/lib/dashboard-sections";
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

function toneByLabel(label: string) {
  if (label.includes("Crítico") || label.includes("Desvio") || label.includes("Retido") || label.includes("Alta") || label.includes("Aberto")) return "bg-rose-50 text-rose-700";
  if (label.includes("Atenção") || label.includes("Em análise") || label.includes("Monitorado") || label.includes("Média") || label.includes("Em andamento") || label.includes("Aguardando")) return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
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
