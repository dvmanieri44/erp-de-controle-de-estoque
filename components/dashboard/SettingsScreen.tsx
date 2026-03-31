"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  COMPANY_SETTINGS_KEY,
  LANGUAGE_PREFERENCE_KEY,
  NAVIGATION_BEHAVIOR_KEY,
  NAVIGATION_LAYOUT_KEY,
  NOTIFICATION_SETTINGS_KEY,
  THEME_PREFERENCE_KEY,
  UI_PREFERENCES_EVENT,
  isLanguagePreference,
  isThemePreference,
  type CompanySettings,
  type LanguagePreference,
  type NotificationSettings,
  type ThemePreference,
} from "@/lib/ui-preferences";

const APPEARANCE_OPTIONS = [
  { id: "claro", label: "Claro" },
  { id: "escuro", label: "Escuro" },
  { id: "automatico", label: "Automático" },
] as const;

const LANGUAGE_OPTIONS = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (United States)" },
] as const;

const NOTIFICATION_OPTIONS = [
  { id: "email", label: "Notificações por e-mail" },
  { id: "stock", label: "Alertas de estoque baixo" },
  { id: "expiration", label: "Alertas de validade" },
  { id: "dailySummary", label: "Resumo diário por e-mail" },
] as const;

const HELP_TOPICS = [
  {
    title: "Como cadastrar um novo produto?",
    description: "Acesse Produtos, clique em novo cadastro e preencha nome, categoria, lote e quantidade inicial.",
  },
  {
    title: "Como acompanhar estoque baixo?",
    description: "Use a seção Estoque Baixo no menu para visualizar itens com reposição recomendada.",
  },
  {
    title: "Onde vejo transferências e histórico?",
    description: "As movimentações ficam em Transferências, Histórico e na área de Analytics do painel.",
  },
] as const;

const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: "Minha Empresa",
  legalName: "Minha Empresa LTDA",
  taxId: "00.000.000/0001-00",
  email: "contato@empresa.com",
  phone: "(11) 99999-9999",
  whatsapp: "(11) 99999-9999",
  address: "Rua Principal, 123",
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email: true,
  stock: true,
  expiration: true,
  dailySummary: false,
};

type SettingsFormState = {
  theme: ThemePreference;
  language: LanguagePreference;
  notifications: NotificationSettings;
  company: CompanySettings;
};

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

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-full appearance-none rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)] px-3 pr-8 text-xs text-[var(--foreground)] outline-none transition-colors"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
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

function buildInitialState(): SettingsFormState {
  return {
    theme: "claro",
    language: "pt-BR",
    notifications: DEFAULT_NOTIFICATION_SETTINGS,
    company: DEFAULT_COMPANY_SETTINGS,
  };
}

export function SettingsScreen() {
  const [savedSettings, setSavedSettings] = useState<SettingsFormState | null>(null);
  const [formState, setFormState] = useState<SettingsFormState>(buildInitialState);

  const hasChanges = savedSettings !== null && JSON.stringify(savedSettings) !== JSON.stringify(formState);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_PREFERENCE_KEY);
    const storedLanguage = window.localStorage.getItem(LANGUAGE_PREFERENCE_KEY);
    const storedCompany = window.localStorage.getItem(COMPANY_SETTINGS_KEY);
    const storedNotifications = window.localStorage.getItem(NOTIFICATION_SETTINGS_KEY);

    const nextState: SettingsFormState = {
      theme: isThemePreference(storedTheme) ? storedTheme : "claro",
      language: isLanguagePreference(storedLanguage) ? storedLanguage : "pt-BR",
      notifications: storedNotifications
        ? { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(storedNotifications) }
        : DEFAULT_NOTIFICATION_SETTINGS,
      company: storedCompany
        ? { ...DEFAULT_COMPANY_SETTINGS, ...JSON.parse(storedCompany) }
        : DEFAULT_COMPANY_SETTINGS,
    };

    setFormState(nextState);
    setSavedSettings(nextState);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const resolvedTheme =
        formState.theme === "automatico"
          ? mediaQuery.matches
            ? "dark"
            : "light"
          : formState.theme === "escuro"
            ? "dark"
            : "light";

      document.documentElement.dataset.theme = resolvedTheme;
    };

    applyTheme();

    if (formState.theme !== "automatico") {
      return;
    }

    mediaQuery.addEventListener("change", applyTheme);
    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [formState.theme]);

  function updateCompanyField(field: keyof CompanySettings, value: string) {
    setFormState((current) => ({
      ...current,
      company: {
        ...current.company,
        [field]: value,
      },
    }));
  }

  function updateNotificationField(field: keyof NotificationSettings, value: boolean) {
    setFormState((current) => ({
      ...current,
      notifications: {
        ...current.notifications,
        [field]: value,
      },
    }));
  }

  function handleSave() {
    window.localStorage.setItem(THEME_PREFERENCE_KEY, formState.theme);
    window.localStorage.setItem(LANGUAGE_PREFERENCE_KEY, formState.language);
    window.localStorage.setItem(NAVIGATION_LAYOUT_KEY, "lateral");
    window.localStorage.setItem(NAVIGATION_BEHAVIOR_KEY, "fixo");
    window.localStorage.setItem(COMPANY_SETTINGS_KEY, JSON.stringify(formState.company));
    window.localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(formState.notifications));
    window.dispatchEvent(new Event(UI_PREFERENCES_EVENT));
    setSavedSettings(formState);
  }

  return (
    <section className="relative min-h-full bg-[var(--panel-muted)] transition-colors">
      <div className="absolute inset-x-0 top-0 h-2 rounded-t-[22px] bg-[var(--accent)]" />

      <div className="space-y-4 pt-5">
        <header className="px-2">
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--foreground)]">Configurações</h1>
        </header>

        <CardSection title="Aparência" icon={<AppearanceIcon />}>
          <div className="mb-2 text-[11px] font-medium text-[var(--muted-foreground)]">Tema</div>
          <div className="grid gap-2 md:grid-cols-3">
            {APPEARANCE_OPTIONS.map((option) => (
              <ThemeOption
                key={option.id}
                label={option.label}
                active={formState.theme === option.id}
                onClick={() => setFormState((current) => ({ ...current, theme: option.id }))}
              />
            ))}
          </div>
        </CardSection>

        <CardSection title="Regional" icon={<RegionalIcon />}>
          <SelectField
            label="Idioma"
            value={formState.language}
            options={LANGUAGE_OPTIONS}
            onChange={(value) => setFormState((current) => ({ ...current, language: value as LanguagePreference }))}
          />
        </CardSection>

        <CardSection title="Notificações" icon={<NotificationIcon />}>
          <div className="space-y-0.5">
            {NOTIFICATION_OPTIONS.map((option) => (
              <label key={option.id} className="flex items-center justify-between py-1.5">
                <span className="text-xs text-[var(--foreground)]">{option.label}</span>
                <input
                  type="checkbox"
                  checked={formState.notifications[option.id]}
                  onChange={(event) => updateNotificationField(option.id, event.target.checked)}
                  className="h-3.5 w-3.5 rounded-[3px] border-slate-300 text-[var(--accent)] focus:ring-[var(--accent)]"
                />
              </label>
            ))}
          </div>
        </CardSection>

        <CardSection title="Informações da Empresa" icon={<CompanyIcon />}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">Nome da empresa</span>
              <input
                value={formState.company.companyName}
                onChange={(event) => updateCompanyField("companyName", event.target.value)}
                className="h-9 w-full rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">Razão social</span>
              <input
                value={formState.company.legalName}
                onChange={(event) => updateCompanyField("legalName", event.target.value)}
                className="h-9 w-full rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">CNPJ</span>
              <input
                value={formState.company.taxId}
                onChange={(event) => updateCompanyField("taxId", event.target.value)}
                className="h-9 w-full rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">E-mail</span>
              <input
                value={formState.company.email}
                onChange={(event) => updateCompanyField("email", event.target.value)}
                className="h-9 w-full rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">Telefone</span>
              <input
                value={formState.company.phone}
                onChange={(event) => updateCompanyField("phone", event.target.value)}
                className="h-9 w-full rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">WhatsApp</span>
              <input
                value={formState.company.whatsapp}
                onChange={(event) => updateCompanyField("whatsapp", event.target.value)}
                className="h-9 w-full rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">Endereço</span>
              <input
                value={formState.company.address}
                onChange={(event) => updateCompanyField("address", event.target.value)}
                className="h-9 w-full rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors"
              />
            </label>
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
                <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{savedSettings?.company.email ?? formState.company.email}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">{savedSettings?.company.whatsapp ?? formState.company.whatsapp}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">Seg a sex, das 8h às 18h</p>
              </div>

              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-soft)] px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                  Documentação
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--foreground)]">Guia rápido do sistema</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Acesse tutoriais, boas práticas e instruções de uso.
                </p>
              </div>
            </div>
          </div>
        </CardSection>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white transition ${
              hasChanges
                ? "bg-[#2563eb] shadow-[0_8px_20px_rgba(37,99,235,0.22)]"
                : "cursor-not-allowed bg-slate-300 shadow-none"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
              <path d="M5 20h14" />
              <path d="M5 4h11l3 3v13H5V4Z" />
            </svg>
            Salvar alterações
          </button>
        </div>
      </div>
    </section>
  );
}
