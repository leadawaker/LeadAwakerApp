import { useState, useCallback, type ReactNode, type CSSProperties } from "react";
import { ChevronDown, Eye, EyeOff, Copy, Check, Pencil } from "lucide-react";
import type { IntegrationField as IntegrationFieldData } from "./types";

// ── Panel — titled neumorphic card ────────────────────────────────────────────
export function Panel({
  icon, eyebrow, title, count, action, children, pad = 24, style, bodyStyle,
}: {
  icon?: ReactNode; eyebrow?: ReactNode; title?: ReactNode; count?: ReactNode;
  action?: ReactNode; children?: ReactNode; pad?: number; style?: CSSProperties; bodyStyle?: CSSProperties;
}) {
  return (
    <section className="neu-raised" style={{ borderRadius: "var(--r-card)", overflow: "hidden", display: "flex", flexDirection: "column", ...style }}>
      {(title || action) && (
        <header style={{ display: "flex", alignItems: "center", gap: 12, padding: `${pad - 6}px ${pad}px ${pad - 12}px` }}>
          {icon && <span style={{ color: "var(--wine)", display: "flex" }}>{icon}</span>}
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flex: 1, minWidth: 0 }}>
            {eyebrow && <div className="eyebrow eyebrow-sm" style={{ marginRight: 2 }}>{eyebrow}</div>}
            <h3 className="serif" style={{ margin: 0, fontSize: 23, color: "var(--ink-soft)", lineHeight: 1, letterSpacing: "-0.01em" }}>{title}</h3>
            {count != null && (
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute)", letterSpacing: "0.08em", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", padding: "2px 9px", borderRadius: "var(--r-pill)" }}>{count}</span>
            )}
          </div>
          {action}
        </header>
      )}
      <div style={{ padding: `0 ${pad}px ${pad}px`, flex: 1, minHeight: 0, ...bodyStyle }}>{children}</div>
    </section>
  );
}

// Small mono action button used in panel headers.
export function PanelAction({ icon, children, wine = false, onClick, disabled }: {
  icon?: ReactNode; children?: ReactNode; wine?: boolean; onClick?: () => void; disabled?: boolean;
}) {
  return (
    <button className={`la-btn ${wine ? "la-btn--wine" : "la-btn--soft"}`} onClick={onClick} disabled={disabled}>
      {icon}{children}
    </button>
  );
}

// ── GroupLabel — eyebrow rule ─────────────────────────────────────────────────
export function GroupLabel({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="row" style={{ gap: 8, padding: "2px 0 8px" }}>
      {icon && <span style={{ color: "var(--mute-2)", display: "flex" }}>{icon}</span>}
      <span className="eyebrow eyebrow-sm">{children}</span>
      <div className="rule" style={{ flex: 1 }} />
    </div>
  );
}

// ── FieldRow — label + inset value chip (or edit input) ───────────────────────
export function FieldRow({ label, value, mono, dropdown, muted, editChild }: {
  label: ReactNode; value?: ReactNode; mono?: boolean; dropdown?: boolean; muted?: boolean; editChild?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "7px 0" }}>
      <span style={{ width: 96, flexShrink: 0, fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--mute)" }}>{label}</span>
      {editChild ? (
        <div style={{ flex: 1, minWidth: 0 }}>{editChild}</div>
      ) : (
        <div className="neu-inset-crisp" style={{
          flex: 1, minWidth: 0, padding: "9px 13px", borderRadius: "var(--r-button)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          fontSize: 13, color: muted ? "var(--mute-2)" : "var(--ink-soft)", fontFamily: mono ? "var(--mono)" : "var(--sans)",
        }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value || <span style={{ color: "var(--mute-2)", fontStyle: "italic" }}>—</span>}</span>
          {dropdown && <span style={{ color: "var(--mute-2)", display: "flex" }}><ChevronDown size={12} /></span>}
        </div>
      )}
    </div>
  );
}

// ── Avatar (initials) ─────────────────────────────────────────────────────────
export function Avatar({ init, size = 36, radius = "var(--r-surface)", tone = "bark" }: {
  init: string; size?: number; radius?: string; tone?: "wine" | "bark";
}) {
  const bg = tone === "wine" ? "var(--wine-grad)" : "linear-gradient(145deg, #8a6e4a, #5a4530)";
  return (
    <span style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0, background: bg, boxShadow: "var(--sh-raised-crisp)",
      display: "flex", alignItems: "center", justifyContent: "center", color: "var(--paper)", fontFamily: "var(--mono)",
      fontSize: size * 0.34, letterSpacing: "0.04em", fontWeight: 500,
    }}>{init}</span>
  );
}

// ── Pills ─────────────────────────────────────────────────────────────────────
export function RolePill({ role }: { role: string }) {
  const owner = role === "Owner" || role === "Admin";
  return (
    <span style={{
      fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
      padding: "3px 9px", borderRadius: "var(--r-pill)", color: owner ? "var(--wine)" : "var(--mute)",
      background: owner ? "var(--wine-tint)" : "var(--bg)", boxShadow: owner ? "inset 0 0 0 1px rgba(94,34,48,0.18)" : "var(--sh-inset-crisp)",
    }}>{role}</span>
  );
}

const CONTRACT_TONES: Record<string, { c: string; tint: string }> = {
  active: { c: "var(--good)", tint: "var(--good-tint)" },
  pending: { c: "var(--warn)", tint: "var(--warn-tint)" },
  expired: { c: "var(--mute-2)", tint: "var(--bg)" },
};

export function ContractPill({ status, label }: { status: string; label: string }) {
  const tone = CONTRACT_TONES[status] || CONTRACT_TONES.expired;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700,
      letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 9px", borderRadius: "var(--r-pill)",
      color: tone.c, background: tone.tint, boxShadow: status === "expired" ? "var(--sh-inset-crisp)" : "none",
    }}>
      <span className="dot" style={{ background: tone.c }} />{label}
    </span>
  );
}

export function ConnectedPill({ on = true, connectedLabel, notSetLabel }: { on?: boolean; connectedLabel: string; notSetLabel: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700,
      letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 10px", borderRadius: "var(--r-pill)",
      color: on ? "var(--good)" : "var(--mute-2)", background: on ? "var(--good-tint)" : "var(--bg)", boxShadow: on ? "none" : "var(--sh-inset-crisp)",
    }}>
      <span className="dot" style={{ background: on ? "var(--good)" : "var(--mute-2)" }} />{on ? connectedLabel : notSetLabel}
    </span>
  );
}

const STATUS_TONES: Record<string, { c: string; tint: string; inset: boolean }> = {
  Active: { c: "var(--good)", tint: "var(--good-tint)", inset: false },
  Trial: { c: "var(--warn)", tint: "var(--warn-tint)", inset: false },
  Inactive: { c: "var(--mute)", tint: "var(--bg)", inset: true },
  Suspended: { c: "var(--wine)", tint: "var(--wine-tint)", inset: false },
};

export function AccountStatusPill({ status, label }: { status: string; label?: string }) {
  const tone = STATUS_TONES[status] || STATUS_TONES.Inactive;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700,
      letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 11px", borderRadius: "var(--r-pill)",
      color: tone.c, background: tone.tint, boxShadow: tone.inset ? "var(--sh-inset-crisp)" : "none",
    }}>
      <span className="dot" style={{ background: tone.c }} />{label || status}
    </span>
  );
}

// ── Stat (campaign row number) ────────────────────────────────────────────────
export function Stat({ n, l, accent }: { n: ReactNode; l: string; accent?: boolean }) {
  return (
    <div style={{ textAlign: "right", minWidth: 44 }}>
      <div className="serif" style={{ fontSize: 19, color: accent ? "var(--wine)" : "var(--ink)", lineHeight: 1 }}>{n}</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginTop: 3 }}>{l}</div>
    </div>
  );
}

// ── BrandTile + IntegrationField + ComingSoonChip ─────────────────────────────
export function BrandTile({ init, size = 34, connected = true }: { init: string; size?: number; connected?: boolean }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: "var(--r-button)", flexShrink: 0,
      background: connected ? "var(--wine-grad)" : "var(--bg)",
      boxShadow: connected ? "var(--sh-raised-crisp), inset 0 1px 0 rgba(255,255,255,0.12)" : "var(--sh-inset-crisp)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: connected ? "var(--paper)" : "var(--mute-2)", fontFamily: '"Yeseva One", serif', fontSize: size * 0.46, lineHeight: 1, paddingBottom: 1,
    }}>{init}</span>
  );
}

export function IntegrationField({ f }: { f: IntegrationFieldData }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const display = f.secret && !revealed ? "••••••••••••" : f.value;
  const copy = useCallback(() => {
    if (!f.value) return;
    navigator.clipboard.writeText(f.value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }, [f.value]);
  return (
    <div style={{ minWidth: 0 }}>
      <div className="row" style={{ gap: 6, marginBottom: 5 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)" }}>{f.label}</span>
      </div>
      <div className="neu-inset-crisp" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", borderRadius: "var(--r-button)" }}>
        <span style={{
          flex: 1, minWidth: 0, fontFamily: f.mono ? "var(--mono)" : "var(--sans)", fontSize: 11.5,
          color: f.value ? (f.secret && !revealed ? "var(--mute)" : "var(--ink-soft)") : "var(--mute-2)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: f.secret && !revealed ? "0.1em" : 0,
          fontStyle: f.value ? "normal" : "italic",
        }}>{f.value ? display : "—"}</span>
        {f.secret && f.value && (
          <span onClick={() => setRevealed((r) => !r)} style={{ color: "var(--mute-2)", display: "flex", cursor: "pointer" }}>
            {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
          </span>
        )}
        {f.copy && f.value && (
          <span onClick={copy} style={{ color: copied ? "var(--good)" : "var(--mute-2)", display: "flex", cursor: "pointer" }}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </span>
        )}
      </div>
    </div>
  );
}

export function ComingSoonChip({ init, label, comingSoonLabel }: { init: string; label: string; comingSoonLabel: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }}>
      <BrandTile init={init} size={32} connected={false} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginTop: 2 }}>{comingSoonLabel}</div>
      </div>
    </div>
  );
}

// Soft inline "Edit" button used in panel/card headers.
export function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="la-btn la-btn--inset" onClick={onClick}><Pencil size={12} />{label}</button>
  );
}
