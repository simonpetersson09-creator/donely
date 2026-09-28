import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { BottomSheet } from "@/components/BottomSheet";
import { CategoryDot } from "@/components/CategoryDot";
import { cn } from "@/lib/utils";
import { useLanguage, useLocale } from "@/lib/use-language";
import { useCategories, useEntries, useWeeklyTodos } from "@/lib/store";
import { isoWeek } from "@/lib/weekly-summary";
import { useSwipeDelete } from "@/hooks/use-swipe-delete";
import { RouteErrorRecovery } from "@/components/RouteErrorRecovery";

export const Route = createFileRoute("/veckans-att-gora")({
  head: () => ({
    meta: [
      { title: "Veckans lista – Donely" },
      {
        name: "description",
        content: "Planera och bocka av veckans uppgifter i Donely.",
      },
      { property: "og:title", content: "Veckans lista – Donely" },
      {
        property: "og:description",
        content: "Planera och bocka av veckans uppgifter i Donely.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VeckansAttGora,
  errorComponent: RouteErrorRecovery,
});

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

function VeckansAttGora() {
  const { t } = useLanguage();
  const { todos, addTodo, completeTodo, uncompleteTodo, updateTodoText, setTodoPriority, removeTodo } =
    useWeeklyTodos();
  const { categories } = useCategories();
  const { addEntry, removeEntry } = useEntries();
  const [editingId, setEditingId] = useState<string | null>(null);
  // Id of the todo waiting for the user to pick which activity gets the point.
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  // Add-task popup state.
  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState("");
  const [addPriority, setAddPriority] = useState<Priority>("medium");
  const addInputRef = useRef<HTMLInputElement | null>(null);

  const handleToggle = (id: string, completed: boolean) => {
    if (completed) {
      const entryId = uncompleteTodo(id);
      if (entryId) removeEntry(entryId);
      return;
    }
    setPendingId(id);
  };

  const handlePickCategory = (categoryId: string) => {
    const id = pendingId;
    setPendingId(null);
    if (!id) return;
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;
    const entryId = addEntry({
      area: category.area,
      categoryId: category.id,
      categoryName: category.name,
      amount: 1,
    });
    completeTodo(id, entryId);
  };

  const suppressRef = useRef<Record<string, number>>({});
  const guard = (id: string, fn: () => void) => () => {
    if (Date.now() < (suppressRef.current[id] ?? 0)) return;
    fn();
  };
  const finishEdit = (id: string) => {
    suppressRef.current[id] = Date.now() + 600;
    setEditingId(null);
  };
  const activeTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);
  const currentWeek = isoWeek(new Date());
  const totalCount = todos.length;
  const completedCount = completedTodos.length;
  const progress = totalCount === 0 ? 0 : (completedCount / totalCount) * 100;
  const allDone = totalCount > 0 && completedCount === totalCount;
  const locale = useLocale();

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
    addTodo(trimmed, addPriority);
    closeAddPopup();
  };

  const startEditing = (id: string) => {
    setEditingId(id);
    requestAnimationFrame(() => {
      const el = document.getElementById(`todo-input-${id}`) as HTMLInputElement | null;
      el?.focus();
    });
  };

  // Groups active todos by priority. Empty groups are skipped.
  const grouped = useMemo(() => {
    const groups: { priority: Priority; items: typeof activeTodos }[] = [];
    for (const priority of PRIORITIES) {
      const items = activeTodos.filter((t) => (t.priority ?? "medium") === priority);
      if (items.length > 0) groups.push({ priority, items });
    }
    return groups;
  }, [activeTodos]);

  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-background px-5 pt-[calc(env(safe-area-inset-top)+0.5rem)] font-sans">
      <div className="flex flex-1 flex-col overflow-y-auto pb-4">
        {/* iOS-style navigation header */}
        <div className="relative flex items-center justify-center pb-3 pt-1">
          <div className="pointer-events-none absolute inset-x-0 top-1 flex justify-center">
            <div className="inline-flex items-center rounded-full bg-primary px-4 py-1.5 shadow-button">
              <h1 className="text-[15px] font-normal text-primary-foreground">
                {t("weeklyTodos")} ({t("week")} {currentWeek})
              </h1>
            </div>
          </div>
        </div>


        {/* Active todos */}
        <section className="mt-8 rounded-2xl bg-background">
          {activeTodos.length === 0 ? (
            totalCount === 0 ? (
              <div className="flex flex-col items-center gap-2.5 px-3 py-7 text-center">
                <span className="flex size-10 items-center justify-center rounded-full border border-border/60 bg-secondary/40">
                  <Plus className="size-4.5 text-muted-foreground/70" strokeWidth={2} />
                </span>
                <p className="max-w-[26ch] text-[13px] font-normal text-muted-foreground">
                  {t("emptyTodos")}
                </p>
              </div>
            ) : (
              <div className="flex justify-center py-2">
                <span className="flex size-9 items-center justify-center rounded-full bg-gold shadow-gold">
                  <Check className="size-4 text-gold-foreground" strokeWidth={3} />
                </span>
              </div>
            )
          ) : (
            <div className="p-0">
              {grouped.map((group, groupIdx) => (
                <div key={group.priority} className={groupIdx > 0 ? "mt-4" : "mt-3"}>
                  <div className="flex flex-col items-center px-3 pb-1">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-[13px] font-semibold uppercase tracking-normal text-muted-foreground">
                        {priorityLabel(t, group.priority)}
                      </span>
                      <span className="text-[12px] font-normal tabular-nums text-muted-foreground/70">
                        {group.items.length}
                      </span>
                    </div>
                    <div className={cn("mt-1 h-0.5 w-14 rounded-full", priorityBarClass(group.priority))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    {group.items.map((todo, idx) => (
                      <TodoRow
                        key={todo.id}
                        todo={todo}
                        index={idx}
                        last={idx === group.items.length - 1}
                        isEditing={editingId === todo.id}
                        variant="card"
                        onToggle={() => handleToggle(todo.id, todo.completed)}
                        onStartEdit={guard(todo.id, () => startEditing(todo.id))}
                        onUpdateText={(text) => updateTodoText(todo.id, text)}
                        onSetPriority={(priority) => setTodoPriority(todo.id, priority)}
                        onRemove={guard(todo.id, () => removeTodo(todo.id))}
                        onFinishEdit={() => finishEdit(todo.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Completed todos (toggle lives in the bottom bar) */}
        {completedExpanded && (
          <section className="mt-6 rounded-2xl bg-background">
            {completedTodos.length === 0 ? (
              <div className="px-3 py-1.5 text-center">
                <p className="text-[13px] font-normal text-foreground">{t("archiveTodosEmpty")}</p>
              </div>
            ) : (
              <>
                <p className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/60">
                  {t("completedTodos")}
                </p>
                <div className="flex flex-col gap-1 p-0">
                {completedTodos.map((todo, idx) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    index={idx}
                    last={idx === completedTodos.length - 1}
                    isEditing={editingId === todo.id}
                    variant="compact"
                    onToggle={() => handleToggle(todo.id, todo.completed)}
                    onStartEdit={guard(todo.id, () => startEditing(todo.id))}
                    onUpdateText={(text) => updateTodoText(todo.id, text)}
                    onSetPriority={(priority) => setTodoPriority(todo.id, priority)}
                    onRemove={guard(todo.id, () => removeTodo(todo.id))}
                    onFinishEdit={() => finishEdit(todo.id)}
                  />
                ))}
              </div>
              </>
            )}
          </section>
        )}

        {/* Calm week overview pinned to the quiet space under the list */}
        {totalCount > 0 && (
          <div className="mt-auto pt-7">
            <WeekOverview
              locale={locale}
              line={`${t("weeklyTasksCount", { count: totalCount })} · ${t("completedTodos")} ${completedCount}/${totalCount}`}
              accent={allDone ? "gold" : "primary"}
            />
          </div>
        )}
      </div>

      {/* Bottom progress bar */}
      <div className="shrink-0 px-1 pt-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/70">
            {t("weeklyTodos")}
          </span>
          {totalCount > 0 && (
            <button
              type="button"
              onClick={() => setCompletedExpanded((v) => !v)}
              className="-mr-2 flex items-center px-2 py-2 text-[11px] font-medium text-muted-foreground transition-colors active:text-primary"
              aria-expanded={completedExpanded}
            >
              {allDone && (
                <span className="mr-1.5 flex size-4 items-center justify-center rounded-full bg-gold">
                  <Check className="size-2.5 text-gold-foreground" strokeWidth={3} />
                </span>
              )}
              {t("completedTodos")}
              <span className={cn("ml-1.5 text-[15px] font-medium", allDone ? "text-gold" : "text-primary")}>
                {completedCount}/{totalCount}
              </span>
              <ChevronDown
                className={cn(
                  "ml-1 size-3.5 text-muted-foreground/70 transition-transform",
                  completedExpanded && "rotate-180"
                )}
              />
            </button>
          )}
        </div>
        <div className="relative mt-2">
          <div className="h-[2px] w-full rounded-full bg-primary/10" aria-hidden="true" />
          <div
            className={cn(
              "absolute top-0 left-0 h-[2px] rounded-full transition-[width] duration-500 ease-out",
              allDone
                ? "bg-gold shadow-[0_0_8px_rgba(202,158,44,0.45)]"
                : "bg-primary shadow-[0_0_8px_rgba(30,58,95,0.3)]"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Bottom actions: back + add todo */}
      <div className="shrink-0 mb-[calc(env(safe-area-inset-bottom)+0.5rem)] mt-3 flex items-center gap-3">
        <BackButton
          fallbackTo="/"
          className="inline-flex h-11 flex-[0.8] items-center justify-center rounded-full bg-secondary/80 text-[14px] font-semibold text-primary shadow-sm backdrop-blur-sm transition-all active:scale-95 active:bg-secondary"
        >
          {t("back")}
        </BackButton>
        <button
          type="button"
          onClick={openAddPopup}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary text-primary-foreground shadow-button transition-all active:scale-95 active:bg-primary/90"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          <span className="text-[14px] font-semibold">{t("addTodo")}</span>
        </button>
      </div>

      {pendingId && (
        <BottomSheet onClose={() => setPendingId(null)} label={t("todoPickCategory")}>
          <div className="px-4 pb-2">
            <h2 className="text-center text-[15px] font-semibold text-foreground">
              {t("todoPickCategory")}
            </h2>
            <p className="mt-1 text-center text-[12px] font-normal text-muted-foreground">
              {t("todoPointHint")}
            </p>
          </div>
          <div className="max-h-[50vh] overflow-y-auto px-3 pb-4">
            {(["jobb", "privat"] as const).map((area) => {
              const list = categories.filter((c) => c.area === area);
              if (list.length === 0) return null;
              return (
                <div key={area} className="mt-2">
                  <p className="px-2 pb-1 text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
                    {area === "jobb" ? t("work") : t("private")}
                  </p>
                  <div className="overflow-hidden rounded-2xl border border-border/50">
                    {list.map((c, i) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handlePickCategory(c.id)}
                        className={cn(
                          "flex w-full items-center gap-2 bg-background px-3 py-2.5 text-left transition-colors active:bg-secondary",
                          i !== list.length - 1 && "border-b border-border",
                        )}
                      >
                        <CategoryDot color={c.color} />
                        <span className="min-w-0 flex-1 truncate text-[14px] font-normal text-foreground">
                          {c.name}
                        </span>
                        <span className="text-[13px] font-semibold text-gold">+1</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </BottomSheet>
      )}

      {addOpen && (
        <BottomSheet onClose={closeAddPopup} label={t("addTodo")}>
          <div className="px-4 pb-2">
            <h2 className="text-center text-[15px] font-semibold text-foreground">{t("addTodo")}</h2>
          </div>
          <div className="px-4 pb-6 pt-2">
            <input
              ref={(el) => {
                addInputRef.current = el;
                if (el) {
                  requestAnimationFrame(() => el.focus());
                }
              }}
              type="text"
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitAddPopup();
                if (e.key === "Escape") closeAddPopup();
              }}
              placeholder={t("addTodo")}
              className="w-full rounded-xl border border-border bg-background px-3 py-3 text-[16px] font-normal text-foreground outline-none ring-primary focus:border-primary focus:ring-1"
            />
            <div className="mt-4">
              <p className="mb-2 text-[12px] font-medium uppercase tracking-normal text-muted-foreground">
                {t("priority")}
              </p>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onMouseDown={(e) => e.preventDefault()}
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

function TodoRow({
  todo,
  index,
  last,
  isEditing,
  variant,
  onToggle,
  onStartEdit,
  onUpdateText,
  onSetPriority,
  onRemove,
  onFinishEdit,
}: {
  todo: { id: string; text: string; completed: boolean; priority?: Priority };
  index: number;
  last: boolean;
  isEditing: boolean;
  variant: "card" | "compact";
  onToggle: () => void;
  onStartEdit: () => void;
  onUpdateText: (text: string) => void;
  onSetPriority: (priority: Priority) => void;
  onRemove: () => void;
  onFinishEdit: () => void;
}) {
  const { t } = useLanguage();
  const delay = useMemo(() => ({ animationDelay: `${Math.min(index, 12) * 30}ms` }), [index]);
  const committedRef = useRef(false);
  const [draft, setDraft] = useState(todo.text);
  const { offset, dragging, handlers, confirmDelete, shouldTriggerAction } = useSwipeDelete({
    onDelete: onRemove,
    enabled: !isEditing,
  });

  useEffect(() => {
    if (isEditing) {
      committedRef.current = false;
      setDraft(todo.text);
    }
  }, [isEditing, todo.text]);

  const commitText = (value: string, { removeIfEmpty = true }: { removeIfEmpty?: boolean } = {}) => {
    if (committedRef.current) return;
    committedRef.current = true;
    const trimmed = value.trim();
    if (!trimmed) {
      if (removeIfEmpty) onRemove();
      onFinishEdit();
      return;
    }
    onUpdateText(trimmed);
    onFinishEdit();
  };

  // Reads the live input value so "Klar" never loses typed text (stale draft / ghost taps).
  const readInputValue = () => {
    const el = document.getElementById(`todo-input-${todo.id}`) as HTMLInputElement | null;
    return el?.value ?? draft;
  };

  const commitFromInput = () => {
    commitText(readInputValue(), { removeIfEmpty: false });
  };

  // Changing priority re-groups (remounts) the row, so save the typed text first.
  const pickPriority = (p: Priority) => {
    const value = readInputValue().trim();
    if (value) onUpdateText(value);
    onSetPriority(p);
  };

  // Preventing default on both pointerdown and mousedown keeps the input focused
  // (no blur → no premature commit) across Chromium, Safari and iOS WKWebView.
  const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();

  const priority = todo.priority ?? "medium";
  const isCompact = variant === "compact";
  const isDone = isCompact || todo.completed;

  const PriorityIndicator = ({ className }: { className?: string }) => (

    <span
      className={cn("block h-5 w-1 self-center rounded-full", priorityBarClass(priority), isDone && "opacity-40", className)}
      aria-hidden="true"
    />
  );

  if (isEditing) {
    return (
      <div
        className="stagger-item flex min-h-8 items-center gap-2 rounded-full bg-secondary/50 px-2 py-0.5"
        style={delay}
      >
        <PriorityIndicator className="shrink-0" />
        <input
          id={`todo-input-${todo.id}`}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={todo.text ? "" : t("todoPlaceholder")}
          className="min-w-0 flex-1 bg-transparent text-[14px] font-normal text-foreground outline-none placeholder:text-muted-foreground"
          onBlur={(e) => {
            commitText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              commitText(todo.text);
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
            todo.completed
              ? "border-completed bg-completed"
              : "border-muted-foreground/40 bg-transparent"
          )}
          aria-label={t("doneEditing")}
        >
          {todo.completed && <Check className="size-2.5 text-completed-foreground" strokeWidth={3} />}
        </button>
      </div>
    );
  }



  const showDelete = offset !== 0;

  return (
      <div
        className={cn(
          "relative h-8 overflow-hidden rounded-full",
          isDone
            ? "bg-muted/10"
            : priority === "high"
              ? "bg-red-500/[0.11]"
              : priority === "medium"
                ? "bg-blue-500/[0.09]"
                : "bg-yellow-500/[0.13]",
        )}
      >
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
        role="button"
        tabIndex={0}
        onClick={() => {
          if (offset === 0 && shouldTriggerAction()) onStartEdit();
        }}
        className={cn(
          "stagger-item group flex h-8 w-full items-center gap-2 rounded-[inherit] bg-transparent px-3 py-1 transition-colors active:bg-secondary/50",
          isCompact && "active:bg-muted/60"
        )}
        style={delay}
      >
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onSetPriority(nextPriority(priority));
          }}
          className="flex shrink-0 items-center justify-center rounded p-0.5 transition-colors active:bg-secondary"
          aria-label={`${t("priority")}: ${priorityLabel(t, priority)}`}
          title={`${t("priority")}: ${priorityLabel(t, priority)}`}
        >
          <PriorityIndicator />
        </button>
        <div
          className={cn(
            "min-w-0 flex-1 truncate text-left transition-colors",
            // Weight and tint scale with priority: bold/high-contrast for Hög,
            // progressively lighter for Medel and Låg.
            isDone
              ? "text-[13px] font-normal text-muted-foreground/40"
              : priority === "high"
                ? "text-[14.5px] font-bold tracking-[-0.02em] text-primary"
                : priority === "medium"
                  ? "text-[14.5px] font-semibold tracking-[-0.01em] text-primary/90"
                  : "text-[14.5px] font-medium tracking-normal text-primary/75"
          )}
        >
          <span className="relative inline-block">
            {todo.text || <span className="italic text-muted-foreground">{t("todoPlaceholder")}</span>}
            {isDone && (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full text-destructive/20"
                viewBox="0 0 100 20"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <line x1="0" y1="5" x2="100" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="0" y1="15" x2="100" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </span>
        </div>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (shouldTriggerAction()) onToggle();
          }}
            className={cn(
              "flex size-[18px] shrink-0 items-center justify-center rounded-full transition-all active:scale-90",
              isDone
                ? "border-transparent bg-primary/30"
                : "border-2 border-muted-foreground/40 bg-transparent"
            )}
            aria-checked={todo.completed}
            role="checkbox"
          >
            {isDone && (
            <Check className="size-2.5 text-primary-foreground/80" strokeWidth={3} />
          )}
        </button>
      </div>
      </div>
    </div>
  );
}
