/**
 * Wires comment-to-DM (server/social/dmEngine.ts, webhookRoutes.ts, dmRoutes.ts) to the real storage,
 * the Instagram connection, the CRM tables and notifications. The only senders are igMessaging.ts's
 * guarded functions: a real send needs dm_mode "live" AND INSTAGRAM_DM_LIVE=1.
 */
import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { broadcast } from "../sse";
import { defaultIgDeps } from "../social/instagramApi";
import { sendDirectMessage, sendPrivateReply } from "../social/igMessaging";
import { deliverManualReply, parseWebhookPayload, processWebhookEvents, type DmConnection, type DmDeps, type ManualReplyResult } from "../social/dmEngine";
import { registerInstagramWebhook } from "../social/webhookRoutes";
import { registerDmRoutes } from "../social/dmRoutes";
import { notifyAgency } from "../social/notify";
import { socialPageLink } from "@shared/socialStudio";
import { IG_CHANNEL_PREFIX } from "../storage/socialDm";
import { interactions, type SocialConnection } from "@shared/schema";
import { toDbKeys } from "../dbKeys";

function toDmConnection(c: SocialConnection | null): DmConnection | null {
  if (!c || !c.externalUserId) return null;
  return { accountId: c.accountsId, igUserId: c.externalUserId, username: c.username, status: c.status, token: storage.getSocialAccessToken(c) };
}

export function liveDmDeps(): DmDeps {
  const ig = defaultIgDeps();
  return {
    now: () => new Date(),
    env: () => process.env,
    findConnection: async (igAccountId) => toDmConnection(await storage.getSocialConnectionByExternalId(igAccountId)),
    findConnectionForAccount: async (accountId) => toDmConnection(await storage.getSocialConnection(accountId)),
    async getSettings(accountId) {
      const s = await storage.getSocialSettings(accountId);
      return s ? { dmMode: s.dmMode, dmHourlyCap: s.dmHourlyCap } : null;
    },
    claimEvent: (key, field, accountId, igUserId) => storage.claimWebhookEvent(key, field, accountId, igUserId),
    finishEvent: (key, outcome) => storage.finishWebhookEvent(key, outcome),
    listActiveRules: (accountId) => storage.listActiveDmRules(accountId),
    isOptedOut: (accountId, igUserId) => storage.isDmOptedOut(accountId, igUserId),
    addOptOut: (accountId, igUserId) => storage.addDmOptOut(accountId, igUserId),
    countSentSince: (accountId, since) => storage.countDmSentSince(accountId, since),
    insertLog: (row) => storage.insertDmLog(row),
    updateLog: (id, fields) => storage.updateDmLog(id, fields),
    async findPrivateReply(accountId, igUserId) {
      const row = await storage.findDmPrivateReply(accountId, igUserId);
      return row ? { ruleId: row.ruleId, status: row.status, mode: row.mode } : null;
    },
    lastInboundAt: (accountId, igUserId) => storage.lastDmInboundAt(accountId, igUserId),
    hasInbound: async (accountId, igUserId) => (await storage.lastDmInboundAt(accountId, igUserId)) !== null,
    crm: {
      async findOrCreateLead(accountId, igUserId, username) {
        return (await storage.findIgLead(accountId, igUserId)) ?? storage.createIgLead(accountId, igUserId, username);
      },
      findLead: (accountId, igUserId) => storage.findIgLead(accountId, igUserId),
      async addInteraction(row) {
        const created = await storage.addIgInteraction(row);
        if (!created?.id) return null;
        // The same event the Chats page gets for any new message (server/routes/conversations.ts).
        broadcast(row.accountId, "new_interaction", toDbKeys(created as any, interactions));
        return { id: created.id };
      },
      markOptedOut: (leadId) => storage.markIgLeadOptedOut(leadId),
    },
    send: {
      privateReply: (c, mode, commentId, text) => sendPrivateReply({ accountMode: mode, igUserId: c.igUserId, token: c.token ?? "", deps: ig }, commentId, text),
      directMessage: (c, mode, to, text) => sendDirectMessage({ accountMode: mode, igUserId: c.igUserId, token: c.token ?? "", deps: ig }, to, text),
    },
    notifyAgency: (n) => notifyAgency({ type: "social_dm_problem", title: n.title, body: n.body, accountId: n.accountId, link: socialPageLink(n.accountId, "comments") }),
  };
}

/** A reply typed on the Chats page to a lead whose channel is ig:<id>. Never throws. */
export async function deliverInstagramReply(lead: { id: number; accountsId: number | null; channelIdentifier: string | null }, text: string): Promise<ManualReplyResult> {
  const igUserId = (lead.channelIdentifier ?? "").slice(IG_CHANNEL_PREFIX.length);
  if (!lead.accountsId || !igUserId) return { status: "failed", reason: "not_instagram" };
  try {
    return await deliverManualReply(liveDmDeps(), { accountId: lead.accountsId, igUserId, leadId: lead.id, text });
  } catch (err: any) {
    console.error(`[social-dm] reply to lead ${lead.id} failed: ${err?.message ?? err}`);
    return { status: "failed", reason: "error" };
  }
}

export function registerSocialDmRoutes(app: Express): void {
  registerInstagramWebhook(app, {
    verifyToken: () => process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || undefined,
    appSecret: () => process.env.INSTAGRAM_APP_SECRET || undefined,
    async process(body) {
      const outcomes = await processWebhookEvents(liveDmDeps(), parseWebhookPayload(body, new Date()));
      if (outcomes.length) console.log(`[social-dm] webhook: ${outcomes.join(", ")}`);
    },
  });
  registerDmRoutes(app, {
    requireAuth,
    now: () => new Date(),
    env: () => process.env,
    webhookReady: () => !!(process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN && process.env.INSTAGRAM_APP_SECRET),
    store: {
      async getAccount(accountId) {
        const a = await storage.getAccountById(accountId);
        return a ? { timezone: a.timezone, language: a.language, socialEnabled: a.socialEnabled === true } : null;
      },
      getSocialSettings: (id) => storage.getSocialSettings(id),
      listDmRules: (id) => storage.listDmRules(id),
      insertDmRule: (row) => storage.insertDmRule(row),
      updateDmRule: (accountId, ruleId, fields) => storage.updateDmRule(accountId, ruleId, fields),
      deleteDmRule: (accountId, ruleId) => storage.deleteDmRule(accountId, ruleId),
      listDmLog: (id, limit) => storage.listDmLog(id, limit),
      countDmSentSince: (id, since) => storage.countDmSentSince(id, since),
      listSocialPosts: (id) => storage.listSocialPosts(id),
      getSocialPost: (accountId, postId) => storage.getSocialPost(accountId, postId),
    },
  });
}
