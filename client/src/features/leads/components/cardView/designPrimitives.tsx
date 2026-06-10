// Design-system primitives for the Leads detail panel.
// Translated from the Claude design (migration/extracted/leads-components.jsx)
// into TSX, wired to the app's real pipeline/tier data. Styling routes entirely
// through design-system.css tokens (wine / neumorphic / serif / mono).
import React from "react";
import { PIPELINE_HEX } from "@/lib/avatarUtils";

export const HEAD_H = 52; // shared header height → keeps every panel divider on one line

// ── Detail pipeline stages — mirrors the design's 8-stage journey ──────────────
// (New → Contacted → Responded → Multi → Qualified → Booked → Lost → DND)
type DetailStage = { key: string; label: string; color: string };
export const DETAIL_STAGES: DetailStage[] = [
  { key: "New",                label: "New",           color: "var(--stage-new)" },
  { key: "Contacted",          label: "Contacted",     color: "var(--stage-contacted)" },
  { key: "Responded",          label: "Responded",     color: "var(--stage-responded)" },
  { key: "Multiple Responses", label: "Multi-Response",color: "var(--stage-multi)" },
  { key: "Qualified",          label: "Qualified",     color: "var(--stage-qualified)" },
  { key: "Booked",             label: "Booked",        color: "var(--stage-booked)" },
  { key: "Lost",               label: "Lost",          color: "var(--stage-lost)" },
  { key: "DND",                label: "DND",           color: "var(--stage-dnd)" },
];

// Map any app status to an index into DETAIL_STAGES.
export function statusToStageIdx(status: string): number {
  if (!status) return 0;
  const i = DETAIL_STAGES.findIndex((s) => s.key === status);
  return i >= 0 ? i : 0;
}

// Resolve a stage's accent colour from the app's canonical hex map, falling back
// to the design token when the status isn't in PIPELINE_HEX.
export function stageHex(status: string): string {
  return PIPELINE_HEX[status] || "var(--mute)";
}

// ── Reusable rounded card with a fixed-height header (divider aligns) ───────────
// variant: 'raised' (default) | 'inset' | 'flat'
export function Card({
  headLeft,
  headRight,
  children,
  style,
  bodyStyle,
  variant = "raised",
}: {
  headLeft?: React.ReactNode;
  headRight?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
  variant?: "raised" | "inset" | "flat";
}) {
  const wrapClass = variant === "raised" ? "neu-raised" : "";
  const wrapBg: React.CSSProperties =
    variant === "raised"
      ? { background: "var(--card)" }
      : variant === "inset"
      ? { background: "var(--bg)", boxShadow: "var(--sh-inset-crisp), inset 0 0 0 1px rgba(0,0,0,0.07)" }
      : { background: "transparent", boxShadow: "none" };
  const headBorder = variant === "flat" ? "1px solid var(--line-strong)" : "1px solid var(--line)";
  const radius = variant === "flat" ? 0 : "var(--r-card)";
  return (
    <div
      className={wrapClass}
      style={{ borderRadius: radius, overflow: "hidden", display: "flex", flexDirection: "column", ...wrapBg, ...style }}
    >
      <div
        style={{
          height: HEAD_H,
          flexShrink: 0,
          padding: "0 16px",
          borderBottom: headBorder,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>{headLeft}</div>
        {headRight}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", ...bodyStyle }}>{children}</div>
    </div>
  );
}

export function CardLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--mono)",
        fontSize: 9.5,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: color || "var(--mute)",
      }}
    >
      {children}
    </span>
  );
}

// ── Temperature / tier badge ───────────────────────────────────────────────────
const TIER_BADGE: Record<string, { bg: string; fg: string; br: string }> = {
  Hot:      { bg: "rgba(162,75,63,0.10)",  fg: "#A24B3F", br: "rgba(162,75,63,0.22)" },
  Awake:    { bg: "rgba(47,148,97,0.10)",  fg: "#2F9461", br: "rgba(47,148,97,0.22)" },
  Lukewarm: { bg: "rgba(185,130,31,0.10)", fg: "#B9821F", br: "rgba(185,130,31,0.20)" },
  Cold:     { bg: "rgba(84,123,176,0.10)", fg: "#547BB0", br: "rgba(84,123,176,0.22)" },
  Sleeping: { bg: "rgba(110,95,65,0.08)",  fg: "var(--mute)", br: "var(--line-strong)" },
  Lost:     { bg: "rgba(110,95,65,0.08)",  fg: "var(--mute-2)", br: "var(--line-strong)" },
};

export function TempBadge({ temp }: { temp?: string | null }) {
  if (!temp) return null;
  const c = TIER_BADGE[temp] || TIER_BADGE.Sleeping;
  return (
    <span
      style={{
        fontFamily: "var(--mono)",
        fontSize: 9,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        padding: "3px 9px",
        borderRadius: "var(--r-pill)",
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.br}`,
        whiteSpace: "nowrap",
      }}
    >
      {temp}
    </span>
  );
}

// ── Pipeline bar — segmented journey bar with stage labels ──────────────────────
export function DetailPipelineBar({ status, skipBooked = false }: { status: string; skipBooked?: boolean }) {
  // Option A: Hide Lost/DND when not in use; show only that stage when applied
  const isLostOrDND = status === "Lost" || status === "DND";
  const stages = isLostOrDND
    ? DETAIL_STAGES.filter((s) => s.key === status)
    : DETAIL_STAGES.filter((s) => s.key !== "Lost" && s.key !== "DND");
  const stageIdx = isLostOrDND ? 0 : statusToStageIdx(status);
  return (
    <div>
      {/* Bars — bottom-aligned so current stage grows taller upward */}
      <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 18 }}>
        {stages.map((s, i) => {
          const reached = i <= stageIdx;
          const current = i === stageIdx;
          return (
            <div
              key={s.key}
              style={{
                flex: 1,
                borderRadius: "var(--r-pill)",
                height: current ? 16 : reached ? 9 : 5,
                background: reached ? s.color : "var(--line)",
                boxShadow: current
                  ? `0 3px 10px color-mix(in srgb, ${s.color} 35%, transparent)`
                  : reached
                  ? "inset 0 1px 0 rgba(255,255,255,0.28)"
                  : "none",
                transition: "height 280ms, background 280ms",
              }}
            />
          );
        })}
      </div>
      {/* Stage labels — same flex + gap layout so they align under their bars */}
      <div style={{ display: "flex", gap: 4, marginTop: 7 }}>
        {stages.map((s, i) => {
          const current = i === stageIdx;
          const reached = i < stageIdx;
          return (
            <div key={s.key} style={{ flex: 1, overflow: "hidden" }}>
              <span
                style={{
                  display: "block",
                  textAlign: "center",
                  fontFamily: "var(--mono)",
                  fontSize: current ? 8.5 : 7.5,
                  fontWeight: current ? 700 : 400,
                  color: current ? s.color : reached ? "var(--mute)" : "var(--mute-2)",
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Score accent colour shared by the score bar / sparkline (matches the design).
export function scoreColor(score: number): string {
  return score >= 55 ? "var(--good)" : score >= 40 ? "var(--warn)" : "var(--stage-contacted)";
}
