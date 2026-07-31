import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
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
  writeKey,
  type Category,
  type Entry,
  type Goals,
} from "@/lib/persistence";

export type Area = "jobb" | "privat";
export type { Category, Entry, Goals };
export { DEFAULT_CATEGORIES };

const CATS_KEY = STORAGE_KEYS.categories;
const ENTRIES_KEY = STORAGE_KEYS.entries;
const GOALS_KEY = STORAGE_KEYS.goals;
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

/** Exposes the startup integrity result (corrupt data / restored from backup). */
export function useDataIntegrity() {
  return useSyncExternalStore(
    subscribeIntegrity,
    getIntegrityStatus,
    () => ({ state: "ok" }) as ReturnType<typeof getIntegrityStatus>,
  );
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    ready();
    // The stored list is always authoritative. Defaults are seeded once by
    // initializeStorage() on a truly empty install — never here.
    const stored = readKey(CATS_KEY, categoriesSchema);
    if (stored.status === "ok") setCategories(stored.value);
    else if (stored.status === "missing") setCategories(readFlagSeeded());
    // "corrupt" → keep whatever is on screen, do not write anything.
    setHydrated(true);
  }, []);

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
      setCategories((prev) => commit(prev.map((c) => (c.id === id ? { ...c, name: name.trim() } : c))));
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

  return { categories, addCategory, renameCategory, removeCategory, hydrated };
}

function readFlagSeeded(): Category[] {
  const stored = readKey(CATS_KEY, categoriesSchema);
  return stored.status === "ok" ? stored.value : DEFAULT_CATEGORIES;
}

export function useEntries() {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    ready();
    const stored = readKey(ENTRIES_KEY, entriesSchema);
    if (stored.status === "ok") setEntries(stored.value);
    // missing → empty list (nothing written), corrupt → left untouched.
  }, []);

  const commit = useCallback((next: Entry[]) => {
    writeKey(ENTRIES_KEY, next, entriesSchema);
    emitDataChanged();
    return next;
  }, []);

  const addEntry = useCallback(
    (entry: Omit<Entry, "id" | "createdAt">) => {
      setEntries((prev) =>
        commit([{ ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...prev]),
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

  return { entries, addEntry, removeEntry, removeEntriesByCategory };
}

/** key: `${year}:${categoryId}` -> yearly target */
export function goalKey(year: number, categoryId: string) {
  return `${year}:${categoryId}`;
}

export function useGoals() {
  const [goals, setGoals] = useState<Goals>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    ready();
    const stored = readKey(GOALS_KEY, goalsSchema);
    if (stored.status === "ok") setGoals(stored.value);
    setHydrated(true);
  }, []);

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
  for (const key of [CATS_KEY, ENTRIES_KEY, GOALS_KEY, ONBOARDING_KEY, LANG_GUIDE_KEY]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  emitDataChanged();
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
