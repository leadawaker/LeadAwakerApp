import { type ReactNode, type CSSProperties } from "react";
import { ChevronRight, X, Check } from "lucide-react";

// Form primitives ported from the prototype billing-forms.jsx (F*).
// Styled with the wine/paper neumorphic tokens; quoted CSS-var inline styles.

export function FLabel({ children, req, hint }: { children: ReactNode; req?: boolean; hint?: ReactNode }) {
  return (
    <div className="row" style={{ gap: 7, marginBottom: 7, flexWrap: "wrap" }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--mute)", fontWeight: 700, whiteSpace: "nowrap" }}>
        {children}{req && <span style={{ color: "var(--stage-lost)" }}> *</span>}
      </span>
      {hint && <span style={{ fontSize: 11, color: "var(--mute-2)", textTransform: "none", letterSpacing: 0, fontWeight: 400, whiteSpace: "nowrap" }}>{hint}</span>}
    </div>
  );
}

export const fInputStyle: CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: "var(--r-surface)", border: "none",
  background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", color: "var(--ink)",
  fontFamily: "var(--sans)", fontSize: 13.5, outline: "none",
};

export function FInput({ value, onChange, placeholder, mono, type = "text", right, disabled }: {
  value: string | number; onChange?: (v: string) => void; placeholder?: string; mono?: boolean;
  type?: string; right?: boolean; disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      style={{ ...fInputStyle, fontFamily: mono ? "var(--mono)" : "var(--sans)", textAlign: right ? "right" : "left" }}
    />
  );
}

type Opt = { value: string; label: string } | string;
function optValue(o: Opt): string { return typeof o === "string" ? o : o.value; }
function optLabel(o: Opt): string { return typeof o === "string" ? o : o.label; }

export function FSelect({ value, onChange, options, placeholder }: {
  value: string; onChange?: (v: string) => void; options: Opt[]; placeholder?: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <select value={value} onChange={(e) => onChange?.(e.target.value)}
        style={{ ...fInputStyle, appearance: "none", cursor: "pointer", paddingRight: 34, color: value ? "var(--ink)" : "var(--mute-2)" }}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={optValue(o)} value={optValue(o)}>{optLabel(o)}</option>)}
      </select>
      <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%) rotate(90deg)", color: "var(--mute-2)", pointerEvents: "none", display: "flex" }}>
        <ChevronRight size={13} />
      </span>
    </div>
  );
}

export function FTextarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange?: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea value={value} placeholder={placeholder} rows={rows} onChange={(e) => onChange?.(e.target.value)}
      style={{ ...fInputStyle, resize: "vertical", lineHeight: 1.5, minHeight: rows * 22 }} />
  );
}

// Pill segmented control (port of forms FSeg — distinct from atoms BSeg/.la-seg).
export function FSeg({ options, value, onChange, size = "md" }: {
  options: Opt[]; value: string; onChange: (v: string) => void; size?: "md" | "sm";
}) {
  return (
    <div className="row" style={{ gap: 7, flexWrap: "wrap" }}>
      {options.map((o) => {
        const k = optValue(o);
        const on = k === value;
        return (
          <button key={k} type="button" onClick={() => onChange(k)} style={{
            padding: size === "sm" ? "6px 12px" : "8px 15px", borderRadius: "var(--r-pill)", border: "none", cursor: "pointer",
            background: on ? "var(--wine-tint)" : "var(--surface)", boxShadow: on ? "inset 0 0 0 1.5px var(--wine)" : "var(--sh-raised-crisp)",
            color: on ? "var(--wine)" : "var(--mute)", fontSize: 12.5, fontWeight: on ? 700 : 500, transition: "all 120ms",
          }}>{optLabel(o)}</button>
        );
      })}
    </div>
  );
}

// Big card choices (deal type / payment account).
export function FCardChoice({ options, value, onChange, cols = 2 }: {
  options: { value: string; label: string; sub?: string }[]; value: string; onChange: (v: string) => void; cols?: number;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} style={{
            textAlign: "left", padding: "13px 15px", borderRadius: "var(--r-surface)", border: "none", cursor: "pointer",
            background: on ? "var(--wine-tint)" : "var(--surface)", boxShadow: on ? "inset 0 0 0 1.5px var(--wine)" : "var(--sh-raised-crisp)",
            transition: "all 120ms",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: on ? "var(--wine)" : "var(--ink)" }}>{o.label}</div>
            {o.sub && <div style={{ fontSize: 11, color: "var(--mute)", marginTop: 3, lineHeight: 1.35 }}>{o.sub}</div>}
          </button>
        );
      })}
    </div>
  );
}

export function FToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} style={{
      width: 46, height: 26, borderRadius: "var(--r-pill)", border: "none", cursor: "pointer", flexShrink: 0, position: "relative",
      background: on ? "var(--good)" : "var(--bg)", boxShadow: on ? "none" : "var(--sh-inset-crisp)", transition: "background 160ms",
    }}>
      <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", transition: "left 160ms" }} />
    </button>
  );
}

export function FSection({ children }: { children: ReactNode }) {
  return <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--mute-2)", fontWeight: 700, margin: "8px 0 14px" }}>{children}</div>;
}

export function FRow({ children, gap = 16 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: "flex", gap, flexWrap: "wrap" }}>{children}</div>;
}

export function FCol({ children, flex = 1, w }: { children: ReactNode; flex?: number | string; w?: number }) {
  return <div style={{ flex: w ? `0 0 ${w}px` : `1 1 ${flex === 1 ? "0" : flex}`, minWidth: 0 }}>{children}</div>;
}

// Form pane chrome (header with X + footer with Cancel/Submit).
export function FormHead({ title, subtitle, onClose }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void }) {
  return (
    <div style={{ flexShrink: 0, padding: "20px 28px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="serif" style={{ fontSize: 28, color: "var(--ink)", lineHeight: 1.1 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12.5, color: "var(--mute)", marginTop: 4 }}>{subtitle}</div>}
      </div>
      <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: "var(--r-pill)", flexShrink: 0, border: "none", cursor: "pointer", background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", color: "var(--mute)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <X size={16} />
      </button>
    </div>
  );
}

export function FormFoot({ onCancel, submitLabel, cancelLabel, onSubmit, note, disabled }: {
  onCancel: () => void; submitLabel: ReactNode; cancelLabel: ReactNode; onSubmit: () => void; note?: ReactNode; disabled?: boolean;
}) {
  return (
    <div style={{ flexShrink: 0, padding: "14px 28px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 14, background: "var(--bg)" }}>
      {note && <span style={{ fontSize: 11.5, color: "var(--mute-2)" }}>{note}</span>}
      <div style={{ flex: 1 }} />
      <button onClick={onCancel} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--mute)", fontSize: 13, fontWeight: 600, padding: "10px 16px" }}>{cancelLabel}</button>
      <button onClick={onSubmit} disabled={disabled} style={{
        display: "flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: "var(--r-surface)", border: "none", cursor: disabled ? "default" : "pointer",
        background: "var(--wine-grad)", boxShadow: "var(--sh-raised-crisp), inset 0 1px 0 rgba(255,255,255,0.12)", opacity: disabled ? 0.6 : 1,
        color: "var(--paper)", fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
      }}>
        <Check size={14} />{submitLabel}
      </button>
    </div>
  );
}
