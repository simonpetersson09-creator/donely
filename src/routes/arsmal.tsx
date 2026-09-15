import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { BottomSheet } from "@/components/BottomSheet";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import { useYearlyGoals } from "@/lib/store";
import { useSwipeDelete } from "@/hooks/use-swipe-delete";

const PRIORITIES = ["high", "medium", "low"] as const;
type Priority = (typeof PRIORITIES)[number];

function priorityLabel(t: (key: string) => string, priority: Priority) {
  if (priority === "high") return t("priorityHigh");
  if (priority === "medium") return t("priorityMedium");
  return t("priorityLow");
}

function priorityBarClass(priority: Priority) {
  if (priority === "high") return "bg-red-500/80";
  if (priority === "medium") return "bg-blue-500/80";
  return "bg-yellow-500/80";
}

function nextPriority(priority: Priority): Priority {
  if (priority === "high") return "medium";
  if (priority === "medium") return "low";
  return "high";
}

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
  const { goals, addGoal, toggleGoal, updateGoalText, removeGoal, setGoalPriority } = useYearlyGoals();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  // Add-goal popup state.
  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState("");
  const [addPriority, setAddPriority] = useState<Priority>("medium");
  // A tap that ends editing must not "fall through" to the row buttons that
  // appear in the same spot right after the row switches to display mode.
  // Per-row, so a tap-through only blocks the row that was just edited.
  const suppressRef = useRef<Record<string, number>>({});
  const guard = (id: string, fn: () => void) => () => {
    if (Date.now() < (suppressRef.current[id] ?? 0)) return;
    fn();
  };
  const finishEdit = (id: string) => {
    suppressRef.current[id] = Date.now() + 600;
    setEditingId(null);
  };
  const activeGoals = goals.filter((g) => !g.completed);
  const completedGoals = goals.filter((g) => g.completed);
  const currentYear = new Date().getFullYear();

  const openAddPopup = () => {
    setAddText("");
    setAddPriority("medium");
    setAddOpen(true);
  };

  const closeAddPopup = () => {
    setAddOpen(false);
    setAddText("");
    setAddPriority("medium");
  };

  const submitAddPopup = () => {
    const trimmed = addText.trim();
    if (!trimmed) return;
    const month = new Date().getMonth() + 1;
    const halfYear: "h1" | "h2" = month <= 6 ? "h1" : "h2";
    addGoal(trimmed, halfYear, addPriority);
    closeAddPopup();
  };

  // Groups active goals by priority. Empty groups are skipped.
  const grouped = useMemo(() => {
    const groups: { priority: Priority; items: typeof activeGoals }[] = [];
    for (const priority of PRIORITIES) {
      const items = activeGoals.filter((g) => (g.priority ?? "medium") === priority);
      if (items.length > 0) groups.push({ priority, items });
    }
    return groups;
  }, [activeGoals]);

  const startEditing = (id: string) => {
    setEditingId(id);
    requestAnimationFrame(() => {
      const el = document.getElementById(`goal-input-${id}`) as HTMLInputElement | null;
      el?.focus();
    });
  };

  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-background px-5 pt-[calc(env(safe-area-inset-top)+0.5rem)] font-sans">
      <div className="flex-1 overflow-y-auto pb-4">
        {/* iOS-style navigation header */}
        <div className="relative flex items-center justify-center pb-3 pt-1">
          <div className="pointer-events-none absolute inset-x-0 top-1 flex justify-center">
            <div className="inline-flex items-center rounded-full bg-primary px-4 py-1.5 shadow-button">
              <h1 className="text-[15px] font-normal text-primary-foreground">
                {t("yearlyGoals")} {currentYear}
              </h1>
            </div>
          </div>
        </div>


        {/* Active goals */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-primary/10 bg-background">
          <div className="flex items-center justify-center gap-1.5 bg-primary px-2 py-1.5">
            <h2 className="text-[13px] font-normal text-primary-foreground">
              {t("activeGoals")}
            </h2>
            <span className="text-[12px] font-normal tabular-nums text-primary-foreground/80">
              {activeGoals.length}
            </span>
          </div>

          {activeGoals.length === 0 ? (
            <div className="px-3 py-3 text-center">
              <p className="text-[13px] font-normal text-foreground">{t("emptyGoals")}</p>
            </div>
          ) : (
            <div className="p-0.5">
              {grouped.map((group, groupIdx) => (
                <div key={group.priority} className={groupIdx > 0 ? "mt-3" : undefined}>
                  <div className="flex items-center justify-center gap-1.5 px-2 pb-0.5">
                    <span
                      className={cn("inline-block h-3.5 w-1 rounded-full", priorityBarClass(group.priority))}
                      aria-hidden="true"
                    />
                    <span className="text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
                      {priorityLabel(t, group.priority)}
                    </span>
                    <span className="text-[11px] font-normal tabular-nums text-muted-foreground/70">
                      {group.items.length}
                    </span>
                  </div>
                  {group.items.map((goal, idx) => (
                    <GoalRow
                      key={goal.id}
                      goal={goal}
                      index={idx}
                      last={idx === group.items.length - 1}
                      isEditing={editingId === goal.id}
                      onToggle={guard(goal.id, () => toggleGoal(goal.id))}
                      onStartEdit={guard(goal.id, () => startEditing(goal.id))}
                      onUpdateText={(text) => updateGoalText(goal.id, text)}
                      onSetPriority={(priority) => setGoalPriority(goal.id, priority)}
                      onRemove={guard(goal.id, () => removeGoal(goal.id))}
                      onFinishEdit={() => finishEdit(goal.id)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed goals — collapsed by default */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-primary/10 bg-background">
          <button
            type="button"
            onClick={() => setCompletedExpanded((v) => !v)}
            className="flex w-full items-center justify-center gap-1.5 bg-gold px-2 py-1.5"
            aria-expanded={completedExpanded}
          >
            <h2 className="text-[13px] font-normal text-gold-foreground">
              {t("archive")}
            </h2>
            <span className="text-[12px] font-normal tabular-nums text-gold-foreground/80">
              {completedGoals.length}
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-gold-foreground/80 transition-transform",
                completedExpanded && "rotate-180"
              )}
            />
          </button>

          {completedExpanded && (
            <>
              {completedGoals.length === 0 ? (
                <div className="px-3 py-3 text-center">
                  <p className="text-[13px] font-normal text-foreground">{t("archiveEmpty")}</p>
                </div>
              ) : (
                <div className="p-0.5">
                  {completedGoals.map((goal, idx) => (
                    <GoalRow
                      key={goal.id}
                      goal={goal}
                      index={idx}
                      last={idx === completedGoals.length - 1}
                      isEditing={editingId === goal.id}
                      onToggle={guard(goal.id, () => toggleGoal(goal.id))}
                      onStartEdit={guard(goal.id, () => startEditing(goal.id))}
                      onUpdateText={(text) => updateGoalText(goal.id, text)}
                      onSetPriority={(priority) => setGoalPriority(goal.id, priority)}
                      onRemove={guard(goal.id, () => removeGoal(goal.id))}
                      onFinishEdit={() => finishEdit(goal.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom progress bar */}
      <div className="shrink-0 px-1 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-normal text-muted-foreground">{t("archive")}</span>
          <span className="text-[12px] font-normal tabular-nums text-muted-foreground">
            {completedGoals.length}/{goals.length}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div
            className="h-full rounded-full bg-gold transition-[width] duration-500 ease-out"
            style={{
              width: `${goals.length === 0 ? 0 : (completedGoals.length / goals.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Bottom actions: back + add goal */}
      <div className="shrink-0 mb-[calc(env(safe-area-inset-bottom)+0.5rem)] mt-2 flex items-center gap-2">
        <BackButton
          fallbackTo="/"
          className="inline-flex h-11 items-center gap-0.5 rounded-2xl bg-secondary/80 px-3 text-[13px] font-normal text-primary shadow-sm backdrop-blur-sm transition-all active:scale-95 active:bg-secondary"
        >
          {t("back")}
        </BackButton>
        <button
          type="button"
          onClick={openAddPopup}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary text-primary-foreground shadow-button transition-all active:scale-95 active:bg-primary/90"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          <span className="text-[15px] font-normal">{t("addGoal")}</span>
        </button>
      </div>

      {addOpen && (
        <BottomSheet onClose={closeAddPopup} label={t("addGoal")}>
          <div className="px-4 pb-2">
            <h2 className="text-center text-[15px] font-semibold text-foreground">{t("addGoal")}</h2>
          </div>
          <div className="px-4 pb-6 pt-2">
            <input
              ref={(el) => {
                if (el) requestAnimationFrame(() => el.focus());
              }}
              type="text"
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitAddPopup();
                if (e.key === "Escape") closeAddPopup();
              }}
              placeholder={t("yearlyGoalPlaceholder")}
              className="w-full rounded-xl border border-border bg-background px-3 py-3 text-[16px] font-normal text-foreground outline-none ring-primary focus:border-primary focus:ring-1"
            />
            <div className="mt-4">
              <p className="mb-2 text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
                {t("priority")}
              </p>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAddPriority(p)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[13px] font-medium transition-colors",
                      addPriority === p
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border bg-secondary text-foreground",
                    )}
                  >
                    <span className={cn("inline-block h-4 w-1 rounded-full", priorityBarClass(p))} />
                    {priorityLabel(t, p)}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={closeAddPopup}
                className="flex-1 rounded-xl border border-border bg-background py-3 text-[15px] font-medium text-foreground transition-colors active:bg-secondary"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={submitAddPopup}
                disabled={!addText.trim()}
                className="flex-1 rounded-xl bg-primary py-3 text-[15px] font-semibold text-primary-foreground transition-colors active:bg-primary/90 disabled:opacity-40"
              >
                {t("save")}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}
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
  onSetPriority,
  onRemove,
  onFinishEdit,
}: {
  goal: { id: string; text: string; completed: boolean; priority?: Priority };
  index: number;
  last: boolean;
  isEditing: boolean;
  onToggle: () => void;
  onStartEdit: () => void;
  onUpdateText: (text: string) => void;
  onSetPriority: (priority: Priority) => void;
  onRemove: () => void;
  onFinishEdit: () => void;
}) {
  const { t } = useLanguage();
  const delay = { animationDelay: `${Math.min(index, 12) * 30}ms` };
  const committedRef = useRef(false);
  // Controlled while editing, so a storage sync mid-typing can't wipe the field.
  const [draft, setDraft] = useState(goal.text);

  useEffect(() => {
    if (isEditing) {
      committedRef.current = false;
      setDraft(goal.text);
    }
    // Only reseed when editing starts, never on external text updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);


  // Empty rows are drafts: discard them instead of leaving a blank goal behind.
  const commitText = (value: string, { removeIfEmpty = true }: { removeIfEmpty?: boolean } = {}) => {
    if (committedRef.current) return;
    committedRef.current = true;
    const trimmed = value.trim();
    if (!trimmed) {
      // Remove before finishing: finishing arms the tap-through guard.
      if (removeIfEmpty) onRemove();
      onFinishEdit();
      return;
    }
    onUpdateText(trimmed);
    onFinishEdit();
  };

  // Reads the live input value so "Klar" never loses typed text (stale draft / ghost taps).
  const readInputValue = () => {
    const el = document.getElementById(`goal-input-${goal.id}`) as HTMLInputElement | null;
    return el?.value ?? draft;
  };

  const commitFromInput = () => {
    commitText(readInputValue(), { removeIfEmpty: false });
  };

  // Preventing default on both pointerdown and mousedown keeps the input focused
  // (no blur → no premature commit) across Chromium, Safari and iOS WKWebView.
  const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();

  // Changing priority re-groups (remounts) the row, so save the typed text first.
  const pickPriority = (p: Priority) => {
    const value = readInputValue().trim();
    if (value) onUpdateText(value);
    onSetPriority(p);
  };

  const priority = goal.priority ?? "medium";

  const PriorityIndicator = ({ className }: { className?: string }) => (
    <span
      className={cn("inline-block h-5 w-1 rounded-full", priorityBarClass(priority), className)}
      aria-hidden="true"
    />
  );

  if (isEditing) {
    return (
      <div
        className={cn(
          "stagger-item flex items-center gap-1.5 px-2 py-1",
          !last && "border-b border-primary/10",
          "bg-secondary/50"
        )}
        style={delay}
      >
        <PriorityIndicator className="shrink-0" />
        <input
          id={`goal-input-${goal.id}`}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={goal.text ? "" : t("yearlyGoalPlaceholder")}
          className="min-w-0 flex-1 bg-transparent text-[14px] font-normal text-foreground outline-none placeholder:text-muted-foreground"
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
        <div className="flex shrink-0 items-center gap-1">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onPointerDown={keepFocus}
              onMouseDown={keepFocus}
              onClick={() => pickPriority(p)}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium transition-colors",
                priority === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              )}
              aria-label={priorityLabel(t, p)}
              title={priorityLabel(t, p)}
            >
              {p === "high" ? "H" : p === "medium" ? "M" : "L"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onPointerDown={keepFocus}
          onMouseDown={keepFocus}
          onClick={commitFromInput}
          className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[13px] font-normal text-primary-foreground shadow-sm transition-colors active:bg-primary/90"
        >
          {t("doneEditing")}
        </button>
        <button
          type="button"
          onPointerDown={keepFocus}
          onMouseDown={keepFocus}
          onClick={() => {
            commitFromInput();
            onToggle();
          }}
          className={cn(
            "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            goal.completed
              ? "border-primary bg-primary"
              : "border-muted-foreground/40 bg-transparent"
          )}
          aria-label={t("doneEditing")}
        >
          {goal.completed && <Check className="size-2.5 text-primary-foreground" strokeWidth={3} />}
        </button>
      </div>
    );
  }

  const { offset, dragging, handlers, confirmDelete, shouldTriggerAction } = useSwipeDelete({
    onDelete: onRemove,
    enabled: !isEditing,
  });

  const showDelete = offset !== 0;

  return (
    <div className="relative overflow-hidden">
      {/* Swipe-revealed delete action */}
      {showDelete && (
        <div className="absolute inset-y-0 right-0 flex w-[72px] items-center justify-center bg-destructive">
          <button
            type="button"
            onClick={confirmDelete}
            className="flex size-10 items-center justify-center rounded-full bg-destructive-foreground/20 text-destructive-foreground transition-transform active:scale-90"
            aria-label={t("remove")}
          >
            <Trash2 className="size-5" strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Swipe translate lives on this wrapper; the entrance animation stays on
          the inner row so the animation's fill-mode transform never overrides it. */}
      <div
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 200ms ease-out",
          touchAction: "pan-y",
        }}
      >
      <div
        {...handlers}
        className={cn(
          "stagger-item group flex items-center gap-2 bg-background px-2 py-1 transition-colors active:bg-secondary",
          !last && "border-b border-primary/10"
        )}
        style={delay}
      >
        {!goal.completed && (
          <button
            type="button"
            onClick={() => onSetPriority(nextPriority(priority))}
            className="shrink-0 rounded p-0.5 transition-colors active:bg-secondary"
            aria-label={`${t("priority")}: ${priorityLabel(t, priority)}`}
            title={`${t("priority")}: ${priorityLabel(t, priority)}`}
          >
            <PriorityIndicator />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (shouldTriggerAction()) onStartEdit();
          }}
          className={cn(
            "min-w-0 flex-1 truncate text-left text-[14px] font-normal transition-colors",
            goal.completed ? "text-muted-foreground" : "text-primary"
          )}
        >
          <span className="relative inline-block">
            {goal.text || <span className="italic text-muted-foreground">{t("yearlyGoalPlaceholder")}</span>}
            {goal.completed && (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full text-destructive/60"
                viewBox="0 0 100 20"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <line x1="0" y1="5" x2="100" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="0" y1="15" x2="100" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </span>
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            if (shouldTriggerAction()) onToggle();
          }}
          className={cn(
            "flex size-[18px] shrink-0 items-center justify-center rounded-full transition-all active:scale-90",
            goal.completed
              ? "border-transparent bg-primary shadow-sm"
              : "border-2 border-muted-foreground/40 bg-transparent"
          )}
          aria-checked={goal.completed}
          role="checkbox"
        >
          {goal.completed && <Check className="size-2.5 text-primary-foreground" strokeWidth={3} />}
        </button>
      </div>
      </div>
    </div>
  );
}
