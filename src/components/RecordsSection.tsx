import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { CategoryDot } from "@/components/CategoryDot";
import { recordHighlights, type RecordType } from "@/lib/records";
import { useCategories, useEntries } from "@/lib/store";
import { categoryLabel, useLanguage } from "@/lib/use-language";

const BEST_KEY: Record<RecordType, string> = {
  day: "recordBestDay",
  week: "recordBestWeek",
  month: "recordBestMonth",
};

/**
 * Compact "Records" list: the single best period per category, largest first.
 * Rendered only when the user has enough history for a record to be relevant.
 */
export function RecordsSection({ limit = 5 }: { limit?: number }) {
  const { t } = useLanguage();
  const { categories } = useCategories();
  const { entries } = useEntries();

  const rows = useMemo(
    () => recordHighlights(entries, categories, limit),
    [entries, categories, limit],
  );

  if (rows.length === 0) return null;

  return (
    <section className="mt-5">
      <div className="mb-1.5 flex items-center gap-1.5 px-1">
        <Trophy className="size-3.5 text-gold" />
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {t("recordsTitle")}
        </h2>
      </div>
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
                <span className="text-[16px] font-bold tabular-nums text-primary">{row.value}</span>{" "}
                {t(BEST_KEY[row.type])}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
