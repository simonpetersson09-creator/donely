import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarChart3, Calendar, Mail } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/BackButton";
import { SummaryBreakdown } from "@/components/SummaryBreakdown";
import { useCategories, useEntries } from "@/lib/store";
import { useLanguage, useLocale } from "@/lib/use-language";
import { activityPhrase } from "@/lib/category-inflection";


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
  const currentYear = new Date().getFullYear();
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

  /** Natural range for the email, e.g. "10–16 augusti" (or across months). */
  const mailRange = useMemo(() => {
    const day = new Intl.DateTimeFormat(locale, { day: "numeric" });
    const dayMonth = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });
    const sameMonth = summary.start.getMonth() === summary.end.getMonth();
    return sameMonth
      ? `${day.format(summary.start)}–${dayMonth.format(summary.end)}`
      : `${dayMonth.format(summary.start)} – ${dayMonth.format(summary.end)}`;
  }, [locale, summary.start, summary.end]);

  const workRows = useMemo(
    () =>
      summary.rows.filter((r) => {
        const category = categories.find((c) => c.id === r.id);
        // Endast jobb-kategorier ska kunna delas som jobbsammanställning.
        return category?.area === "jobb" && r.total > 0;
      }),
    [summary.rows, categories],
  );

  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState("");

  /** "10 möten" – uses proper singular/plural for the category name. */
  const activityLine = (row: (typeof workRows)[number]) =>
    activityPhrase(row.id, row.label, row.total, locale);


  const openComposer = (note: string) => {
    const total = workRows.reduce((acc, r) => acc + r.total, 0);
    const subject = t("mailSubject", { range: mailRange });
    const body = [
      t("mailGreeting"),
      "",
      t("mailIntro", { range: mailRange }),
      "",
      `**${t("mailDoneHeading")}**`,
      ...workRows.map((r) => activityLine(r)),
      "",
      t("mailTotal", { count: total }),
    ];
    if (note.trim()) {
      body.push("", `**${t("mailCommentHeading")}**`, note.trim());
    }
    body.push("", t("mailSignoff"));

    try {
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.join("\n"))}`;
    } catch {
      toast.error(t("shareWorkSummaryFailed"));
    }
  };

  const shareWork = () => {
    if (workRows.length === 0) {
      toast(t("shareWorkSummaryEmpty"));
      return;
    }
    setComment("");
    setCommentOpen(true);
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

      {commentOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            type="button"
            aria-label={t("mailCommentSkip")}
            onClick={() => setCommentOpen(false)}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
          />
          <div className="relative w-full max-w-md rounded-t-3xl border border-border bg-card px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 shadow-[0_-12px_40px_-16px_hsl(0_0%_0%/0.4)]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <h2 className="text-[18px] font-bold leading-tight tracking-[-0.02em] text-primary">
              {t("mailCommentTitle")}
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">{t("mailCommentSubtitle")}</p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder={t("mailCommentPlaceholder")}
              className="mt-3 w-full resize-none rounded-2xl border border-border bg-secondary/50 px-3 py-2.5 text-[15px] text-card-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                onClick={() => {
                  setCommentOpen(false);
                  openComposer(comment);
                }}
                className="w-full rounded-2xl bg-primary px-4 py-3 text-[15px] font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
              >
                {t("mailCommentContinue")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCommentOpen(false);
                  openComposer("");
                }}
                className="w-full rounded-2xl bg-secondary px-4 py-3 text-[15px] font-semibold text-card-foreground transition-transform active:scale-[0.98]"
              >
                {t("mailCommentSkip")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
