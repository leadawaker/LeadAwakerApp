import { useState, useEffect, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { apiFetch } from "@/lib/apiUtils";
import {
  Bot,
  ExternalLink,
  RotateCcw,
  Trash2,
  Zap,
} from "lucide-react";
import { useScoreBreakdown } from "@/hooks/useScoreBreakdown";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "@/hooks/useWorkspace";
import { PipelineDashBar } from "@/features/leads/components/cardView/atoms";
import {
  LeadInteractionTimeline,
  LeadScoreSection,
  LeadTagsSection,
  LeadNotesSection,
  useLeadDnc,
  useLeadStage,
  useLeadTags,
  useVoiceRecording,
  useLeadNotes,
  LeadContactSection,
  LeadStatusSection,
  LeadDncSection,
  LeadBumpSection,
  LeadActivitySection,
  LeadBookingSection,
  LeadAiInsightsSection,
  LeadAssignmentSection,
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

  const leadId = lead?.Id || lead?.id;

  // ── Notes editing state (extracted hook) ──
  const {
    localNotes,
    setLocalNotes,
    notesDirty,
    setNotesDirty,
    savingNotes,
    notesSaved,
    setNotesSaved,
    notesOriginalRef,
    handleNotesSave,
  } = useLeadNotes(leadId, lead);

  // ── Voice recording (extracted hook) — writes transcription into notes ──
  const {
    isRecordingVoice,
    recordingSeconds,
    transcribing,
    transcriptionFailed,
    startVoiceRecording,
    stopVoiceRecording,
    retryTranscription,
    dismissFailedTranscription,
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
  const [campaigns, setCampaigns] = useState<{ id: number; name: string; aiModel?: string }[]>([]);

  useEffect(() => {
    if (!open || !isAgencyPanel) return;
    apiFetch("/api/campaigns")
      .then((r) => r.ok ? r.json() : Promise.resolve([]))
      .then((data: any) => {
        const arr: any[] = Array.isArray(data) ? data : data?.list || data?.data || [];
        const mapped = arr.map((c: any) => ({
          id: c.Id ?? c.id,
          name: c.Name ?? c.name ?? `Campaign #${c.Id ?? c.id}`,
          aiModel: c.ai_model ?? c.aiModel ?? undefined,
          accountId: Number(c.Accounts_id ?? c.accounts_id ?? c.account_id ?? 0),
        }));
        // Filter to only campaigns belonging to this lead's account
        const filtered = leadAccountId
          ? mapped.filter((c) => c.accountId === leadAccountId)
          : mapped;
        setCampaigns(filtered.map(({ id, name, aiModel }) => ({ id, name, aiModel })));
      })
      .catch(() => {});
  }, [open, isAgencyPanel, leadAccountId]);

  // ── Linked conversation prompt name (agency only) — Prompt_Library is the
  //    source of truth, so resolve the prompt by the lead's campaign. ──
  const leadCampaignId = Number(lead?.campaignsId ?? lead?.campaigns_id ?? lead?.Campaigns_id ?? 0);
  const [prompts, setPrompts] = useState<{ campaignsId: number; name: string }[]>([]);
  useEffect(() => {
    if (!open || !isAgencyPanel) return;
    apiFetch("/api/prompts")
      .then((r) => r.ok ? r.json() : Promise.resolve([]))
      .then((data: any) => {
        const arr: any[] = Array.isArray(data) ? data : data?.list || data?.data || [];
        setPrompts(arr.map((p: any) => ({
          campaignsId: Number(p.campaigns_id ?? p.campaignsId ?? p.Campaigns_id ?? 0),
          name: p.name ?? p.Name ?? "",
        })));
      })
      .catch(() => {});
  }, [open, isAgencyPanel]);

  const promptName = useMemo(
    () => prompts.find((p) => p.campaignsId === leadCampaignId)?.name || undefined,
    [prompts, leadCampaignId],
  );
  const aiModel = useMemo(
    () => campaigns.find((c) => c.id === leadCampaignId)?.aiModel || undefined,
    [campaigns, leadCampaignId],
  );

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

          <LeadContactSection
            lead={lead}
            fullName={fullName}
            source={source}
            demoNicheCtx={demoNicheCtx}
            leadId={leadId}
            isAgencyPanel={isAgencyPanel}
            campaigns={campaigns}
            handleInlineFieldSave={handleInlineFieldSave}
            promptName={promptName}
            aiModel={aiModel}
          />

          <LeadStatusSection
            convStatus={convStatus}
            savingStatus={savingStatus}
            stageSaved={stageSaved}
            handleStageChange={handleStageChange}
            autoStatus={autoStatus}
            localManualTakeover={localManualTakeover}
            savingManualTakeover={savingManualTakeover}
            handleManualTakeoverChange={handleManualTakeoverChange}
          />

          {/* Lead Scores — arc + tier + detailed sub-score breakdown */}
          <LeadScoreSection
            panelScore={panelScore}
            scoreBreakdown={scoreBreakdown}
            scoreLoading={scoreLoading}
            demoNicheCtx={demoNicheCtx}
            lead={lead}
          />

          <LeadDncSection
            localOptedOut={localOptedOut}
            savingDnc={savingDnc}
            dncSaved={dncSaved}
            showDncReason={showDncReason}
            localDncReason={localDncReason}
            setLocalDncReason={setLocalDncReason}
            handleDncChange={handleDncChange}
            handleDncReasonSave={handleDncReasonSave}
          />

          <LeadBumpSection lead={lead} />

          <LeadActivitySection
            lead={lead}
            responseRate={responseRate}
            daysInactive={daysInactive}
          />

          <LeadBookingSection lead={lead} accountTimezone={accountTimezone} />

          <LeadAiInsightsSection lead={lead} localAiSummary={localAiSummary} />

          {/* Notes — editable + voice memo + AI notes */}
          <LeadNotesSection
            transcribing={transcribing}
            transcriptionFailed={transcriptionFailed}
            isRecordingVoice={isRecordingVoice}
            recordingSeconds={recordingSeconds}
            startVoiceRecording={startVoiceRecording}
            stopVoiceRecording={stopVoiceRecording}
            retryTranscription={retryTranscription}
            dismissFailedTranscription={dismissFailedTranscription}
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

          <LeadAssignmentSection lead={lead} convStatus={convStatus} priority={priority} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
