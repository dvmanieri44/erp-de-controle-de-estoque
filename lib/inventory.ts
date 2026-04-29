import {
  DEFAULT_LANGUAGE_PREFERENCE,
  loadLanguagePreference,
  type LanguagePreference,
} from "@/lib/ui-preferences";
import { dispatchErpDataEvent } from "@/lib/app-events";

export type LocationType = "Fábrica" | "Centro de Distribuição" | "Expedição" | "Qualidade";
export type LocationStatus = "Ativa" | "Inativa" | "Em manutenção";
export type MovementType = "entrada" | "saida" | "transferencia";
export type MovementStatus = "concluida" | "cancelada";
export type TransferStatus = "solicitada" | "em_separacao" | "em_transito" | "recebida" | "cancelada";
export type TransferPriority = "baixa" | "media" | "alta";
export type DateRangeFilter = "all" | "today" | "7d" | "30d";

export type LocationItem = {
  id: string;
  name: string;
  type: LocationType;
  address: string;
  manager: string;
  capacityTotal: number;
  status: LocationStatus;
};

export type VersionedLocationItem = LocationItem & {
  version?: number;
  updatedAt?: string | null;
};

export type MovementItem = {
  id: string;
  product: string;
  productId?: string;
  lotCode?: string;
  type: MovementType;
  quantity: number;
  reason: string;
  user: string;
  createdAt: string;
  updatedAt?: string;
  locationId?: string;
  fromLocationId?: string;
  toLocationId?: string;
  notes?: string;
  status?: MovementStatus;
  transferStatus?: TransferStatus;
  priority?: TransferPriority;
  code?: string;
  receivedAt?: string;
};

export type VersionedMovementItem = MovementItem & {
  version?: number;
};

export type ProductReferenceItem = {
  sku: string;
  product: string;
};

export type LocationStockBalanceItem = {
  locationId: string;
  balance: number;
};

export type LocationStockBalanceMap = Map<string, number>;

export type DerivedLotLocationConfidence = "high" | "medium" | "low";

export type LotDerivedLocationItem = {
  stableLocationId: string | null;
  inTransitToLocationId: string | null;
  confidence: DerivedLotLocationConfidence;
  mismatch: boolean;
};

export const LOCATIONS_STORAGE_KEY = "erp.locations";
export const MOVEMENTS_STORAGE_KEY = "erp.movements";

const MOVEMENTS_ENDPOINT = "/api/erp/movements";
const LOCATIONS_ENDPOINT = "/api/erp/locations";
const LOCATION_STOCK_ENDPOINT = "/api/erp/stock/locations";
const LOT_LOCATION_ENDPOINT_PREFIX = "/api/erp/stock/lots";
let movementsSyncPromise: Promise<VersionedMovementItem[]> | null = null;
let locationsSyncPromise: Promise<VersionedLocationItem[]> | null = null;

type InventoryMovementsListResponse = {
  items?: unknown;
  error?: unknown;
};

type InventoryMovementMutationResponse = {
  movement?: unknown;
  error?: unknown;
  currentVersion?: unknown;
};

type InventoryLocationsListResponse = {
  items?: unknown;
  error?: unknown;
};

type InventoryLocationMutationResponse = {
  location?: unknown;
  locationId?: unknown;
  error?: unknown;
  currentVersion?: unknown;
};

type LocationStockBalancesResponse = {
  items?: unknown;
  error?: unknown;
};

type LotDerivedLocationResponse = {
  stableLocationId?: unknown;
  inTransitToLocationId?: unknown;
  confidence?: unknown;
  mismatch?: unknown;
  error?: unknown;
};

export class MovementRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MovementRequestError";
    this.status = status;
  }
}

export class MovementVersionConflictError extends MovementRequestError {
  currentVersion: number;

  constructor(currentVersion: number) {
    super("VERSION_CONFLICT", 409);
    this.name = "MovementVersionConflictError";
    this.currentVersion = currentVersion;
  }
}

export class LocationRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "LocationRequestError";
    this.status = status;
  }
}

export class LocationVersionConflictError extends LocationRequestError {
  currentVersion: number;

  constructor(currentVersion: number) {
    super("VERSION_CONFLICT", 409);
    this.name = "LocationVersionConflictError";
    this.currentVersion = currentVersion;
  }
}

export class LocationStockRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "LocationStockRequestError";
    this.status = status;
  }
}

export class LotLocationRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "LotLocationRequestError";
    this.status = status;
  }
}

export const INITIAL_LOCATIONS: LocationItem[] = [
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
    id: "expedicao-dourado",
    name: "Expedição Dourado",
    type: "Expedição",
    address: "Dourado - SP",
    manager: "Fernanda Rocha",
    capacityTotal: 52000,
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
] as const;

export const INITIAL_MOVEMENTS: MovementItem[] = [
  {
    id: "mov-seco-premier-porte-mini",
    product: "PremieR Formula Cães Adultos Porte Mini",
    type: "entrada",
    quantity: 36000,
    reason: "Produção liberada pela qualidade",
    user: "Ana Ribeiro",
    createdAt: "2026-03-27T09:20:00.000Z",
    locationId: "complexo-industrial-dourado",
    notes: "Lote PFM260327 liberado após análise físico-química.",
    status: "concluida",
  },
  {
    id: "mov-golden-gatos-castrados",
    product: "GoldeN Gatos Castrados Salmão",
    type: "entrada",
    quantity: 22000,
    reason: "Produção concluída",
    user: "Rafael Monteiro",
    createdAt: "2026-03-28T11:40:00.000Z",
    locationId: "complexo-industrial-dourado",
    notes: "Lote GGC280326 com embalagem 10,1 kg.",
    status: "concluida",
  },
  {
    id: "trf-premier-formula-cd",
    product: "PremieR Formula Cães Adultos Porte Mini",
    type: "transferencia",
    quantity: 12000,
    reason: "Abastecimento do CD Sudeste",
    user: "Joana Martins",
    createdAt: "2026-03-29T13:10:00.000Z",
    fromLocationId: "complexo-industrial-dourado",
    toLocationId: "cd-sudeste",
    notes: "Transferência programada para pedidos do canal especializado.",
    priority: "alta",
    transferStatus: "recebida",
    code: "TRF-20260329-131000",
    receivedAt: "2026-03-30T09:15:00.000Z",
  },
  {
    id: "mov-golden-expedicao",
    product: "GoldeN Gatos Castrados Salmão",
    type: "transferencia",
    quantity: 8000,
    reason: "Separação para expedição nacional",
    user: "Diego Paiva",
    createdAt: "2026-03-30T16:00:00.000Z",
    fromLocationId: "complexo-industrial-dourado",
    toLocationId: "expedicao-dourado",
    notes: "Janela de carregamento da operação Sul e Sudeste.",
    priority: "media",
    transferStatus: "em_transito",
    code: "TRF-20260330-160000",
  },
  {
    id: "mov-quality-hold",
    product: "PremieR Formula Filhotes Frango",
    type: "transferencia",
    quantity: 3500,
    reason: "Retenção preventiva para reanálise",
    user: "Tatiane Freitas",
    createdAt: "2026-03-31T08:05:00.000Z",
    fromLocationId: "complexo-industrial-dourado",
    toLocationId: "quality-hold",
    notes: "Aguardar parecer do laboratório interno.",
    priority: "alta",
    transferStatus: "em_separacao",
    code: "TRF-20260331-080500",
  },
] as const;

export const LOCATION_TYPES: Array<LocationType | "Todos"> = [
  "Todos",
  "Fábrica",
  "Centro de Distribuição",
  "Expedição",
  "Qualidade",
];
export const LOCATION_STATUS: LocationStatus[] = ["Ativa", "Inativa", "Em manutenção"];
const MOVEMENT_TYPE_VALUES: Array<MovementType | "todos"> = ["todos", "entrada", "saida", "transferencia"];
const DATE_RANGE_VALUES: DateRangeFilter[] = ["all", "today", "7d", "30d"];
const TRANSFER_STATUS_VALUES: TransferStatus[] = [
  "solicitada",
  "em_separacao",
  "em_transito",
  "recebida",
  "cancelada",
];
const TRANSFER_PRIORITY_VALUES: TransferPriority[] = ["baixa", "media", "alta"];

type DynamicLabelOption<TValue extends string> = {
  readonly value: TValue;
  readonly label: string;
};

function resolveLanguage(language?: LanguagePreference) {
  if (language) {
    return language;
  }

  return typeof window === "undefined" ? DEFAULT_LANGUAGE_PREFERENCE : loadLanguagePreference();
}

const LOCATION_TYPE_LABELS: Record<LanguagePreference, Record<LocationType, string>> = {
  "pt-BR": {
    "Fábrica": "Fábrica",
    "Centro de Distribuição": "Centro de Distribuição",
    "Expedição": "Expedição",
    "Qualidade": "Qualidade",
  },
  "en-US": {
    "Fábrica": "Factory",
    "Centro de Distribuição": "Distribution Center",
    "Expedição": "Shipping",
    "Qualidade": "Quality",
  },
  "es-ES": {
    "Fábrica": "Fábrica",
    "Centro de Distribuição": "Centro de Distribución",
    "Expedição": "Expedición",
    "Qualidade": "Calidad",
  },
};

const LOCATION_STATUS_LABELS: Record<LanguagePreference, Record<LocationStatus, string>> = {
  "pt-BR": {
    Ativa: "Ativa",
    Inativa: "Inativa",
    "Em manutenção": "Em manutenção",
  },
  "en-US": {
    Ativa: "Active",
    Inativa: "Inactive",
    "Em manutenção": "Under maintenance",
  },
  "es-ES": {
    Ativa: "Activa",
    Inativa: "Inactiva",
    "Em manutenção": "En mantenimiento",
  },
};

const MOVEMENT_TYPE_LABELS: Record<LanguagePreference, Record<MovementType | "todos", string>> = {
  "pt-BR": {
    todos: "Todas",
    entrada: "Entradas",
    saida: "Saídas",
    transferencia: "Transferências",
  },
  "en-US": {
    todos: "All",
    entrada: "Inbound",
    saida: "Outbound",
    transferencia: "Transfers",
  },
  "es-ES": {
    todos: "Todas",
    entrada: "Entradas",
    saida: "Salidas",
    transferencia: "Transferencias",
  },
};

const DATE_RANGE_LABELS: Record<LanguagePreference, Record<DateRangeFilter, string>> = {
  "pt-BR": {
    all: "Todo período",
    today: "Hoje",
    "7d": "Últimos 7 dias",
    "30d": "Últimos 30 dias",
  },
  "en-US": {
    all: "All time",
    today: "Today",
    "7d": "Last 7 days",
    "30d": "Last 30 days",
  },
  "es-ES": {
    all: "Todo el período",
    today: "Hoy",
    "7d": "Últimos 7 días",
    "30d": "Últimos 30 días",
  },
};

const TRANSFER_STATUS_LABELS: Record<LanguagePreference, Record<TransferStatus, string>> = {
  "pt-BR": {
    solicitada: "Solicitada",
    em_separacao: "Em separação",
    em_transito: "Em trânsito",
    recebida: "Recebida",
    cancelada: "Cancelada",
  },
  "en-US": {
    solicitada: "Requested",
    em_separacao: "Picking",
    em_transito: "In transit",
    recebida: "Received",
    cancelada: "Cancelled",
  },
  "es-ES": {
    solicitada: "Solicitada",
    em_separacao: "En preparación",
    em_transito: "En tránsito",
    recebida: "Recibida",
    cancelada: "Cancelada",
  },
};

const TRANSFER_PRIORITY_LABELS: Record<LanguagePreference, Record<TransferPriority, string>> = {
  "pt-BR": {
    baixa: "Baixa",
    media: "Média",
    alta: "Alta",
  },
  "en-US": {
    baixa: "Low",
    media: "Medium",
    alta: "High",
  },
  "es-ES": {
    baixa: "Baja",
    media: "Media",
    alta: "Alta",
  },
};

const UNIT_LABELS: Record<LanguagePreference, string> = {
  "pt-BR": "unidades",
  "en-US": "units",
  "es-ES": "unidades",
};

export function getLocationTypeLabel(type: LocationType, language?: LanguagePreference) {
  return LOCATION_TYPE_LABELS[resolveLanguage(language)][type];
}

export function getLocationStatusLabel(status: LocationStatus, language?: LanguagePreference) {
  return LOCATION_STATUS_LABELS[resolveLanguage(language)][status];
}

export function getLocationTypeOptions(language?: LanguagePreference) {
  const locale = resolveLanguage(language);
  return LOCATION_TYPES.map((value) => ({
    value,
    label: value === "Todos" ? MOVEMENT_TYPE_LABELS[locale].todos : getLocationTypeLabel(value, locale),
  }));
}

export function getLocationStatusOptions(language?: LanguagePreference) {
  const locale = resolveLanguage(language);
  return LOCATION_STATUS.map((value) => ({
    value,
    label: getLocationStatusLabel(value, locale),
  }));
}

export function getMovementTypeLabel(type: MovementType | "todos", language?: LanguagePreference) {
  return MOVEMENT_TYPE_LABELS[resolveLanguage(language)][type];
}

export function getMovementTypeOptions(language?: LanguagePreference) {
  const locale = resolveLanguage(language);
  return MOVEMENT_TYPE_VALUES.map((value) => ({
    value,
    label: getMovementTypeLabel(value, locale),
  }));
}

export function getDateRangeOptions(language?: LanguagePreference) {
  const locale = resolveLanguage(language);
  return DATE_RANGE_VALUES.map((value) => ({
    value,
    label: DATE_RANGE_LABELS[locale][value],
  }));
}

export function getTransferStatusOptions(language?: LanguagePreference) {
  const locale = resolveLanguage(language);
  return TRANSFER_STATUS_VALUES.map((value) => ({
    value,
    label: TRANSFER_STATUS_LABELS[locale][value],
  }));
}

export function getTransferPriorityOptions(language?: LanguagePreference) {
  const locale = resolveLanguage(language);
  return TRANSFER_PRIORITY_VALUES.map((value) => ({
    value,
    label: TRANSFER_PRIORITY_LABELS[locale][value],
  }));
}

export const MOVEMENT_TYPES: Array<DynamicLabelOption<MovementType | "todos">> = MOVEMENT_TYPE_VALUES.map((value) => ({
  value,
  get label() {
    return getMovementTypeLabel(value);
  },
})) as Array<DynamicLabelOption<MovementType | "todos">>;

export const DATE_RANGE_OPTIONS: Array<DynamicLabelOption<DateRangeFilter>> = DATE_RANGE_VALUES.map((value) => ({
  value,
  get label() {
    return DATE_RANGE_LABELS[resolveLanguage()][value];
  },
})) as Array<DynamicLabelOption<DateRangeFilter>>;

export const TRANSFER_STATUS_OPTIONS: Array<DynamicLabelOption<TransferStatus>> = TRANSFER_STATUS_VALUES.map((value) => ({
  value,
  get label() {
    return TRANSFER_STATUS_LABELS[resolveLanguage()][value];
  },
})) as Array<DynamicLabelOption<TransferStatus>>;

export const TRANSFER_PRIORITY_OPTIONS: Array<DynamicLabelOption<TransferPriority>> = TRANSFER_PRIORITY_VALUES.map((value) => ({
  value,
  get label() {
    return TRANSFER_PRIORITY_LABELS[resolveLanguage()][value];
  },
})) as Array<DynamicLabelOption<TransferPriority>>;

export function createLocationId(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function normalizeReferenceText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeSkuIdentifier(value: string) {
  return value.trim().toUpperCase();
}

export function normalizeText(value: string) {
  return normalizeReferenceText(value);
}

export function findMatchingProductReference<TProduct extends ProductReferenceItem>(
  products: readonly TProduct[],
  value: string,
) {
  const normalizedValue = normalizeReferenceText(value);
  const normalizedSku = normalizeSkuIdentifier(value);

  if (!normalizedValue && !normalizedSku) {
    return null;
  }

  return (
    products.find(
      (product) =>
        normalizeReferenceText(product.product) === normalizedValue ||
        normalizeSkuIdentifier(product.sku) === normalizedSku,
    ) ?? null
  );
}

export function parseCapacity(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : NaN;
}

export function formatUnits(value: number, language?: LanguagePreference) {
  const locale = resolveLanguage(language);
  return `${new Intl.NumberFormat(locale).format(value)} ${UNIT_LABELS[locale]}`;
}

export function formatSignedUnits(value: number, language?: LanguagePreference) {
  const locale = resolveLanguage(language);
  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat(locale).format(value)}`;
}

export function formatDateTime(value: string, language?: LanguagePreference) {
  return new Intl.DateTimeFormat(resolveLanguage(language), {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function buildTransferCode(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `TRF-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function getMovementStatusLabel(movement: MovementItem, language?: LanguagePreference) {
  const locale = resolveLanguage(language);

  if (movement.type === "transferencia") {
    return TRANSFER_STATUS_LABELS[locale][movement.transferStatus ?? "recebida"];
  }

  const cancelledLabels: Record<LanguagePreference, string> = {
    "pt-BR": "Cancelada",
    "en-US": "Cancelled",
    "es-ES": "Cancelada",
  };
  const completedLabels: Record<LanguagePreference, string> = {
    "pt-BR": "Concluída",
    "en-US": "Completed",
    "es-ES": "Completada",
  };

  return movement.status === "cancelada" ? cancelledLabels[locale] : completedLabels[locale];
}

export function getTransferPriorityLabel(priority: TransferPriority | undefined, language?: LanguagePreference) {
  return TRANSFER_PRIORITY_LABELS[resolveLanguage(language)][priority ?? "media"];
}

export function isMovementCancelled(movement: MovementItem) {
  if (movement.type === "transferencia") {
    return (movement.transferStatus ?? "recebida") === "cancelada";
  }

  return (movement.status ?? "concluida") === "cancelada";
}

export function isMovementActiveForCapacity(movement: MovementItem) {
  return !isMovementCancelled(movement);
}

export function matchesDateRange(createdAt: string, filter: DateRangeFilter) {
  if (filter === "all") {
    return true;
  }

  const createdTime = new Date(createdAt).getTime();
  const now = new Date();

  if (filter === "today") {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return createdTime >= startOfDay;
  }

  const days = filter === "7d" ? 7 : 30;
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - days);

  return createdTime >= cutoff.getTime();
}

function isLocationStatus(value: unknown): value is LocationStatus {
  return value === "Ativa" || value === "Inativa" || value === "Em manutenção";
}

function isLocationType(value: unknown): value is LocationType {
  return value === "Fábrica" || value === "Centro de Distribuição" || value === "Expedição" || value === "Qualidade";
}

function isMovementType(value: unknown): value is MovementType {
  return value === "entrada" || value === "saida" || value === "transferencia";
}

function isMovementStatus(value: unknown): value is MovementStatus {
  return value === "concluida" || value === "cancelada";
}

function isTransferStatus(value: unknown): value is TransferStatus {
  return (
    value === "solicitada" ||
    value === "em_separacao" ||
    value === "em_transito" ||
    value === "recebida" ||
    value === "cancelada"
  );
}

function isTransferPriority(value: unknown): value is TransferPriority {
  return value === "baixa" || value === "media" || value === "alta";
}

function normalizeMovementItem(value: unknown): VersionedMovementItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    typeof item.id !== "string" ||
    typeof item.product !== "string" ||
    !isMovementType(item.type) ||
    typeof item.quantity !== "number" ||
    typeof item.reason !== "string" ||
    typeof item.user !== "string" ||
    typeof item.createdAt !== "string"
  ) {
    return null;
  }

  const type = item.type;

  return {
    id: item.id,
    product: item.product,
    productId: typeof item.productId === "string" ? item.productId : undefined,
    lotCode: typeof item.lotCode === "string" ? item.lotCode : undefined,
    type,
    quantity: item.quantity,
    reason: item.reason,
    user: item.user,
    createdAt: item.createdAt,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : undefined,
    locationId: typeof item.locationId === "string" ? item.locationId : undefined,
    fromLocationId: typeof item.fromLocationId === "string" ? item.fromLocationId : undefined,
    toLocationId: typeof item.toLocationId === "string" ? item.toLocationId : undefined,
    notes: typeof item.notes === "string" ? item.notes : undefined,
    status: isMovementStatus(item.status) ? item.status : "concluida",
    transferStatus:
      type === "transferencia"
        ? isTransferStatus(item.transferStatus)
          ? item.transferStatus
          : "recebida"
        : undefined,
    priority:
      type === "transferencia"
        ? isTransferPriority(item.priority)
          ? item.priority
          : "media"
        : undefined,
    code:
      type === "transferencia"
        ? typeof item.code === "string"
          ? item.code
          : buildTransferCode(new Date(item.createdAt))
        : undefined,
    receivedAt: typeof item.receivedAt === "string" ? item.receivedAt : undefined,
    version:
      typeof item.version === "number" &&
      Number.isInteger(item.version) &&
      item.version >= 1
        ? item.version
        : undefined,
  };
}

function normalizeLocationItem(value: unknown): VersionedLocationItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;
  const legacyCapacity = typeof item.capacity === "number" ? item.capacity : null;
  const capacityTotal =
    typeof item.capacityTotal === "number" ? item.capacityTotal : legacyCapacity;

  if (
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    !isLocationType(item.type) ||
    typeof item.address !== "string" ||
    typeof item.manager !== "string" ||
    typeof capacityTotal !== "number" ||
    !isLocationStatus(item.status)
  ) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    type: item.type,
    address: item.address,
    manager: item.manager,
    capacityTotal,
    status: item.status,
    version:
      typeof item.version === "number" &&
      Number.isInteger(item.version) &&
      item.version >= 1
        ? item.version
        : undefined,
    updatedAt:
      typeof item.updatedAt === "string" || item.updatedAt === null
        ? item.updatedAt
        : undefined,
  };
}

function normalizeLocationStockBalanceItem(value: unknown): LocationStockBalanceItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (typeof item.locationId !== "string" || typeof item.balance !== "number") {
    return null;
  }

  return {
    locationId: item.locationId,
    balance: item.balance,
  };
}

function normalizeLotDerivedLocationItem(value: unknown): LotDerivedLocationItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    item.stableLocationId !== null &&
    item.stableLocationId !== undefined &&
    typeof item.stableLocationId !== "string"
  ) {
    return null;
  }

  if (
    item.inTransitToLocationId !== null &&
    item.inTransitToLocationId !== undefined &&
    typeof item.inTransitToLocationId !== "string"
  ) {
    return null;
  }

  if (
    item.confidence !== "high" &&
    item.confidence !== "medium" &&
    item.confidence !== "low"
  ) {
    return null;
  }

  if (typeof item.mismatch !== "boolean") {
    return null;
  }

  return {
    stableLocationId:
      typeof item.stableLocationId === "string" ? item.stableLocationId : null,
    inTransitToLocationId:
      typeof item.inTransitToLocationId === "string"
        ? item.inTransitToLocationId
        : null,
    confidence: item.confidence,
    mismatch: item.mismatch,
  };
}

function sortMovements<TValue extends VersionedMovementItem>(movements: TValue[]) {
  return [...movements].sort((left, right) => {
    const timestampDiff =
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();

    if (timestampDiff !== 0) {
      return timestampDiff;
    }

    return left.id.localeCompare(right.id);
  });
}

function readStoredLocations() {
  const raw = window.localStorage.getItem(LOCATIONS_STORAGE_KEY);

  if (!raw) {
    return INITIAL_LOCATIONS;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return INITIAL_LOCATIONS;
    }

    const locations = parsed
      .map((item) => normalizeLocationItem(item))
      .filter((item): item is VersionedLocationItem => item !== null);

    return locations.length > 0 ? locations : INITIAL_LOCATIONS;
  } catch {
    return INITIAL_LOCATIONS;
  }
}

function writeStoredLocations(locations: VersionedLocationItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCATIONS_STORAGE_KEY, JSON.stringify(locations));
  dispatchErpDataEvent();
}

function upsertStoredLocation(location: VersionedLocationItem) {
  const current = readStoredLocations();
  writeStoredLocations([
    location,
    ...current.filter((item) => item.id !== location.id),
  ]);
}

function removeStoredLocation(locationId: string) {
  writeStoredLocations(
    readStoredLocations().filter((location) => location.id !== locationId),
  );
}

function stripLocationMetadata<
  TValue extends VersionedLocationItem | Partial<VersionedLocationItem>,
>(
  location: TValue,
) {
  const payload = { ...location };
  delete payload.version;
  delete payload.updatedAt;
  return payload;
}

function readStoredMovements() {
  const raw = window.localStorage.getItem(MOVEMENTS_STORAGE_KEY);

  if (!raw) {
    return INITIAL_MOVEMENTS;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return INITIAL_MOVEMENTS;
    }

    return parsed
      .map((item) => normalizeMovementItem(item))
      .filter((item): item is MovementItem => item !== null);
  } catch {
    return INITIAL_MOVEMENTS;
  }
}

function writeStoredMovements(movements: VersionedMovementItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    MOVEMENTS_STORAGE_KEY,
    JSON.stringify(sortMovements(movements)),
  );
  dispatchErpDataEvent();
}

function upsertStoredMovement(movement: VersionedMovementItem) {
  const current = readStoredMovements();
  writeStoredMovements([
    movement,
    ...current.filter((item) => item.id !== movement.id),
  ]);
}

function removeStoredMovement(movementId: string) {
  writeStoredMovements(
    readStoredMovements().filter((movement) => movement.id !== movementId),
  );
}

function stripMovementVersion<
  TValue extends VersionedMovementItem | Partial<VersionedMovementItem>,
>(
  movement: TValue,
) {
  const payload = { ...movement };
  delete payload.version;
  return payload;
}

function getMovementResponseItems(
  payload: InventoryMovementsListResponse | InventoryMovementMutationResponse | null,
) {
  return payload && "items" in payload ? payload.items : undefined;
}

function getMovementResponseItem(
  payload: InventoryMovementsListResponse | InventoryMovementMutationResponse | null,
) {
  return payload && "movement" in payload ? payload.movement : undefined;
}

function getLocationResponseItems(
  payload: InventoryLocationsListResponse | InventoryLocationMutationResponse | null,
) {
  return payload && "items" in payload ? payload.items : undefined;
}

function getLocationResponseItem(
  payload: InventoryLocationsListResponse | InventoryLocationMutationResponse | null,
) {
  return payload && "location" in payload ? payload.location : undefined;
}

async function parseMovementApiPayload(response: Response, fallbackMessage: string) {
  const payload = (await response.json().catch(() => null)) as
    | InventoryMovementsListResponse
    | InventoryMovementMutationResponse
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
    throw new MovementVersionConflictError(currentVersion);
  }

  const message =
    payload && typeof payload.error === "string"
      ? payload.error
      : fallbackMessage;

  throw new MovementRequestError(message, response.status);
}

async function parseLocationApiPayload(response: Response, fallbackMessage: string) {
  const payload = (await response.json().catch(() => null)) as
    | InventoryLocationsListResponse
    | InventoryLocationMutationResponse
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
    throw new LocationVersionConflictError(currentVersion);
  }

  const message =
    payload && typeof payload.error === "string"
      ? payload.error
      : fallbackMessage;

  throw new LocationRequestError(message, response.status);
}

async function fetchLocationsFromServer() {
  const response = await fetch(LOCATIONS_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await parseLocationApiPayload(
    response,
    "Nao foi possivel carregar as localizacoes.",
  );
  const items = getLocationResponseItems(payload);

  if (!Array.isArray(items)) {
    throw new LocationRequestError(
      "Resposta invalida ao carregar as localizacoes.",
      response.status,
    );
  }

  const locations = items
    .map((item) => normalizeLocationItem(item))
    .filter((item): item is VersionedLocationItem => item !== null);

  writeStoredLocations(locations);
  return locations.length > 0 ? locations : INITIAL_LOCATIONS;
}

function syncLocationsFromServerInBackground() {
  if (typeof window === "undefined") {
    return Promise.resolve(INITIAL_LOCATIONS);
  }

  if (!locationsSyncPromise) {
    const nextSync = fetchLocationsFromServer().finally(() => {
      if (locationsSyncPromise === nextSync) {
        locationsSyncPromise = null;
      }
    });
    locationsSyncPromise = nextSync;
  }

  return locationsSyncPromise;
}

async function fetchMovementsFromServer() {
  const response = await fetch(MOVEMENTS_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await parseMovementApiPayload(
    response,
    "Nao foi possivel carregar as movimentacoes.",
  );
  const items = getMovementResponseItems(payload);

  if (!Array.isArray(items)) {
    throw new MovementRequestError(
      "Resposta invalida ao carregar as movimentacoes.",
      response.status,
    );
  }

  const movements = items
    .map((item) => normalizeMovementItem(item))
    .filter((item): item is MovementItem => item !== null);

  writeStoredMovements(movements);
  return movements;
}

function syncMovementsFromServerInBackground() {
  if (typeof window === "undefined") {
    return Promise.resolve(INITIAL_MOVEMENTS);
  }

  if (!movementsSyncPromise) {
    const nextSync = fetchMovementsFromServer().finally(() => {
      if (movementsSyncPromise === nextSync) {
        movementsSyncPromise = null;
      }
    });
    movementsSyncPromise = nextSync;
  }

  return movementsSyncPromise;
}

export async function refreshMovements() {
  if (typeof window === "undefined") {
    return INITIAL_MOVEMENTS;
  }

  return syncMovementsFromServerInBackground();
}

export async function refreshLocations() {
  if (typeof window === "undefined") {
    return INITIAL_LOCATIONS;
  }

  return syncLocationsFromServerInBackground();
}

export function buildLocationStockBalanceMap(
  items: LocationStockBalanceItem[],
): LocationStockBalanceMap {
  return new Map(
    items.map((item) => [item.locationId, item.balance] as const),
  );
}

export async function fetchLocationStockBalances() {
  const response = await fetch(LOCATION_STOCK_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | LocationStockBalancesResponse
    | null;

  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Nao foi possivel carregar o saldo por local.";

    throw new LocationStockRequestError(message, response.status);
  }

  if (!payload || !Array.isArray(payload.items)) {
    throw new LocationStockRequestError(
      "Resposta invalida ao carregar o saldo por local.",
      response.status,
    );
  }

  return payload.items
    .map((item) => normalizeLocationStockBalanceItem(item))
    .filter((item): item is LocationStockBalanceItem => item !== null);
}

export async function fetchLotDerivedLocation(lotCode: string) {
  const response = await fetch(
    `${LOT_LOCATION_ENDPOINT_PREFIX}/${encodeURIComponent(lotCode)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | LotDerivedLocationResponse
    | null;

  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Nao foi possivel carregar a localizacao derivada do lote.";

    throw new LotLocationRequestError(message, response.status);
  }

  const derivedLocation = normalizeLotDerivedLocationItem(payload);

  if (!derivedLocation) {
    throw new LotLocationRequestError(
      "Resposta invalida ao carregar a localizacao derivada do lote.",
      response.status,
    );
  }

  return derivedLocation;
}

export async function createMovement(movement: VersionedMovementItem) {
  const response = await fetch(MOVEMENTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      movement: stripMovementVersion(movement),
    }),
  });
  const payload = await parseMovementApiPayload(
    response,
    "Nao foi possivel criar a movimentacao.",
  );
  const createdMovement = normalizeMovementItem(getMovementResponseItem(payload));

  if (!createdMovement) {
    throw new MovementRequestError(
      "Resposta invalida ao criar a movimentacao.",
      response.status,
    );
  }

  upsertStoredMovement(createdMovement);
  return createdMovement;
}

export async function updateMovement(
  movementId: string,
  movementPatch: Partial<VersionedMovementItem>,
  baseVersion: number,
) {
  const response = await fetch(
    `${MOVEMENTS_ENDPOINT}/${encodeURIComponent(movementId)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        movement: stripMovementVersion(movementPatch),
        baseVersion,
      }),
    },
  );
  const payload = await parseMovementApiPayload(
    response,
    "Nao foi possivel atualizar a movimentacao.",
  );
  const updatedMovement = normalizeMovementItem(getMovementResponseItem(payload));

  if (!updatedMovement) {
    throw new MovementRequestError(
      "Resposta invalida ao atualizar a movimentacao.",
      response.status,
    );
  }

  upsertStoredMovement(updatedMovement);
  return updatedMovement;
}

export async function deleteMovement(
  movementId: string,
  baseVersion: number,
  options?: {
    mode?: "delete" | "cancel";
  },
) {
  const response = await fetch(
    `${MOVEMENTS_ENDPOINT}/${encodeURIComponent(movementId)}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        baseVersion,
        ...(options?.mode ? { mode: options.mode } : {}),
      }),
    },
  );
  const payload = await parseMovementApiPayload(
    response,
    "Nao foi possivel excluir a movimentacao.",
  );

  if (options?.mode === "cancel") {
    const cancelledMovement = normalizeMovementItem(getMovementResponseItem(payload));

    if (!cancelledMovement) {
      throw new MovementRequestError(
        "Resposta invalida ao cancelar a movimentacao.",
        response.status,
      );
    }

    upsertStoredMovement(cancelledMovement);
    return cancelledMovement;
  }

  removeStoredMovement(movementId);
  return null;
}

export async function createLocation(location: LocationItem) {
  const response = await fetch(LOCATIONS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      location: stripLocationMetadata(location),
    }),
  });
  const payload = await parseLocationApiPayload(
    response,
    "Nao foi possivel criar a localizacao.",
  );
  const createdLocation = normalizeLocationItem(getLocationResponseItem(payload));

  if (!createdLocation) {
    throw new LocationRequestError(
      "Resposta invalida ao criar a localizacao.",
      response.status,
    );
  }

  upsertStoredLocation(createdLocation);
  return createdLocation;
}

export async function updateLocation(
  locationId: string,
  locationPatch: Partial<LocationItem>,
  baseVersion: number,
) {
  const response = await fetch(
    `${LOCATIONS_ENDPOINT}/${encodeURIComponent(locationId)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        location: stripLocationMetadata(locationPatch),
        baseVersion,
      }),
    },
  );
  const payload = await parseLocationApiPayload(
    response,
    "Nao foi possivel atualizar a localizacao.",
  );
  const updatedLocation = normalizeLocationItem(getLocationResponseItem(payload));

  if (!updatedLocation) {
    throw new LocationRequestError(
      "Resposta invalida ao atualizar a localizacao.",
      response.status,
    );
  }

  upsertStoredLocation(updatedLocation);
  return updatedLocation;
}

export async function deleteLocation(locationId: string, baseVersion: number) {
  const response = await fetch(
    `${LOCATIONS_ENDPOINT}/${encodeURIComponent(locationId)}`,
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

  await parseLocationApiPayload(
    response,
    "Nao foi possivel excluir a localizacao.",
  );

  removeStoredLocation(locationId);
  return null;
}

export function loadLocations() {
  if (typeof window === "undefined") {
    return INITIAL_LOCATIONS;
  }

  void syncLocationsFromServerInBackground().catch(() => {
    return;
  });

  return readStoredLocations();
}

export function loadMovements() {
  if (typeof window === "undefined") {
    return INITIAL_MOVEMENTS;
  }

  void syncMovementsFromServerInBackground().catch(() => {
    return;
  });

  return readStoredMovements();
}

export function getPreferredLocationUsedCapacity(
  locationId: string,
  movements: MovementItem[],
  stockBalances?: ReadonlyMap<string, number> | null,
) {
  if (stockBalances?.has(locationId)) {
    return Math.max(0, stockBalances.get(locationId) ?? 0);
  }

  return Math.max(0, getLocationUsedCapacity(locationId, movements));
}

export function getPreferredLocationAvailableCapacity(
  location: LocationItem,
  movements: MovementItem[],
  stockBalances?: ReadonlyMap<string, number> | null,
) {
  return Math.max(
    0,
    location.capacityTotal -
      getPreferredLocationUsedCapacity(location.id, movements, stockBalances),
  );
}

export function getLocationUsedCapacity(locationId: string, movements: MovementItem[]) {
  return movements.reduce((total, movement) => {
    if (!isMovementActiveForCapacity(movement)) {
      return total;
    }

    if (movement.type === "entrada" && movement.locationId === locationId) {
      return total + movement.quantity;
    }

    if (movement.type === "saida" && movement.locationId === locationId) {
      return total - movement.quantity;
    }

    if (movement.type === "transferencia") {
      if (movement.toLocationId === locationId) {
        total += movement.quantity;
      }

      if (movement.fromLocationId === locationId) {
        total -= movement.quantity;
      }
    }

    return total;
  }, 0);
}

export function getLocationAvailableCapacity(location: LocationItem, movements: MovementItem[]) {
  return location.capacityTotal - getLocationUsedCapacity(location.id, movements);
}
