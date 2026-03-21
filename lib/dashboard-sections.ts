export type DashboardSection = {
  id: string;
  label: string;
  description: string;
};

export const DASHBOARD_SECTIONS: DashboardSection[] = [
  { id: "dashboard", label: "Dashboard", description: "Visao geral de indicadores do estoque." },
  { id: "produtos", label: "Produtos", description: "Catalogo de produtos e dados essenciais." },
  { id: "entradas", label: "Entradas", description: "Controle de recebimentos e reposicoes." },
  { id: "saidas", label: "Saidas", description: "Registro de baixas e expedicao de itens." },
  { id: "lotes", label: "Lotes", description: "Gestao de lotes e rastreabilidade." },
  {
    id: "movimentacoes",
    label: "Movimentacoes",
    description: "Historico de transferencias e movimentacoes internas.",
  },
  { id: "relatorios", label: "Relatorios", description: "Analises e exportacoes gerenciais." },
];

export const DEFAULT_SECTION_ID = "dashboard";

export function getSectionById(sectionId: string) {
  return DASHBOARD_SECTIONS.find((section) => section.id === sectionId);
}
