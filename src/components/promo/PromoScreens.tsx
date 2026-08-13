import { Briefcase, Home, ChevronDown, Minus, Plus, Check, Crown } from "lucide-react";

/**
 * Stand-alone visual replicas of the app's key screens, used only by the
 * /promo marketing video page. Nothing here is imported by the real app.
 */

const dot = (c: string) => (
  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c }} />
);

export function PhoneChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-[1000px] w-[492px] rounded-[72px] bg-[#0f1520] p-[14px] shadow-[0_60px_120px_-40px_rgba(0,0,0,0.65)]">
      <div className="relative h-full w-full overflow-hidden rounded-[60px] bg-background">
        <div className="absolute left-1/2 top-[18px] z-20 h-[30px] w-[112px] -translate-x-1/2 rounded-full bg-[#0f1520]" />
        {children}
      </div>
    </div>
  );
}

export function RegisterScreen({ amount, pressed }: { amount: number; pressed: boolean }) {
  return (
    <div className="flex h-full flex-col px-8 pb-10 pt-[92px]">
      <div className="flex flex-col items-center">
        <div className="relative mb-3 rounded-full bg-primary px-4 py-1.5">
          <span className="flex items-center gap-1.5 text-[15px] font-semibold text-primary-foreground">
            <Crown className="size-3.5 text-gold" fill="currentColor" />7 dagar gratis
          </span>
          <div className="absolute -bottom-[4px] left-5 size-3 rotate-45 rounded-[1px] bg-primary" />
        </div>
        <h1 className="font-logo text-[46px] font-bold leading-none tracking-[-0.04em] text-primary">
          Donely
        </h1>
        <p className="mt-1 text-[16px] font-medium tracking-wide text-primary/80">
          Det du faktiskt gjort
        </p>
      </div>

      <div className="mt-9 flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-secondary p-1.5">
          <div className="flex items-center justify-center gap-2 rounded-xl bg-card py-3 text-[17px] font-semibold text-primary shadow-card">
            <Briefcase className="size-4" /> Jobb
          </div>
          <div className="flex items-center justify-center gap-2 rounded-xl py-3 text-[17px] font-medium text-muted-foreground">
            <Home className="size-4" /> Privat
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[14px] font-semibold uppercase tracking-wider text-muted-foreground">
            Kategori
          </p>
          <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 shadow-card">
            <span className="flex items-center gap-2.5 text-[19px] font-medium text-card-foreground">
              {dot("#2f5d8a")} Kundmöten
            </span>
            <ChevronDown className="size-4 text-primary" />
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[14px] font-semibold uppercase tracking-wider text-muted-foreground">
            Antal
          </p>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-card">
            <div className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
              <Minus className="size-4" />
            </div>
            <div className="flex-1 text-center text-[34px] font-semibold tabular-nums text-card-foreground">
              {amount}
            </div>
            <div className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
              <Plus className="size-4" />
            </div>
          </div>
          <div className="mt-2.5 flex gap-2.5">
            {[1, 5, 10, 25].map((n) => (
              <div
                key={n}
                className="flex-1 rounded-full border border-primary/20 bg-card py-2 text-center text-[15px] font-semibold text-primary shadow-soft"
              >
                +{n}
              </div>
            ))}
          </div>
        </div>

        <div
          className="mt-2 rounded-2xl bg-gradient-gold py-5 text-center text-[21px] font-bold text-gold-foreground shadow-gold"
          style={{ transform: pressed ? "scale(0.965)" : "scale(1)", transition: "transform 90ms" }}
        >
          Registrera
        </div>
      </div>
    </div>
  );
}

const WEEK = [
  { label: "Kundmöten", color: "#2f5d8a", value: 12, goal: 100, pct: 74 },
  { label: "Offerter", color: "#2e8b84", value: 8, goal: 60, pct: 58 },
  { label: "Träningspass", color: "#4c8b3f", value: 4, goal: 150, pct: 41 },
  { label: "Lästa böcker", color: "#d1a13a", value: 2, goal: 24, pct: 29 },
];

export function WeekScreen({ reveal }: { reveal: number }) {
  return (
    <div className="flex h-full flex-col px-7 pb-10 pt-[96px]">
      <h2 className="text-center text-[30px] font-bold tracking-[-0.02em] text-primary">Din vecka</h2>
      <p className="mt-1 text-center text-[15px] text-muted-foreground">v.33 · 11–17 augusti</p>

      <div className="card-base mt-5 grid grid-cols-2 gap-3 px-3 py-3">
        <div className="rounded-xl bg-accent-life-soft px-3 py-3">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
            <Home className="size-3.5" /> Privat
          </p>
          <p className="mt-1 text-[30px] font-bold tabular-nums text-foreground">6</p>
        </div>
        <div className="rounded-xl bg-accent-work-soft px-3 py-3">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
            <Briefcase className="size-3.5" /> Jobb
          </p>
          <p className="mt-1 text-[30px] font-bold tabular-nums text-foreground">20</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {WEEK.map((r, i) => {
          const p = Math.max(0, Math.min(1, reveal * 4 - i * 0.5));
          return (
            <div
              key={r.label}
              className="card-base px-4 py-3"
              style={{ opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2.5 text-[18px] font-medium text-card-foreground">
                  {dot(r.color)} {r.label}
                </span>
                <span className="text-[20px] font-bold tabular-nums text-foreground">{r.value}</span>
              </div>
              <div className="mt-2.5 h-[6px] w-full overflow-hidden rounded-full bg-accent">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${r.pct * p}%`,
                    backgroundColor: r.color,
                    transition: "width 200ms linear",
                  }}
                />
              </div>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                {Math.round((r.pct * r.goal) / 100)} av {r.goal} i år
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Toast({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-primary px-5 py-3.5 text-[17px] font-semibold text-primary-foreground shadow-card">
      <Check className="size-4.5 text-gold" strokeWidth={3} />
      {text}
    </div>
  );
}
