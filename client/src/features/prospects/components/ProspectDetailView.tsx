import { useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from "react";
import {
  Building2, Phone, Globe, FileText,
  Check, Trash2, FileDown,
  Pencil, X, RefreshCw, Camera,
  ChevronLeft, Linkedin, Mail, MapPin,
  ChevronDown, ChevronUp, Users, Sparkles,
  UserPlus, Send,
} from "lucide-react";
import { EmailComposeModal } from "./EmailComposeModal";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";
import { getInitials, getAccountAvatarColor } from "@/lib/avatarUtils";
import { useTranslation } from "react-i18next";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePublishEntityData } from "@/contexts/PageEntityContext";
import type { ProspectRow } from "./ProspectListView";
import { PROSPECT_COUNTRIES } from "./ProspectCreatePanel";

// ── Status helpers ─────────────────────────────────────────────────────────────

function getStatusDotCls(status: string): string {
  switch (status) {
    case "New":          return "bg-blue-500";
    case "Contacted":    return "bg-amber-500";
    case "In Progress":  return "bg-indigo-500";
    case "Converted":    return "bg-emerald-500";
    case "Archived":     return "bg-slate-400";
    default:             return "bg-blue-400";
  }
}

function getStatusBadgeStyle(status: string): { bg: string; text: string } {
  return getAccountAvatarColor(status);
}

const PROSPECT_STATUS_HEX: Record<string, string> = {
  New:            "#3B82F6",
  Contacted:      "#F59E0B",
  "In Progress":  "#6366F1",
  Converted:      "#10B981",
  Archived:       "#64748B",
};

const PRIORITY_HEX: Record<string, string> = {
  Urgent: "#DC2626", urgent: "#DC2626",
  High:   "#EF4444", high:   "#EF4444",
  Medium: "#F59E0B", medium: "#F59E0B",
  Low:    "#3B82F6", low:    "#3B82F6",
};

const PRIORITY_LEVEL: Record<string, number> = {
  Low: 1, low: 1, Medium: 2, medium: 2, High: 3, high: 3, Urgent: 4, urgent: 4,
};

// ── Edit input helpers ─────────────────────────────────────────────────────────

function InfoRow({ label, value, editChild }: {
  label: string;
  value?: React.ReactNode;
  editChild?: React.ReactNode;
}) {
  return (
    <div className="py-2.5 border-b border-border/20 last:border-0 last:pb-0">
      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block leading-none mb-1">
        {label}
      </span>
      <div className="min-h-[1.125rem]">
        {editChild ?? (
          <span className="text-[12px] font-semibold text-foreground leading-snug">
            {value ?? <span className="text-foreground/25 font-normal italic">&mdash;</span>}
          </span>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ label, icon: Icon }: { label: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-1.5 pt-3 mt-1 mb-1 border-t border-white/30">
      {Icon && <Icon className="w-3 h-3 text-foreground/40" />}
      <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{label}</span>
    </div>
  );
}

function EditText({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-blue/30 rounded-lg px-2.5 py-1 outline-none focus:ring-1 focus:ring-brand-blue/40 placeholder:text-foreground/25"
    />
  );
}

function EditSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-blue/30 rounded-lg px-2.5 py-1 outline-none focus:ring-1 focus:ring-brand-blue/40"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function EditTextarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-blue/30 rounded-lg px-2.5 py-1 resize-none outline-none focus:ring-1 focus:ring-brand-blue/40 placeholder:text-foreground/25 leading-relaxed"
    />
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS   = ["New", "Contacted", "In Progress", "Converted", "Archived"];
const PRIORITY_OPTIONS = ["High", "Medium", "Low"];
const SOURCE_OPTIONS   = ["Web Research", "Referral", "LinkedIn", "Cold Email", "Conference", "Other"];
const ACTION_OPTIONS   = ["Contacted", "Responded", "Researched", "Meeting Scheduled", "Proposal Sent", "Follow-up", "No Response"];

// ── Photo crop modal ────────────────────────────────────────────────────────

function PhotoCropModal({ srcUrl, onSave, onCancel }: {
  srcUrl: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("prospects");
  const PREVIEW = 240;
  const OUTPUT  = 128;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom]     = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging  = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const pinchRef  = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const img = new globalThis.Image();
    img.onload = () => {
      imgRef.current = img;
      setZoom(Math.min(PREVIEW / img.width, PREVIEW / img.height));
      setOffset({ x: 0, y: 0 });
    };
    img.src = srcUrl;
  }, [srcUrl]);

  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, PREVIEW, PREVIEW);
    const w = img.width * zoom;
    const h = img.height * zoom;
    ctx.drawImage(img, (PREVIEW - w) / 2 + offset.x, (PREVIEW - h) / 2 + offset.y, w, h);
  }, [zoom, offset]);

  const handleSave = () => {
    const img = imgRef.current;
    if (!img) return;
    const out = document.createElement("canvas");
    out.width = OUTPUT; out.height = OUTPUT;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    const f = OUTPUT / PREVIEW;
    const w = img.width * zoom * f;
    const h = img.height * zoom * f;
    ctx.drawImage(img, (OUTPUT - w) / 2 + offset.x * f, (OUTPUT - h) / 2 + offset.y * f, w, h);
    onSave(out.toDataURL("image/jpeg", 0.85));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setOffset({ x: dragStart.current.ox + e.clientX - dragStart.current.x, y: dragStart.current.oy + e.clientY - dragStart.current.y });
  };
  const onMouseUp = () => { dragging.current = false; };

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("detail.cropPhoto")}</DialogTitle>
          <DialogDescription>{t("detail.cropDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-full overflow-hidden ring-2 ring-brand-blue/20" style={{ width: PREVIEW, height: PREVIEW }}>
            <canvas
              ref={canvasRef}
              width={PREVIEW}
              height={PREVIEW}
              className="cursor-grab active:cursor-grabbing"
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              onTouchStart={(e) => {
                e.preventDefault();
                if (e.touches.length === 1) {
                  const t = e.touches[0];
                  dragging.current = true;
                  dragStart.current = { x: t.clientX, y: t.clientY, ox: offset.x, oy: offset.y };
                }
                if (e.touches.length === 2) {
                  const dx = e.touches[0].clientX - e.touches[1].clientX;
                  const dy = e.touches[0].clientY - e.touches[1].clientY;
                  pinchRef.current = { dist: Math.hypot(dx, dy), zoom };
                }
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                if (e.touches.length === 1 && dragging.current) {
                  const t = e.touches[0];
                  setOffset({ x: dragStart.current.ox + t.clientX - dragStart.current.x, y: dragStart.current.oy + t.clientY - dragStart.current.y });
                }
                if (e.touches.length === 2 && pinchRef.current) {
                  const dx = e.touches[0].clientX - e.touches[1].clientX;
                  const dy = e.touches[0].clientY - e.touches[1].clientY;
                  const newDist = Math.hypot(dx, dy);
                  const scale = newDist / pinchRef.current.dist;
                  const newZoom = Math.min(8, Math.max(0.05, pinchRef.current.zoom * scale));
                  setZoom(newZoom);
                }
              }}
              onTouchEnd={() => {
                dragging.current = false;
                pinchRef.current = null;
              }}
            />
          </div>
          <div className="flex items-center gap-3 w-full px-2">
            <button type="button" onClick={() => setZoom((z) => Math.max(0.05, parseFloat((z - 0.1).toFixed(2))))}
              className="h-6 w-6 rounded-full flex items-center justify-center text-[14px] font-bold text-muted-foreground hover:bg-muted transition-colors select-none shrink-0">−</button>
            <input type="range" min="0.05" max="8" step="0.05" value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-brand-blue" />
            <button type="button" onClick={() => setZoom((z) => Math.min(8, parseFloat((z + 0.1).toFixed(2))))}
              className="h-6 w-6 rounded-full flex items-center justify-center text-[14px] font-bold text-muted-foreground hover:bg-muted transition-colors select-none shrink-0">+</button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>{t("detail.cancel")}</Button>
          <Button onClick={handleSave}>{t("detail.savePhoto")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Draft type ────────────────────────────────────────────────────────────────

type ProspectDraft = {
  name: string; company: string; niche: string;
  country: string; city: string;
  website: string; phone: string; email: string; linkedin: string;
  contact_name: string; contact_role: string; contact_email: string; contact_phone: string; contact_linkedin: string;
  contact2_name: string; contact2_role: string; contact2_email: string; contact2_phone: string; contact2_linkedin: string;
  source: string; status: string; priority: string;
  next_action: string; action: string; notes: string; Accounts_id: string;
};

// ── Empty state ────────────────────────────────────────────────────────────────

export function ProspectDetailViewEmpty({ toolbarPrefix }: { toolbarPrefix?: ReactNode }) {
  const { t } = useTranslation("prospects");
  return (
    <div className="flex-1 flex flex-col">
      {toolbarPrefix && (
        <div className="shrink-0 px-4 pt-5 pb-3">
          <div className="flex items-center gap-1 flex-wrap">
            {toolbarPrefix}
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-stone-50 to-gray-100 flex items-center justify-center ring-1 ring-stone-200/50">
          <Building2 className="h-10 w-10 text-stone-400" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground/70">{t("empty.title")}</p>
          <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">
            {t("empty.description")}
          </p>
        </div>
        <div className="text-[11px] text-stone-400 font-medium">{t("empty.chooseFromList")}</div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface ProspectDetailViewProps {
  prospect: ProspectRow;
  onSave: (field: string, value: string) => Promise<void>;
  onDelete: () => void;
  toolbarPrefix?: ReactNode;
  onBack?: () => void;
}

export function ProspectDetailView({ prospect, onSave, onDelete, toolbarPrefix, onBack }: ProspectDetailViewProps) {
  const { t } = useTranslation("prospects");
  const isMobile = useIsMobile();
  const status = String(prospect.status || "New");
  const priority = String(prospect.priority || "Medium");
  const badgeStyle = getStatusBadgeStyle(status);
  const prospectId = prospect.Id ?? prospect.id ?? 0;

  // ── Publish entity data for AI chat context ────────────────────────────────
  const publishEntity = usePublishEntityData();
  const entitySummary = useMemo(() => ({
    id: prospectId,
    company: prospect.company,
    name: prospect.name,
    contactName: prospect.contact_name,
    contactRole: prospect.contact_role,
    contactEmail: prospect.contact_email,
    contactPhone: prospect.contact_phone,
    email: prospect.email,
    phone: prospect.phone,
    website: prospect.website,
    linkedin: prospect.linkedin,
    niche: prospect.niche,
    city: prospect.city,
    country: prospect.country,
    status,
    priority,
    source: prospect.source,
    notes: prospect.notes,
    nextAction: prospect.next_action,
    aiSummary: prospect.ai_summary,
    headline: prospect.headline,
  }), [prospectId, prospect, status, priority]);

  useEffect(() => {
    publishEntity({
      entityType: "prospect",
      entityId: prospectId,
      entityName: prospect.company || prospect.name || "Unknown Prospect",
      summary: entitySummary,
      updatedAt: Date.now(),
    });
  }, [publishEntity, prospectId, entitySummary]);

  // ── Edit state ──────────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [draft,     setDraft]     = useState<ProspectDraft>({} as ProspectDraft);
  const [saving,    setSaving]    = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const hasContact2 = !!(prospect.contact2_name || prospect.contact2_role || prospect.contact2_email || prospect.contact2_phone || prospect.contact2_linkedin);
  const [showContact2, setShowContact2] = useState(hasContact2);

  // ── Photo upload state ────────────────────────────────────────────────────
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const handlePhotoFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoInputRef.current) photoInputRef.current.value = "";
    setCropSrc(URL.createObjectURL(file));
  }, []);

  const handleCropSave = useCallback(async (dataUrl: string) => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    await onSave("photo_url", dataUrl);
  }, [cropSrc, onSave]);

  const handleCropCancel = useCallback(() => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }, [cropSrc]);

  // ── Email compose state ──────────────────────────────────────────────────
  const [emailComposeOpen, setEmailComposeOpen] = useState(false);

  const handleRemovePhoto = useCallback(async () => {
    await onSave("photo_url", "");
  }, [onSave]);

  // ── Edit handlers ───────────────────────────────────────────────────────────
  const startEdit = useCallback(() => {
    setDraft({
      name:        String(prospect.name        || ""),
      company:     String(prospect.company     || ""),
      niche:       String(prospect.niche       || ""),
      country:     String(prospect.country     || ""),
      city:        String(prospect.city        || ""),
      website:     String(prospect.website     || ""),
      phone:       String(prospect.phone       || ""),
      email:       String(prospect.email       || ""),
      linkedin:    String(prospect.linkedin    || ""),
      contact_name:     String(prospect.contact_name     || ""),
      contact_role:     String(prospect.contact_role     || ""),
      contact_email:    String(prospect.contact_email    || ""),
      contact_phone:    String(prospect.contact_phone    || ""),
      contact_linkedin: String(prospect.contact_linkedin || ""),
      contact2_name:     String(prospect.contact2_name     || ""),
      contact2_role:     String(prospect.contact2_role     || ""),
      contact2_email:    String(prospect.contact2_email    || ""),
      contact2_phone:    String(prospect.contact2_phone    || ""),
      contact2_linkedin: String(prospect.contact2_linkedin || ""),
      source:      String(prospect.source      || ""),
      status:      String(prospect.status      || "New"),
      priority:    String(prospect.priority    || "Medium"),
      next_action: String(prospect.next_action || ""),
      action:      String((prospect as any).action || ""),
      notes:       String(prospect.notes       || ""),
      Accounts_id: prospect.Accounts_id != null ? String(prospect.Accounts_id) : "",
    });
    setIsEditing(true);
  }, [prospect]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setDraft({} as ProspectDraft);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      for (const [field, value] of Object.entries(draft) as [keyof ProspectDraft, string][]) {
        const current = String((prospect as any)[field] ?? "");
        if (value !== current) {
          await onSave(field, value);
        }
      }
      setIsEditing(false);
      setDraft({} as ProspectDraft);
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setSaving(false);
    }
  }, [draft, prospect, onSave]);

  const set = useCallback((field: keyof ProspectDraft, value: string) => {
    setDraft((d) => ({ ...d, [field]: value }));
  }, []);

  const val = useCallback((field: keyof ProspectDraft): string => {
    if (isEditing) return draft[field] ?? "";
    return String((prospect as any)[field] ?? "");
  }, [isEditing, draft, prospect]);

  const handleDelete = useCallback(() => {
    if (deleteConfirm) { onDelete(); setDeleteConfirm(false); }
    else { setDeleteConfirm(true); setTimeout(() => setDeleteConfirm(false), 3000); }
  }, [deleteConfirm, onDelete]);

  const handlePDF = useCallback(() => { window.print(); }, []);

  // ── Convert to Account ────────────────────────────────────────────────────
  const [converting, setConverting] = useState(false);
  const handleConvertToAccount = useCallback(async () => {
    if (converting) return;
    setConverting(true);
    try {
      const { convertProspectToAccount } = await import("../api/prospectsApi");
      await convertProspectToAccount(prospectId);
      await onSave("status", "Converted");
    } catch (err) {
      console.error("Convert to account failed", err);
    } finally {
      setConverting(false);
    }
  }, [converting, prospectId, onSave]);

  const initials = getInitials(prospect.name || "?");

  const displayStatus     = isEditing ? (draft.status || status) : status;
  const displayBadgeStyle = getStatusBadgeStyle(displayStatus);
  const displayPriority   = isEditing ? (draft.priority || priority) : priority;

  return (
    <div className="relative flex flex-col h-full overflow-hidden" data-testid="prospect-detail-view">

      {/* ── Full-height warm gradient ── */}
      <div className="absolute inset-0 bg-popover dark:bg-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_180%_123%_at_78%_83%,rgba(255,193,193,0.8)_0%,transparent_69%)] dark:opacity-[0.08]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_200%_at_2%_2%,#d0f8ff_5%,transparent_30%)] dark:opacity-[0.08]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_96%_80%_at_49%_51%,rgba(203,203,241,0.8)_0%,transparent_66%)] dark:opacity-[0.08]" />

      {/* ── Header ── */}
      <div className="shrink-0 relative z-10">
        <div className="relative px-4 pt-2 md:pt-9 pb-4 md:pb-10 space-y-3 max-w-[1386px] w-full mr-auto">

          {/* Row 1: Toolbar */}
          <div className="flex items-center gap-1">
            {onBack && (
              <button
                onClick={onBack}
                className="md:hidden h-9 w-9 rounded-full border border-black/[0.125] bg-background grid place-items-center shrink-0 mr-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {toolbarPrefix}

            <div className="flex-1 min-w-0" />

            {/* Send Email + Edit / Save / Cancel + PDF + Delete */}
            <div className="flex items-center gap-1 shrink-0">
              {!isEditing && (prospect.email || prospect.contact_email || prospect.contact2_email) && (
                <button
                  onClick={() => setEmailComposeOpen(true)}
                  className="group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[120px] border-brand-indigo text-brand-indigo"
                >
                  <Send className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    {t("emailCompose.sendEmail")}
                  </span>
                </button>
              )}
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[80px] border-brand-indigo text-brand-indigo disabled:opacity-50"
                  >
                    {saving ? <RefreshCw className="h-4 w-4 shrink-0 animate-spin" /> : <Check className="h-4 w-4 shrink-0" />}
                    <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      {saving ? t("detail.saving") : t("detail.save")}
                    </span>
                  </button>
                  <button
                    onClick={cancelEdit}
                    disabled={saving}
                    className="group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[100px] border-black/[0.125] text-foreground/60 hover:text-foreground"
                  >
                    <X className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">{t("detail.cancel")}</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={startEdit}
                  className="group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[80px] border-black/[0.125] text-foreground/60 hover:text-foreground"
                >
                  <Pencil className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">{t("detail.edit")}</span>
                </button>
              )}

              <button
                onClick={handlePDF}
                className="group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[80px] border-black/[0.125] text-foreground/60 hover:text-foreground"
              >
                <FileDown className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">PDF</span>
              </button>
              <button
                onClick={handleDelete}
                className={cn(
                  "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[100px]",
                  deleteConfirm
                    ? "border-red-400/60 text-red-600"
                    : "border-black/[0.125] text-foreground/60 hover:text-foreground"
                )}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  {deleteConfirm ? t("detail.confirm") : t("toolbar.delete")}
                </span>
              </button>
            </div>
          </div>

          {/* Row 2: Avatar + Name + badges */}
          <div className="flex items-start gap-3 justify-end">
            {/* Photo circle — click to upload */}
            <div className="relative group shrink-0">
              <div
                className="h-[72px] w-[72px] rounded-full flex items-center justify-center text-xl font-bold overflow-hidden cursor-pointer"
                style={prospect.photo_url ? {} : { backgroundColor: displayBadgeStyle.bg, color: displayBadgeStyle.text }}
                onClick={() => photoInputRef.current?.click()}
                title={t("detail.clickToUploadPhoto")}
              >
                {prospect.photo_url ? (
                  <img src={prospect.photo_url} alt="photo" className="h-full w-full object-cover" />
                ) : (
                  initials || <Building2 className="w-6 h-6" />
                )}
              </div>
              {/* Hover overlay */}
              <div
                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer pointer-events-none"
              >
                <Camera className="w-5 h-5 text-white" />
              </div>
              {/* Remove button — hover-only, top-right */}
              {prospect.photo_url && !cropSrc && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemovePhoto(); }}
                  title={t("detail.removePhoto")}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-white dark:bg-card border border-black/[0.125] flex items-center justify-center text-foreground/50 hover:text-red-500 hover:border-red-300 transition-colors z-10 opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoFile}
            />

            <div className="flex-1 min-w-0 py-1">
              {isEditing ? (
                <input
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  className="text-[20px] md:text-[27px] font-semibold font-heading bg-transparent border-b-2 border-brand-blue outline-none w-full leading-tight"
                  placeholder={t("fields.prospectName")}
                  data-testid="prospect-detail-name-input"
                />
              ) : (
                <h2
                  className="text-[20px] md:text-[27px] font-semibold font-heading text-foreground leading-tight truncate"
                  data-testid="prospect-detail-name"
                >
                  {prospect.name || t("detail.unnamedProspect")}
                </h2>
              )}

              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {/* Status badge */}
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: displayBadgeStyle.bg, color: displayBadgeStyle.text }}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", getStatusDotCls(displayStatus))} />
                  {displayStatus}
                </span>
                {/* Priority badge with dashes */}
                {(() => {
                  const level = PRIORITY_LEVEL[displayPriority] || 0;
                  const color = PRIORITY_HEX[displayPriority] || "#94A3B8";
                  return (
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ backgroundColor: `${color}30`, color }}
                    >
                      {displayPriority}
                      <span className="inline-flex items-center gap-[3px]">
                        {[1, 2, 3, 4].map((i) => (
                          <span
                            key={i}
                            className="w-[8px] h-[2.5px] rounded-full"
                            style={{ backgroundColor: i <= level ? color : "rgba(0,0,0,0.08)" }}
                          />
                        ))}
                      </span>
                    </span>
                  );
                })()}
                {/* Prospect ID */}
                {prospectId > 0 && (
                  <span className="text-[11px] text-muted-foreground font-medium">#{prospectId}</span>
                )}
                {/* Convert to Account / Linked Account badge */}
                {!isEditing && (
                  prospect.status !== "Converted" && !prospect.Accounts_id ? (
                    <button
                      onClick={handleConvertToAccount}
                      disabled={converting}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/80 text-foreground/70 border border-border/40 hover:bg-white hover:text-foreground transition-colors disabled:opacity-50 dark:bg-white/10 dark:hover:bg-white/15"
                    >
                      {converting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                      {converting ? t("detail.converting") : t("detail.convertToAccount")}
                    </button>
                  ) : prospect.Accounts_id ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      <Building2 className="h-3 w-3" />
                      {t("detail.linkedAccount")} #{prospect.Accounts_id}
                    </span>
                  ) : null
                )}

                {/* Company */}
                {(isEditing ? draft.company : prospect.company) && (
                  <span className="text-[11px] text-foreground/50 truncate">
                    {isEditing ? draft.company : prospect.company}
                  </span>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Body: single scrollable panel ── */}
      <div
        className="relative flex-1 overflow-y-auto min-h-0 -mt-[80px] pt-[83px] px-[3px] pb-[3px]"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0px, black 83px)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0px, black 83px)",
        }}
      >
        <div className="max-w-[700px] mr-auto">
          <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 flex flex-col" data-testid="prospect-widget-details">

            {/* Basic Info */}
            <p className="text-[18px] font-semibold font-heading text-foreground mb-3">{t("sections.basicInfo")}</p>

            <InfoRow
              label={t("fields.name")}
              value={val("name") || undefined}
              editChild={isEditing ? <EditText value={val("name")} onChange={(v) => set("name", v)} placeholder={t("fields.namePlaceholder")} /> : undefined}
            />
            <InfoRow
              label={t("fields.company")}
              value={val("company") || undefined}
              editChild={isEditing ? <EditText value={val("company")} onChange={(v) => set("company", v)} placeholder={t("fields.companyPlaceholder")} /> : undefined}
            />
            <InfoRow
              label={t("fields.niche")}
              value={val("niche") || undefined}
              editChild={isEditing ? <EditText value={val("niche")} onChange={(v) => set("niche", v)} placeholder={t("fields.nichePlaceholder")} /> : undefined}
            />

            {/* Location */}
            <SectionHeader label={t("sections.location")} icon={MapPin} />

            <InfoRow
              label={t("fields.country")}
              value={val("country") || undefined}
              editChild={isEditing ? <EditSelect value={val("country")} onChange={(v) => set("country", v)} options={["", ...PROSPECT_COUNTRIES]} /> : undefined}
            />
            <InfoRow
              label={t("fields.city")}
              value={val("city") || undefined}
              editChild={isEditing ? <EditText value={val("city")} onChange={(v) => set("city", v)} placeholder={t("fields.cityPlaceholder")} /> : undefined}
            />

            {/* Contact 1 */}
            <SectionHeader label={t("sections.contact1")} icon={Phone} />

            <InfoRow
              label={t("fields.contact1Name")}
              value={val("contact_name") || undefined}
              editChild={isEditing ? <EditText value={val("contact_name")} onChange={(v) => set("contact_name", v)} placeholder={t("fields.contact1NamePlaceholder")} /> : undefined}
            />
            <InfoRow
              label={t("fields.contact1Role")}
              value={val("contact_role") || undefined}
              editChild={isEditing ? <EditText value={val("contact_role")} onChange={(v) => set("contact_role", v)} placeholder={t("fields.contact1RolePlaceholder")} /> : undefined}
            />
            <InfoRow
              label={t("fields.contact1Email")}
              value={val("contact_email") || undefined}
              editChild={isEditing ? <EditText value={val("contact_email")} onChange={(v) => set("contact_email", v)} type="email" placeholder={t("fields.emailPlaceholder")} /> : undefined}
            />
            <InfoRow
              label={t("fields.contact1Phone")}
              value={val("contact_phone") || undefined}
              editChild={isEditing ? <EditText value={val("contact_phone")} onChange={(v) => set("contact_phone", v)} type="tel" placeholder={t("fields.phonePlaceholder")} /> : undefined}
            />
            <InfoRow
              label={t("fields.contact1Linkedin")}
              value={val("contact_linkedin") || undefined}
              editChild={isEditing ? <EditText value={val("contact_linkedin")} onChange={(v) => set("contact_linkedin", v)} placeholder={t("fields.linkedinPlaceholder")} /> : undefined}
            />

            {/* Contact 2 (collapsible) */}
            {(isEditing || hasContact2) && (
              <>
                <div className="flex items-center gap-1.5 pt-3 mt-1 mb-1 border-t border-white/30">
                  <Users className="w-3 h-3 text-foreground/40" />
                  <button
                    type="button"
                    onClick={() => setShowContact2((v) => !v)}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-foreground/40 hover:text-foreground/60 transition-colors"
                  >
                    {t("sections.contact2")}
                    {showContact2 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>
                {showContact2 && (
                  <>
                    <InfoRow
                      label={t("fields.contact2Name")}
                      value={val("contact2_name") || undefined}
                      editChild={isEditing ? <EditText value={val("contact2_name")} onChange={(v) => set("contact2_name", v)} placeholder={t("fields.contact2NamePlaceholder")} /> : undefined}
                    />
                    <InfoRow
                      label={t("fields.contact2Role")}
                      value={val("contact2_role") || undefined}
                      editChild={isEditing ? <EditText value={val("contact2_role")} onChange={(v) => set("contact2_role", v)} placeholder={t("fields.contact2RolePlaceholder")} /> : undefined}
                    />
                    <InfoRow
                      label={t("fields.contact2Email")}
                      value={val("contact2_email") || undefined}
                      editChild={isEditing ? <EditText value={val("contact2_email")} onChange={(v) => set("contact2_email", v)} type="email" placeholder={t("fields.emailPlaceholder")} /> : undefined}
                    />
                    <InfoRow
                      label={t("fields.contact2Phone")}
                      value={val("contact2_phone") || undefined}
                      editChild={isEditing ? <EditText value={val("contact2_phone")} onChange={(v) => set("contact2_phone", v)} type="tel" placeholder={t("fields.phonePlaceholder")} /> : undefined}
                    />
                    <InfoRow
                      label={t("fields.contact2Linkedin")}
                      value={val("contact2_linkedin") || undefined}
                      editChild={isEditing ? <EditText value={val("contact2_linkedin")} onChange={(v) => set("contact2_linkedin", v)} placeholder={t("fields.linkedinPlaceholder")} /> : undefined}
                    />
                  </>
                )}
              </>
            )}

            {/* Pipeline */}
            <SectionHeader label={t("sections.pipeline")} icon={FileText} />

            <InfoRow
              label={t("fields.source")}
              value={val("source") || undefined}
              editChild={isEditing ? <EditSelect value={val("source")} onChange={(v) => set("source", v)} options={SOURCE_OPTIONS} /> : undefined}
            />
            <InfoRow
              label={t("fields.status")}
              value={val("status") || undefined}
              editChild={isEditing ? <EditSelect value={val("status")} onChange={(v) => set("status", v)} options={STATUS_OPTIONS} /> : undefined}
            />
            <InfoRow
              label={t("fields.priority")}
              value={val("priority") || undefined}
              editChild={isEditing ? <EditSelect value={val("priority")} onChange={(v) => set("priority", v)} options={PRIORITY_OPTIONS} /> : undefined}
            />
            <InfoRow
              label={t("fields.nextAction")}
              value={val("next_action") || undefined}
              editChild={isEditing ? <EditText value={val("next_action")} onChange={(v) => set("next_action", v)} placeholder={t("fields.nextActionPlaceholder")} /> : undefined}
            />
            <InfoRow
              label={t("columns.action")}
              value={val("action") || undefined}
              editChild={isEditing ? <EditSelect value={val("action")} onChange={(v) => set("action", v)} options={ACTION_OPTIONS} /> : undefined}
            />
            <InfoRow
              label={t("fields.accountId")}
              value={val("Accounts_id") || undefined}
              editChild={isEditing ? <EditText value={val("Accounts_id")} onChange={(v) => set("Accounts_id", v)} placeholder={t("fields.accountIdPlaceholder")} /> : undefined}
            />

            {/* LinkedIn Enrichment */}
            {(prospect.ai_summary || prospect.headline) && (
              <>
                <SectionHeader label={t("sections.enrichment")} icon={Sparkles} />

                {prospect.headline && (
                  <InfoRow label={t("fields.headline")} value={prospect.headline} />
                )}

                {(prospect.connection_count || prospect.follower_count) && (
                  <div className="flex gap-6 py-2 px-1">
                    {prospect.connection_count && (
                      <div className="text-[11px]">
                        <span className="text-foreground/40">{t("fields.connectionCount")}</span>{" "}
                        <span className="text-foreground font-medium">{Number(prospect.connection_count).toLocaleString()}</span>
                      </div>
                    )}
                    {prospect.follower_count && (
                      <div className="text-[11px]">
                        <span className="text-foreground/40">{t("fields.followerCount")}</span>{" "}
                        <span className="text-foreground font-medium">{Number(prospect.follower_count).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}

                {prospect.ai_summary && (
                  <div className="py-2.5">
                    <div className="text-[11px] text-foreground/40 mb-1">{t("fields.aiSummary")}</div>
                    <p className="text-[12px] text-foreground leading-relaxed">{prospect.ai_summary}</p>
                  </div>
                )}

                {prospect.top_post && (
                  <div className="py-2.5">
                    <div className="text-[11px] text-foreground/40 mb-1">{t("fields.topPost")}</div>
                    <p className="text-[12px] text-foreground/70 leading-relaxed italic">{prospect.top_post}</p>
                  </div>
                )}

              </>
            )}

            {/* Notes */}
            <SectionHeader label={t("sections.notes")} icon={FileText} />

            <div className="py-2.5">
              {isEditing ? (
                <EditTextarea value={val("notes")} onChange={(v) => set("notes", v)} placeholder={t("fields.notesPlaceholder")} rows={4} />
              ) : (
                <span className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap">
                  {prospect.notes || <span className="text-foreground/25 italic">&mdash;</span>}
                </span>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Photo crop modal */}
      {cropSrc && (
        <PhotoCropModal
          srcUrl={cropSrc}
          onSave={handleCropSave}
          onCancel={handleCropCancel}
        />
      )}

      {/* Email compose modal */}
      <EmailComposeModal
        open={emailComposeOpen}
        onOpenChange={setEmailComposeOpen}
        prospect={prospect}
      />
    </div>
  );
}
