import { useCallback, useEffect, useSyncExternalStore } from "react";
import i18n, { localeOf } from "@/lib/i18n";
import { DATA_CHANGED_EVENT } from "@/lib/store";
import { weeklyNotificationContent } from "@/lib/weekly-summary";

/**
 * Weekly local reminder for Donely — Fridays 17:00 in the *device's* local
 * time zone and calendar.
 *
 * TIME / TIME ZONE CONTRACT
 * -------------------------
 * - The reminder is expressed as calendar components (weekday = Friday,
 *   hour = 17, minute = 0) — never as a fixed UTC instant.
 * - On iOS this maps 1:1 to `UNCalendarNotificationTrigger(dateMatching:
 *   DateComponents(hour: 17, minute: 0, weekday: 6), repeats: true)` using
 *   `Calendar.current` (weekday 6 = Friday in Gregorian, where Sunday = 1).
 *   Because iOS re-evaluates the components against the current calendar and
 *   time zone, the notification keeps firing at 17:00 wall-clock time across
 *   DST transitions and when the user travels to another time zone.
 * - JS never converts the schedule to UTC. All previews of the next fire date
 *   are computed with local `Date` arithmetic, which is DST-correct.
 *
 * DEDUPLICATION
 * -------------
 * Every schedule uses the same stable identifier (`WEEKLY_REMINDER_ID`).
 * `UNUserNotificationCenter.add` replaces a pending request with the same
 * identifier, and we additionally cancel before scheduling, so repeated
 * toggling or language changes can never produce duplicates.
 *
 * NATIVE BRIDGE (Swift side, see APPSTORE.md)
 * -------------------------------------------
 * JS -> Swift (`webkit.messageHandlers`):
 *   requestNotificationStatus      {}
 *   requestNotificationPermission  {}
 *   scheduleWeeklyReminder         {id, weekday, hour, minute, repeats, title, body, language, timeZone}
 *   cancelNotification             {id}
 *   openAppSettings                {}
 *
 * Swift -> JS (globals installed below):
 *   window.__donelySetNotificationPermission("granted" | "denied" | "notDetermined" | "provisional")
 *   window.__donelyNotificationScheduled({id, nextFireDate, language})
 *   window.__donelyNotificationError(message)
 */

// ---------------------------------------------------------------------------
// schedule constants
// ---------------------------------------------------------------------------

/** Stable identifier — used to replace or remove the weekly reminder. */
export const WEEKLY_REMINDER_ID = "donely.reminder.weekly.friday";

/** JS weekday (0 = Sunday … 5 = Friday). iOS uses 1-based, so weekday + 1. */
export const REMINDER_WEEKDAY = 5;
export const REMINDER_HOUR = 17;
export const REMINDER_MINUTE = 0;

const ENABLED_KEY = "vr.reminder.weekly.v1";
const TZ_KEY = "vr.reminder.tz.v1";
/** The user asked for the reminder — used to auto-enable when permission later becomes granted. */
const INTENT_KEY = "vr.reminder.intent.v1";

export type PermissionStatus =
  | "unknown"
  | "notDetermined"
  | "granted"
  | "provisional"
  | "denied"
  | "unsupported";

export type ReminderState = {
  enabled: boolean;
  permission: PermissionStatus;
  /** ISO string of the next planned fire date, as reported by iOS or computed locally. */
  nextFireDate: string | null;
  /** Language the currently scheduled notification text is written in. */
  scheduledLanguage: string | null;
  busy: boolean;
  lastError: string | null;
  /** True when running inside the iOS shell (real scheduling available). */
  native: boolean;
};

// ---------------------------------------------------------------------------
// local time helpers (DST-safe: all arithmetic happens in local wall time)
// ---------------------------------------------------------------------------

/** The device's current IANA time zone, e.g. "Europe/Stockholm". */
export function currentTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Next Friday 17:00 in local wall-clock time. Built from local calendar
 * components, so a DST shift between now and then does not move the hour.
 */
export function nextReminderDate(from: Date = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), REMINDER_HOUR, REMINDER_MINUTE, 0, 0);
  let delta = (REMINDER_WEEKDAY - d.getDay() + 7) % 7;
  if (delta === 0 && d.getTime() <= from.getTime()) delta = 7;
  d.setDate(d.getDate() + delta);
  return d;
}

/** Localized, human-readable next fire date for the settings screen. */
export function formatFireDate(iso: string | null, language: string): string {
  const date = iso ? new Date(iso) : nextReminderDate();
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(localeOf(language), {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Localized "Fridays 17:00" label, using the locale's own weekday and clock format. */
export function reminderScheduleLabel(language: string): string {
  const locale = localeOf(language);
  const sample = nextReminderDate();
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(sample);
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(sample);
  return `${weekday.charAt(0).toLocaleUpperCase(locale)}${weekday.slice(1)} ${time}`;
}

// ---------------------------------------------------------------------------
// store
// ---------------------------------------------------------------------------

const initial: ReminderState = {
  enabled: false,
  permission: "unknown",
  nextFireDate: null,
  scheduledLanguage: null,
  busy: false,
  lastError: null,
  native: false,
};

let state: ReminderState = initial;
const listeners = new Set<() => void>();

function setState(patch: Partial<ReminderState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return initial;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// ---------------------------------------------------------------------------
// native bridge
// ---------------------------------------------------------------------------

type NativeBridge = {
  webkit?: {
    messageHandlers?: Record<string, { postMessage: (v: unknown) => void } | undefined>;
  };
};

function handler(name: string) {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as NativeBridge).webkit?.messageHandlers?.[name];
}

/** True when the iOS shell exposes the notification handlers. */
export function hasNotificationBridge(): boolean {
  return !!handler("scheduleWeeklyReminder");
}

function post(name: string, payload: Record<string, unknown> = {}): boolean {
  const h = handler(name);
  if (!h) return false;
  try {
    h.postMessage(payload);
    return true;
  } catch (err) {
    setState({ lastError: String(err) });
    return false;
  }
}

function parsePayload<T>(value: unknown): T | null {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  if (value && typeof value === "object") return value as T;
  return null;
}

// ---------------------------------------------------------------------------
// notification text
// ---------------------------------------------------------------------------

/**
 * The notification body is a summary of the *current* week, so it is rebuilt
 * from the stored entries every time we schedule. Written in the language the
 * user has selected inside Donely.
 */
function notificationText(language: string) {
  return weeklyNotificationContent(language);
}

/** Route the iOS shell should open when the user taps the reminder. */
export const REMINDER_ROUTE = "/veckostatistik";

// ---------------------------------------------------------------------------
// persistence
// ---------------------------------------------------------------------------

function readEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

function readIntent(): boolean {
  try {
    return localStorage.getItem(INTENT_KEY) === "true";
  } catch {
    return false;
  }
}

function writeIntent(value: boolean) {
  try {
    localStorage.setItem(INTENT_KEY, String(value));
  } catch {
    /* storage unavailable */
  }
}

function writeEnabled(value: boolean) {
  try {
    localStorage.setItem(ENABLED_KEY, String(value));
  } catch {
    /* storage unavailable */
  }
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

/** Serializes schedule calls so a double tap can never create two requests. */
let scheduling: Promise<void> | null = null;

/**
 * Enables and schedules the reminder when the user has previously asked for it
 * and permission has since become granted (e.g. after visiting iOS Settings).
 */
function maybeAutoEnable(permission: PermissionStatus) {
  if (state.enabled) return;
  if (!readIntent()) return;
  if (permission !== "granted" && permission !== "provisional") return;
  writeEnabled(true);
  setState({ enabled: true });
  scheduleWeeklyReminder(i18n.language || "sv");
}

/** Ask iOS for the current authorization status (no prompt). */
export function refreshPermission() {
  if (post("requestNotificationStatus")) return;
  if (typeof window !== "undefined" && "Notification" in window) {
    const p = Notification.permission;
    const permission: PermissionStatus =
      p === "granted" ? "granted" : p === "denied" ? "denied" : "notDetermined";
    setState({ permission });
    maybeAutoEnable(permission);
    return;
  }
  setState({ permission: "unsupported" });
}

/**
 * Requests permission. Only called from an explicit user action (the reminder
 * toggle) — never automatically on first launch.
 */
export async function requestPermission(): Promise<PermissionStatus> {
  setState({ busy: true, lastError: null });
  if (post("requestNotificationPermission")) {
    // Swift answers asynchronously through __donelySetNotificationPermission.
    return "unknown";
  }
  if (typeof window !== "undefined" && "Notification" in window) {
    try {
      const result = await Notification.requestPermission();
      const permission: PermissionStatus =
        result === "granted" ? "granted" : result === "denied" ? "denied" : "notDetermined";
      setState({ permission, busy: false });
      return permission;
    } catch {
      setState({ permission: "denied", busy: false });
      return "denied";
    }
  }
  setState({ permission: "unsupported", busy: false });
  return "unsupported";
}

/** (Re)schedules the weekly reminder with the given language. Idempotent. */
export function scheduleWeeklyReminder(language = i18n.language || "sv"): void {
  const { title, body } = notificationText(language);
  const timeZone = currentTimeZone();
  const next = nextReminderDate();

  // Cancel first, then add with the same stable id — belt and braces against
  // duplicates if the shell does not replace by identifier.
  post("cancelNotification", { id: WEEKLY_REMINDER_ID });
  const sent = post("scheduleWeeklyReminder", {
    id: WEEKLY_REMINDER_ID,
    weekday: REMINDER_WEEKDAY + 1, // iOS DateComponents: Sunday = 1 → Friday = 6
    hour: REMINDER_HOUR,
    minute: REMINDER_MINUTE,
    repeats: true,
    title,
    body,
    language,
    timeZone,
    route: REMINDER_ROUTE,
  });

  setState({
    scheduledLanguage: language,
    nextFireDate: next.toISOString(),
    busy: false,
    lastError: sent ? null : state.lastError,
  });

  try {
    localStorage.setItem(TZ_KEY, timeZone);
  } catch {
    /* ignore */
  }

  logReminderDiagnostics(sent ? "scheduled (native)" : "scheduled (web preview — simulated)");
}

/** Turns the reminder on. Asks for permission first if needed. */
export async function enableWeeklyReminder(language = i18n.language || "sv"): Promise<PermissionStatus> {
  writeIntent(true);
  let permission = state.permission;
  if (permission === "unknown" || permission === "notDetermined") {
    permission = await requestPermission();
    if (permission === "unknown") {
      // Native prompt in flight — the permission callback finishes the job.
      pendingEnable = { language: language };
      return permission;
    }
  }
  if (permission === "denied" || permission === "unsupported") {
    setState({ busy: false });
    return permission;
  }
  writeEnabled(true);
  setState({ enabled: true });
  await (scheduling = Promise.resolve().then(() => scheduleWeeklyReminder(language)));
  scheduling = null;
  return permission;
}

/** Turns the reminder off and removes the pending request. */
export function disableWeeklyReminder(): void {
  writeIntent(false);
  writeEnabled(false);
  post("cancelNotification", { id: WEEKLY_REMINDER_ID });
  setState({ enabled: false, nextFireDate: null, scheduledLanguage: null, busy: false });
  logReminderDiagnostics("cancelled");
}

/** Opens the iOS system settings for Donely (notification permissions). */
export function openNotificationSettings(): boolean {
  return post("openAppSettings");
}

/** Structured log: local time, time zone, next fire date, language, identifier. */
export function logReminderDiagnostics(reason = "status"): void {
  const now = new Date();
  const language = state.scheduledLanguage ?? i18n.language ?? "sv";
  // eslint-disable-next-line no-console
  console.info("[Donely] weekly reminder", {
    reason,
    identifier: WEEKLY_REMINDER_ID,
    enabled: state.enabled,
    permission: state.permission,
    localTime: now.toString(),
    localTimeISO: now.toISOString(),
    timeZone: currentTimeZone(),
    utcOffsetMinutes: -now.getTimezoneOffset(),
    schedule: `weekday=${REMINDER_WEEKDAY + 1} (Friday) ${String(REMINDER_HOUR).padStart(2, "0")}:${String(REMINDER_MINUTE).padStart(2, "0")} local`,
    nextFireDate: (state.nextFireDate ? new Date(state.nextFireDate) : nextReminderDate()).toString(),
    language,
    native: hasNotificationBridge(),
  });
}

// ---------------------------------------------------------------------------
// Swift -> JS globals
// ---------------------------------------------------------------------------

let pendingEnable: { language: string } | null = null;
let installed = false;

function installBridge() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const w = window as unknown as Record<string, unknown>;

  w.__donelySetNotificationPermission = (value: unknown) => {
    const raw = typeof value === "string" ? value : ((parsePayload<{ status?: string }>(value)?.status ?? "") as string);
    const permission: PermissionStatus =
      raw === "granted" || raw === "authorized"
        ? "granted"
        : raw === "provisional"
          ? "provisional"
          : raw === "denied"
            ? "denied"
            : raw === "notDetermined"
              ? "notDetermined"
              : "unknown";
    setState({ permission, busy: false });

    if (pendingEnable && (permission === "granted" || permission === "provisional")) {
      const { language } = pendingEnable;
      pendingEnable = null;
      writeEnabled(true);
      setState({ enabled: true });
      scheduleWeeklyReminder(language);
    } else if (pendingEnable && permission === "denied") {
      pendingEnable = null;
      writeEnabled(false);
      setState({ enabled: false });
    } else {
      // The user may have come back from iOS Settings after allowing notifications.
      maybeAutoEnable(permission);
    }
  };

  w.__donelyNotificationScheduled = (value: unknown) => {
    const payload = parsePayload<{ id?: string; nextFireDate?: string; language?: string }>(value);
    if (!payload || (payload.id && payload.id !== WEEKLY_REMINDER_ID)) return;
    setState({
      nextFireDate: payload.nextFireDate ?? state.nextFireDate,
      scheduledLanguage: payload.language ?? state.scheduledLanguage,
      busy: false,
    });
    logReminderDiagnostics("confirmed by iOS");
  };

  w.__donelyNotificationError = (value: unknown) => {
    const message = typeof value === "string" ? value : JSON.stringify(value);
    setState({ lastError: message, busy: false });
    // eslint-disable-next-line no-console
    console.warn("[Donely] notification error", message);
  };

  setState({
    native: hasNotificationBridge(),
    enabled: readEnabled(),
    nextFireDate: readEnabled() ? nextReminderDate().toISOString() : null,
    scheduledLanguage: readEnabled() ? i18n.language || "sv" : null,
  });

  refreshPermission();

  // Language change → reschedule so the pending notification text follows the
  // language the user picked inside Donely.
  i18n.on("languageChanged", (lng: string) => {
    if (!readEnabled()) return;
    if (state.permission === "denied" || state.permission === "unsupported") return;
    scheduleWeeklyReminder(lng);
  });

  // Travelling / time-zone change: iOS recalculates the calendar trigger by
  // itself, but we refresh the preview and re-assert the schedule.
  const checkTimeZone = () => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(TZ_KEY);
    } catch {
      /* ignore */
    }
    const tz = currentTimeZone();
    if (!readEnabled()) return;
    if (stored && stored !== tz) {
      scheduleWeeklyReminder(state.scheduledLanguage ?? i18n.language ?? "sv");
    } else {
      setState({ nextFireDate: nextReminderDate().toISOString() });
    }
  };
  // Whenever an activity is created, edited or deleted the pending Friday
  // notification is rebuilt so its summary is never stale. Debounced so a burst
  // of edits results in a single reschedule.
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener(DATA_CHANGED_EVENT, () => {
    if (!readEnabled()) return;
    if (state.permission === "denied" || state.permission === "unsupported") return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      scheduleWeeklyReminder(state.scheduledLanguage ?? i18n.language ?? "sv");
    }, 400);
  });

  // Swift calls this when the user taps the reminder, so Donely opens straight
  // on the weekly summary the notification showed.
  w.__donelyOpenRoute = (value: unknown) => {
    const path =
      typeof value === "string" ? value : (parsePayload<{ route?: string }>(value)?.route ?? REMINDER_ROUTE);
    if (!path.startsWith("/")) return;
    if (window.location.pathname !== path) window.location.assign(path);
  };

  const onForeground = () => {
    // Re-check the iOS authorization status: the user may have changed it in
    // the system settings while Donely was in the background.
    refreshPermission();
    checkTimeZone();
  };
  window.addEventListener("focus", onForeground);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") onForeground();
  });
}

// ---------------------------------------------------------------------------
// hook
// ---------------------------------------------------------------------------

export function useReminder() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    installBridge();
    refreshPermission();
  }, []);

  const toggle = useCallback(
    async (next: boolean, language: string) => {
      if (next) return enableWeeklyReminder(language);
      disableWeeklyReminder();
      return snapshot.permission;
    },
    [snapshot.permission],
  );

  return { ...snapshot, toggle };
}
