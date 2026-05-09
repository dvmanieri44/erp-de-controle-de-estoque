import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createLocation,
  deleteLocation,
  getLocationById,
  InventoryLocationConflictError,
  InventoryLocationInUseError,
  InventoryLocationNotFoundError,
  listLocations,
  updateLocation,
} from "@/lib/server/inventory-locations";
import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import {
  resetFirebaseAdminTestOverrides,
  setFirebaseAdminDbForTests,
} from "@/lib/server/firebase-admin";

import { FakeFirestoreAdminDb } from "./helpers/fake-firestore";

const ORIGINAL_ENV = { ...process.env };

const SAMPLE_LOCATION = {
  id: "cd-sudeste",
  name: "CD Sudeste",
  type: "Centro de Distribuição" as const,
  address: "Jundiai - SP",
  manager: "Carlos Menezes",
  capacityTotal: 180000,
  status: "Ativa" as const,
};

const SAMPLE_NEW_LOCATION = {
  id: "hub-nordeste",
  name: "Hub Nordeste",
  type: "Centro de Distribuição" as const,
  address: "Recife - PE",
  manager: "Luciana Prado",
  capacityTotal: 95000,
  status: "Ativa" as const,
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

function seedLegacyLocationsSnapshot(
  firestore: FakeFirestoreAdminDb,
  locations: unknown[],
  updatedAt = "2026-04-29T10:00:00.000Z",
) {
  firestore.seed("erpState", "inventory.locations", {
    resource: "inventory.locations",
    data: locations,
    updatedAt,
    version: 3,
  });
}

describe("inventory locations item store", () => {
  beforeEach(() => {
    restoreProcessEnv();
    process.env.NODE_ENV = "test";
    resetFirebaseAdminTestOverrides();
  });

  afterEach(() => {
    restoreProcessEnv();
    resetFirebaseAdminTestOverrides();
  });

  it("lists legacy snapshot locations when no itemized documents exist yet", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyLocationsSnapshot(firestore, [SAMPLE_LOCATION]);

    const payload = await listLocations();
    const loadedLocation = await getLocationById(SAMPLE_LOCATION.id);

    assert.equal(payload.count, 1);
    assert.equal(payload.items[0]?.id, SAMPLE_LOCATION.id);
    assert.equal(payload.items[0]?.version, 1);
    assert.equal(payload.items[0]?.updatedAt, "2026-04-29T10:00:00.000Z");
    assert.equal(loadedLocation.id, SAMPLE_LOCATION.id);
    assert.equal(loadedLocation.version, 1);
    assert.equal(
      firestore.read("inventoryLocations", SAMPLE_LOCATION.id),
      null,
    );
  });

  it("updates a legacy snapshot location through the itemized store without removing snapshot fallback", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyLocationsSnapshot(firestore, [
      SAMPLE_LOCATION,
      {
        ...SAMPLE_LOCATION,
        id: "quality-hold",
        name: "Quality Hold",
        type: "Qualidade",
      },
    ]);

    const updated = await updateLocation(
      SAMPLE_LOCATION.id,
      {
        manager: "Marina Azevedo",
        capacityTotal: 200000,
      },
      {
        baseVersion: 1,
      },
    );
    const loaded = await getLocationById(SAMPLE_LOCATION.id);
    const payload = await listLocations();

    assert.equal(updated.version, 2);
    assert.equal(updated.manager, "Marina Azevedo");
    assert.equal(updated.capacityTotal, 200000);
    assert.equal(loaded.version, 2);
    assert.equal(loaded.manager, "Marina Azevedo");
    assert.equal(
      firestore.read("inventoryLocations", SAMPLE_LOCATION.id)?.manager,
      "Marina Azevedo",
    );
    assert.equal(payload.count, 2);
    assert.equal(
      payload.items.find((item) => item.id === SAMPLE_LOCATION.id)?.version,
      2,
    );
    assert.equal(
      payload.items.find((item) => item.id === "quality-hold")?.version,
      1,
    );
  });

  it("creates a location directly in the item store with version 1", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createLocation(SAMPLE_NEW_LOCATION);
    const loaded = await getLocationById(SAMPLE_NEW_LOCATION.id);

    assert.equal(created.version, 1);
    assert.equal(loaded.version, 1);
    assert.equal(
      firestore.read("inventoryLocations", SAMPLE_NEW_LOCATION.id)?.id,
      SAMPLE_NEW_LOCATION.id,
    );
  });

  it("returns conflict when updating an itemized location with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("inventoryLocations", SAMPLE_LOCATION.id, {
      ...SAMPLE_LOCATION,
      updatedAt: "2026-04-29T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () =>
        updateLocation(
          SAMPLE_LOCATION.id,
          {
            manager: "Fernanda Rocha",
          },
          {
            baseVersion: 2,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof InventoryLocationConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });

  it("rejects payloads that try to change the location id", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyLocationsSnapshot(firestore, [SAMPLE_LOCATION]);

    await assert.rejects(
      () =>
        updateLocation(
          SAMPLE_LOCATION.id,
          {
            id: "localizacao-alterada",
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

  it("deletes a legacy snapshot location through a tombstone without reappearing in hybrid reads", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyLocationsSnapshot(firestore, [
      SAMPLE_LOCATION,
      SAMPLE_NEW_LOCATION,
    ]);

    const deleted = await deleteLocation(SAMPLE_NEW_LOCATION.id, 1);
    const payload = await listLocations();

    assert.equal(deleted.id, SAMPLE_NEW_LOCATION.id);
    assert.equal(deleted.version, 2);
    assert.equal(
      firestore.read("inventoryLocations", SAMPLE_NEW_LOCATION.id)?.deleted,
      true,
    );
    assert.equal(payload.count, 1);
    assert.equal(payload.items[0]?.id, SAMPLE_LOCATION.id);
    await assert.rejects(
      () => getLocationById(SAMPLE_NEW_LOCATION.id),
      InventoryLocationNotFoundError,
    );
  });

  it("returns conflict when deleting a location with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("inventoryLocations", SAMPLE_LOCATION.id, {
      ...SAMPLE_LOCATION,
      updatedAt: "2026-04-29T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () => deleteLocation(SAMPLE_LOCATION.id, 2),
      (error: unknown) => {
        assert.ok(error instanceof InventoryLocationConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });

  it("blocks deleting locations referenced by movements or active stock", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyLocationsSnapshot(firestore, [SAMPLE_LOCATION]);
    firestore.seed("inventoryMovements", "mov-cd-sudeste", {
      id: "mov-cd-sudeste",
      product: "Produto Teste",
      type: "entrada",
      quantity: 10,
      reason: "Entrada inicial",
      user: "Operador",
      createdAt: "2026-04-29T12:00:00.000Z",
      locationId: SAMPLE_LOCATION.id,
      status: "concluida",
      version: 1,
    });

    await assert.rejects(
      () => deleteLocation(SAMPLE_LOCATION.id, 1),
      (error: unknown) => {
        assert.ok(error instanceof InventoryLocationInUseError);
        assert.ok(error.reasons.includes("MOVEMENTS"));
        assert.ok(error.reasons.includes("ACTIVE_STOCK"));
        return true;
      },
    );
  });

  it("blocks deleting locations referenced by lots", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyLocationsSnapshot(firestore, [SAMPLE_LOCATION]);
    firestore.seed("erpState", "operations.lots", {
      resource: "operations.lots",
      data: [
        {
          code: "LOT-CD-001",
          product: "Produto Teste",
          locationId: SAMPLE_LOCATION.id,
          location: SAMPLE_LOCATION.name,
          expiration: "2026-12-31",
          quantity: 10,
          status: "Liberado",
        },
      ],
      updatedAt: "2026-04-29T10:00:00.000Z",
      version: 1,
    });

    await assert.rejects(
      () => deleteLocation(SAMPLE_LOCATION.id, 1),
      (error: unknown) => {
        assert.ok(error instanceof InventoryLocationInUseError);
        assert.ok(error.reasons.includes("LOTS"));
        return true;
      },
    );
  });
});
