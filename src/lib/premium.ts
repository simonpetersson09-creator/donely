import { useCallback, useEffect, useState } from "react";

/**
 * Subscription state for Donely.
 *
 * The app runs as a web/PWA build, so there is no StoreKit runtime available here.
 * All state is kept locally (mirroring how a StoreKit 2 entitlement would be cached
 * and re-validated on every app start), behind a small API surface —
 * `startPremium()` / `restorePurchase()` — that maps 1:1 to the native purchase and
 * restore calls when the project is wrapped in an iOS shell.
 */

const TRIAL_KEY = "vr.trial.v1";
const PREMIUM_KEY = "vr.premium.v1";

export const TRIAL_DAYS = 7;
export const PRICE_LABEL = "29 kr/mån";

export type PremiumState = {
  /** Registration and editing allowed. */
  active: boolean;
  /** True while the free 7-day trial is running. */
  inTrial: boolean;
  trialDaysLeft: number;
  trialExpired: boolean;
  /** Paid, auto-renewable subscription is active. */
  subscribed: boolean;
  hydrated: boolean;
};

function trialStart(): number {
  if (typeof window === "undefined") return Date.now();
  const raw = window.localStorage.getItem(TRIAL_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isFinite(parsed)) return parsed;
  const now = Date.now();
  try {
    window.localStorage.setItem(TRIAL_KEY, String(now));
  } catch {
    /* ignore */
  }
  return now;
}

function isSubscribed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PREMIUM_KEY) === "1";
}

function daysLeft(start: number) {
  const end = start + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000)));
}

function compute(): Omit<PremiumState, "hydrated"> {
  const left = daysLeft(trialStart());
  const subscribed = isSubscribed();
  return {
    subscribed,
    inTrial: !subscribed && left > 0,
    trialDaysLeft: left,
    trialExpired: left === 0,
    active: subscribed || left > 0,
  };
}

const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}

/**
 * Returns true when the user is allowed to perform mutating actions
 * (register, create/edit/rename categories, set/remove goals, delete data).
 * While the state is still hydrating we default to allowed so the UI
 * does not flash-lock on app start.
 */
export function canMutate(state: PremiumState): boolean {
  return !state.hydrated || state.active;
}

/** Marks the auto-renewable subscription as active (StoreKit purchase succeeded). */
export function activateSubscription() {
  try {
    window.localStorage.setItem(PREMIUM_KEY, "1");
  } catch {
    /* ignore */
  }
  notify();
}

/** Clears the entitlement — subscription expired or was cancelled. */
export function deactivateSubscription() {
  try {
    window.localStorage.removeItem(PREMIUM_KEY);
  } catch {
    /* ignore */
  }
  notify();
}

export function usePremium() {
  const [state, setState] = useState<PremiumState>({
    active: true,
    inTrial: true,
    trialDaysLeft: TRIAL_DAYS,
    trialExpired: false,
    subscribed: false,
    hydrated: false,
  });

  const refresh = useCallback(() => {
    setState({ ...compute(), hydrated: true });
  }, []);

  useEffect(() => {
    // Validate on app start, when returning to the app, and on storage changes,
    // so an expired subscription re-locks registration automatically.
    refresh();
    listeners.add(refresh);
    // Tick while the app is open so the countdown reaches 0 on its own.
    const timer = window.setInterval(refresh, 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(timer);
      listeners.delete(refresh);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  return { ...state, refresh };
}

type NativeBridge = {
  webkit?: {
    messageHandlers?: Record<string, { postMessage: (v: unknown) => void } | undefined>;
  };
};

function nativeHandler(name: string) {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as NativeBridge).webkit?.messageHandlers?.[name];
}

export const MANAGE_SUBSCRIPTIONS_URL =
  "https://apps.apple.com/account/subscriptions";

/**
 * Starts the purchase flow. In the iOS shell this hands over to StoreKit 2;
 * on the web build the entitlement is granted locally so the UI can be used.
 * Returns true when premium is active afterwards.
 */
export function purchasePremium(): boolean {
  const handler = nativeHandler("purchasePremium");
  if (handler) {
    handler.postMessage({ product: "donely.premium.monthly" });
    return false;
  }
  activateSubscription();
  return true;
}

/** Restores a previous purchase. Returns true when an entitlement was found. */
export function restorePurchase(): boolean {
  const handler = nativeHandler("restorePurchase");
  if (handler) {
    handler.postMessage({});
    return false;
  }
  notify();
  return isSubscribed();
}

/** Opens Apple's subscription management screen. */
export function openManageSubscriptions() {
  const handler = nativeHandler("manageSubscription");
  if (handler) {
    handler.postMessage({});
    return;
  }
  window.open(MANAGE_SUBSCRIPTIONS_URL, "_blank", "noopener");
}
