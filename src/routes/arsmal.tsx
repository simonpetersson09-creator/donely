import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Plus, X } from "lucide-react";
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
  const activeGoals = goals.filter((g) => !g.completed);
  const completedGoals = goals.filter((g) => g.completed);
  const currentYear = new Date().getFullYear();

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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)] font-sans">

      {/* iOS-style navigation header */}
      <div className="relative flex items-center justify-between pb-3 pt-1">
        <BackButton
          fallbackTo="/"
          className="inline-flex h-9 items-center gap-0.5 rounded-full bg-secondary/80 px-3 text-[13px] font-semibold text-primary shadow-sm backdrop-blur-sm transition-all active:scale-95 active:bg-secondary"
        >
          {t("back")}
        </BackButton>
        <div className="pointer-events-none absolute inset-x-0 top-1 flex justify-center">
          <div className="inline-flex items-center rounded-full bg-primary px-4 py-1.5 shadow-button">
            <h1 className="text-[15px] font-bold text-primary-foreground">
              {t("yearlyGoals")} {currentYear}
            </h1>
          </div>
        </div>
        <div className="h-9 w-9" aria-hidden="true" />
      </div>

      {/* Active goals */}
      <div className="mt-2 overflow-hidden rounded-2xl border border-border/50 bg-background">
        <div className="flex items-center justify-center gap-1.5 bg-primary px-2 py-1.5">
          <h2 className="text-[13px] font-bold text-primary-foreground">
            {t("activeGoals")}
          </h2>
          <span className="text-[12px] font-semibold tabular-nums text-primary-foreground/80">
            {activeGoals.length}
          </span>
        </div>

        {activeGoals.length === 0 ? (
          <div className="px-3 py-3 text-center">
            <p className="text-[13px] font-medium text-foreground">{t("emptyGoals")}</p>
          </div>
        ) : (
          <div className="p-1">
            {activeGoals.map((goal, idx) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                index={idx}
                last={idx === activeGoals.length - 1}
                isEditing={editingId === goal.id}
                onToggle={() => toggleGoal(goal.id)}
                onStartEdit={() => startEditing(goal.id)}
                onUpdateText={(text) => updateGoalText(goal.id, text)}
                onRemove={() => removeGoal(goal.id)}
                onFinishEdit={() => setEditingId(null)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Completed goals — always expanded */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-border/50 bg-background">
        <div className="flex items-center justify-center gap-1.5 bg-primary px-2 py-1.5">
          <h2 className="text-[13px] font-bold text-primary-foreground">
            {t("archive")}
          </h2>
          <span className="text-[12px] font-semibold tabular-nums text-primary-foreground/80">
            {completedGoals.length}
          </span>
        </div>

        {completedGoals.length === 0 ? (
          <div className="px-3 py-3 text-center">
            <p className="text-[13px] font-medium text-foreground">{t("archiveEmpty")}</p>
          </div>
        ) : (
          <div className="p-1">
            {completedGoals.map((goal, idx) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                index={idx}
                last={idx === completedGoals.length - 1}
                isEditing={editingId === goal.id}
                onToggle={() => toggleGoal(goal.id)}
                onStartEdit={() => startEditing(goal.id)}
                onUpdateText={(text) => updateGoalText(goal.id, text)}
                onRemove={() => removeGoal(goal.id)}
                onFinishEdit={() => setEditingId(null)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add goal button at bottom */}
      <button
        type="button"
        onClick={handleAdd}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary py-2.5 text-primary-foreground shadow-button transition-all active:scale-95 active:bg-primary/90"
      >
        <Plus className="size-4" strokeWidth={2.5} />
        <span className="text-[15px] font-bold">{t("addGoal")}</span>
      </button>

    </main>
  );
}


function GoalRow({
  goal,
  index,
  last,
  isEditing,
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
  onToggle: () => void;
  onStartEdit: () => void;
  onUpdateText: (text: string) => void;
  onRemove: () => void;
  onFinishEdit: () => void;
}) {
  const { t } = useLanguage();
  const delay = { animationDelay: `${Math.min(index, 12) * 30}ms` };
  const committedRef = useRef(false);

  useEffect(() => {
    if (isEditing) committedRef.current = false;
  }, [isEditing]);


  // Empty rows are drafts: discard them instead of leaving a blank goal behind.
  const commitText = (value: string) => {
    if (committedRef.current) return;
    committedRef.current = true;
    const trimmed = value.trim();
    if (!trimmed) {
      onFinishEdit();
      onRemove();
      return;
    }
    onUpdateText(trimmed);
    onFinishEdit();
  };

  if (isEditing) {
    return (
      <div
        className={cn(
          "stagger-item flex items-center gap-1.5 px-2 py-1.5",
          !last && "border-b border-border",
          "bg-secondary/50"
        )}
        style={delay}
      >
        <div
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            goal.completed
              ? "border-completed bg-completed"
              : "border-muted-foreground/40 bg-transparent"
          )}
        >
          {goal.completed && <Check className="size-2.5 text-completed-foreground" strokeWidth={3} />}
        </div>
        <input
          id={`goal-input-${goal.id}`}
          type="text"
          defaultValue={goal.text}
          placeholder={goal.text ? "" : t("yearlyGoalPlaceholder")}
          className="min-w-0 flex-1 bg-transparent text-[16px] font-medium text-foreground outline-none placeholder:text-muted-foreground"
          onBlur={(e) => {
            commitText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              commitText(goal.text);
            }
          }}
          autoComplete="off"
        />
        <button
          type="button"
          onPointerDown={(e) => {
            // Commit before the input's blur fires, so the typed value is used.
            e.preventDefault();
            const el = document.getElementById(`goal-input-${goal.id}`) as HTMLInputElement | null;
            commitText(el?.value ?? goal.text);
          }}
          className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[13px] font-bold text-primary-foreground shadow-sm transition-colors active:bg-primary/90"
        >
          {t("doneEditing")}
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "stagger-item group flex items-center gap-2 px-2 py-1.5 transition-colors active:bg-secondary",
        !last && "border-b border-border"
      )}
      style={delay}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90",
          goal.completed
            ? "border-primary bg-primary shadow-sm"
            : "border-muted-foreground/40 bg-transparent"
        )}
        aria-checked={goal.completed}
        role="checkbox"
      >
        {goal.completed && <Check className="size-3 text-primary-foreground" strokeWidth={3} />}
      </button>
      <button
        type="button"
        onClick={onStartEdit}
        className={cn(
          "min-w-0 flex-1 truncate text-left text-[16px] font-medium transition-colors",
          goal.completed
            ? "text-muted-foreground line-through"
            : "text-primary"
        )}
      >
        {goal.text || <span className="italic text-muted-foreground">{t("yearlyGoalPlaceholder")}</span>}
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-all active:scale-90 active:bg-destructive/10 active:text-destructive"
        aria-label={t("remove")}
      >
        <X className="size-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
