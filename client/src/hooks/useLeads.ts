import { useMemo } from "react";
import useSWR from "swr";
import Papa from "papaparse";

export type CsvLead = {
  first_name: string;
  last_name: string;
  automation_status: string;
  Conversion_Status: string;
  leads_id: string;
  account_name: string;
  account_id: string;
  campaign_name: string;
  campaign_id: string;
  Created_time: string;
  Last_modified_time: string;
  phone: string;
  Email: string;
  Source: string;
  last_interaction_at: string;
  notes: string;
  booked_call_date: string;
  full_name: string;
  last_message_received_at: string;
  last_message_sent_at: string;
  message_count_sent: string;
  message_count_received: string;
  ai_memory: string;
  bump_1_sent_at: string;
  bump_2_sent_at: string;
  bump_3_sent_at: string;
  first_message_sent_at: string;
  next_action_at: string;
  current_bump_stage: string;
  timezone: string;
  ai_sentiment: string;
  opted_out: string;
  manual_takeover: string;
  dnc_reason: string;
  priority: string;
  language: string;
  time_zone: string;
  booking_confirmed_at: string;
  Text: string;
  booking_confirmation_sent: string;
  no_show: string;
  re_scheduled_count: string;
  what_has_the_lead_done: string;
  when: string;
  Text_2: string;
};

export type CsvConversation = {
  Who: string;
  account_id: string;
  account_name: string;
  campaign_id: string;
  campaign_name: string;
  lead_id: string;
  lead_name: string;
  type: string;
  direction: string;
  Content: string;
  status: string;
  twilio_message_sid: string;
  from_number: string;
  to_number: string;
  ai_generated: string;
  metadata: string;
  ai_prompt: string;
  ai_model: string;
  ai_response: string;
  ai_prompt_tokens: string;
  ai_completion_tokens: string;
  ai_total_tokens: string;
  ai_cost: string;
  sent_at: string;
  delivered_at: string;
  read_at: string;
  failed_at: string;
  bump_number: string;
  is_bump: string;
  triggered_by: string;
  Attachment: string;
  sentiment_score: string;
  interactions_id: string;
  agent_name: string;
};

export type Lead = {
  id: number;
  account_id: number;
  campaign_id: number;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  email: string;
  conversion_status: string;
  source: string;
  last_interaction_at: string;
  notes: string;
  booked_call_date: string | null;
  automation_status: string;
  last_message_sent_at: string | null;
  last_message_received_at: string | null;
  message_count_sent: number;
  message_count_received: number;
  ai_memory: string;
  bump_1_sent_at: string | null;
  bump_2_sent_at: string | null;
  bump_3_sent_at: string | null;
  first_message_sent_at: string | null;
  current_bump_stage: number;
  next_action_at: string | null;
  timezone: string;
  opted_out: boolean;
  ai_sentiment: string;
  priority: string;
  manual_takeover: boolean;
  dnc_reason: string;
  tags: string[];
};

type UseLeadsArgs = {
  accountId?: number | null;
  campaignId?: number | null;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.text();
};

function cleanHeader(h: string) {
  const raw = (h || "").replace(/^\uFEFF/, "").trim();
  return raw
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toBool(v: unknown) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

function toNum(v: unknown, fallback = 0) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function normalizeLeadRow(row: Record<string, any>): Lead {
  const id = toNum(row.leads_id || row.id, 0) || 0;
  const account_id = toNum(row.account_id, 0);
  const campaign_id = toNum(row.campaign_id, 0);

  const first = String(row.first_name ?? "").trim();
  const last = String(row.last_name ?? "").trim();
  const full = String(row.full_name ?? "").trim() || `${first} ${last}`.trim();
  const created_at = String(row.Created_time || row['Created time'] || '');
  const updated_at = String(row.Last_modified_time || row["Last modified time"] || created_at || "");

  const email = String(row.Email ?? "").trim();

  const conversion_status = String(row.Conversion_Status || row["Conversion Status"] || "").trim();
  const source = String(row.Source ?? "").trim();

  const last_interaction_at = String(row.last_interaction_at ?? "").trim();
  const notes = String(row.notes ?? "").trim();

  const booked_call_date_raw = String(row.booked_call_date ?? "").trim();
  const booked_call_date = booked_call_date_raw ? booked_call_date_raw : null;

  const last_message_received_at_raw = String(row.last_message_received_at ?? "").trim();
  const last_message_sent_at_raw = String(row.last_message_sent_at ?? "").trim();

  return {
    id,
    account_id,
    campaign_id,
    created_at,
    updated_at,
    first_name: first,
    last_name: last,
    full_name: full,
    phone: String(row.phone ?? "").trim(),
    email,
    conversion_status: conversion_status || "New",
    source: source || "Import",
    last_interaction_at,
    notes,
    booked_call_date,
    automation_status: String(row.automation_status ?? "").trim() || "queued",
    last_message_sent_at: last_message_sent_at_raw ? last_message_sent_at_raw : null,
    last_message_received_at: last_message_received_at_raw ? last_message_received_at_raw : null,
    message_count_sent: toNum(row.message_count_sent, 0),
    message_count_received: toNum(row.message_count_received, 0),
    ai_memory: String(row.ai_memory ?? "").trim(),
    bump_1_sent_at: String(row.bump_1_sent_at ?? "").trim() || null,
    bump_2_sent_at: String(row.bump_2_sent_at ?? "").trim() || null,
    bump_3_sent_at: String(row.bump_3_sent_at ?? "").trim() || null,
    first_message_sent_at: String(row.first_message_sent_at ?? "").trim() || null,
    current_bump_stage: toNum(row.current_bump_stage, 0),
    next_action_at: String(row.next_action_at ?? "").trim() || null,
    timezone: String(row.timezone || row.time_zone || "").trim(),
    opted_out: toBool(row.opted_out),
    ai_sentiment: String(row.ai_sentiment ?? "").trim(),
    priority: String(row.priority ?? "").trim() || "Medium",
    manual_takeover: toBool(row.manual_takeover),
    dnc_reason: String(row.dnc_reason ?? "").trim(),
    tags: [],
  };
}

function normalizeConversationRow(row: Record<string, any>) {
  return {
    id: toNum(row.interactions_id || row.id, 0),
    account_id: toNum(row.account_id, 0),
    campaign_id: toNum(row.campaign_id, 0),
    lead_id: toNum(row.lead_id, 0),
    created_at: String(row.sent_at ?? "").trim(),
    type: String(row.type ?? "").trim(),
    direction: String(row.direction ?? "").trim(),
    content: String(row.Content ?? "").trim(),
    status: String(row.status ?? "").trim(),
    who: String(row.Who ?? "").trim(),
    agent_name: String(row.agent_name ?? "").trim(),
  };
}

export function useLeads(args: UseLeadsArgs = {}) {
  const { data: leadsCsv, error: leadsErr } = useSWR("/CSV/Leads.csv", fetcher);
  const { data: convCsv, error: convErr } = useSWR("/CSV/Conversations.csv", fetcher);

  const { leads, interactions } = useMemo(() => {
    const parsedLeads = Papa.parse<Record<string, any>>(leadsCsv ?? "", {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => cleanHeader(h),
    });

    const parsedConv = Papa.parse<Record<string, any>>(convCsv ?? "", {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => cleanHeader(h),
    });

    const leads = (parsedLeads.data ?? [])
      .map(normalizeLeadRow)
      .filter((l) => l.id);

    const interactions = (parsedConv.data ?? [])
      .map(normalizeConversationRow)
      .filter((x) => x.id);

    return { leads, interactions };
  }, [leadsCsv, convCsv]);

  const filtered = useMemo(() => {
    return leads
      .filter((l) => (args.accountId ? l.account_id === args.accountId : true))
      .filter((l) => (args.campaignId ? l.campaign_id === args.campaignId : true));
  }, [leads, args.accountId, args.campaignId]);

  return {
    leads: filtered,
    interactions,
    isLoading: !leadsCsv && !leadsErr,
    error: (leadsErr || convErr) as unknown,
  };
}
