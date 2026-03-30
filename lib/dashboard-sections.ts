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
    description: "Visao geral de indicadores do estoque.",
    group: "principal",
  },
  {
    id: "produtos",
    label: "Produtos",
    description: "Catalogo de produtos e dados essenciais.",
    group: "estoque",
  },
  {
    id: "movimentacoes",
    label: "Movimentacoes",
    description: "Historico de transferencias e movimentacoes internas.",
    group: "estoque",
  },
  {
    id: "estoque-baixo",
    label: "Estoque Baixo",
    description: "Lista de itens com quantidade abaixo do minimo ideal.",
    group: "estoque",
  },
  {
    id: "lotes",
    label: "Lotes",
    description: "Gestao de lotes e rastreabilidade.",
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
    description: "Organizacao de produtos por categorias e familias.",
    group: "gestao",
  },
  {
    id: "localizacoes",
    label: "Localizacoes",
    description: "Mapa de ruas, corredores e posicoes no estoque.",
    group: "gestao",
  },
  {
    id: "transferencias",
    label: "Transferencias",
    description: "Transferencias internas entre locais e depositos.",
    group: "gestao",
  },
  {
    id: "relatorios",
    label: "Relatorios",
    description: "Analises e exportacoes gerenciais.",
    group: "relatorios",
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Indicadores, tendencias e comparativos do estoque.",
    group: "relatorios",
  },
  {
    id: "historico",
    label: "Historico",
    description: "Linha do tempo completa das operacoes realizadas.",
    group: "relatorios",
  },
  {
    id: "configuracoes",
    label: "Configuracoes",
    description: "Preferencias da conta, idioma, notificacoes e dados da empresa.",
    group: "configuracoes",
  },
];

export const DEFAULT_SECTION_ID = "dashboard";

export const DASHBOARD_GROUPS = [
  { id: "principal", label: "Principal" },
  { id: "estoque", label: "Estoque" },
  { id: "gestao", label: "Gestao" },
  { id: "relatorios", label: "Relatorios" },
] as const;

export function getSectionById(sectionId: string) {
  return DASHBOARD_SECTIONS.find((section) => section.id === sectionId);
}
