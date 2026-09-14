import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import { useWeeklyTodos } from "@/lib/store";
import { isoWeek } from "@/lib/weekly-summary";

function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}

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
});

const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({
  total,
  completed,
  className,
}: {
  total: number;
  completed: number;
  className?: string;
}) {
  const pct = total === 0 ? 0 : completed / total;
  const offset = RING_CIRCUMFERENCE * (1 - pct);
  const label = total === 0 ? "0%" : `${Math.round(pct * 100)}%`;

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <svg
        className="size-12 -rotate-90"
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        <circle
          cx="24"
          cy="24"
          r={RING_RADIUS}
          className="text-muted/60"
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
        />
        <circle
          cx="24"
          cy="24"
          r={RING_RADIUS}
          className="text-gold"
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[10px] font-semibold text-foreground">
        {label}
      </span>
    </div>
  );
}

function VeckansAttGora() {
  const { t } = useLanguage();
  const hydrated = useHydrated();
  const { todos, addTodo, toggleTodo, updateTodoText, removeTodo } = useWeeklyTodos();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [quickDraft, setQuickDraft] = useState("");
  const quickInputRef = useRef<HTMLInputElement>(null);
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

  const handleAdd = (text = "") => {
    const id = addTodo(text);
    setEditingId(id);
    requestAnimationFrame(() => {
      const el = document.getElementById(`todo-input-${id}`) as HTMLInputElement | null;
      el?.focus();
    });
  };

  const commitQuickAdd = () => {
    const trimmed = quickDraft.trim();
    if (trimmed) {
      addTodo(trimmed);
    }
    setQuickDraft("");
    quickInputRef.current?.blur();
  };

  const startEditing = (id: string) => {
    setEditingId(id);
    requestAnimationFrame(() => {
      const el = document.getElementById(`todo-input-${id}`) as HTMLInputElement | null;
      el?.focus();
    });
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)] font-sans">
      {/* iOS-style navigation header */}
      <div className="relative flex items-center justify-between pb-3 pt-1">
        <BackButton
          fallbackTo="/"
          className="inline-flex h-9 items-center gap-0.5 rounded-full bg-secondary/80 px-3 text-[13px] font-normal text-primary shadow-sm backdrop-blur-sm transition-all active:scale-95 active:bg-secondary"
        >
          {t("back")}
        </BackButton>
        <div className="pointer-events-none absolute inset-x-0 top-1 flex justify-center">
          <div className="inline-flex items-center rounded-full bg-primary px-4 py-1.5 shadow-button">
            <h1 className="text-[15px] font-normal text-primary-foreground">
              {t("weeklyTodos")} {currentWeek}
            </h1>
          </div>
        </div>
        <div className="h-9 w-9" aria-hidden="true" />
      </div>

      {/* Summary header card */}
      <div className="mt-2 flex items-center justify-between rounded-2xl bg-card p-4 shadow-soft">
        <div>
          <h2 className="text-[19px] font-semibold text-foreground">
            {t("weeklyTodos")}
          </h2>
          <p className="mt-0.5 text-[13px] font-normal text-muted-foreground">
            {t("weeklyTodos")} {currentWeek} · {totalCount}
            {hydrated && (
              <>
                {" "}
                {t("weeklyTasksCount", { count: totalCount }).replace(/^\d+\s*/, "")}
              </>
            )}
          </p>
        </div>
        <ProgressRing total={totalCount} completed={completedCount} />
      </div>

      {/* Quick add */}
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border/50 bg-card px-3 py-2.5 shadow-soft">
        <div className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30" />
        <input
          ref={quickInputRef}
          type="text"
          value={quickDraft}
          onChange={(e) => setQuickDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commitQuickAdd();
            } else if (e.key === "Escape") {
              setQuickDraft("");
              quickInputRef.current?.blur();
            }
          }}
          onBlur={commitQuickAdd}
          placeholder={t("todoPlaceholder")}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-normal text-foreground outline-none placeholder:text-muted-foreground/60"
          autoComplete="off"
        />
      </div>

      {/* Active todos */}
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {t("activeTodos")}
          </h2>
          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
            {activeTodos.length}
          </span>
        </div>

        {activeTodos.length === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card px-4 py-6 text-center shadow-soft">
            <p className="text-[13px] font-normal text-muted-foreground">{t("emptyTodos")}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeTodos.map((todo, idx) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                index={idx}
                last={idx === activeTodos.length - 1}
                isEditing={editingId === todo.id}
                variant="card"
                onToggle={() => toggleTodo(todo.id)}
                onStartEdit={guard(todo.id, () => startEditing(todo.id))}
                onUpdateText={(text) => updateTodoText(todo.id, text)}
                onRemove={guard(todo.id, () => removeTodo(todo.id))}
                onFinishEdit={() => finishEdit(todo.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Completed todos */}
      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {t("completedTodos")}
          </h2>
          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
            {completedTodos.length}
          </span>
        </div>

        {completedTodos.length === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card px-4 py-4 text-center">
            <p className="text-[13px] font-normal text-muted-foreground">{t("archiveTodosEmpty")}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {completedTodos.map((todo, idx) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                index={idx}
                last={idx === completedTodos.length - 1}
                isEditing={editingId === todo.id}
                variant="compact"
                onToggle={() => toggleTodo(todo.id)}
                onStartEdit={guard(todo.id, () => startEditing(todo.id))}
                onUpdateText={(text) => updateTodoText(todo.id, text)}
                onRemove={guard(todo.id, () => removeTodo(todo.id))}
                onFinishEdit={() => finishEdit(todo.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add todo button */}
      <button
        type="button"
        onClick={() => handleAdd()}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary py-2.5 text-primary-foreground shadow-button transition-all active:scale-95 active:bg-primary/90"
      >
        <Plus className="size-4" strokeWidth={2.5} />
        <span className="text-[15px] font-normal">{t("addTodo")}</span>
      </button>
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
  onRemove,
  onFinishEdit,
}: {
  todo: { id: string; text: string; completed: boolean };
  index: number;
  last: boolean;
  isEditing: boolean;
  variant: "card" | "compact";
  onToggle: () => void;
  onStartEdit: () => void;
  onUpdateText: (text: string) => void;
  onRemove: () => void;
  onFinishEdit: () => void;
}) {
  const { t } = useLanguage();
  const delay = useMemo(() => ({ animationDelay: `${Math.min(index, 12) * 30}ms` }), [index]);
  const committedRef = useRef(false);
  const [draft, setDraft] = useState(todo.text);

  useEffect(() => {
    if (isEditing) {
      committedRef.current = false;
      setDraft(todo.text);
    }
  }, [isEditing, todo.text]);

  const commitText = (value: string) => {
    if (committedRef.current) return;
    committedRef.current = true;
    const trimmed = value.trim();
    if (!trimmed) {
      onRemove();
      onFinishEdit();
      return;
    }
    onUpdateText(trimmed);
    onFinishEdit();
  };

  if (isEditing) {
    return (
      <div
        className={cn(
          "stagger-item flex items-center gap-2 rounded-2xl border border-border/50 bg-secondary/60 px-3 py-2.5",
          variant === "card" && "shadow-soft"
        )}
        style={delay}
      >
        <div
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            todo.completed
              ? "border-completed bg-completed"
              : "border-muted-foreground/40 bg-transparent"
          )}
        >
          {todo.completed && <Check className="size-3 text-completed-foreground" strokeWidth={3} />}
        </div>
        <input
          id={`todo-input-${todo.id}`}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={todo.text ? "" : t("todoPlaceholder")}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-normal text-foreground outline-none placeholder:text-muted-foreground"
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
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            commitText(draft);
          }}
          className="shrink-0 rounded-full bg-primary px-3 py-1 text-[13px] font-normal text-primary-foreground shadow-sm transition-colors active:bg-primary/90"
        >
          {t("doneEditing")}
        </button>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "stagger-item group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors active:bg-secondary/60",
          !last && "border-b border-border/40"
        )}
        style={delay}
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-completed bg-completed transition-all active:scale-90"
          aria-checked={todo.completed}
          role="checkbox"
        >
          <Check className="size-3.5 text-completed-foreground" strokeWidth={3} />
        </button>
        <button
          type="button"
          onClick={onStartEdit}
          className="min-w-0 flex-1 truncate text-left text-[14px] font-normal text-muted-foreground line-through"
        >
          {todo.text || <span className="italic text-muted-foreground/70">{t("todoPlaceholder")}</span>}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-all active:scale-90 active:bg-destructive/10 active:text-destructive"
          aria-label={t("remove")}
        >
          <X className="size-3.5" strokeWidth={2.5} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "stagger-item group relative flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-3 shadow-soft transition-all active:scale-[0.99] active:bg-secondary/30",
        "border-l-4 border-l-gold"
      )}
      style={delay}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90",
          todo.completed
            ? "border-completed bg-completed"
            : "border-muted-foreground/40 bg-transparent"
        )}
        aria-checked={todo.completed}
        role="checkbox"
      >
        {todo.completed && <Check className="size-3.5 text-completed-foreground" strokeWidth={3} />}
      </button>
      <button
        type="button"
        onClick={onStartEdit}
        className={cn(
          "min-w-0 flex-1 truncate text-left text-[15px] font-normal transition-colors",
          todo.completed
            ? "text-muted-foreground line-through"
            : "text-foreground"
        )}
      >
        {todo.text || <span className="italic text-muted-foreground/70">{t("todoPlaceholder")}</span>}
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-all active:scale-90 active:bg-destructive/10 active:text-destructive"
        aria-label={t("remove")}
      >
        <X className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}
