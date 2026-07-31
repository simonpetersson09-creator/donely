import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, Crown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { clearAllData } from "@/lib/store";
import { useLanguage } from "@/lib/use-language";

export const Route = createFileRoute("/installningar")({
  head: () => ({
    meta: [
      { title: "Inställningar – Donely" },
      {
        name: "description",
        content:
          "Hantera premiumabonnemang eller rensa alla registreringar, kategorier och årsmål i Donely.",
      },
      { property: "og:title", content: "Inställningar – Donely" },
      {
        property: "og:description",
        content: "Premium och datahantering för Donely.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Installningar,
});

function Installningar() {
  const { t } = useLanguage();
  const [confirming, setConfirming] = useState(false);

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
          {t("donelyPremium")}
        </h2>

        <div className="mb-2 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-card">
          <p className="text-[14px] font-semibold text-primary">
            {premium.subscribed
              ? t("premiumActive")
              : premium.trialExpired
                ? t("trialEnded")
                : t("trialLeft", { count: premium.trialDaysLeft })}
          </p>
          {!premium.subscribed && (
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {t("freeTrialTitle")} · {t("freeTrialThen")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => toast.message(t("premiumFlowComing"))}
            className="w-full rounded-xl bg-primary px-3.5 py-2.5 text-left shadow-card transition-transform active:scale-[0.985]"
          >
            <span className="flex items-center gap-2 text-[15px] font-semibold text-primary-foreground">
              <Crown className="size-4" />
              {t("startPremiumPrice")}
            </span>
          </button>

          <button
            type="button"
            onClick={() => toast.message(t("premiumFlowComing"))}
            className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-left shadow-card transition-colors active:bg-accent"
          >
            <span className="flex items-center gap-2 text-[15px] font-semibold text-primary">
              {t("manageSubscription")}
            </span>
            <span className="mt-0.5 block text-[13px] text-muted-foreground">
              {t("manageSubscriptionDesc")}
            </span>
          </button>

          <button
            type="button"
            onClick={() => toast.message(t("purchasesRestored"))}
            className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-left text-[15px] font-semibold text-primary shadow-card transition-colors active:bg-accent"
          >
            {t("restorePurchase")}
          </button>
        </div>
      </section>


      <p className="mt-auto pt-8 text-center text-[12px] text-muted-foreground">
        Donely · {t("version")} 1.0
      </p>

      <section className="mt-6 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
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
    </main>
  );
}
