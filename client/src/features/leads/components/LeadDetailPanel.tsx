import { useState, useEffect, useRef, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/apiUtils";
import { renderRichText } from "@/lib/richTextUtils";
import { cn } from "@/lib/utils";
import {
  Phone,
  Mail,
  User,
  MessageSquare,
  Calendar,
  Tag,
  Activity,
  Bot,
  StickyNote,
  ExternalLink,
  Loader2,
  Globe,
  ArrowUpCircle,
  BarChart2,
  CheckCircle2,
  X,
  Plus,
  Save,
  Send,
  Smile,
  Meh,
  Frown,
  Layers,
  PhoneCall,
  UserCheck,
  UserX,
  RefreshCw,
  Pencil,
  Ban,
  Mic,
  Square,
  RotateCcw,
  Trash2,
  Zap,
} from "lucide-react";
import { useScoreBreakdown, TIER_COLORS, TIER_ARC_COLOR, TrendIcon } from "@/hooks/useScoreBreakdown";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "@/hooks/useWorkspace";
import { formatBookedDate } from "@/features/leads/components/cardView/formatUtils";
import { PipelineDashBar } from "@/features/leads/components/cardView/atoms";
import {
  fmtDate,
  fmtDateTime,
  formatAiMemory,
  engagementContext,
  activityContext,
  funnelContext,
  PIPELINE_STAGES,
  STATUS_COLORS,
  StatusBadge,
  PriorityBadge,
  SentimentBadge,
  InfoRow,
  SectionTitle,
  InlineEditField,
  ScoreArcPanel,
  ScoreDetailBar,
  LeadInteractionTimeline,
  LeadScoreSection,
  LeadTagsSection,
  LeadNotesSection,
  useLeadDnc,
  useLeadStage,
  useLeadTags,
  useVoiceRecording,
  type Interaction,
} from "./leadDetail";

// ── Types ──────────────────────────────────────────────────────────────────

export interface LeadDetailPanelProps {
  lead: Record<string, any> | null;
  open: boolean;
  onClose: () => void;
}

// ── Main Component ────────────────────────────────────────────────────────

export function LeadDetailPanel({ lead, open, onClose }: LeadDetailPanelProps) {
  const { t } = useTranslation("leads");
  const { accounts, isAgencyView } = useWorkspace();
  const accountTimezone = useMemo(() => {
    if (!lead) return undefined;
    const aid = lead.account_id ?? lead.accounts_id;
    const acct = accounts.find((a: any) => a.id === Number(aid));
    return (acct?.timezone as string) || undefined;
  }, [lead, accounts]);
  const [, setLocation] = useLocation();
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState(false);
  const [tagEvents, setTagEvents] = useState<any[]>([]);

  // ── Score breakdown ──
  const { breakdown: scoreBreakdown, loading: scoreLoading, refetch: refetchScore, resetToZero: resetScoreToZero } = useScoreBreakdown(lead?.id ?? null);
  const panelScore = scoreBreakdown?.lead_score ?? (lead?.lead_score ?? lead?.leadScore ?? 0);

  // ── Notes editing state ──
  const [localNotes, setLocalNotes] = useState<string>("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const notesOriginalRef = useRef<string>("");

  const leadId = lead?.Id || lead?.id;

  // ── Voice recording (extracted hook) — writes transcription into notes ──
  const {
    isRecordingVoice,
    recordingSeconds,
    transcribing,
    startVoiceRecording,
    stopVoiceRecording,
  } = useVoiceRecording(leadId, {
    setLocalNotes,
    setNotesDirty,
    setNotesSaved,
    notesOriginalRef,
  });

  const { toast } = useToast();

  // ── Manual takeover toggle state ──
  const [localManualTakeover, setLocalManualTakeover] = useState<boolean>(false);
  const [savingManualTakeover, setSavingManualTakeover] = useState(false);

  // ── Pipeline stage state (extracted hook) ──
  const {
    localStatus,
    savingStatus,
    stageSaved,
    localAiSummary,
    handleStageChange,
  } = useLeadStage(leadId, lead);

  // ── Tags state (extracted hook) ──
  const {
    leadTags,
    availableTags,
    loadingTags,
    addingTag,
    removingTagId,
    showTagDropdown,
    setShowTagDropdown,
    handleAddTag,
    handleRemoveTag,
    unassignedTags,
  } = useLeadTags(leadId, open);

  // ── DNC / Opted-out state (extracted hook) ──
  const {
    localOptedOut,
    localDncReason,
    setLocalDncReason,
    savingDnc,
    dncSaved,
    showDncReason,
    handleDncChange,
    handleDncReasonSave,
  } = useLeadDnc(leadId, lead);

  // Sync notes when lead changes
  useEffect(() => {
    const notes = lead?.notes || "";
    notesOriginalRef.current = notes;
    setLocalNotes(notes);
    setNotesDirty(false);
    setNotesSaved(false);
  }, [lead?.Id, lead?.id, lead?.notes]);

  // Sync manual_takeover when lead changes
  useEffect(() => {
    setLocalManualTakeover(Boolean(lead?.manual_takeover));
  }, [lead?.Id, lead?.id, lead?.manual_takeover]);

  // Fetch interactions when panel opens with a lead
  useEffect(() => {
    if (!open || !leadId) {
      setInteractions([]);
      return;
    }

    let cancelled = false;
    setLoadingInteractions(true);

    // Fetch all interactions — no limit query param (API returns all when no ?page= given)
    apiFetch(`/api/interactions?leadId=${leadId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled) return;
        const list: Interaction[] = Array.isArray(data) ? data : data?.list || data?.data || [];
        // Sort chronologically ascending (oldest first) — API returns DESC by default
        list.sort((a, b) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return ta - tb;
        });
        setInteractions(list);
      })
      .catch(() => {
        if (!cancelled) setInteractions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingInteractions(false);
      });

    return () => { cancelled = true; };
  }, [open, leadId]);

  // Fetch tag events for inline timeline chips
  useEffect(() => {
    if (!open || !leadId) { setTagEvents([]); return; }
    let cancelled = false;
    apiFetch(`/api/leads/${leadId}/tag-events`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (!cancelled) setTagEvents(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setTagEvents([]); });
    return () => { cancelled = true; };
  }, [open, leadId]);

  // ── Campaigns state (filtered by lead's account, agency view only) ──
  const isAgencyPanel = isAgencyView;
  const leadAccountId = Number(lead?.Accounts_id || lead?.account_id || lead?.accounts_id || 0);
  const [campaigns, setCampaigns] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    if (!open || !isAgencyPanel) return;
    apiFetch("/api/campaigns")
      .then((r) => r.ok ? r.json() : Promise.resolve([]))
      .then((data: any) => {
        const arr: any[] = Array.isArray(data) ? data : data?.list || data?.data || [];
        const mapped = arr.map((c: any) => ({
          id: c.Id ?? c.id,
          name: c.Name ?? c.name ?? `Campaign #${c.Id ?? c.id}`,
          accountId: Number(c.Accounts_id ?? c.accounts_id ?? c.account_id ?? 0),
        }));
        // Filter to only campaigns belonging to this lead's account
        const filtered = leadAccountId
          ? mapped.filter((c) => c.accountId === leadAccountId)
          : mapped;
        setCampaigns(filtered.map(({ id, name }) => ({ id, name })));
      })
      .catch(() => {});
  }, [open, isAgencyPanel, leadAccountId]);

  const handleNotesSave = async () => {
    if (!leadId || !notesDirty || savingNotes) return;
    setSavingNotes(true);
    setNotesSaved(false);
    try {
      const res = await apiFetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: localNotes }),
      });
      if (res.ok) {
        notesOriginalRef.current = localNotes;
        setNotesDirty(false);
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2000);
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setSavingNotes(false);
    }
  };

  const handleManualTakeoverChange = async (checked: boolean) => {
    if (!leadId || savingManualTakeover) return;
    const prev = localManualTakeover;
    setLocalManualTakeover(checked); // optimistic update
    setSavingManualTakeover(true);
    try {
      const res = await apiFetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual_takeover: checked }),
      });
      if (!res.ok) {
        setLocalManualTakeover(prev); // revert on error
      }
    } catch {
      setLocalManualTakeover(prev);
    } finally {
      setSavingManualTakeover(false);
    }
  };

  // Generic inline field save handler (patches lead by field name)
  const handleInlineFieldSave = async (fieldName: string, newValue: string) => {
    if (!leadId) return;
    await apiFetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [fieldName]: newValue }),
    });
  };

  if (!lead) return null;

  const fullName = lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
  const convStatus = localStatus || lead.conversion_status || lead.Conversion_Status || "";
  const autoStatus = lead.automation_status || lead.Automation_Status || "";
  const email = lead.email || lead.Email || "";
  const source = lead.Source || lead.source || lead.inquiries_source || "";
  const priority = lead.priority || lead.Priority || "";

  // Demo niche context
  const demoNicheRaw = lead.demo_niche || lead.demoNiche || "";
  const demoNicheCtx = (() => {
    if (!demoNicheRaw) return null;
    try { return JSON.parse(demoNicheRaw) as Record<string, any>; } catch { return null; }
  })();

  // Derived engagement metrics
  const sentCount = Number(lead.message_count_sent || 0);
  const recvCount = Number(lead.message_count_received || 0);
  const responseRate = sentCount > 0 ? `${Math.round((recvCount / sentCount) * 100)}%` : "—";

  const lastActivityTs = Math.max(
    lead.last_message_sent_at ? new Date(lead.last_message_sent_at).getTime() : 0,
    lead.last_message_received_at ? new Date(lead.last_message_received_at).getTime() : 0,
  );
  const daysInactive = lastActivityTs > 0
    ? `${Math.floor((Date.now() - lastActivityTs) / 86400000)}d ago`
    : "—";

  const handleViewFull = () => {
    onClose();
    setLocation(`/platform/contacts/${leadId}`);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:w-[420px] sm:max-w-[420px] p-0 flex flex-col overflow-hidden bg-background text-foreground dark:bg-card dark:border-border"
        data-testid="lead-detail-panel"
      >
        {/* Header */}
        <SheetHeader
          className="px-4 pt-4 pb-4 border-b border-border shrink-0 md:px-5 md:pt-5"
          data-testid="lead-info-header"
        >
          {/* Row 1: label */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("detail.title")}
            </div>
          </div>

          {/* Row 2: name (most prominent) */}
          <SheetTitle
            className="text-[18px] font-bold leading-tight truncate"
            data-testid="lead-detail-panel-name"
          >
            {fullName}
          </SheetTitle>

          {autoStatus && (
            <SheetDescription className="text-[11px] mt-1.5">
              {autoStatus}
            </SheetDescription>
          )}

          {/* Row 4: View full page */}
          <button
            onClick={handleViewFull}
            className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-brand-indigo hover:text-brand-indigo/80 font-medium transition-colors"
            data-testid="lead-detail-panel-view-full"
          >
            <ExternalLink className="h-3 w-3" />
            {t("detail.openFullPage")}
          </button>
        </SheetHeader>

        {/* Conversion pipeline bar */}
        {convStatus && (
          <div className="shrink-0 border-b border-border bg-background">
            <PipelineDashBar status={convStatus} />
          </div>
        )}

        {/* Action buttons row */}
        <div className="shrink-0 px-4 py-2.5 border-b border-border flex items-center justify-center gap-1.5 md:px-5">
          <button
            onClick={async () => {
              try {
                const res = await apiFetch(`/api/leads/${leadId}/trigger-bump`, { method: "POST" });
                if (!res.ok) throw new Error("Failed");
                toast({ title: t("detail.actions.bumpTriggered"), description: fullName });
              } catch {
                toast({ title: t("detail.actions.bumpFailed"), variant: "destructive" });
              }
            }}
            className="group inline-flex items-center h-9 pl-[9px] rounded-full border border-black/[0.125] text-foreground/60 hover:text-foreground text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[140px]"
            title={t("detail.actions.triggerBump")}
          >
            <RotateCcw className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              {t("detail.actions.bump")} {lead.current_bump_stage ? `${lead.current_bump_stage}/3` : ""}
            </span>
          </button>

          <button
            onClick={async () => {
              try {
                const res = await apiFetch(`/api/leads/${leadId}/reset-demo`, { method: "POST" });
                if (!res.ok) throw new Error("Failed");
                resetScoreToZero();
                toast({ title: t("detail.actions.leadReset"), description: fullName });
              } catch {
                toast({ title: t("detail.actions.resetFailed"), variant: "destructive" });
              }
            }}
            className="group inline-flex items-center h-9 pl-[9px] rounded-full border border-black/[0.125] text-foreground/60 hover:text-foreground text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[110px]"
            title={t("detail.actions.resetLead")}
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              {t("detail.actions.resetLead")}
            </span>
          </button>

          <button
            onClick={async () => {
              try {
                const res = await apiFetch(`/api/leads/${leadId}/demo-reset-and-send`, { method: "POST" });
                if (!res.ok) throw new Error("Failed");
                resetScoreToZero();
                toast({ title: t("detail.actions.demoStarted"), description: fullName });
              } catch {
                toast({ title: t("detail.actions.demoFailed"), variant: "destructive" });
              }
            }}
            className="group inline-flex items-center h-9 pl-[9px] rounded-full border border-amber-400/60 text-amber-600 dark:text-amber-400 hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-300 text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[120px]"
            title={t("detail.actions.demoResetTitle")}
          >
            <Zap className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              {t("detail.actions.demoReset")}
            </span>
          </button>

          <button
            onClick={async () => {
              try {
                const res = await apiFetch(`/api/leads/${leadId}/ai-send`, { method: "POST" });
                if (!res.ok) throw new Error("Failed");
                toast({ title: t("detail.actions.aiSent"), description: fullName });
              } catch {
                toast({ title: t("detail.actions.aiFailed"), variant: "destructive" });
              }
            }}
            className="group inline-flex items-center h-9 pl-[9px] rounded-full border border-black/[0.125] text-foreground/60 hover:text-foreground text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[110px]"
            title={t("detail.actions.aiSendMessage")}
          >
            <Bot className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              {t("detail.actions.aiSend")}
            </span>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5" data-testid="lead-detail-panel-body">

          {/* Contact Info — with inline editing */}
          <SectionTitle icon={<User className="h-3.5 w-3.5" />} title={t("detail.sections.contact")} />
          <div
            className="rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5"
            data-testid="contact-info-section"
          >
            <InlineEditField
              label={t("detail.fields.name")}
              value={fullName}
              icon={<User className="h-3 w-3" />}
              onSave={async (v) => {
                if (!leadId) return;
                const parts = v.trim().split(/\s+/);
                const firstName = parts[0] || "";
                const lastName = parts.slice(1).join(" ") || "";
                await apiFetch(`/api/leads/${leadId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ first_name: firstName, last_name: lastName }),
                });
              }}
              testId="inline-edit-name"
            />
            <InlineEditField
              label={t("detail.fields.phone")}
              value={lead.phone || ""}
              icon={<Phone className="h-3 w-3" />}
              type="tel"
              onSave={(v) => handleInlineFieldSave("phone", v)}
              testId="inline-edit-phone"
            />
            <InlineEditField
              label={t("detail.fields.email")}
              value={lead.email || ""}
              icon={<Mail className="h-3 w-3" />}
              type="email"
              onSave={(v) => handleInlineFieldSave("email", v)}
              testId="inline-edit-email"
            />
            <InlineEditField
              label={t("detail.fields.priority")}
              value={lead.priority || ""}
              icon={<Activity className="h-3 w-3" />}
              onSave={(v) => handleInlineFieldSave("priority", v)}
              selectOptions={["", "High", "Medium", "Low"]}
              testId="inline-edit-priority"
            />
            <InfoRow
              label={t("detail.fields.language")}
              value={lead.language}
            />
            <InfoRow
              label={t("detail.fields.source")}
              value={source}
            />
            {demoNicheCtx && (
              <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
                <span className="text-[11px] text-muted-foreground shrink-0">Niche</span>
                <div className="text-right text-[11px] text-foreground/80">
                  <div className="font-medium">{demoNicheCtx.niche_label || demoNicheCtx.raw || "—"}</div>
                  {demoNicheCtx.raw && demoNicheCtx.raw !== demoNicheCtx.niche_label && (
                    <div className="text-muted-foreground/60 mt-0.5 italic">{demoNicheCtx.raw}</div>
                  )}
                </div>
              </div>
            )}
            {/* Campaign — editable dropdown (#31, agency view only) */}
            {isAgencyPanel && (
              <div
                className="flex items-center justify-between gap-3 py-1.5 border-b border-border/30 last:border-0 group"
                data-testid="inline-edit-campaign"
              >
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-muted-foreground/60"><Layers className="h-3 w-3" /></span>
                  <span className="text-[11px] text-muted-foreground">{t("detail.fields.campaign")}</span>
                </div>
                <select
                  value={String(lead.campaignsId ?? lead.campaigns_id ?? "")}
                  onChange={async (e) => {
                    const val = e.target.value;
                    await handleInlineFieldSave("campaignsId", val ? val : (null as any));
                  }}
                  className="text-[12px] bg-transparent border border-dashed border-border/60 rounded px-1.5 py-0.5 max-w-[160px] focus:outline-none focus:ring-1 focus:ring-brand-indigo/50 text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
                  data-testid="inline-edit-campaign-select"
                >
                  <option value="">{"2014"}</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Status */}
          <SectionTitle icon={<Activity className="h-3.5 w-3.5" />} title={t("detail.sections.status")} />
          <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5">
            {/* Pipeline Stage — interactive dropdown */}
            <div
              className="flex items-start justify-between gap-3 py-1.5 border-b border-border/30"
              data-testid="pipeline-stage-row"
            >
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] text-muted-foreground">{t("detail.fields.pipelineStage")}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {/* Change dropdown */}
                <Select
                  value={convStatus}
                  onValueChange={handleStageChange}
                  disabled={savingStatus}
                >
                  <SelectTrigger
                    className="h-6 w-auto min-w-[70px] text-[11px] px-2 py-0 border-dashed border-border/60 bg-transparent hover:bg-muted/40 transition-colors"
                    data-testid="pipeline-stage-trigger"
                    aria-label={t("detail.fields.pipelineStage")}
                  >
                    <SelectValue placeholder={t("detail.fields.changePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent data-testid="pipeline-stage-dropdown">
                    {PIPELINE_STAGES.map((stage) => {
                      const colors = STATUS_COLORS[stage] ?? { bg: "bg-muted", text: "text-muted-foreground" };
                      return (
                        <SelectItem
                          key={stage}
                          value={stage}
                          className="text-[12px]"
                          data-testid={`pipeline-stage-option-${stage.replace(/\s+/g, "-").toLowerCase()}`}
                        >
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold",
                              colors.bg,
                              colors.text
                            )}
                          >
                            {stage}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {/* Saving/saved indicator */}
                {savingStatus && (
                  <Loader2
                    className="h-3 w-3 animate-spin text-muted-foreground"
                    data-testid="pipeline-stage-saving"
                  />
                )}
                {stageSaved && !savingStatus && (
                  <CheckCircle2
                    className="h-3.5 w-3.5 text-emerald-500"
                    data-testid="pipeline-stage-saved"
                  />
                )}
              </div>
            </div>

            <InfoRow label={t("detail.fields.automation")} value={autoStatus} />

            {/* Manual Takeover — toggle switch */}
            <div
              className="flex items-center justify-between gap-3 py-1.5 border-t border-border/30"
              data-testid="manual-takeover-row"
            >
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-muted-foreground/60">
                  {localManualTakeover ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                </span>
                <span className="text-[11px] text-muted-foreground">{t("detail.fields.manualTakeover")}</span>
                {localManualTakeover && (
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-400/15 px-1.5 py-px rounded-full">
                    {t("detail.fields.aiPaused")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {savingManualTakeover && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                <Switch
                  checked={localManualTakeover}
                  onCheckedChange={handleManualTakeoverChange}
                  disabled={savingManualTakeover}
                  data-testid="manual-takeover-toggle"
                  aria-label={t("detail.fields.manualTakeover")}
                />
              </div>
            </div>
          </div>

          {/* Lead Scores — arc + tier + detailed sub-score breakdown */}
          <LeadScoreSection
            panelScore={panelScore}
            scoreBreakdown={scoreBreakdown}
            scoreLoading={scoreLoading}
            demoNicheCtx={demoNicheCtx}
            lead={lead}
          />

          {/* DNC / Opted-out Section */}
          <SectionTitle icon={<Ban className="h-3.5 w-3.5" />} title={t("detail.sections.doNotContact")} />
          <div
            className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2"
            data-testid="dnc-section"
          >
            {/* Opted-out toggle */}
            <div
              className="flex items-center justify-between gap-3 py-1.5"
              data-testid="dnc-toggle-row"
            >
              <div className="flex items-center gap-1.5">
                <Ban className="h-3 w-3 text-muted-foreground/60" />
                <span className="text-[11px] text-muted-foreground">{t("detail.fields.optedOutDnc")}</span>
                {localOptedOut && (
                  <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-500/15 px-1.5 py-px rounded-full">
                    {t("detail.fields.dncActive")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {savingDnc && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                {dncSaved && !savingDnc && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                <Switch
                  checked={localOptedOut}
                  onCheckedChange={handleDncChange}
                  disabled={savingDnc}
                  data-testid="dnc-toggle"
                  aria-label={t("detail.fields.optedOutDnc")}
                />
              </div>
            </div>

            {/* DNC reason input — shows when opted out */}
            {showDncReason && (
              <div className="mt-1.5 pt-1.5 border-t border-border/30" data-testid="dnc-reason-container">
                <label className="text-[11px] text-muted-foreground mb-1 block">{t("detail.fields.dncReason")}</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={localDncReason}
                    onChange={(e) => setLocalDncReason(e.target.value)}
                    onBlur={handleDncReasonSave}
                    onKeyDown={(e) => { if (e.key === "Enter") handleDncReasonSave(); }}
                    placeholder={t("detail.fields.dncReasonPlaceholder")}
                    className="flex-1 text-[12px] bg-background border border-border/60 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-indigo/50"
                    data-testid="dnc-reason-input"
                    disabled={savingDnc}
                  />
                </div>
                {localDncReason && (
                  <p className="mt-1 text-[11px] text-muted-foreground" data-testid="dnc-reason-display">
                    {t("detail.fields.dncReasonLabel")}: <span className="text-foreground/80">{localDncReason}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Bump Stage Indicator */}
          {(lead.current_bump_stage != null || lead.bump_1_sent_at || lead.bump_2_sent_at || lead.bump_3_sent_at) && (
            <>
              <SectionTitle icon={<Layers className="h-3.5 w-3.5" />} title={t("detail.sections.bumpProgress")} />
              <div
                className="rounded-xl border border-border/40 bg-muted/20 px-3 py-3"
                data-testid="bump-stage-section"
              >
                {/* Stage progress bar */}
                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3].map((stage) => {
                    const currentStage = Number(lead.current_bump_stage ?? 0);
                    const done = currentStage >= stage;
                    return (
                      <div
                        key={stage}
                        className={cn(
                          "flex-1 h-2 rounded-full transition-[width] duration-300",
                          done ? "bg-brand-indigo" : "bg-muted"
                        )}
                        data-testid={`bump-stage-step-${stage}`}
                        data-done={done ? "true" : "false"}
                      />
                    );
                  })}
                </div>

                {/* Current stage label */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-muted-foreground">{t("detail.fields.currentStage")}</span>
                  <span
                    className="text-[12px] font-semibold text-foreground tabular-nums"
                    data-testid="bump-current-stage"
                  >
                    {lead.current_bump_stage ?? 0} / 3
                  </span>
                </div>

                {/* Bump timestamps */}
                {lead.bump_1_sent_at && (
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-[11px] text-muted-foreground">{t("detail.fields.bump", { n: 1 })}</span>
                    <span className="text-[11px] text-foreground/80 tabular-nums" data-testid="bump-1-sent-at">
                      {fmtDateTime(lead.bump_1_sent_at)}
                    </span>
                  </div>
                )}
                {lead.bump_2_sent_at && (
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-[11px] text-muted-foreground">{t("detail.fields.bump", { n: 2 })}</span>
                    <span className="text-[11px] text-foreground/80 tabular-nums" data-testid="bump-2-sent-at">
                      {fmtDateTime(lead.bump_2_sent_at)}
                    </span>
                  </div>
                )}
                {lead.bump_3_sent_at && (
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-[11px] text-muted-foreground">{t("detail.fields.bump", { n: 3 })}</span>
                    <span className="text-[11px] text-foreground/80 tabular-nums" data-testid="bump-3-sent-at">
                      {fmtDateTime(lead.bump_3_sent_at)}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Activity */}
          <SectionTitle icon={<MessageSquare className="h-3.5 w-3.5" />} title={t("detail.sections.activity")} />
          <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5">
            <InfoRow label={t("detail.fields.leadCreated")} value={fmtDate(lead.created_at)} />
            <InfoRow label={t("detail.fields.lastUpdated")} value={fmtDateTime(lead.updated_at)} />
            <InfoRow label={t("detail.fields.lastInteraction")} value={fmtDateTime(lead.last_interaction_at)} />
            <InfoRow label={t("detail.fields.lastSent")} value={fmtDateTime(lead.last_message_sent_at)} />
            <InfoRow label={t("detail.fields.lastReceived")} value={fmtDateTime(lead.last_message_received_at)} />
            <InfoRow label={t("detail.fields.sentCount")} value={lead.message_count_sent} />
            <InfoRow label={t("detail.fields.receivedCount")} value={lead.message_count_received} />
            <InfoRow label={t("detail.fields.responseRate")} value={responseRate} />
            <InfoRow label={t("detail.fields.daysInactive")} value={daysInactive} />
            <InfoRow label={t("detail.fields.firstContacted")} value={fmtDate(lead.first_message_sent_at)} />
            <InfoRow label={t("detail.fields.nextAction")} value={fmtDateTime(lead.next_action_at)} />
            {lead.what_has_the_lead_done && (
              <InfoRow label={t("detail.fields.whatTheyDid")} value={lead.what_has_the_lead_done} />
            )}
          </div>

          {/* Booking */}
          {(lead.booked_call_date || lead.booking_confirmed_at) && (
            <>
              <SectionTitle icon={<PhoneCall className="h-3.5 w-3.5" />} title={t("detail.sections.booking")} />
              <div
                className="rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5"
                data-testid="booked-call-section"
              >
                {lead.previous_booked_call_date && lead.re_scheduled_count != null && lead.re_scheduled_count > 0 && (
                  <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/30">
                    <span className="text-[11px] text-muted-foreground shrink-0">{t("detail.fields.previousCallDate", "Previous")}</span>
                    <span className="text-[12px] text-muted-foreground/50 line-through tabular-nums">{formatBookedDate(lead.previous_booked_call_date, accountTimezone)}</span>
                  </div>
                )}
                <InfoRow label={t("detail.fields.callDate")} value={formatBookedDate(lead.booked_call_date, accountTimezone)} />
                <InfoRow label={t("detail.fields.confirmedAt")} value={fmtDateTime(lead.booking_confirmed_at)} />
                {/* No-show indicator */}
                <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-[11px] text-muted-foreground shrink-0">{t("detail.fields.noShow")}</span>
                  {lead.no_show ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-600 dark:text-red-400"
                      data-testid="no-show-badge"
                    >
                      <X className="h-3 w-3" />
                      {t("detail.fields.noShow")}
                    </span>
                  ) : (
                    <span className="text-[12px] text-muted-foreground">{"2014"}</span>
                  )}
                </div>
                {/* Reschedule count */}
                {lead.re_scheduled_count != null && lead.re_scheduled_count > 0 && (
                  <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <RefreshCw className="h-3 w-3 text-muted-foreground/60" />
                      <span className="text-[11px] text-muted-foreground">{t("detail.fields.rescheduled")}</span>
                    </div>
                    <span
                      className="text-[12px] font-semibold text-amber-600 dark:text-amber-400 tabular-nums"
                      data-testid="reschedule-count"
                    >
                      {lead.re_scheduled_count}×
                    </span>
                  </div>
                )}
                {lead.call_duration_minutes != null && (
                  <InfoRow label={t("detail.fields.duration")} value={t("detail.fields.durationMinutes", { minutes: lead.call_duration_minutes })} />
                )}
                {/* Lead summary generated at booking */}
                {lead.ai_memory && (() => {
                  let isJsonArray = false;
                  try { if (Array.isArray(JSON.parse(lead.ai_memory))) isJsonArray = true; } catch { /* not JSON */ }
                  if (isJsonArray) return null;
                  return (
                    <div className="pt-2 pb-1 border-t border-border/30 mt-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Bot className="h-3 w-3 text-muted-foreground/60" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {t("detail.fields.aiSummary", "AI Summary")}
                        </span>
                      </div>
                      <p className="text-[12px] text-foreground/80 leading-relaxed">{lead.ai_memory}</p>
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {/* AI Insights */}
          {(lead.ai_sentiment || lead.ai_memory || lead.ai_summary || localAiSummary) && (
            <>
              <SectionTitle icon={<Bot className="h-3.5 w-3.5" />} title={t("detail.sections.aiInsights")} />
              <div
                className="rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5"
                data-testid="ai-insights-section"
              >
                {/* AI summary */}
                {(localAiSummary || lead.ai_summary) && (
                  <div className="py-1.5 border-b border-border/30">
                    <div className="text-[11px] text-muted-foreground mb-1">{t("detail.fields.aiSummary")}</div>
                    <p className="text-[12px] text-foreground/80 leading-relaxed">{localAiSummary || lead.ai_summary}</p>
                  </div>
                )}
                {/* Sentiment badge — color coded */}
                {lead.ai_sentiment && (
                  <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
                    <span className="text-[11px] text-muted-foreground shrink-0">{t("detail.fields.aiSentiment")}</span>
                    <SentimentBadge sentiment={lead.ai_sentiment} />
                  </div>
                )}
                {/* AI memory — formatted readably */}
                {lead.ai_memory && (
                  <div className="py-1.5" data-testid="ai-memory-display">
                    <div className="text-[11px] text-muted-foreground mb-1.5">{t("detail.fields.aiMemory")}</div>
                    <pre className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans break-words">
                      {formatAiMemory(lead.ai_memory)}
                    </pre>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Notes — editable + voice memo + AI notes */}
          <LeadNotesSection
            transcribing={transcribing}
            isRecordingVoice={isRecordingVoice}
            recordingSeconds={recordingSeconds}
            startVoiceRecording={startVoiceRecording}
            stopVoiceRecording={stopVoiceRecording}
            savingNotes={savingNotes}
            notesSaved={notesSaved}
            notesDirty={notesDirty}
            handleNotesSave={handleNotesSave}
            localNotes={localNotes}
            setLocalNotes={setLocalNotes}
            setNotesDirty={setNotesDirty}
            setNotesSaved={setNotesSaved}
            notesOriginalRef={notesOriginalRef}
            demoNicheCtx={demoNicheCtx}
          />

          {/* Tags */}
          <LeadTagsSection
            loadingTags={loadingTags}
            leadTags={leadTags}
            availableTags={availableTags}
            unassignedTags={unassignedTags}
            removingTagId={removingTagId}
            addingTag={addingTag}
            showTagDropdown={showTagDropdown}
            setShowTagDropdown={setShowTagDropdown}
            handleAddTag={handleAddTag}
            handleRemoveTag={handleRemoveTag}
          />

          {/* Interaction Timeline */}
          <LeadInteractionTimeline
            interactions={interactions}
            loadingInteractions={loadingInteractions}
            tagEvents={tagEvents}
          />

          {/* Campaign / Account */}
          <SectionTitle icon={<Tag className="h-3.5 w-3.5" />} title={t("detailView.assignment")} />
          <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5 mb-6">
            <InfoRow label={t("detail.fields.account")} value={lead.Account || lead.account_id} />
            <InfoRow label={t("detailView.campaign")} value={lead.Campaign || lead.campaign_id} />
            <InfoRow label={t("contact.created")} value={fmtDate(lead.created_at)} />
            {convStatus && (
              <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
                <span className="text-[11px] text-muted-foreground shrink-0">{t("detail.sections.status")}</span>
                <StatusBadge label={convStatus} />
              </div>
            )}
            {priority && (
              <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
                <span className="text-[11px] text-muted-foreground shrink-0">{t("detail.fields.priority")}</span>
                <PriorityBadge priority={priority} />
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
