export type DashboardSection = {
  id: string;
  label: string;
  description: string;
  group: "principal" | "estoque" | "gestao" | "relatorios" | "configuracoes";
};

export const DASHBOARD_SECTIONS: DashboardSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Visão geral de indicadores do estoque.",
    group: "principal",
  },
  {
    id: "produtos",
    label: "Produtos",
    description: "Catálogo de produtos e dados essenciais.",
    group: "estoque",
  },
  {
    id: "movimentacoes",
    label: "Movimentações",
    description: "Histórico de transferências e movimentações internas.",
    group: "estoque",
  },
  {
    id: "estoque-baixo",
    label: "Estoque Baixo",
    description: "Lista de itens com quantidade abaixo do mínimo ideal.",
    group: "estoque",
  },
  {
    id: "lotes",
    label: "Lotes",
    description: "Gestão de lotes e rastreabilidade.",
    group: "estoque",
  },
  {
    id: "fornecedores",
    label: "Fornecedores",
    description: "Cadastro e relacionamento com fornecedores.",
    group: "gestao",
  },
  {
    id: "categorias",
    label: "Categorias",
    description: "Organização de produtos por categorias e famílias.",
    group: "gestao",
  },
  {
    id: "localizacoes",
    label: "Localizações",
    description: "Mapa de ruas, corredores e posições no estoque.",
    group: "gestao",
  },
  {
    id: "transferencias",
    label: "Transferências",
    description: "Transferências internas entre locais e depósitos.",
    group: "gestao",
  },
  {
    id: "relatorios",
    label: "Relatórios",
    description: "Análises e exportações gerenciais.",
    group: "relatorios",
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Indicadores, tendências e comparativos do estoque.",
    group: "relatorios",
  },
  {
    id: "historico",
    label: "Histórico",
    description: "Linha do tempo completa das operações realizadas.",
    group: "relatorios",
  },
  {
    id: "configuracoes",
    label: "Configurações",
    description: "Preferências da conta, idioma, notificações e dados da empresa.",
    group: "configuracoes",
  },
];

export const DEFAULT_SECTION_ID = "dashboard";

export const DASHBOARD_GROUPS = [
  { id: "principal", label: "Principal" },
  { id: "estoque", label: "Estoque" },
  { id: "gestao", label: "Gestão" },
  { id: "relatorios", label: "Relatórios" },
] as const;

export function getSectionById(sectionId: string) {
  return DASHBOARD_SECTIONS.find((section) => section.id === sectionId);
}
