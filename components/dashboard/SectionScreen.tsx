"use client";

import { useLocale } from "@/components/providers/LocaleProvider";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { getSectionById, type DashboardSection } from "@/lib/dashboard-sections";

type SectionScreenProps = {
  section: DashboardSection;
};

const METRICS = {
  "pt-BR": [
    { title: "Lotes monitorados", value: "186", helper: "Rastreabilidade ativa entre fábrica, quality hold e CD" },
    { title: "Cobertura crítica", value: "12", helper: "SKUs com cobertura abaixo do alvo comercial" },
    { title: "Transferências no dia", value: "28", helper: "Fluxos internos entre Dourado, expedição e distribuição" },
  ],
  "en-US": [
    { title: "Monitored lots", value: "186", helper: "Active traceability across factory, quality hold and DC" },
    { title: "Critical coverage", value: "12", helper: "SKUs below the commercial target coverage" },
    { title: "Transfers today", value: "28", helper: "Internal flows between Dourado, shipping and distribution" },
  ],
  "es-ES": [
    { title: "Lotes monitoreados", value: "186", helper: "Trazabilidad activa entre fábrica, quality hold y CD" },
    { title: "Cobertura crítica", value: "12", helper: "SKUs por debajo de la cobertura objetivo comercial" },
    { title: "Transferencias del día", value: "28", helper: "Flujos internos entre Dourado, expedición y distribución" },
  ],
} as const;

export function SectionScreen({ section }: SectionScreenProps) {
  const { locale } = useLocale();
  const localizedSection = getSectionById(section.id, locale) ?? section;

  return (
    <section className="space-y-8">
      <header className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-6 py-8 transition-colors">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">PremieRpet Operations</p>
        <h2 className="mt-3 text-3xl font-bold text-[var(--navy-900)]">{localizedSection.label}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">{localizedSection.description}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {METRICS[locale].map((metric) => (
          <SectionCard key={metric.title} title={metric.title} value={metric.value} helper={metric.helper} />
        ))}
      </div>
    </section>
  );
}
