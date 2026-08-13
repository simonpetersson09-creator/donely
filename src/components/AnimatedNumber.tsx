import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/use-language";
import { useReducedMotion } from "@/lib/motion";

/**
 * Numbers roll in vertically when — and only when — the value actually
 * changes. Layout is unaffected: the outgoing value is absolutely positioned
 * on top of the new one, so column widths never shift mid-animation.
 */
export function AnimatedNumber({
  value,
  className,
  duration = 280,
}: {
  value: number;
  className?: string;
  duration?: number;
}) {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [previous, setPrevious] = useState<number | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const last = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value === last.current) return;
    const from = last.current;
    last.current = value;
    if (reduced) return;
    setDirection(value >= from ? 1 : -1);
    setPrevious(from);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPrevious(null), duration);
  }, [value, reduced, duration]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const text = value.toLocaleString(locale);

  if (reduced || previous === null) {
    return <span className={cn("tabular-nums", className)}>{text}</span>;
  }

  return (
    <span
      className={cn("relative inline-block overflow-hidden align-bottom tabular-nums", className)}
      style={{ ["--num-dur" as string]: `${duration}ms` }}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 whitespace-nowrap",
          direction === 1 ? "num-roll-out-up" : "num-roll-out-down",
        )}
      >
        {previous.toLocaleString(locale)}
      </span>
      <span className={direction === 1 ? "num-roll-in-up" : "num-roll-in-down"}>{text}</span>
    </span>
  );
}
