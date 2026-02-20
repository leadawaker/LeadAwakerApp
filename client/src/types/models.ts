/**
 * Shared type definitions for the Lead Awaker application.
 * These types represent the database models returned by the API.
 *
 * NOTE: The API uses NocoDB-style field names (e.g., Accounts_id, full_name_1).
 * The types here use the camelCase/snake_case versions after dbKeys normalization.
 */

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
  [key: string]: any;
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
  [key: string]: any;
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
  [key: string]: any;
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
  [key: string]: any;
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
  [key: string]: any;
};

export type AppUser = {
  id: number;
  account_id: number;
  full_name: string;
  email: string;
  phone: string;
  timezone: string;
  role: "Admin" | "Manager" | "Agent" | "Viewer";
  status: "Active" | "Inactive";
  avatar_url: string;
  n8n_webhook_url: string;
  notification_email: boolean;
  notification_sms: boolean;
  last_login_at: string;
  users_id: string;
  Accounts: string;
  accounts_id: string;
  created_time: string;
  last_modified_time: string;
  [key: string]: any;
};

export type TagItem = {
  id: number;
  account_id: number;
  name: string;
  [key: string]: any;
};

export type PromptItem = {
  id: number;
  account_id: number;
  name: string;
  use_case: string;
  model: string;
  performance_score: number;
  [key: string]: any;
};

export type DashboardTrend = {
  date: string;
  bookings: number;
  messagesSent: number;
  responses: number;
  leadsTargeted: number;
  responseRate: number;
};

export type CampaignMetricsHistory = {
  id: number;
  campaigns_id: number;
  metric_date: string;
  total_leads_targeted: number;
  total_messages_sent: number;
  total_responses_received: number;
  response_rate_percent: number;
  bookings_generated: number;
  booking_rate_percent: number;
  total_cost: number;
  cost_per_lead: number;
  cost_per_booking: number;
  roi_percent: number;
  created_at: string;
  [key: string]: any;
};
