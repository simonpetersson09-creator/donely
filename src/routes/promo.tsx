import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PhoneChrome, RegisterScreen, WeekScreen, Toast } from "@/components/promo/PromoScreens";

export const Route = createFileRoute("/promo")({
  head: () => ({
    meta: [
      { title: "Donely – promo (9:16)" },
      {
        name: "description",
        content:
          "Loopande 9:16-promo för Donely: dokumentera vad du faktiskt åstadkommit på fem sekunder.",
      },
      { property: "og:title", content: "Donely – promo (9:16)" },
      {
        property: "og:description",
        content: "Loopande vertikal promo-animation för Donely, redo att spelas in för Reels.",
      },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Promo,
});

const DUR = 11500;

/** Linear 0..1 ramp between two timestamps, clamped. */
const ramp = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
/** Ease-out cubic. */
const eo = (x: number) => 1 - Math.pow(1 - x, 3);
/** Fade in then out over a window. */
const win = (t: number, a: number, b: number, f = 320) =>
  Math.min(ramp(t, a, a + f), 1 - ramp(t, b - f, b));

function Promo() {
  const t = useClock();
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () =>
      setScale(Math.min(window.innerWidth / 1080, window.innerHeight / 1920));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // ---- timeline -----------------------------------------------------------
  const hook = win(t, 0, 2400, 300);
  const hook2 = win(t, 900, 2400, 300);
  const appIn = eo(ramp(t, 2100, 2900));
  const stageOut = 1 - ramp(t, 9200, 9700);

  const tap = win(t, 3250, 3600, 120);
  const amount = t > 3350 && t < 9200 ? 6 : 1;
  const pressed = t > 4450 && t < 4650;
  const toast = win(t, 4650, 5900, 260);
  const cap1 = win(t, 3100, 6000, 300);

  const toWeek = ramp(t, 6100, 6500);
  const weekReveal = ramp(t, 6400, 7600);
  const cap2 = win(t, 6800, 9200, 300);

  const cta = ramp(t, 9500, 10100);
  const ctaOut = 1 - ramp(t, 11150, DUR);

  const phoneY = (1 - appIn) * 220;
  const phoneScale = 0.92 + appIn * 0.08 + ramp(t, 6100, 9000) * 0.05;

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[#0b0f16]">
      <div
        className="relative overflow-hidden bg-background"
        style={{
          width: 1080,
          height: 1920,
          transform: `scale(${scale})`,
          transformOrigin: "center",
        }}
      >
        {/* warm background wash */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 70% at 50% 0%, oklch(0.82 0.02 60) 0%, oklch(0.74 0.008 50) 55%, oklch(0.66 0.012 250) 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-[900px]"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 20%, oklch(0.88 0.08 92 / 0.35), transparent 70%)",
            opacity: 0.6 + 0.4 * Math.sin(t / 900),
          }}
        />

        {/* ---- HOOK ---- */}
        <div
          className="absolute inset-x-0 top-[520px] px-24 text-center"
          style={{ opacity: hook, pointerEvents: "none" }}
        >
          <p
            className="text-[104px] font-bold leading-[1.02] tracking-[-0.04em] text-primary"
            style={{ transform: `translateY(${(1 - eo(ramp(t, 0, 700))) * 40}px)` }}
          >
            Du gör massor.
          </p>
          <p
            className="mt-6 text-[104px] font-bold leading-[1.02] tracking-[-0.04em]"
            style={{
              opacity: hook2,
              color: "var(--gold-deep)",
              transform: `translateY(${(1 - eo(ramp(t, 900, 1500))) * 40}px)`,
            }}
          >
            Och glömmer allt.
          </p>
        </div>

        {/* ---- PHONE STAGE ---- */}
        <div
          className="absolute inset-x-0 flex justify-center"
          style={{
            top: 300,
            opacity: appIn * stageOut,
            transform: `translateY(${phoneY}px) scale(${phoneScale})`,
          }}
        >
          <div className="relative">
            <PhoneChrome>
              <div className="absolute inset-0" style={{ opacity: 1 - toWeek }}>
                <RegisterScreen amount={amount} pressed={pressed} />
              </div>
              <div className="absolute inset-0" style={{ opacity: toWeek }}>
                <WeekScreen reveal={weekReveal} />
              </div>

              {/* toast inside the phone */}
              <div
                className="absolute inset-x-0 top-[70px] flex justify-center"
                style={{
                  opacity: toast,
                  transform: `translateY(${(1 - toast) * -18}px)`,
                }}
              >
                <Toast text="Registrerat" />
              </div>
            </PhoneChrome>

            {/* tap ripple on the +5 chip */}
            <div
              className="pointer-events-none absolute"
              style={{ left: 186, top: 690, opacity: tap }}
            >
              <div
                className="size-[74px] rounded-full border-[3px] border-primary/70"
                style={{ transform: `scale(${0.5 + tap * 0.9})` }}
              />
            </div>
            <div
              className="pointer-events-none absolute"
              style={{ left: 300, top: 838, opacity: pressed ? 1 : 0 }}
            >
              <div className="size-[80px] rounded-full bg-gold/40" />
            </div>
          </div>
        </div>

        {/* ---- CAPTIONS ---- */}
        <Caption opacity={cap1} top={1560}>
          Registrera på 5 sekunder
        </Caption>
        <Caption opacity={cap2} top={1560}>
          Se svart på vitt vad du gjort
        </Caption>

        {/* ---- CTA ---- */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ opacity: cta * ctaOut }}
        >
          <img
            src="/icon-512.png"
            alt="Donely appikon"
            className="size-[228px] rounded-[52px] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.5)]"
            style={{ transform: `scale(${0.88 + eo(cta) * 0.12})` }}
          />
          <h2 className="font-logo mt-10 text-[112px] font-bold leading-none tracking-[-0.04em] text-primary">
            Donely
          </h2>
          <p className="mt-4 text-[40px] font-medium tracking-wide text-primary/80">
            Det du faktiskt gjort
          </p>
          <div
            className="mt-14 rounded-full bg-gradient-gold px-16 py-7 text-[42px] font-bold text-gold-foreground shadow-gold"
            style={{ transform: `translateY(${(1 - eo(ramp(t, 9900, 10500))) * 30}px)` }}
          >
            Ladda ner på App Store
          </div>
        </div>
      </div>
    </div>
  );
}

function Caption({
  opacity,
  top,
  children,
}: {
  opacity: number;
  top: number;
  children: React.ReactNode;
}) {
  if (opacity <= 0.001) return null;
  return (
    <div
      className="absolute inset-x-0 px-20 text-center"
      style={{ top, opacity, transform: `translateY(${(1 - opacity) * 16}px)` }}
    >
      <span className="inline-block rounded-full bg-primary px-10 py-5 text-[46px] font-bold tracking-[-0.02em] text-primary-foreground shadow-card">
        {children}
      </span>
    </div>
  );
}

/** Looping wall-clock in ms, driven by rAF so the animation is seamless. */
function useClock() {
  const [t, setT] = useState(0);
  const start = useRef<number | null>(null);
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      if (start.current === null) start.current = now;
      setT((now - start.current) % DUR);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return t;
}
