import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Copy, Check, Loader2, Wand2, Heart, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/apiUtils";
import { cn } from "@/lib/utils";

interface SavedMessage {
  title: string;
  text: string;
  saved?: boolean;
}

interface MessageGeneratorProps {
  prospectId: number;
  offerIdeas?: Array<{ text: string; checked?: boolean }>;
  contactName?: string;
  contact2Name?: string;
  savedMessages?: SavedMessage[];
  onRefresh?: () => void;
}

const STYLES = ["hormozi", "saraev", "cashvertising", "professional"] as const;
const FORMATS = [
  "whatsapp",
  "linkedin_note",
  "linkedin_message",
  "company_message",
  "email",
  "cold_call",
] as const;
const LANGUAGES = ["en", "nl", "pt"] as const;
const LANGUAGE_LABELS: Record<string, string> = { en: "EN", nl: "NL", pt: "PT" };

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="shrink-0 p-1 rounded hover:bg-muted transition-colors" title="Copy">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
    </button>
  );
}

export function MessageGenerator({ prospectId, offerIdeas, contactName, contact2Name, savedMessages, onRefresh }: MessageGeneratorProps) {
  const { t } = useTranslation("prospects");
  const [style, setStyle] = useState("hormozi");
  const [format, setFormat] = useState("whatsapp");
  const [language, setLanguage] = useState("en");
  const [selectedOffer, setSelectedOffer] = useState("any");
  const [selectedContact, setSelectedContact] = useState("1");
  const [customInstructions, setCustomInstructions] = useState("");
  const [messages, setMessages] = useState<SavedMessage[]>(savedMessages || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build offer for the API: if "any" and some offers are checked, send checked ones joined
  const checkedOffers = offerIdeas?.filter(o => o.checked) || [];
  const offerTexts = offerIdeas?.map(o => o.text) || [];

  function getOfferParam(): string | undefined {
    if (selectedOffer !== "any") return selectedOffer;
    if (checkedOffers.length > 0) return checkedOffers.map(o => o.text).join("; ");
    return undefined;
  }

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/api/prospects/${prospectId}/generate-messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            style,
            format,
            language,
            offer: getOfferParam(),
            contact: selectedContact,
            customInstructions: customInstructions || undefined,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to generate");
      }
      const data = await res.json();
      setMessages(data.messages);
      onRefresh?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  async function toggleSaved(index: number) {
    const updated = messages.map((m, i) => i === index ? { ...m, saved: !m.saved } : m);
    setMessages(updated);
    // Persist to DB
    try {
      await apiFetch(`/api/prospects/${prospectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generated_messages: JSON.stringify(updated) }),
      });
    } catch {
      // silent
    }
  }

  async function deleteMessage(index: number) {
    const updated = messages.filter((_, i) => i !== index);
    setMessages(updated);
    try {
      await apiFetch(`/api/prospects/${prospectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generated_messages: JSON.stringify(updated) }),
      });
    } catch {
      // silent
    }
  }

  // Split messages: favorites first, then rest
  const favorites = messages.filter(m => m.saved);
  const others = messages.filter(m => !m.saved);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4" />
        {t("outreach.title")}
        {favorites.length > 0 && (
          <span className="text-[10px] text-emerald-600 font-normal">
            {favorites.length} saved
          </span>
        )}
      </div>

      {/* Row 1: Style, Format, Language */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={style} onValueChange={setStyle}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder={t("outreach.stylePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {STYLES.map((s) => (
              <SelectItem key={s} value={s}>{t(`outreach.styles.${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={format} onValueChange={setFormat}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder={t("outreach.formatPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {FORMATS.map((f) => (
              <SelectItem key={f} value={f}>{t(`outreach.formats.${f}`, f.replace("_", " "))}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-[70px] h-8 text-xs">
            <SelectValue placeholder={t("outreach.languagePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l} value={l}>{LANGUAGE_LABELS[l]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: Offer, Contact, Generate */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={selectedOffer} onValueChange={setSelectedOffer}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder={t("outreach.anyOffer", "Any offer")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">
              {checkedOffers.length > 0
                ? `Checked offers (${checkedOffers.length})`
                : t("outreach.anyOffer", "Any offer")}
            </SelectItem>
            {offerTexts.map((idea, i) => (
              <SelectItem key={i} value={idea}>
                {idea.length > 40 ? idea.slice(0, 40) + "..." : idea}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedContact} onValueChange={setSelectedContact}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">
              {contactName ? `Contact 1 (${contactName})` : "Contact 1"}
            </SelectItem>
            <SelectItem value="2">
              {contact2Name ? `Contact 2 (${contact2Name})` : "Contact 2"}
            </SelectItem>
            <SelectItem value="generic">
              {t("outreach.contactGeneric", "Company only")}
            </SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={generate} disabled={loading} size="sm" className="h-8">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {loading ? t("outreach.generating") : t("outreach.generate")}
        </Button>
        {loading && <span className="text-xs text-muted-foreground">~60s</span>}
      </div>

      {/* Custom instructions */}
      <Textarea
        value={customInstructions}
        onChange={(e) => setCustomInstructions(e.target.value)}
        placeholder={t("outreach.customInstructionsPlaceholder", "Custom instructions for this message...")}
        rows={2}
        className="text-xs resize-none"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Saved favorites */}
      {favorites.length > 0 && (
        <div className="space-y-2">
          {messages.map((msg, i) => {
            if (!msg.saved) return null;
            return (
              <div key={`msg-${i}`} className="rounded-lg p-3 text-sm bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-emerald-700 dark:text-emerald-400 text-[12px]">{msg.title}</span>
                    <p className="mt-1 whitespace-pre-wrap text-[12px]">{msg.text}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => toggleSaved(i)} className="p-1 rounded hover:bg-muted transition-colors" title="Unsave">
                      <Heart className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />
                    </button>
                    <CopyButton text={msg.text} />
                    <button onClick={() => deleteMessage(i)} className="p-1 rounded hover:bg-destructive/10 transition-colors" title="Delete">
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {others.length > 0 && <div className="h-px bg-border/30" />}
        </div>
      )}

      {/* Non-saved messages */}
      {others.length > 0 && (
        <div className="space-y-2">
          {messages.map((msg, i) => {
            if (msg.saved) return null;
            return (
              <div key={`msg-${i}`} className="bg-white dark:bg-slate-900 border border-border/60 shadow-sm rounded-lg p-3 text-sm group">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-muted-foreground text-[12px]">{msg.title}</span>
                    <p className="mt-1 whitespace-pre-wrap text-[12px]">{msg.text}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => toggleSaved(i)} className="p-1 rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100" title="Save">
                      <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <CopyButton text={msg.text} />
                    <button onClick={() => deleteMessage(i)} className="p-1 rounded hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100" title="Delete">
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
