export const THEME_PREFERENCE_KEY = "theme-preference";
export const NAVIGATION_LAYOUT_KEY = "navigation-layout";
export const NAVIGATION_BEHAVIOR_KEY = "navigation-behavior";
export const LANGUAGE_PREFERENCE_KEY = "language-preference";
export const COMPANY_SETTINGS_KEY = "company-settings";
export const NOTIFICATION_SETTINGS_KEY = "notification-settings";
export const UI_PREFERENCES_EVENT = "ui-preferences-changed";
export const DEFAULT_LANGUAGE_PREFERENCE = "pt-BR";

export type ThemePreference = "claro" | "escuro" | "automatico";
export type NavigationLayout = "lateral" | "superior";
export type NavigationBehavior = "fixo" | "expansivel";
export type LanguagePreference = "pt-BR" | "en-US" | "es-ES";

export type CompanySettings = {
  companyName: string;
  legalName: string;
  taxId: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
};

export type NotificationSettings = {
  email: boolean;
  stock: boolean;
  expiration: boolean;
  dailySummary: boolean;
};

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === "claro" || value === "escuro" || value === "automatico";
}

export function isNavigationLayout(value: string | null): value is NavigationLayout {
  return value === "lateral" || value === "superior";
}

export function isNavigationBehavior(value: string | null): value is NavigationBehavior {
  return value === "fixo" || value === "expansivel";
}

export function isLanguagePreference(value: string | null): value is LanguagePreference {
  return value === "pt-BR" || value === "en-US" || value === "es-ES";
}

export function loadLanguagePreference() {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE_PREFERENCE;
  }

  const value = window.localStorage.getItem(LANGUAGE_PREFERENCE_KEY);
  return isLanguagePreference(value) ? value : DEFAULT_LANGUAGE_PREFERENCE;
}

export function saveLanguagePreference(language: LanguagePreference) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LANGUAGE_PREFERENCE_KEY, language);
}
