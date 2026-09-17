/**
 * Minimal, anonymous "app opened" ping.
 *
 * Sends a random device id (generated once on the device) so we can tell how
 * many devices keep opening the app. No personal data and no activity content
 * ever leaves the phone.
 */

const DEVICE_ID_KEY = "donely_device_id";
const LAST_PING_KEY = "donely_last_ping";
const PING_INTERVAL_MS = 6 * 60 * 60 * 1000; // at most once every 6 hours

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
    /* storage unavailable — skip telemetry */
  }
}

export function getDeviceId(): string | null {
  const existing = safeGet(DEVICE_ID_KEY);
  if (existing && /^[a-zA-Z0-9-]{8,64}$/.test(existing)) return existing;
  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `d-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  safeSet(DEVICE_ID_KEY, generated);
  return safeGet(DEVICE_ID_KEY);
}

export function pingAppOpen(): void {
  if (typeof window === "undefined") return;

  void (async () => {
    const { Capacitor } = await import("@capacitor/core");

    // Only the installed app counts. Browser/preview sessions get a brand new
    // device id every time storage is cleared, which inflated the numbers.
    if (!Capacitor.isNativePlatform()) return;

    const last = Number(safeGet(LAST_PING_KEY) ?? 0);
    if (Number.isFinite(last) && Date.now() - last < PING_INTERVAL_MS) return;

    const deviceId = getDeviceId();
    if (!deviceId) return;

    // The installed app runs from capacitor://localhost, so a relative URL would
    // never reach the backend. Talk to the database directly instead.
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase.rpc("record_app_open", {
        _device_id: deviceId,
        _platform: "ios",
    });

    // Failed/offline attempts must remain eligible for retry on the next app
    // launch. Previously this timestamp was stored before the request, silently
    // suppressing retries for six hours even when no row reached the database.
    if (!error) safeSet(LAST_PING_KEY, String(Date.now()));
  })().catch(() => {
    /* offline — retry on next app launch */
  });
}
