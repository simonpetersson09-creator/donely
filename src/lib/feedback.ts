/**
 * "Vad saknar du i appen?" — a one-time feedback prompt shown after the user
 * has had the app for a while. The free-text answer is stored anonymously
 * (device id only) and is completely separate from the App Store rating flow.
 */

const FIRST_OPEN_KEY = "donely_first_open";
const FEEDBACK_STATE_KEY = "donely_feedback_state"; // "sent" | timestamp of last snooze

const DAYS_UNTIL_PROMPT = 7;
const SNOOZE_DAYS = 14;

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function shouldShowFeedbackPrompt(): boolean {
  if (typeof window === "undefined") return false;

  const state = safeGet(FEEDBACK_STATE_KEY);
  if (state === "sent") return false;

  const now = Date.now();

  let firstOpen = Number(safeGet(FIRST_OPEN_KEY) ?? 0);
  if (!Number.isFinite(firstOpen) || firstOpen <= 0) {
    firstOpen = now;
    safeSet(FIRST_OPEN_KEY, String(now));
  }
  if (now - firstOpen < DAYS_UNTIL_PROMPT * DAY_MS) return false;

  // Snoozed via "Inte nu" — ask again after a while.
  const snoozedAt = Number(state ?? 0);
  if (Number.isFinite(snoozedAt) && snoozedAt > 0 && now - snoozedAt < SNOOZE_DAYS * DAY_MS) {
    return false;
  }

  return true;
}

export function snoozeFeedbackPrompt(): void {
  safeSet(FEEDBACK_STATE_KEY, String(Date.now()));
}

export function markFeedbackSent(): void {
  safeSet(FEEDBACK_STATE_KEY, "sent");
}

export async function submitFeedback(message: string): Promise<boolean> {
  const text = message.trim().slice(0, 2000);
  if (!text) return false;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { getDeviceId } = await import("@/lib/telemetry");
    const isNative =
      typeof (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
        ?.isNativePlatform === "function" &&
      (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor!.isNativePlatform!();
    const { error } = await supabase.from("app_feedback").insert({
      device_id: getDeviceId() ?? "unknown",
      message: text,
      platform: isNative ? "ios" : "web",
    });
    return !error;
  } catch {
    return false;
  }
}
