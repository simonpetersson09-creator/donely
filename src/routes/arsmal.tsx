import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import { useYearlyGoals, type YearlyGoal } from "@/lib/store";

export const Route = createFileRoute("/arsmal")({
  head: () => ({
    meta: [
      { title: "Årsmål – Donely" },
      {
        name: "description",
        content: "Sätt och följ upp dina årsmål i Donely, uppdelat i två halvår.",
      },
      { property: "og:title", content: "Årsmål – Donely" },
      {
        property: "og:description",
        content: "Sätt och följ upp dina årsmål i Donely, uppdelat i två halvår.",
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

  const { h1, h2 } = useMemo(
    () => ({
      h1: goals.filter((g) => g.halfYear === "h1"),
      h2: goals.filter((g) => g.halfYear === "h2"),
    }),
    [goals],
  );

  const currentHalfYear: "h1" | "h2" = useMemo(() => {
    const month = new Date().getMonth() + 1;
    return month <= 6 ? "h1" : "h2";
  }, []);

  const handleAdd = (halfYear: "h1" | "h2") => {
    const id = addGoal("", halfYear);
    setEditingId(id);
    // Focus next frame after render.
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

      <div className="mt-5 space-y-4">
        <HalfYearCard
          halfYear="h1"
          title={t("halfYear1")}
          range={t("halfYear1Range")}
          goals={h1}
          tone="life"
          editingId={editingId}
          onToggle={toggleGoal}
          onStartEdit={startEditing}
          onUpdateText={updateGoalText}
          onRemove={removeGoal}
          onFinishEdit={() => setEditingId(null)}
          onAdd={() => handleAdd("h1")}
          inputRef={inputRef}
        />
        <HalfYearCard
          halfYear="h2"
          title={t("halfYear2")}
          range={t("halfYear2Range")}
          goals={h2}
          tone="work"
          editingId={editingId}
          onToggle={toggleGoal}
          onStartEdit={startEditing}
          onUpdateText={updateGoalText}
          onRemove={removeGoal}
          onFinishEdit={() => setEditingId(null)}
          onAdd={() => handleAdd("h2")}
          inputRef={inputRef}
        />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
        <button
          type="button"
          onClick={() => handleAdd(currentHalfYear)}
          className="flex h-12 w-full max-w-md items-center justify-center gap-2 rounded-full bg-primary px-6 text-[16px] font-semibold text-primary-foreground shadow-button transition-transform duration-200 active:scale-[0.96]"
        >
          <Plus className="size-4" />
          <span>{t("addGoal")}</span>
        </button>
      </div>
    </main>
  );
}

function HalfYearCard({
  title,
  range,
  goals,
  tone,
  editingId,
  onToggle,
  onStartEdit,
  onUpdateText,
  onRemove,
  onFinishEdit,
  onAdd,
  inputRef,
}: {
  halfYear: "h1" | "h2";
  title: string;
  range: string;
  goals: YearlyGoal[];
  tone: "life" | "work";
  editingId: string | null;
  onToggle: (id: string) => void;
  onStartEdit: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onFinishEdit: () => void;
  onAdd: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { t } = useLanguage();
  const completed = goals.filter((g) => g.completed).length;
  const total = goals.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const badgeSoft = tone === "life" ? "bg-accent-life-soft text-accent-life" : "bg-accent-work-soft text-accent-work";
  const progressBar = tone === "life" ? "bg-accent-life" : "bg-accent-work";

  return (
    <section className="card-base overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-bold tracking-wide", badgeSoft)}>
            {title}
          </span>
          <span className="text-[12px] text-muted-foreground">{range}</span>
        </div>
        {total > 0 && (
          <span className="text-[12px] font-semibold tabular-nums text-card-foreground">
            {completed}/{total}
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn("h-full rounded-full transition-all duration-500", progressBar)}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <div className="space-y-1">
        {goals.length === 0 ? (
          <p className="py-2 text-[14px] text-muted-foreground">{t("emptyGoals")}</p>
        ) : (
          goals.map((goal) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              tone={tone}
              isEditing={editingId === goal.id}
              inputRef={inputRef}
              onToggle={() => onToggle(goal.id)}
              onStartEdit={() => onStartEdit(goal.id)}
              onUpdateText={(text) => onUpdateText(goal.id, text)}
              onRemove={() => onRemove(goal.id)}
              onFinishEdit={onFinishEdit}
            />
          ))
        )}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className={cn(
          "mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[14px] font-semibold transition-colors",
          tone === "life"
            ? "bg-accent-life-soft text-accent-life active:bg-accent-life/20"
            : "bg-accent-work-soft text-accent-work active:bg-accent-work/20",
        )}
      >
        <Plus className="size-3.5" />
        {t("addGoal")}
      </button>
    </section>
  );
}

function GoalRow({
  goal,
  tone,
  isEditing,
  inputRef,
  onToggle,
  onStartEdit,
  onUpdateText,
  onRemove,
  onFinishEdit,
}: {
  goal: YearlyGoal;
  tone: "life" | "work";
  isEditing: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onToggle: () => void;
  onStartEdit: () => void;
  onUpdateText: (text: string) => void;
  onRemove: () => void;
  onFinishEdit: () => void;
}) {
  const { t } = useLanguage();
  const accent = tone === "life" ? "bg-accent-life border-accent-life" : "bg-accent-work border-accent-work";

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-secondary/50 px-2 py-1.5">
        <div className={cn("flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-muted-foreground/40 bg-transparent")}>
          {goal.completed && <Check className="size-3 text-primary-foreground" />}
        </div>
        <input
          id={`goal-input-${goal.id}`}
          ref={inputRef}
          type="text"
          defaultValue={goal.text}
          placeholder={goal.text ? "" : t("yearlyGoalPlaceholder")}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-card-foreground outline-none placeholder:text-muted-foreground"
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
    <div className="group flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors active:bg-secondary">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
          goal.completed ? accent : "border-muted-foreground/40 bg-transparent",
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
          "min-w-0 flex-1 text-left text-[15px] transition-colors",
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
