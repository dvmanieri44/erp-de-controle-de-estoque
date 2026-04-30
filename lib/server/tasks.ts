import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { TaskItem } from "@/lib/operations-data";
import {
  ErpResourceValidationError,
  sanitizeStoredErpResourceItemData,
  validateErpResourceItemData,
} from "@/lib/server/erp-resource-schema";
import { readErpResource } from "@/lib/server/erp-state";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import { getServerPersistenceProvider } from "@/lib/server/server-persistence";

const TASKS_COLLECTION = "tasks";
const TASKS_RESOURCE_ID = "operations.tasks";
const DEFAULT_TASKS_FILE = path.join(process.cwd(), ".data", "tasks.json");

let fileWriteQueue = Promise.resolve();

type TaskVersion = number;

type StoredTaskDocument = TaskItem & {
  id: string;
  version: TaskVersion;
  updatedAt: string | null;
  deleted?: false;
};

type DeletedTaskDocument = {
  id: string;
  deleted: true;
  deletedAt: string;
  version: TaskVersion;
  updatedAt: string | null;
};

type TaskRecordLookup = {
  task: TaskRecord | null;
  exists: boolean;
};

type TaskMergeEntry =
  | { type: "task"; task: StoredTaskDocument }
  | { type: "deleted"; task: DeletedTaskDocument };

type StoredTaskEntry = StoredTaskDocument | DeletedTaskDocument;

type DeleteTaskResult = {
  id: string;
  version: TaskVersion;
  deletedAt: string;
};

type TasksFileStore = {
  items?: Record<string, StoredTaskEntry>;
};

export type TaskRecord = TaskItem & {
  id: string;
  version: TaskVersion;
  updatedAt: string | null;
};

export type ListTasksResult = {
  items: TaskRecord[];
  count: number;
};

export type UpdateTaskOptions = {
  baseVersion: number;
};

type TaskMutationResult =
  | { type: "set"; value: TaskItem & { id: string } }
  | { type: "noop"; value: TaskRecord }
  | { type: "delete"; value: TaskRecord };

export class TaskConflictError extends Error {
  status: number;
  currentVersion: number;
  currentUpdatedAt: string | null;

  constructor(
    message: string,
    currentVersion: number,
    currentUpdatedAt: string | null,
  ) {
    super(message);
    this.status = 409;
    this.currentVersion = currentVersion;
    this.currentUpdatedAt = currentUpdatedAt;
  }
}

export class TaskNotFoundError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.status = 404;
  }
}

export function requireTaskBaseVersion(value: unknown, operation: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ErpResourceValidationError(
      `baseVersion obrigatorio para ${operation} a tarefa.`,
      400,
    );
  }

  return value;
}

export function getTaskVersionConflictPayload(error: TaskConflictError) {
  return {
    error: "VERSION_CONFLICT" as const,
    currentVersion: error.currentVersion,
  };
}

function normalizeReference(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeTaskId(value: string) {
  return value.trim();
}

function getLegacyTaskId(task: Pick<TaskItem, "title" | "owner" | "shift">) {
  const key = `${normalizeReference(task.title)}::${normalizeReference(task.owner)}::${normalizeReference(task.shift)}`;
  const digest = createHash("sha1").update(key).digest("hex").slice(0, 16);
  return `task_${digest}`;
}

function getTaskId(task: TaskItem) {
  return typeof task.id === "string" && task.id.trim()
    ? normalizeTaskId(task.id)
    : getLegacyTaskId(task);
}

function getTasksFilePath() {
  return process.env.TASKS_FILE_PATH
    ? path.resolve(process.cwd(), process.env.TASKS_FILE_PATH)
    : DEFAULT_TASKS_FILE;
}

function queueFileWrite<T>(operation: () => Promise<T>) {
  const nextOperation = fileWriteQueue.then(operation, operation);
  fileWriteQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );
  return nextOperation;
}

function normalizeVersion(value: unknown) {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1
    ? value
    : 1;
}

function normalizeUpdatedAt(value: unknown) {
  return typeof value === "string" ? value : null;
}

function normalizeStoredTaskDocument(
  taskId: string,
  value: unknown,
): StoredTaskDocument | null {
  const sanitized = sanitizeStoredErpResourceItemData(TASKS_RESOURCE_ID, value);
  const item = sanitized.item;

  if (!item) {
    return null;
  }

  const resolvedId = getTaskId(item);

  if (resolvedId !== taskId) {
    return null;
  }

  const candidate = value as Partial<StoredTaskDocument>;

  return {
    ...item,
    id: taskId,
    version: normalizeVersion(candidate.version),
    updatedAt: normalizeUpdatedAt(candidate.updatedAt),
  };
}

function normalizeDeletedTaskDocument(
  taskId: string,
  value: unknown,
): DeletedTaskDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<DeletedTaskDocument>;

  if (
    candidate.deleted !== true ||
    candidate.id !== taskId ||
    typeof candidate.deletedAt !== "string"
  ) {
    return null;
  }

  return {
    id: taskId,
    deleted: true,
    deletedAt: candidate.deletedAt,
    version: normalizeVersion(candidate.version),
    updatedAt: normalizeUpdatedAt(candidate.updatedAt),
  };
}

function normalizeStoredTaskEntry(
  taskId: string,
  value: unknown,
): TaskMergeEntry | null {
  const deletedTask = normalizeDeletedTaskDocument(taskId, value);

  if (deletedTask) {
    return {
      type: "deleted",
      task: deletedTask,
    };
  }

  const task = normalizeStoredTaskDocument(taskId, value);

  if (!task) {
    return null;
  }

  return {
    type: "task",
    task,
  };
}

function toStoredTaskEntry(entry: TaskMergeEntry): StoredTaskEntry {
  return entry.task;
}

function toTaskMergeEntry(document: StoredTaskEntry): TaskMergeEntry {
  if ("deleted" in document && document.deleted === true) {
    return {
      type: "deleted",
      task: document,
    };
  }

  return {
    type: "task",
    task: document,
  };
}

function normalizeFileItems(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, StoredTaskEntry>;
  }

  const items: Record<string, StoredTaskEntry> = {};

  for (const [taskId, candidate] of Object.entries(value)) {
    const normalized = normalizeStoredTaskEntry(taskId, candidate);

    if (normalized) {
      items[taskId] = toStoredTaskEntry(normalized);
    }
  }

  return items;
}

async function readTasksFileStore() {
  try {
    const raw = await readFile(getTasksFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        items: {},
      } satisfies Required<TasksFileStore>;
    }

    const value = parsed as TasksFileStore;

    return {
      items: normalizeFileItems(value.items),
    } satisfies Required<TasksFileStore>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        items: {},
      } satisfies Required<TasksFileStore>;
    }

    throw error;
  }
}

function sortTasks<TValue extends Pick<TaskItem, "shift" | "title">>(
  items: TValue[],
) {
  return [...items].sort((left, right) => {
    const byShift = left.shift.localeCompare(right.shift);
    return byShift === 0 ? left.title.localeCompare(right.title) : byShift;
  });
}

function areTaskPayloadsEqual(left: TaskItem, right: TaskItem) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toTaskPayload(task: TaskRecord | null): (TaskItem & { id: string }) | null {
  if (!task) {
    return null;
  }

  const payload = { ...task } as Partial<TaskRecord>;
  delete payload.version;
  delete payload.updatedAt;
  return payload as TaskItem & { id: string };
}

function validateTaskWritePayload(value: unknown, taskId?: string) {
  const normalized = validateErpResourceItemData(TASKS_RESOURCE_ID, value);
  const candidateId =
    typeof normalized.id === "string" && normalized.id.trim()
      ? normalizeTaskId(normalized.id)
      : undefined;

  if (taskId && candidateId && candidateId !== taskId) {
    throw new ErpResourceValidationError(
      "O id da tarefa precisa corresponder ao id da rota.",
    );
  }

  return {
    ...normalized,
    id: taskId ?? candidateId ?? getLegacyTaskId(normalized),
  };
}

function assertBaseVersion(
  current: TaskRecord | null,
  baseVersion: number,
): asserts current is TaskRecord {
  if (!Number.isInteger(baseVersion) || baseVersion < 1) {
    throw new ErpResourceValidationError(
      "Versao base invalida para a tarefa.",
    );
  }

  if (!current) {
    throw new TaskNotFoundError("Tarefa nao encontrada.");
  }

  if (current.version === baseVersion) {
    return;
  }

  throw new TaskConflictError(
    "A tarefa foi alterada por outra sessao. Recarregue os dados antes de salvar novamente.",
    current.version,
    current.updatedAt,
  );
}

function assertTaskWriteResult(
  value: TaskRecord | DeletedTaskDocument,
): asserts value is TaskRecord {
  if ("deleted" in value && value.deleted === true) {
    throw new Error("Operacao de tarefa retornou um marcador de exclusao inesperado.");
  }
}

function assertTaskDeleteResult(
  value: TaskRecord | DeletedTaskDocument,
): asserts value is DeletedTaskDocument {
  if (!("deleted" in value) || value.deleted !== true) {
    throw new Error("Operacao de exclusao da tarefa nao gerou marcador de exclusao.");
  }
}

function buildLegacyTaskRecord(
  task: TaskItem,
  updatedAt: string | null,
): TaskRecord {
  return {
    ...task,
    id: getTaskId(task),
    version: 1,
    updatedAt,
  };
}

async function readLegacyTasksSnapshot() {
  return readErpResource(TASKS_RESOURCE_ID);
}

function mergeTasks(
  itemizedEntries: readonly TaskMergeEntry[],
  legacyTasks: readonly TaskItem[],
  legacyUpdatedAt: string | null,
) {
  const merged = new Map<string, TaskRecord>();
  const deletedTaskIds = new Set<string>();

  for (const entry of itemizedEntries) {
    if (entry.type === "deleted") {
      deletedTaskIds.add(entry.task.id);
      merged.delete(entry.task.id);
      continue;
    }

    merged.set(entry.task.id, entry.task);
  }

  for (const legacyTask of legacyTasks) {
    const taskId = getTaskId(legacyTask);

    if (!deletedTaskIds.has(taskId) && !merged.has(taskId)) {
      merged.set(taskId, buildLegacyTaskRecord(legacyTask, legacyUpdatedAt));
    }
  }

  return sortTasks([...merged.values()]);
}

async function listFirebaseTasks() {
  const [snapshot, legacyResource] = await Promise.all([
    getFirebaseAdminDb()
      .collection<StoredTaskEntry>(TASKS_COLLECTION)
      .get(),
    readLegacyTasksSnapshot(),
  ]);

  const itemizedEntries = snapshot.docs
    .map((document) => normalizeStoredTaskEntry(document.id, document.data()))
    .filter((document): document is TaskMergeEntry => document !== null)
    .sort((left, right) => left.task.id.localeCompare(right.task.id));

  return mergeTasks(itemizedEntries, legacyResource.data, legacyResource.updatedAt);
}

async function listFileTasks() {
  const [store, legacyResource] = await Promise.all([
    readTasksFileStore(),
    readLegacyTasksSnapshot(),
  ]);

  return mergeTasks(
    Object.values(store.items)
      .map((document) => toTaskMergeEntry(document))
      .sort((left, right) => left.task.id.localeCompare(right.task.id)),
    legacyResource.data,
    legacyResource.updatedAt,
  );
}

function findLegacyTask(tasks: readonly TaskItem[], taskId: string) {
  return tasks.find((candidate) => getTaskId(candidate) === taskId);
}

async function readFirebaseTask(taskId: string): Promise<TaskRecordLookup> {
  const snapshot = await getFirebaseAdminDb()
    .collection<StoredTaskEntry>(TASKS_COLLECTION)
    .doc(taskId)
    .get();

  if (snapshot.exists) {
    const deletedTask = normalizeDeletedTaskDocument(taskId, snapshot.data());

    if (deletedTask) {
      return {
        task: null,
        exists: false,
      };
    }

    const task = normalizeStoredTaskDocument(taskId, snapshot.data());

    if (task) {
      return {
        task,
        exists: true,
      };
    }
  }

  const legacyResource = await readLegacyTasksSnapshot();
  const legacyTask = findLegacyTask(legacyResource.data, taskId);

  if (!legacyTask) {
    return {
      task: null,
      exists: false,
    };
  }

  return {
    task: buildLegacyTaskRecord(legacyTask, legacyResource.updatedAt),
    exists: true,
  };
}

async function readFileTask(taskId: string): Promise<TaskRecordLookup> {
  const store = await readTasksFileStore();
  const existingDocument = store.items[taskId] ?? null;

  if (existingDocument) {
    if ("deleted" in existingDocument && existingDocument.deleted === true) {
      return {
        task: null,
        exists: false,
      };
    }

    return {
      task: existingDocument,
      exists: true,
    };
  }

  const legacyResource = await readLegacyTasksSnapshot();
  const legacyTask = findLegacyTask(legacyResource.data, taskId);

  if (!legacyTask) {
    return {
      task: null,
      exists: false,
    };
  }

  return {
    task: buildLegacyTaskRecord(legacyTask, legacyResource.updatedAt),
    exists: true,
  };
}

async function writeFirebaseTask(
  taskId: string,
  update: (current: TaskRecord | null) => Promise<TaskMutationResult>,
) {
  const database = getFirebaseAdminDb();
  const legacyResource = await readLegacyTasksSnapshot();
  const legacyTask = findLegacyTask(legacyResource.data, taskId);
  const collectionRef = database.collection<StoredTaskEntry>(TASKS_COLLECTION);
  const documentRef = collectionRef.doc(taskId);

  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(documentRef);
    const deletedTask = snapshot.exists
      ? normalizeDeletedTaskDocument(taskId, snapshot.data())
      : null;
    const current = snapshot.exists
      ? deletedTask
        ? null
        : normalizeStoredTaskDocument(taskId, snapshot.data())
      : legacyTask
        ? buildLegacyTaskRecord(legacyTask, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    const now = new Date().toISOString();

    if (next.type === "delete") {
      const deletedTaskRecord: DeletedTaskDocument = {
        id: taskId,
        deleted: true,
        deletedAt: now,
        version: next.value.version + 1,
        updatedAt: now,
      };

      transaction.set(documentRef, deletedTaskRecord, { merge: false });
      return deletedTaskRecord;
    }

    const nextDocument: StoredTaskDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
      updatedAt: now,
    };

    transaction.set(documentRef, nextDocument, { merge: false });
    return nextDocument;
  });
}

async function writeFileTask(
  taskId: string,
  update: (current: TaskRecord | null) => Promise<TaskMutationResult>,
) {
  return queueFileWrite(async () => {
    const filePath = getTasksFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });

    const [store, legacyResource] = await Promise.all([
      readTasksFileStore(),
      readLegacyTasksSnapshot(),
    ]);
    const legacyTask = findLegacyTask(legacyResource.data, taskId);
    const existingDocument = store.items[taskId] ?? null;
    const current: TaskRecord | null = existingDocument
      ? "deleted" in existingDocument && existingDocument.deleted === true
        ? null
        : existingDocument
      : legacyTask
        ? buildLegacyTaskRecord(legacyTask, legacyResource.updatedAt)
        : null;
    const next = await update(current);

    if (next.type === "noop") {
      return next.value;
    }

    const now = new Date().toISOString();

    if (next.type === "delete") {
      const deletedTaskRecord: DeletedTaskDocument = {
        id: taskId,
        deleted: true,
        deletedAt: now,
        version: next.value.version + 1,
        updatedAt: now,
      };

      store.items[taskId] = deletedTaskRecord;
      await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
      return deletedTaskRecord;
    }

    const nextDocument: StoredTaskDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
      updatedAt: now,
    };

    store.items[taskId] = nextDocument;
    await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
    return nextDocument;
  });
}

async function writeTask(
  taskId: string,
  update: (current: TaskRecord | null) => Promise<TaskMutationResult>,
) {
  if (getTasksPersistenceProvider() === "firebase") {
    return writeFirebaseTask(taskId, update);
  }

  return writeFileTask(taskId, update);
}

export function getTasksPersistenceProvider() {
  return getServerPersistenceProvider("tarefas");
}

export async function listTasks(): Promise<ListTasksResult> {
  const items =
    getTasksPersistenceProvider() === "firebase"
      ? await listFirebaseTasks()
      : await listFileTasks();

  return {
    items,
    count: items.length,
  };
}

export async function getTaskById(taskId: string) {
  const result =
    getTasksPersistenceProvider() === "firebase"
      ? await readFirebaseTask(taskId)
      : await readFileTask(taskId);

  if (!result.exists || !result.task) {
    throw new TaskNotFoundError("Tarefa nao encontrada.");
  }

  return result.task;
}

export async function createTask(task: unknown): Promise<TaskRecord> {
  const normalized = validateTaskWritePayload(task);

  const createdTask = await writeTask(normalized.id, async (current) => {
    if (current) {
      throw new ErpResourceValidationError(
        "Ja existe uma tarefa com o id informado.",
        409,
      );
    }

    return {
      type: "set",
      value: normalized,
    };
  });

  assertTaskWriteResult(createdTask);
  return createdTask;
}

export async function updateTask(
  taskId: string,
  taskPatch: unknown,
  options: UpdateTaskOptions,
) {
  const updatedTask = await writeTask(taskId, async (current) => {
    assertBaseVersion(current, options.baseVersion);

    if (!taskPatch || typeof taskPatch !== "object" || Array.isArray(taskPatch)) {
      throw new ErpResourceValidationError("Carga invalida para a tarefa.");
    }

    const candidateId = (taskPatch as { id?: unknown }).id;

    if (
      candidateId !== undefined &&
      (typeof candidateId !== "string" ||
        normalizeTaskId(candidateId) !== taskId)
    ) {
      throw new ErpResourceValidationError(
        "O id da tarefa precisa corresponder ao id da rota.",
      );
    }

    const merged = validateTaskWritePayload(
      {
        ...toTaskPayload(current),
        ...taskPatch,
        id: taskId,
      },
      taskId,
    );

    const currentPayload = toTaskPayload(current);

    if (currentPayload && areTaskPayloadsEqual(currentPayload, merged)) {
      return {
        type: "noop",
        value: current,
      } satisfies TaskMutationResult;
    }

    return {
      type: "set",
      value: merged,
    } satisfies TaskMutationResult;
  });

  assertTaskWriteResult(updatedTask);
  return updatedTask;
}

export async function deleteTask(
  taskId: string,
  baseVersion: number,
): Promise<DeleteTaskResult> {
  const deletedTask = await writeTask(taskId, async (current) => {
    assertBaseVersion(current, baseVersion);

    return {
      type: "delete",
      value: current,
    } satisfies TaskMutationResult;
  });

  assertTaskDeleteResult(deletedTask);

  return {
    id: deletedTask.id,
    version: deletedTask.version,
    deletedAt: deletedTask.deletedAt,
  };
}
