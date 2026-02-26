/**
 * CsvImportWizard — multi-step dialog for importing leads from CSV.
 *
 * Steps:
 *  1. Upload  — pick a .csv file, parse headers + preview rows
 *  2. Mapping — map each CSV column to a lead database field (or "skip")
 *  3. Preview — show the first N mapped rows before committing
 *  4. Results — show created / error counts after the POST completes
 */
import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiFetch } from "@/lib/apiUtils";
import {
  Upload,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileText,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Lead Target Fields ───────────────────────────────────────────────────────
// DB column names (in the format the API accepts for POST /api/leads)
export const LEAD_TARGET_FIELDS: { value: string; label: string; required?: boolean }[] = [
  { value: "__skip__", label: "— Skip this column —" },
  // Core identity
  { value: "first_name", label: "First Name" },
  { value: "last_name", label: "Last Name" },
  { value: "phone", label: "Phone", required: true },
  { value: "Email", label: "Email" },
  // Status / pipeline
  { value: "Conversion_Status", label: "Pipeline Stage" },
  { value: "priority", label: "Priority" },
  { value: "automation_status", label: "Automation Status" },
  // Relations
  { value: "Accounts_id", label: "Account ID" },
  { value: "Campaigns_id", label: "Campaign ID" },
  // Metadata
  { value: "Source", label: "Lead Source" },
  { value: "notes", label: "Notes" },
  { value: "language", label: "Language" },
  { value: "time_zone", label: "Timezone" },
  { value: "ai_sentiment", label: "AI Sentiment" },
  { value: "dnc_reason", label: "DNC Reason" },
];

const FIELD_LABEL: Record<string, string> = Object.fromEntries(
  LEAD_TARGET_FIELDS.map((f) => [f.value, f.label]),
);

// ─── CSV Parsing ─────────────────────────────────────────────────────────────
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);
  return { headers, rows };
}

// Auto-detect best matching target field for a CSV header
function autoDetect(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (h === "firstname" || h === "first") return "first_name";
  if (h === "lastname" || h === "last") return "last_name";
  if (h === "phone" || h === "mobile" || h === "tel" || h === "whatsapp") return "phone";
  if (h === "email" || h === "emailaddress") return "Email";
  if (h === "status" || h === "stage" || h === "pipelinestage" || h === "conversionstatus") return "Conversion_Status";
  if (h === "priority") return "priority";
  if (h === "notes" || h === "note" || h === "comment" || h === "comments") return "notes";
  if (h === "source" || h === "leadsource") return "Source";
  if (h === "language" || h === "lang") return "language";
  if (h === "timezone" || h === "tz") return "time_zone";
  if (h === "accountid" || h === "accountsid") return "Accounts_id";
  if (h === "campaignid" || h === "campaignsid") return "Campaigns_id";
  return "__skip__";
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "upload" | "mapping" | "preview" | "results";

interface ImportResults {
  created: number;
  errors: number;
  errorDetails: { row: number; message: string }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
  /** Optional: lock accountsId for non-agency users */
  defaultAccountId?: number;
}

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "mapping", label: "Map Fields" },
    { key: "preview", label: "Preview" },
    { key: "results", label: "Results" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((s, idx) => (
        <div key={s.key} className="flex items-center">
          <div
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
              idx < currentIdx
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : idx === currentIdx
                  ? "bg-brand-indigo text-white"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {idx < currentIdx ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <span className="w-4 text-center">{idx + 1}</span>
            )}
            <span>{s.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div
              className={cn(
                "h-px w-6 mx-1",
                idx < currentIdx ? "bg-green-400" : "bg-border",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function CsvImportWizard({ open, onClose, onImportComplete, defaultAccountId }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");

  // Step 1 state
  const [fileName, setFileName] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [parseError, setParseError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Step 2 state
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({}); // csvHeader → targetField

  // Step 4 state
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [importing, setImporting] = useState(false);

  // Reset wizard state when dialog opens/closes
  const handleClose = useCallback(() => {
    setStep("upload");
    setFileName("");
    setCsvHeaders([]);
    setCsvRows([]);
    setParseError("");
    setFieldMapping({});
    setImportResults(null);
    setImporting(false);
    onClose();
  }, [onClose]);

  // ── Step 1: File selection ─────────────────────────────────────────────────
  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      setParseError("Please select a CSV (.csv) file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setParseError("File is too large. Maximum size is 10 MB.");
      return;
    }
    setParseError("");
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const { headers, rows } = parseCsv(text);
        if (headers.length === 0) {
          setParseError("CSV appears empty or has no headers.");
          return;
        }
        setCsvHeaders(headers);
        setCsvRows(rows);
        // Auto-detect field mapping
        const initial: Record<string, string> = {};
        headers.forEach((h) => {
          initial[h] = autoDetect(h);
        });
        setFieldMapping(initial);
        setStep("mapping");
      } catch (err) {
        setParseError("Failed to parse CSV. Please check the file format.");
      }
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // ── Step 3: Build preview rows ─────────────────────────────────────────────
  const previewData = useCallback(() => {
    const mappedHeaders = csvHeaders.filter((h) => fieldMapping[h] && fieldMapping[h] !== "__skip__");
    const preview = csvRows.slice(0, 5).map((row) => {
      const obj: Record<string, string> = {};
      csvHeaders.forEach((h, i) => {
        const target = fieldMapping[h];
        if (target && target !== "__skip__") {
          obj[target] = row[i] || "";
        }
      });
      return obj;
    });
    return { mappedHeaders, preview };
  }, [csvHeaders, csvRows, fieldMapping]);

  // ── Step 4: Import ─────────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      // Build lead objects from mapped rows
      const leadsToImport = csvRows.map((row) => {
        const obj: Record<string, string | number> = {};
        csvHeaders.forEach((h, i) => {
          const target = fieldMapping[h];
          if (target && target !== "__skip__") {
            const val = row[i] || "";
            // Coerce numeric IDs
            if ((target === "Accounts_id" || target === "Campaigns_id") && val) {
              obj[target] = Number(val) || 0;
            } else {
              obj[target] = val;
            }
          }
        });
        // Apply default accountId if provided and not already mapped
        if (defaultAccountId && !obj["Accounts_id"]) {
          obj["Accounts_id"] = defaultAccountId;
        }
        return obj;
      });

      const res = await apiFetch("/api/leads/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: leadsToImport }),
      });

      const data = await res.json();
      if (!res.ok) {
        setImportResults({
          created: 0,
          errors: leadsToImport.length,
          errorDetails: [{ row: 0, message: data.message || "Import failed" }],
        });
      } else {
        setImportResults({
          created: data.created,
          errors: data.errors,
          errorDetails: data.errorDetails || [],
        });
        if (data.created > 0) {
          onImportComplete?.();
        }
      }
      setStep("results");
    } catch (err: any) {
      setImportResults({
        created: 0,
        errors: csvRows.length,
        errorDetails: [{ row: 0, message: err.message || "Network error" }],
      });
      setStep("results");
    } finally {
      setImporting(false);
    }
  }, [csvHeaders, csvRows, fieldMapping, defaultAccountId, onImportComplete]);

  // ── Validation ─────────────────────────────────────────────────────────────
  const mappedCount = Object.values(fieldMapping).filter((v) => v !== "__skip__").length;
  const hasPhoneMapping = Object.values(fieldMapping).includes("phone");

  // Detect duplicate target field assignments
  const targetCounts: Record<string, number> = {};
  Object.values(fieldMapping).forEach((v) => {
    if (v !== "__skip__") targetCounts[v] = (targetCounts[v] || 0) + 1;
  });
  const hasDuplicates = Object.values(targetCounts).some((c) => c > 1);

  const { mappedHeaders, preview } = step === "preview" ? previewData() : { mappedHeaders: [], preview: [] };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-4 w-4 text-brand-indigo" />
            Import Leads from CSV
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Upload a CSV file and map its columns to lead fields.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <StepIndicator current={step} />

          {/* ── Step 1: Upload ─────────────────────────────────────────── */}
          {step === "upload" && (
            <div className="space-y-4">
              <div
                className={cn(
                  "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors",
                  isDragging
                    ? "border-brand-indigo bg-brand-indigo/5"
                    : "border-border hover:border-brand-indigo/50 hover:bg-muted/30",
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                data-testid="csv-upload-dropzone"
              >
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">
                  Drag & drop a CSV file here, or{" "}
                  <span className="text-brand-indigo underline">browse</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports .csv files up to 10 MB · Max 5,000 leads per import
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                  data-testid="csv-file-input"
                />
              </div>

              {parseError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 text-sm">
                  <XCircle className="h-4 w-4 shrink-0" />
                  {parseError}
                </div>
              )}

              <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm space-y-1">
                <p className="font-semibold text-foreground">CSV Format Tips</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5 text-xs">
                  <li>First row must contain column headers</li>
                  <li>Recommended columns: First Name, Last Name, Phone, Email</li>
                  <li>Phone numbers should include country code (e.g. +1 555 123 4567)</li>
                  <li>Comma-separated; quoted fields supported</li>
                </ul>
              </div>
            </div>
          )}

          {/* ── Step 2: Field Mapping ───────────────────────────────────── */}
          {step === "mapping" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    File: <span className="text-brand-indigo">{fileName}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {csvRows.length} data row{csvRows.length !== 1 ? "s" : ""} · {csvHeaders.length} columns detected
                  </p>
                </div>
                <div className="flex gap-2">
                  {hasDuplicates && (
                    <Badge variant="destructive" className="text-xs">Duplicate mappings</Badge>
                  )}
                  {!hasPhoneMapping && (
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                      Phone not mapped
                    </Badge>
                  )}
                </div>
              </div>

              <ScrollArea className="h-[380px] pr-3">
                <div className="space-y-2">
                  {/* Header row */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-1.5 bg-muted/50 rounded-lg text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <span>CSV Column</span>
                    <span className="text-center w-6" />
                    <span>Maps to Lead Field</span>
                  </div>

                  {csvHeaders.map((header) => {
                    const target = fieldMapping[header] || "__skip__";
                    const isDupe = target !== "__skip__" && targetCounts[target] > 1;
                    const sample = csvRows.slice(0, 3).map((r) => r[csvHeaders.indexOf(header)] || "").filter(Boolean);

                    return (
                      <div
                        key={header}
                        className={cn(
                          "grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors",
                          isDupe
                            ? "border-red-300 bg-red-50 dark:bg-red-900/10 dark:border-red-800"
                            : target === "__skip__"
                              ? "border-border bg-muted/20 opacity-60"
                              : "border-border bg-card",
                        )}
                        data-testid={`mapping-row-${header}`}
                      >
                        {/* CSV column info */}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{header}</p>
                          {sample.length > 0 && (
                            <p className="text-xs text-muted-foreground truncate">
                              e.g. {sample.slice(0, 2).join(", ")}
                            </p>
                          )}
                        </div>

                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

                        {/* Target field selector */}
                        <Select
                          value={target}
                          onValueChange={(val) =>
                            setFieldMapping((prev) => ({ ...prev, [header]: val }))
                          }
                          data-testid={`mapping-select-${header}`}
                        >
                          <SelectTrigger className="h-10 text-sm">
                            <SelectValue placeholder="Select field..." />
                          </SelectTrigger>
                          <SelectContent>
                            {LEAD_TARGET_FIELDS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>
                                {f.label}
                                {f.required && <span className="text-red-500 ml-1">*</span>}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <p className="text-xs text-muted-foreground">
                {mappedCount} of {csvHeaders.length} column{csvHeaders.length !== 1 ? "s" : ""} mapped
              </p>
            </div>
          )}

          {/* ── Step 3: Preview ─────────────────────────────────────────── */}
          {step === "preview" && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Import preview</p>
                <p className="text-xs text-muted-foreground">
                  Showing first {Math.min(5, csvRows.length)} of {csvRows.length} row{csvRows.length !== 1 ? "s" : ""}
                  {" "}· {mappedCount} field{mappedCount !== 1 ? "s" : ""} mapped
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide border-b border-border w-10">
                        #
                      </th>
                      {mappedHeaders.map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                          {FIELD_LABEL[fieldMapping[h]] || fieldMapping[h]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr
                        key={i}
                        className={cn("transition-colors", i % 2 === 0 ? "" : "bg-muted/20")}
                        data-testid={`preview-row-${i}`}
                      >
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        {mappedHeaders.map((h) => {
                          const target = fieldMapping[h];
                          return (
                            <td key={h} className="px-3 py-2 max-w-[160px] truncate">
                              {row[target] || <span className="text-muted-foreground italic">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium mb-1">Ready to import</p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  <li>• <strong>{csvRows.length}</strong> lead{csvRows.length !== 1 ? "s" : ""} will be created</li>
                  <li>• <strong>{mappedCount}</strong> field{mappedCount !== 1 ? "s" : ""} mapped per lead</li>
                  {defaultAccountId && (
                    <li>• Leads will be assigned to account <strong>#{defaultAccountId}</strong></li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* ── Step 4: Results ─────────────────────────────────────────── */}
          {step === "results" && importResults && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 p-5 text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-green-700 dark:text-green-400">
                    {importResults.created}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-500 mt-0.5">
                    Lead{importResults.created !== 1 ? "s" : ""} imported
                  </p>
                </div>
                <div
                  className={cn(
                    "rounded-2xl border p-5 text-center",
                    importResults.errors > 0
                      ? "border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800"
                      : "border-border bg-muted/30",
                  )}
                >
                  {importResults.errors > 0 ? (
                    <XCircle className="h-8 w-8 text-red-600 dark:text-red-400 mx-auto mb-2" />
                  ) : (
                    <CheckCircle2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  )}
                  <p
                    className={cn(
                      "text-3xl font-bold",
                      importResults.errors > 0
                        ? "text-red-700 dark:text-red-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {importResults.errors}
                  </p>
                  <p
                    className={cn(
                      "text-sm mt-0.5",
                      importResults.errors > 0
                        ? "text-red-600 dark:text-red-500"
                        : "text-muted-foreground",
                    )}
                  >
                    Row{importResults.errors !== 1 ? "s" : ""} failed
                  </p>
                </div>
              </div>

              {/* Error details */}
              {importResults.errorDetails.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-red-600">Error details:</p>
                  <ScrollArea className="h-40">
                    <div className="space-y-1.5">
                      {importResults.errorDetails.map((e, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/10 text-xs"
                        >
                          <span className="shrink-0 font-semibold text-red-600">Row {e.row}:</span>
                          <span className="text-red-700 dark:text-red-400">{e.message}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {importResults.created > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Leads table has been refreshed with the new records.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <DialogFooter className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between gap-3">
          {/* Back button */}
          {step !== "upload" && step !== "results" && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                if (step === "mapping") setStep("upload");
                else if (step === "preview") setStep("mapping");
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          {(step === "upload" || step === "results") && (
            <Button variant="outline" onClick={handleClose}>
              {step === "results" ? "Close" : "Cancel"}
            </Button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Next / Import button */}
          {step === "upload" && null /* proceed happens automatically on file select */}

          {step === "mapping" && (
            <Button
              className="gap-2 bg-brand-indigo hover:bg-brand-indigo/90 text-white"
              onClick={() => setStep("preview")}
              disabled={mappedCount === 0 || hasDuplicates}
              data-testid="csv-mapping-next"
            >
              Preview Import
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}

          {step === "preview" && (
            <Button
              className="gap-2 bg-brand-indigo hover:bg-brand-indigo/90 text-white"
              onClick={handleImport}
              disabled={importing}
              data-testid="csv-import-confirm"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  Import {csvRows.length} Lead{csvRows.length !== 1 ? "s" : ""}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          )}

          {step === "results" && importResults && importResults.errors > 0 && importResults.created === 0 && (
            <Button
              variant="outline"
              onClick={() => setStep("mapping")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Fix Mapping
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
