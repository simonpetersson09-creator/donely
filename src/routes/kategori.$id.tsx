import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { goalKey, useCategories, useEntries, useGoals } from "@/lib/store";

export const Route = createFileRoute("/kategori/$id")({
  head: () => ({
    meta: [
      { title: "Kategoriöversikt – Donely" },
      {
        name: "description",
        content:
          "Se resultat per år för en kategori, jämför mot årsmålet och följ utvecklingen över de fem senaste åren.",
      },
      { property: "og:title", content: "Kategoriöversikt – Donely" },
      {
        property: "og:description",
        content: "Årsvis stapeldiagram och progress mot årsmål för din kategori.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CategoryDetail,
});

function CategoryDetail() {
  const { id } = Route.useParams();
  const currentYear = new Date().getFullYear();
  const { categories } = useCategories();
  const { entries } = useEntries();
  const { goals } = useGoals();
  const [selected, setSelected] = useState<number | null>(null);

  const category = categories.find((c) => c.id === id) ?? null;

  const bars = useMemo(() => {
    const totals = new Map<number, number>();
    for (const e of entries) {
      if (e.categoryId !== id) continue;
      const y = new Date(e.createdAt).getFullYear();
      totals.set(y, (totals.get(y) ?? 0) + e.amount);
    }
    const years = new Set<number>(totals.keys());
    for (const k of Object.keys(goals)) {
      const [y, cid] = k.split(":");
      if (cid === id) years.add(Number(y));
    }
    years.add(currentYear);

    return [...years]
      .sort((a, b) => a - b)
      .slice(-5)
      .map((year) => ({
        year,
        total: totals.get(year) ?? 0,
        goal: goals[goalKey(year, id)] ?? null,
      }));
  }, [entries, goals, id, currentYear]);

  const thisYear = bars.find((b) => b.year === currentYear);
  const total = thisYear?.total ?? 0;
  const goal = thisYear?.goal ?? null;
  const pct = goal && goal > 0 ? Math.min(100, Math.round((total / goal) * 100)) : null;
  const max = Math.max(1, ...bars.map((b) => b.total));
  const active = bars.find((b) => b.year === selected) ?? null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div className="py-2">
        <Link
          to="/statistik"
          className="-ml-2 inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[15px] font-medium text-primary transition-colors active:bg-secondary"
        >
          <ChevronLeft className="size-4" />
          Statistik
        </Link>
      </div>

      <h1 className="px-1 text-[28px] font-bold leading-tight tracking-[-0.03em] text-primary">
        {category ? category.name : "Kategori"}
      </h1>

      <div className="mt-3 rounded-xl border border-border bg-card px-3.5 py-3 text-card-foreground shadow-card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-card-foreground/60">
          {currentYear} hittills
        </p>
        <p className="mt-0.5 text-[26px] font-bold leading-none tabular-nums">
          {goal !== null
            ? `${total.toLocaleString("sv-SE")} av ${goal.toLocaleString("sv-SE")}`
            : `${total.toLocaleString("sv-SE")} hittills`}
        </p>
        {pct !== null && (
          <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-accent">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      <section className="mt-5">
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/60">
          Per år
        </p>
        <div className="rounded-xl border border-border bg-card px-3 py-3 text-card-foreground shadow-card">
          <div className="flex h-44 items-end justify-between gap-2">
            {bars.map((b) => {
              const h = Math.max(4, Math.round((b.total / max) * 100));
              const isActive = selected === b.year;
              return (
                <button
                  key={b.year}
                  type="button"
                  onClick={() => setSelected(isActive ? null : b.year)}
                  aria-label={`${b.year}: ${b.total} registrerade`}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                >
                  <span className="text-[11px] font-semibold tabular-nums text-card-foreground/70">
                    {b.total.toLocaleString("sv-SE")}
                  </span>
                  <span
                    style={{ height: `${h}%` }}
                    className={
                      "w-full rounded-t-md transition-all duration-500 " +
                      (isActive ? "bg-primary" : "bg-primary/50")
                    }
                  />
                  <span className="text-[11px] font-medium tabular-nums text-card-foreground/70">
                    {b.year}
                  </span>
                  {b.year === currentYear && (
                    <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-card-foreground/50">
                      Hittills
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {active && (
        <div className="mt-3 rounded-xl border border-border bg-card px-3.5 py-3 text-card-foreground shadow-card">
          <p className="text-[15px] font-bold">{active.year}</p>
          <p className="mt-1 text-[14px]">
            Registrerat: <span className="font-semibold tabular-nums">{active.total.toLocaleString("sv-SE")}</span>
          </p>
          {active.goal !== null && (
            <>
              <p className="text-[14px]">
                Årsmål: <span className="font-semibold tabular-nums">{active.goal.toLocaleString("sv-SE")}</span>
              </p>
              <p className="mt-1 text-[13px] text-card-foreground/70">
                {active.total >= active.goal ? "Målet uppnåddes." : "Målet uppnåddes inte."}
              </p>
            </>
          )}
        </div>
      )}
    </main>
  );
}
