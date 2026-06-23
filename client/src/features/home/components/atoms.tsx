import * as React from "react";
import { HomeIcon } from "../icons";
import type { DeltaDir } from "../data";

/** Mono eyebrow label (Geist Mono, uppercase, tracked). */
export function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span
      style={{
        fontFamily: "var(--mono)",
        fontSize: 10,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "var(--mute-2)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** Section header — serif title + optional eyebrow + optional right-aligned action. */
export function SectionHead({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 16 }}>
      <div>
        {eyebrow && <div style={{ marginBottom: 4 }}><Eyebrow>{eyebrow}</Eyebrow></div>}
        <div style={{ fontFamily: "var(--serif)", fontSize: 24, color: "var(--ink-soft)", lineHeight: 1.1 }}>{title}</div>
      </div>
      {action}
    </div>
  );
}

/**
 * Section label — serif title + optional count pill + optional right action.
 * Matches the mockup's `SectionLabel` (Playfair 21px, wine-tint count chip).
 */
export function SectionLabel({
  text,
  count,
  right,
  style,
}: {
  text: React.ReactNode;
  count?: number;
  right?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="row" style={{ justifyContent: "space-between", marginBottom: 16, ...style }}>
      <span className="row" style={{ gap: 10, alignItems: "center" }}>
        <span style={{ fontFamily: "var(--serif)", fontSize: 21, lineHeight: 1, color: "var(--ink)", letterSpacing: "-0.01em" }}>
          {text}
        </span>
        {count != null && (
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--wine)",
              background: "var(--wine-tint)",
              borderRadius: "var(--r-pill)",
              padding: "2px 9px",
            }}
          >
            {count}
          </span>
        )}
      </span>
      {right}
    </div>
  );
}

/** Trend delta pill — arrow + value, green when an improvement. */
export function Delta({ text, dir }: { text: string; dir: DeltaDir }) {
  const good = dir === "up" || dir === "good-down";
  const color = good ? "var(--good)" : "var(--stage-lost)";
  const arrow = dir === "up" ? "trendUp" : "trendDn";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        color,
        fontFamily: "var(--mono)",
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      <HomeIcon name={arrow} size={12} sw={2} />
      {text}
    </span>
  );
}

type StatusTone = "live" | "preview";

/** Small status tag for a service: Live (wine) or Preview (muted). */
export function StatusTag({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  const live = tone === "live";
  return (
    <span
      style={{
        fontFamily: "var(--mono)",
        fontSize: 8.5,
        fontWeight: 700,
        letterSpacing: "0.13em",
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: "var(--r-pill)",
        whiteSpace: "nowrap",
        color: live ? "var(--paper)" : "var(--mute)",
        background: live ? "var(--wine)" : "var(--surface)",
        boxShadow: live ? "var(--sh-raised-crisp)" : "var(--sh-inset-crisp)",
      }}
    >
      {children}
    </span>
  );
}

/** Service tag chip (mono, inset well) tinted to the service accent color. */
export function ServiceTag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--mono)",
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.13em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        padding: "3px 9px",
        borderRadius: "var(--r-flush)",
        background: "var(--surface)",
        boxShadow: "var(--sh-inset-crisp)",
        color,
      }}
    >
      {children}
    </span>
  );
}
