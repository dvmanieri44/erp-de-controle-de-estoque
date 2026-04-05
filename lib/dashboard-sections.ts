export type DashboardSection = {
  id: string;
  label: string;
  description: string;
  group: "principal" | "estoque" | "gestao" | "relatorios" | "configuracoes";
};

export const DASHBOARD_SECTIONS: DashboardSection[] = [
  {
    id: "dashboard",
    label: "Painel Industrial",
    description: "Visão consolidada da operação de estoque, expedição, centros de distribuição e rastreabilidade da PremieRpet.",
    group: "principal",
  },
  {
    id: "notificacoes",
    label: "Notificações",
    description: "Central de alertas, aprovações, pendências de operação e avisos críticos do sistema.",
    group: "principal",
  },
  {
    id: "pendencias",
    label: "Pendências",
    description: "Itens aguardando ação por área, prioridade, responsável ou etapa do processo.",
    group: "principal",
  },
  {
    id: "produtos",
    label: "Linhas e SKUs",
    description: "Gestão de portfólio por linha, espécie, porte, fase da vida, embalagem e estoque disponível.",
    group: "estoque",
  },
  {
    id: "movimentacoes",
    label: "Movimentações",
    description: "Histórico operacional de produção liberada, expedição, saídas, ajustes e movimentações internas.",
    group: "estoque",
  },
  {
    id: "estoque-baixo",
    label: "Cobertura Crítica",
    description: "Itens com cobertura abaixo do ideal para distribuição, expedição e atendimento comercial.",
    group: "estoque",
  },
  {
    id: "lotes",
    label: "Lotes",
    description: "Rastreabilidade de lotes, validade, retenções, liberações e controle por janela operacional.",
    group: "estoque",
  },
  {
    id: "qualidade",
    label: "Qualidade",
    description: "Monitoramento de quality hold, liberações laboratoriais, desvios e status de inspeção.",
    group: "estoque",
  },
  {
    id: "fornecedores",
    label: "Fornecedores",
    description: "Cadastro e relacionamento com parceiros de insumos, embalagens, transporte e serviços industriais.",
    group: "gestao",
  },
  {
    id: "categorias",
    label: "Categorias",
    description: "Organização por linha de produto, espécie, porte, fase da vida, canal e família industrial.",
    group: "gestao",
  },
  {
    id: "localizacoes",
    label: "Localizações",
    description: "Mapa operacional de fábrica, centros de distribuição, quality hold, armazenagem e expedição.",
    group: "gestao",
  },
  {
    id: "transferencias",
    label: "Transferências",
    description: "Transferências internas entre fábrica, CD, expedição e áreas de qualidade.",
    group: "gestao",
  },
  {
    id: "planejamento",
    label: "Planejamento",
    description: "Plano mestre de abastecimento, prioridades de rota, janelas logísticas e cobertura projetada.",
    group: "gestao",
  },
  {
    id: "tarefas",
    label: "Tarefas",
    description: "Gestão de tarefas operacionais, checklists, responsáveis e execução por turno.",
    group: "gestao",
  },
  {
    id: "distribuidores",
    label: "Distribuidores",
    description: "Base de clientes e parceiros de distribuição com prioridade, região e histórico de abastecimento.",
    group: "gestao",
  },
  {
    id: "calendario",
    label: "Calendário",
    description: "Agenda operacional com janelas de expedição, validades, inspeções e eventos planejados.",
    group: "gestao",
  },
  {
    id: "relatorios",
    label: "Relatórios",
    description: "Análises gerenciais de giro, cobertura, distribuição, abastecimento e rastreabilidade.",
    group: "relatorios",
  },
  {
    id: "incidentes",
    label: "Incidentes",
    description: "Registro de avarias, desvios, atrasos, perdas e ocorrências operacionais.",
    group: "relatorios",
  },
  {
    id: "documentos",
    label: "Documentos",
    description: "Central de laudos, anexos, comprovantes, evidências e documentos de apoio da operação.",
    group: "relatorios",
  },
  {
    id: "historico",
    label: "Histórico",
    description: "Linha do tempo completa das operações logísticas e industriais, com rastreio por evento.",
    group: "relatorios",
  },
  {
    id: "configuracoes",
    label: "Configurações",
    description: "Preferências do painel, notificações, contas, contatos e dados da operação.",
    group: "configuracoes",
  },
];

export const DEFAULT_SECTION_ID = "dashboard";

export const DASHBOARD_GROUPS = [
  { id: "principal", label: "Principal" },
  { id: "estoque", label: "Operação" },
  { id: "gestao", label: "Gestão" },
  { id: "relatorios", label: "Inteligência" },
] as const;

export function getSectionById(sectionId: string) {
  return DASHBOARD_SECTIONS.find((section) => section.id === sectionId);
}
