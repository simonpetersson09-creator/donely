import { Link } from "@tanstack/react-router";
import { BarChart3, Calendar, CalendarDays } from "lucide-react";
import { useLanguage } from "@/lib/use-language";
import { cn } from "@/lib/utils";

export type StatsView = "day" | "week" | "year";

const segments: {
  view: StatsView;
  to: string;
  icon: React.ReactNode;
  labelKey: "dailySummaryLink" | "weeklySummaryLink" | null;
}[] = [
  {
    view: "day",
    to: "/dagsstatistik",
    icon: <Calendar className="size-3.5" />,
    labelKey: "dailySummaryLink",
  },
  {
    view: "week",
    to: "/veckostatistik",
    icon: <CalendarDays className="size-3.5" />,
    labelKey: "weeklySummaryLink",
  },
  {
    view: "year",
    to: "/statistik",
    icon: <BarChart3 className="size-3.5" />,
    labelKey: null,
  },
];

export function StatsSegmentedControl({ active }: { active: StatsView }) {
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();

  return (
    <div
      className="flex w-full items-center rounded-full bg-secondary p-1 shadow-soft"
      role="tablist"
    >
      {segments.map((segment) => {
        const isActive = active === segment.view;
        const label = segment.labelKey ? t(segment.labelKey) : String(currentYear);
        return (
          <Link
            key={segment.view}
            to={segment.to}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 text-[13px] font-semibold transition-all",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-primary hover:bg-secondary-foreground/10",
            )}
          >
            {segment.icon}
            <span>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
