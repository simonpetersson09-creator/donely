import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { exportData, latestValidBackup, restoreSnapshot } from "@/lib/persistence";
import { useDataIntegrity } from "@/lib/store";

/**
 * Only rendered when the local database could not be read. It never appears in
 * normal use — the app has no other UI change from the integrity work.
 * Corrupt data is kept on disk; the user can export it or restore a backup.
 */
export function DataIntegrityNotice() {
  const status = useDataIntegrity();
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  if (status.state !== "corrupt" || dismissed) return null;

  const download = () => {
    try {
      const blob = new Blob([exportData()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `donely-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn("[donely] export failed", error);
    }
  };

  const backup = latestValidBackup();

  return (
    <div className="fixed inset-x-0 top-0 z-[60] px-4 pt-[max(env(safe-area-inset-top),12px)]">
      <div className="mx-auto flex max-w-[520px] flex-col gap-2 rounded-2xl border border-destructive/30 bg-card p-3 shadow-card">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-[2px] size-[18px] shrink-0 text-destructive" />
          <div>
            <p className="text-[13px] font-semibold leading-[18px] text-foreground">
              {t("dataIssueTitle")}
            </p>
            <p className="mt-1 text-[11px] font-normal leading-[16px] text-muted-foreground">
              {t("dataIssueBody")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={download}
            className="rounded-xl border border-border bg-card px-3 py-2 text-[12px] font-semibold text-primary active:bg-accent"
          >
            {t("dataIssueExport")}
          </button>
          <button
            type="button"
            onClick={() => {
              if (backup && restoreSnapshot(backup)) window.location.reload();
              else setDismissed(true);
            }}
            className="rounded-xl bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground active:opacity-90"
          >
            {backup ? t("dataIssueRestore") : t("dataIssueDismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
