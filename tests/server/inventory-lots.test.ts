import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createLot,
  deleteLot,
  getLotByCode,
  InventoryLotConflictError,
  InventoryLotInUseError,
  listLots,
  updateLot,
  InventoryLotNotFoundError,
} from "@/lib/server/inventory-lots";
import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import {
  resetFirebaseAdminTestOverrides,
  setFirebaseAdminDbForTests,
} from "@/lib/server/firebase-admin";

import { FakeFirestoreAdminDb } from "./helpers/fake-firestore";

const ORIGINAL_ENV = { ...process.env };

const SAMPLE_LOT = {
  code: "LOT-ITEM-001",
  product: "PremieR Formula Caes Adultos Porte Mini",
  productId: "PF-AD-MINI-25",
  locationId: "complexo-industrial-dourado",
  location: "Complexo Industrial Dourado",
  expiration: "2026-12-31",
  quantity: 1200,
  status: "Liberado" as const,
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

function seedLegacyLotsSnapshot(
  firestore: FakeFirestoreAdminDb,
  lots: unknown[],
  updatedAt = "2026-04-27T10:00:00.000Z",
) {
  firestore.seed("erpState", "operations.lots", {
    resource: "operations.lots",
    data: lots,
    updatedAt,
    version: 3,
  });
}

describe("inventory lots item store", () => {
  beforeEach(() => {
    restoreProcessEnv();
    process.env.NODE_ENV = "test";
    resetFirebaseAdminTestOverrides();
  });

  afterEach(() => {
    restoreProcessEnv();
    resetFirebaseAdminTestOverrides();
  });

  it("lists legacy snapshot lots when no itemized documents exist yet", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyLotsSnapshot(firestore, [SAMPLE_LOT]);

    const payload = await listLots();
    const loadedLot = await getLotByCode(SAMPLE_LOT.code);

    assert.equal(payload.count, 1);
    assert.equal(payload.items[0]?.code, SAMPLE_LOT.code);
    assert.equal(payload.items[0]?.version, 1);
    assert.equal(payload.items[0]?.updatedAt, "2026-04-27T10:00:00.000Z");
    assert.equal(loadedLot.code, SAMPLE_LOT.code);
    assert.equal(loadedLot.version, 1);
    assert.equal(firestore.read("inventoryLots", SAMPLE_LOT.code), null);
  });

  it("updates a legacy snapshot lot through the itemized store without removing snapshot fallback", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyLotsSnapshot(firestore, [
      SAMPLE_LOT,
      {
        ...SAMPLE_LOT,
        code: "LOT-LEGADO-002",
      },
    ]);

    const updated = await updateLot(
      SAMPLE_LOT.code,
      {
        locationId: "cd-sudeste",
        location: "CD Sudeste",
        quantity: 900,
      },
      {
        baseVersion: 1,
      },
    );
    const loaded = await getLotByCode(SAMPLE_LOT.code);
    const payload = await listLots();

    assert.equal(updated.version, 2);
    assert.equal(updated.locationId, "cd-sudeste");
    assert.equal(updated.location, "CD Sudeste");
    assert.equal(updated.quantity, 900);
    assert.equal(loaded.version, 2);
    assert.equal(loaded.locationId, "cd-sudeste");
    assert.equal(
      firestore.read("inventoryLots", SAMPLE_LOT.code)?.locationId,
      "cd-sudeste",
    );
    assert.equal(payload.count, 2);
    assert.equal(
      payload.items.find((lot) => lot.code === SAMPLE_LOT.code)?.version,
      2,
    );
    assert.equal(
      payload.items.find((lot) => lot.code === "LOT-LEGADO-002")?.version,
      1,
    );
  });

  it("creates a lot directly in the item store with version 1", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createLot(SAMPLE_LOT);
    const loaded = await getLotByCode(SAMPLE_LOT.code);

    assert.equal(created.version, 1);
    assert.equal(loaded.version, 1);
    assert.equal(
      firestore.read("inventoryLots", SAMPLE_LOT.code)?.code,
      SAMPLE_LOT.code,
    );
  });

  it("returns conflict when updating an itemized lot with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("inventoryLots", SAMPLE_LOT.code, {
      ...SAMPLE_LOT,
      updatedAt: "2026-04-27T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () =>
        updateLot(
          SAMPLE_LOT.code,
          {
            quantity: 800,
          },
          {
            baseVersion: 2,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof InventoryLotConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });

  it("rejects payloads that try to change the lot code", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyLotsSnapshot(firestore, [SAMPLE_LOT]);

    await assert.rejects(
      () =>
        updateLot(
          SAMPLE_LOT.code,
          {
            code: "LOT-ALTERADO",
          },
          {
            baseVersion: 1,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof ErpResourceValidationError);
        assert.match(error.message, /code da rota/i);
        return true;
      },
    );
  });

  it("deletes a legacy snapshot lot through a tombstone without reappearing in hybrid reads", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyLotsSnapshot(firestore, [
      SAMPLE_LOT,
      {
        ...SAMPLE_LOT,
        code: "LOT-LEGADO-002",
      },
    ]);

    const deleted = await deleteLot(SAMPLE_LOT.code, 1);
    const payload = await listLots();

    assert.equal(deleted.code, SAMPLE_LOT.code);
    assert.equal(deleted.version, 2);
    assert.equal(
      firestore.read("inventoryLots", SAMPLE_LOT.code)?.deleted,
      true,
    );
    assert.equal(payload.count, 1);
    assert.equal(payload.items[0]?.code, "LOT-LEGADO-002");
    await assert.rejects(
      () => getLotByCode(SAMPLE_LOT.code),
      InventoryLotNotFoundError,
    );
  });

  it("returns conflict when deleting a lot with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("inventoryLots", SAMPLE_LOT.code, {
      ...SAMPLE_LOT,
      updatedAt: "2026-04-29T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () => deleteLot(SAMPLE_LOT.code, 2),
      (error: unknown) => {
        assert.ok(error instanceof InventoryLotConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });

  it("blocks deleting lots referenced by movements", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("inventoryLots", SAMPLE_LOT.code, {
      ...SAMPLE_LOT,
      updatedAt: "2026-04-29T11:00:00.000Z",
      version: 1,
    });
    firestore.seed("inventoryMovements", "mov-lote-teste", {
      id: "mov-lote-teste",
      product: SAMPLE_LOT.product,
      productId: SAMPLE_LOT.productId,
      lotCode: SAMPLE_LOT.code,
      type: "entrada",
      quantity: 10,
      reason: "Entrada inicial",
      user: "Operador",
      createdAt: "2026-04-29T12:00:00.000Z",
      locationId: SAMPLE_LOT.locationId,
      status: "concluida",
      version: 1,
    });

    await assert.rejects(
      () => deleteLot(SAMPLE_LOT.code, 1),
      (error: unknown) => {
        assert.ok(error instanceof InventoryLotInUseError);
        assert.ok(error.reasons.includes("MOVEMENTS"));
        return true;
      },
    );
  });
});
