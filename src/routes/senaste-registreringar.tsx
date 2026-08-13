import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { BackButton } from "@/components/BackButton";
import { BottomSheet } from "@/components/BottomSheet";

import { categoryLabel, useLanguage, useLocale } from "@/lib/use-language";
import { useEntries } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/senaste-registreringar")({
  head: () => ({
    meta: [
      { title: "Senaste registreringar – Donely" },
      {
        name: "description",
        content:
          "Se och hantera dina senaste registreringar i Donely. Ta bort enstaka felregistreringar.",
      },
      { property: "og:title", content: "Senaste registreringar – Donely" },
      {
        property: "og:description",
        content: "Senaste registreringar och felregistreringar i Donely.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SenasteRegistreringar,
});

function SenasteRegistreringar() {
  const { t, language } = useLanguage();
  const locale = useLocale();
  const { entries, removeEntry, updateEntry } = useEntries();
  const [editing, setEditing] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("1");
  const [editDate, setEditDate] = useState("");
  const recent = entries.slice(0, 10);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div className="pb-1 pt-0.5">
        <BackButton
          fallbackTo="/installningar"
          className="-ml-2 inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[15px] font-medium text-primary transition-colors active:bg-secondary"
        >
          {t("back")}
        </BackButton>
      </div>

      <h1 className="px-1 text-[28px] font-bold leading-tight tracking-[-0.03em] text-primary">
        {t("recentSection")}
      </h1>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-card">
        {recent.length === 0 ? (
          <p className="px-3 py-4 text-center text-[12px] font-normal leading-[16px] text-muted-foreground">
            {t("recentEmpty")}
          </p>
        ) : (
          recent.map((entry, index) => {
            const hours = entry.durationMin ? Math.floor(entry.durationMin / 60) : 0;
            const mins = entry.durationMin ? Math.round(entry.durationMin % 60) : 0;
            return (
              <div
                key={entry.id}
                className={`stagger-item flex items-center gap-3 px-3 py-2.5 ${index > 0 ? "border-t border-border" : ""}`}
                style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold leading-[18px] text-foreground">
                    {categoryLabel(t, { id: entry.categoryId, name: entry.categoryName })}
                    <span className="ml-1 font-normal text-muted-foreground">×{entry.amount}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] font-normal leading-[15px] text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleDateString(language, {
                      day: "numeric",
                      month: "short",
                    })}
                    {entry.distanceKm
                      ? ` · ${entry.distanceKm.toLocaleString(locale, { maximumFractionDigits: 1 })} km`
                      : ""}
                    {entry.durationMin
                      ? ` · ${hours > 0 ? `${hours} h ${mins} min` : `${mins} min`}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t("editEntry")}
                  onClick={() => {
                    setEditing(entry.id);
                    setEditAmount(String(entry.amount));
                    setEditDate(new Date(entry.createdAt).toISOString().slice(0, 10));
                  }}
                  className="shrink-0 rounded-lg p-2 text-primary transition-colors active:bg-accent"
                >
                  <Pencil className="size-[16px]" />
                </button>
                <button
                  type="button"
                  aria-label={t("recentDeleted")}
                  onClick={() => {
                    removeEntry(entry.id);
                    toast.success(t("recentDeleted"));
                  }}
                  className="shrink-0 rounded-lg p-2 text-destructive transition-colors active:bg-destructive/10"
                >
                  <Trash2 className="size-[16px]" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {editing !== null && (
        <BottomSheet
          onClose={() => setEditing(null)}
          label={t("cancel")}
          className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-1"
        >
          <div>
            <p className="text-[15px] font-bold leading-tight text-primary">{t("editEntry")}</p>

            <label className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {t("amount")}
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-[16px] font-semibold text-foreground outline-none focus:border-primary"
            />

            <label className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {t("entryDate")}
            </label>
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-[16px] font-semibold text-foreground outline-none focus:border-primary"
            />

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] font-semibold text-foreground active:bg-accent"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const amount = Math.floor(Number(editAmount));
                  if (!Number.isFinite(amount) || amount < 1) return;
                  const current = entries.find((e) => e.id === editing);
                  const time = current ? new Date(current.createdAt) : new Date();
                  const [y, m, d] = editDate.split("-").map(Number);
                  const next =
                    y && m && d
                      ? new Date(y, m - 1, d, time.getHours(), time.getMinutes(), time.getSeconds())
                      : time;
                  updateEntry(editing, { amount, createdAt: next.toISOString() });
                  setEditing(null);
                  toast.success(t("entryUpdated"));
                }}
                className="rounded-xl bg-primary px-3 py-2.5 text-[13px] font-semibold text-primary-foreground active:opacity-90"
              >
                {t("save")}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}
    </main>
  );
}
