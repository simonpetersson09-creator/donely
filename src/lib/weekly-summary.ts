import i18n, { localeOf } from "@/lib/i18n";
import { readStoredCategories, readStoredEntries, type Category, type Entry } from "@/lib/store";
import { categoryLabel } from "@/lib/use-language";
import { formatKm, formatMinutes, supportsMetrics } from "@/lib/activity-metrics";

/**
 * Shared weekly summary used both for the Friday notification body and for the
 * in-app weekly statistics screen, so the two always show the same numbers.
 */

/** Maximum number of category lines shown inside a notification. */
export const MAX_NOTIFICATION_ROWS = 10;

/** ISO week number for the given date (Monday-based, 1–53). */
export function isoWeek(date: Date): number {
  const tmp = new Date(date.getTime());
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
  const yearStart = new Date(tmp.getFullYear(), 0, 1);
  return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}

export type WeeklyRow = {
  id: string;
  label: string;
  total: number;
  distanceKm: number;
  durationMin: number;
};

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
  const km = new Map<string, number>();
  const minutes = new Map<string, number>();

  for (const e of entries) {
    const at = new Date(e.createdAt).getTime();
    if (at < start.getTime() || at > end.getTime()) continue;
    const category = known.get(e.categoryId);
    if (!category) continue;
    totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.amount);
    const activity = supportsMetrics(category);
    if (activity && e.distanceKm) {
      km.set(e.categoryId, (km.get(e.categoryId) ?? 0) + e.distanceKm);
    }
    if (activity && e.durationMin) {
      minutes.set(e.categoryId, (minutes.get(e.categoryId) ?? 0) + e.durationMin);
    }
  }

  const rows: WeeklyRow[] = [...totals.entries()]
    .filter(([, total]) => total > 0)
    .map(([id, total]) => ({
      id,
      label: categoryLabel(t, known.get(id)!),
      total,
      distanceKm: km.get(id) ?? 0,
      durationMin: minutes.get(id) ?? 0,
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));

  return { rows, total: rows.reduce((sum, r) => sum + r.total, 0), start, end };
}

/** Reads the current week straight from local storage (used by the scheduler). */
export function currentWeeklySummary(language = i18n.language || "sv"): WeeklySummary {
  const fixed = i18n.getFixedT(language);
  return buildWeeklySummary(readStoredEntries(), readStoredCategories(), (k) => fixed(k) as string);
}

/**
 * Notification body: one line per category (largest first). Metrics for
 * workouts are grouped in parentheses so the line is easier to scan.
 */
export function formatWeeklyBody(summary: WeeklySummary, language = i18n.language || "sv"): string {
  const fixed = i18n.getFixedT(language);
  const locale = localeOf(language);
  const lines: string[] = [];

  if (summary.rows.length === 0) {
    lines.push(fixed("weeklySummaryEmpty") as string);
  } else {
    const shown = summary.rows.slice(0, MAX_NOTIFICATION_ROWS);
    for (const row of shown) {
      let line = `${row.label}: ${row.total}`;
      const metricParts: string[] = [];
      if (row.distanceKm > 0) metricParts.push(`${formatKm(row.distanceKm, locale)} km`);
      if (row.durationMin > 0) metricParts.push(formatMinutes(row.durationMin, locale));
      if (metricParts.length > 0) line += ` (${metricParts.join(" · ")})`;
      lines.push(line);
    }
    const rest = summary.rows.length - shown.length;
    if (rest > 0) lines.push(fixed("weeklySummaryMore", { count: rest }) as string);
  }

  return lines.join("\n");
}

/**
 * Title + subtitle + body for the weekly notification, in the given language.
 * The subtitle carries the week number and total, so the body can stay as a
 * clean category list. `bodyLines` is the same body pre-split, so the native
 * shell can rebuild the multi-line body without depending on how newlines
 * survive the bridge.
 */
export function weeklyNotificationContent(language = i18n.language || "sv") {
  const fixed = i18n.getFixedT(language);
  const summary = currentWeeklySummary(language);
  const body = formatWeeklyBody(summary, language);
  const weekNo = isoWeek(summary.end);
  const totalText = fixed("weeklySummaryTotal", { count: summary.total }) as string;
  const subtitle = `${fixed("weeklyHeading")} ${weekNo} · ${totalText}`;
  return {
    title: fixed("weeklySummaryTitle") as string,
    subtitle,
    body,
    bodyLines: body.split("\n"),
  };
}
