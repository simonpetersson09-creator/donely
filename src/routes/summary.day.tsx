import { createFileRoute, redirect } from "@tanstack/react-router";
import { validateSummarySearch } from "@/lib/summary-date";

/**
 * Stable deep link used by the daily notification:
 * `/summary/day?date=2026-08-23` → the daily summary for that exact day.
 */
export const Route = createFileRoute("/summary/day")({
  validateSearch: validateSummarySearch,
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/dagsstatistik", search, replace: true });
  },
  component: () => null,
});
