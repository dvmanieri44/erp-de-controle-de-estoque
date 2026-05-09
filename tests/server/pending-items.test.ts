import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import {
  resetFirebaseAdminTestOverrides,
  setFirebaseAdminDbForTests,
} from "@/lib/server/firebase-admin";
import {
  createPendingItem,
  deletePendingItem,
  getPendingItemById,
  listPendingItems,
  PendingConflictError,
  PendingNotFoundError,
  updatePendingItem,
} from "@/lib/server/pending-items";
import { PENDING_ITEMS } from "@/lib/operations-data";

import { FakeFirestoreAdminDb } from "./helpers/fake-firestore";

const ORIGINAL_ENV = { ...process.env };

const SAMPLE_PENDING_ITEM = {
  title: "Confirmar recebimento itemizado",
  owner: "Carlos Menezes",
  area: "CD Sudeste",
  due: "Hoje, 17:30",
  priority: PENDING_ITEMS[0]!.priority,
};

const SAMPLE_SECOND_PENDING_ITEM = {
  title: "Liberar reanalise itemizada",
  owner: "Luciana Prado",
  area: "Qualidade",
  due: "Hoje, 14:00",
  priority: PENDING_ITEMS[1]!.priority,
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

function seedLegacyPendingSnapshot(
  firestore: FakeFirestoreAdminDb,
  items: unknown[],
  updatedAt = "2026-04-30T10:00:00.000Z",
) {
  firestore.seed("erpState", "operations.pending", {
    resource: "operations.pending",
    data: items,
    updatedAt,
    version: 3,
  });
}

describe("pending item store", () => {
  beforeEach(() => {
    restoreProcessEnv();
    process.env.NODE_ENV = "test";
    resetFirebaseAdminTestOverrides();
  });

  afterEach(() => {
    restoreProcessEnv();
    resetFirebaseAdminTestOverrides();
  });

  it("lists legacy snapshot pending items with deterministic ids", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyPendingSnapshot(firestore, [SAMPLE_PENDING_ITEM]);

    const payload = await listPendingItems();
    const item = payload.items[0];

    assert.equal(payload.count, 1);
    assert.ok(item);
    assert.match(item.id, /^pending_[a-f0-9]{16}$/);
    assert.equal(item.version, 1);
    assert.equal(item.updatedAt, "2026-04-30T10:00:00.000Z");
    assert.equal((await getPendingItemById(item.id)).title, SAMPLE_PENDING_ITEM.title);
    assert.equal(firestore.read("pending", item.id), null);
  });

  it("updates a legacy snapshot pending item through the itemized store without removing snapshot fallback", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyPendingSnapshot(firestore, [
      SAMPLE_PENDING_ITEM,
      SAMPLE_SECOND_PENDING_ITEM,
    ]);
    const legacyItem = (await listPendingItems()).items.find(
      (item) => item.title === SAMPLE_PENDING_ITEM.title,
    );

    assert.ok(legacyItem);

    const updated = await updatePendingItem(
      legacyItem.id,
      {
        owner: "Marina Azevedo",
        priority: PENDING_ITEMS[2]!.priority,
      },
      {
        baseVersion: 1,
      },
    );
    const loaded = await getPendingItemById(legacyItem.id);
    const payload = await listPendingItems();

    assert.equal(updated.version, 2);
    assert.equal(updated.owner, "Marina Azevedo");
    assert.equal(updated.priority, PENDING_ITEMS[2]!.priority);
    assert.equal(loaded.version, 2);
    assert.equal(firestore.read("pending", legacyItem.id)?.owner, "Marina Azevedo");
    assert.equal(payload.count, 2);
    assert.equal(
      payload.items.find((item) => item.id === legacyItem.id)?.version,
      2,
    );
    assert.equal(
      payload.items.find(
        (item) => item.title === SAMPLE_SECOND_PENDING_ITEM.title,
      )?.version,
      1,
    );
  });

  it("creates a pending item directly in the item store with version 1", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createPendingItem(SAMPLE_PENDING_ITEM);
    const loaded = await getPendingItemById(created.id);

    assert.match(created.id, /^pending_[a-f0-9]{16}$/);
    assert.equal(created.version, 1);
    assert.equal(loaded.version, 1);
    assert.equal(
      firestore.read("pending", created.id)?.title,
      SAMPLE_PENDING_ITEM.title,
    );
  });

  it("returns conflict when updating an itemized pending item with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("pending", "pending_manual", {
      ...SAMPLE_PENDING_ITEM,
      id: "pending_manual",
      updatedAt: "2026-04-30T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () =>
        updatePendingItem(
          "pending_manual",
          {
            owner: "Outra pessoa",
          },
          {
            baseVersion: 2,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof PendingConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });

  it("rejects payloads that try to change the pending id", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("pending", "pending_manual", {
      ...SAMPLE_PENDING_ITEM,
      id: "pending_manual",
      updatedAt: "2026-04-30T11:00:00.000Z",
      version: 1,
    });

    await assert.rejects(
      () =>
        updatePendingItem(
          "pending_manual",
          {
            id: "pending_outro",
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

  it("deletes a legacy snapshot pending item through a tombstone without reappearing in hybrid reads", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyPendingSnapshot(firestore, [
      SAMPLE_PENDING_ITEM,
      SAMPLE_SECOND_PENDING_ITEM,
    ]);
    const legacyItem = (await listPendingItems()).items.find(
      (item) => item.title === SAMPLE_PENDING_ITEM.title,
    );

    assert.ok(legacyItem);

    const deleted = await deletePendingItem(legacyItem.id, 1);
    const payload = await listPendingItems();

    assert.equal(deleted.id, legacyItem.id);
    assert.equal(deleted.version, 2);
    assert.equal(firestore.read("pending", legacyItem.id)?.deleted, true);
    assert.equal(payload.count, 1);
    assert.equal(payload.items[0]?.title, SAMPLE_SECOND_PENDING_ITEM.title);
    await assert.rejects(
      () => getPendingItemById(legacyItem.id),
      PendingNotFoundError,
    );
  });

  it("returns conflict when deleting a pending item with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("pending", "pending_manual", {
      ...SAMPLE_PENDING_ITEM,
      id: "pending_manual",
      updatedAt: "2026-04-30T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () => deletePendingItem("pending_manual", 2),
      (error: unknown) => {
        assert.ok(error instanceof PendingConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });
});
