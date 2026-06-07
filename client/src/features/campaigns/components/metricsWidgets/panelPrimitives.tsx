// Panel primitives for the campaign Summary tab.
// Ported from the Claude campaigns dashboard design (migration/extracted/layout-bold.jsx
// + components.jsx). Styling routes entirely through design-system.css tokens
// (wine / neumorphic / serif / mono) so the summary panels match the design.
import React from "react";

// ── PanelShell — summary-panel surface. variant: raised (default) | inset | flat
export function PanelShell({
  children,
  className,
  style,
  testId,
  variant = "raised",
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  testId?: string;
  variant?: "raised" | "inset" | "flat";
}) {
  const surface: React.CSSProperties =
    variant === "raised"
      ? { background: "var(--card)" }
      : variant === "inset"
      ? { background: "var(--bg)", boxShadow: "var(--sh-inset-crisp), inset 0 0 0 1px rgba(0,0,0,0.07)" }
      : { background: "transparent", boxShadow: "none" };
  return (
    <div
      className={[variant === "raised" ? "neu-raised" : "", "flex", "flex-col", className].filter(Boolean).join(" ")}
      style={{
        borderRadius: "var(--r-card)",
        padding: 26,
        overflow: "hidden",
        ...surface,
        ...style,
      }}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

// ── SectionHead — eyebrow (mono uppercase) + serif title, optional right action ─
export function SectionHead({
  eyebrow,
  title,
  action,
  marginBottom = 18,
  titleSize = 26,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  action?: React.ReactNode;
  marginBottom?: number;
  /** Serif title size. 26 for in-column panels; 32 for the live rail cards (design spec). */
  titleSize?: number;
}) {
  return (
    <div
      className="row"
      style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom }}
    >
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <div
          className="display"
          style={{ fontSize: titleSize, color: "var(--ink-soft)", marginTop: eyebrow ? 5 : 0, lineHeight: 1.05 }}
        >
          {title}
        </div>
      </div>
      {action}
    </div>
  );
}
