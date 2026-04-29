/**
 * useCampaignDetail
 *
 * Data-fetching and mutation logic extracted from CampaignDetailView.
 * Covers: prompt library, daily capacity stats, linked contract, inline
 * edit state management (draft, save, cancel).
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiUtils";
import type { Campaign } from "@/types/models";

// ── Contract type (minimal, for financials) ──────────────────────────────────

export interface ContractFinancials {
  id: number;
  title: string | null;
  deal_type: string | null;
  value_per_booking: number | null;
  payment_trigger: string | null;
  monthly_fee: number | null;
  fixed_fee_amount: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getCampaignMetrics(
  campaign: Campaign,
  cMetrics: import("@/types/models").CampaignMetricsHistory[]
) {
  const directLeads = Number(campaign.total_leads_targeted) || 0;
  const directMessages = Number(campaign.total_messages_sent) || 0;
  const directResponseRate = Number(campaign.response_rate_percent) || 0;
  const directBookingRate = Number(campaign.booking_rate_percent) || 0;

  if (directLeads > 0 || directMessages > 0 || directResponseRate > 0 || directBookingRate > 0) {
    return {
      totalLeadsTargeted: directLeads,
      totalMessagesSent: directMessages,
      responseRate: directResponseRate,
      bookingRate: directBookingRate,
      totalCost: Number(campaign.total_cost) || 0,
      costPerLead: Number(campaign.cost_per_lead) || 0,
      costPerBooking: Number(campaign.cost_per_booking) || 0,
      roiPercent: Number(campaign.roi_percent) || 0,
      bookings: directLeads > 0 ? Math.round(directLeads * directBookingRate / 100) : 0,
    };
  }

  if (cMetrics.length === 0) {
    return {
      totalLeadsTargeted: 0,
      totalMessagesSent: 0,
      responseRate: null as number | null,
      bookingRate: null as number | null,
      totalCost: null as number | null,
      costPerLead: null as number | null,
      costPerBooking: null as number | null,
      roiPercent: null as number | null,
      bookings: 0,
    };
  }

  const sorted = [...cMetrics].sort((a, b) =>
    (b.metric_date || "").localeCompare(a.metric_date || "")
  );
  const latest = sorted[0];
  const totalLeadsTargeted = cMetrics.reduce((s, m) => s + (m.total_leads_targeted || 0), 0);
  const totalMessagesSent = cMetrics.reduce((s, m) => s + (m.total_messages_sent || 0), 0);
  const totalCost = cMetrics.reduce((s, m) => s + (Number(m.total_cost) || 0), 0);
  const bookingRateVal = Number(latest.booking_rate_percent) || 0;
  const bookings = totalLeadsTargeted > 0 ? Math.round(totalLeadsTargeted * bookingRateVal / 100) : 0;

  return {
    totalLeadsTargeted,
    totalMessagesSent,
    responseRate: Number(latest.response_rate_percent) || 0,
    bookingRate: bookingRateVal,
    totalCost,
    costPerLead: Number(latest.cost_per_lead) || 0,
    costPerBooking: Number(latest.cost_per_booking) || 0,
    roiPercent: Number(latest.roi_percent) || 0,
    bookings,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCampaignDetail(campaign: Campaign, onSave: (id: number, patch: Record<string, unknown>) => Promise<void>) {
  const { t } = useTranslation("campaigns");
  const { toast } = useToast();

  const campaignId = campaign.id || (campaign as any).Id;

  // ── Stable refs ────────────────────────────────────────────────────────────
  const campaignRef = useRef(campaign);
  campaignRef.current = campaign;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // ── Linked prompt ──────────────────────────────────────────────────────────
  const [conversationPrompts, setConversationPrompts] = useState<any[]>([]);

  const reloadPrompts = useCallback(() => {
    apiFetch("/api/prompts")
      .then((r) => r.ok ? r.json() : [])
      .then((data: any[]) => {
        setConversationPrompts(
          Array.isArray(data) ? data.filter((p) => (p.use_case || p.useCase || "").toLowerCase() === "conversation") : []
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    reloadPrompts();
  }, [reloadPrompts]);

  const linkedPrompt = useMemo(() => {
    const cid = campaign.id || (campaign as any).Id;
    return conversationPrompts.find((p) => Number(p.campaigns_id || p.campaignsId || p.Campaigns_id) === cid) ?? null;
  }, [conversationPrompts, campaign.id, (campaign as any).Id]);

  // ── Daily capacity stats ───────────────────────────────────────────────────
  const [dailyStats, setDailyStats] = useState<{ sentToday: number; dailyLimit: number; channel: string } | null>(null);
  useEffect(() => {
    const id = campaign.id || (campaign as any).Id;
    if (!id) return;
    apiFetch(`/api/campaigns/${id}/daily-stats`)
      .then((r) => r.json())
      .then(setDailyStats)
      .catch(() => {});
  }, [campaign.id, (campaign as any).Id]);

  // ── Linked contract ────────────────────────────────────────────────────────
  const [linkedContract, setLinkedContract] = useState<ContractFinancials | null>(null);
  const [contractLoading, setContractLoading] = useState(false);

  useEffect(() => {
    const contractId = campaign.contract_id ?? (campaign as any).contract_id;
    if (!contractId) {
      setLinkedContract(null);
      return;
    }
    setContractLoading(true);
    apiFetch(`/api/contracts/${contractId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setLinkedContract(data ?? null))
      .catch(() => setLinkedContract(null))
      .finally(() => setContractLoading(false));
  }, [campaign.contract_id, (campaign as any).contract_id]);

  // ── AI token usage + cost (for financials widget) ──────────────────────────
  const [aiCosts, setAiCosts] = useState<{ aiTokens: number; aiCostUsd: number } | null>(null);
  useEffect(() => {
    const id = campaign.id || (campaign as any).Id;
    if (!id) return;
    apiFetch(`/api/campaigns/${id}/ai-costs`)
      .then((r) => r.json())
      .then(setAiCosts)
      .catch(() => {});
  }, [campaign.id, (campaign as any).Id]);

  // ── Local AI summary state ─────────────────────────────────────────────────
  const [localAiSummary, setLocalAiSummary] = useState<string | null>(campaign.ai_summary ?? null);
  const [localAiSummaryAt, setLocalAiSummaryAt] = useState<string | null>(campaign.ai_summary_generated_at ?? null);
  useEffect(() => {
    setLocalAiSummary(campaign.ai_summary ?? null);
    setLocalAiSummaryAt(campaign.ai_summary_generated_at ?? null);
  }, [campaignId, campaign.ai_summary, campaign.ai_summary_generated_at]);

  const handleAiSummaryRefreshed = useCallback((summary: string, generatedAt: string) => {
    setLocalAiSummary(summary);
    setLocalAiSummaryAt(generatedAt);
  }, []);

  // ── Always-on editing state (auto-save on change) ──────────────────────────
  const [focusField, setFocusField] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Build draft from campaign data
  const buildDraft = useCallback((c: Campaign, lp: any): Record<string, unknown> => ({
    name: c.name || "",
    status: c.status || "",
    type: c.type || "",
    description: c.description || "",
    start_date: c.start_date || "",
    end_date: c.end_date || "",
    active_hours_start: c.active_hours_start || "",
    active_hours_end: c.active_hours_end || "",
    daily_lead_limit: c.daily_lead_limit ?? "",
    message_interval_minutes: c.message_interval_minutes ?? "",
    stop_on_response: c.stop_on_response ?? false,
    use_ai_bumps: c.use_ai_bumps ?? false,
    first_message_voice_note: c.first_message_voice_note ?? false,
    bump_1_voice_note: c.bump_1_voice_note ?? false,
    bump_2_voice_note: c.bump_2_voice_note ?? false,
    bump_3_voice_note: c.bump_3_voice_note ?? false,
    bump_4_voice_note: c.bump_4_voice_note ?? false,
    ai_reply_voice_note: c.ai_reply_voice_note ?? false,
    voice_reply_mode: c.voice_reply_mode || "off",
    tts_voice_id: c.tts_voice_id || "",
    max_bumps: c.max_bumps ?? "",
    ai_model: c.ai_model || "",
    ai_temperature: c.ai_temperature ?? "",
    agent_name: c.agent_name || "",
    service_name: c.service_name || "",
    booking_mode_override: c.booking_mode_override || "",
    niche_question: c.niche_question || "",
    what_lead_did: c.what_lead_did || "",
    inquiries_source: c.inquiries_source || "",
    website: c.website || "",
    calendar_link_override: c.calendar_link_override || c.calendar_link || "",
    campaign_usp: c.campaign_usp || "",
    kb: c.kb || "",
    prompt_linked_id: lp ? String(lp.id || lp.Id) : "",
    First_Message: c.First_Message || c.first_message_template || "",
    bump_1_template: c.bump_1_template || "",
    bump_1_delay_hours: c.bump_1_delay_hours ?? "",
    bump_1_ai_reference: c.bump_1_ai_reference ?? false,
    bump_1_voice_template: c.bump_1_voice_template || "",
    bump_2_template: c.bump_2_template || "",
    bump_2_delay_hours: c.bump_2_delay_hours ?? "",
    bump_2_ai_reference: c.bump_2_ai_reference ?? false,
    bump_2_voice_template: c.bump_2_voice_template || "",
    bump_3_template: c.bump_3_template || "",
    bump_3_delay_hours: c.bump_3_delay_hours ?? "",
    bump_3_ai_reference: c.bump_3_ai_reference ?? false,
    bump_3_voice_template: c.bump_3_voice_template || "",
    bump_4_template: c.bump_4_template || "",
    bump_4_delay_hours: c.bump_4_delay_hours ?? "",
    bump_4_voice_template: c.bump_4_voice_template || "",
    contract_id: String(c.contract_id || (c as any).contract_id || ""),
    value_per_booking: c.value_per_booking ?? "",
    channel: c.channel || "sms",
    company_name: c.company_name || "",
    demo_client_name: c.demo_client_name || "",
    language: c.language || "",
    is_demo: c.is_demo ?? false,
    opt_out_notice: c.opt_out_notice ?? false,
    ab_enabled: c.ab_enabled ?? false,
    ab_split_ratio: c.ab_split_ratio ?? 50,
    ai_role: (c as any).ai_role || "",
    ai_style_override: (c as any).ai_style_override || "",
    niche: (c as any).niche || "",
    inquiry_timeframe: (c as any).inquiry_timeframe || "",
    typo_count: (c as any).typo_count ?? "",
  }), []);

  const [draft, setDraft] = useState<Record<string, unknown>>(() => buildDraft(campaign, linkedPrompt));
  const [originalDraft, setOriginalDraft] = useState<Record<string, unknown>>(() => buildDraft(campaign, linkedPrompt));

  // Track prev campaign ID so we can flush saves with the correct ID on switch
  const prevCampaignIdRef = useRef(campaignId);

  // Re-sync draft when campaign changes — flush any pending save first
  useEffect(() => {
    if (autoSaveTimer.current && prevCampaignIdRef.current !== campaignId) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
      // Flush save for the PREVIOUS campaign using stale draft/original refs
      const currentDraft = draftRef.current;
      const currentOriginal = originalDraftRef.current;
      const prevId = prevCampaignIdRef.current;
      const changed = Object.keys(currentOriginal).some(k =>
        JSON.stringify(currentDraft[k]) !== JSON.stringify(currentOriginal[k])
      );
      if (changed && prevId) {
        const { prompt_linked_id: _omit, ...rawPatch } = currentDraft as any;
        const campaignPatch = Object.fromEntries(
          Object.entries(rawPatch).map(([k, v]: [string, unknown]) => [k, v === "" ? null : v])
        );
        onSaveRef.current(prevId, campaignPatch);
      }
    }
    prevCampaignIdRef.current = campaignId;
    const d = buildDraft(campaign, linkedPrompt);
    setDraft(d);
    setOriginalDraft(d);
    setFocusField(null);
  }, [campaignId, buildDraft]);

  // Stable refs for auto-save
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const originalDraftRef = useRef(originalDraft);
  originalDraftRef.current = originalDraft;

  // Always in edit mode
  const isEditing = true;

  const hasChanges = useMemo(() => {
    if (Object.keys(originalDraft).length === 0) return false;
    return Object.keys(originalDraft).some(k =>
      JSON.stringify(draft[k]) !== JSON.stringify(originalDraft[k])
    );
  }, [draft, originalDraft]);

  // Auto-save debounced 1.5s after draft changes
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (Object.keys(originalDraftRef.current).length === 0) return;
    const changed = Object.keys(originalDraftRef.current).some(k =>
      JSON.stringify(draftRef.current[k]) !== JSON.stringify(originalDraftRef.current[k])
    );
    if (!changed) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { doSave(); }, 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [draft]);

  const doSave = useCallback(async () => {
    const currentDraft = draftRef.current;
    const currentOriginal = originalDraftRef.current;
    const id = campaignRef.current.id || campaignRef.current.Id;
    if (!id) return;
    setSaving(true);
    try {
      // Handle prompt linking changes
      const prevPromptId = String(currentOriginal.prompt_linked_id ?? "");
      const newPromptId = String(currentDraft.prompt_linked_id ?? "");
      if (newPromptId !== prevPromptId) {
        if (prevPromptId) {
          await apiFetch(`/api/prompts/${prevPromptId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaignsId: null }),
          });
        }
        if (newPromptId) {
          await apiFetch(`/api/prompts/${newPromptId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaignsId: id }),
          });
        }
        reloadPrompts();
      }

      const { prompt_linked_id: _omit, ...rawPatch } = currentDraft as any;
      const campaignPatch = Object.fromEntries(
        Object.entries(rawPatch).map(([k, v]) => [k, v === "" ? null : v])
      );
      await onSaveRef.current(id, campaignPatch);
      setOriginalDraft({ ...currentDraft });
    } catch (e) {
      console.error("Auto-save failed", e);
      toast({ title: "Save failed", description: "Could not save changes.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [reloadPrompts, toast]);

  // Legacy compat stubs (keep API surface stable)
  const startEdit = useCallback((_linkedPromptArg?: any) => {}, []);
  const startEditForField = useCallback((field: string) => { setFocusField(field); }, []);
  const cancelEdit = useCallback(() => { setFocusField(null); }, []);
  const handleSave = doSave;

  return {
    // Prompts
    conversationPrompts,
    linkedPrompt,
    // Daily stats
    dailyStats,
    // Contract
    linkedContract,
    contractLoading,
    // AI costs
    aiCosts,
    // AI summary
    localAiSummary,
    localAiSummaryAt,
    handleAiSummaryRefreshed,
    // Edit state
    isEditing,
    focusField,
    startEditForField,
    deleteConfirm,
    setDeleteConfirm,
    deleting,
    setDeleting,
    draft,
    setDraft,
    saving,
    hasChanges,
    startEdit,
    cancelEdit,
    handleSave,
    reloadPrompts,
  };
}
