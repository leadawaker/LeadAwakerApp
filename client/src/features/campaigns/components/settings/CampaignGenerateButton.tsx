import { useState, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, RefreshCw } from "lucide-react";
import type { Campaign } from "@/types/models";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiUtils";
import { parseLangField, isFilled } from "@shared/langField";

const CONTEXT_FIELD_KEYS = [
  "description", "nicheQuestion", "kb",
  "campaignUsp", "aiStyleOverride", "whatLeadDid", "serviceName",
] as const;

function hasEmptyFields(campaign: any): boolean {
  return CONTEXT_FIELD_KEYS.some((k) => {
    const raw = campaign[k];
    if (!raw && raw !== 0) return true;
    const f = parseLangField(raw);
    const isMirrored = f.en && f.nl && f.en === f.nl;
    return isMirrored || (!isFilled(raw, "en") && !isFilled(raw, "nl"));
  });
}

export function CampaignGenerateButton({
  campaign,
  onGenerated,
}: {
  campaign: Campaign;
  onGenerated?: () => void;
}) {
  const { t } = useTranslation("campaigns");
  const { toast } = useToast();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [niche, setNiche] = useState("");
  const [generating, setGenerating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const needsNiche = useMemo(() => hasEmptyFields(campaign), [campaign]);

  const handleGenerate = async () => {
    if (generating) return;
    if (needsNiche && !niche.trim()) return;
    setGenerating(true);
    try {
      const id = (campaign as any).id || (campaign as any).Id;
      const body: Record<string, string> = {};
      if (niche.trim()) body.niche = niche.trim();
      const res = await apiFetch(`/api/campaigns/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Generation failed");
      }
      const data = await res.json();
      const filledFields: string[] = data.filledFields ?? [];
      const translatedFields: string[] = data.translatedFields ?? [];
      setPopoverOpen(false);
      setNiche("");
      onGenerated?.();
      if (!filledFields.length && !translatedFields.length) {
        toast({ title: t("toolbar.nothingToDo", "Nothing to do"), description: t("toolbar.allComplete", "All fields already have both languages.") });
      } else {
        const parts: string[] = [];
        if (filledFields.length) parts.push(`${t("toolbar.filled", "Filled")}: ${filledFields.join(", ")}`);
        if (translatedFields.length) parts.push(`${t("toolbar.translated", "Translated")}: ${translatedFields.join(", ")}`);
        toast({ title: t("toolbar.done", "Done"), description: parts.join(" · ") });
      }
    } catch (err: any) {
      toast({ title: t("toolbar.generateFailed", "Generation failed"), description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Popover
      open={popoverOpen}
      onOpenChange={(v) => {
        setPopoverOpen(v);
        if (v && needsNiche) setTimeout(() => inputRef.current?.focus(), 50);
      }}
    >
      <PopoverTrigger asChild>
        <button
          className="la-btn"
          style={{
            fontFamily: "Geist Mono, ui-monospace, monospace", fontSize: 10, letterSpacing: "0.14em",
            textTransform: "uppercase", gap: 8, display: "inline-flex", alignItems: "center",
            background: "var(--paper)", border: "none", boxShadow: "none", color: "var(--ink)", cursor: "pointer",
          }}
          title={t("toolbar.generate", "Generate / Translate")}
        >
          <Sparkles style={{ width: 14, height: 14, color: "var(--wine)" }} />
          {t("toolbar.generate", "Generate / Translate")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        {needsNiche ? (
          <>
            <p className="text-[11px] text-muted-foreground mb-2">
              {t("toolbar.generateHint", "Type a niche — AI fills empty fields in EN + NL and translates any single-language fields.")}
            </p>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
                placeholder={t("toolbar.nichePlaceholder", "e.g. dental clinic, solar, gym")}
                className="flex-1 h-8 rounded-md border border-black/[0.125] bg-background px-2.5 text-[12px] outline-none focus:border-brand-indigo transition-colors"
              />
              <button
                onClick={handleGenerate}
                disabled={!niche.trim() || generating}
                className="h-8 w-8 rounded-full bg-brand-indigo text-white disabled:opacity-50 hover:bg-brand-indigo/90 transition-colors flex items-center justify-center shrink-0"
                title={t("toolbar.generate", "Generate")}
              >
                {generating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground mb-2">
              {t("toolbar.translateHint", "All fields are filled. Click to translate any single-language fields to add the missing language.")}
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full h-8 rounded-md bg-brand-indigo text-white text-[12px] font-semibold disabled:opacity-50 hover:bg-brand-indigo/90 transition-colors flex items-center justify-center gap-1.5"
            >
              {generating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {t("toolbar.translate", "Translate missing languages")}
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
