import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Minus, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCategories, useEntries, DEFAULT_CATEGORIES, type Area } from "@/lib/store";

const DEFAULT_IDS = new Set(DEFAULT_CATEGORIES.map((c) => c.id));




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

  const { categories, addCategory, renameCategory, removeCategory, hydrated } = useCategories();
  const { addEntry } = useEntries();

  const areaCategories = useMemo(() => {
    const list = categories.filter((c) => c.area === area);
    const isStd = (id: string) => DEFAULT_IDS.has(id);
    return [
      ...list.filter((c) => isStd(c.id)),
      ...list.filter((c) => !isStd(c.id)),
    ];
  }, [categories, area]);


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

  const accentText = "text-primary";

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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div className="flex flex-1 items-center justify-center">
        <h1 className="select-none font-['Inter',system-ui,-apple-system,sans-serif] text-[36px] font-bold leading-none tracking-[-0.04em] text-primary">
          Donely
        </h1>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3">
        {/* Område */}
        <div className="grid grid-cols-2 gap-2">
          <AreaButton
            active={area === "jobb"}
            onClick={() => setArea("jobb")}
            label="Jobb"
            tone="work"
          />
          <AreaButton
            active={area === "privat"}
            onClick={() => setArea("privat")}
            label="Privat"
            tone="life"
          />
        </div>

        {/* Kategori */}
        <section>
          <Label>Kategori</Label>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3.5 py-2.5 text-left text-card-foreground shadow-card transition-transform active:scale-[0.985]"
          >
            <span className="text-[15px] font-medium">
              {hydrated ? (selected?.name ?? "Skapa en kategori") : "Laddar…"}
            </span>
            <ChevronDown className="size-3.5 text-card-foreground/60" />
          </button>
        </section>

        {/* Antal */}
        <section>
          <Label>Antal</Label>
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card p-1 shadow-card">
            <StepButton
              onClick={() => setAmount(String(Math.max(1, (parsed || 1) - 1)))}
              aria-label="Minska antal"
            >
              <Minus className="size-3.5" />
            </StepButton>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
              onFocus={(e) => e.target.select()}
              aria-label="Antal"
              className="min-w-0 flex-1 bg-transparent text-center text-[24px] font-semibold tabular-nums text-card-foreground outline-none"
            />
            <StepButton
              onClick={() => setAmount(String((parsed || 0) + 1))}
              aria-label="Öka antal"
            >
              <Plus className="size-3.5" />
            </StepButton>
          </div>
          <div className="mt-1.5 flex gap-2">
            {[1, 5, 10, 25].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAmount(String(n))}
                className="flex-1 rounded-full border border-primary/20 bg-card py-1 text-[12px] font-semibold text-primary shadow-soft transition-colors active:bg-accent"
              >
                {n}
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Registrera + Statistik — fasta längst ner */}
      <div className="mt-auto space-y-2 pb-1">
        <div className="h-4 text-center">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-[13px] font-medium transition-all duration-300",
              accentText,
              flash ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
            )}
          >
            <Check className="size-3.5" /> Registrerat
          </span>
        </div>
        <button
          type="button"
          disabled={!valid}
          onClick={register}
          className="w-full rounded-xl bg-primary py-3 text-[16px] font-semibold text-primary-foreground shadow-card transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
        >
          Registrera
        </button>
        <Link
          to="/statistik"
          className="flex w-full items-center justify-center rounded-xl border border-border bg-card py-3 text-[16px] font-semibold text-primary shadow-card transition-transform active:scale-[0.98]"
        >
          Statistik
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
          onRename={renameCategory}
          onDelete={removeCategory}
          onClose={() => setPickerOpen(false)}

        />
      )}
    </main>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/60">
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
      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary transition-transform active:scale-90"
    >
      {children}
    </button>
  );
}


function AreaButton({
  active,
  onClick,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone: "work" | "life";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-xl border py-3 text-[14px] font-semibold transition-all duration-200 active:scale-[0.97]",
        active
          ? "border-transparent bg-primary text-primary-foreground shadow-card"
          : "border-border bg-card text-card-foreground",
      )}
    >
      {label}
    </button>
  );
}

function CategorySheet({
  area,
  categories,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onClose,
}: {
  area: Area;
  categories: { id: string; name: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Stäng"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px] animate-in fade-in"
      />
      <div className="relative flex w-full max-w-md flex-col rounded-t-3xl border border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-card animate-in slide-in-from-bottom duration-200">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-bold">
            {area === "jobb" ? "Jobb" : "Privat"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Stäng"
            className="flex size-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim()) {
                onCreate(newName);
                setNewName("");
                setAdding(false);
              }
            }}
            className="mb-2 flex gap-2"
          >
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Namn på kategori"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-[15px] outline-none placeholder:text-muted-foreground focus:border-ring"
            />
            <button
              type="submit"
              disabled={!newName.trim()}
              className="rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
            >
              Spara
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mb-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-[15px] font-semibold text-primary transition-colors active:bg-secondary"
          >
            <Plus className="size-4" />
            Lägg till kategori
          </button>
        )}

        <div className="max-h-[60dvh] space-y-1 overflow-y-auto">
          {categories.map((c) =>
            renamingId === c.id ? (
              <form
                key={c.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (renameValue.trim()) onRename(c.id, renameValue);
                  setRenamingId(null);
                }}
                className="flex gap-2 py-1"
              >
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-[15px] outline-none focus:border-ring"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground active:scale-95"
                >
                  Spara
                </button>
              </form>
            ) : (
              <CategoryRow
                key={c.id}
                name={c.name}
                selected={c.id === selectedId}
                actionsOpen={openId === c.id}
                onOpenActions={() => setOpenId(c.id)}
                onCloseActions={() => setOpenId(null)}
                onSelect={() => onSelect(c.id)}
                onRename={() => {
                  setRenameValue(c.name);
                  setRenamingId(c.id);
                  setOpenId(null);
                }}
                onDelete={() => {
                  onDelete(c.id);
                  setOpenId(null);
                }}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  name,
  selected,
  actionsOpen,
  onOpenActions,
  onCloseActions,
  onSelect,
  onRename,
  onDelete,
}: {
  name: string;
  selected: boolean;
  actionsOpen: boolean;
  onOpenActions: () => void;
  onCloseActions: () => void;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const startX = useRef(0);
  const moved = useRef(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-1">
        <button
          type="button"
          onClick={onRename}
          aria-label="Byt namn"
          className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary"
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Ta bort"
          className="flex size-9 items-center justify-center rounded-lg bg-destructive text-destructive-foreground"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <button
        type="button"
        onTouchStart={(e) => {
          startX.current = e.touches[0].clientX;
          moved.current = false;
          clearPress();
          pressTimer.current = setTimeout(onOpenActions, 500);
        }}
        onTouchMove={(e) => {
          const dx = e.touches[0].clientX - startX.current;
          if (Math.abs(dx) > 8) {
            moved.current = true;
            clearPress();
          }
          if (dx < -40) onOpenActions();
          if (dx > 40) onCloseActions();
        }}
        onTouchEnd={clearPress}
        onContextMenu={(e) => {
          e.preventDefault();
          onOpenActions();
        }}
        onClick={() => {
          if (moved.current) return;
          if (actionsOpen) onCloseActions();
          else onSelect();
        }}
        style={{ transform: actionsOpen ? "translateX(-88px)" : "translateX(0)" }}
        className="relative flex w-full items-center justify-between rounded-xl bg-card px-4 py-2.5 text-left text-[15px] text-card-foreground transition-transform duration-200 active:bg-secondary"
      >
        <span className="truncate">{name}</span>
        {selected && !actionsOpen && <Check className="size-4 shrink-0 text-primary" />}
      </button>
    </div>
  );
}

