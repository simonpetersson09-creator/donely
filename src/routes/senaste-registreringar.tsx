import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Timer, Trash2 } from "lucide-react";
import { BackButton } from "@components/BackButton";
import { useLanguage, useLocale } from "@/lib/use-language";
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
  const { entries, removeEntry } = useEntries();
  const recent = entries.slice(0, 10);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div className="py-2">
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
      <p className="mt-1 px-1 text-[13px] text-muted-foreground">
        {t("settingsSubtitle")}
      </p>

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
                className={`flex items-center gap-3 px-3 py-2.5 ${index > 0 ? "border-t border-border" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold leading-[18px] text-foreground">
                    {entry.categoryName}
                    <span className="ml-1 font-normal text-muted-foreground">
                      ×{entry.amount}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] font-normal leading-[15px] text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleDateString(language, {
                      day: "numeric",
                      month: "short",
                    })}
                    {entry.distanceKm ? ` · ${entry.distanceKm.toLocaleString(locale, { maximumFractionDigits: 1 })} km` : ""}
                    {entry.durationMin ? ` · ${hours > 0 ? `${hours} h ${mins} min` : `${mins} min`}` : ""}
                  </p>
                </div>
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
    </main>
  );
}
