import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  Building2, Phone, Globe, Clock, FileText,
  Check, FileDown, Trash2,
  Pencil, X, RefreshCw, Camera,
  ChevronLeft,
} from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import { syncInstagramContacts } from "../api/accountsApi";
import { getInitials } from "@/lib/avatarUtils";
import { useLocation } from "wouter";
import type { AccountRow } from "./AccountDetailsDialog";
import KnowledgeBasePanel from "./KnowledgeBasePanel";
import { useTranslation } from "react-i18next";
import {
  getStatusDotCls,
  getStatusBadgeStyle,
  getStatusIcon,
  formatTimeDisplay,
  parseServiceCategories,
  LogoCropModal,
  InfoRow,
  SectionHeader,
  EditText,
  EditSelect,
  EditTextarea,
  MonoValue,
  SecretDisplay,
  VoiceCloneWidget,
  AccountCampaignsPanel,
  AccountUsersPanel,
  AccountDetailViewEmpty,
} from "./accountDetailWidgets";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS   = ["Active", "Trial", "Inactive", "Suspended"];
const TYPE_OPTIONS     = ["Agency", "Client"];
const TIMEZONE_OPTIONS = [
  "America/Sao_Paulo",
  "Europe/Amsterdam",
];
const LANGUAGE_OPTIONS = [
  "English",
  "Portuguese",
  "Dutch",
];

// ── Draft type ────────────────────────────────────────────────────────────────

type AccountDraft = {
  name: string; status: string; type: string; business_niche: string;
  owner_email: string; phone: string; website: string; address: string; tax_id: string;
  business_description: string; notes: string; service_categories: string;
  default_ai_name: string; default_ai_role: string; default_ai_style: string;
  default_typo_frequency: string; opt_out_keyword: string; preferred_terminology: string;
  timezone: string; language: string; business_hours_start: string; business_hours_end: string; max_daily_sends: string;
  twilio_account_sid: string; twilio_auth_token: string; twilio_messaging_service_sid: string;
  twilio_default_from_number: string; webhook_url: string; webhook_secret: string; logo_url: string;
  instagram_user_id: string; instagram_access_token: string;
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface AccountDetailViewProps {
  account: AccountRow;
  onSave: (field: string, value: string) => Promise<void>;
  onAddAccount: () => void;
  onDelete: () => void;
  onToggleStatus: (account: AccountRow) => void;
  toolbarPrefix?: ReactNode;
  onBack?: () => void;
}

// ── Re-export empty state so callers don't need a separate import ─────────────

export { AccountDetailViewEmpty };

// ── Main Component ─────────────────────────────────────────────────────────────

export function AccountDetailView({ account, onSave, onAddAccount, onDelete, onToggleStatus, toolbarPrefix, onBack }: AccountDetailViewProps) {
  const { t } = useTranslation("accounts");
  const isMobile   = useIsMobile();
  const status     = String(account.status || t("status.unknown"));
  const badgeStyle = getStatusBadgeStyle(status);
  const accountId  = account.Id ?? account.id ?? 0;
  const [location] = useLocation();
  const routePrefix = location.startsWith("/subaccount") ? "/subaccount" : "/agency";

  // ── Edit state ──────────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [draft,     setDraft]     = useState<AccountDraft>({} as AccountDraft);
  const [saving,    setSaving]    = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc,    setCropSrc]    = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [leadCount, setLeadCount] = useState<number | null>(null);

  // ── Instagram sync state ──────────────────────────────────────────────────
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const id = (account as any).Id ?? (account as any).id;
    if (!id) return;
    setLeadCount(null);
    apiFetch(`/api/leads?accountId=${id}&page=1&limit=1`)
      .then((data: any) => {
        const total = data?.total ?? data?.pagination?.total ?? null;
        setLeadCount(typeof total === "number" ? total : null);
      })
      .catch(() => setLeadCount(null));
  }, [(account as any).Id ?? (account as any).id]);

  // ── Instagram sync handler ─────────────────────────────────────────────────
  const handleSyncInstagram = async () => {
    const id = (account as any).Id ?? (account as any).id;
    if (!id) return;
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const result = await syncInstagramContacts(id);
      setSyncResult(result);
    } catch (err: any) {
      setSyncError(err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  // ── Edit handlers ───────────────────────────────────────────────────────────
  const startEdit = useCallback(() => {
    setDraft({
      name:                       String(account.name                    || ""),
      status:                     String(account.status                  || ""),
      type:                       String(account.type                    || ""),
      business_niche:             String(account.business_niche          || ""),
      owner_email:                String(account.owner_email             || ""),
      phone:                      String(account.phone                   || ""),
      website:                    String(account.website                 || ""),
      address:                    String(account.address                 || ""),
      tax_id:                     String(account.tax_id                  || ""),
      business_description:       String(account.business_description    || ""),
      notes:                      String(account.notes                   || ""),
      service_categories:         String(account.service_categories      || ""),
      default_ai_name:            String(account.default_ai_name         || ""),
      default_ai_role:            String(account.default_ai_role         || ""),
      default_ai_style:           String(account.default_ai_style        || ""),
      default_typo_frequency:     String(account.default_typo_frequency  || ""),
      opt_out_keyword:            String(account.opt_out_keyword         || ""),
      preferred_terminology:      String(account.preferred_terminology   || ""),
      timezone:                   TIMEZONE_OPTIONS.includes(String(account.timezone || "")) ? String(account.timezone || "") : "",
      language:                   String(account.language                || "English"),
      business_hours_start:       String(account.business_hours_start    || ""),
      business_hours_end:         String(account.business_hours_end      || ""),
      max_daily_sends:            account.max_daily_sends != null ? String(account.max_daily_sends) : "",
      twilio_account_sid:         String(account.twilio_account_sid           || ""),
      twilio_auth_token:          String(account.twilio_auth_token            || ""),
      twilio_messaging_service_sid: String(account.twilio_messaging_service_sid || ""),
      twilio_default_from_number: String(account.twilio_default_from_number   || ""),
      webhook_url:                String(account.webhook_url                  || ""),
      webhook_secret:             String(account.webhook_secret               || ""),
      logo_url:                   String(account.logo_url                     || ""),
      instagram_user_id:          String(account.instagram_user_id            || ""),
      instagram_access_token:     String(account.instagram_access_token       || ""),
    });
    setIsEditing(true);
  }, [account]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setDraft({} as AccountDraft);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      for (const [field, value] of Object.entries(draft) as [keyof AccountDraft, string][]) {
        const current = String((account as any)[field] ?? "");
        if (value !== current) {
          await onSave(field, value);
        }
      }
      setIsEditing(false);
      setDraft({} as AccountDraft);
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setSaving(false);
    }
  }, [draft, account, onSave]);

  const set = useCallback((field: keyof AccountDraft, value: string) => {
    setDraft((d) => ({ ...d, [field]: value }));
  }, []);

  // Helper: get current value (draft when editing, account otherwise)
  const val = useCallback((field: keyof AccountDraft): string => {
    if (isEditing) return draft[field] ?? "";
    return String((account as any)[field] ?? "");
  }, [isEditing, draft, account]);

  const handleDelete = useCallback(() => {
    if (deleteConfirm) { onDelete(); setDeleteConfirm(false); }
    else { setDeleteConfirm(true); setTimeout(() => setDeleteConfirm(false), 3000); }
  }, [deleteConfirm, onDelete]);

  const handlePDF = useCallback(() => { window.print(); }, []);

  const handleLogoFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (logoInputRef.current) logoInputRef.current.value = "";
    setCropSrc(URL.createObjectURL(file));
  }, []);

  const handleCropSave = useCallback(async (dataUrl: string) => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    await onSave("logo_url", dataUrl);
  }, [cropSrc, onSave]);

  const handleCropCancel = useCallback(() => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }, [cropSrc]);

  const handleRemoveLogo = useCallback(async () => {
    await onSave("logo_url", "");
  }, [onSave]);

  const initials = getInitials(account.name || "?");

  const serviceCategories = parseServiceCategories(account.service_categories);

  // Display status badge uses live account status (not draft — badge updates after save)
  const displayStatus     = isEditing ? (draft.status || status) : status;
  const displayBadgeStyle = getStatusBadgeStyle(displayStatus);

  return (
    <div className="relative flex flex-col h-full overflow-hidden" data-testid="account-detail-view">

      {/* ── Full-height warm gradient ── */}
      <div className="absolute inset-0 bg-popover dark:bg-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_180%_123%_at_78%_83%,rgba(255,193,193,0.8)_0%,transparent_69%)] dark:opacity-[0.08]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_200%_at_2%_2%,#d0f8ff_5%,transparent_30%)] dark:opacity-[0.08]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_96%_80%_at_49%_51%,rgba(203,203,241,0.8)_0%,transparent_66%)] dark:opacity-[0.08]" />

      {/* ── Header ── */}
      <div className="shrink-0 relative z-10">
        <div className="relative px-4 pt-6 pb-4 md:pb-10 space-y-3 max-w-[1386px] w-full mr-auto">

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

            {/* Edit / Save / Cancel + PDF + Delete — far right */}
            <div className="flex items-center gap-1 shrink-0">
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
          <div className="flex items-start gap-3">
            {/* Logo circle — click to upload */}
            <div className="relative group shrink-0">
              <div
                className="h-[72px] w-[72px] rounded-full flex items-center justify-center text-xl font-bold overflow-hidden cursor-pointer"
                style={account.logo_url ? {} : { backgroundColor: displayBadgeStyle.bg, color: displayBadgeStyle.text }}
                onClick={() => logoInputRef.current?.click()}
                title={t("detail.clickToUploadLogo")}
              >
                {account.logo_url ? (
                  <img src={account.logo_url} alt="logo" className="h-full w-full object-cover" />
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
              {account.logo_url && !cropSrc && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveLogo(); }}
                  title={t("detail.removeLogo")}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-white dark:bg-card border border-black/[0.125] flex items-center justify-center text-foreground/50 hover:text-red-500 hover:border-red-300 transition-colors z-10 opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoFile}
            />

            <div className="flex-1 min-w-0 py-1">
              {isEditing ? (
                <input
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  className="text-[20px] md:text-[27px] font-semibold font-heading bg-transparent border-b-2 border-brand-blue outline-none w-full leading-tight"
                  placeholder={t("fields.accountName")}
                  data-testid="account-detail-name-input"
                />
              ) : (
                <h2
                  className="text-[20px] md:text-[27px] font-semibold font-heading text-foreground leading-tight truncate"
                  data-testid="account-detail-name"
                >
                  {account.name || t("detail.unnamedAccount")}
                </h2>
              )}

              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: displayBadgeStyle.bg, color: displayBadgeStyle.text }}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", getStatusDotCls(displayStatus))} />
                  {getStatusIcon(displayStatus)}
                  {displayStatus}
                </span>
                {leadCount !== null && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-black/[0.06] text-foreground/55">
                    {leadCount} {leadCount === 1 ? t("detail.lead") : t("detail.leads")}
                  </span>
                )}
                {(isEditing ? draft.type : account.type) && (
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border",
                    (isEditing ? draft.type : account.type) === "Agency"
                      ? "bg-brand-blue/[0.08] border-brand-blue/20 text-brand-blue"
                      : "border-border/50 text-foreground/60"
                  )}>
                    {isEditing ? draft.type : account.type}
                  </span>
                )}
                {account.business_niche && !isEditing && (
                  <span className="text-[11px] text-foreground/50 truncate">{account.business_niche}</span>
                )}
                <span className="text-[11px] text-foreground/40">#{accountId}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Body: scrollable with fade ── */}
      <div
        className="relative flex-1 overflow-y-auto min-h-0 -mt-[80px] pt-[83px] px-[3px] pb-[3px] flex flex-col gap-[3px]"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0px, black 83px)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0px, black 83px)",
        }}
      >

        {/* Top row: Overview | Campaigns & Contracts | Users */}
        <div
          className={cn("grid gap-[3px]", isMobile ? "grid-cols-1" : "grid-cols-3", "max-w-[1386px] w-full mr-auto")}
          style={isMobile ? undefined : { gridTemplateColumns: "1fr 1fr 1fr" }}
        >

          {/* Column 1: Overview */}
          <div className={cn("overflow-y-auto rounded-xl", isMobile ? "min-h-[300px]" : "h-[720px]")} style={isMobile ? undefined : { height: 720 }}>
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 flex flex-col min-h-full" data-testid="account-widget-basic">
              <p className="text-[18px] font-semibold font-heading text-foreground mb-3">{t("detail.overview")}</p>

              <InfoRow
                label={t("fields.status")}
                value={val("status")}
                editChild={isEditing ? <EditSelect value={val("status")} onChange={(v) => set("status", v)} options={STATUS_OPTIONS} /> : undefined}
              />
              <InfoRow
                label={t("fields.type")}
                value={val("type")}
                editChild={isEditing ? <EditSelect value={val("type")} onChange={(v) => set("type", v)} options={TYPE_OPTIONS} /> : undefined}
              />
              <InfoRow
                label={t("columns.niche")}
                value={val("business_niche")}
                editChild={isEditing ? <EditText value={val("business_niche")} onChange={(v) => set("business_niche", v)} placeholder={t("fields.businessNichePlaceholder")} /> : undefined}
              />

              <SectionHeader label={t("sections.contact")} icon={Phone} />

              <InfoRow
                label={t("fields.email")}
                value={val("owner_email")}
                editChild={isEditing ? <EditText value={val("owner_email")} onChange={(v) => set("owner_email", v)} type="email" placeholder={t("fields.ownerEmailPlaceholder")} /> : undefined}
              />
              <InfoRow
                label={t("fields.phone")}
                value={val("phone")}
                editChild={isEditing ? <EditText value={val("phone")} onChange={(v) => set("phone", v)} type="tel" placeholder={t("fields.phonePlaceholder")} /> : undefined}
              />
              <InfoRow
                label={t("fields.website")}
                value={val("website")}
                editChild={isEditing ? <EditText value={val("website")} onChange={(v) => set("website", v)} type="url" placeholder={t("fields.websitePlaceholder")} /> : undefined}
              />
              <InfoRow
                label={t("fields.address")}
                value={val("address")}
                editChild={isEditing ? <EditText value={val("address")} onChange={(v) => set("address", v)} placeholder="Street, City, Country" /> : undefined}
              />

              <SectionHeader label={t("sections.schedule")} icon={Clock} />

              <InfoRow
                label={t("fields.timezone")}
                value={val("timezone")}
                editChild={isEditing ? <EditSelect value={val("timezone")} onChange={(v) => set("timezone", v)} options={TIMEZONE_OPTIONS} /> : undefined}
              />
              <InfoRow
                label={t("fields.language")}
                value={val("language")}
                editChild={isEditing ? <EditSelect value={val("language")} onChange={(v) => set("language", v)} options={LANGUAGE_OPTIONS} /> : undefined}
              />
              <InfoRow
                label={t("fields.hoursOpen")}
                value={formatTimeDisplay(val("business_hours_start")) || val("business_hours_start")}
                editChild={isEditing ? <EditText value={val("business_hours_start")} onChange={(v) => set("business_hours_start", v)} type="time" /> : undefined}
              />
              <InfoRow
                label={t("fields.hoursClose")}
                value={formatTimeDisplay(val("business_hours_end")) || val("business_hours_end")}
                editChild={isEditing ? <EditText value={val("business_hours_end")} onChange={(v) => set("business_hours_end", v)} type="time" /> : undefined}
              />
              <InfoRow
                label={t("fields.dailySends")}
                value={val("max_daily_sends")}
                editChild={isEditing ? <EditText value={val("max_daily_sends")} onChange={(v) => set("max_daily_sends", v)} type="number" placeholder="0" /> : undefined}
              />
              <InfoRow
                label={t("fields.optOutKeyword")}
                value={val("opt_out_keyword")}
                editChild={isEditing ? <EditText value={val("opt_out_keyword")} onChange={(v) => set("opt_out_keyword", v)} placeholder="e.g. STOP" /> : undefined}
              />

              <InfoRow
                label={t("fields.taxId")}
                value={val("tax_id")}
                editChild={isEditing ? <EditText value={val("tax_id")} onChange={(v) => set("tax_id", v)} placeholder="Tax identifier" /> : undefined}
              />

              <SectionHeader label={t("sections.notes")} icon={FileText} />

              <InfoRow
                label={t("fields.description")}
                value={val("business_description")}
                editChild={isEditing ? <EditTextarea value={val("business_description")} onChange={(v) => set("business_description", v)} placeholder="Business description…" rows={3} /> : undefined}
              />
              <InfoRow
                label={t("columns.notes")}
                value={val("notes")}
                editChild={isEditing ? <EditTextarea value={val("notes")} onChange={(v) => set("notes", v)} placeholder="Internal notes…" rows={3} /> : undefined}
              />
              <InfoRow
                label={t("fields.serviceCategories")}
                value={
                  serviceCategories.length > 0 ? (
                    <span className="flex flex-wrap gap-1 mt-0.5">
                      {serviceCategories.map((cat, i) => (
                        <span key={i} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
                          {cat}
                        </span>
                      ))}
                    </span>
                  ) : undefined
                }
                editChild={isEditing ? <EditText value={val("service_categories")} onChange={(v) => set("service_categories", v)} placeholder="Comma-separated list" /> : undefined}
              />
            </div>
          </div>

          {/* Column 2: Campaigns & Contracts */}
          <div className={cn("overflow-y-auto rounded-xl", isMobile ? "min-h-[300px]" : "h-[720px]")} style={isMobile ? undefined : { height: 720 }}>
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 min-h-full" data-testid="account-widget-campaigns">
              <p className="text-[18px] font-semibold font-heading text-foreground mb-3">{t("detail.campaignsAndContracts")}</p>
              <AccountCampaignsPanel accountId={accountId} routePrefix={routePrefix} />
            </div>
          </div>

          {/* Column 3: Users */}
          <div className={cn("overflow-y-auto rounded-xl", isMobile ? "min-h-[300px]" : "h-[720px]")} style={isMobile ? undefined : { height: 720 }}>
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 min-h-full" data-testid="account-widget-users">
              <p className="text-[18px] font-semibold font-heading text-foreground mb-3">{t("related.users")}</p>
              <AccountUsersPanel accountId={accountId} routePrefix={routePrefix} />
            </div>
          </div>

        </div>

        {/* Bottom row: Knowledge Base | Integrations | Voice Clone */}
        <div
          className={cn("grid gap-[3px]", isMobile ? "grid-cols-1" : "grid-cols-3", "max-w-[1386px] w-full mr-auto")}
          style={isMobile ? undefined : { gridTemplateColumns: "1fr 1fr 1fr" }}
        >

          {/* Bottom Col 1: Knowledge Base */}
          <div className={cn("overflow-y-auto rounded-xl", isMobile ? "min-h-[300px]" : "h-[720px]")} style={isMobile ? undefined : { height: 720 }}>
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 flex flex-col min-h-full" data-testid="account-widget-kb">
              <KnowledgeBasePanel accountId={accountId} />
            </div>
          </div>

          {/* Bottom Col 2: Integrations */}
          <div className={cn("overflow-y-auto rounded-xl", isMobile ? "min-h-[300px]" : "h-[720px]")} style={isMobile ? undefined : { height: 720 }}>
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 flex flex-col min-h-full" data-testid="account-widget-twilio">
              <p className="text-[18px] font-semibold font-heading text-foreground mb-3">{t("detail.integrations")}</p>

              <SectionHeader label="Twilio" icon={Globe} />

              <InfoRow
                label={t("fields.accountSid")}
                value={<MonoValue value={val("twilio_account_sid")} />}
                editChild={isEditing ? <EditText value={val("twilio_account_sid")} onChange={(v) => set("twilio_account_sid", v)} placeholder="ACxxxxxxxxxxxxxxxx" /> : undefined}
              />
              <InfoRow
                label={t("fields.authToken")}
                value={<SecretDisplay value={val("twilio_auth_token")} />}
                editChild={isEditing ? <EditText value={val("twilio_auth_token")} onChange={(v) => set("twilio_auth_token", v)} type="password" placeholder="Auth token" /> : undefined}
              />
              <InfoRow
                label={t("fields.serviceSid")}
                value={<MonoValue value={val("twilio_messaging_service_sid")} />}
                editChild={isEditing ? <EditText value={val("twilio_messaging_service_sid")} onChange={(v) => set("twilio_messaging_service_sid", v)} placeholder="MGxxxxxxxxxxxxxxxx" /> : undefined}
              />
              <InfoRow
                label={t("fields.fromNumber")}
                value={<MonoValue value={val("twilio_default_from_number")} />}
                editChild={isEditing ? <EditText value={val("twilio_default_from_number")} onChange={(v) => set("twilio_default_from_number", v)} placeholder="+1xxxxxxxxxx" /> : undefined}
              />
              <InfoRow
                label={t("fields.webhookUrl")}
                value={<MonoValue value={val("webhook_url")} />}
                editChild={isEditing ? <EditText value={val("webhook_url")} onChange={(v) => set("webhook_url", v)} type="url" placeholder="https://..." /> : undefined}
              />
              <InfoRow
                label={t("fields.apiKeyIntake")}
                value={<SecretDisplay value={val("webhook_secret")} />}
                editChild={isEditing ? <EditText value={val("webhook_secret")} onChange={(v) => set("webhook_secret", v)} type="password" placeholder="Webhook secret" /> : undefined}
              />
              <InfoRow
                label={t("fields.intakeUrl")}
                value={<MonoValue value="https://webhooks.leadawaker.com/api/leads/intake" />}
              />

              <SectionHeader label="Instagram" icon={Globe} />
              <InfoRow
                label={t("fields.userId")}
                value={<MonoValue value={val("instagram_user_id")} />}
                editChild={isEditing ? <EditText value={val("instagram_user_id")} onChange={(v) => set("instagram_user_id", v)} placeholder="IG Business Account User ID" /> : undefined}
              />
              <InfoRow
                label={t("fields.accessToken")}
                value={<SecretDisplay value={val("instagram_access_token")} />}
                editChild={isEditing ? <EditText value={val("instagram_access_token")} onChange={(v) => set("instagram_access_token", v)} type="password" placeholder="Long-lived Page access token" /> : undefined}
              />
              {/* Instagram Sync */}
              {!isEditing && val("instagram_user_id") && val("instagram_access_token") && (
                <div className="mt-3 space-y-2">
                  <button
                    onClick={handleSyncInstagram}
                    disabled={syncing}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-indigo text-white text-xs font-medium hover:bg-brand-indigo/90 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
                    {syncing ? t("detail.syncingContacts") : t("detail.syncInstagram")}
                  </button>
                  {syncResult && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800 space-y-1">
                      <p className="font-medium">{t("detail.contactsSynced", { count: syncResult.synced })}</p>
                      {syncResult.skipped_duplicates > 0 && (
                        <p className="text-emerald-600">{t("detail.alreadyExisted", { count: syncResult.skipped_duplicates })}</p>
                      )}
                      {syncResult.failed > 0 && (
                        <p className="text-amber-600">{t("detail.failedCount", { count: syncResult.failed })}</p>
                      )}
                      {syncResult.rate_limited && (
                        <p className="text-amber-600">{t("detail.rateLimited")}</p>
                      )}
                      <p className="text-emerald-600/70">{t("detail.conversationsScanned", { count: syncResult.total_conversations })}</p>
                    </div>
                  )}
                  {syncError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                      {syncError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Col 3: Voice Clone */}
          <div className={cn("overflow-y-auto rounded-xl", isMobile ? "min-h-[300px]" : "h-[720px]")} style={isMobile ? undefined : { height: 720 }}>
            <VoiceCloneWidget
              voiceFileData={(account as any).voice_file_data ?? null}
              voiceFileName={(account as any).voice_file_name ?? null}
              accountId={(account as any).Id ?? (account as any).id ?? 0}
              onSave={onSave}
            />
          </div>

        </div>


      </div>

      {/* Logo crop modal */}
      {cropSrc && (
        <LogoCropModal
          srcUrl={cropSrc}
          onSave={handleCropSave}
          onCancel={handleCropCancel}
        />
      )}

    </div>
  );
}
