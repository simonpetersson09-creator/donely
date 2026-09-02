import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, forwardRef } from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Briefcase,
  Check,
  ChevronDown,
  ChevronLeft,
  CirclePlus,
  Crown,
  GripVertical,
  Home,
  Lock,
  Minus,
  Pencil,
  Plus,
  Settings,
  Target,
  Trash2,
  X,
  Palette,
} from "lucide-react";
import { CATEGORY_COLORS, categoryColorValue } from "@/lib/category-colors";
import { toast } from "sonner";
import { RegisteredToast } from "@/components/RegisteredToast";

import { detectAchievement, type Achievement } from "@/lib/achievements";
import { AchievementCard } from "@/components/AchievementCard";

import { cn } from "@/lib/utils";
import { haptic } from "@/lib/motion";
import {
  useCategories,
  useEntries,
  useOnboarding,
  useLanguageGuide,
  useReminderPrompt,
  deleteCategoryData,
  type Area,
} from "@/lib/store";
import { useTranslation } from "react-i18next";
import { categoryLabel, useLanguage, useLocale } from "@/lib/use-language";
import { formatKm, formatMinutes, parseMetric, supportsMetrics } from "@/lib/activity-metrics";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { BottomSheet } from "@/components/BottomSheet";

import { Paywall } from "@/components/Paywall";
import { canMutate, usePremium } from "@/lib/premium";
import { useReminder } from "@/lib/notifications";

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
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    achievement: Achievement;
    name: string;
    id: number;
  } | null>(null);

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackSeq = useRef(0);


  const { t } = useLanguage();
  const locale = useLocale();
  const { categories, addCategory, renameCategory, setCategoryColor, reorderCategory, hydrated } =
    useCategories();
  const { entries, addEntry, removeEntry } = useEntries();
  const {
    seen: onboardingSeen,
    markSeen: markOnboardingSeen,
    hydrated: onboardingHydrated,
  } = useOnboarding();
  const premium = usePremium();
  const locked = !premium.loading && !canMutate(premium);

  const { seen: guideSeen, markSeen: markGuideSeen, hydrated: guideHydrated } = useLanguageGuide();
  const {
    answered: reminderPromptAnswered,
    markAnswered: markReminderPromptAnswered,
    hydrated: reminderPromptHydrated,
  } = useReminderPrompt();
  const reminder = useReminder();
  const { language } = useLanguage();

  // Manuell ordning: listan visas exakt som den är sparad, så användarens
  // egna upp/ned-flyttar syns både här och i statistiken.
  const areaCategories = useMemo(
    () => categories.filter((c) => c.area === area),
    [categories, area],
  );

  // Fall back synchronously (not in an effect) so switching area never renders
  // an intermediate frame without a selected category — that caused a flicker
  // in the fields below the segmented control.
  const effectiveCategoryId = areaCategories.some((c) => c.id === categoryId)
    ? categoryId
    : (areaCategories[0]?.id ?? null);

  useEffect(() => {
    if (effectiveCategoryId !== categoryId) setCategoryId(effectiveCategoryId);
  }, [effectiveCategoryId, categoryId]);


  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  // Lock scrolling on the home screen — the layout is designed to fit the
  // viewport, and page scroll causes unwanted shifts on iOS.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  const selected = areaCategories.find((c) => c.id === effectiveCategoryId);
  const parsed = Number.parseInt(amount, 10);
  const valid = Number.isInteger(parsed) && parsed > 0 && !!selected;
  // Distance/duration only make sense for private activity categories.
  const showMetrics = !!selected && supportsMetrics(selected);
  const distanceKm = showMetrics ? parseMetric(distance) : undefined;
  const durationMin = showMetrics ? parseMetric(duration) : undefined;

  // Clearing the fields when switching away keeps stale km/min from following
  // the user to a category where they are not shown.
  useEffect(() => {
    if (!showMetrics) {
      setDistance("");
      setDuration("");
    }
  }, [showMetrics, categoryId]);

  const accentText = "text-primary";

  function register() {
    // All mutating actions are gated through the same premium status. The gate
    // is checked before validity so a locked button always explains itself
    // instead of silently doing nothing when no category is selected.
    if (premium.loading) {
      toast.message(t("premiumLoading"));
      return;
    }
    if (!canMutate(premium)) {
      haptic("medium");
      setPaywallOpen(true);
      return;
    }
    if (!valid || !selected) return;
    haptic("light");
    setConfirmOpen(true);
  }

  // Runs after the user confirms the summary in the dialog.
  function commit() {
    if (!valid || !selected) return;
    setConfirmOpen(false);
    const name = categoryLabel(t, selected);
    const entryId = addEntry({
      area,
      categoryId: selected.id,
      categoryName: selected.name,
      amount: parsed,
      ...(distanceKm !== undefined ? { distanceKm } : {}),
      ...(durationMin !== undefined ? { durationMin } : {}),
    });
    haptic("success");
    setAmount("1");
    setDistance("");
    setDuration("");
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 1100);
    const extras = [
      distanceKm !== undefined ? `${formatKm(distanceKm, locale)} km` : null,
      durationMin !== undefined ? formatMinutes(durationMin, locale) : null,
    ].filter(Boolean);
    const areaLabel = area === "jobb" ? t("work") : t("private");
    toast.custom(
      () => (
        <RegisteredToast
          title={t("registeredToast", { count: parsed, name })}
          description={[areaLabel, ...extras].join(" · ")}
          undoLabel={t("undoAction")}
          onUndo={() => {
            removeEntry(entryId);
            toast.success(t("entryUndone"));
          }}
        />
      ),
      { duration: 4000 },
    );


    // Rekord- och milstolpskoll sker lokalt och deterministiskt på den färska
    // listan, efter att registreringen redan är sparad — snabbregistreringen
    // påverkas inte och kortet visas bara ovanpå den befintliga vyn.
    const nextEntries = [
      {
        id: entryId,
        area,
        categoryId: selected.id,
        categoryName: selected.name,
        amount: parsed,
        createdAt: new Date().toISOString(),
      },
      ...entries,
    ];
    const achievement = detectAchievement(nextEntries, selected.id);
    if (achievement) {
      if (achievement.kind === "record" || achievement.kind === "milestone") haptic("success");
      window.setTimeout(() => setFeedback({ achievement, name }), 420);
    }
  }

  if (!onboardingHydrated) return null;
  if (!onboardingSeen) return <Onboarding onStart={markOnboardingSeen} />;

  // Donely's own explanation comes first — Apple's system prompt is only
  // triggered when the user taps "Enable reminder".
  const showReminderPrompt = reminderPromptHydrated && !reminderPromptAnswered;

  return (
    <main
      data-donely-app-ready
      className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]"
    >
      <div className="flex shrink-0 items-end justify-center pb-4 pt-16">
        <div className="relative translate-y-[94px]">
          <div className="absolute -right-6 -top-9 z-10">
            <div className="relative rounded-full bg-primary px-3 py-1 shadow-[0_6px_16px_-8px_hsl(0_0%_0%/0.45)]">
              <span className="flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold leading-[14px] tracking-wide text-primary-foreground">
                {premium.subscribed ? (
                  <>
                    <Crown className="size-2.5 shrink-0 text-gold" fill="currentColor" />
                    {t("premiumActive")}
                  </>
                ) : premium.inTrial ? (
                  t("trialLeft", { count: premium.trialDaysLeft })
                ) : (
                  t("trialExpired")
                )}
              </span>
              <div className="absolute -bottom-[3px] left-3 size-2.5 rotate-45 rounded-[1px] bg-primary" />
            </div>
          </div>

          <h1 className="font-logo select-none text-[36px] font-bold leading-none tracking-[-0.04em] text-primary">
            Donely
          </h1>
          <p className="mt-0.5 text-center text-[13px] font-medium tracking-wide text-primary/80">
            {t("tagline")}
          </p>
        </div>
      </div>

      <div className="flex flex-1 translate-y-[80px] flex-col justify-center gap-3">
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
            <ChevronDown className="size-3.5 text-primary" />
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

        {/* Km och minuter — visas bara för träningsliknande privata kategorier.
            Platsen reserveras alltid så att övrigt innehåll inte hoppar upp
            när fälten visas. */}
        <section
          className={cn(
            "min-h-[56px] transition-opacity duration-200",
            showMetrics ? "opacity-100" : "invisible opacity-0",
          )}
          aria-hidden={!showMetrics}
        >
          <Label>{t("metricsHint")}</Label>
          <div className="flex gap-2">
            <MetricField
              label={t("distanceKm")}
              value={distance}
              onChange={setDistance}
              suffix="km"
              disabled={!showMetrics}
            />
            <MetricField
              label={t("durationMin")}
              value={duration}
              onChange={setDuration}
              suffix="min"
              disabled={!showMetrics}
            />
          </div>
        </section>
      </div>

      {/* Registrera + Statistik — fasta längst ner */}
      <div className="relative z-10 mt-auto space-y-2 pb-1">
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
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            disabled={!valid && !locked}
            onPointerDown={() => setPressed(true)}
            onAnimationEnd={() => setPressed(false)}
            onClick={register}
            aria-label={locked ? `${t("register")} — ${t("premiumRequired")}` : t("register")}
            className={cn(
              "relative flex-1 overflow-hidden rounded-xl py-3 text-[16px] font-semibold shadow-[0_8px_20px_-6px_hsl(0_0%_0%/0.35)] transition-shadow duration-200 ease-out active:shadow-[0_3px_10px_-6px_hsl(0_0%_0%/0.35)] disabled:opacity-40 disabled:shadow-none",
              pressed && "press-spring",
              locked
                ? "bg-primary/85 text-primary-foreground"
                : "bg-primary text-primary-foreground",
            )}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {locked ? (
                <span className="flex size-6 items-center justify-center rounded-full bg-primary-foreground/15 ring-1 ring-primary-foreground/25">
                  <Lock className="size-3.5" />
                </span>
              ) : (
                <CirclePlus className="size-5" />
              )}
              {t("register")}
            </span>
          </button>

          <Link
            to="/installningar"
            aria-label={t("settings")}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card transition-transform duration-200 active:scale-[0.95]"
          >
            <Settings className="size-[20px]" />
          </Link>
        </div>
        <div className="flex items-stretch gap-2">
          <Link
            to="/dagsstatistik"
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card text-[16px] font-semibold text-primary shadow-card transition-transform duration-200 active:scale-[0.98]"
          >
            <BarChart3 className="size-5" />
            {t("statistics")}
          </Link>
          <Link
            to="/arsmal"
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-[16px] font-semibold text-primary-foreground shadow-button transition-transform duration-200 active:scale-[0.98]"
          >
            <Target className="size-5" />
            {t("yearlyGoals")}
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
          selectedId={effectiveCategoryId}
          onSelect={(id) => {
            setCategoryId(id);
            setPickerOpen(false);
          }}
          onCreate={(name) => {
            if (premium.loading) {
              toast.message(t("premiumLoading"));
              return;
            }
            if (!canMutate(premium)) {
              setPickerOpen(false);
              setPaywallOpen(true);
              return;
            }
            const created = addCategory(name, area);
            setCategoryId(created.id);
            setPickerOpen(false);
          }}
          onReorder={(id, newIndex) => {
            if (premium.loading) {
              toast.message(t("premiumLoading"));
              return;
            }
            if (!canMutate(premium)) {
              setPickerOpen(false);
              setPaywallOpen(true);
              return;
            }
            reorderCategory(id, newIndex);
          }}
          onSetColor={(id, color) => {
            if (premium.loading) {
              toast.message(t("premiumLoading"));
              return;
            }
            if (!canMutate(premium)) {
              setPickerOpen(false);
              setPaywallOpen(true);
              return;
            }
            setCategoryColor(id, color);
          }}
          onRename={(id, name) => {
            if (premium.loading) {
              toast.message(t("premiumLoading"));
              return;
            }
            if (!canMutate(premium)) {
              setPickerOpen(false);
              setPaywallOpen(true);
              return;
            }
            renameCategory(id, name);
          }}
          onDelete={(id) => {
            if (premium.loading) {
              toast.message(t("premiumLoading"));
              return;
            }
            if (!canMutate(premium)) {
              setPickerOpen(false);
              setPaywallOpen(true);
              return;
            }
            // Category, entries and goals are committed together. This keeps
            // storage valid even if iOS suspends the app during deletion.
            deleteCategoryData(id);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {confirmOpen && selected && (
        <ConfirmDialog
          area={area}
          areaLabel={area === "jobb" ? t("work") : t("private")}
          categoryName={categoryLabel(t, selected)}
          amount={parsed}
          distanceText={distanceKm !== undefined ? `${formatKm(distanceKm, locale)} km` : null}
          durationText={durationMin !== undefined ? formatMinutes(durationMin, locale) : null}
          title={t("confirmTitle")}
          categoryWord={t("category")}
          amountWord={t("amount")}
          confirmLabel={t("confirmRegister")}
          cancelLabel={t("cancel")}
          onConfirm={commit}
          onClose={() => setConfirmOpen(false)}
        />
      )}

      {paywallOpen && <Paywall onClose={() => setPaywallOpen(false)} />}

      {feedback &&
        (() => {
          const content = achievementContent(feedback.achievement, feedback.name, t);
          return (
            <AchievementCard
              key={`${feedback.achievement.kind}-${feedback.name}`}
              variant={content.variant}
              title={content.title}
              lines={content.lines}
              emphatic={content.emphatic}
              onDismiss={() => setFeedback(null)}
            />
          );
        })()}

      {showReminderPrompt && (
        <ReminderPrompt
          onEnable={(choice) => {
            markReminderPromptAnswered();
            if (choice.weekly) void reminder.toggle(true, language);
            if (choice.daily) void reminder.toggleDaily(true, language);
          }}
          onLater={markReminderPromptAnswered}
        />
      )}
    </main>
  );
}

/** Optional numeric field (km / minutes) shown for workout categories. */
function MetricField({
  label,
  value,
  onChange,
  suffix,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 shadow-card",
        disabled && "opacity-50",
      )}
    >
      <input
        inputMode="decimal"
        value={value}
        placeholder="0"
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 6))}
        onFocus={(e) => e.target.select()}
        aria-label={label}
        disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold tabular-nums text-card-foreground outline-none placeholder:text-card-foreground/30"
      />
      <span className="text-[12px] font-semibold text-card-foreground/50">{suffix}</span>
    </label>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
      {children}
    </p>
  );
}

function StepButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform active:scale-90"
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
  const options: { value: Area; label: string; icon: typeof Briefcase }[] = [
    { value: "jobb", label: workLabel, icon: Briefcase },
    { value: "privat", label: privateLabel, icon: Home },
  ];
  const index = area === "jobb" ? 0 : 1;

  return (
    <div
      role="tablist"
      className="relative grid grid-cols-2 rounded-xl bg-secondary p-1 shadow-card"
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg shadow-soft transition-[transform,background-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          area === "jobb" ? "bg-accent-work" : "bg-accent-life",
        )}
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={area === o.value}
            onClick={() => {
              if (area !== o.value) haptic("light");
              onChange(o.value);
            }}
            className={cn(
              "relative z-10 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[14px] font-semibold transition-colors duration-200",
              area === o.value ? "text-primary-foreground" : "text-foreground/60",
            )}
          >
            <Icon className="size-4" />
            {o.label}
          </button>
        );
      })}
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
  onSetColor,
  onReorder,
  onDelete,
  onClose,
}: {
  area: Area;
  categories: { id: string; name: string; color?: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onSetColor: (id: string, color: string | null) => void;
  onReorder: (id: string, newIndex: number) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Local order mirrors props so drag feels instant; it resets when props change.
  const [localCategories, setLocalCategories] = useState(categories);
  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const [drag, setDrag] = useState<{
    id: string;
    index: number;
    startIndex: number;
    startY: number;
    currentY: number;
    itemHeight: number;
  } | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const localRef = useRef(localCategories);
  localRef.current = localCategories;

  const handleDragStart = (id: string, clientY: number) => {
    // Close action panels so every row has the same height during the drag.
    setOpenId(null);

    const index = localCategories.findIndex((c) => c.id === id);
    if (!listRef.current || index < 0) return;

    const items = Array.from(listRef.current.children).filter(
      (el) => (el as HTMLElement).dataset.row === "true",
    ) as HTMLElement[];
    const row = items[index];
    if (!row) return;

    const rowRect = row.getBoundingClientRect();
    setDrag({
      id,
      index,
      startIndex: index,
      startY: clientY,
      currentY: clientY,
      itemHeight: rowRect.height + 2, // + space-y-0.5 gap
    });
  };

  const handleDragMove = (clientY: number) => {
    const active = dragRef.current;
    if (!active || !listRef.current) return;
    // Measure the first row fresh each move — the list may scroll during drag.
    const firstRow = listRef.current.querySelector<HTMLElement>('[data-row="true"]');
    const listTop = firstRow ? firstRow.getBoundingClientRect().top : 0;
    const relativeY = clientY - listTop;
    const rawIndex = Math.round(relativeY / active.itemHeight);
    const list = localRef.current;
    const newIndex = Math.max(0, Math.min(list.length - 1, rawIndex));
    if (newIndex !== active.index) {
      const next = [...list];
      const [moved] = next.splice(active.index, 1);
      next.splice(newIndex, 0, moved);
      setLocalCategories(next);
      setDrag({ ...active, index: newIndex, currentY: clientY });
      haptic("light");
    } else {
      setDrag({ ...active, currentY: clientY });
    }
  };

  const handleDragEnd = () => {
    const active = dragRef.current;
    if (active) {
      const finalIndex = localRef.current.findIndex((c) => c.id === active.id);
      const originalIndex = categories.findIndex((c) => c.id === active.id);
      if (finalIndex !== originalIndex) {
        onReorder(active.id, finalIndex);
      }
    }
    setDrag(null);
  };

  // Listen on window: on touch devices the pointer is implicitly captured by
  // the drag handle, so list-level handlers would never fire.
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      e.preventDefault();
      handleDragMove(e.clientY);
    };
    const up = () => handleDragEnd();
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null]);

  return (
    <BottomSheet
      onClose={onClose}
      label={t("close")}
      className="h-[63dvh] max-h-[63dvh] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-1"
    >
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <h2 className="flex items-center gap-1.5 px-1 text-[17px] font-bold tracking-[-0.02em] text-primary">
          {area === "jobb" ? <Briefcase className="size-5" /> : <Home className="size-5" />}
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
          className="mb-1.5 flex shrink-0 gap-2"
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("categoryName")}
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-[16px] outline-none placeholder:text-muted-foreground focus:border-ring"
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
          className="mb-1 flex w-full shrink-0 items-center gap-2 rounded-xl border border-dashed border-border px-3 py-1.5 text-[14px] font-semibold text-primary transition-colors active:bg-secondary"
        >
          <Plus className="size-3.5" />
          {t("addCategory")}
        </button>
      )}

      <div className="mb-1.5 flex shrink-0 items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-primary">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15">
          <ChevronLeft className="size-3.5 animate-pulse" />
        </span>
        <p className="text-[13px] font-semibold leading-[16px]">{t("swipeHint")}</p>
      </div>

      <div
        ref={listRef}
        className="no-scrollbar min-h-0 flex-1 space-y-0 overflow-y-auto overscroll-contain pb-10"
        style={{
          WebkitOverflowScrolling: "touch",
          // Lock list scrolling while a row is being dragged.
          touchAction: drag ? "none" : "pan-y",
        }}
        onScroll={() => setOpenId(null)}
      >
        {localCategories.map((c, index) =>
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
                className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-[16px] outline-none focus:border-ring"
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
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              data-row="true"
              categoryColor={c.color ?? null}
              name={categoryLabel(t, c)}
              onSetColor={(color) => onSetColor(c.id, color)}
              selected={c.id === selectedId}
              actionsOpen={openId === c.id}
              dragging={drag?.id === c.id}
              dragOffset={
                drag?.id === c.id
                  ? drag.currentY - drag.startY - (drag.index - drag.startIndex) * drag.itemHeight
                  : 0
              }
              onOpenActions={() => setOpenId(c.id)}
              onCloseActions={() => setOpenId(null)}
              onSelect={() => onSelect(c.id)}
              onStartDrag={(y) => handleDragStart(c.id, y)}
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
    </BottomSheet>
  );
}

const CategoryRow = forwardRef(function CategoryRow(
  {
    name,
    categoryColor,
    onSetColor,
    selected,
    actionsOpen,
    dragging,
    dragOffset = 0,
    onOpenActions,
    onCloseActions,
    onSelect,
    onStartDrag,
    onRename,
    onDelete,
    ...rest
  }: {
    name: string;
    categoryColor: string | null;
    onSetColor: (color: string | null) => void;
    selected: boolean;
    actionsOpen: boolean;
    dragging?: boolean;
    dragOffset?: number;
    onOpenActions: () => void;
    onCloseActions: () => void;
    onSelect: () => void;
    onStartDrag: (y: number) => void;
    onRename: () => void;
    onDelete: () => void;
  } & React.HTMLAttributes<HTMLDivElement>,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const { t } = useTranslation();
  const renameLabel = t("rename");
  const deleteLabel = t("delete");
  const startX = useRef(0);
  const startY = useRef(0);
  const moved = useRef(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const dotColor = categoryColorValue(categoryColor);

  const clearPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  return (
    <div ref={ref} {...rest} className="rounded-xl">
      <div className="relative overflow-hidden rounded-xl">
        <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-1">
          <button
            type="button"
            onClick={() => setColorOpen((v) => !v)}
            aria-label={t("categoryColor")}
            className="flex size-8 items-center justify-center rounded-lg bg-secondary text-primary"
          >
            <Palette className="size-3.5" />
          </button>
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
            startY.current = e.touches[0].clientY;
            moved.current = false;
            clearPress();
            pressTimer.current = setTimeout(onOpenActions, 500);
          }}
          onTouchMove={(e) => {
            const dx = e.touches[0].clientX - startX.current;
            const dy = e.touches[0].clientY - startY.current;
            if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
              moved.current = true;
              clearPress();
            }
            if (Math.abs(dy) > Math.abs(dx)) return;
            if (dx < -40) onOpenActions();
            if (dx > 40) onCloseActions();
          }}
          onTouchEnd={clearPress}
          onTouchCancel={clearPress}
          onContextMenu={(e) => {
            e.preventDefault();
            onOpenActions();
          }}
          onClick={() => {
            if (moved.current) return;
            if (actionsOpen) onCloseActions();
            else onSelect();
          }}
          style={{
            transform: `${actionsOpen ? "translateX(-112px)" : "translateX(0)"}${
              dragging ? ` translateY(${dragOffset}px)` : ""
            }`,
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            touchAction: "pan-y",
          }}
          className={cn(
            "relative flex w-full select-none items-center justify-between rounded-xl bg-card px-3 py-1.5 text-left text-[14px] text-card-foreground",
            dragging
              ? "z-10 scale-[1.02] shadow-lg opacity-95"
              : "transition-transform duration-200 active:bg-secondary",
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full border"
              style={{
                backgroundColor: dotColor ?? "transparent",
                borderColor: dotColor ?? "var(--border)",
              }}
            />
            <span className="truncate">{name}</span>
          </span>
          {!actionsOpen && (
            <span className="flex shrink-0 items-center gap-0.5">
              {selected && <Check className="size-3.5 text-primary" />}
              <span className="text-muted-foreground/40">
                <ChevronLeft className="size-3.5" />
              </span>
              <span
                aria-label={t("reorder")}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onStartDrag(e.clientY);
                }}
                style={{ touchAction: "none" }}
                className="-my-1 flex size-10 items-center justify-center rounded-lg text-muted-foreground/70 active:bg-secondary active:text-primary"
                role="button"
              >
                <GripVertical className="size-[18px]" />
              </span>
            </span>
          )}
        </button>
      </div>

      {actionsOpen && colorOpen && (
        <div className="flex flex-wrap items-center gap-2 rounded-b-xl bg-secondary/60 px-3 py-2">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-label={c.id}
              onClick={() => {
                onSetColor(c.id);
                setColorOpen(false);
                onCloseActions();
              }}
              className={`size-6 rounded-full transition-transform active:scale-90 ${
                categoryColor === c.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              onSetColor(null);
              setColorOpen(false);
              onCloseActions();
            }}
            className="flex size-6 items-center justify-center rounded-full border border-border text-muted-foreground"
          >
            <X className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
});

function ReminderPrompt({
  onEnable,
  onLater,
}: {
  onEnable: (choice: { weekly: boolean; daily: boolean }) => void;
  onLater: () => void;
}) {
  const { t } = useLanguage();
  // Användaren får välja båda påminnelserna direkt: veckan (fre 17:00) och
  // dagen (mån–fre 17:00). Båda är förvalda.
  const [weekly, setWeekly] = useState(true);
  const [daily, setDaily] = useState(true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-8 backdrop-blur-[2px]">
      <div className="w-full max-w-[300px] overflow-hidden rounded-[16px] bg-card p-5 text-center shadow-xl">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-secondary">
          <Bell className="size-5 text-primary" />
        </div>
        <h2 className="mt-3 text-[16px] font-semibold leading-[21px] text-card-foreground">
          {t("reminderPromptTitle")}
        </h2>
        <p className="mt-1.5 text-[13px] font-normal leading-[18px] text-muted-foreground">
          {t("reminderPromptBody")}
        </p>

        <div className="mt-3 space-y-1.5 text-left">
          <ReminderOption
            checked={weekly}
            onToggle={() => setWeekly((v) => !v)}
            title={t("weeklyReminder")}
            description={t("weeklyReminderDesc")}
          />
          <ReminderOption
            checked={daily}
            onToggle={() => setDaily((v) => !v)}
            title={t("dailyReminder")}
            description={t("dailyReminderDesc")}
          />
        </div>

        <button
          type="button"
          disabled={!weekly && !daily}
          onClick={() => onEnable({ weekly, daily })}
          className="mt-4 w-full rounded-xl bg-primary py-3 text-[15px] font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {t("reminderPromptEnable")}
        </button>
        <button
          type="button"
          onClick={onLater}
          className="mt-2 w-full rounded-xl py-2.5 text-[15px] font-normal text-primary transition-colors active:bg-secondary"
        >
          {t("reminderPromptLater")}
        </button>
      </div>
    </div>
  );
}

function ReminderOption({
  checked,
  onToggle,
  title,
  description,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className={cn(
        "flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left transition-colors",
        checked ? "border-primary bg-secondary" : "border-border bg-card",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[5px] border",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
        )}
      >
        {checked && <Check className="size-3" />}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-card-foreground">{title}</span>
        <span className="block text-[11px] leading-[15px] text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  );
}

function Onboarding({ onStart }: { onStart: () => void }) {
  const { t } = useTranslation();

  return (
    <main
      data-donely-app-ready
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]"
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="font-logo select-none text-[36px] font-bold leading-none tracking-[-0.04em] text-primary">
          Donely
        </h1>
        <p className="mt-6 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
          {t("welcomeTitle")}
        </p>
        <div className="mt-4 space-y-1.5">
          <p className="text-[17px] leading-relaxed text-muted-foreground">{t("welcomeLine1")}</p>
          <p className="text-[17px] leading-relaxed text-muted-foreground">{t("welcomeLine2")}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-primary py-4 text-[17px] font-semibold text-primary-foreground shadow-[0_12px_28px_-8px_hsl(0_0%_0%/0.35),0_4px_8px_-3px_hsl(0_0%_0%/0.2)] transition-all duration-200 ease-out active:scale-[0.96] active:shadow-[0_6px_14px_-5px_hsl(0_0%_0%/0.3)]"
      >
        <span className="relative z-10">{t("getStarted")}</span>
        <ArrowRight className="relative z-10 size-[18px] transition-transform duration-300 group-hover:translate-x-0.5" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/15 to-transparent" />
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
    // pointer-events-none so the bubble never blocks the primary Register button
    // underneath it; only the × needs to be clickable.
    <div
      ref={ref}
      className="pointer-events-none absolute bottom-full right-0 z-50 mb-3 w-56 origin-bottom-right rounded-2xl border border-border bg-card p-3.5 shadow-card animate-in fade-in zoom-in-95 duration-200"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t("close")}
        className="pointer-events-auto absolute right-2 top-2 rounded-full p-1 text-card-foreground/50 transition-colors active:bg-secondary"
      >
        <X className="size-3.5" />
      </button>
      <p className="pr-5 text-[14px] font-semibold text-card-foreground">
        {t("languageGuideTitle")}
      </p>
      <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
        {t("languageGuideBody")}
      </p>
      <div className="absolute -bottom-1.5 right-6 size-3 rotate-45 rounded-[2px] border-r border-b border-border bg-card" />
    </div>
  );
}

function ConfirmDialog({
  area,
  areaLabel,
  categoryName,
  amount,
  distanceText,
  durationText,
  title,
  categoryWord,
  amountWord,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
}: {
  area: Area;
  areaLabel: string;
  categoryName: string;
  amount: number;
  distanceText: string | null;
  durationText: string | null;
  title: string;
  categoryWord: string;
  amountWord: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
    >
      <button
        type="button"
        aria-label={cancelLabel}
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-card">
        <p className="text-center text-[17px] font-bold text-card-foreground">{title}</p>

        <div
          className={cn(
            "mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold",
            area === "jobb"
              ? "bg-accent-work-soft text-accent-work"
              : "bg-accent-life-soft text-accent-life",
          )}
        >
          {area === "jobb" ? <Briefcase className="size-3.5" /> : <Home className="size-3.5" />}
          {areaLabel}
        </div>

        <dl className="mt-3 divide-y divide-border rounded-2xl border border-border">
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <dt className="text-[13px] text-muted-foreground">{categoryWord}</dt>
            <dd className="truncate text-[15px] font-semibold text-card-foreground">
              {categoryName}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <dt className="text-[13px] text-muted-foreground">{amountWord}</dt>
            <dd className="text-[15px] font-semibold tabular-nums text-card-foreground">
              {amount}
            </dd>
          </div>
          {(distanceText || durationText) && (
            <div className="flex items-center justify-end gap-2 px-3.5 py-2.5 text-[13px] font-medium text-muted-foreground">
              {distanceText && <span>{distanceText}</span>}
              {distanceText && durationText && <span aria-hidden>·</span>}
              {durationText && <span>{durationText}</span>}
            </div>
          )}
        </dl>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-border bg-background py-3 text-[15px] font-semibold text-primary transition-transform active:scale-[0.98]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[16px] font-semibold text-primary-foreground shadow-[0_8px_20px_-6px_hsl(0_0%_0%/0.35)] transition-all duration-200 ease-out active:scale-[0.96] active:shadow-[0_3px_10px_-6px_hsl(0_0%_0%/0.35)]"
          >
            <Check className="size-4" />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const RECORD_TITLE_KEY = {
  day: "recordNewDay",
  week: "recordNewWeek",
  month: "recordNewMonth",
} as const;

const PERIOD_KEY = {
  day: "periodThisDay",
  week: "periodThisWeek",
  month: "periodThisMonth",
} as const;

/** Översätter en achievement till kortets variant, rubrik och rader. */
export function achievementContent(
  achievement: Achievement,
  name: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): { variant: "record" | "milestone" | "nearRecord" | "nearMilestone"; title: string; lines: string[]; emphatic: boolean } {
  switch (achievement.kind) {
    case "record":
      return {
        variant: "record",
        title: t(RECORD_TITLE_KEY[achievement.type]),
        lines: [
          t("recordCurrentLine", {
            count: achievement.value,
            name,
            period: t(PERIOD_KEY[achievement.type]),
          }),
          t("recordPrevious", { count: achievement.previous }),
        ],
        emphatic: true,
      };
    case "milestone":
      return {
        variant: "milestone",
        title: t("milestoneTitle"),
        lines: [t("milestoneLine", { count: achievement.target, name })],
        emphatic: true,
      };
    case "nearRecord":
      return {
        variant: "nearRecord",
        title: t("nearRecordTitle"),
        lines: [
          t("recordCurrentLine", {
            count: achievement.current,
            name,
            period: t(PERIOD_KEY[achievement.type]),
          }),
          t("nearRecordHint", { count: achievement.remaining, record: achievement.target }),
        ],
        emphatic: false,
      };
    case "nearMilestone":
      return {
        variant: "nearMilestone",
        title: t("nearMilestoneTitle"),
        lines: [
          t("nearMilestoneHint", {
            count: achievement.remaining,
            target: achievement.target,
            name,
          }),
        ],
        emphatic: false,
      };
  }
}
