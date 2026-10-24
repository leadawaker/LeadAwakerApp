import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { RightPanel } from "@/components/crm/primitives";
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
import { Upload, FileText, X } from "lucide-react";

// Upload an existing contract PDF as a right-hand panel (UI_STANDARDS 3.7).
// Mount it only while open; closing unmounts it, which resets the form.

// ── Props ─────────────────────────────────────────────────────────────────────

interface ContractUploadPanelProps {
  onClose: () => void;
  accounts: Array<{ id: number; name: string | null }>;
  isAgencyUser: boolean;
  onCreate: (payload: Record<string, any>) => Promise<any>;
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ContractUploadPanel({
  onClose,
  accounts,
  isAgencyUser,
  onCreate,
  className,
}: ContractUploadPanelProps) {
  const { t } = useTranslation("billing");

  // ── Form state ────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Reset ─────────────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setTitle("");
    setAccountId("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setFileData(null);
    setFileName("");
    setFileSize(0);
    setSaving(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // ── File handler ──────────────────────────────────────────────────────────

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (file.type !== "application/pdf") {
      alert(t("contracts.form.onlyPdfAccepted"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      alert(t("contracts.form.fileSizeLimit"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileData(reader.result as string);
      setFileName(file.name);
      setFileSize(file.size);
    };
    reader.readAsDataURL(file);
  }, [t]);

  const handleRemoveFile = useCallback(() => {
    setFileData(null);
    setFileName("");
    setFileSize(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // ── Drop handler ──────────────────────────────────────────────────────────

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert(t("contracts.form.onlyPdfAccepted"));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert(t("contracts.form.fileSizeLimit"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileData(reader.result as string);
      setFileName(file.name);
      setFileSize(file.size);
    };
    reader.readAsDataURL(file);
  }, [t]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return;

    setSaving(true);
    try {
      await onCreate({
        title: title.trim(),
        Accounts_id: accountId ? Number(accountId) : null,
        description: description.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        file_data: fileData,
        file_name: fileName || null,
        file_size: fileSize || null,
        file_type: fileData ? "application/pdf" : null,
        status: "Draft",
      });
      resetForm();
      onClose();
    } catch {
      // error handled by caller
    } finally {
      setSaving(false);
    }
  }, [
    title, accountId, description, startDate, endDate,
    fileData, fileName, fileSize, onCreate, resetForm, onClose,
  ]);

  return (
    <RightPanel
      title={t("contracts.form.uploadContract")}
      onClose={onClose}
      cancelLabel={t("contracts.form.cancel")}
      submitLabel={saving ? t("contracts.form.uploading") : t("contracts.form.uploadContract2")}
      onSubmit={handleSubmit}
      submitting={saving}
      submitDisabled={!title.trim()}
      className={className}
      data-testid="contract-upload-panel"
    >
        <div className="space-y-4">

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="contract-title">{t("contracts.form.title")}</Label>
            <Input
              id="contract-title"
              placeholder={t("contracts.form.titlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Account select */}
          <div className="space-y-1.5">
            <Label>{t("contracts.form.account")}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder={t("contracts.form.selectAccount")} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={String(acc.id)}>
                    {acc.name || `Account #${acc.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="contract-description">{t("contracts.form.description")}</Label>
            <Textarea
              id="contract-description"
              placeholder={t("contracts.form.descriptionPlaceholder")}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contract-start-date">{t("contracts.form.startDate")}</Label>
              <Input
                id="contract-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contract-end-date">{t("contracts.form.endDate")}</Label>
              <Input
                id="contract-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* File upload zone */}
          <div className="space-y-1.5">
            <Label>{t("contracts.form.pdfFile")}</Label>
            <div
              className="border-2 border-dashed border-border/60 rounded-xl p-8 text-center hover:border-brand-indigo/40 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {fileData ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="text-[13px] font-medium text-foreground">{fileName}</p>
                  <p className="text-[11px] text-muted-foreground">{formatFileSize(fileSize)}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile();
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-red-500 hover:text-red-600 font-medium mt-1"
                  >
                    <X className="h-3 w-3" />
                    {t("contracts.form.remove")}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-10 w-10 rounded-xl bg-stone-100 flex items-center justify-center">
                    <Upload className="h-5 w-5 text-stone-400" />
                  </div>
                  <p className="text-[13px] font-medium text-foreground/70">
                    {t("contracts.form.dropPdfOrBrowse")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("contracts.form.pdfOnlyMax5MB")}
                  </p>
                </div>
              )}
              <input
                type="file"
                accept=".pdf"
                hidden
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>
          </div>
        </div>
    </RightPanel>
  );
}
