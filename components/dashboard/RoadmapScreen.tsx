"use client";

import { useMemo, useState } from "react";

import { useLocale } from "@/components/providers/LocaleProvider";
import { getSectionById, type DashboardSection } from "@/lib/dashboard-sections";
import {
  ERP_ROADMAP_IDEAS,
  getRoadmapEffortLabel,
  getRoadmapImpactLabel,
  getRoadmapStageLabel,
  getRoadmapThemeLabel,
  getRoadmapThemeLabels,
  type RoadmapStage,
  type RoadmapTheme,
} from "@/lib/erp-roadmap";
import { normalizeText } from "@/lib/inventory";

const COPY = {
  "pt-BR": {
    eyebrow: "Roadmap do ERP",
    intro: "Consolidei no sistema as ideias levantadas desde o início da conversa em um backlog navegável, com 100 frentes de evolução separadas por fundação, expansão e escala.",
    readingTitle: "Leitura recomendada",
    readingBody: "Começar por fundação, depois escolher um trilho de negócio.",
    mappedIdeas: "Ideias mapeadas",
    mappedIdeasHelper: "Backlog consolidado dentro da aplicação.",
    foundation: "Fundação",
    foundationHelper: "Itens que preparam autenticação, dados e operação.",
    expansion: "Expansão",
    expansionHelper: "Blocos que ampliam logística, compras e colaboração.",
    highImpact: "Alto impacto",
    highImpactHelper: "Entradas com retorno operacional ou estratégico mais forte.",
    searchPlaceholder: "Buscar por tema, módulo ou ideia...",
    allStages: "Todas as fases",
    allThemes: "Todos os temas",
    prioritizedBacklog: "Backlog priorizado",
    visibleIdeas: "{count} ideias visíveis para o recorte atual",
    moduleNote: "Este módulo não implementa automaticamente as 100 frentes, mas deixa a expansão inteira organizada dentro do ERP para execução por ondas.",
  },
  "en-US": {
    eyebrow: "ERP roadmap",
    intro: "I consolidated the ideas raised throughout our conversation into a navigable backlog, with 100 evolution fronts organized into foundation, expansion and scale.",
    readingTitle: "Recommended reading",
    readingBody: "Start with the foundation, then choose a business track.",
    mappedIdeas: "Mapped ideas",
    mappedIdeasHelper: "Backlog consolidated inside the application.",
    foundation: "Foundation",
    foundationHelper: "Items that prepare authentication, data and operations.",
    expansion: "Expansion",
    expansionHelper: "Blocks that expand logistics, purchasing and collaboration.",
    highImpact: "High impact",
    highImpactHelper: "Entries with stronger operational or strategic return.",
    searchPlaceholder: "Search by theme, module or idea...",
    allStages: "All stages",
    allThemes: "All themes",
    prioritizedBacklog: "Prioritized backlog",
    visibleIdeas: "{count} visible ideas for the current view",
    moduleNote: "This module does not automatically implement the 100 initiatives, but it keeps the full expansion backlog organized inside the ERP for wave-based execution.",
  },
  "es-ES": {
    eyebrow: "Roadmap del ERP",
    intro: "Consolidé en el sistema las ideas surgidas durante nuestra conversación en un backlog navegable, con 100 frentes de evolución separados en fundación, expansión y escala.",
    readingTitle: "Lectura recomendada",
    readingBody: "Empieza por la fundación y luego elige un frente de negocio.",
    mappedIdeas: "Ideas mapeadas",
    mappedIdeasHelper: "Backlog consolidado dentro de la aplicación.",
    foundation: "Fundación",
    foundationHelper: "Elementos que preparan autenticación, datos y operación.",
    expansion: "Expansión",
    expansionHelper: "Bloques que amplían logística, compras y colaboración.",
    highImpact: "Alto impacto",
    highImpactHelper: "Entradas con retorno operativo o estratégico más fuerte.",
    searchPlaceholder: "Buscar por tema, módulo o idea...",
    allStages: "Todas las fases",
    allThemes: "Todos los temas",
    prioritizedBacklog: "Backlog priorizado",
    visibleIdeas: "{count} ideas visibles para el recorte actual",
    moduleNote: "Este módulo no implementa automáticamente los 100 frentes, pero deja toda la expansión organizada dentro del ERP para ejecución por olas.",
  },
} as const;

function MetricCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-[0_10px_24px_var(--shadow-color)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[var(--navy-900)]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{helper}</p>
    </article>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-[var(--accent)] text-white shadow-[0_10px_20px_rgba(37,99,235,0.22)]"
          : "border border-[var(--panel-border)] bg-[var(--panel)] text-[var(--foreground)] hover:bg-[var(--panel-soft)]"
      }`}
    >
      {label}
    </button>
  );
}

function toneByStage(stage: RoadmapStage) {
  if (stage === "fundacao") return "bg-emerald-50 text-emerald-700";
  if (stage === "expansao") return "bg-amber-50 text-amber-700";
  return "bg-violet-50 text-violet-700";
}

function toneByImpact(impact: "alto" | "medio" | "estrategico") {
  if (impact === "estrategico") return "bg-rose-50 text-rose-700";
  if (impact === "alto") return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-700";
}

function Pill({ label, tone }: { label: string; tone: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

export function RoadmapScreen({ section }: { section: DashboardSection }) {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const localizedSection = getSectionById(section.id, locale) ?? section;
  const [query, setQuery] = useState("");
  const [themeFilter, setThemeFilter] = useState<"todas" | RoadmapTheme>("todas");
  const [stageFilter, setStageFilter] = useState<"todas" | RoadmapStage>("todas");
  const themeLabels = getRoadmapThemeLabels(locale);

  const filteredIdeas = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return ERP_ROADMAP_IDEAS.filter((idea) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        normalizeText(
          [idea.title, idea.summary, getRoadmapThemeLabel(idea.theme, locale), getRoadmapStageLabel(idea.stage, locale)].join(" "),
        ).includes(normalizedQuery);
      const matchesTheme = themeFilter === "todas" || idea.theme === themeFilter;
      const matchesStage = stageFilter === "todas" || idea.stage === stageFilter;

      return matchesQuery && matchesTheme && matchesStage;
    });
  }, [locale, query, stageFilter, themeFilter]);

  const stageSummary = useMemo(
    () => ({
      fundacao: ERP_ROADMAP_IDEAS.filter((idea) => idea.stage === "fundacao").length,
      expansao: ERP_ROADMAP_IDEAS.filter((idea) => idea.stage === "expansao").length,
      escala: ERP_ROADMAP_IDEAS.filter((idea) => idea.stage === "escala").length,
    }),
    [],
  );

  const highImpactCount = useMemo(
    () => ERP_ROADMAP_IDEAS.filter((idea) => idea.impact === "alto" || idea.impact === "estrategico").length,
    [],
  );

  return (
    <section className="space-y-8 pb-8">
      <header className="overflow-hidden rounded-[32px] border border-[var(--panel-border)] bg-[var(--panel)] shadow-[0_14px_32px_var(--shadow-color)]">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.15),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.02),transparent_65%)] px-6 py-7 md:px-8 md:py-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">{copy.eyebrow}</p>
              <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-[var(--navy-900)]">{localizedSection.label}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">{copy.intro}</p>
            </div>
            <div className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 shadow-[0_10px_24px_var(--shadow-color)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">{copy.readingTitle}</p>
              <p className="mt-2 text-sm text-[var(--foreground)]">{copy.readingBody}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title={copy.mappedIdeas} value={String(ERP_ROADMAP_IDEAS.length)} helper={copy.mappedIdeasHelper} />
        <MetricCard title={copy.foundation} value={String(stageSummary.fundacao)} helper={copy.foundationHelper} />
        <MetricCard title={copy.expansion} value={String(stageSummary.expansao)} helper={copy.expansionHelper} />
        <MetricCard title={copy.highImpact} value={String(highImpactCount)} helper={copy.highImpactHelper} />
      </div>

      <section className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_10px_28px_var(--shadow-color)]">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
          <label className="relative block">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted-foreground)]">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
              className="h-12 w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--input-bg)] px-12 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <FilterChip active={stageFilter === "todas"} label={copy.allStages} onClick={() => setStageFilter("todas")} />
            <FilterChip active={stageFilter === "fundacao"} label={getRoadmapStageLabel("fundacao", locale)} onClick={() => setStageFilter("fundacao")} />
            <FilterChip active={stageFilter === "expansao"} label={getRoadmapStageLabel("expansao", locale)} onClick={() => setStageFilter("expansao")} />
            <FilterChip active={stageFilter === "escala"} label={getRoadmapStageLabel("escala", locale)} onClick={() => setStageFilter("escala")} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <FilterChip active={themeFilter === "todas"} label={copy.allThemes} onClick={() => setThemeFilter("todas")} />
          {(Object.keys(themeLabels) as RoadmapTheme[]).map((theme) => (
            <FilterChip
              key={theme}
              active={themeFilter === theme}
              label={themeLabels[theme]}
              onClick={() => setThemeFilter(theme)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_10px_28px_var(--shadow-color)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{copy.prioritizedBacklog}</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[var(--navy-900)]">
              {copy.visibleIdeas.replace("{count}", String(filteredIdeas.length))}
            </h2>
          </div>
          <p className="max-w-2xl text-sm text-[var(--muted-foreground)]">{copy.moduleNote}</p>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {filteredIdeas.map((idea) => (
            <article key={idea.id} className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel-soft)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">{idea.title}</h3>
                    <Pill label={getRoadmapStageLabel(idea.stage, locale)} tone={toneByStage(idea.stage)} />
                    <Pill label={getRoadmapImpactLabel(idea.impact, locale)} tone={toneByImpact(idea.impact)} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">{idea.summary}</p>
                </div>
                <span className="rounded-full bg-[var(--panel)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                  {idea.id}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Pill label={getRoadmapThemeLabel(idea.theme, locale)} tone="bg-[var(--accent-soft)] text-[var(--accent)]" />
                <Pill label={getRoadmapEffortLabel(idea.effort, locale)} tone="bg-slate-100 text-slate-700" />
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
