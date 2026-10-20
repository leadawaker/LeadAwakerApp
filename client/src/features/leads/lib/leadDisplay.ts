// Display helpers shared by the Chats and Leads pages: the stage a lead shows
// (receptionist leads get simpler stages), its colour, and the "last contact"
// line ("WhatsApp · 2h ago", "Called · yesterday").
//
// The server computes `stage_key` (GET /api/leads/page). Receptionist leads map
// to rx_new / rx_answered / Booked / rx_done; DBR leads keep Conversion_Status.
// It is display only: the DB stage column is never rewritten for it.
import { PIPELINE_HEX } from "@/lib/avatarUtils";
import { formatRelativeTime } from "../components/cardView/formatUtils";

type T = (key: string, opts?: Record<string, any>) => string;

export const DBR_STAGES = [
  "New", "Contacted", "Responded", "Multiple Responses", "Qualified", "Booked", "Lost", "DND",
];
export const RX_STAGES = ["rx_new", "rx_answered", "Booked", "rx_done"];

/** Every stage a list can group/filter by, in pipeline order. */
export const ALL_STAGE_KEYS = [
  "New", "rx_new", "Contacted", "Responded", "rx_answered", "Multiple Responses",
  "Qualified", "Booked", "rx_done", "Lost", "DND",
];

/** Receptionist stages borrow the colour of the nearest pipeline stage. */
const RX_COLOR_STAGE: Record<string, string> = {
  rx_new: "New",
  rx_answered: "Responded",
  rx_done: "Closed",
};

/** DB status a receptionist column writes when a card is dropped on it. */
export const RX_STAGE_DB_STATUS: Record<string, string> = {
  rx_new: "New",
  rx_answered: "Responded",
  rx_done: "Lost",
};

export function rawStatus(lead: Record<string, any>): string {
  return lead.conversion_status || lead.Conversion_Status || "";
}

export function displayStage(lead: Record<string, any>): string {
  return lead.stage_key || rawStatus(lead) || "New";
}

/** Pipeline stage whose colours (hex, avatar) this stage uses. */
export function stageColorKey(stage: string): string {
  return RX_COLOR_STAGE[stage] ?? stage;
}

export function stageHex(stage: string): string {
  return PIPELINE_HEX[stageColorKey(stage)] || PIPELINE_HEX.New || "#6C5A8C";
}

export function stageLabel(t: T, stage: string): string {
  if (!stage) return "";
  return t(`kanban.stageLabels.${stage.replace(/ /g, "")}`, { defaultValue: stage });
}

export type ContactChannel = "website" | "whatsapp" | "phone" | "email" | "sms";

export function lastContactChannel(lead: Record<string, any>): ContactChannel | null {
  const c = String(lead.last_contact_channel ?? lead.last_channel ?? "");
  return (["website", "whatsapp", "phone", "email", "sms"] as const).find((x) => x === c) ?? null;
}

export function lastContactAt(lead: Record<string, any>): string | null {
  return lead.last_contact_at || lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at || null;
}

/** "WhatsApp · 2h ago", "Called · Yesterday"; just the time when the channel is unknown. */
export function lastContactText(lead: Record<string, any>, t: T): string {
  const ch = lastContactChannel(lead);
  const when = formatRelativeTime(lastContactAt(lead), t);
  if (!ch) return when;
  const label = t(`leadChannel.${ch}`);
  return when ? `${label} · ${when}` : label;
}
