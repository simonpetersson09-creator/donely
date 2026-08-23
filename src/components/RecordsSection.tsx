import { useMemo, useState } from "react";
import { ChevronDown, Trophy } from "lucide-react";
import { CategoryDot } from "@/components/CategoryDot";
import { recordHighlights, recordsInPeriod, type RecordType } from "@/lib/records";
import { useCategories, useEntries } from "@/lib/store";
import { categoryLabel, useLanguage } from "@/lib/use-language";
import { useReducedMotion } from "@/lib/motion";

const BEST_KEY: Record<RecordType, string> = {
  day: "recordBestDay",
  week: "recordBestWeek",
  month: "recordBestMonth",
};

/**
 * Compact "Records" list: the single best period per category, largest first.
 * Rendered only when the user has enough history for a record to be relevant.
 * Collapsed by default; tap the header to expand.
 */
export function RecordsSection({
  limit = 5,
  period,
}: {
  limit?: number;
  /** When set, only records actually set during that period are listed. */
  period?: { type: RecordType; date: Date };
}) {
  const { t } = useLanguage();
  const { categories } = useCategories();
  const { entries } = useEntries();
  const reducedMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);

  const periodType = period?.type ?? null;
  const periodTime = period ? period.date.getTime() : null;
  const rows = useMemo(
    () =>
      periodType && periodTime !== null
        ? recordsInPeriod(entries, categories, periodType, new Date(periodTime), limit)
        : recordHighlights(entries, categories, limit),
    [entries, categories, limit, periodType, periodTime],
  );

  if (rows.length === 0) return null;

  return (
    <section className="mt-5">
      <button
        type="button"
        onClick={() => setIsOpen((s) => !s)}
        aria-expanded={isOpen}
        className="mb-1.5 flex w-full items-center justify-between px-1 py-1 text-left"
      >
        <div className="flex items-center gap-1.5">
          <Trophy className="size-3.5 text-gold" />
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {t("recordsTitle")}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[12px] text-muted-foreground">
            {isOpen ? t("recordsHide") : t("recordsShow")}
          </span>
          <ChevronDown
            className="size-4 text-muted-foreground transition-transform duration-200"
            style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </div>
      </button>
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-300 ease-out"
        style={{
          maxHeight: isOpen ? "600px" : "0px",
          opacity: isOpen ? 1 : 0,
          transitionDuration: reducedMotion ? "0ms" : undefined,
        }}
      >
        <div className="card-base divide-y divide-border/60 px-3 py-1">
          {rows.map((row) => {
            const category = categories.find((c) => c.id === row.categoryId);
            if (!category) return null;
            return (
              <div key={`${row.categoryId}-${row.type}`} className="flex items-center gap-2 py-2">
                <CategoryDot color={category.color ?? null} />
                <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-card-foreground">
                  {categoryLabel(t, category)}
                </p>
                <p className="shrink-0 text-right text-[13px] text-muted-foreground">
                  <span className="text-[16px] font-bold tabular-nums text-primary">{row.value}</span>
                  {" · "}
                  {t(BEST_KEY[row.type])}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

