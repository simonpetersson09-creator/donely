/**
 * Date handling for the summary screens that a notification can deep link to.
 *
 * A notification tap carries the date it was *delivered* (`?date=YYYY-MM-DD`),
 * so opening it hours or days later still shows the right day / week instead
 * of "today". Anything missing or malformed falls back to today.
 */

/** Local `YYYY-MM-DD` for a date (never UTC — the schedule is wall-clock). */
export function toDateParam(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses `YYYY-MM-DD` into a local midnight Date, or null when invalid. */
export function parseDateParam(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(date.getTime()) || date.getMonth() !== Number(m) - 1) return null;
  return date;
}

/** The date a summary screen should render — the param when valid, else today. */
export function summaryDate(value: unknown): Date {
  return parseDateParam(value) ?? new Date();
}

/** Search-param validation shared by the summary routes. */
export function validateSummarySearch(search: Record<string, unknown>): { date?: string } {
  const date = parseDateParam(search["date"]);
  return date ? { date: toDateParam(date) } : {};
}
