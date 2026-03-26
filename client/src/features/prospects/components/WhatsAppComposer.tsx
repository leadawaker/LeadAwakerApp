import { useState } from "react";
import { Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { hapticSend } from "@/lib/haptics";
import { sendWhatsAppMessage } from "../api/prospectsApi";

interface WhatsAppComposerProps {
  prospectId: number;
  prospectPhone: string | null | undefined;
  onSent?: () => void;
}

export function WhatsAppComposer({ prospectId, prospectPhone, onSent }: WhatsAppComposerProps) {
  const { t } = useTranslation("prospects");
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!prospectPhone) {
    return (
      <p className="text-[11px] text-muted-foreground/50 italic">
        {t("whatsappComposer.noPhone")}
      </p>
    );
  }

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    hapticSend();
    try {
      await sendWhatsAppMessage(prospectId, trimmed);
      setValue("");
      onSent?.();
    } catch {
      setError(t("whatsappComposer.sendFailed"));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="w-full min-h-[60px] max-h-[120px] rounded-xl bg-muted/30 border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-brand-indigo/30 resize-none transition-colors"
        placeholder={t("whatsappComposer.placeholder")}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={sending}
      />
      {error && (
        <p className="text-[11px] text-destructive">{error}</p>
      )}
      <div className="flex justify-end">
        <Button
          size="sm"
          className="h-9 rounded-xl gap-1.5"
          disabled={value.trim().length === 0 || sending}
          onClick={handleSend}
        >
          <Send className="h-3.5 w-3.5" />
          {sending ? t("whatsappComposer.sending") : t("whatsappComposer.send")}
        </Button>
      </div>
    </div>
  );
}
