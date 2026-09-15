import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";

/**
 * Route-level safety net.
 *
 * If anything throws while a screen renders (bad stored data, a plugin hiccup
 * in the native WebView, ...) TanStack would show the global "This page didn't
 * load" screen. For the list screens that is far worse than simply re-rendering
 * the page, so this boundary quietly resets itself once and puts the user back
 * on the same screen instead of on an error page.
 */
export function RouteErrorRecovery({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const resetRef = useRef(reset);
  resetRef.current = reset;

  useEffect(() => {
    const id = window.setTimeout(() => {
      router.invalidate();
      resetRef.current();
    }, 50);
    return () => window.clearTimeout(id);
  }, [router]);

  return <div className="min-h-dvh bg-background" aria-busy="true" />;
}
