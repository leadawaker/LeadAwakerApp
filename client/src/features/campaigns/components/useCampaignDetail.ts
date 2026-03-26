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

  // ── Inline editing state ───────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [originalDraft, setOriginalDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const startEdit = useCallback((linkedPromptArg: any) => {
    const d: Record<string, unknown> = {
      name: campaign.name || "",
      status: campaign.status || "",
      type: campaign.type || "",
      description: campaign.description || "",
      start_date: campaign.start_date || "",
      end_date: campaign.end_date || "",
      active_hours_start: campaign.active_hours_start || "",
      active_hours_end: campaign.active_hours_end || "",
      daily_lead_limit: campaign.daily_lead_limit ?? "",
      message_interval_minutes: campaign.message_interval_minutes ?? "",
      stop_on_response: campaign.stop_on_response ?? false,
      use_ai_bumps: campaign.use_ai_bumps ?? false,
      first_message_voice_note: campaign.first_message_voice_note ?? false,
      bump_1_voice_note: campaign.bump_1_voice_note ?? false,
      bump_2_voice_note: campaign.bump_2_voice_note ?? false,
      bump_3_voice_note: campaign.bump_3_voice_note ?? false,
      ai_reply_voice_note: campaign.ai_reply_voice_note ?? false,
      tts_voice_id: campaign.tts_voice_id || "",
      max_bumps: campaign.max_bumps ?? "",
      ai_model: campaign.ai_model || "",
      ai_temperature: campaign.ai_temperature ?? "",
      agent_name: campaign.agent_name || "",
      service_name: campaign.service_name || "",
      booking_mode_override: campaign.booking_mode_override || "",
      niche_question: campaign.niche_question || "",
      what_lead_did: campaign.what_lead_did || "",
      inquiries_source: campaign.inquiries_source || "",
      website: campaign.website || "",
      calendar_link_override: campaign.calendar_link_override || campaign.calendar_link || "",
      campaign_usp: campaign.campaign_usp || "",
      prompt_linked_id: linkedPromptArg ? String(linkedPromptArg.id || linkedPromptArg.Id) : "",
      ai_prompt_template: campaign.ai_prompt_template || "",
      first_message_template: campaign.first_message_template || campaign.First_Message || "",
      second_message: campaign.second_message || "",
      bump_1_template: campaign.bump_1_template || "",
      bump_1_delay_hours: campaign.bump_1_delay_hours ?? "",
      bump_1_ai_reference: campaign.bump_1_ai_reference ?? false,
      bump_2_template: campaign.bump_2_template || "",
      bump_2_delay_hours: campaign.bump_2_delay_hours ?? "",
      bump_2_ai_reference: campaign.bump_2_ai_reference ?? false,
      bump_3_template: campaign.bump_3_template || "",
      bump_3_delay_hours: campaign.bump_3_delay_hours ?? "",
      bump_3_ai_reference: campaign.bump_3_ai_reference ?? false,
      contract_id: String(campaign.contract_id || (campaign as any).contract_id || ""),
      value_per_booking: campaign.value_per_booking ?? "",
      channel: campaign.channel || "sms",
    };
    setOriginalDraft(d);
    setDraft(d);
    setIsEditing(true);
  }, [campaign]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setDraft({});
    setOriginalDraft({});
  }, []);

  const hasChanges = useMemo(() => {
    if (!isEditing || Object.keys(originalDraft).length === 0) return false;
    return Object.keys(originalDraft).some(k =>
      JSON.stringify(draft[k]) !== JSON.stringify(originalDraft[k])
    );
  }, [draft, originalDraft, isEditing]);

  const handleSave = useCallback(async () => {
    const id = campaignRef.current.id || campaignRef.current.Id;
    if (!id) return;
    setSaving(true);
    try {
      // Handle prompt linking changes
      const prevPromptId = String(originalDraft.prompt_linked_id ?? "");
      const newPromptId = String(draft.prompt_linked_id ?? "");
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
          // Pull the latest prompts list to get prompt text
          const promptsRes = await apiFetch("/api/prompts");
          const promptsData = promptsRes.ok ? await promptsRes.json() : [];
          const allPrompts = Array.isArray(promptsData) ? promptsData : [];
          const selectedP = allPrompts.find((p: any) => String(p.id || p.Id) === newPromptId);
          if (selectedP) {
            draft.ai_prompt_template = selectedP.prompt_text || selectedP.promptText || "";
          }
        }
        reloadPrompts();
      }

      const { prompt_linked_id: _omit, ...rawPatch } = draft as any;
      const campaignPatch = Object.fromEntries(
        Object.entries(rawPatch).map(([k, v]) => [k, v === "" ? null : v])
      );
      await onSaveRef.current(id, campaignPatch);
      setIsEditing(false);
      setDraft({});
      setOriginalDraft({});
      toast({ title: t("toolbar.save"), description: "Campaign updated." });
    } catch (e) {
      console.error("Save failed", e);
      toast({ title: "Save failed", description: "Could not save changes.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [draft, originalDraft, reloadPrompts, toast, t]);

  return {
    // Prompts
    conversationPrompts,
    linkedPrompt,
    // Daily stats
    dailyStats,
    // Contract
    linkedContract,
    contractLoading,
    // AI summary
    localAiSummary,
    localAiSummaryAt,
    handleAiSummaryRefreshed,
    // Edit state
    isEditing,
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
  };
}
