import { useEffect } from "react";
import { Crown, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  purchasePremium,
  restorePurchase,
  subscribePurchaseEvents,
  usePremium,
  usePrice,
} from "@/lib/premium";

/** Full-screen iOS-style paywall shown when the free trial has ended. */
export function Paywall({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const premium = usePremium();
  const price = usePrice();

  // Close the paywall as soon as access is granted by StoreKit.
  useEffect(
    () =>
      subscribePurchaseEvents((e) => {
        if (e.status === "success" || e.status === "restored") onClose();
      }),
    [onClose],
  );

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
          <Crown className="size-6 text-gold" fill="currentColor" />
        </div>

        <h2 className="mt-4 text-center text-[22px] font-bold leading-tight tracking-[-0.02em] text-primary">
          {t("paywallTitle")}
        </h2>
        <p className="mt-2 text-center text-[14px] leading-relaxed text-muted-foreground">
          {t("paywallBody")}
        </p>

        <p className="mt-4 text-center text-[26px] font-bold tabular-nums tracking-[-0.02em] text-foreground">
          {premium.productStatus === "loading"
            ? t("productLoading")
            : premium.productStatus === "unavailable"
              ? t("productUnavailable")
              : t("pricePerMonth", { price })}
        </p>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={premium.busy || premium.loading}
            onClick={() => purchasePremium()}
            className="w-full rounded-xl bg-primary py-3 text-[16px] font-semibold text-primary-foreground shadow-[0_8px_20px_-6px_hsl(0_0%_0%/0.35)] transition-transform active:scale-[0.97] disabled:opacity-60"
          >
            {premium.loading
              ? t("premiumLoading")
              : premium.phase === "purchasing"
                ? t("purchasePending")
                : t("startPremiumDynamic", { price })}
          </button>
          <button
            type="button"
            disabled={premium.busy}
            onClick={() => restorePurchase()}
            className="w-full rounded-xl border border-border bg-card py-3 text-[15px] font-semibold text-primary transition-colors active:bg-accent disabled:opacity-60"
          >
            {premium.phase === "restoring" ? t("restoring") : t("restorePurchase")}
          </button>
        </div>

        <p className="mt-3 text-center text-[12px] leading-relaxed text-muted-foreground">
          {t("paywallFootnote")}
        </p>
      </div>
    </div>
  );
}
