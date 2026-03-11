import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Download, Link, FileSignature, Trash2,
  Eye, Calendar, FileText, Copy, Check, Plus, Upload,
  Pencil, Send, X, ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import type { ContractRow } from "../types";
import { CONTRACT_STATUS_COLORS } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

// ── Deal structure helpers ────────────────────────────────────────────────────

const DEAL_TYPE_I18N_KEYS: Record<string, string> = {
  performance:      "contracts.form.dealTypes.performance",
  cost_passthrough: "contracts.form.dealTypes.costPassthrough",
  fixed_fee:        "contracts.form.dealTypes.fixedFee",
  deposit:          "contracts.form.dealTypes.deposit",
  monthly_retainer: "contracts.form.dealTypes.monthlyRetainer",
  hybrid:           "contracts.form.dealTypes.hybrid",
};

const DEAL_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  performance:      { bg: "#D1FAE5", text: "#065F46" },
  cost_passthrough: { bg: "#DBEAFE", text: "#1D4ED8" },
  fixed_fee:        { bg: "#EDE9FE", text: "#5B21B6" },
  deposit:          { bg: "#FEF3C7", text: "#92400E" },
  monthly_retainer: { bg: "#F0FDF4", text: "#166534" },
  hybrid:           { bg: "#F4F4F5", text: "#52525B" },
};

const PAYMENT_TRIGGER_I18N_KEYS: Record<string, string> = {
  call_booked: "contracts.form.paymentTriggers.callBooked",
  closed_sale: "contracts.form.paymentTriggers.closedSale",
};

function fmtMoney(val: number | string | null | undefined, currency = "EUR"): string {
  if (val === null || val === undefined || val === "") return "—";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}

function fmtRate(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "—";
  return `${n}%`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ContractDetailViewProps {
  contract: ContractRow;
  isAgencyUser: boolean;
  onMarkSigned: (id: number) => Promise<any>;
  onDelete: (id: number) => Promise<void>;
  onRefresh: () => void;
  onNew?: () => void;
  onUpdate?: (id: number, patch: Record<string, any>) => Promise<any>;
  toolbarSlot?: React.ReactNode;
  noBackground?: boolean;
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function ContractDetailViewEmpty({ toolbarSlot }: { toolbarSlot?: React.ReactNode }) {
  const { t } = useTranslation("billing");
  return (
    <div className="flex-1 flex flex-col h-full">
      {toolbarSlot && (
        <div className="px-4 pt-3 pb-1.5 flex items-center gap-1.5 shrink-0">
          {toolbarSlot}
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-stone-50 to-gray-100 flex items-center justify-center ring-1 ring-stone-200/50">
          <FileText className="h-10 w-10 text-stone-400" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground/70">{t("contracts.empty.selectAContract")}</p>
          <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">
            {t("contracts.empty.selectAContractDesc")}
          </p>
        </div>
        <div className="text-[11px] text-stone-400 font-medium">&larr; {t("contracts.empty.chooseFromList")}</div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(val: string | null | undefined): string {
  if (!val) return "\u2014";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isExpired(contract: ContractRow): boolean {
  if (contract.status === "Signed" || contract.status === "Cancelled" || contract.status === "Draft") return false;
  if (!contract.end_date) return false;
  return new Date(contract.end_date) < new Date();
}

function expiryInfo(endDate: string | null | undefined, t: TFunction): { label: string; color: string } | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (isNaN(end.getTime())) return null;
  const now = new Date();
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0)   return { label: t("contracts.detail.expiredDaysAgo", { count: Math.abs(diff) }), color: "text-rose-600" };
  if (diff === 0) return { label: t("contracts.detail.expiresToday"),                               color: "text-amber-600" };
  if (diff <= 30) return { label: t("contracts.detail.expiresInDays", { count: diff }),             color: "text-amber-600" };
  return           { label: t("contracts.detail.expiresInDays", { count: diff }),                   color: "text-foreground/60" };
}

// ── Expand-on-hover toolbar button constants ──────────────────────────────────
const xBase    = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
const xActive  = "border-brand-indigo text-brand-indigo";
const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

// ── Main Component ────────────────────────────────────────────────────────────

// ── Mobile tab type ───────────────────────────────────────────────────────────
type ContractMobileTab = "details" | "terms";

export function ContractDetailView({
  contract,
  isAgencyUser,
  onMarkSigned,
  onDelete,
  onRefresh,
  onNew,
  onUpdate,
  toolbarSlot,
  noBackground,
}: ContractDetailViewProps) {
  const { t } = useTranslation("billing");
  const displayStatus = isExpired(contract) ? "Expired" : (contract.status || "Draft");
  const statusColors  = CONTRACT_STATUS_COLORS[displayStatus] || CONTRACT_STATUS_COLORS.Draft;
  const [mobileTab, setMobileTab] = useState<ContractMobileTab>("details");

  const { toast } = useToast();

  // ── Copy link state ───────────────────────────────────────────────────────
  const [copied,       setCopied]       = useState(false);
  const [linkCopied,   setLinkCopied]   = useState(false);

  // ── Delete two-tap confirm ────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  useEffect(() => {
    if (deleteConfirm) {
      const timer = setTimeout(() => setDeleteConfirm(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [deleteConfirm]);

  // ── Action busy states ────────────────────────────────────────────────────
  const [markingSigned, setMarkingSigned] = useState(false);
  const [sending,       setSending]       = useState(false);

  // ── Edit mode (Draft contracts only) ─────────────────────────────────────
  const [isEditing,  setIsEditing]  = useState(false);
  const [editText,   setEditText]   = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // ── SignWell state ────────────────────────────────────────────────────────
  const [swDialogOpen,  setSwDialogOpen]  = useState(false);
  const [swEmail,       setSwEmail]       = useState("");
  const [swSending,     setSwSending]     = useState(false);
  const [swSigningUrl,  setSwSigningUrl]  = useState<string | null>(null);
  const [swUrlCopied,   setSwUrlCopied]   = useState(false);
  const [swTestMode,    setSwTestMode]    = useState(true);   // flip to false for real sends

  // ── Upload state ──────────────────────────────────────────────────────────
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset local state when contract changes
  useEffect(() => {
    setDeleteConfirm(false);
    setCopied(false);
    setLinkCopied(false);
    setMarkingSigned(false);
    setSending(false);
    setIsEditing(false);
    setEditText("");
    setEditSaving(false);
    setUploadOpen(false);
    setUploading(false);
    setSwDialogOpen(false);
    setSwEmail("");
    setSwSigningUrl(null);
    setMobileTab("details");
  }, [contract.id]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** Send via SignWell — creates a document and returns a signing URL */
  const handleSendSignWell = useCallback(async () => {
    if (!swEmail.trim()) return;
    setSwSending(true);
    try {
      const res = await apiFetch(`/api/contracts/${contract.id}/send-for-signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerEmail: swEmail.trim(),
          signerName:  contract.signer_name || undefined,
          testMode:    swTestMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.details?.message || data?.error || "Failed to send";
        toast({ title: t("contracts.signwell.signwellError"), description: msg, variant: "destructive" });
        return;
      }
      setSwSigningUrl(data.signingUrl || null);
      toast({
        title:       swTestMode ? t("contracts.signwell.testDocCreated") : t("contracts.signwell.sentForSignature"),
        description: swTestMode
          ? t("contracts.signwell.testDocDesc")
          : t("contracts.signwell.sentForSignatureDesc", { email: swEmail }),
      });
      onRefresh();
    } catch (err) {
      toast({ title: t("contracts.signwell.networkError"), description: String(err), variant: "destructive" });
    } finally {
      setSwSending(false);
    }
  }, [contract.id, contract.signer_name, swEmail, swTestMode, onRefresh, toast, t]);

  const handleCopySigningUrl = useCallback(async () => {
    if (!swSigningUrl) return;
    await navigator.clipboard.writeText(swSigningUrl);
    setSwUrlCopied(true);
    setTimeout(() => setSwUrlCopied(false), 2000);
  }, [swSigningUrl]);

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/api/contracts/view/${contract.view_token}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [contract.view_token]);

  /** Draft → Sent: update status + copy share link */
  const handleSend = useCallback(async () => {
    if (!onUpdate) return;
    setSending(true);
    try {
      await onUpdate(contract.id, {
        status:  "Sent",
        sent_at: new Date().toISOString(),
      });
      const url = `${window.location.origin}/api/contracts/view/${contract.view_token}`;
      await navigator.clipboard.writeText(url);
      toast({
        title:       t("contracts.actions.contractSent"),
        description: t("contracts.actions.contractSentDesc"),
      });
      onRefresh();
    } catch {
      toast({ title: t("contracts.actions.failedToSend"), variant: "destructive" });
    } finally {
      setSending(false);
    }
  }, [contract.id, contract.view_token, onUpdate, onRefresh, toast, t]);

  const handleMarkSigned = useCallback(async () => {
    setMarkingSigned(true);
    try {
      await onMarkSigned(contract.id);
      onRefresh();
    } finally {
      setMarkingSigned(false);
    }
  }, [contract.id, onMarkSigned, onRefresh]);

  const handleDelete = useCallback(async () => {
    if (deleteConfirm) {
      setDeleteConfirm(false);
      await onDelete(contract.id);
    } else {
      setDeleteConfirm(true);
    }
  }, [deleteConfirm, contract.id, onDelete]);

  const handleDownloadPdf = useCallback(() => {
    if (!contract.file_data) return;
    const a = document.createElement("a");
    a.href     = contract.file_data;
    a.download = contract.file_name || "contract.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [contract.file_data, contract.file_name]);

  // ── PDF blob URL (avoids Chromium auto-download on base64 data URLs) ──────
  const pdfBlobUrl = useMemo(() => {
    if (!contract.file_data) return null;
    try {
      const match = contract.file_data.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return contract.file_data;
      const mimeType = match[1];
      const base64 = match[2];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      return URL.createObjectURL(blob);
    } catch {
      return contract.file_data;
    }
  }, [contract.file_data]);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl && pdfBlobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  // ── Edit handlers ─────────────────────────────────────────────────────────
  const handleStartEdit = useCallback(() => {
    setEditText(contract.contract_text || "");
    setIsEditing(true);
  }, [contract.contract_text]);

  const handleSaveEdit = useCallback(async () => {
    if (!onUpdate) return;
    setEditSaving(true);
    try {
      await onUpdate(contract.id, { contract_text: editText });
      toast({ title: t("contracts.actions.contractSaved") });
      setIsEditing(false);
      onRefresh();
    } catch {
      toast({ title: t("contracts.actions.failedToSaveContract"), variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  }, [contract.id, editText, onUpdate, onRefresh, toast, t]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditText("");
  }, []);

  const handleCopyContractText = useCallback(async () => {
    const text = isEditing ? editText : (contract.contract_text || "");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [isEditing, editText, contract.contract_text]);

  // ── PDF upload ────────────────────────────────────────────────────────────
  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  const handleFileUpload = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      toast({ title: t("contracts.actions.invalidFile"), description: t("contracts.form.onlyPdfAccepted"), variant: "destructive" });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: t("contracts.actions.fileTooLarge"), description: t("contracts.form.fileSizeLimit"), variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        if (onUpdate) {
          await onUpdate(contract.id, {
            file_data: base64,
            file_name: file.name,
            file_size: file.size,
            file_type: "application/pdf",
          });
          toast({ title: t("contracts.actions.pdfAttachedTitle"), description: t("contracts.actions.pdfAttachedDesc", { name: file.name }) });
          setUploadOpen(false);
          onRefresh();
        }
      };
      reader.readAsDataURL(file);
    } catch {
      toast({ title: t("contracts.actions.uploadFailed"), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [contract.id, onUpdate, onRefresh, toast, t]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  // ── Computed values ───────────────────────────────────────────────────────
  const contractCurrency = (contract.currency as string | null) || "EUR";

  const dealType          = contract.deal_type as string | null | undefined;
  const dealTypeI18nKey   = dealType ? (DEAL_TYPE_I18N_KEYS[dealType] ?? null) : null;
  const dealTypeColor     = dealType ? (DEAL_TYPE_COLORS[dealType] ?? DEAL_TYPE_COLORS.hybrid) : null;
  const paymentTrigger        = contract.payment_trigger as string | null | undefined;
  const paymentTriggerI18nKey = paymentTrigger ? (PAYMENT_TRIGGER_I18N_KEYS[paymentTrigger] ?? null) : null;
  const showCostPassthrough = dealType === "cost_passthrough" || dealType === "hybrid";
  const showFixedFee        = dealType === "fixed_fee"        || dealType === "hybrid";
  const showDeposit         = dealType === "deposit"          || dealType === "hybrid";
  const showMonthlyFee      = dealType === "monthly_retainer" || dealType === "hybrid";
  const hasDealStructure    = !!dealType;
  const expiry = expiryInfo(contract.end_date, t);

  const canEdit = isAgencyUser && contract.status === "Draft" && !contract.file_data;
  const contractTextToShow = isEditing ? editText : (contract.contract_text || "");

  return (
    <div className="relative flex flex-col h-full overflow-hidden" data-testid="contract-detail-view">

      {/* ── Background gradients ── */}
      {!noBackground && (
        <>
          <div className="absolute inset-0 bg-popover dark:bg-background" />
          {/* Layer 1: White bloom — disabled */}
          {/* Layer 2: Yellow — disabled */}
          {/* Layer 3: Peach — disabled */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_124%_162%_at_20%_92%,rgba(219,153,244,0.4)_0%,transparent_69%)] dark:opacity-[0.08]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_200%_at_2%_2%,#C7E0FF_5%,transparent_30%)] dark:opacity-[0.08]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_102%_at_62%_47%,rgba(209,187,233,0.38)_0%,transparent_66%)] dark:opacity-[0.08]" />
        </>
      )}

      {/* ── Header ── */}
      <div className="relative z-10 shrink-0 px-[3px] pt-[3px] pb-[3px] space-y-[3px]">

        {/* Action toolbar */}
        <div className="px-4 pt-3 pb-1.5 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {toolbarSlot}
          {isAgencyUser && (
            <div className="ml-auto flex items-center gap-1 shrink-0">

              {/* New + PDF + Copy Link */}
              {onNew && (
                <button onClick={onNew} className={cn(xBase, xDefault, "hover:max-w-[80px]")}>
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className={xSpan}>{t("contracts.actions.new")}</span>
                </button>
              )}

              {contract.file_data && (
                <button onClick={handleDownloadPdf} className={cn(xBase, xDefault, "hover:max-w-[80px]")}>
                  <Download className="h-4 w-4 shrink-0" />
                  <span className={xSpan}>{t("contracts.actions.pdf")}</span>
                </button>
              )}

              <button onClick={handleCopyLink} className={cn(xBase, linkCopied ? xActive : xDefault, "hover:max-w-[110px]")}>
                {linkCopied
                  ? <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                  : <Link  className="h-4 w-4 shrink-0" />}
                <span className={xSpan}>{linkCopied ? t("contracts.actions.copied") : t("contracts.actions.copyLink")}</span>
              </button>

              {/* Edit + Send (Draft only) */}
              {contract.status === "Draft" && (
                <>
                  {canEdit && !isEditing && (
                    <button onClick={handleStartEdit} className={cn(xBase, xDefault, "hover:max-w-[80px]")}>
                      <Pencil className="h-4 w-4 shrink-0" />
                      <span className={xSpan}>{t("contracts.actions.edit")}</span>
                    </button>
                  )}

                  {/* Mark sent (simple status update + copy link) */}
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className={cn(xBase, xDefault, "hover:max-w-[110px] disabled:opacity-50")}
                  >
                    <Link className="h-4 w-4 shrink-0" />
                    <span className={xSpan}>{sending ? t("contracts.actions.sending") : t("contracts.actions.markSent")}</span>
                  </button>

                  {/* Sign via SignWell */}
                  {contract.contract_text && (
                    <button
                      onClick={() => setSwDialogOpen(v => !v)}
                      className={cn(
                        xBase,
                        swDialogOpen ? xActive : "border-brand-indigo/30 text-brand-indigo hover:text-brand-indigo",
                        "hover:max-w-[160px]"
                      )}
                    >
                      <Send className="h-4 w-4 shrink-0" />
                      <span className={xSpan}>{t("contracts.signwell.sendViaSignWell")}</span>
                    </button>
                  )}
                </>
              )}

              {/* Mark Signed (Sent / Viewed) */}
              {(contract.status === "Sent" || contract.status === "Viewed") && (
                <button
                  onClick={handleMarkSigned}
                  disabled={markingSigned}
                  className={cn(xBase, xDefault, "hover:max-w-[120px] disabled:opacity-50")}
                >
                  <FileSignature className="h-4 w-4 shrink-0" />
                  <span className={xSpan}>{markingSigned ? t("contracts.actions.updating") : t("contracts.actions.markSigned")}</span>
                </button>
              )}

              {/* Delete */}
              <button
                onClick={handleDelete}
                className={cn(
                  xBase,
                  "hover:max-w-[100px]",
                  deleteConfirm
                    ? "border-red-400/60 text-red-600"
                    : xDefault
                )}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                <span className={xSpan}>{deleteConfirm ? t("contracts.actions.confirm") : t("contracts.actions.delete")}</span>
              </button>
            </div>
          )}
        </div>

        {/* ── SignWell inline dialog ── */}
        {swDialogOpen && (
          <div className="mx-3 mb-1 rounded-xl border border-brand-indigo/20 bg-brand-indigo/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-foreground">{t("contracts.signwell.sendViaSignWell")}</p>
                <p className="text-[11px] text-foreground/50 mt-0.5">
                  {swTestMode
                    ? t("contracts.signwell.testModeActive")
                    : t("contracts.signwell.liveModeActive")}
                </p>
              </div>
              <button
                onClick={() => { setSwDialogOpen(false); setSwSigningUrl(null); }}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card border border-border/40 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            {/* Signer email input */}
            {!swSigningUrl && (
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder={t("contracts.signwell.signerEmailPlaceholder")}
                  value={swEmail}
                  onChange={e => setSwEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSendSignWell(); }}
                  className="flex-1 h-9 text-[12px]"
                />
                <button
                  onClick={handleSendSignWell}
                  disabled={swSending || !swEmail.trim()}
                  className="h-9 px-4 rounded-lg text-[12px] font-semibold bg-brand-indigo text-white hover:bg-brand-indigo/90 disabled:opacity-50 transition-colors shrink-0"
                >
                  {swSending ? t("contracts.signwell.creating") : t("contracts.signwell.send")}
                </button>
              </div>
            )}

            {/* Test mode toggle */}
            {!swSigningUrl && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setSwTestMode(v => !v)}
                  className={cn(
                    "w-8 h-4 rounded-full transition-colors cursor-pointer relative",
                    swTestMode ? "bg-amber-400" : "bg-brand-indigo"
                  )}
                >
                  <div className={cn(
                    "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform",
                    swTestMode ? "translate-x-0.5" : "translate-x-4"
                  )} />
                </div>
                <span className="text-[11px] text-foreground/60">
                  {swTestMode ? t("contracts.signwell.testModeOn") : t("contracts.signwell.liveMode")}
                </span>
              </label>
            )}

            {/* Signing URL result */}
            {swSigningUrl && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-emerald-700">
                  {t("contracts.signwell.documentCreated")}
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-card border border-border/50 font-mono text-[10px] text-foreground/70 truncate">
                    {swSigningUrl}
                  </div>
                  <button
                    onClick={handleCopySigningUrl}
                    className="h-9 px-3 rounded-lg text-[12px] font-medium bg-card border border-border/50 hover:bg-muted/60 transition-colors shrink-0 flex items-center gap-1"
                  >
                    {swUrlCopied
                      ? <><Check className="h-3 w-3 text-emerald-600" /> {t("contracts.signwell.linkCopied")}</>
                      : <><Copy className="h-3 w-3" /> {t("contracts.signwell.copyLink")}</>}
                  </button>
                  <a
                    href={swSigningUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-3 rounded-lg text-[12px] font-medium bg-card border border-border/50 hover:bg-muted/60 transition-colors shrink-0 flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {t("contracts.signwell.open")}
                  </a>
                </div>
                <p className="text-[10px] text-foreground/40">
                  {swTestMode ? t("contracts.signwell.testDocNote") : t("contracts.signwell.contractSentNote")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Title + status + tracking */}
        <div className="px-4 pt-3 pb-2 space-y-2">
          <div>
            <h2 className="text-[22px] font-semibold font-heading text-foreground leading-tight">
              {contract.title || t("contracts.card.untitledContract")}
            </h2>
            {contract.account_name && (
              <span className="text-[13px] text-foreground/50 mt-0.5 block">
                {contract.account_name}
              </span>
            )}
          </div>

        </div>
      </div>

      {/* ── Mobile tab bar (hidden on desktop) ── */}
      <div className="md:hidden relative z-10 flex gap-1 px-4 pb-3 overflow-x-auto [scrollbar-width:none] shrink-0" data-testid="contract-mobile-tabs">
        {([
          { id: "details" as const, label: t("mobileTabs.details") },
          { id: "terms" as const,   label: t("mobileTabs.terms") },
        ] as { id: ContractMobileTab; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setMobileTab(id)}
            data-testid={`contract-tab-${id}`}
            className={cn(
              "h-8 px-3.5 rounded-full text-[12px] font-semibold shrink-0 transition-colors",
              mobileTab === id
                ? "bg-foreground text-background"
                : "bg-white/60 dark:bg-white/[0.10] text-foreground/60 border border-border/40"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Two-column content area ── */}
      <div className="relative z-10 flex-1 min-h-0 px-[3px] pb-[3px] overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-[3px] max-w-[1386px] w-full mr-auto">

          {/* ── LEFT column: full-height contract widget ── */}
          <div className={cn("bg-white/60 dark:bg-white/[0.10] rounded-xl flex flex-col min-h-[280px] md:min-h-0 overflow-hidden", mobileTab !== "terms" ? "hidden md:flex" : "flex")}>

            {/* Contract widget header */}
            <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-border/20 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold uppercase tracking-widest text-foreground/40 font-heading">
                  {t("contracts.detail.contractHeader")}
                </span>
                {isEditing && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">
                    {t("contracts.detail.editing")}
                  </span>
                )}
                {contract.file_data && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                    {t("contracts.detail.pdfAttachedBadge")}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={editSaving}
                      className="inline-flex items-center gap-1 h-7 px-3 rounded-lg text-[11px] font-semibold bg-brand-indigo text-white hover:bg-brand-indigo/90 disabled:opacity-50 transition-colors"
                    >
                      {editSaving ? t("contracts.actions.savingText") : t("contracts.actions.saveText")}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-card border border-border/40 transition-colors"
                    >
                      <X className="h-3 w-3" />
                      {t("contracts.form.cancel")}
                    </button>
                  </>
                ) : (
                  <>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={handleStartEdit}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-card border border-border/40 transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                        {t("contracts.actions.editText")}
                      </button>
                    )}
                    {(contract.contract_text || isEditing) && (
                      <button
                        type="button"
                        onClick={handleCopyContractText}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-card border border-border/40 transition-colors"
                      >
                        {copied
                          ? <Check className="h-3 w-3 text-emerald-600" />
                          : <Copy  className="h-3 w-3" />}
                        {copied ? t("contracts.actions.copied") : t("contracts.actions.copyText")}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Contract content (fills remaining height) ── */}
            {isEditing ? (
              /* Edit mode — editable textarea */
              <>
                <textarea
                  className="flex-1 min-h-0 w-full resize-none bg-transparent font-sans text-[12px] leading-relaxed text-foreground/80 p-6 outline-none"
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  spellCheck={false}
                  autoFocus
                />
                <div className="px-6 py-1.5 border-t border-border/20 shrink-0">
                  <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                    {t("contracts.detail.characters", { count: editText.length })}
                  </span>
                </div>
              </>
            ) : pdfBlobUrl ? (
              /* PDF embed */
              <object
                data={pdfBlobUrl}
                type="application/pdf"
                className="w-full flex-1 min-h-0 border-0 rounded-b-xl"
              >
                <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
                  <p className="text-sm text-muted-foreground">{t("contracts.detail.pdfPreviewUnavailable")}</p>
                  <button
                    onClick={handleDownloadPdf}
                    className="text-sm text-brand-indigo hover:underline font-medium"
                  >
                    {t("contracts.detail.downloadPdf")}
                  </button>
                </div>
              </object>
            ) : contract.contract_text ? (
              /* Read-only contract text with bold section headings */
              <>
                <div className="flex-1 min-h-0 overflow-y-auto font-sans text-[12px] leading-relaxed text-foreground/75 whitespace-pre-wrap p-6">
                  {contract.contract_text.split("\n").map((line, i) => {
                    const trimmed = line.trim();
                    const isHeading = /^\d+[\.\)]/.test(trimmed) || (trimmed.length > 0 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed));
                    return (
                      <span key={i}>
                        {isHeading ? <strong className="text-foreground font-semibold">{line}</strong> : line}
                        {"\n"}
                      </span>
                    );
                  })}
                </div>
                <div className="px-6 py-1.5 border-t border-border/20 shrink-0">
                  <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                    {t("contracts.detail.characters", { count: contract.contract_text.length })}
                  </span>
                </div>
              </>
            ) : (
              /* Empty state */
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-stone-100 flex items-center justify-center">
                  <FileText className="h-7 w-7 text-stone-400" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-[12px] font-medium text-foreground/40">{t("contracts.detail.noDocumentYet")}</p>
                  <p className="text-[11px] text-foreground/25">
                    {isAgencyUser
                      ? t("contracts.detail.attachSignedPdfHint")
                      : t("contracts.detail.noDocumentAttached")}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT column: stacked info widgets ── */}
          <div className={cn("flex flex-col gap-[3px]", mobileTab === "terms" ? "hidden md:flex" : "flex")}>

            {/* Status widget (consolidated with tracking) */}
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 shrink-0">
              <span className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading block mb-4">
                {t("contracts.detail.status")}
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold"
                style={{ backgroundColor: statusColors.bg, color: statusColors.text }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColors.dot }} />
                {t(`contracts.statusLabels.${displayStatus}`, displayStatus)}
              </span>
              <div className="flex items-center gap-1.5 mt-3">
                <Eye className="h-3.5 w-3.5 text-foreground/40" />
                <span className="text-[14px] font-bold tabular-nums text-foreground leading-none">
                  {contract.viewed_count ?? 0}
                </span>
                <span className="text-[11px] text-foreground/40">
                  {(contract.viewed_count ?? 0) === 1 ? t("contracts.detail.view") : t("contracts.detail.views")}
                </span>
              </div>
              {contract.viewed_at && (
                <span className="text-[10px] text-foreground/40 mt-1.5 block">
                  {t("contracts.detail.firstViewed", { date: fmtDate(contract.viewed_at) })}
                </span>
              )}
              {contract.signed_at && (
                <span className="text-[10px] text-emerald-600 mt-2 block">
                  {t("contracts.detail.signed", { date: fmtDate(contract.signed_at) })}
                </span>
              )}
              {contract.sent_at && contract.status !== "Draft" && (
                <span className="text-[10px] text-foreground/40 mt-1 block">
                  {t("contracts.detail.sent", { date: fmtDate(contract.sent_at) })}
                </span>
              )}
              {(contract.status === "Sent" || contract.status === "Viewed") && isAgencyUser && (
                <button
                  onClick={handleMarkSigned}
                  disabled={markingSigned}
                  className={cn(xBase, xDefault, "mt-3 hover:max-w-[120px] disabled:opacity-50")}
                >
                  <FileSignature className="h-4 w-4 shrink-0" />
                  <span className={xSpan}>{markingSigned ? t("contracts.actions.updating") : t("contracts.actions.markSigned")}</span>
                </button>
              )}
            </div>

            {/* Dates widget */}
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 shrink-0">
              <span className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading block mb-4">
                {t("contracts.detail.dates")}
              </span>

              {/* Start date */}
              <div className="pb-3">
                <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">
                  {t("contracts.detail.start")}
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  <Calendar className="h-3 w-3 text-foreground/30 shrink-0" />
                  <span className="text-[12px] font-semibold text-foreground tabular-nums">
                    {fmtDate(contract.start_date)}
                  </span>
                </div>
              </div>

              {/* End date */}
              <div className="pt-3 border-t border-border/20">
                <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">
                  {t("contracts.detail.end")}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Calendar className="h-3 w-3 text-foreground/30 shrink-0" />
                  <span className="text-[12px] font-semibold text-foreground tabular-nums">
                    {fmtDate(contract.end_date)}
                  </span>
                </div>
                {expiry && displayStatus !== "Signed" && displayStatus !== "Cancelled" && (
                  <span className={cn("text-[10px] font-medium mt-1 block", expiry.color)}>
                    {expiry.label}
                  </span>
                )}
              </div>
            </div>

            {/* Deal Structure widget */}
            {hasDealStructure && (
              <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 shrink-0">
                <span className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading block mb-4">
                  {t("contracts.detail.dealStructure")}
                </span>

                {contract.signer_name && (
                  <div className="pb-3">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">{t("contracts.detail.signer")}</span>
                    <span className="text-[12px] font-semibold text-foreground block mt-0.5">{contract.signer_name}</span>
                  </div>
                )}

                {dealTypeI18nKey && dealTypeColor && (
                  <div className={cn("mb-3", contract.signer_name && "pt-3 border-t border-border/20")}>
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{ backgroundColor: dealTypeColor.bg, color: dealTypeColor.text }}
                    >
                      {t(dealTypeI18nKey, dealType ?? undefined)}
                    </span>
                  </div>
                )}

                <div className="space-y-0">
                  {contract.value_per_booking != null && (
                    <div className="pb-3">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">{t("contracts.detail.valuePerBooking")}</span>
                      <span className="text-[12px] font-semibold text-foreground block mt-0.5 tabular-nums">
                        {fmtMoney(contract.value_per_booking, contractCurrency)}
                      </span>
                    </div>
                  )}
                  {paymentTriggerI18nKey && (
                    <div className={cn("pb-3", contract.value_per_booking != null && "pt-3 border-t border-border/20")}>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">{t("contracts.detail.paymentTrigger")}</span>
                      <span className="text-[12px] font-semibold text-foreground block mt-0.5">{t(paymentTriggerI18nKey, { defaultValue: paymentTrigger ?? "" })}</span>
                    </div>
                  )}
                  {showCostPassthrough && contract.cost_passthrough_rate != null && (
                    <div className="pt-3 border-t border-border/20 pb-3">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">{t("contracts.detail.costPassthrough")}</span>
                      <span className="text-[12px] font-semibold text-foreground block mt-0.5 tabular-nums">{fmtRate(contract.cost_passthrough_rate)}</span>
                    </div>
                  )}
                  {showFixedFee && contract.fixed_fee_amount != null && (
                    <div className="pt-3 border-t border-border/20 pb-3">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">{t("contracts.detail.fixedFee")}</span>
                      <span className="text-[12px] font-semibold text-foreground block mt-0.5 tabular-nums">{fmtMoney(contract.fixed_fee_amount, contractCurrency)}</span>
                    </div>
                  )}
                  {showDeposit && contract.deposit_amount != null && (
                    <div className="pt-3 border-t border-border/20 pb-3">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">{t("contracts.detail.deposit")}</span>
                      <span className="text-[12px] font-semibold text-foreground block mt-0.5 tabular-nums">{fmtMoney(contract.deposit_amount, contractCurrency)}</span>
                    </div>
                  )}
                  {showMonthlyFee && contract.monthly_fee != null && (
                    <div className="pt-3 border-t border-border/20 pb-3">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">{t("contracts.detail.monthlyFee")}</span>
                      <span className="text-[12px] font-semibold text-foreground block mt-0.5 tabular-nums">{fmtMoney(contract.monthly_fee, contractCurrency)} {t("contracts.detail.perMonth")}</span>
                    </div>
                  )}
                </div>

                {/* Invoice cadence */}
                {contract.invoice_cadence && (
                  <div className="pt-3 border-t border-border/20">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">{t("contracts.detail.invoiceCadence")}</span>
                    <span className="text-[12px] font-semibold text-foreground block mt-0.5 capitalize">{contract.invoice_cadence}</span>
                  </div>
                )}
              </div>
            )}

            {/* Attach / Replace PDF (agency only) */}
            {isAgencyUser && (
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={() => setUploadOpen(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/[0.10] border border-border/30 text-[12px] font-medium text-foreground/70 hover:text-foreground hover:bg-white/80 dark:hover:bg-white/[0.08] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Upload className="h-3.5 w-3.5" />
                    {contract.file_data ? t("contracts.detail.replacePdf") : t("contracts.detail.attachSignedPdf")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{uploadOpen ? "▲" : "▼"}</span>
                </button>

                {uploadOpen && (
                  <div
                    className="mt-[3px] border-2 border-dashed border-border/50 rounded-xl p-5 text-center cursor-pointer hover:border-brand-indigo/40 transition-colors bg-white/40 dark:bg-white/[0.04]"
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={e => e.preventDefault()}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
                        {uploading
                          ? <div className="h-4 w-4 rounded-full border-2 border-brand-indigo border-t-transparent animate-spin" />
                          : <FileText className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <p className="text-[12px] font-medium text-foreground/70">
                        {uploading ? t("contracts.detail.uploading") : t("contracts.detail.dropPdfBrowse")}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{t("contracts.detail.pdfOnlyMax5MB")}</p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf"
                      hidden
                      ref={fileInputRef}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Bottom spacer so last widget isn't flush with edge */}
            <div className="shrink-0 h-1" />
          </div>

        </div>
      </div>
    </div>
  );
}
