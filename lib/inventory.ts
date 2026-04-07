import {
  DEFAULT_LANGUAGE_PREFERENCE,
  loadLanguagePreference,
  type LanguagePreference,
} from "@/lib/ui-preferences";

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

export type MovementItem = {
  id: string;
  product: string;
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

export const LOCATIONS_STORAGE_KEY = "erp.locations";
export const MOVEMENTS_STORAGE_KEY = "erp.movements";

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

export function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
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

export function loadLocations() {
  const raw = window.localStorage.getItem(LOCATIONS_STORAGE_KEY);

  if (!raw) {
    return INITIAL_LOCATIONS;
  }

  const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;

  if (!Array.isArray(parsed)) {
    return INITIAL_LOCATIONS;
  }

  const locations = parsed
    .map((item) => {
      const legacyCapacity = typeof item.capacity === "number" ? item.capacity : null;
      const capacityTotal = typeof item.capacityTotal === "number" ? item.capacityTotal : legacyCapacity;

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
      } satisfies LocationItem;
    })
    .filter((item): item is LocationItem => item !== null);

  return locations.length > 0 ? locations : INITIAL_LOCATIONS;
}

export function saveLocations(locations: LocationItem[]) {
  window.localStorage.setItem(LOCATIONS_STORAGE_KEY, JSON.stringify(locations));
}

export function loadMovements() {
  const raw = window.localStorage.getItem(MOVEMENTS_STORAGE_KEY);

  if (!raw) {
    return INITIAL_MOVEMENTS;
  }

  const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;

  if (!Array.isArray(parsed)) {
    return INITIAL_MOVEMENTS;
  }

  return parsed
    .map((item) => {
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

      const movement: MovementItem = {
        id: item.id,
        product: item.product,
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
      };

      return movement;
    })
    .filter((item): item is MovementItem => item !== null);
}

export function saveMovements(movements: MovementItem[]) {
  window.localStorage.setItem(MOVEMENTS_STORAGE_KEY, JSON.stringify(movements));
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
