// LeadDetailView and KanbanDetailPanel extracted from LeadsCardView.tsx
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { updateLead, deleteLead } from "../../api/leadsApi";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { CAMPAIGN_STICKERS } from "@/assets/campaign-stickers/index";
import {
  GradientTester,
  GradientControlPoints,
  layerToStyle,
  type GradientLayer,
} from "@/components/ui/gradient-tester";

/** Matches the hardcoded CSS fallback gradients for the leads detail page */
const PAGE_DEFAULT_LAYERS: GradientLayer[] = [
  { id: 0, label: "Base", enabled: true, type: "solid", solidColor: "#ffffff", ellipseW: 100, ellipseH: 100, posX: 50, posY: 50, colorStops: [] },
  { id: 1, label: "Orange glow", enabled: true, type: "radial", ellipseW: 79, ellipseH: 101, posX: 42, posY: 91, colorStops: [
    { color: "#ff6611", opacity: 0.4, position: 0 },
    { color: "#ff6611", opacity: 0, position: 69 },
  ]},
  { id: 2, label: "Lime corner TL", enabled: true, type: "radial", ellipseW: 200, ellipseH: 200, posX: 2, posY: 2, colorStops: [
    { color: "#f0ffb5", opacity: 1, position: 5 },
    { color: "#f0ffb5", opacity: 0, position: 30 },
  ]},
  { id: 3, label: "Peach center-right", enabled: true, type: "radial", ellipseW: 73, ellipseH: 92, posX: 69, posY: 50, colorStops: [
    { color: "#ffbf87", opacity: 0.38, position: 0 },
    { color: "#ffbf87", opacity: 0, position: 66 },
  ]},
];

import { useWorkspace } from "@/hooks/useWorkspace";
import { useScoreBreakdown, TIER_COLORS } from "@/hooks/useScoreBreakdown";
import { hapticSave, hapticDelete } from "@/lib/haptics";
import { getLeadStatusAvatarColor, getCampaignAvatarColor } from "@/lib/avatarUtils";

import { getLeadId, getFullName, getStatus, getScore } from "./leadUtils";
import { formatRelativeTime, formatBookedDate } from "./formatUtils";
import { PipelineProgress, PipelineProgressCompact, PipelineDashBar } from "./atoms";
import { ScoreWidget } from "./ScoreWidgets";
import { ContactWidget } from "./ContactWidget";
import { ConversationWidget } from "./ConversationWidget";
import { TempBadge } from "./designPrimitives";
import { LeadSummaryCard } from "./LeadSummaryCard";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ── Alias used inside this file ──────────────────────────────────────────────
const getStatusAvatarColor = getLeadStatusAvatarColor;

// ── Full lead detail view ──────────────────────────────────────────────────────
export function LeadDetailView({
  lead,
  onClose,
  onRefresh,
  campaignsById,
  leadTags,
}: {
  lead: Record<string, any>;
  onClose: () => void;
  leadTags?: { name: string; color: string }[];
  onRefresh?: () => void;
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
  const [panelWidth, setPanelWidth] = useState(1000);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setPanelWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const isNarrow = panelWidth < 820;
  // The chat card always toggles between Conversations / Summary. Default to
  // Conversations unless a real summary already exists (conversation ended —
  // booked or lost). Mirror LeadSummaryCard's resolution so we don't flip to a
  // locked/empty Summary just because ai_memory has unrelated data.
  const hasSummary = (() => {
    const aiSummary = lead?.ai_summary || lead?.aiSummary || "";
    if (aiSummary) return true;
    const memoryStr = lead?.ai_memory || lead?.aiMemory || "";
    if (!memoryStr) return false;
    try {
      const obj = typeof memoryStr === "string" ? JSON.parse(memoryStr) : memoryStr;
      return Boolean(obj?.summary || obj?.notes || obj?.description);
    } catch { return false; }
  })();
  const [chatTab, setChatTab] = useState<"chat" | "summary">(hasSummary ? "summary" : "chat");
  useEffect(() => {
    setChatTab(hasSummary ? "summary" : "chat");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  // ── Human-takeover state (reported up by ConversationWidget) so the "Let AI
  //    continue" control can sit in the tab-switcher row, opposite corner. ──
  const [chatHumanTakeover, setChatHumanTakeover] = useState(false);
  const [showAiResume, setShowAiResume] = useState(false);
  useEffect(() => { setShowAiResume(false); }, [leadId]);
  const handleChatAiResume = useCallback(async () => {
    setShowAiResume(false);
    try {
      await updateLead(leadId, { manual_takeover: false });
      setChatHumanTakeover(false);
      onRefresh?.();
    } catch (err) {
      console.error("Failed to resume AI", err);
    }
  }, [leadId, onRefresh]);

  // ── Reputation: mark service completed (the entry trigger for the feedback ask).
  //    The timestamp is set server-side by the endpoint, never sent from here. ──
  const servedAt = lead?.service_completed_at || lead?.serviceCompletedAt || null;
  const [marking, setMarking] = useState(false);
  const handleMarkServed = useCallback(async () => {
    if (!leadId) return;
    setMarking(true);
    try {
      const res = await apiFetch(`/api/leads/${leadId}/mark-served`, { method: "POST" });
      if (res.ok) {
        hapticSave();
        toast({ description: t("detail.markServed.success", "Marked as served") });
        onRefresh?.();
      } else {
        toast({ description: t("detail.markServed.error", "Could not mark as served"), variant: "destructive" });
      }
    } catch {
      toast({ description: t("detail.markServed.error", "Could not mark as served"), variant: "destructive" });
    }
    setMarking(false);
  }, [leadId, onRefresh, t, toast]);

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
      const nameParts = (editFields.full_name || "").trim().split(/\s+/);
      const patch: Record<string, string> = {
        first_name: nameParts[0] || "",
        last_name: nameParts.slice(1).join(" ") || "",
      };
      if (editFields.source !== undefined) patch.source = editFields.source;
      await updateLead(leadId, patch);
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
  const [gradientLayers, setGradientLayers] = useState<GradientLayer[]>(savedGradient ?? PAGE_DEFAULT_LAYERS);
  const [gradientDragMode, setGradientDragMode] = useState(false);
  const updateGradientLayer = useCallback((id: number, patch: Partial<GradientLayer>) => {
    if (id === -1) { setGradientLayers(prev => [...prev, patch as GradientLayer]); return; }
    if (id === -2) { setGradientLayers(prev => prev.filter(l => l.id !== (patch as GradientLayer).id)); return; }
    setGradientLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }, []);
  const handleSaveGradient = useCallback(() => {
    localStorage.setItem(GRADIENT_KEY, JSON.stringify(gradientLayers));
    setSavedGradient(gradientLayers);
  }, [gradientLayers]);
  const handleApplyGradient = useCallback(() => {
    handleSaveGradient();
    setGradientTesterOpen(false);
  }, [handleSaveGradient]);
  const toggleGradientTester = useCallback(() => {
    if (!gradientTesterOpen) {
      try {
        const raw = localStorage.getItem(GRADIENT_KEY);
        if (raw) setGradientLayers(JSON.parse(raw) as GradientLayer[]);
        else setGradientLayers(PAGE_DEFAULT_LAYERS);
      } catch { /* keep current layers */ }
    }
    setGradientTesterOpen(prev => !prev);
  }, [gradientTesterOpen]);

  // Listen for the global gradient toggle dispatched by the nav menu button
  useEffect(() => {
    const handler = () => toggleGradientTester();
    window.addEventListener("toggle-gradient-tester", handler);
    return () => window.removeEventListener("toggle-gradient-tester", handler);
  }, [toggleGradientTester]);

  // ── Hero data (computed once) ─────────────────────────────────────────────
  const campName = lead.campaign_name || lead.Campaign || "";
  const acctName = lead.account_name || lead.Account || "";
  const hasActivity = lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at;
  const bookedDate = lead.booked_call_date || lead.bookedCallDate;
  const skipBooked = (() => {
    const cId = lead.Campaigns_id ?? lead.campaigns_id ?? lead.campaignsId;
    const mode = cId && campaignsById?.get(Number(cId))?.bookingMode;
    return mode === "direct";
  })();
  const setRefs = (n: HTMLDivElement | null) => { panelRef.current = n; containerRef.current = n; };
  const sep = <span style={{ color: "var(--line-strong)" }}>·</span>;

  return (
    <div ref={setRefs} className="relative flex flex-col h-full" style={{ gap: 14, padding: 14 }}>

      {/* ── Hero (detached, rounded) ── */}
      <div className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--card)", overflow: "hidden", flexShrink: 0 }}>
        <div style={{ padding: isNarrow ? "14px 16px" : "16px 20px", display: "flex", alignItems: "center", gap: isNarrow ? 12 : 16 }}>
          <EntityAvatar name={name} bgColor={avatarColor.bg} textColor={avatarColor.text} size={isNarrow ? 42 : 50} className="rounded-[14px] overflow-hidden shrink-0" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5, flexWrap: "wrap" }}>
              {isEditing ? (
                <input
                  value={editFields.full_name ?? ""}
                  onChange={(e) => setEditFields((f) => ({ ...f, full_name: e.target.value }))}
                  onBlur={handleSaveEdit}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setIsEditing(false); }}
                  autoFocus
                  style={{ fontFamily: "var(--serif)", fontSize: isNarrow ? 22 : 27, color: "var(--ink)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", border: "none", borderRadius: "var(--r-button)", padding: "2px 8px", outline: "none" }}
                />
              ) : (
                <span onClick={startEdit} style={{ fontFamily: "var(--serif)", fontSize: isNarrow ? 22 : 27, color: "var(--ink)", lineHeight: 1, letterSpacing: "-0.01em", cursor: "text" }}>{name}</span>
              )}
              {tier && <TempBadge temp={tier} />}
              <span style={{ fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--mute-2)", letterSpacing: "0.1em", textTransform: "uppercase", border: "1px solid var(--line-strong)", borderRadius: 4, padding: "2px 6px" }}>Lead {leadId}</span>
              {bookedDate && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--warn-tint)", border: "1px solid rgba(196,138,47,0.4)", borderRadius: "var(--r-pill)", padding: "3px 10px 3px 8px", color: "var(--stage-booked)", fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
                  <Calendar className="h-[11px] w-[11px]" />Booked · {formatBookedDate(bookedDate, accountTimezone)}
                </span>
              )}
              {servedAt ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "color-mix(in srgb, var(--primary) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--primary) 35%, transparent)", borderRadius: "var(--r-pill)", padding: "3px 10px 3px 8px", color: "var(--primary)", fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
                  <CheckCircle2 className="h-[11px] w-[11px]" />{t("detail.served", "Served")} · {formatBookedDate(servedAt, accountTimezone)}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleMarkServed}
                  disabled={marking}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid var(--line-strong)", borderRadius: "var(--r-pill)", padding: "3px 10px 3px 8px", color: "var(--mute)", fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, cursor: marking ? "default" : "pointer", opacity: marking ? 0.5 : 1 }}
                >
                  <CheckCircle2 className="h-[11px] w-[11px]" />{marking ? t("detail.markServed.saving", "Saving…") : t("detail.markServed.label", "Mark served")}
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 12, fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--mute)", letterSpacing: "0.1em", textTransform: "uppercase", flexWrap: "wrap" }}>
              {hasActivity && <span>{t("contact.lastActivity", "Activity")} {formatRelativeTime(hasActivity, t)}</span>}
              {campName && <>{sep}<span>{campName}{campaignNumber ? ` #${campaignNumber}` : ""}</span></>}
              {!isNarrow && acctName && <>{sep}<span>{acctName}</span></>}
            </div>
          </div>
        </div>
        {status && <PipelineDashBar status={status} />}
      </div>

      {/* ── Columns ── */}
      <div style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", flexDirection: isNarrow ? "column" : "row", gap: 14, overflowY: isNarrow ? "auto" : undefined, overflow: isNarrow ? "auto" : "visible" }}>
        {/* Contact */}
        <div style={{ width: isNarrow ? "auto" : 200, flexShrink: 0, minHeight: isNarrow ? 360 : 0, display: "flex" }}>
          <ContactWidget
            lead={lead}
            onRefresh={onRefresh}
            accountLogo={accountLogo}
            campaignStickerUrl={campaignStickerUrl}
            campaignsById={campaignsById}
            onPdf={handlePdf}
            onDelete={handleDelete}
            isDeleting={deleting}
            deleteConfirm={deleteConfirm}
            setDeleteConfirm={setDeleteConfirm}
            onToggleGradient={toggleGradientTester}
            gradientTesterOpen={gradientTesterOpen}
            isAgencyUser={isAgencyUser}
          />
        </div>
        {/* Chat with Conversations / Summary toggle — admin/owner only */}
        {isAgencyUser && (
          <div style={{ flex: isNarrow ? undefined : "1 1 auto", minWidth: isNarrow ? "auto" : 180, minHeight: isNarrow ? 440 : 0, display: "flex" }}>
            <div className="glass-strong" style={{ flex: 1, minWidth: 0, borderRadius: "var(--r-card)", overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 8px 0" }}>
                <div className="la-seg la-seg--pill">
                  <button className={`la-seg-btn${chatTab === "chat" ? " on" : ""}`} onClick={() => setChatTab("chat")}>Conversations</button>
                  <button className={`la-seg-btn${chatTab === "summary" ? " on" : ""}`} onClick={() => setChatTab("summary")}>{t("detail.aiSummary", "Summary")}</button>
                </div>
                {/* Let AI continue — opposite corner from the tab switcher, only while a human has taken over */}
                {chatTab === "chat" && chatHumanTakeover && (
                  <Popover open={showAiResume} onOpenChange={setShowAiResume}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="group relative inline-flex items-center justify-center h-[30px] w-[30px] rounded-full border border-black/[0.125] hover:border-brand-indigo shrink-0 overflow-hidden transition-[width,border-color] duration-200 hover:w-[128px]"
                        aria-label={t("chat.letAiContinue", "Let AI continue")}
                      >
                        <img src="/6. Favicon.svg" alt="AI" className="h-[18px] w-[18px] shrink-0 absolute left-[5px]" />
                        <span className="whitespace-nowrap pl-7 pr-2 text-[11px] font-medium text-brand-indigo opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          {t("chat.letAiContinue", "Let AI continue")}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      side="bottom"
                      sideOffset={6}
                      className="w-auto p-3 shadow-md border border-black/[0.08] bg-white dark:bg-popover rounded-xl"
                    >
                      <p className="text-[12px] text-foreground/70 mb-2.5 max-w-[200px]">
                        AI will resume this conversation. You can take over again anytime.
                      </p>
                      <div className="flex items-center gap-2 justify-end">
                        <button type="button" onClick={() => setShowAiResume(false)} className="text-[12px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/60 transition-colors">Cancel</button>
                        <button type="button" onClick={handleChatAiResume} className="text-[12px] font-medium text-white bg-brand-indigo hover:bg-brand-indigo/90 px-3 py-1 rounded-md transition-colors">Confirm</button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              {chatTab === "summary" ? (
                <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
                  <LeadSummaryCard lead={lead} tier={tier} status={status} hideHeader />
                </div>
              ) : (
                <ConversationWidget lead={lead} showHeader={false} onTakeoverChange={setChatHumanTakeover} />
              )}
            </div>
          </div>
        )}
        {/* Lead Score — same fixed width as Contact */}
        <div style={{ width: isNarrow ? "auto" : 200, flexShrink: 0, minHeight: isNarrow ? 360 : 0, display: "flex" }}>
          <ScoreWidget score={score} lead={lead} status={status} />
        </div>
      </div>

      {/* Gradient Tester floating panel (agency-only) */}
      {isAgencyUser && (
        <GradientTester
          open={gradientTesterOpen}
          onClose={() => setGradientTesterOpen(false)}
          layers={gradientLayers}
          onUpdateLayer={updateGradientLayer}
          onResetLayers={() => setGradientLayers(PAGE_DEFAULT_LAYERS)}
          dragMode={gradientDragMode}
          onToggleDragMode={() => setGradientDragMode((prev) => !prev)}
          onSave={handleSaveGradient}
          onApply={handleApplyGradient}
        />
      )}
    </div>
  );
}

// Re-exported from its own module (kept here for existing import paths).
export { KanbanDetailPanel } from "./KanbanDetailPanel";
