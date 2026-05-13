import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import {
  CategoryConflictError,
  CategoryNotFoundError,
  createCategory,
  deleteCategory,
  getCategoryById,
  listCategories,
  updateCategory,
} from "@/lib/server/categories";
import {
  resetFirebaseAdminTestOverrides,
  setFirebaseAdminDbForTests,
} from "@/lib/server/firebase-admin";

import { FakeFirestoreAdminDb } from "./helpers/fake-firestore";

const ORIGINAL_ENV = { ...process.env };

const SAMPLE_CATEGORY = {
  name: "Super Premium Caes",
  portfolio: "PremieR Formula",
  skus: 42,
  share: "38%",
  focus: "Sustenta o mix de maior margem e maior cobertura comercial.",
};

const SAMPLE_SECOND_CATEGORY = {
  name: "Premium Gatos",
  portfolio: "Golden",
  skus: 18,
  share: "16%",
  focus: "Complementa o portfolio felino com giro recorrente.",
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

function seedLegacyCategoriesSnapshot(
  firestore: FakeFirestoreAdminDb,
  items: unknown[],
  updatedAt = "2026-05-02T10:00:00.000Z",
) {
  firestore.seed("erpState", "operations.categories", {
    resource: "operations.categories",
    data: items,
    updatedAt,
    version: 3,
  });
}

describe("categories item store", () => {
  beforeEach(() => {
    restoreProcessEnv();
    process.env.NODE_ENV = "test";
    resetFirebaseAdminTestOverrides();
  });

  afterEach(() => {
    restoreProcessEnv();
    resetFirebaseAdminTestOverrides();
  });

  it("lists legacy snapshot categories with deterministic ids", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyCategoriesSnapshot(firestore, [SAMPLE_CATEGORY]);

    const payload = await listCategories();
    const item = payload.items[0];

    assert.equal(payload.count, 1);
    assert.ok(item);
    assert.match(item.id, /^category_[a-f0-9]{16}$/);
    assert.equal(item.version, 1);
    assert.equal(item.updatedAt, "2026-05-02T10:00:00.000Z");
    assert.equal((await getCategoryById(item.id)).name, SAMPLE_CATEGORY.name);
    assert.equal(firestore.read("categories", item.id), null);
  });

  it("updates a legacy snapshot category through the itemized store without removing snapshot fallback", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyCategoriesSnapshot(firestore, [
      SAMPLE_CATEGORY,
      SAMPLE_SECOND_CATEGORY,
    ]);
    const legacyItem = (await listCategories()).items.find(
      (item) => item.name === SAMPLE_CATEGORY.name,
    );

    assert.ok(legacyItem);

    const updated = await updateCategory(
      legacyItem.id,
      {
        share: "41%",
      },
      {
        baseVersion: 1,
      },
    );
    const loaded = await getCategoryById(legacyItem.id);
    const payload = await listCategories();

    assert.equal(updated.version, 2);
    assert.equal(updated.share, "41%");
    assert.equal(loaded.version, 2);
    assert.equal(
      firestore.read("categories", legacyItem.id)?.share,
      "41%",
    );
    assert.equal(payload.count, 2);
    assert.equal(
      payload.items.find((item) => item.id === legacyItem.id)?.version,
      2,
    );
  });

  it("creates a category directly in the item store with version 1", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createCategory(SAMPLE_CATEGORY);
    const loaded = await getCategoryById(created.id);

    assert.match(created.id, /^category_[a-f0-9]{16}$/);
    assert.equal(created.version, 1);
    assert.equal(loaded.version, 1);
    assert.equal(
      firestore.read("categories", created.id)?.name,
      SAMPLE_CATEGORY.name,
    );
  });

  it("rejects create when another category already uses the same name", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyCategoriesSnapshot(firestore, [SAMPLE_CATEGORY]);

    await assert.rejects(
      () =>
        createCategory({
          ...SAMPLE_SECOND_CATEGORY,
          name: SAMPLE_CATEGORY.name,
        }),
      (error: unknown) => {
        assert.ok(error instanceof ErpResourceValidationError);
        assert.match(error.message, /ja existe uma categoria com esse nome/i);
        return true;
      },
    );
  });

  it("returns conflict when updating an itemized category with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("categories", "category_manual", {
      ...SAMPLE_CATEGORY,
      id: "category_manual",
      updatedAt: "2026-05-02T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () =>
        updateCategory(
          "category_manual",
          {
            portfolio: "PremieR Selecao Natural",
          },
          {
            baseVersion: 2,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof CategoryConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });

  it("rejects payloads that try to change the category id", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("categories", "category_manual", {
      ...SAMPLE_CATEGORY,
      id: "category_manual",
      updatedAt: "2026-05-02T11:00:00.000Z",
      version: 1,
    });

    await assert.rejects(
      () =>
        updateCategory(
          "category_manual",
          {
            id: "category_other",
          },
          {
            baseVersion: 1,
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof ErpResourceValidationError);
        assert.match(error.message, /id da categoria precisa corresponder/i);
        return true;
      },
    );
  });

  it("deletes a legacy snapshot category through a tombstone without reappearing in hybrid reads", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    seedLegacyCategoriesSnapshot(firestore, [
      SAMPLE_CATEGORY,
      SAMPLE_SECOND_CATEGORY,
    ]);
    const legacyItem = (await listCategories()).items.find(
      (item) => item.name === SAMPLE_CATEGORY.name,
    );

    assert.ok(legacyItem);

    const deleted = await deleteCategory(legacyItem.id, 1);
    const payload = await listCategories();

    assert.equal(deleted.id, legacyItem.id);
    assert.equal(deleted.version, 2);
    assert.equal(firestore.read("categories", legacyItem.id)?.deleted, true);
    assert.equal(payload.count, 1);
    assert.equal(payload.items[0]?.name, SAMPLE_SECOND_CATEGORY.name);
    await assert.rejects(
      () => getCategoryById(legacyItem.id),
      CategoryNotFoundError,
    );
  });

  it("returns conflict when deleting a category with an outdated baseVersion", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("categories", "category_manual", {
      ...SAMPLE_CATEGORY,
      id: "category_manual",
      updatedAt: "2026-05-02T11:00:00.000Z",
      version: 3,
    });

    await assert.rejects(
      () => deleteCategory("category_manual", 2),
      (error: unknown) => {
        assert.ok(error instanceof CategoryConflictError);
        assert.equal(error.currentVersion, 3);
        return true;
      },
    );
  });
});
