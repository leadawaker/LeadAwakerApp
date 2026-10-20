/**
 * Comment-to-DM: what happens to a webhook comment or message. Spec:
 * docs/superpowers/specs/2026-10-20-comment-to-dm-design.md
 *
 * A comment with a rule's keyword gets ONE private reply (the rule's first message). Safe by default:
 * dm_mode "off" does nothing, "dry_run" writes what it would send to Social_Dm_Log and sends nothing,
 * "live" sends only when INSTAGRAM_DM_LIVE=1 too (effectiveDmMode + igMessaging.assertLiveAllowed).
 * Guards, in order: dedupe on comment / message id, the account's own comments, opt-outs, the 7-day
 * window, the hourly cap, one private reply per comment (unique index). Errors are recorded, never
 * retried. Live conversations land in the CRM as a lead (channel ig:<id>) with Interactions, so they
 * show on the Chats page under the Instagram type.
 */
import type { SocialDmRule } from "@shared/schema";
import type { DmMode } from "@shared/socialStudio";
import { effectiveDmMode } from "./dmSafety";
import { DM_TEXT_MAX, isStopMessage, matchesKeyword, renderFirstMessage } from "./dmMatch";
import { DmBlockedError, withinMessagingWindow, withinPrivateReplyWindow } from "./igMessaging";

export type WebhookEvent =
  | { field: "comments"; igAccountId: string; commentId: string; text: string; fromId: string; fromUsername: string | null; mediaId: string | null; at: Date }
  | { field: "messages"; igAccountId: string; mid: string; text: string; senderId: string; isEcho: boolean; at: Date };

function at(v: unknown, fallback: Date): Date {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return new Date(n < 1e12 ? n * 1000 : n);
}

/** Meta's "instagram" webhook body: entry[].changes[] (comments) and entry[].messaging[] (messages). */
export function parseWebhookPayload(body: unknown, now: Date): WebhookEvent[] {
  const b = body as { object?: unknown; entry?: unknown };
  if (!b || b.object !== "instagram" || !Array.isArray(b.entry)) return [];
  const out: WebhookEvent[] = [];
  for (const entry of b.entry as any[]) {
    const igAccountId = entry?.id != null ? String(entry.id) : "";
    if (!igAccountId) continue;
    const entryAt = at(entry.time, now);
    for (const ch of Array.isArray(entry.changes) ? entry.changes : []) {
      const v = ch?.value;
      if (ch?.field !== "comments" || !v?.id || !v?.from?.id) continue;
      out.push({
        field: "comments", igAccountId, commentId: String(v.id), text: typeof v.text === "string" ? v.text : "",
        fromId: String(v.from.id), fromUsername: typeof v.from.username === "string" ? v.from.username : null,
        mediaId: v.media?.id != null ? String(v.media.id) : null, at: entryAt,
      });
    }
    for (const m of Array.isArray(entry.messaging) ? entry.messaging : []) {
      if (!m?.message?.mid || !m?.sender?.id) continue;
      out.push({
        field: "messages", igAccountId, mid: String(m.message.mid), text: typeof m.message.text === "string" ? m.message.text : "",
        senderId: String(m.sender.id), isEcho: m.message.is_echo === true, at: at(m.timestamp, entryAt),
      });
    }
  }
  return out;
}

export interface DmConnection { accountId: number; igUserId: string; username: string | null; status: string; token: string | null }

export interface DmDeps {
  now(): Date;
  env(): NodeJS.ProcessEnv;
  findConnection(igAccountId: string): Promise<DmConnection | null>;
  findConnectionForAccount(accountId: number): Promise<DmConnection | null>;
  getSettings(accountId: number): Promise<{ dmMode: string; dmHourlyCap: number } | null>;
  /** false when this event was already seen (unique event key). */
  claimEvent(key: string, field: string, accountId: number, igUserId: string): Promise<boolean>;
  finishEvent(key: string, outcome: string): Promise<void>;
  listActiveRules(accountId: number): Promise<SocialDmRule[]>;
  isOptedOut(accountId: number, igUserId: string): Promise<boolean>;
  addOptOut(accountId: number, igUserId: string): Promise<void>;
  /** Private replies and replies sent (or that would have been, in dry run) since the given time. */
  countSentSince(accountId: number, since: Date): Promise<number>;
  /** null when the account already has a private reply for this comment (unique index). */
  insertLog(row: LogRow): Promise<{ id: number } | null>;
  updateLog(id: number, fields: Partial<LogRow>): Promise<void>;
  /** The newest private reply to this person with one of these statuses (live follows only "sent"). */
  findPrivateReply(accountId: number, igUserId: string, statuses: string[]): Promise<{ ruleId: number | null; status: string; mode: string } | null>;
  /** This person already got (or, in dry run, would have got) this rule's message: one per person and rule. */
  hasPrivateReplyForRule(accountId: number, igUserId: string, ruleId: number): Promise<boolean>;
  /** The last message this person sent the account (inbound log row), for the 24 h window. */
  lastInboundAt(accountId: number, igUserId: string): Promise<Date | null>;
  hasInbound(accountId: number, igUserId: string): Promise<boolean>;
  crm: {
    findOrCreateLead(accountId: number, igUserId: string, username: string | null): Promise<{ id: number }>;
    findLead(accountId: number, igUserId: string): Promise<{ id: number; optedOut: boolean } | null>;
    addInteraction(row: { accountId: number; leadId: number; direction: "inbound" | "outbound"; content: string; status: string; kind: string }): Promise<{ id: number } | null>;
    markOptedOut(leadId: number): Promise<void>;
  };
  send: {
    privateReply(conn: DmConnection, mode: DmMode, commentId: string, text: string): Promise<string | null>;
    directMessage(conn: DmConnection, mode: DmMode, recipientId: string, text: string): Promise<string | null>;
  };
  notifyAgency(n: { title: string; body: string; accountId: number }): Promise<void>;
}

/** Opted out by a stop word here, or marked do-not-contact on the lead in the CRM. */
async function optedOut(d: DmDeps, accountId: number, igUserId: string): Promise<boolean> {
  if (await d.isOptedOut(accountId, igUserId)) return true;
  return (await d.crm.findLead(accountId, igUserId))?.optedOut === true;
}

export interface LogRow {
  accountsId: number; ruleId?: number | null; commentId?: string | null; igUserId?: string | null; username?: string | null;
  kind: "private_reply" | "reply" | "inbound" | "opt_out" | "ai_follow_up";
  mode: "dry_run" | "live"; status: "would_send" | "sending" | "sent" | "failed" | "skipped" | "received";
  reason?: string | null; text?: string | null; leadId?: number | null; interactionId?: number | null;
}

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 300);

/** Rules for this post first (a post's own keyword wins over an "all posts" rule), then the rest. */
export function pickRule(rules: SocialDmRule[], mediaId: string | null, text: string): SocialDmRule | null {
  // A rule for one post that has no media id yet matches nothing (it never turns into an "all posts" rule).
  const candidates = rules.filter((r) => r.active && (r.igMediaId === null ? r.postId === null : r.igMediaId === mediaId));
  candidates.sort((a, b) => Number(b.igMediaId !== null) - Number(a.igMediaId !== null) || a.id - b.id);
  return candidates.find((r) => matchesKeyword(text, r.keywordNorm || r.keyword)) ?? null;
}

async function handleComment(d: DmDeps, ev: Extract<WebhookEvent, { field: "comments" }>, conn: DmConnection): Promise<string> {
  if (ev.fromId === conn.igUserId || (conn.username && ev.fromUsername?.toLowerCase() === conn.username.toLowerCase())) return "own_comment";
  const settings = await d.getSettings(conn.accountId);
  const mode = effectiveDmMode(settings?.dmMode, d.env());
  if (mode === "off") return "off";
  const rule = pickRule(await d.listActiveRules(conn.accountId), ev.mediaId, ev.text);
  if (!rule) return "no_match";
  const now = d.now();
  const base = { accountsId: conn.accountId, ruleId: rule.id, commentId: ev.commentId, igUserId: ev.fromId, username: ev.fromUsername, mode } as const;
  const skip = async (reason: string) => {
    await d.insertLog({ ...base, kind: "private_reply", status: "skipped", reason });
    return reason;
  };
  if (await optedOut(d, conn.accountId, ev.fromId)) return skip("opted_out");
  if (await d.hasPrivateReplyForRule(conn.accountId, ev.fromId, rule.id)) return skip("already_messaged");
  if (!withinPrivateReplyWindow(ev.at, now)) return skip("window_closed");
  if ((await d.countSentSince(conn.accountId, new Date(now.getTime() - 3_600_000))) >= (settings?.dmHourlyCap ?? 20)) return skip("hourly_cap");

  const text = renderFirstMessage(rule.firstMessage, { username: ev.fromUsername }).slice(0, DM_TEXT_MAX);
  const log = await d.insertLog({ ...base, kind: "private_reply", status: mode === "live" ? "sending" : "would_send", text });
  if (!log) return "already_replied";
  if (mode === "dry_run") return "would_send";

  if (!conn.token || conn.status === "disconnected") {
    await d.updateLog(log.id, { status: "failed", reason: "not_connected" });
    return "not_connected";
  }
  try {
    await d.send.privateReply(conn, mode, ev.commentId, text);
  } catch (err) {
    const reason = err instanceof DmBlockedError ? `blocked: ${err.reason}` : errText(err);
    await d.updateLog(log.id, { status: "failed", reason });
    void d.notifyAgency({ title: "Instagram private reply failed", body: `Account ${conn.accountId}, comment by @${ev.fromUsername ?? ev.fromId}: ${reason}`, accountId: conn.accountId }).catch(() => {});
    return "failed";
  }
  // It went out: record that first, so their reply is followed even if the CRM write below fails.
  await d.updateLog(log.id, { status: "sent" });
  try {
    const lead = await d.crm.findOrCreateLead(conn.accountId, ev.fromId, ev.fromUsername);
    await d.crm.addInteraction({ accountId: conn.accountId, leadId: lead.id, direction: "inbound", content: ev.text, status: "received", kind: "instagram_comment" });
    const out = await d.crm.addInteraction({ accountId: conn.accountId, leadId: lead.id, direction: "outbound", content: text, status: "delivered", kind: "instagram_private_reply" });
    await d.updateLog(log.id, { leadId: lead.id, interactionId: out?.id ?? null });
  } catch (err) {
    console.error(`[social-dm] comment ${ev.commentId}: sent, but the CRM write failed: ${errText(err)}`);
    void d.notifyAgency({ title: "Instagram reply sent, Chats not updated", body: `Account ${conn.accountId}: a private reply to @${ev.fromUsername ?? ev.fromId} went out but could not be added to Chats (${errText(err)}).`, accountId: conn.accountId }).catch(() => {});
  }
  return "sent";
}

async function handleMessage(d: DmDeps, ev: Extract<WebhookEvent, { field: "messages" }>, conn: DmConnection): Promise<string> {
  if (ev.isEcho || ev.senderId === conn.igUserId) return "echo";
  const mode = effectiveDmMode((await d.getSettings(conn.accountId))?.dmMode, d.env());
  if (mode === "off") return "off";
  // Only people this flow wrote to: the rest of the account's DMs are not the CRM's business.
  // Live: only after a real private reply. Dry run: also after one that would have gone out.
  const started = await d.findPrivateReply(conn.accountId, ev.senderId, mode === "live" ? ["sent"] : ["sent", "would_send"]);
  if (!started) return "not_in_flow";
  const base = { accountsId: conn.accountId, igUserId: ev.senderId, mode, ruleId: started!.ruleId } as const;

  if (isStopMessage(ev.text)) {
    await d.addOptOut(conn.accountId, ev.senderId);
    const lead = mode === "live" ? await d.crm.findLead(conn.accountId, ev.senderId) : null;
    if (lead) {
      await d.crm.markOptedOut(lead.id);
      await d.crm.addInteraction({ accountId: conn.accountId, leadId: lead.id, direction: "inbound", content: ev.text, status: "received", kind: "instagram_dm" });
    }
    await d.insertLog({ ...base, kind: "opt_out", status: "received", text: ev.text.slice(0, DM_TEXT_MAX), leadId: lead?.id ?? null });
    return "opted_out";
  }

  const first = !(await d.hasInbound(conn.accountId, ev.senderId));
  let leadId: number | null = null;
  let interactionId: number | null = null;
  if (mode === "live") {
    const lead = await d.crm.findOrCreateLead(conn.accountId, ev.senderId, null);
    leadId = lead.id;
    interactionId = (await d.crm.addInteraction({ accountId: conn.accountId, leadId, direction: "inbound", content: ev.text, status: "received", kind: "instagram_dm" }))?.id ?? null;
  }
  await d.insertLog({ ...base, kind: "inbound", status: "received", text: ev.text.slice(0, DM_TEXT_MAX), leadId, interactionId });

  const ruleId = started!.ruleId;
  const rule = ruleId ? (await d.listActiveRules(conn.accountId)).find((r) => r.id === ruleId) : undefined;
  if (rule?.aiFollowUp) {
    // The AI conversation engine (the Python service) has no Instagram channel yet: recorded, not sent.
    await d.insertLog({ ...base, kind: "ai_follow_up", status: "skipped", reason: "engine_not_connected", leadId });
  }
  if (first && mode === "live") {
    void d.notifyAgency({ title: "Instagram DM reply", body: `A person who commented on account ${conn.accountId}'s post replied in DM. Answer from Chats within 24 h.`, accountId: conn.accountId }).catch(() => {});
  }
  return "received";
}

/** Every event of one webhook delivery, one after the other. Never throws: each outcome is recorded. */
export async function processWebhookEvents(d: DmDeps, events: WebhookEvent[]): Promise<string[]> {
  const outcomes: string[] = [];
  for (const ev of events) {
    // Scoped to the receiving professional account: one message id can show up on both sides of a chat.
    const key = ev.field === "comments" ? `${ev.igAccountId}:comment:${ev.commentId}` : `${ev.igAccountId}:message:${ev.mid}`;
    let outcome = "error";
    try {
      const conn = await d.findConnection(ev.igAccountId);
      if (!conn) { outcomes.push("unknown_account"); continue; }
      const userId = ev.field === "comments" ? ev.fromId : ev.senderId;
      if (!(await d.claimEvent(key, ev.field, conn.accountId, userId))) { outcomes.push("duplicate"); continue; }
      outcome = ev.field === "comments" ? await handleComment(d, ev, conn) : await handleMessage(d, ev, conn);
      await d.finishEvent(key, outcome);
    } catch (err) {
      console.error(`[social-dm] ${key}: ${errText(err)}`);
      await d.finishEvent(key, `error: ${errText(err)}`).catch(() => {});
    }
    outcomes.push(outcome);
  }
  return outcomes;
}

export type ManualReplyResult = { status: "delivered" | "failed" | "dry_run"; reason?: string };

/**
 * A person answering from the Chats page to an Instagram lead (channel ig:<id>). Same switches and
 * guards as the automation: live only with both switches, never to someone who opted out, only within
 * 24 h of their last message, within the hourly cap. Dry run records what would have gone out.
 */
export async function deliverManualReply(d: DmDeps, p: { accountId: number; igUserId: string; leadId: number; text: string }): Promise<ManualReplyResult> {
  const settings = await d.getSettings(p.accountId);
  const mode = effectiveDmMode(settings?.dmMode, d.env());
  const base = { accountsId: p.accountId, igUserId: p.igUserId, leadId: p.leadId, text: p.text.slice(0, DM_TEXT_MAX), kind: "reply" as const };
  if (mode === "off") return { status: "failed", reason: "dm_off" };
  const now = d.now();
  const refuse = async (reason: string): Promise<ManualReplyResult> => {
    await d.insertLog({ ...base, mode, status: "skipped", reason });
    return { status: "failed", reason };
  };
  if (!p.text.trim()) return refuse("empty");
  if (p.text.length > DM_TEXT_MAX) return refuse("too_long");
  if (await optedOut(d, p.accountId, p.igUserId)) return refuse("opted_out");
  if (!withinMessagingWindow(await d.lastInboundAt(p.accountId, p.igUserId), now)) return refuse("window_closed");
  if ((await d.countSentSince(p.accountId, new Date(now.getTime() - 3_600_000))) >= (settings?.dmHourlyCap ?? 20)) return refuse("hourly_cap");
  if (mode === "dry_run") {
    await d.insertLog({ ...base, mode, status: "would_send" });
    return { status: "dry_run" };
  }
  const conn = await d.findConnectionForAccount(p.accountId);
  if (!conn?.token || conn.status === "disconnected") return refuse("not_connected");
  // Logged before the send: if the request goes out and the update below fails, the row says "sending",
  // never "failed", so nobody resends a message that may have arrived.
  const log = await d.insertLog({ ...base, mode, status: "sending" });
  try {
    await d.send.directMessage(conn, mode, p.igUserId, p.text);
  } catch (err) {
    const reason = err instanceof DmBlockedError ? `blocked: ${err.reason}` : errText(err);
    if (log) await d.updateLog(log.id, { status: "failed", reason });
    return { status: "failed", reason };
  }
  if (log) await d.updateLog(log.id, { status: "sent" }).catch(() => {});
  return { status: "delivered" };
}
