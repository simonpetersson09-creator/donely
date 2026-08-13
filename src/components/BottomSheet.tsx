import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/motion";

/**
 * iOS-style bottom sheet: springs up from the bottom, dims the page behind it
 * and can be flicked away with a downward swipe on the grab handle. The exit
 * animation runs before `onClose` fires so the sheet never disappears abruptly.
 */
export function BottomSheet({
  onClose,
  children,
  className,
  label,
}: {
  onClose: () => void;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const reduced = useReducedMotion();
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);
  const start = useRef<{ y: number; t: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Freezes the page behind the sheet so the background can't scroll away.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previous;
    };
  }, []);

  const requestClose = useCallback(() => {
    if (closing) return;
    if (reduced) {
      onClose();
      return;
    }
    setClosing(true);
    setTimeout(onClose, 200);
  }, [closing, onClose, reduced]);

  const onTouchStart = (e: React.TouchEvent) => {
    start.current = { y: e.touches[0].clientY, t: Date.now() };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return;
    const dy = e.touches[0].clientY - start.current.y;
    setDrag(dy > 0 ? dy : dy / 4);
  };

  const onTouchEnd = () => {
    const from = start.current;
    start.current = null;
    const height = panel.current?.offsetHeight ?? 400;
    const velocity = from ? drag / Math.max(1, Date.now() - from.t) : 0;
    if (drag > Math.min(120, height * 0.28) || velocity > 0.6) {
      requestClose();
    } else {
      setDrag(0);
    }
  };

  const dragging = start.current !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label={label}
        onClick={requestClose}
        className={cn(
          "absolute inset-0 bg-foreground/30 backdrop-blur-[2px]",
          !reduced && (closing ? "sheet-scrim-out" : "sheet-scrim-in"),
        )}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-card",
          !reduced && !dragging && (closing ? "sheet-out" : "sheet-in"),
          className,
        )}
        style={{
          transform: drag !== 0 ? `translateY(${drag}px)` : undefined,
          transition: dragging || reduced ? "none" : "transform 260ms cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="flex shrink-0 cursor-grab justify-center pb-1 pt-2 active:cursor-grabbing"
          style={{ touchAction: "none" }}
        >
          <span className="h-1 w-10 rounded-full bg-border" />
        </div>
        {children}
      </div>
    </div>
  );
}
