export const THEME_PREFERENCE_KEY = "theme-preference";
export const NAVIGATION_LAYOUT_KEY = "navigation-layout";
export const NAVIGATION_BEHAVIOR_KEY = "navigation-behavior";
export const LANGUAGE_PREFERENCE_KEY = "language-preference";
export const COMPANY_SETTINGS_KEY = "company-settings";
export const NOTIFICATION_SETTINGS_KEY = "notification-settings";
export const UI_PREFERENCES_EVENT = "ui-preferences-changed";

export type ThemePreference = "claro" | "escuro" | "automatico";
export type NavigationLayout = "lateral" | "superior";
export type NavigationBehavior = "fixo" | "expansivel";
export type LanguagePreference = "pt-BR" | "en-US";

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
  return value === "pt-BR" || value === "en-US";
}
