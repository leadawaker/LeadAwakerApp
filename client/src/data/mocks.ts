export type Account = {
  id: number;
  created_at: string;
  updated_at: string;
  name: string;
  slug: string;
  type: "Agency" | "Enterprise" | "Starter";
  status: "Active" | "Inactive" | "Suspended" | "Trial";
  timezone: string;
  notes: string;
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_messaging_service_sid: string;
  twilio_default_from_number: string;
  business_hours_start: string;
  business_hours_end: string;
  max_daily_sends: number;
  ai_model_default: "gpt-4" | "gpt-3.5-turbo" | "claude-3";
  owner_email: string;
};

export type Campaign = {
  id: number;
  account_id: number;
  created_at: string;
  updated_at: string;
  name: string;
  status: "Draft" | "Active" | "Paused" | "Completed" | "Archived";
  type: "Cold Outreach" | "Re-engagement" | "Follow-up" | "Event";
  description: string;
  start_date: string;
  end_date: string;
  n8n_workflow_id: string;
  ai_prompt_template: string;
  total_cost: number;
  first_message_template: string;
  bump_1_template: string;
  bump_2_template: string;
  bump_3_template: string;
  bump_1_delay_hours: number;
  bump_2_delay_hours: number;
  bump_3_delay_hours: number;
  daily_lead_limit: number;
  message_interval_minutes: number;
  active_hours_start: string;
  active_hours_end: string;
  calendar_link: string;
  webhook_url: string;
  ai_model: "gpt-4" | "gpt-3.5-turbo" | "claude-3";
  ai_temperature: number;
  use_ai_bumps: boolean;
  max_bumps: number;
  stop_on_response: boolean;
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
  phone_normalized: string;
  email: string;
  conversion_status:
    | "New"
    | "Contacted"
    | "Responded"
    | "Multiple Responses"
    | "Qualified"
    | "Booked"
    | "Lost"
    | "DND";
  source: "Manual Upload" | "Facebook" | "Google" | "Referral" | "API" | "Import";
  last_interaction_at: string;
  notes: string;
  booked_call_date: string | null;
  automation_status: "queued" | "active" | "paused" | "completed" | "dnd" | "error";
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
  ai_sentiment: "Positive" | "Neutral" | "Negative" | "Unknown";
  priority: "Low" | "Medium" | "High" | "Urgent";
  manual_takeover: boolean;
  dnc_reason: string;
  custom_field_1: string;
  custom_field_2: string;
  custom_field_3: string;
};

export type Interaction = {
  id: number;
  account_id: number;
  campaign_id: number;
  lead_id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  type: "SMS" | "WhatsApp" | "Email" | "Call" | "Note";
  direction: "Inbound" | "Outbound";
  content: string;
  status: "queued" | "sending" | "sent" | "delivered" | "failed" | "read";
  twilio_message_sid: string;
  from_number: string;
  to_number: string;
  metadata: string;
  ai_generated: boolean;
  ai_model: string;
  ai_prompt: string;
  ai_response: string;
};

export const MOCK_AGENCY_USER = {
  id: 1,
  account_id: 1,
  email: "leadawaker@gmail.com",
  role: "Admin" as const,
  isAgency: true,
};

export const accounts: Account[] = [
  {
    id: 1,
    created_at: "2026-01-01T10:00:00Z",
    updated_at: "2026-01-29T10:00:00Z",
    name: "LeadAwaker",
    slug: "leadawaker",
    type: "Agency",
    status: "Active",
    timezone: "Europe/Amsterdam",
    notes: "Agency prototype account (hardcoded).",
    twilio_account_sid: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    twilio_auth_token: "********************************",
    twilio_messaging_service_sid: "MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    twilio_default_from_number: "+31612345678",
    business_hours_start: "09:00",
    business_hours_end: "17:00",
    max_daily_sends: 500,
    ai_model_default: "gpt-4",
    owner_email: "leadawaker@gmail.com",
  },
];

export const campaigns: Campaign[] = [
  {
    id: 1,
    account_id: 1,
    created_at: "2026-01-05T09:00:00Z",
    updated_at: "2026-01-29T09:00:00Z",
    name: "Gym Reactivation - January",
    status: "Active",
    type: "Re-engagement",
    description: "Re-activate stale gym leads from last 90 days.",
    start_date: "2026-01-10",
    end_date: "2026-02-10",
    n8n_workflow_id: "n8n_workflow_001",
    ai_prompt_template: "You are a helpful sales rep...",
    total_cost: 127.35,
    first_message_template: "Hey {{first_name}}, quick question...",
    bump_1_template: "Just bumping this up...",
    bump_2_template: "No worries if now isn't the time...",
    bump_3_template: "Last ping — should I close your file?",
    bump_1_delay_hours: 24,
    bump_2_delay_hours: 24,
    bump_3_delay_hours: 24,
    daily_lead_limit: 100,
    message_interval_minutes: 2,
    active_hours_start: "09:00",
    active_hours_end: "17:00",
    calendar_link: "https://cal.example.com/leadawaker",
    webhook_url: "https://n8n.example.com/webhook/leadawaker",
    ai_model: "gpt-4",
    ai_temperature: 0.7,
    use_ai_bumps: true,
    max_bumps: 3,
    stop_on_response: true,
  },
];

function iso(d: Date) {
  return d.toISOString();
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

const leadFirst = [
  "Alex",
  "Jordan",
  "Taylor",
  "Morgan",
  "Casey",
  "Riley",
  "Jamie",
  "Cameron",
  "Avery",
  "Parker",
];
const leadLast = ["Smith", "Johnson", "Brown", "Miller", "Davis", "Wilson", "Moore", "Clark"];

const statuses: Lead["conversion_status"][] = [
  "New",
  "Contacted",
  "Responded",
  "Qualified",
  "Booked",
  "Lost",
  "DND",
];

const sentiments: Lead["ai_sentiment"][] = ["Positive", "Neutral", "Negative", "Unknown"];
const priorities: Lead["priority"][] = ["Low", "Medium", "High", "Urgent"];
const sources: Lead["source"][] = ["Manual Upload", "Facebook", "Google", "Referral", "API", "Import"];
const automation: Lead["automation_status"][] = ["queued", "active", "paused", "completed", "dnd", "error"];

export const leads: Lead[] = Array.from({ length: 20 }).map((_, idx) => {
  const id = idx + 1;
  const first_name = pick(leadFirst, idx);
  const last_name = pick(leadLast, idx);
  const created = new Date(Date.now() - (18 - idx) * 24 * 3600 * 1000);
  const updated = new Date(created.getTime() + 6 * 3600 * 1000);

  const phone = `+31 6 ${String(1200 + idx).padStart(4, "0")} ${String(5600 + idx).padStart(4, "0")}`;
  const phone_normalized = `+316${String(12005600 + idx).padStart(8, "0")}`;

  const conversion_status = pick(statuses, idx);
  const hasRecentInbound = conversion_status === "Responded" || conversion_status === "Multiple Responses";

  return {
    id,
    account_id: 1,
    campaign_id: 1,
    created_at: iso(created),
    updated_at: iso(updated),
    first_name,
    last_name,
    full_name: `${first_name} ${last_name}`,
    phone,
    phone_normalized,
    email: `${first_name.toLowerCase()}.${last_name.toLowerCase()}@example.com`,
    conversion_status,
    source: pick(sources, idx),
    last_interaction_at: iso(new Date(Date.now() - (5 - (idx % 5)) * 3600 * 1000)),
    notes: idx % 4 === 0 ? "Asked about pricing" : idx % 4 === 1 ? "Prefer mornings" : "",
    booked_call_date: conversion_status === "Booked" ? iso(new Date(Date.now() + 2 * 24 * 3600 * 1000)) : null,
    automation_status: pick(automation, idx),
    last_message_sent_at: iso(new Date(Date.now() - (idx % 6) * 3600 * 1000)),
    last_message_received_at: hasRecentInbound ? iso(new Date(Date.now() - ((idx % 4) + 1) * 3600 * 1000)) : null,
    message_count_sent: 2 + (idx % 6),
    message_count_received: hasRecentInbound ? 1 + (idx % 3) : 0,
    ai_memory: JSON.stringify({ last_intent: idx % 3 === 0 ? "price" : "schedule", objections: [] }),
    bump_1_sent_at: idx % 3 === 0 ? iso(new Date(Date.now() - 48 * 3600 * 1000)) : null,
    bump_2_sent_at: idx % 5 === 0 ? iso(new Date(Date.now() - 24 * 3600 * 1000)) : null,
    bump_3_sent_at: null,
    first_message_sent_at: iso(new Date(Date.now() - 72 * 3600 * 1000)),
    current_bump_stage: idx % 6 === 0 ? 2 : idx % 4 === 0 ? 1 : 0,
    next_action_at: iso(new Date(Date.now() + (idx % 6) * 3600 * 1000)),
    timezone: "Europe/Amsterdam",
    opted_out: conversion_status === "DND",
    ai_sentiment: pick(sentiments, idx),
    priority: pick(priorities, idx),
    manual_takeover: idx % 10 === 0,
    dnc_reason: conversion_status === "DND" ? "User opted out" : "",
    custom_field_1: idx % 2 === 0 ? "facebook_ad_12" : "",
    custom_field_2: idx % 3 === 0 ? "variant_a" : "",
    custom_field_3: "",
  };
});

const interactionTypes: Interaction["type"][] = ["SMS", "WhatsApp", "Email", "Call", "Note"];
const interactionStatus: Interaction["status"][] = ["queued", "sending", "sent", "delivered", "failed", "read"];

export const interactions: Interaction[] = Array.from({ length: 50 }).map((_, idx) => {
  const id = idx + 1;
  const lead_id = (idx % 20) + 1;
  const direction: Interaction["direction"] = idx % 3 === 0 ? "Inbound" : "Outbound";
  const created = new Date(Date.now() - (50 - idx) * 30 * 60 * 1000);

  const lead = leads[lead_id - 1];
  const content =
    direction === "Outbound"
      ? pick(
          [
            "Hey {{first_name}} — quick question: are you still interested in getting this scheduled?",
            "Totally fair. Want me to send available times?",
            "If it helps, we can do a 10-min call today.",
            "No worries — should I close this out?",
            "Just checking if you saw this.",
          ],
          idx,
        ).replace("{{first_name}}", lead.first_name)
      : pick(
          [
            "Yes, but I'm busy this week.",
            "How much is it?",
            "Can you text me tomorrow morning?",
            "Stop messaging me.",
            "Ok, send me the link.",
          ],
          idx,
        );

  return {
    id,
    account_id: 1,
    campaign_id: 1,
    lead_id,
    user_id: 1,
    created_at: iso(created),
    updated_at: iso(new Date(created.getTime() + 5 * 60 * 1000)),
    type: pick(interactionTypes, idx),
    direction,
    content,
    status: pick(interactionStatus, idx),
    twilio_message_sid: `SM${String(100000 + idx)}`,
    from_number: direction === "Outbound" ? "+31612345678" : lead.phone,
    to_number: direction === "Outbound" ? lead.phone : "+31612345678",
    metadata: JSON.stringify({ campaign: 1, lead_id }),
    ai_generated: direction === "Outbound" && idx % 2 === 0,
    ai_model: direction === "Outbound" ? "gpt-4" : "",
    ai_prompt: direction === "Outbound" ? "Generate a friendly follow up" : "",
    ai_response: direction === "Outbound" ? "(mock)" : "",
  };
});
