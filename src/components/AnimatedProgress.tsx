import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/motion";

/**
 * Progress fill that grows from 0 when the view (or the selected period)
 * mounts. `runKey` controls when the intro animation replays — small data
 * updates only glide the width, they don't restart from zero.
 */
export function AnimatedProgress({
  value,
  className,
  runKey,
}: {
  value: number;
  className?: string;
  runKey?: string | number;
}) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setWidth(value);
      return;
    }
    setWidth(0);
    const id = requestAnimationFrame(() => setWidth(value));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, reduced]);

  useEffect(() => {
    if (width !== 0 || reduced) setWidth(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="h-[6px] w-full overflow-hidden rounded-full bg-accent">
      <div
        className={cn("h-full rounded-full", className)}
        style={{
          width: `${Math.min(100, Math.max(0, width))}%`,
          transition: reduced ? "none" : "width 420ms cubic-bezier(0.32,0.72,0,1)",
        }}
      />
    </div>
  );
}
