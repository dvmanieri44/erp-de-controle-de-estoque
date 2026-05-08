import type { LocationItem, MovementItem } from "@/lib/inventory";
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
import type { UserAccount } from "@/lib/user-accounts";

export type ErpResourceMap = {
  "inventory.locations": LocationItem[];
  "inventory.movements": MovementItem[];
  "operations.products": ProductLineItem[];
  "operations.lots": LotItem[];
  "operations.suppliers": SupplierItem[];
  "operations.categories": CategoryItem[];
  "operations.notifications": NotificationItem[];
  "operations.quality-events": QualityEventItem[];
  "operations.planning": PlanningItem[];
  "operations.reports": ReportItem[];
  "operations.pending": PendingItem[];
  "operations.tasks": TaskItem[];
  "operations.distributors": DistributorItem[];
  "operations.incidents": IncidentItem[];
  "operations.documents": DocumentItem[];
  "operations.calendar": CalendarItem[];
  "user.accounts": UserAccount[];
};

export type ErpResourceId = keyof ErpResourceMap;

type ErpResourceDefinition<TKey extends ErpResourceId> = {
  localStorageKey: string;
  defaultValue: ErpResourceMap[TKey];
  event: "erp-data" | "user-accounts";
};

const PRODUCT_LINES_STORAGE_KEY = "erp.operations.products";
const LOCATIONS_STORAGE_KEY = "erp.locations";
const MOVEMENTS_STORAGE_KEY = "erp.movements";
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
const USER_ACCOUNTS_STORAGE_KEY = "erp.user-accounts";

const INITIAL_LOCATIONS: LocationItem[] = [
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
];

const INITIAL_MOVEMENTS: MovementItem[] = [
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
];

const INITIAL_USER_ACCOUNTS: UserAccount[] = [
  {
    id: "conta-admin-premierpet",
    name: "Joao Pedro Chiavoloni",
    username: "admin",
    email: "marina.azevedo@premierpet.com.br",
    role: "administrador",
    unit: "Matriz Dourado",
    status: "ativo",
  },
  {
    id: "conta-gestao-supply",
    name: "Equipe de Supply",
    username: "maria",
    email: "supply@premierpet.com.br",
    role: "gestor",
    unit: "Planejamento Logístico",
    status: "ativo",
  },
  {
    id: "conta-operacao-cd",
    name: "Logística Dourado",
    username: "joao",
    email: "logistica.dourado@premierpet.com.br",
    role: "operador",
    unit: "Complexo Industrial Dourado",
    status: "ativo",
  },
  {
    id: "conta-auditoria",
    name: "Auditoria Interna",
    username: "auditoria",
    email: "auditoria@premierpet.com.br",
    role: "consulta",
    unit: "Compliance Operacional",
    status: "ativo",
  },
];

export const ERP_RESOURCE_DEFINITIONS: {
  [TKey in ErpResourceId]: ErpResourceDefinition<TKey>;
} = {
  "inventory.locations": {
    localStorageKey: LOCATIONS_STORAGE_KEY,
    defaultValue: [...INITIAL_LOCATIONS],
    event: "erp-data",
  },
  "inventory.movements": {
    localStorageKey: MOVEMENTS_STORAGE_KEY,
    defaultValue: [...INITIAL_MOVEMENTS],
    event: "erp-data",
  },
  "operations.products": {
    localStorageKey: PRODUCT_LINES_STORAGE_KEY,
    defaultValue: [...PRODUCT_LINES],
    event: "erp-data",
  },
  "operations.lots": {
    localStorageKey: LOTS_STORAGE_KEY,
    defaultValue: [...LOTS],
    event: "erp-data",
  },
  "operations.suppliers": {
    localStorageKey: SUPPLIERS_STORAGE_KEY,
    defaultValue: [...SUPPLIERS],
    event: "erp-data",
  },
  "operations.categories": {
    localStorageKey: CATEGORIES_STORAGE_KEY,
    defaultValue: [...CATEGORIES],
    event: "erp-data",
  },
  "operations.notifications": {
    localStorageKey: NOTIFICATIONS_STORAGE_KEY,
    defaultValue: [...NOTIFICATIONS],
    event: "erp-data",
  },
  "operations.quality-events": {
    localStorageKey: QUALITY_EVENTS_STORAGE_KEY,
    defaultValue: [...QUALITY_EVENTS],
    event: "erp-data",
  },
  "operations.planning": {
    localStorageKey: PLANNING_ITEMS_STORAGE_KEY,
    defaultValue: [...PLANNING_ITEMS],
    event: "erp-data",
  },
  "operations.reports": {
    localStorageKey: REPORTS_STORAGE_KEY,
    defaultValue: [...REPORTS],
    event: "erp-data",
  },
  "operations.pending": {
    localStorageKey: PENDING_ITEMS_STORAGE_KEY,
    defaultValue: [...PENDING_ITEMS],
    event: "erp-data",
  },
  "operations.tasks": {
    localStorageKey: TASKS_STORAGE_KEY,
    defaultValue: [...TASKS],
    event: "erp-data",
  },
  "operations.distributors": {
    localStorageKey: DISTRIBUTORS_STORAGE_KEY,
    defaultValue: [...DISTRIBUTORS],
    event: "erp-data",
  },
  "operations.incidents": {
    localStorageKey: INCIDENTS_STORAGE_KEY,
    defaultValue: [...INCIDENTS],
    event: "erp-data",
  },
  "operations.documents": {
    localStorageKey: DOCUMENTS_STORAGE_KEY,
    defaultValue: [...DOCUMENTS],
    event: "erp-data",
  },
  "operations.calendar": {
    localStorageKey: CALENDAR_EVENTS_STORAGE_KEY,
    defaultValue: [...CALENDAR_EVENTS],
    event: "erp-data",
  },
  "user.accounts": {
    localStorageKey: USER_ACCOUNTS_STORAGE_KEY,
    defaultValue: [...INITIAL_USER_ACCOUNTS],
    event: "user-accounts",
  },
};

export function isErpResourceId(value: string): value is ErpResourceId {
  return value in ERP_RESOURCE_DEFINITIONS;
}

export function cloneErpResourceDefault<TKey extends ErpResourceId>(resource: TKey): ErpResourceMap[TKey] {
  return JSON.parse(JSON.stringify(ERP_RESOURCE_DEFINITIONS[resource].defaultValue)) as ErpResourceMap[TKey];
}
