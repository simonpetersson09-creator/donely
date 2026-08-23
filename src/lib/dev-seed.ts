/**
 * Development-only demo data.
 *
 * Fills the local database with a realistic set of activities so that the
 * statistics, records, milestones and summary screens have something to show
 * while developing. It NEVER runs in a production build (`import.meta.env.DEV`
 * guard) and never overwrites existing entries — if the user already has data,
 * seeding is skipped.
 *
 * Manual control from the browser console:
 *   donely.seed()   → force-write the demo activities (replaces entries)
 *   donely.clear()  → remove all demo activities again
 */

import {
  DEFAULT_CATEGORIES,
  STORAGE_KEYS,
  categoriesSchema,
  entriesSchema,
  goalsSchema,
  readKey,
  writeKey,
  type Category,
  type Entry,
  type Goals,
} from "@/lib/persistence";
import { DATA_CHANGED_EVENT } from "@/lib/store";

const SEEDED_FLAG = "vr.dev.seeded.v1";

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
}

function startOfDay(daysAgo: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function categoryById(categories: Category[], id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}

/** A deterministic-ish spread of activities over the last ~5 weeks. */
function buildEntries(categories: Category[]): Entry[] {
  const entries: Entry[] = [];
  let n = 0;

  const push = (categoryId: string, daysAgo: number, amount: number, hour: number) => {
    const category = categoryById(categories, categoryId);
    if (!category || amount <= 0) return;
    const at = startOfDay(daysAgo, hour, (n * 7) % 60);
    entries.push({
      id: `dev-${n++}-${at.getTime()}`,
      area: category.area,
      categoryId: category.id,
      categoryName: category.name,
      amount,
      createdAt: at.toISOString(),
    });
  };

  // Last five weeks of work activity, ramping up towards this week so that
  // records and milestones become reachable.
  for (let day = 34; day >= 0; day--) {
    const date = startOfDay(day, 9);
    const weekday = date.getDay(); // 0 = Sunday
    const workday = weekday >= 1 && weekday <= 5;
    const intensity = 1 + Math.round((34 - day) / 12); // 1 → 3

    if (workday) {
      push("j-moten", day, 1 + (day % 2) + intensity - 1, 9);
      push("j-samtal", day, 2 + ((day + 1) % 3) + intensity, 11);
      if (day % 4 === 0) push("j-avtal", day, 1, 14);
      if (day % 3 === 0) push("j-admin", day, 2, 16);
    }

    // Private life happens all week.
    if (day % 2 === 0) push("p-lopning", day, 1, 7);
    if (day % 3 === 1) push("p-traning", day, 1, 6);
    if (day % 2 === 1) push("p-promenad", day, 1, 18);
    push("p-meditation", day, 1, 21);
    if (day % 7 === 0) push("p-bocker", day, 1, 20);
  }

  return entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function buildGoals(year: number): Goals {
  return {
    [`${year}:j-moten`]: 400,
    [`${year}:j-samtal`]: 600,
    [`${year}:j-avtal`]: 60,
    [`${year}:p-lopning`]: 150,
    [`${year}:p-traning`]: 120,
    [`${year}:p-meditation`]: 300,
  };
}

/** Writes the demo activities (and matching yearly goals). */
export function seedDevActivities({ force = false }: { force?: boolean } = {}): boolean {
  if (typeof window === "undefined") return false;

  const storedCategories = readKey(STORAGE_KEYS.categories, categoriesSchema);
  const categories = storedCategories.status === "ok" ? storedCategories.value : DEFAULT_CATEGORIES;
  if (storedCategories.status === "missing") {
    writeKey(STORAGE_KEYS.categories, categories, categoriesSchema);
  }

  const existing = readKey(STORAGE_KEYS.entries, entriesSchema);
  if (!force && existing.status === "ok" && existing.value.length > 0) return false;
  if (!force && existing.status === "corrupt") return false;

  const entries = buildEntries(categories);
  writeKey(STORAGE_KEYS.entries, entries, entriesSchema);

  const storedGoals = readKey(STORAGE_KEYS.goals, goalsSchema);
  const goals = { ...buildGoals(new Date().getFullYear()) };
  if (storedGoals.status === "ok") Object.assign(goals, storedGoals.value);
  writeKey(STORAGE_KEYS.goals, goals, goalsSchema);

  try {
    window.localStorage.setItem(SEEDED_FLAG, "1");
  } catch {
    /* non-critical */
  }

  emit();
  return true;
}

/** Removes every seeded activity again (keeps categories). */
export function clearDevActivities() {
  if (typeof window === "undefined") return;
  writeKey(STORAGE_KEYS.entries, [], entriesSchema);
  try {
    window.localStorage.removeItem(SEEDED_FLAG);
  } catch {
    /* non-critical */
  }
  emit();
}

/**
 * Called once at app start. Only does anything in a dev build, and only when
 * there is no activity data yet.
 */
export function initDevSeed() {
  if (!import.meta.env.DEV || typeof window === "undefined") return;

  const w = window as unknown as { donely?: Record<string, unknown> };
  w.donely = {
    ...(w.donely ?? {}),
    seed: () => seedDevActivities({ force: true }),
    clear: () => clearDevActivities(),
  };

  const already = (() => {
    try {
      return window.localStorage.getItem(SEEDED_FLAG) === "1";
    } catch {
      return false;
    }
  })();
  if (already) return;

  if (seedDevActivities()) {
    console.info("[donely/dev] demo activities seeded — window.donely.clear() to remove them");
  }
}
