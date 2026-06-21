// mobilePrimitives.tsx — shared wine/paper mobile chrome + formatters for the
// Lead Awaker mobile Billing experience. Ports the reference design
// (mobile-billing.jsx / billing-views.jsx / mobile-shell.jsx) into the CRM,
// wired to the real billing data types. Desktop tree is untouched — these
// components only render when useIsMobile() is true.

import { useState, useEffect, type ReactNode, type ComponentType } from "react";
import { Building2 } from "lucide-react";
import { isOverdue, INVOICE_STATUS_COLORS, CONTRACT_STATUS_COLORS } from "../../types";
import type { InvoiceRow, ContractRow } from "../../types";

// ── Formatters ─────────────────────────────────────────────────────────────

export function num(val: string | number | null | undefined): number {
  if (val == null) return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
}

/** Currency with cents (e.g. €1,250.00). */
export function money(val: string | number | null | undefined, currency = "EUR"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num(val));
}

/** Currency rounded to whole units (e.g. €1,250). */
export function money0(val: string | number | null | undefined, currency = "EUR"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(num(val));
}

export function dateShort(val: string | null | undefined): string {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function dateFull(val: string | null | undefined): string {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function daysFrom(due: string | null | undefined): number | null {
  if (!due) return null;
  const d = new Date(due);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

/** Two-letter initials for an avatar tile. */
export function initials(name: string | null | undefined): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function displayStatus(inv: InvoiceRow): string {
  return isOverdue(inv) ? "Overdue" : (inv.status || "Draft");
}

// ── Avatar tile (initials on wine-tint) ──────────────────────────────────────

export function BAvatar({ name, size = 40 }: { name: string | null | undefined; size?: number }) {
  return (
    <span
      className="la-mono-tile wine"
      style={{ width: size, height: size, fontSize: size * 0.34, borderRadius: "var(--r-button)", flexShrink: 0 }}
    >
      {initials(name)}
    </span>
  );
}

// ── Status pills ──────────────────────────────────────────────────────────────

export function StatusPill({ status, kind }: { status: string; kind: "invoice" | "contract" }) {
  const colors = (kind === "invoice" ? INVOICE_STATUS_COLORS : CONTRACT_STATUS_COLORS)[status]
    ?? INVOICE_STATUS_COLORS.Draft;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
        textTransform: "uppercase", padding: "3px 9px", borderRadius: "var(--r-pill)",
        background: colors.bg, color: colors.text,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: colors.dot }} />
      {status}
    </span>
  );
}

/** Due / paid label for invoices — wine when due today, red when overdue. */
export function DueLabel({ inv, t }: { inv: InvoiceRow; t: (k: string, o?: any) => string }) {
  const status = displayStatus(inv);
  if (inv.status === "Paid") return <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--good)" }}>{t("invoices.card.paid")}</span>;
  if (inv.status === "Draft") return <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute-2)" }}>{t("mobile.notSent")}</span>;
  const d = daysFrom(inv.due_date);
  if (d == null) return <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute)" }}>—</span>;
  if (d < 0)  return <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 700, color: "var(--stage-lost)" }}>{t("invoices.card.dOverdue", { count: Math.abs(d) })}</span>;
  if (d === 0) return <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 700, color: "var(--wine)" }}>{t("mobile.dueToday")}</span>;
  return <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute)" }}>{t("invoices.card.dueIn", { count: d })}</span>;
}

// ── Segmented control (cream .la-seg) ─────────────────────────────────────────

export type SegOption = { key: string; label: string; Ic?: ComponentType<{ size?: number }>; badge?: number };

export function MBSegment({
  options, value, onChange, small,
}: { options: SegOption[]; value: string; onChange: (k: string) => void; small?: boolean }) {
  return (
    <div className="la-seg la-seg--fill">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`la-seg-btn${on ? " on" : ""}`}
            style={{ padding: small ? "8px 4px" : "11px 6px", fontSize: small ? 9.5 : 10.5 }}
          >
            {o.Ic && <o.Ic size={small ? 13 : 15} />}
            {o.label}
            {o.badge != null && o.badge > 0 && (
              <span style={{
                fontFamily: "var(--mono)", fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: "var(--r-pill)",
                background: on ? "var(--wine)" : "var(--mute-2)", color: "var(--paper)",
              }}>{o.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Icon-only view toggle (list / table) ──────────────────────────────────────

export function MBViewToggle({
  value, onChange, opts,
}: { value: string; onChange: (k: string) => void; opts: Array<[string, ComponentType<{ size?: number }>]> }) {
  return (
    <div className="la-seg">
      {opts.map(([k, Ic]) => {
        const on = k === value;
        return (
          <button key={k} onClick={() => onChange(k)} className={`la-seg-btn${on ? " on" : ""}`}
            style={{ width: 36, height: 32, padding: 0 }}><Ic size={15} /></button>
        );
      })}
    </div>
  );
}

// ── Horizontal stat strip ─────────────────────────────────────────────────────

export type StatCard = { label: string; value: string; sub?: string; accent?: string; Ic?: ComponentType<{ size?: number }> };

export function MBStatStrip({ cards }: { cards: StatCard[] }) {
  return (
    <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "2px 16px", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
      {cards.map((s, i) => (
        <div key={i} className="neu-raised" style={{ flex: "0 0 auto", minWidth: 132, padding: "13px 15px", borderRadius: "var(--r-card)", position: "relative", overflow: "hidden" }}>
          {s.accent && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: s.accent }} />}
          <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
            <span className="eyebrow eyebrow-sm" style={{ fontSize: 8.5 }}>{s.label}</span>
            {s.Ic && <span style={{ color: s.accent || "var(--mute-2)", display: "flex" }}><s.Ic size={13} /></span>}
          </div>
          <div className="serif" style={{ fontSize: 25, color: "var(--ink)", lineHeight: 1.05, marginTop: 6 }}>{s.value}</div>
          {s.sub && <div style={{ fontSize: 10.5, color: "var(--mute)", marginTop: 3 }}>{s.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Filter chips (horizontal scroll) ──────────────────────────────────────────

export type Chip = { key: string; label: string; count?: number | null };

export function MBChips({ chips, value, onChange }: { chips: Chip[]; value: string; onChange: (k: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 7, overflowX: "auto", padding: "0 16px", scrollbarWidth: "none" }}>
      {chips.map(({ key, label, count }) => {
        const on = key === value;
        return (
          <button key={key} onClick={() => onChange(key)} style={{
            flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: "var(--r-pill)", border: "none", cursor: "pointer",
            background: on ? "var(--wine)" : "var(--surface)", boxShadow: on ? "none" : "var(--sh-raised-crisp)",
            color: on ? "var(--paper)" : "var(--ink-soft)", fontSize: 12, fontWeight: on ? 700 : 500, whiteSpace: "nowrap",
          }}>
            {label}
            {count != null && (
              <span style={{
                fontFamily: "var(--mono)", fontSize: 8.5, fontWeight: 700, color: on ? "var(--paper)" : "var(--mute-2)",
                background: on ? "rgba(255,255,255,0.18)" : "var(--bg-2)", borderRadius: "var(--r-pill)", padding: "1px 6px",
              }}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────

export function MBSection({ label, accent, count, amount }: { label: string; accent?: string | null; count?: number | null; amount?: string | null }) {
  return (
    <div className="row" style={{ gap: 9, padding: "16px 4px 9px" }}>
      {accent && <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, flexShrink: 0 }} />}
      <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-soft)", fontWeight: 700 }}>{label}</span>
      {count != null && <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", borderRadius: "var(--r-pill)", padding: "1px 7px" }}>{count}</span>}
      <div className="rule" style={{ flex: 1, marginLeft: 2 }} />
      {amount != null && <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute)", fontWeight: 600 }}>{amount}</span>}
    </div>
  );
}

// ── Detail drawer field ─────────────────────────────────────────────────────

export function BField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 0 }}>
      <div className="eyebrow eyebrow-sm">{label}</div>
      <div style={{ fontSize: 13.5, color: "var(--ink)", marginTop: 5 }}>{children}</div>
    </div>
  );
}

// ── Tool button (sheet action footer) ─────────────────────────────────────────

export function BToolBtn({
  Ic, label, primary, onClick,
}: { Ic: ComponentType<{ size?: number }>; label: string; primary?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={primary ? "btn-wine" : "btn-neu"}
      style={{ flex: 1, padding: "13px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: "var(--r-surface)" }}
    >
      <Ic size={15} />{label}
    </button>
  );
}

// ── Client-preview banner (client view) ────────────────────────────────────────

export function ClientPreviewBanner({ name, message }: { name: string; message: string }) {
  return (
    <div className="glass" style={{ margin: "12px 16px 0", borderRadius: "var(--r-surface)", padding: "11px 13px", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 28, height: 28, borderRadius: "var(--r-button)", background: "var(--wine-tint)", color: "var(--wine)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Building2 size={15} />
      </span>
      <span style={{ fontSize: 11.5, color: "var(--mute)", lineHeight: 1.35 }}>
        {message} <b style={{ color: "var(--ink)" }}>{name}</b>.
      </span>
    </div>
  );
}

// ── Bottom sheet (locked transition, ported from mobile-shell.jsx MobSheet) ────

export function MobSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const [render, setRender] = useState(open);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    if (open) {
      setRender(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVis(true)));
    } else {
      setVis(false);
    }
  }, [open]);
  if (!render) return null;
  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
  return (
    <>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0, zIndex: 20,
        background: "rgba(31,26,20,0.32)",
        opacity: vis ? 1 : 0, transition: "opacity 360ms ease",
        pointerEvents: vis ? "auto" : "none",
      }} />
      <div onTransitionEnd={() => { if (!vis) setRender(false); }} style={{
        position: "absolute", left: 0, right: 0, top: 18, bottom: 0, zIndex: 21,
        transform: vis ? "translateY(0)" : "translateY(100%)",
        transition: `transform 360ms ${ease}`,
        borderRadius: "var(--r-panel) var(--r-panel) 0 0", overflow: "hidden",
        boxShadow: "0 -10px 40px rgba(60,45,25,0.20)",
      }}>
        <div onClick={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 26, display: "flex", justifyContent: "center", alignItems: "center", zIndex: 6 }}>
          <span style={{ width: 40, height: 5, borderRadius: "var(--r-pill)", background: "var(--mute-2)", opacity: 0.6 }} />
        </div>
        {children}
      </div>
    </>
  );
}

// ── Sheet header (eyebrow + serif title + close) ────────────────────────────────

export function SheetHead({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) {
  return (
    <div style={{ flexShrink: 0, padding: "20px 22px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div className="eyebrow eyebrow-sm">{eyebrow}</div>
        <div className="serif" style={{ fontSize: 26, color: "var(--ink)", marginTop: 4, lineHeight: 1.1 }}>{title}</div>
      </div>
      <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: "var(--r-pill)", flexShrink: 0, border: "none", cursor: "pointer", background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", color: "var(--mute)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>×</button>
    </div>
  );
}

// ── List card: invoice ─────────────────────────────────────────────────────────

export function MBInvoiceCard({ inv, onClick, t }: { inv: InvoiceRow; onClick: () => void; t: (k: string, o?: any) => string }) {
  const status = displayStatus(inv);
  return (
    <div onClick={onClick} className="neu-raised-crisp" style={{ padding: 15, borderRadius: "var(--r-card)", cursor: "pointer", marginBottom: 10 }}>
      <div className="row" style={{ gap: 12 }}>
        <BAvatar name={inv.account_name} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {inv.account_name || inv.title || t("invoices.card.untitledInvoice")}
          </div>
          <div className="row" style={{ gap: 7, marginTop: 3 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)" }}>{inv.invoice_number || "—"}</span>
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--mute-2)" }} />
            <DueLabel inv={inv} t={t} />
          </div>
        </div>
        <StatusPill status={status} kind="invoice" />
      </div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginTop: 13, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        <span style={{ fontSize: 11, color: "var(--mute)" }}>{inv.status === "Paid" ? t("invoices.card.paid") : t("mobile.amountDue")}</span>
        <span className="serif" style={{ fontSize: 26, color: "var(--ink)", lineHeight: 1 }}>{money(inv.total, inv.currency || "EUR")}</span>
      </div>
    </div>
  );
}

// ── List card: contract ─────────────────────────────────────────────────────────

export function MBContractCard({ ctr, onClick, t }: { ctr: ContractRow; onClick: () => void; t: (k: string, o?: any) => string }) {
  const value = num(ctr.fixed_fee_amount) || num(ctr.monthly_fee) || num(ctr.value_per_booking) || num(ctr.deposit_amount);
  return (
    <div onClick={onClick} className="neu-raised-crisp" style={{ padding: 15, borderRadius: "var(--r-card)", cursor: "pointer", marginBottom: 10 }}>
      <div className="row" style={{ gap: 12 }}>
        <BAvatar name={ctr.account_name} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ctr.title || t("contracts.card.untitledContract")}
          </div>
          <div className="row" style={{ gap: 7, marginTop: 3 }}>
            <span style={{ fontSize: 11.5, color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ctr.account_name || t("contracts.card.noAccount")}
            </span>
          </div>
        </div>
        <StatusPill status={ctr.status || "Draft"} kind="contract" />
      </div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginTop: 13, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute-2)" }}>
          {ctr.start_date ? t("contracts.card.from", { date: dateShort(ctr.start_date) }) : "—"}
        </span>
        {value > 0 && <span className="serif" style={{ fontSize: 22, color: "var(--ink)", lineHeight: 1 }}>{money0(value, ctr.currency || "EUR")}</span>}
      </div>
    </div>
  );
}
