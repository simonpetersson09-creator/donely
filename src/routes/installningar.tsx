import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, Crown, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { clearAllData } from "@/lib/store";
import { useLanguage } from "@/lib/use-language";
import { usePremium } from "@/lib/premium";

const APP_STORE_REVIEW_URL =
  "https://apps.apple.com/app/id0000000000?action=write-review";

/**
 * Ber om Apples inbyggda betygsdialog (SKStoreReviewController / StoreKit 2
 * AppStore.requestReview) via native-bryggan när appen körs i iOS-skalet.
 * Faller tillbaka till App Store-recensionssidan på webben.
 */
function requestAppStoreReview() {
  const w = window as unknown as {
    webkit?: { messageHandlers?: { requestReview?: { postMessage: (v: unknown) => void } } };
  };
  const handler = w.webkit?.messageHandlers?.requestReview;
  if (handler) {
    handler.postMessage({});
    return;
  }
  window.open(APP_STORE_REVIEW_URL, "_blank", "noopener");
}

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
  const premium = usePremium();
  const [confirming, setConfirming] = useState(false);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div>
        <div className="py-2">
          <Link
            to="/"
            className="-ml-2 inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[13px] font-normal leading-[18px] text-primary transition-colors active:bg-secondary"
          >
            <ChevronLeft className="size-4" />
            {t("back")}
          </Link>
        </div>

        <h1 className="px-1 text-[26px] font-bold leading-[32px] tracking-[-0.03em] text-primary">
          {t("settings")}
        </h1>
        <p className="mt-1 px-1 text-[12px] font-normal leading-[17px] text-muted-foreground">
          {t("settingsSubtitle")}
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center py-6">
        <div className="relative">
          {!premium.subscribed && !premium.trialExpired && (
            <div className="absolute -right-1 -top-14 z-10 rotate-[6deg]">
              <div className="relative rounded-full border border-primary bg-background px-4 py-3 shadow-card">
                <p className="text-center text-[11px] font-semibold leading-[14px] text-primary">
                  {(() => {
                    const text = t("trialLeft", { count: premium.trialDaysLeft });
                    const parts = text.split(/kvar\s*/);
                    if (parts.length === 2) {
                      return (
                        <>
                          {parts[0]}kvar
                          <br />
                          {parts[1]}
                        </>
                      );
                    }
                    return text;
                  })()}
                </p>
                <div className="absolute -bottom-1.5 left-5 h-3 w-3 rotate-45 border-b border-r border-primary bg-background" />
              </div>
            </div>
          )}
          <h1 className="select-none font-['Inter',system-ui,-apple-system,sans-serif] text-[36px] font-bold leading-none tracking-[-0.04em] text-primary">
            Donely
          </h1>
        </div>
      </div>

      <div>
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => toast.message(t("premiumFlowComing"))}
            className="w-full rounded-xl bg-primary px-3.5 py-3 text-center shadow-card transition-transform active:scale-[0.985]"
          >
            <span className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold leading-[18px] text-primary-foreground">
              <Crown className="size-4" />
              {t("startPremiumPrice")}
            </span>
          </button>

          {(premium.subscribed || premium.trialExpired) && (
            <div className="rounded-full border border-border bg-card px-5 py-5 text-center shadow-card">
              {premium.subscribed ? (
                <p className="text-[15px] font-semibold leading-[20px] text-primary">
                  {t("premiumActive")}
                </p>
              ) : (
                <p className="text-[15px] font-semibold leading-[20px] text-primary">
                  {t("premiumUnlockAll")}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => toast.message(t("premiumFlowComing"))}
              className="flex w-full items-center justify-center rounded-xl border border-border bg-card px-3 py-3 text-[13px] font-semibold leading-[18px] text-primary shadow-card transition-colors active:bg-accent"
            >
              {t("manageSubscription")}
            </button>

            <button
              type="button"
              onClick={() => toast.message(t("purchasesRestored"))}
              className="flex w-full items-center justify-center rounded-xl border border-border bg-card px-3 py-3 text-[13px] font-semibold leading-[18px] text-primary shadow-card transition-colors active:bg-accent"
            >
              {t("restorePurchase")}
            </button>
          </div>
        </section>

        <div className="mt-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={requestAppStoreReview}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-3 text-[13px] font-semibold leading-[18px] text-primary shadow-card transition-colors active:bg-accent"
            >
              <Star className="size-[18px]" />
              <span>{t("rateDonely")}</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-card px-3 py-3 text-[13px] font-semibold leading-[18px] text-destructive shadow-card transition-colors active:bg-destructive/10"
            >
              <Trash2 className="size-[18px]" />
              <span>{t("deleteAllDataRow")}</span>
            </button>
          </div>

          <p className="mt-2 text-center text-[9px] font-normal leading-[13px] text-muted-foreground/80">
            Donely · {t("version")} 1.0
          </p>
        </div>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-8 backdrop-blur-[2px]">
          <div className="w-full max-w-[280px] overflow-hidden rounded-[14px] bg-card text-center shadow-xl">
            <div className="px-4 pb-4 pt-5">
              <p className="text-[13px] font-semibold leading-[18px] text-foreground">
                {t("deleteAllData")}
              </p>
              <p className="mt-1.5 text-[11px] font-normal leading-[16px] text-muted-foreground">
                {t("deleteAllDataWarning")}
              </p>
            </div>
            <div className="grid grid-cols-2 border-t border-border">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="border-r border-border py-2.5 text-[13px] font-normal leading-[18px] text-primary transition-colors active:bg-accent"
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
                className="py-2.5 text-[13px] font-semibold leading-[18px] text-destructive transition-colors active:bg-destructive/10"
              >
                {t("deleteAllData")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
