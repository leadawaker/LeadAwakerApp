// Lead score arc + tier + sub-score breakdown + AI-summary block for the Lead
// detail panel. JSX moved verbatim from LeadDetailPanel.tsx (structural split).
import { useTranslation } from "react-i18next";
import { BarChart2, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { TIER_COLORS, TrendIcon } from "@/hooks/useScoreBreakdown";
import { SectionTitle } from "./atoms";
import { ScoreArcPanel, ScoreDetailBar } from "./ScorePanel";
import { engagementContext, activityContext, funnelContext } from "./format";

interface LeadScoreSectionProps {
  panelScore: number;
  scoreBreakdown: any;
  scoreLoading: boolean;
  demoNicheCtx: Record<string, any> | null;
  lead: Record<string, any>;
}

export function LeadScoreSection({
  panelScore,
  scoreBreakdown,
  scoreLoading,
  demoNicheCtx,
  lead,
}: LeadScoreSectionProps) {
  const { t } = useTranslation("leads");
  return (
          <>
            <SectionTitle icon={<BarChart2 className="h-3.5 w-3.5" />} title={t("detail.sections.scores")} />
            <div
              className="rounded-xl border border-border/40 bg-muted/20 px-4 py-4 flex flex-col gap-4 relative"
              data-testid="lead-score-gauges"
            >
              {/* Arc + trend row */}
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <ScoreArcPanel score={panelScore} tier={scoreBreakdown?.tier} />
                  {/* Tier tag — top-right of score arc */}
                  {scoreBreakdown && (
                    <span
                      className={cn("absolute -top-1 -right-2 text-[10px] font-bold px-2 py-0.5 rounded-full z-10", TIER_COLORS[scoreBreakdown.tier] ?? TIER_COLORS.Sleeping)}
                      style={(scoreBreakdown.tier === "Hot" || scoreBreakdown.tier === "Awake") ? {
                        boxShadow: `0 0 8px 2px ${scoreBreakdown.tier === "Hot" ? "rgba(239,68,68,0.4)" : "rgba(16,185,129,0.4)"}`,
                      } : undefined}
                    >
                      {scoreBreakdown.tier}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  {demoNicheCtx && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/15 text-violet-500 dark:text-violet-400 border border-violet-500/25 self-start">
                      DEMO{demoNicheCtx.niche_label ? ` · ${demoNicheCtx.niche_label}` : ""}
                    </span>
                  )}
                  {scoreBreakdown && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <TrendIcon
                        trend={scoreBreakdown.trend}
                        upClass="h-4 w-4 text-blue-500"
                        downClass="h-4 w-4 text-gray-400"
                      />
                      <span>{scoreBreakdown.trend === "up" ? "Trending up" : scoreBreakdown.trend === "down" ? "Trending down" : "Stable"}</span>
                    </div>
                  )}
                  {!scoreBreakdown && scoreLoading && (
                    <div className="flex flex-col gap-2">
                      <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
                      <div className="h-3 w-16 bg-muted animate-pulse rounded" />
                    </div>
                  )}
                </div>
              </div>

              {/* Sub-score bars with context — extra spacing */}
              {scoreBreakdown && (
                <div className="flex flex-col gap-5">
                  <ScoreDetailBar
                    label="Engagement"
                    rawScore={scoreBreakdown.engagement_score}
                    weight={1}
                    maxRaw={30}
                    context={engagementContext(lead)}
                  />
                  <ScoreDetailBar
                    label="Activity"
                    rawScore={scoreBreakdown.activity_score}
                    weight={1}
                    maxRaw={20}
                    context={activityContext(lead)}
                  />
                  <ScoreDetailBar
                    label="Funnel"
                    rawScore={scoreBreakdown.funnel_weight}
                    weight={1}
                    maxRaw={50}
                    context={funnelContext(lead)}
                  />
                </div>
              )}

              {/* Signal chips */}
              {scoreBreakdown && !scoreLoading && scoreBreakdown.signals.length > 0 && (
                <div className="flex flex-wrap gap-1.5 animate-in fade-in duration-200">
                  {scoreBreakdown.signals.map((s) => (
                    <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* AI Summary — below score gauges */}
            {lead.ai_memory && (() => {
              // Only show plain-text summaries here (not legacy JSON exchange logs)
              let isJsonArray = false;
              try {
                const parsed = JSON.parse(lead.ai_memory);
                if (Array.isArray(parsed)) isJsonArray = true;
              } catch { /* not JSON */ }
              if (isJsonArray) return null;
              return (
                <div
                  className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5 mt-2"
                  data-testid="ai-summary-below-scores"
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Bot className="h-3 w-3 text-muted-foreground/60" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {t("detail.fields.aiSummary", "AI Summary")}
                    </span>
                  </div>
                  <p className="text-[12px] text-foreground/80 leading-relaxed">{lead.ai_memory}</p>
                </div>
              );
            })()}
          </>
  );
}
