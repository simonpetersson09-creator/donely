import { useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Back control that always returns to the configured parent screen.
 * This keeps navigation predictable when the user has browsed around
 * inside the same section (e.g. switching between Day/Week/Year stats).
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
    router.navigate({ to: fallbackTo });
  };

  return (
    <button type="button" onClick={handleBack} className={className}>
      <ChevronLeft className="size-4" />
      {children}
    </button>
  );
}
