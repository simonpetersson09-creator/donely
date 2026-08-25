import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CATEGORIES,
  MAX_BACKUPS,
  SCHEMA_VERSION,
  STORAGE_KEYS,
  categoriesSchema,
  createBackup,
  currentSnapshot,
  entriesSchema,
  exportData,
  getIntegrityStatus,
  importData,
  initializeStorage,
  latestValidBackup,
  readBackups,
  readKey,
  recoverPendingWrites,
  resetInitializationForTests,
  restoreSnapshot,
  runMigrations,
  writeKey,
  writeTransaction,
  type Entry,
  type Snapshot,
} from "@/lib/persistence";

// --- minimal localStorage for the node test environment ------------------
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

const storage = new MemoryStorage();
vi.stubGlobal("window", { localStorage: storage } as unknown as Window);

const entry = (id: string, categoryId = "p-traning"): Entry => ({
  id,
  area: "privat",
  categoryId,
  categoryName: "Träningspass",
  amount: 1,
  createdAt: new Date("2026-07-31T10:00:00Z").toISOString(),
});

function seedRealData() {
  writeKey(STORAGE_KEYS.categories, DEFAULT_CATEGORIES, categoriesSchema);
  writeKey(STORAGE_KEYS.entries, [entry("e1"), entry("e2")], entriesSchema);
  storage.setItem(STORAGE_KEYS.schemaVersion, String(SCHEMA_VERSION));
}

beforeEach(() => {
  storage.clear();
  resetInitializationForTests();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("first run and no automatic reset", () => {
  it("seeds defaults only when storage is completely empty", () => {
    const status = initializeStorage();
    expect(status.state).toBe("first-run");
    expect(readKey(STORAGE_KEYS.categories, categoriesSchema)).toEqual({
      status: "ok",
      value: DEFAULT_CATEGORIES,
    });
  });

  it("never re-seeds defaults over an existing (even empty) category list", () => {
    writeKey(STORAGE_KEYS.categories, [], categoriesSchema);
    initializeStorage();
    expect(readKey(STORAGE_KEYS.categories, categoriesSchema)).toEqual({ status: "ok", value: [] });
  });

  it("app reopened after a reinstall over existing app data keeps the data", () => {
    seedRealData();
    resetInitializationForTests();
    initializeStorage();
    const entries = readKey(STORAGE_KEYS.entries, entriesSchema);
    expect(entries.status === "ok" && entries.value).toHaveLength(2);
  });

  it("a failed read does not wipe anything", () => {
    seedRealData();
    const before = storage.getItem(STORAGE_KEYS.entries);
    const spy = vi.spyOn(storage, "getItem").mockImplementationOnce(() => {
      throw new Error("boom");
    });
    readKey(STORAGE_KEYS.entries, entriesSchema);
    spy.mockRestore();
    expect(storage.getItem(STORAGE_KEYS.entries)).toBe(before);
  });
});

describe("atomic writes", () => {
  it("refuses to persist invalid data", () => {
    seedRealData();
    const before = storage.getItem(STORAGE_KEYS.entries);
    // @ts-expect-error deliberately invalid
    expect(writeKey(STORAGE_KEYS.entries, [{ id: 1 }], entriesSchema)).toBe(false);
    expect(storage.getItem(STORAGE_KEYS.entries)).toBe(before);
  });

  it("restores the previous value when the write throws (app killed / quota)", () => {
    seedRealData();
    const before = storage.getItem(STORAGE_KEYS.entries);
    const spy = vi.spyOn(storage, "setItem").mockImplementation((key: string) => {
      if (key === STORAGE_KEYS.entries) throw new Error("QuotaExceeded");
    });
    expect(writeKey(STORAGE_KEYS.entries, [entry("e3")], entriesSchema)).toBe(false);
    spy.mockRestore();
    expect(storage.getItem(STORAGE_KEYS.entries)).toBe(before);
  });

  it("rolls the whole transaction back when one key fails", () => {
    seedRealData();
    const beforeCats = storage.getItem(STORAGE_KEYS.categories);
    const spy = vi.spyOn(storage, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === STORAGE_KEYS.entries) throw new Error("fail");
      MemoryStorage.prototype.setItem.call(storage, key, value);
    });
    const ok = writeTransaction([
      { key: STORAGE_KEYS.categories, value: [], schema: categoriesSchema as never },
      { key: STORAGE_KEYS.entries, value: [entry("e9")], schema: entriesSchema as never },
    ]);
    spy.mockRestore();
    expect(ok).toBe(false);
    expect(storage.getItem(STORAGE_KEYS.categories)).toBe(beforeCats);
  });

  it("recovers a write interrupted by the app being killed", () => {
    seedRealData();
    const pending = JSON.stringify([entry("e1"), entry("e2"), entry("e3")]);
    storage.setItem(STORAGE_KEYS.entries + STORAGE_KEYS.journalSuffix, pending);
    recoverPendingWrites();
    const entries = readKey(STORAGE_KEYS.entries, entriesSchema);
    expect(entries.status === "ok" && entries.value).toHaveLength(3);
    expect(storage.getItem(STORAGE_KEYS.entries + STORAGE_KEYS.journalSuffix)).toBeNull();
  });

  it("discards an invalid journal instead of applying it", () => {
    seedRealData();
    const before = storage.getItem(STORAGE_KEYS.entries);
    storage.setItem(STORAGE_KEYS.entries + STORAGE_KEYS.journalSuffix, "{not json");
    recoverPendingWrites();
    expect(storage.getItem(STORAGE_KEYS.entries)).toBe(before);
  });
});

describe("backups", () => {
  it("snapshot contains data, settings, schemaVersion and timestamp — never premium", () => {
    seedRealData();
    storage.setItem("vr.premium.v1", "1");
    const snapshot = currentSnapshot();
    expect(Object.keys(snapshot).sort()).toEqual([
      "categories",
      "entries",
      "goals",
      "schemaVersion",
      "settings",
      "timestamp",
      "yearlyGoals",
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("premium");
  });

  it("keeps the three most recent backups", () => {
    seedRealData();
    for (let i = 0; i < 5; i += 1) createBackup(`test-${i}`);
    expect(readBackups()).toHaveLength(MAX_BACKUPS);
  });
});

describe("startup validation and recovery", () => {
  it("restores the latest valid backup when the main database is corrupt", () => {
    seedRealData();
    createBackup("before-corruption");
    storage.setItem(STORAGE_KEYS.entries, "{{{ corrupt");
    resetInitializationForTests();
    const status = initializeStorage();
    expect(status.state).toBe("restored");
    const entries = readKey(STORAGE_KEYS.entries, entriesSchema);
    expect(entries.status === "ok" && entries.value).toHaveLength(2);
  });

  it("keeps corrupt bytes and reports an error when there is no backup", () => {
    seedRealData();
    storage.setItem(STORAGE_KEYS.entries, "{{{ corrupt");
    resetInitializationForTests();
    const status = initializeStorage();
    expect(status.state).toBe("corrupt");
    expect(storage.getItem(STORAGE_KEYS.entries)).toBe("{{{ corrupt");
    expect(getIntegrityStatus().state).toBe("corrupt");
  });

  it("partially corrupt data leaves the healthy keys alone", () => {
    seedRealData();
    storage.setItem(STORAGE_KEYS.goals, "nope");
    resetInitializationForTests();
    initializeStorage();
    const cats = readKey(STORAGE_KEYS.categories, categoriesSchema);
    expect(cats.status === "ok" && cats.value).toHaveLength(DEFAULT_CATEGORIES.length);
  });
});

describe("schema version and migrations", () => {
  it("stamps the current version on first run and does not re-run", () => {
    initializeStorage();
    expect(runMigrations()).toEqual({ status: "none" });
    expect(runMigrations()).toEqual({ status: "none" });
  });

  it("restores the pre-migration data when a migration fails", async () => {
    seedRealData();
    const persistence = await import("@/lib/persistence");
    storage.setItem(STORAGE_KEYS.schemaVersion, "1");
    persistence.MIGRATIONS.push({
      to: 2,
      description: "failing test migration",
      run: () => {
        throw new Error("migration exploded");
      },
    });
    const outcome = runMigrations();
    persistence.MIGRATIONS.pop();
    expect(outcome.status).toBe("failed");
    const entries = readKey(STORAGE_KEYS.entries, entriesSchema);
    expect(entries.status === "ok" && entries.value).toHaveLength(2);
    expect(storage.getItem(STORAGE_KEYS.schemaVersion)).toBe("1");
  });

  it("a successful migration preserves every id", async () => {
    seedRealData();
    const persistence = await import("@/lib/persistence");
    storage.setItem(STORAGE_KEYS.schemaVersion, "1");
    persistence.MIGRATIONS.push({
      to: 2,
      description: "no-op",
      run: (s: Snapshot) => ({ ...s, entries: s.entries.map((e) => ({ ...e })) }),
    });
    const outcome = runMigrations();
    persistence.MIGRATIONS.pop();
    expect(outcome.status).toBe("migrated");
    const entries = readKey(STORAGE_KEYS.entries, entriesSchema);
    expect(entries.status === "ok" && entries.value.map((e) => e.id)).toEqual(["e1", "e2"]);
  });
});

describe("import protection", () => {
  it("rejects an invalid file without touching the current data", () => {
    seedRealData();
    const before = storage.getItem(STORAGE_KEYS.entries);
    expect(importData("{ not json").status).toBe("invalid");
    expect(importData(JSON.stringify({ entries: "nope" })).status).toBe("invalid");
    expect(storage.getItem(STORAGE_KEYS.entries)).toBe(before);
  });

  it("rejects entries that reference an unknown category", () => {
    seedRealData();
    const snapshot = currentSnapshot();
    snapshot.entries = [entry("x1", "ghost-category")];
    expect(importData(JSON.stringify(snapshot)).status).toBe("invalid");
  });

  it("backs up, imports and never carries premium over", () => {
    seedRealData();
    const snapshot = currentSnapshot();
    snapshot.entries = [entry("i1")];
    const payload = { ...snapshot, subscribed: true, premium: true };
    const outcome = importData(JSON.stringify(payload));
    expect(outcome.status).toBe("ok");
    expect(latestValidBackup()).not.toBeNull();
    const entries = readKey(STORAGE_KEYS.entries, entriesSchema);
    expect(entries.status === "ok" && entries.value.map((e) => e.id)).toEqual(["i1"]);
    expect(exportData()).not.toContain("premium");
  });
});

describe("data survives unrelated app events", () => {
  it("language change, premium expiry and reminder rescheduling do not touch the data keys", () => {
    seedRealData();
    const before = storage.getItem(STORAGE_KEYS.entries);

    storage.setItem("vr.lang.v1", "en"); // language switch
    storage.removeItem("vr.premium.v1"); // premium lost / expired
    storage.setItem("vr.trial.v1", "0"); // trial expired
    storage.setItem("vr.reminder.enabled.v1", "true"); // reminder rescheduled

    resetInitializationForTests();
    initializeStorage(); // returning from background / relaunch
    expect(storage.getItem(STORAGE_KEYS.entries)).toBe(before);
  });

  it("renaming a category keeps ids and entry relations", () => {
    seedRealData();
    const renamed = DEFAULT_CATEGORIES.map((c) =>
      c.id === "p-traning" ? { ...c, name: "Gym" } : c,
    );
    writeKey(STORAGE_KEYS.categories, renamed, categoriesSchema);
    const entries = readKey(STORAGE_KEYS.entries, entriesSchema);
    expect(
      entries.status === "ok" && entries.value.every((e) => e.categoryId === "p-traning"),
    ).toBe(true);
    const cats = readKey(STORAGE_KEYS.categories, categoriesSchema);
    expect(cats.status === "ok" && cats.value.find((c) => c.id === "p-traning")?.name).toBe("Gym");
  });

  it("editing or deleting an activity only changes that activity", () => {
    seedRealData();
    const current = readKey(STORAGE_KEYS.entries, entriesSchema);
    const list = current.status === "ok" ? current.value : [];
    writeKey(
      STORAGE_KEYS.entries,
      list.filter((e) => e.id !== "e1"),
      entriesSchema,
    );
    const after = readKey(STORAGE_KEYS.entries, entriesSchema);
    expect(after.status === "ok" && after.value.map((e) => e.id)).toEqual(["e2"]);
  });

  it("a restore puts every field back", () => {
    seedRealData();
    const snapshot = currentSnapshot();
    storage.setItem(STORAGE_KEYS.entries, JSON.stringify([]));
    expect(restoreSnapshot(snapshot)).toBe(true);
    const entries = readKey(STORAGE_KEYS.entries, entriesSchema);
    expect(entries.status === "ok" && entries.value).toHaveLength(2);
  });
});
