import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
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
  Plus,
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
    const km = new Map<string, number>();
    const minutes = new Map<string, number>();
    for (const e of entries as Entry[]) {
      const d = new Date(e.createdAt);
      if (d.getFullYear() !== year) continue;
      totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.amount);
      if (e.distanceKm) km.set(e.categoryId, (km.get(e.categoryId) ?? 0) + e.distanceKm);
      if (e.durationMin)
        minutes.set(e.categoryId, (minutes.get(e.categoryId) ?? 0) + e.durationMin);
    }

    const build = (area: Area): Row[] =>
      categories
        .filter((c) => c.area === area)
        .map((c) => ({
          category: c,
          total: totals.get(c.id) ?? 0,
          goal: goals[goalKey(year, c.id)] ?? null,
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]">
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

      <h1 className="mt-3 px-1 text-center text-[26px] font-bold leading-tight tracking-[-0.03em] text-primary">
        {isCurrentYear ? t("yearSoFar", { year }) : t("yearFinal", { year })}
      </h1>

      {/* Överblick */}
      <div className="card-base mt-3 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {t("totalActivities")}
            </p>
            <p className="mt-0.5 text-[30px] font-bold leading-none tabular-nums text-card-foreground">
              {totalActivities.toLocaleString(locale)}
            </p>
          </div>
          {reachedGoals > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
              <Check className="size-3" />
              {reachedGoals} {t("achieved")}
            </span>
          )}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-2">
          <AreaStat
            icon={<Home className="size-3.5" />}
            label={t("private")}
            value={areaTotals.privat.toLocaleString(locale)}
            tone="life"
          />
          <AreaStat
            icon={<Briefcase className="size-3.5" />}
            label={t("work")}
            value={areaTotals.jobb.toLocaleString(locale)}
            tone="work"
          />
        </div>
      </div>

      {/* Snabblänkar */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          to="/dagsstatistik"
          className="card-base flex items-center justify-between gap-1 bg-primary px-3 py-2.5 text-[14px] font-semibold text-primary-foreground transition-colors active:bg-primary/90"
        >
          <span className="truncate">{t("dailySummaryLink")}</span>
          <ChevronRight className="size-4 shrink-0 text-primary-foreground/80" />
        </Link>
        <Link
          to="/veckostatistik"
          className="card-base flex items-center justify-between gap-1 bg-primary px-3 py-2.5 text-[14px] font-semibold text-primary-foreground transition-colors active:bg-primary/90"
        >
          <span className="truncate">{t("weeklySummaryLink")}</span>
          <ChevronRight className="size-4 shrink-0 text-primary-foreground/80" />
        </Link>
      </div>

      <Section
        title={t("private")}
        icon={<Home className="size-4" />}
        area="privat"
        rows={rows.privat}
        showGoalCta={isCurrentYear}
        onSetGoal={handleSetGoal}
      />
      <Section
        title={t("work")}
        icon={<Briefcase className="size-4" />}
        area="jobb"
        rows={rows.jobb}
        showGoalCta={isCurrentYear}
        onSetGoal={handleSetGoal}
      />

      {rows.privat.length === 0 && rows.jobb.length === 0 && (
        <p className="mt-8 px-1 text-center text-[15px] text-muted-foreground">
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

function AreaStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "life" | "work";
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-2.5 py-2">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          tone === "life"
            ? "bg-accent-life-soft text-accent-life"
            : "bg-accent-work-soft text-accent-work",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className="text-[18px] font-bold leading-none tabular-nums text-card-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  area,
  rows,
  showGoalCta,
  onSetGoal,
}: {
  title: string;
  icon: ReactNode;
  area: Area;
  rows: Row[];
  showGoalCta: boolean;
  onSetGoal: (c: Category) => void;
}) {
  const locale = useLocale();
  const { t } = useLanguage();
  if (rows.length === 0) return null;
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full",
            area === "privat"
              ? "bg-accent-life-soft text-accent-life"
              : "bg-accent-work-soft text-accent-work",
          )}
        >
          {icon}
        </span>
        <h2 className="text-[17px] font-bold leading-tight tracking-[-0.02em] text-primary">
          {title}
        </h2>
      </div>
      <div className="card-base overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_56px_56px_28px] items-center gap-2 border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>{t("activity")}</span>
          <span className="text-right">{t("done")}</span>
          <span className="text-right">{t("goal")}</span>
          <span />
        </div>
        {rows.map((row, idx) => (
          <GoalRow
            key={row.category.id}
            row={row}
            area={area}
            showGoalCta={showGoalCta}
            onSetGoal={onSetGoal}
            isLast={idx === rows.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

function GoalRow({
  row,
  area,
  showGoalCta,
  onSetGoal,
  isLast,
}: {
  row: Row;
  area: Area;
  showGoalCta: boolean;
  onSetGoal: (c: Category) => void;
  isLast: boolean;
}) {
  const { t } = useLanguage();
  const locale = useLocale();
  const { category, total, goal } = row;
  const pct = goal && goal > 0 ? Math.round((total / goal) * 100) : null;
  const reached = pct !== null && total >= goal!;

  const accentClass = area === "privat" ? "bg-accent-life" : "bg-accent-work";

  return (
    <Link
      to="/kategori/$id"
      params={{ id: category.id }}
      className={cn(
        "block transition-colors active:bg-accent",
        !isLast && "border-b border-border",
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_56px_56px_28px] items-center gap-2 px-3 py-2.5">
        <span className="min-w-0 truncate text-[14px] font-medium text-card-foreground">
          {categoryLabel(t, category)}
        </span>
        <span className="text-right text-[16px] font-bold tabular-nums text-card-foreground">
          {total.toLocaleString(locale)}
        </span>
        <span className="text-right text-[12px] tabular-nums text-muted-foreground">
          {goal !== null ? goal.toLocaleString(locale) : "—"}
        </span>
        {showGoalCta ? (
          <button
            type="button"
            aria-label={t("changeGoalFor", { name: categoryLabel(t, category) })}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSetGoal(category);
            }}
            className="flex size-6 items-center justify-center text-muted-foreground transition-colors active:text-primary"
          >
            <Pencil className="size-3" />
          </button>
        ) : (
          <span />
        )}
      </div>
      {goal !== null && (
        <div className="h-[2px] w-full bg-accent">
          <div
            className={cn("h-full transition-all duration-500", accentClass)}
            style={{ width: `${Math.min(100, pct ?? 0)}%` }}
          />
        </div>
      )}
    </Link>
  );
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
