import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { InventoryLotNotFoundError } from "@/lib/server/inventory-lots";
import {
  getLotLocationMismatchPayload,
  listLotLocationMismatchPayloads,
} from "@/lib/server/stock-lots";
import {
  resetFirebaseAdminTestOverrides,
  setFirebaseAdminDbForTests,
} from "@/lib/server/firebase-admin";

import { FakeFirestoreAdminDb } from "./helpers/fake-firestore";

const ORIGINAL_ENV = { ...process.env };

const SAMPLE_LOT_CODE = "LOT-STOCK-ROUTE-001";
const SAMPLE_PRODUCT = "PremieR Formula Caes Adultos Porte Mini";
const SAMPLE_PRODUCT_ID = "PF-AD-MINI-25";

const LEGACY_LOT = {
  code: SAMPLE_LOT_CODE,
  product: SAMPLE_PRODUCT,
  productId: SAMPLE_PRODUCT_ID,
  locationId: "complexo-industrial-dourado",
  location: "Complexo Industrial Dourado",
  expiration: "2026-12-31",
  quantity: 120,
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
) {
  firestore.seed("erpState", "operations.lots", {
    resource: "operations.lots",
    data: lots,
    updatedAt: "2026-05-01T10:00:00.000Z",
    version: 1,
  });
}

function seedMovement(
  firestore: FakeFirestoreAdminDb,
  lotCode: string,
  locationId: string,
) {
  firestore.seed("inventoryMovements", `mov-${lotCode}`, {
    id: `mov-${lotCode}`,
    product: SAMPLE_PRODUCT,
    productId: SAMPLE_PRODUCT_ID,
    lotCode,
    type: "entrada",
    quantity: 120,
    reason: "Entrada para derivacao de localizacao",
    user: "Time QA",
    createdAt: "2026-05-01T11:00:00.000Z",
    locationId,
    status: "concluida",
    version: 1,
    updatedAt: "2026-05-01T11:00:00.000Z",
  });
}

describe("stock lot location route helpers", () => {
  beforeEach(() => {
    restoreProcessEnv();
    process.env.NODE_ENV = "test";
    resetFirebaseAdminTestOverrides();
  });

  afterEach(() => {
    restoreProcessEnv();
    resetFirebaseAdminTestOverrides();
  });

  it("uses the itemized lot store instead of a stale legacy snapshot", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyLotsSnapshot(firestore, [LEGACY_LOT]);
    firestore.seed("inventoryLots", SAMPLE_LOT_CODE, {
      ...LEGACY_LOT,
      locationId: "cd-sudeste",
      location: "CD Sudeste",
      version: 2,
      updatedAt: "2026-05-01T10:30:00.000Z",
    });
    seedMovement(firestore, SAMPLE_LOT_CODE, "cd-sudeste");

    const payload = await getLotLocationMismatchPayload(SAMPLE_LOT_CODE);

    assert.deepEqual(payload, {
      stableLocationId: "cd-sudeste",
      inTransitToLocationId: null,
      confidence: "high",
      mismatch: false,
    });
  });

  it("does not resurrect a legacy lot when the item store has a tombstone", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyLotsSnapshot(firestore, [LEGACY_LOT]);
    firestore.seed("inventoryLots", SAMPLE_LOT_CODE, {
      code: SAMPLE_LOT_CODE,
      deleted: true,
      deletedAt: "2026-05-01T12:00:00.000Z",
      version: 2,
      updatedAt: "2026-05-01T12:00:00.000Z",
    });

    await assert.rejects(
      () => getLotLocationMismatchPayload(SAMPLE_LOT_CODE),
      InventoryLotNotFoundError,
    );
  });

  it("keeps the legacy fallback through the official lot store", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyLotsSnapshot(firestore, [LEGACY_LOT]);
    seedMovement(firestore, SAMPLE_LOT_CODE, LEGACY_LOT.locationId);

    const payload = await getLotLocationMismatchPayload(SAMPLE_LOT_CODE);

    assert.deepEqual(payload, {
      stableLocationId: LEGACY_LOT.locationId,
      inTransitToLocationId: null,
      confidence: "high",
      mismatch: false,
    });
  });

  it("returns batch derived locations without failing the whole request for tombstoned lots", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyLotsSnapshot(firestore, [
      LEGACY_LOT,
      {
        ...LEGACY_LOT,
        code: "LOT-STOCK-ROUTE-DELETED",
      },
    ]);
    firestore.seed("inventoryLots", "LOT-STOCK-ROUTE-DELETED", {
      code: "LOT-STOCK-ROUTE-DELETED",
      deleted: true,
      deletedAt: "2026-05-01T12:00:00.000Z",
      version: 2,
      updatedAt: "2026-05-01T12:00:00.000Z",
    });
    seedMovement(firestore, SAMPLE_LOT_CODE, LEGACY_LOT.locationId);

    const payload = await listLotLocationMismatchPayloads([
      SAMPLE_LOT_CODE,
      "LOT-STOCK-ROUTE-DELETED",
    ]);

    assert.equal(payload.items.length, 1);
    assert.equal(payload.items[0]?.lotCode, SAMPLE_LOT_CODE);
    assert.equal(payload.errors.length, 1);
    assert.equal(payload.errors[0]?.lotCode, "LOT-STOCK-ROUTE-DELETED");
  });

  it("returns partial errors for missing lots in the batch payload", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyLotsSnapshot(firestore, [LEGACY_LOT]);
    seedMovement(firestore, SAMPLE_LOT_CODE, LEGACY_LOT.locationId);

    const payload = await listLotLocationMismatchPayloads([
      SAMPLE_LOT_CODE,
      "LOT-STOCK-ROUTE-MISSING",
    ]);

    assert.equal(payload.items.length, 1);
    assert.equal(payload.items[0]?.lotCode, SAMPLE_LOT_CODE);
    assert.equal(payload.errors.length, 1);
    assert.equal(payload.errors[0]?.lotCode, "LOT-STOCK-ROUTE-MISSING");
  });
});
