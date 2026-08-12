import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/BackButton";
import { SummaryBreakdown } from "@/components/SummaryBreakdown";
import { useCategories, useEntries } from "@/lib/store";
import { useLanguage, useLocale } from "@/lib/use-language";
import { buildWeeklySummary } from "@/lib/weekly-summary";

export const Route = createFileRoute("/veckostatistik")({
  head: () => ({
    meta: [
      { title: "Din vecka – Donely" },
      {
        name: "description",
        content:
          "Veckans sammanfattning i Donely: antal registrerade aktiviteter per kategori och totalsumma för den aktuella veckan.",
      },
      { property: "og:title", content: "Din vecka – Donely" },
      {
        property: "og:description",
        content: "Veckans registrerade aktiviteter per kategori, med totalsumma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Veckostatistik,
});

function Veckostatistik() {
  const { t } = useLanguage();
  const locale = useLocale();
  const { categories } = useCategories();
  const { entries } = useEntries();

  const summary = useMemo(
    () => buildWeeklySummary(entries, categories, t as (key: string) => string),
    [entries, categories, t],
  );

  const range = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    return `${fmt.format(summary.start)} – ${fmt.format(summary.end)}`;
  }, [locale, summary.start, summary.end]);

  const workRows = useMemo(
    () =>
      summary.rows.filter((r) => {
        const category = categories.find((c) => c.id === r.id);
        // Endast jobb-kategorier ska kunna delas som jobbsammanställning.
        return category?.area === "jobb";
      }),
    [summary.rows, categories],
  );

  const shareWork = () => {
    // Dubbelkolla att inga privat-rader har slunkit med.
    const onlyJobbRows = workRows.filter((r) => {
      const category = categories.find((c) => c.id === r.id);
      return category?.area === "jobb";
    });

    if (onlyJobbRows.length === 0) {
      toast(t("shareWorkSummaryEmpty"));
      return;
    }

    const lines = onlyJobbRows.map((r) => `• ${r.label}: ${r.total}`);
    const total = onlyJobbRows.reduce((acc, r) => acc + r.total, 0);
    const title = t("shareWorkSummarySubject", { range });
    const text = [title, "", ...lines, "", t("shareWorkSummaryTotal", { count: total })].join("\n");
    try {
      window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`;
    } catch {
      toast.error(t("shareWorkSummaryFailed"));
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div className="pb-1 pt-0.5">
        <BackButton
          fallbackTo="/"
          className="-ml-2 inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[15px] font-medium text-primary transition-colors active:bg-secondary"
        >
          {t("back")}
        </BackButton>
      </div>

      <h1 className="mt-3 px-1 text-center text-[26px] font-bold leading-tight tracking-[-0.03em] text-primary">
        {t("weeklySummaryTitle")}
      </h1>
      <p className="mt-1 px-1 text-center text-[13px] text-muted-foreground">{range}</p>

      {/* Snabblänkar till dagsvyn och årsstatistiken */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          to="/dagsstatistik"
          className="flex items-center justify-center gap-1.5 rounded-2xl bg-primary px-3 py-2.5 text-[14px] font-semibold text-primary-foreground transition-colors active:bg-primary/90"
        >
          <Calendar className="size-4" />
          <span>{t("dailySummaryLink")}</span>
        </Link>
        <Link
          to="/statistik"
          className="flex items-center justify-center gap-1.5 rounded-2xl bg-primary px-3 py-2.5 text-[14px] font-semibold text-primary-foreground transition-colors active:bg-primary/90"
        >
          <BarChart3 className="size-4" />
          <span>{currentYear}</span>
        </Link>
      </div>

      {summary.rows.length === 0 ? (
        <p className="mt-8 px-1 text-[15px] text-muted-foreground">{t("weeklySummaryEmpty")}</p>
      ) : (
        <SummaryBreakdown rows={summary.rows} />
      )}

      <button
        type="button"
        onClick={shareWork}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-[0_10px_24px_-10px_hsl(0_0%_0%/0.45)] transition-all duration-200 active:scale-[0.98] active:shadow-[0_4px_12px_-8px_hsl(0_0%_0%/0.45)]"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-primary-foreground/15 ring-1 ring-primary-foreground/25">
          <Mail className="size-4" />
        </span>
        {t("shareWorkSummary")}
      </button>
    </main>
  );
}
