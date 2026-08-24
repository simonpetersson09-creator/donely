import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import { useYearlyGoals } from "@/lib/store";

export const Route = createFileRoute("/arsmal")({
  head: () => ({
    meta: [
      { title: "Årsmål – Donely" },
      {
        name: "description",
        content: "Sätt och följ upp dina årsmål i Donely.",
      },
      { property: "og:title", content: "Årsmål – Donely" },
      {
        property: "og:description",
        content: "Sätt och följ upp dina årsmål i Donely.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Arsmal,
});

function Arsmal() {
  const { t } = useLanguage();
  const { goals, addGoal, toggleGoal, updateGoalText, removeGoal } = useYearlyGoals();
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const month = new Date().getMonth() + 1;
    const halfYear: "h1" | "h2" = month <= 6 ? "h1" : "h2";
    const id = addGoal("", halfYear);
    setEditingId(id);
    requestAnimationFrame(() => {
      const el = document.getElementById(`goal-input-${id}`) as HTMLInputElement | null;
      el?.focus();
    });
  };

  const startEditing = (id: string) => {
    setEditingId(id);
    requestAnimationFrame(() => {
      const el = document.getElementById(`goal-input-${id}`) as HTMLInputElement | null;
      el?.focus();
    });
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div className="pb-1 pt-0.5">
        <BackButton
          fallbackTo="/"
          className="-ml-2 inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[15px] font-medium text-primary transition-colors active:bg-secondary"
        >
          {t("back")}
        </BackButton>
      </div>

      <div className="mt-3 px-1 text-center">
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.03em] text-primary">
          {t("yearlyGoals")}
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{t("yearlyGoalsSubtitle")}</p>
      </div>

      <div className="card-base mt-3 overflow-hidden p-0">
        {goals.length === 0 ? (
          <p className="px-3 py-3 text-[14px] text-muted-foreground">{t("emptyGoals")}</p>
        ) : (
          goals.map((goal, idx) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              index={idx}
              last={idx === goals.length - 1}
              isEditing={editingId === goal.id}
              inputRef={inputRef}
              onToggle={() => toggleGoal(goal.id)}
              onStartEdit={() => startEditing(goal.id)}
              onUpdateText={(text) => updateGoalText(goal.id, text)}
              onRemove={() => removeGoal(goal.id)}
              onFinishEdit={() => setEditingId(null)}
            />
          ))
        )}

        <button
          type="button"
          onClick={handleAdd}
          className="flex w-full items-center justify-center gap-1.5 border-t border-border py-2.5 text-[14px] font-semibold text-primary transition-colors active:bg-secondary"
        >
          <Plus className="size-3.5" />
          {t("addGoal")}
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex h-12 w-full max-w-md items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground shadow-button transition-transform duration-200 active:scale-[0.98]"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-primary-foreground/15 ring-1 ring-primary-foreground/25">
            <Plus className="size-4" />
          </span>
          {t("addGoal")}
        </button>
      </div>
    </main>
  );
}

function GoalRow({
  goal,
  index,
  last,
  isEditing,
  inputRef,
  onToggle,
  onStartEdit,
  onUpdateText,
  onRemove,
  onFinishEdit,
}: {
  goal: { id: string; text: string; completed: boolean };
  index: number;
  last: boolean;
  isEditing: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onToggle: () => void;
  onStartEdit: () => void;
  onUpdateText: (text: string) => void;
  onRemove: () => void;
  onFinishEdit: () => void;
}) {
  const { t } = useLanguage();
  const rowClass = cn("stagger-item px-3 py-1.5", !last && "border-b border-border");
  const delay = { animationDelay: `${Math.min(index, 12) * 30}ms` };

  if (isEditing) {
    return (
      <div className={cn(rowClass, "flex items-center gap-2 bg-secondary/50")} style={delay}>
        <div className="flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-muted-foreground/40 bg-transparent">
          {goal.completed && <Check className="size-3 text-primary-foreground" />}
        </div>
        <input
          id={`goal-input-${goal.id}`}
          ref={inputRef}
          type="text"
          defaultValue={goal.text}
          placeholder={goal.text ? "" : t("yearlyGoalPlaceholder")}
          className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-card-foreground outline-none placeholder:text-muted-foreground"
          onBlur={(e) => onUpdateText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onUpdateText(e.currentTarget.value);
              onFinishEdit();
            } else if (e.key === "Escape") {
              onUpdateText(goal.text);
              onFinishEdit();
            }
          }}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => onRemove()}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-destructive transition-colors active:bg-destructive/10"
          aria-label={t("remove")}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn(rowClass, "group flex items-center gap-2 transition-colors active:bg-secondary")} style={delay}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
          goal.completed ? "bg-primary border-primary" : "border-muted-foreground/40 bg-transparent",
        )}
        aria-checked={goal.completed}
        role="checkbox"
      >
        {goal.completed && <Check className="size-3 text-primary-foreground" />}
      </button>
      <button
        type="button"
        onClick={onStartEdit}
        className={cn(
          "min-w-0 flex-1 truncate text-left text-[14px] font-medium transition-colors",
          goal.completed ? "text-muted-foreground line-through" : "text-card-foreground",
        )}
      >
        {goal.text || <span className="italic text-muted-foreground">{t("yearlyGoalPlaceholder")}</span>}
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 active:bg-secondary active:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
        aria-label={t("remove")}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
