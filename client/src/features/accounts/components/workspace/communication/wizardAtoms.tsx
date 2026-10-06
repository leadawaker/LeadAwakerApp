// Small presentational pieces shared by the onboarding wizard's step renderers.
import type { ReactNode } from "react";
import { Check } from "lucide-react";

export function OptionCard({ selected, onClick, children, badge }: { selected: boolean; onClick: () => void; children: ReactNode; badge?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={selected ? "neu-raised" : "neu-inset-crisp"}
      style={{
        textAlign: "left", width: "100%", padding: "13px 15px", borderRadius: "var(--r-button)",
        cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 11, position: "relative",
        border: selected ? "1px solid var(--wine)" : "1px solid transparent",
        background: selected ? "var(--wine-tint)" : "var(--bg)", transition: "background 120ms",
      }}
    >
      <span style={{
        width: 16, height: 16, marginTop: 1, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: selected ? "var(--wine)" : "transparent", boxShadow: selected ? "none" : "var(--sh-inset-crisp)",
        color: "var(--paper)",
      }}>{selected && <Check size={11} strokeWidth={3} />}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {badge}
    </button>
  );
}

export function Chip({ selected, disabled, onClick, label }: { selected: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !selected}
      style={{
        padding: "8px 14px", borderRadius: "var(--r-pill)", fontSize: 13.5, cursor: disabled && !selected ? "not-allowed" : "pointer",
        border: selected ? "1px solid var(--wine)" : "1px solid transparent",
        background: selected ? "var(--wine-tint)" : "var(--bg)",
        color: selected ? "var(--wine)" : disabled ? "var(--mute-2)" : "var(--ink-soft)",
        boxShadow: selected ? "none" : "var(--sh-inset-crisp)", fontWeight: selected ? 600 : 400,
        opacity: disabled && !selected ? 0.5 : 1, transition: "background 120ms",
      }}
    >{label}</button>
  );
}

export function RecommendedBadge({ label }: { label: string }) {
  return (
    <span style={{
      fontFamily: "var(--mono)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
      color: "var(--wine)", background: "var(--wine-tint)", padding: "3px 8px", borderRadius: "var(--r-pill)", whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

export const inputStyle = {
  width: "100%", padding: "9px 13px", borderRadius: "var(--r-button)", fontSize: 14,
  border: "none", background: "var(--bg)", color: "var(--ink-soft)",
} as const;
