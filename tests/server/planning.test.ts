import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { PRIORITY_OPTIONS } from "@/lib/operations-data";
import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import {
  createPlanningItem,
  deletePlanningItem,
  getPlanningItemById,
  listPlanningItems,
  PlanningConflictError,
  PlanningNotFoundError,
  updatePlanningItem,
} from "@/lib/server/planning";
import {
  resetFirebaseAdminTestOverrides,
  setFirebaseAdminDbForTests,
} from "@/lib/server/firebase-admin";

import { FakeFirestoreAdminDb } from "./helpers/fake-firestore";

const ORIGINAL_ENV = { ...process.env };

const SAMPLE_PLANNING_ITEM = {
  route: "Dourado -> CD Sudeste",
  window: "Hoje, 18:00",
  priority: PRIORITY_OPTIONS[0],
  demand: 12000,
  coverage: "Cobertura projetada de 8 dias",
};

const SAMPLE_SECOND_PLANNING_ITEM = {
  route: "Matriz -> Hub Sul",
  window: "Amanha, 08:00",
  priority: PRIORITY_OPTIONS[1],
  demand: 5400,
  coverage: "Cobertura projetada de 5 dias",
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

function seedLegacyPlanningSnapshot(
  firestore: FakeFirestoreAdminDb,
  items: unknown[],
  updatedAt = "2026-05-02T10:00:00.000Z",
) {
  firestore.seed("erpState", "operations.planning", {
    resource: "operations.planning",
    data: items,
    updatedAt,
    version: 3,
  });
}

describe("planning item store", () => {
  beforeEach(() => {
    restoreProcessEnv();
    process.env.NODE_ENV = "test";
    resetFirebaseAdminTestOverrides();
  });

  afterEach(() => {
    restoreProcessEnv();
    resetFirebaseAdminTestOverrides();
  });

  it("lists legacy snapshot planning items with deterministic ids", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyPlanningSnapshot(firestore, [SAMPLE_PLANNING_ITEM]);

    const payload = await listPlanningItems();
    const item = payload.items[0];

    assert.equal(payload.count, 1);
    assert.ok(item);
    assert.match(item.id, /^planning_[a-f0-9]{16}$/);
    assert.equal(item.version, 1);
    assert.equal(item.updatedAt, "2026-05-02T10:00:00.000Z");
    assert.equal(
      (await getPlanningItemById(item.id)).route,
      SAMPLE_PLANNING_ITEM.route,
    );
    assert.equal(firestore.read("planning", item.id), null);
  });

  it("updates a legacy snapshot planning item through the itemized store without removing snapshot fallback", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyPlanningSnapshot(firestore, [
      SAMPLE_PLANNING_ITEM,
      SAMPLE_SECOND_PLANNING_ITEM,
    ]);
    const legacyItem = (await listPlanningItems()).items.find(
      (item) => item.route === SAMPLE_PLANNING_ITEM.route,
    );

    assert.ok(legacyItem);

    const updated = await updatePlanningItem(
      legacyItem.id,
      {
        demand: 15000,
      },
      {
        baseVersion: 1,
      },
    );
    const loaded = await getPlanningItemById(legacyItem.id);
    const payload = await listPlanningItems();

    assert.equal(updated.version, 2);
    assert.equal(updated.demand, 15000);
    assert.equal(loaded.version, 2);
    assert.equal(firestore.read("planning", legacyItem.id)?.demand, 15000);
    assert.equal(payload.count, 2);
    assert.equal(
      payload.items.find((item) => item.id === legacyItem.id)?.version,
      2,
    );
  });

  it("creates a planning item directly in the item store with version 1", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createPlanningItem(SAMPLE_PLANNING_ITEM);
    const loaded = await getPlanningItemById(created.id);

    assert.match(created.id, /^planning_[a-f0-9]{16}$/);
    assert.equal(created.version, 1);
    assert.equal(loaded.version, 1);
    assert.equal(
      firestore.read("planning", created.id)?.route,
      SAMPLE_PLANNING_ITEM.route,
    );
  });

  it("rejects create when another planning item already uses the same route", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyPlanningSnapshot(firestore, [SAMPLE_PLANNING_ITEM]);

    await assert.rejects(
      () =>
        createPlanningItem({
          ...SAMPLE_SECOND_PLANNING_ITEM,
          route: SAMPLE_PLANNING_ITEM.route,
        }),
      (error: unknown) => {
        assert.ok(error instanceof ErpResourceValidationError);
        assert.match(error.message, /ja existe um planejamento com essa rota/i);
        return true;
      },
    );
  });

  it("returns conflict when updating an itemized planning item with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("planning", "planning_manual", {
      ...SAMPLE_PLANNING_ITEM,
      id: "planning_manual",
      updatedAt: "2026-05-02T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () =>
        updatePlanningItem(
          "planning_manual",
          {
            demand: 1000,
          },
          {
            baseVersion: 2,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof PlanningConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });

  it("rejects payloads that try to change the planning id", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("planning", "planning_manual", {
      ...SAMPLE_PLANNING_ITEM,
      id: "planning_manual",
      updatedAt: "2026-05-02T11:00:00.000Z",
      version: 1,
    });

    await assert.rejects(
      () =>
        updatePlanningItem(
          "planning_manual",
          {
            id: "planning_other",
          },
          {
            baseVersion: 1,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof ErpResourceValidationError);
        assert.match(error.message, /id do planejamento precisa corresponder/i);
        return true;
      },
    );
  });

  it("deletes a legacy snapshot planning item through a tombstone without reappearing in hybrid reads", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyPlanningSnapshot(firestore, [
      SAMPLE_PLANNING_ITEM,
      SAMPLE_SECOND_PLANNING_ITEM,
    ]);
    const legacyItem = (await listPlanningItems()).items.find(
      (item) => item.route === SAMPLE_PLANNING_ITEM.route,
    );

    assert.ok(legacyItem);

    const deleted = await deletePlanningItem(legacyItem.id, 1);
    const payload = await listPlanningItems();

    assert.equal(deleted.id, legacyItem.id);
    assert.equal(deleted.version, 2);
    assert.equal(firestore.read("planning", legacyItem.id)?.deleted, true);
    assert.equal(payload.count, 1);
    assert.equal(payload.items[0]?.route, SAMPLE_SECOND_PLANNING_ITEM.route);
    await assert.rejects(
      () => getPlanningItemById(legacyItem.id),
      PlanningNotFoundError,
    );
  });

  it("returns conflict when deleting a planning item with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("planning", "planning_manual", {
      ...SAMPLE_PLANNING_ITEM,
      id: "planning_manual",
      updatedAt: "2026-05-02T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () => deletePlanningItem("planning_manual", 2),
      (error: unknown) => {
        assert.ok(error instanceof PlanningConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });
});
