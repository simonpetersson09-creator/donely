import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import type { Subtask } from "@/lib/store";

/**
 * Indented checklist rendered directly under a parent todo or goal card.
 * Tapping a row opens the subtask sheet; the small check toggles inline.
 */
export function InlineSubtasks({
  subtasks,
  onToggle,
  onOpen,
  faded,
}: {
  subtasks: Subtask[];
  onToggle: (id: string) => void;
  onOpen: () => void;
  faded?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="ml-7 flex flex-col gap-1 pb-1.5 pr-2">
      {subtasks.map((s) => (
        <div
          key={s.id}
          role="button"
          tabIndex={0}
          onClick={onOpen}
          className={cn(
            "flex h-6.5 items-center gap-2 rounded-full bg-background/40 pl-1.5 pr-3 text-left transition-colors active:bg-background/60",
            faded && "opacity-60",
          )}
        >
          <button
            type="button"
            role="checkbox"
            aria-checked={s.done}
            aria-label={s.text}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(s.id);
            }}
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full transition-all active:scale-90",
              s.done ? "bg-gold/90" : "border-[1.5px] border-muted-foreground/30",
            )}
          >
            {s.done && <Check className="size-2 text-gold-foreground" strokeWidth={3.5} />}
          </button>
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[12px] leading-tight transition-colors",
              s.done ? "text-muted-foreground/40 line-through" : "text-foreground/85",
            )}
          >
            {s.text}
          </span>
        </div>
      ))}
    </div>
  );
}
