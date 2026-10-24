/**
 * useCampaignAiSummary
 *
 * The campaign's AI summary (the "AI Read" strip, AISummaryWidget) and its
 * refresh. The text is kept in localStorage per campaign, falling back to the
 * campaign's stored ai_summary. Refresh calls POST /api/campaigns/:id/generate-summary,
 * which checks the caller owns the campaign. Used by useCampaignDetail and by
 * Home > Reactivation.
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiUtils";

const summaryKey = (id: unknown) => `la:campaign-summary:${id}`;
const summaryAtKey = (id: unknown) => `la:campaign-summary-at:${id}`;

function readStored(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStored(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
}

/** `campaign` needs only its id and the stored summary fields. */
export function useCampaignAiSummary(campaign: {
  id?: number | null; Id?: number | null; ai_summary?: string | null; ai_summary_generated_at?: string | null;
}) {
  const { t } = useTranslation("campaigns");
  const { toast } = useToast();
  const campaignId = campaign.id || campaign.Id;

  const [localAiSummary, setLocalAiSummary] = useState<string | null>(
    () => readStored(summaryKey(campaignId)) ?? campaign.ai_summary ?? null,
  );
  const [localAiSummaryAt, setLocalAiSummaryAt] = useState<string | null>(
    () => readStored(summaryAtKey(campaignId)) ?? campaign.ai_summary_generated_at ?? null,
  );

  useEffect(() => {
    setLocalAiSummary(readStored(summaryKey(campaignId)) ?? campaign.ai_summary ?? null);
    setLocalAiSummaryAt(readStored(summaryAtKey(campaignId)) ?? campaign.ai_summary_generated_at ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const handleAiSummaryRefreshed = useCallback((summary: string, generatedAt: string) => {
    setLocalAiSummary(summary);
    setLocalAiSummaryAt(generatedAt);
    writeStored(summaryKey(campaignId), summary);
    writeStored(summaryAtKey(campaignId), generatedAt);
  }, [campaignId]);

  const [refreshingSummary, setRefreshingSummary] = useState(false);
  const refreshAiSummary = useCallback(async () => {
    if (refreshingSummary || !campaignId) return;
    setRefreshingSummary(true);
    try {
      const res = await apiFetch(`/api/campaigns/${campaignId}/generate-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      // The endpoint answers 200 with { error } when no Groq key is set, and sends no timestamp.
      if (data?.error === "NO_GROQ_API_KEY") throw new Error(t("summary.groqApiKeyMissing"));
      if (!data?.summary) throw new Error(String(data?.error ?? ""));
      handleAiSummaryRefreshed(data.summary, data.generated_at ?? new Date().toISOString());
    } catch (err: any) {
      toast({ title: t("summary.generateFailed"), description: err?.message || undefined, variant: "destructive" });
    } finally {
      setRefreshingSummary(false);
    }
  }, [campaignId, refreshingSummary, toast, t, handleAiSummaryRefreshed]);

  return { localAiSummary, localAiSummaryAt, handleAiSummaryRefreshed, refreshAiSummary, refreshingSummary };
}
