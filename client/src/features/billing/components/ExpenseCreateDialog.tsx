import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Loader2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { parsePdf, createExpense } from "../api/expensesApi";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ExpenseCreateDialog({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [noApiKey, setNoApiKey] = useState(false);
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

  function resetForm() {
    setDate(""); setSupplier(""); setCountry(""); setInvoiceNumber("");
    setDescription(""); setCurrency("EUR"); setAmountExclVat(""); setVatRatePct("");
    setVatAmount(""); setTotalAmount(""); setNlBtwDeductible(false); setNotes("");
    setPdfData(null); setPdfName(null); setParseError(null); setNoApiKey(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  const processFile = useCallback(async (file: File) => {
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
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPdfData(dataUrl);
      setIsParsing(true);
      try {
        const extracted = await parsePdf(dataUrl);
        if ((extracted as any).error === "NO_API_KEY") {
          setNoApiKey(true);
        } else {
          // Populate form fields
          if (extracted.date) setDate(extracted.date as string);
          if (extracted.supplier) setSupplier(extracted.supplier as string);
          if (extracted.country) setCountry(extracted.country as string);
          if (extracted.invoice_number) setInvoiceNumber(extracted.invoice_number as string);
          if (extracted.description) setDescription(extracted.description as string);
          if (extracted.currency) setCurrency(extracted.currency as string);
          if (extracted.amount_excl_vat != null) setAmountExclVat(String(extracted.amount_excl_vat));
          if (extracted.vat_rate_pct != null) setVatRatePct(String(extracted.vat_rate_pct));
          if (extracted.vat_amount != null) setVatAmount(String(extracted.vat_amount));
          if (extracted.total_amount != null) setTotalAmount(String(extracted.total_amount));
          if (extracted.nl_btw_deductible != null) setNlBtwDeductible(Boolean(extracted.nl_btw_deductible));
          if (extracted.notes) setNotes(extracted.notes as string);
        }
      } catch (e: any) {
        setParseError(`Parse failed: ${e.message}`);
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  async function handleSave() {
    if (!date || !supplier) return; // minimal validation
    setIsSaving(true);
    try {
      // Derive quarter from date
      const mo = new Date(date).getMonth();
      const q = mo <= 2 ? "Q1" : mo <= 5 ? "Q2" : mo <= 8 ? "Q3" : "Q4";
      const yr = new Date(date).getFullYear();
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
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      handleClose();
    } catch (e: any) {
      setParseError(`Save failed: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-[15px] font-bold">Add Expense</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 pt-4 space-y-4">

          {/* PDF Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 transition-colors cursor-pointer",
              isDragging
                ? "border-brand-indigo bg-brand-indigo/5"
                : pdfName
                ? "border-emerald-300 bg-emerald-50/50"
                : "border-border/40 bg-muted/30 hover:border-brand-indigo/40 hover:bg-muted/50"
            )}
            onClick={() => document.getElementById("expense-pdf-input")?.click()}
          >
            <input id="expense-pdf-input" type="file" accept="application/pdf" className="hidden" onChange={handleFileInput} />
            {isParsing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-brand-indigo" />
                <span className="text-[12px] text-foreground/60 font-medium">Analysing invoice with AI...</span>
              </>
            ) : pdfName ? (
              <>
                <FileText className="h-5 w-5 text-emerald-600" />
                <span className="text-[12px] text-emerald-700 font-medium truncate max-w-full">{pdfName}</span>
                <span className="text-[10px] text-foreground/40">Click to replace</span>
              </>
            ) : (
              <>
                <Upload className="h-5 w-5 text-foreground/30" />
                <span className="text-[12px] text-foreground/50 font-medium">Drop PDF invoice here, or click to upload</span>
                <span className="text-[10px] text-foreground/35">AI will auto-extract all fields</span>
              </>
            )}
          </div>

          {/* No API key notice */}
          {noApiKey && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-700">
                <strong>ANTHROPIC_API_KEY</strong> not set on the server. Enter fields manually, or set the key in your <code>.env</code> file and restart the server.
              </p>
            </div>
          )}

          {/* Parse error */}
          {parseError && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-rose-700">{parseError}</p>
            </div>
          )}

          {/* Form fields */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date *" col="full">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full h-9 rounded-lg border border-border/50 bg-background px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-indigo/30" />
            </Field>

            <Field label="Supplier *">
              <input type="text" placeholder="Anthropic PBC" value={supplier} onChange={(e) => setSupplier(e.target.value)}
                className="w-full h-9 rounded-lg border border-border/50 bg-background px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-indigo/30" />
            </Field>

            <Field label="Country">
              <input type="text" placeholder="US" maxLength={2} value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())}
                className="w-full h-9 rounded-lg border border-border/50 bg-background px-3 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-indigo/30" />
            </Field>

            <Field label="Invoice #" col="full">
              <input type="text" placeholder="INV-2026-001" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full h-9 rounded-lg border border-border/50 bg-background px-3 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-indigo/30" />
            </Field>

            <Field label="Description" col="full">
              <input type="text" placeholder="Brief description of item/service" value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full h-9 rounded-lg border border-border/50 bg-background px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-indigo/30" />
            </Field>

            <Field label="Currency">
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-9 rounded-lg border border-border/50 bg-background px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-indigo/30">
                <option>EUR</option>
                <option>USD</option>
                <option>GBP</option>
              </select>
            </Field>

            <Field label="Amount Excl. VAT">
              <input type="number" step="0.01" placeholder="0.00" value={amountExclVat} onChange={(e) => setAmountExclVat(e.target.value)}
                className="w-full h-9 rounded-lg border border-border/50 bg-background px-3 text-[13px] tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-indigo/30" />
            </Field>

            <Field label="VAT %">
              <input type="number" step="0.01" placeholder="21" value={vatRatePct} onChange={(e) => setVatRatePct(e.target.value)}
                className="w-full h-9 rounded-lg border border-border/50 bg-background px-3 text-[13px] tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-indigo/30" />
            </Field>

            <Field label="VAT Amount">
              <input type="number" step="0.01" placeholder="0.00" value={vatAmount} onChange={(e) => setVatAmount(e.target.value)}
                className="w-full h-9 rounded-lg border border-border/50 bg-background px-3 text-[13px] tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-indigo/30" />
            </Field>

            <Field label="Total Amount">
              <input type="number" step="0.01" placeholder="0.00" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)}
                className="w-full h-9 rounded-lg border border-border/50 bg-background px-3 text-[13px] tabular-nums font-semibold focus:outline-none focus:ring-2 focus:ring-brand-indigo/30" />
            </Field>

            <Field label="NL BTW Deductible" col="full">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={nlBtwDeductible} onChange={(e) => setNlBtwDeductible(e.target.checked)}
                  className="h-4 w-4 rounded border-border/50 text-brand-indigo focus:ring-brand-indigo/30" />
                <span className="text-[12px] text-foreground/70">VAT is reclaimable as NL voorbelasting (BTW)</span>
              </label>
            </Field>

            <Field label="Notes" col="full">
              <textarea rows={2} placeholder="e.g. US company — no EU VAT charged" value={notes} onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-brand-indigo/30" />
            </Field>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={handleClose}
              className="h-9 px-4 rounded-lg text-[13px] font-medium text-foreground/60 hover:bg-muted/50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isParsing || !date || !supplier}
              className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-brand-indigo text-white hover:bg-brand-indigo/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save Expense
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Helper sub-component ─────────────────────────────────────────────────────

function Field({ label, children, col }: { label: string; children: React.ReactNode; col?: "full" }) {
  return (
    <div className={col === "full" ? "col-span-2" : ""}>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-1">{label}</label>
      {children}
    </div>
  );
}
