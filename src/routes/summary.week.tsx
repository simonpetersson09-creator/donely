import { createFileRoute, redirect } from "@tanstack/react-router";
import { validateSummarySearch } from "@/lib/summary-date";

/**
 * Stable deep link used by the Friday notification:
 * `/summary/week?date=2026-08-23` → the weekly summary for that week.
 */
export const Route = createFileRoute("/summary/week")({
  validateSearch: validateSummarySearch,
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/veckostatistik", search, replace: true });
  },
  component: () => null,
});
