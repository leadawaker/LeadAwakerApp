import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Plus, Trash2 } from "lucide-react";
import type { InvoiceRow, InvoiceLineItem } from "../types";
import { parseLineItems } from "../types";

interface InvoiceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingInvoice: InvoiceRow | null;
  accounts: Array<{ id: number; name: string | null }>;
  isAgencyUser: boolean;
  onCreate: (payload: Record<string, any>) => Promise<any>;
  onUpdate: (id: number, patch: Record<string, any>) => Promise<any>;
}

const CURRENCIES = ["USD", "EUR", "GBP", "BRL"] as const;

const DEFAULT_LINE_ITEM: InvoiceLineItem = {
  description: "",
  qty: 1,
  unitPrice: 0,
  amount: 0,
};

export function InvoiceCreateDialog({
  open,
  onOpenChange,
  editingInvoice,
  accounts,
  isAgencyUser,
  onCreate,
  onUpdate,
}: InvoiceCreateDialogProps) {
  const isEditMode = editingInvoice !== null;

  // ── Form state ──────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [currency, setCurrency] = useState("USD");
  const [issuedDate, setIssuedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [dueDate, setDueDate] = useState("");
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    { ...DEFAULT_LINE_ITEM },
  ]);
  const [taxPercent, setTaxPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [paymentInfo, setPaymentInfo] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Populate / reset when dialog opens ──────────────────────
  useEffect(() => {
    if (!open) return;

    if (editingInvoice) {
      setTitle(editingInvoice.title || "");
      setAccountId(
        editingInvoice.Accounts_id ? String(editingInvoice.Accounts_id) : "",
      );
      setCurrency(editingInvoice.currency || "USD");
      setIssuedDate(
        editingInvoice.issued_date
          ? editingInvoice.issued_date.split("T")[0]
          : new Date().toISOString().split("T")[0],
      );
      setDueDate(
        editingInvoice.due_date
          ? editingInvoice.due_date.split("T")[0]
          : "",
      );
      const parsed = parseLineItems(editingInvoice.line_items);
      setLineItems(
        parsed.length > 0 ? parsed : [{ ...DEFAULT_LINE_ITEM }],
      );
      setTaxPercent(
        editingInvoice.tax_percent
          ? parseFloat(editingInvoice.tax_percent)
          : 0,
      );
      setDiscountAmount(
        editingInvoice.discount_amount
          ? parseFloat(editingInvoice.discount_amount)
          : 0,
      );
      setNotes(editingInvoice.notes || "");
      setPaymentInfo(editingInvoice.payment_info || "");
    } else {
      // Reset to defaults
      setTitle("");
      setAccountId("");
      setCurrency("USD");
      setIssuedDate(new Date().toISOString().split("T")[0]);
      setDueDate("");
      setLineItems([{ ...DEFAULT_LINE_ITEM }]);
      setTaxPercent(0);
      setDiscountAmount(0);
      setNotes("");
      setPaymentInfo("");
    }
    setSaving(false);
  }, [editingInvoice, open]);

  // ── Line item helpers ───────────────────────────────────────
  function updateLineItem(
    index: number,
    field: keyof InvoiceLineItem,
    value: string | number,
  ) {
    setLineItems((prev) => {
      const next = [...prev];
      const item = { ...next[index] };

      if (field === "description") {
        item.description = value as string;
      } else if (field === "qty") {
        item.qty = Number(value) || 0;
      } else if (field === "unitPrice") {
        item.unitPrice = Number(value) || 0;
      }

      item.amount = Math.round(item.qty * item.unitPrice * 100) / 100;
      next[index] = item;
      return next;
    });
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

  // ── Totals ──────────────────────────────────────────────────
  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
    const taxAmount = Math.round(subtotal * (taxPercent / 100) * 100) / 100;
    const total =
      Math.round((subtotal + taxAmount - discountAmount) * 100) / 100;
    return { subtotal, taxAmount, total: Math.max(total, 0) };
  }, [lineItems, taxPercent, discountAmount]);

  // ── Submit ──────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload: Record<string, any> = {
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
    };

    try {
      if (isEditMode && editingInvoice) {
        await onUpdate(editingInvoice.id, payload);
      } else {
        await onCreate(payload);
      }
      onOpenChange(false);
    } catch {
      // Error handling is expected to be managed by the caller
    } finally {
      setSaving(false);
    }
  }

  // ── Currency formatter for display ─────────────────────────
  function fmt(value: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(value);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Invoice" : "Create Invoice"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Title + Account Row ─────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="inv-title">Title</Label>
              <Input
                id="inv-title"
                placeholder="Invoice title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {isAgencyUser && (
              <div className="space-y-1.5">
                <Label htmlFor="inv-account">Account</Label>
                <Select
                  value={accountId}
                  onValueChange={setAccountId}
                  disabled={isEditMode && !!editingInvoice?.Accounts_id}
                >
                  <SelectTrigger id="inv-account">
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
          </div>

          {/* ── Currency + Dates Row ────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="inv-currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="inv-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-issued">Issue Date</Label>
              <Input
                id="inv-issued"
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-due">Due Date</Label>
              <Input
                id="inv-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* ── Divider ─────────────────────────────────────── */}
          <div className="h-px bg-border/60" />

          {/* ── Line Items ──────────────────────────────────── */}
          <div className="space-y-2">
            <Label>Line Items</Label>

            {/* Header row */}
            <div className="grid grid-cols-[1fr_4rem_6rem_6rem_2rem] gap-2 text-[11px] font-medium text-muted-foreground px-0.5">
              <span>Description</span>
              <span>Qty</span>
              <span>Unit Price</span>
              <span>Amount</span>
              <span />
            </div>

            {/* Item rows */}
            {lineItems.map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_4rem_6rem_6rem_2rem] gap-2 items-center"
              >
                <Input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) =>
                    updateLineItem(idx, "description", e.target.value)
                  }
                />
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={item.qty}
                  onChange={(e) =>
                    updateLineItem(idx, "qty", e.target.value)
                  }
                  className="text-center tabular-nums"
                />
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={item.unitPrice}
                  onChange={(e) =>
                    updateLineItem(idx, "unitPrice", e.target.value)
                  }
                  className="tabular-nums"
                />
                <Input
                  readOnly
                  tabIndex={-1}
                  value={item.amount.toFixed(2)}
                  className="tabular-nums bg-muted/40 cursor-default"
                />
                <button
                  type="button"
                  onClick={() => removeLineItem(idx)}
                  disabled={lineItems.length <= 1}
                  className="flex items-center justify-center h-9 w-8 rounded-md text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                  aria-label="Remove line item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addLineItem}
              className="mt-1"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Line Item
            </Button>
          </div>

          {/* ── Divider ─────────────────────────────────────── */}
          <div className="h-px bg-border/60" />

          {/* ── Tax & Discount + Summary ────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Left: Tax + Discount inputs */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="inv-tax">Tax %</Label>
                <Input
                  id="inv-tax"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={taxPercent}
                  onChange={(e) =>
                    setTaxPercent(Number(e.target.value) || 0)
                  }
                  className="w-28 tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-discount">Discount Amount</Label>
                <Input
                  id="inv-discount"
                  type="number"
                  min={0}
                  step={0.01}
                  value={discountAmount}
                  onChange={(e) =>
                    setDiscountAmount(Number(e.target.value) || 0)
                  }
                  className="w-28 tabular-nums"
                />
              </div>
            </div>

            {/* Right: Calculated totals */}
            <div className="flex flex-col justify-end space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{fmt(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Tax ({taxPercent}%)
                </span>
                <span className="tabular-nums">{fmt(totals.taxAmount)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="tabular-nums text-destructive">
                    -{fmt(discountAmount)}
                  </span>
                </div>
              )}
              <div className="h-px bg-border/60 my-1" />
              <div className="flex justify-between font-semibold text-base">
                <span>Total</span>
                <span className="tabular-nums">{fmt(totals.total)}</span>
              </div>
            </div>
          </div>

          {/* ── Divider ─────────────────────────────────────── */}
          <div className="h-px bg-border/60" />

          {/* ── Notes + Payment Info ────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="inv-notes">Notes</Label>
              <Textarea
                id="inv-notes"
                placeholder="Additional notes for the client..."
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-payment">Payment Info</Label>
              <Textarea
                id="inv-payment"
                placeholder="Bank details, PayPal, etc."
                rows={3}
                value={paymentInfo}
                onChange={(e) => setPaymentInfo(e.target.value)}
              />
            </div>
          </div>

          {/* ── Actions ─────────────────────────────────────── */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {saving
                ? "Saving..."
                : isEditMode
                  ? "Update Invoice"
                  : "Create Invoice"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
