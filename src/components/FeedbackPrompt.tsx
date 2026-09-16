import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { BottomSheet } from "@/components/BottomSheet";
import {
  markFeedbackSent,
  shouldShowFeedbackPrompt,
  snoozeFeedbackPrompt,
  submitFeedback,
} from "@/lib/feedback";

const SHOW_DELAY_MS = 3000;

/**
 * Shows the "what are you missing?" sheet once the app has been installed for
 * a while. Rendered once at the root so it works on every screen.
 */
export function FeedbackPrompt() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (shouldShowFeedbackPrompt()) setOpen(true);
    }, SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!open) return null;

  const dismiss = () => {
    snoozeFeedbackPrompt();
    setOpen(false);
  };

  const send = async () => {
    if (sending) return;
    const text = message.trim();
    if (!text) return;
    setSending(true);
    const ok = await submitFeedback(text);
    setSending(false);
    if (ok) {
      markFeedbackSent();
      setOpen(false);
      toast.success(t("feedbackThanks"));
    }
  };

  return (
    <BottomSheet onClose={dismiss} label={t("feedbackNotNow")}>
      <div className="px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-2">
        <h2 className="text-center text-[17px] font-semibold text-foreground">
          {t("feedbackTitle")}
        </h2>
        <p className="mt-1.5 text-center text-[13px] leading-snug text-muted-foreground">
          {t("feedbackBody")}
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("feedbackPlaceholder")}
          rows={4}
          maxLength={2000}
          className="mt-4 w-full resize-none rounded-xl border border-primary/10 bg-background/60 px-4 py-3 text-[15px] text-foreground outline-none focus:border-primary/40"
        />
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || message.trim().length === 0}
            className="press-down inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-gold px-6 py-3 text-[15px] font-semibold text-primary shadow-gold disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {t("feedbackSend")}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="press-down w-full rounded-full py-2 text-[14px] font-medium text-muted-foreground"
          >
            {t("feedbackNotNow")}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
