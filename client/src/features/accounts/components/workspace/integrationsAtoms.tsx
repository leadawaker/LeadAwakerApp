// ── Shared helpers ─────────────────────────────────────────────────────────────
export function IntegSection({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div style={{ padding: "22px 24px", ...(first ? {} : { borderTop: "1.5px solid var(--line)" }) }}>
      {children}
    </div>
  );
}

export function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      width: 36, height: 36, borderRadius: "var(--r-button)", flexShrink: 0,
      background: "var(--card)", boxShadow: "var(--sh-raised-crisp)",
      display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-soft)",
    }}>
      {children}
    </span>
  );
}

export function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="row" style={{ gap: 12, marginBottom: 16 }}>
      {children}
    </div>
  );
}

// ── Flat credential row (booking page / display-only values) ───────────────────
export function FlatRow({ label, value, extra, children }: { label: string; value?: string; extra?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="row" style={{ gap: 12, padding: "6px 0" }}>
      <div style={{ width: 90, flexShrink: 0, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)" }}>{label}</div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value || children || <span style={{ color: "var(--mute-2)", fontStyle: "italic" }}>—</span>}
      </div>
      {extra}
    </div>
  );
}

// ── Generic integration field input ─────────────────────────────────────────────
export function EditFieldInput({ value, onChange, secret }: { value: string; onChange: (v: string) => void; secret?: boolean }) {
  return (
    <input
      className="neu-input"
      style={{ fontSize: 11.5, padding: "8px 11px", width: "100%", fontFamily: "var(--mono)" }}
      type={secret ? "password" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// ── Messaging state pill (SMS / WhatsApp) ──────────────────────────────────────
import { useTranslation } from "react-i18next";

export function StatePill({ label, state }: { label: string; state: string }) {
  const { t } = useTranslation("accounts");
  const styles: Record<string, { bg: string; fg: string; key: string }> = {
    ready:    { bg: "color-mix(in srgb, var(--good) 14%, transparent)", fg: "var(--good)", key: "messaging.state.ready" },
    approved: { bg: "color-mix(in srgb, var(--good) 14%, transparent)", fg: "var(--good)", key: "messaging.state.ready" },
    pending:  { bg: "var(--warn-tint)", fg: "var(--stage-booked)", key: "messaging.state.pending" },
    rejected: { bg: "color-mix(in srgb, var(--wine) 14%, transparent)", fg: "var(--wine)", key: "messaging.state.rejected" },
    none:     { bg: "color-mix(in srgb, var(--mute) 12%, transparent)", fg: "var(--mute)", key: "messaging.state.none" },
  };
  const c = styles[state] || styles.none;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)" }}>{label}</span>
      <span style={{ background: c.bg, color: c.fg, borderRadius: "var(--r-pill)", padding: "2px 9px", fontSize: 10.5, fontWeight: 700 }}>{t(c.key)}</span>
    </span>
  );
}
