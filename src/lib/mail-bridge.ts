/**
 * Native mail composer bridge (iOS).
 *
 * WHY NOT mailto:
 * ---------------
 * `mailto:` can only carry plain text, so an image can never appear inside the
 * message body. To show the Donely report card inline we hand an HTML body to
 * `MFMailComposeViewController` (native half: ios/App/App/DonelyMailBridge.swift),
 * with the PNG embedded as a base64 data URI inside the HTML. iOS Mail renders
 * and sends that image inline — the recipient sees the card directly in the
 * message, not as a file they must open.
 *
 * The user still reviews the message, picks recipients and presses Send: Donely
 * never sends anything by itself and no backend is involved.
 *
 * JS -> Swift (webkit.messageHandlers):
 *   composeMail {subject, html, plain, pngBase64, fileName}
 * Swift -> JS:
 *   window.__donelyMailResult("sent" | "saved" | "cancelled" | "failed" | "unavailable")
 *   window.__donelyMailAvailable = true   (set when the bridge is installed)
 */

export type MailResult = "sent" | "saved" | "cancelled" | "failed" | "unavailable";

type MailPayload = {
  subject: string;
  /** HTML body with the report card inlined as a data URI. */
  html: string;
  /** Plain-text fallback used when no native composer exists. */
  plain: string;
  /** Base64 PNG (no data URI prefix). */
  pngBase64?: string;
  fileName?: string;
};

type MailWindow = Window & {
  webkit?: { messageHandlers?: Record<string, { postMessage: (data: unknown) => void }> };
  __donelyMailAvailable?: boolean;
  __donelyMailResult?: (status: MailResult) => void;
};

function handler() {
  if (typeof window === "undefined") return undefined;
  return (window as MailWindow).webkit?.messageHandlers?.composeMail;
}

/** True when the native composer is present and the device can send mail. */
export function isNativeMailAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as MailWindow;
  return Boolean(handler()) && w.__donelyMailAvailable !== false;
}

let pending: ((status: MailResult) => void) | null = null;

function ensureCallback() {
  if (typeof window === "undefined") return;
  const w = window as MailWindow;
  if (w.__donelyMailResult) return;
  w.__donelyMailResult = (status: MailResult) => {
    const resolve = pending;
    pending = null;
    resolve?.(status);
  };
}

/**
 * Opens the native mail composer. Resolves once the user sends, saves or
 * cancels. Resolves with "unavailable" when there is no native composer.
 */
export function composeMail(payload: MailPayload): Promise<MailResult> {
  const bridge = handler();
  if (!bridge) return Promise.resolve("unavailable");
  ensureCallback();
  return new Promise<MailResult>((resolve) => {
    pending = resolve;
    try {
      bridge.postMessage(payload);
    } catch {
      pending = null;
      resolve("failed");
    }
    // Safety net: never leave the UI waiting forever.
    setTimeout(() => {
      if (pending === resolve) {
        pending = null;
        resolve("failed");
      }
    }, 120_000);
  });
}

/** Last-resort plain-text fallback (web preview / no Mail account). */
export function openMailto(subject: string, body: string) {
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
