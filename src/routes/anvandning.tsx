import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";

import { getTelemetryOverview } from "@/lib/telemetry.functions";

export const Route = createFileRoute("/anvandning")({
  component: UsagePage,
  head: () => ({
    meta: [
      { title: "Användning – Donely" },
      {
        name: "description",
        content: "Anonym översikt över hur många enheter som öppnar Donely.",
      },
      { property: "og:title", content: "Användning – Donely" },
      {
        property: "og:description",
        content: "Anonym översikt över hur många enheter som öppnar Donely.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-primary/10 bg-card/60 px-4 py-3">
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{label}</p>
    </div>
  );
}

function UsagePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["telemetry-overview"],
    queryFn: () => getTelemetryOverview(),
  });

  return (
    <div className="flex min-h-dvh flex-col bg-background px-5 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-[calc(env(safe-area-inset-top,0px)+24px)]">
      <h1 className="mx-auto rounded-full bg-primary/10 px-4 py-1.5 text-[15px] font-semibold text-foreground">
        Användning
      </h1>

      <p className="mt-6 text-[13px] text-muted-foreground">
        Anonym statistik. Ingen personlig information och inget innehåll från appen sparas.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Enheter totalt" value={isLoading ? 0 : (data?.devices ?? 0)} />
        <Stat label="Appöppningar" value={isLoading ? 0 : (data?.opens ?? 0)} />
        <Stat label="Aktiva senaste 7 dagarna" value={isLoading ? 0 : (data?.active7 ?? 0)} />
        <Stat label="Aktiva senaste 30 dagarna" value={isLoading ? 0 : (data?.active30 ?? 0)} />
        <Stat label="Nya senaste 7 dagarna" value={isLoading ? 0 : (data?.newLast7 ?? 0)} />
      </div>

      <div className="mt-auto pt-8">
        <Link
          to="/"
          className="press-down inline-flex items-center gap-1 rounded-full border border-primary/10 bg-card/60 px-4 py-2 text-[14px] font-semibold text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Tillbaka
        </Link>
      </div>
    </div>
  );
}
