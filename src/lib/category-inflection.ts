import i18n from "@/lib/i18n";

/** Languages where a naive "+s" plural is reasonable for custom category names. */
const S_PLURAL_LANGS = new Set(["en", "es", "pt", "fr", "nl"]);

/**
 * Returns the category name inflected for `count`, e.g. 1 -> "möte", 10 -> "möten".
 *
 * Built-in categories use the curated `catn.<id>_one/_other` plural forms so the
 * text reads naturally in every supported language. Custom categories fall back
 * to the user's own label, with a light plural heuristic for +s languages.
 */
export function inflectCategory(id: string, label: string, count: number): string {
  const key = `catn.${id}`;
  if (i18n.exists(key)) {
    return i18n.t(key, { count }) as string;
  }

  const lang = (i18n.resolvedLanguage || i18n.language || "en").split("-")[0];
  if (count === 1 || !S_PLURAL_LANGS.has(lang)) return label;

  const trimmed = label.trim();
  if (/[sxz]$/i.test(trimmed) || /(ch|sh)$/i.test(trimmed)) return trimmed;
  if (/[^aeiou]y$/i.test(trimmed) && lang === "en") return `${trimmed.slice(0, -1)}ies`;
  return `${trimmed}s`;
}

/** "10 möten" – count plus the correctly inflected category name. */
export function activityPhrase(
  id: string,
  label: string,
  count: number,
  locale: string,
): string {
  return `${count.toLocaleString(locale)} ${inflectCategory(id, label, count)}`;
}
