import { DEFAULT_LANGUAGE_PREFERENCE, type LanguagePreference } from "@/lib/ui-preferences";

export const SUPPORTED_LANGUAGES = ["pt-BR", "en-US", "es-ES"] as const;

export function getLanguageDisplayName(language: LanguagePreference, locale: LanguagePreference = DEFAULT_LANGUAGE_PREFERENCE) {
  const labels: Record<LanguagePreference, Record<LanguagePreference, string>> = {
    "pt-BR": {
      "pt-BR": "Português (Brasil)",
      "en-US": "Inglês (Estados Unidos)",
      "es-ES": "Espanhol (Espanha)",
    },
    "en-US": {
      "pt-BR": "Portuguese (Brazil)",
      "en-US": "English (United States)",
      "es-ES": "Spanish (Spain)",
    },
    "es-ES": {
      "pt-BR": "Portugués (Brasil)",
      "en-US": "Inglés (Estados Unidos)",
      "es-ES": "Español (España)",
    },
  };

  return labels[locale][language];
}

export function formatMessage(
  template: string,
  params: Record<string, string | number> = {},
) {
  return Object.entries(params).reduce(
    (value, [key, param]) => value.replaceAll(`{${key}}`, String(param)),
    template,
  );
}
