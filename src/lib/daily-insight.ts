import type { Entry } from "@/lib/store";
import { dayEnd, dayStart } from "@/lib/daily-summary";

export type DailyInsight =
  | { kind: "recordYear" }
  | { kind: "best30" }
  | { kind: "bestWeek" }
  | { kind: "average"; direction: "up" | "down"; diff: number };

/** Local YYYY-MM-DD key. */
function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Monday 00:00 local for the week containing `date`. */
function weekStart(date: Date): Date {
  const d = dayStart(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Minimum number of earlier days with activity before averages are shown. */
const MIN_PRIOR_DAYS = 5;

/**
 * One short, dynamic insight for "Din dag", based purely on the user's own
 * history. Today's own registrations are never part of the average.
 */
export function buildDailyInsight(entries: Entry[], day: Date = new Date()): DailyInsight | null {
  const todayKey = dayKey(day);
  const end = dayEnd(day).getTime();

  // Totals per day, only up to and including the viewed day.
  const perDay = new Map<string, number>();
  for (const e of entries) {
    const at = new Date(e.createdAt);
    const time = at.getTime();
    if (!Number.isFinite(time) || time > end) continue;
    const key = dayKey(at);
    perDay.set(key, (perDay.get(key) ?? 0) + e.amount);
  }

  const todayTotal = perDay.get(todayKey) ?? 0;
  if (todayTotal <= 0) return null;

  const priorDays = [...perDay.entries()].filter(([key]) => key !== todayKey);
  if (priorDays.length === 0) return null;

  const startOfYear = new Date(day.getFullYear(), 0, 1).getTime();
  const start30 = dayStart(day).getTime() - 29 * 86_400_000;
  const startWeek = weekStart(day).getTime();

  const inSpan = (key: string, from: number) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1).getTime() >= from;
  };

  const beatsAll = (from: number) =>
    priorDays.filter(([key]) => inSpan(key, from)).every(([, total]) => total < todayTotal);
  const hasPrior = (from: number) => priorDays.some(([key]) => inSpan(key, from));

  if (hasPrior(startOfYear) && beatsAll(startOfYear)) return { kind: "recordYear" };
  if (hasPrior(start30) && beatsAll(start30)) return { kind: "best30" };
  if (hasPrior(startWeek) && beatsAll(startWeek)) return { kind: "bestWeek" };

  if (priorDays.length < MIN_PRIOR_DAYS) return null;
  const sum = priorDays.reduce((acc, [, total]) => acc + total, 0);
  const average = sum / priorDays.length;
  const diff = Math.round(todayTotal - average);
  if (diff === 0) return null;
  return { kind: "average", direction: diff > 0 ? "up" : "down", diff: Math.abs(diff) };
}
