import i18n from "@/lib/i18n";
import { readStoredCategories, readStoredEntries, type Category, type Entry } from "@/lib/store";
import { categoryLabel } from "@/lib/use-language";

/**
 * Shared weekly summary used both for the Friday notification body and for the
 * in-app weekly statistics screen, so the two always show the same numbers.
 */

/** Maximum number of category lines shown inside a notification. */
export const MAX_NOTIFICATION_ROWS = 5;

export type WeeklyRow = { id: string; label: string; total: number };

export type WeeklySummary = {
  rows: WeeklyRow[];
  total: number;
  start: Date;
  end: Date;
};

/** Monday 00:00 local time for the week containing `from`. */
export function weekStart(from: Date = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const shift = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - shift);
  return d;
}

/** Sunday 23:59:59.999 local time for the week containing `from`. */
export function weekEnd(from: Date = new Date()): Date {
  const d = weekStart(from);
  d.setDate(d.getDate() + 7);
  return new Date(d.getTime() - 1);
}

/**
 * Aggregates the current week's entries per category, largest first. Only
 * categories with at least one activity this week are included, and the user's
 * own category names are used.
 */
export function buildWeeklySummary(
  entries: Entry[],
  categories: Category[],
  t: (key: string) => string,
  from: Date = new Date(),
): WeeklySummary {
  const start = weekStart(from);
  const end = weekEnd(from);
  const known = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, number>();

  for (const e of entries) {
    const at = new Date(e.createdAt).getTime();
    if (at < start.getTime() || at > end.getTime()) continue;
    if (!known.has(e.categoryId)) continue;
    totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.amount);
  }

  const rows: WeeklyRow[] = [...totals.entries()]
    .filter(([, total]) => total > 0)
    .map(([id, total]) => ({ id, label: categoryLabel(t, known.get(id)!), total }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));

  return { rows, total: rows.reduce((sum, r) => sum + r.total, 0), start, end };
}

/** Reads the current week straight from local storage (used by the scheduler). */
export function currentWeeklySummary(language = i18n.language || "sv"): WeeklySummary {
  const fixed = i18n.getFixedT(language);
  return buildWeeklySummary(readStoredEntries(), readStoredCategories(), (k) => fixed(k) as string);
}

/**
 * Notification body: one line per category (top five), an overflow line when
 * there are more, and always the total on the last line.
 */
export function formatWeeklyBody(summary: WeeklySummary, language = i18n.language || "sv"): string {
  const fixed = i18n.getFixedT(language);
  const lines: string[] = [];

  if (summary.rows.length === 0) {
    lines.push(fixed("weeklySummaryEmpty") as string);
  } else {
    const shown = summary.rows.slice(0, MAX_NOTIFICATION_ROWS);
    for (const row of shown) lines.push(`${row.label}: ${row.total}`);
    const rest = summary.rows.length - shown.length;
    if (rest > 0) lines.push(fixed("weeklySummaryMore", { count: rest }) as string);
  }

  lines.push("");
  lines.push(fixed("weeklySummaryTotal", { count: summary.total }) as string);
  return lines.join("\n");
}

/**
 * Title + body for the weekly notification, in the given language.
 * `bodyLines` is the same text pre-split, so the native shell can rebuild the
 * multi-line body without depending on how newlines survive the bridge.
 */
export function weeklyNotificationContent(language = i18n.language || "sv") {
  const fixed = i18n.getFixedT(language);
  const body = formatWeeklyBody(currentWeeklySummary(language), language);
  return {
    title: fixed("weeklySummaryTitle") as string,
    body,
    bodyLines: body.split("\n"),
  };
}
