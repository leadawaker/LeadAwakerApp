// The master list of everything the automation engine does (specs/automation-overview).
// Every engine automation must be listed here, otherwise the Automations page shows
// it as "Unlisted". Labels live in client/src/locales/{en,nl,pt}/automation.json
// under names.<id> and descriptions.<id>.

export type AutomationService = "reactivation" | "speed_to_lead" | "bookings" | "reputation" | "receptionist" | "inbox" | "internal";

export type AutomationTrigger =
  | { type: "schedule"; everySeconds: number }
  | { type: "daily"; at: string }
  | { type: "event"; on: string };

export interface AutomationEntry {
  id: string;
  service: AutomationService;
  trigger: AutomationTrigger;
  scope: "campaign" | "account" | "agency";
  audience: "client" | "internal";
  aliases?: string[];
  jobId?: string;
  quietAfterHours?: number;
}

export const SERVICE_ORDER: AutomationService[] = [
  "reactivation", "speed_to_lead", "bookings", "reputation", "receptionist", "inbox", "internal",
];

const every = (s: number): AutomationTrigger => ({ type: "schedule", everySeconds: s });
const daily = (at: string): AutomationTrigger => ({ type: "daily", at });
const on = (ev: string): AutomationTrigger => ({ type: "event", on: ev });

export const AUTOMATION_CATALOGUE: AutomationEntry[] = [
  // Reactivation
  { id: "campaign_launcher", service: "reactivation", trigger: every(60), scope: "campaign", audience: "client" },
  { id: "bump_scheduler", service: "reactivation", trigger: every(300), scope: "campaign", audience: "client" },
  { id: "buying_signal_followup", service: "reactivation", trigger: every(300), scope: "campaign", audience: "client" },
  // Speed to lead
  { id: "speed_to_lead", service: "speed_to_lead", trigger: on("new_form_lead"), scope: "campaign", audience: "client" },
  // Bookings
  { id: "booking_reminder", service: "bookings", trigger: every(300), scope: "account", audience: "client" },
  { id: "no_show_followup", service: "bookings", trigger: every(900), scope: "account", audience: "client", aliases: ["no_show"] },
  { id: "reschedule_reengage", service: "bookings", trigger: on("reschedule"), scope: "account", audience: "client" },
  { id: "booking_webhook", service: "bookings", trigger: on("calendar_booking"), scope: "account", audience: "client" },
  // Reputation
  { id: "reputation_scheduler", service: "reputation", trigger: every(300), scope: "account", audience: "client" },
  { id: "reputation_handler", service: "reputation", trigger: on("customer_reply"), scope: "campaign", audience: "client" },
  { id: "review_response", service: "reputation", trigger: every(300), scope: "account", audience: "client", jobId: "review_drafter", aliases: ["review_drafter"] },
  // Receptionist
  { id: "voice_receptionist", service: "receptionist", trigger: on("phone_call"), scope: "account", audience: "client" },
  { id: "missed_call", service: "receptionist", trigger: on("missed_call"), scope: "account", audience: "client" },
  // Inbox
  { id: "inbound_handler", service: "inbox", trigger: on("incoming_message"), scope: "account", audience: "client", quietAfterHours: 72 },
  { id: "ai_conversation", service: "inbox", trigger: on("lead_replies"), scope: "campaign", audience: "client", quietAfterHours: 72 },
  { id: "website_chat", service: "inbox", trigger: on("widget_message"), scope: "account", audience: "client" },
  { id: "channel_fallback", service: "inbox", trigger: on("whatsapp_undelivered"), scope: "campaign", audience: "client" },
  { id: "message_delivery", service: "inbox", trigger: on("delivery_receipt"), scope: "account", audience: "client", aliases: ["whatsapp_cloud_webhook"] },
  { id: "stock_sync", service: "inbox", trigger: every(3600), scope: "account", audience: "client" },
  // Behind the scenes
  { id: "lead_scorer", service: "internal", trigger: every(1800), scope: "agency", audience: "internal" },
  { id: "metrics_aggregator", service: "internal", trigger: every(900), scope: "agency", audience: "internal" },
  { id: "nightly_summary", service: "internal", trigger: daily("00:00"), scope: "agency", audience: "internal" },
  { id: "task_reminders", service: "internal", trigger: every(900), scope: "agency", audience: "internal" },
  { id: "quality_rating_monitor", service: "internal", trigger: every(3600), scope: "agency", audience: "internal" },
  { id: "voice_call_sweep", service: "internal", trigger: every(60), scope: "agency", audience: "internal" },
  { id: "error_log_digest", service: "internal", trigger: daily("07:30"), scope: "agency", audience: "internal" },
  { id: "booking_consistency_check", service: "internal", trigger: daily("07:00"), scope: "agency", audience: "internal" },
  { id: "demo_data_purge", service: "internal", trigger: daily("03:30"), scope: "agency", audience: "internal" },
  { id: "demo_bump_scheduler", service: "internal", trigger: every(300), scope: "agency", audience: "internal" },
  { id: "send_queue_worker", service: "internal", trigger: every(3), scope: "agency", audience: "internal" },
];

const BY_NAME = new Map<string, AutomationEntry>();
for (const e of AUTOMATION_CATALOGUE) {
  BY_NAME.set(e.id, e);
  for (const a of e.aliases ?? []) BY_NAME.set(a, e);
  if (e.jobId) BY_NAME.set(e.jobId, e);
}

export function findEntry(name: string): AutomationEntry | undefined {
  return BY_NAME.get(name);
}

export function entryJobId(e: AutomationEntry): string | null {
  return e.trigger.type === "event" ? null : (e.jobId ?? e.id);
}
