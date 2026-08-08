import { useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { subscribePurchaseEvents } from "@/lib/premium";

/**
 * Global toast feedback for every purchase / restore outcome reported by
 * StoreKit through the native bridge. Mounted once in the root layout.
 */
export function PurchaseFeedback() {
  const { t } = useTranslation();

  useEffect(
    () =>
      subscribePurchaseEvents(({ status, message }) => {
        switch (status) {
          case "success":
            toast.success(message ?? t("purchaseSuccess"));
            break;
          case "restored":
            toast.success(message ?? t("restoreSuccess"));
            break;
          case "cancelled":
            toast.message(message ?? t("purchaseCancelled"));
            break;
          case "failed":
            toast.error(message ?? t("purchaseFailed"));
            break;
          case "productUnavailable":
            // Show Apple's own reason as description when StoreKit gave one.
            toast.error(t("productUnavailable"), message ? { description: message } : undefined);
            break;
          case "nothingToRestore":
            toast.message(message ?? t("restoreNone"));
            break;
          case "pending":
            toast.message(message ?? t("purchasePendingApproval"));
            break;
        }
      }),
    [t],
  );

  return null;
}
