import { dispatchErpDataEvent } from "@/lib/app-events";
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

function cloneCollection<T>(items: readonly T[]) {
  return items.map((item) => ({ ...item }));
}

function loadCollection<T>(key: string, fallback: readonly T[]) {
  if (typeof window === "undefined") {
    return cloneCollection(fallback);
  }

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

function saveCollection<T>(key: string, items: T[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(items));
  dispatchErpDataEvent();
}

export function loadProductLines() {
  return loadCollection<ProductLineItem>(PRODUCT_LINES_STORAGE_KEY, PRODUCT_LINES);
}

export function saveProductLines(items: ProductLineItem[]) {
  saveCollection(PRODUCT_LINES_STORAGE_KEY, items);
}

export function loadLots() {
  return loadCollection<LotItem>(LOTS_STORAGE_KEY, LOTS);
}

export function saveLots(items: LotItem[]) {
  saveCollection(LOTS_STORAGE_KEY, items);
}

export function loadSuppliers() {
  return loadCollection<SupplierItem>(SUPPLIERS_STORAGE_KEY, SUPPLIERS);
}

export function saveSuppliers(items: SupplierItem[]) {
  saveCollection(SUPPLIERS_STORAGE_KEY, items);
}

export function loadCategories() {
  return loadCollection<CategoryItem>(CATEGORIES_STORAGE_KEY, CATEGORIES);
}

export function saveCategories(items: CategoryItem[]) {
  saveCollection(CATEGORIES_STORAGE_KEY, items);
}

export function loadNotifications() {
  return loadCollection<NotificationItem>(NOTIFICATIONS_STORAGE_KEY, NOTIFICATIONS);
}

export function saveNotifications(items: NotificationItem[]) {
  saveCollection(NOTIFICATIONS_STORAGE_KEY, items);
}

export function loadQualityEvents() {
  return loadCollection<QualityEventItem>(QUALITY_EVENTS_STORAGE_KEY, QUALITY_EVENTS);
}

export function saveQualityEvents(items: QualityEventItem[]) {
  saveCollection(QUALITY_EVENTS_STORAGE_KEY, items);
}

export function loadPlanningItems() {
  return loadCollection<PlanningItem>(PLANNING_ITEMS_STORAGE_KEY, PLANNING_ITEMS);
}

export function savePlanningItems(items: PlanningItem[]) {
  saveCollection(PLANNING_ITEMS_STORAGE_KEY, items);
}

export function loadReports() {
  return loadCollection<ReportItem>(REPORTS_STORAGE_KEY, REPORTS);
}

export function saveReports(items: ReportItem[]) {
  saveCollection(REPORTS_STORAGE_KEY, items);
}

export function loadPendingItems() {
  return loadCollection<PendingItem>(PENDING_ITEMS_STORAGE_KEY, PENDING_ITEMS);
}

export function savePendingItems(items: PendingItem[]) {
  saveCollection(PENDING_ITEMS_STORAGE_KEY, items);
}

export function loadTasks() {
  return loadCollection<TaskItem>(TASKS_STORAGE_KEY, TASKS);
}

export function saveTasks(items: TaskItem[]) {
  saveCollection(TASKS_STORAGE_KEY, items);
}

export function loadDistributors() {
  return loadCollection<DistributorItem>(DISTRIBUTORS_STORAGE_KEY, DISTRIBUTORS);
}

export function saveDistributors(items: DistributorItem[]) {
  saveCollection(DISTRIBUTORS_STORAGE_KEY, items);
}

export function loadIncidents() {
  return loadCollection<IncidentItem>(INCIDENTS_STORAGE_KEY, INCIDENTS);
}

export function saveIncidents(items: IncidentItem[]) {
  saveCollection(INCIDENTS_STORAGE_KEY, items);
}

export function loadDocuments() {
  return loadCollection<DocumentItem>(DOCUMENTS_STORAGE_KEY, DOCUMENTS);
}

export function saveDocuments(items: DocumentItem[]) {
  saveCollection(DOCUMENTS_STORAGE_KEY, items);
}

export function loadCalendarEvents() {
  return loadCollection<CalendarItem>(CALENDAR_EVENTS_STORAGE_KEY, CALENDAR_EVENTS);
}

export function saveCalendarEvents(items: CalendarItem[]) {
  saveCollection(CALENDAR_EVENTS_STORAGE_KEY, items);
}
