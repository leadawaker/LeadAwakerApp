import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, X, Globe, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { InvoiceRow, InvoiceLineItem } from "../types";
import { parseLineItems } from "../types";
import { fetchCampaigns } from "../../campaigns/api/campaignsApi";

// ── Sender Presets ────────────────────────────────────────────────────────────

export type SenderPreset = "EU" | "BR";

// TODO: Fetch from server-side API
export const SENDER_PRESETS: Record<SenderPreset, { label: string; flag: string; paymentInfo: string }> = {
  EU: {
    label: "EU — N26",
    flag: "🇳🇱",
    paymentInfo: "",
  },
  BR: {
    label: "BR — Banco 380",
    flag: "🇧🇷",
    paymentInfo: "",
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

const CURRENCIES = ["USD", "EUR", "GBP", "BRL"] as const;

const DEFAULT_LINE_ITEM: InvoiceLineItem = {
  description: "",
  qty: 1,
  unitPrice: 0,
  amount: 0,
};

// Due date quick-pick presets (Net N days)
const DUE_PRESETS = [7, 15, 30, 45] as const;

interface InvoiceCreatePanelProps {
  editingInvoice: InvoiceRow | null;
  prefillInvoice?: InvoiceRow | null;
  nextInvoiceNumber?: string;
  accounts: Array<{ id: number; name: string | null; timezone?: string | null }>;
  isAgencyUser: boolean;
  onCreate: (payload: Record<string, any>) => Promise<any>;
  onUpdate: (id: number, patch: Record<string, any>) => Promise<any>;
  onClose: () => void;
}

// ── Detect preset from account timezone ──────────────────────────────────────

function detectPresetFromTimezone(timezone?: string | null): SenderPreset {
  if (!timezone) return "EU";
  const tz = timezone.toLowerCase();
  if (
    tz.includes("america/sao_paulo") ||
    tz.includes("america/fortaleza") ||
    tz.includes("america/manaus") ||
    tz.includes("america/belem") ||
    tz.includes("brazil") ||
    tz.includes("brt") ||
    tz.startsWith("america/")
  ) {
    return "BR";
  }
  return "EU";
}

// Add N days to a YYYY-MM-DD string, returns YYYY-MM-DD
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InvoiceCreatePanel({
  editingInvoice,
  prefillInvoice,
  nextInvoiceNumber,
  accounts,
  isAgencyUser,
  onCreate,
  onUpdate,
  onClose,
}: InvoiceCreatePanelProps) {
  const isEditMode = editingInvoice !== null;
  const { toast } = useToast();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [invoiceNumber, setInvoiceNumber] = useState(nextInvoiceNumber ?? "");
  const [title, setTitle] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [currency, setCurrency] = useState("EUR");
  const [issuedDate, setIssuedDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([{ ...DEFAULT_LINE_ITEM }]);
  const [taxPercent, setTaxPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [paymentInfo, setPaymentInfo] = useState(SENDER_PRESETS.EU.paymentInfo);
  const [selectedPreset, setSelectedPreset] = useState<SenderPreset>("EU");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [campaignId, setCampaignId] = useState<string>("");
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  // Optional extra fields
  const [paidAt, setPaidAt] = useState("");
  const [sentAt, setSentAt] = useState("");
  const [showMoreFields, setShowMoreFields] = useState(false);

  // ── Populate / reset on mount or when editing/prefill changes ────────────────
  useEffect(() => {
    if (isEditMode && editingInvoice) {
      // Edit mode: populate from existing invoice
      setInvoiceNumber(editingInvoice.invoice_number || "");
      setTitle(editingInvoice.title || "");
      setAccountId(editingInvoice.Accounts_id ? String(editingInvoice.Accounts_id) : "");
      setCurrency(editingInvoice.currency || "EUR");
      setIssuedDate(
        editingInvoice.issued_date
          ? editingInvoice.issued_date.split("T")[0]
          : new Date().toISOString().split("T")[0],
      );
      setDueDate(editingInvoice.due_date ? editingInvoice.due_date.split("T")[0] : "");
      const parsed = parseLineItems(editingInvoice.line_items);
      setLineItems(parsed.length > 0 ? parsed : [{ ...DEFAULT_LINE_ITEM }]);
      setTaxPercent(editingInvoice.tax_percent ? parseFloat(editingInvoice.tax_percent) : 0);
      setDiscountAmount(editingInvoice.discount_amount ? parseFloat(editingInvoice.discount_amount) : 0);
      setNotes(editingInvoice.notes || "");
      setPaymentInfo(editingInvoice.payment_info || "");
      setPaidAt(editingInvoice.paid_at ? editingInvoice.paid_at.split("T")[0] : "");
      setSentAt(editingInvoice.sent_at ? editingInvoice.sent_at.split("T")[0] : "");
      setShowMoreFields(!!(editingInvoice.paid_at || editingInvoice.sent_at));
      setCampaignId("");
      setCampaigns([]);
    } else if (!isEditMode && prefillInvoice) {
      // Duplicate mode: prefill from source invoice, fresh dates + number
      setInvoiceNumber(nextInvoiceNumber ?? "");
      setTitle(`${prefillInvoice.title || "Invoice"} (Copy)`);
      setAccountId(prefillInvoice.Accounts_id ? String(prefillInvoice.Accounts_id) : "");
      setCurrency(prefillInvoice.currency || "EUR");
      setIssuedDate(new Date().toISOString().split("T")[0]);
      setDueDate("");
      const parsed = parseLineItems(prefillInvoice.line_items);
      setLineItems(parsed.length > 0 ? parsed : [{ ...DEFAULT_LINE_ITEM }]);
      setTaxPercent(prefillInvoice.tax_percent ? parseFloat(prefillInvoice.tax_percent) : 0);
      setDiscountAmount(prefillInvoice.discount_amount ? parseFloat(prefillInvoice.discount_amount) : 0);
      setNotes(prefillInvoice.notes || "");
      setPaymentInfo(prefillInvoice.payment_info || SENDER_PRESETS.EU.paymentInfo);
      setPaidAt("");
      setSentAt("");
      setShowMoreFields(false);
      setCampaignId("");
      setCampaigns([]);
    } else {
      // Create mode: blank form
      setInvoiceNumber(nextInvoiceNumber ?? "");
      setTitle("");
      setAccountId("");
      setCurrency("EUR");
      setIssuedDate(new Date().toISOString().split("T")[0]);
      setDueDate("");
      setLineItems([{ ...DEFAULT_LINE_ITEM }]);
      setTaxPercent(0);
      setDiscountAmount(0);
      setNotes("");
      setPaymentInfo(SENDER_PRESETS.EU.paymentInfo);
      setSelectedPreset("EU");
      setPaidAt("");
      setSentAt("");
      setShowMoreFields(false);
      setCampaignId("");
      setCampaigns([]);
    }
    setErrors({});
    setSaving(false);
  }, [editingInvoice, prefillInvoice]);

  // ── Auto-detect preset when account changes ─────────────────────────────────
  useEffect(() => {
    if (isEditMode) return; // don't override in edit mode
    const acct = accounts.find((a) => String(a.id) === accountId);
    if (!acct) return;
    const detected = detectPresetFromTimezone(acct.timezone);
    if (detected !== selectedPreset) {
      setSelectedPreset(detected);
      setPaymentInfo(SENDER_PRESETS[detected].paymentInfo);
    }
  }, [accountId, accounts, isEditMode]);

  // ── Fetch campaigns for selected account ──────────────────────────────────
  useEffect(() => {
    if (!accountId) {
      setCampaigns([]);
      setCampaignId("");
      return;
    }
    setCampaignsLoading(true);
    fetchCampaigns(Number(accountId))
      .then((data) => setCampaigns(data))
      .catch(() => setCampaigns([]))
      .finally(() => setCampaignsLoading(false));
  }, [accountId]);

  // ── Auto-fill title from campaign + account + invoice number ──────────────
  useEffect(() => {
    if (!campaignId || !accountId) return;
    const campaign = campaigns.find((c) => String(c.id || c.Id) === campaignId);
    const account = accounts.find((a) => String(a.id) === accountId);
    if (campaign && account) {
      const toSlug = (s: string) => String(s || "").replace(/\s+/g, "_");
      setTitle(
        `${toSlug(campaign.name || campaign.Name)}_${toSlug(account.name || "")}_${invoiceNumber}`,
      );
    }
  }, [campaignId]); // intentionally only campaignId — avoid infinite loops

  // ── Apply a preset ──────────────────────────────────────────────────────────
  function applyPreset(preset: SenderPreset) {
    setSelectedPreset(preset);
    setPaymentInfo(SENDER_PRESETS[preset].paymentInfo);
    if (preset === "BR") setCurrency("BRL");
    else if (preset === "EU") setCurrency("EUR");
  }

  // ── Due date quick-picks ────────────────────────────────────────────────────
  function applyNetDays(days: number) {
    const base = issuedDate || new Date().toISOString().split("T")[0];
    const computed = addDays(base, days);
    setDueDate(computed);
    setErrors((prev) => ({ ...prev, dueDate: "" }));
  }

  // Which Net-N pill is currently active (matches due date exactly)
  const activeNetPreset = useMemo(() => {
    if (!dueDate || !issuedDate) return null;
    for (const days of DUE_PRESETS) {
      if (addDays(issuedDate, days) === dueDate) return days;
    }
    return null;
  }, [dueDate, issuedDate]);

  // ── Line item helpers ───────────────────────────────────────────────────────
  function updateLineItem(index: number, field: keyof InvoiceLineItem, value: string | number) {
    setLineItems((prev) => {
      const next = [...prev];
      const item = { ...next[index] };
      if (field === "description") item.description = value as string;
      else if (field === "qty") item.qty = Number(value) || 0;
      else if (field === "unitPrice") item.unitPrice = Number(value) || 0;
      item.amount = Math.round(item.qty * item.unitPrice * 100) / 100;
      next[index] = item;
      return next;
    });
    // Clear line items error when user edits
    setErrors((prev) => ({ ...prev, lineItems: "" }));
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, { ...DEFAULT_LINE_ITEM }]);
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
    const taxAmount = Math.round(subtotal * (taxPercent / 100) * 100) / 100;
    const total = Math.round((subtotal + taxAmount - discountAmount) * 100) / 100;
    return { subtotal, taxAmount, total: Math.max(total, 0) };
  }, [lineItems, taxPercent, discountAmount]);

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};

    if (!title.trim()) {
      errs.title = "Title is required";
    }

    const hasValidItem = lineItems.some(
      (li) => li.description.trim() !== "" && li.amount > 0,
    );
    if (!hasValidItem) {
      errs.lineItems = "Add at least one line item with a description and price";
    }

    if (issuedDate && dueDate && dueDate < issuedDate) {
      errs.dueDate = "Due date cannot be before the issue date";
    }

    return errs;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setSaving(false);
      return;
    }

    setSaving(true);

    const payload: Record<string, any> = {
      invoice_number: invoiceNumber.trim() || null,
      title: title.trim() || null,
      Accounts_id: accountId ? Number(accountId) : null,
      currency,
      issued_date: issuedDate || null,
      due_date: dueDate || null,
      line_items: JSON.stringify(lineItems),
      subtotal: String(totals.subtotal),
      tax_percent: String(taxPercent),
      tax_amount: String(totals.taxAmount),
      discount_amount: String(discountAmount),
      total: String(totals.total),
      notes: notes.trim() || null,
      payment_info: paymentInfo.trim() || null,
      paid_at: paidAt || null,
      sent_at: sentAt || null,
    };

    try {
      if (isEditMode && editingInvoice) {
        await onUpdate(editingInvoice.id, payload);
        toast({ title: "Invoice updated", description: `"${title || "Invoice"}" has been saved.` });
      } else {
        await onCreate(payload);
        toast({ title: "Invoice created", description: `"${title || "Invoice"}" was added to your list.` });
      }
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      toast({ title: "Failed to save invoice", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function fmt(value: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Panel header */}
      <div className="flex items-start justify-between px-5 pt-6 pb-4 border-b border-border/30 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-foreground font-heading leading-tight">
            {isEditMode ? "Edit Invoice" : prefillInvoice ? "Duplicate Invoice" : "New Invoice"}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {isEditMode ? "Update invoice details" : "Fill in the details below"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="icon-circle-lg icon-circle-base mt-0.5"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable form body */}
      <form id="invoice-create-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="px-5 py-4 space-y-5">

          {/* ── Title + Account + Invoice # ───────────────────────────── */}
          <div className={cn(
            "grid gap-4",
            isAgencyUser && accountId
              ? "grid-cols-[1fr_1fr_1fr_7rem]"
              : isAgencyUser
                ? "grid-cols-[1fr_1fr_7rem]"
                : "grid-cols-[1fr_7rem]"
          )}>
            <div className="space-y-1.5">
              <Label htmlFor="cp-title" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Title</Label>
              <Input
                id="cp-title"
                placeholder="Invoice title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: "" }));
                }}
                className={cn(errors.title && "border-destructive")}
              />
              {errors.title && (
                <p className="text-[10px] text-destructive font-medium">{errors.title}</p>
              )}
            </div>
            {isAgencyUser && (
              <div className="space-y-1.5">
                <Label htmlFor="cp-account" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Account</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger id="cp-account">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name || `Account #${a.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isAgencyUser && accountId && (
              <div className="space-y-1.5">
                <Label htmlFor="cp-campaign" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Campaign
                </Label>
                <Select
                  value={campaignId || "__none__"}
                  onValueChange={(v) => setCampaignId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger id="cp-campaign" disabled={campaignsLoading}>
                    <SelectValue placeholder={campaignsLoading ? "Loading..." : "Optional"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id || c.Id} value={String(c.id || c.Id)}>
                        {c.name || c.Name || `Campaign #${c.id || c.Id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="cp-inv-num" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Invoice #</Label>
              <Input
                id="cp-inv-num"
                placeholder="INV-001"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>

          {/* ── Currency + Dates ───────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp-currency" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="cp-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-issued" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Issued</Label>
              <Input
                id="cp-issued"
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="cp-due" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Due Date</Label>
                {/* Net-N quick-pick pills */}
                <div className="flex items-center gap-0.5 bg-muted rounded-full p-0.5">
                  {DUE_PRESETS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => applyNetDays(days)}
                      title={`Due in ${days} days from issued date`}
                      className={cn(
                        "px-1.5 py-0.5 rounded-full text-[9px] font-bold transition-colors leading-none",
                        activeNetPreset === days
                          ? "bg-highlight-active text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {days}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                id="cp-due"
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  if (errors.dueDate) setErrors((prev) => ({ ...prev, dueDate: "" }));
                }}
                className={cn(errors.dueDate && "border-destructive")}
              />
              {errors.dueDate && (
                <p className="text-[10px] text-destructive font-medium">{errors.dueDate}</p>
              )}
            </div>
          </div>

          {/* ── Divider ───────────────────────────────────────────────────── */}
          <div className="h-px bg-border/40" />

          {/* ── Line Items ────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Line Items</Label>
              {errors.lineItems && (
                <p className="text-[10px] text-destructive font-medium">{errors.lineItems}</p>
              )}
            </div>

            {/* Header */}
            <div className="grid grid-cols-[1fr_3.5rem_5.5rem_5.5rem_1.5rem] gap-2 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide px-0.5">
              <span>Description</span>
              <span>Qty</span>
              <span>Unit Price</span>
              <span>Amount</span>
              <span />
            </div>

            {lineItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_3.5rem_5.5rem_5.5rem_1.5rem] gap-2 items-center">
                <Input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateLineItem(idx, "description", e.target.value)}
                  className="h-8 text-[12px]"
                />
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={item.qty}
                  onChange={(e) => updateLineItem(idx, "qty", e.target.value)}
                  className="h-8 text-center tabular-nums text-[12px]"
                />
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={item.unitPrice}
                  onChange={(e) => updateLineItem(idx, "unitPrice", e.target.value)}
                  className="h-8 tabular-nums text-[12px]"
                />
                <Input
                  readOnly
                  tabIndex={-1}
                  value={item.amount.toFixed(2)}
                  className="h-8 tabular-nums bg-muted/40 cursor-default text-[12px]"
                />
                <button
                  type="button"
                  onClick={() => removeLineItem(idx)}
                  disabled={lineItems.length <= 1}
                  className="h-8 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addLineItem}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground mt-1"
            >
              <Plus className="h-3 w-3" />
              Add Line Item
            </button>
          </div>

          {/* ── Divider ───────────────────────────────────────────────────── */}
          <div className="h-px bg-border/40" />

          {/* ── Tax / Discount + Summary ──────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-tax" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tax %</Label>
                <Input
                  id="cp-tax"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(Number(e.target.value) || 0)}
                  className="w-full tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-discount" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Discount</Label>
                <Input
                  id="cp-discount"
                  type="number"
                  min={0}
                  step={0.01}
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                  className="w-full tabular-nums"
                />
              </div>
            </div>
            <div className="flex flex-col justify-end space-y-1 text-sm bg-muted/50 rounded-lg p-3">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums font-medium">{fmt(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Tax ({taxPercent}%)</span>
                <span className="tabular-nums font-medium">{fmt(totals.taxAmount)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="tabular-nums text-destructive font-medium">-{fmt(discountAmount)}</span>
                </div>
              )}
              <div className="h-px bg-border/50 my-1" />
              <div className="flex justify-between font-bold text-sm">
                <span>Total</span>
                <span className="tabular-nums">{fmt(totals.total)}</span>
              </div>
            </div>
          </div>

          {/* ── Divider ───────────────────────────────────────────────────── */}
          <div className="h-px bg-border/40" />

          {/* ── More Fields toggle ────────────────────────────────────────── */}
          <button
            type="button"
            onClick={() => setShowMoreFields((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-150 ${showMoreFields ? "" : "-rotate-90"}`}
            />
            {showMoreFields ? "Fewer fields" : "More fields"}
          </button>

          {/* ── Optional extra fields ─────────────────────────────────────── */}
          {showMoreFields && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-sent-at" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sent Date</Label>
                <Input
                  id="cp-sent-at"
                  type="date"
                  value={sentAt}
                  onChange={(e) => setSentAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-paid-at" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Paid Date</Label>
                <Input
                  id="cp-paid-at"
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ── Divider ───────────────────────────────────────────────────── */}
          <div className="h-px bg-border/40" />

          {/* ── Notes ────────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="cp-notes" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</Label>
            <Textarea
              id="cp-notes"
              placeholder="Additional notes for the client..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-[12px] resize-none"
            />
          </div>

          {/* ── Payment Info + Presets ────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="cp-payment" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payment Info</Label>
              {/* Preset toggle buttons */}
              <div className="flex items-center gap-1 bg-muted rounded-full p-0.5">
                {(Object.entries(SENDER_PRESETS) as [SenderPreset, typeof SENDER_PRESETS[SenderPreset]][]).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyPreset(key)}
                    title={`Use ${preset.label} bank details`}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors",
                      selectedPreset === key
                        ? "bg-highlight-active text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span>{preset.flag}</span>
                    <span>{key}</span>
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              id="cp-payment"
              placeholder="Bank details, payment instructions..."
              rows={6}
              value={paymentInfo}
              onChange={(e) => setPaymentInfo(e.target.value)}
              className="text-[11px] font-mono resize-none leading-relaxed"
            />
            <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
              <Globe className="h-2.5 w-2.5" />
              Presets auto-fill your bank details. You can edit them freely.
            </p>
          </div>

        </div>
      </form>

      {/* Sticky footer actions */}
      <div className="px-5 py-3 border-t border-border/30 shrink-0 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="text-sm text-muted-foreground hover:text-foreground font-medium"
        >
          Cancel
        </button>
        <Button
          type="submit"
          form="invoice-create-form"
          disabled={saving}
          className="bg-foreground text-background hover:bg-foreground/90 h-9 px-5 text-sm"
        >
          {saving
            ? "Saving..."
            : isEditMode
              ? "Update Invoice"
              : "Create Invoice"}
        </Button>
      </div>
    </div>
  );
}
