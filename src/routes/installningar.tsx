import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, ChevronRight, Crown, FileText, FlaskConical, Star, Trash2 } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { toast } from "sonner";
import { clearAllData, isDevEnvironment, seedDemoEntries, useEntries } from "@/lib/store";
import { useLanguage } from "@/lib/use-language";
import { LEGAL_URL, openExternalUrl } from "@/lib/config";
import { Switch } from "@/components/ui/switch";
import { formatFireDate, openNotificationSettings, useReminder } from "@/lib/notifications";
import {
  openManageSubscriptions,
  purchasePremium,
  restorePurchase,
  usePremium,
  usePrice,
} from "@/lib/premium";

const APP_STORE_REVIEW_URL = "https://apps.apple.com/app/id0000000000?action=write-review";

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
  const { t, language } = useLanguage();
  const premium = usePremium();
  const price = usePrice();
  const reminder = useReminder();

  const [confirming, setConfirming] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div>
        <div className="py-2">
          <BackButton
            fallbackTo="/"
            className="-ml-2 inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[13px] font-normal leading-[18px] text-primary transition-colors active:bg-secondary"
          >
            {t("back")}
          </BackButton>
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
          <div className="absolute -right-14 -top-14 z-10 rotate-[6deg]">
            <div className="relative rounded-full border border-primary bg-background px-4 py-3 shadow-card">
              <p className="max-w-[9rem] text-balance text-center text-[11px] font-semibold leading-[14px] text-primary">
                {premium.subscribed ? (
                  <span className="inline-flex items-center gap-1">
                    <Crown className="size-3 text-gold" fill="currentColor" />
                    {t("premiumActive")}
                  </span>
                ) : (
                  t("trialLeft", { count: premium.inTrial ? premium.trialDaysLeft : 0 })
                )}
              </p>

              <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-primary bg-background" />
            </div>
          </div>
          <h1 className="font-logo select-none text-[36px] font-bold leading-none tracking-[-0.04em] text-primary">
            Donely
          </h1>
        </div>
      </div>

      <div>
        <section className="space-y-3">
          <button
            type="button"
            disabled={premium.busy || premium.loading}
            onClick={() => {
              if (premium.subscribed) {
                toast.message(t("premiumActive"));
                return;
              }
              purchasePremium();
            }}
            className="w-full rounded-xl bg-primary px-3.5 py-3 text-center shadow-card transition-transform active:scale-[0.985] disabled:opacity-60"
          >
            <span className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold leading-[18px] text-primary-foreground">
              <Crown className="size-4 text-gold" fill="currentColor" />
              {premium.loading
                ? t("premiumLoading")
                : premium.phase === "purchasing"
                  ? t("purchasePending")
                  : premium.subscribed
                    ? t("premiumActive")
                    : premium.productStatus === "loading"
                      ? t("productLoading")
                      : t("startPremiumPriceDynamic", { price })}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={openManageSubscriptions}
              className="flex w-full items-center justify-center rounded-xl border border-border bg-card px-3 py-3 text-[13px] font-semibold leading-[18px] text-primary shadow-card transition-colors active:bg-accent"
            >
              {t("manageSubscription")}
            </button>

            <button
              type="button"
              disabled={premium.busy}
              onClick={() => restorePurchase()}
              className="flex w-full items-center justify-center rounded-xl border border-border bg-card px-3 py-3 text-[13px] font-semibold leading-[18px] text-primary shadow-card transition-colors active:bg-accent disabled:opacity-60"
            >
              {premium.phase === "restoring" ? t("restoring") : t("restorePurchase")}
            </button>
          </div>
        </section>

        <section className="mt-4">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {t("remindersSection")}
          </p>

          <div className="rounded-xl border border-border bg-card px-3 py-3 shadow-card">
            <div className="flex items-center gap-3">
              <Bell className="size-[18px] shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold leading-[18px] text-primary">
                  {t("weeklyReminder")}
                </p>
                <p className="mt-0.5 text-[11px] font-normal leading-[15px] text-muted-foreground">
                  {t("weeklyReminderDesc")}
                </p>
              </div>
              <Switch
                checked={reminder.enabled}
                disabled={reminder.busy}
                aria-label={t("weeklyReminder")}
                onCheckedChange={async (next) => {
                  const result = await reminder.toggle(next, language);
                  if (!next) {
                    toast.success(t("reminderOffToast"));
                    return;
                  }
                  if (result === "denied") toast.error(t("notifDenied"));
                  else if (result === "unsupported") toast.error(t("notifUnsupported"));
                  else if (result === "granted" || result === "provisional")
                    toast.success(t("reminderOnToast"));
                }}
              />
            </div>

            {reminder.enabled && reminder.permission !== "denied" && (
              <p className="mt-2 pl-[30px] text-[11px] font-normal leading-[15px] text-muted-foreground">
                {t("nextReminder", {
                  date: formatFireDate(reminder.nextFireDate, language),
                })}
              </p>
            )}

            {reminder.permission === "denied" && (
              <div className="mt-3 rounded-lg bg-secondary px-3 py-2.5">
                <p className="text-[11px] font-normal leading-[16px] text-muted-foreground">
                  {t("notifDenied")}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (!openNotificationSettings() && !openExternalUrl("app-settings:")) {
                      toast.error(t("notifUnsupported"));
                    }
                  }}
                  className="mt-2 text-[12px] font-semibold leading-[16px] text-primary underline-offset-2 active:underline"
                >
                  {t("openIosSettings")}
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="mt-4">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {t("recentSection")}
          </p>

          <Link
            to="/senaste-registreringar"
            className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3.5 py-3 text-[14px] font-semibold text-primary shadow-card transition-colors active:bg-accent"
          >
            <span className="flex items-center gap-2">
              <Trash2 className="size-[18px]" />
              {t("recentSection")}
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        </section>


        <div className="mt-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {t("aboutApp")}
          </p>

          <button
            type="button"
            onClick={() => {
              if (!openExternalUrl(LEGAL_URL)) {
                toast.error(t("legalOpenError"));
              }
            }}
            className="relative mb-2 flex w-full items-center justify-center rounded-xl border border-border bg-card px-3 py-3 shadow-card transition-colors active:bg-accent"
          >
            <span className="flex items-center gap-2 text-[13px] font-semibold leading-[18px] text-primary">
              <FileText className="size-[18px]" />
              {t("legalRow")}
            </span>
            <ChevronRight className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </button>

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

          <div className="mt-2">
            {mounted && isDevEnvironment() && (
              <button
                type="button"
                onClick={() => {
                  const count = seedDemoEntries();
                  if (count === 0) {
                    toast.error("Kunde inte skapa exempeldata");
                    return;
                  }
                  toast.success(`${count} exempelaktiviteter tillagda`);
                  window.location.href = "/statistik";
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-3 py-3 text-[13px] font-semibold leading-[18px] text-muted-foreground transition-colors active:bg-accent"
              >
                <FlaskConical className="size-[18px]" />
                <span>Fyll på med exempeldata (endast utveckling)</span>
              </button>
            )}
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
