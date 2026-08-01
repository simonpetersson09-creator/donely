import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BackButton } from "@/components/BackButton";
import { goalKey, useCategories, useEntries, useGoals } from "@/lib/store";
import { categoryLabel, useLanguage, useLocale } from "@/lib/use-language";
import { formatKm, formatMinutes } from "@/lib/activity-metrics";

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
  const { t } = useLanguage();
  const locale = useLocale();
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
  // Optional workout metrics, summed for the current year only.
  const metrics = useMemo(() => {
    let km = 0;
    let min = 0;
    for (const e of entries) {
      if (e.categoryId !== id) continue;
      if (new Date(e.createdAt).getFullYear() !== currentYear) continue;
      km += e.distanceKm ?? 0;
      min += e.durationMin ?? 0;
    }
    return { km, min };
  }, [entries, id, currentYear]);


  const lastAt = useMemo(() => {
    let max: string | null = null;
    for (const e of entries) {
      if (e.categoryId !== id) continue;
      if (!max || new Date(e.createdAt) > new Date(max)) max = e.createdAt;
    }
    return max;
  }, [entries, id]);

  const thisYear = bars.find((b) => b.year === currentYear);
  const total = thisYear?.total ?? 0;
  const goal = thisYear?.goal ?? null;
  const pct = goal && goal > 0 ? Math.min(100, Math.round((total / goal) * 100)) : null;
  const max = Math.max(1, ...bars.map((b) => b.total));
  const active = bars.find((b) => b.year === selected) ?? null;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div className="py-2">
        <BackButton
          fallbackTo="/statistik"
          className="-ml-2 inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[15px] font-medium text-primary transition-colors active:bg-secondary"
        >
          {t("statistics")}
        </BackButton>
      </div>

      <h1 className="px-1 text-[28px] font-bold leading-tight tracking-[-0.03em] text-primary">
        {category ? categoryLabel(t, category) : t("categoryTitle")}
      </h1>

      <div className="mt-3 rounded-xl border border-border bg-card px-3.5 py-3 text-card-foreground shadow-card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-card-foreground/60">
          {t("yearSoFar", { year: currentYear })}
        </p>
        <p className="mt-0.5 text-[26px] font-bold leading-none tabular-nums">
          {goal !== null
            ? t("ofGoal", {
                total: total.toLocaleString(locale),
                goal: goal.toLocaleString(locale),
              })
            : t("soFarCount", { total: total.toLocaleString(locale) })}
        </p>
        {lastAt && mounted && (
          <p className="mt-1 text-[11px] text-card-foreground/50">
            {t("lastRegistered", { date: formatDate(lastAt, locale) })}
          </p>
        )}
        {(metrics.km > 0 || metrics.min > 0) && (
          <div className="mt-2.5 flex gap-2">
            {metrics.km > 0 && (
              <div className="flex-1 rounded-lg bg-accent px-2.5 py-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-card-foreground/60">
                  {t("distanceLabel")}
                </p>
                <p className="text-[15px] font-bold tabular-nums">
                  {formatKm(metrics.km, locale)} km
                </p>
              </div>
            )}
            {metrics.min > 0 && (
              <div className="flex-1 rounded-lg bg-accent px-2.5 py-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-card-foreground/60">
                  {t("durationLabel")}
                </p>
                <p className="text-[15px] font-bold tabular-nums">
                  {formatMinutes(metrics.min, locale)}
                </p>
              </div>
            )}
          </div>
        )}
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
          {t("developmentPerYear")}
        </p>
        <div className="rounded-xl border border-border bg-card px-3 py-4 text-card-foreground shadow-card">
          <div className="flex h-64 items-end justify-between gap-2">
            {bars.map((b) => {
              const h = Math.max(4, Math.round((b.total / max) * 100));
              const isCurrent = b.year === currentYear;
              return (
                <button
                  key={b.year}
                  type="button"
                  onClick={() => setSelected(selected === b.year ? null : b.year)}
                  aria-label={t("barA11y", { year: b.year, total: b.total })}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                >
                  <span className="text-[11px] font-semibold tabular-nums text-card-foreground/70">
                    {b.total.toLocaleString(locale)}
                  </span>
                  <span
                    style={{ height: `${h}%` }}
                    className={
                      "w-full rounded-t-md transition-all duration-500 " +
                      (isCurrent ? "bg-primary" : "bg-muted")
                    }
                  />
                  <span
                    className={
                      "text-[11px] font-medium tabular-nums " +
                      (isCurrent ? "text-primary" : "text-card-foreground/70")
                    }
                  >
                    {b.year}
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-card-foreground/50">
                    {isCurrent ? t("soFarShort") : "\u00A0"}
                  </span>
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
            {t("registeredCountLabel")}{" "}
            <span className="font-semibold tabular-nums">
              {active.total.toLocaleString(locale)}
            </span>
          </p>
          {active.goal !== null && (
            <>
              <p className="text-[14px]">
                {t("goalShort")}{" "}
                <span className="font-semibold tabular-nums">
                  {active.goal.toLocaleString(locale)}
                </span>
              </p>
              <p className="mt-1 text-[13px] text-card-foreground/70">
                {active.total >= active.goal ? t("goalReached") : t("goalNotReached")}
              </p>
            </>
          )}
        </div>
      )}
    </main>
  );
}

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
