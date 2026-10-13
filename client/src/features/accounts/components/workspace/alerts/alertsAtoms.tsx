// Small shared pieces for the Recaps & alerts cards.
import type { ReactNode } from "react";
import { Switch } from "@/components/ui/switch";

export { FieldLabel, ReadOnlyValue, helpStyle, inputStyle, useDraft } from "../voice/voiceAtoms";

export const rowLabelStyle = { fontSize: 13.5, color: "var(--ink)", fontWeight: 600 } as const;
export const errorStyle = { fontSize: 12.5, color: "var(--stage-lost)", margin: "10px 0 0" } as const;

/** A labelled switch that saves on flip. */
export function SwitchRow({ label, help, checked, disabled, onChange }: {
  label: ReactNode; help?: ReactNode; checked: boolean; disabled?: boolean; onChange: (on: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 0" }}>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled}
        aria-label={typeof label === "string" ? label : undefined} />
      <div style={{ minWidth: 0 }}>
        <div style={rowLabelStyle}>{label}</div>
        {help && <div style={{ fontSize: 12.5, color: "var(--mute)", lineHeight: 1.5, marginTop: 2 }}>{help}</div>}
      </div>
    </div>
  );
}

/** Small status badge (opted out, waiting for consent). */
export function Badge({ children, tone = "mute" }: { children: ReactNode; tone?: "mute" | "warn" | "lost" }) {
  const color = tone === "lost" ? "var(--stage-lost)" : tone === "warn" ? "var(--warn)" : "var(--mute)";
  return (
    <span className="neu-inset-super-crisp" style={{
      display: "inline-flex", alignItems: "center", borderRadius: "var(--r-pill)", padding: "2px 9px",
      fontSize: 11, fontWeight: 600, color, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}
