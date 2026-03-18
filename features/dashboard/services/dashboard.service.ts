import type { DashboardSummary } from "@/features/dashboard/types/dashboard";

const DASHBOARD_SUMMARY: DashboardSummary = {
  stats: [
    {
      description: "Itens ativos cadastrados no catalogo.",
      label: "Produtos",
      value: "248",
    },
    {
      description: "Produtos abaixo do nivel minimo.",
      label: "Estoque baixo",
      value: "12",
    },
    {
      description: "Movimentacoes registradas hoje.",
      label: "Movimentacoes",
      value: "34",
    },
    {
      description: "Valor estimado do estoque atual.",
      label: "Valor em estoque",
      value: "R$ 182.400",
    },
  ],
  recentMovements: [
    {
      date: "12/03/2026",
      id: "mov-1",
      productName: "Notebook Dell Latitude",
      quantity: 3,
      type: "Entrada",
    },
    {
      date: "12/03/2026",
      id: "mov-2",
      productName: "Mouse Logitech M170",
      quantity: 8,
      type: "Saida",
    },
    {
      date: "11/03/2026",
      id: "mov-3",
      productName: "Monitor LG 24",
      quantity: 2,
      type: "Saida",
    },
  ],
  lowStockProducts: [
    {
      id: "prod-1",
      name: "Teclado Mecanico Redragon",
      quantity: 4,
    },
    {
      id: "prod-2",
      name: "Headset HyperX Cloud",
      quantity: 2,
    },
    {
      id: "prod-3",
      name: "SSD Kingston 480GB",
      quantity: 5,
    },
  ],
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return DASHBOARD_SUMMARY;
}
