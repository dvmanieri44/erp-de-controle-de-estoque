import { dispatchErpDataEvent } from "@/lib/app-events";
import { type ErpResourceId } from "@/lib/erp-data-resources";
import { erpQueryClient } from "@/lib/erp-query-client";
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
const QUALITY_EVENTS_ENDPOINT = "/api/erp/quality-events";
const INCIDENTS_ENDPOINT = "/api/erp/incidents";
const DOCUMENTS_ENDPOINT = "/api/erp/documents";
const TASKS_ENDPOINT = "/api/erp/tasks";
const PENDING_ENDPOINT = "/api/erp/pending";
const DEDICATED_SYNC_CACHE_MS = 30_000;
const PRODUCTS_QUERY_RESOURCE = "operations.products";
const LOTS_QUERY_RESOURCE = "operations.lots";
const QUALITY_EVENTS_QUERY_RESOURCE = "operations.quality-events";
const INCIDENTS_QUERY_RESOURCE = "operations.incidents";
const DOCUMENTS_QUERY_RESOURCE = "operations.documents";
const TASKS_QUERY_RESOURCE = "operations.tasks";
const PENDING_QUERY_RESOURCE = "operations.pending";

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

  const serializedItems = JSON.stringify(items);

  if (window.localStorage.getItem(key) === serializedItems) {
    return;
  }

  window.localStorage.setItem(key, serializedItems);
  dispatchErpDataEvent();
  persistResourceToBackendInBackground(resource, items as never[]);
}

function isQualityEventStatus(
  value: unknown,
): value is QualityEventItem["status"] {
  return QUALITY_EVENTS.some((item) => item.status === value);
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
  return INCIDENTS.some((item) => item.severity === value);
}

function isIncidentStatus(value: unknown): value is IncidentItem["status"] {
  return INCIDENTS.some((item) => item.status === value);
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
  return PENDING_ITEMS.some((item) => item.priority === value);
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
  return TASKS.some((item) => item.status === value);
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
  if (typeof window === "undefined") {
    return cloneCollection(QUALITY_EVENTS) as VersionedQualityEventItem[];
  }

  void syncQualityEventsFromServerInBackground();
  return readStoredQualityEvents();
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

export function loadDistributors() {
  return loadCollection<DistributorItem>(DISTRIBUTORS_STORAGE_KEY, DISTRIBUTORS, "operations.distributors");
}

export function saveDistributors(items: DistributorItem[]) {
  saveCollection(DISTRIBUTORS_STORAGE_KEY, items, "operations.distributors");
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
  return loadCollection<CalendarItem>(CALENDAR_EVENTS_STORAGE_KEY, CALENDAR_EVENTS, "operations.calendar");
}

export function saveCalendarEvents(items: CalendarItem[]) {
  saveCollection(CALENDAR_EVENTS_STORAGE_KEY, items, "operations.calendar");
}
