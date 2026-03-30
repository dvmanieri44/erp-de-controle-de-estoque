"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  isNavigationBehavior,
  isNavigationLayout,
  isThemePreference,
  NAVIGATION_BEHAVIOR_KEY,
  NAVIGATION_LAYOUT_KEY,
  THEME_PREFERENCE_KEY,
  UI_PREFERENCES_EVENT,
  type NavigationBehavior,
  type NavigationLayout,
} from "@/lib/ui-preferences";

const APPEARANCE_OPTIONS = [
  { id: "claro", label: "Claro" },
  { id: "escuro", label: "Escuro" },
  { id: "automatico", label: "Automatico" },
] as const;

const NOTIFICATION_OPTIONS = [
  { id: "email", label: "Notificacoes por Email", enabled: true },
  { id: "estoque", label: "Alertas de Estoque Baixo", enabled: true },
  { id: "validade", label: "Alertas de Validade", enabled: true },
];

const NAVIGATION_OPTIONS = [
  { id: "lateral", label: "Menu lateral" },
  { id: "superior", label: "Menu superior" },
] as const;

const NAVIGATION_BEHAVIOR_OPTIONS = [
  { id: "fixo", label: "Menu fixo" },
  { id: "expansivel", label: "Menu expansivel" },
] as const;

const CURRENCY_OPTIONS = [
  "Real (BRL)",
  "Dolar Americano (USD)",
  "Euro (EUR)",
  "Libra Esterlina (GBP)",
  "Peso Argentino (ARS)",
  "Peso Chileno (CLP)",
] as const;

const DATE_FORMAT_OPTIONS = [
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "YYYY-MM-DD",
  "DD-MM-YYYY",
] as const;

const LANGUAGE_OPTIONS = [
  "Portugues (Brasil)",
  "English (United States)",
  "Espanol (Latinoamerica)",
  "Frances (France)",
] as const;

const HELP_TOPICS = [
  {
    title: "Como cadastrar um novo produto?",
    description: "Acesse Produtos, clique em novo cadastro e preencha nome, categoria, lote e quantidade inicial.",
  },
  {
    title: "Como acompanhar estoque baixo?",
    description: "Use a secao Estoque Baixo no menu para visualizar itens com reposicao recomendada.",
  },
  {
    title: "Onde vejo transferencias e historico?",
    description: "As movimentacoes ficam em Transferencias, Historico e na area de Analytics do painel.",
  },
] as const;

function CardSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-4 shadow-[0_2px_8px_var(--shadow-color)] transition-colors">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--icon-surface)] text-[var(--muted-foreground)]">
          {icon}
        </div>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SmallIcon({ children, tone }: { children: ReactNode; tone: string }) {
  return <span className={`h-3.5 w-3.5 ${tone}`}>{children}</span>;
}

function ThemeOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[72px] flex-col items-center justify-center rounded-xl border text-center transition ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[inset_0_0_0_1px_rgba(75,137,217,0.12)]"
          : "border-[var(--panel-border)] bg-[var(--panel)]"
      }`}
    >
      <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--panel-border)] bg-[var(--panel)] text-[var(--muted-foreground)]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5" />
        </svg>
      </div>
      <span className="text-xs font-medium text-[var(--foreground)]">{label}</span>
    </button>
  );
}

function NavigationOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--panel-border)] bg-[var(--panel)]"
      }`}
    >
      <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
    </button>
  );
}

function InputField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">{label}</span>
      <input
        readOnly
        value={value}
        className="h-9 w-full rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  className = "",
}: {
  label: string;
  value: string;
  options: readonly string[];
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">{label}</span>
      <div className="relative">
        <select
          defaultValue={value}
          className="h-9 w-full appearance-none rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)] px-3 pr-8 text-xs text-[var(--foreground)] outline-none transition-colors"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </label>
  );
}

function CheckRow({ label, checked }: { label: string; checked: boolean }) {
  return (
    <label className="flex items-center justify-between py-1.5">
      <span className="text-xs text-[var(--foreground)]">{label}</span>
      <input
        type="checkbox"
        defaultChecked={checked}
        className="h-3.5 w-3.5 rounded-[3px] border-slate-300 text-[var(--accent)] focus:ring-[var(--accent)]"
      />
    </label>
  );
}

function AppearanceIcon() {
  return (
    <SmallIcon tone="text-blue-500">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-full w-full">
        <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21" />
        <circle cx="12" cy="12" r="3.5" />
      </svg>
    </SmallIcon>
  );
}

function RegionalIcon() {
  return (
    <SmallIcon tone="text-emerald-500">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-full w-full">
        <circle cx="12" cy="12" r="8" />
        <path d="M4 12h16" />
      </svg>
    </SmallIcon>
  );
}

function NotificationIcon() {
  return (
    <SmallIcon tone="text-amber-500">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-full w-full">
        <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      </svg>
    </SmallIcon>
  );
}

function CompanyIcon() {
  return (
    <SmallIcon tone="text-fuchsia-500">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-full w-full">
        <path d="M4 20V7h10v13M14 11h6v9M3 20h18" />
      </svg>
    </SmallIcon>
  );
}

function NavigationIcon() {
  return (
    <SmallIcon tone="text-sky-500">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-full w-full">
        <path d="M4 7h16" />
        <path d="M4 12h10" />
        <path d="M4 17h16" />
      </svg>
    </SmallIcon>
  );
}

function HelpIcon() {
  return (
    <SmallIcon tone="text-violet-500">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-full w-full">
        <circle cx="12" cy="12" r="8" />
        <path d="M9.75 9a2.25 2.25 0 1 1 4.08 1.31c-.45.63-1.08.98-1.58 1.44-.5.45-.83.93-.83 1.75" />
        <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    </SmallIcon>
  );
}

export function SettingsScreen() {
  const [selectedAppearance, setSelectedAppearance] = useState("claro");
  const [navigationLayout, setNavigationLayout] = useState<NavigationLayout>("lateral");
  const [navigationBehavior, setNavigationBehavior] = useState<NavigationBehavior>("fixo");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_PREFERENCE_KEY);
    const storedNavigation = window.localStorage.getItem(NAVIGATION_LAYOUT_KEY);
    const storedBehavior = window.localStorage.getItem(NAVIGATION_BEHAVIOR_KEY);

    if (isThemePreference(storedTheme)) {
      setSelectedAppearance(storedTheme);
    }

    if (isNavigationLayout(storedNavigation)) {
      setNavigationLayout(storedNavigation);
    }

    if (isNavigationBehavior(storedBehavior)) {
      setNavigationBehavior(storedBehavior);
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const resolvedTheme =
        selectedAppearance === "automatico"
          ? mediaQuery.matches
            ? "dark"
            : "light"
          : selectedAppearance === "escuro"
            ? "dark"
            : "light";

      document.documentElement.dataset.theme = resolvedTheme;
      window.localStorage.setItem(THEME_PREFERENCE_KEY, selectedAppearance);
      window.dispatchEvent(new Event(UI_PREFERENCES_EVENT));
    };

    applyTheme();

    if (selectedAppearance !== "automatico") {
      return;
    }

    const handleChange = () => {
      applyTheme();
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [selectedAppearance]);

  useEffect(() => {
    window.localStorage.setItem(NAVIGATION_LAYOUT_KEY, navigationLayout);
    window.dispatchEvent(new Event(UI_PREFERENCES_EVENT));
  }, [navigationLayout]);

  useEffect(() => {
    window.localStorage.setItem(NAVIGATION_BEHAVIOR_KEY, navigationBehavior);
    window.dispatchEvent(new Event(UI_PREFERENCES_EVENT));
  }, [navigationBehavior]);

  return (
    <section className="relative min-h-full bg-[var(--panel-muted)] transition-colors">
      <div className="absolute inset-x-0 top-0 h-2 rounded-t-[22px] bg-[var(--accent)]" />

      <div className="space-y-4 pt-5">
        <header className="px-2">
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--foreground)]">Configuracoes</h1>
        </header>

        <CardSection title="Aparencia" icon={<AppearanceIcon />}>
          <div className="mb-2 text-[11px] font-medium text-[var(--muted-foreground)]">Tema</div>
          <div className="grid gap-2 md:grid-cols-3">
            {APPEARANCE_OPTIONS.map((option) => (
              <ThemeOption
                key={option.id}
                label={option.label}
                active={selectedAppearance === option.id}
                onClick={() => setSelectedAppearance(option.id)}
              />
            ))}
          </div>
        </CardSection>

        <CardSection title="Regional" icon={<RegionalIcon />}>
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField label="Moeda" value="Real (BRL)" options={CURRENCY_OPTIONS} />
            <SelectField label="Formato de Data" value="DD/MM/YYYY" options={DATE_FORMAT_OPTIONS} />
            <SelectField
              label="Idioma"
              value="Portugues (Brasil)"
              options={LANGUAGE_OPTIONS}
              className="md:col-span-2"
            />
          </div>
        </CardSection>

        <CardSection title="Navegacao" icon={<NavigationIcon />}>
          <div className="grid gap-3">
            <div className="grid gap-2 md:grid-cols-2">
              {NAVIGATION_OPTIONS.map((option) => (
                <NavigationOption
                  key={option.id}
                  label={option.label}
                  active={navigationLayout === option.id}
                  onClick={() => setNavigationLayout(option.id)}
                />
              ))}
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              {NAVIGATION_BEHAVIOR_OPTIONS.map((option) => (
                <NavigationOption
                  key={option.id}
                  label={option.label}
                  active={navigationBehavior === option.id}
                  onClick={() => setNavigationBehavior(option.id)}
                />
              ))}
            </div>
          </div>
        </CardSection>

        <CardSection title="Notificacoes" icon={<NotificationIcon />}>
          <div className="space-y-0.5">
            {NOTIFICATION_OPTIONS.map((option) => (
              <CheckRow key={option.id} label={option.label} checked={option.enabled} />
            ))}
          </div>
        </CardSection>

        <CardSection title="Informacoes da Empresa" icon={<CompanyIcon />}>
          <div className="grid gap-3 md:grid-cols-2">
            <InputField label="Nome da Empresa" value="Minha Empresa" />
            <InputField label="Email" value="contato@empresa.com" />
            <InputField label="Telefone" value="(11) 99999-9999" />
            <InputField label="Endereco" value="Rua Principal, 123" />
          </div>
        </CardSection>

        <CardSection title="Central de ajuda" icon={<HelpIcon />}>
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-2">
              {HELP_TOPICS.map((topic) => (
                <article
                  key={topic.title}
                  className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-soft)] px-3 py-3 transition-colors"
                >
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">{topic.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{topic.description}</p>
                </article>
              ))}
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-soft)] px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                  Suporte
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--foreground)]">contato@empresa.com</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">Seg a sex, das 8h as 18h</p>
              </div>

              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-soft)] px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                  Documentacao
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--foreground)]">Guia rapido do sistema</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Acesse tutoriais, boas praticas e instrucoes de uso.
                </p>
              </div>
            </div>
          </div>
        </CardSection>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2.5 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.22)]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
              <path d="M5 20h14" />
              <path d="M5 4h11l3 3v13H5V4Z" />
            </svg>
            Salvar Configuracoes
          </button>
        </div>
      </div>
    </section>
  );
}
