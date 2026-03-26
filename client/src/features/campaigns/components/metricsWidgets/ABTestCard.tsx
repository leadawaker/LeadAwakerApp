import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FlaskConical } from "lucide-react";
import type { Campaign } from "@/types/models";

// ── ABTestCard ────────────────────────────────────────────────────────────────

export function ABTestCard({ campaign, mockStats }: { campaign: Campaign; mockStats?: any }) {
  const { t } = useTranslation("campaigns");
  const [stats, setStats] = useState<any>(mockStats ?? null);
  const [loading, setLoading] = useState(!mockStats);

  useEffect(() => {
    if (mockStats) return;
    fetch(`/api/campaigns/${campaign.id}/ab-stats`, { credentials: "include" })
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [campaign.id, mockStats]);

  if (loading) {
    return (
      <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-y-auto min-h-0 max-h-[680px]" data-testid="campaign-detail-view-ab">
        <div className="flex items-center min-h-[36px] shrink-0">
          <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">{t("abTesting.title")}</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground text-xs">Loading...</div>
        </div>
      </div>
    );
  }

  const hasData = stats?.variants && (stats.variants.A || stats.variants.B);

  return (
    <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-y-auto min-h-0 max-h-[680px]" data-testid="campaign-detail-view-ab">
      <div className="flex items-center justify-between min-h-[36px] shrink-0">
        <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">{t("abTesting.title")}</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {stats?.split_ratio != null ? `${100 - stats.split_ratio}/${stats.split_ratio}` : "50/50"}
        </span>
      </div>
      {!hasData ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <FlaskConical className="w-8 h-8 opacity-20" />
          <span className="text-xs">{t("abTesting.noTest")}</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4">
            {(["A", "B"] as const).map((v) => {
              const isWinner = stats.winner === v;
              return (
                <div key={v} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-sm ${v === "A" ? "bg-indigo-500" : "bg-transparent ring-1 ring-indigo-500"}`} />
                  <span className={`text-xs font-medium ${isWinner ? "text-amber-400" : "text-foreground"}`}>
                    {v}{isWinner ? " ✦" : ""}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{stats.variants[v]?.leads ?? 0} leads</span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-3">
            {[
              { key: "response",   label: t("abTesting.response"),          field: "response_rate",          pct: true },
              { key: "qual",       label: t("abTesting.qualification"),      field: "qualification_rate",      pct: true },
              { key: "booking",    label: t("abTesting.booking"),            field: "booking_rate",            pct: true },
              { key: "optout",     label: t("abTesting.optOut"),             field: "optout_rate",             pct: true,  invert: true },
              { key: "avgMsgs",    label: t("abTesting.avgMessages"),        field: "avg_messages",            pct: false, invert: true },
              { key: "avgTime",    label: t("abTesting.avgResponseTime"),    field: "avg_response_time_min",   pct: false, suffix: "m", invert: true },
            ].map(({ key, label, field, pct, invert, suffix }) => {
              const a = stats.variants.A?.[field] ?? 0;
              const b = stats.variants.B?.[field] ?? 0;
              const max = Math.max(a, b) || 1;
              const fmt = (v: number) => pct ? `${(v * 100).toFixed(0)}%` : `${v.toFixed(1)}${suffix ?? ""}`;
              const better = invert ? (a < b && a > 0 ? "A" : b < a && b > 0 ? "B" : null) : (a > b ? "A" : b > a ? "B" : null);
              return (
                <div key={key} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
                    {better && <span className="text-[10px] text-amber-400 font-semibold">{better} ✦</span>}
                  </div>
                  {(["A", "B"] as const).map((v) => {
                    const val = v === "A" ? a : b;
                    const wPct = pct ? val * 100 : (max > 0 ? (val / max) * 100 : 0);
                    const w = Math.max(wPct, val > 0 ? 6 : 0);
                    const isSolid = v === "A";
                    const text = fmt(val);
                    return (
                      <div key={v} className="relative h-6">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${isSolid ? "bg-indigo-500" : "border border-indigo-500/60 bg-indigo-500/8"}`}
                          style={{ width: `${w}%`, minWidth: w > 0 ? "24px" : "0" }}
                        />
                        {isSolid ? (
                          <>
                            <div className="absolute inset-0 flex items-center px-3 overflow-hidden" style={{ width: `${w}%`, minWidth: w > 0 ? "24px" : "0" }}>
                              <span className="font-mono text-[11px] font-medium text-white whitespace-nowrap">{text}</span>
                            </div>
                            <div className="absolute inset-0 flex items-center px-3 overflow-hidden" style={{ clipPath: `inset(0 0 0 ${w}%)` }}>
                              <span className="font-mono text-[11px] font-medium text-foreground whitespace-nowrap">{text}</span>
                            </div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex items-center px-3">
                            <span className="font-mono text-[11px] font-medium text-foreground">{text}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {stats.confidence > 0 && (
            <div className="flex flex-col gap-2 pt-3 border-t border-border/30">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t("abTesting.confidence")}</span>
                <span className={`font-mono font-semibold ${stats.confidence >= 0.95 ? "text-emerald-500" : stats.confidence >= 0.7 ? "text-amber-500" : "text-indigo-400"}`}>
                  {(stats.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-border/40 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${stats.confidence * 100}%`,
                    background: stats.confidence >= 0.95
                      ? "linear-gradient(90deg, #10b981, #34d399)"
                      : stats.confidence >= 0.7
                        ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                        : "linear-gradient(90deg, #6366f1, #818cf8)",
                  }}
                />
              </div>
              {stats.leads_needed_for_95pct > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {t("abTesting.needMore", { count: stats.leads_needed_for_95pct })}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
