import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ChevronLeft, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { clearAllData, replayOnboarding } from "@/lib/store";
import { useLanguage } from "@/lib/use-language";
import type { LanguageCode } from "@/lib/i18n";

export const Route = createFileRoute("/installningar")({
  head: () => ({
    meta: [
      { title: "Inställningar – Donely" },
      {
        name: "description",
        content:
          "Ställ in appspråk, visa introduktionen igen eller rensa alla registreringar, kategorier och årsmål i Donely.",
      },
      { property: "og:title", content: "Inställningar – Donely" },
      {
        property: "og:description",
        content: "Språk, introduktion och datahantering för Donely.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Installningar,
});

function Installningar() {
  const { t, language, changeLanguage, languages } = useLanguage();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const select = (code: LanguageCode) => {
    changeLanguage(code);
    navigator.vibrate?.(8);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div className="py-2">
        <Link
          to="/"
          className="-ml-2 inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[15px] font-medium text-primary transition-colors active:bg-secondary"
        >
          <ChevronLeft className="size-4" />
          {t("back")}
        </Link>
      </div>

      <h1 className="px-1 text-[28px] font-bold leading-tight tracking-[-0.03em] text-primary">
        {t("settings")}
      </h1>
      <p className="mt-0.5 px-1 text-[14px] text-muted-foreground">{t("settingsSubtitle")}</p>

      <section className="mt-6">
        <h2 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/60">
          {t("appLanguage")}
        </h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          {languages.map((l, i) => {
            const active = l.code === language;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => select(l.code)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-[15px] text-card-foreground transition-colors active:bg-secondary",
                  i > 0 && "border-t border-border",
                  active && "font-semibold",
                )}
              >
                <span className="text-[17px] leading-none">{l.flag}</span>
                <span className="min-w-0 flex-1 truncate">{l.label}</span>
                {active && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-8 space-y-2">
        <button
          type="button"
          onClick={() => {
            replayOnboarding();
            toast.success(t("showIntroAgain"));
            router.navigate({ to: "/" });
          }}
          className="w-full rounded-xl border border-border bg-card px-3.5 py-3 text-left shadow-card transition-colors active:bg-accent"
        >
          <span className="flex items-center gap-2 text-[15px] font-semibold text-primary">
            <RotateCcw className="size-4" />
            {t("showIntroAgain")}
          </span>
          <span className="mt-0.5 block text-[13px] text-muted-foreground">
            {t("showIntroAgainDesc")}
          </span>
        </button>

        <div className="rounded-xl border border-destructive/30 bg-card px-3.5 py-3 shadow-card">
          <span className="flex items-center gap-2 text-[15px] font-semibold text-destructive">
            <Trash2 className="size-4" />
            {t("deleteAllData")}
          </span>
          <span className="mt-0.5 block text-[13px] text-muted-foreground">
            {t("deleteAllDataDesc")}
          </span>
          {confirming ? (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-xl border border-border bg-card py-2.5 text-[15px] font-semibold text-primary"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAllData();
                  toast.success(t("allDataDeleted"));
                  window.location.href = "/";
                }}
                className="flex-1 rounded-xl bg-destructive py-2.5 text-[15px] font-semibold text-destructive-foreground"
              >
                {t("deleteAllConfirm")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-3 w-full rounded-xl border border-destructive/30 bg-card py-2.5 text-[15px] font-semibold text-destructive transition-colors active:bg-destructive/10"
            >
              {t("deleteAllData")}
            </button>
          )}
        </div>
      </section>

      <p className="mt-auto pt-8 text-center text-[12px] text-muted-foreground">
        Donely · {t("version")} 1.0
      </p>
    </main>
  );
}
