import { useCallback, useEffect, useState } from "react";

/**
 * Subscription state for Donely.
 *
 * The web/PWA build uses localStorage as a development fallback so the UI can be
 * tested without StoreKit. When the app runs inside the iOS shell, the native
 * bridge is the only source of truth: localStorage trial/premium keys are
 * ignored and the iOS side pushes the current entitlement via
 * `window.__donelySetEntitlement(...)`.
 */

const TRIAL_KEY = "vr.trial.v1";
const PREMIUM_KEY = "vr.premium.v1";

export const TRIAL_DAYS = 7;
export const PRICE_LABEL = "29 kr/månad";

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

export type EntitlementPayload = {
  subscribed: boolean;
  inTrial: boolean;
  trialDaysLeft: number;
};

// --- local fallback (web/PWA development only) ---

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

function isSubscribedLocal(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PREMIUM_KEY) === "1";
}

function daysLeft(start: number) {
  const end = start + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000)));
}

function computeLocal(): Omit<PremiumState, "hydrated"> {
  const left = daysLeft(trialStart());
  const subscribed = isSubscribedLocal();
  return {
    subscribed,
    inTrial: !subscribed && left > 0,
    trialDaysLeft: left,
    trialExpired: left === 0,
    active: subscribed || left > 0,
  };
}

// --- native bridge ---

type NativeBridge = {
  webkit?: {
    messageHandlers?: Record<string, { postMessage: (v: unknown) => void } | undefined>;
  };
};

function nativeHandler(name: string) {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as NativeBridge).webkit?.messageHandlers?.[name];
}

let nativeBridgeAvailable = false;
let nativeEntitlement: EntitlementPayload | null = null;

function detectNativeBridge() {
  nativeBridgeAvailable = !!nativeHandler("purchasePremium");
}

/**
 * Called by the iOS shell to report the current StoreKit entitlement.
 * This is the single source of truth when the app runs as an iOS app.
 */
export function setEntitlement(payload: EntitlementPayload) {
  nativeBridgeAvailable = true;
  nativeEntitlement = payload;
  notify();
}

if (typeof window !== "undefined") {
  (
    window as unknown as { __donelySetEntitlement?: typeof setEntitlement }
  ).__donelySetEntitlement = setEntitlement;
}

// --- state computation ---

function compute(): Omit<PremiumState, "hydrated"> {
  detectNativeBridge();

  if (nativeBridgeAvailable) {
    if (nativeEntitlement) {
      return {
        ...nativeEntitlement,
        active: nativeEntitlement.subscribed || nativeEntitlement.inTrial,
        trialExpired: nativeEntitlement.trialDaysLeft === 0,
      };
    }
    // Waiting for the iOS shell to report StoreKit status. Stay locked.
    return {
      subscribed: false,
      inTrial: false,
      trialDaysLeft: 0,
      trialExpired: true,
      active: false,
    };
  }

  // Web/PWA development fallback.
  return computeLocal();
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

// --- local fallback helpers (not exported, only used when there is no iOS shell) ---

function activateSubscriptionLocal() {
  try {
    window.localStorage.setItem(PREMIUM_KEY, "1");
  } catch {
    /* ignore */
  }
  notify();
}

function deactivateSubscriptionLocal() {
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
    refresh();
    listeners.add(refresh);
    detectNativeBridge();

    if (nativeBridgeAvailable) {
      // Ask the iOS shell to send the current entitlement on mount.
      const request = nativeHandler("requestEntitlement");
      if (request) request.postMessage({});
    } else {
      // Web/PWA fallback: tick while the app is open so the countdown
      // reaches 0 on its own.
      const timer = window.setInterval(refresh, 60 * 1000);
      const onVisible = () => {
        if (document.visibilityState === "visible") refresh();
      };
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("focus", refresh);
      window.addEventListener("storage", refresh);
      return () => {
        window.clearInterval(timer);
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("focus", refresh);
        window.removeEventListener("storage", refresh);
        listeners.delete(refresh);
      };
    }

    return () => {
      listeners.delete(refresh);
    };
  }, [refresh]);

  return { ...state, refresh };
}

export const MANAGE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

/**
 * Starts the purchase flow. In the iOS shell this hands over to StoreKit 2
 * and the iOS side later calls `setEntitlement()` with the result. In the
 * web/PWA build the entitlement is granted locally so the UI can be tested.
 */
export function purchasePremium(): boolean {
  const handler = nativeHandler("purchasePremium");
  if (handler) {
    handler.postMessage({ product: "donely.premium.monthly" });
    return false;
  }
  activateSubscriptionLocal();
  return true;
}

/**
 * Restores a previous purchase. In the iOS shell this hands over to StoreKit 2.
 * In the web/PWA build it only checks the local fallback flag.
 */
export function restorePurchase(): boolean {
  const handler = nativeHandler("restorePurchase");
  if (handler) {
    handler.postMessage({});
    return false;
  }
  notify();
  return isSubscribedLocal();
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
