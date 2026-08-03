import { z } from "zod";

/**
 * Donely local persistence layer.
 *
 * Everything the user creates (activities, categories, goals, settings) lives in
 * the browser/WKWebView `localStorage` of the app. This module is the single
 * writer: it validates, writes atomically, versions the schema, migrates safely
 * and keeps rolling backups so that data can never be silently reset.
 *
 * Hard rules implemented here:
 *  - defaults are only ever seeded when there is NO previous data at all
 *  - a failed read/parse never causes a reset — the bytes are left untouched
 *  - every write is validated first and verified by reading it back
 *  - migrations are versioned, run once, back up first and roll back on failure
 *  - premium/entitlement state is never part of a backup or an import
 */

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

export const STORAGE_KEYS = {
  categories: "vr.categories.v1",
  entries: "vr.entries.v1",
  goals: "vr.goals.v1",
  onboarding: "vr.onboarding.v1",
  langGuide: "vr.langGuide.v1",
  reminderPrompt: "vr.reminderPrompt.v1",
  language: "vr.lang.v1",
  schemaVersion: "vr.schemaVersion.v1",
  backups: "vr.backups.v1",
  /** Suffix used for the write-ahead journal of an in-flight write. */
  journalSuffix: ".writing",
} as const;

/** Data keys that make up the user database (settings flags included). */
const DATA_KEYS = [
  STORAGE_KEYS.categories,
  STORAGE_KEYS.entries,
  STORAGE_KEYS.goals,
  STORAGE_KEYS.onboarding,
  STORAGE_KEYS.langGuide,
  STORAGE_KEYS.reminderPrompt,
] as const;

export const SCHEMA_VERSION = 1;
export const MAX_BACKUPS = 3;

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const areaSchema = z.enum(["jobb", "privat"]);

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  area: areaSchema,
});

export const entrySchema = z.object({
  id: z.string().min(1),
  area: areaSchema,
  categoryId: z.string().min(1),
  categoryName: z.string(),
  amount: z.number().finite(),
  // Optional workout metrics. Only written for activity-style categories, so
  // every existing entry stays valid without migration.
  distanceKm: z.number().finite().positive().optional(),
  durationMin: z.number().finite().positive().optional(),
  createdAt: z.string().min(1),
});

export const categoriesSchema = z.array(categorySchema);
export const entriesSchema = z.array(entrySchema);
export const goalsSchema = z.record(z.string(), z.number().finite());
export const flagSchema = z.boolean();

export type Category = z.infer<typeof categorySchema>;
export type Entry = z.infer<typeof entrySchema>;
export type Goals = z.infer<typeof goalsSchema>;

export type Snapshot = {
  schemaVersion: number;
  timestamp: string;
  entries: Entry[];
  categories: Category[];
  goals: Goals;
  settings: {
    onboarding: boolean;
    langGuide: boolean;
    reminderPrompt: boolean;
    language: string | null;
  };
};

export const snapshotSchema = z.object({
  schemaVersion: z.number().int().nonnegative(),
  timestamp: z.string().min(1),
  entries: entriesSchema,
  categories: categoriesSchema,
  goals: goalsSchema,
  settings: z.object({
    onboarding: z.boolean(),
    langGuide: z.boolean(),
    reminderPrompt: z.boolean(),
    language: z.string().nullable(),
  }),
});

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "p-traning", name: "Träningspass", area: "privat" },
  { id: "p-lopning", name: "Löpning", area: "privat" },
  { id: "p-promenad", name: "Promenad", area: "privat" },
  { id: "p-meditation", name: "Meditation", area: "privat" },
  { id: "p-bocker", name: "Lästa böcker", area: "privat" },
  { id: "j-moten", name: "Möten", area: "jobb" },
  { id: "j-avtal", name: "Avtal", area: "jobb" },
  { id: "j-samtal", name: "Nya samtal", area: "jobb" },
  { id: "j-admin", name: "Admin-uppgifter", area: "jobb" },
];

/** The default running category and the flag guarding its one-time backfill. */
const RUNNING_CATEGORY: Category = { id: "p-lopning", name: "Löpning", area: "privat" };
const BACKFILL_RUNNING_KEY = "vr.backfill.lopning.v1";


// ---------------------------------------------------------------------------
// Low level storage access
// ---------------------------------------------------------------------------

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function log(message: string, detail?: unknown) {
  // Errors are logged, never "fixed" by wiping data.
  console.warn(`[donely/persistence] ${message}`, detail ?? "");
}

export type ReadResult<T> =
  { status: "ok"; value: T } | { status: "missing" } | { status: "corrupt"; raw: string };

/** Reads and validates a single key. Never throws, never writes. */
export function readKey<T>(key: string, schema: z.ZodType<T>): ReadResult<T> {
  const store = storage();
  if (!store) return { status: "missing" };
  let raw: string | null = null;
  try {
    raw = store.getItem(key);
  } catch (error) {
    log(`could not read ${key}`, error);
    return { status: "missing" };
  }
  if (raw === null) return { status: "missing" };
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    if (parsed.success) return { status: "ok", value: parsed.data };
    log(`invalid data in ${key}`, parsed.error.issues);
    return { status: "corrupt", raw };
  } catch (error) {
    log(`unparsable data in ${key}`, error);
    return { status: "corrupt", raw };
  }
}

/**
 * Atomic, validated write.
 *
 * 1. validate the value — invalid data never reaches storage
 * 2. write it to a journal key first
 * 3. write the real key
 * 4. read it back and compare; on mismatch restore the previous bytes
 * 5. drop the journal
 *
 * If the app is killed between 2 and 5 the journal is still there and
 * `recoverPendingWrites()` completes or discards it on next start.
 */
export function writeKey<T>(key: string, value: T, schema: z.ZodType<T>): boolean {
  const store = storage();
  if (!store) return false;

  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    log(`refused to write invalid value to ${key}`, parsed.error.issues);
    return false;
  }

  const journal = key + STORAGE_KEYS.journalSuffix;
  let previous: string | null = null;
  try {
    previous = store.getItem(key);
    const serialized = JSON.stringify(parsed.data);
    store.setItem(journal, serialized);
    store.setItem(key, serialized);
    if (store.getItem(key) !== serialized) throw new Error("read-back mismatch");
    store.removeItem(journal);
    return true;
  } catch (error) {
    log(`write to ${key} failed — restoring previous value`, error);
    try {
      if (previous === null) store.removeItem(key);
      else store.setItem(key, previous);
      store.removeItem(journal);
    } catch (restoreError) {
      log(`restore of ${key} failed`, restoreError);
    }
    return false;
  }
}

/**
 * Commits several keys as one unit. Either all of them land or none of them do,
 * so a half-updated database cannot happen.
 */
export function writeTransaction(
  entries: Array<{ key: string; value: unknown; schema: z.ZodType<unknown> }>,
): boolean {
  const store = storage();
  if (!store) return false;

  for (const { key, value, schema } of entries) {
    if (!schema.safeParse(value).success) {
      log(`transaction aborted before writing — invalid value for ${key}`);
      return false;
    }
  }

  const previous = new Map<string, string | null>();
  for (const { key } of entries) previous.set(key, store.getItem(key));

  try {
    for (const { key, value, schema } of entries) {
      if (!writeKey(key, value, schema)) throw new Error(`write failed for ${key}`);
    }
    return true;
  } catch (error) {
    log("transaction failed — rolling back", error);
    for (const [key, value] of previous) {
      try {
        if (value === null) store.removeItem(key);
        else store.setItem(key, value);
      } catch (restoreError) {
        log(`rollback of ${key} failed`, restoreError);
      }
    }
    return false;
  }
}

/** Completes or discards a write that was interrupted by the app being killed. */
export function recoverPendingWrites(): void {
  const store = storage();
  if (!store) return;
  for (const key of DATA_KEYS) {
    const journal = key + STORAGE_KEYS.journalSuffix;
    let pending: string | null = null;
    try {
      pending = store.getItem(journal);
    } catch {
      continue;
    }
    if (pending === null) continue;
    try {
      const current = store.getItem(key);
      // The journal is only used when the main key never received the value.
      if (current !== pending) {
        const valid = validateRaw(key, pending);
        if (valid) {
          store.setItem(key, pending);
          log(`recovered interrupted write for ${key}`);
        } else {
          log(`discarded invalid journal for ${key}`);
        }
      }
      store.removeItem(journal);
    } catch (error) {
      log(`could not recover journal for ${key}`, error);
    }
  }
}

function schemaFor(key: string): z.ZodType<unknown> {
  switch (key) {
    case STORAGE_KEYS.categories:
      return categoriesSchema as unknown as z.ZodType<unknown>;
    case STORAGE_KEYS.entries:
      return entriesSchema as unknown as z.ZodType<unknown>;
    case STORAGE_KEYS.goals:
      return goalsSchema as unknown as z.ZodType<unknown>;
    default:
      return flagSchema as unknown as z.ZodType<unknown>;
  }
}

function validateRaw(key: string, raw: string): boolean {
  try {
    return schemaFor(key).safeParse(JSON.parse(raw)).success;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Snapshots and backups
// ---------------------------------------------------------------------------

/** Builds a snapshot of whatever is currently valid in storage. Never premium. */
export function currentSnapshot(): Snapshot {
  const categories = readKey(STORAGE_KEYS.categories, categoriesSchema);
  const entries = readKey(STORAGE_KEYS.entries, entriesSchema);
  const goals = readKey(STORAGE_KEYS.goals, goalsSchema);
  const store = storage();
  let language: string | null = null;
  try {
    language = store?.getItem(STORAGE_KEYS.language) ?? null;
  } catch {
    language = null;
  }
  return {
    schemaVersion: readSchemaVersion() ?? SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    categories: categories.status === "ok" ? categories.value : [],
    entries: entries.status === "ok" ? entries.value : [],
    goals: goals.status === "ok" ? goals.value : {},
    settings: {
      onboarding: readFlag(STORAGE_KEYS.onboarding),
      langGuide: readFlag(STORAGE_KEYS.langGuide),
      reminderPrompt: readFlag(STORAGE_KEYS.reminderPrompt),
      language,
    },
  };
}

export function readFlag(key: string): boolean {
  const result = readKey(key, flagSchema);
  return result.status === "ok" ? result.value : false;
}

export function readBackups(): Snapshot[] {
  const result = readKey(STORAGE_KEYS.backups, z.array(snapshotSchema));
  return result.status === "ok" ? result.value : [];
}

/**
 * Stores a backup before a risky operation. Keeps the newest `MAX_BACKUPS`
 * valid snapshots. A backup is skipped when there is nothing to protect.
 */
export function createBackup(reason: string): Snapshot | null {
  const snapshot = currentSnapshot();
  if (snapshot.entries.length === 0 && snapshot.categories.length === 0) return null;
  const next = [snapshot, ...readBackups()].slice(0, MAX_BACKUPS);
  const ok = writeKey(STORAGE_KEYS.backups, next, z.array(snapshotSchema));
  if (!ok) log(`could not store backup (${reason})`);
  return ok ? snapshot : null;
}

/** Writes a snapshot back into the live keys as one transaction. */
export function restoreSnapshot(snapshot: Snapshot): boolean {
  const parsed = snapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    log("refused to restore an invalid snapshot", parsed.error.issues);
    return false;
  }
  const s = parsed.data;
  return writeTransaction([
    {
      key: STORAGE_KEYS.categories,
      value: s.categories,
      schema: categoriesSchema as unknown as z.ZodType<unknown>,
    },
    {
      key: STORAGE_KEYS.entries,
      value: s.entries,
      schema: entriesSchema as unknown as z.ZodType<unknown>,
    },
    {
      key: STORAGE_KEYS.goals,
      value: s.goals,
      schema: goalsSchema as unknown as z.ZodType<unknown>,
    },
    {
      key: STORAGE_KEYS.onboarding,
      value: s.settings.onboarding,
      schema: flagSchema as unknown as z.ZodType<unknown>,
    },
    {
      key: STORAGE_KEYS.langGuide,
      value: s.settings.langGuide,
      schema: flagSchema as unknown as z.ZodType<unknown>,
    },
    {
      key: STORAGE_KEYS.reminderPrompt,
      value: s.settings.reminderPrompt,
      schema: flagSchema as unknown as z.ZodType<unknown>,
    },
  ]);
}

/** Newest backup that parses. */
export function latestValidBackup(): Snapshot | null {
  for (const candidate of readBackups()) {
    if (snapshotSchema.safeParse(candidate).success) return candidate;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Schema version and migrations
// ---------------------------------------------------------------------------

export function readSchemaVersion(): number | null {
  const result = readKey(STORAGE_KEYS.schemaVersion, z.number().int().nonnegative());
  return result.status === "ok" ? result.value : null;
}

function writeSchemaVersion(version: number) {
  writeKey(STORAGE_KEYS.schemaVersion, version, z.number().int().nonnegative());
}

export type Migration = {
  /** Schema version this migration produces. */
  to: number;
  description: string;
  /** Pure transform: receives a snapshot, returns the migrated snapshot. */
  run: (snapshot: Snapshot) => Snapshot;
};

/**
 * Versioned migrations. They must never delete user data — only add, rename or
 * reshape fields. Ids are always preserved.
 */
export const MIGRATIONS: Migration[] = [
  // Example of the required shape (kept empty on purpose for v1):
  // { to: 2, description: "add note field", run: (s) => ({ ...s, entries: s.entries.map(e => ({ ...e })) }) },
];

export type MigrationOutcome =
  | { status: "none" }
  | { status: "migrated"; from: number; to: number }
  | { status: "failed"; from: number; error: string; restored: boolean };

/**
 * Runs pending migrations exactly once, in order.
 * A backup is taken first; if anything throws or the result does not validate,
 * the backup is restored and the stored schema version is left unchanged.
 */
export function runMigrations(): MigrationOutcome {
  const stored = readSchemaVersion();
  const from = stored ?? SCHEMA_VERSION;
  const pending = MIGRATIONS.filter((m) => m.to > from).sort((a, b) => a.to - b.to);

  if (stored === null) {
    writeSchemaVersion(SCHEMA_VERSION);
  }
  if (pending.length === 0) {
    if (stored !== null && stored < SCHEMA_VERSION) writeSchemaVersion(SCHEMA_VERSION);
    return { status: "none" };
  }

  const backup = createBackup("migration");
  let snapshot = currentSnapshot();
  try {
    for (const migration of pending) {
      snapshot = migration.run(snapshot);
      const parsed = snapshotSchema.safeParse(snapshot);
      if (!parsed.success) throw new Error(`migration ${migration.to} produced invalid data`);
      snapshot = parsed.data;
    }
    if (!restoreSnapshot(snapshot)) throw new Error("could not commit migrated data");
    writeSchemaVersion(pending[pending.length - 1].to);
    return { status: "migrated", from, to: pending[pending.length - 1].to };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("migration failed — restoring pre-migration data", message);
    const restored = backup ? restoreSnapshot(backup) : true;
    return { status: "failed", from, error: message, restored };
  }
}

// ---------------------------------------------------------------------------
// Startup: validation, recovery, first-run seeding
// ---------------------------------------------------------------------------

export type IntegrityStatus =
  | { state: "ok" }
  | { state: "first-run" }
  | { state: "restored"; from: string }
  | { state: "corrupt"; keys: string[] };

let integrity: IntegrityStatus = { state: "ok" };
let initialized = false;
const listeners = new Set<() => void>();

export function getIntegrityStatus(): IntegrityStatus {
  return integrity;
}

export function subscribeIntegrity(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setIntegrity(next: IntegrityStatus) {
  integrity = next;
  for (const listener of listeners) listener();
}

/**
 * Runs once per app start, before any UI reads storage.
 * Never overwrites existing bytes with defaults.
 */
export function initializeStorage(): IntegrityStatus {
  if (initialized) return integrity;
  initialized = true;
  const store = storage();
  if (!store) return integrity;

  recoverPendingWrites();

  const categories = readKey(STORAGE_KEYS.categories, categoriesSchema);
  const entries = readKey(STORAGE_KEYS.entries, entriesSchema);
  const goals = readKey(STORAGE_KEYS.goals, goalsSchema);

  const everythingMissing =
    categories.status === "missing" &&
    entries.status === "missing" &&
    goals.status === "missing" &&
    readSchemaVersion() === null &&
    readBackups().length === 0;

  if (everythingMissing) {
    // True first run (or a fresh install): seed the defaults exactly once.
    writeKey(STORAGE_KEYS.categories, DEFAULT_CATEGORIES, categoriesSchema);
    writeSchemaVersion(SCHEMA_VERSION);
    setIntegrity({ state: "first-run" });
    return integrity;
  }

  const corrupt: string[] = [];
  if (categories.status === "corrupt") corrupt.push(STORAGE_KEYS.categories);
  if (entries.status === "corrupt") corrupt.push(STORAGE_KEYS.entries);
  if (goals.status === "corrupt") corrupt.push(STORAGE_KEYS.goals);

  if (corrupt.length > 0) {
    const backup = latestValidBackup();
    if (backup && restoreSnapshot(backup)) {
      log(`restored ${corrupt.join(", ")} from backup ${backup.timestamp}`);
      setIntegrity({ state: "restored", from: backup.timestamp });
    } else {
      // No valid backup: keep the damaged bytes so they can still be exported
      // or repaired. Absolutely no reset to empty defaults here.
      log(`corrupt data in ${corrupt.join(", ")} and no valid backup — data left untouched`);
      setIntegrity({ state: "corrupt", keys: corrupt });
      return integrity;
    }
  }

  backfillRunningCategory();

  const outcome = runMigrations();
  if (outcome.status === "failed") {
    setIntegrity({ state: "corrupt", keys: [STORAGE_KEYS.schemaVersion] });
  }
  return integrity;
}

/**
 * One-time backfill: existing installs never got the default "Löpning"
 * category. It is inserted right after "Träningspass" (or first among the
 * private categories). Runs at most once, so a user who deletes it keeps it
 * deleted.
 */
function backfillRunningCategory() {
  const store = storage();
  if (!store) return;
  const done = readKey(BACKFILL_RUNNING_KEY, flagSchema);
  if (done.status === "ok" && done.value) return;

  const current = readKey(STORAGE_KEYS.categories, categoriesSchema);
  if (current.status !== "ok") return;

  if (!current.value.some((c) => c.id === RUNNING_CATEGORY.id)) {
    const next = [...current.value];
    const trainingIndex = next.findIndex((c) => c.id === "p-traning");
    const insertAt =
      trainingIndex >= 0 ? trainingIndex + 1 : Math.max(next.findIndex((c) => c.area === "privat"), 0);
    next.splice(insertAt, 0, RUNNING_CATEGORY);
    writeKey(STORAGE_KEYS.categories, next, categoriesSchema);
  }
  writeKey(BACKFILL_RUNNING_KEY, true, flagSchema);
}


/** Test hook: lets the suite re-run initialization on a fresh storage. */
export function resetInitializationForTests() {
  initialized = false;
  integrity = { state: "ok" };
}

// ---------------------------------------------------------------------------
// Export / import
// ---------------------------------------------------------------------------

/** Full, human-readable export of the user's data. Contains no premium state. */
export function exportData(): string {
  return JSON.stringify({ app: "donely", ...currentSnapshot() }, null, 2);
}

export type ImportOutcome =
  | { status: "ok"; entries: number; categories: number }
  | { status: "invalid"; error: string }
  | { status: "failed"; error: string; restored: boolean };

/**
 * Validates the whole file first, backs the current data up, then commits.
 * Any failure rolls the previous data back. Premium fields are dropped.
 */
export function importData(json: string): ImportOutcome {
  let candidate: unknown;
  try {
    candidate = JSON.parse(json);
  } catch (error) {
    return { status: "invalid", error: error instanceof Error ? error.message : "unparsable file" };
  }

  const parsed = snapshotSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      status: "invalid",
      error: parsed.error.issues.map((i) => i.path.join(".")).join(", "),
    };
  }
  const snapshot = parsed.data;

  // Relational sanity: every entry must point at a category in the same file.
  const known = new Set(snapshot.categories.map((c) => c.id));
  const orphan = snapshot.entries.find((e) => !known.has(e.categoryId));
  if (orphan) return { status: "invalid", error: `entry ${orphan.id} references unknown category` };

  const backup = createBackup("import");
  if (!restoreSnapshot(snapshot)) {
    const restored = backup ? restoreSnapshot(backup) : true;
    return { status: "failed", error: "could not commit imported data", restored };
  }
  return { status: "ok", entries: snapshot.entries.length, categories: snapshot.categories.length };
}
