import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
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

  const add = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onChange([...subtasks, { id: crypto.randomUUID(), text: trimmed, done: false }]);
    setText("");
  };

  return (
    <BottomSheet onClose={onClose} label={t("subtasks")}>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="min-w-0 truncate text-[17px] font-semibold text-foreground">{title}</h2>
          {subtasks.length > 0 && (
            <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
              {done}/{subtasks.length}
            </span>
          )}
        </div>
        <p className="-mt-2 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground/70">
          {t("subtasks")}
        </p>

        {subtasks.length === 0 ? (
          <p className="py-2 text-center text-[13px] text-muted-foreground">{t("subtasksEmpty")}</p>
        ) : (
          <ul className="flex max-h-[45vh] flex-col gap-1 overflow-y-auto">
            {subtasks.map((s) => (
              <li key={s.id} className="flex h-9 items-center gap-2 rounded-full bg-secondary/50 px-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={s.done}
                  onClick={() => onChange(subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
                  className={cn(
                    "flex size-[18px] shrink-0 items-center justify-center rounded-full transition-all active:scale-90",
                    s.done ? "bg-primary" : "border-2 border-muted-foreground/40",
                  )}
                >
                  {s.done && <Check className="size-2.5 text-primary-foreground" strokeWidth={3} />}
                </button>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[14px]",
                    s.done ? "text-muted-foreground line-through" : "text-foreground",
                  )}
                >
                  {s.text}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(subtasks.filter((x) => x.id !== s.id))}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-secondary"
                  aria-label={t("remove")}
                >
                  <X className="size-4" />
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
            className="h-10 min-w-0 flex-1 rounded-full bg-secondary/60 px-4 text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            enterKeyHint="done"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm disabled:opacity-40"
            aria-label={t("addSubtask")}
          >
            <Plus className="size-5" />
          </button>
        </form>
      </div>
    </BottomSheet>
  );
}
