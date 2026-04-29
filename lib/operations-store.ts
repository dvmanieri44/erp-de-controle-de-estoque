import { dispatchErpDataEvent } from "@/lib/app-events";
import { type ErpResourceId } from "@/lib/erp-data-resources";
import {
  persistResourceToBackendInBackground,
  syncResourceFromBackendInBackground,
} from "@/lib/erp-remote-sync";
import {
  CALENDAR_EVENTS,
  CATEGORIES,
  DISTRIBUTORS,
  DOCUMENTS,
  INCIDENTS,
  LOTS,
  NOTIFICATIONS,
  PENDING_ITEMS,
  PLANNING_ITEMS,
  PRODUCT_LINES,
  QUALITY_EVENTS,
  REPORTS,
  SUPPLIERS,
  TASKS,
  type CalendarItem,
  type CategoryItem,
  type DistributorItem,
  type DocumentItem,
  type IncidentItem,
  type LotItem,
  type NotificationItem,
  type PendingItem,
  type PlanningItem,
  type ProductLineItem,
  type QualityEventItem,
  type ReportItem,
  type SupplierItem,
  type TaskItem,
} from "@/lib/operations-data";

const PRODUCT_LINES_STORAGE_KEY = "erp.operations.products";
const LOTS_STORAGE_KEY = "erp.operations.lots";
const SUPPLIERS_STORAGE_KEY = "erp.operations.suppliers";
const CATEGORIES_STORAGE_KEY = "erp.operations.categories";
const NOTIFICATIONS_STORAGE_KEY = "erp.operations.notifications";
const QUALITY_EVENTS_STORAGE_KEY = "erp.operations.quality-events";
const PLANNING_ITEMS_STORAGE_KEY = "erp.operations.planning";
const REPORTS_STORAGE_KEY = "erp.operations.reports";
const PENDING_ITEMS_STORAGE_KEY = "erp.operations.pending";
const TASKS_STORAGE_KEY = "erp.operations.tasks";
const DISTRIBUTORS_STORAGE_KEY = "erp.operations.distributors";
const INCIDENTS_STORAGE_KEY = "erp.operations.incidents";
const DOCUMENTS_STORAGE_KEY = "erp.operations.documents";
const CALENDAR_EVENTS_STORAGE_KEY = "erp.operations.calendar";
const PRODUCTS_ENDPOINT = "/api/erp/products";
const LOTS_ENDPOINT = "/api/erp/lots";
let productsSyncPromise: Promise<VersionedProductLineItem[]> | null = null;
let lotsSyncPromise: Promise<LotItem[]> | null = null;

export type VersionedProductLineItem = ProductLineItem & {
  version?: number;
  updatedAt?: string | null;
};

type VersionedLotItem = LotItem & {
  version?: number;
  updatedAt?: string | null;
};

type OperationsProductsListResponse = {
  items?: unknown;
  error?: unknown;
};

type OperationsProductMutationResponse = {
  product?: unknown;
  error?: unknown;
  currentVersion?: unknown;
};

type InventoryLotsListResponse = {
  items?: unknown;
  error?: unknown;
};

type InventoryLotMutationResponse = {
  lot?: unknown;
  error?: unknown;
  currentVersion?: unknown;
};

export class LotRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "LotRequestError";
    this.status = status;
  }
}

export class LotVersionConflictError extends LotRequestError {
  currentVersion: number;

  constructor(currentVersion: number) {
    super("VERSION_CONFLICT", 409);
    this.name = "LotVersionConflictError";
    this.currentVersion = currentVersion;
  }
}

export class ProductRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ProductRequestError";
    this.status = status;
  }
}

export class ProductVersionConflictError extends ProductRequestError {
  currentVersion: number;

  constructor(currentVersion: number) {
    super("VERSION_CONFLICT", 409);
    this.name = "ProductVersionConflictError";
    this.currentVersion = currentVersion;
  }
}

function cloneCollection<T>(items: readonly T[]) {
  return items.map((item) => ({ ...item }));
}

function loadCollection<T>(key: string, fallback: readonly T[], resource: ErpResourceId) {
  if (typeof window === "undefined") {
    return cloneCollection(fallback);
  }

  syncResourceFromBackendInBackground(resource);

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return cloneCollection(fallback);
    }

    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : cloneCollection(fallback);
  } catch {
    return cloneCollection(fallback);
  }
}

function saveCollection<T>(key: string, items: T[], resource: ErpResourceId) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(items));
  dispatchErpDataEvent();
  persistResourceToBackendInBackground(resource, items as never[]);
}

function normalizeProductSku(value: string) {
  return value.trim().toUpperCase();
}

function isProductSpecies(value: unknown): value is ProductLineItem["species"] {
  return PRODUCT_LINES.some((item) => item.species === value);
}

function isProductStatus(value: unknown): value is ProductLineItem["status"] {
  return PRODUCT_LINES.some((item) => item.status === value);
}

function normalizeProductLineItem(
  value: unknown,
): VersionedProductLineItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    typeof item.sku !== "string" ||
    typeof item.product !== "string" ||
    typeof item.line !== "string" ||
    !isProductSpecies(item.species) ||
    typeof item.stage !== "string" ||
    typeof item.package !== "string" ||
    typeof item.stock !== "number" ||
    !Number.isFinite(item.stock) ||
    typeof item.target !== "number" ||
    !Number.isFinite(item.target) ||
    typeof item.coverageDays !== "number" ||
    !Number.isFinite(item.coverageDays) ||
    !isProductStatus(item.status)
  ) {
    return null;
  }

  return {
    sku: normalizeProductSku(item.sku),
    product: item.product,
    line: item.line,
    species: item.species,
    stage: item.stage,
    package: item.package,
    stock: item.stock,
    target: item.target,
    coverageDays: item.coverageDays,
    status: item.status,
    version:
      typeof item.version === "number" &&
      Number.isInteger(item.version) &&
      item.version >= 1
        ? item.version
        : undefined,
    updatedAt:
      typeof item.updatedAt === "string" ? item.updatedAt : undefined,
  };
}

function sortProducts<TValue extends ProductLineItem>(items: TValue[]) {
  return [...items].sort((left, right) => left.sku.localeCompare(right.sku));
}

function readStoredProducts() {
  if (typeof window === "undefined") {
    return cloneCollection(PRODUCT_LINES) as VersionedProductLineItem[];
  }

  const raw = window.localStorage.getItem(PRODUCT_LINES_STORAGE_KEY);

  if (!raw) {
    return cloneCollection(PRODUCT_LINES) as VersionedProductLineItem[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return cloneCollection(PRODUCT_LINES) as VersionedProductLineItem[];
    }

    return parsed
      .map((item) => normalizeProductLineItem(item))
      .filter((item): item is VersionedProductLineItem => item !== null);
  } catch {
    return cloneCollection(PRODUCT_LINES) as VersionedProductLineItem[];
  }
}

function writeStoredProducts(products: VersionedProductLineItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    PRODUCT_LINES_STORAGE_KEY,
    JSON.stringify(sortProducts(products)),
  );
  dispatchErpDataEvent();
}

function upsertStoredProduct(product: VersionedProductLineItem) {
  const current = readStoredProducts();
  writeStoredProducts([
    product,
    ...current.filter((item) => normalizeProductSku(item.sku) !== product.sku),
  ]);
}

function removeStoredProduct(sku: string) {
  const normalizedSku = normalizeProductSku(sku);
  writeStoredProducts(
    readStoredProducts().filter(
      (item) => normalizeProductSku(item.sku) !== normalizedSku,
    ),
  );
}

function getProductResponseItems(
  payload:
    | OperationsProductsListResponse
    | OperationsProductMutationResponse
    | null,
) {
  return payload && "items" in payload ? payload.items : undefined;
}

function getProductResponseItem(
  payload:
    | OperationsProductsListResponse
    | OperationsProductMutationResponse
    | null,
) {
  return payload && "product" in payload ? payload.product : undefined;
}

function stripProductVersion<
  TValue extends VersionedProductLineItem | Partial<VersionedProductLineItem>,
>(product: TValue) {
  const payload = { ...product };
  delete payload.version;
  delete payload.updatedAt;
  return payload;
}

async function parseProductApiPayload(
  response: Response,
  fallbackMessage: string,
) {
  const payload = (await response.json().catch(() => null)) as
    | OperationsProductsListResponse
    | OperationsProductMutationResponse
    | null;

  if (response.ok) {
    return payload;
  }

  const currentVersion =
    payload && "currentVersion" in payload ? payload.currentVersion : undefined;

  if (
    payload &&
    payload.error === "VERSION_CONFLICT" &&
    typeof currentVersion === "number"
  ) {
    throw new ProductVersionConflictError(currentVersion);
  }

  const message =
    payload && typeof payload.error === "string"
      ? payload.error
      : fallbackMessage;

  throw new ProductRequestError(message, response.status);
}

async function fetchProductsFromServer() {
  const response = await fetch(PRODUCTS_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await parseProductApiPayload(
    response,
    "Nao foi possivel carregar os produtos.",
  );
  const items = getProductResponseItems(payload);

  if (!Array.isArray(items)) {
    throw new ProductRequestError(
      "Resposta invalida ao carregar os produtos.",
      response.status,
    );
  }

  const products = items
    .map((item) => normalizeProductLineItem(item))
    .filter((item): item is VersionedProductLineItem => item !== null);

  writeStoredProducts(products);
  return products;
}

function syncProductsFromServerInBackground() {
  if (typeof window === "undefined") {
    return Promise.resolve(
      cloneCollection(PRODUCT_LINES) as VersionedProductLineItem[],
    );
  }

  if (!productsSyncPromise) {
    const nextSync = fetchProductsFromServer().finally(() => {
      if (productsSyncPromise === nextSync) {
        productsSyncPromise = null;
      }
    });
    productsSyncPromise = nextSync;
  }

  return productsSyncPromise;
}

export async function refreshProductLines() {
  if (typeof window === "undefined") {
    return cloneCollection(PRODUCT_LINES) as VersionedProductLineItem[];
  }

  return syncProductsFromServerInBackground();
}

export async function createProductLine(product: ProductLineItem) {
  const response = await fetch(PRODUCTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product: stripProductVersion(product),
    }),
  });
  const payload = await parseProductApiPayload(
    response,
    "Nao foi possivel criar o produto.",
  );
  const createdProduct = normalizeProductLineItem(
    getProductResponseItem(payload),
  );

  if (!createdProduct) {
    throw new ProductRequestError(
      "Resposta invalida ao criar o produto.",
      response.status,
    );
  }

  upsertStoredProduct(createdProduct);
  return createdProduct;
}

export async function updateProductLine(
  sku: string,
  productPatch: Partial<ProductLineItem>,
  baseVersion: number,
) {
  try {
    const response = await fetch(
      `${PRODUCTS_ENDPOINT}/${encodeURIComponent(sku)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product: stripProductVersion(productPatch),
          baseVersion,
        }),
      },
    );
    const payload = await parseProductApiPayload(
      response,
      "Nao foi possivel atualizar o produto.",
    );
    const updatedProduct = normalizeProductLineItem(
      getProductResponseItem(payload),
    );

    if (!updatedProduct) {
      throw new ProductRequestError(
        "Resposta invalida ao atualizar o produto.",
        response.status,
      );
    }

    upsertStoredProduct(updatedProduct);
    return updatedProduct;
  } catch (error) {
    if (error instanceof ProductVersionConflictError) {
      await refreshProductLines();
    }

    throw error;
  }
}

export async function deleteProductLine(sku: string, baseVersion: number) {
  try {
    const response = await fetch(
      `${PRODUCTS_ENDPOINT}/${encodeURIComponent(sku)}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          baseVersion,
        }),
      },
    );

    await parseProductApiPayload(
      response,
      "Nao foi possivel excluir o produto.",
    );
    removeStoredProduct(sku);
  } catch (error) {
    if (error instanceof ProductVersionConflictError) {
      await refreshProductLines();
    }

    throw error;
  }
}

function normalizeLotItem(value: unknown): VersionedLotItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    typeof item.code !== "string" ||
    typeof item.product !== "string" ||
    typeof item.location !== "string" ||
    typeof item.expiration !== "string" ||
    typeof item.quantity !== "number" ||
    (item.status !== "Liberado" &&
      item.status !== "Em análise" &&
      item.status !== "Retido" &&
      item.status !== "Em analise")
  ) {
    return null;
  }

  return {
    code: item.code,
    product: item.product,
    productId: typeof item.productId === "string" ? item.productId : undefined,
    locationId:
      typeof item.locationId === "string" ? item.locationId : undefined,
    location: item.location,
    expiration: item.expiration,
    quantity: item.quantity,
    status:
      item.status === "Em analise"
        ? "Em análise"
        : (item.status as LotItem["status"]),
    version:
      typeof item.version === "number" &&
      Number.isInteger(item.version) &&
      item.version >= 1
        ? item.version
        : undefined,
    updatedAt:
      typeof item.updatedAt === "string" ? item.updatedAt : undefined,
  };
}

function sortLots<TValue extends LotItem>(items: TValue[]) {
  return [...items].sort((left, right) => left.code.localeCompare(right.code));
}

function readStoredLots() {
  const raw = window.localStorage.getItem(LOTS_STORAGE_KEY);

  if (!raw) {
    return cloneCollection(LOTS) as VersionedLotItem[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return cloneCollection(LOTS) as VersionedLotItem[];
    }

    return parsed
      .map((item) => normalizeLotItem(item))
      .filter((item): item is VersionedLotItem => item !== null);
  } catch {
    return cloneCollection(LOTS) as VersionedLotItem[];
  }
}

function writeStoredLots(lots: VersionedLotItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    LOTS_STORAGE_KEY,
    JSON.stringify(sortLots(lots)),
  );
  dispatchErpDataEvent();
}

function upsertStoredLot(lot: VersionedLotItem) {
  const current = readStoredLots();
  writeStoredLots([
    lot,
    ...current.filter((item) => item.code !== lot.code),
  ]);
}

function getLotResponseItems(
  payload: InventoryLotsListResponse | InventoryLotMutationResponse | null,
) {
  return payload && "items" in payload ? payload.items : undefined;
}

function getLotResponseItem(
  payload: InventoryLotsListResponse | InventoryLotMutationResponse | null,
) {
  return payload && "lot" in payload ? payload.lot : undefined;
}

function stripLotVersion<TValue extends VersionedLotItem | Partial<VersionedLotItem>>(
  lot: TValue,
) {
  const payload = { ...lot };
  delete payload.version;
  delete payload.updatedAt;
  return payload;
}

async function parseLotApiPayload(response: Response, fallbackMessage: string) {
  const payload = (await response.json().catch(() => null)) as
    | InventoryLotsListResponse
    | InventoryLotMutationResponse
    | null;

  if (response.ok) {
    return payload;
  }

  const currentVersion =
    payload && "currentVersion" in payload ? payload.currentVersion : undefined;

  if (
    payload &&
    payload.error === "VERSION_CONFLICT" &&
    typeof currentVersion === "number"
  ) {
    throw new LotVersionConflictError(currentVersion);
  }

  const message =
    payload && typeof payload.error === "string"
      ? payload.error
      : fallbackMessage;

  throw new LotRequestError(message, response.status);
}

async function fetchLotsFromServer() {
  const response = await fetch(LOTS_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await parseLotApiPayload(
    response,
    "Nao foi possivel carregar os lotes.",
  );
  const items = getLotResponseItems(payload);

  if (!Array.isArray(items)) {
    throw new LotRequestError(
      "Resposta invalida ao carregar os lotes.",
      response.status,
    );
  }

  const lots = items
    .map((item) => normalizeLotItem(item))
    .filter((item): item is VersionedLotItem => item !== null);

  writeStoredLots(lots);
  return lots;
}

function syncLotsFromServerInBackground() {
  if (typeof window === "undefined") {
    return Promise.resolve(cloneCollection(LOTS));
  }

  if (!lotsSyncPromise) {
    const nextSync = fetchLotsFromServer().finally(() => {
      if (lotsSyncPromise === nextSync) {
        lotsSyncPromise = null;
      }
    });
    lotsSyncPromise = nextSync;
  }

  return lotsSyncPromise;
}

export async function refreshLots() {
  if (typeof window === "undefined") {
    return cloneCollection(LOTS);
  }

  return syncLotsFromServerInBackground();
}

export async function createLot(lot: LotItem) {
  const response = await fetch(LOTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      lot: stripLotVersion(lot),
    }),
  });
  const payload = await parseLotApiPayload(
    response,
    "Nao foi possivel criar o lote.",
  );
  const createdLot = normalizeLotItem(getLotResponseItem(payload));

  if (!createdLot) {
    throw new LotRequestError(
      "Resposta invalida ao criar o lote.",
      response.status,
    );
  }

  upsertStoredLot(createdLot);
  return createdLot;
}

export async function updateLot(
  lotCode: string,
  lotPatch: Partial<LotItem>,
) {
  let current = readStoredLots().find((item) => item.code === lotCode);

  if (!current?.version) {
    await refreshLots();
    current = readStoredLots().find((item) => item.code === lotCode);
  }

  if (!current?.version) {
    throw new LotRequestError(
      "Versao local do lote indisponivel para atualizacao.",
      400,
    );
  }

  try {
    const response = await fetch(
      `${LOTS_ENDPOINT}/${encodeURIComponent(lotCode)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lot: stripLotVersion(lotPatch),
          baseVersion: current.version,
        }),
      },
    );
    const payload = await parseLotApiPayload(
      response,
      "Nao foi possivel atualizar o lote.",
    );
    const updatedLot = normalizeLotItem(getLotResponseItem(payload));

    if (!updatedLot) {
      throw new LotRequestError(
        "Resposta invalida ao atualizar o lote.",
        response.status,
      );
    }

    upsertStoredLot(updatedLot);
    return updatedLot;
  } catch (error) {
    if (error instanceof LotVersionConflictError) {
      await refreshLots();
    }

    throw error;
  }
}

export function loadProductLines() {
  if (typeof window === "undefined") {
    return cloneCollection(PRODUCT_LINES) as VersionedProductLineItem[];
  }

  void syncProductsFromServerInBackground();
  return readStoredProducts();
}

export function loadLots() {
  if (typeof window === "undefined") {
    return cloneCollection(LOTS);
  }

  void syncLotsFromServerInBackground();
  return readStoredLots();
}

export function loadSuppliers() {
  return loadCollection<SupplierItem>(SUPPLIERS_STORAGE_KEY, SUPPLIERS, "operations.suppliers");
}

export function saveSuppliers(items: SupplierItem[]) {
  saveCollection(SUPPLIERS_STORAGE_KEY, items, "operations.suppliers");
}

export function loadCategories() {
  return loadCollection<CategoryItem>(CATEGORIES_STORAGE_KEY, CATEGORIES, "operations.categories");
}

export function saveCategories(items: CategoryItem[]) {
  saveCollection(CATEGORIES_STORAGE_KEY, items, "operations.categories");
}

export function loadNotifications() {
  return loadCollection<NotificationItem>(NOTIFICATIONS_STORAGE_KEY, NOTIFICATIONS, "operations.notifications");
}

export function saveNotifications(items: NotificationItem[]) {
  saveCollection(NOTIFICATIONS_STORAGE_KEY, items, "operations.notifications");
}

export function loadQualityEvents() {
  return loadCollection<QualityEventItem>(QUALITY_EVENTS_STORAGE_KEY, QUALITY_EVENTS, "operations.quality-events");
}

export function saveQualityEvents(items: QualityEventItem[]) {
  saveCollection(QUALITY_EVENTS_STORAGE_KEY, items, "operations.quality-events");
}

export function loadPlanningItems() {
  return loadCollection<PlanningItem>(PLANNING_ITEMS_STORAGE_KEY, PLANNING_ITEMS, "operations.planning");
}

export function savePlanningItems(items: PlanningItem[]) {
  saveCollection(PLANNING_ITEMS_STORAGE_KEY, items, "operations.planning");
}

export function loadReports() {
  return loadCollection<ReportItem>(REPORTS_STORAGE_KEY, REPORTS, "operations.reports");
}

export function saveReports(items: ReportItem[]) {
  saveCollection(REPORTS_STORAGE_KEY, items, "operations.reports");
}

export function loadPendingItems() {
  return loadCollection<PendingItem>(PENDING_ITEMS_STORAGE_KEY, PENDING_ITEMS, "operations.pending");
}

export function savePendingItems(items: PendingItem[]) {
  saveCollection(PENDING_ITEMS_STORAGE_KEY, items, "operations.pending");
}

export function loadTasks() {
  return loadCollection<TaskItem>(TASKS_STORAGE_KEY, TASKS, "operations.tasks");
}

export function saveTasks(items: TaskItem[]) {
  saveCollection(TASKS_STORAGE_KEY, items, "operations.tasks");
}

export function loadDistributors() {
  return loadCollection<DistributorItem>(DISTRIBUTORS_STORAGE_KEY, DISTRIBUTORS, "operations.distributors");
}

export function saveDistributors(items: DistributorItem[]) {
  saveCollection(DISTRIBUTORS_STORAGE_KEY, items, "operations.distributors");
}

export function loadIncidents() {
  return loadCollection<IncidentItem>(INCIDENTS_STORAGE_KEY, INCIDENTS, "operations.incidents");
}

export function saveIncidents(items: IncidentItem[]) {
  saveCollection(INCIDENTS_STORAGE_KEY, items, "operations.incidents");
}

export function loadDocuments() {
  return loadCollection<DocumentItem>(DOCUMENTS_STORAGE_KEY, DOCUMENTS, "operations.documents");
}

export function saveDocuments(items: DocumentItem[]) {
  saveCollection(DOCUMENTS_STORAGE_KEY, items, "operations.documents");
}

export function loadCalendarEvents() {
  return loadCollection<CalendarItem>(CALENDAR_EVENTS_STORAGE_KEY, CALENDAR_EVENTS, "operations.calendar");
}

export function saveCalendarEvents(items: CalendarItem[]) {
  saveCollection(CALENDAR_EVENTS_STORAGE_KEY, items, "operations.calendar");
}
