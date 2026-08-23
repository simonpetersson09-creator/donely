import { useEffect, useRef, useState } from "react";
import { Trophy, Target, Flame, type LucideIcon } from "lucide-react";
import { useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

type AchievementVariant = "record" | "milestone" | "nearRecord" | "nearMilestone";

const ICONS: Record<AchievementVariant, LucideIcon> = {
  record: Trophy,
  milestone: Target,
  nearRecord: Flame,
  nearMilestone: Target,
};

/**
 * Discreet feedback card that slides up from the bottom after a registration.
 * It never blocks the view underneath, disappears on its own after ~3 s and
 * can be swiped away. iOS-native glassmorphism: frosted card, gradient icon
 * pill, soft spring transitions, and a subtle right-edge dismiss indicator.
 */
export function AchievementCard({
  variant,
  title,
  lines,
  emphatic = false,
  duration = 3200,
  onDismiss,
}: {
  variant: AchievementVariant;
  title: string;
  lines: string[];
  emphatic?: boolean;
  duration?: number;
  onDismiss: () => void;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const closed = useRef(false);

  const Icon = ICONS[variant];

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => close(), duration);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  function close() {
    if (closed.current) return;
    closed.current = true;
    if (reduced) {
      onDismiss();
      return;
    }
    setClosing(true);
    window.setTimeout(onDismiss, 220);
  }

  const offset = closing ? 140 : shown ? drag : 140;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      role="status"
      aria-live="polite"
    >
      <div
        onTouchStart={(e) => {
          start.current = e.touches[0].clientY;
        }}
        onTouchMove={(e) => {
          if (start.current === null) return;
          const dy = e.touches[0].clientY - start.current;
          setDrag(dy > 0 ? dy : dy / 5);
        }}
        onTouchEnd={() => {
          start.current = null;
          if (drag > 40) close();
          else setDrag(0);
        }}
        onClick={close}
        style={{
          transform: `translateY(${offset}px)`,
          opacity: closing || !shown ? 0 : 1,
          transition: reduced
            ? "opacity 150ms linear"
            : "transform 340ms cubic-bezier(0.22,1,0.36,1), opacity 220ms ease-out",
        }}
        className="pointer-events-auto w-full max-w-[342px]"
      >
        <div
          className={cn(
            "relative overflow-hidden rounded-3xl border border-white/25 px-4 py-3.5 shadow-card",
            "bg-card/80 backdrop-blur-xl",
          )}
        >
          {/* Inner highlight border for the glass edge */}
          <div
            className="pointer-events-none absolute inset-0 rounded-3xl border border-white/20"
            aria-hidden
          />

          <div className="flex items-center gap-3.5">
            {/* Gradient icon pill */}
            <span
              aria-hidden
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full text-primary-foreground",
                emphatic
                  ? "bg-gradient-to-br from-gold to-gold-deep shadow-gold"
                  : "bg-gradient-to-br from-primary to-primary/80 shadow-button",
                reduced ? "" : "scale-in",
              )}
              style={
                reduced
                  ? undefined
                  : {
                      display: "inline-flex",
                      animation: "donely-pop 420ms cubic-bezier(0.22,1,0.36,1) 80ms both",
                    }
              }
            >
              <Icon className="size-5" strokeWidth={2.5} />
            </span>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-[14px] font-semibold leading-tight tracking-tight",
                  emphatic ? "text-primary" : "text-foreground",
                )}
              >
                {title}
              </p>
              {lines.map((line, i) => (
                <p
                  key={i}
                  className="mt-0.5 truncate text-[13px] font-medium leading-snug text-muted-foreground"
                  title={line}
                >
                  {line}
                </p>
              ))}
            </div>

            {/* iOS-style dismiss indicator */}
            <div className="h-8 w-1 shrink-0 rounded-full bg-muted/40" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
