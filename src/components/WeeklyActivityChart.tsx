import { useMemo } from "react";
import { weekStart } from "@/lib/weekly-summary";
import type { Entry } from "@/lib/store";

export function WeeklyActivityChart({
  entries,
  locale,
  title,
}: {
  entries: Entry[];
  locale: string;
  title: string;
}) {
  const days = useMemo(() => {
    const start = weekStart();
    const dayFormatter = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
    const daysData = [];

    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + i,
        0,
        0,
        0,
        0,
      );
      const dayEnd = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + i + 1,
        0,
        0,
        0,
        0,
      );
      const count = entries.reduce((sum, entry) => {
        const at = new Date(entry.createdAt).getTime();
        return at >= dayStart.getTime() && at < dayEnd.getTime() ? sum + entry.amount : sum;
      }, 0);
      daysData.push({
        label: dayFormatter.format(dayStart),
        count,
        date: dayStart,
      });
    }
    return daysData;
  }, [entries, locale]);

  const max = useMemo(() => Math.max(0, ...days.map((d) => d.count)), [days]);

  return (
    <div className="card-base mt-4">
      <h3 className="mb-3 text-[15px] font-bold text-primary">{title}</h3>
      <div className="flex h-32 items-end gap-1">
        {days.map((day) => (
          <div key={day.label} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[13px] font-bold tabular-nums text-card-foreground">
              {day.count}
            </span>
            <div className="relative flex h-24 w-full items-end justify-center rounded-t-lg bg-secondary">
              <div
                className="w-full max-w-[32px] rounded-t-lg bg-primary transition-all duration-300 ease-out"
                style={{ height: max > 0 ? `${(day.count / max) * 100}%` : "0%" }}
                aria-label={`${day.label}: ${day.count}`}
              />
            </div>
            <span className="text-[11px] font-medium uppercase text-muted-foreground">
              {day.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
