import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * Central subscription state for Donely.
 *
 * SOURCE OF TRUTH
 * ---------------
 * In the iOS build, StoreKit 2 (through the native bridge) is the ONLY source
 * of truth for trial, remaining trial days, price and subscription status.
 * The app never grants or extends Premium on its own.
 *
 * The localStorage fallback exists purely so the UI can be exercised in the
 * web preview / development build. It is compiled out unless
 * `import.meta.env.DEV` is true or `VITE_ALLOW_LOCAL_PREMIUM=true` is set.
 *
 * NATIVE BRIDGE (implemented on the Swift side, see APPSTORE.md)
 * -------------------------------------------------------------
 * JS -> Swift (webkit.messageHandlers):
 *   requestEntitlement  {}                                → send entitlement
 *   requestProduct      {product}                          → send product info
 *   purchasePremium     {product}                          → start StoreKit purchase
 *   restorePurchase     {}                                 → AppStore.sync()
 *   manageSubscription  {}                                 → showManageSubscriptions
 *
 * Swift -> JS (globals installed below):
 *   window.__donelySetEntitlement({subscribed, inTrial, trialDaysLeft})
 *   window.__donelySetProduct({displayPrice, id} | null)
 *   window.__donelyPurchaseResult(status, message?)
 */

const TRIAL_KEY = "vr.trial.v1";
const PREMIUM_KEY = "vr.premium.v1";

export const TRIAL_DAYS = 7;
export const PRODUCT_ID = "se.shiningdays.donely.premium.monthly";

/** Fallback price shown only until StoreKit reports the real localized price. */
export const FALLBACK_PRICE = "29 kr";

/**
 * The localStorage trial/premium fallback is development-only. In a production
 * build it is disabled, so no user can grant themselves Premium locally.
 */
export const LOCAL_FALLBACK_ENABLED: boolean =
  import.meta.env.DEV || import.meta.env.VITE_ALLOW_LOCAL_PREMIUM === "true";

export type PremiumStatus = "loading" | "trial" | "subscribed" | "expired";

export type PurchasePhase = "idle" | "loadingProduct" | "purchasing" | "restoring";

export type PurchaseResultStatus =
  | "success"
  | "cancelled"
  | "failed"
  | "productUnavailable"
  | "restored"
  | "nothingToRestore"
  | "pending";

export type ProductStatus = "idle" | "loading" | "loaded" | "unavailable";

export type StoreProduct = {
  id: string;
  /** StoreKit `product.displayPrice`, already localized with currency. */
  displayPrice: string;
};

export type PremiumState = {
  status: PremiumStatus;
  /** True until StoreKit (or the dev fallback) has reported a status. */
  loading: boolean;
  /** Registration and editing allowed. */
  active: boolean;
  inTrial: boolean;
  trialDaysLeft: number;
  trialExpired: boolean;
  subscribed: boolean;
  hydrated: boolean;
  /** Purchase / restore flow state. */
  phase: PurchasePhase;
  /** True while a purchase or restore is running — disable buy buttons. */
  busy: boolean;
  lastResult: PurchaseResultStatus | null;
  lastMessage: string | null;
  product: StoreProduct | null;
  productStatus: ProductStatus;
};

export type EntitlementPayload = {
  subscribed: boolean;
  inTrial: boolean;
  trialDaysLeft: number;
};

// ---------------------------------------------------------------------------
// store
// ---------------------------------------------------------------------------

const initial: PremiumState = {
  status: "loading",
  loading: true,
  active: false,
  inTrial: false,
  trialDaysLeft: 0,
  trialExpired: false,
  subscribed: false,
  hydrated: false,
  phase: "idle",
  busy: false,
  lastResult: null,
  lastMessage: null,
  product: null,
  productStatus: "idle",
};

let state: PremiumState = initial;
const listeners = new Set<() => void>();

function setState(patch: Partial<PremiumState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function getSnapshot() {
  return state;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// purchase result events (for toasts)
type PurchaseEvent = { status: PurchaseResultStatus; message?: string };
const eventListeners = new Set<(e: PurchaseEvent) => void>();

export function subscribePurchaseEvents(cb: (e: PurchaseEvent) => void) {
  eventListeners.add(cb);
  return () => {
    eventListeners.delete(cb);
  };
}

function emitPurchaseEvent(e: PurchaseEvent) {
  for (const l of eventListeners) l(e);
}

// ---------------------------------------------------------------------------
// native bridge
// ---------------------------------------------------------------------------

type NativeBridge = {
  webkit?: {
    messageHandlers?: Record<string, { postMessage: (v: unknown) => void } | undefined>;
  };
};

function nativeHandler(name: string) {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as NativeBridge).webkit?.messageHandlers?.[name];
}

export function hasNativeBridge(): boolean {
  return !!nativeHandler("purchasePremium");
}

function applyEntitlement(payload: EntitlementPayload) {
  const subscribed = !!payload.subscribed;
  const inTrial = !subscribed && !!payload.inTrial;
  const raw = Number(payload.trialDaysLeft);
  const trialDaysLeft = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
  const active = subscribed || inTrial;
  setState({
    subscribed,
    inTrial,
    trialDaysLeft,
    trialExpired: !subscribed && !inTrial,
    active,
    hydrated: true,
    loading: false,
    status: subscribed ? "subscribed" : inTrial ? "trial" : "expired",
  });
}

/**
 * True as soon as an entitlement has arrived over the bridge. From then on the
 * dev localStorage fallback must never overwrite it (bridge = source of truth).
 */
let bridgeControlled = false;

/** Bumped when the JS side of the contract changes; Swift can assert on it. */
export const BRIDGE_VERSION = 1;

/**
 * Called by the iOS shell with the current StoreKit entitlement.
 * Defensive: accepts a JSON string too, since `evaluateJavaScript` payloads
 * are easy to stringify by mistake on the Swift side.
 */
export function setEntitlement(payload: EntitlementPayload | string) {
  let data: Partial<EntitlementPayload> = {};
  if (typeof payload === "string") {
    try {
      data = JSON.parse(payload) as Partial<EntitlementPayload>;
    } catch {
      data = {};
    }
  } else if (payload && typeof payload === "object") {
    data = payload;
  }
  bridgeControlled = true;
  clearPendingTimeout();
  applyEntitlement({
    subscribed: !!data.subscribed,
    inTrial: !!data.inTrial,
    trialDaysLeft: Number(data.trialDaysLeft ?? 0),
  });
}

/** Called by the iOS shell with the fetched StoreKit product (or null). */
export function setProduct(product: StoreProduct | string | null) {
  clearTimer("product");
  let data: Partial<StoreProduct> | null = null;
  if (typeof product === "string") {
    try {
      data = JSON.parse(product) as Partial<StoreProduct>;
    } catch {
      data = null;
    }
  } else if (product && typeof product === "object") {
    data = product;
  }
  const displayPrice = typeof data?.displayPrice === "string" ? data.displayPrice.trim() : "";
  if (!displayPrice) {
    setState({ product: null, productStatus: "unavailable" });
    // Transient App Store / sandbox hiccups are common: retry a couple of
    // times with backoff before showing the "price unavailable" state.
    if (typeof window !== "undefined" && productAttempt < PRODUCT_MAX_ATTEMPTS) {
      const delay = 1500 * productAttempt;
      window.setTimeout(() => {
        if (state.productStatus === "unavailable") loadProduct();
      }, delay);
    }
    return;
  }
  productAttempt = 0;
  setState({
    product: { id: typeof data?.id === "string" ? data.id : PRODUCT_ID, displayPrice },
    productStatus: "loaded",
  });
}

const PURCHASE_RESULT_STATUSES: PurchaseResultStatus[] = [
  "success",
  "cancelled",
  "failed",
  "productUnavailable",
  "restored",
  "nothingToRestore",
  "pending",
];

/**
 * Called by the iOS shell when a purchase or restore finishes.
 * `status` is one of PurchaseResultStatus; `message` is an optional
 * already-localized detail from StoreKit.
 */
export function reportPurchaseResult(status: PurchaseResultStatus, message?: string) {
  const safeStatus: PurchaseResultStatus = PURCHASE_RESULT_STATUSES.includes(status)
    ? status
    : "failed";
  clearPendingTimeout();
  setState({
    phase: "idle",
    busy: false,
    lastResult: safeStatus,
    lastMessage: typeof message === "string" && message ? message : null,
  });
  emitPurchaseEvent({ status: safeStatus, message });
  // Ask for a fresh entitlement after a successful purchase/restore.
  if (safeStatus === "success" || safeStatus === "restored") requestEntitlement();
}

// --- timeouts: never leave the UI stuck if Swift goes silent ---------------

/** How long we wait for the shell to answer before falling back. */
const ENTITLEMENT_TIMEOUT_MS = 8000;
const PRODUCT_TIMEOUT_MS = 15000;
/** Ask to Buy / SCA can take a while, but never forever. */
const PURCHASE_TIMEOUT_MS = 180000;

const timers: Record<"entitlement" | "product" | "purchase", number | null> = {
  entitlement: null,
  product: null,
  purchase: null,
};

function clearTimer(key: keyof typeof timers) {
  const id = timers[key];
  if (id !== null && typeof window !== "undefined") window.clearTimeout(id);
  timers[key] = null;
}

function armTimer(key: keyof typeof timers, ms: number, onTimeout: () => void) {
  clearTimer(key);
  if (typeof window === "undefined") return;
  timers[key] = window.setTimeout(() => {
    timers[key] = null;
    onTimeout();
  }, ms);
}

/** Cleared whenever the shell answers with an entitlement or a result. */
function clearPendingTimeout() {
  clearTimer("entitlement");
  clearTimer("purchase");
}

/** Tells the shell that the web app is ready to receive entitlement/product. */
export function notifyBridgeReady() {
  nativeHandler("bridgeReady")?.postMessage({ version: BRIDGE_VERSION });
}

if (typeof window !== "undefined") {
  const w = window as unknown as Record<string, unknown>;
  w.__donelySetEntitlement = setEntitlement;
  w.__donelySetProduct = setProduct;
  w.__donelyPurchaseResult = reportPurchaseResult;
  w.__donelyBridgeVersion = BRIDGE_VERSION;
  // Handshake: the shell may inject entitlement before or after this runs.
  w.__donelyBridgeReady = true;
  notifyBridgeReady();
}

// ---------------------------------------------------------------------------
// development fallback (never active in production builds)
// ---------------------------------------------------------------------------

function localTrialStart(): number {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(TRIAL_KEY);
  } catch {
    /* storage disabled — fall through to a fresh in-memory trial start */
  }
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

function localDaysLeft(start: number) {
  const end = start + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000)));
}

function refreshLocalFallback() {
  if (state.productStatus === "idle") {
    setProduct({ id: PRODUCT_ID, displayPrice: FALLBACK_PRICE });
  }
  // A bridge entitlement always wins over the local dev fallback.
  if (bridgeControlled) return;
  const subscribed = window.localStorage.getItem(PREMIUM_KEY) === "1";
  const left = localDaysLeft(localTrialStart());
  applyEntitlement({ subscribed, inTrial: !subscribed && left > 0, trialDaysLeft: left });
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

export function requestEntitlement() {
  const handler = nativeHandler("requestEntitlement");
  if (handler) {
    handler.postMessage({});
    // If the shell never answers, don't hang on "loading" forever — lock down.
    if (!bridgeControlled) {
      armTimer("entitlement", ENTITLEMENT_TIMEOUT_MS, () => {
        if (!bridgeControlled)
          applyEntitlement({ subscribed: false, inTrial: false, trialDaysLeft: 0 });
      });
    }
    return;
  }
  if (LOCAL_FALLBACK_ENABLED && typeof window !== "undefined") {
    refreshLocalFallback();
    return;
  }
  // Production web build without an iOS shell: nothing can be verified,
  // so premium features stay locked.
  applyEntitlement({ subscribed: false, inTrial: false, trialDaysLeft: 0 });
}

/** Number of times we re-ask StoreKit before declaring the product unavailable. */
const PRODUCT_MAX_ATTEMPTS = 3;
let productAttempt = 0;

/** Asks StoreKit for the product so the real localized price can be shown. */
export function loadProduct(options?: { retry?: boolean }) {
  if (state.productStatus === "loading") return;
  if (options?.retry) productAttempt = 0;
  const handler = nativeHandler("requestProduct");
  if (handler) {
    productAttempt += 1;
    setState({ productStatus: "loading" });
    handler.postMessage({ product: PRODUCT_ID });
    // Swift replies with __donelySetProduct(...)
    armTimer("product", PRODUCT_TIMEOUT_MS, () => {
      if (state.productStatus === "loading")
        setState({ product: null, productStatus: "unavailable" });
    });
    return;
  }
  if (LOCAL_FALLBACK_ENABLED) {
    setProduct({ id: PRODUCT_ID, displayPrice: FALLBACK_PRICE });
    return;
  }
  setProduct(null);
}

/** Starts Apple's purchase flow. Never grants Premium by itself. */
export function purchasePremium() {
  if (state.busy) return;
  const handler = nativeHandler("purchasePremium");
  if (handler) {
    // Always hand the request to StoreKit, even if the price fetch failed
    // earlier. StoreKit can succeed where the metadata fetch did not, and if
    // it fails we surface Apple's real reason instead of a generic error.
    setState({ phase: "purchasing", busy: true, lastResult: null, lastMessage: null });
    handler.postMessage({ product: PRODUCT_ID });
    armTimer("purchase", PURCHASE_TIMEOUT_MS, () => reportPurchaseResult("failed"));
    return;
  }
  if (LOCAL_FALLBACK_ENABLED) {
    setState({ phase: "purchasing", busy: true });
    try {
      window.localStorage.setItem(PREMIUM_KEY, "1");
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      refreshLocalFallback();
      reportPurchaseResult("success");
    }, 400);
    return;
  }
  emitPurchaseEvent({ status: "productUnavailable" });
}

/** Syncs with Apple and verifies the entitlement. */
export function restorePurchase() {
  if (state.busy) return;
  const handler = nativeHandler("restorePurchase");
  if (handler) {
    setState({ phase: "restoring", busy: true, lastResult: null, lastMessage: null });
    handler.postMessage({});
    armTimer("purchase", PURCHASE_TIMEOUT_MS, () => reportPurchaseResult("failed"));
    return;
  }
  if (LOCAL_FALLBACK_ENABLED) {
    setState({ phase: "restoring", busy: true });
    window.setTimeout(() => {
      const found = bridgeControlled
        ? state.subscribed
        : window.localStorage.getItem(PREMIUM_KEY) === "1";
      refreshLocalFallback();
      reportPurchaseResult(found ? "restored" : "nothingToRestore");
    }, 400);
    return;
  }
  emitPurchaseEvent({ status: "nothingToRestore" });
}

export const MANAGE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

/** Opens Apple's subscription management screen. */
export function openManageSubscriptions() {
  const handler = nativeHandler("manageSubscription");
  if (handler) {
    handler.postMessage({});
    return;
  }
  window.open(MANAGE_SUBSCRIPTIONS_URL, "_blank", "noopener");
}

// ---------------------------------------------------------------------------
// access control
// ---------------------------------------------------------------------------

/**
 * Single gate for every mutating action: registering activities, creating /
 * renaming / deleting categories and setting or removing yearly goals.
 * Reading history, statistics, navigation, rating, restore and subscription
 * management are never gated.
 *
 * In development builds the gate is always open so the app can be exercised
 * without a StoreKit sandbox. In production iOS builds StoreKit is the only
 * source of truth.
 *
 * While the status is still loading this returns false, so nothing is granted
 * before StoreKit has answered. Callers should check `state.loading` first and
 * show the loading message instead of the paywall.
 */
export function canMutate(state: PremiumState): boolean {
  if (import.meta.env.DEV || LOCAL_FALLBACK_ENABLED) return true;
  return state.status === "trial" || state.status === "subscribed";
}

// ---------------------------------------------------------------------------
// hook
// ---------------------------------------------------------------------------

export function usePremium() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const refresh = useCallback(() => {
    requestEntitlement();
  }, []);

  useEffect(() => {
    requestEntitlement();
    if (state.productStatus === "idle") loadProduct();

    if (hasNativeBridge()) {
      const onVisible = () => {
        if (document.visibilityState === "visible") requestEntitlement();
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => document.removeEventListener("visibilitychange", onVisible);
    }

    if (!LOCAL_FALLBACK_ENABLED) return;
    // Dev fallback: tick so the trial countdown reaches 0 on its own.
    const timer = window.setInterval(refreshLocalFallback, 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshLocalFallback();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refreshLocalFallback);
    window.addEventListener("storage", refreshLocalFallback);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refreshLocalFallback);
      window.removeEventListener("storage", refreshLocalFallback);
    };
  }, []);

  return { ...snapshot, refresh };
}

/** Price to interpolate into i18next strings as {{price}}. */
export function usePrice(): string {
  const { product } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (product?.displayPrice) return product.displayPrice;
  // Never invent a price in a production iOS build — an invented price is what
  // makes a failed StoreKit fetch look like a working (but broken) purchase.
  return LOCAL_FALLBACK_ENABLED ? FALLBACK_PRICE : "";
}
