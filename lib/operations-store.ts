import {
  dispatchErpDataEvent,
  dispatchErpResourceChangedEvent,
} from "@/lib/app-events";
import { erpQueryClient } from "@/lib/erp-query-client";
import {
  CALENDAR_TYPE_OPTIONS,
  CALENDAR_EVENTS,
  CATEGORIES,
  DISTRIBUTOR_STATUS_OPTIONS,
  DISTRIBUTORS,
  DOCUMENTS,
  INCIDENTS,
  INCIDENT_SEVERITY_OPTIONS,
  INCIDENT_STATUS_OPTIONS,
  LOTS,
  NOTIFICATIONS,
  NOTIFICATION_STATUS_OPTIONS,
  NOTIFICATION_TYPE_OPTIONS,
  PENDING_ITEMS,
  PLANNING_ITEMS,
  PRIORITY_OPTIONS,
  PRODUCT_LINES,
  PRODUCT_SPECIES_OPTIONS,
  PRODUCT_STATUS_OPTIONS,
  QUALITY_EVENTS,
  QUALITY_EVENT_STATUS_OPTIONS,
  REPORTS,
  SUPPLIER_STATUS_OPTIONS,
  SUPPLIERS,
  TASKS,
  TASK_STATUS_OPTIONS,
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
const QUALITY_EVENTS_ENDPOINT = "/api/erp/quality-events";
const INCIDENTS_ENDPOINT = "/api/erp/incidents";
const DOCUMENTS_ENDPOINT = "/api/erp/documents";
const TASKS_ENDPOINT = "/api/erp/tasks";
const PENDING_ENDPOINT = "/api/erp/pending";
const NOTIFICATIONS_ENDPOINT = "/api/erp/notifications";
const PLANNING_ENDPOINT = "/api/erp/planning";
const CALENDAR_ENDPOINT = "/api/erp/calendar";
const REPORTS_ENDPOINT = "/api/erp/reports";
const DISTRIBUTORS_ENDPOINT = "/api/erp/distributors";
const SUPPLIERS_ENDPOINT = "/api/erp/suppliers";
const CATEGORIES_ENDPOINT = "/api/erp/categories";
const DEDICATED_SYNC_CACHE_MS = 30_000;
const PRODUCTS_QUERY_RESOURCE = "operations.products";
const LOTS_QUERY_RESOURCE = "operations.lots";
const QUALITY_EVENTS_QUERY_RESOURCE = "operations.quality-events";
const INCIDENTS_QUERY_RESOURCE = "operations.incidents";
const DOCUMENTS_QUERY_RESOURCE = "operations.documents";
const TASKS_QUERY_RESOURCE = "operations.tasks";
const PENDING_QUERY_RESOURCE = "operations.pending";
const NOTIFICATIONS_QUERY_RESOURCE = "operations.notifications";
const PLANNING_QUERY_RESOURCE = "operations.planning";
const CALENDAR_QUERY_RESOURCE = "operations.calendar";
const REPORTS_QUERY_RESOURCE = "operations.reports";
const DISTRIBUTORS_QUERY_RESOURCE = "operations.distributors";
const SUPPLIERS_QUERY_RESOURCE = "operations.suppliers";
const CATEGORIES_QUERY_RESOURCE = "operations.categories";

type DedicatedSyncOptions = {
  force?: boolean;
};

export type VersionedProductLineItem = ProductLineItem & {
  version?: number;
  updatedAt?: string | null;
};

type VersionedLotItem = LotItem & {
  version?: number;
  updatedAt?: string | null;
};

export type VersionedQualityEventItem = QualityEventItem & {
  version?: number;
  updatedAt?: string | null;
};

export type VersionedIncidentItem = IncidentItem & {
  id: string;
  version?: number;
  updatedAt?: string | null;
};

export type VersionedDocumentItem = DocumentItem & {
  id: string;
  version?: number;
  versionUpdatedAt?: string | null;
};

export type VersionedTaskItem = TaskItem & {
  id: string;
  version?: number;
  updatedAt?: string | null;
};

export type VersionedPendingItem = PendingItem & {
  id: string;
  version?: number;
  updatedAt?: string | null;
};

export type VersionedNotificationItem = NotificationItem & {
  id: string;
  version?: number;
  updatedAt?: string | null;
};

export type VersionedPlanningItem = PlanningItem & {
  id: string;
  version?: number;
  updatedAt?: string | null;
};

export type VersionedCalendarEventItem = CalendarItem & {
  id: string;
  version?: number;
  updatedAt?: string | null;
};

export type VersionedReportItem = ReportItem & {
  id: string;
  version?: number;
  updatedAt?: string | null;
};

export type VersionedDistributorItem = DistributorItem & {
  id: string;
  version?: number;
  updatedAt?: string | null;
};

export type VersionedSupplierItem = SupplierItem & {
  id: string;
  version?: number;
  updatedAt?: string | null;
};

export type VersionedCategoryItem = CategoryItem & {
  id: string;
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

type QualityEventsListResponse = {
  items?: unknown;
  error?: unknown;
};

type QualityEventMutationResponse = {
  event?: unknown;
  error?: unknown;
  currentVersion?: unknown;
};

type IncidentsListResponse = {
  items?: unknown;
  error?: unknown;
};

type IncidentMutationResponse = {
  incident?: unknown;
  error?: unknown;
  currentVersion?: unknown;
};

type DocumentsListResponse = {
  items?: unknown;
  error?: unknown;
};

type DocumentMutationResponse = {
  document?: unknown;
  error?: unknown;
  currentVersion?: unknown;
};

type TasksListResponse = {
  items?: unknown;
  error?: unknown;
};

type TaskMutationResponse = {
  task?: unknown;
  error?: unknown;
  currentVersion?: unknown;
};

type PendingItemsListResponse = {
  items?: unknown;
  error?: unknown;
};

type PendingItemMutationResponse = {
  item?: unknown;
  error?: unknown;
  currentVersion?: unknown;
};

type NotificationsListResponse = {
  items?: unknown;
  error?: unknown;
};

type NotificationMutationResponse = {
  item?: unknown;
  error?: unknown;
  currentVersion?: unknown;
};

type PlanningItemsListResponse = {
  items?: unknown;
  error?: unknown;
};

type PlanningItemMutationResponse = {
  item?: unknown;
  error?: unknown;
  currentVersion?: unknown;
};

type CalendarEventsListResponse = {
  items?: unknown;
  error?: unknown;
};

type CalendarEventMutationResponse = {
  item?: unknown;
  error?: unknown;
  currentVersion?: unknown;
};

type ReportsListResponse = {
  items?: unknown;
  error?: unknown;
};

type ReportMutationResponse = {
  item?: unknown;
  error?: unknown;
  currentVersion?: unknown;
};

type DistributorsListResponse = {
  items?: unknown;
  error?: unknown;
};

type DistributorMutationResponse = {
  item?: unknown;
  error?: unknown;
  currentVersion?: unknown;
};

type SuppliersListResponse = {
  items?: unknown;
  error?: unknown;
};

type SupplierMutationResponse = {
  item?: unknown;
  error?: unknown;
  currentVersion?: unknown;
};

type CategoriesListResponse = {
  items?: unknown;
  error?: unknown;
};

type CategoryMutationResponse = {
  item?: unknown;
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

export class QualityEventRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "QualityEventRequestError";
    this.status = status;
  }
}

export class QualityEventVersionConflictError extends QualityEventRequestError {
  currentVersion: number;

  constructor(currentVersion: number) {
    super("VERSION_CONFLICT", 409);
    this.name = "QualityEventVersionConflictError";
    this.currentVersion = currentVersion;
  }
}

export class IncidentRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "IncidentRequestError";
    this.status = status;
  }
}

export class IncidentVersionConflictError extends IncidentRequestError {
  currentVersion: number;

  constructor(currentVersion: number) {
    super("VERSION_CONFLICT", 409);
    this.name = "IncidentVersionConflictError";
    this.currentVersion = currentVersion;
  }
}

export class DocumentRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DocumentRequestError";
    this.status = status;
  }
}

export class DocumentVersionConflictError extends DocumentRequestError {
  currentVersion: number;

  constructor(currentVersion: number) {
    super("VERSION_CONFLICT", 409);
    this.name = "DocumentVersionConflictError";
    this.currentVersion = currentVersion;
  }
}

export class TaskRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "TaskRequestError";
    this.status = status;
  }
}

export class TaskVersionConflictError extends TaskRequestError {
  currentVersion: number;

  constructor(currentVersion: number) {
    super("VERSION_CONFLICT", 409);
    this.name = "TaskVersionConflictError";
    this.currentVersion = currentVersion;
  }
}

export class PendingItemRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PendingItemRequestError";
    this.status = status;
  }
}

export class PendingItemVersionConflictError extends PendingItemRequestError {
  currentVersion: number;

  constructor(currentVersion: number) {
    super("VERSION_CONFLICT", 409);
    this.name = "PendingItemVersionConflictError";
    this.currentVersion = currentVersion;
  }
}

export class NotificationItemRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "NotificationItemRequestError";
    this.status = status;
  }
}

export class NotificationItemVersionConflictError extends NotificationItemRequestError {
  currentVersion: number;

  constructor(currentVersion: number) {
    super("VERSION_CONFLICT", 409);
    this.name = "NotificationItemVersionConflictError";
    this.currentVersion = currentVersion;
  }
}

export class PlanningItemRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PlanningItemRequestError";
    this.status = status;
  }
}

export class PlanningItemVersionConflictError extends PlanningItemRequestError {
  currentVersion: number;

  constructor(currentVersion: number) {
    super("VERSION_CONFLICT", 409);
    this.name = "PlanningItemVersionConflictError";
    this.currentVersion = currentVersion;
  }
}

export class CalendarEventRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CalendarEventRequestError";
    this.status = status;
  }
}

export class CalendarEventVersionConflictError extends CalendarEventRequestError {
  currentVersion: number;

  constructor(currentVersion: number) {
    super("VERSION_CONFLICT", 409);
    this.name = "CalendarEventVersionConflictError";
    this.currentVersion = currentVersion;
  }
}

export class ReportRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ReportRequestError";
    this.status = status;
  }
}

export class ReportVersionConflictError extends ReportRequestError {
  currentVersion: number;

  constructor(currentVersion: number) {
    super("VERSION_CONFLICT", 409);
    this.name = "ReportVersionConflictError";
    this.currentVersion = currentVersion;
  }
}

export class DistributorRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DistributorRequestError";
    this.status = status;
  }
}

export class DistributorVersionConflictError extends DistributorRequestError {
  currentVersion: number;

  constructor(currentVersion: number) {
    super("VERSION_CONFLICT", 409);
    this.name = "DistributorVersionConflictError";
    this.currentVersion = currentVersion;
  }
}

export class SupplierRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SupplierRequestError";
    this.status = status;
  }
}

export class SupplierVersionConflictError extends SupplierRequestError {
  currentVersion: number;

  constructor(currentVersion: number) {
    super("VERSION_CONFLICT", 409);
    this.name = "SupplierVersionConflictError";
    this.currentVersion = currentVersion;
  }
}

export class CategoryRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CategoryRequestError";
    this.status = status;
  }
}

export class CategoryVersionConflictError extends CategoryRequestError {
  currentVersion: number;

  constructor(currentVersion: number) {
    super("VERSION_CONFLICT", 409);
    this.name = "CategoryVersionConflictError";
    this.currentVersion = currentVersion;
  }
}

function cloneCollection<T>(items: readonly T[]) {
  return items.map((item) => ({ ...item }));
}

function isQualityEventStatus(
  value: unknown,
): value is QualityEventItem["status"] {
  return QUALITY_EVENT_STATUS_OPTIONS.includes(value as QualityEventItem["status"]);
}

function normalizeQualityEventItem(
  value: unknown,
): VersionedQualityEventItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    typeof item.title !== "string" ||
    typeof item.lot !== "string" ||
    typeof item.area !== "string" ||
    typeof item.owner !== "string" ||
    !isQualityEventStatus(item.status)
  ) {
    return null;
  }

  return {
    id: typeof item.id === "string" ? item.id : undefined,
    title: item.title,
    lot: item.lot,
    area: item.area,
    owner: item.owner,
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


function sortQualityEvents<TValue extends QualityEventItem>(items: TValue[]) {
  return [...items].sort((left, right) => {
    const byLot = left.lot.localeCompare(right.lot);
    return byLot === 0 ? left.title.localeCompare(right.title) : byLot;
  });
}

function readStoredQualityEvents() {
  if (typeof window === "undefined") {
    return cloneCollection(QUALITY_EVENTS) as VersionedQualityEventItem[];
  }

  const raw = window.localStorage.getItem(QUALITY_EVENTS_STORAGE_KEY);

  if (!raw) {
    return cloneCollection(QUALITY_EVENTS) as VersionedQualityEventItem[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return cloneCollection(QUALITY_EVENTS) as VersionedQualityEventItem[];
    }

    return parsed
      .map((item) => normalizeQualityEventItem(item))
      .filter((item): item is VersionedQualityEventItem => item !== null);
  } catch {
    return cloneCollection(QUALITY_EVENTS) as VersionedQualityEventItem[];
  }
}

function writeStoredQualityEvents(events: VersionedQualityEventItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  const sortedEvents = sortQualityEvents(events);
  const serializedEvents = JSON.stringify(sortedEvents);

  if (window.localStorage.getItem(QUALITY_EVENTS_STORAGE_KEY) === serializedEvents) {
    erpQueryClient.prime(QUALITY_EVENTS_QUERY_RESOURCE, sortedEvents);
    return;
  }

  window.localStorage.setItem(QUALITY_EVENTS_STORAGE_KEY, serializedEvents);
  erpQueryClient.prime(QUALITY_EVENTS_QUERY_RESOURCE, sortedEvents);
  dispatchErpResourceChangedEvent(QUALITY_EVENTS_QUERY_RESOURCE);
  dispatchErpDataEvent();
}

function upsertStoredQualityEvent(event: VersionedQualityEventItem) {
  const current = readStoredQualityEvents();

  writeStoredQualityEvents([
    event,
    ...current.filter((item) =>
      event.id ? item.id !== event.id : item.title !== event.title || item.lot !== event.lot,
    ),
  ]);
}

function removeStoredQualityEvent(eventId: string) {
  writeStoredQualityEvents(
    readStoredQualityEvents().filter((item) => item.id !== eventId),
  );
}

function getQualityEventResponseItems(
  payload: QualityEventsListResponse | QualityEventMutationResponse | null,
) {
  return payload && "items" in payload ? payload.items : undefined;
}

function getQualityEventResponseItem(
  payload: QualityEventsListResponse | QualityEventMutationResponse | null,
) {
  return payload && "event" in payload ? payload.event : undefined;
}

function stripQualityEventVersion<
  TValue extends VersionedQualityEventItem | Partial<VersionedQualityEventItem>,
>(event: TValue) {
  const payload = { ...event };
  delete payload.version;
  delete payload.updatedAt;
  return payload;
}

async function parseQualityEventApiPayload(
  response: Response,
  fallbackMessage: string,
) {
  const payload = (await response.json().catch(() => null)) as
    | QualityEventsListResponse
    | QualityEventMutationResponse
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
    throw new QualityEventVersionConflictError(currentVersion);
  }

  const message =
    payload && typeof payload.error === "string"
      ? payload.error
      : fallbackMessage;

  throw new QualityEventRequestError(message, response.status);
}

async function fetchQualityEventsFromServer() {
  const response = await fetch(QUALITY_EVENTS_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await parseQualityEventApiPayload(
    response,
    "Nao foi possivel carregar os eventos de qualidade.",
  );
  const items = getQualityEventResponseItems(payload);

  if (!Array.isArray(items)) {
    throw new QualityEventRequestError(
      "Resposta invalida ao carregar os eventos de qualidade.",
      response.status,
    );
  }

  const events = items
    .map((item) => normalizeQualityEventItem(item))
    .filter((item): item is VersionedQualityEventItem => item !== null);

  writeStoredQualityEvents(events);
  return events;
}

function syncQualityEventsFromServerInBackground(options?: DedicatedSyncOptions) {
  if (typeof window === "undefined") {
    return Promise.resolve(
      cloneCollection(QUALITY_EVENTS) as VersionedQualityEventItem[],
    );
  }

  return erpQueryClient.query(
    QUALITY_EVENTS_QUERY_RESOURCE,
    fetchQualityEventsFromServer,
    {
      force: options?.force,
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function refreshQualityEvents() {
  if (typeof window === "undefined") {
    return cloneCollection(QUALITY_EVENTS) as VersionedQualityEventItem[];
  }

  return erpQueryClient.refresh(
    QUALITY_EVENTS_QUERY_RESOURCE,
    fetchQualityEventsFromServer,
    {
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function createQualityEvent(event: QualityEventItem) {
  const response = await fetch(QUALITY_EVENTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event: stripQualityEventVersion(event),
    }),
  });
  const payload = await parseQualityEventApiPayload(
    response,
    "Nao foi possivel criar o evento de qualidade.",
  );
  const createdEvent = normalizeQualityEventItem(
    getQualityEventResponseItem(payload),
  );

  if (!createdEvent) {
    throw new QualityEventRequestError(
      "Resposta invalida ao criar o evento de qualidade.",
      response.status,
    );
  }

  upsertStoredQualityEvent(createdEvent);
  return createdEvent;
}

export async function updateQualityEvent(
  eventId: string,
  eventPatch: Partial<QualityEventItem>,
  baseVersion: number,
) {
  try {
    const response = await fetch(
      `${QUALITY_EVENTS_ENDPOINT}/${encodeURIComponent(eventId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event: stripQualityEventVersion(eventPatch),
          baseVersion,
        }),
      },
    );
    const payload = await parseQualityEventApiPayload(
      response,
      "Nao foi possivel atualizar o evento de qualidade.",
    );
    const updatedEvent = normalizeQualityEventItem(
      getQualityEventResponseItem(payload),
    );

    if (!updatedEvent) {
      throw new QualityEventRequestError(
        "Resposta invalida ao atualizar o evento de qualidade.",
        response.status,
      );
    }

    upsertStoredQualityEvent(updatedEvent);
    return updatedEvent;
  } catch (error) {
    if (error instanceof QualityEventVersionConflictError) {
      await refreshQualityEvents();
    }

    throw error;
  }
}

export async function deleteQualityEvent(
  eventId: string,
  baseVersion: number,
) {
  try {
    const response = await fetch(
      `${QUALITY_EVENTS_ENDPOINT}/${encodeURIComponent(eventId)}`,
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

    await parseQualityEventApiPayload(
      response,
      "Nao foi possivel excluir o evento de qualidade.",
    );
    removeStoredQualityEvent(eventId);
  } catch (error) {
    if (error instanceof QualityEventVersionConflictError) {
      await refreshQualityEvents();
    }

    throw error;
  }
}

function isIncidentSeverity(
  value: unknown,
): value is IncidentItem["severity"] {
  return INCIDENT_SEVERITY_OPTIONS.includes(value as IncidentItem["severity"]);
}

function isIncidentStatus(value: unknown): value is IncidentItem["status"] {
  return INCIDENT_STATUS_OPTIONS.includes(value as IncidentItem["status"]);
}

function normalizeIncidentItem(value: unknown): VersionedIncidentItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    typeof item.title !== "string" ||
    typeof item.area !== "string" ||
    typeof item.owner !== "string" ||
    !isIncidentSeverity(item.severity) ||
    !isIncidentStatus(item.status)
  ) {
    return null;
  }

  return {
    id: typeof item.id === "string" ? item.id : undefined,
    title: item.title,
    area: item.area,
    severity: item.severity,
    owner: item.owner,
    status: item.status,
    version:
      typeof item.version === "number" &&
      Number.isInteger(item.version) &&
      item.version >= 1
        ? item.version
        : undefined,
    updatedAt:
      typeof item.updatedAt === "string" ? item.updatedAt : undefined,
  } as VersionedIncidentItem;
}

function sortIncidents<TValue extends IncidentItem>(items: TValue[]) {
  return [...items].sort((left, right) => {
    const bySeverity = left.severity.localeCompare(right.severity);
    return bySeverity === 0 ? left.title.localeCompare(right.title) : bySeverity;
  });
}

function readStoredIncidents() {
  if (typeof window === "undefined") {
    return cloneCollection(INCIDENTS) as VersionedIncidentItem[];
  }

  const raw = window.localStorage.getItem(INCIDENTS_STORAGE_KEY);

  if (!raw) {
    return cloneCollection(INCIDENTS) as VersionedIncidentItem[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return cloneCollection(INCIDENTS) as VersionedIncidentItem[];
    }

    return parsed
      .map((item) => normalizeIncidentItem(item))
      .filter((item): item is VersionedIncidentItem => item !== null);
  } catch {
    return cloneCollection(INCIDENTS) as VersionedIncidentItem[];
  }
}

function writeStoredIncidents(incidents: VersionedIncidentItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  const sortedIncidents = sortIncidents(incidents);
  const serializedIncidents = JSON.stringify(sortedIncidents);

  if (window.localStorage.getItem(INCIDENTS_STORAGE_KEY) === serializedIncidents) {
    erpQueryClient.prime(INCIDENTS_QUERY_RESOURCE, sortedIncidents);
    return;
  }

  window.localStorage.setItem(INCIDENTS_STORAGE_KEY, serializedIncidents);
  erpQueryClient.prime(INCIDENTS_QUERY_RESOURCE, sortedIncidents);
  dispatchErpResourceChangedEvent(INCIDENTS_QUERY_RESOURCE);
  dispatchErpDataEvent();
}

function upsertStoredIncident(incident: VersionedIncidentItem) {
  const current = readStoredIncidents();

  writeStoredIncidents([
    incident,
    ...current.filter((item) =>
      incident.id ? item.id !== incident.id : item.title !== incident.title,
    ),
  ]);
}

function removeStoredIncident(incidentId: string) {
  writeStoredIncidents(
    readStoredIncidents().filter((item) => item.id !== incidentId),
  );
}

function getIncidentResponseItems(
  payload: IncidentsListResponse | IncidentMutationResponse | null,
) {
  return payload && "items" in payload ? payload.items : undefined;
}

function getIncidentResponseItem(
  payload: IncidentsListResponse | IncidentMutationResponse | null,
) {
  return payload && "incident" in payload ? payload.incident : undefined;
}

function stripIncidentVersion<
  TValue extends VersionedIncidentItem | Partial<VersionedIncidentItem>,
>(incident: TValue) {
  const payload = { ...incident };
  delete payload.version;
  delete payload.updatedAt;
  return payload;
}

async function parseIncidentApiPayload(
  response: Response,
  fallbackMessage: string,
) {
  const payload = (await response.json().catch(() => null)) as
    | IncidentsListResponse
    | IncidentMutationResponse
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
    throw new IncidentVersionConflictError(currentVersion);
  }

  const message =
    payload && typeof payload.error === "string"
      ? payload.error
      : fallbackMessage;

  throw new IncidentRequestError(message, response.status);
}

async function fetchIncidentsFromServer() {
  const response = await fetch(INCIDENTS_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await parseIncidentApiPayload(
    response,
    "Nao foi possivel carregar os incidentes.",
  );
  const items = getIncidentResponseItems(payload);

  if (!Array.isArray(items)) {
    throw new IncidentRequestError(
      "Resposta invalida ao carregar os incidentes.",
      response.status,
    );
  }

  const incidents = items
    .map((item) => normalizeIncidentItem(item))
    .filter((item): item is VersionedIncidentItem => item !== null);

  writeStoredIncidents(incidents);
  return incidents;
}

function syncIncidentsFromServerInBackground(options?: DedicatedSyncOptions) {
  if (typeof window === "undefined") {
    return Promise.resolve(
      cloneCollection(INCIDENTS) as VersionedIncidentItem[],
    );
  }

  return erpQueryClient.query(
    INCIDENTS_QUERY_RESOURCE,
    fetchIncidentsFromServer,
    {
      force: options?.force,
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function refreshIncidents() {
  if (typeof window === "undefined") {
    return cloneCollection(INCIDENTS) as VersionedIncidentItem[];
  }

  return erpQueryClient.refresh(
    INCIDENTS_QUERY_RESOURCE,
    fetchIncidentsFromServer,
    {
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function createIncident(incident: IncidentItem) {
  const response = await fetch(INCIDENTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      incident: stripIncidentVersion(incident),
    }),
  });
  const payload = await parseIncidentApiPayload(
    response,
    "Nao foi possivel criar o incidente.",
  );
  const createdIncident = normalizeIncidentItem(
    getIncidentResponseItem(payload),
  );

  if (!createdIncident) {
    throw new IncidentRequestError(
      "Resposta invalida ao criar o incidente.",
      response.status,
    );
  }

  upsertStoredIncident(createdIncident);
  return createdIncident;
}

export async function updateIncident(
  incidentId: string,
  incidentPatch: Partial<IncidentItem>,
  baseVersion: number,
) {
  try {
    const response = await fetch(
      `${INCIDENTS_ENDPOINT}/${encodeURIComponent(incidentId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          incident: stripIncidentVersion(incidentPatch),
          baseVersion,
        }),
      },
    );
    const payload = await parseIncidentApiPayload(
      response,
      "Nao foi possivel atualizar o incidente.",
    );
    const updatedIncident = normalizeIncidentItem(
      getIncidentResponseItem(payload),
    );

    if (!updatedIncident) {
      throw new IncidentRequestError(
        "Resposta invalida ao atualizar o incidente.",
        response.status,
      );
    }

    upsertStoredIncident(updatedIncident);
    return updatedIncident;
  } catch (error) {
    if (error instanceof IncidentVersionConflictError) {
      await refreshIncidents();
    }

    throw error;
  }
}

export async function deleteIncident(
  incidentId: string,
  baseVersion: number,
) {
  try {
    const response = await fetch(
      `${INCIDENTS_ENDPOINT}/${encodeURIComponent(incidentId)}`,
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

    await parseIncidentApiPayload(
      response,
      "Nao foi possivel excluir o incidente.",
    );
    removeStoredIncident(incidentId);
  } catch (error) {
    if (error instanceof IncidentVersionConflictError) {
      await refreshIncidents();
    }

    throw error;
  }
}

function isPendingPriority(value: unknown): value is PendingItem["priority"] {
  return PRIORITY_OPTIONS.includes(value as PendingItem["priority"]);
}

function normalizePendingItem(value: unknown): VersionedPendingItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    typeof item.title !== "string" ||
    typeof item.owner !== "string" ||
    typeof item.area !== "string" ||
    typeof item.due !== "string" ||
    !isPendingPriority(item.priority)
  ) {
    return null;
  }

  return {
    id: typeof item.id === "string" ? item.id : undefined,
    title: item.title,
    owner: item.owner,
    area: item.area,
    due: item.due,
    priority: item.priority,
    version:
      typeof item.version === "number" &&
      Number.isInteger(item.version) &&
      item.version >= 1
        ? item.version
        : undefined,
    updatedAt:
      typeof item.updatedAt === "string" ? item.updatedAt : undefined,
  } as VersionedPendingItem;
}

function sortPendingItems<TValue extends PendingItem>(items: TValue[]) {
  return [...items].sort((left, right) => {
    const byPriority = left.priority.localeCompare(right.priority);
    return byPriority === 0 ? left.title.localeCompare(right.title) : byPriority;
  });
}

function readStoredPendingItems() {
  if (typeof window === "undefined") {
    return cloneCollection(PENDING_ITEMS) as VersionedPendingItem[];
  }

  const raw = window.localStorage.getItem(PENDING_ITEMS_STORAGE_KEY);

  if (!raw) {
    return cloneCollection(PENDING_ITEMS) as VersionedPendingItem[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return cloneCollection(PENDING_ITEMS) as VersionedPendingItem[];
    }

    return parsed
      .map((item) => normalizePendingItem(item))
      .filter((item): item is VersionedPendingItem => item !== null);
  } catch {
    return cloneCollection(PENDING_ITEMS) as VersionedPendingItem[];
  }
}

function writeStoredPendingItems(items: VersionedPendingItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  const sortedItems = sortPendingItems(items);
  const serializedItems = JSON.stringify(sortedItems);

  if (window.localStorage.getItem(PENDING_ITEMS_STORAGE_KEY) === serializedItems) {
    erpQueryClient.prime(PENDING_QUERY_RESOURCE, sortedItems);
    return;
  }

  window.localStorage.setItem(PENDING_ITEMS_STORAGE_KEY, serializedItems);
  erpQueryClient.prime(PENDING_QUERY_RESOURCE, sortedItems);
  dispatchErpResourceChangedEvent(PENDING_QUERY_RESOURCE);
  dispatchErpDataEvent();
}

function upsertStoredPendingItem(item: VersionedPendingItem) {
  const current = readStoredPendingItems();

  writeStoredPendingItems([
    item,
    ...current.filter((currentItem) =>
      item.id ? currentItem.id !== item.id : currentItem.title !== item.title,
    ),
  ]);
}

function removeStoredPendingItem(pendingId: string) {
  writeStoredPendingItems(
    readStoredPendingItems().filter((item) => item.id !== pendingId),
  );
}

function getPendingResponseItems(
  payload: PendingItemsListResponse | PendingItemMutationResponse | null,
) {
  return payload && "items" in payload ? payload.items : undefined;
}

function getPendingResponseItem(
  payload: PendingItemsListResponse | PendingItemMutationResponse | null,
) {
  return payload && "item" in payload ? payload.item : undefined;
}

function stripPendingVersion<
  TValue extends VersionedPendingItem | Partial<VersionedPendingItem>,
>(item: TValue) {
  const payload = { ...item };
  delete payload.version;
  delete payload.updatedAt;
  return payload;
}

async function parsePendingApiPayload(
  response: Response,
  fallbackMessage: string,
) {
  const payload = (await response.json().catch(() => null)) as
    | PendingItemsListResponse
    | PendingItemMutationResponse
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
    throw new PendingItemVersionConflictError(currentVersion);
  }

  const message =
    payload && typeof payload.error === "string"
      ? payload.error
      : fallbackMessage;

  throw new PendingItemRequestError(message, response.status);
}

async function fetchPendingItemsFromServer() {
  const response = await fetch(PENDING_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await parsePendingApiPayload(
    response,
    "Nao foi possivel carregar as pendencias.",
  );
  const items = getPendingResponseItems(payload);

  if (!Array.isArray(items)) {
    throw new PendingItemRequestError(
      "Resposta invalida ao carregar as pendencias.",
      response.status,
    );
  }

  const pendingItems = items
    .map((item) => normalizePendingItem(item))
    .filter((item): item is VersionedPendingItem => item !== null);

  writeStoredPendingItems(pendingItems);
  return pendingItems;
}

function syncPendingItemsFromServerInBackground(options?: DedicatedSyncOptions) {
  if (typeof window === "undefined") {
    return Promise.resolve(
      cloneCollection(PENDING_ITEMS) as VersionedPendingItem[],
    );
  }

  return erpQueryClient.query(
    PENDING_QUERY_RESOURCE,
    fetchPendingItemsFromServer,
    {
      force: options?.force,
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function refreshPendingItems() {
  if (typeof window === "undefined") {
    return cloneCollection(PENDING_ITEMS) as VersionedPendingItem[];
  }

  return erpQueryClient.refresh(
    PENDING_QUERY_RESOURCE,
    fetchPendingItemsFromServer,
    {
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function createPendingItem(item: PendingItem) {
  const response = await fetch(PENDING_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      item: stripPendingVersion(item),
    }),
  });
  const payload = await parsePendingApiPayload(
    response,
    "Nao foi possivel criar a pendencia.",
  );
  const createdItem = normalizePendingItem(getPendingResponseItem(payload));

  if (!createdItem) {
    throw new PendingItemRequestError(
      "Resposta invalida ao criar a pendencia.",
      response.status,
    );
  }

  upsertStoredPendingItem(createdItem);
  return createdItem;
}

export async function updatePendingItem(
  pendingId: string,
  itemPatch: Partial<PendingItem>,
  baseVersion: number,
) {
  try {
    const response = await fetch(
      `${PENDING_ENDPOINT}/${encodeURIComponent(pendingId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item: stripPendingVersion(itemPatch),
          baseVersion,
        }),
      },
    );
    const payload = await parsePendingApiPayload(
      response,
      "Nao foi possivel atualizar a pendencia.",
    );
    const updatedItem = normalizePendingItem(getPendingResponseItem(payload));

    if (!updatedItem) {
      throw new PendingItemRequestError(
        "Resposta invalida ao atualizar a pendencia.",
        response.status,
      );
    }

    upsertStoredPendingItem(updatedItem);
    return updatedItem;
  } catch (error) {
    if (error instanceof PendingItemVersionConflictError) {
      await refreshPendingItems();
    }

    throw error;
  }
}

export async function deletePendingItem(
  pendingId: string,
  baseVersion: number,
) {
  try {
    const response = await fetch(
      `${PENDING_ENDPOINT}/${encodeURIComponent(pendingId)}`,
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

    await parsePendingApiPayload(
      response,
      "Nao foi possivel excluir a pendencia.",
    );
    removeStoredPendingItem(pendingId);
  } catch (error) {
    if (error instanceof PendingItemVersionConflictError) {
      await refreshPendingItems();
    }

    throw error;
  }
}

function isTaskStatus(value: unknown): value is TaskItem["status"] {
  return TASK_STATUS_OPTIONS.includes(value as TaskItem["status"]);
}

function normalizeTaskItem(value: unknown): VersionedTaskItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    typeof item.title !== "string" ||
    typeof item.shift !== "string" ||
    typeof item.owner !== "string" ||
    typeof item.checklist !== "number" ||
    !Number.isFinite(item.checklist) ||
    typeof item.completed !== "number" ||
    !Number.isFinite(item.completed) ||
    !isTaskStatus(item.status)
  ) {
    return null;
  }

  return {
    id: typeof item.id === "string" ? item.id : undefined,
    title: item.title,
    shift: item.shift,
    owner: item.owner,
    checklist: item.checklist,
    completed: item.completed,
    status: item.status,
    version:
      typeof item.version === "number" &&
      Number.isInteger(item.version) &&
      item.version >= 1
        ? item.version
        : undefined,
    updatedAt:
      typeof item.updatedAt === "string" ? item.updatedAt : undefined,
  } as VersionedTaskItem;
}

function sortTasks<TValue extends TaskItem>(items: TValue[]) {
  return [...items].sort((left, right) => {
    const byShift = left.shift.localeCompare(right.shift);
    return byShift === 0 ? left.title.localeCompare(right.title) : byShift;
  });
}

function readStoredTasks() {
  if (typeof window === "undefined") {
    return cloneCollection(TASKS) as VersionedTaskItem[];
  }

  const raw = window.localStorage.getItem(TASKS_STORAGE_KEY);

  if (!raw) {
    return cloneCollection(TASKS) as VersionedTaskItem[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return cloneCollection(TASKS) as VersionedTaskItem[];
    }

    return parsed
      .map((item) => normalizeTaskItem(item))
      .filter((item): item is VersionedTaskItem => item !== null);
  } catch {
    return cloneCollection(TASKS) as VersionedTaskItem[];
  }
}

function writeStoredTasks(tasks: VersionedTaskItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  const sortedTasks = sortTasks(tasks);
  const serializedTasks = JSON.stringify(sortedTasks);

  if (window.localStorage.getItem(TASKS_STORAGE_KEY) === serializedTasks) {
    erpQueryClient.prime(TASKS_QUERY_RESOURCE, sortedTasks);
    return;
  }

  window.localStorage.setItem(TASKS_STORAGE_KEY, serializedTasks);
  erpQueryClient.prime(TASKS_QUERY_RESOURCE, sortedTasks);
  dispatchErpResourceChangedEvent(TASKS_QUERY_RESOURCE);
  dispatchErpDataEvent();
}

function upsertStoredTask(task: VersionedTaskItem) {
  const current = readStoredTasks();

  writeStoredTasks([
    task,
    ...current.filter((item) =>
      task.id ? item.id !== task.id : item.title !== task.title,
    ),
  ]);
}

function removeStoredTask(taskId: string) {
  writeStoredTasks(readStoredTasks().filter((item) => item.id !== taskId));
}

function getTaskResponseItems(
  payload: TasksListResponse | TaskMutationResponse | null,
) {
  return payload && "items" in payload ? payload.items : undefined;
}

function getTaskResponseItem(
  payload: TasksListResponse | TaskMutationResponse | null,
) {
  return payload && "task" in payload ? payload.task : undefined;
}

function stripTaskVersion<
  TValue extends VersionedTaskItem | Partial<VersionedTaskItem>,
>(task: TValue) {
  const payload = { ...task };
  delete payload.version;
  delete payload.updatedAt;
  return payload;
}

async function parseTaskApiPayload(
  response: Response,
  fallbackMessage: string,
) {
  const payload = (await response.json().catch(() => null)) as
    | TasksListResponse
    | TaskMutationResponse
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
    throw new TaskVersionConflictError(currentVersion);
  }

  const message =
    payload && typeof payload.error === "string"
      ? payload.error
      : fallbackMessage;

  throw new TaskRequestError(message, response.status);
}

async function fetchTasksFromServer() {
  const response = await fetch(TASKS_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await parseTaskApiPayload(
    response,
    "Nao foi possivel carregar as tarefas.",
  );
  const items = getTaskResponseItems(payload);

  if (!Array.isArray(items)) {
    throw new TaskRequestError(
      "Resposta invalida ao carregar as tarefas.",
      response.status,
    );
  }

  const tasks = items
    .map((item) => normalizeTaskItem(item))
    .filter((item): item is VersionedTaskItem => item !== null);

  writeStoredTasks(tasks);
  return tasks;
}

function syncTasksFromServerInBackground(options?: DedicatedSyncOptions) {
  if (typeof window === "undefined") {
    return Promise.resolve(cloneCollection(TASKS) as VersionedTaskItem[]);
  }

  return erpQueryClient.query(
    TASKS_QUERY_RESOURCE,
    fetchTasksFromServer,
    {
      force: options?.force,
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function refreshTasks() {
  if (typeof window === "undefined") {
    return cloneCollection(TASKS) as VersionedTaskItem[];
  }

  return erpQueryClient.refresh(
    TASKS_QUERY_RESOURCE,
    fetchTasksFromServer,
    {
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function createTask(task: TaskItem) {
  const response = await fetch(TASKS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      task: stripTaskVersion(task),
    }),
  });
  const payload = await parseTaskApiPayload(
    response,
    "Nao foi possivel criar a tarefa.",
  );
  const createdTask = normalizeTaskItem(getTaskResponseItem(payload));

  if (!createdTask) {
    throw new TaskRequestError(
      "Resposta invalida ao criar a tarefa.",
      response.status,
    );
  }

  upsertStoredTask(createdTask);
  return createdTask;
}

export async function updateTask(
  taskId: string,
  taskPatch: Partial<TaskItem>,
  baseVersion: number,
) {
  try {
    const response = await fetch(
      `${TASKS_ENDPOINT}/${encodeURIComponent(taskId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task: stripTaskVersion(taskPatch),
          baseVersion,
        }),
      },
    );
    const payload = await parseTaskApiPayload(
      response,
      "Nao foi possivel atualizar a tarefa.",
    );
    const updatedTask = normalizeTaskItem(getTaskResponseItem(payload));

    if (!updatedTask) {
      throw new TaskRequestError(
        "Resposta invalida ao atualizar a tarefa.",
        response.status,
      );
    }

    upsertStoredTask(updatedTask);
    return updatedTask;
  } catch (error) {
    if (error instanceof TaskVersionConflictError) {
      await refreshTasks();
    }

    throw error;
  }
}

export async function deleteTask(taskId: string, baseVersion: number) {
  try {
    const response = await fetch(
      `${TASKS_ENDPOINT}/${encodeURIComponent(taskId)}`,
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

    await parseTaskApiPayload(response, "Nao foi possivel excluir a tarefa.");
    removeStoredTask(taskId);
  } catch (error) {
    if (error instanceof TaskVersionConflictError) {
      await refreshTasks();
    }

    throw error;
  }
}

function normalizeDocumentItem(value: unknown): VersionedDocumentItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    typeof item.title !== "string" ||
    typeof item.type !== "string" ||
    typeof item.area !== "string" ||
    typeof item.updatedAt !== "string" ||
    typeof item.owner !== "string"
  ) {
    return null;
  }

  return {
    id: typeof item.id === "string" ? item.id : undefined,
    title: item.title,
    type: item.type,
    area: item.area,
    updatedAt: item.updatedAt,
    owner: item.owner,
    version:
      typeof item.version === "number" &&
      Number.isInteger(item.version) &&
      item.version >= 1
        ? item.version
        : undefined,
    versionUpdatedAt:
      typeof item.versionUpdatedAt === "string"
        ? item.versionUpdatedAt
        : undefined,
  } as VersionedDocumentItem;
}

function sortDocuments<TValue extends DocumentItem>(items: TValue[]) {
  return [...items].sort((left, right) => {
    const byType = left.type.localeCompare(right.type);
    return byType === 0 ? left.title.localeCompare(right.title) : byType;
  });
}

function readStoredDocuments() {
  if (typeof window === "undefined") {
    return cloneCollection(DOCUMENTS) as VersionedDocumentItem[];
  }

  const raw = window.localStorage.getItem(DOCUMENTS_STORAGE_KEY);

  if (!raw) {
    return cloneCollection(DOCUMENTS) as VersionedDocumentItem[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return cloneCollection(DOCUMENTS) as VersionedDocumentItem[];
    }

    return parsed
      .map((item) => normalizeDocumentItem(item))
      .filter((item): item is VersionedDocumentItem => item !== null);
  } catch {
    return cloneCollection(DOCUMENTS) as VersionedDocumentItem[];
  }
}

function writeStoredDocuments(documents: VersionedDocumentItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  const sortedDocuments = sortDocuments(documents);
  const serializedDocuments = JSON.stringify(sortedDocuments);

  if (window.localStorage.getItem(DOCUMENTS_STORAGE_KEY) === serializedDocuments) {
    erpQueryClient.prime(DOCUMENTS_QUERY_RESOURCE, sortedDocuments);
    return;
  }

  window.localStorage.setItem(DOCUMENTS_STORAGE_KEY, serializedDocuments);
  erpQueryClient.prime(DOCUMENTS_QUERY_RESOURCE, sortedDocuments);
  dispatchErpResourceChangedEvent(DOCUMENTS_QUERY_RESOURCE);
  dispatchErpDataEvent();
}

function upsertStoredDocument(document: VersionedDocumentItem) {
  const current = readStoredDocuments();

  writeStoredDocuments([
    document,
    ...current.filter((item) =>
      document.id ? item.id !== document.id : item.title !== document.title,
    ),
  ]);
}

function removeStoredDocument(documentId: string) {
  writeStoredDocuments(
    readStoredDocuments().filter((item) => item.id !== documentId),
  );
}

function getDocumentResponseItems(
  payload: DocumentsListResponse | DocumentMutationResponse | null,
) {
  return payload && "items" in payload ? payload.items : undefined;
}

function getDocumentResponseItem(
  payload: DocumentsListResponse | DocumentMutationResponse | null,
) {
  return payload && "document" in payload ? payload.document : undefined;
}

function stripDocumentVersion<
  TValue extends VersionedDocumentItem | Partial<VersionedDocumentItem>,
>(document: TValue) {
  const payload = { ...document };
  delete payload.version;
  delete payload.versionUpdatedAt;
  return payload;
}

async function parseDocumentApiPayload(
  response: Response,
  fallbackMessage: string,
) {
  const payload = (await response.json().catch(() => null)) as
    | DocumentsListResponse
    | DocumentMutationResponse
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
    throw new DocumentVersionConflictError(currentVersion);
  }

  const message =
    payload && typeof payload.error === "string"
      ? payload.error
      : fallbackMessage;

  throw new DocumentRequestError(message, response.status);
}

async function fetchDocumentsFromServer() {
  const response = await fetch(DOCUMENTS_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await parseDocumentApiPayload(
    response,
    "Nao foi possivel carregar os documentos.",
  );
  const items = getDocumentResponseItems(payload);

  if (!Array.isArray(items)) {
    throw new DocumentRequestError(
      "Resposta invalida ao carregar os documentos.",
      response.status,
    );
  }

  const documents = items
    .map((item) => normalizeDocumentItem(item))
    .filter((item): item is VersionedDocumentItem => item !== null);

  writeStoredDocuments(documents);
  return documents;
}

function syncDocumentsFromServerInBackground(options?: DedicatedSyncOptions) {
  if (typeof window === "undefined") {
    return Promise.resolve(cloneCollection(DOCUMENTS) as VersionedDocumentItem[]);
  }

  return erpQueryClient.query(
    DOCUMENTS_QUERY_RESOURCE,
    fetchDocumentsFromServer,
    {
      force: options?.force,
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function refreshDocuments() {
  if (typeof window === "undefined") {
    return cloneCollection(DOCUMENTS) as VersionedDocumentItem[];
  }

  return erpQueryClient.refresh(
    DOCUMENTS_QUERY_RESOURCE,
    fetchDocumentsFromServer,
    {
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function createDocument(document: DocumentItem) {
  const response = await fetch(DOCUMENTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      document: stripDocumentVersion(document),
    }),
  });
  const payload = await parseDocumentApiPayload(
    response,
    "Nao foi possivel criar o documento.",
  );
  const createdDocument = normalizeDocumentItem(
    getDocumentResponseItem(payload),
  );

  if (!createdDocument) {
    throw new DocumentRequestError(
      "Resposta invalida ao criar o documento.",
      response.status,
    );
  }

  upsertStoredDocument(createdDocument);
  return createdDocument;
}

export async function updateDocument(
  documentId: string,
  documentPatch: Partial<DocumentItem>,
  baseVersion: number,
) {
  try {
    const response = await fetch(
      `${DOCUMENTS_ENDPOINT}/${encodeURIComponent(documentId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document: stripDocumentVersion(documentPatch),
          baseVersion,
        }),
      },
    );
    const payload = await parseDocumentApiPayload(
      response,
      "Nao foi possivel atualizar o documento.",
    );
    const updatedDocument = normalizeDocumentItem(
      getDocumentResponseItem(payload),
    );

    if (!updatedDocument) {
      throw new DocumentRequestError(
        "Resposta invalida ao atualizar o documento.",
        response.status,
      );
    }

    upsertStoredDocument(updatedDocument);
    return updatedDocument;
  } catch (error) {
    if (error instanceof DocumentVersionConflictError) {
      await refreshDocuments();
    }

    throw error;
  }
}

export async function deleteDocument(
  documentId: string,
  baseVersion: number,
) {
  try {
    const response = await fetch(
      `${DOCUMENTS_ENDPOINT}/${encodeURIComponent(documentId)}`,
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

    await parseDocumentApiPayload(
      response,
      "Nao foi possivel excluir o documento.",
    );
    removeStoredDocument(documentId);
  } catch (error) {
    if (error instanceof DocumentVersionConflictError) {
      await refreshDocuments();
    }

    throw error;
  }
}

function normalizeProductSku(value: string) {
  return value.trim().toUpperCase();
}

function isProductSpecies(value: unknown): value is ProductLineItem["species"] {
  return PRODUCT_SPECIES_OPTIONS.includes(value as ProductLineItem["species"]);
}

function isProductStatus(value: unknown): value is ProductLineItem["status"] {
  return PRODUCT_STATUS_OPTIONS.includes(value as ProductLineItem["status"]);
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

  const sortedProducts = sortProducts(products);
  const serializedProducts = JSON.stringify(sortedProducts);

  if (window.localStorage.getItem(PRODUCT_LINES_STORAGE_KEY) === serializedProducts) {
    return;
  }

  window.localStorage.setItem(PRODUCT_LINES_STORAGE_KEY, serializedProducts);
  erpQueryClient.prime(PRODUCTS_QUERY_RESOURCE, sortedProducts);
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

function syncProductsFromServerInBackground(options?: DedicatedSyncOptions) {
  if (typeof window === "undefined") {
    return Promise.resolve(
      cloneCollection(PRODUCT_LINES) as VersionedProductLineItem[],
    );
  }

  return erpQueryClient.query(
    PRODUCTS_QUERY_RESOURCE,
    fetchProductsFromServer,
    {
      force: options?.force,
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function refreshProductLines() {
  if (typeof window === "undefined") {
    return cloneCollection(PRODUCT_LINES) as VersionedProductLineItem[];
  }

  return erpQueryClient.refresh(
    PRODUCTS_QUERY_RESOURCE,
    fetchProductsFromServer,
    {
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
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

  const sortedLots = sortLots(lots);
  const serializedLots = JSON.stringify(sortedLots);

  if (window.localStorage.getItem(LOTS_STORAGE_KEY) === serializedLots) {
    erpQueryClient.prime(LOTS_QUERY_RESOURCE, sortedLots);
    return;
  }

  window.localStorage.setItem(LOTS_STORAGE_KEY, serializedLots);
  erpQueryClient.prime(LOTS_QUERY_RESOURCE, sortedLots);
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

function syncLotsFromServerInBackground(options?: DedicatedSyncOptions) {
  if (typeof window === "undefined") {
    return Promise.resolve(cloneCollection(LOTS));
  }

  return erpQueryClient.query(
    LOTS_QUERY_RESOURCE,
    fetchLotsFromServer,
    {
      force: options?.force,
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function refreshLots() {
  if (typeof window === "undefined") {
    return cloneCollection(LOTS);
  }

  return erpQueryClient.refresh(
    LOTS_QUERY_RESOURCE,
    fetchLotsFromServer,
    {
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
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

function isSupplierStatus(value: unknown): value is SupplierItem["status"] {
  return SUPPLIER_STATUS_OPTIONS.includes(value as SupplierItem["status"]);
}

function normalizeSupplierItem(
  value: unknown,
): VersionedSupplierItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    (item.id !== undefined && typeof item.id !== "string") ||
    typeof item.name !== "string" ||
    typeof item.category !== "string" ||
    typeof item.city !== "string" ||
    typeof item.leadTimeDays !== "number" ||
    !Number.isFinite(item.leadTimeDays) ||
    typeof item.score !== "number" ||
    !Number.isFinite(item.score) ||
    !isSupplierStatus(item.status)
  ) {
    return null;
  }

  return {
    id: typeof item.id === "string" ? item.id : undefined,
    name: item.name,
    category: item.category,
    city: item.city,
    leadTimeDays: item.leadTimeDays,
    score: item.score,
    status: item.status,
    version:
      typeof item.version === "number" &&
      Number.isInteger(item.version) &&
      item.version >= 1
        ? item.version
        : undefined,
    updatedAt:
      typeof item.updatedAt === "string" ? item.updatedAt : undefined,
  } as VersionedSupplierItem;
}

function readStoredSuppliers() {
  if (typeof window === "undefined") {
    return cloneCollection(SUPPLIERS) as VersionedSupplierItem[];
  }

  const raw = window.localStorage.getItem(SUPPLIERS_STORAGE_KEY);

  if (!raw) {
    return cloneCollection(SUPPLIERS) as VersionedSupplierItem[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return cloneCollection(SUPPLIERS) as VersionedSupplierItem[];
    }

    return parsed
      .map((item) => normalizeSupplierItem(item))
      .filter((item): item is VersionedSupplierItem => item !== null);
  } catch {
    return cloneCollection(SUPPLIERS) as VersionedSupplierItem[];
  }
}

function writeStoredSuppliers(items: VersionedSupplierItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  const serializedItems = JSON.stringify(items);

  if (
    window.localStorage.getItem(SUPPLIERS_STORAGE_KEY) === serializedItems
  ) {
    erpQueryClient.prime(SUPPLIERS_QUERY_RESOURCE, items);
    return;
  }

  window.localStorage.setItem(SUPPLIERS_STORAGE_KEY, serializedItems);
  erpQueryClient.prime(SUPPLIERS_QUERY_RESOURCE, items);
  dispatchErpResourceChangedEvent(SUPPLIERS_QUERY_RESOURCE);
  dispatchErpDataEvent();
}

function upsertStoredSupplier(item: VersionedSupplierItem) {
  const current = readStoredSuppliers();
  const existingIndex = current.findIndex(
    (currentItem) => currentItem.id === item.id,
  );

  if (existingIndex === -1) {
    writeStoredSuppliers([item, ...current]);
    return;
  }

  const nextItems = [...current];
  nextItems[existingIndex] = item;
  writeStoredSuppliers(nextItems);
}

function removeStoredSupplier(supplierId: string) {
  writeStoredSuppliers(
    readStoredSuppliers().filter((item) => item.id !== supplierId),
  );
}

function getSuppliersResponseItems(
  payload: SuppliersListResponse | SupplierMutationResponse | null,
) {
  return payload && "items" in payload ? payload.items : undefined;
}

function getSupplierResponseItem(
  payload: SuppliersListResponse | SupplierMutationResponse | null,
) {
  return payload && "item" in payload ? payload.item : undefined;
}

function stripSupplierVersion<
  TValue extends VersionedSupplierItem | Partial<VersionedSupplierItem>,
>(item: TValue) {
  const payload = { ...item };
  delete payload.version;
  delete payload.updatedAt;
  return payload;
}

async function parseSupplierApiPayload(
  response: Response,
  fallbackMessage: string,
) {
  const payload = (await response.json().catch(() => null)) as
    | SuppliersListResponse
    | SupplierMutationResponse
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
    throw new SupplierVersionConflictError(currentVersion);
  }

  const message =
    payload && typeof payload.error === "string"
      ? payload.error
      : fallbackMessage;

  throw new SupplierRequestError(message, response.status);
}

async function fetchSuppliersFromServer() {
  const response = await fetch(SUPPLIERS_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await parseSupplierApiPayload(
    response,
    "Nao foi possivel carregar os fornecedores.",
  );
  const items = getSuppliersResponseItems(payload);

  if (!Array.isArray(items)) {
    throw new SupplierRequestError(
      "Resposta invalida ao carregar os fornecedores.",
      response.status,
    );
  }

  const suppliers = items
    .map((item) => normalizeSupplierItem(item))
    .filter((item): item is VersionedSupplierItem => item !== null);

  writeStoredSuppliers(suppliers);
  return suppliers;
}

function syncSuppliersFromServerInBackground(
  options?: DedicatedSyncOptions,
) {
  if (typeof window === "undefined") {
    return Promise.resolve(
      cloneCollection(SUPPLIERS) as VersionedSupplierItem[],
    );
  }

  return erpQueryClient.query(
    SUPPLIERS_QUERY_RESOURCE,
    fetchSuppliersFromServer,
    {
      force: options?.force,
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function refreshSuppliers() {
  if (typeof window === "undefined") {
    return cloneCollection(SUPPLIERS) as VersionedSupplierItem[];
  }

  return erpQueryClient.refresh(
    SUPPLIERS_QUERY_RESOURCE,
    fetchSuppliersFromServer,
    {
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function createSupplier(item: SupplierItem) {
  const response = await fetch(SUPPLIERS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      item: stripSupplierVersion(item),
    }),
  });
  const payload = await parseSupplierApiPayload(
    response,
    "Nao foi possivel criar o fornecedor.",
  );
  const createdItem = normalizeSupplierItem(
    getSupplierResponseItem(payload),
  );

  if (!createdItem) {
    throw new SupplierRequestError(
      "Resposta invalida ao criar o fornecedor.",
      response.status,
    );
  }

  upsertStoredSupplier(createdItem);
  return createdItem;
}

export async function updateSupplier(
  supplierId: string,
  itemPatch: Partial<SupplierItem>,
  baseVersion: number,
) {
  try {
    const response = await fetch(
      `${SUPPLIERS_ENDPOINT}/${encodeURIComponent(supplierId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item: stripSupplierVersion(itemPatch),
          baseVersion,
        }),
      },
    );
    const payload = await parseSupplierApiPayload(
      response,
      "Nao foi possivel atualizar o fornecedor.",
    );
    const updatedItem = normalizeSupplierItem(getSupplierResponseItem(payload));

    if (!updatedItem) {
      throw new SupplierRequestError(
        "Resposta invalida ao atualizar o fornecedor.",
        response.status,
      );
    }

    upsertStoredSupplier(updatedItem);
    return updatedItem;
  } catch (error) {
    if (error instanceof SupplierVersionConflictError) {
      await refreshSuppliers();
    }

    throw error;
  }
}

export async function deleteSupplier(supplierId: string, baseVersion: number) {
  try {
    const response = await fetch(
      `${SUPPLIERS_ENDPOINT}/${encodeURIComponent(supplierId)}`,
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

    await parseSupplierApiPayload(
      response,
      "Nao foi possivel excluir o fornecedor.",
    );
    removeStoredSupplier(supplierId);
  } catch (error) {
    if (error instanceof SupplierVersionConflictError) {
      await refreshSuppliers();
    }

    throw error;
  }
}

export function loadSuppliers() {
  if (typeof window === "undefined") {
    return cloneCollection(SUPPLIERS) as VersionedSupplierItem[];
  }

  void syncSuppliersFromServerInBackground();
  return readStoredSuppliers();
}

function normalizeCategoryItem(
  value: unknown,
): VersionedCategoryItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    (item.id !== undefined && typeof item.id !== "string") ||
    typeof item.name !== "string" ||
    typeof item.portfolio !== "string" ||
    typeof item.skus !== "number" ||
    !Number.isFinite(item.skus) ||
    !Number.isInteger(item.skus) ||
    typeof item.share !== "string" ||
    typeof item.focus !== "string"
  ) {
    return null;
  }

  return {
    id: typeof item.id === "string" ? item.id : undefined,
    name: item.name,
    portfolio: item.portfolio,
    skus: item.skus,
    share: item.share,
    focus: item.focus,
    version:
      typeof item.version === "number" &&
      Number.isInteger(item.version) &&
      item.version >= 1
        ? item.version
        : undefined,
    updatedAt:
      typeof item.updatedAt === "string" ? item.updatedAt : undefined,
  } as VersionedCategoryItem;
}

function readStoredCategories() {
  if (typeof window === "undefined") {
    return cloneCollection(CATEGORIES) as VersionedCategoryItem[];
  }

  const raw = window.localStorage.getItem(CATEGORIES_STORAGE_KEY);

  if (!raw) {
    return cloneCollection(CATEGORIES) as VersionedCategoryItem[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return cloneCollection(CATEGORIES) as VersionedCategoryItem[];
    }

    return parsed
      .map((item) => normalizeCategoryItem(item))
      .filter((item): item is VersionedCategoryItem => item !== null);
  } catch {
    return cloneCollection(CATEGORIES) as VersionedCategoryItem[];
  }
}

function writeStoredCategories(items: VersionedCategoryItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  const serializedItems = JSON.stringify(items);

  if (
    window.localStorage.getItem(CATEGORIES_STORAGE_KEY) === serializedItems
  ) {
    erpQueryClient.prime(CATEGORIES_QUERY_RESOURCE, items);
    return;
  }

  window.localStorage.setItem(CATEGORIES_STORAGE_KEY, serializedItems);
  erpQueryClient.prime(CATEGORIES_QUERY_RESOURCE, items);
  dispatchErpResourceChangedEvent(CATEGORIES_QUERY_RESOURCE);
  dispatchErpDataEvent();
}

function upsertStoredCategory(item: VersionedCategoryItem) {
  const current = readStoredCategories();
  const existingIndex = current.findIndex(
    (currentItem) => currentItem.id === item.id,
  );

  if (existingIndex === -1) {
    writeStoredCategories([item, ...current]);
    return;
  }

  const nextItems = [...current];
  nextItems[existingIndex] = item;
  writeStoredCategories(nextItems);
}

function removeStoredCategory(categoryId: string) {
  writeStoredCategories(
    readStoredCategories().filter((item) => item.id !== categoryId),
  );
}

function getCategoriesResponseItems(
  payload: CategoriesListResponse | CategoryMutationResponse | null,
) {
  return payload && "items" in payload ? payload.items : undefined;
}

function getCategoryResponseItem(
  payload: CategoriesListResponse | CategoryMutationResponse | null,
) {
  return payload && "item" in payload ? payload.item : undefined;
}

function stripCategoryVersion<
  TValue extends VersionedCategoryItem | Partial<VersionedCategoryItem>,
>(item: TValue) {
  const payload = { ...item };
  delete payload.version;
  delete payload.updatedAt;
  return payload;
}

async function parseCategoryApiPayload(
  response: Response,
  fallbackMessage: string,
) {
  const payload = (await response.json().catch(() => null)) as
    | CategoriesListResponse
    | CategoryMutationResponse
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
    throw new CategoryVersionConflictError(currentVersion);
  }

  const message =
    payload && typeof payload.error === "string"
      ? payload.error
      : fallbackMessage;

  throw new CategoryRequestError(message, response.status);
}

async function fetchCategoriesFromServer() {
  const response = await fetch(CATEGORIES_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await parseCategoryApiPayload(
    response,
    "Nao foi possivel carregar as categorias.",
  );
  const items = getCategoriesResponseItems(payload);

  if (!Array.isArray(items)) {
    throw new CategoryRequestError(
      "Resposta invalida ao carregar as categorias.",
      response.status,
    );
  }

  const categories = items
    .map((item) => normalizeCategoryItem(item))
    .filter((item): item is VersionedCategoryItem => item !== null);

  writeStoredCategories(categories);
  return categories;
}

function syncCategoriesFromServerInBackground(
  options?: DedicatedSyncOptions,
) {
  if (typeof window === "undefined") {
    return Promise.resolve(
      cloneCollection(CATEGORIES) as VersionedCategoryItem[],
    );
  }

  return erpQueryClient.query(
    CATEGORIES_QUERY_RESOURCE,
    fetchCategoriesFromServer,
    {
      force: options?.force,
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function refreshCategories() {
  if (typeof window === "undefined") {
    return cloneCollection(CATEGORIES) as VersionedCategoryItem[];
  }

  return erpQueryClient.refresh(
    CATEGORIES_QUERY_RESOURCE,
    fetchCategoriesFromServer,
    {
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function createCategory(item: CategoryItem) {
  const response = await fetch(CATEGORIES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      item: stripCategoryVersion(item),
    }),
  });
  const payload = await parseCategoryApiPayload(
    response,
    "Nao foi possivel criar a categoria.",
  );
  const createdItem = normalizeCategoryItem(getCategoryResponseItem(payload));

  if (!createdItem) {
    throw new CategoryRequestError(
      "Resposta invalida ao criar a categoria.",
      response.status,
    );
  }

  upsertStoredCategory(createdItem);
  return createdItem;
}

export async function updateCategory(
  categoryId: string,
  itemPatch: Partial<CategoryItem>,
  baseVersion: number,
) {
  try {
    const response = await fetch(
      `${CATEGORIES_ENDPOINT}/${encodeURIComponent(categoryId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item: stripCategoryVersion(itemPatch),
          baseVersion,
        }),
      },
    );
    const payload = await parseCategoryApiPayload(
      response,
      "Nao foi possivel atualizar a categoria.",
    );
    const updatedItem = normalizeCategoryItem(getCategoryResponseItem(payload));

    if (!updatedItem) {
      throw new CategoryRequestError(
        "Resposta invalida ao atualizar a categoria.",
        response.status,
      );
    }

    upsertStoredCategory(updatedItem);
    return updatedItem;
  } catch (error) {
    if (error instanceof CategoryVersionConflictError) {
      await refreshCategories();
    }

    throw error;
  }
}

export async function deleteCategory(categoryId: string, baseVersion: number) {
  try {
    const response = await fetch(
      `${CATEGORIES_ENDPOINT}/${encodeURIComponent(categoryId)}`,
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

    await parseCategoryApiPayload(
      response,
      "Nao foi possivel excluir a categoria.",
    );
    removeStoredCategory(categoryId);
  } catch (error) {
    if (error instanceof CategoryVersionConflictError) {
      await refreshCategories();
    }

    throw error;
  }
}

export function loadCategories() {
  if (typeof window === "undefined") {
    return cloneCollection(CATEGORIES) as VersionedCategoryItem[];
  }

  void syncCategoriesFromServerInBackground();
  return readStoredCategories();
}

function isNotificationPriority(
  value: unknown,
): value is NotificationItem["priority"] {
  return PRIORITY_OPTIONS.includes(value as NotificationItem["priority"]);
}

function isNotificationType(value: unknown): value is NotificationItem["type"] {
  return NOTIFICATION_TYPE_OPTIONS.includes(value as NotificationItem["type"]);
}

function isNotificationStatus(
  value: unknown,
): value is NotificationItem["status"] {
  return NOTIFICATION_STATUS_OPTIONS.includes(
    value as NotificationItem["status"],
  );
}

function normalizeNotificationItem(
  value: unknown,
): VersionedNotificationItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    (item.id !== undefined && typeof item.id !== "string") ||
    typeof item.title !== "string" ||
    typeof item.area !== "string" ||
    !isNotificationPriority(item.priority) ||
    !isNotificationType(item.type) ||
    !isNotificationStatus(item.status)
  ) {
    return null;
  }

  return {
    id: typeof item.id === "string" ? item.id : undefined,
    title: item.title,
    area: item.area,
    priority: item.priority,
    type: item.type,
    status: item.status,
    version:
      typeof item.version === "number" &&
      Number.isInteger(item.version) &&
      item.version >= 1
        ? item.version
        : undefined,
    updatedAt:
      typeof item.updatedAt === "string" ? item.updatedAt : undefined,
  } as VersionedNotificationItem;
}

function sortNotifications<TValue extends NotificationItem>(items: TValue[]) {
  return [...items].sort((left, right) => {
    const byPriority = left.priority.localeCompare(right.priority);

    if (byPriority !== 0) {
      return byPriority;
    }

    const byTitle = left.title.localeCompare(right.title);
    return byTitle === 0 ? left.area.localeCompare(right.area) : byTitle;
  });
}

function readStoredNotifications() {
  if (typeof window === "undefined") {
    return cloneCollection(NOTIFICATIONS) as VersionedNotificationItem[];
  }

  const raw = window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);

  if (!raw) {
    return cloneCollection(NOTIFICATIONS) as VersionedNotificationItem[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return cloneCollection(NOTIFICATIONS) as VersionedNotificationItem[];
    }

    return parsed
      .map((item) => normalizeNotificationItem(item))
      .filter((item): item is VersionedNotificationItem => item !== null);
  } catch {
    return cloneCollection(NOTIFICATIONS) as VersionedNotificationItem[];
  }
}

function writeStoredNotifications(items: VersionedNotificationItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  const sortedItems = sortNotifications(items);
  const serializedItems = JSON.stringify(sortedItems);

  if (
    window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) === serializedItems
  ) {
    erpQueryClient.prime(NOTIFICATIONS_QUERY_RESOURCE, sortedItems);
    return;
  }

  window.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, serializedItems);
  erpQueryClient.prime(NOTIFICATIONS_QUERY_RESOURCE, sortedItems);
  dispatchErpResourceChangedEvent(NOTIFICATIONS_QUERY_RESOURCE);
  dispatchErpDataEvent();
}

function upsertStoredNotification(item: VersionedNotificationItem) {
  const current = readStoredNotifications();

  writeStoredNotifications([
    item,
    ...current.filter((currentItem) => currentItem.id !== item.id),
  ]);
}

function getNotificationResponseItems(
  payload: NotificationsListResponse | NotificationMutationResponse | null,
) {
  return payload && "items" in payload ? payload.items : undefined;
}

function getNotificationResponseItem(
  payload: NotificationsListResponse | NotificationMutationResponse | null,
) {
  return payload && "item" in payload ? payload.item : undefined;
}

function stripNotificationVersion<
  TValue extends
    | VersionedNotificationItem
    | Partial<VersionedNotificationItem>,
>(item: TValue) {
  const payload = { ...item };
  delete payload.version;
  delete payload.updatedAt;
  return payload;
}

async function parseNotificationApiPayload(
  response: Response,
  fallbackMessage: string,
) {
  const payload = (await response.json().catch(() => null)) as
    | NotificationsListResponse
    | NotificationMutationResponse
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
    throw new NotificationItemVersionConflictError(currentVersion);
  }

  const message =
    payload && typeof payload.error === "string"
      ? payload.error
      : fallbackMessage;

  throw new NotificationItemRequestError(message, response.status);
}

async function fetchNotificationsFromServer() {
  const response = await fetch(NOTIFICATIONS_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await parseNotificationApiPayload(
    response,
    "Nao foi possivel carregar as notificacoes.",
  );
  const items = getNotificationResponseItems(payload);

  if (!Array.isArray(items)) {
    throw new NotificationItemRequestError(
      "Resposta invalida ao carregar as notificacoes.",
      response.status,
    );
  }

  const notifications = items
    .map((item) => normalizeNotificationItem(item))
    .filter((item): item is VersionedNotificationItem => item !== null);

  writeStoredNotifications(notifications);
  return notifications;
}

function syncNotificationsFromServerInBackground(
  options?: DedicatedSyncOptions,
) {
  if (typeof window === "undefined") {
    return Promise.resolve(
      cloneCollection(NOTIFICATIONS) as VersionedNotificationItem[],
    );
  }

  return erpQueryClient.query(
    NOTIFICATIONS_QUERY_RESOURCE,
    fetchNotificationsFromServer,
    {
      force: options?.force,
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function refreshNotifications() {
  if (typeof window === "undefined") {
    return cloneCollection(NOTIFICATIONS) as VersionedNotificationItem[];
  }

  return erpQueryClient.refresh(
    NOTIFICATIONS_QUERY_RESOURCE,
    fetchNotificationsFromServer,
    {
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function updateNotification(
  notificationId: string,
  itemPatch: Partial<NotificationItem>,
  baseVersion: number,
) {
  try {
    const response = await fetch(
      `${NOTIFICATIONS_ENDPOINT}/${encodeURIComponent(notificationId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item: stripNotificationVersion(itemPatch),
          baseVersion,
        }),
      },
    );
    const payload = await parseNotificationApiPayload(
      response,
      "Nao foi possivel atualizar a notificacao.",
    );
    const updatedItem = normalizeNotificationItem(
      getNotificationResponseItem(payload),
    );

    if (!updatedItem) {
      throw new NotificationItemRequestError(
        "Resposta invalida ao atualizar a notificacao.",
        response.status,
      );
    }

    upsertStoredNotification(updatedItem);
    return updatedItem;
  } catch (error) {
    if (error instanceof NotificationItemVersionConflictError) {
      await refreshNotifications();
    }

    throw error;
  }
}

export function loadNotifications() {
  if (typeof window === "undefined") {
    return cloneCollection(NOTIFICATIONS) as VersionedNotificationItem[];
  }

  void syncNotificationsFromServerInBackground();
  return readStoredNotifications();
}

export function loadQualityEvents() {
  if (typeof window === "undefined") {
    return cloneCollection(QUALITY_EVENTS) as VersionedQualityEventItem[];
  }

  void syncQualityEventsFromServerInBackground();
  return readStoredQualityEvents();
}

function isPlanningPriority(value: unknown): value is PlanningItem["priority"] {
  return PRIORITY_OPTIONS.includes(value as PlanningItem["priority"]);
}

function normalizePlanningItem(value: unknown): VersionedPlanningItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    (item.id !== undefined && typeof item.id !== "string") ||
    typeof item.route !== "string" ||
    typeof item.window !== "string" ||
    !isPlanningPriority(item.priority) ||
    typeof item.demand !== "number" ||
    !Number.isFinite(item.demand) ||
    typeof item.coverage !== "string"
  ) {
    return null;
  }

  return {
    id: typeof item.id === "string" ? item.id : undefined,
    route: item.route,
    window: item.window,
    priority: item.priority,
    demand: item.demand,
    coverage: item.coverage,
    version:
      typeof item.version === "number" &&
      Number.isInteger(item.version) &&
      item.version >= 1
        ? item.version
        : undefined,
    updatedAt:
      typeof item.updatedAt === "string" ? item.updatedAt : undefined,
  } as VersionedPlanningItem;
}

function readStoredPlanningItems() {
  if (typeof window === "undefined") {
    return cloneCollection(PLANNING_ITEMS) as VersionedPlanningItem[];
  }

  const raw = window.localStorage.getItem(PLANNING_ITEMS_STORAGE_KEY);

  if (!raw) {
    return cloneCollection(PLANNING_ITEMS) as VersionedPlanningItem[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return cloneCollection(PLANNING_ITEMS) as VersionedPlanningItem[];
    }

    return parsed
      .map((item) => normalizePlanningItem(item))
      .filter((item): item is VersionedPlanningItem => item !== null);
  } catch {
    return cloneCollection(PLANNING_ITEMS) as VersionedPlanningItem[];
  }
}

function writeStoredPlanningItems(items: VersionedPlanningItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  const serializedItems = JSON.stringify(items);

  if (window.localStorage.getItem(PLANNING_ITEMS_STORAGE_KEY) === serializedItems) {
    erpQueryClient.prime(PLANNING_QUERY_RESOURCE, items);
    return;
  }

  window.localStorage.setItem(PLANNING_ITEMS_STORAGE_KEY, serializedItems);
  erpQueryClient.prime(PLANNING_QUERY_RESOURCE, items);
  dispatchErpDataEvent();
}

function upsertStoredPlanningItem(item: VersionedPlanningItem) {
  const current = readStoredPlanningItems();
  const existingIndex = current.findIndex(
    (currentItem) => currentItem.id === item.id,
  );

  if (existingIndex === -1) {
    writeStoredPlanningItems([item, ...current]);
    return;
  }

  const nextItems = [...current];
  nextItems[existingIndex] = item;
  writeStoredPlanningItems(nextItems);
}

function removeStoredPlanningItem(planningId: string) {
  writeStoredPlanningItems(
    readStoredPlanningItems().filter((item) => item.id !== planningId),
  );
}

function getPlanningResponseItems(
  payload: PlanningItemsListResponse | PlanningItemMutationResponse | null,
) {
  return payload && "items" in payload ? payload.items : undefined;
}

function getPlanningResponseItem(
  payload: PlanningItemsListResponse | PlanningItemMutationResponse | null,
) {
  return payload && "item" in payload ? payload.item : undefined;
}

function stripPlanningVersion<
  TValue extends VersionedPlanningItem | Partial<VersionedPlanningItem>,
>(item: TValue) {
  const payload = { ...item };
  delete payload.version;
  delete payload.updatedAt;
  return payload;
}

async function parsePlanningApiPayload(
  response: Response,
  fallbackMessage: string,
) {
  const payload = (await response.json().catch(() => null)) as
    | PlanningItemsListResponse
    | PlanningItemMutationResponse
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
    throw new PlanningItemVersionConflictError(currentVersion);
  }

  const message =
    payload && typeof payload.error === "string"
      ? payload.error
      : fallbackMessage;

  throw new PlanningItemRequestError(message, response.status);
}

async function fetchPlanningItemsFromServer() {
  const response = await fetch(PLANNING_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await parsePlanningApiPayload(
    response,
    "Nao foi possivel carregar os planejamentos.",
  );
  const items = getPlanningResponseItems(payload);

  if (!Array.isArray(items)) {
    throw new PlanningItemRequestError(
      "Resposta invalida ao carregar os planejamentos.",
      response.status,
    );
  }

  const planningItems = items
    .map((item) => normalizePlanningItem(item))
    .filter((item): item is VersionedPlanningItem => item !== null);

  writeStoredPlanningItems(planningItems);
  return planningItems;
}

function syncPlanningItemsFromServerInBackground(
  options?: DedicatedSyncOptions,
) {
  if (typeof window === "undefined") {
    return Promise.resolve(
      cloneCollection(PLANNING_ITEMS) as VersionedPlanningItem[],
    );
  }

  return erpQueryClient.query(
    PLANNING_QUERY_RESOURCE,
    fetchPlanningItemsFromServer,
    {
      force: options?.force,
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function refreshPlanningItems() {
  if (typeof window === "undefined") {
    return cloneCollection(PLANNING_ITEMS) as VersionedPlanningItem[];
  }

  return erpQueryClient.refresh(
    PLANNING_QUERY_RESOURCE,
    fetchPlanningItemsFromServer,
    {
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function createPlanningItem(item: PlanningItem) {
  const response = await fetch(PLANNING_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      item: stripPlanningVersion(item),
    }),
  });
  const payload = await parsePlanningApiPayload(
    response,
    "Nao foi possivel criar o planejamento.",
  );
  const createdItem = normalizePlanningItem(getPlanningResponseItem(payload));

  if (!createdItem) {
    throw new PlanningItemRequestError(
      "Resposta invalida ao criar o planejamento.",
      response.status,
    );
  }

  upsertStoredPlanningItem(createdItem);
  return createdItem;
}

export async function updatePlanningItem(
  planningId: string,
  itemPatch: Partial<PlanningItem>,
  baseVersion: number,
) {
  try {
    const response = await fetch(
      `${PLANNING_ENDPOINT}/${encodeURIComponent(planningId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item: stripPlanningVersion(itemPatch),
          baseVersion,
        }),
      },
    );
    const payload = await parsePlanningApiPayload(
      response,
      "Nao foi possivel atualizar o planejamento.",
    );
    const updatedItem = normalizePlanningItem(getPlanningResponseItem(payload));

    if (!updatedItem) {
      throw new PlanningItemRequestError(
        "Resposta invalida ao atualizar o planejamento.",
        response.status,
      );
    }

    upsertStoredPlanningItem(updatedItem);
    return updatedItem;
  } catch (error) {
    if (error instanceof PlanningItemVersionConflictError) {
      await refreshPlanningItems();
    }

    throw error;
  }
}

export async function deletePlanningItem(
  planningId: string,
  baseVersion: number,
) {
  try {
    const response = await fetch(
      `${PLANNING_ENDPOINT}/${encodeURIComponent(planningId)}`,
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

    await parsePlanningApiPayload(
      response,
      "Nao foi possivel excluir o planejamento.",
    );
    removeStoredPlanningItem(planningId);
  } catch (error) {
    if (error instanceof PlanningItemVersionConflictError) {
      await refreshPlanningItems();
    }

    throw error;
  }
}

export function loadPlanningItems() {
  if (typeof window === "undefined") {
    return cloneCollection(PLANNING_ITEMS) as VersionedPlanningItem[];
  }

  void syncPlanningItemsFromServerInBackground();
  return readStoredPlanningItems();
}

function isCalendarEventType(
  value: unknown,
): value is CalendarItem["type"] {
  return CALENDAR_TYPE_OPTIONS.includes(value as CalendarItem["type"]);
}

function normalizeCalendarEvent(
  value: unknown,
): VersionedCalendarEventItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    (item.id !== undefined && typeof item.id !== "string") ||
    typeof item.title !== "string" ||
    typeof item.slot !== "string" ||
    typeof item.area !== "string" ||
    !isCalendarEventType(item.type)
  ) {
    return null;
  }

  return {
    id: typeof item.id === "string" ? item.id : undefined,
    title: item.title,
    slot: item.slot,
    area: item.area,
    type: item.type,
    version:
      typeof item.version === "number" &&
      Number.isInteger(item.version) &&
      item.version >= 1
        ? item.version
        : undefined,
    updatedAt:
      typeof item.updatedAt === "string" ? item.updatedAt : undefined,
  } as VersionedCalendarEventItem;
}

function readStoredCalendarEvents() {
  if (typeof window === "undefined") {
    return cloneCollection(CALENDAR_EVENTS) as VersionedCalendarEventItem[];
  }

  const raw = window.localStorage.getItem(CALENDAR_EVENTS_STORAGE_KEY);

  if (!raw) {
    return cloneCollection(CALENDAR_EVENTS) as VersionedCalendarEventItem[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return cloneCollection(CALENDAR_EVENTS) as VersionedCalendarEventItem[];
    }

    return parsed
      .map((item) => normalizeCalendarEvent(item))
      .filter((item): item is VersionedCalendarEventItem => item !== null);
  } catch {
    return cloneCollection(CALENDAR_EVENTS) as VersionedCalendarEventItem[];
  }
}

function writeStoredCalendarEvents(items: VersionedCalendarEventItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  const serializedItems = JSON.stringify(items);

  if (
    window.localStorage.getItem(CALENDAR_EVENTS_STORAGE_KEY) === serializedItems
  ) {
    erpQueryClient.prime(CALENDAR_QUERY_RESOURCE, items);
    return;
  }

  window.localStorage.setItem(CALENDAR_EVENTS_STORAGE_KEY, serializedItems);
  erpQueryClient.prime(CALENDAR_QUERY_RESOURCE, items);
  dispatchErpDataEvent();
}

function upsertStoredCalendarEvent(item: VersionedCalendarEventItem) {
  const current = readStoredCalendarEvents();
  const existingIndex = current.findIndex(
    (currentItem) => currentItem.id === item.id,
  );

  if (existingIndex === -1) {
    writeStoredCalendarEvents([item, ...current]);
    return;
  }

  const nextItems = [...current];
  nextItems[existingIndex] = item;
  writeStoredCalendarEvents(nextItems);
}

function removeStoredCalendarEvent(calendarEventId: string) {
  writeStoredCalendarEvents(
    readStoredCalendarEvents().filter((item) => item.id !== calendarEventId),
  );
}

function getCalendarResponseItems(
  payload: CalendarEventsListResponse | CalendarEventMutationResponse | null,
) {
  return payload && "items" in payload ? payload.items : undefined;
}

function getCalendarResponseItem(
  payload: CalendarEventsListResponse | CalendarEventMutationResponse | null,
) {
  return payload && "item" in payload ? payload.item : undefined;
}

function stripCalendarVersion<
  TValue extends VersionedCalendarEventItem | Partial<VersionedCalendarEventItem>,
>(item: TValue) {
  const payload = { ...item };
  delete payload.version;
  delete payload.updatedAt;
  return payload;
}

async function parseCalendarApiPayload(
  response: Response,
  fallbackMessage: string,
) {
  const payload = (await response.json().catch(() => null)) as
    | CalendarEventsListResponse
    | CalendarEventMutationResponse
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
    throw new CalendarEventVersionConflictError(currentVersion);
  }

  const message =
    payload && typeof payload.error === "string"
      ? payload.error
      : fallbackMessage;

  throw new CalendarEventRequestError(message, response.status);
}

async function fetchCalendarEventsFromServer() {
  const response = await fetch(CALENDAR_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await parseCalendarApiPayload(
    response,
    "Nao foi possivel carregar os eventos do calendario.",
  );
  const items = getCalendarResponseItems(payload);

  if (!Array.isArray(items)) {
    throw new CalendarEventRequestError(
      "Resposta invalida ao carregar os eventos do calendario.",
      response.status,
    );
  }

  const calendarEvents = items
    .map((item) => normalizeCalendarEvent(item))
    .filter((item): item is VersionedCalendarEventItem => item !== null);

  writeStoredCalendarEvents(calendarEvents);
  return calendarEvents;
}

function syncCalendarEventsFromServerInBackground(
  options?: DedicatedSyncOptions,
) {
  if (typeof window === "undefined") {
    return Promise.resolve(
      cloneCollection(CALENDAR_EVENTS) as VersionedCalendarEventItem[],
    );
  }

  return erpQueryClient.query(
    CALENDAR_QUERY_RESOURCE,
    fetchCalendarEventsFromServer,
    {
      force: options?.force,
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function refreshCalendarEvents() {
  if (typeof window === "undefined") {
    return cloneCollection(CALENDAR_EVENTS) as VersionedCalendarEventItem[];
  }

  return erpQueryClient.refresh(
    CALENDAR_QUERY_RESOURCE,
    fetchCalendarEventsFromServer,
    {
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function createCalendarEvent(item: CalendarItem) {
  const response = await fetch(CALENDAR_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      item: stripCalendarVersion(item),
    }),
  });
  const payload = await parseCalendarApiPayload(
    response,
    "Nao foi possivel criar o evento do calendario.",
  );
  const createdItem = normalizeCalendarEvent(getCalendarResponseItem(payload));

  if (!createdItem) {
    throw new CalendarEventRequestError(
      "Resposta invalida ao criar o evento do calendario.",
      response.status,
    );
  }

  upsertStoredCalendarEvent(createdItem);
  return createdItem;
}

export async function updateCalendarEvent(
  calendarEventId: string,
  itemPatch: Partial<CalendarItem>,
  baseVersion: number,
) {
  try {
    const response = await fetch(
      `${CALENDAR_ENDPOINT}/${encodeURIComponent(calendarEventId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item: stripCalendarVersion(itemPatch),
          baseVersion,
        }),
      },
    );
    const payload = await parseCalendarApiPayload(
      response,
      "Nao foi possivel atualizar o evento do calendario.",
    );
    const updatedItem = normalizeCalendarEvent(getCalendarResponseItem(payload));

    if (!updatedItem) {
      throw new CalendarEventRequestError(
        "Resposta invalida ao atualizar o evento do calendario.",
        response.status,
      );
    }

    upsertStoredCalendarEvent(updatedItem);
    return updatedItem;
  } catch (error) {
    if (error instanceof CalendarEventVersionConflictError) {
      await refreshCalendarEvents();
    }

    throw error;
  }
}

export async function deleteCalendarEvent(
  calendarEventId: string,
  baseVersion: number,
) {
  try {
    const response = await fetch(
      `${CALENDAR_ENDPOINT}/${encodeURIComponent(calendarEventId)}`,
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

    await parseCalendarApiPayload(
      response,
      "Nao foi possivel excluir o evento do calendario.",
    );
    removeStoredCalendarEvent(calendarEventId);
  } catch (error) {
    if (error instanceof CalendarEventVersionConflictError) {
      await refreshCalendarEvents();
    }

    throw error;
  }
}

function normalizeReportItem(value: unknown): VersionedReportItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    (item.id !== undefined && typeof item.id !== "string") ||
    typeof item.title !== "string" ||
    typeof item.owner !== "string" ||
    typeof item.cadence !== "string" ||
    typeof item.lastRun !== "string" ||
    typeof item.summary !== "string"
  ) {
    return null;
  }

  return {
    id: typeof item.id === "string" ? item.id : undefined,
    title: item.title,
    owner: item.owner,
    cadence: item.cadence,
    lastRun: item.lastRun,
    summary: item.summary,
    version:
      typeof item.version === "number" &&
      Number.isInteger(item.version) &&
      item.version >= 1
        ? item.version
        : undefined,
    updatedAt:
      typeof item.updatedAt === "string" ? item.updatedAt : undefined,
  } as VersionedReportItem;
}

function readStoredReports() {
  if (typeof window === "undefined") {
    return cloneCollection(REPORTS) as VersionedReportItem[];
  }

  const raw = window.localStorage.getItem(REPORTS_STORAGE_KEY);

  if (!raw) {
    return cloneCollection(REPORTS) as VersionedReportItem[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return cloneCollection(REPORTS) as VersionedReportItem[];
    }

    return parsed
      .map((item) => normalizeReportItem(item))
      .filter((item): item is VersionedReportItem => item !== null);
  } catch {
    return cloneCollection(REPORTS) as VersionedReportItem[];
  }
}

function writeStoredReports(items: VersionedReportItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  const serializedItems = JSON.stringify(items);

  if (window.localStorage.getItem(REPORTS_STORAGE_KEY) === serializedItems) {
    erpQueryClient.prime(REPORTS_QUERY_RESOURCE, items);
    return;
  }

  window.localStorage.setItem(REPORTS_STORAGE_KEY, serializedItems);
  erpQueryClient.prime(REPORTS_QUERY_RESOURCE, items);
  dispatchErpDataEvent();
}

function upsertStoredReport(item: VersionedReportItem) {
  const current = readStoredReports();
  const existingIndex = current.findIndex(
    (currentItem) => currentItem.id === item.id,
  );

  if (existingIndex === -1) {
    writeStoredReports([item, ...current]);
    return;
  }

  const nextItems = [...current];
  nextItems[existingIndex] = item;
  writeStoredReports(nextItems);
}

function removeStoredReport(reportId: string) {
  writeStoredReports(
    readStoredReports().filter((item) => item.id !== reportId),
  );
}

function getReportsResponseItems(
  payload: ReportsListResponse | ReportMutationResponse | null,
) {
  return payload && "items" in payload ? payload.items : undefined;
}

function getReportResponseItem(
  payload: ReportsListResponse | ReportMutationResponse | null,
) {
  return payload && "item" in payload ? payload.item : undefined;
}

function stripReportVersion<
  TValue extends VersionedReportItem | Partial<VersionedReportItem>,
>(item: TValue) {
  const payload = { ...item };
  delete payload.version;
  delete payload.updatedAt;
  return payload;
}

async function parseReportApiPayload(
  response: Response,
  fallbackMessage: string,
) {
  const payload = (await response.json().catch(() => null)) as
    | ReportsListResponse
    | ReportMutationResponse
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
    throw new ReportVersionConflictError(currentVersion);
  }

  const message =
    payload && typeof payload.error === "string"
      ? payload.error
      : fallbackMessage;

  throw new ReportRequestError(message, response.status);
}

async function fetchReportsFromServer() {
  const response = await fetch(REPORTS_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await parseReportApiPayload(
    response,
    "Nao foi possivel carregar os relatorios.",
  );
  const items = getReportsResponseItems(payload);

  if (!Array.isArray(items)) {
    throw new ReportRequestError(
      "Resposta invalida ao carregar os relatorios.",
      response.status,
    );
  }

  const reports = items
    .map((item) => normalizeReportItem(item))
    .filter((item): item is VersionedReportItem => item !== null);

  writeStoredReports(reports);
  return reports;
}

function syncReportsFromServerInBackground(options?: DedicatedSyncOptions) {
  if (typeof window === "undefined") {
    return Promise.resolve(cloneCollection(REPORTS) as VersionedReportItem[]);
  }

  return erpQueryClient.query(REPORTS_QUERY_RESOURCE, fetchReportsFromServer, {
    force: options?.force,
    staleMs: DEDICATED_SYNC_CACHE_MS,
  });
}

export async function refreshReports() {
  if (typeof window === "undefined") {
    return cloneCollection(REPORTS) as VersionedReportItem[];
  }

  return erpQueryClient.refresh(REPORTS_QUERY_RESOURCE, fetchReportsFromServer, {
    staleMs: DEDICATED_SYNC_CACHE_MS,
  });
}

export async function createReport(item: ReportItem) {
  const response = await fetch(REPORTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      item: stripReportVersion(item),
    }),
  });
  const payload = await parseReportApiPayload(
    response,
    "Nao foi possivel criar o relatorio.",
  );
  const createdItem = normalizeReportItem(getReportResponseItem(payload));

  if (!createdItem) {
    throw new ReportRequestError(
      "Resposta invalida ao criar o relatorio.",
      response.status,
    );
  }

  upsertStoredReport(createdItem);
  return createdItem;
}

export async function updateReport(
  reportId: string,
  itemPatch: Partial<ReportItem>,
  baseVersion: number,
) {
  try {
    const response = await fetch(
      `${REPORTS_ENDPOINT}/${encodeURIComponent(reportId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item: stripReportVersion(itemPatch),
          baseVersion,
        }),
      },
    );
    const payload = await parseReportApiPayload(
      response,
      "Nao foi possivel atualizar o relatorio.",
    );
    const updatedItem = normalizeReportItem(getReportResponseItem(payload));

    if (!updatedItem) {
      throw new ReportRequestError(
        "Resposta invalida ao atualizar o relatorio.",
        response.status,
      );
    }

    upsertStoredReport(updatedItem);
    return updatedItem;
  } catch (error) {
    if (error instanceof ReportVersionConflictError) {
      await refreshReports();
    }

    throw error;
  }
}

export async function deleteReport(reportId: string, baseVersion: number) {
  try {
    const response = await fetch(
      `${REPORTS_ENDPOINT}/${encodeURIComponent(reportId)}`,
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

    await parseReportApiPayload(
      response,
      "Nao foi possivel excluir o relatorio.",
    );
    removeStoredReport(reportId);
  } catch (error) {
    if (error instanceof ReportVersionConflictError) {
      await refreshReports();
    }

    throw error;
  }
}

export function loadReports() {
  if (typeof window === "undefined") {
    return cloneCollection(REPORTS) as VersionedReportItem[];
  }

  void syncReportsFromServerInBackground();
  return readStoredReports();
}

export function loadPendingItems() {
  if (typeof window === "undefined") {
    return cloneCollection(PENDING_ITEMS) as VersionedPendingItem[];
  }

  void syncPendingItemsFromServerInBackground();
  return readStoredPendingItems();
}

export function loadTasks() {
  if (typeof window === "undefined") {
    return cloneCollection(TASKS) as VersionedTaskItem[];
  }

  void syncTasksFromServerInBackground();
  return readStoredTasks();
}

function isDistributorPriority(
  value: unknown,
): value is DistributorItem["priority"] {
  return PRIORITY_OPTIONS.includes(value as DistributorItem["priority"]);
}

function isDistributorStatus(
  value: unknown,
): value is DistributorItem["status"] {
  return DISTRIBUTOR_STATUS_OPTIONS.includes(value as DistributorItem["status"]);
}

function normalizeDistributorItem(
  value: unknown,
): VersionedDistributorItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    (item.id !== undefined && typeof item.id !== "string") ||
    typeof item.name !== "string" ||
    typeof item.region !== "string" ||
    typeof item.channel !== "string" ||
    !isDistributorPriority(item.priority) ||
    typeof item.lastSupply !== "string" ||
    !isDistributorStatus(item.status)
  ) {
    return null;
  }

  return {
    id: typeof item.id === "string" ? item.id : undefined,
    name: item.name,
    region: item.region,
    channel: item.channel,
    priority: item.priority,
    lastSupply: item.lastSupply,
    status: item.status,
    version:
      typeof item.version === "number" &&
      Number.isInteger(item.version) &&
      item.version >= 1
        ? item.version
        : undefined,
    updatedAt:
      typeof item.updatedAt === "string" ? item.updatedAt : undefined,
  } as VersionedDistributorItem;
}

function readStoredDistributors() {
  if (typeof window === "undefined") {
    return cloneCollection(DISTRIBUTORS) as VersionedDistributorItem[];
  }

  const raw = window.localStorage.getItem(DISTRIBUTORS_STORAGE_KEY);

  if (!raw) {
    return cloneCollection(DISTRIBUTORS) as VersionedDistributorItem[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return cloneCollection(DISTRIBUTORS) as VersionedDistributorItem[];
    }

    return parsed
      .map((item) => normalizeDistributorItem(item))
      .filter((item): item is VersionedDistributorItem => item !== null);
  } catch {
    return cloneCollection(DISTRIBUTORS) as VersionedDistributorItem[];
  }
}

function writeStoredDistributors(items: VersionedDistributorItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  const serializedItems = JSON.stringify(items);

  if (
    window.localStorage.getItem(DISTRIBUTORS_STORAGE_KEY) === serializedItems
  ) {
    erpQueryClient.prime(DISTRIBUTORS_QUERY_RESOURCE, items);
    return;
  }

  window.localStorage.setItem(DISTRIBUTORS_STORAGE_KEY, serializedItems);
  erpQueryClient.prime(DISTRIBUTORS_QUERY_RESOURCE, items);
  dispatchErpResourceChangedEvent(DISTRIBUTORS_QUERY_RESOURCE);
  dispatchErpDataEvent();
}

function upsertStoredDistributor(item: VersionedDistributorItem) {
  const current = readStoredDistributors();
  const existingIndex = current.findIndex(
    (currentItem) => currentItem.id === item.id,
  );

  if (existingIndex === -1) {
    writeStoredDistributors([item, ...current]);
    return;
  }

  const nextItems = [...current];
  nextItems[existingIndex] = item;
  writeStoredDistributors(nextItems);
}

function removeStoredDistributor(distributorId: string) {
  writeStoredDistributors(
    readStoredDistributors().filter((item) => item.id !== distributorId),
  );
}

function getDistributorsResponseItems(
  payload: DistributorsListResponse | DistributorMutationResponse | null,
) {
  return payload && "items" in payload ? payload.items : undefined;
}

function getDistributorResponseItem(
  payload: DistributorsListResponse | DistributorMutationResponse | null,
) {
  return payload && "item" in payload ? payload.item : undefined;
}

function stripDistributorVersion<
  TValue extends VersionedDistributorItem | Partial<VersionedDistributorItem>,
>(item: TValue) {
  const payload = { ...item };
  delete payload.version;
  delete payload.updatedAt;
  return payload;
}

async function parseDistributorApiPayload(
  response: Response,
  fallbackMessage: string,
) {
  const payload = (await response.json().catch(() => null)) as
    | DistributorsListResponse
    | DistributorMutationResponse
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
    throw new DistributorVersionConflictError(currentVersion);
  }

  const message =
    payload && typeof payload.error === "string"
      ? payload.error
      : fallbackMessage;

  throw new DistributorRequestError(message, response.status);
}

async function fetchDistributorsFromServer() {
  const response = await fetch(DISTRIBUTORS_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await parseDistributorApiPayload(
    response,
    "Nao foi possivel carregar os distribuidores.",
  );
  const items = getDistributorsResponseItems(payload);

  if (!Array.isArray(items)) {
    throw new DistributorRequestError(
      "Resposta invalida ao carregar os distribuidores.",
      response.status,
    );
  }

  const distributors = items
    .map((item) => normalizeDistributorItem(item))
    .filter((item): item is VersionedDistributorItem => item !== null);

  writeStoredDistributors(distributors);
  return distributors;
}

function syncDistributorsFromServerInBackground(
  options?: DedicatedSyncOptions,
) {
  if (typeof window === "undefined") {
    return Promise.resolve(
      cloneCollection(DISTRIBUTORS) as VersionedDistributorItem[],
    );
  }

  return erpQueryClient.query(
    DISTRIBUTORS_QUERY_RESOURCE,
    fetchDistributorsFromServer,
    {
      force: options?.force,
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function refreshDistributors() {
  if (typeof window === "undefined") {
    return cloneCollection(DISTRIBUTORS) as VersionedDistributorItem[];
  }

  return erpQueryClient.refresh(
    DISTRIBUTORS_QUERY_RESOURCE,
    fetchDistributorsFromServer,
    {
      staleMs: DEDICATED_SYNC_CACHE_MS,
    },
  );
}

export async function createDistributor(item: DistributorItem) {
  const response = await fetch(DISTRIBUTORS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      item: stripDistributorVersion(item),
    }),
  });
  const payload = await parseDistributorApiPayload(
    response,
    "Nao foi possivel criar o distribuidor.",
  );
  const createdItem = normalizeDistributorItem(
    getDistributorResponseItem(payload),
  );

  if (!createdItem) {
    throw new DistributorRequestError(
      "Resposta invalida ao criar o distribuidor.",
      response.status,
    );
  }

  upsertStoredDistributor(createdItem);
  return createdItem;
}

export async function updateDistributor(
  distributorId: string,
  itemPatch: Partial<DistributorItem>,
  baseVersion: number,
) {
  try {
    const response = await fetch(
      `${DISTRIBUTORS_ENDPOINT}/${encodeURIComponent(distributorId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item: stripDistributorVersion(itemPatch),
          baseVersion,
        }),
      },
    );
    const payload = await parseDistributorApiPayload(
      response,
      "Nao foi possivel atualizar o distribuidor.",
    );
    const updatedItem = normalizeDistributorItem(
      getDistributorResponseItem(payload),
    );

    if (!updatedItem) {
      throw new DistributorRequestError(
        "Resposta invalida ao atualizar o distribuidor.",
        response.status,
      );
    }

    upsertStoredDistributor(updatedItem);
    return updatedItem;
  } catch (error) {
    if (error instanceof DistributorVersionConflictError) {
      await refreshDistributors();
    }

    throw error;
  }
}

export async function deleteDistributor(
  distributorId: string,
  baseVersion: number,
) {
  try {
    const response = await fetch(
      `${DISTRIBUTORS_ENDPOINT}/${encodeURIComponent(distributorId)}`,
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

    await parseDistributorApiPayload(
      response,
      "Nao foi possivel excluir o distribuidor.",
    );
    removeStoredDistributor(distributorId);
  } catch (error) {
    if (error instanceof DistributorVersionConflictError) {
      await refreshDistributors();
    }

    throw error;
  }
}

export function loadDistributors() {
  if (typeof window === "undefined") {
    return cloneCollection(DISTRIBUTORS) as VersionedDistributorItem[];
  }

  void syncDistributorsFromServerInBackground();
  return readStoredDistributors();
}

export function loadIncidents() {
  if (typeof window === "undefined") {
    return cloneCollection(INCIDENTS) as VersionedIncidentItem[];
  }

  void syncIncidentsFromServerInBackground();
  return readStoredIncidents();
}

export function loadDocuments() {
  if (typeof window === "undefined") {
    return cloneCollection(DOCUMENTS) as VersionedDocumentItem[];
  }

  void syncDocumentsFromServerInBackground();
  return readStoredDocuments();
}

export function loadCalendarEvents() {
  if (typeof window === "undefined") {
    return cloneCollection(CALENDAR_EVENTS) as VersionedCalendarEventItem[];
  }

  void syncCalendarEventsFromServerInBackground();
  return readStoredCalendarEvents();
}
