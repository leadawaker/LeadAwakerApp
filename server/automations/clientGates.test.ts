import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClientLines, visibleCampaigns, type GateInputs, type GateCampaign } from "./clientGates";

const camp = (over: Partial<GateCampaign> = {}): GateCampaign => ({
  id: 7, name: "Winter", status: "Active", campaignType: "reactivation",
  maxBumps: 3, bumpDelaysHours: [24, 48, 72, null], useAiBumps: false,
  channelMode: "whatsapp_then_sms", fallbackChannel: "sms",
  dailyLeadLimit: 50, activeHoursStart: "09:00:00", activeHoursEnd: "18:00:00",
  hadActivity7d: false, activeLeads: 0, ...over,
});
const base = (over: Partial<GateInputs> = {}): GateInputs => ({
  account: { id: 1, enableReputationManagement: false, enableReviewResponse: false, missedCallEnabled: false, missedCallNumber: null },
  campaigns: [], voiceNumbers: [], widgets: [], stockFeedUrl: null, ...over,
});
const line = (lines: ReturnType<typeof buildClientLines>, id: string, campaignId: number | null = null) =>
  lines.find((l) => l.automationId === id && l.campaignId === campaignId);

test("empty account: account lines only, sensible states", () => {
  const lines = buildClientLines(base());
  assert.equal(lines.some((l) => l.campaignId !== null), false);
  assert.equal(line(lines, "booking_reminder")!.state, "always_on");
  assert.equal(line(lines, "voice_receptionist")!.state, "off");
  assert.equal(line(lines, "missed_call")!.state, "off");
  assert.equal(lines.some((l) => l.automationId === "lead_scorer"), false);
});

test("active reactivation campaign", () => {
  const lines = buildClientLines(base({ campaigns: [camp()] }));
  assert.equal(line(lines, "campaign_launcher", 7)!.state, "on");
  assert.deepEqual(line(lines, "campaign_launcher", 7)!.summary, [
    { key: "dailyLimit", values: { n: 50 } },
    { key: "activeHours", values: { start: "09:00", end: "18:00" } },
  ]);
  assert.deepEqual(line(lines, "bump_scheduler", 7)!.summary[0], { key: "bumps", values: { n: 3, delays: "24h, 48h, 72h" } });
  assert.deepEqual(line(lines, "bump_scheduler", 7)!.change, { kind: "campaign_section", campaignId: 7, section: "behavior" });
  assert.equal(line(lines, "channel_fallback", 7)!.state, "on");
});

test("lowercase status counts as active", () => {
  const lines = buildClientLines(base({ campaigns: [camp({ status: "active" })] }));
  assert.equal(line(lines, "campaign_launcher", 7)!.state, "on");
});

test("paused campaign with active leads warns on follow-ups", () => {
  const lines = buildClientLines(base({ campaigns: [camp({ status: "Paused", activeLeads: 12 })] }));
  assert.equal(line(lines, "campaign_launcher", 7)!.state, "off");
  assert.deepEqual(line(lines, "bump_scheduler", 7)!.warning, { key: "paused_followups", count: 12 });
});

test("completed campaign hidden unless it had activity", () => {
  assert.equal(visibleCampaigns([camp({ status: "Completed" })]).length, 0);
  assert.equal(visibleCampaigns([camp({ status: "Completed", hadActivity7d: true })]).length, 1);
});

test("reputation campaign gets reputation lines, not reactivation ones", () => {
  const lines = buildClientLines(base({
    account: { id: 1, enableReputationManagement: true, enableReviewResponse: true, missedCallEnabled: true, missedCallNumber: "+31201234567" },
    campaigns: [camp({ id: 9, campaignType: "reputation" })],
  }));
  assert.equal(line(lines, "campaign_launcher", 9), undefined);
  assert.equal(line(lines, "reputation_handler", 9)!.state, "on");
  assert.equal(line(lines, "reputation_scheduler")!.state, "on");
  assert.equal(line(lines, "review_response")!.state, "on");
  assert.deepEqual(line(lines, "missed_call")!.summary, [{ key: "missedCallNumber", values: { number: "+31201234567" } }]);
});

test("voice line on", () => {
  const lines = buildClientLines(base({ voiceNumbers: [{ phoneNumber: "+3185", enabled: true, transferNumber: null }] }));
  assert.equal(line(lines, "voice_receptionist")!.state, "on");
  assert.deepEqual(line(lines, "voice_receptionist")!.change, { kind: "account_tab", tab: "voice" });
});
