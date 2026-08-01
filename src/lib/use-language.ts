import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n, {
  LANGUAGES,
  detectLanguage,
  localeOf,
  persistLanguage,
  type LanguageCode,
} from "@/lib/i18n";
import { DEFAULT_CATEGORIES } from "@/lib/store";

const DEFAULT_NAMES = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c.name]));

/** Applies the stored/device language after hydration and exposes the switcher API. */
export function useLanguage() {
  const { t, i18n: instance } = useTranslation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const next = detectLanguage();
    if (instance.language !== next) void instance.changeLanguage(next);
    setReady(true);
  }, [instance]);

  const language = (instance.language ?? "sv") as LanguageCode;

  const changeLanguage = (code: LanguageCode) => {
    persistLanguage(code);
    void instance.changeLanguage(code);
  };

  return { t, language, changeLanguage, ready, languages: LANGUAGES };
}

/** Locale string for Intl formatting, following the active language. */
export function useLocale() {
  const { i18n: instance } = useTranslation();
  return localeOf(instance.language ?? "sv");
}

/**
 * Default categories are translated; user-created ones — and defaults the user has
 * renamed — keep their own name.
 */
export function categoryLabel(t: (key: string) => string, category: { id: string; name: string }) {
  const original = DEFAULT_NAMES.get(category.id);
  return original !== undefined && original === category.name
    ? t(`cat.${category.id}`)
    : category.name;
}

export { i18n };
