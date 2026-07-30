import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Minus, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCategories, useEntries, type Area } from "@/lib/store";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Donely – registrera på under 5 sekunder" },
      {
        name: "description",
        content:
          "Dokumentera genomförda aktiviteter inom jobb och privat. Välj område, kategori och antal – registrera på under fem sekunder.",
      },
      { property: "og:title", content: "Donely" },
      {
        property: "og:description",
        content: "Dokumentera vad du faktiskt har åstadkommit – jobb och privat, på fem sekunder.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [area, setArea] = useState<Area>("jobb");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("1");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { categories, addCategory, hydrated } = useCategories();
  const { addEntry } = useEntries();

  const areaCategories = useMemo(
    () => categories.filter((c) => c.area === area),
    [categories, area],
  );

  useEffect(() => {
    if (!areaCategories.some((c) => c.id === categoryId)) {
      setCategoryId(areaCategories[0]?.id ?? null);
    }
  }, [areaCategories, categoryId]);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);


  const selected = areaCategories.find((c) => c.id === categoryId);
  const parsed = Number.parseInt(amount, 10);
  const valid = Number.isInteger(parsed) && parsed > 0 && !!selected;

  const accentText = area === "jobb" ? "text-accent-work" : "text-accent-life";

  function register() {
    if (!valid || !selected) return;
    addEntry({ area, categoryId: selected.id, categoryName: selected.name, amount: parsed });
    navigator.vibrate?.(12);
    setAmount("1");
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 1100);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      <header className="flex justify-center pb-1">
        <div className="inline-flex items-center gap-2 rounded-2xl bg-card px-5 py-3 shadow-sm">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-6 w-6 text-[hsl(var(--gold,42_78%_52%))]"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--color-gold-deep, #c9a227)" }}
          >
            <path d="M4 13.5 9.5 19 20 5.5" />
          </svg>
          <h1 className="text-2xl font-semibold tracking-tight text-card-foreground">
            donely
          </h1>
        </div>
      </header>



      {/* Område */}
      <div className="mt-7 grid grid-cols-2 gap-3">
        <AreaButton
          active={area === "jobb"}
          onClick={() => setArea("jobb")}
          emoji="💼"
          label="Jobb"
          tone="work"
        />
        <AreaButton
          active={area === "privat"}
          onClick={() => setArea("privat")}
          emoji="🏡"
          label="Privat"
          tone="life"
        />
      </div>

      {/* Kategori */}
      <section className="mt-6">
        <Label>Kategori</Label>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 text-left shadow-card transition-transform active:scale-[0.985]"
        >
          <span className="text-[17px] font-medium">
            {hydrated ? (selected?.name ?? "Skapa en kategori") : "Laddar…"}
          </span>
          <ChevronDown className="size-5 text-muted-foreground" />
        </button>
      </section>

      {/* Antal */}
      <section className="mt-6">
        <Label>Antal</Label>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2 shadow-card">
          <StepButton
            onClick={() => setAmount(String(Math.max(1, (parsed || 1) - 1)))}
            aria-label="Minska antal"
          >
            <Minus className="size-5" />
          </StepButton>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
            onFocus={(e) => e.target.select()}
            aria-label="Antal"
            className="min-w-0 flex-1 bg-transparent text-center text-[36px] font-semibold tabular-nums outline-none"
          />
          <StepButton
            onClick={() => setAmount(String((parsed || 0) + 1))}
            aria-label="Öka antal"
          >
            <Plus className="size-5" />
          </StepButton>
        </div>
        <div className="mt-3 flex gap-2">
          {[1, 5, 10, 25].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setAmount(String(n))}
              className="flex-1 rounded-full border border-primary/20 bg-card py-2 text-[15px] font-semibold text-primary shadow-soft transition-colors active:bg-accent"
            >
              {n}
            </button>
          ))}
        </div>

      </section>

      <div className="flex-1" />

      {/* Registrera */}
      <div className="mt-8 space-y-3">
        <div className="h-5 text-center">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-[15px] font-medium transition-all duration-300",
              accentText,
              flash ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
            )}
          >
            <Check className="size-4" /> Registrerat
          </span>
        </div>
        <button
          type="button"
          disabled={!valid}
          onClick={register}
          className="w-full rounded-2xl bg-gradient-gold py-4 text-[19px] font-semibold text-gold-foreground shadow-gold transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
        >
          Registrera
        </button>
        <Link
          to="/statistik"
          className="flex w-full items-center justify-center rounded-2xl border border-primary/20 bg-card py-3.5 text-[17px] font-semibold text-primary shadow-card transition-transform active:scale-[0.98]"
        >
          📊 Statistik
        </Link>

      </div>

      {pickerOpen && (
        <CategorySheet
          area={area}
          categories={areaCategories}
          selectedId={categoryId}
          onSelect={(id) => {
            setCategoryId(id);
            setPickerOpen(false);
          }}
          onCreate={(name) => {
            const created = addCategory(name, area);
            setCategoryId(created.id);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </main>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground/60">
      {children}
    </p>
  );
}

function StepButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary transition-transform active:scale-90"
    >
      {children}
    </button>
  );
}


function AreaButton({
  active,
  onClick,
  emoji,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
  tone: "work" | "life";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-2xl border py-5 text-[17px] font-semibold transition-all duration-200 active:scale-[0.97]",
        active
          ? tone === "work"
            ? "border-transparent bg-primary text-primary-foreground shadow-card"
            : "border-transparent bg-accent-life text-primary-foreground shadow-card"
          : "border-border bg-card text-foreground/55",
      )}

    >
      <span className="block text-[26px] leading-none">{emoji}</span>
      <span className="mt-2 block">{label}</span>
    </button>
  );
}

function CategorySheet({
  area,
  categories,
  selectedId,
  onSelect,
  onCreate,
  onClose,
}: {
  area: Area;
  categories: { id: string; name: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState("");
  const accent = area === "jobb" ? "text-accent-work" : "text-accent-life";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Stäng"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px] animate-in fade-in"
      />
      <div className="relative w-full max-w-md rounded-t-3xl border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-card animate-in slide-in-from-bottom duration-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[20px] font-bold">
            {area === "jobb" ? "💼 Jobb" : "🏡 Privat"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Stäng"
            className="flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[45dvh] space-y-1 overflow-y-auto">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className="flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left text-[17px] transition-colors active:bg-secondary"
            >
              {c.name}
              {c.id === selectedId && <Check className={cn("size-5", accent)} />}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) {
              onCreate(newName);
              setNewName("");
            }
          }}
          className="mt-4 flex gap-2 border-t border-border pt-4"
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ny kategori"
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-[17px] outline-none placeholder:text-muted-foreground focus:border-ring"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="rounded-xl bg-gradient-gold px-5 text-[17px] font-semibold text-gold-foreground transition-transform active:scale-95 disabled:opacity-40"
          >
            Lägg till
          </button>
        </form>
      </div>
    </div>
  );
}
