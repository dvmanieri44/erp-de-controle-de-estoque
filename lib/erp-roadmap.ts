import { DEFAULT_LANGUAGE_PREFERENCE, type LanguagePreference } from "@/lib/ui-preferences";

export type RoadmapTheme =
  | "operacao"
  | "logistica"
  | "compras"
  | "seguranca"
  | "analytics"
  | "ux"
  | "plataforma";

export type RoadmapStage = "fundacao" | "expansao" | "escala";
export type RoadmapImpact = "alto" | "medio" | "estrategico";
export type RoadmapEffort = "medio" | "alto" | "transformacional";

export type RoadmapIdea = {
  id: string;
  title: string;
  summary: string;
  theme: RoadmapTheme;
  stage: RoadmapStage;
  impact: RoadmapImpact;
  effort: RoadmapEffort;
};

const IDEA_SEED: Array<[string, string, RoadmapTheme, RoadmapStage, RoadmapImpact, RoadmapEffort]> = [
  ["Cadastro de produtos com variações", "Modelar SKU, unidade, embalagem e conversão operacional.", "operacao", "fundacao", "alto", "medio"],
  ["Controle por lotes", "Rastrear entradas, saldos, validade e bloqueios por lote.", "operacao", "fundacao", "alto", "medio"],
  ["Controle por série", "Acompanhar itens únicos e sua trilha completa de movimentação.", "operacao", "expansao", "alto", "alto"],
  ["Validade com alertas", "Disparar ações para vencimento, FEFO e janelas de risco.", "operacao", "fundacao", "alto", "medio"],
  ["Estoque mínimo e máximo", "Definir alvo, mínimo, máximo e ponto de ressuprimento.", "operacao", "fundacao", "alto", "medio"],
  ["Inventário cíclico", "Programar contagens contínuas por classe, área e risco.", "operacao", "fundacao", "alto", "medio"],
  ["Ajuste com motivo obrigatório", "Registrar correção de saldo com justificativa e aprovador.", "operacao", "fundacao", "alto", "medio"],
  ["Transferência com aprovação", "Criar fluxo formal para transferências internas sensíveis.", "operacao", "fundacao", "alto", "medio"],
  ["Transferência entre filiais", "Levar saldo entre unidades com acompanhamento ponta a ponta.", "operacao", "expansao", "alto", "alto"],
  ["Reserva de estoque", "Separar saldo para pedidos, tarefas ou ordens de produção.", "operacao", "expansao", "alto", "medio"],
  ["Bloqueio por avaria ou quarentena", "Impedir uso de estoque sob análise, dano ou retenção.", "operacao", "fundacao", "alto", "medio"],
  ["Kit e desmontagem", "Montar kits comerciais e desmontar combinações no saldo.", "operacao", "expansao", "medio", "medio"],
  ["Rastreabilidade por SKU", "Ver a jornada completa do item entre entrada, uso e saída.", "operacao", "fundacao", "alto", "medio"],
  ["Histórico cronológico por item", "Centralizar eventos, motivos, usuários e evidências.", "operacao", "fundacao", "alto", "medio"],
  ["Sugestão automática de localização", "Indicar melhor endereço conforme giro e disponibilidade.", "operacao", "escala", "estrategico", "alto"],
  ["FIFO, FEFO e custo médio", "Escolher regra de baixa conforme política operacional.", "operacao", "expansao", "alto", "alto"],
  ["Curva ABC", "Classificar itens por relevância, consumo e impacto financeiro.", "analytics", "fundacao", "alto", "medio"],
  ["Giro de estoque", "Medir rotação por SKU, família, filial e período.", "analytics", "fundacao", "alto", "medio"],
  ["Cobertura em dias", "Projetar quantos dias o saldo suporta a demanda atual.", "analytics", "fundacao", "alto", "medio"],
  ["Alerta de ruptura iminente", "Antecipar falta de estoque antes de afetar a operação.", "analytics", "fundacao", "alto", "medio"],
  ["Endereçamento completo", "Estruturar rua, módulo, nível, posição e zona operacional.", "logistica", "fundacao", "alto", "medio"],
  ["Mapa visual do armazém", "Representar o espaço físico para navegação e ocupação.", "logistica", "expansao", "alto", "alto"],
  ["Recebimento com conferência cega", "Conferir mercadoria sem antecipar quantidade esperada.", "logistica", "expansao", "alto", "alto"],
  ["Picking list", "Gerar lista de separação por rota, pedido ou prioridade.", "logistica", "expansao", "alto", "medio"],
  ["Packing com conferência final", "Validar itens antes da expedição e reduzir erro.", "logistica", "expansao", "alto", "medio"],
  ["Expedição com checklist", "Padronizar a liberação final com verificações obrigatórias.", "logistica", "expansao", "alto", "medio"],
  ["Gestão de docas", "Controlar agenda, ocupação e fila de recebimento e saída.", "logistica", "expansao", "medio", "alto"],
  ["Agendamento logístico", "Marcar recebimentos e expedições por janela e prioridade.", "logistica", "expansao", "medio", "alto"],
  ["Ondas de separação", "Agrupar tarefas de picking para ganhar produtividade.", "logistica", "escala", "estrategico", "alto"],
  ["Roteirização interna", "Definir melhor trajeto de coleta dentro do armazém.", "logistica", "escala", "estrategico", "alto"],
  ["Cross docking", "Mover itens de recebimento para expedição sem armazenagem.", "logistica", "escala", "medio", "alto"],
  ["Devoluções e reversa", "Tratar retorno de mercadoria com status e motivo.", "logistica", "expansao", "alto", "medio"],
  ["Transferências com SLA", "Controlar prazo alvo para cada etapa operacional.", "logistica", "expansao", "medio", "medio"],
  ["Controle de pallets", "Rastrear embalagens retornáveis, pallets e ativos logísticos.", "logistica", "expansao", "medio", "medio"],
  ["Check-in de transportadoras", "Receber parceiros com fila, doca e janela reservada.", "logistica", "escala", "medio", "alto"],
  ["Acompanhamento de carga", "Visualizar status da carga entre preparo e entrega.", "logistica", "expansao", "alto", "alto"],
  ["Prova de entrega", "Registrar assinatura e confirmação de recebimento.", "logistica", "expansao", "alto", "medio"],
  ["Foto por ocorrência", "Anexar evidências visuais em desvios e incidentes.", "logistica", "fundacao", "medio", "medio"],
  ["Checklist de segurança operacional", "Garantir padrão de operação segura no dia a dia.", "logistica", "fundacao", "alto", "medio"],
  ["Gestão de equipamentos", "Controlar empilhadeiras, coletores e manutenção associada.", "logistica", "escala", "medio", "alto"],
  ["Solicitação de compra automática", "Gerar sugestões de compra com base em cobertura e demanda.", "compras", "expansao", "alto", "alto"],
  ["Comparação de fornecedores", "Confrontar preço, prazo, score e histórico de entrega.", "compras", "expansao", "alto", "medio"],
  ["Pedido de compra com aprovação", "Formalizar compras por alçada e fluxo interno.", "compras", "expansao", "alto", "alto"],
  ["Recebimento vinculado à compra", "Conectar entrada física ao pedido e itens esperados.", "compras", "expansao", "alto", "medio"],
  ["Lead time por fornecedor", "Medir prazo médio, atraso e confiabilidade de entrega.", "compras", "fundacao", "medio", "medio"],
  ["Histórico de preço de compra", "Acompanhar variação de custo ao longo do tempo.", "compras", "fundacao", "alto", "medio"],
  ["Ordem de produção", "Abrir, acompanhar e baixar ordens ligadas ao estoque.", "compras", "escala", "estrategico", "alto"],
  ["Baixa de insumos", "Consumir matéria-prima conforme ordem ou apontamento.", "compras", "escala", "alto", "alto"],
  ["Entrada de produto acabado", "Fechar produção e converter em saldo disponível.", "compras", "escala", "alto", "alto"],
  ["Planejamento de materiais", "Projetar necessidade futura com demanda e reposição.", "compras", "escala", "estrategico", "alto"],
  ["Integração com pedidos de venda", "Reservar e baixar saldo por compromisso comercial.", "compras", "escala", "alto", "alto"],
  ["Reserva para vendas", "Priorizar estoque para pedido confirmado e em separação.", "compras", "expansao", "alto", "medio"],
  ["Separação por pedido", "Orquestrar picking, packing e despacho por venda.", "compras", "expansao", "alto", "alto"],
  ["Faturamento ligado à saída", "Relacionar expedição com documento comercial e fiscal.", "compras", "escala", "alto", "alto"],
  ["Devolução de cliente", "Tratar retorno comercial com reintegração ou descarte.", "compras", "expansao", "alto", "medio"],
  ["Gestão de perdas e sucata", "Registrar quebra, descarte e impacto financeiro.", "compras", "fundacao", "alto", "medio"],
  ["Custeio por lote", "Medir custo por origem, lote e janela operacional.", "compras", "escala", "medio", "alto"],
  ["Margem por produto", "Cruzar estoque, custo e preço para entender rentabilidade.", "analytics", "escala", "alto", "alto"],
  ["Simulação compra versus ruptura", "Comparar reposição, custo e risco de indisponibilidade.", "analytics", "escala", "estrategico", "alto"],
  ["Login robusto", "Criar autenticação real para acesso seguro ao ERP.", "seguranca", "fundacao", "alto", "alto"],
  ["Perfis por função", "Separar administrador, gestor, operador e consulta.", "seguranca", "fundacao", "alto", "medio"],
  ["Permissão por tela", "Restringir visualização e ação por módulo e funcionalidade.", "seguranca", "fundacao", "alto", "medio"],
  ["Permissão por filial", "Limitar acesso conforme unidade de trabalho.", "seguranca", "expansao", "alto", "medio"],
  ["Permissão por localização", "Controlar áreas sensíveis ou zonas restritas.", "seguranca", "expansao", "medio", "medio"],
  ["Auditoria completa", "Registrar quem fez o que, quando e em qual contexto.", "seguranca", "fundacao", "alto", "medio"],
  ["Histórico de login e sessão", "Rastrear acessos, dispositivos e duração de uso.", "seguranca", "fundacao", "medio", "medio"],
  ["Aprovação em duas etapas", "Exigir dupla validação em ações de alto risco.", "seguranca", "expansao", "alto", "alto"],
  ["Observação obrigatória", "Forçar contexto em ajustes e exclusões sensíveis.", "seguranca", "fundacao", "alto", "medio"],
  ["Assinatura eletrônica interna", "Validar aprovações com identidade operacional.", "seguranca", "expansao", "medio", "alto"],
  ["Auditoria exportável", "Permitir extração de trilhas para compliance e revisão.", "seguranca", "expansao", "medio", "medio"],
  ["Alerta de comportamento suspeito", "Detectar padrão anômalo em acessos e operações.", "seguranca", "escala", "estrategico", "alto"],
  ["Bloqueio por tentativas excessivas", "Proteger login contra abuso e brute force.", "seguranca", "fundacao", "medio", "medio"],
  ["Mascaramento de dados", "Ocultar dados sensíveis conforme perfil e contexto.", "seguranca", "expansao", "medio", "medio"],
  ["LGPD e retenção", "Aplicar políticas de consentimento, descarte e anonimato.", "seguranca", "escala", "alto", "alto"],
  ["Logs administrativos", "Concentrar mudanças estruturais em um centro único.", "seguranca", "fundacao", "alto", "medio"],
  ["Delegação temporária de acesso", "Emprestar permissão por prazo controlado.", "seguranca", "escala", "medio", "alto"],
  ["Controle de dispositivos autorizados", "Aprovar estações seguras para operação crítica.", "seguranca", "escala", "medio", "alto"],
  ["Recuperação de senha segura", "Fluxo confiável de redefinição e proteção de conta.", "seguranca", "fundacao", "alto", "medio"],
  ["SSO corporativo", "Integrar autenticação com provedor central da empresa.", "seguranca", "escala", "medio", "alto"],
  ["Dashboard executivo", "Consolidar KPIs de operação, risco e capacidade.", "analytics", "fundacao", "alto", "medio"],
  ["Dashboard em tempo real", "Atualizar eventos e gargalos sem recarregar a tela.", "analytics", "expansao", "alto", "alto"],
  ["Gráficos por período", "Permitir análise visual por janela, filial e categoria.", "analytics", "fundacao", "alto", "medio"],
  ["Busca global", "Encontrar SKU, lote, localização ou usuário num único lugar.", "ux", "fundacao", "alto", "medio"],
  ["Filtros avançados", "Salvar recortes operacionais por coluna, tag e status.", "ux", "fundacao", "alto", "medio"],
  ["Filtros favoritos", "Reabrir visões frequentes com um clique.", "ux", "expansao", "medio", "medio"],
  ["Estados vazios melhores", "Guiar o usuário quando não houver dados na tela.", "ux", "fundacao", "medio", "medio"],
  ["Atalhos de teclado", "Acelerar operação de escritório e backoffice.", "ux", "expansao", "medio", "medio"],
  ["Tema visual mais forte", "Padronizar interface, identidade e legibilidade do sistema.", "ux", "fundacao", "alto", "medio"],
  ["Modo mobile operacional", "Adaptar fluxos para uso rápido em celular e coletor.", "ux", "expansao", "alto", "alto"],
  ["PWA com offline parcial", "Permitir uso básico sem internet com sincronização posterior.", "plataforma", "escala", "estrategico", "alto"],
  ["Notificações internas", "Informar pendências, alertas e aprovações dentro do app.", "ux", "fundacao", "alto", "medio"],
  ["Centro de tarefas", "Distribuir trabalho por turno, papel e prioridade.", "ux", "expansao", "alto", "medio"],
  ["Feed de eventos", "Exibir fluxo vivo do que está acontecendo na operação.", "analytics", "expansao", "alto", "alto"],
  ["Onboarding guiado", "Ajudar novos usuários a aprender cada módulo.", "ux", "fundacao", "medio", "medio"],
  ["Tour contextual", "Explicar telas e blocos sem tirar o usuário do fluxo.", "ux", "fundacao", "medio", "medio"],
  ["Comentários e menções", "Permitir colaboração sobre itens, lotes e incidentes.", "ux", "expansao", "medio", "medio"],
  ["Relatórios PDF e Excel", "Gerar saídas compartilháveis para operação e gestão.", "analytics", "fundacao", "alto", "medio"],
  ["Widgets personalizados", "Deixar cada perfil montar sua própria visão inicial.", "ux", "escala", "medio", "alto"],
  ["Assistente com IA", "Consultar dados, explicar desvios e sugerir próximos passos.", "plataforma", "escala", "estrategico", "transformacional"],
];

export const ERP_ROADMAP_IDEAS: RoadmapIdea[] = IDEA_SEED.map(
  ([title, summary, theme, stage, impact, effort], index) => ({
    id: `idea-${String(index + 1).padStart(3, "0")}`,
    title,
    summary,
    theme,
    stage,
    impact,
    effort,
  }),
);

const ROADMAP_THEME_LABELS: Record<LanguagePreference, Record<RoadmapTheme, string>> = {
  "pt-BR": {
    operacao: "Operação",
    logistica: "Logística",
    compras: "Compras e produção",
    seguranca: "Segurança e acesso",
    analytics: "Analytics e gestão",
    ux: "Experiência",
    plataforma: "Plataforma",
  },
  "en-US": {
    operacao: "Operations",
    logistica: "Logistics",
    compras: "Purchasing and production",
    seguranca: "Security and access",
    analytics: "Analytics and management",
    ux: "Experience",
    plataforma: "Platform",
  },
  "es-ES": {
    operacao: "Operación",
    logistica: "Logística",
    compras: "Compras y producción",
    seguranca: "Seguridad y acceso",
    analytics: "Analytics y gestión",
    ux: "Experiencia",
    plataforma: "Plataforma",
  },
};

const ROADMAP_STAGE_LABELS: Record<LanguagePreference, Record<RoadmapStage, string>> = {
  "pt-BR": { fundacao: "Fundação", expansao: "Expansão", escala: "Escala" },
  "en-US": { fundacao: "Foundation", expansao: "Expansion", escala: "Scale" },
  "es-ES": { fundacao: "Fundación", expansao: "Expansión", escala: "Escala" },
};

const ROADMAP_IMPACT_LABELS: Record<LanguagePreference, Record<RoadmapImpact, string>> = {
  "pt-BR": { alto: "Alto impacto", medio: "Impacto médio", estrategico: "Impacto estratégico" },
  "en-US": { alto: "High impact", medio: "Medium impact", estrategico: "Strategic impact" },
  "es-ES": { alto: "Alto impacto", medio: "Impacto medio", estrategico: "Impacto estratégico" },
};

const ROADMAP_EFFORT_LABELS: Record<LanguagePreference, Record<RoadmapEffort, string>> = {
  "pt-BR": { medio: "Esforço médio", alto: "Esforço alto", transformacional: "Esforço transformacional" },
  "en-US": { medio: "Medium effort", alto: "High effort", transformacional: "Transformational effort" },
  "es-ES": { medio: "Esfuerzo medio", alto: "Esfuerzo alto", transformacional: "Esfuerzo transformacional" },
};

export function getRoadmapThemeLabel(theme: RoadmapTheme, locale: LanguagePreference = DEFAULT_LANGUAGE_PREFERENCE) {
  return ROADMAP_THEME_LABELS[locale][theme];
}

export function getRoadmapThemeLabels(locale: LanguagePreference = DEFAULT_LANGUAGE_PREFERENCE) {
  return ROADMAP_THEME_LABELS[locale];
}

export function getRoadmapStageLabel(stage: RoadmapStage, locale: LanguagePreference = DEFAULT_LANGUAGE_PREFERENCE) {
  return ROADMAP_STAGE_LABELS[locale][stage];
}

export function getRoadmapImpactLabel(impact: RoadmapImpact, locale: LanguagePreference = DEFAULT_LANGUAGE_PREFERENCE) {
  return ROADMAP_IMPACT_LABELS[locale][impact];
}

export function getRoadmapEffortLabel(effort: RoadmapEffort, locale: LanguagePreference = DEFAULT_LANGUAGE_PREFERENCE) {
  return ROADMAP_EFFORT_LABELS[locale][effort];
}
