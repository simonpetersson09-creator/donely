import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { clearRecordLedger } from "@/lib/records";
import { clearAchievementLedger } from "@/lib/achievements";

import type { z } from "zod";
import {
  DEFAULT_CATEGORIES,
  STORAGE_KEYS,
  categoriesSchema,
  createBackup,
  entriesSchema,
  flagSchema,
  getIntegrityStatus,
  goalsSchema,
  initializeStorage,
  readFlag,
  readKey,
  subscribeIntegrity,
  writeTransaction,
  writeKey,
  yearlyGoalsSchema,
  type Category,
  type Entry,
  type Goals,
  type YearlyGoal,
} from "@/lib/persistence";

export type Area = "jobb" | "privat";
export type { Category, Entry, Goals, YearlyGoal };
export { DEFAULT_CATEGORIES };

const CATS_KEY = STORAGE_KEYS.categories;
const ENTRIES_KEY = STORAGE_KEYS.entries;
const GOALS_KEY = STORAGE_KEYS.goals;
const YEARLY_GOALS_KEY = STORAGE_KEYS.yearlyGoals;
const ONBOARDING_KEY = STORAGE_KEYS.onboarding;
const LANG_GUIDE_KEY = STORAGE_KEYS.langGuide;
const REMINDER_PROMPT_KEY = STORAGE_KEYS.reminderPrompt;

/** Event fired whenever entries or categories change (used to refresh the weekly notification). */
export const DATA_CHANGED_EVENT = "donely:data-changed";

function emitDataChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
}

/**
 * Ensures the storage layer has validated/recovered itself before the first
 * read. Safe to call many times — it only does work once per app start.
 */
function ready() {
  initializeStorage();
}

/**
 * Reads a list. A missing key falls back to `fallback`, but a *corrupt* key
 * keeps the current in-memory value and never triggers a write, so damaged
 * bytes are preserved for recovery instead of being replaced by defaults.
 */
function readList<T>(key: string, schema: Parameters<typeof readKey<T[]>>[1], fallback: T[]): T[] {
  const result = readKey(key, schema);
  return result.status === "ok" ? result.value : fallback;
}

/** Synchronous read of the stored categories (non-React callers). */
export function readStoredCategories(): Category[] {
  ready();
  return readList<Category>(CATS_KEY, categoriesSchema, DEFAULT_CATEGORIES);
}

/** Synchronous read of the stored entries (non-React callers). */
export function readStoredEntries(): Entry[] {
  ready();
  return readList<Entry>(ENTRIES_KEY, entriesSchema, []);
}

/**
 * Deletes a category and all related data as one storage transaction.
 * This avoids three rapid writes/events (and three large backups), which can
 * leave WKWebView in a partially updated state when storage is close to quota.
 */
export function deleteCategoryData(categoryId: string): boolean {
  ready();
  const categories = readKey(CATS_KEY, categoriesSchema);
  const entries = readKey(ENTRIES_KEY, entriesSchema);
  const goals = readKey(GOALS_KEY, goalsSchema);
  if (categories.status !== "ok") return false;

  const nextGoals = goals.status === "ok" ? { ...goals.value } : {};
  for (const key of Object.keys(nextGoals)) {
    if (key.endsWith(`:${categoryId}`)) delete nextGoals[key];
  }

  createBackup("remove-category-data");
  const committed = writeTransaction([
    {
      key: CATS_KEY,
      value: categories.value.filter((category) => category.id !== categoryId),
      schema: categoriesSchema as unknown as z.ZodType<unknown>,
    },
    {
      key: ENTRIES_KEY,
      value:
        entries.status === "ok"
          ? entries.value.filter((entry) => entry.categoryId !== categoryId)
          : [],
      schema: entriesSchema as unknown as z.ZodType<unknown>,
    },
    { key: GOALS_KEY, value: nextGoals, schema: goalsSchema as unknown as z.ZodType<unknown> },
  ]);
  if (committed) emitDataChanged();
  return committed;
}

const SERVER_INTEGRITY = { state: "ok" } as ReturnType<typeof getIntegrityStatus>;
const serverIntegrity = () => SERVER_INTEGRITY;

/** Exposes the startup integrity result (corrupt data / restored from backup). */
export function useDataIntegrity() {
  return useSyncExternalStore(subscribeIntegrity, getIntegrityStatus, serverIntegrity);
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [hydrated, setHydrated] = useState(false);

  const readFromStorage = useCallback(() => {
    ready();
    // The stored list is always authoritative. Defaults are seeded once by
    // initializeStorage() on a truly empty install — never here.
    const stored = readKey(CATS_KEY, categoriesSchema);
    if (stored.status === "ok") setCategories(stored.value);
    else if (stored.status === "missing") setCategories(readFlagSeeded());
    // "corrupt" → keep whatever is on screen, do not write anything.
    setHydrated(true);
  }, []);

  useEffect(() => {
    readFromStorage();
  }, [readFromStorage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener(DATA_CHANGED_EVENT, readFromStorage);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, readFromStorage);
  }, [readFromStorage]);

  const commit = useCallback((next: Category[]) => {
    writeKey(CATS_KEY, next, categoriesSchema);
    emitDataChanged();
    return next;
  }, []);

  const addCategory = useCallback(
    (name: string, area: Area) => {
      const category: Category = {
        // Stable id, generated once and never regenerated afterwards.
        id: `${area}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name: name.trim(),
        area,
      };
      setCategories((prev) => commit([...prev, category]));
      return category;
    },
    [commit],
  );

  const renameCategory = useCallback(
    (id: string, name: string) => {
      // Only the label changes — the id (and therefore every entry relation)
      // is preserved.
      setCategories((prev) =>
        commit(prev.map((c) => (c.id === id ? { ...c, name: name.trim() } : c))),
      );
    },
    [commit],
  );

  const setCategoryColor = useCallback(
    (id: string, color: string | null) => {
      setCategories((prev) =>
        commit(
          prev.map((c) => {
            if (c.id !== id) return c;
            if (!color) {
              const { color: _drop, ...rest } = c;
              return rest;
            }
            return { ...c, color };
          }),
        ),
      );
    },
    [commit],
  );

  const removeCategory = useCallback(
    (id: string) => {
      createBackup("remove-category");
      setCategories((prev) => commit(prev.filter((c) => c.id !== id)));
    },
    [commit],
  );


  /**
   * Reorders a category to an absolute position within its own area.
   * Used by drag-to-reorder in the category picker.
   */
  const reorderCategory = useCallback(
    (id: string, newIndex: number) => {
      setCategories((prev) => {
        const current = prev.find((c) => c.id === id);
        if (!current) return prev;
        const sameArea = prev.filter((c) => c.area === current.area);
        const oldIndex = sameArea.findIndex((c) => c.id === id);
        if (oldIndex === newIndex || newIndex < 0 || newIndex >= sameArea.length) return prev;
        const reordered = [...sameArea];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);
        const reorderedIter = reordered[Symbol.iterator]();
        const next = prev.map((c) =>
          c.area === current.area ? reorderedIter.next().value! : c,
        );
        return commit(next);
      });
    },
    [commit],
  );

  return {
    categories,
    addCategory,
    renameCategory,
    setCategoryColor,
    removeCategory,
    reorderCategory,
    hydrated,
  };
}

function readFlagSeeded(): Category[] {
  const stored = readKey(CATS_KEY, categoriesSchema);
  return stored.status === "ok" ? stored.value : DEFAULT_CATEGORIES;
}

export function useEntries() {
  const [entries, setEntries] = useState<Entry[]>([]);

  const readFromStorage = useCallback(() => {
    ready();
    const stored = readKey(ENTRIES_KEY, entriesSchema);
    if (stored.status === "ok") setEntries(stored.value);
    // missing → empty list (nothing written), corrupt → left untouched.
  }, []);

  useEffect(() => {
    readFromStorage();
  }, [readFromStorage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener(DATA_CHANGED_EVENT, readFromStorage);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, readFromStorage);
  }, [readFromStorage]);

  const commit = useCallback((next: Entry[]) => {
    writeKey(ENTRIES_KEY, next, entriesSchema);
    emitDataChanged();
    return next;
  }, []);

  const addEntry = useCallback(
    (entry: Omit<Entry, "id" | "createdAt">) => {
      const id = crypto.randomUUID();
      setEntries((prev) =>
        commit([{ ...entry, id, createdAt: new Date().toISOString() }, ...prev]),
      );
      return id;
    },
    [commit],
  );

  /** Edits amount and/or date of a single entry, keeping the list sorted. */
  const updateEntry = useCallback(
    (id: string, patch: { amount?: number; createdAt?: string }) => {
      createBackup("update-entry");
      setEntries((prev) =>
        commit(
          prev
            .map((e) => (e.id === id ? { ...e, ...patch } : e))
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)),
        ),
      );
    },
    [commit],
  );

  /**
   * Adds a summed entry for a past period — either a previous year (e.g. "150
   * runs in 2025") or a past month in the current year (e.g. "32 meetings in
   * March 2026"). The entry is dated at 12:00 on the last day of the supplied
   * period so it is picked up by the matching month/year statistics, and the
   * list stays sorted newest-first.
   */
  const addHistoryEntry = useCallback(
    (entry: Omit<Entry, "id" | "createdAt">, date: Date) => {
      const createdAt = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        12,
        0,
        0,
      ).toISOString();
      createBackup("add-history-entry");
      setEntries((prev) =>
        commit(
          [{ ...entry, id: crypto.randomUUID(), createdAt }, ...prev].sort((a, b) =>
            a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
          ),
        ),
      );
    },
    [commit],
  );


  const removeEntry = useCallback(
    (id: string) => {
      createBackup("remove-entry");
      setEntries((prev) => commit(prev.filter((e) => e.id !== id)));
    },
    [commit],
  );

  const removeEntriesByCategory = useCallback(
    (categoryId: string) => {
      createBackup("remove-category-entries");
      setEntries((prev) => commit(prev.filter((e) => e.categoryId !== categoryId)));
    },
    [commit],
  );

  return { entries, addEntry, addHistoryEntry, updateEntry, removeEntry, removeEntriesByCategory };
}

/** key: `${year}:${categoryId}` -> yearly target */
export function goalKey(year: number, categoryId: string) {
  return `${year}:${categoryId}`;
}

export function useGoals() {
  const [goals, setGoals] = useState<Goals>({});
  const [hydrated, setHydrated] = useState(false);

  const readFromStorage = useCallback(() => {
    ready();
    const stored = readKey(GOALS_KEY, goalsSchema);
    if (stored.status === "ok") setGoals(stored.value);
    setHydrated(true);
  }, []);

  useEffect(() => {
    readFromStorage();
  }, [readFromStorage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener(DATA_CHANGED_EVENT, readFromStorage);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, readFromStorage);
  }, [readFromStorage]);

  const commit = useCallback((next: Goals) => {
    writeKey(GOALS_KEY, next, goalsSchema);
    return next;
  }, []);

  const setGoal = useCallback(
    (year: number, categoryId: string, target: number) => {
      setGoals((prev) => commit({ ...prev, [goalKey(year, categoryId)]: target }));
    },
    [commit],
  );

  const removeGoal = useCallback(
    (year: number, categoryId: string) => {
      setGoals((prev) => {
        const next = { ...prev };
        delete next[goalKey(year, categoryId)];
        return commit(next);
      });
    },
    [commit],
  );

  const removeGoalsByCategory = useCallback(
    (categoryId: string) => {
      setGoals((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (key.endsWith(`:${categoryId}`)) delete next[key];
        }
        return commit(next);
      });
    },
    [commit],
  );

  return { goals, setGoal, removeGoal, removeGoalsByCategory, hydrated };
}

export function useYearlyGoals() {
  const [goals, setGoals] = useState<YearlyGoal[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const goalsRef = useRef<YearlyGoal[]>([]);

  const apply = useCallback((next: YearlyGoal[]) => {
    goalsRef.current = next;
    setGoals(next);
  }, []);

  const readFromStorage = useCallback(() => {
    ready();
    const stored = readKey(YEARLY_GOALS_KEY, yearlyGoalsSchema);
    if (stored.status === "ok") {
      // Guard against duplicate ids sneaking in from concurrent writes.
      const seen = new Set<string>();
      const unique = stored.value.filter((g) => {
        if (seen.has(g.id)) return false;
        seen.add(g.id);
        return true;
      });
      apply(unique);
    }
    setHydrated(true);
  }, [apply]);

  useEffect(() => {
    readFromStorage();
  }, [readFromStorage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener(DATA_CHANGED_EVENT, readFromStorage);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, readFromStorage);
  }, [readFromStorage]);

  const commit = useCallback(
    (next: YearlyGoal[]) => {
      apply(next);
      writeKey(YEARLY_GOALS_KEY, next, yearlyGoalsSchema);
      emitDataChanged();
      return next;
    },
    [apply],
  );

  const addGoal = useCallback(
    (text: string, halfYear: "h1" | "h2") => {
      const trimmed = text.trim();
      // Reuse an existing empty draft row instead of stacking a new one.
      const existingEmpty = goalsRef.current.find((g) => !g.text && !g.completed);
      if (!trimmed && existingEmpty) return existingEmpty.id;

      const goal: YearlyGoal = {
        id: crypto.randomUUID(),
        text: trimmed,
        completed: false,
        halfYear,
        createdAt: new Date().toISOString(),
      };
      commit([...goalsRef.current, goal]);
      return goal.id;
    },
    [commit],
  );



  const toggleGoal = useCallback(
    (id: string) => {
      commit(goalsRef.current.map((g) => (g.id === id ? { ...g, completed: !g.completed } : g)));
    },
    [commit],
  );

  const updateGoalText = useCallback(
    (id: string, text: string) => {
      const trimmed = text.trim();
      commit(
        trimmed
          ? goalsRef.current.map((g) => (g.id === id ? { ...g, text: trimmed } : g))
          : goalsRef.current.filter((g) => g.id !== id),
      );
    },
    [commit],
  );

  const removeGoal = useCallback(
    (id: string) => {
      createBackup("remove-yearly-goal");
      commit(goalsRef.current.filter((g) => g.id !== id));
    },
    [commit],
  );

  const moveGoal = useCallback(
    (id: string, halfYear: "h1" | "h2") => {
      commit(goalsRef.current.map((g) => (g.id === id ? { ...g, halfYear } : g)));
    },
    [commit],
  );


  return { goals, addGoal, toggleGoal, updateGoalText, removeGoal, moveGoal, hydrated };
}

function useFlag(key: string) {
  const [value, setValue] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    ready();
    setValue(readFlag(key));
    setHydrated(true);
  }, [key]);

  const mark = useCallback(() => {
    writeKey(key, true, flagSchema);
    setValue(true);
  }, [key]);

  return { value, mark, hydrated };
}

export function useOnboarding() {
  const { value, mark, hydrated } = useFlag(ONBOARDING_KEY);
  return { seen: value, markSeen: mark, hydrated };
}

export function useLanguageGuide() {
  const { value, mark, hydrated } = useFlag(LANG_GUIDE_KEY);
  return { seen: value, markSeen: mark, hydrated };
}

/**
 * Tracks whether Donely's own explanatory notification dialog has been shown.
 * It is shown exactly once, on the first run after the welcome screen, and the
 * choice ("Enable reminder" / "Not now") is stored locally.
 */
export function useReminderPrompt() {
  const { value, mark, hydrated } = useFlag(REMINDER_PROMPT_KEY);
  return { answered: value, markAnswered: mark, hydrated };
}

/**
 * Clears every locally stored entry, category and goal.
 * Only ever called from the explicit two-step confirmation in Settings.
 * A backup is taken first, so the deletion is recoverable from the app data.
 */
export function clearAllData() {
  if (typeof window === "undefined") return;
  createBackup("delete-all-data");
  clearRecordLedger();
  clearAchievementLedger();

  for (const key of [CATS_KEY, ENTRIES_KEY, GOALS_KEY, YEARLY_GOALS_KEY, ONBOARDING_KEY, LANG_GUIDE_KEY]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  emitDataChanged();
}

/**
 * True in local development and in the Lovable preview, where the browser
 * storage can be wiped between builds. Never true in the shipped iOS app.
 */
export function isDevEnvironment() {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.includes("-preview--") ||
    host.endsWith("-dev.lovable.app")
  );
}

/**
 * Development helper: fills the app with a handful of realistic activities
 * spread over the last few weeks, so the statistics and weekly views have
 * something to show after the preview storage has been cleared.
 * Existing entries are kept — the demo rows are simply added on top.
 */
export function seedDemoEntries(): number {
  if (typeof window === "undefined") return 0;
  ready();
  const categories = readStoredCategories();
  const existing = readStoredEntries();
  if (categories.length === 0) return 0;

  const pick = (idPart: string) => categories.find((c) => c.id.includes(idPart)) ?? categories[0];

  const plan: { category: Category; amount: number; daysAgo: number; km?: number; min?: number }[] =
    [
      { category: pick("traning"), amount: 1, daysAgo: 0, km: 5.2, min: 32 },
      { category: pick("traning"), amount: 1, daysAgo: 2, km: 8, min: 47 },
      { category: pick("traning"), amount: 1, daysAgo: 9, km: 3.4, min: 21 },
      { category: pick("promenad"), amount: 1, daysAgo: 1, km: 2.1, min: 25 },
      { category: pick("promenad"), amount: 1, daysAgo: 4, km: 4, min: 40 },
      { category: pick("meditation"), amount: 1, daysAgo: 3, min: 15 },
      { category: pick("bocker"), amount: 1, daysAgo: 12 },
      { category: pick("moten"), amount: 3, daysAgo: 0 },
      { category: pick("moten"), amount: 2, daysAgo: 5 },
      { category: pick("samtal"), amount: 7, daysAgo: 1 },
      { category: pick("avtal"), amount: 1, daysAgo: 6 },
      { category: pick("admin"), amount: 4, daysAgo: 8 },
    ];

  const demo: Entry[] = plan.map((row, index) => {
    const date = new Date();
    date.setDate(date.getDate() - row.daysAgo);
    date.setHours(9 + (index % 8), 15, 0, 0);
    return {
      id: crypto.randomUUID(),
      area: row.category.area,
      categoryId: row.category.id,
      categoryName: row.category.name,
      amount: row.amount,
      ...(row.km ? { distanceKm: row.km } : {}),
      ...(row.min ? { durationMin: row.min } : {}),
      createdAt: date.toISOString(),
    };
  });

  createBackup("seed-demo-entries");
  writeKey(ENTRIES_KEY, [...demo, ...existing], entriesSchema);
  emitDataChanged();
  return demo.length;
}

/** Makes the welcome screen and the language guide show up again on next start. */
export function replayOnboarding() {
  if (typeof window === "undefined") return;
  for (const key of [ONBOARDING_KEY, LANG_GUIDE_KEY]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
