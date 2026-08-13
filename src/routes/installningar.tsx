import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CalendarPlus,
  ChevronRight,
  Crown,
  Download,
  FileText,
  Star,
  Trash2,
  History,
  Upload,
} from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { toast } from "sonner";
import { DATA_CHANGED_EVENT, clearAllData } from "@/lib/store";
import { importData } from "@/lib/persistence";
import { readBackupFile, saveBackupFile } from "@/lib/backup-file";
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

  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await saveBackupFile();
      if (result === "downloaded") toast.success(t("exportDone"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      // User dismissed the iOS share sheet — not an error worth surfacing.
      if (!/cancel/i.test(message)) toast.error(t("importFailed"));
    } finally {
      setExporting(false);
    }
  };

  const runImport = (json: string) => {
    const result = importData(json);
    if (result.status === "ok") {
      window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
      toast.success(t("importDone", { entries: result.entries, categories: result.categories }));
      return;
    }
    toast.error(result.status === "invalid" ? t("importInvalid") : t("importFailed"));
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background overflow-x-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div>
        <div className="pb-1 pt-0.5">
          <BackButton
            fallbackTo="/"
            className="-ml-2 inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[13px] font-normal leading-[18px] text-primary transition-colors active:bg-secondary"
          >
            {t("back")}
          </BackButton>
        </div>

        <h1 className="px-1 text-[22px] font-bold leading-[28px] tracking-[-0.03em] text-primary">
          {t("settings")}
        </h1>
      </div>

      <div className="mt-10 flex flex-[1.1] items-end justify-center pb-10">
        <div className="relative">
          <h1 className="font-logo select-none text-[30px] font-bold leading-none tracking-[-0.04em] text-primary">
            Donely
          </h1>
          <p className="mt-0.5 text-center text-[11px] font-medium tracking-wide text-primary/80">
            {t("tagline")}
          </p>

          <div className="absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2">
            <div className="relative rounded-full bg-primary px-3 py-1 shadow-[0_6px_16px_-8px_hsl(0_0%_0%/0.45)]">
              <span className="flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold leading-[14px] tracking-wide text-primary-foreground">
                {premium.subscribed ? (
                  <>
                    <Crown className="size-2.5 shrink-0 text-gold" fill="currentColor" />
                    {t("premiumActive")}
                  </>
                ) : premium.inTrial ? (
                  t("trialLeft", { count: premium.trialDaysLeft })
                ) : (
                  t("trialExpired")
                )}
              </span>
              <div className="absolute -top-[3px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 rounded-[1px] bg-primary" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <section className="space-y-2">
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
            className="premium-sheen group w-full overflow-hidden rounded-full border border-premium-border bg-gradient-premium px-3 py-2 text-center shadow-premium transition-transform active:scale-[0.985] disabled:opacity-60 edge-fix"
          >
            <span className="relative z-[2] inline-flex items-center justify-center gap-2 text-[13px] font-semibold leading-[17px] text-gold-foreground">
              <Crown
                className="size-3.5 text-gold-deep transition-transform duration-300 group-hover:rotate-12"
                fill="currentColor"
              />

              {premium.loading
                ? t("premiumLoading")
                : premium.phase === "purchasing"
                  ? t("purchasePending")
                  : premium.subscribed
                    ? t("premiumActive")
                    : premium.productStatus === "loading"
                      ? t("productLoading")
                      : price
                        ? t("startPremiumPriceDynamic", { price })
                        : t("startPremiumPlain")}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={openManageSubscriptions}
              className="flex w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-card px-3 py-2 text-[12px] font-semibold leading-[17px] text-primary shadow-button transition-colors active:bg-accent edge-fix"
            >
              {t("manageSubscription")}
            </button>

            <button
              type="button"
              disabled={premium.busy}
              onClick={() => restorePurchase()}
              className="flex w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-card px-3 py-2 text-[12px] font-semibold leading-[17px] text-primary shadow-button transition-colors active:bg-accent disabled:opacity-60 edge-fix"
            >
              {premium.phase === "restoring" ? t("restoring") : t("restorePurchase")}
            </button>
          </div>
        </section>

        <section className="mt-3">
          <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {t("remindersSection")}
          </p>

          <div className="overflow-hidden rounded-xl border border-border bg-card px-3 py-2.5 shadow-card edge-fix">
            <div className="flex items-center gap-3">
              <Bell className="size-[16px] shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold leading-[17px] text-primary">
                  {t("weeklyReminder")}
                </p>
                <p className="mt-0.5 text-[10px] font-normal leading-[14px] text-muted-foreground">
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
              <p className="mt-2 pl-[28px] text-[10px] font-normal leading-[14px] text-muted-foreground">
                {t("nextReminder", {
                  date: formatFireDate(reminder.nextFireDate, language),
                })}
              </p>
            )}

            <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
              <Bell className="size-[16px] shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold leading-[17px] text-primary">
                  {t("dailyReminder")}
                </p>
                <p className="mt-0.5 text-[10px] font-normal leading-[14px] text-muted-foreground">
                  {t("dailyReminderDesc")}
                </p>
              </div>
              <Switch
                checked={reminder.dailyEnabled}
                disabled={reminder.busy}
                aria-label={t("dailyReminder")}
                onCheckedChange={async (next) => {
                  const result = await reminder.toggleDaily(next, language);
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

            {reminder.permission === "denied" && (
              <div className="mt-3 rounded-lg bg-secondary px-3 py-2.5">
                <p className="text-[10px] font-normal leading-[14px] text-muted-foreground">
                  {t("notifDenied")}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (!openNotificationSettings() && !openExternalUrl("app-settings:")) {
                      toast.error(t("notifUnsupported"));
                    }
                  }}
                  className="mt-2 text-[11px] font-semibold leading-[15px] text-primary underline-offset-2 active:underline"
                >
                  {t("openIosSettings")}
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="mt-3">
          <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {t("recentSection")}
          </p>

          <Link
            to="/senaste-registreringar"
            className="flex w-full items-center justify-between overflow-hidden rounded-xl border border-border bg-card px-3.5 py-2.5 text-[12px] font-semibold text-primary shadow-button transition-colors active:bg-accent edge-fix"
          >
            <span className="flex items-center gap-2">
              <History className="size-[16px]" />
              {t("recentSection")}
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>

          <Link
            to="/historik"
            className="mt-2 flex w-full items-center justify-between overflow-hidden rounded-xl border border-border bg-card px-3.5 py-2.5 text-[12px] font-semibold text-primary shadow-button transition-colors active:bg-accent edge-fix"
          >
            <span className="flex items-center gap-2">
              <CalendarPlus className="size-[16px]" />
              {t("historySection")}
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        </section>

        <section className="mt-3">
          <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {t("backupSection")}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center justify-center gap-2 overflow-hidden rounded-xl border border-border bg-card px-3 py-2 text-[12px] font-semibold leading-[17px] text-primary shadow-button transition-colors active:bg-accent disabled:opacity-60 edge-fix"
            >
              <Download className="size-[16px]" />
              <span>{t("exportBackup")}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex items-center justify-center gap-2 overflow-hidden rounded-xl border border-border bg-card px-3 py-2 text-[12px] font-semibold leading-[17px] text-primary shadow-button transition-colors active:bg-accent edge-fix"
            >
              <Upload className="size-[16px]" />
              <span>{t("importBackup")}</span>
            </button>
          </div>

          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              try {
                setPendingImport(await readBackupFile(file));
              } catch {
                toast.error(t("importInvalid"));
              }
            }}
          />
        </section>

        <div className="mt-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
          <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {t("aboutApp")}
          </p>

          <button
            type="button"
            onClick={() => {
              if (!openExternalUrl(LEGAL_URL)) {
                toast.error(t("legalOpenError"));
              }
            }}
            className="relative mb-2 flex w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-card px-3 py-2.5 shadow-button transition-colors active:bg-accent edge-fix"
          >
            <span className="flex items-center gap-2 text-[12px] font-semibold leading-[17px] text-primary">
              <FileText className="size-[16px]" />
              {t("legalRow")}
            </span>
            <ChevronRight className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={requestAppStoreReview}
              className="flex items-center justify-center gap-2 overflow-hidden rounded-xl border border-border bg-card px-3 py-2 text-[12px] font-semibold leading-[17px] text-primary shadow-button transition-colors active:bg-accent edge-fix"
            >
              <Star className="size-[16px]" />
              <span>{t("rateDonely")}</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex items-center justify-center gap-2 overflow-hidden rounded-xl border border-destructive/30 bg-card px-3 py-2 text-[12px] font-semibold leading-[17px] text-destructive shadow-button transition-colors active:bg-destructive/10 edge-fix"
            >
              <Trash2 className="size-[16px]" />
              <span>{t("deleteAllDataRow")}</span>
            </button>
          </div>

          <p className="mt-2 text-center text-[8px] font-normal leading-[12px] text-muted-foreground/80">
            Donely · {t("version")} 1.0
          </p>
        </div>
      </div>

      {pendingImport !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-8 backdrop-blur-[2px]">
          <div className="w-full max-w-[280px] overflow-hidden rounded-[14px] bg-card text-center shadow-xl">
            <div className="px-4 pb-4 pt-5">
              <p className="text-[13px] font-semibold leading-[18px] text-foreground">
                {t("importTitle")}
              </p>
              <p className="mt-1.5 text-[11px] font-normal leading-[16px] text-muted-foreground">
                {t("importBody")}
              </p>
            </div>
            <div className="grid grid-cols-2 border-t border-border">
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                className="border-r border-border py-2.5 text-[13px] font-normal leading-[18px] text-primary transition-colors active:bg-accent"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const json = pendingImport;
                  setPendingImport(null);
                  runImport(json);
                }}
                className="py-2.5 text-[13px] font-semibold leading-[18px] text-primary transition-colors active:bg-accent"
              >
                {t("importConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}

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
