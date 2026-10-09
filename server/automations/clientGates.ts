// Per-client ON/OFF + plain-words settings summary for each automation
// (specs/automation-overview). Pure: the route loads GateInputs from the DB.
import { AUTOMATION_CATALOGUE, type AutomationEntry } from "@shared/automationCatalogue";
import type { ChangeTarget, ClientLine, ClientState, SummaryToken } from "@shared/automationTypes";

export interface GateCampaign {
  id: number; name: string; status: string | null; campaignType: string | null;
  maxBumps: number | null; bumpDelaysHours: (number | null)[];
  useAiBumps: boolean | null; channelMode: string | null; fallbackChannel: string | null;
  dailyLeadLimit: number | null; activeHoursStart: string | null; activeHoursEnd: string | null;
  hadActivity7d: boolean; activeLeads: number;
}

export interface GateInputs {
  account: { id: number; enableReputationManagement: boolean | null; enableReviewResponse: boolean | null; missedCallEnabled: boolean | null; missedCallNumber: string | null };
  campaigns: GateCampaign[];
  voiceNumbers: { phoneNumber: string; enabled: boolean; transferNumber: string | null }[];
  widgets: { enabled: boolean | null }[];
  stockFeedUrl: string | null;
}

export type ClientLineBase = Omit<ClientLine, "counts7d">;

export const isActiveStatus = (s: string | null) => (s ?? "").toLowerCase() === "active";
const isPausedStatus = (s: string | null) => (s ?? "").toLowerCase() === "paused";
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");
const REACTIVATION_TYPES = new Set(["reactivation", ""]);

export function visibleCampaigns(cs: GateCampaign[]): GateCampaign[] {
  return cs.filter((c) => isActiveStatus(c.status) || isPausedStatus(c.status) || c.hadActivity7d);
}

const section = (c: GateCampaign, s: "business" | "ai" | "behavior"): ChangeTarget => ({ kind: "campaign_section", campaignId: c.id, section: s });
const tab = (t: "integrations" | "communication" | "voice"): ChangeTarget => ({ kind: "account_tab", tab: t });

type CampaignRule = (c: GateCampaign, inp: GateInputs) => { state: ClientState; summary?: SummaryToken[]; change: ChangeTarget | null; warning?: ClientLineBase["warning"] } | null;
type AccountRule = (inp: GateInputs) => { state: ClientState; summary?: SummaryToken[]; change: ChangeTarget | null };

const isReactivation = (c: GateCampaign) => REACTIVATION_TYPES.has((c.campaignType ?? "").toLowerCase());

const CAMPAIGN_RULES: Record<string, CampaignRule> = {
  campaign_launcher: (c) => {
    if (!isReactivation(c)) return null;
    const summary: SummaryToken[] = [];
    if (c.dailyLeadLimit) summary.push({ key: "dailyLimit", values: { n: c.dailyLeadLimit } });
    if (c.activeHoursStart && c.activeHoursEnd) summary.push({ key: "activeHours", values: { start: hhmm(c.activeHoursStart), end: hhmm(c.activeHoursEnd) } });
    return { state: isActiveStatus(c.status) ? "on" : "off", summary, change: section(c, "behavior") };
  },
  bump_scheduler: (c) => {
    if (!isReactivation(c)) return null;
    const n = c.maxBumps ?? 0;
    const delays = c.bumpDelaysHours.slice(0, n).filter((d): d is number => d != null).map((d) => `${d}h`).join(", ");
    const summary: SummaryToken[] = n > 0 ? [{ key: "bumps", values: { n, delays } }] : [];
    if (n > 0 && c.useAiBumps) summary.push({ key: "aiBumps" });
    const warning = !isActiveStatus(c.status) && c.activeLeads > 0 ? { key: "paused_followups" as const, count: c.activeLeads } : null;
    return { state: n > 0 ? "on" : "off", summary, change: section(c, "behavior"), warning };
  },
  buying_signal_followup: (c) => (isReactivation(c) ? { state: "always_on", change: null } : null),
  speed_to_lead: (c) => ((c.campaignType ?? "").toLowerCase() === "speed_to_lead"
    ? { state: isActiveStatus(c.status) ? "on" : "off", change: section(c, "business") } : null),
  reputation_handler: (c, inp) => ((c.campaignType ?? "").toLowerCase() === "reputation"
    ? { state: inp.account.enableReputationManagement ? "on" : "off", change: { kind: "settings_account" } } : null),
  ai_conversation: (c) => ({ state: "always_on", change: section(c, "ai") }),
  channel_fallback: (c) => (c.channelMode === "whatsapp_then_sms"
    ? { state: "on", summary: [{ key: "fallbackTo", values: { channel: c.fallbackChannel ?? "sms" } }], change: section(c, "behavior") }
    : { state: "off", change: section(c, "behavior") }),
};

const ACCOUNT_RULES: Record<string, AccountRule> = {
  inbound_handler: () => ({ state: "always_on", change: null }),
  message_delivery: () => ({ state: "always_on", change: null }),
  website_chat: (i) => ({ state: i.widgets.some((w) => w.enabled) ? "on" : "off", change: tab("integrations") }),
  stock_sync: (i) => ({ state: i.stockFeedUrl ? "on" : "off", change: tab("communication") }),
  booking_reminder: () => ({ state: "always_on", summary: [{ key: "reminderTimes" }], change: null }),
  no_show_followup: () => ({ state: "always_on", change: null }),
  reschedule_reengage: () => ({ state: "always_on", change: null }),
  booking_webhook: () => ({ state: "always_on", change: null }),
  reputation_scheduler: (i) => ({
    state: i.account.enableReputationManagement && visibleCampaigns(i.campaigns).some((c) => (c.campaignType ?? "").toLowerCase() === "reputation") ? "on" : "off",
    change: { kind: "settings_account" },
  }),
  review_response: (i) => ({ state: i.account.enableReviewResponse ? "on" : "off", change: { kind: "settings_account" } }),
  voice_receptionist: (i) => {
    const line = i.voiceNumbers.find((v) => v.enabled);
    return { state: line ? "on" : "off", summary: line ? [{ key: "voiceLine", values: { number: line.phoneNumber } }] : [], change: tab("voice") };
  },
  missed_call: (i) => ({
    state: i.account.missedCallEnabled ? "on" : "off",
    summary: i.account.missedCallNumber ? [{ key: "missedCallNumber", values: { number: i.account.missedCallNumber } }] : [],
    change: tab("integrations"),
  }),
};

export function buildClientLines(inputs: GateInputs, catalogue: AutomationEntry[] = AUTOMATION_CATALOGUE): ClientLineBase[] {
  const campaigns = visibleCampaigns(inputs.campaigns);
  const out: ClientLineBase[] = [];
  for (const entry of catalogue) {
    if (entry.audience !== "client") continue;
    if (entry.scope === "campaign") {
      const rule = CAMPAIGN_RULES[entry.id];
      if (!rule) continue;
      for (const c of campaigns) {
        const r = rule(c, inputs);
        if (!r) continue;
        out.push({ automationId: entry.id, campaignId: c.id, campaignName: c.name, state: r.state, summary: r.summary ?? [], change: r.change, warning: r.warning ?? null });
      }
    } else {
      const rule = ACCOUNT_RULES[entry.id];
      if (!rule) continue;
      const r = rule(inputs);
      out.push({ automationId: entry.id, campaignId: null, campaignName: null, state: r.state, summary: r.summary ?? [], change: r.change, warning: null });
    }
  }
  return out;
}
