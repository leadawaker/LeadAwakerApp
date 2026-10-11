// Small shared pieces for the two WhatsApp cards. Same look as the other
// integration cards (integrationsAtoms.tsx, atoms.tsx): tokens only.
import type { CSSProperties, ReactNode } from "react";

export const MONO_LABEL: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em",
  textTransform: "uppercase", color: "var(--mute-2)",
};

export const CARD_STYLE: CSSProperties = {
  borderRadius: "var(--r-card)", padding: "22px 24px", background: "var(--bone)",
};

export const EXPLAINER: CSSProperties = { fontSize: 12, color: "var(--mute)", lineHeight: 1.5, margin: 0 };

export type Tone = "good" | "warn" | "bad" | "mute";

const TONES: Record<Tone, { c: string; tint: string; inset: boolean }> = {
  good: { c: "var(--good)", tint: "var(--good-tint)", inset: false },
  warn: { c: "var(--warn)", tint: "var(--warn-tint)", inset: false },
  bad: { c: "var(--wine)", tint: "var(--wine-tint)", inset: false },
  mute: { c: "var(--mute-2)", tint: "var(--bg)", inset: true },
};

/** Status pill with a dot, the same shape as ConnectedPill but in four tones. */
export function TonePill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const s = TONES[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700,
      letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 10px", borderRadius: "var(--r-pill)",
      whiteSpace: "nowrap", flexShrink: 0,
      color: s.c, background: s.tint, boxShadow: s.inset ? "var(--sh-inset-super-crisp)" : "none",
    }}>
      <span className="dot" style={{ background: s.c }} />{children}
    </span>
  );
}

/** One line of feedback under a form or a list: an error, a warning or a confirmation. */
export function Note({ tone, children }: { tone: Tone; children: ReactNode }) {
  // Amber is too faint for a sentence: a warning reads in ink behind an amber dot.
  const color = tone === "mute" ? "var(--mute)" : tone === "warn" ? "var(--ink-soft)" : TONES[tone].c;
  return (
    <p role={tone === "bad" ? "alert" : "status"} style={{ fontSize: 11.5, lineHeight: 1.5, color, margin: 0, overflowWrap: "anywhere" }}>
      {tone === "warn" && <span className="dot" style={{ background: "var(--warn)", display: "inline-block", marginRight: 7, verticalAlign: "middle" }} />}
      {children}
    </p>
  );
}

/** Label over value, for what Meta reports about the number. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...MONO_LABEL, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--ink-soft)", overflowWrap: "anywhere" }}>
        {children || <span style={{ color: "var(--mute-2)", fontStyle: "italic" }}>-</span>}
      </div>
    </div>
  );
}
