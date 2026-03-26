import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { DonutChart } from "@/components/ui/donut-chart";
import { useLeads } from "@/hooks/useApiData";
import { PIPELINE_HEX } from "@/lib/avatarUtils";

// ── Funnel stage definitions ──────────────────────────────────────────────────

export const FUNNEL_STAGES = [
  { key: "new",       labelKey: "funnelStages.new",               dbValue: "New" },
  { key: "contacted", labelKey: "funnelStages.contacted",         dbValue: "Contacted" },
  { key: "responded", labelKey: "funnelStages.responded",         dbValue: "Responded" },
  { key: "multi",     labelKey: "funnelStages.multipleResponses", dbValue: "Multiple Responses" },
  { key: "qualified", labelKey: "funnelStages.qualified",         dbValue: "Qualified" },
  { key: "booked",    labelKey: "funnelStages.callBooked",        dbValue: "Booked" },
  { key: "closed",    labelKey: "funnelStages.closed",            dbValue: "Closed" },
  { key: "lost",      labelKey: "funnelStages.lost",              dbValue: "Lost" },
  { key: "dnd",       labelKey: "funnelStages.dnd",               dbValue: "DND" },
] as const;

export function tintColor(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgb(${Math.round(r+(255-r)*amount)},${Math.round(g+(255-g)*amount)},${Math.round(b+(255-b)*amount)})`;
}

// ── PipelineAndDonutWidget ────────────────────────────────────────────────────

export function PipelineAndDonutWidget({ campaignId, mockStages }: {
  campaignId: number;
  mockStages?: Array<{ key: string; count: number; }>;
}) {
  const { t } = useTranslation("campaigns");
  const { leads, loading } = useLeads(undefined, campaignId);
  const hadDataOnce = useRef(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [lockedKey, setLockedKey] = useState<string | null>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    setHoveredKey(null);
    setLockedKey(null);
    hasAnimated.current = false;
    hadDataOnce.current = false;
  }, [campaignId]);

  const activeKey = hoveredKey ?? lockedKey;

  const stages = useMemo(() => {
    return FUNNEL_STAGES.map((s) => ({
      ...s,
      label: t(s.labelKey),
      color: PIPELINE_HEX[s.dbValue] || "#6B7280",
      count: mockStages
        ? (mockStages.find((m) => m.key === s.key)?.count ?? 0)
        : leads.filter((l: any) => l.conversion_status === s.dbValue).length,
    }));
  }, [leads, t, mockStages]);

  const total = stages.reduce((s, st) => s + st.count, 0);
  const maxCount = Math.max(...stages.map((s) => s.count), 1);
  const hasData = stages.some((s) => s.count > 0);

  const donutData = useMemo(() =>
    stages.filter((s) => s.count > 0).map((s) => ({
      key: s.key,
      label: s.label,
      value: s.count,
      color: s.color,
    }))
  , [stages]);

  const activeStage = activeKey ? stages.find((s) => s.key === activeKey) : null;
  const displayCount = activeStage ? activeStage.count : total;
  const displayLabel = activeStage ? activeStage.label : t("summary.totalLeads");

  const skipAnim = hasAnimated.current;
  useEffect(() => {
    if (hasData && !hasAnimated.current) hasAnimated.current = true;
    if (hasData || leads.length > 0) hadDataOnce.current = true;
  });

  if (loading && !hadDataOnce.current && !mockStages) {
    return (
      <>
        <div className="flex justify-center">
          <div className="w-[170px] h-[170px] rounded-full border-[22px] border-foreground/[0.06] animate-pulse" />
        </div>
        <div className="border-t border-border/15" />
        <div className="flex flex-col flex-1 justify-between w-full py-1">
          {FUNNEL_STAGES.map((s) => (
            <div key={s.key} className="flex flex-col gap-0.5">
              <div className="h-3 w-2/3 rounded bg-foreground/[0.06] animate-pulse" />
              <div className="h-[4px] w-full rounded-full bg-foreground/[0.06] animate-pulse" />
            </div>
          ))}
        </div>
      </>
    );
  }

  if (!hasData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-6">
        <p className="text-[11px] text-foreground/40">{t("summary.noPipelineData")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-center" style={{ marginTop: 7 }}>
        <DonutChart
          data={donutData}
          size={154}
          strokeWidth={22}
          animationDuration={1.0}
          animationDelayPerSegment={0.04}
          skipAnimation={skipAnim}
          activeKey={activeKey}
          onSegmentHover={(seg) => setHoveredKey(seg?.key ?? null)}
          onSegmentClick={(seg) => setLockedKey(prev => prev !== null ? null : (seg.key ?? null))}
          onBackgroundClick={() => setLockedKey(null)}
          centerContent={
            <AnimatePresence mode="wait">
              <motion.div
                key={displayLabel}
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex flex-col items-center justify-center text-center pointer-events-none select-none"
              >
                <span className="text-[10px] font-medium uppercase tracking-widest text-foreground/35 mb-0.5 leading-none max-w-[110px] truncate">
                  {displayLabel}
                </span>
                <span className="text-[26px] font-black tabular-nums leading-none text-foreground">
                  {displayCount.toLocaleString()}
                </span>
                {activeStage && total > 0 && (
                  <span className="text-[11px] font-medium text-foreground/40 mt-0.5 leading-none">
                    {((activeStage.count / total) * 100).toFixed(0)}%
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          }
        />
      </div>
      <div className="flex flex-col flex-1 justify-between w-full">
        {stages.map((stage) => {
          const isActive = activeKey === stage.key;
          const isDimmed = activeKey !== null && !isActive;
          const hasCount = stage.count > 0;
          const widthPct = hasCount ? Math.max((stage.count / maxCount) * 100, 4) : 0;
          const pct = total > 0 && hasCount ? ((stage.count / total) * 100).toFixed(0) : null;
          const barColor = isDimmed ? tintColor(stage.color, 0.72) : stage.color;
          const barH = isActive ? "22px" : "20px";

          return (
            <div
              key={stage.key}
              className="flex flex-col gap-0.5 cursor-pointer"
              onMouseEnter={() => setHoveredKey(hasCount ? stage.key : null)}
              onMouseLeave={() => setHoveredKey(null)}
              onClick={() => { if (hasCount) setLockedKey(prev => prev !== null ? null : stage.key); }}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-medium truncate" style={{ color: "rgba(0,0,0,0.55)", transition: "color 150ms ease" }}>
                  {stage.label}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: isDimmed ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.75)", transition: "color 150ms ease" }}>
                    {stage.count.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="w-full rounded-full overflow-hidden bg-foreground/[0.03] relative" style={{ height: barH, transition: "height 250ms ease" }}>
                {hasCount && (
                  <div
                    className="h-full rounded-full relative"
                    style={{ width: `${widthPct}%`, backgroundColor: barColor, transition: "background-color 150ms ease, width 300ms ease" }}
                  >
                    {pct && (
                      <span
                        className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white tabular-nums select-none"
                        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)", opacity: isDimmed ? 0.5 : 1, transition: "opacity 150ms ease" }}
                      >
                        {pct}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── PipelineCardWrapper ───────────────────────────────────────────────────────

export function PipelineCardWrapper({ campaignId, mockStages }: {
  campaignId: number;
  mockStages?: Array<{ key: string; count: number; }>;
}) {
  const { t } = useTranslation("campaigns");
  return (
    <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-hidden" data-testid="campaign-detail-view-funnel">
      <div className="flex items-center min-h-[36px]">
        <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">{t("summary.pipeline")}</span>
      </div>
      <PipelineAndDonutWidget campaignId={campaignId} mockStages={mockStages} />
    </div>
  );
}
