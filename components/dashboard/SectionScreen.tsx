import { SectionCard } from "@/components/dashboard/SectionCard";
import type { DashboardSection } from "@/lib/dashboard-sections";

type SectionScreenProps = {
  section: DashboardSection;
};

const SECTION_METRICS = [
  { title: "Itens ativos", value: "1.284", helper: "Atualizado ha 5 minutos" },
  { title: "Baixo estoque", value: "37", helper: "Recomenda reposicao imediata" },
  { title: "Movimentacoes hoje", value: "219", helper: "Entradas e saidas consolidadas" },
];

export function SectionScreen({ section }: SectionScreenProps) {
  return (
    <section className="space-y-8">
      <header className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-6 py-8 transition-colors">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">GoodStock</p>
        <h2 className="mt-3 text-3xl font-bold text-[var(--navy-900)]">{section.label}</h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)]">{section.description}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SECTION_METRICS.map((metric) => (
          <SectionCard key={metric.title} title={metric.title} value={metric.value} helper={metric.helper} />
        ))}
      </div>
    </section>
  );
}
