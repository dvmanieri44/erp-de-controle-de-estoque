import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { SUPPLIER_STATUS_OPTIONS } from "@/lib/operations-data";
import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import {
  createSupplier,
  deleteSupplier,
  getSupplierById,
  listSuppliers,
  SupplierConflictError,
  SupplierNotFoundError,
  updateSupplier,
} from "@/lib/server/suppliers";
import {
  resetFirebaseAdminTestOverrides,
  setFirebaseAdminDbForTests,
} from "@/lib/server/firebase-admin";

import { FakeFirestoreAdminDb } from "./helpers/fake-firestore";

const ORIGINAL_ENV = { ...process.env };

const SAMPLE_SUPPLIER = {
  name: "PackFlex Embalagens",
  category: "Embalagens",
  city: "Campinas/SP",
  leadTimeDays: 7,
  score: 89,
  status: SUPPLIER_STATUS_OPTIONS[0],
};

const SAMPLE_SECOND_SUPPLIER = {
  name: "Ingredion Mix Brasil",
  category: "Ingredientes",
  city: "Sorocaba/SP",
  leadTimeDays: 10,
  score: 76,
  status: SUPPLIER_STATUS_OPTIONS[1],
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

function seedLegacySuppliersSnapshot(
  firestore: FakeFirestoreAdminDb,
  items: unknown[],
  updatedAt = "2026-05-02T10:00:00.000Z",
) {
  firestore.seed("erpState", "operations.suppliers", {
    resource: "operations.suppliers",
    data: items,
    updatedAt,
    version: 3,
  });
}

describe("suppliers item store", () => {
  beforeEach(() => {
    restoreProcessEnv();
    process.env.NODE_ENV = "test";
    resetFirebaseAdminTestOverrides();
  });

  afterEach(() => {
    restoreProcessEnv();
    resetFirebaseAdminTestOverrides();
  });

  it("lists legacy snapshot suppliers with deterministic ids", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacySuppliersSnapshot(firestore, [SAMPLE_SUPPLIER]);

    const payload = await listSuppliers();
    const item = payload.items[0];

    assert.equal(payload.count, 1);
    assert.ok(item);
    assert.match(item.id, /^supplier_[a-f0-9]{16}$/);
    assert.equal(item.version, 1);
    assert.equal(item.updatedAt, "2026-05-02T10:00:00.000Z");
    assert.equal((await getSupplierById(item.id)).name, SAMPLE_SUPPLIER.name);
    assert.equal(firestore.read("suppliers", item.id), null);
  });

  it("updates a legacy snapshot supplier through the itemized store without removing snapshot fallback", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacySuppliersSnapshot(firestore, [
      SAMPLE_SUPPLIER,
      SAMPLE_SECOND_SUPPLIER,
    ]);
    const legacyItem = (await listSuppliers()).items.find(
      (item) => item.name === SAMPLE_SUPPLIER.name,
    );

    assert.ok(legacyItem);

    const updated = await updateSupplier(
      legacyItem.id,
      {
        score: 92,
      },
      {
        baseVersion: 1,
      },
    );
    const loaded = await getSupplierById(legacyItem.id);
    const payload = await listSuppliers();

    assert.equal(updated.version, 2);
    assert.equal(updated.score, 92);
    assert.equal(loaded.version, 2);
    assert.equal(
      firestore.read("suppliers", legacyItem.id)?.score,
      92,
    );
    assert.equal(payload.count, 2);
    assert.equal(
      payload.items.find((item) => item.id === legacyItem.id)?.version,
      2,
    );
  });

  it("creates a supplier directly in the item store with version 1", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createSupplier(SAMPLE_SUPPLIER);
    const loaded = await getSupplierById(created.id);

    assert.match(created.id, /^supplier_[a-f0-9]{16}$/);
    assert.equal(created.version, 1);
    assert.equal(loaded.version, 1);
    assert.equal(
      firestore.read("suppliers", created.id)?.name,
      SAMPLE_SUPPLIER.name,
    );
  });

  it("rejects create when another supplier already uses the same name", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacySuppliersSnapshot(firestore, [SAMPLE_SUPPLIER]);

    await assert.rejects(
      () =>
        createSupplier({
          ...SAMPLE_SECOND_SUPPLIER,
          name: SAMPLE_SUPPLIER.name,
        }),
      (error: unknown) => {
        assert.ok(error instanceof ErpResourceValidationError);
        assert.match(error.message, /ja existe um fornecedor com esse nome/i);
        return true;
      },
    );
  });

  it("returns conflict when updating an itemized supplier with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("suppliers", "supplier_manual", {
      ...SAMPLE_SUPPLIER,
      id: "supplier_manual",
      updatedAt: "2026-05-02T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () =>
        updateSupplier(
          "supplier_manual",
          {
            city: "Jundiai/SP",
          },
          {
            baseVersion: 2,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof SupplierConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });

  it("rejects payloads that try to change the supplier id", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("suppliers", "supplier_manual", {
      ...SAMPLE_SUPPLIER,
      id: "supplier_manual",
      updatedAt: "2026-05-02T11:00:00.000Z",
      version: 1,
    });

    await assert.rejects(
      () =>
        updateSupplier(
          "supplier_manual",
          {
            id: "supplier_other",
          },
          {
            baseVersion: 1,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof ErpResourceValidationError);
        assert.match(error.message, /id do fornecedor precisa corresponder/i);
        return true;
      },
    );
  });

  it("deletes a legacy snapshot supplier through a tombstone without reappearing in hybrid reads", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacySuppliersSnapshot(firestore, [
      SAMPLE_SUPPLIER,
      SAMPLE_SECOND_SUPPLIER,
    ]);
    const legacyItem = (await listSuppliers()).items.find(
      (item) => item.name === SAMPLE_SUPPLIER.name,
    );

    assert.ok(legacyItem);

    const deleted = await deleteSupplier(legacyItem.id, 1);
    const payload = await listSuppliers();

    assert.equal(deleted.id, legacyItem.id);
    assert.equal(deleted.version, 2);
    assert.equal(firestore.read("suppliers", legacyItem.id)?.deleted, true);
    assert.equal(payload.count, 1);
    assert.equal(payload.items[0]?.name, SAMPLE_SECOND_SUPPLIER.name);
    await assert.rejects(
      () => getSupplierById(legacyItem.id),
      SupplierNotFoundError,
    );
  });

  it("returns conflict when deleting a supplier with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("suppliers", "supplier_manual", {
      ...SAMPLE_SUPPLIER,
      id: "supplier_manual",
      updatedAt: "2026-05-02T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () => deleteSupplier("supplier_manual", 2),
      (error: unknown) => {
        assert.ok(error instanceof SupplierConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });
});
