import { useEffect, useState } from "react";

/**
 * Tracks the OS-level "Reduce Motion" setting. Every micro-interaction in
 * Donely reads this and falls back to a plain fade (or no motion at all)
 * so the experience stays identical, just calmer.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * Discreet haptic feedback. Uses the native Capacitor plugin when running in
 * the iOS shell and silently degrades to the web vibration API (or nothing).
 * Never awaited by callers so it can never delay a registration.
 */
export function haptic(style: "light" | "medium" | "success" = "light") {
  void (async () => {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
        if (style === "success") {
          await Haptics.notification({ type: NotificationType.Success });
        } else {
          await Haptics.impact({
            style: style === "medium" ? ImpactStyle.Medium : ImpactStyle.Light,
          });
        }
        return;
      }
    } catch {
      /* fall through to the web API */
    }
    try {
      navigator.vibrate?.(style === "success" ? 12 : style === "medium" ? 8 : 6);
    } catch {
      /* ignore */
    }
  })();
}
