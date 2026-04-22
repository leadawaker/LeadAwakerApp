import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Send, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import type { ProspectRow } from "./ProspectListView";

// ── Types ────────────────────────────────────────────────────────────────────

interface ReplyContext {
  messageId: string;
  threadId: string;
  subject: string;
}

interface EmailComposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospect: ProspectRow;
  replyTo?: ReplyContext;
  onSent?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function EmailComposeModal({
  open,
  onOpenChange,
  prospect,
  replyTo,
  onSent,
}: EmailComposeModalProps) {
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

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setTo(availableEmails[0] || "");
      setSubject(replyTo ? `Re: ${replyTo.subject}` : "");
      setBody("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

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
      onOpenChange(false);
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
  }, [to, subject, body, prospect, replyTo, toast, t, onOpenChange, onSent]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-semibold">
            {replyTo ? t("emailCompose.replyTitle") : t("emailCompose.title")}
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            {t("emailCompose.subtitle", { name: prospect.name || prospect.company || "" })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 flex-1 overflow-y-auto py-2">
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

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-[13px]"
          >
            {t("detail.cancel")}
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !to || !subject.trim() || !body.trim()}
            className="text-[13px] gap-2"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sending ? t("emailCompose.sending") : t("emailCompose.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
