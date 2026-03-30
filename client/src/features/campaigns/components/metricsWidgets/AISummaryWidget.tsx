import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderRichText } from "@/lib/richTextUtils";
import { apiFetch } from "@/lib/apiUtils";
import type { Campaign } from "@/types/models";

// ── AISummaryWidget ───────────────────────────────────────────────────────────

export function AISummaryWidget({ campaign, summary, generatedAt, onRefreshed }: {
  campaign: Campaign;
  summary: string | null;
  generatedAt: string | null;
  onRefreshed: (summary: string, generatedAt: string) => void;
}) {
  const { t } = useTranslation("campaigns");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formattedAt = useMemo(() => {
    if (!generatedAt) return null;
    try {
      return new Date(generatedAt).toLocaleString(undefined, {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return null; }
  }, [generatedAt]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const httpRes = await apiFetch(`/api/campaigns/${campaign.id || (campaign as any).Id}/generate-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await httpRes.json() as any;
      if (res.error === "NO_GROQ_API_KEY") { setError(t("summary.groqApiKeyMissing")); return; }
      if (res.error) { setError(t("summary.generateFailed")); return; }
      onRefreshed(res.summary, res.generated_at);
    } catch {
      setError(t("summary.networkError"));
    } finally {
      setLoading(false);
    }
  }, [campaign, onRefreshed, t]);

  const paragraphs = useMemo(() => {
    if (!summary) return [];
    return summary.split(/\n\n+/).filter(p => p.trim().length > 0);
  }, [summary]);

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-h-0">
      <div className="flex items-center justify-between gap-2 shrink-0">
        {formattedAt ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-foreground/35 tabular-nums">{t("summary.lastRun", { date: formattedAt })}</span>
          </div>
        ) : (
          <span className="text-[10px] text-foreground/30 italic">{t("summary.noAnalysisYet")}</span>
        )}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className={cn(
            "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9",
            loading
              ? "border-brand-indigo/30 text-brand-indigo/50 cursor-not-allowed"
              : "border-brand-indigo/40 text-brand-indigo hover:text-brand-indigo hover:max-w-[140px]"
          )}
        >
          {loading
            ? <div className="w-4 h-4 rounded-full border-2 border-brand-indigo/30 border-t-brand-indigo animate-spin shrink-0" />
            : <Sparkles className="h-4 w-4 shrink-0" />
          }
          <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {summary ? t("summary.regenerate") : t("summary.generate")}
          </span>
        </button>
      </div>
      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200/60 px-3 py-2.5 text-[11px] text-rose-600 shrink-0">
          {error}
        </div>
      )}
      {paragraphs.length > 0 ? (
        <div className="flex flex-col gap-3 text-[12px] leading-relaxed text-foreground/75">
          {paragraphs.map((p, i) => (
            <p key={i} className={cn(i === 0 && "font-medium text-foreground/85")}>{renderRichText(p)}</p>
          ))}
        </div>
      ) : !loading && !error && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-6">
          <div className="w-10 h-10 rounded-2xl bg-brand-indigo/8 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-brand-indigo/50" />
          </div>
          <div>
            <p className="text-[12px] font-medium text-foreground/50">{t("summary.noAiAnalysis")}</p>
            <p className="text-[11px] text-foreground/35 mt-0.5">{t("summary.aiRunsNightly")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
