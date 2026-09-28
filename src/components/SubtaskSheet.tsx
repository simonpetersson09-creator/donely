import { useState } from "react";
import { Check, ListChecks, Plus, X } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import type { Subtask } from "@/lib/store";

/** Checklist of smaller steps inside a todo or goal. */
export function SubtaskSheet({
  title,
  subtasks,
  onChange,
  onClose,
}: {
  title: string;
  subtasks: Subtask[];
  onChange: (next: Subtask[]) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const done = subtasks.filter((s) => s.done).length;
  const allDone = subtasks.length > 0 && done === subtasks.length;

  const add = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onChange([...subtasks, { id: crypto.randomUUID(), text: trimmed, done: false }]);
    setText("");
  };

  return (
    <BottomSheet onClose={onClose} label={t("subtasks")}>
      <div className="flex flex-col gap-3 px-4 pb-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
          {subtasks.length > 0 && (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums transition-colors",
                allDone ? "bg-gold/15 text-gold" : "bg-secondary text-muted-foreground",
              )}
            >
              {done}/{subtasks.length}
            </span>
          )}
        </div>

        {subtasks.length > 0 ? (
          <div className="flex items-center gap-2.5">
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/70">
              {t("subtasks")}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn("h-full rounded-full transition-all duration-300 ease-out", allDone ? "bg-gold" : "bg-primary/80")}
                style={{ width: `${(done / subtasks.length) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/70">
            {t("subtasks")}
          </p>
        )}

        {subtasks.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-secondary">
              <ListChecks className="size-4 text-muted-foreground/70" />
            </span>
            <p className="max-w-[24ch] text-center text-[12.5px] text-muted-foreground">{t("subtasksEmpty")}</p>
          </div>
        ) : (
          <ul className="flex max-h-[38vh] flex-col gap-1 overflow-y-auto">
            {subtasks.map((s) => (
              <li
                key={s.id}
                className={cn(
                  "flex min-h-9 items-center gap-2.5 rounded-full px-2.5 transition-colors duration-300",
                  s.done ? "bg-gold/10" : "bg-secondary/50",
                )}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={s.done}
                  onClick={() => onChange(subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
                  className={cn(
                    "flex size-4.5 shrink-0 items-center justify-center rounded-full transition-all active:scale-90",
                    s.done ? "bg-gold shadow-[0_0_6px_rgba(202,158,44,0.4)]" : "border-2 border-muted-foreground/40",
                  )}
                >
                  {s.done && <Check className="size-2.5 text-gold-foreground" strokeWidth={3} />}
                </button>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[13px] transition-colors",
                    s.done ? "text-muted-foreground/70 line-through" : "text-foreground",
                  )}
                >
                  {s.text}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(subtasks.filter((x) => x.id !== s.id))}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors active:bg-secondary"
                  aria-label={t("remove")}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("addSubtask")}
            className="h-10 min-w-0 flex-1 rounded-full bg-secondary/60 px-3.5 text-[13px] text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
            autoComplete="off"
            enterKeyHint="done"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all active:scale-95 disabled:opacity-40"
            aria-label={t("addSubtask")}
          >
            <Plus className="size-4.5" />
          </button>
        </form>
      </div>
    </BottomSheet>
  );
}
