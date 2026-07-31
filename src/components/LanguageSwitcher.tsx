import { useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import type { LanguageCode } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { t, language, changeLanguage, languages } = useLanguage();
  const short = languages.find((l) => l.code === language)?.short ?? "EN";
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const select = (code: LanguageCode) => {
    changeLanguage(code);
    navigator.vibrate?.(8);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative shrink-0">
      {open && (
        <div
          role="listbox"
          aria-label={t("language")}
          className="absolute bottom-full right-0 z-50 mb-2 max-h-[45dvh] w-56 origin-bottom-right overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-1 shadow-card duration-200 animate-in fade-in slide-in-from-bottom-2 zoom-in-95"
        >
          {languages.map((l) => {
            const active = l.code === language;
            return (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => select(l.code)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[14px] text-card-foreground transition-colors active:bg-secondary",
                  active && "font-semibold",
                )}
              >
                <span className="text-[16px] leading-none">{l.flag}</span>
                <span className="min-w-0 flex-1 truncate">{l.label}</span>
                {active && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        aria-label={t("language")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-full bg-primary text-primary-foreground shadow-card transition-transform duration-200 active:scale-[0.95]"
      >
        <Globe className="size-[18px]" />
        <span className="text-[9px] font-bold leading-none tracking-[0.08em]">{short}</span>
      </button>
    </div>
  );
}
