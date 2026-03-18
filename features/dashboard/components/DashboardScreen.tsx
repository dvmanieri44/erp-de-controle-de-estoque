import { Card } from "@/components/ui/Card";
import type { DashboardSummary } from "@/features/dashboard/types/dashboard";

type DashboardScreenProps = {
  summary: DashboardSummary;
};

export function DashboardScreen({ summary }: DashboardScreenProps) {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <span className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Dashboard
          </span>
          <h1 className="text-3xl font-semibold text-slate-900">
            Visao geral do estoque
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            Esta pagina centraliza indicadores e blocos independentes para
            facilitar evolucao, testes e manutencao.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summary.stats.map((stat) => (
            <Card key={stat.label}>
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">
                {stat.value}
              </p>
              <p className="mt-2 text-sm text-slate-500">{stat.description}</p>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Ultimas movimentacoes
              </h2>
              <span className="text-sm text-slate-500">
                {summary.recentMovements.length} registros
              </span>
            </div>

            <div className="space-y-3">
              {summary.recentMovements.map((movement) => (
                <div
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3"
                  key={movement.id}
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {movement.productName}
                    </p>
                    <p className="text-sm text-slate-500">
                      {movement.type} em {movement.date}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">
                    {movement.quantity} un.
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-900">
              Estoque em alerta
            </h2>
            <div className="mt-4 space-y-3">
              {summary.lowStockProducts.map((product) => (
                <div
                  className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
                  key={product.id}
                >
                  <p className="font-medium text-slate-900">{product.name}</p>
                  <p className="text-sm text-slate-600">
                    {product.quantity} unidades disponiveis
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
