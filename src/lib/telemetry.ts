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

function getDeviceId(): string | null {
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

  const isNative =
    typeof (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      ?.isNativePlatform === "function" &&
    (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor!.isNativePlatform!();

  // Only the installed app counts. Browser/preview sessions get a brand new
  // device id every time storage is cleared, which inflated the numbers.
  if (!isNative) return;

  const last = Number(safeGet(LAST_PING_KEY) ?? 0);
  if (Number.isFinite(last) && Date.now() - last < PING_INTERVAL_MS) return;

  const deviceId = getDeviceId();
  if (!deviceId) return;

  safeSet(LAST_PING_KEY, String(Date.now()));

  void fetch("/api/public/ping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId,
      platform: "ios",
    }),
  }).catch(() => {
    /* offline — ignore */
  });
}
