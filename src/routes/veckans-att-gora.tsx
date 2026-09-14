import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import { useWeeklyTodos } from "@/lib/store";
import { isoWeek } from "@/lib/weekly-summary";

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

function VeckansAttGora() {
  const { t } = useLanguage();
  const { todos, addTodo, toggleTodo, updateTodoText, removeTodo } = useWeeklyTodos();
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const handleAdd = (text = "") => {
    const id = addTodo(text);
    setEditingId(id);
    requestAnimationFrame(() => {
      const el = document.getElementById(`todo-input-${id}`) as HTMLInputElement | null;
      el?.focus();
    });
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

      {/* Compact weekly overview */}
      <section className="mt-2 px-1" aria-labelledby="week-heading">
        <div className="flex items-center justify-between">
          <h2 id="week-heading" className="text-[13px] font-normal text-foreground">
            {t("weeklyTodos")} {currentWeek}
          </h2>
          <span className="text-[12px] font-normal tabular-nums text-muted-foreground">
            {completedCount}/{totalCount}
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div
            className="h-full rounded-full bg-gold transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      {/* Active todos */}
      <section className="mt-3 overflow-hidden rounded-2xl border border-border/50 bg-background">
        <div className="flex items-center justify-center gap-1.5 bg-primary px-2 py-1.5">
          <h2 className="text-[13px] font-normal text-primary-foreground">
            {t("activeTodos")}
          </h2>
          <span className="text-[12px] font-normal tabular-nums text-primary-foreground/80">
            {activeTodos.length}
          </span>
        </div>

        {activeTodos.length === 0 ? (
          <div className="px-3 py-3 text-center">
            <p className="text-[13px] font-normal text-foreground">{t("emptyTodos")}</p>
          </div>
        ) : (
          <div className="p-1">
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
      </section>

      {/* Completed todos */}
      <section className="mt-3 overflow-hidden rounded-2xl border border-border/50 bg-background">
        <div className="flex items-center justify-center gap-1.5 bg-primary px-2 py-1.5">
          <h2 className="text-[13px] font-normal text-primary-foreground">
            {t("completedTodos")}
          </h2>
          <span className="text-[12px] font-normal tabular-nums text-primary-foreground/80">
            {completedTodos.length}
          </span>
        </div>

        {completedTodos.length === 0 ? (
          <div className="px-3 py-3 text-center">
            <p className="text-[13px] font-normal text-foreground">{t("archiveTodosEmpty")}</p>
          </div>
        ) : (
          <div className="p-1">
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
      </section>

      {/* Add todo button */}
      <button
        type="button"
        onClick={() => handleAdd()}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary py-2.5 text-primary-foreground shadow-button transition-all active:scale-95 active:bg-primary/90"
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
          "stagger-item flex items-center gap-1.5 bg-secondary/50 px-2 py-1.5",
          !last && "border-b border-border",
        )}
        style={delay}
      >
        <div
          className={cn(
            "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            todo.completed
              ? "border-completed bg-completed"
              : "border-muted-foreground/40 bg-transparent"
          )}
        >
          {todo.completed && <Check className="size-2.5 text-completed-foreground" strokeWidth={3} />}
        </div>
        <input
          id={`todo-input-${todo.id}`}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={todo.text ? "" : t("todoPlaceholder")}
          className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-foreground outline-none placeholder:text-muted-foreground"
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
          className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[13px] font-normal text-primary-foreground shadow-sm transition-colors active:bg-primary/90"
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
          "stagger-item group flex items-center gap-2 px-2 py-1.5 transition-colors active:bg-secondary",
          !last && "border-b border-border"
        )}
        style={delay}
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex size-[18px] shrink-0 items-center justify-center rounded-full border-transparent bg-gradient-gold shadow-sm transition-all active:scale-90"
          aria-checked={todo.completed}
          role="checkbox"
        >
          <Check className="size-2.5 text-gold-foreground" strokeWidth={3} />
        </button>
        <button
          type="button"
          onClick={onStartEdit}
          className="min-w-0 flex-1 truncate text-left text-[14px] font-normal text-muted-foreground line-through decoration-border"
        >
          {todo.text || <span className="italic text-muted-foreground">{t("todoPlaceholder")}</span>}
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

  return (
    <div
      className={cn(
        "stagger-item group flex items-center gap-2 px-2 py-1.5 transition-colors active:bg-secondary",
        !last && "border-b border-border",
      )}
      style={delay}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90",
          todo.completed
            ? "border-transparent bg-gradient-gold shadow-sm"
            : "border-muted-foreground/40 bg-transparent"
        )}
        aria-checked={todo.completed}
        role="checkbox"
      >
        {todo.completed && <Check className="size-2.5 text-gold-foreground" strokeWidth={3} />}
      </button>
      <button
        type="button"
        onClick={onStartEdit}
        className={cn(
          "min-w-0 flex-1 truncate text-left text-[14px] font-semibold transition-colors",
          todo.completed
            ? "font-normal text-muted-foreground line-through"
            : "text-primary"
        )}
      >
        {todo.text || <span className="italic text-muted-foreground">{t("todoPlaceholder")}</span>}
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
