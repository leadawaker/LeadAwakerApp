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
  tags: string[];
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

export type AutomationLog = {
  id: number;
  account_id: number;
  campaign_id: number;
  lead_id: number;
  created_at: string;
  status: "success" | "error" | "skipped" | "running";
  error_message: string;
  execution_time_ms: number;
  stage: string;
};

export type AppUser = {
  id: number;
  account_id: number;
  email: string;
  role: "Admin" | "Manager" | "Agent";
  last_login_at: string;
};

export type TagItem = {
  id: number;
  account_id: number;
  name: string;
};

export type PromptItem = {
  id: number;
  account_id: number;
  name: string;
  use_case: string;
  model: string;
  performance_score: number;
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
    name: "LeadAwaker Agency",
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
  {
    id: 2,
    created_at: "2026-01-02T10:00:00Z",
    updated_at: "2026-01-29T10:00:00Z",
    name: "FitnessGym ABC",
    slug: "fitnessgym-abc",
    type: "Enterprise",
    status: "Active",
    timezone: "Europe/Amsterdam",
    notes: "Mock client account.",
    twilio_account_sid: "ACfitnessgymxxxxxxxxxxxxxxxxxxxxxx",
    twilio_auth_token: "********************************",
    twilio_messaging_service_sid: "MGfitnessgymxxxxxxxxxxxxxxxxxxxxxx",
    twilio_default_from_number: "+31670000001",
    business_hours_start: "08:00",
    business_hours_end: "18:00",
    max_daily_sends: 250,
    ai_model_default: "gpt-4",
    owner_email: "owner@fitnessgymabc.com",
  },
  {
    id: 3,
    created_at: "2026-01-03T10:00:00Z",
    updated_at: "2026-01-29T10:00:00Z",
    name: "LawFirm XYZ",
    slug: "lawfirm-xyz",
    type: "Enterprise",
    status: "Active",
    timezone: "Europe/Amsterdam",
    notes: "Mock client account.",
    twilio_account_sid: "AClawfirmxxxxxxxxxxxxxxxxxxxxxxxxx",
    twilio_auth_token: "********************************",
    twilio_messaging_service_sid: "MGlawfirmxxxxxxxxxxxxxxxxxxxxxxxxx",
    twilio_default_from_number: "+31670000002",
    business_hours_start: "09:00",
    business_hours_end: "17:00",
    max_daily_sends: 250,
    ai_model_default: "gpt-4",
    owner_email: "owner@lawfirmxyz.com",
  },
];

export const campaigns: Campaign[] = [
  {
    id: 11,
    account_id: 2,
    created_at: "2026-01-05T09:00:00Z",
    updated_at: "2026-01-29T09:00:00Z",
    name: "Gym Reactivation - January",
    status: "Active",
    type: "Re-engagement",
    description: "Re-activate stale gym leads from last 90 days.",
    start_date: "2026-01-10",
    end_date: "2026-02-10",
    n8n_workflow_id: "n8n_workflow_001",
    ai_prompt_template: "You are a helpful sales rep. Qualify the lead, answer questions, and push to book a call.",
    total_cost: 127.35,
    first_message_template: "Hey {{first_name}}, quick question — still looking to get back to training?",
    bump_1_template: "Just bumping this up — want me to send available times?",
    bump_2_template: "No worries if now isn't the time. Want to pause outreach?",
    bump_3_template: "Last ping — should I close your file?",
    bump_1_delay_hours: 24,
    bump_2_delay_hours: 24,
    bump_3_delay_hours: 24,
    daily_lead_limit: 100,
    message_interval_minutes: 2,
    active_hours_start: "09:00",
    active_hours_end: "17:00",
    calendar_link: "https://cal.example.com/fitnessgym",
    webhook_url: "https://n8n.example.com/webhook/fitnessgym",
    ai_model: "gpt-4",
    ai_temperature: 0.7,
    use_ai_bumps: true,
    max_bumps: 3,
    stop_on_response: true,
  },
  {
    id: 12,
    account_id: 2,
    created_at: "2026-01-06T09:00:00Z",
    updated_at: "2026-01-29T09:00:00Z",
    name: "PT Upsell - Winter",
    status: "Active",
    type: "Follow-up",
    description: "Upsell personal training packages to recent signups.",
    start_date: "2026-01-12",
    end_date: "2026-02-20",
    n8n_workflow_id: "n8n_workflow_002",
    ai_prompt_template: "Be concise, friendly, and ask qualifying questions. Offer a booking link.",
    total_cost: 64.22,
    first_message_template: "Hey {{first_name}} — want a quick plan review call this week?",
    bump_1_template: "Quick bump — morning or afternoon works better?",
    bump_2_template: "If you'd like, I can send the calendar link.",
    bump_3_template: "Closing this out unless you reply.",
    bump_1_delay_hours: 24,
    bump_2_delay_hours: 24,
    bump_3_delay_hours: 24,
    daily_lead_limit: 80,
    message_interval_minutes: 3,
    active_hours_start: "09:00",
    active_hours_end: "17:00",
    calendar_link: "https://cal.example.com/fitnessgym",
    webhook_url: "https://n8n.example.com/webhook/fitnessgym2",
    ai_model: "gpt-4",
    ai_temperature: 0.7,
    use_ai_bumps: true,
    max_bumps: 3,
    stop_on_response: true,
  },
  {
    id: 21,
    account_id: 3,
    created_at: "2026-01-07T09:00:00Z",
    updated_at: "2026-01-29T09:00:00Z",
    name: "Case Intake - January",
    status: "Active",
    type: "Cold Outreach",
    description: "Qualify inbound legal inquiries and book a consultation.",
    start_date: "2026-01-11",
    end_date: "2026-02-15",
    n8n_workflow_id: "n8n_workflow_003",
    ai_prompt_template: "You are an intake assistant. Ask the right questions, qualify, and schedule a consultation.",
    total_cost: 98.7,
    first_message_template: "Hi {{first_name}} — thanks for reaching out. What’s the best time to talk?",
    bump_1_template: "Just checking — do you want to schedule a consult?",
    bump_2_template: "If you prefer, I can send the calendar link.",
    bump_3_template: "Last ping — closing your request unless you reply.",
    bump_1_delay_hours: 24,
    bump_2_delay_hours: 24,
    bump_3_delay_hours: 24,
    daily_lead_limit: 120,
    message_interval_minutes: 2,
    active_hours_start: "09:00",
    active_hours_end: "17:00",
    calendar_link: "https://cal.example.com/lawfirm",
    webhook_url: "https://n8n.example.com/webhook/lawfirm",
    ai_model: "gpt-4",
    ai_temperature: 0.6,
    use_ai_bumps: true,
    max_bumps: 3,
    stop_on_response: true,
  },
  {
    id: 22,
    account_id: 3,
    created_at: "2026-01-08T09:00:00Z",
    updated_at: "2026-01-29T09:00:00Z",
    name: "Re-engage Old Leads",
    status: "Active",
    type: "Re-engagement",
    description: "Re-open conversations with old legal leads.",
    start_date: "2026-01-14",
    end_date: "2026-02-28",
    n8n_workflow_id: "n8n_workflow_004",
    ai_prompt_template: "Be professional. Verify need, then offer consult booking.",
    total_cost: 55.35,
    first_message_template: "Hi {{first_name}} — still need help with your case?",
    bump_1_template: "Quick follow-up — want to chat this week?",
    bump_2_template: "I can send a consultation calendar link.",
    bump_3_template: "Closing this thread unless you reply.",
    bump_1_delay_hours: 24,
    bump_2_delay_hours: 24,
    bump_3_delay_hours: 24,
    daily_lead_limit: 60,
    message_interval_minutes: 4,
    active_hours_start: "09:00",
    active_hours_end: "17:00",
    calendar_link: "https://cal.example.com/lawfirm",
    webhook_url: "https://n8n.example.com/webhook/lawfirm2",
    ai_model: "gpt-4",
    ai_temperature: 0.6,
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
  "Sam",
  "Drew",
  "Kris",
  "Robin",
];
const leadLast = ["Smith", "Johnson", "Brown", "Miller", "Davis", "Wilson", "Moore", "Clark", "Lewis"];

const statuses: Lead["conversion_status"][] = [
  "New",
  "Contacted",
  "Responded",
  "Multiple Responses",
  "Qualified",
  "Booked",
  "Lost",
  "DND",
];

const sentiments: Lead["ai_sentiment"][] = ["Positive", "Neutral", "Negative", "Unknown"];
const priorities: Lead["priority"][] = ["Low", "Medium", "High", "Urgent"];
const sources: Lead["source"][] = ["Manual Upload", "Facebook", "Google", "Referral", "API", "Import"];
const automation: Lead["automation_status"][] = ["queued", "active", "paused", "completed", "dnd", "error"];

const tagPool = [
  "New",
  "Hot",
  "Follow-up",
  "Pricing",
  "Booked",
  "No-show risk",
  "High intent",
  "Needs details",
];

// Distribution to follow a funnel pattern (more at the start, tapering down)
const leadsPerStage: Record<string, number> = {
  "New": 20,
  "Contacted": 12,
  "Responded": 8,
  "Multiple Responses": 5,
  "Qualified": 3,
  "Booked": 2,
  "DND": 2
};

let leadIdCounter = 1;
const generateLeadsForAccount = (accId: number) => {
  const accountLeads: Lead[] = [];
  Object.entries(leadsPerStage).forEach(([stage, count]) => {
    for (let i = 0; i < count; i++) {
      const first_name = pick(leadFirst, leadIdCounter);
      const last_name = pick(leadLast, leadIdCounter + 2);
      const created = new Date(Date.now() - Math.random() * 30 * 24 * 3600 * 1000);
      const updated = new Date(created.getTime() + 6 * 3600 * 1000);
      
      accountLeads.push({
        id: leadIdCounter++,
        account_id: accId,
        campaign_id: accId === 2 ? pick([11, 12], i) : pick([21, 22], i),
        created_at: iso(created),
        updated_at: iso(updated),
        first_name,
        last_name,
        full_name: `${first_name} ${last_name}`,
        phone: `+31 6 ${String(1200 + leadIdCounter).padStart(4, "0")} ${String(5600 + leadIdCounter).padStart(4, "0")}`,
        phone_normalized: `+316${String(12005600 + leadIdCounter).padStart(8, "0")}`,
        email: `${first_name.toLowerCase()}.${last_name.toLowerCase()}@example.com`,
        conversion_status: stage as any,
        source: pick(sources, i),
        last_interaction_at: iso(new Date(Date.now() - (5 - (i % 5)) * 3600 * 1000)),
        notes: i % 4 === 0 ? "Asked about pricing" : "",
        booked_call_date: stage === "Booked" ? iso(new Date(Date.now() + 2 * 24 * 3600 * 1000)) : null,
        automation_status: pick(automation, i),
        last_message_sent_at: iso(new Date(Date.now() - 3600 * 1000)),
        last_message_received_at: (stage === "Responded" || stage === "Multiple Responses") ? iso(new Date(Date.now() - 1800 * 1000)) : null,
        message_count_sent: 2,
        message_count_received: (stage === "Responded" || stage === "Multiple Responses") ? 1 : 0,
        ai_memory: "{}",
        bump_1_sent_at: null,
        bump_2_sent_at: null,
        bump_3_sent_at: null,
        first_message_sent_at: iso(new Date(Date.now() - 72 * 3600 * 1000)),
        current_bump_stage: 0,
        next_action_at: iso(new Date(Date.now() + 3600 * 1000)),
        timezone: "Europe/Amsterdam",
        opted_out: stage === "DND",
        ai_sentiment: "Neutral",
        priority: "Medium",
        manual_takeover: false,
        dnc_reason: stage === "DND" ? "User opted out" : "",
        custom_field_1: "",
        custom_field_2: "",
        custom_field_3: "",
        tags: [pick(tagPool, i)],
      });
    }
  });
  return accountLeads;
};

export const leads: Lead[] = [
  ...generateLeadsForAccount(1),
  ...generateLeadsForAccount(2),
  ...generateLeadsForAccount(3),
];

const interactionTypes: Interaction["type"][] = ["SMS", "WhatsApp", "Email", "Call", "Note"];
const interactionStatus: Interaction["status"][] = ["queued", "sending", "sent", "delivered", "failed", "read"];

export const interactions: Interaction[] = Array.from({ length: 120 }).map((_, idx) => {
  const id = idx + 1;
  const lead_id = (idx % 50) + 1;
  const lead = leads[lead_id - 1];
  const direction: Interaction["direction"] = idx % 3 === 0 ? "Inbound" : "Outbound";
  const created = new Date(Date.now() - (120 - idx) * 25 * 60 * 1000);

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
    account_id: lead.account_id,
    campaign_id: lead.campaign_id,
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
    metadata: JSON.stringify({ campaign_id: lead.campaign_id, lead_id }),
    ai_generated: direction === "Outbound" && idx % 2 === 0,
    ai_model: direction === "Outbound" ? "gpt-4" : "",
    ai_prompt: direction === "Outbound" ? "Generate a friendly follow up" : "",
    ai_response: direction === "Outbound" ? "(mock)" : "",
  };
});

export const automationLogs: AutomationLog[] = Array.from({ length: 40 }).map((_, idx) => {
  const lead = leads[(idx % leads.length)];
  const created = new Date(Date.now() - (idx + 1) * 2 * 60 * 60 * 1000);
  const status = pick<AutomationLog["status"]>(["success", "error", "skipped", "running"], idx);
  return {
    id: idx + 1,
    account_id: lead.account_id,
    campaign_id: lead.campaign_id,
    lead_id: lead.id,
    created_at: iso(created),
    status,
    error_message: status === "error" ? "Twilio delivery failed (mock)" : "",
    execution_time_ms: 250 + (idx % 900),
    stage: pick(["first_message", "bump_1", "bump_2", "handoff"], idx),
  };
});

export const users: AppUser[] = [
  { id: 1, account_id: 1, email: "leadawaker@gmail.com", role: "Admin", last_login_at: iso(new Date(Date.now() - 2 * 60 * 60 * 1000)) },
  { id: 2, account_id: 2, email: "owner@fitnessgymabc.com", role: "Admin", last_login_at: iso(new Date(Date.now() - 5 * 60 * 60 * 1000)) },
  { id: 3, account_id: 3, email: "owner@lawfirmxyz.com", role: "Admin", last_login_at: iso(new Date(Date.now() - 7 * 60 * 60 * 1000)) },
];

export const tags: TagItem[] = [
  { id: 1, account_id: 2, name: "New" },
  { id: 2, account_id: 2, name: "Hot" },
  { id: 3, account_id: 2, name: "Follow-up" },
  { id: 4, account_id: 2, name: "Pricing" },
  { id: 5, account_id: 3, name: "New" },
  { id: 6, account_id: 3, name: "Follow-up" },
  { id: 7, account_id: 3, name: "High intent" },
  { id: 8, account_id: 3, name: "Needs details" },
];

export const promptLibrary: PromptItem[] = [
  { id: 1, account_id: 2, name: "Gym reactivation - friendly", use_case: "Re-engagement", model: "gpt-4", performance_score: 0.86 },
  { id: 2, account_id: 2, name: "PT upsell - concise", use_case: "Follow-up", model: "gpt-4", performance_score: 0.81 },
  { id: 3, account_id: 3, name: "Legal intake - qualifying", use_case: "Cold outreach", model: "gpt-4", performance_score: 0.83 },
  { id: 4, account_id: 3, name: "Re-engage old legal leads", use_case: "Re-engagement", model: "gpt-4", performance_score: 0.78 },
];
