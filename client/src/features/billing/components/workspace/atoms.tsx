import { type ReactNode, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { formatCurrency, INVOICE_STATUS_COLORS, CONTRACT_STATUS_COLORS } from "../../types";

// ── Money / date helpers (port of bMoney / bDate / bDateFull / bDaysFrom) ──────
export function fmtMoney(value: string | number | null | undefined, currency = "EUR"): string {
  return formatCurrency(value, currency);
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDateParts(iso: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!iso) return null;
  // Support both "YYYY-MM-DD" and full ISO timestamps.
  const datePart = String(iso).slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

export function fmtDate(iso: string | null | undefined): string {
  const p = parseDateParts(iso);
  if (!p) return "—";
  return `${MON[p.m - 1]} ${p.d}`;
}

export function fmtDateFull(iso: string | null | undefined): string {
  const p = parseDateParts(iso);
  if (!p) return "—";
  return `${MON[p.m - 1]} ${p.d}, ${p.y}`;
}

// Whole days between iso date and today (negative = in the past).
export function daysFrom(iso: string | null | undefined, today: Date = new Date()): number | null {
  const p = parseDateParts(iso);
  if (!p) return null;
  const target = Date.UTC(p.y, p.m - 1, p.d);
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - base) / 86_400_000);
}

// ── Avatar — initials tile (port of BAvatar) ──────────────────────────────────
export function Avatar({ init, size = 34, color }: { init: string; size?: number; color?: string }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28), flexShrink: 0,
      background: color || "var(--wine-grad)", color: "var(--paper)", boxShadow: "var(--sh-raised-crisp)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--mono)", fontSize: size * 0.34, fontWeight: 700, letterSpacing: "0.01em",
    }}>{init}</span>
  );
}

// ── Status pills (port of BStatus / BInvoiceStatus / BContractStatus) ──────────
// Resolves colors from the shared types.ts maps so cards/tables/pills stay in sync.
function StatusPillBase({ bg, text, dot, label, dotVisible = true }: {
  bg: string; text: string; dot: string; label: string; dotVisible?: boolean;
}) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: "var(--r-pill)",
      background: bg, color: text, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em",
      textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {dotVisible && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} />}
      {label}
    </span>
  );
}

export function StatusPill({ kind, status, label }: {
  kind: "invoice" | "contract"; status: string; label?: string;
}) {
  const map = kind === "invoice" ? INVOICE_STATUS_COLORS : CONTRACT_STATUS_COLORS;
  const tone = map[status] || { bg: "var(--surface)", text: "var(--mute)", dot: "var(--mute-2)" };
  return <StatusPillBase bg={tone.bg} text={tone.text} dot={tone.dot} label={label ?? status} />;
}

// ── Expense badges (port of BDedBadge / BPdfBadge) ─────────────────────────────
export function DedBadge({ ded }: { ded: boolean }) {
  const { t } = useTranslation("billing");
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: "var(--r-pill)",
      background: ded ? "var(--good-tint)" : "rgba(148,138,119,0.14)", color: ded ? "var(--good)" : "var(--mute-2)",
      fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {ded && <Check size={10} />}{ded ? t("expenses.status.deductible", "BTW Deductible") : t("expenses.status.notDeductible", "Non-deductible")}
    </span>
  );
}

export function PdfBadge({ label = "PDF" }: { label?: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: "var(--r-pill)",
      background: "var(--wine-tint)", color: "var(--wine)", fontFamily: "var(--mono)", fontSize: 8.5,
      letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
    }}>{label}</span>
  );
}

// ── Category tag (port of BCatTag) ─────────────────────────────────────────────
export function CatTag({ color, label, big }: { color: string; label: string; big?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span style={{ width: big ? 9 : 8, height: big ? 9 : 8, borderRadius: 3, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: big ? 12.5 : 12, color: "var(--mute)" }}>{label}</span>
    </span>
  );
}

// ── Stat card (port of BStat) ──────────────────────────────────────────────────
export function StatCard({ label, value, sub, accent, icon }: {
  label: ReactNode; value: ReactNode; sub?: ReactNode; accent?: string; icon?: ReactNode;
}) {
  return (
    <div className="neu-raised" style={{ flex: "1 1 0", minWidth: 0, padding: "16px 18px", borderRadius: "var(--r-card)", position: "relative", overflow: "hidden" }}>
      {accent && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent }} />}
      <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
        <span className="eyebrow eyebrow-sm">{label}</span>
        {icon && <span style={{ color: accent || "var(--mute-2)", display: "flex" }}>{icon}</span>}
      </div>
      <div className="serif" style={{ fontSize: 32, color: "var(--ink)", lineHeight: 1.05, marginTop: 8, letterSpacing: "-0.01em" }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--mute)", marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// ── Group bar — sticky list section header (port of BGroupBar) ─────────────────
export function GroupBar({ label, count, accent, sticky }: {
  label: ReactNode; count?: number; accent?: string; sticky?: boolean;
}) {
  return (
    <div
      className="row"
      style={{
        gap: 10, padding: "10px 4px 8px",
        ...(sticky ? { position: "sticky", top: 0, zIndex: 5, background: "var(--bg)" } : {}),
      }}
    >
      <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: accent || "var(--ink-soft)", fontWeight: 700 }}>{label}</span>
      {count != null && (
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", borderRadius: "var(--r-pill)", padding: "1px 8px" }}>{count}</span>
      )}
      <div className="rule" style={{ flex: 1, marginLeft: 4 }} />
    </div>
  );
}

// ── Field — eyebrow label + value (port of BField) ─────────────────────────────
export function Field({ label, children, style }: { label: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 0, ...style }}>
      <div className="eyebrow eyebrow-sm">{label}</div>
      <div style={{ fontSize: 13.5, color: "var(--ink)", marginTop: 5 }}>{children}</div>
    </div>
  );
}

// ── Toolbar button (port of BToolBtn) ──────────────────────────────────────────
export function ToolBtn({ icon, label, onClick, primary, disabled, title }: {
  icon?: ReactNode; label?: ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean; title?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title ?? (typeof label === "string" ? label : undefined)}
      className={`la-btn ${primary ? "la-btn--wine" : "la-btn--soft"}`}>
      {icon}{label}
    </button>
  );
}
