// ── Contract Template ─────────────────────────────────────────────────────────
// Generates a complete English service agreement from form fields.

export type DealType = "performance" | "cost_passthrough" | "fixed_fee" | "deposit" | "monthly_retainer" | "hybrid" | "";
export type PaymentTrigger = "call_booked" | "closed_sale" | "";
export type Currency = "EUR" | "USD" | "GBP" | "BRL";
export type InvoiceCadence = "weekly" | "biweekly" | "monthly";
export type PaymentPreset = "EU" | "BR";

export interface ContractFormFields {
  title: string;
  accountName: string;
  campaignName: string;
  startDate: string;
  endDate: string;
  timezone: string;
  language: string;
  dealType: DealType;
  paymentTrigger: PaymentTrigger;
  valuePerBooking: string;
  currency: Currency | string;
  fixedFeeAmount: string;
  depositAmount: string;
  monthlyFee: string;
  costPassthroughRate: string;
  invoiceCadence: InvoiceCadence | string;
  paymentPreset: PaymentPreset | string;
  signerName: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€", USD: "$", GBP: "£", BRL: "R$",
};

const CADENCE_LABELS: Record<string, string> = {
  weekly: "weekly", biweekly: "bi-weekly", monthly: "monthly",
};

const TRIGGER_LABELS: Record<string, string> = {
  call_booked: "per qualified call booked",
  closed_sale: "per closed sale (completed by the client's team)",
};

function sym(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

function fmtMoney(currency: string, value: string): string {
  const n = parseFloat(value);
  if (!value || isNaN(n)) return `${sym(currency)}[TBD]`;
  return `${sym(currency)}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  if (!iso) return "[TBD]";
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
}

function buildDealSection(f: ContractFormFields): string {
  const c = f.currency || "EUR";
  const trigger = TRIGGER_LABELS[f.paymentTrigger] ?? "per qualifying event";
  const lines: string[] = [];

  if (!f.dealType) return "  Deal structure: To be agreed between the parties.";

  switch (f.dealType) {
    case "performance":
      lines.push(`  Model: Zero-risk / Performance`);
      lines.push(`  All campaign infrastructure and operational costs are covered exclusively by Lead Awaker.`);
      lines.push(`  The Client incurs no upfront fees or recurring costs.`);
      if (f.valuePerBooking) lines.push(`  Fee: ${fmtMoney(c, f.valuePerBooking)} ${trigger}.`);
      break;
    case "cost_passthrough":
      lines.push(`  Model: Cost Passthrough`);
      lines.push(`  The Client agrees to reimburse ${f.costPassthroughRate ? `${f.costPassthroughRate}%` : "[TBD]%"} of actual campaign infrastructure and platform costs incurred by Lead Awaker.`);
      if (f.valuePerBooking) lines.push(`  Performance fee: ${fmtMoney(c, f.valuePerBooking)} ${trigger}.`);
      break;
    case "fixed_fee":
      lines.push(`  Model: Fixed Upfront Fee`);
      lines.push(`  The Client agrees to pay a fixed fee of ${fmtMoney(c, f.fixedFeeAmount)} due at signing of this Agreement.`);
      if (f.valuePerBooking) lines.push(`  Additional performance fee: ${fmtMoney(c, f.valuePerBooking)} ${trigger}.`);
      break;
    case "deposit":
      lines.push(`  Model: Deposit + Return`);
      lines.push(`  The Client agrees to pay a refundable deposit of ${fmtMoney(c, f.depositAmount)}.`);
      lines.push(`  The deposit shall be returned to the Client upon completion of agreed performance criteria.`);
      if (f.valuePerBooking) lines.push(`  Performance fee: ${fmtMoney(c, f.valuePerBooking)} ${trigger}.`);
      break;
    case "monthly_retainer":
      lines.push(`  Model: Monthly Retainer`);
      lines.push(`  The Client agrees to pay a fixed retainer of ${fmtMoney(c, f.monthlyFee)} per month, payable in advance.`);
      if (f.valuePerBooking) lines.push(`  Additional performance fee: ${fmtMoney(c, f.valuePerBooking)} ${trigger}.`);
      break;
    case "hybrid":
      lines.push(`  Model: Hybrid`);
      if (f.monthlyFee) lines.push(`  Monthly retainer: ${fmtMoney(c, f.monthlyFee)}/month.`);
      if (f.fixedFeeAmount) lines.push(`  Fixed fee: ${fmtMoney(c, f.fixedFeeAmount)} due at signing.`);
      if (f.depositAmount) lines.push(`  Refundable deposit: ${fmtMoney(c, f.depositAmount)}.`);
      if (f.costPassthroughRate) lines.push(`  Cost passthrough: ${f.costPassthroughRate}% of campaign costs.`);
      if (f.valuePerBooking) lines.push(`  Performance fee: ${fmtMoney(c, f.valuePerBooking)} ${trigger}.`);
      break;
  }

  return lines.join("\n");
}

function buildPaymentInfo(preset: string): string {
  if (preset === "BR") {
    return [
      "  Payment method: Bank transfer",
      "  Titular: Gabriel Barbosa Fronza",
      "  Banco: 380 (PicPay / Original)",
      "  Agência: 0001 | Conta Corrente: 98927440-3",
      "  CPF: 056.536.669.63",
      "  Email: gabriel@leadawaker.com",
    ].join("\n");
  }
  // Default: EU
  return [
    "  Payment method: Bank transfer (SEPA / International)",
    "  Account holder: Gabriel Barbosa Fronza",
    "  Bank: N26",
    "  IBAN: DE35 1001 1001 2939 5454 81",
    "  Company registration (KVK): 99366738",
    "  Address: Christiaan Huygensweg 32, s'Hertogenbosch, The Netherlands",
    "  Email: gabriel@leadawaker.com",
  ].join("\n");
}

export function generateContractText(f: ContractFormFields): string {
  const cadence = CADENCE_LABELS[f.invoiceCadence] ?? "weekly";
  const clientName = f.accountName || "[CLIENT NAME]";
  const signerDisplay = f.signerName ? `${f.signerName} (${clientName})` : clientName;
  const campaignClause = f.campaignName
    ? `\n  Campaign name: ${f.campaignName}`
    : "";

  return `LEAD AWAKER — SERVICE AGREEMENT
${"─".repeat(60)}

This Service Agreement ("Agreement") is entered into as of ${fmtDate(f.startDate)}, between:

  Service Provider:
    Gabriel Barbosa Fronza (trading as "Lead Awaker")
    Christiaan Huygensweg 32, s'Hertogenbosch, The Netherlands
    KVK: 99366738 | Email: gabriel@leadawaker.com
    Phone: +55 47 97400 2162

  Client:
    ${clientName}${f.signerName ? `\n    Authorised signatory: ${f.signerName}` : ""}

${"─".repeat(60)}
1. SCOPE OF SERVICES
${"─".repeat(60)}

Lead Awaker agrees to provide the following services to the Client:${campaignClause}

  - Automated lead reactivation via WhatsApp, SMS, and/or Instagram,
    powered by Artificial Intelligence.
  - Configuration, monitoring, and optimization of outreach campaigns.
  - Weekly check-in call with the Client to review campaign performance,
    discuss results, and align on next steps.
  - Access to the Lead Awaker CRM dashboard for real-time campaign tracking.

${"─".repeat(60)}
2. TERM
${"─".repeat(60)}

  Start date: ${fmtDate(f.startDate)}
  End date:   ${fmtDate(f.endDate)}
  Timezone:   ${f.timezone || "Europe/Amsterdam"}

This Agreement may be renewed by mutual written agreement of both parties prior to the end date.

${"─".repeat(60)}
3. COMMERCIAL TERMS
${"─".repeat(60)}

${buildDealSection(f)}

${"─".repeat(60)}
4. PAYMENT TERMS
${"─".repeat(60)}

  Invoicing frequency: ${cadence.charAt(0).toUpperCase() + cadence.slice(1)}
  Payment due:         Within 7 (seven) days of invoice date
  Currency:            ${f.currency || "EUR"}
  Late payment:        Invoices unpaid after 14 days may incur a 2% monthly late fee.

  Additional information regarding payment amounts, line items, and applicable
  taxes will be specified in each individual invoice issued by Lead Awaker.

${buildPaymentInfo(f.paymentPreset || "EU")}

${"─".repeat(60)}
5. CLIENT RESPONSIBILITIES
${"─".repeat(60)}

  The Client is solely responsible for:
  - The origin, legality, and legitimacy of all leads provided.
  - Ensuring compliance with applicable data protection laws (e.g. GDPR),
    consumer protection regulations, and platform usage policies.
  - The commercial content, products, and services promoted through campaigns.
  - Providing accurate and up-to-date contact information for leads.

  The Client represents that they hold a valid legal basis to contact the
  provided leads and that all applicable laws and platform policies are respected.

${"─".repeat(60)}
6. RESULTS AND PERFORMANCE DISCLAIMER
${"─".repeat(60)}

  Unless expressly agreed otherwise, Lead Awaker's services constitute an
  obligation of means and not an obligation of results.

  In performance-based arrangements, results are evaluated within up to 30
  (thirty) days from the campaign start date. If agreed performance criteria
  are not met within this period, payment obligations may be waived in
  accordance with the specific commercial terms above.

${"─".repeat(60)}
7. THIRD-PARTY PLATFORMS
${"─".repeat(60)}

  Lead Awaker's services rely on third-party platforms including WhatsApp,
  Instagram, SMS providers, and cloud infrastructure services. Lead Awaker has
  no control over the policies, availability, limitations, suspensions, or
  account restrictions imposed by such platforms.

  Lead Awaker shall not be liable for disruptions, blocks, or bans resulting
  from decisions taken by third-party platforms, provided that Lead Awaker has
  acted in good faith and in compliance with platform policies.

${"─".repeat(60)}
8. DATA PROCESSING
${"─".repeat(60)}

  The Client acts as the Data Controller for all personal data shared with
  Lead Awaker. Lead Awaker acts as a Data Processor and processes personal data
  strictly in accordance with Client instructions and applicable EU data
  protection laws, including the General Data Protection Regulation (GDPR).

  Lead Awaker implements appropriate technical and organisational measures to
  protect personal data against unauthorised access, loss, or disclosure.

${"─".repeat(60)}
9. INTELLECTUAL PROPERTY
${"─".repeat(60)}

  All systems, workflows, automation logic, AI models, and methodologies
  developed by Lead Awaker remain its exclusive intellectual property, unless
  otherwise agreed in writing. The Client is granted a limited, non-transferable
  right to use such materials solely for the duration and purpose of this Agreement.

${"─".repeat(60)}
10. LIMITATION OF LIABILITY
${"─".repeat(60)}

  To the maximum extent permitted by applicable law, Lead Awaker shall not be
  liable for indirect damages, loss of profits, loss of business opportunities,
  account suspensions by third-party platforms, or consequential damages
  arising from the use of its services.

  Any potential liability of Lead Awaker shall be limited to the amounts
  effectively paid by the Client under this Agreement in the relevant period.

${"─".repeat(60)}
11. TERMINATION
${"─".repeat(60)}

  Either party may terminate this Agreement by providing written notice in
  accordance with the agreed commercial terms. Lead Awaker reserves the right
  to suspend or terminate services immediately if it identifies unlawful use,
  breach of this Agreement, or violation of applicable laws or platform policies.

  Unless otherwise stated, there are no penalties for cancellation.

${"─".repeat(60)}
12. GOVERNING LAW
${"─".repeat(60)}

  This Agreement shall be governed by and construed in accordance with
  applicable European Union law and, where necessary, the laws of the Netherlands.
  Any disputes shall be submitted to the competent courts of the Netherlands,
  without prejudice to mandatory legal provisions.

${"─".repeat(60)}
13. ENTIRE AGREEMENT
${"─".repeat(60)}

  This Agreement, together with any invoices and annexes issued pursuant to it,
  constitutes the entire agreement between the parties with respect to its
  subject matter and supersedes all prior discussions, representations, or
  agreements. Amendments must be made in writing and signed by both parties.

${"─".repeat(60)}
SIGNATURES
${"─".repeat(60)}

  CLIENT                              LEAD AWAKER

  ____________________________        ____________________________
  ${signerDisplay}${" ".repeat(Math.max(0, 32 - signerDisplay.length))}Gabriel Barbosa Fronza

  Date: ______________________        Date: ______________________

  Signature: _________________        Signature: _________________


${"─".repeat(60)}
  Lead Awaker | gabriel@leadawaker.com | +55 47 97400 2162
  Christiaan Huygensweg 32, s'Hertogenbosch, NL | KVK 99366738
${"─".repeat(60)}
`;
}
