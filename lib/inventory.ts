export type LocationType = "Depósito" | "Loja" | "Armazém";
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
    id: "deposito-principal",
    name: "Depósito Principal",
    type: "Depósito",
    address: "Rua Central, 100 - São Paulo",
    manager: "Roberto Lima",
    capacityTotal: 10000,
    status: "Ativa",
  },
  {
    id: "loja-centro",
    name: "Loja Centro",
    type: "Loja",
    address: "Av. Paulista, 500 - São Paulo",
    manager: "Maria Costa",
    capacityTotal: 2000,
    status: "Ativa",
  },
] as const;

export const INITIAL_MOVEMENTS: MovementItem[] = [];

export const LOCATION_TYPES: Array<LocationType | "Todos"> = ["Todos", "Depósito", "Loja", "Armazém"];
export const LOCATION_STATUS: LocationStatus[] = ["Ativa", "Inativa", "Em manutenção"];
export const MOVEMENT_TYPES: Array<{ value: MovementType | "todos"; label: string }> = [
  { value: "todos", label: "Todas" },
  { value: "entrada", label: "Entradas" },
  { value: "saida", label: "Saídas" },
  { value: "transferencia", label: "Transferências" },
];
export const DATE_RANGE_OPTIONS: Array<{ value: DateRangeFilter; label: string }> = [
  { value: "all", label: "Todo período" },
  { value: "today", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
];
export const TRANSFER_STATUS_OPTIONS: Array<{ value: TransferStatus; label: string }> = [
  { value: "solicitada", label: "Solicitada" },
  { value: "em_separacao", label: "Em separação" },
  { value: "em_transito", label: "Em trânsito" },
  { value: "recebida", label: "Recebida" },
  { value: "cancelada", label: "Cancelada" },
];
export const TRANSFER_PRIORITY_OPTIONS: Array<{ value: TransferPriority; label: string }> = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
];

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

export function formatUnits(value: number) {
  return `${new Intl.NumberFormat("pt-BR").format(value)} unidades`;
}

export function formatSignedUnits(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("pt-BR").format(value)}`;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function buildTransferCode(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `TRF-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function getMovementStatusLabel(movement: MovementItem) {
  if (movement.type === "transferencia") {
    const transferStatus = movement.transferStatus ?? "recebida";

    if (transferStatus === "solicitada") return "Solicitada";
    if (transferStatus === "em_separacao") return "Em separação";
    if (transferStatus === "em_transito") return "Em trânsito";
    if (transferStatus === "cancelada") return "Cancelada";
    return "Recebida";
  }

  return movement.status === "cancelada" ? "Cancelada" : "Concluída";
}

export function getTransferPriorityLabel(priority: TransferPriority | undefined) {
  if (priority === "alta") return "Alta";
  if (priority === "baixa") return "Baixa";
  return "Média";
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
  return value === "Depósito" || value === "Loja" || value === "Armazém";
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
