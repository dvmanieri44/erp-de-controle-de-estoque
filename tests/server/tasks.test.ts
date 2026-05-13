import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import {
  resetFirebaseAdminTestOverrides,
  setFirebaseAdminDbForTests,
} from "@/lib/server/firebase-admin";
import {
  createTask,
  deleteTask,
  getTaskById,
  listTasks,
  TaskConflictError,
  TaskNotFoundError,
  updateTask,
} from "@/lib/server/tasks";
import { TASK_STATUS_OPTIONS } from "@/lib/operations-data";

import { FakeFirestoreAdminDb } from "./helpers/fake-firestore";

const ORIGINAL_ENV = { ...process.env };

const SAMPLE_TASK = {
  title: "Conferencia de pallets itemizada",
  shift: "Turno A",
  owner: "Diego Paiva",
  checklist: 8,
  completed: 3,
  status: TASK_STATUS_OPTIONS[1],
};

const SAMPLE_SECOND_TASK = {
  title: "Checklist de limpeza itemizado",
  shift: "Turno B",
  owner: "Fernanda Rocha",
  checklist: 6,
  completed: 6,
  status: TASK_STATUS_OPTIONS[2],
};

function restoreProcessEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function seedLegacyTasksSnapshot(
  firestore: FakeFirestoreAdminDb,
  tasks: unknown[],
  updatedAt = "2026-04-30T10:00:00.000Z",
) {
  firestore.seed("erpState", "operations.tasks", {
    resource: "operations.tasks",
    data: tasks,
    updatedAt,
    version: 3,
  });
}

describe("tasks item store", () => {
  beforeEach(() => {
    restoreProcessEnv();
    process.env.NODE_ENV = "test";
    resetFirebaseAdminTestOverrides();
  });

  afterEach(() => {
    restoreProcessEnv();
    resetFirebaseAdminTestOverrides();
  });

  it("lists legacy snapshot tasks with deterministic ids", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyTasksSnapshot(firestore, [SAMPLE_TASK]);

    const payload = await listTasks();
    const task = payload.items[0];

    assert.equal(payload.count, 1);
    assert.ok(task);
    assert.match(task.id, /^task_[a-f0-9]{16}$/);
    assert.equal(task.version, 1);
    assert.equal(task.updatedAt, "2026-04-30T10:00:00.000Z");
    assert.equal((await getTaskById(task.id)).title, SAMPLE_TASK.title);
    assert.equal(firestore.read("tasks", task.id), null);
  });

  it("updates a legacy snapshot task through the itemized store without removing snapshot fallback", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyTasksSnapshot(firestore, [SAMPLE_TASK, SAMPLE_SECOND_TASK]);
    const legacyTask = (await listTasks()).items.find(
      (task) => task.title === SAMPLE_TASK.title,
    );

    assert.ok(legacyTask);

    const updated = await updateTask(
      legacyTask.id,
      {
        completed: 8,
        status: TASK_STATUS_OPTIONS[2],
      },
      {
        baseVersion: 1,
      },
    );
    const loaded = await getTaskById(legacyTask.id);
    const payload = await listTasks();

    assert.equal(updated.version, 2);
    assert.equal(updated.completed, 8);
    assert.equal(updated.status, TASK_STATUS_OPTIONS[2]);
    assert.equal(loaded.version, 2);
    assert.equal(firestore.read("tasks", legacyTask.id)?.completed, 8);
    assert.equal(payload.count, 2);
    assert.equal(
      payload.items.find((task) => task.id === legacyTask.id)?.version,
      2,
    );
    assert.equal(
      payload.items.find((task) => task.title === SAMPLE_SECOND_TASK.title)
        ?.version,
      1,
    );
  });

  it("creates a task directly in the item store with version 1", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createTask(SAMPLE_TASK);
    const loaded = await getTaskById(created.id);

    assert.match(created.id, /^task_[a-f0-9]{16}$/);
    assert.equal(created.version, 1);
    assert.equal(loaded.version, 1);
    assert.equal(firestore.read("tasks", created.id)?.title, SAMPLE_TASK.title);
  });

  it("returns conflict when updating an itemized task with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("tasks", "task_manual", {
      ...SAMPLE_TASK,
      id: "task_manual",
      updatedAt: "2026-04-30T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () =>
        updateTask(
          "task_manual",
          {
            completed: 4,
          },
          {
            baseVersion: 2,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof TaskConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });

  it("rejects payloads that try to change the task id", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("tasks", "task_manual", {
      ...SAMPLE_TASK,
      id: "task_manual",
      updatedAt: "2026-04-30T11:00:00.000Z",
      version: 1,
    });

    await assert.rejects(
      () =>
        updateTask(
          "task_manual",
          {
            id: "task_outro",
          },
          {
            baseVersion: 1,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof ErpResourceValidationError);
        assert.match(error.message, /id da rota/i);
        return true;
      },
    );
  });

  it("deletes a legacy snapshot task through a tombstone without reappearing in hybrid reads", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyTasksSnapshot(firestore, [SAMPLE_TASK, SAMPLE_SECOND_TASK]);
    const legacyTask = (await listTasks()).items.find(
      (task) => task.title === SAMPLE_TASK.title,
    );

    assert.ok(legacyTask);

    const deleted = await deleteTask(legacyTask.id, 1);
    const payload = await listTasks();

    assert.equal(deleted.id, legacyTask.id);
    assert.equal(deleted.version, 2);
    assert.equal(firestore.read("tasks", legacyTask.id)?.deleted, true);
    assert.equal(payload.count, 1);
    assert.equal(payload.items[0]?.title, SAMPLE_SECOND_TASK.title);
    await assert.rejects(() => getTaskById(legacyTask.id), TaskNotFoundError);
  });

  it("returns conflict when deleting a task with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("tasks", "task_manual", {
      ...SAMPLE_TASK,
      id: "task_manual",
      updatedAt: "2026-04-30T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () => deleteTask("task_manual", 2),
      (error: unknown) => {
        assert.ok(error instanceof TaskConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });
});
