import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { DISTRIBUTOR_STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/lib/operations-data";
import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import {
  createDistributor,
  deleteDistributor,
  DistributorConflictError,
  DistributorNotFoundError,
  getDistributorById,
  listDistributors,
  updateDistributor,
} from "@/lib/server/distributors";
import {
  resetFirebaseAdminTestOverrides,
  setFirebaseAdminDbForTests,
} from "@/lib/server/firebase-admin";

import { FakeFirestoreAdminDb } from "./helpers/fake-firestore";

const ORIGINAL_ENV = { ...process.env };

const SAMPLE_DISTRIBUTOR = {
  name: "Distribuidora Pet Sul",
  region: "Sul",
  channel: "Especializado",
  priority: PRIORITY_OPTIONS[0],
  lastSupply: "Hoje, 08:50",
  status: DISTRIBUTOR_STATUS_OPTIONS[0],
};

const SAMPLE_SECOND_DISTRIBUTOR = {
  name: "Distribuidora Centro Oeste",
  region: "Centro-Oeste",
  channel: "Atacado",
  priority: PRIORITY_OPTIONS[1],
  lastSupply: "Ontem, 17:30",
  status: DISTRIBUTOR_STATUS_OPTIONS[1],
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

function seedLegacyDistributorsSnapshot(
  firestore: FakeFirestoreAdminDb,
  items: unknown[],
  updatedAt = "2026-05-02T10:00:00.000Z",
) {
  firestore.seed("erpState", "operations.distributors", {
    resource: "operations.distributors",
    data: items,
    updatedAt,
    version: 3,
  });
}

describe("distributors item store", () => {
  beforeEach(() => {
    restoreProcessEnv();
    process.env.NODE_ENV = "test";
    resetFirebaseAdminTestOverrides();
  });

  afterEach(() => {
    restoreProcessEnv();
    resetFirebaseAdminTestOverrides();
  });

  it("lists legacy snapshot distributors with deterministic ids", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyDistributorsSnapshot(firestore, [SAMPLE_DISTRIBUTOR]);

    const payload = await listDistributors();
    const item = payload.items[0];

    assert.equal(payload.count, 1);
    assert.ok(item);
    assert.match(item.id, /^distributor_[a-f0-9]{16}$/);
    assert.equal(item.version, 1);
    assert.equal(item.updatedAt, "2026-05-02T10:00:00.000Z");
    assert.equal((await getDistributorById(item.id)).name, SAMPLE_DISTRIBUTOR.name);
    assert.equal(firestore.read("distributors", item.id), null);
  });

  it("updates a legacy snapshot distributor through the itemized store without removing snapshot fallback", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyDistributorsSnapshot(firestore, [
      SAMPLE_DISTRIBUTOR,
      SAMPLE_SECOND_DISTRIBUTOR,
    ]);
    const legacyItem = (await listDistributors()).items.find(
      (item) => item.name === SAMPLE_DISTRIBUTOR.name,
    );

    assert.ok(legacyItem);

    const updated = await updateDistributor(
      legacyItem.id,
      {
        lastSupply: "Hoje, 11:20",
      },
      {
        baseVersion: 1,
      },
    );
    const loaded = await getDistributorById(legacyItem.id);
    const payload = await listDistributors();

    assert.equal(updated.version, 2);
    assert.equal(updated.lastSupply, "Hoje, 11:20");
    assert.equal(loaded.version, 2);
    assert.equal(
      firestore.read("distributors", legacyItem.id)?.lastSupply,
      "Hoje, 11:20",
    );
    assert.equal(payload.count, 2);
    assert.equal(
      payload.items.find((item) => item.id === legacyItem.id)?.version,
      2,
    );
  });

  it("creates a distributor directly in the item store with version 1", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createDistributor(SAMPLE_DISTRIBUTOR);
    const loaded = await getDistributorById(created.id);

    assert.match(created.id, /^distributor_[a-f0-9]{16}$/);
    assert.equal(created.version, 1);
    assert.equal(loaded.version, 1);
    assert.equal(
      firestore.read("distributors", created.id)?.name,
      SAMPLE_DISTRIBUTOR.name,
    );
  });

  it("rejects create when another distributor already uses the same name", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyDistributorsSnapshot(firestore, [SAMPLE_DISTRIBUTOR]);

    await assert.rejects(
      () =>
        createDistributor({
          ...SAMPLE_SECOND_DISTRIBUTOR,
          name: SAMPLE_DISTRIBUTOR.name,
        }),
      (error: unknown) => {
        assert.ok(error instanceof ErpResourceValidationError);
        assert.match(error.message, /ja existe um distribuidor com esse nome/i);
        return true;
      },
    );
  });

  it("returns conflict when updating an itemized distributor with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("distributors", "distributor_manual", {
      ...SAMPLE_DISTRIBUTOR,
      id: "distributor_manual",
      updatedAt: "2026-05-02T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () =>
        updateDistributor(
          "distributor_manual",
          {
            channel: "Varejo",
          },
          {
            baseVersion: 2,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof DistributorConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });

  it("rejects payloads that try to change the distributor id", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("distributors", "distributor_manual", {
      ...SAMPLE_DISTRIBUTOR,
      id: "distributor_manual",
      updatedAt: "2026-05-02T11:00:00.000Z",
      version: 1,
    });

    await assert.rejects(
      () =>
        updateDistributor(
          "distributor_manual",
          {
            id: "distributor_other",
          },
          {
            baseVersion: 1,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof ErpResourceValidationError);
        assert.match(error.message, /id do distribuidor precisa corresponder/i);
        return true;
      },
    );
  });

  it("deletes a legacy snapshot distributor through a tombstone without reappearing in hybrid reads", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyDistributorsSnapshot(firestore, [
      SAMPLE_DISTRIBUTOR,
      SAMPLE_SECOND_DISTRIBUTOR,
    ]);
    const legacyItem = (await listDistributors()).items.find(
      (item) => item.name === SAMPLE_DISTRIBUTOR.name,
    );

    assert.ok(legacyItem);

    const deleted = await deleteDistributor(legacyItem.id, 1);
    const payload = await listDistributors();

    assert.equal(deleted.id, legacyItem.id);
    assert.equal(deleted.version, 2);
    assert.equal(firestore.read("distributors", legacyItem.id)?.deleted, true);
    assert.equal(payload.count, 1);
    assert.equal(payload.items[0]?.name, SAMPLE_SECOND_DISTRIBUTOR.name);
    await assert.rejects(
      () => getDistributorById(legacyItem.id),
      DistributorNotFoundError,
    );
  });

  it("returns conflict when deleting a distributor with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("distributors", "distributor_manual", {
      ...SAMPLE_DISTRIBUTOR,
      id: "distributor_manual",
      updatedAt: "2026-05-02T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () => deleteDistributor("distributor_manual", 2),
      (error: unknown) => {
        assert.ok(error instanceof DistributorConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });
});
