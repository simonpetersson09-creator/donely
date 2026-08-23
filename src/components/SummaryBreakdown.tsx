import type { ReactNode } from "react";
import { Home, Briefcase, MapPin, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCategories, type Area } from "@/lib/store";
import { useLanguage, useLocale } from "@/lib/use-language";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { CategoryDot } from "@/components/CategoryDot";

export type SummaryRow = {
  id: string;
  label: string;
  total: number;
  distanceKm: number;
  durationMin: number;
};

/**
 * Shared overview + per-area table used by the daily and weekly summaries,
 * mirroring the layout of the yearly statistics page.
 */
export function SummaryBreakdown({
  rows,
  title,
  subtitle,
  children,
}: {
  rows: SummaryRow[];
  title?: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useLanguage();
  const { categories } = useCategories();

  const areaOf = (id: string): Area =>
    (categories.find((c) => c.id === id)?.area ?? "privat") as Area;
  const colorOf = (id: string) => categories.find((c) => c.id === id)?.color ?? null;

  const privat = rows.filter((r) => areaOf(r.id) === "privat");
  const jobb = rows.filter((r) => areaOf(r.id) === "jobb");
  const sum = (list: SummaryRow[]) => list.reduce((acc, r) => acc + r.total, 0);

  return (
    <>
      <div className="card-base mt-3 px-2 py-2">
        <div className="grid grid-cols-2 gap-2">
          <AreaStat
            icon={<Home className="size-3" />}
            label={t("private")}
            value={sum(privat)}
            tone="life"
          />
          <AreaStat
            icon={<Briefcase className="size-3" />}
            label={t("work")}
            value={sum(jobb)}
            tone="work"
          />
        </div>
      </div>

      {title && (
        <div className="mt-3 px-1 text-center">
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.03em] text-primary">
            {title}
          </h1>
          {subtitle}
        </div>
      )}
      {children}

      <SummarySection
        title={t("private")}
        icon={<Home className="size-4" />}
        area="privat"
        rows={privat}
        colorOf={colorOf}
      />
      <SummarySection
        title={t("work")}
        icon={<Briefcase className="size-4" />}
        area="jobb"
        rows={jobb}
        colorOf={colorOf}
      />
    </>
  );
}

function AreaStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: "life" | "work";
}) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl bg-secondary/60 px-2 py-1.5">
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          tone === "life"
            ? "bg-accent-life-soft text-accent-life"
            : "bg-accent-work-soft text-accent-work",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 text-center">
        <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className="text-[17px] font-bold leading-none tabular-nums text-card-foreground">
          <AnimatedNumber value={value} />
        </p>
      </div>
    </div>
  );
}

function SummarySection({
  title,
  icon,
  area,
  rows,
  colorOf,
}: {
  title: string;
  icon: ReactNode;
  area: Area;
  rows: SummaryRow[];
  colorOf: (id: string) => string | null;
}) {
  const { t } = useLanguage();
  const locale = useLocale();
  if (rows.length === 0) return null;
  return (
    <section className="mt-4">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full",
            area === "privat"
              ? "bg-accent-life-soft text-accent-life"
              : "bg-accent-work-soft text-accent-work",
          )}
        >
          {icon}
        </span>
        <h2 className="text-[17px] font-bold leading-tight tracking-[-0.02em] text-primary">
          {title}
        </h2>
      </div>
      <div className="card-base overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_56px] items-center gap-2 border-b border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>{t("activity")}</span>
          <span className="text-center">{t("done")}</span>
        </div>
        {rows.map((row, idx) => {
          const hours = Math.floor(row.durationMin / 60);
          const mins = Math.round(row.durationMin % 60);
          const hasMetrics = row.distanceKm > 0 || row.durationMin > 0;
          return (
            <div
              key={row.id}
              className={cn(
                "stagger-item px-3 py-1.5",
                idx < rows.length - 1 && "border-b border-border",
              )}
              style={{ animationDelay: `${Math.min(idx, 12) * 30}ms` }}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_56px] items-center gap-2">
                <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                  <CategoryDot color={colorOf(row.id)} />
                  <span className="block truncate text-[14px] font-medium text-card-foreground">
                    {row.label}
                  </span>
                </div>
                <span className="shrink-0 text-center text-[16px] font-bold tabular-nums text-card-foreground">
                  <AnimatedNumber value={row.total} />
                </span>
              </div>
              {hasMetrics && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 pb-0.5">
                  {row.distanceKm > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium tabular-nums text-card-foreground/80">
                      <MapPin className="size-3 text-primary" />
                      {row.distanceKm.toLocaleString(locale, { maximumFractionDigits: 1 })} km
                    </span>
                  )}
                  {row.durationMin > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium tabular-nums text-card-foreground/80">
                      <Timer className="size-3 text-primary" />
                      {hours > 0 ? `${hours} h ${mins} min` : `${mins} min`}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
