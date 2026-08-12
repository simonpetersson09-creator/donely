import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Pencil,
  Home,
  Briefcase,
  MapPin,
  Timer,
} from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { cn } from "@/lib/utils";
import {
  goalKey,
  deleteCategoryData,
  useCategories,
  useEntries,
  useGoals,
  type Area,
  type Category,
  type Entry,
} from "@/lib/store";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Paywall } from "@/components/Paywall";
import { canMutate, usePremium } from "@/lib/premium";
import { categoryLabel, useLanguage, useLocale } from "@/lib/use-language";

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
        content:
          "Resultat hittills i år per kategori, med årsmål och progress för privat och jobb.",
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
  distanceKm: number;
  durationMin: number;
};

function Statistik() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [editing, setEditing] = useState<Category | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const { t } = useLanguage();
  const premium = usePremium();
  const locale = useLocale();
  const { categories } = useCategories();
  const { entries } = useEntries();
  const { goals, setGoal, removeGoal } = useGoals();

  const isCurrentYear = year === currentYear;

  const rows = useMemo(() => {
    const totals = new Map<string, number>();
    const lastAt = new Map<string, string>();
    const km = new Map<string, number>();
    const minutes = new Map<string, number>();
    for (const e of entries as Entry[]) {
      const d = new Date(e.createdAt);
      if (d.getFullYear() !== year) continue;
      totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.amount);
      if (e.distanceKm) km.set(e.categoryId, (km.get(e.categoryId) ?? 0) + e.distanceKm);
      if (e.durationMin)
        minutes.set(e.categoryId, (minutes.get(e.categoryId) ?? 0) + e.durationMin);
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
          distanceKm: km.get(c.id) ?? 0,
          durationMin: minutes.get(c.id) ?? 0,
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

  const totalActivities = useMemo(() => {
    const known = new Set(categories.map((c) => c.id));
    return entries
      .filter((e) => known.has(e.categoryId) && new Date(e.createdAt).getFullYear() === year)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [categories, entries, year]);

  const areaTotals = useMemo(
    () => ({
      privat: rows.privat.reduce((sum, r) => sum + r.total, 0),
      jobb: rows.jobb.reduce((sum, r) => sum + r.total, 0),
    }),
    [rows],
  );

  const reachedGoals = useMemo(() => {
    const reached = (arr: Row[]) =>
      arr.filter((r) => r.goal !== null && r.total >= r.goal!).length;
    return reached(rows.privat) + reached(rows.jobb);
  }, [rows]);

  const handleSetGoal = (c: Category) => {
    if (premium.loading) {
      toast.message(t("premiumLoading"));
      return;
    }
    if (!canMutate(premium)) {
      setPaywallOpen(true);
      return;
    }
    setEditing(c);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div className="flex items-center justify-between pb-1 pt-0.5">
        <BackButton
          fallbackTo="/"
          className="-ml-2 inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[15px] font-medium text-primary transition-colors active:bg-secondary"
        >
          {t("back")}
        </BackButton>

        <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
          <button
            type="button"
            aria-label={t("prevYear")}
            disabled={yearIndex >= years.length - 1}
            onClick={() => setYear(years[yearIndex + 1])}
            className="flex size-7 items-center justify-center rounded-full bg-card text-primary shadow-soft transition-transform active:scale-95 disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[3.5ch] text-center text-[15px] font-bold tabular-nums text-primary">
            {year}
          </span>
          <button
            type="button"
            aria-label={t("nextYear")}
            disabled={yearIndex <= 0}
            onClick={() => setYear(years[yearIndex - 1])}
            className="flex size-7 items-center justify-center rounded-full bg-card text-primary shadow-soft transition-transform active:scale-95 disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Link
          to="/dagsstatistik"
          className="flex items-center justify-between rounded-xl border border-border bg-card px-3.5 py-2 text-[14px] font-semibold text-primary shadow-card transition-colors active:bg-accent"
        >
          <span>{t("dailySummaryLink")}</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
        <Link
          to="/veckostatistik"
          className="flex items-center justify-between rounded-xl border border-border bg-card px-3.5 py-2 text-[14px] font-semibold text-primary shadow-card transition-colors active:bg-accent"
        >
          <span>{t("weeklySummaryLink")}</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </div>

      <h1 className="mt-2 px-1 text-center text-[22px] font-bold leading-tight tracking-[-0.03em] text-primary">
        {isCurrentYear ? t("yearSoFar", { year }) : t("yearFinal", { year })}
      </h1>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="col-span-2 rounded-2xl bg-primary px-3 py-2 text-primary-foreground shadow-card">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] opacity-75">
                {t("totalActivities")}
              </p>
              <p className="mt-0.5 text-[22px] font-bold leading-none tabular-nums">
                {totalActivities.toLocaleString(locale)}
              </p>
            </div>
            {reachedGoals > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-foreground/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">
                <Check className="size-3" />
                {reachedGoals} {t("achieved")}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-1.5 shadow-card">
          <div className="flex items-center gap-1.5">
            <div className="flex size-6 items-center justify-center rounded-full bg-accent-life-soft text-accent-life">
              <Home className="size-3" />
            </div>
            <div>
              <p className="text-[9px] font-medium text-muted-foreground">{t("private")}</p>
              <p className="text-[14px] font-bold tabular-nums text-card-foreground">
                {areaTotals.privat.toLocaleString(locale)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-1.5 shadow-card">
          <div className="flex items-center gap-1.5">
            <div className="flex size-6 items-center justify-center rounded-full bg-accent-work-soft text-accent-work">
              <Briefcase className="size-3" />
            </div>
            <div>
              <p className="text-[9px] font-medium text-muted-foreground">{t("work")}</p>
              <p className="text-[14px] font-bold tabular-nums text-card-foreground">
                {areaTotals.jobb.toLocaleString(locale)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Section
        title={`${t("private")} (${year})`}
        icon={<Home className="size-5" />}
        area="privat"
        total={areaTotals.privat}
        rows={rows.privat}
        showGoalCta={isCurrentYear}
        onSetGoal={handleSetGoal}
      />
      <Section
        title={`${t("work")} (${year})`}
        icon={<Briefcase className="size-5" />}
        area="jobb"
        total={areaTotals.jobb}
        rows={rows.jobb}
        showGoalCta={isCurrentYear}
        onSetGoal={handleSetGoal}
      />

      {rows.privat.length === 0 && rows.jobb.length === 0 && (
        <p className="mt-8 px-1 text-[15px] text-muted-foreground">
          {isCurrentYear ? t("noEntriesThisYear") : t("noEntriesYear", { year })}
        </p>
      )}

      {editing && (
        <GoalSheet
          category={editing}
          year={year}
          current={goals[goalKey(year, editing.id)] ?? null}
          onSave={(target) => {
            if (premium.loading) {
              toast.message(t("premiumLoading"));
              return;
            }
            if (!canMutate(premium)) {
              setEditing(null);
              setPaywallOpen(true);
              return;
            }
            setGoal(year, editing.id, target);
            setEditing(null);
          }}
          onRemove={() => {
            if (premium.loading) {
              toast.message(t("premiumLoading"));
              return;
            }
            if (!canMutate(premium)) {
              setEditing(null);
              setPaywallOpen(true);
              return;
            }
            removeGoal(year, editing.id);
            setEditing(null);
          }}
          onDelete={() => {
            if (premium.loading) {
              toast.message(t("premiumLoading"));
              return;
            }
            if (!canMutate(premium)) {
              setEditing(null);
              setPaywallOpen(true);
              return;
            }
            deleteCategoryData(editing.id);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {paywallOpen && <Paywall onClose={() => setPaywallOpen(false)} />}
    </main>
  );
}

function Section({
  title,
  icon,
  area,
  total,
  rows,
  showGoalCta,
  onSetGoal,
}: {
  title: string;
  icon: ReactNode;
  area: Area;
  total: number;
  rows: Row[];
  showGoalCta: boolean;
  onSetGoal: (c: Category) => void;
}) {
  const locale = useLocale();
  if (rows.length === 0) return null;
  return (
    <section className="mt-3">
      <div className="mb-1 flex flex-col items-center px-1">
        <h2 className="flex items-center gap-1.5 text-[18px] font-bold leading-tight tracking-[-0.02em] text-primary">
          {icon}
          <span>{title}</span>
        </h2>
        <span className="text-[13px] font-semibold tabular-nums text-muted-foreground">
          {total.toLocaleString(locale)}
        </span>
      </div>
      <div className="space-y-1">
        {rows.map((row) => (
          <GoalCard
            key={row.category.id}
            row={row}
            area={area}
            showGoalCta={showGoalCta}
            onSetGoal={onSetGoal}
          />
        ))}
      </div>
    </section>
  );
}

function GoalCard({
  row,
  area,
  showGoalCta,
  onSetGoal,
}: {
  row: Row;
  area: Area;
  showGoalCta: boolean;
  onSetGoal: (c: Category) => void;
}) {
  const { t } = useLanguage();
  const locale = useLocale();
  const { category, total, goal, lastAt, distanceKm, durationMin } = row;
  const pct = goal && goal > 0 ? Math.round((total / goal) * 100) : null;
  const reached = pct !== null && total >= goal!;
  const hasMetrics = distanceKm > 0 || durationMin > 0;
  const hours = Math.floor(durationMin / 60);
  const mins = Math.round(durationMin % 60);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const accentClass = area === "privat" ? "bg-accent-life" : "bg-accent-work";

  return (
    <Link
      to="/kategori/$id"
      params={{ id: category.id }}
      className="block rounded-xl border border-border bg-card px-2 py-1 text-card-foreground shadow-card transition-colors active:bg-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[9px] font-medium text-card-foreground/70">
            {categoryLabel(t, category)}
          </h3>
          <p className="text-[14px] font-bold leading-tight tabular-nums">
            {goal !== null
              ? t("ofGoal", {
                  total: total.toLocaleString(locale),
                  goal: goal.toLocaleString(locale),
                })
              : t("soFarCount", { total: total.toLocaleString(locale) })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {reached && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-1 py-0.5 text-[8px] font-semibold text-primary-foreground">
              <Check className="size-2" /> {t("achieved")}
            </span>
          )}
          {showGoalCta && (
            <button
              type="button"
              aria-label={t("changeGoalFor", { name: categoryLabel(t, category) })}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSetGoal(category);
              }}
              className="flex size-4 items-center justify-center rounded-full bg-secondary text-primary transition-colors active:bg-primary active:text-primary-foreground"
            >
              <Pencil className="size-2" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-0.5 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {distanceKm > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-1 py-0.5 text-[8px] font-medium tabular-nums text-card-foreground/80">
              <MapPin className="size-2 text-primary" />
              {distanceKm.toLocaleString(locale, { maximumFractionDigits: 1 })} km
            </span>
          )}
          {durationMin > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-1 py-0.5 text-[8px] font-medium tabular-nums text-card-foreground/80">
              <Timer className="size-2 text-primary" />
              {hours > 0 ? `${hours} h ${mins} min` : `${mins} min`}
            </span>
          )}
        </div>
        {lastAt && mounted && (
          <span className="shrink-0 rounded-full bg-secondary px-1 py-0.5 text-[8px] text-muted-foreground">
            {formatRelativeDate(lastAt, locale, t)}
          </span>
        )}
      </div>

      {pct !== null && (
        <div className="mt-1 h-[2px] w-full overflow-hidden rounded-full bg-accent">
          <div
            className={cn("h-full rounded-full transition-all duration-500", accentClass)}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}
    </Link>
  );
}

function formatRelativeDate(
  iso: string,
  locale: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
) {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const time = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  if (diffDays === 0) return t("today", { time });
  if (diffDays === 1) return t("yesterday", { time });
  if (diffDays >= 2 && diffDays <= 6) return t("daysAgo", { count: diffDays });

  return date.toLocaleDateString(locale, {
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
  onDelete,
  onClose,
}: {
  category: Category;
  year: number;
  current: number | null;
  onSave: (target: number) => void;
  onRemove: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(current !== null ? String(current) : "");
  const parsed = Number.parseInt(value, 10);
  const valid = Number.isInteger(parsed) && parsed > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label={t("close")}
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
            {t("yearGoal", { year, name: categoryLabel(t, category) })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
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
          placeholder={t("goalPlaceholder")}
          aria-label={t("goalLabel")}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-[22px] font-semibold tabular-nums outline-none focus:border-ring"
        />

        <div className={cn("mt-3 flex gap-2")}>
          {current !== null && (
            <button
              type="button"
              onClick={onRemove}
              className="flex-1 rounded-xl border border-border bg-card py-3 text-[15px] font-semibold text-primary"
            >
              {t("removeGoal")}
            </button>
          )}
          <button
            type="submit"
            disabled={!valid}
            className="flex-1 rounded-xl bg-primary py-3 text-[15px] font-semibold text-primary-foreground disabled:opacity-40"
          >
            {t("save")}
          </button>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="mt-2 w-full rounded-xl border border-destructive/30 bg-card py-3 text-[15px] font-semibold text-destructive transition-colors active:bg-destructive/10"
        >
          {t("deleteCategoryAndStats")}
        </button>
      </form>
    </div>
  );
}
