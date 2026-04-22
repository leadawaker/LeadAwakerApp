import { useState, useEffect } from "react";
import { Copy, Check, Linkedin, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/apiUtils";
import type { ProspectRow } from "./ProspectListView";

interface LinkedInComposerProps {
  prospectId: number;
  prospect: ProspectRow;
  onSent?: () => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={handleCopy} className="p-1 rounded hover:bg-muted transition-colors" title="Copy">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground/60" />}
    </button>
  );
}

export function LinkedInComposer({ prospectId, prospect, onSent }: LinkedInComposerProps) {
  const { t } = useTranslation("prospects");

  type RecipientKey = "contact1" | "contact2" | "company";

  const recipients: { key: RecipientKey; label: string; url: string | null | undefined }[] = ([
    { key: "contact1" as RecipientKey, label: prospect.contact_name || "Contact 1", url: prospect.contact_linkedin },
    { key: "contact2" as RecipientKey, label: prospect.contact2_name || "Contact 2", url: prospect.contact2_linkedin },
    { key: "company" as RecipientKey, label: prospect.company || "Company", url: prospect.company_linkedin },
  ]).filter((r) => r.url);

  const hasRecipients = recipients.length > 0;

  const [recipient, setRecipient] = useState<RecipientKey>(recipients[0]?.key ?? "contact1");
  const [body, setBody] = useState(() => { try { return localStorage.getItem(`li-draft-${prospectId}`) || ""; } catch { return ""; } });
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset recipient if prospect changes
  useEffect(() => {
    setRecipient(recipients[0]?.key ?? "contact1");
    setBody("");
    setLogged(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectId]);

  const selectedRecipient = recipients.find((r) => r.key === recipient) ?? recipients[0];

  const handleLog = async () => {
    if (!body.trim() || logging) return;
    setLogging(true);
    setError(null);
    try {
      const res = await apiFetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospect_id: prospectId,
          type: "linkedin",
          direction: "outbound",
          content: body.trim(),
          metadata: {
            recipient: selectedRecipient?.label,
            linkedin_url: selectedRecipient?.url,
          },
        }),
      });
      if (!res.ok) throw new Error("Log failed");
      setBody("");
      setLogged(true);
      setTimeout(() => setLogged(false), 2500);
      onSent?.();
    } catch {
      setError("Failed to log interaction");
    } finally {
      setLogging(false);
    }
  };

  if (!hasRecipients) {
    return (
      <div className="flex items-center gap-1.5">
        <Linkedin className="h-3.5 w-3.5 text-muted-foreground/30" />
        <p className="text-[11px] text-muted-foreground/50 italic">
          {t("linkedInComposer.noLinkedin", "No LinkedIn URLs added for this prospect")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* To */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          {t("emailComposer.to", "To")}
        </label>
        <div className="flex items-center gap-1.5">
          {recipients.length > 1 ? (
            <div className="relative flex-1">
              <select
                value={recipient}
                onChange={(e) => setRecipient(e.target.value as RecipientKey)}
                className="w-full appearance-none text-[12px] rounded-lg border border-border/60 bg-white dark:bg-slate-900 px-2.5 py-1.5 pr-7 outline-none focus:ring-2 focus:ring-brand-indigo/30 text-foreground"
              >
                {recipients.map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/50 text-[10px]">▾</div>
            </div>
          ) : (
            <span className="text-[12px] text-foreground/70 flex-1">{recipients[0].label}</span>
          )}
          {selectedRecipient?.url && (
            <a
              href={selectedRecipient.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open LinkedIn profile"
              className="shrink-0 h-7 w-7 rounded-full border border-border/60 bg-white dark:bg-slate-900 flex items-center justify-center text-muted-foreground/50 hover:text-[#0A66C2] hover:border-[#0A66C2]/30 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* Message */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          {t("emailComposer.body", "Message")}
        </label>
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          placeholder="Write your LinkedIn message..."
          rows={3}
          className="text-[12px] rounded-lg border border-border/60 bg-white dark:bg-slate-900 px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-brand-indigo/30 text-foreground placeholder:text-muted-foreground/40 resize-none min-h-[72px] overflow-hidden"
        />
      </div>

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      <div className="flex items-center justify-end gap-2 pb-2">
        {body.trim() && <CopyButton text={body.trim()} />}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!body.trim()}
          onClick={() => {
            try { localStorage.setItem(`li-draft-${prospectId}`, body); } catch {}
          }}
          className="h-8 rounded-xl text-[11px]"
        >
          Draft
        </Button>
        <Button
          size="sm"
          className="h-8 rounded-xl"
          disabled={!body.trim() || logging}
          onClick={handleLog}
        >
          {logged ? "Logged" : logging ? "Logging..." : "Log"}
        </Button>
      </div>
    </div>
  );
}
