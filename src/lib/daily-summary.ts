import i18n, { localeOf } from "@/lib/i18n";
import { readStoredCategories, readStoredEntries, type Category, type Entry } from "@/lib/store";
import { categoryLabel } from "@/lib/use-language";
import { formatKm, formatMinutes, supportsMetrics } from "@/lib/activity-metrics";

export type DailyRow = {
  id: string;
  label: string;
  total: number;
  distanceKm: number;
  durationMin: number;
};

export type DailySummary = {
  rows: DailyRow[];
  total: number;
  date: Date;
};

/** Start of today (00:00:00.000 local time). */
export function dayStart(from: Date = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate());
}

/** End of today (23:59:59.999 local time). */
export function dayEnd(from: Date = new Date()): Date {
  const d = dayStart(from);
  d.setDate(d.getDate() + 1);
  return new Date(d.getTime() - 1);
}

/**
 * Aggregates today's entries per category, largest first. Only categories
 * with at least one activity today are included, and the user's own category
 * names are used.
 */
export function buildDailySummary(
  entries: Entry[],
  categories: Category[],
  t: (key: string) => string,
  from: Date = new Date(),
): DailySummary {
  const start = dayStart(from);
  const end = dayEnd(from);
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

  const rows: DailyRow[] = [...totals.entries()]
    .filter(([, total]) => total > 0)
    .map(([id, total]) => ({
      id,
      label: categoryLabel(t, known.get(id)!),
      total,
      distanceKm: km.get(id) ?? 0,
      durationMin: minutes.get(id) ?? 0,
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));

  return { rows, total: rows.reduce((sum, r) => sum + r.total, 0), date: start };
}

/** Reads today straight from local storage. */
export function currentDailySummary(language = i18n.language || "sv"): DailySummary {
  const fixed = i18n.getFixedT(language);
  return buildDailySummary(readStoredEntries(), readStoredCategories(), (k) => fixed(k) as string);
}

/**
 * Notification-style body: one line per category (largest first). Metrics for
 * workouts are grouped in parentheses.
 */
export function formatDailyBody(summary: DailySummary, language = i18n.language || "sv"): string {
  const fixed = i18n.getFixedT(language);
  const locale = localeOf(language);
  const lines: string[] = [];

  if (summary.rows.length === 0) {
    lines.push(fixed("dailySummaryEmpty") as string);
  } else {
    for (const row of summary.rows) {
      let line = `${row.label}: ${row.total}`;
      const metricParts: string[] = [];
      if (row.distanceKm > 0) metricParts.push(`${formatKm(row.distanceKm, locale)} km`);
      if (row.durationMin > 0) metricParts.push(formatMinutes(row.durationMin, locale));
      if (metricParts.length > 0) line += ` (${metricParts.join(" · ")})`;
      lines.push(line);
    }
  }

  return lines.join("\n");
}

/**
 * Title + subtitle + body for the daily notification (Mon–Fri 17:00), in the
 * given language. Mirrors `weeklyNotificationContent` so the native bridge can
 * render both the same way.
 */
export function dailyNotificationContent(language = i18n.language || "sv") {
  const fixed = i18n.getFixedT(language);
  const summary = currentDailySummary(language);
  const body = formatDailyBody(summary, language);
  const locale = localeOf(language);
  const dateText = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(summary.date);
  const totalText = fixed("dailySummaryTotal", { count: summary.total }) as string;
  return {
    title: fixed("dailySummaryTitle") as string,
    subtitle: `${dateText.charAt(0).toLocaleUpperCase(locale)}${dateText.slice(1)} · ${totalText}`,
    body,
    bodyLines: body.split("\n"),
  };
}
