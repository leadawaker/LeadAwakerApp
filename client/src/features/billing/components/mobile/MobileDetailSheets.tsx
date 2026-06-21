// MobileDetailSheets.tsx — bottom-sheet detail bodies for the mobile Billing
// experience (Invoice / Expense / Contract). Ports billing-views.jsx detail
// drawers into the CRM, wired to real data + handler props. Net-new, mobile-only.

import { useTranslation } from "react-i18next";
import {
  Download, Send, CheckCircle, Pencil, Trash2, FileText, Check, Info,
} from "lucide-react";
import { parseLineItems } from "../../types";
import type { InvoiceRow, ContractRow, ExpenseRow } from "../../types";
import {
  money, money0, dateFull, num, BAvatar, StatusPill, DueLabel, BField, BToolBtn, displayStatus,
} from "./mobilePrimitives";

// ── Invoice ─────────────────────────────────────────────────────────────────

export function MobileInvoiceDetail({
  inv, isAgencyUser, onMarkSent, onMarkPaid, onEdit, onDelete, onClose,
}: {
  inv: InvoiceRow;
  isAgencyUser: boolean;
  onMarkSent: (id: number) => Promise<any>;
  onMarkPaid: (id: number) => Promise<any>;
  onEdit: () => void;
  onDelete: (id: number) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation("billing");
  const currency = inv.currency || "EUR";
  const status = displayStatus(inv);
  const items = parseLineItems(inv.line_items);
  const sub = num(inv.subtotal) || items.reduce((a, it) => a + num(it.amount), 0);
  const taxPct = num(inv.tax_percent);
  const tax = num(inv.tax_amount) || Math.round(sub * (taxPct / 100) * 100) / 100;
  const total = num(inv.total) || sub + tax;

  return (
    <>
      <SheetHeader eyebrow={inv.invoice_number || t("invoices.detail.invoice")} title={money(total, currency)} onClose={onClose} />
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px 28px" }}>
        <div className="row" style={{ gap: 10, marginBottom: 20 }}>
          <StatusPill status={status} kind="invoice" />
          <DueLabel inv={inv} t={t} />
        </div>

        <div className="neu-inset" style={{ borderRadius: "var(--r-surface)", padding: 16, display: "flex", alignItems: "center", gap: 13, marginBottom: 18 }}>
          <BAvatar name={inv.account_name} size={40} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{inv.account_name || t("invoices.card.noAccount")}</div>
            {inv.title && <div style={{ fontSize: 12, color: "var(--mute)", marginTop: 2 }}>{inv.title}</div>}
          </div>
        </div>

        <div className="row" style={{ gap: 20, marginBottom: 22 }}>
          <BField label={t("invoices.detail.issued")}>{dateFull(inv.issued_date)}</BField>
          <BField label={t("invoices.detail.dueDate")}>{dateFull(inv.due_date)}</BField>
        </div>

        <div className="eyebrow eyebrow-sm" style={{ marginBottom: 10 }}>{t("invoices.detail.lineItems")}</div>
        {items.length > 0 ? (
          <div className="neu-raised-crisp" style={{ borderRadius: "var(--r-surface)", overflow: "hidden", background: "var(--card)", marginBottom: 18 }}>
            {items.map((it, i) => (
              <div key={i} className="row" style={{ justifyContent: "space-between", gap: 12, padding: "12px 15px", borderBottom: i < items.length - 1 ? "1px solid var(--line)" : "none" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{it.description}</div>
                  {it.qty > 1 && <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)", marginTop: 2 }}>{it.qty} × {money(it.unitPrice, currency)}</div>}
                </div>
                <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink)", flexShrink: 0 }}>{money(num(it.amount) || it.qty * it.unitPrice, currency)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: "var(--mute)", marginBottom: 18 }}>{t("invoices.detail.noLineItems")}</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          <div className="row" style={{ justifyContent: "space-between", fontSize: 13, color: "var(--mute)" }}><span>{t("invoices.detail.subtotal")}</span><span style={{ fontFamily: "var(--mono)" }}>{money(sub, currency)}</span></div>
          <div className="row" style={{ justifyContent: "space-between", fontSize: 13, color: "var(--mute)" }}><span>{t("invoices.detail.taxWithPercent", { percent: taxPct })}</span><span style={{ fontFamily: "var(--mono)" }}>{money(tax, currency)}</span></div>
          <div className="rule" />
          <div className="row" style={{ justifyContent: "space-between" }}><span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{t("invoices.detail.total")}</span><span className="serif" style={{ fontSize: 22, color: "var(--ink)" }}>{money(total, currency)}</span></div>
        </div>

        {isAgencyUser && (
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            {inv.status === "Paid" ? (
              <BToolBtn Ic={Download} label={t("invoices.actions.pdf")} />
            ) : (
              <>
                {(inv.status === "Sent" || inv.status === "Viewed" || status === "Overdue") ? (
                  <BToolBtn Ic={CheckCircle} label={t("invoices.actions.markPaid")} primary onClick={() => inv.id && onMarkPaid(inv.id)} />
                ) : (
                  <BToolBtn Ic={Send} label={t("invoices.actions.markSent")} primary onClick={() => inv.id && onMarkSent(inv.id)} />
                )}
                <BToolBtn Ic={Pencil} label={t("invoices.actions.edit")} onClick={onEdit} />
              </>
            )}
            <BToolBtn Ic={Trash2} label={t("invoices.actions.delete")} onClick={() => inv.id && onDelete(inv.id).then(onClose)} />
          </div>
        )}
      </div>
    </>
  );
}

// ── Expense ─────────────────────────────────────────────────────────────────

export function MobileExpenseDetail({
  exp, isAgencyUser, onEdit, onClose,
}: {
  exp: ExpenseRow;
  isAgencyUser: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("billing");
  const cur = exp.currency || "EUR";
  const excl = num(exp.amountExclVat);
  const total = num(exp.totalAmount);
  const vatPct = num(exp.vatRatePct);
  const vatAmt = num(exp.vatAmount) || total - excl;
  const btw = exp.nlBtwDeductible ? vatAmt : 0;
  const q = exp.quarter || "";

  return (
    <>
      <SheetHeader eyebrow={`${exp.invoiceNumber || "—"} · ${exp.supplier || t("expenses.detail.unknownSupplier")}`} title={money(total, cur)} onClose={onClose} />
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px 28px" }}>
        <div className="row" style={{ gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 9px", borderRadius: "var(--r-pill)", background: exp.nlBtwDeductible ? "var(--good-tint)" : "var(--bg-2)", color: exp.nlBtwDeductible ? "var(--good)" : "var(--mute)" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: exp.nlBtwDeductible ? "var(--good)" : "var(--mute-2)" }} />
            {exp.nlBtwDeductible ? t("expenses.detail.nlBtwDeductible") : t("expenses.detail.nlBtwNonDeductible")}
          </span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mute)", background: "var(--bg)", boxShadow: "var(--sh-inset-super-crisp)", borderRadius: "var(--r-pill)", padding: "3px 9px" }}>{cur}</span>
          {q && <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mute)", background: "var(--bg)", boxShadow: "var(--sh-inset-super-crisp)", borderRadius: "var(--r-pill)", padding: "3px 9px" }}>{q} {exp.year ?? ""}</span>}
        </div>

        {exp.description && <div style={{ fontSize: 15, color: "var(--ink)", lineHeight: 1.45, marginBottom: 18 }}>{exp.description}</div>}

        <div className="row" style={{ gap: 20, marginBottom: 18 }}>
          <BField label={t("expenses.detail.date")}>{dateFull(exp.date)}</BField>
          <BField label={t("expenses.form.invoiceNumberShort")}><span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{exp.invoiceNumber || "—"}</span></BField>
        </div>

        <div className="eyebrow eyebrow-sm" style={{ marginBottom: 10 }}>{t("expenses.detail.amounts")}</div>
        <div className="neu-raised-crisp" style={{ borderRadius: "var(--r-surface)", overflow: "hidden", background: "var(--card)", marginBottom: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", padding: "11px 15px", borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontSize: 13, color: "var(--mute)" }}>{t("expenses.detail.exclVat")}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink)" }}>{money(excl, cur)}</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between", padding: "11px 15px", borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontSize: 13, color: "var(--mute)" }}>{t("expenses.detail.vatPercent", { percent: vatPct })}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink)" }}>{money(vatAmt, cur)}</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between", padding: "12px 15px", background: "var(--bg-2)" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{t("expenses.detail.total")}</span>
            <span className="serif" style={{ fontSize: 20, color: "var(--ink)" }}>{money(total, cur)}</span>
          </div>
        </div>

        <div className="row" style={{ gap: 12, padding: "13px 15px", borderRadius: "var(--r-surface)", marginBottom: 18, background: exp.nlBtwDeductible ? "var(--good-tint)" : "rgba(148,138,119,0.12)" }}>
          <span style={{ width: 34, height: 34, borderRadius: "var(--r-surface)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", color: exp.nlBtwDeductible ? "var(--good)" : "var(--mute-2)" }}>
            {exp.nlBtwDeductible ? <Check size={17} /> : <Info size={17} />}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
              {exp.nlBtwDeductible ? `${t("expenses.detail.nlBtwDeductible")} · ${money(btw, "EUR")}` : t("expenses.detail.nlBtwNonDeductible")}
            </div>
            {exp.notes && <div style={{ fontSize: 12, color: "var(--mute)", marginTop: 2, lineHeight: 1.4 }}>{exp.notes}</div>}
          </div>
        </div>

        {isAgencyUser && (
          <div className="row" style={{ gap: 10 }}>
            {exp.pdfPath && <BToolBtn Ic={Download} label={t("expenses.actions.pdf")} primary />}
            <BToolBtn Ic={Pencil} label={t("expenses.actions.edit")} onClick={onEdit} />
          </div>
        )}
      </div>
    </>
  );
}

// ── Contract ────────────────────────────────────────────────────────────────

export function MobileContractDetail({
  ctr, isAgencyUser, onMarkSigned, onDelete, onClose,
}: {
  ctr: ContractRow;
  isAgencyUser: boolean;
  onMarkSigned: (id: number) => Promise<any>;
  onDelete: (id: number) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation("billing");
  const cur = ctr.currency || "EUR";
  const value = num(ctr.fixed_fee_amount) || num(ctr.monthly_fee) || num(ctr.value_per_booking) || num(ctr.deposit_amount);
  const status = ctr.status || "Draft";
  const signedOrActive = status === "Signed";

  const steps = [
    { label: t("contracts.detail.dates"), date: ctr.created_at, done: true },
    { label: t("contracts.detail.sentDate"), date: ctr.sent_at, done: status !== "Draft" },
    { label: t("contracts.detail.signedDate"), date: ctr.signed_at, done: signedOrActive },
  ];

  return (
    <>
      <SheetHeader eyebrow={t("contracts.detail.contractHeader")} title={ctr.title || t("contracts.card.untitledContract")} onClose={onClose} />
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px 28px" }}>
        <div className="row" style={{ gap: 10, marginBottom: 20 }}>
          <StatusPill status={status} kind="contract" />
          {value > 0 && <span className="serif" style={{ fontSize: 22, color: "var(--ink)", marginLeft: "auto" }}>{money0(value, cur)}</span>}
        </div>

        <div className="neu-inset" style={{ borderRadius: "var(--r-surface)", padding: 16, display: "flex", alignItems: "center", gap: 13, marginBottom: 18 }}>
          <BAvatar name={ctr.account_name} size={40} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{ctr.account_name || t("contracts.card.noAccount")}</div>
            {ctr.signer_name && <div style={{ fontSize: 12, color: "var(--mute)", marginTop: 2 }}>{t("contracts.detail.signer")}: {ctr.signer_name}</div>}
          </div>
        </div>

        <div className="row" style={{ gap: 18, marginBottom: 18, flexWrap: "wrap" }}>
          <BField label={t("contracts.detail.startDate")}>{dateFull(ctr.start_date)}</BField>
          <BField label={t("contracts.detail.endDate")}>{dateFull(ctr.end_date)}</BField>
          {value > 0 && <BField label={t("contracts.detail.totalAmount")}>{money0(value, cur)}</BField>}
        </div>

        {ctr.description && (
          <>
            <div className="eyebrow eyebrow-sm" style={{ marginBottom: 10 }}>{t("contracts.detail.overview")}</div>
            <div className="neu-inset" style={{ borderRadius: "var(--r-surface)", padding: "16px 18px", marginBottom: 18, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.55 }}>{ctr.description}</div>
          </>
        )}

        <div className="eyebrow eyebrow-sm" style={{ marginBottom: 14 }}>{t("contracts.detail.status")}</div>
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 22 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 13 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: s.done ? "var(--good)" : "var(--bg)", boxShadow: s.done ? "var(--sh-raised-crisp)" : "var(--sh-inset-crisp)", color: s.done ? "#fff" : "var(--mute-2)" }}>
                  {s.done ? <Check size={13} /> : <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--mute-2)" }} />}
                </span>
                {i < steps.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 22, background: s.done ? "var(--good)" : "var(--line)" }} />}
              </div>
              <div style={{ paddingBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: s.done ? "var(--ink)" : "var(--mute)" }}>{s.label}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)", marginTop: 2 }}>{s.date ? dateFull(s.date) : t("contracts.detail.notSentYet")}</div>
              </div>
            </div>
          ))}
        </div>

        {isAgencyUser && (
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            {!signedOrActive && <BToolBtn Ic={CheckCircle} label={t("contracts.actions.markSigned")} primary onClick={() => ctr.id && onMarkSigned(ctr.id)} />}
            {ctr.file_data && <BToolBtn Ic={FileText} label={t("contracts.detail.downloadPdf")} />}
            <BToolBtn Ic={Trash2} label={t("contracts.actions.delete")} onClick={() => ctr.id && onDelete(ctr.id).then(onClose)} />
          </div>
        )}
      </div>
    </>
  );
}

// ── shared sheet header (kept local to avoid extra import churn) ──────────────

function SheetHeader({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) {
  return (
    <div style={{ flexShrink: 0, padding: "20px 22px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div className="eyebrow eyebrow-sm">{eyebrow}</div>
        <div className="serif" style={{ fontSize: 26, color: "var(--ink)", marginTop: 4, lineHeight: 1.1, overflowWrap: "anywhere" }}>{title}</div>
      </div>
      <button onClick={onClose} aria-label="Close" style={{ width: 36, height: 36, borderRadius: "var(--r-pill)", flexShrink: 0, border: "none", cursor: "pointer", background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", color: "var(--mute)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>×</button>
    </div>
  );
}
