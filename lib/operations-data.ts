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
  location: string;
  expiration: string;
  quantity: number;
  status: "Liberado" | "Em análise" | "Retido";
};

export type SupplierItem = {
  name: string;
  category: string;
  city: string;
  leadTimeDays: number;
  score: number;
  status: "Homologado" | "Monitorado" | "Crítico";
};

export type CategoryItem = {
  name: string;
  portfolio: string;
  skus: number;
  share: string;
  focus: string;
};

export type QualityEventItem = {
  title: string;
  lot: string;
  area: string;
  owner: string;
  status: "Em análise" | "Liberado" | "Desvio";
};

export type PlanningItem = {
  route: string;
  window: string;
  priority: "Alta" | "Média" | "Baixa";
  demand: number;
  coverage: string;
};

export type ReportItem = {
  title: string;
  owner: string;
  cadence: string;
  lastRun: string;
  summary: string;
};

export type NotificationItem = {
  title: string;
  area: string;
  priority: "Alta" | "Média" | "Baixa";
  type: "Alerta" | "Aprovação" | "Sistema";
  status: "Não lida" | "Em andamento" | "Concluída";
};

export type PendingItem = {
  title: string;
  owner: string;
  area: string;
  due: string;
  priority: "Alta" | "Média" | "Baixa";
};

export type TaskItem = {
  title: string;
  shift: string;
  owner: string;
  checklist: number;
  completed: number;
  status: "Em execução" | "Aguardando" | "Concluída";
};

export type DistributorItem = {
  name: string;
  region: string;
  channel: string;
  priority: "Alta" | "Média" | "Baixa";
  lastSupply: string;
  status: "Ativo" | "Em atenção";
};

export type IncidentItem = {
  title: string;
  area: string;
  severity: "Alta" | "Média" | "Baixa";
  owner: string;
  status: "Aberto" | "Em tratativa" | "Encerrado";
};

export type DocumentItem = {
  title: string;
  type: string;
  area: string;
  updatedAt: string;
  owner: string;
};

export type CalendarItem = {
  title: string;
  slot: string;
  area: string;
  type: "Expedição" | "Qualidade" | "Planejamento" | "Fornecedor";
};

export const PRODUCT_LINES: ProductLineItem[] = [
  {
    sku: "PF-AD-MINI-25",
    product: "PremieR Formula Cães Adultos Porte Mini",
    line: "PremieR Formula",
    species: "Cães",
    stage: "Adulto",
    package: "2,5 kg",
    stock: 18400,
    target: 24000,
    coverageDays: 12,
    status: "Atenção",
  },
  {
    sku: "GL-GC-SAL-101",
    product: "GoldeN Gatos Castrados Salmão",
    line: "GoldeN",
    species: "Gatos",
    stage: "Adulto",
    package: "10,1 kg",
    stock: 22600,
    target: 18000,
    coverageDays: 18,
    status: "Estável",
  },
  {
    sku: "NF-FL-FRA-15",
    product: "PremieR Formula Filhotes Frango",
    line: "PremieR Formula",
    species: "Cães",
    stage: "Filhote",
    package: "15 kg",
    stock: 7200,
    target: 14000,
    coverageDays: 6,
    status: "Crítico",
  },
  {
    sku: "NS-CB-CR-300",
    product: "Cookie Premier Pet Cães",
    line: "PremieR Nutrição Clínica",
    species: "Cães",
    stage: "Snack",
    package: "300 g",
    stock: 9800,
    target: 9000,
    coverageDays: 21,
    status: "Estável",
  },
] as const;

export const LOTS: LotItem[] = [
  { code: "PFM260327", product: "PremieR Formula Cães Adultos Porte Mini", location: "Complexo Industrial Dourado", expiration: "2026-11-28", quantity: 36000, status: "Liberado" },
  { code: "GGC280326", product: "GoldeN Gatos Castrados Salmão", location: "Expedição Dourado", expiration: "2026-10-16", quantity: 8000, status: "Liberado" },
  { code: "PFF310326", product: "PremieR Formula Filhotes Frango", location: "Quality Hold", expiration: "2026-09-21", quantity: 3500, status: "Em análise" },
  { code: "NCL010426", product: "PremieR Nutrição Clínica Hipoalergênica", location: "CD Sudeste", expiration: "2026-12-02", quantity: 4200, status: "Retido" },
] as const;

export const SUPPLIERS: SupplierItem[] = [
  { name: "NutriGrain Ingredientes", category: "Cereais e proteínas", city: "Ribeirão Preto/SP", leadTimeDays: 4, score: 94, status: "Homologado" },
  { name: "PackFlex Embalagens", category: "Embalagens", city: "Campinas/SP", leadTimeDays: 7, score: 89, status: "Monitorado" },
  { name: "LogPrime Transportes", category: "Distribuição", city: "Jundiaí/SP", leadTimeDays: 2, score: 91, status: "Homologado" },
  { name: "BioAdditives Brasil", category: "Aditivos nutricionais", city: "Paulínia/SP", leadTimeDays: 9, score: 72, status: "Crítico" },
] as const;

export const CATEGORIES: CategoryItem[] = [
  { name: "Super Premium Cães", portfolio: "PremieR Formula", skus: 42, share: "38%", focus: "Maior valor agregado e distribuição especializada" },
  { name: "Premium Especial Gatos", portfolio: "GoldeN", skus: 28, share: "24%", focus: "Alta recorrência no canal pet e supermercados" },
  { name: "Nutrição Clínica", portfolio: "PremieR Nutrição Clínica", skus: 14, share: "11%", focus: "Portfólio técnico com liberação controlada" },
  { name: "Snacks e Cookies", portfolio: "PremieR Cookies", skus: 18, share: "9%", focus: "Giro promocional e kits de sell-out" },
] as const;

export const QUALITY_EVENTS: QualityEventItem[] = [
  { title: "Reanálise de granulometria", lot: "PFF310326", area: "Quality Hold", owner: "Luciana Prado", status: "Em análise" },
  { title: "Liberação microbiológica", lot: "PFM260327", area: "Laboratório central", owner: "Tatiane Freitas", status: "Liberado" },
  { title: "Desvio de embalagem secundária", lot: "NCL010426", area: "Qualidade de embalagem", owner: "Marina Azevedo", status: "Desvio" },
] as const;

export const PLANNING_ITEMS: PlanningItem[] = [
  { route: "Dourado -> CD Sudeste", window: "Hoje, 18:00", priority: "Alta", demand: 12000, coverage: "Cobertura projetada de 8 dias" },
  { route: "CD Sudeste -> Canal especializado", window: "Amanhã, 08:30", priority: "Alta", demand: 6800, coverage: "Reposição do mix premium" },
  { route: "Dourado -> Expedição Dourado", window: "Hoje, 15:00", priority: "Média", demand: 8000, coverage: "Carregamento nacional" },
  { route: "Dourado -> Quality Hold", window: "Sob demanda", priority: "Baixa", demand: 1500, coverage: "Contingência de retenção" },
] as const;

export const REPORTS: ReportItem[] = [
  { title: "Giro por linha e espécie", owner: "Controladoria industrial", cadence: "Diário", lastRun: "Hoje, 07:10", summary: "Acompanha volume expedido, giro e cobertura por família de produto." },
  { title: "Capacidade por localização", owner: "Logística interna", cadence: "A cada 4 horas", lastRun: "Hoje, 11:40", summary: "Mostra ocupação, capacidade disponível e gargalos por área." },
  { title: "Lotes próximos do vencimento", owner: "Qualidade", cadence: "Diário", lastRun: "Hoje, 06:30", summary: "Monitora vencimento, retenções e lotes críticos por janela." },
  { title: "Performance de fornecedores", owner: "Suprimentos", cadence: "Semanal", lastRun: "Segunda, 09:00", summary: "Consolida lead time, score e desvios por parceiro." },
] as const;

export const NOTIFICATIONS: NotificationItem[] = [
  { title: "Transferência aguardando recebimento no CD Sudeste", area: "Transferências", priority: "Alta", type: "Alerta", status: "Não lida" },
  { title: "Lote PFF310326 precisa de parecer final da qualidade", area: "Qualidade", priority: "Alta", type: "Aprovação", status: "Em andamento" },
  { title: "Cobertura crítica em PremieR Formula Filhotes Frango", area: "Planejamento", priority: "Média", type: "Alerta", status: "Não lida" },
  { title: "Backup do ambiente demo concluído com sucesso", area: "Sistema", priority: "Baixa", type: "Sistema", status: "Concluída" },
] as const;

export const PENDING_ITEMS: PendingItem[] = [
  { title: "Confirmar recebimento do TRF-20260330-160000", owner: "Carlos Menezes", area: "CD Sudeste", due: "Hoje, 17:30", priority: "Alta" },
  { title: "Liberar reanálise do lote PFF310326", owner: "Luciana Prado", area: "Qualidade", due: "Hoje, 14:00", priority: "Alta" },
  { title: "Replanejar mix de expedição do canal Sul", owner: "Equipe de Supply", area: "Planejamento", due: "Amanhã, 09:00", priority: "Média" },
  { title: "Atualizar score do fornecedor BioAdditives Brasil", owner: "Suprimentos", area: "Fornecedores", due: "Sexta, 11:00", priority: "Baixa" },
] as const;

export const TASKS: TaskItem[] = [
  { title: "Conferência de pallets para expedição nacional", shift: "Turno A", owner: "Diego Paiva", checklist: 8, completed: 5, status: "Em execução" },
  { title: "Checklist de limpeza da área de ensaque", shift: "Turno B", owner: "Fernanda Rocha", checklist: 6, completed: 6, status: "Concluída" },
  { title: "Separação de abastecimento do CD Sudeste", shift: "Turno A", owner: "Joana Martins", checklist: 10, completed: 4, status: "Em execução" },
  { title: "Validação de amostras retidas do laboratório", shift: "Turno C", owner: "Tatiane Freitas", checklist: 5, completed: 1, status: "Aguardando" },
] as const;

export const DISTRIBUTORS: DistributorItem[] = [
  { name: "Distribuidora Pet Sul", region: "Sul", channel: "Especializado", priority: "Alta", lastSupply: "Ontem, 16:20", status: "Ativo" },
  { name: "Canal Vet Nordeste", region: "Nordeste", channel: "Veterinário", priority: "Média", lastSupply: "Segunda, 10:15", status: "Ativo" },
  { name: "Atacado Pet Minas", region: "Sudeste", channel: "Atacado", priority: "Alta", lastSupply: "Hoje, 08:50", status: "Ativo" },
  { name: "Rede MaxPet", region: "Centro-Oeste", channel: "Varejo", priority: "Baixa", lastSupply: "Há 6 dias", status: "Em atenção" },
] as const;

export const INCIDENTS: IncidentItem[] = [
  { title: "Avaria em pallet de produto acabado", area: "Expedição Dourado", severity: "Média", owner: "Fernanda Rocha", status: "Em tratativa" },
  { title: "Divergência de embalagem secundária no lote NCL010426", area: "Qualidade", severity: "Alta", owner: "Marina Azevedo", status: "Aberto" },
  { title: "Atraso de coleta na rota Sul", area: "Transporte", severity: "Baixa", owner: "LogPrime Transportes", status: "Encerrado" },
] as const;

export const DOCUMENTS: DocumentItem[] = [
  { title: "Laudo microbiológico do lote PFM260327", type: "Laudo", area: "Qualidade", updatedAt: "Hoje, 08:12", owner: "Tatiane Freitas" },
  { title: "Comprovante de transferência TRF-20260329-131000", type: "Comprovante", area: "Transferências", updatedAt: "Ontem, 19:45", owner: "Joana Martins" },
  { title: "Checklist de expedição canal Sul", type: "Checklist", area: "Expedição", updatedAt: "Hoje, 10:30", owner: "Diego Paiva" },
  { title: "Avaliação trimestral de fornecedor", type: "Documento", area: "Suprimentos", updatedAt: "Segunda, 15:00", owner: "Controladoria industrial" },
] as const;

export const CALENDAR_EVENTS: CalendarItem[] = [
  { title: "Janela de carregamento do CD Sudeste", slot: "Hoje, 18:00", area: "Expedição Dourado", type: "Expedição" },
  { title: "Inspeção final do lote PFF310326", slot: "Hoje, 14:30", area: "Laboratório central", type: "Qualidade" },
  { title: "Reunião de alinhamento de cobertura", slot: "Amanhã, 08:00", area: "Planejamento", type: "Planejamento" },
  { title: "Recebimento PackFlex Embalagens", slot: "Sexta, 09:15", area: "Suprimentos", type: "Fornecedor" },
] as const;
