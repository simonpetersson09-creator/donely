import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/BackButton";
import { categoryLabel, useLanguage } from "@/lib/use-language";
import { useCategories, useEntries, type Area } from "@/lib/store";

export const Route = createFileRoute("/historik")({
  head: () => ({
    meta: [
      { title: "Lägg till historik – Donely" },
      {
        name: "description",
        content:
          "Lägg in totalsummor från tidigare år eller månader i Donely, till exempel 150 löppass under 2025 eller 30 möten i mars 2026.",
      },
      { property: "og:title", content: "Lägg till historik – Donely" },
      {
        property: "og:description",
        content: "Fyll på din Donely-statistik med resultat från tidigare år och månader.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Historik,
});

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth();
const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - 1 - i);

/** Localised month labels for the current year (Jan, Feb, ...). */
function monthLabels(locale: string) {
  return Array.from({ length: 12 }, (_, i) =>
    new Date(CURRENT_YEAR, i, 1).toLocaleString(locale, { month: "short" }),
  );
}

function Historik() {
  const { t, language } = useLanguage();
  const { categories } = useCategories();
  const { entries, addHistoryEntry, removeEntry } = useEntries();

  const [mode, setMode] = useState<"year" | "month">("year");
  const [year, setYear] = useState(CURRENT_YEAR - 1);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [area, setArea] = useState<Area>("privat");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  const areaCategories = useMemo(
    () => categories.filter((c) => c.area === area),
    [categories, area],
  );

  const months = useMemo(() => monthLabels(language), [language]);

  // A historical entry is anything dated before the current month (earlier
  // months in the current year, or any previous year).
  const now = new Date();
  const history = useMemo(
    () =>
      entries.filter((e) => {
        const d = new Date(e.createdAt);
        return d.getFullYear() < CURRENT_YEAR || d.getMonth() < CURRENT_MONTH;
      }),
    [entries],
  );

  const submit = () => {
    const category = areaCategories.find((c) => c.id === categoryId);
    const value = Number.parseInt(amount, 10);
    if (!category || !Number.isFinite(value) || value <= 0) {
      toast.error(t("historyInvalid"));
      return;
    }

    const date =
      mode === "year"
        ? new Date(year, 11, 31, 12, 0, 0)
        : new Date(CURRENT_YEAR, month, 1, 12, 0, 0);

    addHistoryEntry(
      { area, categoryId: category.id, categoryName: category.name, amount: value },
      date,
    );
    setAmount("");
    setCategoryId(null);
    toast.success(t("historyAdded"));
  };

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
        {t("historySection")}
      </h1>
      <p className="mt-1 px-1 text-[13px] font-normal leading-[18px] text-muted-foreground">
        {t("historyIntro")}
      </p>

      <section className="mt-4 rounded-2xl border border-border bg-card p-3.5 shadow-card">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {t("historyPeriod")}
        </p>
        <div className="flex rounded-xl bg-secondary p-1">
          {(["year", "month"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg py-2 text-[14px] font-semibold transition-colors ${
                m === mode ? "bg-card text-primary shadow-button" : "text-muted-foreground"
              }`}
            >
              {m === "year" ? t("historyYear") : t("historyMonth")}
            </button>
          ))}
        </div>

        {mode === "year" ? (
          <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {YEARS.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[14px] font-semibold transition-colors ${
                  y === year ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {months.map((label, index) => {
              const disabled = index > CURRENT_MONTH;
              return (
                <button
                  key={label}
                  type="button"
                  disabled={disabled}
                  onClick={() => setMonth(index)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-[14px] font-semibold transition-colors ${
                    index === month
                      ? "bg-primary text-primary-foreground"
                      : disabled
                        ? "bg-secondary text-muted-foreground opacity-50"
                        : "bg-secondary text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex rounded-xl bg-secondary p-1">
          {(["privat", "jobb"] as Area[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setArea(a);
                setCategoryId(null);
              }}
              className={`flex-1 rounded-lg py-2 text-[14px] font-semibold transition-colors ${
                a === area ? "bg-card text-primary shadow-button" : "text-muted-foreground"
              }`}
            >
              {a === "privat" ? t("private") : t("work")}
            </button>
          ))}
        </div>

        <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {t("category")}
        </p>
        <div className="flex flex-wrap gap-2">
          {areaCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setCategoryId(category.id)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                category.id === categoryId
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground"
              }`}
            >
              {categoryLabel(t, category)}
            </button>
          ))}
        </div>

        <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {t("amount")}
        </p>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
          placeholder="0"
          className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-[17px] font-semibold text-foreground outline-none focus:border-primary"
        />

        <button
          type="button"
          onClick={submit}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-[16px] font-semibold text-primary-foreground shadow-button transition-transform active:scale-[0.98]"
        >
          <Plus className="size-[18px]" />
          {t("historyAdd")}
        </button>
      </section>

      <section className="mt-5">
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {t("historyListTitle")}
        </p>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          {history.length === 0 ? (
            <p className="px-3 py-4 text-center text-[12px] font-normal leading-[16px] text-muted-foreground">
              {t("historyEmpty")}
            </p>
          ) : (
            history.map((entry, index) => {
              const d = new Date(entry.createdAt);
              const isYearOnly = d.getMonth() === 11 && d.getDate() === 31;
              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 px-3 py-2.5 ${index > 0 ? "border-t border-border" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold leading-[18px] text-foreground">
                      {categoryLabel(t, { id: entry.categoryId, name: entry.categoryName })}
                      <span className="ml-1 font-normal text-muted-foreground">
                        ×{entry.amount.toLocaleString(language)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] font-normal leading-[15px] text-muted-foreground">
                      {isYearOnly
                        ? d.getFullYear()
                        : d.toLocaleString(language, { year: "numeric", month: "long" })}
                      {" · "}
                      {entry.area === "privat" ? t("private") : t("work")}
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
      </section>
    </main>
  );
}
