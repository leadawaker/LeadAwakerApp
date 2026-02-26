import { useState, useEffect, useCallback } from "react";
import {
  Download, Link, Send, CheckCircle, Pencil, Trash2,
  Eye, Check, FileText, CopyPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { InvoiceRow } from "../types";
import type { AccountRow } from "@/features/accounts/components/AccountDetailsDialog";
import {
  parseLineItems,
  formatCurrency,
  isOverdue,
  INVOICE_STATUS_COLORS,
} from "../types";

// ── Props ─────────────────────────────────────────────────────────────────────

interface InvoiceDetailViewProps {
  invoice: InvoiceRow;
  allInvoices?: InvoiceRow[];
  account?: AccountRow | null;
  isAgencyUser: boolean;
  onMarkSent: (id: number) => Promise<any>;
  onMarkPaid: (id: number) => Promise<any>;
  onEdit: (invoice: InvoiceRow) => void;
  onDuplicate?: (invoice: InvoiceRow) => void;
  onDelete: (id: number) => Promise<void>;
  onRefresh: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Convert snake_case or kebab-case title to "Title Case" for display. */
function toDisplayTitle(title: string | null): string {
  if (!title) return "Untitled Invoice";
  return title
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function InvoiceDetailViewEmpty() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-stone-50 to-gray-100 flex items-center justify-center ring-1 ring-stone-200/50">
        <FileText className="h-10 w-10 text-stone-400" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground/70">Select an invoice</p>
        <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">
          Click any invoice on the left to see its details and line items.
        </p>
      </div>
      <div className="text-[11px] text-stone-400 font-medium">&larr; Choose from the list</div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse payment info text into structured key/value lines. Lines that look like
 *  "Label: value" are split into { key, value }; plain lines get key = null. */
function parsePaymentLines(text: string): Array<{ key: string | null; value: string }> {
  return text.split("\n").filter((l) => l.trim()).map((line) => {
    const idx = line.indexOf(": ");
    if (idx > 0) {
      return { key: line.slice(0, idx).trim(), value: line.slice(idx + 2).trim() };
    }
    return { key: null, value: line.trim() };
  });
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(val: string | null | undefined): string {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function daysDiff(dueDate: string | null | undefined): { days: number; label: string; color: string } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return null;
  const now = new Date();
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) {
    return { days: diff, label: `${Math.abs(diff)}d overdue`, color: "text-rose-600" };
  }
  if (diff === 0) {
    return { days: 0, label: "Due today", color: "text-amber-600" };
  }
  if (diff <= 7) {
    return { days: diff, label: `Due in ${diff}d`, color: "text-amber-600" };
  }
  return { days: diff, label: `Due in ${diff}d`, color: "text-foreground/60" };
}

// ── Main Component ────────────────────────────────────────────────────────────

export function InvoiceDetailView({
  invoice,
  allInvoices,
  account,
  isAgencyUser,
  onMarkSent,
  onMarkPaid,
  onEdit,
  onDuplicate,
  onDelete,
  onRefresh,
}: InvoiceDetailViewProps) {
  const displayStatus = isOverdue(invoice) ? "Overdue" : (invoice.status || "Draft");
  const statusColors = INVOICE_STATUS_COLORS[displayStatus] || INVOICE_STATUS_COLORS.Draft;
  const lineItems = parseLineItems(invoice.line_items);
  const currency = invoice.currency || "EUR";

  // ── Per-client invoice number ────────────────────────────────────────────
  const clientInvoiceNum = (() => {
    if (!allInvoices?.length || !invoice.Accounts_id) return null;
    const accountInvoices = allInvoices
      .filter((i) => i.Accounts_id === invoice.Accounts_id)
      .sort((a, b) =>
        (a.issued_date || a.created_at || "").localeCompare(b.issued_date || b.created_at || "")
      );
    const idx = accountInvoices.findIndex((i) => i.id === invoice.id);
    return idx >= 0 ? idx + 1 : null;
  })();
  const invoiceYear = invoice.issued_date
    ? new Date(invoice.issued_date).getFullYear()
    : new Date().getFullYear();

  // ── Copy link state ───────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);

  // ── Delete two-tap confirm ────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  useEffect(() => {
    if (deleteConfirm) {
      const t = setTimeout(() => setDeleteConfirm(false), 3000);
      return () => clearTimeout(t);
    }
  }, [deleteConfirm]);

  // ── Action busy states ────────────────────────────────────────────────────
  const [markingSent, setMarkingSent] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);

  // Reset local state when invoice changes
  useEffect(() => {
    setDeleteConfirm(false);
    setCopied(false);
    setMarkingSent(false);
    setMarkingPaid(false);
  }, [invoice.id]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/api/invoices/view/${invoice.view_token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [invoice.view_token]);

  const handleMarkSent = useCallback(async () => {
    setMarkingSent(true);
    try {
      await onMarkSent(invoice.id);
      onRefresh();
    } finally {
      setMarkingSent(false);
    }
  }, [invoice.id, onMarkSent, onRefresh]);

  const handleMarkPaid = useCallback(async () => {
    setMarkingPaid(true);
    try {
      await onMarkPaid(invoice.id);
      onRefresh();
    } finally {
      setMarkingPaid(false);
    }
  }, [invoice.id, onMarkPaid, onRefresh]);

  const handleDelete = useCallback(async () => {
    if (deleteConfirm) {
      setDeleteConfirm(false);
      await onDelete(invoice.id);
    } else {
      setDeleteConfirm(true);
    }
  }, [deleteConfirm, invoice.id, onDelete]);

  const handleDownloadPdf = useCallback(() => {
    const subtotalNum = parseFloat(invoice.subtotal || "0");
    const totalNum    = parseFloat(invoice.total    || "0");
    const taxAmt      = parseFloat(invoice.tax_amount    || "0");
    const discountAmt = parseFloat(invoice.discount_amount || "0");

    const itemRows = lineItems.map((item) =>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#374151;">${item.description}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#374151;text-align:center;">${item.qty}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#374151;text-align:right;">${formatCurrency(item.unitPrice, currency)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#374151;text-align:right;font-weight:600;">${formatCurrency(item.amount, currency)}</td>
      </tr>`
    ).join("");

    const totalsRows = [
      `<tr><td style="padding:4px 12px;font-size:13px;color:#6B7280;">Subtotal</td><td style="padding:4px 12px;font-size:13px;text-align:right;">${formatCurrency(subtotalNum, currency)}</td></tr>`,
      taxAmt > 0 ? `<tr><td style="padding:4px 12px;font-size:13px;color:#6B7280;">Tax${invoice.tax_percent ? ` (${invoice.tax_percent}%)` : ""}</td><td style="padding:4px 12px;font-size:13px;text-align:right;">${formatCurrency(taxAmt, currency)}</td></tr>` : "",
      discountAmt > 0 ? `<tr><td style="padding:4px 12px;font-size:13px;color:#6B7280;">Discount</td><td style="padding:4px 12px;font-size:13px;text-align:right;color:#059669;">-${formatCurrency(discountAmt, currency)}</td></tr>` : "",
      `<tr><td style="padding:6px 12px;font-size:13px;font-weight:700;border-top:1px solid #E5E7EB;color:#111827;">Total</td><td style="padding:6px 12px;font-size:13px;font-weight:700;text-align:right;border-top:1px solid #E5E7EB;color:#111827;">${formatCurrency(totalNum, currency)}</td></tr>`,
    ].join("");

    // ── Build Bill To block ────────────────────────────────────────────────
    const billToLines: string[] = [];
    billToLines.push(`<div style="font-size:15px;font-weight:700;margin-bottom:3px;">${invoice.account_name || "—"}</div>`);
    if (account?.address) {
      billToLines.push(`<div style="font-size:13px;color:#374151;">${account.address.replace(/\n/g, "<br>")}</div>`);
    }
    if (account?.phone || account?.owner_email) {
      const contact = [account?.phone, account?.owner_email].filter(Boolean).join(" · ");
      billToLines.push(`<div style="font-size:13px;color:#6B7280;margin-top:2px;">${contact}</div>`);
    }
    if (account?.tax_id) {
      billToLines.push(`<div style="font-size:12px;color:#9CA3AF;margin-top:4px;">Tax ID / Reg. No.: ${account.tax_id}</div>`);
    }

    // Build the invoice body as an HTML string with full inline styles.
    const logoUrl = `${window.location.origin}/2.Full-LOGO.svg`;
    const bodyHtml = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;color:#111827;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;">
          <img src="${logoUrl}" alt="Lead Awaker" style="height:100px;width:auto;" />
          <div>
            <div style="font-size:28px;font-weight:700;text-align:right;">INVOICE</div>
            <div style="text-align:right;font-size:13px;color:#6B7280;margin-top:4px;">
              ${invoice.invoice_number ? `#${invoice.invoice_number}<br>` : ""}
              Issued: ${fmtDate(invoice.issued_date)}<br>
              Due: ${fmtDate(invoice.due_date)}
            </div>
          </div>
        </div>
        <div style="margin-bottom:28px;">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#9CA3AF;margin-bottom:6px;">Bill To</div>
          ${billToLines.join("")}
        </div>
        ${invoice.title ? `<p style="font-size:16px;font-weight:600;margin:0 0 16px;">${toDisplayTitle(invoice.title)}</p>` : ""}
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9CA3AF;border-bottom:2px solid #E5E7EB;text-align:left;">Description</th>
              <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9CA3AF;border-bottom:2px solid #E5E7EB;text-align:center;">Qty</th>
              <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9CA3AF;border-bottom:2px solid #E5E7EB;text-align:right;">Unit Price</th>
              <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9CA3AF;border-bottom:2px solid #E5E7EB;text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div style="margin-top:16px;display:flex;justify-content:flex-end;">
          <table style="width:280px;border-collapse:collapse;">${totalsRows}</table>
        </div>
        ${invoice.payment_info ? `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #E5E7EB;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#9CA3AF;margin-bottom:8px;">Payment Info</div><p style="margin:0;font-size:13px;color:#374151;white-space:pre-wrap;">${invoice.payment_info}</p></div>` : ""}
        ${invoice.notes ? `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #E5E7EB;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#9CA3AF;margin-bottom:8px;">Notes</div><p style="margin:0;font-size:13px;color:#374151;white-space:pre-wrap;">${invoice.notes}</p></div>` : ""}
      </div>`;

    // Print via hidden iframe — completely isolates from the app's CSS
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

    // Wait for all images (logo) to load, then print
    const printWhenReady = () => {
      const images = Array.from(doc.querySelectorAll("img"));
      const pending = images.filter((img) => !img.complete);
      if (pending.length === 0) {
        setTimeout(() => {
          iframe.contentWindow?.print();
          setTimeout(() => document.getElementById(FRAME_ID)?.remove(), 500);
        }, 50);
      } else {
        let loaded = 0;
        const onDone = () => {
          loaded++;
          if (loaded >= pending.length) {
            setTimeout(() => {
              iframe.contentWindow?.print();
              setTimeout(() => document.getElementById(FRAME_ID)?.remove(), 500);
            }, 50);
          }
        };
        pending.forEach((img) => {
          img.addEventListener("load", onDone, { once: true });
          img.addEventListener("error", onDone, { once: true });
        });
      }
    };

    iframe.onload = printWhenReady;
    // Fallback if onload already fired
    if (doc.readyState === "complete") printWhenReady();
  }, [invoice, lineItems, currency]);

  // ── Computed values ───────────────────────────────────────────────────────
  const dueDateInfo = daysDiff(invoice.due_date);
  const subtotalNum = parseFloat(invoice.subtotal || "0");
  const totalNum = parseFloat(invoice.total || "0");
  const taxAmt = parseFloat(invoice.tax_amount || "0");
  const discountAmt = parseFloat(invoice.discount_amount || "0");
  const showSubtotalDiff = Math.abs(subtotalNum - totalNum) > 0.001;

  // Inline due-date suffix: "in 13 days", "today", "3d overdue"
  const dueDateSuffix = (() => {
    if (!dueDateInfo || displayStatus === "Paid" || displayStatus === "Cancelled") return null;
    const d = dueDateInfo.days;
    if (d < 0) return `${Math.abs(d)}d overdue`;
    if (d === 0) return "today";
    return `in ${d} day${d === 1 ? "" : "s"}`;
  })();

  return (
    <div className="relative flex flex-col h-full overflow-hidden" data-testid="invoice-detail-view">

      {/* ── Full-height warm gradient bloom background ── */}
      <div className="absolute inset-0 bg-[#F8F3EB]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.9)_0%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,242,134,0.35)_0%,transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(241,218,162,0.2)_0%,transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(210,188,130,0.15)_0%,transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(105,170,255,0.18)_0%,transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,rgba(165,205,255,0.12)_0%,transparent_60%)]" />

      {/* ── Header ── */}
      <div className="relative z-10 shrink-0 px-[3px] pt-[3px] pb-[3px] space-y-[3px]">

        {/* Action toolbar (above header, no container) */}
        {isAgencyUser && (
          <div className="px-3 py-2 flex items-center gap-1 flex-wrap">
            {/* Group 1: Download + Copy Link */}
            <button
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-card transition-colors"
            >
              <Download className="h-3 w-3" />
              PDF
            </button>

            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-card transition-colors"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Link className="h-3 w-3" />}
              {copied ? "Copied!" : "Copy Link"}
            </button>

            {/* Group 2 (conditional): divider + Mark Sent */}
            {invoice.status === "Draft" && (
              <>
                <div className="h-4 w-px bg-border/40 shrink-0" />
                <button
                  onClick={handleMarkSent}
                  disabled={markingSent}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-card transition-colors disabled:opacity-50"
                >
                  <Send className="h-3 w-3" />
                  {markingSent ? "Sending..." : "Mark Sent"}
                </button>
              </>
            )}

            {/* Group 2 (conditional): divider + Mark Paid */}
            {(invoice.status === "Sent" || invoice.status === "Viewed") && (
              <>
                <div className="h-4 w-px bg-border/40 shrink-0" />
                <button
                  onClick={handleMarkPaid}
                  disabled={markingPaid}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-card transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="h-3 w-3" />
                  {markingPaid ? "Updating..." : "Mark Paid"}
                </button>
              </>
            )}

            {/* Divider before Group 3 */}
            <div className="h-4 w-px bg-border/40 shrink-0" />

            {/* Group 3: Edit + Duplicate */}
            <button
              onClick={() => onEdit(invoice)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-card transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>

            {onDuplicate && (
              <button
                onClick={() => onDuplicate(invoice)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-card transition-colors"
              >
                <CopyPlus className="h-3 w-3" />
                Duplicate
              </button>
            )}

            {/* Divider before Group 4 */}
            <div className="h-4 w-px bg-border/40 shrink-0" />

            {/* Group 4: Delete */}
            <button
              onClick={handleDelete}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition-colors",
                deleteConfirm
                  ? "border-red-400/60 text-red-600 bg-red-50/50 hover:bg-red-50/70"
                  : "border-border/60 bg-transparent text-foreground hover:bg-card"
              )}
            >
              <Trash2 className="h-3 w-3" />
              {deleteConfirm ? "Confirm?" : "Delete"}
            </button>
          </div>
        )}

        {/* Title + status + tracking */}
        <div className="px-4 pt-3 pb-2 space-y-2">
          <div>
            <h2 className="text-[22px] font-semibold font-heading text-foreground leading-tight">
              {toDisplayTitle(invoice.title)}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {invoice.account_name && (
                <span className="text-[13px] text-foreground/50">{invoice.account_name}</span>
              )}
              {clientInvoiceNum !== null && (
                <>
                  <span className="text-foreground/25 text-[13px]">·</span>
                  <span className="text-[13px] text-foreground/50">
                    Invoice {String(clientInvoiceNum).padStart(2, "0")} · {invoiceYear}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Status badge + Tracking inline */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold"
              style={{ backgroundColor: statusColors.bg, color: statusColors.text }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: statusColors.dot }}
              />
              {displayStatus}
            </span>

            {/* Tracking */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/50">
              <Eye className="h-3.5 w-3.5 text-foreground/40" />
              <span className="text-[12px] font-semibold tabular-nums text-foreground">
                {invoice.viewed_count ?? 0}
              </span>
              <span className="text-[11px] text-foreground/40">
                {(invoice.viewed_count ?? 0) === 1 ? "view" : "views"}
              </span>
              {invoice.viewed_count && invoice.viewed_count > 0 && invoice.account_name && (
                <span className="text-[11px] text-foreground/40">
                  by {invoice.account_name}
                </span>
              )}
            </div>

            {invoice.viewed_at && (
              <span className="text-[10px] text-foreground/40">
                First viewed {fmtDate(invoice.viewed_at)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Scrollable content area (two columns: wide + narrow) ── */}
      <div className="relative z-10 flex-1 overflow-y-auto px-[3px] pb-[3px] min-h-0">
        <div className="grid grid-cols-[1.6fr_1fr] gap-[3px] h-full">

          {/* ── Left column (wide): Line items only ── */}
          <div className="bg-white/60 rounded-xl p-5 flex flex-col">
            <p className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading mb-4">
              Line Items
            </p>

            {lineItems.length > 0 ? (
              <>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-foreground/40 pb-2 pr-2">
                        Description
                      </th>
                      <th className="text-center text-[10px] font-semibold uppercase tracking-wider text-foreground/40 pb-2 px-2">
                        Qty
                      </th>
                      <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-foreground/40 pb-2 px-2">
                        Unit Price
                      </th>
                      <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-foreground/40 pb-2 pl-2">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, i) => (
                      <tr key={i} className="border-b border-border/20 last:border-0">
                        <td className="text-[12px] text-foreground py-2.5 pr-2">
                          {item.description}
                        </td>
                        <td className="text-[12px] text-foreground/70 text-center py-2.5 px-2 tabular-nums">
                          {item.qty}
                        </td>
                        <td className="text-[12px] text-foreground/70 text-right py-2.5 px-2 tabular-nums">
                          {formatCurrency(item.unitPrice, currency)}
                        </td>
                        <td className="text-[12px] text-foreground font-medium text-right py-2.5 pl-2 tabular-nums">
                          {formatCurrency(item.amount, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals footer — always show, with Total at the bottom */}
                <div className="mt-3 pt-2 border-t border-border/30 space-y-1">
                  {showSubtotalDiff && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-foreground/50">Subtotal</span>
                      <span className="text-[12px] text-foreground tabular-nums">
                        {formatCurrency(subtotalNum, currency)}
                      </span>
                    </div>
                  )}
                  {taxAmt > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-foreground/50">
                        Tax{invoice.tax_percent ? ` (${invoice.tax_percent}%)` : ""}
                      </span>
                      <span className="text-[12px] text-foreground tabular-nums">
                        {formatCurrency(taxAmt, currency)}
                      </span>
                    </div>
                  )}
                  {discountAmt > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-foreground/50">Discount</span>
                      <span className="text-[12px] text-emerald-600 tabular-nums">
                        -{formatCurrency(discountAmt, currency)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1.5 border-t border-border/20">
                    <span className="text-[13px] font-bold text-foreground">Total</span>
                    <span className="text-[13px] font-bold text-foreground tabular-nums">
                      {formatCurrency(totalNum, currency)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-8 flex-1">
                <span className="text-[12px] text-foreground/30 italic">No line items</span>
              </div>
            )}

            {/* Notes — simple subtitle at the bottom of the widget */}
            {invoice.notes && (
              <div className="mt-auto pt-3 border-t border-border/20">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-foreground/30 mb-1">Notes & Details</p>
                <p className="text-[11px] text-foreground/50 leading-relaxed whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
          </div>

          {/* ── Right column (narrow): Total Amount → Dates → Payment Info → Notes & Details ── */}
          <div className="flex flex-col gap-[3px] h-full">

            {/* Total Amount — top of right column, 30% taller */}
            <div className="bg-white/60 rounded-xl px-5 py-7 min-h-[110px]">
              <span className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading block mb-2">
                Total Amount
              </span>
              <span className="text-[28px] font-bold tabular-nums text-foreground leading-none block">
                {formatCurrency(totalNum, currency)}
              </span>
            </div>

            {/* Dates — Due Date + Sent Date */}
            <div className="bg-white/60 rounded-xl p-5">
              <span className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading block mb-4">
                Dates
              </span>
              <div>
                {/* Due Date */}
                <div className="pb-3.5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">
                    Due Date
                  </span>
                  <div className="mt-0.5">
                    <span className="text-[12px] font-semibold text-foreground tabular-nums">
                      {fmtDate(invoice.due_date)}
                    </span>
                    {dueDateSuffix && (
                      <span className={cn("text-[11px] font-medium ml-1.5", dueDateInfo?.color)}>
                        {dueDateSuffix}
                      </span>
                    )}
                    {displayStatus === "Paid" && invoice.paid_at && (
                      <span className="text-[11px] font-medium text-emerald-600 ml-1.5">
                        · Paid {fmtDate(invoice.paid_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Sent Date */}
                <div className="pt-3.5 border-t border-border/20">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">
                    Sent Date
                  </span>
                  <span className="text-[12px] font-semibold text-foreground block mt-0.5 tabular-nums">
                    {invoice.sent_at ? fmtDateTime(invoice.sent_at) : "Not sent yet"}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Info — label-above-value with dividers, fills remaining height */}
            {invoice.payment_info && (() => {
              const lines = parsePaymentLines(invoice.payment_info);
              return (
                <div className="bg-white/60 rounded-xl p-5 flex-1">
                  <span className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading block mb-4">
                    Payment Info
                  </span>
                  <div>
                    {lines.map((line, i) =>
                      line.key ? (
                        <div
                          key={i}
                          className={cn(
                            "pb-3.5",
                            i > 0 && "pt-3.5 border-t border-border/20"
                          )}
                        >
                          <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">
                            {line.key}
                          </span>
                          <span className="text-[12px] font-semibold text-foreground block mt-0.5">
                            {line.value}
                          </span>
                        </div>
                      ) : (
                        <p
                          key={i}
                          className={cn(
                            "text-[12px] text-foreground pb-3.5",
                            i > 0 && "pt-3.5 border-t border-border/20"
                          )}
                        >
                          {line.value}
                        </p>
                      )
                    )}
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      </div>
    </div>
  );
}
