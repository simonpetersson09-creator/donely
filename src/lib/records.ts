import type { Category, Entry } from "@/lib/store";

/**
 * Deterministic personal records.
 *
 * A record is the highest total for one category inside one calendar period
 * (day / ISO week / month). Detection is pure arithmetic on the stored
 * entries — no heuristics, no AI — and every celebration is de-duplicated
 * through a small localStorage ledger so a refresh never re-fires a toast.
 */

export type RecordType = "day" | "week" | "month";

export type PersonalRecord = {
  categoryId: string;
  type: RecordType;
  /** Total for the winning period. */
  value: number;
  /** Stable identifier of the period, e.g. "2026-08-23" / "2026-W34" / "2026-08". */
  period: string;
  /** Local start of the winning period, ISO string. */
  periodStart: string;
  /** Best value in any *other* period (0 when there is none). */
  previous: number;
  /** How many other periods contain at least one registration. */
  priorPeriods: number;
};

/**
 * Minimum amount of history before a record is considered meaningful. Without
 * this, the very first registration of a new activity would "break a record".
 */
const MIN_PRIOR_PERIODS: Record<RecordType, number> = { day: 4, week: 3, month: 2 };
/** A record of 1 is never interesting. */
const MIN_VALUE = 2;

const pad = (n: number) => String(n).padStart(2, "0");

/** Monday 00:00 local time for the week containing `date`. */
function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function isoWeekParts(date: Date): { year: number; week: number } {
  const tmp = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
  const yearStart = new Date(tmp.getFullYear(), 0, 1);
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return { year: tmp.getFullYear(), week };
}

/** Stable key for the period of `date` in local time. */
export function periodKeyOf(type: RecordType, date: Date): string {
  if (type === "day") return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (type === "month") return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  const { year, week } = isoWeekParts(date);
  return `${year}-W${pad(week)}`;
}

/** Local start date of the period containing `date`. */
export function periodStartOf(type: RecordType, date: Date): Date {
  if (type === "day") return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (type === "month") return new Date(date.getFullYear(), date.getMonth(), 1);
  return startOfWeek(date);
}

type PeriodBucket = { total: number; start: Date };

/** Totals per period for one category. */
function bucketsFor(entries: Entry[], categoryId: string, type: RecordType) {
  const buckets = new Map<string, PeriodBucket>();
  for (const entry of entries) {
    if (entry.categoryId !== categoryId) continue;
    const at = new Date(entry.createdAt);
    if (Number.isNaN(at.getTime())) continue;
    const key = periodKeyOf(type, at);
    const current = buckets.get(key);
    if (current) current.total += entry.amount;
    else buckets.set(key, { total: entry.amount, start: periodStartOf(type, at) });
  }
  return buckets;
}

/**
 * The all-time best period for one category and period type, or null when
 * there is not enough history for it to be meaningful.
 */
export function bestRecord(
  entries: Entry[],
  categoryId: string,
  type: RecordType,
): PersonalRecord | null {
  const buckets = bucketsFor(entries, categoryId, type);
  if (buckets.size === 0) return null;

  let bestKey = "";
  let best: PeriodBucket | null = null;
  for (const [key, bucket] of buckets) {
    if (!best || bucket.total > best.total || (bucket.total === best.total && key > bestKey)) {
      best = bucket;
      bestKey = key;
    }
  }
  if (!best || best.total < MIN_VALUE) return null;

  let previous = 0;
  let priorPeriods = 0;
  for (const [key, bucket] of buckets) {
    if (key === bestKey) continue;
    if (bucket.total > 0) priorPeriods += 1;
    if (bucket.total > previous) previous = bucket.total;
  }
  if (priorPeriods < MIN_PRIOR_PERIODS[type]) return null;

  return {
    categoryId,
    type,
    value: best.total,
    period: bestKey,
    periodStart: best.start.toISOString(),
    previous,
    priorPeriods,
  };
}

/**
 * Records that the *current* day / week / month has just beaten for one
 * category. Only strictly higher values count — tying an old record does not.
 */
export function detectRecords(
  entries: Entry[],
  categoryId: string,
  now: Date = new Date(),
): PersonalRecord[] {
  const found: PersonalRecord[] = [];
  for (const type of ["day", "week", "month"] as RecordType[]) {
    const buckets = bucketsFor(entries, categoryId, type);
    const key = periodKeyOf(type, now);
    const current = buckets.get(key);
    if (!current || current.total < MIN_VALUE) continue;

    let previous = 0;
    let priorPeriods = 0;
    for (const [otherKey, bucket] of buckets) {
      if (otherKey === key) continue;
      if (bucket.total > 0) priorPeriods += 1;
      if (bucket.total > previous) previous = bucket.total;
    }
    if (priorPeriods < MIN_PRIOR_PERIODS[type]) continue;
    if (current.total <= previous) continue;

    found.push({
      categoryId,
      type,
      value: current.total,
      period: key,
      periodStart: current.start.toISOString(),
      previous,
      priorPeriods,
    });
  }
  // Bara det mest imponerande rekordet firas åt gången (månad > vecka > dag).
  const order: RecordType[] = ["month", "week", "day"];
  return found.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
}

/** Best record per category, one row per category (highest value wins). */
export function recordHighlights(
  entries: Entry[],
  categories: Category[],
  limit = 6,
): PersonalRecord[] {
  const rows: PersonalRecord[] = [];
  for (const category of categories) {
    const candidates = (["day", "week", "month"] as RecordType[])
      .map((type) => bestRecord(entries, category.id, type))
      .filter((r): r is PersonalRecord => r !== null);
    if (candidates.length === 0) continue;
    const order: RecordType[] = ["month", "week", "day"];
    candidates.sort((a, b) => b.value - a.value || order.indexOf(a.type) - order.indexOf(b.type));
    rows.push(candidates[0]);
  }
  return rows.sort((a, b) => b.value - a.value).slice(0, limit);
}

/* ---------------------------------------------------------------- ledger */

const LEDGER_KEY = "vr.records.celebrated.v1";
const MAX_LEDGER_ENTRIES = 200;

type Ledger = Record<string, number>;

function readLedger(): Ledger {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LEDGER_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Ledger = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function writeLedger(ledger: Ledger) {
  if (typeof window === "undefined") return;
  try {
    const keys = Object.keys(ledger);
    const trimmed =
      keys.length > MAX_LEDGER_ENTRIES
        ? Object.fromEntries(keys.slice(keys.length - MAX_LEDGER_ENTRIES).map((k) => [k, ledger[k]]))
        : ledger;
    window.localStorage.setItem(LEDGER_KEY, JSON.stringify(trimmed));
  } catch {
    /* storage full or unavailable — celebrations are non-critical */
  }
}

const ledgerKeyOf = (record: PersonalRecord) =>
  `${record.categoryId}:${record.type}:${record.period}`;

/**
 * Marks a record as celebrated. Returns false when the exact same record (same
 * category, period and value or higher) has already been shown, so a refresh
 * or a re-render never fires the toast twice.
 */
export function claimRecord(record: PersonalRecord): boolean {
  const ledger = readLedger();
  const key = ledgerKeyOf(record);
  if ((ledger[key] ?? 0) >= record.value) return false;
  ledger[key] = record.value;
  writeLedger(ledger);
  return true;
}

/** Removes the celebration ledger (used when all app data is deleted). */
export function clearRecordLedger() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEDGER_KEY);
  } catch {
    /* ignore */
  }
}
