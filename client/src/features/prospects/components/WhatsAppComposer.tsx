import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { hapticSend } from "@/lib/haptics";
import { sendWhatsAppMessage } from "../api/prospectsApi";
import type { ProspectRow } from "./ProspectListView";

function draftKey(prospectId: number) { return `wa-draft-${prospectId}`; }
function loadDraft(prospectId: number) {
  try { return localStorage.getItem(draftKey(prospectId)) || ""; } catch { return ""; }
}
function saveDraft(prospectId: number, text: string) {
  try { localStorage.setItem(draftKey(prospectId), text); } catch {}
}
function clearDraft(prospectId: number) {
  try { localStorage.removeItem(draftKey(prospectId)); } catch {}
}

interface WhatsAppComposerProps {
  prospectId: number;
  prospect: ProspectRow;
  onSent?: () => void;
}

export function WhatsAppComposer({ prospectId, prospect, onSent }: WhatsAppComposerProps) {
  const { t } = useTranslation("prospects");

  const recipients = [
    { label: prospect.contact_name || "Contact 1", phone: prospect.contact_phone },
    { label: prospect.contact2_name || "Contact 2", phone: prospect.contact2_phone },
    { label: prospect.company || "Company", phone: prospect.phone },
  ].filter((r) => r.phone) as { label: string; phone: string }[];

  const [selectedPhone, setSelectedPhone] = useState(recipients[0]?.phone ?? "");
  const [value, setValue] = useState(() => loadDraft(prospectId));
  const [sending, setSending] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (recipients.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground/50 italic">
        {t("whatsappComposer.noPhone")}
      </p>
    );
  }

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    if (!window.confirm(`Send WhatsApp to ${selectedPhone}?`)) return;
    setSending(true);
    setError(null);
    hapticSend();
    try {
      await sendWhatsAppMessage(prospectId, trimmed);
      setValue("");
      clearDraft(prospectId);
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
      {/* To */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          {t("emailComposer.to", "To")}
        </label>
        {recipients.length > 1 ? (
          <div className="relative">
            <select
              value={selectedPhone}
              onChange={(e) => setSelectedPhone(e.target.value)}
              className="w-full appearance-none text-[12px] rounded-lg border border-border/60 bg-white dark:bg-slate-900 px-2.5 py-1.5 pr-7 outline-none focus:ring-2 focus:ring-brand-indigo/30 text-foreground"
            >
              {recipients.map((r) => (
                <option key={r.phone} value={r.phone}>{r.label} — {r.phone}</option>
              ))}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/50 text-[10px]">▾</div>
          </div>
        ) : (
          <span className="text-[12px] text-foreground/70 px-0.5">{recipients[0].label} — {recipients[0].phone}</span>
        )}
      </div>

      <textarea
        className="w-full rounded-lg bg-white dark:bg-slate-900 border border-border/60 p-3 text-[12px] text-foreground/80 leading-relaxed outline-none focus:ring-2 focus:ring-brand-indigo/30 resize-none overflow-hidden transition-colors min-h-[72px]"
        placeholder={t("whatsappComposer.placeholder")}
        value={value}
        onChange={(e) => { setValue(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
        onKeyDown={handleKeyDown}
        disabled={sending}
      />
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <div className="flex items-center justify-end gap-2 pb-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => { saveDraft(prospectId, value); setDraftSaved(true); setTimeout(() => setDraftSaved(false), 2000); }}
          disabled={value.trim().length === 0}
          className="h-8 rounded-xl text-[11px]"
        >
          {draftSaved ? "Saved" : "Draft"}
        </Button>
        <Button
          size="sm"
          className="h-8 rounded-xl"
          disabled={value.trim().length === 0 || sending}
          onClick={handleSend}
        >
          {sending ? t("whatsappComposer.sending") : "Send"}
        </Button>
      </div>
    </div>
  );
}
