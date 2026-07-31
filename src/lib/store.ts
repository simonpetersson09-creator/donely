import { useCallback, useEffect, useState } from "react";

export type Area = "jobb" | "privat";

export type Category = {
  id: string;
  name: string;
  area: Area;
};

export type Entry = {
  id: string;
  area: Area;
  categoryId: string;
  categoryName: string;
  amount: number;
  createdAt: string;
};

const CATS_KEY = "vr.categories.v1";
const ENTRIES_KEY = "vr.entries.v1";

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "p-traning", name: "Träningspass", area: "privat" },
  { id: "p-promenad", name: "Promenad", area: "privat" },
  { id: "p-meditation", name: "Meditation", area: "privat" },
  { id: "p-bocker", name: "Lästa böcker", area: "privat" },
  { id: "j-moten", name: "Möten", area: "jobb" },
  { id: "j-avtal", name: "Avtal", area: "jobb" },
  { id: "j-samtal", name: "Nya samtal", area: "jobb" },
  { id: "j-admin", name: "Admin-uppgifter", area: "jobb" },
];

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Seed the default categories once, on the very first app start. After that the
    // stored list is authoritative, so removed defaults never come back.
    const stored = read<Category[] | null>(CATS_KEY, null);
    if (stored === null) {
      write(CATS_KEY, DEFAULT_CATEGORIES);
      setCategories(DEFAULT_CATEGORIES);
    } else {
      setCategories(stored);
    }
    setHydrated(true);
  }, []);

  const addCategory = useCallback((name: string, area: Area) => {
    const category: Category = {
      id: `${area}-${Date.now().toString(36)}`,
      name: name.trim(),
      area,
    };
    setCategories((prev) => {
      const next = [...prev, category];
      write(CATS_KEY, next);
      return next;
    });
    return category;
  }, []);

  const renameCategory = useCallback((id: string, name: string) => {
    setCategories((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, name: name.trim() } : c));
      write(CATS_KEY, next);
      return next;
    });
  }, []);

  const removeCategory = useCallback((id: string) => {
    setCategories((prev) => {
      const next = prev.filter((c) => c.id !== id);
      write(CATS_KEY, next);
      return next;
    });
  }, []);

  return { categories, addCategory, renameCategory, removeCategory, hydrated };
}


export function useEntries() {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    setEntries(read<Entry[]>(ENTRIES_KEY, []));
  }, []);

  const addEntry = useCallback((entry: Omit<Entry, "id" | "createdAt">) => {
    setEntries((prev) => {
      const next = [
        { ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
        ...prev,
      ];
      write(ENTRIES_KEY, next);
      return next;
    });
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      write(ENTRIES_KEY, next);
      return next;
    });
  }, []);

  const removeEntriesByCategory = useCallback((categoryId: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.categoryId !== categoryId);
      write(ENTRIES_KEY, next);
      return next;
    });
  }, []);

  return { entries, addEntry, removeEntry, removeEntriesByCategory };
}

const GOALS_KEY = "vr.goals.v1";

/** key: `${year}:${categoryId}` -> yearly target */
export type Goals = Record<string, number>;

export function goalKey(year: number, categoryId: string) {
  return `${year}:${categoryId}`;
}

export function useGoals() {
  const [goals, setGoals] = useState<Goals>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setGoals(read<Goals>(GOALS_KEY, {}));
    setHydrated(true);
  }, []);

  const setGoal = useCallback((year: number, categoryId: string, target: number) => {
    setGoals((prev) => {
      const next = { ...prev, [goalKey(year, categoryId)]: target };
      write(GOALS_KEY, next);
      return next;
    });
  }, []);

  const removeGoal = useCallback((year: number, categoryId: string) => {
    setGoals((prev) => {
      const next = { ...prev };
      delete next[goalKey(year, categoryId)];
      write(GOALS_KEY, next);
      return next;
    });
  }, []);

  const removeGoalsByCategory = useCallback((categoryId: string) => {
    setGoals((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.endsWith(`:${categoryId}`)) delete next[key];
      }
      write(GOALS_KEY, next);
      return next;
    });
  }, []);

  return { goals, setGoal, removeGoal, removeGoalsByCategory, hydrated };
}

const ONBOARDING_KEY = "vr.onboarding.v1";

export function useOnboarding() {
  const [seen, setSeen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = read<boolean>(ONBOARDING_KEY, false);
    setSeen(stored);
    setHydrated(true);
  }, []);

  const markSeen = useCallback(() => {
    write(ONBOARDING_KEY, true);
    setSeen(true);
  }, []);

  return { seen, markSeen, hydrated };
}

const LANG_GUIDE_KEY = "vr.langGuide.v1";

export function useLanguageGuide() {
  const [seen, setSeen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = read<boolean>(LANG_GUIDE_KEY, false);
    setSeen(stored);
    setHydrated(true);
  }, []);

  const markSeen = useCallback(() => {
    write(LANG_GUIDE_KEY, true);
    setSeen(true);
  }, []);

  return { seen, markSeen, hydrated };
}

const REMINDER_PROMPT_KEY = "vr.reminderPrompt.v1";

/**
 * Tracks whether Donely's own explanatory notification dialog has been shown.
 * It is shown exactly once, on the first run after the welcome screen, and the
 * choice ("Enable reminder" / "Not now") is stored locally.
 */
export function useReminderPrompt() {
  const [answered, setAnswered] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAnswered(read<boolean>(REMINDER_PROMPT_KEY, false));
    setHydrated(true);
  }, []);

  const markAnswered = useCallback(() => {
    write(REMINDER_PROMPT_KEY, true);
    setAnswered(true);
  }, []);

  return { answered, markAnswered, hydrated };
}

/** Clears every locally stored entry, category and goal. Language stays untouched. */
export function clearAllData() {
  if (typeof window === "undefined") return;
  for (const key of [CATS_KEY, ENTRIES_KEY, GOALS_KEY, ONBOARDING_KEY, LANG_GUIDE_KEY]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
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
