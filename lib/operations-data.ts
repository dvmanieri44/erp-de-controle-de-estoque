export type ProductLineItem = {
  sku: string;
  product: string;
  line: string;
  species: "Cães" | "Gatos";
  stage: string;
  package: string;
  stock: number;
  target: number;
  coverageDays: number;
  status: "Estável" | "Atenção" | "Crítico";
};

export type LotItem = {
  code: string;
  product: string;
  productId?: string;
  locationId?: string;
  location: string;
  expiration: string;
  quantity: number;
  status: "Liberado" | "Em análise" | "Retido";
};

export type SupplierItem = {
  id?: string;
  name: string;
  category: string;
  city: string;
  leadTimeDays: number;
  score: number;
  status: "Homologado" | "Monitorado" | "Crítico";
};

export type CategoryItem = {
  id?: string;
  name: string;
  portfolio: string;
  skus: number;
  share: string;
  focus: string;
};

export type QualityEventItem = {
  id?: string;
  title: string;
  lot: string;
  area: string;
  owner: string;
  status: "Em análise" | "Liberado" | "Desvio";
};

export type PlanningItem = {
  id?: string;
  route: string;
  window: string;
  priority: "Alta" | "Média" | "Baixa";
  demand: number;
  coverage: string;
};

export type ReportItem = {
  id?: string;
  title: string;
  owner: string;
  cadence: string;
  lastRun: string;
  summary: string;
};

export type NotificationItem = {
  id?: string;
  title: string;
  area: string;
  priority: "Alta" | "Média" | "Baixa";
  type: "Alerta" | "Aprovação" | "Sistema";
  status: "Não lida" | "Em andamento" | "Concluída";
};

export type PendingItem = {
  id?: string;
  title: string;
  owner: string;
  area: string;
  due: string;
  priority: "Alta" | "Média" | "Baixa";
};

export type TaskItem = {
  id?: string;
  title: string;
  shift: string;
  owner: string;
  checklist: number;
  completed: number;
  status: "Em execução" | "Aguardando" | "Concluída";
};

export type DistributorItem = {
  id?: string;
  name: string;
  region: string;
  channel: string;
  priority: "Alta" | "Média" | "Baixa";
  lastSupply: string;
  status: "Ativo" | "Em atenção";
};

export type IncidentItem = {
  id?: string;
  title: string;
  area: string;
  severity: "Alta" | "Média" | "Baixa";
  owner: string;
  status: "Aberto" | "Em tratativa" | "Encerrado";
};

export type DocumentItem = {
  id?: string;
  title: string;
  type: string;
  area: string;
  updatedAt: string;
  owner: string;
};

export type CalendarItem = {
  id?: string;
  title: string;
  slot: string;
  area: string;
  type: "Expedição" | "Qualidade" | "Planejamento" | "Fornecedor";
};

export const PRODUCT_SPECIES_OPTIONS = ["Cães", "Gatos"] as const satisfies readonly ProductLineItem["species"][];
export const PRODUCT_STATUS_OPTIONS = ["Estável", "Atenção", "Crítico"] as const satisfies readonly ProductLineItem["status"][];
export const LOT_STATUS_OPTIONS = ["Liberado", "Em análise", "Retido"] as const satisfies readonly LotItem["status"][];
export const SUPPLIER_STATUS_OPTIONS = ["Homologado", "Monitorado", "Crítico"] as const satisfies readonly SupplierItem["status"][];
export const PRIORITY_OPTIONS = ["Alta", "Média", "Baixa"] as const;
export const QUALITY_EVENT_STATUS_OPTIONS = ["Em análise", "Liberado", "Desvio"] as const satisfies readonly QualityEventItem["status"][];
export const NOTIFICATION_TYPE_OPTIONS = ["Alerta", "Aprovação", "Sistema"] as const satisfies readonly NotificationItem["type"][];
export const NOTIFICATION_STATUS_OPTIONS = ["Não lida", "Em andamento", "Concluída"] as const satisfies readonly NotificationItem["status"][];
export const TASK_STATUS_OPTIONS = ["Aguardando", "Em execução", "Concluída"] as const satisfies readonly TaskItem["status"][];
export const DISTRIBUTOR_STATUS_OPTIONS = ["Ativo", "Em atenção"] as const satisfies readonly DistributorItem["status"][];
export const INCIDENT_SEVERITY_OPTIONS = ["Alta", "Média", "Baixa"] as const satisfies readonly IncidentItem["severity"][];
export const INCIDENT_STATUS_OPTIONS = ["Aberto", "Em tratativa", "Encerrado"] as const satisfies readonly IncidentItem["status"][];
export const CALENDAR_TYPE_OPTIONS = ["Expedição", "Qualidade", "Planejamento", "Fornecedor"] as const satisfies readonly CalendarItem["type"][];

export const PRODUCT_LINES: ProductLineItem[] = [];
export const LOTS: LotItem[] = [];
export const SUPPLIERS: SupplierItem[] = [];
export const CATEGORIES: CategoryItem[] = [];
export const QUALITY_EVENTS: QualityEventItem[] = [];
export const PLANNING_ITEMS: PlanningItem[] = [];
export const REPORTS: ReportItem[] = [];
export const NOTIFICATIONS: NotificationItem[] = [];
export const PENDING_ITEMS: PendingItem[] = [];
export const TASKS: TaskItem[] = [];
export const DISTRIBUTORS: DistributorItem[] = [];
export const INCIDENTS: IncidentItem[] = [];
export const DOCUMENTS: DocumentItem[] = [];
export const CALENDAR_EVENTS: CalendarItem[] = [];
