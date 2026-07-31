import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Minus, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCategories, useEntries, useOnboarding, useLanguageGuide, DEFAULT_CATEGORIES, type Area } from "@/lib/store";
import { useTranslation } from "react-i18next";
import { categoryLabel, useLanguage } from "@/lib/use-language";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

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

  const { t } = useLanguage();
  const { categories, addCategory, renameCategory, removeCategory, hydrated } = useCategories();
  const { entries, addEntry } = useEntries();
  const { seen: onboardingSeen, markSeen: markOnboardingSeen, hydrated: onboardingHydrated } = useOnboarding();
  const { seen: guideSeen, markSeen: markGuideSeen, hydrated: guideHydrated } = useLanguageGuide();

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
    const name = categoryLabel(t, selected);
    addEntry({ area, categoryId: selected.id, categoryName: selected.name, amount: parsed });
    navigator.vibrate?.(12);
    setAmount("1");
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 1100);
    toast.success(t("registeredToast", { count: parsed, name }), {
      description: area === "jobb" ? t("work") : t("private"),
    });
  }

  if (!onboardingHydrated) return null;
  if (!onboardingSeen) return <Onboarding onStart={markOnboardingSeen} />;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div className="flex flex-1 items-center justify-center">

        <h1 className="select-none font-['Inter',system-ui,-apple-system,sans-serif] text-[36px] font-bold leading-none tracking-[-0.04em] text-primary">
          Donely
        </h1>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3">
        {/* Område */}
        <AreaSegmented
          area={area}
          onChange={setArea}
          workLabel={t("work")}
          privateLabel={t("private")}
        />

        {/* Kategori */}
        <section>
          <Label>{t("category")}</Label>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3.5 py-2.5 text-left text-card-foreground shadow-card transition-transform active:scale-[0.985]"
          >
            <span className="text-[15px] font-medium">
              {hydrated
                ? selected
                  ? categoryLabel(t, selected)
                  : t("createCategory")
                : t("loading")}
            </span>
            <ChevronDown className="size-3.5 text-card-foreground/60" />
          </button>
        </section>

        {/* Antal */}
        <section>
          <Label>{t("amount")}</Label>
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card p-1 shadow-card">
            <StepButton
              onClick={() => setAmount(String(Math.max(1, (parsed || 1) - 1)))}
              aria-label={t("decrease")}
            >
              <Minus className="size-3.5" />
            </StepButton>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
              onFocus={(e) => e.target.select()}
              aria-label={t("amount")}
              className="min-w-0 flex-1 bg-transparent text-center text-[24px] font-semibold tabular-nums text-card-foreground outline-none"
            />
            <StepButton
              onClick={() => setAmount(String((parsed || 0) + 1))}
              aria-label={t("increase")}
            >
              <Plus className="size-3.5" />
            </StepButton>
          </div>
          <div className="mt-1.5 flex gap-2">
            {[1, 5, 10, 25].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAmount(String(Math.min(99999, (parsed || 0) + n)))}
                className="flex-1 rounded-full border border-primary/20 bg-card py-1.5 text-[12px] font-semibold text-primary shadow-soft transition-all duration-200 active:scale-95 active:bg-accent"
              >
                +{n}
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
            <Check className="size-3.5" /> {t("registered")}
          </span>
        </div>
        <button
          type="button"
          disabled={!valid}
          onClick={register}
          className="w-full rounded-xl bg-primary py-3 text-[16px] font-semibold text-primary-foreground shadow-[0_8px_20px_-6px_hsl(0_0%_0%/0.35)] transition-all duration-200 ease-out active:scale-[0.96] active:shadow-[0_3px_10px_-6px_hsl(0_0%_0%/0.35)] disabled:opacity-40 disabled:shadow-none"
        >
          {t("register")}
        </button>
        <div className="flex items-stretch gap-2">
          <Link
            to="/statistik"
            className="flex h-12 flex-1 items-center justify-center rounded-xl border border-border bg-card text-[16px] font-semibold text-primary shadow-card transition-transform duration-200 active:scale-[0.98]"
          >
            {t("statistics")}
          </Link>
          <div className="relative shrink-0">
            <LanguageSwitcher />
            {!guideSeen && guideHydrated && <LanguageGuideBubble onClose={markGuideSeen} />}
          </div>
        </div>
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




function AreaSegmented({
  area,
  onChange,
  workLabel,
  privateLabel,
}: {
  area: Area;
  onChange: (a: Area) => void;
  workLabel: string;
  privateLabel: string;
}) {
  const options: { value: Area; label: string }[] = [
    { value: "jobb", label: workLabel },
    { value: "privat", label: privateLabel },
  ];
  const index = area === "jobb" ? 0 : 1;

  return (
    <div
      role="tablist"
      className="relative grid grid-cols-2 rounded-xl bg-secondary p-1 shadow-card"
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-primary shadow-soft transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={area === o.value}
          onClick={() => {
            if (area !== o.value) navigator.vibrate?.(8);
            onChange(o.value);
          }}
          className={cn(
            "relative z-10 rounded-lg py-2.5 text-[14px] font-semibold transition-colors duration-200",
            area === o.value ? "text-primary-foreground" : "text-foreground/60",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
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
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label={t("close")}
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px] animate-in fade-in"
      />
      <div className="relative flex w-full max-w-md flex-col rounded-t-3xl border border-border bg-card p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-card animate-in slide-in-from-bottom duration-200">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-bold">
            {area === "jobb" ? t("work") : t("private")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("close")}
            className="flex size-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
          >
            <X className="size-3.5" />
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
            className="mb-1.5 flex gap-2"
          >
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("categoryName")}
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-[14px] outline-none placeholder:text-muted-foreground focus:border-ring"
            />
            <button
              type="submit"
              disabled={!newName.trim()}
              className="rounded-xl bg-primary px-3 text-[14px] font-semibold text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
            >
              {t("save")}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mb-1.5 flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-[14px] font-semibold text-primary transition-colors active:bg-secondary"
          >
            <Plus className="size-3.5" />
            {t("addCategory")}
          </button>
        )}

        <div className="max-h-[55dvh] space-y-0.5 overflow-y-auto">
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
                  {t("save")}
                </button>
              </form>
            ) : (
              <CategoryRow
                key={c.id}
                name={categoryLabel(t, c)}
                selected={c.id === selectedId}
                actionsOpen={openId === c.id}
                onOpenActions={() => setOpenId(c.id)}
                onCloseActions={() => setOpenId(null)}
                onSelect={() => onSelect(c.id)}
                onRename={() => {
                  setRenameValue(categoryLabel(t, c));
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
  const { t } = useTranslation();
  const renameLabel = t("rename");
  const deleteLabel = t("delete");
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
          aria-label={renameLabel}
          className="flex size-8 items-center justify-center rounded-lg bg-secondary text-primary"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={deleteLabel}
          className="flex size-8 items-center justify-center rounded-lg bg-destructive text-destructive-foreground"
        >
          <Trash2 className="size-3.5" />
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
        style={{ transform: actionsOpen ? "translateX(-78px)" : "translateX(0)" }}
        className="relative flex w-full items-center justify-between rounded-xl bg-card px-3 py-2 text-left text-[14px] text-card-foreground transition-transform duration-200 active:bg-secondary"
      >
        <span className="truncate">{name}</span>
        {selected && !actionsOpen && <Check className="size-3.5 shrink-0 text-primary" />}
      </button>
    </div>
  );
}

function Onboarding({ onStart }: { onStart: () => void }) {
  const { t } = useTranslation();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="select-none text-[36px] font-bold leading-none tracking-[-0.04em] text-primary">
          Donely
        </h1>
        <p className="mt-6 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
          {t("welcomeTitle")}
        </p>
        <div className="mt-4 space-y-1.5">
          <p className="text-[17px] leading-relaxed text-muted-foreground">
            {t("welcomeLine1")}
          </p>
          <p className="text-[17px] leading-relaxed text-muted-foreground">
            {t("welcomeLine2")}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="w-full rounded-xl bg-primary py-3.5 text-[17px] font-semibold text-primary-foreground shadow-[0_8px_20px_-6px_hsl(0_0%_0%/0.35)] transition-all duration-200 ease-out active:scale-[0.96]"
      >
        {t("getStarted")}
      </button>
    </main>
  );
}

function LanguageGuideBubble({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 z-50 mb-3 w-56 origin-bottom-right rounded-2xl border border-border bg-card p-3.5 shadow-card animate-in fade-in zoom-in-95 duration-200"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t("close")}
        className="absolute right-2 top-2 rounded-full p-1 text-card-foreground/50 transition-colors active:bg-secondary"
      >
        <X className="size-3.5" />
      </button>
      <p className="pr-5 text-[14px] font-semibold text-card-foreground">{t("languageGuideTitle")}</p>
      <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{t("languageGuideBody")}</p>
      <div className="absolute -bottom-1.5 right-6 size-3 rotate-45 rounded-[2px] border-r border-b border-border bg-card" />
    </div>
  );
}




