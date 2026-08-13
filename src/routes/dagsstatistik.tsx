import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { BackButton } from "@/components/BackButton";
import { SummaryBreakdown } from "@/components/SummaryBreakdown";
import { useCategories, useEntries } from "@/lib/store";
import { useLanguage, useLocale } from "@/lib/use-language";
import { buildDailySummary } from "@/lib/daily-summary";

export const Route = createFileRoute("/dagsstatistik")({
  head: () => ({
    meta: [
      { title: "Din dag – Donely" },
      {
        name: "description",
        content:
          "Dagens sammanfattning i Donely: antal registrerade aktiviteter per kategori och totalsumma för idag.",
      },
      { property: "og:title", content: "Din dag – Donely" },
      {
        property: "og:description",
        content: "Dagens registrerade aktiviteter per kategori, med totalsumma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dagsstatistik,
});

function Dagsstatistik() {
  const { t } = useLanguage();
  const locale = useLocale();
  const { categories } = useCategories();
  const { entries } = useEntries();

  const summary = useMemo(
    () => buildDailySummary(entries, categories, t as (key: string) => string),
    [entries, categories, t],
  );

  const dateLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    return fmt.format(summary.date);
  }, [locale, summary.date]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div className="pb-1 pt-0.5">
        <BackButton
          fallbackTo="/veckostatistik"
          className="-ml-2 inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[15px] font-medium text-primary transition-colors active:bg-secondary"
        >
          {t("back")}
        </BackButton>
      </div>

      <h1 className="mt-3 px-1 text-center text-[26px] font-bold leading-tight tracking-[-0.03em] text-primary">
        {t("dailySummaryTitle")}
      </h1>
      <p className="mt-1 px-1 text-center text-[13px] capitalize text-muted-foreground">
        {dateLabel}
      </p>

      {summary.rows.length === 0 ? (
        <p className="mt-8 px-1 text-[15px] text-muted-foreground">{t("dailySummaryEmpty")}</p>
      ) : (
        <SummaryBreakdown rows={summary.rows} />
      )}
    </main>
  );
}
