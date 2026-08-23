import type { Category, Entry } from "@/lib/store";
import {
  bestRecord,
  claimRecord,
  detectRecords,
  periodKeyOf,
  type PersonalRecord,
  type RecordType,
} from "@/lib/records";

/**
 * In-app feedback after a registration.
 *
 * Everything here is deterministic arithmetic on the already-saved entries and
 * runs *after* the entry is stored, so the quick "+" flow never gets slower.
 * At most one achievement is returned per registration, in this priority:
 *   record > milestone > nearRecord > nearMilestone
 */

export type Achievement =
  | { kind: "record"; categoryId: string; type: RecordType; value: number; previous: number }
  | { kind: "milestone"; categoryId: string; target: number }
  | {
      kind: "nearRecord";
      categoryId: string;
      type: RecordType;
      current: number;
      target: number;
      remaining: number;
    }
  | { kind: "nearMilestone"; categoryId: string; target: number; remaining: number };

/** Natural milestones — the steps grow so they never fire too often. */
const BASE_MILESTONES = [10, 25, 50, 100, 250, 500, 1000];

/** Every milestone up to (and a bit past) `total`. */
function milestonesUpTo(total: number): number[] {
  const out = [...BASE_MILESTONES];
  let next = 2000;
  while (next <= total + 5000) {
    out.push(next);
    next += next < 5000 ? 1000 : 5000;
  }
  return out;
}

/** The highest milestone strictly crossed when going from `before` to `after`. */
export function milestoneCrossed(before: number, after: number): number | null {
  let hit: number | null = null;
  for (const m of milestonesUpTo(after)) {
    if (before < m && after >= m) hit = m;
  }
  return hit;
}

/** The next milestone above `total`. */
export function nextMilestone(total: number): number {
  for (const m of milestonesUpTo(total + 1)) if (m > total) return m;
  return total + 1000;
}

/** All-time total for one category. */
export function categoryTotal(entries: Entry[], categoryId: string): number {
  let total = 0;
  for (const e of entries) if (e.categoryId === categoryId) total += e.amount;
  return total;
}

/** Total inside one period for one category. */
function periodTotal(entries: Entry[], categoryId: string, type: RecordType, now: Date): number {
  const key = periodKeyOf(type, now);
  let total = 0;
  for (const e of entries) {
    if (e.categoryId !== categoryId) continue;
    const at = new Date(e.createdAt);
    if (Number.isNaN(at.getTime())) continue;
    if (periodKeyOf(type, at) === key) total += e.amount;
  }
  return total;
}

/** Feedback is only shown from 80 % of the target and up. */
const NEAR_RATIO = 0.8;
const ORDER: RecordType[] = ["month", "week", "day"];

/* ---------------------------------------------------------------- ledger */

const SEEN_KEY = "vr.achievements.seen.v1";
const MAX_SEEN = 300;

function readSeen(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function claimKey(key: string): boolean {
  if (typeof window === "undefined") return true;
  const seen = readSeen();
  if (seen.includes(key)) return false;
  const next = [...seen, key].slice(-MAX_SEEN);
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    /* celebrations are non-critical */
  }
  return true;
}

/** Clears the "already shown" ledger (used when all app data is deleted). */
export function clearAchievementLedger() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SEEN_KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------- detection */

/**
 * The single most relevant thing to show after a registration, or null when a
 * registration is just an ordinary one (the common, calm case).
 */
export function detectAchievement(
  entries: Entry[],
  categoryId: string,
  now: Date = new Date(),
): Achievement | null {
  // 1. New personal record — already de-duplicated by its own ledger.
  const record = detectRecords(entries, categoryId, now).find((r) => claimRecord(r));
  if (record) {
    return {
      kind: "record",
      categoryId,
      type: record.type,
      value: record.value,
      previous: record.previous,
    };
  }

  const total = categoryTotal(entries, categoryId);

  // 2. Milestone just crossed.
  for (const target of milestonesUpTo(total)) {
    if (total >= target && claimKeyIfNew(`ms:${categoryId}:${target}`, total, target)) {
      return { kind: "milestone", categoryId, target };
    }
  }

  // 3. Close to a personal record in the current day / week / month.
  for (const type of ORDER) {
    const best = bestRecord(entries, categoryId, type);
    if (!best) continue;
    const current = periodTotal(entries, categoryId, type, now);
    if (best.period === periodKeyOf(type, now)) continue; // the record *is* this period
    const remaining = best.value + 1 - current;
    if (current < NEAR_RATIO * best.value || remaining <= 0) continue;
    if (!claimKey(`near:${categoryId}:${type}:${periodKeyOf(type, now)}:${best.value}`)) continue;
    return { kind: "nearRecord", categoryId, type, current, target: best.value, remaining };
  }

  // 4. Close to the next milestone.
  const target = nextMilestone(total);
  const remaining = target - total;
  if (total >= NEAR_RATIO * target && remaining > 0) {
    if (claimKey(`nearms:${categoryId}:${target}`)) {
      return { kind: "nearMilestone", categoryId, target, remaining };
    }
  }

  return null;
}

/**
 * A milestone only counts the first time it is reached. The ledger key carries
 * the target, so re-reaching it after an undo never fires twice.
 */
function claimKeyIfNew(key: string, total: number, target: number): boolean {
  if (total < target) return false;
  return claimKey(key);
}

/* -------------------------------------------------- notification enrichment */

export type PeriodHighlight = { records: PersonalRecord[]; milestones: number[] };

/**
 * Records set and milestones crossed inside one time span — used to adapt the
 * text of the existing daily / weekly notifications (no new notifications).
 */
export function highlightsInSpan(
  entries: Entry[],
  categories: Category[],
  type: RecordType,
  start: Date,
  end: Date,
): PeriodHighlight {
  const key = periodKeyOf(type, start);
  const records: PersonalRecord[] = [];
  const milestones: number[] = [];

  for (const category of categories) {
    const best = bestRecord(entries, category.id, type);
    if (best && best.period === key) records.push(best);

    let before = 0;
    let after = 0;
    for (const e of entries) {
      if (e.categoryId !== category.id) continue;
      const at = new Date(e.createdAt).getTime();
      if (Number.isNaN(at)) continue;
      if (at < start.getTime()) before += e.amount;
      if (at <= end.getTime()) after += e.amount;
    }
    const hit = milestoneCrossed(before, after);
    if (hit) milestones.push(hit);
  }

  records.sort((a, b) => b.value - a.value);
  milestones.sort((a, b) => b - a);
  return { records, milestones };
}
