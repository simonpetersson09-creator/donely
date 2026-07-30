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
  { id: "p-bocker", name: "Lästa böcker", area: "privat" },
  { id: "p-traning", name: "Träningspass", area: "privat" },
  { id: "p-armhavningar", name: "Armhävningar", area: "privat" },
  { id: "j-samtal", name: "Nya samtal", area: "jobb" },
  { id: "j-moten", name: "Möten", area: "jobb" },
  { id: "j-avtal", name: "Avtal", area: "jobb" },
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
    setCategories(read<Category[]>(CATS_KEY, DEFAULT_CATEGORIES));
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

  return { categories, addCategory, hydrated };
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

  return { entries, addEntry };
}
