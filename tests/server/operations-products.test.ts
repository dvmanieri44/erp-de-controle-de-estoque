import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { PRODUCT_LINES } from "@/lib/operations-data";
import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import {
  createProduct,
  deleteProduct,
  getProductBySku,
  listProducts,
  OperationsProductConflictError,
  OperationsProductInUseError,
  OperationsProductNotFoundError,
  updateProduct,
} from "@/lib/server/operations-products";
import {
  resetFirebaseAdminTestOverrides,
  setFirebaseAdminDbForTests,
} from "@/lib/server/firebase-admin";

import { FakeFirestoreAdminDb } from "./helpers/fake-firestore";

const ORIGINAL_ENV = { ...process.env };

const SAMPLE_PRODUCT = {
  sku: "PF-AD-MINI-25",
  product: "PremieR Formula Caes Adultos Porte Mini",
  line: "PremieR Formula",
  species: PRODUCT_LINES[0]!.species,
  stage: "Adulto",
  package: "2,5 kg",
  stock: 18400,
  target: 24000,
  coverageDays: 12,
  status: PRODUCT_LINES[0]!.status,
};

const SAMPLE_NEW_PRODUCT = {
  sku: "TEST-PROD-001",
  product: "Produto Teste Itemizado",
  line: "PremieR Formula",
  species: PRODUCT_LINES[2]!.species,
  stage: "Filhote",
  package: "15 kg",
  stock: 7200,
  target: 14000,
  coverageDays: 6,
  status: PRODUCT_LINES[2]!.status,
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

function seedLegacyProductsSnapshot(
  firestore: FakeFirestoreAdminDb,
  products: unknown[],
  updatedAt = "2026-04-29T10:00:00.000Z",
) {
  firestore.seed("erpState", "operations.products", {
    resource: "operations.products",
    data: products,
    updatedAt,
    version: 3,
  });
}

describe("operations products item store", () => {
  beforeEach(() => {
    restoreProcessEnv();
    process.env.NODE_ENV = "test";
    resetFirebaseAdminTestOverrides();
  });

  afterEach(() => {
    restoreProcessEnv();
    resetFirebaseAdminTestOverrides();
  });

  it("lists legacy snapshot products when no itemized documents exist yet", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyProductsSnapshot(firestore, [SAMPLE_PRODUCT]);

    const payload = await listProducts();
    const loadedProduct = await getProductBySku(SAMPLE_PRODUCT.sku);

    assert.equal(payload.count, 1);
    assert.equal(payload.items[0]?.sku, SAMPLE_PRODUCT.sku);
    assert.equal(payload.items[0]?.version, 1);
    assert.equal(payload.items[0]?.updatedAt, "2026-04-29T10:00:00.000Z");
    assert.equal(loadedProduct.sku, SAMPLE_PRODUCT.sku);
    assert.equal(loadedProduct.version, 1);
    assert.equal(
      firestore.read("operationsProducts", SAMPLE_PRODUCT.sku),
      null,
    );
  });

  it("updates a legacy snapshot product through the itemized store without removing snapshot fallback", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyProductsSnapshot(firestore, [
      SAMPLE_PRODUCT,
      SAMPLE_NEW_PRODUCT,
    ]);

    const updated = await updateProduct(
      SAMPLE_PRODUCT.sku,
      {
        stock: 19000,
        target: 25000,
      },
      1,
    );
    const loaded = await getProductBySku(SAMPLE_PRODUCT.sku);
    const payload = await listProducts();

    assert.equal(updated.version, 2);
    assert.equal(updated.stock, 19000);
    assert.equal(updated.target, 25000);
    assert.equal(loaded.version, 2);
    assert.equal(loaded.stock, 19000);
    assert.equal(
      firestore.read("operationsProducts", SAMPLE_PRODUCT.sku)?.stock,
      19000,
    );
    assert.equal(payload.count, 2);
    assert.equal(
      payload.items.find((product) => product.sku === SAMPLE_PRODUCT.sku)?.version,
      2,
    );
    assert.equal(
      payload.items.find((product) => product.sku === SAMPLE_NEW_PRODUCT.sku)?.version,
      1,
    );
  });

  it("creates a product directly in the item store with version 1 and normalized sku", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createProduct({
      ...SAMPLE_NEW_PRODUCT,
      sku: "test-prod-001",
    });
    const loaded = await getProductBySku("test-prod-001");

    assert.equal(created.version, 1);
    assert.equal(created.sku, SAMPLE_NEW_PRODUCT.sku);
    assert.equal(loaded.version, 1);
    assert.equal(
      firestore.read("operationsProducts", SAMPLE_NEW_PRODUCT.sku)?.sku,
      SAMPLE_NEW_PRODUCT.sku,
    );
  });

  it("rejects create when sku already exists in the legacy snapshot", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyProductsSnapshot(firestore, [SAMPLE_PRODUCT]);

    await assert.rejects(
      () => createProduct(SAMPLE_PRODUCT),
      (error: unknown) => {
        assert.ok(error instanceof ErpResourceValidationError);
        assert.equal(error.status, 409);
        return true;
      },
    );
  });

  it("returns conflict when updating an itemized product with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("operationsProducts", SAMPLE_PRODUCT.sku, {
      ...SAMPLE_PRODUCT,
      updatedAt: "2026-04-29T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () =>
        updateProduct(
          SAMPLE_PRODUCT.sku,
          {
            stock: 19500,
          },
          2,
        ),
      (error: unknown) => {
        assert.ok(error instanceof OperationsProductConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });

  it("rejects payloads that try to change the product sku", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyProductsSnapshot(firestore, [SAMPLE_PRODUCT]);

    await assert.rejects(
      () =>
        updateProduct(
          SAMPLE_PRODUCT.sku,
          {
            sku: "SKU-ALTERADO",
          },
          1,
        ),
      (error: unknown) => {
        assert.ok(error instanceof ErpResourceValidationError);
        assert.match(error.message, /sku da rota/i);
        return true;
      },
    );
  });

  it("deletes a legacy snapshot product through a tombstone without reappearing in hybrid reads", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyProductsSnapshot(firestore, [
      SAMPLE_PRODUCT,
      SAMPLE_NEW_PRODUCT,
    ]);

    const deleted = await deleteProduct(SAMPLE_NEW_PRODUCT.sku, 1);
    const payload = await listProducts();

    assert.equal(deleted.sku, SAMPLE_NEW_PRODUCT.sku);
    assert.equal(deleted.version, 2);
    assert.equal(
      firestore.read("operationsProducts", SAMPLE_NEW_PRODUCT.sku)?.deleted,
      true,
    );
    assert.equal(payload.count, 1);
    assert.equal(payload.items[0]?.sku, SAMPLE_PRODUCT.sku);
    await assert.rejects(
      () => getProductBySku(SAMPLE_NEW_PRODUCT.sku),
      OperationsProductNotFoundError,
    );
  });

  it("returns conflict when deleting a product with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("operationsProducts", SAMPLE_PRODUCT.sku, {
      ...SAMPLE_PRODUCT,
      updatedAt: "2026-04-29T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () => deleteProduct(SAMPLE_PRODUCT.sku, 2),
      (error: unknown) => {
        assert.ok(error instanceof OperationsProductConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });

  it("blocks deleting products referenced by movements", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("operationsProducts", SAMPLE_NEW_PRODUCT.sku, {
      ...SAMPLE_NEW_PRODUCT,
      updatedAt: "2026-04-29T11:00:00.000Z",
      version: 1,
    });
    firestore.seed("inventoryMovements", "mov-produto-teste", {
      id: "mov-produto-teste",
      product: SAMPLE_NEW_PRODUCT.product,
      productId: SAMPLE_NEW_PRODUCT.sku,
      type: "entrada",
      quantity: 10,
      reason: "Entrada inicial",
      user: "Operador",
      createdAt: "2026-04-29T12:00:00.000Z",
      locationId: "cd-sudeste",
      status: "concluida",
      version: 1,
    });

    await assert.rejects(
      () => deleteProduct(SAMPLE_NEW_PRODUCT.sku, 1),
      (error: unknown) => {
        assert.ok(error instanceof OperationsProductInUseError);
        assert.ok(error.reasons.includes("MOVEMENTS"));
        return true;
      },
    );
  });

  it("blocks deleting products referenced by lots", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("operationsProducts", SAMPLE_NEW_PRODUCT.sku, {
      ...SAMPLE_NEW_PRODUCT,
      updatedAt: "2026-04-29T11:00:00.000Z",
      version: 1,
    });
    firestore.seed("erpState", "operations.lots", {
      resource: "operations.lots",
      data: [
        {
          code: "LOT-PROD-001",
          product: SAMPLE_NEW_PRODUCT.product,
          productId: SAMPLE_NEW_PRODUCT.sku,
          location: "CD Sudeste",
          expiration: "2026-12-31",
          quantity: 10,
          status: "Liberado",
        },
      ],
      updatedAt: "2026-04-29T10:00:00.000Z",
      version: 1,
    });

    await assert.rejects(
      () => deleteProduct(SAMPLE_NEW_PRODUCT.sku, 1),
      (error: unknown) => {
        assert.ok(error instanceof OperationsProductInUseError);
        assert.ok(error.reasons.includes("LOTS"));
        return true;
      },
    );
  });
});
