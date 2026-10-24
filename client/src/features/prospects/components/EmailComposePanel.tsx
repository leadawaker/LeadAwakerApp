// Compose an email to a prospect, as a right-hand panel (UI_STANDARDS 3.7).
// Mount it only while open; each mount starts with a fresh form.
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";
import { RightPanel } from "@/components/crm/primitives";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import type { ProspectRow } from "./ProspectListView";

// ── Types ────────────────────────────────────────────────────────────────────

interface ReplyContext {
  messageId: string;
  threadId: string;
  subject: string;
}

interface EmailComposePanelProps {
  onClose: () => void;
  prospect: ProspectRow;
  replyTo?: ReplyContext;
  onSent?: () => void;
  className?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function EmailComposePanel({
  onClose,
  prospect,
  replyTo,
  onSent,
  className,
}: EmailComposePanelProps) {
  const { t } = useTranslation("prospects");
  const { toast } = useToast();

  // Collect available emails
  const availableEmails: string[] = [];
  if (prospect.email) availableEmails.push(prospect.email);
  if (prospect.contact_email && !availableEmails.includes(prospect.contact_email))
    availableEmails.push(prospect.contact_email);
  if (prospect.contact2_email && !availableEmails.includes(prospect.contact2_email))
    availableEmails.push(prospect.contact2_email);

  const [to, setTo] = useState(availableEmails[0] || "");
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : "");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  // Send email
  const handleSend = useCallback(async () => {
    if (!to || !subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      const prospectId = prospect.Id ?? prospect.id ?? 0;
      const payload: Record<string, unknown> = {
        to,
        subject: subject.trim(),
        htmlBody: body.trim().replace(/\n/g, "<br>"),
        prospectId,
      };
      if (replyTo) {
        payload.replyToMessageId = replyTo.messageId;
        payload.threadId = replyTo.threadId;
      }

      const res = await apiFetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Send failed" }));
        throw new Error(err.message || "Send failed");
      }

      toast({
        title: t("emailCompose.sent"),
        description: t("emailCompose.sentDescription", { to }),
      });
      onClose();
      onSent?.();
    } catch (err: any) {
      toast({
        title: t("emailCompose.sendFailed"),
        description: err.message || t("emailCompose.sendFailedDescription"),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }, [to, subject, body, prospect, replyTo, toast, t, onClose, onSent]);

  return (
    <RightPanel
      title={replyTo ? t("emailCompose.replyTitle") : t("emailCompose.title")}
      subtitle={t("emailCompose.subtitle", { name: prospect.name || prospect.company || "" })}
      onClose={onClose}
      cancelLabel={t("detail.cancel")}
      submitLabel={sending ? t("emailCompose.sending") : t("emailCompose.send")}
      submitIcon={<Send className="h-4 w-4" />}
      onSubmit={handleSend}
      submitting={sending}
      submitDisabled={!to || !subject.trim() || !body.trim()}
      className={className}
      data-testid="email-compose-panel"
    >
        <div className="flex flex-col gap-3">
          {/* To */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-brand-indigo dark:text-blue-400 mb-1 block">
              {t("emailCompose.to")}
            </label>
            {availableEmails.length > 1 ? (
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full h-9 rounded-lg border border-border/60 bg-white dark:bg-slate-900 px-3 text-[13px] font-medium outline-none focus:ring-1 focus:ring-brand-indigo/40"
              >
                {availableEmails.map((email) => (
                  <option key={email} value={email}>
                    {email}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder={t("emailCompose.toPlaceholder")}
                className="w-full h-9 rounded-lg border border-border/60 bg-white dark:bg-slate-900 px-3 text-[13px] outline-none focus:ring-1 focus:ring-brand-indigo/40"
              />
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-brand-indigo dark:text-blue-400 mb-1 block">
              {t("emailCompose.subject")}
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("emailCompose.subjectPlaceholder")}
              className="w-full h-9 rounded-lg border border-border/60 bg-white dark:bg-slate-900 px-3 text-[13px] outline-none focus:ring-1 focus:ring-brand-indigo/40"
            />
          </div>

          {/* Body */}
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-brand-indigo dark:text-blue-400 mb-1 block">
              {t("emailCompose.body")}
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("emailCompose.bodyPlaceholder")}
              rows={10}
              className="w-full rounded-lg border border-border/60 bg-white dark:bg-slate-900 px-3 py-2 text-[13px] leading-relaxed resize-none outline-none focus:ring-1 focus:ring-brand-indigo/40 placeholder:text-foreground/25"
            />
            <p className="text-[10px] text-foreground/40 mt-1">
              {t("emailCompose.signatureNote")}
            </p>
          </div>

        </div>
    </RightPanel>
  );
}
