// AI insights block for LeadDetailPanel: AI summary, sentiment, memory.
// Extracted verbatim (Session C).
import { Bot } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SectionTitle } from "./atoms";
import { SentimentBadge } from "./badges";
import { formatAiMemory } from "./format";

interface LeadAiInsightsSectionProps {
  lead: Record<string, any>;
  localAiSummary: string | null;
}

export function LeadAiInsightsSection({ lead, localAiSummary }: LeadAiInsightsSectionProps) {
  const { t } = useTranslation("leads");
  if (!(lead.ai_sentiment || lead.ai_memory || lead.ai_summary || localAiSummary)) return null;
  return (
    <>
      <SectionTitle icon={<Bot className="h-3.5 w-3.5" />} title={t("detail.sections.aiInsights")} />
      <div
        className="rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5"
        data-testid="ai-insights-section"
      >
        {/* AI summary */}
        {(localAiSummary || lead.ai_summary) && (
          <div className="py-1.5 border-b border-border/30">
            <div className="text-[11px] text-muted-foreground mb-1">{t("detail.fields.aiSummary")}</div>
            <p className="text-[12px] text-foreground/80 leading-relaxed">{localAiSummary || lead.ai_summary}</p>
          </div>
        )}
        {/* Sentiment badge — color coded */}
        {lead.ai_sentiment && (
          <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
            <span className="text-[11px] text-muted-foreground shrink-0">{t("detail.fields.aiSentiment")}</span>
            <SentimentBadge sentiment={lead.ai_sentiment} />
          </div>
        )}
        {/* AI memory — formatted readably */}
        {lead.ai_memory && (
          <div className="py-1.5" data-testid="ai-memory-display">
            <div className="text-[11px] text-muted-foreground mb-1.5">{t("detail.fields.aiMemory")}</div>
            <pre className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans break-words">
              {formatAiMemory(lead.ai_memory)}
            </pre>
          </div>
        )}
      </div>
    </>
  );
}
