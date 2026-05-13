import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  NOTIFICATION_STATUS_OPTIONS,
  NOTIFICATION_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
} from "@/lib/operations-data";
import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import {
  getNotificationById,
  createNotification,
  deleteNotification,
  listNotifications,
  NotificationConflictError,
  NotificationNotFoundError,
  updateNotification,
} from "@/lib/server/notifications";
import {
  resetFirebaseAdminTestOverrides,
  setFirebaseAdminDbForTests,
} from "@/lib/server/firebase-admin";

import { FakeFirestoreAdminDb } from "./helpers/fake-firestore";

const ORIGINAL_ENV = { ...process.env };

const SAMPLE_NOTIFICATION = {
  title: "Aprovar janela do CD Sudeste",
  area: "Planejamento",
  priority: PRIORITY_OPTIONS[0],
  type: NOTIFICATION_TYPE_OPTIONS[1],
  status: NOTIFICATION_STATUS_OPTIONS[0],
};

const SAMPLE_SECOND_NOTIFICATION = {
  title: "Sincronizar monitoramento de lotes",
  area: "Qualidade",
  priority: PRIORITY_OPTIONS[1],
  type: NOTIFICATION_TYPE_OPTIONS[0],
  status: NOTIFICATION_STATUS_OPTIONS[1],
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

function seedLegacyNotificationsSnapshot(
  firestore: FakeFirestoreAdminDb,
  items: unknown[],
  updatedAt = "2026-05-01T10:00:00.000Z",
) {
  firestore.seed("erpState", "operations.notifications", {
    resource: "operations.notifications",
    data: items,
    updatedAt,
    version: 3,
  });
}

describe("notifications item store", () => {
  beforeEach(() => {
    restoreProcessEnv();
    process.env.NODE_ENV = "test";
    resetFirebaseAdminTestOverrides();
  });

  afterEach(() => {
    restoreProcessEnv();
    resetFirebaseAdminTestOverrides();
  });

  it("lists legacy snapshot notifications with deterministic ids", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyNotificationsSnapshot(firestore, [SAMPLE_NOTIFICATION]);

    const payload = await listNotifications();
    const item = payload.items[0];

    assert.equal(payload.count, 1);
    assert.ok(item);
    assert.match(item.id, /^notification_[a-f0-9]{16}$/);
    assert.equal(item.version, 1);
    assert.equal(item.updatedAt, "2026-05-01T10:00:00.000Z");
    assert.equal(
      (await getNotificationById(item.id)).title,
      SAMPLE_NOTIFICATION.title,
    );
    assert.equal(firestore.read("notifications", item.id), null);
  });

  it("updates a legacy snapshot notification through the itemized store without removing snapshot fallback", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyNotificationsSnapshot(firestore, [
      SAMPLE_NOTIFICATION,
      SAMPLE_SECOND_NOTIFICATION,
    ]);
    const legacyItem = (await listNotifications()).items.find(
      (item) => item.title === SAMPLE_NOTIFICATION.title,
    );

    assert.ok(legacyItem);

    const updated = await updateNotification(
      legacyItem.id,
      {
        status: NOTIFICATION_STATUS_OPTIONS[2],
      },
      {
        baseVersion: 1,
      },
    );
    const loaded = await getNotificationById(legacyItem.id);
    const payload = await listNotifications();

    assert.equal(updated.version, 2);
    assert.equal(updated.status, NOTIFICATION_STATUS_OPTIONS[2]);
    assert.equal(loaded.version, 2);
    assert.equal(
      firestore.read("notifications", legacyItem.id)?.status,
      NOTIFICATION_STATUS_OPTIONS[2],
    );
    assert.equal(payload.count, 2);
    assert.equal(
      payload.items.find((item) => item.id === legacyItem.id)?.version,
      2,
    );
  });

  it("creates a notification directly in the item store with version 1", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createNotification(SAMPLE_NOTIFICATION);
    const loaded = await getNotificationById(created.id);

    assert.match(created.id, /^notification_[a-f0-9]{16}$/);
    assert.equal(created.version, 1);
    assert.equal(loaded.version, 1);
    assert.equal(
      firestore.read("notifications", created.id)?.title,
      SAMPLE_NOTIFICATION.title,
    );
  });

  it("returns conflict when updating an itemized notification with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("notifications", "notification_manual", {
      ...SAMPLE_NOTIFICATION,
      id: "notification_manual",
      updatedAt: "2026-05-01T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () =>
        updateNotification(
          "notification_manual",
          {
            status: NOTIFICATION_STATUS_OPTIONS[1],
          },
          {
            baseVersion: 2,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof NotificationConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });

  it("rejects payloads that try to change the notification id", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("notifications", "notification_manual", {
      ...SAMPLE_NOTIFICATION,
      id: "notification_manual",
      updatedAt: "2026-05-01T11:00:00.000Z",
      version: 1,
    });

    await assert.rejects(
      () =>
        updateNotification(
          "notification_manual",
          {
            id: "notification_other",
          },
          {
            baseVersion: 1,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof ErpResourceValidationError);
        assert.match(error.message, /id da notificacao precisa corresponder/i);
        return true;
      },
    );
  });

  it("deletes a legacy snapshot notification through a tombstone without reappearing in hybrid reads", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyNotificationsSnapshot(firestore, [
      SAMPLE_NOTIFICATION,
      SAMPLE_SECOND_NOTIFICATION,
    ]);
    const legacyItem = (await listNotifications()).items.find(
      (item) => item.title === SAMPLE_NOTIFICATION.title,
    );

    assert.ok(legacyItem);

    const deleted = await deleteNotification(legacyItem.id, 1);
    const payload = await listNotifications();

    assert.equal(deleted.id, legacyItem.id);
    assert.equal(deleted.version, 2);
    assert.equal(firestore.read("notifications", legacyItem.id)?.deleted, true);
    assert.equal(payload.count, 1);
    assert.equal(payload.items[0]?.title, SAMPLE_SECOND_NOTIFICATION.title);
    await assert.rejects(
      () => getNotificationById(legacyItem.id),
      NotificationNotFoundError,
    );
  });

  it("returns conflict when deleting a notification with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("notifications", "notification_manual", {
      ...SAMPLE_NOTIFICATION,
      id: "notification_manual",
      updatedAt: "2026-05-01T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () => deleteNotification("notification_manual", 2),
      (error: unknown) => {
        assert.ok(error instanceof NotificationConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });
});
