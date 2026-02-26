export type InvoiceLineItem = {
  description: string;
  qty: number;
  unitPrice: number;
  amount: number;
};

export type InvoiceStatus = "Draft" | "Sent" | "Viewed" | "Paid" | "Overdue" | "Cancelled";
export type ContractStatus = "Draft" | "Sent" | "Viewed" | "Signed" | "Expired" | "Cancelled";

export type InvoiceRow = {
  id: number;
  Accounts_id: number | null;
  account_name: string | null;
  invoice_number: string | null;
  title: string | null;
  status: string | null;
  currency: string | null;
  subtotal: string | null;
  tax_percent: string | null;
  tax_amount: string | null;
  discount_amount: string | null;
  total: string | null;
  line_items: InvoiceLineItem[] | string | null;
  notes: string | null;
  payment_info: string | null;
  issued_date: string | null;
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  viewed_at: string | null;
  viewed_count: number | null;
  view_token: string | null;
  created_at: string | null;
  updated_at: string | null;
  [key: string]: any;
};

export type ContractRow = {
  id: number;
  Accounts_id: number | null;
  account_name: string | null;
  title: string | null;
  status: string | null;
  description: string | null;
  file_data: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  start_date: string | null;
  end_date: string | null;
  signed_at: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  viewed_count: number | null;
  view_token: string | null;
  created_at: string | null;
  updated_at: string | null;
  deal_type: string | null;
  payment_trigger: string | null;
  value_per_booking: string | null;
  fixed_fee_amount: string | null;
  deposit_amount: string | null;
  monthly_fee: string | null;
  cost_passthrough_rate: string | null;
  campaigns_id: number | null;
  currency: string | null;
  language: string | null;
  timezone: string | null;
  invoice_cadence: string | null;
  payment_preset: string | null;
  contract_text: string | null;
  signer_name: string | null;
  [key: string]: any;
};

// ── Expense ──────────────────────────────────────────────────────────────────
export type ExpenseRow = {
  id: number;
  date: string | null;
  year: number | null;
  quarter: string | null;
  supplier: string | null;
  country: string | null;
  invoiceNumber: string | null;
  description: string | null;
  currency: string | null;
  amountExclVat: string | null;   // numeric as string from Drizzle
  vatRatePct: string | null;
  vatAmount: string | null;
  totalAmount: string | null;
  nlBtwDeductible: boolean;
  notes: string | null;
  pdfPath: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const INVOICE_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  Draft:     { bg: "#F4F4F5", text: "#52525B", dot: "#94A3B8" },
  Sent:      { bg: "#DBEAFE", text: "#1D4ED8", dot: "#3B82F6" },
  Viewed:    { bg: "#EDE9FE", text: "#5B21B6", dot: "#8B5CF6" },
  Paid:      { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  Overdue:   { bg: "#FFE4E6", text: "#9F1239", dot: "#F43F5E" },
  Cancelled: { bg: "#F4F4F5", text: "#52525B", dot: "#94A3B8" },
};

export const CONTRACT_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  Draft:     { bg: "#F4F4F5", text: "#52525B", dot: "#94A3B8" },
  Sent:      { bg: "#DBEAFE", text: "#1D4ED8", dot: "#3B82F6" },
  Viewed:    { bg: "#EDE9FE", text: "#5B21B6", dot: "#8B5CF6" },
  Signed:    { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  Expired:   { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  Cancelled: { bg: "#F4F4F5", text: "#52525B", dot: "#94A3B8" },
};

export function parseLineItems(raw: InvoiceLineItem[] | string | null): InvoiceLineItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

export function formatCurrency(value: string | number | null | undefined, currency = "EUR"): string {
  const num = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  if (isNaN(num)) return "\u20AC0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
}

export function isOverdue(invoice: InvoiceRow): boolean {
  if (invoice.status === "Paid" || invoice.status === "Cancelled" || invoice.status === "Draft") return false;
  if (!invoice.due_date) return false;
  return new Date(invoice.due_date) < new Date();
}
