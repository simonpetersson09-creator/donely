import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronLeft, Lock } from "lucide-react";

import { getFeedback, getTelemetryOverview } from "@/lib/telemetry.functions";
import { isUsageUnlocked, unlockUsage } from "@/lib/usage-gate.functions";

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

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-primary/10 bg-card/60 px-4 py-3">
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80">{hint}</p>
    </div>
  );
}

const TOKEN_KEY = "donely.usage-token";

function readToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function UsagePage() {
  const queryClient = useQueryClient();
  const unlock = useServerFn(unlockUsage);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: unlocked, isLoading: gateLoading } = useQuery({
    queryKey: ["usage-unlocked"],
    queryFn: () => isUsageUnlocked({ data: { token: readToken() } }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["telemetry-overview"],
    queryFn: () => getTelemetryOverview({ data: { token: readToken() } }),
    enabled: unlocked === true,
    retry: false,
  });

  const { data: feedback } = useQuery({
    queryKey: ["app-feedback"],
    queryFn: () => getFeedback({ data: { token: readToken() } }),
    enabled: unlocked === true,
    retry: false,
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(false);
    try {
      const { ok, token } = await unlock({ data: { password: password.trim() } });
      if (ok) {
        try {
          window.localStorage.setItem(TOKEN_KEY, token);
        } catch {
          // Local storage blocked — the session cookie may still carry it.
        }
        await queryClient.invalidateQueries({ queryKey: ["usage-unlocked"] });
        await queryClient.invalidateQueries({ queryKey: ["telemetry-overview"] });
      } else {
        setError(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (gateLoading) {
    return <div className="min-h-dvh bg-background" />;
  }

  if (!unlocked) {
    return (
      <div className="flex min-h-dvh flex-col bg-background px-5 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-[calc(env(safe-area-inset-top,0px)+24px)]">
        <h1 className="mx-auto rounded-full bg-primary/10 px-4 py-1.5 text-[15px] font-semibold text-foreground">
          Användning
        </h1>

        <form onSubmit={onSubmit} className="mt-10 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <p className="text-[13px] text-muted-foreground">
            Den här sidan är låst. Ange din kod för att se statistiken.
          </p>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Kod"
            className="w-48 rounded-xl border border-primary/10 bg-card/60 px-4 py-3 text-center text-[15px] text-foreground outline-none focus:border-primary/40"
          />
          {error && (
            <p className="text-[13px] font-medium text-destructive">Fel kod, försök igen.</p>
          )}
          <button
            type="submit"
            disabled={submitting || password.length === 0}
            className="press-down rounded-full bg-gradient-gold px-6 py-2.5 text-[14px] font-semibold text-primary shadow-gold disabled:opacity-50"
          >
            Lås upp
          </button>
        </form>

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

  return (
    <div className="flex min-h-dvh flex-col bg-background px-5 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-[calc(env(safe-area-inset-top,0px)+24px)]">
      <h1 className="mx-auto rounded-full bg-primary/10 px-4 py-1.5 text-[15px] font-semibold text-foreground">
        Användning
      </h1>

      <p className="mt-6 text-[13px] text-muted-foreground">
        Anonym statistik. Ingen personlig information och inget innehåll från appen sparas.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat
          label="Enheter totalt"
          value={isLoading ? 0 : (data?.devices ?? 0)}
          hint="Unika telefoner som öppnat appen minst en gång"
        />
        <Stat
          label="Appöppningar"
          value={isLoading ? 0 : (data?.opens ?? 0)}
          hint="Alla starter av appen, alla enheter sammanlagt"
        />
        <Stat
          label="Aktiva senaste 7 dagarna"
          value={isLoading ? 0 : (data?.active7 ?? 0)}
          hint="Enheter som öppnat appen den senaste veckan"
        />
        <Stat
          label="Aktiva senaste 30 dagarna"
          value={isLoading ? 0 : (data?.active30 ?? 0)}
          hint="Enheter som öppnat appen den senaste månaden"
        />
        <Stat
          label="Nya senaste 7 dagarna"
          value={isLoading ? 0 : (data?.newLast7 ?? 0)}
          hint="Nya enheter som öppnat appen första gången"
        />
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
