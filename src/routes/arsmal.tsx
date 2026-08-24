import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Check, Home, Briefcase, Plus, Target, Trash2, X } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { AnimatedProgress } from "@/components/AnimatedProgress";
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

  const doneCount = (list: YearlyGoal[]) => list.filter((g) => g.completed).length;

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

      {/* Overview tiles – same shape as the statistics summary card. */}
      <div className="card-base mt-3 px-2 py-2">
        <div className="grid grid-cols-2 gap-2">
          <HalfStat
            icon={<Home className="size-3" />}
            label={t("halfYear1")}
            done={doneCount(h1)}
            total={h1.length}
            tone="life"
          />
          <HalfStat
            icon={<Briefcase className="size-3" />}
            label={t("halfYear2")}
            done={doneCount(h2)}
            total={h2.length}
            tone="work"
          />
        </div>
      </div>

      <HalfYearSection
        title={t("halfYear1")}
        icon={<Home className="size-4" />}
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
      <HalfYearSection
        title={t("halfYear2")}
        icon={<Briefcase className="size-4" />}
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

      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
        <button
          type="button"
          onClick={() => handleAdd(currentHalfYear)}
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

function HalfStat({
  icon,
  label,
  done,
  total,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  done: number;
  total: number;
  tone: "life" | "work";
}) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl bg-secondary/60 px-2 py-1.5">
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          tone === "life"
            ? "bg-accent-life-soft text-accent-life"
            : "bg-accent-work-soft text-accent-work",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 text-center">
        <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className="text-[17px] font-bold leading-none tabular-nums text-card-foreground">
          <AnimatedNumber value={done} />
          <span className="text-muted-foreground">/{total}</span>
        </p>
      </div>
    </div>
  );
}

function HalfYearSection({
  title,
  icon,
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
  title: string;
  icon: React.ReactNode;
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

  return (
    <section className="mt-3">
      <div className="mb-1.5 flex items-center gap-2 px-1">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full",
            tone === "life"
              ? "bg-accent-life-soft text-accent-life"
              : "bg-accent-work-soft text-accent-work",
          )}
        >
          {icon}
        </span>
        <h2 className="text-[17px] font-bold leading-tight tracking-[-0.02em] text-primary">
          {title}
        </h2>
        <span className="text-[12px] text-muted-foreground">{range}</span>
      </div>

      <div className="card-base overflow-hidden p-0">
        <div className="grid grid-cols-[minmax(0,1fr)_56px] items-center gap-2 border-b border-border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>{t("yearlyGoals")}</span>
          <span className="text-center">{t("done")}</span>
        </div>

        {total > 0 && (
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <AnimatedProgress
              value={pct}
              runKey={`${tone}-${total}`}
              className={tone === "life" ? "bg-accent-life" : "bg-accent-work"}
            />
            <span className="shrink-0 text-[12px] font-semibold tabular-nums text-card-foreground">
              {completed}/{total}
            </span>
          </div>
        )}

        {goals.length === 0 ? (
          <p className="px-3 py-3 text-[14px] text-muted-foreground">{t("emptyGoals")}</p>
        ) : (
          goals.map((goal, idx) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              tone={tone}
              index={idx}
              last={idx === goals.length - 1}
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

        <button
          type="button"
          onClick={onAdd}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 border-t border-border py-2.5 text-[14px] font-semibold transition-colors",
            tone === "life"
              ? "text-accent-life active:bg-accent-life-soft"
              : "text-accent-work active:bg-accent-work-soft",
          )}
        >
          <Plus className="size-3.5" />
          {t("addGoal")}
        </button>
      </div>
    </section>
  );
}

function GoalRow({
  goal,
  tone,
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
  goal: YearlyGoal;
  tone: "life" | "work";
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
  const accent = tone === "life" ? "bg-accent-life border-accent-life" : "bg-accent-work border-accent-work";
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
