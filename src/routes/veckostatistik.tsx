import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/BackButton";
import { BottomSheet } from "@/components/BottomSheet";
import { StatsSegmentedControl } from "@/components/StatsSegmentedControl";
import { SummaryBreakdown } from "@/components/SummaryBreakdown";
import { WeeklyActivityChart } from "@/components/WeeklyActivityChart";
import { useCategories, useEntries } from "@/lib/store";
import { useLanguage, useLocale } from "@/lib/use-language";
import { activityPhrase } from "@/lib/category-inflection";
import { renderWeeklyReportPng } from "@/lib/report-card";
import { composeMail, isNativeMailAvailable, openMailto } from "@/lib/mail-bridge";

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
  const [cardPreview, setCardPreview] = useState<string | null>(null);

  /** "10 möten" – uses proper singular/plural for the category name. */
  const activityLine = (row: (typeof workRows)[number]) =>
    activityPhrase(row.id, row.label, row.total, locale);

  // Live preview of the report card inside the sheet, so the design can be
  // reviewed both in the web preview and on device before the mail opens.
  useEffect(() => {
    if (!commentOpen) return;
    const id = setTimeout(() => {
      const card = renderWeeklyReportPng({
        title: t("reportTitle"),
        range: mailRange,
        rows: workRows.map((r) => ({ label: r.label, value: r.total })),
        total: workRows.reduce((acc, r) => acc + r.total, 0),
        totalLabel: t("reportTotalLabel"),
        comment: comment.trim() || undefined,
        commentHeading: t("mailCommentHeading"),
        footer: t("reportFooter"),
      });
      setCardPreview(card ? `data:image/png;base64,${card.base64}` : null);
    }, 200);
    return () => clearTimeout(id);
  }, [commentOpen, comment, workRows, mailRange, t]);

  /**
   * Builds the weekly report as a PNG and opens the native iOS mail composer
   * with an HTML body where the card is inlined (data URI) – so the recipient
   * sees the report directly in the message, not as a file to open.
   * Falls back to a plain-text mailto: when no native composer exists.
   */
  const openComposer = async (note: string) => {
    const total = workRows.reduce((acc, r) => acc + r.total, 0);
    const subject = t("mailSubject", { range: mailRange });
    const heading = (label: string) => label.toLocaleUpperCase(locale);

    const plain = [
      t("mailGreeting"),
      "",
      t("mailIntro", { range: mailRange }),
      "",
      heading(t("mailDoneHeading")),
      ...workRows.map((r) => `• ${activityLine(r)}`),
      "",
      t("mailTotal", { count: total }),
      ...(note.trim() ? ["", heading(t("mailCommentHeading")), note.trim()] : []),
      "",
      "—",
      "",
      t("mailSignoff"),
      "",
      "Donely",
    ].join("\n");

    if (!isNativeMailAvailable()) {
      try {
        openMailto(subject, plain);
      } catch {
        toast.error(t("shareWorkSummaryFailed"));
      }
      return;
    }

    const card = renderWeeklyReportPng({
      title: t("reportTitle"),
      range: mailRange,
      rows: workRows.map((r) => ({ label: r.label, value: r.total })),
      total,
      totalLabel: t("reportTotalLabel"),
      comment: note.trim() || undefined,
      commentHeading: t("mailCommentHeading"),
      footer: t("reportFooter"),
    });

    const esc = (value: string) =>
      value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const html = [
      '<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:16px;color:#1e3a56;line-height:1.5;">',
      `<p>${esc(t("mailGreeting"))}</p>`,
      `<p>${esc(t("mailIntro", { range: mailRange }))}</p>`,
      card
        ? `<p><img src="data:image/png;base64,${card.base64}" width="600" style="width:100%;max-width:600px;height:auto;display:block;border:0;" alt="${esc(t("reportTitle"))}" /></p>`
        : "",
      `<p>${esc(t("mailSignoff"))}</p>`,
      "</div>",
    ].join("");

    const status = await composeMail({
      subject,
      html,
      plain,
      pngBase64: card?.base64,
      fileName: "donely-veckosammanstallning.png",
    });

    if (status === "sent") toast.success(t("mailSent"));
    else if (status === "unavailable") {
      toast(t("mailNoAccount"));
      openMailto(subject, plain);
    } else if (status === "failed") toast.error(t("shareWorkSummaryFailed"));
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

      {summary.rows.length === 0 ? (
        <>
          <div className="mt-3 px-1 text-center">
            <h1 className="text-[26px] font-bold leading-tight tracking-[-0.03em] text-primary">
              {t("weeklySummaryTitle")}
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">{range}</p>
          </div>
          <div className="mt-3">
            <StatsSegmentedControl active="week" />
          </div>
          <WeeklyActivityChart entries={entries} locale={locale} title={t("weeklyActivityTitle")} />
          <p className="mt-8 px-1 text-[15px] text-muted-foreground">{t("weeklySummaryEmpty")}</p>
        </>
      ) : (
        <SummaryBreakdown
          rows={summary.rows}
          title={t("weeklySummaryTitle")}
          subtitle={<p className="mt-1 text-[13px] text-muted-foreground">{range}</p>}
          postSummary={
            <WeeklyActivityChart entries={entries} locale={locale} title={t("weeklyActivityTitle")} />
          }
        >
          <div className="mt-3">
            <StatsSegmentedControl active="week" />
          </div>
        </SummaryBreakdown>
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
        <BottomSheet
          onClose={() => setCommentOpen(false)}
          label={t("mailCommentSkip")}
          className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2"
        >
          <div>
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
            {cardPreview && (
              <div className="mt-3 max-h-[38vh] overflow-y-auto rounded-2xl border border-border bg-secondary/40 p-2">
                <img src={cardPreview} alt={t("reportTitle")} className="w-full rounded-xl" />
              </div>
            )}

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
        </BottomSheet>
      )}
    </main>
  );
}
