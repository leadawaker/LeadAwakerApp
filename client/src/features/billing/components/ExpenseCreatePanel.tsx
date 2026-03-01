import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Loader2, AlertCircle, X, Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parsePdf, createExpense, updateExpense } from "../api/expensesApi";
import type { ExpenseRow } from "../types";

// ── Props ─────────────────────────────────────────────────────────────────────

interface ExpenseCreatePanelProps {
  editingExpense?: ExpenseRow | null;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExpenseCreatePanel({ editingExpense, onClose }: ExpenseCreatePanelProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editingExpense;

  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [noApiKey, setNoApiKey] = useState(false);
  const [aiSuccess, setAiSuccess] = useState(false);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form fields
  const [date, setDate] = useState("");
  const [supplier, setSupplier] = useState("");
  const [country, setCountry] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [amountExclVat, setAmountExclVat] = useState("");
  const [vatRatePct, setVatRatePct] = useState("");
  const [vatAmount, setVatAmount] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [nlBtwDeductible, setNlBtwDeductible] = useState(false);
  const [notes, setNotes] = useState("");

  // Pre-fill form when editing
  useEffect(() => {
    if (editingExpense) {
      setDate(editingExpense.date || "");
      setSupplier(editingExpense.supplier || "");
      setCountry(editingExpense.country || "");
      setInvoiceNumber(editingExpense.invoiceNumber || "");
      setDescription(editingExpense.description || "");
      setCurrency(editingExpense.currency || "EUR");
      setAmountExclVat(editingExpense.amountExclVat ? String(editingExpense.amountExclVat) : "");
      setVatRatePct(editingExpense.vatRatePct ? String(editingExpense.vatRatePct) : "");
      setVatAmount(editingExpense.vatAmount ? String(editingExpense.vatAmount) : "");
      setTotalAmount(editingExpense.totalAmount ? String(editingExpense.totalAmount) : "");
      setNlBtwDeductible(editingExpense.nlBtwDeductible ?? false);
      setNotes(editingExpense.notes || "");
    }
  }, [editingExpense]);

  function resetForm() {
    setDate(""); setSupplier(""); setCountry(""); setInvoiceNumber("");
    setDescription(""); setCurrency("EUR"); setAmountExclVat(""); setVatRatePct("");
    setVatAmount(""); setTotalAmount(""); setNlBtwDeductible(false); setNotes("");
    setPdfData(null); setPdfName(null); setParseError(null); setNoApiKey(false); setAiSuccess(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  // ── PDF upload (file only — no auto-parse) ────────────────────────────────
  const processFile = useCallback((file: File) => {
    if (file.type !== "application/pdf") {
      setParseError("Only PDF files are accepted.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setParseError("PDF must be under 10 MB.");
      return;
    }
    setParseError(null);
    setPdfName(file.name);
    setAiSuccess(false);
    const reader = new FileReader();
    reader.onload = () => {
      setPdfData(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  // ── Manual AI parse trigger ───────────────────────────────────────────────
  const handleAiProcess = useCallback(async () => {
    if (!pdfData) return;
    setParseError(null);
    setNoApiKey(false);
    setAiSuccess(false);
    setIsParsing(true);
    try {
      const extracted = await parsePdf(pdfData);
      if ((extracted as any).error === "NO_API_KEY") {
        setNoApiKey(true);
      } else {
        if (extracted.date)             setDate(extracted.date as string);
        if (extracted.supplier)         setSupplier(extracted.supplier as string);
        if (extracted.country)          setCountry(extracted.country as string);
        if (extracted.invoice_number)   setInvoiceNumber(extracted.invoice_number as string);
        if (extracted.description)      setDescription(extracted.description as string);
        if (extracted.currency)         setCurrency(extracted.currency as string);
        if (extracted.amount_excl_vat != null) setAmountExclVat(String(extracted.amount_excl_vat));
        if (extracted.vat_rate_pct != null)    setVatRatePct(String(extracted.vat_rate_pct));
        if (extracted.vat_amount != null)      setVatAmount(String(extracted.vat_amount));
        if (extracted.total_amount != null)    setTotalAmount(String(extracted.total_amount));
        if (extracted.nl_btw_deductible != null) setNlBtwDeductible(Boolean(extracted.nl_btw_deductible));
        if (extracted.notes)            setNotes(extracted.notes as string);
        setAiSuccess(true);
      }
    } catch (e: any) {
      setParseError(`AI parse failed: ${e.message}`);
    } finally {
      setIsParsing(false);
    }
  }, [pdfData]);

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!date || !supplier) return;
    setIsSaving(true);
    try {
      const mo = new Date(date).getMonth();
      const q = mo <= 2 ? "Q1" : mo <= 5 ? "Q2" : mo <= 8 ? "Q3" : "Q4";
      const yr = new Date(date).getFullYear();

      if (isEditing && editingExpense) {
        await updateExpense(editingExpense.id, {
          date,
          year: yr,
          quarter: q,
          supplier,
          country: country || null,
          invoice_number: invoiceNumber || null,
          description: description || null,
          currency,
          amount_excl_vat: amountExclVat ? parseFloat(amountExclVat) : null,
          vat_rate_pct: vatRatePct ? parseFloat(vatRatePct) : null,
          vat_amount: vatAmount ? parseFloat(vatAmount) : null,
          total_amount: totalAmount ? parseFloat(totalAmount) : null,
          nl_btw_deductible: nlBtwDeductible,
          notes: notes || null,
          ...(pdfData ? { pdf_data: pdfData } : {}),
        });
      } else {
        await createExpense({
          date,
          year: yr,
          quarter: q,
          supplier,
          country: country || null,
          invoice_number: invoiceNumber || null,
          description: description || null,
          currency,
          amount_excl_vat: amountExclVat ? parseFloat(amountExclVat) : null,
          vat_rate_pct: vatRatePct ? parseFloat(vatRatePct) : null,
          vat_amount: vatAmount ? parseFloat(vatAmount) : null,
          total_amount: totalAmount ? parseFloat(totalAmount) : null,
          nl_btw_deductible: nlBtwDeductible,
          notes: notes || null,
          pdf_data: pdfData || undefined,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      handleClose();
    } catch (e: any) {
      setParseError(`Save failed: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Panel header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between px-5 pt-6 pb-4 border-b border-border/30 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-foreground font-heading leading-tight">
            {isEditing ? "Edit Expense" : "Add Expense"}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {isEditing
              ? "Update the expense details below"
              : "Upload a PDF, then click \"Process with AI\" or fill in manually"}
          </p>
        </div>
        <button type="button" onClick={handleClose} className="icon-circle-lg icon-circle-base mt-0.5" title="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Scrollable form body ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-4 space-y-5">

          {/* PDF Drop Zone */}
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
              PDF Invoice
            </Label>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 cursor-pointer",
                "transition-colors duration-[150ms]",
                isDragging
                  ? "border-brand-indigo bg-brand-indigo/5"
                  : pdfName
                  ? "border-emerald-300 bg-emerald-50/50"
                  : "border-border/50 bg-muted/30 hover:border-brand-indigo/40 hover:bg-muted/50"
              )}
              onClick={() => document.getElementById("expense-panel-pdf-input")?.click()}
            >
              <input id="expense-panel-pdf-input" type="file" accept="application/pdf" className="hidden" onChange={handleFileInput} />
              {pdfName ? (
                <>
                  <FileText className="h-5 w-5 text-emerald-600" />
                  <span className="text-[12px] text-emerald-700 font-medium truncate max-w-full">{pdfName}</span>
                  <span className="text-[10px] text-foreground/40">Click to replace</span>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-foreground/30" />
                  <span className="text-[12px] text-foreground/55 font-medium">Drop PDF here, or click to upload</span>
                  <span className="text-[10px] text-foreground/35">max 10 MB</span>
                </>
              )}
            </div>

            {/* Process with AI button — only when PDF loaded */}
            {pdfData && (
              <button
                type="button"
                onClick={handleAiProcess}
                disabled={isParsing}
                className={cn(
                  "mt-2 w-full flex items-center justify-center gap-2 h-9 rounded-lg border-2 text-[12px] font-semibold transition-colors duration-[150ms]",
                  aiSuccess
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 cursor-default"
                    : "border-brand-indigo/30 bg-brand-indigo/5 text-brand-indigo hover:bg-brand-indigo/10 disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                {isParsing ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Analysing invoice…</>
                ) : aiSuccess ? (
                  <><span className="text-base leading-none">✓</span>Fields extracted successfully</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" />Process with AI</>
                )}
              </button>
            )}
          </div>

          {/* Notices */}
          {noApiKey && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-700">
                <strong>OPEN_AI_API_KEY</strong> not set. Fill in fields manually, or set the key in <code>.env</code> and restart the server.
              </p>
            </div>
          )}
          {parseError && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-rose-700">{parseError}</p>
            </div>
          )}

          <div className="h-px bg-border/40" />

          {/* ── Core fields ─────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="ep-date" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input id="ep-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="placeholder:text-muted-foreground/50" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ep-supplier" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Supplier <span className="text-destructive">*</span>
              </Label>
              <Input id="ep-supplier" placeholder="Anthropic PBC" value={supplier} onChange={(e) => setSupplier(e.target.value)} className="placeholder:text-muted-foreground/50" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ep-country" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Country</Label>
              <Input id="ep-country" placeholder="US" maxLength={2} value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} className="font-mono placeholder:text-muted-foreground/50" />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="ep-invnum" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Invoice Number</Label>
              <Input id="ep-invnum" placeholder="INV-2026-001" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="font-mono placeholder:text-muted-foreground/50" />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="ep-desc" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Description</Label>
              <Input id="ep-desc" placeholder="Brief description of item / service" value={description} onChange={(e) => setDescription(e.target.value)} className="placeholder:text-muted-foreground/50" />
            </div>

          </div>

          <div className="h-px bg-border/40" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/50 font-heading">Amounts</p>

          {/* ── Amount fields ─────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">

            <div className="space-y-1.5">
              <Label htmlFor="ep-currency" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Currency</Label>
              <select
                id="ep-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-10 rounded-[var(--radius)] border border-input bg-background px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
              >
                <option>EUR</option>
                <option>USD</option>
                <option>GBP</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ep-vat-pct" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">VAT %</Label>
              <Input id="ep-vat-pct" type="number" step="0.01" placeholder="21" value={vatRatePct} onChange={(e) => setVatRatePct(e.target.value)} className="tabular-nums placeholder:text-muted-foreground/50" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ep-excl-vat" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Excl. VAT</Label>
              <Input id="ep-excl-vat" type="number" step="0.01" placeholder="0.00" value={amountExclVat} onChange={(e) => setAmountExclVat(e.target.value)} className="tabular-nums placeholder:text-muted-foreground/50" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ep-vat-amt" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">VAT Amount</Label>
              <Input id="ep-vat-amt" type="number" step="0.01" placeholder="0.00" value={vatAmount} onChange={(e) => setVatAmount(e.target.value)} className="tabular-nums placeholder:text-muted-foreground/50" />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="ep-total" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total Amount</Label>
              <Input id="ep-total" type="number" step="0.01" placeholder="0.00" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="tabular-nums font-semibold placeholder:text-muted-foreground/50" />
            </div>

          </div>

          <div className="h-px bg-border/40" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/50 font-heading">Tax</p>

          {/* ── NL BTW toggle ─────────────────────────────────── */}
          <button
            type="button"
            onClick={() => setNlBtwDeductible((v) => !v)}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors duration-[150ms]",
              nlBtwDeductible
                ? "bg-highlight-active border-highlight-active border-2"
                : "bg-card border-border hover:bg-muted/60"
            )}
          >
            <div className="text-left">
              <p className="text-[13px] font-semibold text-foreground leading-tight">NL BTW Deductible</p>
              <p className="text-[11px] text-foreground/55 leading-snug mt-0.5">
                VAT reclaimable as <em>voorbelasting</em> on BTW return
              </p>
            </div>
            <div className={cn(
              "h-5 w-9 rounded-full border-2 relative shrink-0 transition-colors duration-[150ms]",
              nlBtwDeductible ? "bg-foreground border-foreground" : "bg-border/40 border-border"
            )}>
              <div className={cn(
                "absolute top-0.5 h-3 w-3 rounded-full transition-transform duration-[150ms]",
                nlBtwDeductible ? "bg-highlight-active translate-x-[18px]" : "bg-foreground/30 translate-x-0.5"
              )} />
            </div>
          </button>

          {/* ── Notes ─────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="ep-notes" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</Label>
            <textarea
              id="ep-notes"
              rows={3}
              placeholder="e.g. US company — no EU VAT charged. Pre-start expense for Q1 2026."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-[var(--radius)] border border-input bg-background px-3 py-2.5 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-brand-indigo/30 placeholder:text-muted-foreground/50"
            />
          </div>

        </div>
      </div>

      {/* ── Sticky footer ─────────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-t border-border/30 shrink-0 flex items-center justify-between gap-2">
        <button type="button" onClick={handleClose} disabled={isSaving} className="text-sm text-muted-foreground hover:text-foreground font-medium">
          Cancel
        </button>
        <Button
          onClick={handleSave}
          disabled={isSaving || isParsing || !date || !supplier}
          className="bg-foreground text-background hover:bg-foreground/90 h-9 px-5 text-sm"
        >
          {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          {isSaving ? "Saving…" : isEditing ? "Save Changes" : "Save Expense"}
        </Button>
      </div>

    </div>
  );
}
