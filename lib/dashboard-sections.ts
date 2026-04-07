import { DEFAULT_LANGUAGE_PREFERENCE, type LanguagePreference } from "@/lib/ui-preferences";

type DashboardGroupId = "principal" | "estoque" | "gestao" | "relatorios" | "estrategia" | "configuracoes";

export type DashboardSection = {
  id: string;
  label: string;
  description: string;
  group: DashboardGroupId;
};

type SectionDefinition = {
  id: string;
  group: DashboardGroupId;
};

const SECTION_DEFINITIONS: SectionDefinition[] = [
  { id: "dashboard", group: "principal" },
  { id: "notificacoes", group: "principal" },
  { id: "pendencias", group: "principal" },
  { id: "produtos", group: "estoque" },
  { id: "movimentacoes", group: "estoque" },
  { id: "estoque-baixo", group: "estoque" },
  { id: "lotes", group: "estoque" },
  { id: "qualidade", group: "estoque" },
  { id: "fornecedores", group: "gestao" },
  { id: "categorias", group: "gestao" },
  { id: "localizacoes", group: "gestao" },
  { id: "transferencias", group: "gestao" },
  { id: "planejamento", group: "gestao" },
  { id: "tarefas", group: "gestao" },
  { id: "distribuidores", group: "gestao" },
  { id: "calendario", group: "gestao" },
  { id: "relatorios", group: "relatorios" },
  { id: "incidentes", group: "relatorios" },
  { id: "documentos", group: "relatorios" },
  { id: "historico", group: "relatorios" },
  { id: "roadmap", group: "estrategia" },
  { id: "configuracoes", group: "configuracoes" },
];

const SECTION_COPY: Record<LanguagePreference, Record<string, { label: string; description: string }>> = {
  "pt-BR": {
    dashboard: {
      label: "Painel Industrial",
      description: "Visão consolidada da operação de estoque, expedição, centros de distribuição e rastreabilidade da PremieRpet.",
    },
    notificacoes: {
      label: "Notificações",
      description: "Central de alertas, aprovações, pendências de operação e avisos críticos do sistema.",
    },
    pendencias: {
      label: "Pendências",
      description: "Itens aguardando ação por área, prioridade, responsável ou etapa do processo.",
    },
    produtos: {
      label: "Linhas e SKUs",
      description: "Gestão de portfólio por linha, espécie, porte, fase da vida, embalagem e estoque disponível.",
    },
    movimentacoes: {
      label: "Movimentações",
      description: "Histórico operacional de produção liberada, expedição, saídas, ajustes e movimentações internas.",
    },
    "estoque-baixo": {
      label: "Cobertura Crítica",
      description: "Itens com cobertura abaixo do ideal para distribuição, expedição e atendimento comercial.",
    },
    lotes: {
      label: "Lotes",
      description: "Rastreabilidade de lotes, validade, retenções, liberações e controle por janela operacional.",
    },
    qualidade: {
      label: "Qualidade",
      description: "Monitoramento de quality hold, liberações laboratoriais, desvios e status de inspeção.",
    },
    fornecedores: {
      label: "Fornecedores",
      description: "Cadastro e relacionamento com parceiros de insumos, embalagens, transporte e serviços industriais.",
    },
    categorias: {
      label: "Categorias",
      description: "Organização por linha de produto, espécie, porte, fase da vida, canal e família industrial.",
    },
    localizacoes: {
      label: "Localizações",
      description: "Mapa operacional de fábrica, centros de distribuição, quality hold, armazenagem e expedição.",
    },
    transferencias: {
      label: "Transferências",
      description: "Transferências internas entre fábrica, CD, expedição e áreas de qualidade.",
    },
    planejamento: {
      label: "Planejamento",
      description: "Plano mestre de abastecimento, prioridades de rota, janelas logísticas e cobertura projetada.",
    },
    tarefas: {
      label: "Tarefas",
      description: "Gestão de tarefas operacionais, checklists, responsáveis e execução por turno.",
    },
    distribuidores: {
      label: "Distribuidores",
      description: "Base de clientes e parceiros de distribuição com prioridade, região e histórico de abastecimento.",
    },
    calendario: {
      label: "Calendário",
      description: "Agenda operacional com janelas de expedição, validades, inspeções e eventos planejados.",
    },
    relatorios: {
      label: "Relatórios",
      description: "Análises gerenciais de giro, cobertura, distribuição, abastecimento e rastreabilidade.",
    },
    incidentes: {
      label: "Incidentes",
      description: "Registro de avarias, desvios, atrasos, perdas e ocorrências operacionais.",
    },
    documentos: {
      label: "Documentos",
      description: "Central de laudos, anexos, comprovantes, evidências e documentos de apoio da operação.",
    },
    historico: {
      label: "Histórico",
      description: "Linha do tempo completa das operações logísticas e industriais, com rastreio por evento.",
    },
    roadmap: {
      label: "Roadmap ERP",
      description: "Backlog estratégico com as ideias priorizadas para evoluir o ERP em fundação, expansão e escala.",
    },
    configuracoes: {
      label: "Configurações",
      description: "Preferências do painel, notificações, contas, contatos e dados da operação.",
    },
  },
  "en-US": {
    dashboard: {
      label: "Industrial Dashboard",
      description: "Consolidated view of warehouse operations, shipping, distribution centers and PremieRpet traceability.",
    },
    notificacoes: {
      label: "Notifications",
      description: "Central hub for alerts, approvals, operational pending items and critical system notices.",
    },
    pendencias: {
      label: "Pending Items",
      description: "Items waiting for action by area, priority, owner or process stage.",
    },
    produtos: {
      label: "Lines and SKUs",
      description: "Portfolio management by product line, species, size, life stage, package and available stock.",
    },
    movimentacoes: {
      label: "Movements",
      description: "Operational history of released production, shipping, outbound, adjustments and internal movements.",
    },
    "estoque-baixo": {
      label: "Critical Coverage",
      description: "Items below the ideal stock coverage for distribution, shipping and commercial service.",
    },
    lotes: {
      label: "Lots",
      description: "Lot traceability, shelf life, holds, releases and control by operational window.",
    },
    qualidade: {
      label: "Quality",
      description: "Monitoring of quality hold, lab releases, deviations and inspection status.",
    },
    fornecedores: {
      label: "Suppliers",
      description: "Registration and relationship management with ingredient, packaging, transport and industrial service partners.",
    },
    categorias: {
      label: "Categories",
      description: "Organization by product line, species, size, life stage, channel and industrial family.",
    },
    localizacoes: {
      label: "Locations",
      description: "Operational map of factory, distribution centers, quality hold, storage and shipping.",
    },
    transferencias: {
      label: "Transfers",
      description: "Internal transfers between factory, DC, shipping and quality areas.",
    },
    planejamento: {
      label: "Planning",
      description: "Master supply plan, route priorities, logistics windows and projected coverage.",
    },
    tarefas: {
      label: "Tasks",
      description: "Management of operational tasks, checklists, owners and shift execution.",
    },
    distribuidores: {
      label: "Distributors",
      description: "Customer and distribution partner base with priority, region and replenishment history.",
    },
    calendario: {
      label: "Calendar",
      description: "Operational calendar with shipping windows, expirations, inspections and planned events.",
    },
    relatorios: {
      label: "Reports",
      description: "Management analyses of turnover, coverage, distribution, replenishment and traceability.",
    },
    incidentes: {
      label: "Incidents",
      description: "Record of damages, deviations, delays, losses and operational incidents.",
    },
    documentos: {
      label: "Documents",
      description: "Central hub for reports, attachments, receipts, evidence and operational support documents.",
    },
    historico: {
      label: "History",
      description: "Complete timeline of logistics and industrial operations with event-level traceability.",
    },
    roadmap: {
      label: "ERP Roadmap",
      description: "Strategic backlog with prioritized ideas to evolve the ERP through foundation, expansion and scale.",
    },
    configuracoes: {
      label: "Settings",
      description: "Dashboard preferences, notifications, accounts, contacts and operational data.",
    },
  },
  "es-ES": {
    dashboard: {
      label: "Panel Industrial",
      description: "Vista consolidada de la operación de inventario, expedición, centros de distribución y trazabilidad de PremieRpet.",
    },
    notificacoes: {
      label: "Notificaciones",
      description: "Centro de alertas, aprobaciones, pendientes operativos y avisos críticos del sistema.",
    },
    pendencias: {
      label: "Pendientes",
      description: "Elementos que esperan acción por área, prioridad, responsable o etapa del proceso.",
    },
    produtos: {
      label: "Líneas y SKUs",
      description: "Gestión del portafolio por línea, especie, tamaño, etapa de vida, empaque y stock disponible.",
    },
    movimentacoes: {
      label: "Movimientos",
      description: "Historial operativo de producción liberada, expedición, salidas, ajustes y movimientos internos.",
    },
    "estoque-baixo": {
      label: "Cobertura Crítica",
      description: "Ítems por debajo de la cobertura ideal para distribución, expedición y atención comercial.",
    },
    lotes: {
      label: "Lotes",
      description: "Trazabilidad de lotes, vencimiento, retenciones, liberaciones y control por ventana operativa.",
    },
    qualidade: {
      label: "Calidad",
      description: "Monitoreo de quality hold, liberaciones de laboratorio, desvíos y estado de inspección.",
    },
    fornecedores: {
      label: "Proveedores",
      description: "Registro y relación con socios de insumos, embalajes, transporte y servicios industriales.",
    },
    categorias: {
      label: "Categorías",
      description: "Organización por línea de producto, especie, tamaño, etapa de vida, canal y familia industrial.",
    },
    localizacoes: {
      label: "Ubicaciones",
      description: "Mapa operativo de fábrica, centros de distribución, quality hold, almacenaje y expedición.",
    },
    transferencias: {
      label: "Transferencias",
      description: "Transferencias internas entre fábrica, CD, expedición y áreas de calidad.",
    },
    planejamento: {
      label: "Planificación",
      description: "Plan maestro de abastecimiento, prioridades de ruta, ventanas logísticas y cobertura proyectada.",
    },
    tarefas: {
      label: "Tareas",
      description: "Gestión de tareas operativas, checklists, responsables y ejecución por turno.",
    },
    distribuidores: {
      label: "Distribuidores",
      description: "Base de clientes y socios de distribución con prioridad, región e historial de abastecimiento.",
    },
    calendario: {
      label: "Calendario",
      description: "Agenda operativa con ventanas de expedición, vencimientos, inspecciones y eventos planificados.",
    },
    relatorios: {
      label: "Informes",
      description: "Análisis gerenciales de giro, cobertura, distribución, abastecimiento y trazabilidad.",
    },
    incidentes: {
      label: "Incidentes",
      description: "Registro de averías, desvíos, retrasos, pérdidas e incidentes operativos.",
    },
    documentos: {
      label: "Documentos",
      description: "Centro de informes, anexos, comprobantes, evidencias y documentos de apoyo operativo.",
    },
    historico: {
      label: "Historial",
      description: "Línea de tiempo completa de las operaciones logísticas e industriales, con rastreo por evento.",
    },
    roadmap: {
      label: "Roadmap ERP",
      description: "Backlog estratégico con ideas priorizadas para evolucionar el ERP en fundación, expansión y escala.",
    },
    configuracoes: {
      label: "Configuración",
      description: "Preferencias del panel, notificaciones, cuentas, contactos y datos de la operación.",
    },
  },
};

const GROUP_COPY: Record<LanguagePreference, Array<{ id: Exclude<DashboardGroupId, "configuracoes">; label: string }>> = {
  "pt-BR": [
    { id: "principal", label: "Principal" },
    { id: "estoque", label: "Operação" },
    { id: "gestao", label: "Gestão" },
    { id: "relatorios", label: "Inteligência" },
    { id: "estrategia", label: "Estratégia" },
  ],
  "en-US": [
    { id: "principal", label: "Main" },
    { id: "estoque", label: "Operations" },
    { id: "gestao", label: "Management" },
    { id: "relatorios", label: "Insights" },
    { id: "estrategia", label: "Strategy" },
  ],
  "es-ES": [
    { id: "principal", label: "Principal" },
    { id: "estoque", label: "Operación" },
    { id: "gestao", label: "Gestión" },
    { id: "relatorios", label: "Inteligencia" },
    { id: "estrategia", label: "Estrategia" },
  ],
};

export function getDashboardSections(locale: LanguagePreference = DEFAULT_LANGUAGE_PREFERENCE): DashboardSection[] {
  return SECTION_DEFINITIONS.map((section) => ({
    ...section,
    ...SECTION_COPY[locale][section.id],
  }));
}

export function getSectionById(sectionId: string, locale: LanguagePreference = DEFAULT_LANGUAGE_PREFERENCE) {
  return getDashboardSections(locale).find((section) => section.id === sectionId);
}

export const DASHBOARD_SECTIONS = getDashboardSections();
export const DEFAULT_SECTION_ID = "dashboard";

export function getDashboardGroups(locale: LanguagePreference = DEFAULT_LANGUAGE_PREFERENCE) {
  return GROUP_COPY[locale];
}

export const DASHBOARD_GROUPS = getDashboardGroups();
