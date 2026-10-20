/**
 * Comment-to-DM storage: rules, webhook event dedupe, the DM log, opt-outs, and the CRM side of a live
 * conversation (a lead with channel_identifier "ig:<IG-scoped id>" and its Interactions, so it shows on
 * the Chats page under the Instagram type). Spec: docs/superpowers/specs/2026-10-20-comment-to-dm-design.md
 */
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  interactions,
  leads,
  socialDmLog,
  socialDmOptOuts,
  socialDmRules,
  socialWebhookEvents,
  type InsertSocialDmLog,
  type Interactions,
  type InsertSocialDmRule,
  type SocialDmLogRow,
  type SocialDmRule,
} from "@shared/schema";

export const IG_CHANNEL_PREFIX = "ig:";

export const socialDmStorage = {
  async listDmRules(accountId: number): Promise<SocialDmRule[]> {
    return db.select().from(socialDmRules).where(eq(socialDmRules.accountsId, accountId)).orderBy(desc(socialDmRules.id));
  },

  async listActiveDmRules(accountId: number): Promise<SocialDmRule[]> {
    return db.select().from(socialDmRules).where(and(eq(socialDmRules.accountsId, accountId), eq(socialDmRules.active, true)));
  },

  async insertDmRule(row: InsertSocialDmRule): Promise<SocialDmRule> {
    const [created] = await db.insert(socialDmRules).values(row).returning();
    return created;
  },

  async updateDmRule(accountId: number, ruleId: number, fields: Partial<InsertSocialDmRule>): Promise<SocialDmRule | null> {
    const [row] = await db.update(socialDmRules).set({ ...fields, updatedAt: new Date() })
      .where(and(eq(socialDmRules.id, ruleId), eq(socialDmRules.accountsId, accountId))).returning();
    return row ?? null;
  },

  async deleteDmRule(accountId: number, ruleId: number): Promise<boolean> {
    const rows = await db.delete(socialDmRules).where(and(eq(socialDmRules.id, ruleId), eq(socialDmRules.accountsId, accountId))).returning({ id: socialDmRules.id });
    return rows.length > 0;
  },

  /** false when the event key was already there (Meta delivered it before). */
  async claimWebhookEvent(eventKey: string, field: string, accountId: number, igUserId: string): Promise<boolean> {
    const rows = await db.insert(socialWebhookEvents).values({ eventKey, field, accountsId: accountId, igUserId })
      .onConflictDoNothing().returning({ id: socialWebhookEvents.id });
    return rows.length > 0;
  },

  async finishWebhookEvent(eventKey: string, outcome: string): Promise<void> {
    await db.update(socialWebhookEvents).set({ outcome: outcome.slice(0, 300), processedAt: new Date() }).where(eq(socialWebhookEvents.eventKey, eventKey));
  },

  async isDmOptedOut(accountId: number, igUserId: string): Promise<boolean> {
    const [row] = await db.select({ id: socialDmOptOuts.id }).from(socialDmOptOuts)
      .where(and(eq(socialDmOptOuts.accountsId, accountId), eq(socialDmOptOuts.igUserId, igUserId))).limit(1);
    return !!row;
  },

  async addDmOptOut(accountId: number, igUserId: string): Promise<void> {
    await db.insert(socialDmOptOuts).values({ accountsId: accountId, igUserId }).onConflictDoNothing();
  },

  async countDmSentSince(accountId: number, since: Date): Promise<number> {
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(socialDmLog).where(and(
      eq(socialDmLog.accountsId, accountId),
      inArray(socialDmLog.kind, ["private_reply", "reply"]),
      inArray(socialDmLog.status, ["sent", "would_send", "sending"]),
      gte(socialDmLog.createdAt, since),
    ));
    return row?.n ?? 0;
  },

  /** null on the one-private-reply-per-comment unique index. */
  async insertDmLog(row: InsertSocialDmLog): Promise<{ id: number } | null> {
    const rows = await db.insert(socialDmLog).values(row).onConflictDoNothing().returning({ id: socialDmLog.id });
    return rows[0] ?? null;
  },

  async updateDmLog(id: number, fields: Partial<InsertSocialDmLog>): Promise<void> {
    await db.update(socialDmLog).set(fields).where(eq(socialDmLog.id, id));
  },

  async findDmPrivateReply(accountId: number, igUserId: string, statuses: string[]): Promise<SocialDmLogRow | null> {
    if (statuses.length === 0) return null;
    const [row] = await db.select().from(socialDmLog).where(and(
      eq(socialDmLog.accountsId, accountId), eq(socialDmLog.igUserId, igUserId), eq(socialDmLog.kind, "private_reply"),
      inArray(socialDmLog.status, statuses),
    )).orderBy(desc(socialDmLog.id)).limit(1);
    return row ?? null;
  },

  async hasDmPrivateReplyForRule(accountId: number, igUserId: string, ruleId: number): Promise<boolean> {
    const [row] = await db.select({ id: socialDmLog.id }).from(socialDmLog).where(and(
      eq(socialDmLog.accountsId, accountId), eq(socialDmLog.igUserId, igUserId), eq(socialDmLog.kind, "private_reply"),
      eq(socialDmLog.ruleId, ruleId), inArray(socialDmLog.status, ["sent", "would_send", "sending"]),
    )).limit(1);
    return !!row;
  },

  async lastDmInboundAt(accountId: number, igUserId: string): Promise<Date | null> {
    const [row] = await db.select({ at: socialDmLog.createdAt }).from(socialDmLog)
      .where(and(eq(socialDmLog.accountsId, accountId), eq(socialDmLog.igUserId, igUserId), eq(socialDmLog.kind, "inbound")))
      .orderBy(desc(socialDmLog.createdAt)).limit(1);
    return row?.at ?? null;
  },

  async listDmLog(accountId: number, limit: number): Promise<SocialDmLogRow[]> {
    return db.select().from(socialDmLog).where(eq(socialDmLog.accountsId, accountId)).orderBy(desc(socialDmLog.id)).limit(limit);
  },

  // ─── The CRM side of a live conversation ──────────────────────────────────

  /** The lead and its do-not-contact flag (Leads.opted_out, the CRM's DNC switch). */
  async findIgLead(accountId: number, igUserId: string): Promise<{ id: number; optedOut: boolean } | null> {
    const [row] = await db.select({ id: leads.id, optedOut: leads.optedOut }).from(leads)
      .where(and(eq(leads.accountsId, accountId), eq(leads.channelIdentifier, `${IG_CHANNEL_PREFIX}${igUserId}`))).limit(1);
    return row?.id != null ? { id: row.id, optedOut: row.optedOut === true } : null;
  },

  /** No campaign, so the lead is "paused" for the automation engine: only people and this flow write to it. */
  async createIgLead(accountId: number, igUserId: string, username: string | null): Promise<{ id: number }> {
    const now = new Date();
    const [row] = await db.insert(leads).values({
      accountsId: accountId,
      firstName: username ? `@${username}` : "Instagram",
      source: "Instagram",
      channelIdentifier: `${IG_CHANNEL_PREFIX}${igUserId}`,
      automationStatus: "paused",
      conversionStatus: "New",
      createdAt: now,
      updatedAt: now,
    } as any).returning({ id: leads.id });
    return { id: row.id! };
  },

  async markIgLeadOptedOut(leadId: number): Promise<void> {
    await db.update(leads).set({ optedOut: true, updatedAt: new Date() } as any).where(eq(leads.id, leadId));
  },

  async addIgInteraction(row: { accountId: number; leadId: number; direction: "inbound" | "outbound"; content: string; status: string; kind: string }): Promise<Interactions | null> {
    const now = new Date();
    const [created] = await db.insert(interactions).values({
      accountsId: row.accountId,
      leadsId: row.leadId,
      type: "instagram",
      direction: row.direction,
      content: row.content,
      status: row.status,
      who: row.direction === "inbound" ? "Lead" : "Instagram",
      metadata: { source: "instagram", kind: row.kind },
      channel: "other",
      isRead: row.direction !== "inbound",
      sentAt: row.direction === "outbound" ? now : null,
      deliveredAt: row.direction === "outbound" && row.status === "delivered" ? now : null,
      createdAt: now,
      updatedAt: now,
    } as any).returning();
    return created ?? null;
  },
};
