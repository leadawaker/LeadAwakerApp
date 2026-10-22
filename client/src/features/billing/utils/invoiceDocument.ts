import i18n from "@/i18n";
import type { InvoiceRow } from "../types";
import type { AccountRow } from "@/features/accounts/components/AccountDetailsDialog";
import { parseLineItems } from "../types";

// ── Printable invoice (A4) ────────────────────────────────────────────────────
// One template for every invoice PDF. The document language is chosen per
// download (EN / NL / PT) and is independent of the app's UI language.

export type InvoiceLanguage = "en" | "nl" | "pt";
export const INVOICE_LANGUAGES: InvoiceLanguage[] = ["en", "nl", "pt"];

const LOCALES: Record<InvoiceLanguage, string> = { en: "en-GB", nl: "nl-NL", pt: "pt-BR" };

// Sender details printed on every invoice. Lead Awaker is an eenmanszaak, so
// the owner's name is part of the legal identity on the invoice.
export const INVOICE_SENDER = {
  company: "Lead Awaker",
  owner: "Gabriel Barbosa Fronza",
  street: "Christiaan Huygensweg 32",
  postalCity: "5223 BH ’s-Hertogenbosch",
  country: { en: "The Netherlands", nl: "Nederland", pt: "Países Baixos" } as Record<InvoiceLanguage, string>,
  phone: "+31 6 17862359",
  email: "gabriel@leadawaker.com",
  website: "www.leadawaker.com",
  iban: "NL50 FNOM 0173 6400 07",
  bank: "Finom",
  accountHolder: "Lead Awaker",
  kvk: "99366738",
  vat: "NL002488258B44",
};

/** Map an account's language ("Dutch", "nl", "Portuguese", ...) to an invoice language. */
export function invoiceLanguageFor(accountLanguage: string | null | undefined, fallback: string): InvoiceLanguage {
  const pick = (v: string | null | undefined): InvoiceLanguage | null => {
    const s = (v || "").trim().toLowerCase();
    if (s.startsWith("nl") || s.startsWith("dutch") || s.startsWith("neder")) return "nl";
    if (s.startsWith("pt") || s.startsWith("portug")) return "pt";
    if (s.startsWith("en")) return "en";
    return null;
  };
  return pick(accountLanguage) ?? pick(fallback) ?? "en";
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function nl2br(v: string): string {
  return esc(v).replace(/\n/g, "<br>");
}

// Payment text that older invoices stored by default; the template prints these
// details itself, so this exact block is not repeated on the page.
function isDefaultPaymentInfo(text: string): boolean {
  const s = text.replace(/\s+/g, "");
  return !s || (s.includes(INVOICE_SENDER.iban.replace(/\s+/g, "")) && /^Paymentmethod:/i.test(s));
}

export function buildInvoiceHtml(invoice: InvoiceRow, account: AccountRow | null | undefined, lang: InvoiceLanguage): string {
  const t = i18n.getFixedT(lang, "billing", "invoices.document");
  const locale = LOCALES[lang];
  const currency = invoice.currency || "EUR";
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number.isFinite(n) ? n : 0);
  const date = (v: string | null | undefined) => {
    if (!v) return "—";
    const d = new Date(v);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  };
  const num = (v: string | null | undefined) => parseFloat(v || "0") || 0;

  const lineItems = parseLineItems(invoice.line_items);
  const subtotal = num(invoice.subtotal);
  const taxAmt = num(invoice.tax_amount);
  const discountAmt = num(invoice.discount_amount);
  const total = num(invoice.total);
  const taxPercent = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(num(invoice.tax_percent));
  const number = invoice.invoice_number || "";

  const recipient = [
    `<strong>${esc(invoice.account_name || account?.name || "—")}</strong>`,
    account?.address ? nl2br(account.address) : "",
    account?.tax_id ? `${esc(t("vatId"))}: ${esc(account.tax_id)}` : "",
  ].filter(Boolean).join("<br>");

  const meta = [
    [t("invoiceNumber"), number],
    [t("invoiceDate"), date(invoice.issued_date)],
    [t("dueDate"), date(invoice.due_date)],
    invoice.title ? [t("project"), invoice.title] : null,
  ].filter(Boolean) as string[][];

  const rows = lineItems.map((item) => `
    <tr>
      <td>${nl2br(item.description || "")}</td>
      <td class="qty">${esc(item.qty)}</td>
      <td class="num">${money(item.unitPrice)}</td>
      <td class="num">${money(item.amount)}</td>
    </tr>`).join("");

  const totals = [
    `<tr><td>${esc(t("subtotal"))}</td><td>${money(subtotal)}</td></tr>`,
    discountAmt > 0 ? `<tr><td>${esc(t("discount"))}</td><td>−${money(discountAmt)}</td></tr>` : "",
    taxAmt > 0 || num(invoice.tax_percent) > 0
      ? `<tr><td>${esc(t("vat", { percent: taxPercent }))}</td><td>${money(taxAmt)}</td></tr>`
      : "",
    `<tr class="grand"><td>${esc(t("total"))}</td><td>${money(total)}</td></tr>`,
  ].join("");

  const paymentInfo = (invoice.payment_info || "").trim();
  const customPayment = paymentInfo && !isDefaultPaymentInfo(paymentInfo);
  // The IBAN is bold and both it and the invoice number must not wrap, so they
  // go in after escaping.
  const IBAN_SLOT = "%%IBAN%%";
  const NUMBER_SLOT = "%%NUMBER%%";
  const dueKey = invoice.due_date ? "" : "NoDate";
  const payLine = customPayment
    ? esc(t(`paymentRequestCustom${dueKey}`, { date: date(invoice.due_date), number: NUMBER_SLOT }))
    : esc(t(`paymentRequest${dueKey}`, { date: date(invoice.due_date), iban: IBAN_SLOT, holder: INVOICE_SENDER.accountHolder, number: NUMBER_SLOT }))
        .replace(IBAN_SLOT, `<strong class="nowrap">${INVOICE_SENDER.iban}</strong>`);
  const payHtml = payLine.replace(NUMBER_SLOT, `<span class="nowrap">${esc(number)}</span>`);

  const s = INVOICE_SENDER;
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>${esc(t("title"))} ${esc(number)} - ${esc(s.company)}</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 210mm; }
  body {
    font-family: "Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #1F1A14; font-size: 9.5pt; line-height: 1.45; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page { position: relative; min-height: 297mm; padding: 18mm 20mm 40mm; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; }
  .logo { height: 13mm; width: auto; }
  .from { text-align: right; font-size: 8.5pt; color: #5a5146; line-height: 1.55; }
  .from strong, .to strong { color: #1F1A14; font-weight: 700; }
  .to { margin-top: 20mm; font-size: 10pt; line-height: 1.55; }
  h1 { margin-top: 16mm; font-size: 20pt; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; }
  .meta { margin-top: 4mm; border-collapse: collapse; }
  .meta td { padding: 0.6mm 0; }
  .meta td:first-child { color: #5a5146; width: 38mm; }
  .meta td:last-child { font-weight: 600; }
  table.lines { margin-top: 12mm; width: 100%; border-collapse: collapse; }
  .lines th {
    text-align: left; font-size: 8pt; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: #5a5146; padding: 0 0 2.5mm; border-bottom: 1.2pt solid #1F1A14;
  }
  .lines td { padding: 3.5mm 0; border-bottom: 0.5pt solid #d9d1c2; vertical-align: top; }
  .lines .num { text-align: right; white-space: nowrap; width: 32mm; }
  .lines .qty { text-align: center; width: 20mm; }
  .totals { margin-top: 6mm; margin-left: auto; width: 82mm; border-collapse: collapse; }
  .totals td { padding: 1.4mm 0; }
  .totals td:last-child { text-align: right; white-space: nowrap; }
  .totals tr.grand td { border-top: 1.2pt solid #1F1A14; padding-top: 2.5mm; font-weight: 700; font-size: 11pt; }
  .pay { margin-top: 14mm; max-width: 150mm; }
  .block { margin-top: 8mm; max-width: 150mm; }
  .block h2 { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #5a5146; margin-bottom: 1.5mm; }
  .nowrap { white-space: nowrap; }
  footer {
    position: absolute; left: 20mm; right: 20mm; bottom: 14mm;
    display: grid; grid-template-columns: 1.15fr 1.2fr 1.35fr 1.2fr; gap: 5mm;
    border-top: 0.5pt solid #d9d1c2; padding-top: 4mm;
    font-size: 7.5pt; line-height: 1.6; color: #5a5146;
  }
  footer strong { color: #1F1A14; font-weight: 700; }
</style>
</head>
<body>
<div class="page">
  <div class="top">
    <img class="logo" src="${window.location.origin}/invoice-logo.svg" alt="${esc(s.company)}">
    <div class="from">
      <strong>${esc(s.company)}</strong><br>
      ${esc(s.owner)}<br>
      ${esc(s.street)}<br>
      ${esc(s.postalCity)}<br>
      ${esc(s.phone)}<br>
      ${esc(s.email)}
    </div>
  </div>

  <div class="to">${recipient}</div>

  <h1>${esc(t("title"))}</h1>
  <table class="meta">
    ${meta.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}
  </table>

  <table class="lines">
    <thead>
      <tr>
        <th>${esc(t("description"))}</th>
        <th class="qty">${esc(t("qty"))}</th>
        <th class="num">${esc(t("price"))}</th>
        <th class="num">${esc(t("amount"))}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <table class="totals">${totals}</table>

  <p class="pay">${payHtml}</p>
  ${customPayment ? `<div class="block"><h2>${esc(t("paymentDetails"))}</h2><p>${nl2br(paymentInfo)}</p></div>` : ""}
  ${invoice.notes ? `<div class="block"><h2>${esc(t("notes"))}</h2><p>${nl2br(invoice.notes)}</p></div>` : ""}

  <footer>
    <div><strong>${esc(s.company)}</strong><br>${esc(s.owner)}<br>${esc(s.street)}<br>${esc(s.postalCity)}</div>
    <div>${esc(s.phone)}<br>${esc(s.email)}<br>${esc(s.website)}</div>
    <div>IBAN ${esc(s.iban)}<br>${esc(t("accountHolder"))}: ${esc(s.accountHolder)}<br>${esc(t("bank"))}: ${esc(s.bank)}</div>
    <div>${esc(t("kvk"))} ${esc(s.kvk)}<br>${esc(t("vatNumber"))} ${esc(s.vat)}</div>
  </footer>
</div>
</body>
</html>`;
}

/** Print the invoice through a hidden iframe so the app's CSS never leaks in. */
export function printInvoice(invoice: InvoiceRow, account: AccountRow | null | undefined, lang: InvoiceLanguage): void {
  const FRAME_ID = "__inv_print_frame__";
  document.getElementById(FRAME_ID)?.remove();
  const iframe = document.createElement("iframe");
  iframe.id = FRAME_ID;
  iframe.style.cssText = "position:fixed;width:0;height:0;border:none;left:-9999px;top:-9999px;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(buildInvoiceHtml(invoice, account, lang));
  doc.close();

  let fired = false;
  const fire = () => {
    if (fired) return;
    fired = true;
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.getElementById(FRAME_ID)?.remove(), 500);
    }, 50);
  };
  const printWhenReady = () => {
    const images = Array.from(doc.querySelectorAll("img")).filter((img) => !img.complete);
    const imagesReady = Promise.all(images.map((img) => new Promise((r) => {
      img.addEventListener("load", r, { once: true });
      img.addEventListener("error", r, { once: true });
    })));
    // Web font is a nicety: never wait on it for more than 2s.
    const fontsReady = Promise.race([doc.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 2000))]);
    Promise.all([imagesReady, fontsReady]).then(fire);
  };
  iframe.onload = printWhenReady;
  if (doc.readyState === "complete") printWhenReady();
}
