import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/motion";

/**
 * Discreet feedback card that slides up from the bottom after a registration.
 * It never blocks the view underneath, disappears on its own after ~3 s and
 * can be swiped away. No confetti — just a small scale-in on the icon.
 */
export function AchievementCard({
  icon,
  title,
  lines,
  emphatic = false,
  duration = 3200,
  onDismiss,
}: {
  icon: string;
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
        className="pointer-events-auto w-full max-w-md rounded-3xl border border-border/60 bg-card px-4 py-3.5 shadow-[0_18px_40px_-16px_hsl(0_0%_0%/0.45)]"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="shrink-0 text-[26px] leading-none"
            style={
              reduced
                ? undefined
                : {
                    display: "inline-block",
                    animation: emphatic
                      ? "donely-pop 420ms cubic-bezier(0.22,1,0.36,1) 80ms both"
                      : undefined,
                  }
            }
          >
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={
                emphatic
                  ? "text-[15px] font-semibold leading-tight text-primary"
                  : "text-[15px] font-semibold leading-tight text-foreground"
              }
            >
              {title}
            </p>
            {lines.map((line, i) => (
              <p
                key={i}
                className="mt-0.5 truncate text-[13px] leading-snug text-muted-foreground"
                title={line}
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
