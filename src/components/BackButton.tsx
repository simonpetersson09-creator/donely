import { useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Back control that returns to the previous screen in history.
 * Falls back to `fallbackTo` when there is no history entry (deep link / cold start).
 */
export function BackButton({
  children,
  fallbackTo = "/",
  className,
}: {
  children: ReactNode;
  fallbackTo?: string;
  className?: string;
}) {
  const router = useRouter();

  const handleBack = () => {
    const canGoBack =
      typeof window !== "undefined" &&
      (router.history.canGoBack?.() === true || window.history.length > 1);
    if (canGoBack) {
      router.history.back();
    } else {
      router.navigate({ to: fallbackTo });
    }
  };

  return (
    <button type="button" onClick={handleBack} className={className}>
      <ChevronLeft className="size-4" />
      {children}
    </button>
  );
}
