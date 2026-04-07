"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useLocale } from "@/components/providers/LocaleProvider";
import { getLanguageDisplayName } from "@/lib/i18n";
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

const COPY = {
  "pt-BR": {
    title: "Configurações",
    appearance: "Aparência",
    theme: "Tema",
    light: "Claro",
    dark: "Escuro",
    automatic: "Automático",
    regional: "Regional",
    language: "Idioma",
    notifications: "Notificações",
    notificationEmail: "Notificações por e-mail",
    notificationStock: "Alertas de estoque baixo",
    notificationExpiration: "Alertas de validade",
    notificationDaily: "Resumo diário por e-mail",
    companyInfo: "Informações da Empresa",
    companyName: "Nome da empresa",
    legalName: "Razão social",
    taxId: "CNPJ",
    email: "E-mail",
    phone: "Telefone",
    whatsapp: "WhatsApp",
    address: "Endereço",
    helpCenter: "Central de ajuda",
    help1Title: "Como registrar um novo lote?",
    help1Description: "Acesse Produtos ou Lotes, informe a linha PremieRpet, o código do lote e a quantidade inicial produzida.",
    help2Title: "Como acompanhar estoque crítico?",
    help2Description: "Use a seção Estoque Baixo para acompanhar rupturas em CDs, expedição e áreas com necessidade de reposição.",
    help3Title: "Onde acompanho transferências entre fábrica e CDs?",
    help3Description: "As movimentações operacionais ficam em Transferências e Histórico, com rastreio entre Dourado, expedição e centros de distribuição.",
    support: "Suporte",
    supportHours: "Suporte operacional em dias úteis, das 8h às 18h",
    documentation: "Documentação",
    guideTitle: "Guia operacional PremieRpet",
    guideDescription: "Acesse padrões de movimentação, boas práticas de armazenagem e instruções de uso.",
    saveChanges: "Salvar alterações",
  },
  "en-US": {
    title: "Settings",
    appearance: "Appearance",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    automatic: "Automatic",
    regional: "Regional",
    language: "Language",
    notifications: "Notifications",
    notificationEmail: "Email notifications",
    notificationStock: "Low stock alerts",
    notificationExpiration: "Expiration alerts",
    notificationDaily: "Daily email summary",
    companyInfo: "Company Information",
    companyName: "Company name",
    legalName: "Legal name",
    taxId: "Tax ID",
    email: "Email",
    phone: "Phone",
    whatsapp: "WhatsApp",
    address: "Address",
    helpCenter: "Help center",
    help1Title: "How do I register a new lot?",
    help1Description: "Go to Products or Lots, enter the PremieRpet line, the lot code and the initial produced quantity.",
    help2Title: "How do I monitor critical stock?",
    help2Description: "Use the Low Stock section to track shortages in DCs, shipping and areas that need replenishment.",
    help3Title: "Where do I track transfers between the factory and DCs?",
    help3Description: "Operational movements are available in Transfers and History, with traceability between Dourado, shipping and distribution centers.",
    support: "Support",
    supportHours: "Operational support on business days, from 8 AM to 6 PM",
    documentation: "Documentation",
    guideTitle: "PremieRpet operational guide",
    guideDescription: "Access movement standards, storage best practices and usage instructions.",
    saveChanges: "Save changes",
  },
  "es-ES": {
    title: "Configuración",
    appearance: "Apariencia",
    theme: "Tema",
    light: "Claro",
    dark: "Oscuro",
    automatic: "Automático",
    regional: "Regional",
    language: "Idioma",
    notifications: "Notificaciones",
    notificationEmail: "Notificaciones por correo",
    notificationStock: "Alertas de stock bajo",
    notificationExpiration: "Alertas de vencimiento",
    notificationDaily: "Resumen diario por correo",
    companyInfo: "Información de la Empresa",
    companyName: "Nombre de la empresa",
    legalName: "Razón social",
    taxId: "CIF/CNPJ",
    email: "Correo",
    phone: "Teléfono",
    whatsapp: "WhatsApp",
    address: "Dirección",
    helpCenter: "Centro de ayuda",
    help1Title: "¿Cómo registrar un nuevo lote?",
    help1Description: "Accede a Productos o Lotes, informa la línea PremieRpet, el código del lote y la cantidad inicial producida.",
    help2Title: "¿Cómo seguir el stock crítico?",
    help2Description: "Usa la sección Stock Bajo para seguir quiebres en CDs, expedición y áreas que necesitan reposición.",
    help3Title: "¿Dónde sigo las transferencias entre fábrica y CDs?",
    help3Description: "Los movimientos operativos están en Transferencias e Historial, con trazabilidad entre Dourado, expedición y centros de distribución.",
    support: "Soporte",
    supportHours: "Soporte operativo en días hábiles, de 8:00 a 18:00",
    documentation: "Documentación",
    guideTitle: "Guía operativa PremieRpet",
    guideDescription: "Accede a estándares de movimientos, buenas prácticas de almacenaje e instrucciones de uso.",
    saveChanges: "Guardar cambios",
  },
} as const;

type SettingsFormState = {
  theme: ThemePreference;
  language: LanguagePreference;
  notifications: NotificationSettings;
  company: CompanySettings;
};

const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: "PremieRpet",
  legalName: "Premier Pet Ltda.",
  taxId: "00.000.000/0001-00",
  email: "operacoes@premierpet.com.br",
  phone: "(16) 3366-0000",
  whatsapp: "(16) 99666-0000",
  address: "Complexo Industrial Dourado, SP",
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email: true,
  stock: true,
  expiration: true,
  dailySummary: false,
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
  const { locale, setLocale } = useLocale();
  const copy = COPY[locale];
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

  const helpTopics = useMemo(
    () => [
      { title: copy.help1Title, description: copy.help1Description },
      { title: copy.help2Title, description: copy.help2Description },
      { title: copy.help3Title, description: copy.help3Description },
    ],
    [copy.help1Description, copy.help1Title, copy.help2Description, copy.help2Title, copy.help3Description, copy.help3Title],
  );

  const languageOptions = useMemo(
    () =>
      (["pt-BR", "en-US", "es-ES"] as const).map((value) => ({
        value,
        label: getLanguageDisplayName(value, locale),
      })),
    [locale],
  );

  const themeOptions = [
    { id: "claro" as const, label: copy.light },
    { id: "escuro" as const, label: copy.dark },
    { id: "automatico" as const, label: copy.automatic },
  ];

  const notificationOptions = [
    { id: "email" as const, label: copy.notificationEmail },
    { id: "stock" as const, label: copy.notificationStock },
    { id: "expiration" as const, label: copy.notificationExpiration },
    { id: "dailySummary" as const, label: copy.notificationDaily },
  ];

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

  function handleLanguageChange(value: string) {
    const nextLanguage = value as LanguagePreference;

    setFormState((current) => ({
      ...current,
      language: nextLanguage,
    }));
    setSavedSettings((current) =>
      current
        ? {
            ...current,
            language: nextLanguage,
          }
        : current,
    );
    setLocale(nextLanguage);
  }

  function handleSave() {
    window.localStorage.setItem(THEME_PREFERENCE_KEY, formState.theme);
    window.localStorage.setItem(LANGUAGE_PREFERENCE_KEY, formState.language);
    window.localStorage.setItem(NAVIGATION_LAYOUT_KEY, "lateral");
    window.localStorage.setItem(NAVIGATION_BEHAVIOR_KEY, "fixo");
    window.localStorage.setItem(COMPANY_SETTINGS_KEY, JSON.stringify(formState.company));
    window.localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(formState.notifications));
    window.dispatchEvent(new Event(UI_PREFERENCES_EVENT));
    setLocale(formState.language);
    setSavedSettings(formState);
  }

  return (
    <section className="relative min-h-full bg-[var(--panel-muted)] transition-colors">
      <div className="absolute inset-x-0 top-0 h-2 rounded-t-[22px] bg-[var(--accent)]" />

      <div className="space-y-4 pt-5">
        <header className="px-2">
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--foreground)]">{copy.title}</h1>
        </header>

        <CardSection title={copy.appearance} icon={<AppearanceIcon />}>
          <div className="mb-2 text-[11px] font-medium text-[var(--muted-foreground)]">{copy.theme}</div>
          <div className="grid gap-2 md:grid-cols-3">
            {themeOptions.map((option) => (
              <ThemeOption
                key={option.id}
                label={option.label}
                active={formState.theme === option.id}
                onClick={() => setFormState((current) => ({ ...current, theme: option.id }))}
              />
            ))}
          </div>
        </CardSection>

        <CardSection title={copy.regional} icon={<RegionalIcon />}>
          <SelectField
            label={copy.language}
            value={formState.language}
            options={languageOptions}
            onChange={handleLanguageChange}
          />
        </CardSection>

        <CardSection title={copy.notifications} icon={<NotificationIcon />}>
          <div className="space-y-0.5">
            {notificationOptions.map((option) => (
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

        <CardSection title={copy.companyInfo} icon={<CompanyIcon />}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">{copy.companyName}</span>
              <input value={formState.company.companyName} onChange={(event) => updateCompanyField("companyName", event.target.value)} className="h-9 w-full rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">{copy.legalName}</span>
              <input value={formState.company.legalName} onChange={(event) => updateCompanyField("legalName", event.target.value)} className="h-9 w-full rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">{copy.taxId}</span>
              <input value={formState.company.taxId} onChange={(event) => updateCompanyField("taxId", event.target.value)} className="h-9 w-full rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">{copy.email}</span>
              <input value={formState.company.email} onChange={(event) => updateCompanyField("email", event.target.value)} className="h-9 w-full rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">{copy.phone}</span>
              <input value={formState.company.phone} onChange={(event) => updateCompanyField("phone", event.target.value)} className="h-9 w-full rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">{copy.whatsapp}</span>
              <input value={formState.company.whatsapp} onChange={(event) => updateCompanyField("whatsapp", event.target.value)} className="h-9 w-full rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors" />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-[11px] font-medium text-[var(--muted-foreground)]">{copy.address}</span>
              <input value={formState.company.address} onChange={(event) => updateCompanyField("address", event.target.value)} className="h-9 w-full rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors" />
            </label>
          </div>
        </CardSection>

        <CardSection title={copy.helpCenter} icon={<HelpIcon />}>
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-2">
              {helpTopics.map((topic) => (
                <article key={topic.title} className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-soft)] px-3 py-3 transition-colors">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">{topic.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{topic.description}</p>
                </article>
              ))}
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-soft)] px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{copy.support}</p>
                <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{savedSettings?.company.email ?? formState.company.email}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">{savedSettings?.company.whatsapp ?? formState.company.whatsapp}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">{copy.supportHours}</p>
              </div>

              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-soft)] px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{copy.documentation}</p>
                <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{copy.guideTitle}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">{copy.guideDescription}</p>
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
            {copy.saveChanges}
          </button>
        </div>
      </div>
    </section>
  );
}
