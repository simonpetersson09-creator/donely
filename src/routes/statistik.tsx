import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/statistik")({
  head: () => ({
    meta: [
      { title: "Statistik – Veckans Resultat" },
      {
        name: "description",
        content:
          "Översikt över dina registrerade aktiviteter inom jobb och privat. Statistikvyn är under utveckling.",
      },
      { property: "og:title", content: "Statistik – Veckans Resultat" },
      {
        property: "og:description",
        content: "Översikt över dina registrerade aktiviteter inom jobb och privat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Statistik,
});

function Statistik() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-1 py-4">
        <Link
          to="/"
          className="-ml-2 inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[17px] text-accent-work transition-colors hover:bg-secondary"
        >
          <ChevronLeft className="size-5" />
          Tillbaka
        </Link>
      </div>

      <h1 className="text-[34px] font-bold leading-tight tracking-tight">Statistik</h1>

      <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center shadow-card">
        <div className="text-4xl">📊</div>
        <p className="mt-4 text-[17px] font-semibold">Kommer snart</p>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          Här kommer du kunna följa veckans resultat per område och kategori.
        </p>
      </div>
    </main>
  );
}
