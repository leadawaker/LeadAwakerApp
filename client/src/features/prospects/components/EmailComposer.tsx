import { useState, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/apiUtils";
import type { ProspectRow } from "./ProspectListView";

function draftKey(prospectId: number) { return `email-draft-${prospectId}`; }
function loadDraft(prospectId: number) {
  try { return JSON.parse(localStorage.getItem(draftKey(prospectId)) || "null"); } catch { return null; }
}
function saveDraft(prospectId: number, data: { subject: string; body: string }) {
  try { localStorage.setItem(draftKey(prospectId), JSON.stringify(data)); } catch {}
}
function clearDraft(prospectId: number) {
  try { localStorage.removeItem(draftKey(prospectId)); } catch {}
}

interface OutreachTemplate {
  id: number;
  name: string | null;
  subject: string | null;
  body: string | null;
  channel: string | null;
}

function substituteVariables(text: string, prospect: ProspectRow): string {
  return text
    .replace(/\{\{name\}\}/g, prospect.contact_name || prospect.name || "")
    .replace(/\{\{company\}\}/g, prospect.company || "")
    .replace(/\{\{niche\}\}/g, prospect.niche || "");
}

interface EmailComposerProps {
  prospectId: number;
  prospect: ProspectRow;
  onSent?: () => void;
}

export function EmailComposer({ prospectId, prospect, onSent }: EmailComposerProps) {
  const { t } = useTranslation("prospects");

  const availableEmails = [prospect.contact_email, prospect.email, prospect.contact2_email].filter(Boolean) as string[];
  const hasEmail = availableEmails.length > 0;

  const [to, setTo] = useState(availableEmails[0] ?? "");
  const [subject, setSubject] = useState(() => loadDraft(prospectId)?.subject ?? "");
  const [body, setBody] = useState(() => loadDraft(prospectId)?.body ?? "");
  const [sending, setSending] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  useEffect(() => {
    apiFetch("/api/outreach-templates")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setTemplates(data.filter((tpl: OutreachTemplate) => !tpl.channel || tpl.channel === "email"));
        }
      })
      .catch(() => {});
  }, []);

  const handleTemplateChange = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const tpl = templates.find((t) => String(t.id) === templateId);
    if (!tpl) return;
    if (tpl.subject) setSubject(substituteVariables(tpl.subject, prospect));
    if (tpl.body) setBody(substituteVariables(tpl.body, prospect));
  }, [templates, prospect]);

  const handleSend = async () => {
    const trimmedBody = body.trim();
    if (!trimmedBody || !to.trim() || sending) return;
    if (!window.confirm(`Send email to ${to.trim()}?`)) return;
    setSending(true);
    setError(null);
    try {
      const res = await apiFetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospect_id: prospectId,
          type: "email",
          direction: "outbound",
          content: trimmedBody,
          metadata: { subject: subject.trim(), to: to.trim() },
        }),
      });
      if (!res.ok) throw new Error("Send failed");
      setSubject("");
      setBody("");
      setSelectedTemplateId("");
      clearDraft(prospectId);
      onSent?.();
    } catch {
      setError(t("emailCompose.sendFailed"));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!hasEmail) {
    return (
      <p className="text-[11px] text-muted-foreground/50 italic">
        {t("emailComposer.noEmail")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2" onKeyDown={handleKeyDown}>
      {/* To */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          {t("emailComposer.to", "To")}
        </label>
        {availableEmails.length > 1 ? (
          <div className="relative">
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full appearance-none text-[12px] rounded-lg border border-border/60 bg-white dark:bg-slate-900 px-2.5 py-1.5 pr-7 outline-none focus:ring-2 focus:ring-brand-indigo/30 text-foreground"
            >
              {availableEmails.map((email) => (
                <option key={email} value={email}>{email}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50 pointer-events-none" />
          </div>
        ) : (
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="text-[12px] rounded-lg border border-border/60 bg-white dark:bg-slate-900 px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-brand-indigo/30 text-foreground"
          />
        )}
      </div>

      {/* Template */}
      {templates.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            {t("emailCompose.template", "Template")}
          </label>
          <div className="relative">
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full appearance-none text-[12px] rounded-lg border border-border/60 bg-white dark:bg-slate-900 px-2.5 py-1.5 pr-7 outline-none focus:ring-2 focus:ring-brand-indigo/30 text-foreground"
            >
              <option value="">{t("emailCompose.noTemplate", "No template (blank)")}</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={String(tpl.id)}>{tpl.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Subject */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          {t("emailComposer.subject", "Subject")}
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t("emailCompose.subjectPlaceholder")}
          className="text-[12px] rounded-lg border border-border/60 bg-white dark:bg-slate-900 px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-brand-indigo/30 text-foreground placeholder:text-muted-foreground/40"
        />
      </div>

      {/* Body */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          {t("emailComposer.body", "Message")}
        </label>
        <textarea
          value={body}
          onChange={(e) => { setBody(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
          onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
          placeholder={t("emailCompose.bodyPlaceholder")}
          className="w-full text-[12px] rounded-lg border border-border/60 bg-white dark:bg-slate-900 px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-brand-indigo/30 text-foreground placeholder:text-muted-foreground/40 resize-none min-h-[72px] overflow-hidden"
        />
      </div>

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      <div className="flex items-center justify-end gap-2 pb-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => { saveDraft(prospectId, { subject, body }); setDraftSaved(true); setTimeout(() => setDraftSaved(false), 2000); }}
          disabled={!body.trim() && !subject.trim()}
          className="h-8 rounded-xl text-[11px]"
        >
          {draftSaved ? "Saved" : "Draft"}
        </Button>
        <Button
          size="sm"
          className="h-8 rounded-xl"
          disabled={!body.trim() || !to.trim() || sending}
          onClick={handleSend}
        >
          {sending ? t("emailComposer.sending", "Sending...") : "Send"}
        </Button>
      </div>
    </div>
  );
}
