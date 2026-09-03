import { Check } from "lucide-react";

interface RegisteredToastProps {
  title: string;
  description: string;
  undoLabel: string;
  onUndo: () => void;
}

export function RegisteredToast({
  title,
  description,
  undoLabel,
  onUndo,
}: RegisteredToastProps) {
  return (
    <div
      data-registered-toast
      className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-card"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold shadow-inner">
          <Check className="size-5 text-white" strokeWidth={3} />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-semibold leading-tight tracking-tight text-card-foreground">
            {title}
          </span>
          <span className="truncate text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            {description}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onUndo}
        className="ml-4 shrink-0 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-gold transition-colors hover:bg-accent active:opacity-60"
      >
        {undoLabel}
      </button>
    </div>
  );
}
