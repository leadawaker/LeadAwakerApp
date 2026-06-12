import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FlaskConical } from "lucide-react";
import type { Campaign } from "@/types/models";
import { PanelShell, SectionHead } from "./panelPrimitives";

// ── ABTestCard ────────────────────────────────────────────────────────────────

export function ABTestCard({ campaign, mockStats }: { campaign: Campaign; mockStats?: any }) {
  const { t } = useTranslation("campaigns");
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredMetricKey, setHoveredMetricKey] = useState<string | null>(null);

  useEffect(() => {
    if (mockStats) {
      setStats(mockStats);
      setLoading(false);
      return;
    }
    if (!campaign.id) return;
    setLoading(true);
    fetch(`/api/campaigns/${campaign.id}/ab-stats`, { credentials: "include" })
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [campaign.id, mockStats]);

  const metrics = [
    { key: "response", label: t("abTesting.response"), field: "response_rate", pct: true },
    { key: "qual", label: t("abTesting.qualification"), field: "qualification_rate", pct: true },
    { key: "booking", label: t("abTesting.booking"), field: "booking_rate", pct: true },
    { key: "optout", label: t("abTesting.optOut"), field: "optout_rate", pct: true, invert: true },
    { key: "avgMsgs", label: t("abTesting.avgMessages"), field: "avg_messages", pct: false, invert: true },
    { key: "avgTime", label: t("abTesting.avgResponseTime"), field: "avg_response_time_min", pct: false, suffix: "m", invert: true },
  ];

  if (loading) {
    return (
      <PanelShell variant="flat" testId="campaign-detail-view-ab" style={{ overflowY: "auto", minHeight: 0, maxHeight: 680 }}>
        <div className="animate-pulse text-muted-foreground text-xs">{t("summary.generating")}</div>
      </PanelShell>
    );
  }

  const hasData = stats?.variants && (stats.variants.A || stats.variants.B);
  const colorA = "var(--wine)";
  const colorB = "#C48A2F";

  const renderVerticalBars = () => {
    return (
      <div className="flex w-full gap-3 items-flex-end" style={{ height: 120 }}>
        {metrics.map(({ key, label, field, pct, invert, suffix }) => {
          const a = stats.variants.A?.[field] ?? 0;
          const b = stats.variants.B?.[field] ?? 0;
          const max = Math.max(a, b) || 1;
          const fmt = (v: number) => pct ? `${(v * 100).toFixed(0)}%` : `${v.toFixed(1)}${suffix ?? ""}`;
          const better = invert ? (a < b && a > 0 ? "A" : b < a && b > 0 ? "B" : null) : (a > b ? "A" : b > a ? "B" : null);
          const isHovered = hoveredMetricKey === key;

          return (
            <div
              key={key}
              className="flex flex-col items-center gap-2 flex-1 transition-opacity duration-200 min-w-0"
              style={{
                opacity: hoveredMetricKey && !isHovered ? 0.25 : 1,
              }}
              onMouseEnter={() => setHoveredMetricKey(key)}
              onMouseLeave={() => setHoveredMetricKey(null)}
            >
              <div className="text-center min-w-0 w-full mb-1">
                <div className="text-[12px] text-muted-foreground uppercase tracking-wider truncate font-medium">
                  {label} {better && <span style={{ color: "var(--ink)" }}>{better}</span>}
                </div>
              </div>
              <div className="flex items-flex-end gap-1 justify-center flex-1 w-full" style={{ height: 80 }}>
                {(["A", "B"] as const).map((v) => {
                  const val = v === "A" ? a : b;
                  const percent = pct ? val * 100 : (max > 0 ? (val / max) * 100 : 0);
                  const color = v === "A" ? colorA : colorB;

                  return (
                    <div key={v} className="flex flex-col items-center justify-end gap-1 flex-1" style={{ minWidth: 0 }}>
                      <span className="text-[8px] font-mono font-semibold" style={{ color: "var(--ink)" }}>
                        {fmt(val)}
                      </span>
                      <div
                        className="transition-all duration-400 w-full flex flex-col items-center"
                        style={{
                          height: 80,
                          position: "relative",
                        }}
                      >
                        {/* Rail behind the fill bar */}
                        <div
                          className="absolute bottom-0 w-full flex flex-col items-center"
                          style={{
                            height: 80,
                            maxWidth: 28,
                            margin: "0 auto",
                            justifyContent: "flex-end",
                          }}
                        >
                          <div
                            style={{
                              width: "100%",
                              height: 80,
                              borderRadius: "var(--r-pill) var(--r-pill) 0 0",
                              position: "relative",
                              background: "var(--bg)",
                              boxShadow: "var(--sh-inset-crisp)",
                            }}
                          />
                        </div>
                        {/* Fill bar on top */}
                        <div
                          className="absolute bottom-0 transition-all duration-400"
                          style={{
                            width: "100%",
                            maxWidth: 28,
                            height: Math.max(percent * 0.6, 2),
                            background: color,
                            borderRadius: "var(--r-pill) var(--r-pill) 0 0",
                            boxShadow: isHovered ? `inset 0 0 0 1.5px ${color}55` : undefined,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Confidence bar as 7th column */}
        {stats.confidence > 0 && (
          <div
            className="flex flex-col items-center gap-2 flex-1 transition-opacity duration-200 min-w-0"
            style={{
              opacity: hoveredMetricKey && hoveredMetricKey !== "confidence" ? 0.25 : 1,
            }}
            onMouseEnter={() => setHoveredMetricKey("confidence")}
            onMouseLeave={() => setHoveredMetricKey(null)}
          >
            <div className="text-center min-w-0 w-full mb-1">
              <div className="text-[12px] text-muted-foreground uppercase tracking-wider truncate font-medium">
                {t("abTesting.confidence")}
              </div>
            </div>
            <div className="flex items-flex-end gap-1 justify-center flex-1 w-full" style={{ height: 80 }}>
              <div className="flex flex-col items-center justify-end gap-1 flex-1" style={{ minWidth: 0 }}>
                <span className="text-[8px] font-mono font-semibold" style={{ color: "var(--ink)" }}>
                  {(stats.confidence * 100).toFixed(0)}%
                </span>
                <div
                  className="transition-all duration-400 w-full flex flex-col items-center"
                  style={{
                    height: 80,
                    position: "relative",
                  }}
                >
                  {/* Rail behind fill */}
                  <div
                    className="absolute bottom-0 w-full flex flex-col items-center"
                    style={{
                      height: 80,
                      maxWidth: 28,
                      margin: "0 auto",
                      justifyContent: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: 80,
                        borderRadius: "var(--r-pill) var(--r-pill) 0 0",
                        position: "relative",
                        background: "var(--bg)",
                        boxShadow: "var(--sh-inset-crisp)",
                      }}
                    />
                  </div>
                  {/* Fill bar on top */}
                  <div
                    className="absolute bottom-0 transition-all duration-400"
                    style={{
                      width: "100%",
                      maxWidth: 28,
                      height: Math.max(stats.confidence * 80, 2),
                      background: "#fcfbfb",
                      borderRadius: "var(--r-pill) var(--r-pill) 0 0",
                      boxShadow: hoveredMetricKey === "confidence" ? `inset 0 0 0 1.5px #DADADA` : undefined,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderHorizontalBars = () => {
    return (
      <div className="flex flex-col gap-4">
        {metrics.map(({ key, label, field, pct, invert, suffix }) => {
          const a = stats.variants.A?.[field] ?? 0;
          const b = stats.variants.B?.[field] ?? 0;
          const max = Math.max(a, b) || 1;
          const fmt = (v: number) => pct ? `${(v * 100).toFixed(0)}%` : `${v.toFixed(1)}${suffix ?? ""}`;
          const better = invert ? (a < b && a > 0 ? "A" : b < a && b > 0 ? "B" : null) : (a > b ? "A" : b > a ? "B" : null);
          const isHovered = hoveredMetricKey === key;

          return (
            <div
              key={key}
              className="flex flex-col gap-2 transition-opacity duration-200"
              style={{
                opacity: hoveredMetricKey && !isHovered ? 0.25 : 1,
              }}
              onMouseEnter={() => setHoveredMetricKey(key)}
              onMouseLeave={() => setHoveredMetricKey(null)}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground uppercase tracking-wider font-medium">
                  {label} {better && <span style={{ color: "var(--ink)" }}>{better}</span>}
                </span>
              </div>
              {(["A", "B"] as const).map((v) => {
                const val = v === "A" ? a : b;
                const percent = pct ? val * 100 : (max > 0 ? (val / max) * 100 : 0);
                const color = v === "A" ? colorA : colorB;

                return (
                  <div key={v} className="flex items-center gap-2">
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span className="text-[10px] font-mono font-semibold" style={{ width: 12, color: "var(--mute)" }}>
                      {v}
                    </span>
                    <div
                      className="flex-1 h-2 transition-all duration-400 relative"
                      style={{
                        background: "var(--bg)",
                        boxShadow: "var(--sh-inset-crisp)",
                        borderRadius: "var(--r-pill)",
                        overflow: "hidden",
                        boxSizing: "border-box",
                      }}
                    >
                      <div
                        className="h-full transition-all duration-400"
                        style={{
                          width: `${percent}%`,
                          background: color,
                          borderRadius: "var(--r-pill)",
                          minWidth: percent > 0 ? "8px" : "0",
                          boxShadow: isHovered ? `inset 0 0 0 1.5px ${color}55` : undefined,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono font-semibold" style={{ width: 40, textAlign: "right", color: "var(--ink)" }}>
                      {fmt(val)}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="surface-panel surface-panel--inset" style={{
      padding: "20px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      height: "100%",
      overflowY: "auto",
    }}>
      {/* Title always visible */}
      <div style={{ marginBottom: 4 }}>
        <SectionHead title={t("abTesting.title")} titleSize={32} marginBottom={0} />
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground py-8">
          <FlaskConical className="w-8 h-8 opacity-20" />
          <span className="text-xs">{t("abTesting.noTest")}</span>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--mono)", letterSpacing: "0.1em" }}>
              {stats?.split_ratio != null ? `${100 - stats.split_ratio}/${stats.split_ratio}` : "50/50"} {t("common.split")}
            </span>
            <div className="flex items-center gap-4">
              {(["A", "B"] as const).map((v) => {
                const color = v === "A" ? colorA : colorB;
                const count = v === "A" ? (stats.variants.A?.leads ?? stats.variants.A?.lead_count) : (stats.variants.B?.leads ?? stats.variants.B?.lead_count);
                return (
                  <div key={v} className="flex items-center gap-2">
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span className="text-[10px] font-medium" style={{ color: "var(--ink)", fontFamily: "var(--mono)" }}>
                      {v} {count ? `— ${count}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Metrics bars */}
          <div className="ab-layout" style={{ flex: 1, minHeight: 0 }}>
            <div className="ab-bars-vertical">{renderVerticalBars()}</div>
            <div className="ab-bars-horizontal">{renderHorizontalBars()}</div>
          </div>
        </>
      )}
    </div>
  );
}
