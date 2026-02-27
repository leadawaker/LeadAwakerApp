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

// ── Deal structure helpers ────────────────────────────────────────────────────

const DEAL_TYPE_LABELS: Record<string, string> = {
  performance:      "Zero-risk / Performance",
  cost_passthrough: "Cost Passthrough",
  fixed_fee:        "Fixed Upfront Fee",
  deposit:          "Deposit + Return",
  monthly_retainer: "Monthly Retainer",
  hybrid:           "Hybrid / Mix",
};

const DEAL_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  performance:      { bg: "#D1FAE5", text: "#065F46" },
  cost_passthrough: { bg: "#DBEAFE", text: "#1D4ED8" },
  fixed_fee:        { bg: "#EDE9FE", text: "#5B21B6" },
  deposit:          { bg: "#FEF3C7", text: "#92400E" },
  monthly_retainer: { bg: "#F0FDF4", text: "#166534" },
  hybrid:           { bg: "#F4F4F5", text: "#52525B" },
};

const PAYMENT_TRIGGER_LABELS: Record<string, string> = {
  call_booked: "Call Booked",
  closed_sale: "Closed Sale (by client's team)",
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
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function ContractDetailViewEmpty() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-stone-50 to-gray-100 flex items-center justify-center ring-1 ring-stone-200/50">
        <FileText className="h-10 w-10 text-stone-400" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground/70">Select a contract</p>
        <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">
          Click any contract on the left to see its details and document.
        </p>
      </div>
      <div className="text-[11px] text-stone-400 font-medium">&larr; Choose from the list</div>
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

function expiryInfo(endDate: string | null | undefined): { label: string; color: string } | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (isNaN(end.getTime())) return null;
  const now = new Date();
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0)   return { label: `Expired ${Math.abs(diff)}d ago`, color: "text-rose-600" };
  if (diff === 0) return { label: "Expires today",                   color: "text-amber-600" };
  if (diff <= 30) return { label: `Expires in ${diff}d`,             color: "text-amber-600" };
  return           { label: `Expires in ${diff}d`,                   color: "text-foreground/60" };
}

// ── Action button base class ──────────────────────────────────────────────────
const actionBtn = "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-card transition-colors";

// ── Main Component ────────────────────────────────────────────────────────────

export function ContractDetailView({
  contract,
  isAgencyUser,
  onMarkSigned,
  onDelete,
  onRefresh,
  onNew,
  onUpdate,
}: ContractDetailViewProps) {
  const displayStatus = isExpired(contract) ? "Expired" : (contract.status || "Draft");
  const statusColors  = CONTRACT_STATUS_COLORS[displayStatus] || CONTRACT_STATUS_COLORS.Draft;

  const { toast } = useToast();

  // ── Copy link state ───────────────────────────────────────────────────────
  const [copied,       setCopied]       = useState(false);
  const [linkCopied,   setLinkCopied]   = useState(false);

  // ── Delete two-tap confirm ────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  useEffect(() => {
    if (deleteConfirm) {
      const t = setTimeout(() => setDeleteConfirm(false), 3000);
      return () => clearTimeout(t);
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
        toast({ title: "SignWell error", description: msg, variant: "destructive" });
        return;
      }
      setSwSigningUrl(data.signingUrl || null);
      toast({
        title:       swTestMode ? "Test document created" : "Sent for signature",
        description: swTestMode
          ? "Test mode — no real email sent. Copy the signing link below."
          : `Signing link sent to ${swEmail}.`,
      });
      onRefresh();
    } catch (err) {
      toast({ title: "Network error", description: String(err), variant: "destructive" });
    } finally {
      setSwSending(false);
    }
  }, [contract.id, contract.signer_name, swEmail, swTestMode, onRefresh, toast]);

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
        title:       "Contract sent",
        description: "Status updated to Sent. Share link copied to clipboard.",
      });
      onRefresh();
    } catch {
      toast({ title: "Failed to send contract", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }, [contract.id, contract.view_token, onUpdate, onRefresh, toast]);

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
      toast({ title: "Contract saved" });
      setIsEditing(false);
      onRefresh();
    } catch {
      toast({ title: "Failed to save contract", variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  }, [contract.id, editText, onUpdate, onRefresh, toast]);

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
      toast({ title: "Invalid file", description: "Only PDF files are accepted.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "File too large", description: "Max file size is 5 MB.", variant: "destructive" });
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
          toast({ title: "PDF attached", description: `"${file.name}" has been attached.` });
          setUploadOpen(false);
          onRefresh();
        }
      };
      reader.readAsDataURL(file);
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [contract.id, onUpdate, onRefresh, toast]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  // ── Computed values ───────────────────────────────────────────────────────
  const expiry     = expiryInfo(contract.end_date);
  const contractCurrency = (contract.currency as string | null) || "EUR";

  const dealType          = contract.deal_type as string | null | undefined;
  const dealTypeLabel     = dealType ? (DEAL_TYPE_LABELS[dealType] ?? dealType) : null;
  const dealTypeColor     = dealType ? (DEAL_TYPE_COLORS[dealType] ?? DEAL_TYPE_COLORS.hybrid) : null;
  const paymentTrigger      = contract.payment_trigger as string | null | undefined;
  const paymentTriggerLabel = paymentTrigger ? (PAYMENT_TRIGGER_LABELS[paymentTrigger] ?? paymentTrigger) : null;
  const showCostPassthrough = dealType === "cost_passthrough" || dealType === "hybrid";
  const showFixedFee        = dealType === "fixed_fee"        || dealType === "hybrid";
  const showDeposit         = dealType === "deposit"          || dealType === "hybrid";
  const showMonthlyFee      = dealType === "monthly_retainer" || dealType === "hybrid";
  const hasDealStructure    = !!dealType;

  const canEdit = isAgencyUser && contract.status === "Draft" && !contract.file_data;
  const contractTextToShow = isEditing ? editText : (contract.contract_text || "");

  return (
    <div className="relative flex flex-col h-full overflow-hidden" data-testid="contract-detail-view">

      {/* ── Background gradients ── */}
      <div className="absolute inset-0 bg-[#F8F3EB]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.9)_0%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,242,134,0.35)_0%,transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(241,218,162,0.2)_0%,transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(210,188,130,0.15)_0%,transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(105,170,255,0.18)_0%,transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,rgba(165,205,255,0.12)_0%,transparent_60%)]" />

      {/* ── Header ── */}
      <div className="relative z-10 shrink-0 px-[3px] pt-[3px] pb-[3px] space-y-[3px]">

        {/* Action toolbar (agency only) */}
        {isAgencyUser && (
          <div className="px-3 py-2 flex items-center gap-1 flex-wrap">

            {/* Group 1: New + PDF + Copy Link */}
            {onNew && (
              <button onClick={onNew} className={actionBtn}>
                <Plus className="h-3 w-3" />
                New
              </button>
            )}

            {contract.file_data && (
              <button onClick={handleDownloadPdf} className={actionBtn}>
                <Download className="h-3 w-3" />
                PDF
              </button>
            )}

            <button onClick={handleCopyLink} className={actionBtn}>
              {linkCopied
                ? <Check className="h-3 w-3 text-emerald-500" />
                : <Link  className="h-3 w-3" />}
              {linkCopied ? "Copied!" : "Copy Link"}
            </button>

            {/* Group 2: Edit + Send (Draft only) */}
            {contract.status === "Draft" && (
              <>
                <div className="h-4 w-px bg-border/40 shrink-0" />

                {canEdit && !isEditing && (
                  <button onClick={handleStartEdit} className={actionBtn}>
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                )}

                {/* Mark sent (simple status update + copy link) */}
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className={cn(actionBtn, "disabled:opacity-50")}
                >
                  <Link className="h-3 w-3" />
                  {sending ? "Sending..." : "Mark Sent"}
                </button>

                {/* Sign via SignWell */}
                {contract.contract_text && (
                  <button
                    onClick={() => setSwDialogOpen(v => !v)}
                    className={cn(
                      actionBtn,
                      "bg-brand-indigo/10 border-brand-indigo/30 text-brand-indigo hover:bg-brand-indigo/20",
                      swDialogOpen && "bg-brand-indigo/20"
                    )}
                  >
                    <Send className="h-3 w-3" />
                    Sign via SignWell
                  </button>
                )}
              </>
            )}

            {/* Group 3: Mark Signed (Sent / Viewed) */}
            {(contract.status === "Sent" || contract.status === "Viewed") && (
              <>
                <div className="h-4 w-px bg-border/40 shrink-0" />
                <button
                  onClick={handleMarkSigned}
                  disabled={markingSigned}
                  className={cn(actionBtn, "disabled:opacity-50")}
                >
                  <FileSignature className="h-3 w-3" />
                  {markingSigned ? "Updating..." : "Mark Signed"}
                </button>
              </>
            )}

            {/* Group 4: Delete */}
            <div className="h-4 w-px bg-border/40 shrink-0" />
            <button
              onClick={handleDelete}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition-colors",
                deleteConfirm
                  ? "border-red-400/60 text-red-600 bg-red-50/50 hover:bg-red-50/70"
                  : "border-border/60 bg-transparent text-foreground hover:bg-card"
              )}
            >
              <Trash2 className="h-3 w-3" />
              {deleteConfirm ? "Confirm?" : "Delete"}
            </button>
          </div>
        )}

        {/* ── SignWell inline dialog ── */}
        {swDialogOpen && (
          <div className="mx-3 mb-1 rounded-xl border border-brand-indigo/20 bg-brand-indigo/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-foreground">Send for e-Signature via SignWell</p>
                <p className="text-[11px] text-foreground/50 mt-0.5">
                  {swTestMode
                    ? "Test mode — no real email sent, signing link returned directly."
                    : "Live — SignWell will email the signer automatically."}
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
                  placeholder="Signer email address"
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
                  {swSending ? "Creating..." : "Send"}
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
                  {swTestMode ? "Test mode ON (safe to try)" : "Live mode — will send real email"}
                </span>
              </label>
            )}

            {/* Signing URL result */}
            {swSigningUrl && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-emerald-700">
                  Document created. Share this signing link:
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 px-3 py-2 rounded-lg bg-white border border-border/50 font-mono text-[10px] text-foreground/70 truncate">
                    {swSigningUrl}
                  </div>
                  <button
                    onClick={handleCopySigningUrl}
                    className="h-9 px-3 rounded-lg text-[12px] font-medium bg-card border border-border/50 hover:bg-muted/60 transition-colors shrink-0 flex items-center gap-1"
                  >
                    {swUrlCopied
                      ? <><Check className="h-3 w-3 text-emerald-600" /> Copied</>
                      : <><Copy className="h-3 w-3" /> Copy</>}
                  </button>
                  <a
                    href={swSigningUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-3 rounded-lg text-[12px] font-medium bg-card border border-border/50 hover:bg-muted/60 transition-colors shrink-0 flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open
                  </a>
                </div>
                <p className="text-[10px] text-foreground/40">
                  {swTestMode ? "⚠ Test document — no real signature legally binding." : "Contract sent. Status updated to Sent."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Title + status + tracking */}
        <div className="px-4 pt-3 pb-2 space-y-2">
          <div>
            <h2 className="text-[22px] font-semibold font-heading text-foreground leading-tight">
              {contract.title || "Untitled Contract"}
            </h2>
            {contract.account_name && (
              <span className="text-[13px] text-foreground/50 mt-0.5 block">
                {contract.account_name}
              </span>
            )}
          </div>

          {/* Status + Tracking inline */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold"
              style={{ backgroundColor: statusColors.bg, color: statusColors.text }}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColors.dot }} />
              {displayStatus}
            </span>

            {/* Tracking pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/50">
              <Eye className="h-3.5 w-3.5 text-foreground/40" />
              <span className="text-[12px] font-semibold tabular-nums text-foreground">
                {contract.viewed_count ?? 0}
              </span>
              <span className="text-[11px] text-foreground/40">
                {(contract.viewed_count ?? 0) === 1 ? "view" : "views"}
              </span>
            </div>

            {contract.signer_name && (
              <span className="text-[12px] text-foreground/50 italic">
                Signer: {contract.signer_name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Two-column content area ── */}
      <div className="relative z-10 flex-1 min-h-0 px-[3px] pb-[3px] overflow-hidden">
        <div className="grid grid-cols-[1fr_1.6fr] gap-[3px] h-full">

          {/* ── LEFT column: stacked info widgets ── */}
          <div className="flex flex-col gap-[3px] overflow-y-auto min-h-0">

            {/* Status widget */}
            <div className="bg-white/60 rounded-xl p-4 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 block mb-2">
                Status
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold"
                style={{ backgroundColor: statusColors.bg, color: statusColors.text }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColors.dot }} />
                {displayStatus}
              </span>
              {contract.signed_at && (
                <span className="text-[10px] text-emerald-600 mt-2 block">
                  Signed {fmtDate(contract.signed_at)}
                </span>
              )}
              {contract.sent_at && contract.status !== "Draft" && (
                <span className="text-[10px] text-foreground/40 mt-1 block">
                  Sent {fmtDate(contract.sent_at)}
                </span>
              )}
            </div>

            {/* Dates widget */}
            <div className="bg-white/60 rounded-xl p-4 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 block mb-2">
                Dates
              </span>

              {/* Start date */}
              <div className="pb-3">
                <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">
                  Start
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
                  End
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
              <div className="bg-white/60 rounded-xl p-4 shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 block mb-3">
                  Deal Structure
                </span>

                {dealTypeLabel && dealTypeColor && (
                  <div className="mb-3">
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{ backgroundColor: dealTypeColor.bg, color: dealTypeColor.text }}
                    >
                      {dealTypeLabel}
                    </span>
                  </div>
                )}

                <div className="space-y-0">
                  {contract.value_per_booking != null && (
                    <div className="pb-3">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">Value per Booking</span>
                      <span className="text-[12px] font-semibold text-foreground block mt-0.5 tabular-nums">
                        {fmtMoney(contract.value_per_booking, contractCurrency)}
                      </span>
                    </div>
                  )}
                  {paymentTriggerLabel && (
                    <div className={cn("pb-3", contract.value_per_booking != null && "pt-3 border-t border-border/20")}>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">Payment Trigger</span>
                      <span className="text-[12px] font-semibold text-foreground block mt-0.5">{paymentTriggerLabel}</span>
                    </div>
                  )}
                  {showCostPassthrough && contract.cost_passthrough_rate != null && (
                    <div className="pt-3 border-t border-border/20 pb-3">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">Cost Passthrough</span>
                      <span className="text-[12px] font-semibold text-foreground block mt-0.5 tabular-nums">{fmtRate(contract.cost_passthrough_rate)}</span>
                    </div>
                  )}
                  {showFixedFee && contract.fixed_fee_amount != null && (
                    <div className="pt-3 border-t border-border/20 pb-3">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">Fixed Fee</span>
                      <span className="text-[12px] font-semibold text-foreground block mt-0.5 tabular-nums">{fmtMoney(contract.fixed_fee_amount, contractCurrency)}</span>
                    </div>
                  )}
                  {showDeposit && contract.deposit_amount != null && (
                    <div className="pt-3 border-t border-border/20 pb-3">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">Deposit</span>
                      <span className="text-[12px] font-semibold text-foreground block mt-0.5 tabular-nums">{fmtMoney(contract.deposit_amount, contractCurrency)}</span>
                    </div>
                  )}
                  {showMonthlyFee && contract.monthly_fee != null && (
                    <div className="pt-3 border-t border-border/20 pb-3">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">Monthly Fee</span>
                      <span className="text-[12px] font-semibold text-foreground block mt-0.5 tabular-nums">{fmtMoney(contract.monthly_fee, contractCurrency)} / mo</span>
                    </div>
                  )}
                </div>

                {/* Invoice cadence */}
                {contract.invoice_cadence && (
                  <div className="pt-3 border-t border-border/20">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">Invoice Cadence</span>
                    <span className="text-[12px] font-semibold text-foreground block mt-0.5 capitalize">{contract.invoice_cadence}</span>
                  </div>
                )}
              </div>
            )}

            {/* Tracking widget */}
            <div className="bg-white/60 rounded-xl p-4 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 block mb-2">
                Tracking
              </span>
              <div className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-foreground/40" />
                <span className="text-[18px] font-bold tabular-nums text-foreground leading-none">
                  {contract.viewed_count ?? 0}
                </span>
                <span className="text-[11px] text-foreground/40">
                  {(contract.viewed_count ?? 0) === 1 ? "view" : "views"}
                </span>
              </div>
              {contract.viewed_at && (
                <span className="text-[10px] text-foreground/40 mt-1.5 block">
                  First viewed {fmtDate(contract.viewed_at)}
                </span>
              )}
            </div>

            {/* Description */}
            {contract.description && (
              <div className="bg-white/60 rounded-xl p-4 shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 block mb-2">
                  Description
                </span>
                <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap">
                  {contract.description}
                </p>
              </div>
            )}

            {/* Attach / Replace PDF (agency only) */}
            {isAgencyUser && (
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={() => setUploadOpen(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/60 border border-border/30 text-[12px] font-medium text-foreground/70 hover:text-foreground hover:bg-white/80 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Upload className="h-3.5 w-3.5" />
                    {contract.file_data ? "Replace PDF" : "Attach signed PDF"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{uploadOpen ? "▲" : "▼"}</span>
                </button>

                {uploadOpen && (
                  <div
                    className="mt-[3px] border-2 border-dashed border-border/50 rounded-xl p-5 text-center cursor-pointer hover:border-brand-indigo/40 transition-colors bg-white/40"
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
                        {uploading ? "Uploading..." : "Drop PDF here or click to browse"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">PDF only, max 5 MB</p>
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

          {/* ── RIGHT column: full-height contract widget ── */}
          <div className="bg-white/60 rounded-xl flex flex-col min-h-0 overflow-hidden">

            {/* Contract widget header */}
            <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-border/20 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold uppercase tracking-widest text-foreground/40 font-heading">
                  Contract
                </span>
                {isEditing && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">
                    Editing
                  </span>
                )}
                {contract.file_data && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                    PDF attached
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
                      {editSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-card border border-border/40 transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Cancel
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
                        Edit
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
                        {copied ? "Copied" : "Copy"}
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
                  className="flex-1 min-h-0 w-full resize-none bg-transparent font-mono text-[11px] leading-relaxed text-foreground/80 p-4 outline-none"
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  spellCheck={false}
                  autoFocus
                />
                <div className="px-4 py-1.5 border-t border-border/20 shrink-0">
                  <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                    {editText.length.toLocaleString()} characters
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
                  <p className="text-sm text-muted-foreground">PDF preview not available in this browser.</p>
                  <button
                    onClick={handleDownloadPdf}
                    className="text-sm text-brand-indigo hover:underline font-medium"
                  >
                    Download PDF
                  </button>
                </div>
              </object>
            ) : contract.contract_text ? (
              /* Read-only contract text */
              <>
                <pre className="flex-1 min-h-0 overflow-y-auto font-mono text-[11px] leading-relaxed text-foreground/75 whitespace-pre-wrap p-4">
                  {contract.contract_text}
                </pre>
                <div className="px-4 py-1.5 border-t border-border/20 shrink-0">
                  <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                    {contract.contract_text.length.toLocaleString()} characters
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
                  <p className="text-[12px] font-medium text-foreground/40">No document yet</p>
                  <p className="text-[11px] text-foreground/25">
                    {isAgencyUser
                      ? "Attach a signed PDF or edit the contract text above"
                      : "No document has been attached to this contract"}
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
