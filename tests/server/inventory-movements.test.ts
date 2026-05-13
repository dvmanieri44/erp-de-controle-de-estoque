import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { assertCanWriteErpResource } from "@/lib/server/erp-access-control";
import {
  calculateLocationStockBalances,
  createInventoryMovement,
  deleteOrCancelInventoryMovement,
  deriveLotLocation,
  detectLotLocationMismatch,
  getInventoryMovementById,
  InventoryMovementConflictError,
  InventoryMovementInvalidProductIdError,
  InventoryMovementInvalidLotCodeError,
  InventoryMovementInvalidLotLocationError,
  InventoryMovementInvalidLotProductError,
  listLocationStockBalances,
  listInventoryMovements,
  updateInventoryMovement,
} from "@/lib/server/inventory-movements";
import { ErpResourceValidationError } from "@/lib/server/erp-resource-schema";
import { writeErpResource } from "@/lib/server/erp-state";
import {
  resetFirebaseAdminTestOverrides,
  setFirebaseAdminDbForTests as setFirebaseAdminDbForTestsBase,
} from "@/lib/server/firebase-admin";
import {
  PRODUCT_SPECIES_OPTIONS,
  PRODUCT_STATUS_OPTIONS,
  type ProductLineItem,
} from "@/lib/operations-data";
import type { UserAccount } from "@/lib/user-accounts";

import { FakeFirestoreAdminDb } from "./helpers/fake-firestore";

const ORIGINAL_ENV = { ...process.env };

const SAMPLE_ADMIN_ACCOUNT: UserAccount = {
  id: "conta-admin-premierpet",
  name: "Joao Pedro Chiavoloni",
  username: "admin",
  email: "admin@premierpet.com.br",
  role: "administrador",
  unit: "Matriz Dourado",
  status: "ativo",
};

const SAMPLE_MOVEMENT = {
  id: "mov-test-entrada-001",
  product: "PremieR Formula Caes Adultos Porte Mini",
  productId: "PF-AD-MINI-25",
  type: "entrada" as const,
  quantity: 1200,
  reason: "Teste automatizado",
  user: "Time QA",
  createdAt: "2026-04-24T13:00:00.000Z",
  locationId: "complexo-industrial-dourado",
  status: "concluida" as const,
};

const SAMPLE_PRODUCT: ProductLineItem = {
  sku: SAMPLE_MOVEMENT.productId,
  product: SAMPLE_MOVEMENT.product,
  line: "Linha de teste",
  species: PRODUCT_SPECIES_OPTIONS[0]!,
  stage: "Adulto",
  package: "2,5 kg",
  stock: 0,
  target: 0,
  coverageDays: 0,
  status: PRODUCT_STATUS_OPTIONS[0]!,
};

const SAMPLE_CANONICAL_PRODUCT = SAMPLE_PRODUCT.product;
const SAMPLE_COMPATIBLE_LOT_WITH_PRODUCT_ID = {
  code: "LOT-COMPATIVEL-PRODUCT-ID",
  product: SAMPLE_CANONICAL_PRODUCT,
  productId: SAMPLE_MOVEMENT.productId,
  locationId: "complexo-industrial-dourado",
  location: "Complexo Industrial Dourado",
  expiration: "2026-12-31",
  quantity: 1500,
  status: "Liberado" as const,
};
const SAMPLE_INCOMPATIBLE_LOT_WITH_PRODUCT_ID = {
  ...SAMPLE_COMPATIBLE_LOT_WITH_PRODUCT_ID,
  code: "LOT-INCOMPATIVEL-PRODUCT-ID",
  productId: "GL-GC-SAL-101",
};
const SAMPLE_FALLBACK_LOT_WITHOUT_PRODUCT_ID = {
  code: "LOT-FALLBACK-POR-NOME",
  product: SAMPLE_CANONICAL_PRODUCT,
  location: "Complexo Industrial Dourado",
  expiration: "2026-12-30",
  quantity: 900,
  status: "Liberado" as const,
};
const SAMPLE_UNRESOLVABLE_LOT_WITHOUT_LOCATION_ID = {
  code: "LOT-SEM-GARANTIA-DE-LOCAL",
  product: SAMPLE_CANONICAL_PRODUCT,
  location: "Galpao Historico Antigo",
  expiration: "2026-12-29",
  quantity: 600,
  status: "Liberado" as const,
};

const EMPTY_LEGACY_MOVEMENTS_RESOURCE = {
  resource: "inventory.movements" as const,
  data: [],
  updatedAt: "2026-04-24T12:00:00.000Z",
  version: 0,
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

async function seedLotsResource(lots: unknown[]) {
  await writeErpResource("operations.lots", lots, { baseVersion: 0 });
}

function setFirebaseAdminDbForTests(firestore: FakeFirestoreAdminDb) {
  setFirebaseAdminDbForTestsBase(firestore);
  firestore.seed("operationsProducts", SAMPLE_PRODUCT.sku, {
    ...SAMPLE_PRODUCT,
    version: 1,
    updatedAt: "2026-04-24T12:00:00.000Z",
  });
}

describe("inventory movements item store", () => {
  beforeEach(() => {
    restoreProcessEnv();
    process.env.NODE_ENV = "test";
    process.env.AUTH_SECRET =
      "0123456789abcdef0123456789abcdef0123456789abcdef";
    resetFirebaseAdminTestOverrides();
  });

  afterEach(() => {
    restoreProcessEnv();
    resetFirebaseAdminTestOverrides();
  });

  it("migrates legacy movement snapshots into individual firestore documents", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed("erpState", "inventory.movements", {
      resource: "inventory.movements",
      data: [SAMPLE_MOVEMENT],
      updatedAt: "2026-04-24T12:00:00.000Z",
      version: 3,
    });

    const payload = await listInventoryMovements();

    assert.equal(payload.count, 1);
    assert.equal(payload.items[0]?.id, SAMPLE_MOVEMENT.id);
    assert.equal(payload.items[0]?.version, 1);
    assert.equal(
      firestore.read("inventoryMovements", SAMPLE_MOVEMENT.id)?.id,
      SAMPLE_MOVEMENT.id,
    );
    assert.equal(
      firestore.read("erpResourceMeta", "inventory.movements")
        ?.legacyMigrationCompleted,
      true,
    );
  });

  it("creates and reads a movement through firestore item documents", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createInventoryMovement({
      ...SAMPLE_MOVEMENT,
      product: "Nome divergente do catalogo",
    });
    const loaded = await getInventoryMovementById(SAMPLE_MOVEMENT.id);

    assert.equal(created?.version, 1);
    assert.equal(loaded.version, 1);
    assert.equal(loaded.product, SAMPLE_CANONICAL_PRODUCT);
    assert.equal(loaded.productId, SAMPLE_MOVEMENT.productId);
    assert.equal(
      firestore.read("inventoryMovements", SAMPLE_MOVEMENT.id)?.product,
      SAMPLE_CANONICAL_PRODUCT,
    );
    assert.equal(
      firestore.read("inventoryMovements", SAMPLE_MOVEMENT.id)?.productId,
      SAMPLE_MOVEMENT.productId,
    );
  });

  it("canonicalizes the product name on update when productId is valid", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createInventoryMovement({
      ...SAMPLE_MOVEMENT,
      id: "mov-canonico-update",
    });

    const updated = await updateInventoryMovement(
      "mov-canonico-update",
      {
        product: "Outro nome qualquer",
        productId: SAMPLE_MOVEMENT.productId,
      },
      {
        baseVersion: created.version,
      },
    );

    assert.equal(updated.product, SAMPLE_CANONICAL_PRODUCT);
    assert.equal(updated.productId, SAMPLE_MOVEMENT.productId);
    assert.equal(
      firestore.read("inventoryMovements", "mov-canonico-update")?.product,
      SAMPLE_CANONICAL_PRODUCT,
    );
  });

  it("accepts a valid lotCode when the lot productId matches the movement productId", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    await seedLotsResource([SAMPLE_COMPATIBLE_LOT_WITH_PRODUCT_ID]);

    const created = await createInventoryMovement({
      ...SAMPLE_MOVEMENT,
      id: "mov-lote-valido",
      lotCode: SAMPLE_COMPATIBLE_LOT_WITH_PRODUCT_ID.code,
    });

    assert.equal(created.lotCode, SAMPLE_COMPATIBLE_LOT_WITH_PRODUCT_ID.code);
    assert.equal(
      firestore.read("inventoryMovements", "mov-lote-valido")?.lotCode,
      SAMPLE_COMPATIBLE_LOT_WITH_PRODUCT_ID.code,
    );
  });

  it("accepts a valid lotCode without productId by falling back to the product name", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    await seedLotsResource([SAMPLE_FALLBACK_LOT_WITHOUT_PRODUCT_ID]);

    const created = await createInventoryMovement({
      ...SAMPLE_MOVEMENT,
      id: "mov-lote-fallback-nome",
      productId: undefined,
      product: SAMPLE_CANONICAL_PRODUCT,
      lotCode: SAMPLE_FALLBACK_LOT_WITHOUT_PRODUCT_ID.code,
    });

    assert.equal(created.lotCode, SAMPLE_FALLBACK_LOT_WITHOUT_PRODUCT_ID.code);
    assert.equal(created.productId, undefined);
  });

  it("keeps the provided product string when productId is absent", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createInventoryMovement({
      ...SAMPLE_MOVEMENT,
      id: "mov-sem-product-id",
      product: "Produto sem vinculo canonico",
      productId: undefined,
    });

    assert.equal(created.product, "Produto sem vinculo canonico");
    assert.equal(created.productId, undefined);
    assert.equal(
      firestore.read("inventoryMovements", "mov-sem-product-id")?.product,
      "Produto sem vinculo canonico",
    );
  });

  it("rejects invalid payloads before persisting a movement item", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    await assert.rejects(
      () =>
        createInventoryMovement({
          id: "mov-invalida",
          product: "Carga quebrada",
        }),
      (error) => error instanceof ErpResourceValidationError,
    );
  });

  it("returns a 409 conflict when movement baseVersion is stale", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createInventoryMovement(SAMPLE_MOVEMENT);

    await updateInventoryMovement(SAMPLE_MOVEMENT.id, { quantity: 1500 }, {
      baseVersion: created!.version,
    });

    await assert.rejects(
      () =>
        updateInventoryMovement(SAMPLE_MOVEMENT.id, { quantity: 1600 }, {
          baseVersion: created!.version,
        }),
      (error) =>
        error instanceof InventoryMovementConflictError &&
        error.currentVersion === 2,
    );
  });

  it("rejects creates when productId does not exist in operations.products", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    await assert.rejects(
      () =>
        createInventoryMovement({
          ...SAMPLE_MOVEMENT,
          id: "mov-produto-invalido-create",
          productId: "SKU-INEXISTENTE-001",
        }),
      (error) =>
        error instanceof InventoryMovementInvalidProductIdError &&
        error.status === 422,
    );
  });

  it("rejects creates when productId is tombstoned in the itemized product store", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    await writeErpResource(
      "operations.products",
      [SAMPLE_PRODUCT],
      { baseVersion: 0 },
    );
    firestore.seed("operationsProducts", SAMPLE_MOVEMENT.productId, {
      sku: SAMPLE_MOVEMENT.productId,
      deleted: true,
      deletedAt: "2026-05-01T10:00:00.000Z",
      updatedAt: "2026-05-01T10:00:00.000Z",
      version: 2,
    });

    await assert.rejects(
      () => createInventoryMovement(SAMPLE_MOVEMENT),
      (error) =>
        error instanceof InventoryMovementInvalidProductIdError &&
        error.productId === SAMPLE_MOVEMENT.productId,
    );
  });

  it("rejects creates when lotCode does not exist in operations.lots", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    await assert.rejects(
      () =>
        createInventoryMovement({
          ...SAMPLE_MOVEMENT,
          id: "mov-lote-invalido-create",
          lotCode: "LOTE-INEXISTENTE-001",
        }),
      (error) =>
        error instanceof InventoryMovementInvalidLotCodeError &&
        error.status === 422,
    );
  });

  it("rejects creates when lotCode is tombstoned in the itemized lot store", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    await seedLotsResource([SAMPLE_COMPATIBLE_LOT_WITH_PRODUCT_ID]);
    firestore.seed("inventoryLots", SAMPLE_COMPATIBLE_LOT_WITH_PRODUCT_ID.code, {
      code: SAMPLE_COMPATIBLE_LOT_WITH_PRODUCT_ID.code,
      deleted: true,
      deletedAt: "2026-05-01T10:00:00.000Z",
      updatedAt: "2026-05-01T10:00:00.000Z",
      version: 2,
    });

    await assert.rejects(
      () =>
        createInventoryMovement({
          ...SAMPLE_MOVEMENT,
          id: "mov-lote-tombstoned-create",
          lotCode: SAMPLE_COMPATIBLE_LOT_WITH_PRODUCT_ID.code,
        }),
      (error) =>
        error instanceof InventoryMovementInvalidLotCodeError &&
        error.lotCode === SAMPLE_COMPATIBLE_LOT_WITH_PRODUCT_ID.code,
    );
  });

  it("rejects creates when the lot productId is incompatible with the movement productId", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    await seedLotsResource([SAMPLE_INCOMPATIBLE_LOT_WITH_PRODUCT_ID]);

    await assert.rejects(
      () =>
        createInventoryMovement({
          ...SAMPLE_MOVEMENT,
          id: "mov-lote-incompativel-create",
          lotCode: SAMPLE_INCOMPATIBLE_LOT_WITH_PRODUCT_ID.code,
        }),
      (error) =>
        error instanceof InventoryMovementInvalidLotProductError &&
        error.status === 422,
    );
  });

  it("accepts a saida when the lot locationId matches the movement origin location", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    await seedLotsResource([SAMPLE_COMPATIBLE_LOT_WITH_PRODUCT_ID]);

    await createInventoryMovement({
      ...SAMPLE_MOVEMENT,
      id: "mov-entrada-base-lote-localizado",
      quantity: 200,
      lotCode: SAMPLE_COMPATIBLE_LOT_WITH_PRODUCT_ID.code,
    });

    const created = await createInventoryMovement({
      id: "mov-saida-lote-localizado",
      product: SAMPLE_CANONICAL_PRODUCT,
      productId: SAMPLE_MOVEMENT.productId,
      lotCode: SAMPLE_COMPATIBLE_LOT_WITH_PRODUCT_ID.code,
      type: "saida",
      quantity: 50,
      reason: "Saida de lote com origem valida",
      user: SAMPLE_MOVEMENT.user,
      createdAt: "2026-04-24T13:30:00.000Z",
      locationId: "complexo-industrial-dourado",
      status: "concluida",
    });

    assert.equal(created.id, "mov-saida-lote-localizado");
  });

  it("rejects transferencias when the lot locationId differs from the movement origin", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    await seedLotsResource([SAMPLE_COMPATIBLE_LOT_WITH_PRODUCT_ID]);

    await assert.rejects(
      () =>
        createInventoryMovement({
          id: "trf-lote-localizacao-invalida",
          product: SAMPLE_CANONICAL_PRODUCT,
          productId: SAMPLE_MOVEMENT.productId,
          lotCode: SAMPLE_COMPATIBLE_LOT_WITH_PRODUCT_ID.code,
          type: "transferencia",
          quantity: 50,
          reason: "Transferencia com origem divergente do lote",
          user: SAMPLE_MOVEMENT.user,
          createdAt: "2026-04-24T14:00:00.000Z",
          fromLocationId: "cd-sudeste",
          toLocationId: "expedicao-dourado",
          priority: "media",
          transferStatus: "solicitada",
          code: "TRF-LOCAL-INVALIDA",
        }),
      (error) =>
        error instanceof InventoryMovementInvalidLotLocationError &&
        error.status === 422,
    );
  });

  it("accepts a lot without locationId when the fallback by location name is consistent", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    await seedLotsResource([SAMPLE_FALLBACK_LOT_WITHOUT_PRODUCT_ID]);

    const created = await createInventoryMovement({
      id: "trf-lote-fallback-local",
      product: SAMPLE_CANONICAL_PRODUCT,
      productId: SAMPLE_MOVEMENT.productId,
      lotCode: SAMPLE_FALLBACK_LOT_WITHOUT_PRODUCT_ID.code,
      type: "transferencia",
      quantity: 40,
      reason: "Transferencia com fallback de local por nome",
      user: SAMPLE_MOVEMENT.user,
      createdAt: "2026-04-24T14:30:00.000Z",
      fromLocationId: "complexo-industrial-dourado",
      toLocationId: "cd-sudeste",
      priority: "media",
      transferStatus: "solicitada",
      code: "TRF-FALLBACK-LOCAL",
    });

    assert.equal(created.id, "trf-lote-fallback-local");
  });

  it("keeps transferencias permissive when the lot has no locationId and fallback cannot guarantee consistency", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    await seedLotsResource([SAMPLE_UNRESOLVABLE_LOT_WITHOUT_LOCATION_ID]);

    const created = await createInventoryMovement({
      id: "trf-lote-sem-garantia-local",
      product: SAMPLE_CANONICAL_PRODUCT,
      productId: SAMPLE_MOVEMENT.productId,
      lotCode: SAMPLE_UNRESOLVABLE_LOT_WITHOUT_LOCATION_ID.code,
      type: "transferencia",
      quantity: 35,
      reason: "Transferencia sem garantia historica de local",
      user: SAMPLE_MOVEMENT.user,
      createdAt: "2026-04-24T15:00:00.000Z",
      fromLocationId: "cd-sudeste",
      toLocationId: "expedicao-dourado",
      priority: "media",
      transferStatus: "solicitada",
      code: "TRF-SEM-GARANTIA-LOCAL",
    });

    assert.equal(created.id, "trf-lote-sem-garantia-local");
  });

  it("rejects updates when productId does not exist in operations.products", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createInventoryMovement({
      ...SAMPLE_MOVEMENT,
      id: "mov-produto-invalido-update",
    });

    await assert.rejects(
      () =>
        updateInventoryMovement(
          "mov-produto-invalido-update",
          { productId: "SKU-INEXISTENTE-002" },
          {
            baseVersion: created.version,
          },
        ),
      (error) =>
        error instanceof InventoryMovementInvalidProductIdError &&
        error.status === 422,
    );
  });

  it("supports canceling and deleting item documents with version checks", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const created = await createInventoryMovement({
      ...SAMPLE_MOVEMENT,
      id: "trf-test-001",
      type: "transferencia",
      fromLocationId: "complexo-industrial-dourado",
      toLocationId: "cd-sudeste",
      priority: "alta",
      transferStatus: "solicitada",
      code: "TRF-TEST-001",
    });

    const cancelled = await deleteOrCancelInventoryMovement("trf-test-001", {
      baseVersion: created!.version,
      mode: "cancel",
    });

    assert.equal(cancelled?.version, 2);
    assert.equal(cancelled?.transferStatus, "cancelada");

    await deleteOrCancelInventoryMovement("trf-test-001", {
      baseVersion: cancelled!.version,
      mode: "delete",
    });

    assert.equal(firestore.read("inventoryMovements", "trf-test-001"), null);
  });

  it("calculates location balances with transfer status semantics", () => {
    const balances = calculateLocationStockBalances([
      {
        ...SAMPLE_MOVEMENT,
        id: "mov-entrada-base",
        quantity: 100,
      },
      {
        ...SAMPLE_MOVEMENT,
        id: "trf-solicitada",
        type: "transferencia",
        quantity: 10,
        fromLocationId: "complexo-industrial-dourado",
        toLocationId: "cd-sudeste",
        priority: "alta",
        transferStatus: "solicitada",
        code: "TRF-SOLICITADA",
      },
      {
        ...SAMPLE_MOVEMENT,
        id: "trf-em-transito",
        type: "transferencia",
        quantity: 15,
        fromLocationId: "complexo-industrial-dourado",
        toLocationId: "expedicao-dourado",
        priority: "alta",
        transferStatus: "em_transito",
        code: "TRF-TRANSITO",
      },
      {
        ...SAMPLE_MOVEMENT,
        id: "trf-recebida",
        type: "transferencia",
        quantity: 20,
        fromLocationId: "complexo-industrial-dourado",
        toLocationId: "cd-sudeste",
        priority: "alta",
        transferStatus: "recebida",
        code: "TRF-RECEBIDA",
      },
    ]);

    assert.deepEqual(balances, [
      { locationId: "cd-sudeste", balance: 20 },
      { locationId: "complexo-industrial-dourado", balance: 65 },
    ]);
  });

  it("blocks writes that would leave location stock negative", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed(
      "erpState",
      "inventory.movements",
      EMPTY_LEGACY_MOVEMENTS_RESOURCE,
    );

    const createdEntry = await createInventoryMovement({
      ...SAMPLE_MOVEMENT,
      id: "mov-entrada-negativa",
      quantity: 10,
    });
    await createInventoryMovement({
      id: "mov-saida-dependente",
      product: SAMPLE_MOVEMENT.product,
      type: "saida",
      quantity: 8,
      reason: "Consumo dependente da entrada",
      user: SAMPLE_MOVEMENT.user,
      createdAt: "2026-04-24T13:30:00.000Z",
      locationId: SAMPLE_MOVEMENT.locationId,
      status: "concluida",
    });

    await assert.rejects(
      () =>
        createInventoryMovement({
          id: "mov-saida-negativa",
          product: SAMPLE_MOVEMENT.product,
          type: "saida",
          quantity: 11,
          reason: "Saida acima do saldo",
          user: SAMPLE_MOVEMENT.user,
          createdAt: "2026-04-24T14:00:00.000Z",
          locationId: SAMPLE_MOVEMENT.locationId,
          status: "concluida",
        }),
      (error) =>
        error instanceof ErpResourceValidationError &&
        /saldo insuficiente/i.test(error.message),
    );

    await assert.rejects(
      () =>
        deleteOrCancelInventoryMovement(createdEntry.id, {
          baseVersion: createdEntry.version,
          mode: "delete",
        }),
      (error) =>
        error instanceof ErpResourceValidationError &&
        /saldo insuficiente/i.test(error.message),
    );
  });

  it("lists consolidated balances for all known locations", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed(
      "erpState",
      "inventory.movements",
      EMPTY_LEGACY_MOVEMENTS_RESOURCE,
    );

    await writeErpResource(
      "inventory.locations",
      [
        {
          id: "complexo-industrial-dourado",
          name: "Complexo Industrial Dourado",
          type: "Fábrica",
          address: "Dourado - SP",
          manager: "Marina Azevedo",
          capacityTotal: 280000,
          status: "Ativa",
        },
        {
          id: "cd-sudeste",
          name: "CD Sudeste",
          type: "Centro de Distribuição",
          address: "Jundiaí - SP",
          manager: "Carlos Menezes",
          capacityTotal: 180000,
          status: "Ativa",
        },
        {
          id: "quality-hold",
          name: "Quality Hold",
          type: "Qualidade",
          address: "Dourado - SP",
          manager: "Luciana Prado",
          capacityTotal: 24000,
          status: "Ativa",
        },
      ],
      { baseVersion: 0 },
    );

    await createInventoryMovement({
      ...SAMPLE_MOVEMENT,
      id: "mov-entrada-stock-1",
      quantity: 50,
    });
    await createInventoryMovement({
      id: "trf-stock-1",
      product: SAMPLE_MOVEMENT.product,
      type: "transferencia",
      quantity: 20,
      reason: "Transferencia recebida",
      user: SAMPLE_MOVEMENT.user,
      createdAt: "2026-04-24T15:00:00.000Z",
      fromLocationId: "complexo-industrial-dourado",
      toLocationId: "cd-sudeste",
      priority: "alta",
      transferStatus: "recebida",
      code: "TRF-STOCK-1",
      receivedAt: "2026-04-24T15:30:00.000Z",
    });

    const payload = await listLocationStockBalances();

    assert.deepEqual(payload.items, [
      { locationId: "cd-sudeste", balance: 20 },
      { locationId: "complexo-industrial-dourado", balance: 30 },
      { locationId: "quality-hold", balance: 0 },
    ]);
    assert.equal(payload.count, 3);
  });

  it("does not include tombstoned legacy locations in consolidated balances", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    firestore.seed(
      "erpState",
      "inventory.movements",
      EMPTY_LEGACY_MOVEMENTS_RESOURCE,
    );
    await writeErpResource(
      "inventory.locations",
      [
        {
          id: "local-tombstoned",
          name: "Local Tombstoned",
          type: "Centro de Distribuição",
          address: "Teste",
          manager: "Time QA",
          capacityTotal: 1000,
          status: "Ativa",
        },
      ],
      { baseVersion: 0 },
    );
    firestore.seed("inventoryLocations", "local-tombstoned", {
      id: "local-tombstoned",
      deleted: true,
      deletedAt: "2026-05-01T10:00:00.000Z",
      updatedAt: "2026-05-01T10:00:00.000Z",
      version: 2,
    });

    const payload = await listLocationStockBalances();

    assert.equal(
      payload.items.some((item) => item.locationId === "local-tombstoned"),
      false,
    );
  });

  it("derives a high-confidence stable location when the lot history is clear", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    await seedLotsResource([
      {
        code: "LOTE-HISTORICO-CLARO",
        product: SAMPLE_CANONICAL_PRODUCT,
        productId: SAMPLE_MOVEMENT.productId,
        locationId: "complexo-industrial-dourado",
        location: "Complexo Industrial Dourado",
        expiration: "2026-12-28",
        quantity: 80,
        status: "Liberado",
      },
    ]);

    await createInventoryMovement({
      ...SAMPLE_MOVEMENT,
      id: "mov-lote-derivacao-entrada",
      lotCode: "LOTE-HISTORICO-CLARO",
      quantity: 80,
    });
    await createInventoryMovement({
      id: "trf-lote-derivacao-recebida",
      product: SAMPLE_CANONICAL_PRODUCT,
      productId: SAMPLE_MOVEMENT.productId,
      lotCode: "LOTE-HISTORICO-CLARO",
      type: "transferencia",
      quantity: 80,
      reason: "Transferencia recebida para novo local",
      user: SAMPLE_MOVEMENT.user,
      createdAt: "2026-04-24T16:00:00.000Z",
      fromLocationId: "complexo-industrial-dourado",
      toLocationId: "cd-sudeste",
      priority: "alta",
      transferStatus: "recebida",
      code: "TRF-DERIVACAO-RECEBIDA",
      receivedAt: "2026-04-24T16:30:00.000Z",
    });

    const derived = await deriveLotLocation("LOTE-HISTORICO-CLARO");

    assert.deepEqual(derived, {
      stableLocationId: "cd-sudeste",
      inTransitToLocationId: null,
      confidence: "high",
    });
  });

  it("derives an in-transit destination with medium confidence when the last transfer is in transit", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    await seedLotsResource([
      {
        code: "LOTE-EM-TRANSITO",
        product: SAMPLE_CANONICAL_PRODUCT,
        productId: SAMPLE_MOVEMENT.productId,
        locationId: "complexo-industrial-dourado",
        location: "Complexo Industrial Dourado",
        expiration: "2026-12-27",
        quantity: 60,
        status: "Liberado",
      },
    ]);

    await createInventoryMovement({
      ...SAMPLE_MOVEMENT,
      id: "mov-lote-transito-entrada",
      lotCode: "LOTE-EM-TRANSITO",
      quantity: 60,
    });
    await createInventoryMovement({
      id: "trf-lote-em-transito",
      product: SAMPLE_CANONICAL_PRODUCT,
      productId: SAMPLE_MOVEMENT.productId,
      lotCode: "LOTE-EM-TRANSITO",
      type: "transferencia",
      quantity: 60,
      reason: "Transferencia em transito",
      user: SAMPLE_MOVEMENT.user,
      createdAt: "2026-04-24T17:00:00.000Z",
      fromLocationId: "complexo-industrial-dourado",
      toLocationId: "expedicao-dourado",
      priority: "media",
      transferStatus: "em_transito",
      code: "TRF-DERIVACAO-TRANSITO",
    });

    const derived = await deriveLotLocation("LOTE-EM-TRANSITO");

    assert.deepEqual(derived, {
      stableLocationId: "complexo-industrial-dourado",
      inTransitToLocationId: "expedicao-dourado",
      confidence: "medium",
    });
  });

  it("returns low confidence when the lot has no movement history", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);

    const derived = await deriveLotLocation("LOTE-SEM-HISTORICO");

    assert.deepEqual(derived, {
      stableLocationId: null,
      inTransitToLocationId: null,
      confidence: "low",
    });
  });

  it("detects mismatch when the persisted lot location differs from a confident derived location", async () => {
    const firestore = new FakeFirestoreAdminDb();
    setFirebaseAdminDbForTests(firestore);
    await seedLotsResource([
      {
        code: "LOTE-INCONSISTENTE",
        product: SAMPLE_CANONICAL_PRODUCT,
        productId: SAMPLE_MOVEMENT.productId,
        locationId: "complexo-industrial-dourado",
        location: "Complexo Industrial Dourado",
        expiration: "2026-12-26",
        quantity: 75,
        status: "Liberado",
      },
    ]);

    await createInventoryMovement({
      ...SAMPLE_MOVEMENT,
      id: "mov-lote-inconsistente-entrada",
      lotCode: "LOTE-INCONSISTENTE",
      quantity: 75,
    });
    await createInventoryMovement({
      id: "trf-lote-inconsistente-recebida",
      product: SAMPLE_CANONICAL_PRODUCT,
      productId: SAMPLE_MOVEMENT.productId,
      lotCode: "LOTE-INCONSISTENTE",
      type: "transferencia",
      quantity: 75,
      reason: "Transferencia recebida para reconciliacao",
      user: SAMPLE_MOVEMENT.user,
      createdAt: "2026-04-24T18:00:00.000Z",
      fromLocationId: "complexo-industrial-dourado",
      toLocationId: "cd-sudeste",
      priority: "alta",
      transferStatus: "recebida",
      code: "TRF-DERIVACAO-INCONSISTENTE",
      receivedAt: "2026-04-24T18:20:00.000Z",
    });

    const mismatch = await detectLotLocationMismatch({
      code: "LOTE-INCONSISTENTE",
      locationId: "complexo-industrial-dourado",
    });

    assert.deepEqual(mismatch, {
      persistedLocationId: "complexo-industrial-dourado",
      derivedLocation: {
        stableLocationId: "cd-sudeste",
        inTransitToLocationId: null,
        confidence: "high",
      },
      hasMismatch: true,
    });
  });

  it("keeps write access blocked for read-only roles", () => {
    assert.throws(
      () =>
        assertCanWriteErpResource(
          {
            account: SAMPLE_ADMIN_ACCOUNT,
            username: "consulta",
            role: "consulta",
            expiresAt: Date.now() + 60_000,
          },
          "inventory.movements",
        ),
      /nao pode alterar/i,
    );
  });
});
