import { useState } from "react";
import { User, Copy, Check, Sparkles, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/apiUtils";

interface ContactTabProps {
  prospect: Record<string, any>;
  slot: 1 | 2;
  prospectId: number;
  onRefresh?: () => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={handleCopy}
      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-muted-foreground/50" />}
    </button>
  );
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return raw.split("\n").filter(Boolean);
  }
}

export function ContactTab({ prospect, slot, prospectId, onRefresh }: ContactTabProps) {
  const { t } = useTranslation("prospects");

  const prefix = slot === 1 ? "" : "contact2_";
  const linkedinUrl = slot === 1 ? prospect.contact_linkedin : prospect.contact2_linkedin;
  const contactName = slot === 1 ? prospect.contact_name : prospect.contact2_name;
  const photoUrl = prospect[`${prefix}photo_url`];
  const headline = prospect[`${prefix}headline`];
  const connectionCount = prospect[`${prefix}connection_count`];
  const followerCount = prospect[`${prefix}follower_count`];
  const topPost = prospect[`${prefix}top_post`];
  const personBrief = parseJsonArray(prospect[`${prefix}person_brief`]);

  const [enriching, setEnriching] = useState(false);

  async function handleEnrich() {
    if (enriching) return;
    setEnriching(true);
    try {
      await apiFetch(`/api/prospects/${prospectId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "linkedin", contactSlot: slot }),
      });
      onRefresh?.();
    } catch {
      // silent
    } finally {
      setEnriching(false);
    }
  }

  // No LinkedIn URL set
  if (!linkedinUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
        <User className="h-6 w-6 text-muted-foreground/20" />
        <p className="text-[11px] text-muted-foreground/40 italic">
          {t("contact.addLinkedinHint", "Add a LinkedIn URL to enrich this contact")}
        </p>
      </div>
    );
  }

  // LinkedIn URL exists but no data enriched yet
  const hasData = !!(headline || photoUrl || personBrief.length > 0);
  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
        <Sparkles className="h-6 w-6 text-muted-foreground/20" />
        <p className="text-[11px] text-muted-foreground/40 italic">
          {t("contact.enrichHint", "Enrich LinkedIn to see contact insights")}
        </p>
        <button
          onClick={handleEnrich}
          disabled={enriching}
          className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium bg-brand-indigo/10 text-brand-indigo hover:bg-brand-indigo/20 transition-colors disabled:opacity-50"
        >
          {enriching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {t("contact.enrichLinkedin", "Enrich LinkedIn")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* Photo + headline */}
      <div className="flex items-start gap-2.5">
        {photoUrl && (
          <img
            src={photoUrl}
            alt={contactName || ""}
            className="w-8 h-8 rounded-full object-cover shrink-0 border border-border/30"
          />
        )}
        <div className="flex-1 min-w-0">
          {headline && (
            <p className="text-[12px] font-medium text-foreground leading-snug">{headline}</p>
          )}
          {(connectionCount || followerCount) && (
            <div className="flex gap-3 mt-0.5">
              {connectionCount && (
                <span className="text-[10px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{Number(connectionCount).toLocaleString()}</span> connections
                </span>
              )}
              {followerCount && (
                <span className="text-[10px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{Number(followerCount).toLocaleString()}</span> followers
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Top post */}
      {topPost && (
        <>
          <div className="h-px bg-border/30" />
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
            {t("fields.topPost")}
          </h4>
          <div className="group flex items-start gap-1.5 p-2.5 rounded-lg bg-muted/30 border-l-2 border-brand-indigo/20">
            <p className="flex-1 text-[11px] text-foreground/70 leading-relaxed italic">{topPost}</p>
            <CopyButton text={topPost} />
          </div>
        </>
      )}

      {/* Person brief bullets */}
      {personBrief.length > 0 && (
        <>
          <div className="h-px bg-border/30" />
          <ul className="flex flex-col gap-1">
            {personBrief.map((bullet, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-foreground/80 leading-snug">
                <span className="mt-1 w-1 h-1 rounded-full bg-brand-indigo/40 shrink-0" />
                {bullet}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Re-enrich button */}
      <div className="pt-1">
        <button
          onClick={handleEnrich}
          disabled={enriching}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          {enriching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {t("contact.enrichLinkedin", "Enrich LinkedIn")}
        </button>
      </div>
    </div>
  );
}
