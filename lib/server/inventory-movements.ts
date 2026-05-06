import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MovementItem } from "@/lib/inventory";
import type { LotItem } from "@/lib/operations-data";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import {
  ErpResourceValidationError,
  sanitizeStoredErpResourceItemData,
  validateErpResourceItemData,
} from "@/lib/server/erp-resource-schema";
import { readErpResource } from "@/lib/server/erp-state";
import { getServerPersistenceProvider } from "@/lib/server/server-persistence";

const INVENTORY_MOVEMENTS_COLLECTION = "inventoryMovements";
const ERP_RESOURCE_META_COLLECTION = "erpResourceMeta";
const MOVEMENTS_RESOURCE_ID = "inventory.movements";
const DEFAULT_INVENTORY_MOVEMENTS_FILE = path.join(
  process.cwd(),
  ".data",
  "inventory-movements.json",
);

let fileWriteQueue = Promise.resolve();

type MovementVersion = number;

type StoredInventoryMovementDocument = MovementItem & {
  version: MovementVersion;
};

type InventoryMovementItemRecord = {
  movement: StoredInventoryMovementDocument | null;
  exists: boolean;
};

type InventoryMovementsFileStore = {
  meta?: InventoryMovementsMetaDocument;
  items?: Record<string, StoredInventoryMovementDocument>;
};

type InventoryMovementsMetaDocument = {
  resource: typeof MOVEMENTS_RESOURCE_ID;
  legacyMigrationCompleted: boolean;
  legacyMigratedAt: string | null;
};

export type InventoryMovementRecord = MovementItem & {
  version: MovementVersion;
};

export type ListInventoryMovementsResult = {
  items: InventoryMovementRecord[];
  count: number;
};

export type LocationStockBalanceRecord = {
  locationId: string;
  balance: number;
};

export type ListLocationStockBalancesResult = {
  items: LocationStockBalanceRecord[];
  count: number;
};

export type DerivedLotLocationConfidence = "high" | "medium" | "low";

export type DerivedLotLocationResult = {
  stableLocationId: string | null;
  inTransitToLocationId: string | null;
  confidence: DerivedLotLocationConfidence;
};

export type LotLocationMismatchResult = {
  persistedLocationId: string | null;
  derivedLocation: DerivedLotLocationResult;
  hasMismatch: boolean;
};

export type UpdateInventoryMovementOptions = {
  baseVersion: number;
};

export type DeleteInventoryMovementOptions = {
  baseVersion: number;
  mode?: "delete" | "cancel";
};

type MovementDocumentMutationResult =
  | { type: "set"; value: MovementItem }
  | { type: "delete" }
  | { type: "noop"; value: InventoryMovementRecord };

export class InventoryMovementConflictError extends Error {
  status: number;
  currentVersion: number;
  currentUpdatedAt: string | null;

  constructor(
    message: string,
    currentVersion: number,
    currentUpdatedAt: string | null,
  ) {
    super(message);
    this.status = 409;
    this.currentVersion = currentVersion;
    this.currentUpdatedAt = currentUpdatedAt;
  }
}

export class InventoryMovementNotFoundError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.status = 404;
  }
}

export class InventoryMovementInvalidProductIdError extends Error {
  status: number;
  productId: string;

  constructor(productId: string) {
    super(`ProductId invalido para a movimentacao: ${productId}.`);
    this.status = 422;
    this.productId = productId;
  }
}

export class InventoryMovementInvalidLotCodeError extends Error {
  status: number;
  lotCode: string;

  constructor(lotCode: string) {
    super(`LotCode invalido para a movimentacao: ${lotCode}.`);
    this.status = 422;
    this.lotCode = lotCode;
  }
}

export class InventoryMovementInvalidLotProductError extends Error {
  status: number;
  lotCode: string;

  constructor(lotCode: string) {
    super(`O lote ${lotCode} nao pertence ao produto informado na movimentacao.`);
    this.status = 422;
    this.lotCode = lotCode;
  }
}

export class InventoryMovementInvalidLotLocationError extends Error {
  status: number;
  lotCode: string;

  constructor(lotCode: string) {
    super(`O lote ${lotCode} nao pertence a localizacao de origem informada na movimentacao.`);
    this.status = 422;
    this.lotCode = lotCode;
  }
}

export function requireInventoryMovementBaseVersion(
  value: unknown,
  operation: string,
) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ErpResourceValidationError(
      `baseVersion obrigatorio para ${operation} a movimentacao.`,
      400,
    );
  }

  return value;
}

export function getInventoryMovementVersionConflictPayload(
  error: InventoryMovementConflictError,
) {
  return {
    error: "VERSION_CONFLICT" as const,
    currentVersion: error.currentVersion,
  };
}

export function getInventoryMovementInvalidProductIdPayload() {
  return {
    error: "INVALID_PRODUCT_ID" as const,
  };
}

export function getInventoryMovementInvalidLotCodePayload() {
  return {
    error: "INVALID_LOT_CODE" as const,
  };
}

export function getInventoryMovementInvalidLotProductPayload() {
  return {
    error: "INVALID_LOT_PRODUCT" as const,
  };
}

export function getInventoryMovementInvalidLotLocationPayload() {
  return {
    error: "INVALID_LOT_LOCATION" as const,
  };
}

function getInventoryMovementsFilePath() {
  return process.env.INVENTORY_MOVEMENTS_FILE_PATH
    ? path.resolve(process.cwd(), process.env.INVENTORY_MOVEMENTS_FILE_PATH)
    : DEFAULT_INVENTORY_MOVEMENTS_FILE;
}

function queueFileWrite<T>(operation: () => Promise<T>) {
  const nextOperation = fileWriteQueue.then(operation, operation);
  fileWriteQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );
  return nextOperation;
}

function getDefaultMetaDocument(): InventoryMovementsMetaDocument {
  return {
    resource: MOVEMENTS_RESOURCE_ID,
    legacyMigrationCompleted: false,
    legacyMigratedAt: null,
  };
}

async function readInventoryMovementsFileStore() {
  try {
    const raw = await readFile(getInventoryMovementsFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        meta: getDefaultMetaDocument(),
        items: {},
      } satisfies Required<InventoryMovementsFileStore>;
    }

    const value = parsed as InventoryMovementsFileStore;

    return {
      meta: normalizeMetaDocument(value.meta),
      items: normalizeFileItems(value.items),
    } satisfies Required<InventoryMovementsFileStore>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        meta: getDefaultMetaDocument(),
        items: {},
      } satisfies Required<InventoryMovementsFileStore>;
    }

    throw error;
  }
}

function normalizeMetaDocument(value: unknown): InventoryMovementsMetaDocument {
  if (!value || typeof value !== "object") {
    return getDefaultMetaDocument();
  }

  const candidate = value as Partial<InventoryMovementsMetaDocument>;

  return {
    resource: MOVEMENTS_RESOURCE_ID,
    legacyMigrationCompleted: candidate.legacyMigrationCompleted === true,
    legacyMigratedAt:
      typeof candidate.legacyMigratedAt === "string"
        ? candidate.legacyMigratedAt
        : null,
  };
}

function normalizeStoredMovementDocument(
  documentId: string,
  value: unknown,
): StoredInventoryMovementDocument | null {
  const sanitized = sanitizeStoredErpResourceItemData(MOVEMENTS_RESOURCE_ID, value);
  const item = sanitized.item;

  if (!item || item.id !== documentId) {
    return null;
  }

  const candidate = value as Partial<StoredInventoryMovementDocument>;

  return {
    ...item,
    version:
      typeof candidate.version === "number" &&
      Number.isInteger(candidate.version) &&
      candidate.version >= 1
        ? candidate.version
        : 1,
  };
}

function normalizeFileItems(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, StoredInventoryMovementDocument>;
  }

  const items: Record<string, StoredInventoryMovementDocument> = {};

  for (const [documentId, candidate] of Object.entries(value)) {
    const normalized = normalizeStoredMovementDocument(documentId, candidate);

    if (normalized) {
      items[documentId] = normalized;
    }
  }

  return items;
}

function sortMovementItems<TValue extends MovementItem>(items: TValue[]) {
  return [...items].sort((left, right) => {
    const timestampDiff =
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();

    if (timestampDiff !== 0) {
      return timestampDiff;
    }

    return left.id.localeCompare(right.id);
  });
}

function sortMovementsChronologically<TValue extends MovementItem>(items: TValue[]) {
  return [...items].sort((left, right) => {
    const timestampDiff =
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();

    if (timestampDiff !== 0) {
      return timestampDiff;
    }

    return left.id.localeCompare(right.id);
  });
}

function areMovementPayloadsEqual(left: MovementItem, right: MovementItem) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toMovementPayload(
  movement: InventoryMovementRecord | null,
): MovementItem | null {
  if (!movement) {
    return null;
  }

  const payload = { ...movement } as Partial<InventoryMovementRecord>;
  delete payload.version;
  return payload as MovementItem;
}

function getMovementStockTransferStatus(movement: MovementItem) {
  return movement.transferStatus ?? "recebida";
}

function isMovementCancelledForStock(movement: MovementItem) {
  if (movement.type === "transferencia") {
    return getMovementStockTransferStatus(movement) === "cancelada";
  }

  return (movement.status ?? "concluida") === "cancelada";
}

function deriveLotLocationFromMovements(
  movements: readonly MovementItem[],
): DerivedLotLocationResult {
  let stableLocationId: string | null = null;
  let inTransitToLocationId: string | null = null;
  let confidence: DerivedLotLocationConfidence = "low";

  for (const movement of sortMovementsChronologically([...movements])) {
    if (movement.type === "entrada") {
      stableLocationId = movement.locationId ?? stableLocationId;
      inTransitToLocationId = null;
      confidence = movement.locationId ? "high" : confidence;
      continue;
    }

    if (movement.type === "saida") {
      inTransitToLocationId = null;
      confidence = stableLocationId ? "medium" : "low";
      continue;
    }

    const transferStatus = getMovementStockTransferStatus(movement);

    if (transferStatus === "solicitada" || transferStatus === "em_separacao") {
      inTransitToLocationId = null;
      confidence = stableLocationId ? "medium" : "low";
      continue;
    }

    if (transferStatus === "em_transito") {
      stableLocationId = movement.fromLocationId ?? stableLocationId;
      inTransitToLocationId = movement.toLocationId ?? null;
      confidence =
        stableLocationId || inTransitToLocationId ? "medium" : "low";
      continue;
    }

    if (transferStatus === "recebida") {
      stableLocationId = movement.toLocationId ?? stableLocationId;
      inTransitToLocationId = null;
      confidence = movement.toLocationId ? "high" : confidence;
    }
  }

  return {
    stableLocationId,
    inTransitToLocationId,
    confidence,
  };
}

function applyLocationBalanceDelta(
  balances: Map<string, number>,
  locationId: string | undefined,
  delta: number,
) {
  if (!locationId || delta === 0) {
    return;
  }

  balances.set(locationId, (balances.get(locationId) ?? 0) + delta);
}

function getLocationBalanceMapFromMovements(movements: readonly MovementItem[]) {
  const balances = new Map<string, number>();

  for (const movement of movements) {
    if (isMovementCancelledForStock(movement)) {
      continue;
    }

    if (movement.type === "entrada") {
      applyLocationBalanceDelta(balances, movement.locationId, movement.quantity);
      continue;
    }

    if (movement.type === "saida") {
      applyLocationBalanceDelta(balances, movement.locationId, -movement.quantity);
      continue;
    }

    const transferStatus = getMovementStockTransferStatus(movement);

    if (transferStatus === "em_transito" || transferStatus === "recebida") {
      applyLocationBalanceDelta(
        balances,
        movement.fromLocationId,
        -movement.quantity,
      );
    }

    if (transferStatus === "recebida") {
      applyLocationBalanceDelta(balances, movement.toLocationId, movement.quantity);
    }
  }

  return balances;
}

function projectMovementMutation(
  allMovements: readonly InventoryMovementRecord[],
  movementId: string,
  next: MovementDocumentMutationResult,
) {
  if (next.type === "noop") {
    return allMovements
      .map((movement) => toMovementPayload(movement))
      .filter((movement): movement is MovementItem => movement !== null);
  }

  const projected = allMovements
    .filter((movement) => movement.id !== movementId)
    .map((movement) => toMovementPayload(movement))
    .filter((movement): movement is MovementItem => movement !== null);

  if (next.type === "set") {
    projected.push(next.value);
  }

  return projected;
}

function assertMovementLocationShape(movement: MovementItem) {
  if (movement.type === "transferencia") {
    if (!movement.fromLocationId || !movement.toLocationId) {
      throw new ErpResourceValidationError(
        "Transferencias precisam informar origem e destino.",
      );
    }

    if (movement.fromLocationId === movement.toLocationId) {
      throw new ErpResourceValidationError(
        "Origem e destino da transferencia precisam ser diferentes.",
      );
    }

    return movement;
  }

  if (!movement.locationId) {
    throw new ErpResourceValidationError(
      `Movimentacoes de ${movement.type} precisam informar a localizacao.`,
    );
  }

  return movement;
}

function assertProjectedLocationBalances(
  allMovements: readonly InventoryMovementRecord[],
  movementId: string,
  next: MovementDocumentMutationResult,
) {
  if (next.type === "noop") {
    return;
  }

  const projectedMovements = projectMovementMutation(allMovements, movementId, next);
  const balances = getLocationBalanceMapFromMovements(projectedMovements);
  const negativeBalance = [...balances.entries()].find(
    ([, balance]) => balance < 0,
  );

  if (!negativeBalance) {
    return;
  }

  const [locationId, balance] = negativeBalance;

  throw new ErpResourceValidationError(
    `Saldo insuficiente para a localizacao ${locationId}. A operacao deixaria o saldo em ${balance}.`,
  );
}

export function calculateLocationStockBalances(
  movements: readonly MovementItem[],
): LocationStockBalanceRecord[] {
  return [...getLocationBalanceMapFromMovements(movements).entries()]
    .map(([locationId, balance]) => ({
      locationId,
      balance,
    }))
    .sort((left, right) => left.locationId.localeCompare(right.locationId));
}

function assertBaseVersion(
  current: InventoryMovementRecord | null,
  baseVersion: number,
): asserts current is InventoryMovementRecord {
  if (!Number.isInteger(baseVersion) || baseVersion < 1) {
    throw new ErpResourceValidationError(
      "Versao base invalida para a movimentacao.",
    );
  }

  if (!current) {
    throw new InventoryMovementNotFoundError("Movimentacao nao encontrada.");
  }

  if (current.version === baseVersion) {
    return;
  }

  throw new InventoryMovementConflictError(
    "A movimentacao foi alterada por outra sessao. Recarregue os dados antes de salvar novamente.",
    current.version,
    current.updatedAt ?? current.createdAt ?? null,
  );
}

function buildMetaDocument(completedAt: string | null): InventoryMovementsMetaDocument {
  return {
    resource: MOVEMENTS_RESOURCE_ID,
    legacyMigrationCompleted: true,
    legacyMigratedAt: completedAt,
  };
}

function validateMovementWritePayload(value: unknown, movementId?: string) {
  const normalized = validateErpResourceItemData(MOVEMENTS_RESOURCE_ID, value);

  if (movementId && normalized.id !== movementId) {
    throw new ErpResourceValidationError(
      "O id da movimentacao precisa corresponder ao id da rota.",
    );
  }

  return assertMovementLocationShape(normalized);
}

function normalizeCatalogReference(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeCatalogSku(value: string) {
  return value.trim().toUpperCase();
}

function normalizeCatalogLocationId(value: string) {
  return value.trim();
}

function getMovementLotSourceLocationId(movement: MovementItem) {
  if (movement.type === "saida") {
    return movement.locationId ?? null;
  }

  if (movement.type === "transferencia") {
    return movement.fromLocationId ?? null;
  }

  return null;
}

async function resolveLegacyLotLocationIdByName(locationName: string) {
  const normalizedLocationName = normalizeCatalogReference(locationName);

  if (!normalizedLocationName) {
    return null;
  }

  const { listLocations } = await import("@/lib/server/inventory-locations");
  const locationsPayload = await listLocations();
  const matchingLocation = locationsPayload.items.find(
    (candidate) =>
      normalizeCatalogReference(candidate.name) === normalizedLocationName,
  );

  return matchingLocation?.id ?? null;
}

async function assertMovementProductIntegrity(movement: MovementItem) {
  if (!movement.productId) {
    return movement;
  }

  const { getProductBySku, OperationsProductNotFoundError } = await import(
    "@/lib/server/operations-products"
  );
  let product = null;

  try {
    product = await getProductBySku(movement.productId);
  } catch (error) {
    if (!(error instanceof OperationsProductNotFoundError)) {
      throw error;
    }
  }

  if (!product) {
    throw new InventoryMovementInvalidProductIdError(movement.productId);
  }

  return {
    ...movement,
    product: product.product,
  };
}

async function assertMovementLotIntegrity(movement: MovementItem) {
  if (!movement.lotCode) {
    return movement;
  }

  const { InventoryLotNotFoundError, getLotByCode } = await import(
    "@/lib/server/inventory-lots"
  );
  let lot = null;

  try {
    lot = await getLotByCode(movement.lotCode);
  } catch (error) {
    if (!(error instanceof InventoryLotNotFoundError)) {
      throw error;
    }
  }

  if (!lot) {
    throw new InventoryMovementInvalidLotCodeError(movement.lotCode);
  }

  if (lot.productId) {
    if (
      !movement.productId ||
      normalizeCatalogSku(movement.productId) !== normalizeCatalogSku(lot.productId)
    ) {
      throw new InventoryMovementInvalidLotProductError(movement.lotCode);
    }
  } else if (
    normalizeCatalogReference(lot.product) !==
    normalizeCatalogReference(movement.product)
  ) {
    throw new InventoryMovementInvalidLotProductError(movement.lotCode);
  }

  const movementSourceLocationId = getMovementLotSourceLocationId(movement);

  if (!movementSourceLocationId) {
    return movement;
  }

  if (lot.locationId) {
    if (
      normalizeCatalogLocationId(movementSourceLocationId) !==
      normalizeCatalogLocationId(lot.locationId)
    ) {
      throw new InventoryMovementInvalidLotLocationError(movement.lotCode);
    }

    return movement;
  }

  const fallbackLocationId = await resolveLegacyLotLocationIdByName(lot.location);

  if (
    fallbackLocationId &&
    normalizeCatalogLocationId(movementSourceLocationId) !==
      normalizeCatalogLocationId(fallbackLocationId)
  ) {
    throw new InventoryMovementInvalidLotLocationError(movement.lotCode);
  }

  return movement;
}

async function assertMovementCatalogIntegrity(movement: MovementItem) {
  const canonicalProductMovement = await assertMovementProductIntegrity(movement);
  return assertMovementLotIntegrity(canonicalProductMovement);
}

async function readLegacyMovementsSnapshot() {
  const legacyResource = await readErpResource(MOVEMENTS_RESOURCE_ID);
  return legacyResource.data;
}

async function ensureFirebaseLegacyMigration() {
  const database = getFirebaseAdminDb();
  const metaRef =
    database.collection<InventoryMovementsMetaDocument>(ERP_RESOURCE_META_COLLECTION).doc(MOVEMENTS_RESOURCE_ID);
  const metaSnapshot = await metaRef.get();
  const meta = normalizeMetaDocument(metaSnapshot.data());

  if (meta.legacyMigrationCompleted) {
    return;
  }

  const movementsCollection =
    database.collection<StoredInventoryMovementDocument>(INVENTORY_MOVEMENTS_COLLECTION);
  const existingDocuments = await movementsCollection.limit(1).get();

  if (existingDocuments.docs.length > 0) {
    await metaRef.set(buildMetaDocument(new Date().toISOString()), { merge: false });
    return;
  }

  const legacyMovements = await readLegacyMovementsSnapshot();
  const migratedAt = new Date().toISOString();

  for (const legacyMovement of legacyMovements) {
    const normalized = validateMovementWritePayload(legacyMovement);
    await movementsCollection.doc(normalized.id).set(
      {
        ...normalized,
        version: 1,
      },
      { merge: false },
    );
  }

  await metaRef.set(buildMetaDocument(legacyMovements.length > 0 ? migratedAt : null), {
    merge: false,
  });
}

async function ensureFileLegacyMigration() {
  await queueFileWrite(async () => {
    const filePath = getInventoryMovementsFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });

    const store = await readInventoryMovementsFileStore();

    if (store.meta.legacyMigrationCompleted) {
      return;
    }

    if (Object.keys(store.items).length > 0) {
      store.meta = buildMetaDocument(new Date().toISOString());
      await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
      return;
    }

    const legacyMovements = await readLegacyMovementsSnapshot();

    for (const legacyMovement of legacyMovements) {
      const normalized = validateMovementWritePayload(legacyMovement);
      store.items[normalized.id] = {
        ...normalized,
        version: 1,
      };
    }

    store.meta = buildMetaDocument(
      legacyMovements.length > 0 ? new Date().toISOString() : null,
    );
    await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
  });
}

async function ensureLegacyMigration() {
  if (getInventoryMovementsPersistenceProvider() === "firebase") {
    await ensureFirebaseLegacyMigration();
    return;
  }

  await ensureFileLegacyMigration();
}

async function listFirebaseInventoryMovements() {
  await ensureLegacyMigration();
  const snapshot = await getFirebaseAdminDb()
    .collection<StoredInventoryMovementDocument>(INVENTORY_MOVEMENTS_COLLECTION)
    .get();

  return sortMovementItems(
    snapshot.docs
      .map((document) =>
        normalizeStoredMovementDocument(document.id, document.data()),
      )
      .filter((document): document is StoredInventoryMovementDocument => document !== null),
  );
}

async function listFileInventoryMovements() {
  await ensureLegacyMigration();
  const store = await readInventoryMovementsFileStore();

  return sortMovementItems(Object.values(store.items));
}

async function readFirebaseInventoryMovement(
  movementId: string,
): Promise<InventoryMovementItemRecord> {
  await ensureLegacyMigration();
  const snapshot = await getFirebaseAdminDb()
    .collection<StoredInventoryMovementDocument>(INVENTORY_MOVEMENTS_COLLECTION)
    .doc(movementId)
    .get();

  if (!snapshot.exists) {
    return {
      movement: null as never,
      exists: false,
    };
  }

  const movement = normalizeStoredMovementDocument(movementId, snapshot.data());

  if (!movement) {
    return {
      movement: null as never,
      exists: false,
    };
  }

  return {
    movement,
    exists: true,
  };
}

async function readFileInventoryMovement(
  movementId: string,
): Promise<InventoryMovementItemRecord> {
  await ensureLegacyMigration();
  const store = await readInventoryMovementsFileStore();
  const movement = store.items[movementId] ?? null;

  if (!movement) {
    return {
      movement: null as never,
      exists: false,
    };
  }

  return {
    movement,
    exists: true,
  };
}

async function writeFirebaseMovementDocument(
  movementId: string,
  update: (
    current: InventoryMovementRecord | null,
    allMovements: InventoryMovementRecord[],
  ) => Promise<MovementDocumentMutationResult>,
) {
  await ensureLegacyMigration();
  const database = getFirebaseAdminDb();
  const collectionRef =
    database.collection<StoredInventoryMovementDocument>(INVENTORY_MOVEMENTS_COLLECTION);
  const documentRef =
    collectionRef.doc(movementId);

  return database.runTransaction(async (transaction) => {
    const [snapshot, collectionSnapshot] = await Promise.all([
      transaction.get(documentRef),
      transaction.get(collectionRef),
    ]);
    const current = snapshot.exists
      ? normalizeStoredMovementDocument(movementId, snapshot.data())
      : null;
    const allMovements = collectionSnapshot.docs
      .map((document) =>
        normalizeStoredMovementDocument(document.id, document.data()),
      )
      .filter(
        (document): document is StoredInventoryMovementDocument =>
          document !== null,
      );
    const next = await update(current, allMovements);
    assertProjectedLocationBalances(allMovements, movementId, next);

    if (next.type === "noop") {
      return next.value;
    }

    if (next.type === "delete") {
      if (!current) {
        throw new InventoryMovementNotFoundError("Movimentacao nao encontrada.");
      }

      transaction.delete(documentRef);
      return null;
    }

    const nextVersion = current ? current.version + 1 : 1;
    const nextDocument: StoredInventoryMovementDocument = {
      ...next.value,
      version: nextVersion,
    };

    transaction.set(documentRef, nextDocument, { merge: false });
    return nextDocument;
  });
}

async function writeFileMovementDocument(
  movementId: string,
  update: (
    current: InventoryMovementRecord | null,
    allMovements: InventoryMovementRecord[],
  ) => Promise<MovementDocumentMutationResult>,
) {
  await ensureLegacyMigration();

  return queueFileWrite(async () => {
    const filePath = getInventoryMovementsFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });

    const store = await readInventoryMovementsFileStore();
    const current = store.items[movementId] ?? null;
    const allMovements = Object.values(store.items);
    const next = await update(current, allMovements);
    assertProjectedLocationBalances(allMovements, movementId, next);

    if (next.type === "noop") {
      return next.value;
    }

    if (next.type === "delete") {
      if (!current) {
        throw new InventoryMovementNotFoundError("Movimentacao nao encontrada.");
      }

      delete store.items[movementId];
      await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
      return null;
    }

    const nextDocument: StoredInventoryMovementDocument = {
      ...next.value,
      version: current ? current.version + 1 : 1,
    };

    store.items[movementId] = nextDocument;
    await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
    return nextDocument;
  });
}

async function writeMovementDocument(
  movementId: string,
  update: (
    current: InventoryMovementRecord | null,
    allMovements: InventoryMovementRecord[],
  ) => Promise<MovementDocumentMutationResult>,
) {
  if (getInventoryMovementsPersistenceProvider() === "firebase") {
    return writeFirebaseMovementDocument(movementId, update);
  }

  return writeFileMovementDocument(movementId, update);
}

async function writeVersionedMovementDocument(
  movementId: string,
  baseVersion: number,
  update: (
    current: InventoryMovementRecord,
    allMovements: InventoryMovementRecord[],
  ) => Promise<MovementDocumentMutationResult>,
) {
  return writeMovementDocument(movementId, async (current, allMovements) => {
    assertBaseVersion(current, baseVersion);
    return update(current, allMovements);
  });
}

export function getInventoryMovementsPersistenceProvider() {
  return getServerPersistenceProvider("movimentacoes do inventario");
}

export async function listInventoryMovements(): Promise<ListInventoryMovementsResult> {
  const items =
    getInventoryMovementsPersistenceProvider() === "firebase"
      ? await listFirebaseInventoryMovements()
      : await listFileInventoryMovements();

  return {
    items,
    count: items.length,
  };
}

export async function listLocationStockBalances(): Promise<ListLocationStockBalancesResult> {
  const { listLocations } = await import("@/lib/server/inventory-locations");
  const [movementsPayload, locationsPayload] = await Promise.all([
    listInventoryMovements(),
    listLocations(),
  ]);
  const balances = new Map<string, number>(
    calculateLocationStockBalances(movementsPayload.items).map((item) => [
      item.locationId,
      item.balance,
    ]),
  );

  for (const location of locationsPayload.items) {
    balances.set(location.id, balances.get(location.id) ?? 0);
  }

  const items = [...balances.entries()]
    .map(([locationId, balance]) => ({
      locationId,
      balance,
    }))
    .sort((left, right) => left.locationId.localeCompare(right.locationId));

  return {
    items,
    count: items.length,
  };
}

export async function deriveLotLocation(
  lotCode: string,
): Promise<DerivedLotLocationResult> {
  const movementsPayload = await listInventoryMovements();
  const lotMovements = movementsPayload.items.filter(
    (movement) =>
      movement.lotCode === lotCode &&
      !isMovementCancelledForStock(movement),
  );

  return deriveLotLocationFromMovements(lotMovements);
}

export async function detectLotLocationMismatch(
  lot: Pick<LotItem, "code" | "locationId">,
): Promise<LotLocationMismatchResult> {
  const derivedLocation = await deriveLotLocation(lot.code);
  const persistedLocationId = lot.locationId ?? null;
  const hasMismatch =
    persistedLocationId !== null &&
    derivedLocation.stableLocationId !== null &&
    derivedLocation.confidence !== "low" &&
    normalizeCatalogLocationId(persistedLocationId) !==
      normalizeCatalogLocationId(derivedLocation.stableLocationId);

  return {
    persistedLocationId,
    derivedLocation,
    hasMismatch,
  };
}

export async function getInventoryMovementById(movementId: string) {
  const result =
    getInventoryMovementsPersistenceProvider() === "firebase"
      ? await readFirebaseInventoryMovement(movementId)
      : await readFileInventoryMovement(movementId);

  if (!result.exists) {
    throw new InventoryMovementNotFoundError("Movimentacao nao encontrada.");
  }

  return result.movement;
}

export async function createInventoryMovement(
  movement: unknown,
): Promise<InventoryMovementRecord> {
  const normalized = await assertMovementCatalogIntegrity(
    validateMovementWritePayload(movement),
  );

  const createdMovement = await writeMovementDocument(normalized.id, async (current) => {
    if (current) {
      throw new ErpResourceValidationError(
        "Ja existe uma movimentacao com o id informado.",
        409,
      );
    }

    return {
      type: "set",
      value: normalized,
    };
  });

  if (!createdMovement) {
    throw new Error("Falha inesperada ao criar a movimentacao.");
  }

  return createdMovement;
}

export async function updateInventoryMovement(
  movementId: string,
  movementPatch: unknown,
  options: UpdateInventoryMovementOptions,
): Promise<InventoryMovementRecord> {
  const updatedMovement = await writeVersionedMovementDocument(
    movementId,
    options.baseVersion,
    async (current) => {
    if (!movementPatch || typeof movementPatch !== "object" || Array.isArray(movementPatch)) {
      throw new ErpResourceValidationError(
        "Carga invalida para a movimentacao.",
      );
    }

    const candidateId = (movementPatch as { id?: unknown }).id;

    if (candidateId !== undefined && candidateId !== movementId) {
      throw new ErpResourceValidationError(
        "O id da movimentacao precisa corresponder ao id da rota.",
      );
    }

    const merged = validateMovementWritePayload(
      {
        ...toMovementPayload(current),
        ...movementPatch,
        id: movementId,
      },
      movementId,
    );
    const canonicalMerged = await assertMovementCatalogIntegrity(merged);

    const currentPayload = toMovementPayload(current);

    if (currentPayload && areMovementPayloadsEqual(currentPayload, canonicalMerged)) {
      return {
        type: "noop",
        value: current,
      };
    }

    return {
      type: "set",
      value: {
        ...canonicalMerged,
        updatedAt: new Date().toISOString(),
      },
    };
    },
  );

  if (!updatedMovement) {
    throw new Error("Falha inesperada ao atualizar a movimentacao.");
  }

  return updatedMovement;
}

export async function deleteOrCancelInventoryMovement(
  movementId: string,
  options: DeleteInventoryMovementOptions,
) {
  const mode = options.mode ?? "delete";

  return writeVersionedMovementDocument(
    movementId,
    options.baseVersion,
    async (current) => {
    if (mode === "cancel") {
      if (
        current.type === "transferencia" &&
        (current.transferStatus ?? "solicitada") === "recebida"
      ) {
        throw new ErpResourceValidationError(
          "Transferencias recebidas nao podem ser canceladas por esta rota.",
        );
      }

      const cancelledMovement = validateMovementWritePayload(
        current.type === "transferencia"
          ? {
              ...toMovementPayload(current),
              transferStatus: "cancelada",
              updatedAt: new Date().toISOString(),
            }
          : {
              ...toMovementPayload(current),
              status: "cancelada",
              updatedAt: new Date().toISOString(),
            },
        movementId,
      );

      const currentPayload = toMovementPayload(current);

      if (currentPayload && areMovementPayloadsEqual(currentPayload, cancelledMovement)) {
        return {
          type: "noop",
          value: current,
        };
      }

      return {
        type: "set",
        value: cancelledMovement,
      };
    }

    if (
      current.type === "transferencia" &&
      (current.transferStatus ?? "solicitada") === "recebida"
    ) {
      throw new ErpResourceValidationError(
        "Transferencias recebidas nao podem ser excluidas. Cancele ou edite o status, se necessario.",
      );
    }

    return {
      type: "delete",
    };
    },
  );
}
