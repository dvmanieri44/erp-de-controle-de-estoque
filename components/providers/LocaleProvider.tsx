"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  DEFAULT_LANGUAGE_PREFERENCE,
  UI_PREFERENCES_EVENT,
  loadLanguagePreference,
  saveLanguagePreference,
  type LanguagePreference,
} from "@/lib/ui-preferences";

type LocaleContextValue = {
  locale: LanguagePreference;
  setLocale: (locale: LanguagePreference) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LanguagePreference>(DEFAULT_LANGUAGE_PREFERENCE);

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = loadLanguagePreference();
      setLocaleState(nextLocale);
      document.documentElement.lang = nextLocale;
    };

    syncLocale();
    window.addEventListener("storage", syncLocale);
    window.addEventListener(UI_PREFERENCES_EVENT, syncLocale);

    return () => {
      window.removeEventListener("storage", syncLocale);
      window.removeEventListener(UI_PREFERENCES_EVENT, syncLocale);
    };
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: (nextLocale) => {
        saveLanguagePreference(nextLocale);
        setLocaleState(nextLocale);
        document.documentElement.lang = nextLocale;
        window.dispatchEvent(new Event(UI_PREFERENCES_EVENT));
      },
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);

  if (!context) {
    return {
      locale: DEFAULT_LANGUAGE_PREFERENCE,
      setLocale: () => undefined,
    } satisfies LocaleContextValue;
  }

  return context;
}
