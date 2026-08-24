import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]">

      {/* Compact header */}
      <div className="relative flex items-center justify-between pb-2 pt-1">
        <BackButton
          fallbackTo="/"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-primary transition-colors active:bg-secondary"
        >
          <span className="sr-only">{t("back")}</span>
        </BackButton>
        <div className="absolute inset-x-0 top-1 text-center">
          <h1 className="text-lg font-bold leading-tight tracking-tight text-primary">
            {t("yearlyGoals")}
          </h1>
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {currentYear}
          </p>
        </div>
        <div className="h-9 w-9" aria-hidden="true" />
      </div>

      {/* Goals list — blends with app background, blue accents */}
      <div className="mt-1 overflow-hidden rounded-2xl border border-border/50 bg-background p-1.5">
        {activeGoals.length === 0 ? (
          <div className="px-3 py-5 text-center">
            <p className="text-sm font-medium text-foreground">{t("emptyGoals")}</p>
          </div>
        ) : (
          activeGoals.map((goal, idx) => (
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
          ))
        )}

        <button
          type="button"
          onClick={handleAdd}
          className="flex w-full items-center gap-2 rounded-b-2xl px-2.5 py-2 text-primary transition-colors active:bg-secondary"
        >
          <div className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Plus className="size-4" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-bold tracking-tight">{t("addGoal")}</span>
        </button>
      </div>

      {/* Completed goals — always expanded */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-border/50 bg-background p-1.5">
        <div className="flex items-center gap-2 px-2.5 py-2">
          <span className="flex-1 text-left text-sm font-bold tracking-tight text-primary">
            {t("archive")}
          </span>
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {completedGoals.length}
          </span>
        </div>

        {completedGoals.length === 0 ? (
          <div className="border-t border-border px-3 py-4 text-center">
            <p className="text-xs font-medium text-muted-foreground">{t("archiveEmpty")}</p>
          </div>
        ) : (
          <div className="border-t border-border">
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

  if (isEditing) {
    return (
      <div
        className={cn(
          "stagger-item flex items-center gap-2 px-2.5 py-2",
          !last && "border-b border-border",
          "bg-secondary/50"
        )}
        style={delay}
      >
        <div
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            goal.completed
              ? "border-completed bg-completed"
              : "border-muted-foreground/40 bg-transparent"
          )}
        >
          {goal.completed && <Check className="size-3 text-completed-foreground" strokeWidth={3} />}
        </div>
        <input
          id={`goal-input-${goal.id}`}
          type="text"
          defaultValue={goal.text}
          placeholder={goal.text ? "" : t("yearlyGoalPlaceholder")}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
          onBlur={(e) => {
            onUpdateText(e.target.value);
            onFinishEdit();
          }}
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
          onClick={onFinishEdit}
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors active:bg-primary/90"
          aria-label={t("doneEditing")}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "stagger-item group flex items-center gap-2 px-2.5 py-2 transition-colors active:bg-secondary",
        !last && "border-b border-border"
      )}
      style={delay}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          goal.completed
            ? "border-completed bg-completed"
            : "border-muted-foreground/40 bg-transparent"
        )}
        aria-checked={goal.completed}
        role="checkbox"
      >
        {goal.completed && <Check className="size-3 text-completed-foreground" strokeWidth={3} />}
      </button>
      <button
        type="button"
        onClick={onStartEdit}
        className={cn(
          "min-w-0 flex-1 truncate text-left text-sm font-medium transition-colors",
          goal.completed
            ? "text-completed/85 line-through"
            : "text-primary"
        )}
      >
        {goal.text || <span className="italic text-muted-foreground">{t("yearlyGoalPlaceholder")}</span>}
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 active:bg-secondary active:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
        aria-label={t("remove")}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
