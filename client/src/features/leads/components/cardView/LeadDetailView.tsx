// LeadDetailView and KanbanDetailPanel extracted from LeadsCardView.tsx
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  FileText,
  Trash2,
  Pencil,
  Palette,
  MessageSquare,
  Phone,
  TrendingUp,
  ClipboardList,
  ExternalLink,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { updateLead, deleteLead } from "../../api/leadsApi";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { CAMPAIGN_STICKERS } from "@/assets/campaign-stickers/index";
import { renderRichText } from "@/lib/richTextUtils";
import {
  GradientTester,
  GradientControlPoints,
  DEFAULT_LAYERS,
  layerToStyle,
  type GradientLayer,
} from "@/components/ui/gradient-tester";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useScoreBreakdown, TIER_COLORS } from "@/hooks/useScoreBreakdown";
import { hapticSave, hapticDelete } from "@/lib/haptics";
import { getLeadStatusAvatarColor, getCampaignAvatarColor } from "@/lib/avatarUtils";

import { getLeadId, getFullName, getStatus, getScore } from "./leadUtils";
import { formatRelativeTime, formatBookedDate } from "./formatUtils";
import { PipelineProgress, PipelineProgressCompact } from "./atoms";
import { ScoreWidget } from "./ScoreWidgets";
import { ContactWidget } from "./ContactWidget";
import { ConversationWidget } from "./ConversationWidget";
import { ActivityTimeline } from "./DetailWidgets";

// ── Alias used inside this file ──────────────────────────────────────────────
const getStatusAvatarColor = getLeadStatusAvatarColor;

// ── Full lead detail view ──────────────────────────────────────────────────────
export function LeadDetailView({
  lead,
  onClose,
  onRefresh,
  toolbarPrefix,
  campaignsById,
  leadTags,
}: {
  lead: Record<string, any>;
  onClose: () => void;
  leadTags?: { name: string; color: string }[];
  onRefresh?: () => void;
  toolbarPrefix?: (opts: { isNarrow: boolean }) => React.ReactNode;
  campaignsById?: Map<number, { name: string; accountId: number | null; bookingMode?: string | null }>;
}) {
  const { t } = useTranslation("leads");
  const { toast } = useToast();
  const name        = getFullName(lead);
  const status      = getStatus(lead);
  const score       = getScore(lead);
  const avatarColor = getStatusAvatarColor(status);
  const leadId      = getLeadId(lead);

  const { breakdown: detailBreakdown } = useScoreBreakdown(leadId ? Number(leadId) : null);
  const tier = detailBreakdown?.tier ?? (score === 0 ? "Sleeping" : null);

  // ── Responsive columns ─────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsNarrow(entry.contentRect.width < 820);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Tag events — fetch junction rows + full tag list, merge by ID ──────────
  const [tagEvents, setTagEvents] = useState<{ name: string; color?: string; appliedAt?: string }[]>([]);

  useEffect(() => {
    if (!leadId) { setTagEvents([]); return; }
    Promise.all([
      apiFetch(`/api/leads/${leadId}/tags`).then((r) => r.ok ? r.json() : []),
      apiFetch(`/api/tags`).then((r) => r.ok ? r.json() : []),
    ]).then(([junctionRows, allTagsData]: [any[], any[]]) => {
      const tagById = new Map<number, any>(
        (Array.isArray(allTagsData) ? allTagsData : []).map((t: any) => [t.id ?? t.Id, t])
      );
      const arr = Array.isArray(junctionRows) ? junctionRows : [];
      setTagEvents(arr.map((e: any) => {
        const tid = e.tagsId ?? e.Tags_id;
        const tag = tagById.get(Number(tid));
        return {
          name:      tag?.name  || tag?.Name  || `Tag #${tid ?? "?"}`,
          color:     tag?.color || tag?.Color || "gray",
          appliedAt: e.created_at ?? e.CreatedAt ?? null,
        };
      }));
    }).catch(() => setTagEvents([]));
  }, [leadId]);

  // ── Account logo ───────────────────────────────────────────────────────────
  const [accountLogo, setAccountLogo] = useState<string | null>(null);

  useEffect(() => {
    const accountId = lead.Accounts_id || lead.account_id || lead.accounts_id;
    if (!accountId) { setAccountLogo(null); return; }
    let cancelled = false;
    apiFetch(`/api/accounts/${accountId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: any) => { if (!cancelled) setAccountLogo(data?.logo_url || null); })
      .catch(() => { if (!cancelled) setAccountLogo(null); });
    return () => { cancelled = true; };
  }, [lead.Accounts_id, lead.account_id, lead.accounts_id]);

  // ── Campaign sticker ──────────────────────────────────────────────────────
  const [campaignStickerUrl, setCampaignStickerUrl] = useState<string | null>(null);

  useEffect(() => {
    const cId = lead.Campaigns_id || lead.campaigns_id || lead.campaignsId;
    if (!cId) { setCampaignStickerUrl(null); return; }
    let cancelled = false;
    apiFetch(`/api/campaigns/${cId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: any) => {
        if (cancelled) return;
        const slug = data?.campaign_sticker || data?.campaignSticker;
        const sticker = slug ? CAMPAIGN_STICKERS.find(s => s.slug === slug) : undefined;
        setCampaignStickerUrl(sticker?.url || null);
      })
      .catch(() => { if (!cancelled) setCampaignStickerUrl(null); });
    return () => { cancelled = true; };
  }, [lead.Campaigns_id, lead.campaigns_id, lead.campaignsId]);

  // ── Campaign number (#N within same account, sorted by ID) ────────────────
  const campaignNumber = useMemo(() => {
    const cId = Number(lead.Campaigns_id || lead.campaigns_id || lead.campaignsId || 0);
    if (!cId || !campaignsById) return null;
    const info = campaignsById.get(cId);
    if (!info) return null;
    const sameAccount = Array.from(campaignsById.entries())
      .filter(([, c]) => c.accountId === info.accountId)
      .sort(([a], [b]) => a - b);
    const idx = sameAccount.findIndex(([id]) => id === cId);
    return idx >= 0 ? idx + 1 : null;
  }, [lead.Campaigns_id, lead.campaigns_id, lead.campaignsId, campaignsById]);

  // ── Edit mode ──────────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const startEdit = useCallback(() => {
    setEditFields({
      full_name: getFullName(lead),
      source:    lead.source || lead.Source || "",
    });
    setIsEditing(true);
  }, [lead]);

  const handleSaveEdit = useCallback(async () => {
    setSaving(true);
    try {
      await updateLead(leadId, editFields);
      hapticSave();
      setIsEditing(false);
      onRefresh?.();
    } catch { /* noop */ } finally {
      setSaving(false);
    }
  }, [leadId, editFields, onRefresh]);

  // ── Delete confirm ─────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    hapticDelete();
    setDeleting(true);
    try {
      await deleteLead(leadId);
      onClose();
      onRefresh?.();
    } catch { /* noop */ } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  }, [leadId, onClose, onRefresh]);

  // ── PDF print ─────────────────────────────────────────────────────────────
  const panelRef = useRef<HTMLDivElement>(null);
  const handlePdf = useCallback(() => {
    const id = `__pdf_panel_${leadId}`;
    if (panelRef.current) panelRef.current.id = id;
    const style = document.createElement("style");
    style.id = "__pdf_print_style__";
    style.textContent = `
      @media print {
        body > * { display: none !important; }
        #${id} { display: flex !important; position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100dvh !important; overflow: hidden !important; z-index: 9999 !important; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.getElementById("__pdf_print_style__")?.remove(), 1200);
  }, [leadId]);

  // ── Gradient tester (agency-only) ─────────────────────────────────────────
  const { isAgencyUser, accounts } = useWorkspace();
  const accountTimezone = useMemo(() => {
    const aid = lead.Accounts_id || lead.account_id || lead.accounts_id;
    if (!aid) return undefined;
    const acct = accounts.find((a) => a.id === Number(aid));
    return (acct?.timezone as string) || undefined;
  }, [lead.Accounts_id, lead.account_id, lead.accounts_id, accounts]);
  const GRADIENT_KEY = "la:gradient:leads";
  const [savedGradient, setSavedGradient] = useState<GradientLayer[] | null>(() => {
    try { const raw = localStorage.getItem(GRADIENT_KEY); return raw ? JSON.parse(raw) as GradientLayer[] : null; } catch { return null; }
  });
  const [gradientTesterOpen, setGradientTesterOpen] = useState(false);
  const [gradientLayers, setGradientLayers] = useState<GradientLayer[]>(DEFAULT_LAYERS);
  const [gradientDragMode, setGradientDragMode] = useState(false);
  const updateGradientLayer = useCallback((id: number, patch: Partial<GradientLayer>) => {
    if (id === -1) { setGradientLayers(prev => [...prev, patch as GradientLayer]); return; }
    if (id === -2) { setGradientLayers(prev => prev.filter(l => l.id !== (patch as GradientLayer).id)); return; }
    setGradientLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }, []);
  const handleApplyGradient = useCallback(() => {
    localStorage.setItem(GRADIENT_KEY, JSON.stringify(gradientLayers));
    setSavedGradient(gradientLayers);
    setGradientTesterOpen(false);
  }, [gradientLayers]);
  const toggleGradientTester = useCallback(() => {
    setGradientTesterOpen(prev => {
      if (!prev && savedGradient) setGradientLayers(savedGradient);
      return !prev;
    });
  }, [savedGradient]);

  // ── Expand-on-hover button helpers ───────────────────────────────────────
  const xBtn = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
  const xSpan = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

  return (
    <div ref={panelRef} className="relative flex flex-col h-full overflow-hidden">

      {/* ── Full-height gradient ── */}
      {gradientTesterOpen ? (
        <>
          {gradientLayers.map(layer => {
            const style = layerToStyle(layer);
            return style ? <div key={layer.id} className="absolute inset-0" style={style} /> : null;
          })}
          {gradientDragMode && (
            <GradientControlPoints layers={gradientLayers} onUpdateLayer={updateGradientLayer} />
          )}
        </>
      ) : savedGradient ? (
        <>
          {savedGradient.map((layer: GradientLayer) => {
            const style = layerToStyle(layer);
            return style ? <div key={layer.id} className="absolute inset-0" style={style} /> : null;
          })}
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-popover dark:bg-background" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_79%_101%_at_42%_91%,rgba(255,102,17,0.4)_0%,transparent_69%)] dark:opacity-[0.08]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_200%_at_2%_2%,#f0ffb5_5%,transparent_30%)] dark:opacity-[0.08]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_73%_92%_at_69%_50%,rgba(255,191,135,0.38)_0%,transparent_66%)] dark:opacity-[0.08]" />
        </>
      )}

      {/* ── Fixed header (stays in place) ── */}
      <div className="relative shrink-0 z-10 px-4 pt-5 pb-3 space-y-6 max-w-[1386px] w-full mr-auto">

          {/* Toolbar */}
          <div className="flex items-center gap-1 flex-wrap">
            {toolbarPrefix?.({ isNarrow })}

            {/* Action buttons removed — available on Chats page only */}

            {/* Right-edge: Gradient + To PDF + Delete */}
            <div className="ml-auto flex items-center gap-1">
              {/* Gradient Tester (agency-only) */}
              {isAgencyUser && (
                <button
                  onClick={toggleGradientTester}
                  className={cn(xBtn, "hover:max-w-[120px]", gradientTesterOpen ? "border-indigo-200 text-indigo-600 bg-indigo-100" : "border-black/[0.125] text-foreground/60 hover:text-foreground")}
                  title="Gradient Tester"
                >
                  <Palette className="h-4 w-4 shrink-0" />
                  <span className={xSpan}>Gradient</span>
                </button>
              )}
              {/* To PDF */}
              <button onClick={handlePdf} className={cn(xBtn, "hover:max-w-[110px] border-black/[0.125] text-foreground/60 hover:text-foreground")}>
                <span className="relative inline-flex h-4 w-4 shrink-0">
                  <FileText className="h-4 w-4" />
                  <span className="absolute bottom-[1px] left-0 right-0 flex justify-center text-[5px] font-black leading-none">PDF</span>
                </span>
                <span className={xSpan}>{t("detailView.toPdf")}</span>
              </button>

              {/* Delete */}
              {deleteConfirm ? (
                <div className="inline-flex items-center gap-1 px-2 py-1.5 rounded-full border border-red-200 bg-red-50">
                  <span className="text-[11px] text-red-600 font-medium">{t("detailView.deleteLead")}</span>
                  <button onClick={handleDelete} disabled={deleting} className="text-[11px] font-bold text-red-600 hover:text-red-700 px-1">{deleting ? "…" : t("confirm.yes")}</button>
                  <button onClick={() => setDeleteConfirm(false)} className="text-[11px] text-muted-foreground hover:text-foreground px-1">{t("confirm.no")}</button>
                </div>
              ) : (
                <button onClick={() => setDeleteConfirm(true)} className={cn(xBtn, "hover:max-w-[110px] border-red-300/60 text-red-400 hover:border-red-400 hover:text-red-600")}>
                  <Trash2 className="h-4 w-4 shrink-0" />
                  <span className={xSpan}>{t("detailView.delete")}</span>
                </button>
              )}
            </div>
          </div>

          {/* Avatar + Name + Tags + Info row (merged onto one line) */}
          <div className="relative flex items-start gap-3">
            <EntityAvatar
              name={name}
              bgColor={avatarColor.bg}
              textColor={avatarColor.text}
              size={65}
              className="overflow-hidden"
            />

            <div className="flex-1 min-w-0 py-1">
              {isEditing ? (
                <input
                  value={editFields.full_name ?? ""}
                  onChange={(e) => setEditFields((f) => ({ ...f, full_name: e.target.value }))}
                  onBlur={handleSaveEdit}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setIsEditing(false); }}
                  autoFocus
                  className="text-[24px] font-semibold font-heading bg-white/70 dark:bg-white/[0.07] border border-brand-indigo/30 rounded-lg px-2 py-0.5 w-full focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
                />
              ) : (
                <div className="group/name flex items-center gap-2 cursor-text" onClick={startEdit}>
                  <h2 className="text-[18px] md:text-[27px] font-semibold font-heading text-foreground leading-tight truncate">{name}</h2>
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(); }}
                    className="opacity-0 group-hover/name:opacity-100 p-1 rounded hover:bg-muted/50 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
                    title="Edit name"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded border border-border/50 text-[10px] font-medium text-muted-foreground">Lead {leadId}</span>
                {tier && (
                  <span
                    className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold", TIER_COLORS[tier] ?? TIER_COLORS.Sleeping)}
                    style={(tier === "Hot" || tier === "Awake") ? {
                      boxShadow: `0 0 8px 2px ${tier === "Hot" ? "rgba(239,68,68,0.4)" : "rgba(16,185,129,0.4)"}`,
                    } : undefined}
                  >
                    {tier}
                  </span>
                )}
              </div>
            </div>
            {/* Metachips — absolute, centered on panel 2/3 boundary (66.67%) */}
            {(() => {
              const campName = lead.campaign_name || lead.Campaign || "";
              const acctName = lead.account_name || lead.Account || "";
              const hasAny = campName || acctName || lead.last_interaction_at || lead.last_message_received_at || lead.booked_call_date;
              if (!hasAny) return null;
              return (
              <div className="absolute -translate-x-1/2 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-8 whitespace-nowrap pointer-events-auto z-10" style={{ left: "66.67%" }}>
                {campName && (
                  <div className="flex items-center gap-1.5">
                    {campaignStickerUrl ? (
                      <img src={campaignStickerUrl} alt="" className="h-[38px] w-[38px] object-contain shrink-0" />
                    ) : (
                      <EntityAvatar
                        name={campName}
                        bgColor={getCampaignAvatarColor("Active").bg}
                        textColor={getCampaignAvatarColor("Active").text}
                        size={38}
                        className="shrink-0"
                      />
                    )}
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Campaign{campaignNumber ? ` #${campaignNumber}` : ""}</div>
                      <div className="text-[12px] font-bold text-foreground leading-none truncate max-w-[120px]">{campName}</div>
                    </div>
                  </div>
                )}
                {acctName && (
                  <div className="flex items-center gap-1.5">
                    {accountLogo ? (
                      <img src={accountLogo} alt="" className="h-[25px] w-[25px] rounded-full object-cover shrink-0" />
                    ) : (
                      <EntityAvatar
                        name={acctName}
                        bgColor="rgba(0,0,0,0.08)"
                        textColor="#374151"
                        size={25}
                        className="shrink-0"
                      />
                    )}
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Account</div>
                      <div className="text-[12px] font-bold text-foreground leading-none truncate max-w-[120px]">{acctName}</div>
                    </div>
                  </div>
                )}
                {(lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at) && (
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("contact.lastActivity", "Last Activity")}</div>
                    <div className="text-[12px] font-bold text-foreground leading-none">{formatRelativeTime(lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at, t)}</div>
                  </div>
                )}
                {(lead.booked_call_date || lead.bookedCallDate) && (
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("detail.fields.callDate", "Booked Call")}</div>
                    {(lead.previous_booked_call_date || lead.previousBookedCallDate) && Number(lead.re_scheduled_count || lead.reScheduledCount || 0) > 0 && (
                      <div className="text-[10px] text-muted-foreground/50 line-through leading-none mb-0.5">{formatBookedDate(lead.previous_booked_call_date || lead.previousBookedCallDate, accountTimezone)}</div>
                    )}
                    <div className="text-[12px] font-bold text-foreground leading-none">{formatBookedDate(lead.booked_call_date || lead.bookedCallDate, accountTimezone)}</div>
                  </div>
                )}
              </div>
              );
            })()}
          </div>

          {/* Pipeline tube */}
          {status && (
            <div className="pt-2 pb-6">
              <div className="hidden md:block"><PipelineProgress status={status} skipBooked={(() => { const cId = lead.Campaigns_id ?? lead.campaigns_id ?? lead.campaignsId; const mode = cId && campaignsById?.get(Number(cId))?.bookingMode; return mode === "direct"; })()} /></div>
              <div className="md:hidden"><PipelineProgressCompact status={status} /></div>
            </div>
          )}
        </div>

      {/* ── Body — fills remaining viewport, columns scroll internally ── */}
      <div
        className="relative flex-1 -mt-[80px] pt-[83px] overflow-hidden min-h-0"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0px, black 83px)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0px, black 83px)",
        }}
      >
        <div ref={containerRef} className="p-[3px] h-full flex flex-col gap-[3px] max-w-[1386px] w-full mr-auto">
          <div className="grid gap-[3px] flex-1 min-h-0" style={{ gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr 1fr" }}>
            {/* Contact */}
            <div className="overflow-y-auto rounded-xl min-h-0">
              <ContactWidget lead={lead} onRefresh={onRefresh} accountLogo={accountLogo} campaignStickerUrl={campaignStickerUrl} campaignsById={campaignsById} />
            </div>
            {/* Chat */}
            <div className="overflow-hidden rounded-xl bg-white/60 dark:bg-white/[0.10] flex flex-col min-h-0">
              <ConversationWidget lead={lead} showHeader />
            </div>
            {/* Lead Score */}
            <div className="overflow-y-auto rounded-xl min-h-0">
              <ScoreWidget score={score} lead={lead} status={status} />
            </div>
          </div>
        </div>
      </div>

      {/* Gradient Tester floating panel (agency-only) */}
      {isAgencyUser && (
        <GradientTester
          open={gradientTesterOpen}
          onClose={() => setGradientTesterOpen(false)}
          layers={gradientLayers}
          onUpdateLayer={updateGradientLayer}
          onResetLayers={() => setGradientLayers(DEFAULT_LAYERS)}
          dragMode={gradientDragMode}
          onToggleDragMode={() => setGradientDragMode(prev => !prev)}
          onApply={handleApplyGradient}
        />
      )}

    </div>
  );
}

// ── Kanban detail panel (tabbed, compact) ─────────────────────────────────────
type KanbanTab = "chat" | "contact" | "score" | "activity" | "notes";

export function KanbanDetailPanel({
  lead,
  onClose,
  leadTags,
  onOpenFullProfile,
}: {
  lead: Record<string, any>;
  onClose: () => void;
  leadTags: { name: string; color: string }[];
  onOpenFullProfile?: () => void;
}) {
  const { t } = useTranslation("leads");
  const [activeTab, setActiveTab] = useState<KanbanTab>("chat");

  const kanbanTabs: { id: KanbanTab; label: string; icon: typeof MessageSquare }[] = [
    { id: "chat",     label: t("conversations.title"), icon: MessageSquare },
    { id: "contact",  label: t("contact.title"),       icon: Phone },
    { id: "score",    label: t("score.title"),          icon: TrendingUp },
    { id: "activity", label: t("detail.sections.activity"), icon: ClipboardList },
    { id: "notes",    label: t("detail.sections.notes"),    icon: FileText },
  ];

  const name       = getFullName(lead);
  const status     = getStatus(lead);
  const score      = getScore(lead);
  const avatarColor = getStatusAvatarColor(status);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card rounded-lg">

      {/* ── Header: avatar + name + X ── */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border/20">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <EntityAvatar
              name={name}
              bgColor={avatarColor.bg}
              textColor={avatarColor.text}
              size={72}
            />
            <div>
              <p className="text-[18px] font-semibold font-heading text-foreground leading-tight truncate max-w-[180px]">{name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{status || "—"}</p>
            </div>
          </div>
          {onOpenFullProfile && (
            <button
              onClick={onOpenFullProfile}
              title="Open full lead profile"
              className="flex items-center gap-1 text-[11px] font-medium text-brand-indigo/80 hover:text-brand-indigo transition-colors px-2 py-1 rounded-lg hover:bg-brand-indigo/5 shrink-0 mt-1"
            >
              <span>Full profile</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={onClose}
            className="icon-circle-lg icon-circle-base shrink-0"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

      </div>

      {/* ── Tabs ── */}
      <div className="shrink-0 px-2 pt-2 pb-1 flex items-center gap-1">
        {kanbanTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium",
              activeTab === id
                ? "bg-highlight-active text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Active widget ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "chat" && <ConversationWidget lead={lead} showHeader />}
        {activeTab === "contact" && (
          <div className="h-full overflow-y-auto p-3">
            <ContactWidget lead={lead} />
          </div>
        )}
        {activeTab === "score" && (
          <div className="h-full overflow-y-auto p-3">
            <ScoreWidget score={score} lead={lead} status={status} />
          </div>
        )}
        {activeTab === "activity" && (
          <div className="h-full overflow-hidden">
            <ActivityTimeline lead={lead} tagEvents={leadTags} />
          </div>
        )}
        {activeTab === "notes" && (
          <div className="h-full overflow-y-auto p-4">
            <p className="text-[18px] font-semibold font-heading text-foreground mb-3">{t("detail.sections.notes")}</p>
            {lead.notes || lead.Notes ? (
              <p className="text-[12px] text-foreground/80 leading-relaxed">
                {renderRichText(lead.notes || lead.Notes || "")}
              </p>
            ) : (
              <p className="text-[12px] text-muted-foreground/50 italic">{t("activity.clickToAddNotes")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
