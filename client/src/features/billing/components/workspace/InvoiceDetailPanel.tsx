import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Download, Link2, SendHorizontal, CheckCircle, Pencil, Trash2, Eye, Check, CopyPlus } from "lucide-react";
import type { InvoiceRow } from "../../types";
import type { AccountRow } from "@/features/accounts/components/AccountDetailsDialog";
import { parseLineItems, formatCurrency } from "../../types";
import { StatusPill, fmtDateFull, daysFrom } from "./atoms";
import { effectiveInvoiceStatus } from "./adapters";

// Small soft action button used in the detail header.
function ActBtn({ icon, label, onClick, disabled, danger, active }: {
  icon: ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean; active?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="la-btn la-btn--soft"
      style={{ ...(danger ? { color: "var(--stage-lost)" } : active ? { color: "var(--good)" } : {}), opacity: disabled ? 0.5 : 1 }}>
      {icon}{label}
    </button>
  );
}

// neu-raised section card with an eyebrow heading.
function SectionCard({ title, children, style }: { title: ReactNode; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <section className="neu-raised" style={{ borderRadius: "var(--r-card)", padding: "18px 20px", ...style }}>
      <div className="eyebrow eyebrow-sm" style={{ marginBottom: 14 }}>{title}</div>
      {children}
    </section>
  );
}

function parsePaymentLines(text: string): Array<{ key: string | null; value: string }> {
  return text.split("\n").filter((l) => l.trim()).map((line) => {
    const idx = line.indexOf(": ");
    if (idx > 0) return { key: line.slice(0, idx).trim(), value: line.slice(idx + 2).trim() };
    return { key: null, value: line.trim() };
  });
}

function toDisplayTitle(title: string | null, fallback: string): string {
  if (!title) return fallback;
  return title.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Props {
  invoice: InvoiceRow;
  account?: AccountRow | null;
  isAgencyUser: boolean;
  onMarkSent: (id: number) => Promise<any>;
  onMarkPaid: (id: number) => Promise<any>;
  onEdit: (invoice: InvoiceRow) => void;
  onDuplicate?: (invoice: InvoiceRow) => void;
  onDelete: (id: number) => Promise<void>;
  onRefresh: () => void;
}

export function InvoiceDetailPanel({ invoice, account, isAgencyUser, onMarkSent, onMarkPaid, onEdit, onDuplicate, onDelete, onRefresh }: Props) {
  const { t } = useTranslation("billing");
  const status = effectiveInvoiceStatus(invoice);
  const lineItems = parseLineItems(invoice.line_items);
  const currency = invoice.currency || "EUR";

  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [markingSent, setMarkingSent] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);

  useEffect(() => {
    setCopied(false); setDeleteConfirm(false); setMarkingSent(false); setMarkingPaid(false);
  }, [invoice.id]);
  useEffect(() => {
    if (!deleteConfirm) return;
    const tm = setTimeout(() => setDeleteConfirm(false), 3000);
    return () => clearTimeout(tm);
  }, [deleteConfirm]);

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/api/invoices/view/${invoice.view_token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [invoice.view_token]);

  const handleMarkSent = useCallback(async () => {
    setMarkingSent(true);
    try { await onMarkSent(invoice.id); onRefresh(); } finally { setMarkingSent(false); }
  }, [invoice.id, onMarkSent, onRefresh]);

  const handleMarkPaid = useCallback(async () => {
    setMarkingPaid(true);
    try { await onMarkPaid(invoice.id); onRefresh(); } finally { setMarkingPaid(false); }
  }, [invoice.id, onMarkPaid, onRefresh]);

  const handleDelete = useCallback(async () => {
    if (deleteConfirm) { setDeleteConfirm(false); await onDelete(invoice.id); }
    else setDeleteConfirm(true);
  }, [deleteConfirm, invoice.id, onDelete]);

  const handleDownloadPdf = useCallback(() => {
    const subtotalNum = parseFloat(invoice.subtotal || "0");
    const totalNum = parseFloat(invoice.total || "0");
    const taxAmt = parseFloat(invoice.tax_amount || "0");
    const discountAmt = parseFloat(invoice.discount_amount || "0");
    const itemRows = lineItems.map((item) =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#374151;">${item.description}</td><td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#374151;text-align:center;">${item.qty}</td><td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#374151;text-align:right;">${formatCurrency(item.unitPrice, currency)}</td><td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#374151;text-align:right;font-weight:600;">${formatCurrency(item.amount, currency)}</td></tr>`
    ).join("");
    const totalsRows = [
      `<tr><td style="padding:4px 12px;font-size:13px;color:#6B7280;">${t("invoices.detail.subtotal")}</td><td style="padding:4px 12px;font-size:13px;text-align:right;">${formatCurrency(subtotalNum, currency)}</td></tr>`,
      taxAmt > 0 ? `<tr><td style="padding:4px 12px;font-size:13px;color:#6B7280;">${invoice.tax_percent ? t("invoices.detail.taxWithPercent", { percent: invoice.tax_percent }) : t("invoices.detail.tax")}</td><td style="padding:4px 12px;font-size:13px;text-align:right;">${formatCurrency(taxAmt, currency)}</td></tr>` : "",
      discountAmt > 0 ? `<tr><td style="padding:4px 12px;font-size:13px;color:#6B7280;">${t("invoices.detail.discount")}</td><td style="padding:4px 12px;font-size:13px;text-align:right;color:#059669;">-${formatCurrency(discountAmt, currency)}</td></tr>` : "",
      `<tr><td style="padding:6px 12px;font-size:13px;font-weight:700;border-top:1px solid #E5E7EB;color:#111827;">${t("invoices.detail.total")}</td><td style="padding:6px 12px;font-size:13px;font-weight:700;text-align:right;border-top:1px solid #E5E7EB;color:#111827;">${formatCurrency(totalNum, currency)}</td></tr>`,
    ].join("");
    const billToLines: string[] = [];
    billToLines.push(`<div style="font-size:15px;font-weight:700;margin-bottom:3px;">${invoice.account_name || "—"}</div>`);
    if (account?.address) billToLines.push(`<div style="font-size:13px;color:#374151;">${account.address.replace(/\n/g, "<br>")}</div>`);
    if (account?.phone || account?.owner_email) billToLines.push(`<div style="font-size:13px;color:#6B7280;margin-top:2px;">${[account?.phone, account?.owner_email].filter(Boolean).join(" · ")}</div>`);
    if (account?.tax_id) billToLines.push(`<div style="font-size:12px;color:#9CA3AF;margin-top:4px;">${t("invoices.detail.taxIdRegNo")}: ${account.tax_id}</div>`);
    const logoUrl = `${window.location.origin}/2.Full-LOGO.svg`;
    const bodyHtml = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;color:#111827;background:#fff;"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;"><img src="${logoUrl}" alt="Lead Awaker" style="height:100px;width:auto;" /><div><div style="font-size:28px;font-weight:700;text-align:right;">${t("invoices.detail.invoice").toUpperCase()}</div><div style="text-align:right;font-size:13px;color:#6B7280;margin-top:4px;">${invoice.invoice_number ? `#${invoice.invoice_number}<br>` : ""}${t("invoices.detail.issued")}: ${fmtDateFull(invoice.issued_date)}<br>${t("invoices.detail.dueDate")}: ${fmtDateFull(invoice.due_date)}</div></div></div><div style="margin-bottom:28px;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#9CA3AF;margin-bottom:6px;">${t("invoices.detail.billTo")}</div>${billToLines.join("")}</div>${invoice.title ? `<p style="font-size:16px;font-weight:600;margin:0 0 16px;">${toDisplayTitle(invoice.title, t("invoices.card.untitledInvoice"))}</p>` : ""}<table style="width:100%;border-collapse:collapse;"><thead><tr><th style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9CA3AF;border-bottom:2px solid #E5E7EB;text-align:left;">${t("invoices.detail.description")}</th><th style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9CA3AF;border-bottom:2px solid #E5E7EB;text-align:center;">${t("invoices.detail.qty")}</th><th style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9CA3AF;border-bottom:2px solid #E5E7EB;text-align:right;">${t("invoices.detail.unitPrice")}</th><th style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9CA3AF;border-bottom:2px solid #E5E7EB;text-align:right;">${t("invoices.detail.amount")}</th></tr></thead><tbody>${itemRows}</tbody></table><div style="margin-top:16px;display:flex;justify-content:flex-end;"><table style="width:280px;border-collapse:collapse;">${totalsRows}</table></div>${invoice.payment_info ? `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #E5E7EB;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#9CA3AF;margin-bottom:8px;">${t("invoices.detail.paymentInfo")}</div><p style="margin:0;font-size:13px;color:#374151;white-space:pre-wrap;">${invoice.payment_info}</p></div>` : ""}${invoice.notes ? `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #E5E7EB;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#9CA3AF;margin-bottom:8px;">${t("invoices.detail.notesAndDetails")}</div><p style="margin:0;font-size:13px;color:#374151;white-space:pre-wrap;">${invoice.notes}</p></div>` : ""}</div>`;
    const FRAME_ID = "__inv_print_frame__";
    document.getElementById(FRAME_ID)?.remove();
    const iframe = document.createElement("iframe");
    iframe.id = FRAME_ID;
    iframe.style.cssText = "position:fixed;width:0;height:0;border:none;left:-9999px;top:-9999px;";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${invoice.invoice_number || ""}</title><style>body{margin:0;padding:0;} @media print { body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }</style></head><body>${bodyHtml}</body></html>`);
    doc.close();
    const printWhenReady = () => {
      const images = Array.from(doc.querySelectorAll("img"));
      const pending = images.filter((img) => !img.complete);
      const fire = () => { setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => document.getElementById(FRAME_ID)?.remove(), 500); }, 50); };
      if (pending.length === 0) { fire(); return; }
      let loaded = 0;
      const onDone = () => { loaded++; if (loaded >= pending.length) fire(); };
      pending.forEach((img) => { img.addEventListener("load", onDone, { once: true }); img.addEventListener("error", onDone, { once: true }); });
    };
    iframe.onload = printWhenReady;
    if (doc.readyState === "complete") printWhenReady();
  }, [invoice, lineItems, currency, account, t]);

  const subtotalNum = parseFloat(invoice.subtotal || "0");
  const totalNum = parseFloat(invoice.total || "0");
  const taxAmt = parseFloat(invoice.tax_amount || "0");
  const discountAmt = parseFloat(invoice.discount_amount || "0");
  const showSubtotalDiff = Math.abs(subtotalNum - totalNum) > 0.001;
  const dueD = daysFrom(invoice.due_date);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }} data-testid="invoice-detail-panel">
      {/* Header */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div className="serif" style={{ fontSize: 28, color: "var(--ink)", lineHeight: 1.1 }}>
            {toDisplayTitle(invoice.title, t("invoices.card.untitledInvoice"))}
          </div>
          <div className="row" style={{ gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            {invoice.account_name && <span style={{ fontSize: 13, color: "var(--mute)" }}>{invoice.account_name}</span>}
            {invoice.invoice_number && <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute-2)" }}>#{invoice.invoice_number}</span>}
          </div>
        </div>
        {isAgencyUser && (
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <ActBtn icon={<Download size={14} />} label={t("invoices.actions.pdf")} onClick={handleDownloadPdf} />
            <ActBtn icon={copied ? <Check size={14} /> : <Link2 size={14} />} label={copied ? t("invoices.actions.copied") : t("invoices.actions.copyLink")} onClick={handleCopyLink} active={copied} />
            {invoice.status === "Draft" && <ActBtn icon={<SendHorizontal size={14} />} label={markingSent ? t("invoices.actions.sending") : t("invoices.actions.markSent")} onClick={handleMarkSent} disabled={markingSent} />}
            {(invoice.status === "Sent" || invoice.status === "Viewed") && <ActBtn icon={<CheckCircle size={14} />} label={markingPaid ? t("invoices.actions.updating") : t("invoices.actions.markPaid")} onClick={handleMarkPaid} disabled={markingPaid} />}
            <ActBtn icon={<Pencil size={14} />} label={t("invoices.actions.edit")} onClick={() => onEdit(invoice)} />
            {onDuplicate && <ActBtn icon={<CopyPlus size={14} />} label={t("invoices.actions.duplicate")} onClick={() => onDuplicate(invoice)} />}
            <ActBtn icon={<Trash2 size={14} />} label={deleteConfirm ? t("invoices.actions.confirm") : t("invoices.actions.delete")} onClick={handleDelete} danger={deleteConfirm} />
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)", gap: 16 }} className="max-md:!grid-cols-1">
        {/* Line items */}
        <SectionCard title={t("invoices.detail.lineItems")}>
          {lineItems.length > 0 ? (
            <>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {[t("invoices.detail.description"), t("invoices.detail.qty"), t("invoices.detail.unitPrice"), t("invoices.detail.amount")].map((h, i) => (
                      <th key={i} style={{ textAlign: i === 0 ? "left" : i === 1 ? "center" : "right", fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)", paddingBottom: 8 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ fontSize: 12.5, color: "var(--ink)", padding: "10px 0" }}>{item.description}</td>
                      <td style={{ fontSize: 12.5, color: "var(--mute)", textAlign: "center", fontFamily: "var(--mono)" }}>{item.qty}</td>
                      <td style={{ fontSize: 12.5, color: "var(--mute)", textAlign: "right", fontFamily: "var(--mono)" }}>{formatCurrency(item.unitPrice, currency)}</td>
                      <td style={{ fontSize: 12.5, color: "var(--ink)", textAlign: "right", fontFamily: "var(--mono)", fontWeight: 600 }}>{formatCurrency(item.amount, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 6 }}>
                {showSubtotalDiff && <Row label={t("invoices.detail.subtotal")} value={formatCurrency(subtotalNum, currency)} />}
                {taxAmt > 0 && <Row label={invoice.tax_percent ? t("invoices.detail.taxWithPercent", { percent: invoice.tax_percent }) : t("invoices.detail.tax")} value={formatCurrency(taxAmt, currency)} />}
                {discountAmt > 0 && <Row label={t("invoices.detail.discount")} value={`-${formatCurrency(discountAmt, currency)}`} valueColor="var(--good)" />}
                <div className="row" style={{ justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{t("invoices.detail.total")}</span>
                  <span className="serif" style={{ fontSize: 20, color: "var(--ink)" }}>{formatCurrency(totalNum, currency)}</span>
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: "24px 0", textAlign: "center", fontSize: 12, color: "var(--mute-2)", fontStyle: "italic" }}>{t("invoices.detail.noLineItems")}</div>
          )}
          {invoice.notes && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              <div className="eyebrow eyebrow-sm" style={{ marginBottom: 6 }}>{t("invoices.detail.notesAndDetails")}</div>
              <p style={{ fontSize: 11.5, color: "var(--mute)", lineHeight: 1.5, whiteSpace: "pre-wrap", margin: 0 }}>{invoice.notes}</p>
            </div>
          )}
        </SectionCard>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard title={t("invoices.detail.totalAmount")}>
            <div className="serif" style={{ fontSize: 30, color: "var(--ink)", lineHeight: 1 }}>{formatCurrency(totalNum, currency)}</div>
          </SectionCard>

          <SectionCard title={t("invoices.detail.status")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><StatusPill kind="invoice" status={status} label={t(`invoices.statusLabels.${status}`, status)} /></div>
              <div className="row" style={{ gap: 6 }}>
                <Eye size={14} style={{ color: "var(--mute-2)" }} />
                <span style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--mono)" }}>{invoice.viewed_count ?? 0}</span>
                <span style={{ fontSize: 11, color: "var(--mute-2)" }}>{(invoice.viewed_count ?? 0) === 1 ? t("invoices.detail.view") : t("invoices.detail.views")}</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title={t("invoices.detail.dates")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div className="eyebrow eyebrow-sm" style={{ marginBottom: 4 }}>{t("invoices.detail.dueDate")}</div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{fmtDateFull(invoice.due_date)}</span>
                {dueD != null && status !== "Paid" && status !== "Cancelled" && (
                  <span style={{ fontSize: 11, marginLeft: 6, color: dueD < 0 ? "var(--stage-lost)" : "var(--mute)" }}>
                    {dueD < 0 ? t("invoices.card.dOverdue", { count: Math.abs(dueD) }) : dueD === 0 ? t("invoices.card.dueToday", "Due today") : t("invoices.card.dueIn", { count: dueD })}
                  </span>
                )}
                {status === "Paid" && invoice.paid_at && <span style={{ fontSize: 11, marginLeft: 6, color: "var(--good)" }}>· {t("invoices.detail.paidOn", { date: fmtDateFull(invoice.paid_at) })}</span>}
              </div>
              <div style={{ paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                <div className="eyebrow eyebrow-sm" style={{ marginBottom: 4 }}>{t("invoices.detail.sentDate")}</div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{invoice.sent_at ? fmtDateFull(invoice.sent_at) : t("invoices.detail.notSentYet")}</span>
              </div>
            </div>
          </SectionCard>

          {invoice.payment_info && (
            <SectionCard title={t("invoices.detail.paymentInfo")}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {parsePaymentLines(invoice.payment_info).map((line, i) =>
                  line.key ? (
                    <div key={i} style={i > 0 ? { paddingTop: 10, borderTop: "1px solid var(--line)" } : undefined}>
                      <div className="eyebrow eyebrow-sm" style={{ marginBottom: 4 }}>{line.key}</div>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{line.value}</span>
                    </div>
                  ) : (
                    <p key={i} style={{ fontSize: 12.5, color: "var(--ink)", margin: 0, ...(i > 0 ? { paddingTop: 10, borderTop: "1px solid var(--line)" } : {}) }}>{line.value}</p>
                  )
                )}
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, valueColor }: { label: ReactNode; value: ReactNode; valueColor?: string }) {
  return (
    <div className="row" style={{ justifyContent: "space-between" }}>
      <span style={{ fontSize: 11.5, color: "var(--mute)" }}>{label}</span>
      <span style={{ fontSize: 12, color: valueColor || "var(--ink)", fontFamily: "var(--mono)" }}>{value}</span>
    </div>
  );
}

export function InvoiceDetailPanelEmpty() {
  const { t } = useTranslation("billing");
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ height: "100%", color: "var(--mute)" }}>
      <p style={{ fontSize: 14 }}>{t("invoices.empty.selectAnInvoice")}</p>
    </div>
  );
}
