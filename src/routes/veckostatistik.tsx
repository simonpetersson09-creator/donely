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
      summary.rows.filter(
        (r) => categories.find((c) => c.id === r.id)?.area === "jobb",
      ),
    [summary.rows, categories],
  );

  const shareWork = async () => {
    if (workRows.length === 0) {
      toast(t("shareWorkSummaryEmpty"));
      return;
    }
    const lines = workRows.map((r) => `• ${r.label}: ${r.total}`);
    const total = workRows.reduce((acc, r) => acc + r.total, 0);
    const title = t("shareWorkSummarySubject", { range });
    const text = [title, "", ...lines, "", t("shareWorkSummaryTotal", { count: total })].join("\n");
    try {
      await Share.share({ title, text, dialogTitle: title });
    } catch (err) {
      if (err instanceof Error && /cancel/i.test(err.message)) return;
      try {
        window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`;
      } catch {
        toast.error(t("shareWorkSummaryFailed"));
      }
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

      {summary.rows.length === 0 ? (
        <p className="mt-8 px-1 text-[15px] text-muted-foreground">{t("weeklySummaryEmpty")}</p>
      ) : (
        <SummaryBreakdown rows={summary.rows} />
      )}

      <button
        type="button"
        onClick={shareWork}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-3.5 py-3 text-[15px] font-semibold text-primary shadow-soft transition-transform active:scale-[0.99]"
      >
        <Send className="size-4" />
        {t("shareWorkSummary")}
      </button>

      <div className="mt-3 rounded-xl bg-primary px-3.5 py-3 text-center shadow-card">
        <p className="text-[15px] font-semibold text-primary-foreground">
          {t("weeklySummaryTotal", { count: summary.total })}
        </p>
      </div>
    </main>
  );
}
