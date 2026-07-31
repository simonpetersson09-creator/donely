import { Crown, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { purchasePremium, restorePurchase, usePremium } from "@/lib/premium";

/** Full-screen iOS-style paywall shown when the free trial has ended. */
export function Paywall({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const premium = usePremium();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-[2px]">
      <button type="button" aria-label={t("close")} className="absolute inset-0" onClick={onClose} />
      <div className="relative mx-auto w-full max-w-md animate-in slide-in-from-bottom duration-300 rounded-t-3xl border-t border-border bg-card px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-5 shadow-card">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-transform active:scale-95"
        >
          <X className="size-4" />
        </button>

        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-card">
          <Crown className="size-6" />
        </div>

        <h2 className="mt-4 text-center text-[22px] font-bold leading-tight tracking-[-0.02em] text-primary">
          {t("paywallTitle")}
        </h2>
        <p className="mt-2 text-center text-[14px] leading-relaxed text-muted-foreground">
          {t("paywallBody")}
        </p>

        <p className="mt-4 text-center text-[26px] font-bold tabular-nums tracking-[-0.02em] text-foreground">
          {t("priceMonthly")}
        </p>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => {
              if (purchasePremium()) {
                premium.refresh();
                toast.success(t("premiumActive"));
                onClose();
              } else {
                toast.message(t("premiumFlowComing"));
              }
            }}
            className="w-full rounded-xl bg-primary py-3 text-[16px] font-semibold text-primary-foreground shadow-[0_8px_20px_-6px_hsl(0_0%_0%/0.35)] transition-transform active:scale-[0.97]"
          >
            {t("startPremium")}
          </button>
          <button
            type="button"
            onClick={() => {
              const found = restorePurchase();
              premium.refresh();
              if (found) {
                toast.success(t("premiumActive"));
                onClose();
              } else {
                toast.message(t("purchasesRestored"));
              }
            }}
            className="w-full rounded-xl border border-border bg-card py-3 text-[15px] font-semibold text-primary transition-colors active:bg-accent"
          >
            {t("restorePurchase")}
          </button>
        </div>

        <p className="mt-3 text-center text-[12px] leading-relaxed text-muted-foreground">
          {t("paywallFootnote")}
        </p>
      </div>
    </div>
  );
}
