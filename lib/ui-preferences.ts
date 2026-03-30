export const THEME_PREFERENCE_KEY = "theme-preference";
export const NAVIGATION_LAYOUT_KEY = "navigation-layout";
export const NAVIGATION_BEHAVIOR_KEY = "navigation-behavior";
export const UI_PREFERENCES_EVENT = "ui-preferences-changed";

export type ThemePreference = "claro" | "escuro" | "automatico";
export type NavigationLayout = "lateral" | "superior";
export type NavigationBehavior = "fixo" | "expansivel";

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === "claro" || value === "escuro" || value === "automatico";
}

export function isNavigationLayout(value: string | null): value is NavigationLayout {
  return value === "lateral" || value === "superior";
}

export function isNavigationBehavior(value: string | null): value is NavigationBehavior {
  return value === "fixo" || value === "expansivel";
}
