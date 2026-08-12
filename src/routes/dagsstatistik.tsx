import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { MapPin, Timer } from "lucide-react";
import { BackButton } from "@/components/BackButton";
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
          fallbackTo="/statistik"
          className="-ml-2 inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[15px] font-medium text-primary transition-colors active:bg-secondary"
        >
          {t("back")}
        </BackButton>
      </div>

      <h1 className="px-1 text-[28px] font-bold leading-tight tracking-[-0.03em] text-primary">
        {t("dailySummaryTitle")}
      </h1>
      <p className="mt-1 px-1 text-[13px] capitalize text-muted-foreground">{dateLabel}</p>

      {summary.rows.length === 0 ? (
        <p className="mt-8 px-1 text-[15px] text-muted-foreground">{t("dailySummaryEmpty")}</p>
      ) : (
        <div className="mt-4 space-y-1.5">
          {summary.rows.map((row) => {
            const hasMetrics = row.distanceKm > 0 || row.durationMin > 0;
            const hours = Math.floor(row.durationMin / 60);
            const mins = Math.round(row.durationMin % 60);
            return (
              <div
                key={row.id}
                className="rounded-xl border border-border bg-card px-3.5 py-3 text-card-foreground shadow-card"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-[15px] font-medium">{row.label}</span>
                  <span className="shrink-0 text-[17px] font-bold tabular-nums">
                    {row.total.toLocaleString(locale)}
                  </span>
                </div>
                {hasMetrics && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {row.distanceKm > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[12px] font-medium tabular-nums text-card-foreground/80">
                        <MapPin className="size-3 text-primary" />
                        {row.distanceKm.toLocaleString(locale, { maximumFractionDigits: 1 })} km
                      </span>
                    )}
                    {row.durationMin > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[12px] font-medium tabular-nums text-card-foreground/80">
                        <Timer className="size-3 text-primary" />
                        {hours > 0 ? `${hours} h ${mins} min` : `${mins} min`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 rounded-xl bg-primary px-3.5 py-3 text-center shadow-card">
        <p className="text-[15px] font-semibold text-primary-foreground">
          {t("dailySummaryTotal", { count: summary.total })}
        </p>
      </div>
    </main>
  );
}
