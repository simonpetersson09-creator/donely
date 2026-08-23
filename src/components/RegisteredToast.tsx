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
      className="flex w-full items-center justify-between rounded-full border border-white/10 bg-primary py-2 pl-2 pr-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md"
    >

      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold shadow-inner">
          <Check className="size-[18px] text-white" strokeWidth={3} />
        </div>
        <div className="flex flex-col">
          <span className="text-[14px] font-semibold leading-tight tracking-tight text-white">
            {title}
          </span>
          <span className="text-[11px] font-medium uppercase tracking-widest text-gold/80">
            {description}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onUndo}
        className="ml-4 shrink-0 px-2 text-sm font-bold text-gold transition-opacity active:opacity-60"
      >
        {undoLabel}
      </button>
    </div>
  );
}
