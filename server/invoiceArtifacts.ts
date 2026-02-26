import { chromium } from "playwright-core";
import fs from "fs";
import path from "path";

const INVOICES_DIR = "/home/gabriel/Images/Invoices";
const REVENUE_CSV = path.join(INVOICES_DIR, "revenue.csv");
const LOGO_PATH = "file:///home/gabriel/docker/code-server/config/workspace/LeadAwakerApp/client/public/2.Full-LOGO.svg";

function getQuarter(date: Date): string {
  return `Q${Math.ceil((date.getMonth() + 1) / 3)}`;
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return "—";
  const d = new Date(val);
  return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(amount: number | string | null | undefined, currency = "EUR"): string {
  const n = Number(amount ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "EUR" }).format(n);
}

function buildInvoiceHtml(invoice: any): string {
  const currency = invoice.currency || "EUR";
  const subtotalNum = parseFloat(invoice.subtotal || "0");
  const taxAmt = parseFloat(invoice.taxAmount || invoice.tax_amount || "0");
  const discountAmt = parseFloat(invoice.discountAmount || invoice.discount_amount || "0");
  const totalNum = parseFloat(invoice.total || "0");
  const taxPercent = invoice.taxPercent || invoice.tax_percent;
  const accountName = invoice.accountName || invoice.account_name || "—";
  const invoiceNumber = invoice.invoiceNumber || invoice.invoice_number;
  const issuedDate = invoice.issuedDate || invoice.issued_date;
  const dueDate = invoice.dueDate || invoice.due_date;
  const paymentInfo = invoice.paymentInfo || invoice.payment_info;

  // Line items — stored as JSON array
  const rawItems: any[] = Array.isArray(invoice.lineItems)
    ? invoice.lineItems
    : (typeof invoice.lineItems === "string" ? JSON.parse(invoice.lineItems || "[]") : []);

  const itemRows = rawItems.map((item: any) =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#374151;">${item.description || ""}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#374151;text-align:center;">${item.qty ?? item.quantity ?? 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#374151;text-align:right;">${formatCurrency(item.unitPrice ?? item.unit_price, currency)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#374151;text-align:right;font-weight:600;">${formatCurrency(item.amount, currency)}</td>
    </tr>`
  ).join("");

  const totalsRows = [
    `<tr><td style="padding:4px 12px;font-size:13px;color:#6B7280;">Subtotal</td><td style="padding:4px 12px;font-size:13px;text-align:right;">${formatCurrency(subtotalNum, currency)}</td></tr>`,
    taxAmt > 0 ? `<tr><td style="padding:4px 12px;font-size:13px;color:#6B7280;">Tax${taxPercent ? ` (${taxPercent}%)` : ""}</td><td style="padding:4px 12px;font-size:13px;text-align:right;">${formatCurrency(taxAmt, currency)}</td></tr>` : "",
    discountAmt > 0 ? `<tr><td style="padding:4px 12px;font-size:13px;color:#6B7280;">Discount</td><td style="padding:4px 12px;font-size:13px;text-align:right;color:#059669;">-${formatCurrency(discountAmt, currency)}</td></tr>` : "",
    `<tr><td style="padding:6px 12px;font-size:13px;font-weight:700;border-top:1px solid #E5E7EB;color:#111827;">Total</td><td style="padding:6px 12px;font-size:13px;font-weight:700;text-align:right;border-top:1px solid #E5E7EB;color:#111827;">${formatCurrency(totalNum, currency)}</td></tr>`,
  ].join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoiceNumber || ""}</title>
  <style>
    body { margin: 0; padding: 0; }
    @media print { body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
  </style>
</head>
<body>
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;color:#111827;background:#fff;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;">
      <img src="${LOGO_PATH}" alt="Lead Awaker" style="height:100px;width:auto;" />
      <div>
        <div style="font-size:28px;font-weight:700;text-align:right;">INVOICE</div>
        <div style="text-align:right;font-size:13px;color:#6B7280;margin-top:4px;">
          ${invoiceNumber ? `#${invoiceNumber}<br>` : ""}
          Issued: ${fmtDate(issuedDate)}<br>
          Due: ${fmtDate(dueDate)}
        </div>
      </div>
    </div>
    <div style="margin-bottom:28px;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#9CA3AF;margin-bottom:6px;">Bill To</div>
      <div style="font-size:15px;font-weight:700;margin-bottom:3px;">${accountName}</div>
    </div>
    ${invoice.title ? `<p style="font-size:16px;font-weight:600;margin:0 0 16px;">${invoice.title}</p>` : ""}
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
    ${paymentInfo ? `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #E5E7EB;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#9CA3AF;margin-bottom:8px;">Payment Info</div><p style="margin:0;font-size:13px;color:#374151;white-space:pre-wrap;">${paymentInfo}</p></div>` : ""}
    ${invoice.notes ? `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #E5E7EB;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#9CA3AF;margin-bottom:8px;">Notes</div><p style="margin:0;font-size:13px;color:#374151;white-space:pre-wrap;">${invoice.notes}</p></div>` : ""}
  </div>
</body>
</html>`;
}

export async function saveInvoiceArtifacts(invoice: any): Promise<void> {
  const paidAt = invoice.paidAt ? new Date(invoice.paidAt) : new Date();
  const year = paidAt.getFullYear();
  const quarter = getQuarter(paidAt);

  // --- PDF ---
  const dir = path.join(INVOICES_DIR, String(year), quarter);
  fs.mkdirSync(dir, { recursive: true });

  const currency = invoice.currency || "EUR";
  const amount = `${currency}${Number(invoice.total ?? 0).toFixed(2)}`;
  const accountName = (invoice.accountName || invoice.account_name || "Unknown").replace(/[/\\?%*:|"<>]/g, "-");
  const invoiceNumber = (invoice.invoiceNumber || invoice.invoice_number || "unknown").replace(/[/\\?%*:|"<>]/g, "-");
  const datePart = paidAt.toISOString().slice(0, 10);
  const filename = `${datePart}_${accountName}_${invoiceNumber}_${amount}.pdf`;
  const pdfPath = path.join(dir, filename);

  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setContent(buildInvoiceHtml(invoice), { waitUntil: "networkidle" });
    await page.pdf({ path: pdfPath, format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }

  console.log(`[invoice-artifacts] PDF saved: ${pdfPath}`);

  // --- CSV ---
  const vatRate = invoice.taxPercent ?? invoice.tax_percent ?? 0;
  const subtotal = Number(invoice.subtotal ?? 0);
  const discountAmt = Number(invoice.discountAmount ?? invoice.discount_amount ?? 0);
  const excl = subtotal - discountAmt;

  const row = [
    datePart,
    year,
    quarter,
    invoice.accountName || invoice.account_name || "",
    "",  // Country — not in schema
    invoice.invoiceNumber || invoice.invoice_number || "",
    invoice.title || "Services",
    currency,
    excl.toFixed(2),
    vatRate,
    Number(invoice.taxAmount ?? invoice.tax_amount ?? 0).toFixed(2),
    Number(invoice.total ?? 0).toFixed(2),
    "Paid",
    datePart,
    invoice.notes || "",
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");

  fs.appendFileSync(REVENUE_CSV, row + "\n");
  console.log(`[invoice-artifacts] CSV row appended to ${REVENUE_CSV}`);
}
