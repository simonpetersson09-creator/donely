import type { Category } from "@/lib/persistence";

/**
 * Words that mark a category as a physical activity where distance and
 * duration make sense. Matched case-insensitively against the stored name and
 * the stable id, so both default and user created categories are covered.
 */
const ACTIVITY_WORDS = [
  "tran",
  "trän",
  "trening",
  "traening",
  "harjoit",
  "workout",
  "training",
  "gym",
  "exercise",
  "fitness",
  "promenad",
  "walk",
  "gehen",
  "spazier",
  "kavely",
  "löp",
  "lop",
  "spring",
  "run",
  "jogg",
  "cykel",
  "cykl",
  "bike",
  "cycl",
  "rad",
  "sim",
  "swim",
  "schwimm",
  "yoga",
  "pilates",
  "padel",
  "tennis",
  "skid",
  "ski",
  "rodd",
  "row",
  "vandr",
  "hike",
  "spinn",
  "spin",
  "crossfit",
  "cross",
  "styrk",
  "strength",
  "kondition",
  "cardio",
  "rörelse",
  "rorelse",
  "dans",
  "danc",
  "box",
  "kampsport",
  "klättr",
  "klattr",
  "climb",
  "stavgång",
  "stavgang",
  "skate",
  "golf",
  "fotboll",
  "football",
  "soccer",
  "innebandy",
  "basket",
  "handboll",
  "hockey",
  "squash",
  "badminton",
  "zumba",
  "aerobic",
  "hiit",
  "intervall",
  "interval",
  "motion",
];

function normalize(value: string) {
  return value.toLowerCase();
}

/** True when the category is a private activity that can log km and minutes. */
export function supportsMetrics(category: Pick<Category, "id" | "name" | "area">) {
  if (category.area !== "privat") return false;
  const haystack = `${normalize(category.name)} ${normalize(category.id)}`;
  return ACTIVITY_WORDS.some((word) => haystack.includes(word));
}

/** Parses a free-text metric field into a positive number, or undefined. */
export function parseMetric(value: string) {
  const n = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Formats km with at most one decimal, using the active locale. */
export function formatKm(value: number, locale: string) {
  return value.toLocaleString(locale, { maximumFractionDigits: 1 });
}

/** Formats minutes as "1 h 20 min" when it goes past an hour. */
export function formatMinutes(value: number, locale: string) {
  const total = Math.round(value);
  if (total < 60) return `${total.toLocaleString(locale)} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
