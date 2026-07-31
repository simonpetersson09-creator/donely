import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Check, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  goalKey,
  useCategories,
  useEntries,
  useGoals,
  type Area,
  type Category,
  type Entry,
} from "@/lib/store";

export const Route = createFileRoute("/statistik")({
  head: () => ({
    meta: [
      { title: "Statistik – Donely" },
      {
        name: "description",
        content:
          "Se ditt resultat hittills i år per kategori, jämför mot dina årsmål och följ utvecklingen inom privat och jobb.",
      },
      { property: "og:title", content: "Statistik – Donely" },
      {
        property: "og:description",
        content: "Resultat hittills i år per kategori, med årsmål och progress för privat och jobb.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Statistik,
});

type Row = {
  category: Category;
  total: number;
  goal: number | null;
  lastAt: string | null;
};

function Statistik() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [editing, setEditing] = useState<Category | null>(null);

  const { categories } = useCategories();
  const { entries } = useEntries();
  const { goals, setGoal, removeGoal } = useGoals();

  const isCurrentYear = year === currentYear;

  const rows = useMemo(() => {
    const totals = new Map<string, number>();
    const lastAt = new Map<string, string>();
    for (const e of entries as Entry[]) {
      const d = new Date(e.createdAt);
      if (d.getFullYear() === year) {
        totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.amount);
      }
      const prev = lastAt.get(e.categoryId);
      if (!prev || d > new Date(prev)) lastAt.set(e.categoryId, e.createdAt);
    }

    const build = (area: Area): Row[] =>
      categories
        .filter((c) => c.area === area)
        .map((c) => ({
          category: c,
          total: totals.get(c.id) ?? 0,
          goal: goals[goalKey(year, c.id)] ?? null,
          lastAt: lastAt.get(c.id) ?? null,
        }))
        .filter((r) => r.total > 0 || r.goal !== null)
        .sort((a, b) => b.total - a.total);

    return { privat: build("privat"), jobb: build("jobb") };
  }, [categories, entries, goals, year]);

  const years = useMemo(() => {
    const set = new Set<number>([currentYear]);
    for (const e of entries) set.add(new Date(e.createdAt).getFullYear());
    for (const k of Object.keys(goals)) set.add(Number(k.split(":")[0]));
    return [...set].sort((a, b) => b - a);
  }, [entries, goals, currentYear]);

  const yearIndex = years.indexOf(year);

  const totalActivities = useMemo(
    () =>
      entries
        .filter((e) => new Date(e.createdAt).getFullYear() === year)
        .reduce((sum, e) => sum + e.amount, 0),
    [entries, year],
  );


  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div className="flex items-center justify-between py-2">
        <Link
          to="/"
          className="-ml-2 inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[15px] font-medium text-primary transition-colors active:bg-secondary"
        >
          <ChevronLeft className="size-4" />
          Tillbaka
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-foreground/60">Byt år</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Föregående år"
              disabled={yearIndex >= years.length - 1}
              onClick={() => setYear(years[yearIndex + 1])}
              className="flex size-8 items-center justify-center rounded-full bg-primary text-white shadow-soft transition-transform active:scale-95 disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Nästa år"
              disabled={yearIndex <= 0}
              onClick={() => setYear(years[yearIndex - 1])}
              className="flex size-8 items-center justify-center rounded-full bg-primary text-white shadow-soft transition-transform active:scale-95 disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <h1 className="px-1 text-[28px] font-bold leading-tight tracking-[-0.03em] text-primary">
        {year} {isCurrentYear ? "hittills" : "– slutresultat"}
      </h1>

      <div className="mt-3 rounded-xl border border-border bg-card px-3.5 py-2.5 text-card-foreground shadow-card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-card-foreground/60">
          Totalt registrerade aktiviteter
        </p>
        <p className="mt-0.5 text-[26px] font-bold leading-none tabular-nums">
          {totalActivities.toLocaleString("sv-SE")}
        </p>
      </div>

      <Section title="Privat" rows={rows.privat} showGoalCta={isCurrentYear} onSetGoal={setEditing} />
      <Section title="Jobb" rows={rows.jobb} showGoalCta={isCurrentYear} onSetGoal={setEditing} />

      {rows.privat.length === 0 && rows.jobb.length === 0 && (
        <p className="mt-8 px-1 text-[15px] text-muted-foreground">
          Inga registreringar {isCurrentYear ? "i år" : `${year}`} ännu.
        </p>
      )}

      {editing && (
        <GoalSheet
          category={editing}
          year={year}
          current={goals[goalKey(year, editing.id)] ?? null}
          onSave={(target) => {
            setGoal(year, editing.id, target);
            setEditing(null);
          }}
          onRemove={() => {
            removeGoal(year, editing.id);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  );
}

function Section({
  title,
  rows,
  showGoalCta,
  onSetGoal,
}: {
  title: string;
  rows: Row[];
  showGoalCta: boolean;
  onSetGoal: (c: Category) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-1 px-1 text-[13px] font-semibold tracking-[-0.01em] text-primary/80">
        {title}
      </h2>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <GoalCard key={row.category.id} row={row} showGoalCta={showGoalCta} onSetGoal={onSetGoal} />
        ))}
      </div>
    </section>
  );
}

function GoalCard({
  row,
  showGoalCta,
  onSetGoal,
}: {
  row: Row;
  showGoalCta: boolean;
  onSetGoal: (c: Category) => void;
}) {
  const { category, total, goal, lastAt } = row;
  const pct = goal && goal > 0 ? Math.round((total / goal) * 100) : null;
  const reached = pct !== null && total >= goal!;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <article
      className={cn(
        "rounded-xl border border-border bg-card px-3.5 py-2.5 text-card-foreground shadow-card",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Link
          to="/kategori/$id"
          params={{ id: category.id }}
          className="min-w-0 flex-1 text-left"
        >
          <h3 className="truncate text-[12px] font-medium text-card-foreground/70">
            {category.name}
          </h3>
          <p className="text-[21px] font-bold leading-tight tabular-nums">
            {goal !== null
              ? `${total.toLocaleString("sv-SE")} av ${goal.toLocaleString("sv-SE")}`
              : `${total.toLocaleString("sv-SE")} hittills`}
          </p>
          {lastAt && mounted && (
            <p className="mt-0.5 text-[11px] text-card-foreground/50">
              Senast {formatDate(lastAt)}
            </p>
          )}
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          {reached && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground">
              <Check className="size-3" /> Uppnått
            </span>
          )}
          {showGoalCta && (
            <button
              type="button"
              aria-label={`Ändra årsmål för ${category.name}`}
              onClick={() => onSetGoal(category)}
              className="flex size-6 items-center justify-center rounded-full bg-secondary text-primary transition-colors active:bg-primary active:text-primary-foreground"
            >
              <Pencil className="size-3" />
            </button>
          )}
        </div>
      </div>

      {pct !== null && (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-accent">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}
    </article>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}


function GoalSheet({
  category,
  year,
  current,
  onSave,
  onRemove,
  onClose,
}: {
  category: Category;
  year: number;
  current: number | null;
  onSave: (target: number) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(current !== null ? String(current) : "");
  const parsed = Number.parseInt(value, 10);
  const valid = Number.isInteger(parsed) && parsed > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Stäng"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px] animate-in fade-in"
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSave(parsed);
        }}
        className="relative w-full max-w-md rounded-t-3xl border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-card-foreground shadow-card animate-in slide-in-from-bottom duration-200"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[18px] font-bold">
            Årsmål {year} · {category.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng"
            className="flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <input
          autoFocus
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, "").slice(0, 7))}
          placeholder="t.ex. 20"
          aria-label="Årsmål"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-[22px] font-semibold tabular-nums outline-none focus:border-ring"
        />

        <div className={cn("mt-3 flex gap-2")}>
          {current !== null && (
            <button
              type="button"
              onClick={onRemove}
              className="flex-1 rounded-xl border border-border bg-card py-3 text-[15px] font-semibold text-primary"
            >
              Ta bort mål
            </button>
          )}
          <button
            type="submit"
            disabled={!valid}
            className="flex-1 rounded-xl bg-primary py-3 text-[15px] font-semibold text-primary-foreground disabled:opacity-40"
          >
            Spara
          </button>
        </div>
      </form>
    </div>
  );
}
