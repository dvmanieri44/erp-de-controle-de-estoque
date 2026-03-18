export type DashboardStat = {
  description: string;
  label: string;
  value: string;
};

export type StockMovement = {
  date: string;
  id: string;
  productName: string;
  quantity: number;
  type: "Entrada" | "Saida";
};

export type LowStockProduct = {
  id: string;
  name: string;
  quantity: number;
};

export type DashboardSummary = {
  lowStockProducts: LowStockProduct[];
  recentMovements: StockMovement[];
  stats: DashboardStat[];
};
