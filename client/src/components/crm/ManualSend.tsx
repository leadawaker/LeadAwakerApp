import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/apiUtils";

export function ManualSend({ disabled, leadId, accountId, onSent }: { disabled: boolean; leadId?: number; accountId?: number; onSent?: () => void }) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!value.trim() || !leadId || !accountId) return;
    setSending(true);
    try {
      await apiFetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads_id: leadId,
          accounts_id: accountId,
          content: value.trim(),
          type: "WhatsApp",
          direction: "Outbound",
          status: "sent",
        }),
      });
      setValue("");
      onSent?.();
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex items-end gap-2" data-testid="form-manual-send">
      <div className="flex-1">
        <label className="text-xs text-muted-foreground" data-testid="label-manual-message">
          Manual send (takeover)
        </label>
        <textarea
          className="mt-1 w-full min-h-[44px] max-h-40 rounded-xl bg-muted/30 border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          placeholder={disabled ? "Select a lead first" : "Type a message…"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled || sending}
          data-testid="input-manual-message"
        />
      </div>
      <Button
        className="h-11 rounded-xl"
        disabled={disabled || value.trim().length === 0 || sending}
        onClick={handleSend}
        data-testid="button-manual-send"
      >
        <Send className="h-4 w-4" />
        {sending ? "Sending…" : "Send"}
      </Button>
    </div>
  );
}
