/**
 * Instagram connections (docs/superpowers/specs/2026-10-19-instagram-connect-and-publishing-design.md).
 *
 * One `Social_Connections` row per account and provider. The access token is
 * sealed with secretBox on the way in; only getSocialAccessToken() opens it,
 * for server-side Graph calls. Never log or return what it gives back.
 * Posts: every post route writes through updateSocialPostIf, a conditional
 * UPDATE that loses (returns null) when the post moved on meanwhile.
 */
import { and, asc, desc, eq, gt, inArray, isNull, lte, ne, or, type SQL } from "drizzle-orm";
import { db } from "../db";
import {
  accounts,
  socialConnections,
  socialPosts,
  users,
  type InsertSocialPost,
  type SocialConnection,
  type SocialPost,
} from "@shared/schema";
import type { ApprovalStatus, SocialPostStatus } from "@shared/socialPosts";
import { open, seal } from "../lib/secretBox";

const PROVIDER = "instagram";

export type SocialConnectionStatus = "connected" | "needs_attention" | "disconnected";

export interface SocialConnectionFields {
  externalUserId: string;
  appScopedUserId: string | null;
  username: string;
  accountType: string;
  profilePictureUrl: string | null;
  accessToken: string;
  expiresAt: Date;
  scopes: string[];
  connectedByUserId: number | null;
}

export const socialStorage = {
  async getSocialConnection(accountId: number): Promise<SocialConnection | null> {
    const [row] = await db.select().from(socialConnections)
      .where(and(eq(socialConnections.accountsId, accountId), eq(socialConnections.provider, PROVIDER)))
      .limit(1);
    return row ?? null;
  },

  /** The live (not disconnected) connection for this Instagram user, if any. At most one exists (partial unique index). */
  async getSocialConnectionByExternalId(externalUserId: string): Promise<SocialConnection | null> {
    const [row] = await db.select().from(socialConnections)
      .where(and(
        eq(socialConnections.provider, PROVIDER),
        eq(socialConnections.externalUserId, externalUserId),
        ne(socialConnections.status, "disconnected"),
      ))
      .limit(1);
    return row ?? null;
  },

  /**
   * Rows for the user id in a Meta deauthorize / data-deletion signed_request, which may be either
   * the professional account id (external_user_id) or the app-scoped id. Disconnected rows included.
   */
  async listSocialConnectionsByMetaUserId(userId: string): Promise<SocialConnection[]> {
    return db.select().from(socialConnections)
      .where(and(
        eq(socialConnections.provider, PROVIDER),
        or(eq(socialConnections.externalUserId, userId), eq(socialConnections.appScopedUserId, userId)),
      ));
  },

  /** Insert or replace the account's connection: seals the token, status connected, clears last_error. */
  async upsertSocialConnection(accountId: number, fields: SocialConnectionFields): Promise<SocialConnection> {
    const now = new Date();
    const values = {
      externalUserId: fields.externalUserId,
      appScopedUserId: fields.appScopedUserId,
      username: fields.username,
      accountType: fields.accountType,
      profilePictureUrl: fields.profilePictureUrl,
      accessTokenEnc: seal(fields.accessToken),
      scopes: fields.scopes,
      tokenExpiresAt: fields.expiresAt,
      tokenRefreshedAt: now,
      status: "connected" as SocialConnectionStatus,
      lastError: null,
      expiryWarnedAt: null,
      connectedByUserId: fields.connectedByUserId,
      updatedAt: now,
    };
    const [row] = await db.insert(socialConnections)
      .values({ accountsId: accountId, provider: PROVIDER, ...values })
      .onConflictDoUpdate({ target: [socialConnections.accountsId, socialConnections.provider], set: values })
      .returning();
    return row;
  },

  async setSocialConnectionStatus(id: number, status: SocialConnectionStatus, lastError: string | null): Promise<void> {
    await db.update(socialConnections)
      .set({ status, lastError, updatedAt: new Date() })
      .where(eq(socialConnections.id, id));
  },

  /** Wipes the token and marks the connection disconnected. Scheduled posts fail at their own publish time. */
  async disconnectSocialConnection(accountId: number): Promise<void> {
    await db.update(socialConnections)
      .set({ accessTokenEnc: null, status: "disconnected", updatedAt: new Date() })
      .where(and(eq(socialConnections.accountsId, accountId), eq(socialConnections.provider, PROVIDER)));
  },

  async deleteSocialConnection(accountId: number): Promise<void> {
    await db.delete(socialConnections)
      .where(and(eq(socialConnections.accountsId, accountId), eq(socialConnections.provider, PROVIDER)));
  },

  /** The opened token, or null when there is none or it cannot be opened. Server-side use only. */
  getSocialAccessToken(conn: SocialConnection): string | null {
    if (!conn.accessTokenEnc) return null;
    try {
      return open(conn.accessTokenEnc);
    } catch (err: any) {
      console.error(`[social] could not open the token of connection ${conn.id}: ${err?.message ?? "unknown error"}`);
      return null;
    }
  },

  /** Stores a refreshed token. Skips a connection that was disconnected meanwhile, so a wiped token stays wiped. */
  async updateSocialToken(id: number, accessToken: string, expiresAt: Date): Promise<void> {
    const now = new Date();
    await db.update(socialConnections)
      .set({ accessTokenEnc: seal(accessToken), tokenExpiresAt: expiresAt, tokenRefreshedAt: now, expiryWarnedAt: null, updatedAt: now })
      .where(and(eq(socialConnections.id, id), ne(socialConnections.status, "disconnected")));
  },

  async markSocialExpiryWarned(id: number, at: Date): Promise<void> {
    await db.update(socialConnections).set({ expiryWarnedAt: at }).where(eq(socialConnections.id, id));
  },

  async listSocialConnectionsForRefresh(): Promise<SocialConnection[]> {
    return db.select().from(socialConnections)
      .where(and(eq(socialConnections.provider, PROVIDER), ne(socialConnections.status, "disconnected")));
  },

  /** Deletes the account's posts that never went live and returns them, so the caller can remove their video files. */
  async deleteUnpublishedSocialPosts(accountId: number): Promise<SocialPost[]> {
    return db.delete(socialPosts)
      .where(and(eq(socialPosts.accountsId, accountId), ne(socialPosts.status, "published")))
      .returning();
  },

  /** The account's posts except cancelled ones, newest scheduled time first. */
  async listSocialPosts(accountId: number): Promise<SocialPost[]> {
    return db.select().from(socialPosts)
      .where(and(eq(socialPosts.accountsId, accountId), ne(socialPosts.status, "cancelled")))
      .orderBy(desc(socialPosts.scheduledAt), desc(socialPosts.id));
  },

  /** Always scoped to the account: another account's post id is not found. */
  async getSocialPost(accountId: number, postId: number): Promise<SocialPost | null> {
    const [row] = await db.select().from(socialPosts)
      .where(and(eq(socialPosts.id, postId), eq(socialPosts.accountsId, accountId)))
      .limit(1);
    return row ?? null;
  },

  async getSocialPostByPublicId(publicId: string): Promise<SocialPost | null> {
    const [row] = await db.select().from(socialPosts)
      .where(eq(socialPosts.videoPublicId, publicId))
      .limit(1);
    return row ?? null;
  },

  async insertSocialPost(row: InsertSocialPost): Promise<SocialPost> {
    const [created] = await db.insert(socialPosts).values(row).returning();
    return created;
  },

  /**
   * UPDATE ... WHERE id = $1 AND status IN (...) [AND approval_status IN (...)] [AND caption / video unchanged] RETURNING *.
   * null when nothing matched: the publisher or another user changed the post first, and this write loses.
   */
  async updateSocialPostIf(
    postId: number,
    allowedStatuses: SocialPostStatus[],
    fields: Partial<InsertSocialPost>,
    opts: { approvalStatuses?: ApprovalStatus[]; content?: { caption: string; videoPublicId: string | null } } = {},
  ): Promise<SocialPost | null> {
    if (allowedStatuses.length === 0) return null;
    const conds: SQL[] = [eq(socialPosts.id, postId), inArray(socialPosts.status, allowedStatuses)];
    if (opts.approvalStatuses?.length) conds.push(inArray(socialPosts.approvalStatus, opts.approvalStatuses));
    if (opts.content) {
      conds.push(eq(socialPosts.caption, opts.content.caption));
      conds.push(opts.content.videoPublicId === null ? isNull(socialPosts.videoPublicId) : eq(socialPosts.videoPublicId, opts.content.videoPublicId));
    }
    const [row] = await db.update(socialPosts)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(...conds))
      .returning();
    return row ?? null;
  },

  /** Publisher: scheduled posts whose time has come, oldest first. */
  async listDueSocialPosts(now: Date): Promise<SocialPost[]> {
    return db.select().from(socialPosts)
      .where(and(eq(socialPosts.status, "scheduled"), lte(socialPosts.scheduledAt, now)))
      .orderBy(asc(socialPosts.scheduledAt), asc(socialPosts.id));
  },

  /** Publisher: posts with a container being processed (also what a restart leaves behind). */
  async listPublishingSocialPosts(): Promise<SocialPost[]> {
    return db.select().from(socialPosts).where(eq(socialPosts.status, "publishing")).orderBy(asc(socialPosts.id));
  },

  /** Publisher: posts still waiting for approval within 24 h of their time, not reminded yet. */
  async listPostsNeedingReminder(now: Date): Promise<SocialPost[]> {
    return db.select().from(socialPosts)
      .where(and(
        eq(socialPosts.status, "scheduled"),
        eq(socialPosts.requiresApproval, true),
        eq(socialPosts.approvalStatus, "pending"),
        isNull(socialPosts.approvalReminderSentAt),
        gt(socialPosts.scheduledAt, now),
        lte(socialPosts.scheduledAt, new Date(now.getTime() + 24 * 3_600_000)),
      ));
  },

  /** Display names for user ids: the full name, else the email. Unknown ids are left out. */
  async getSocialUserNames(ids: number[]): Promise<Map<number, string>> {
    const unique = [...new Set(ids)];
    const names = new Map<number, string>();
    if (unique.length === 0) return names;
    const rows = await db.select({ id: users.id, fullName: users.fullName1, email: users.email })
      .from(users)
      .where(inArray(users.id, unique));
    for (const r of rows) {
      const name = r.fullName?.trim() || r.email?.trim();
      if (r.id != null && name) names.set(r.id, name);
    }
    return names;
  },

  async setSocialEnabled(accountId: number, enabled: boolean): Promise<void> {
    await db.update(accounts).set({ socialEnabled: enabled }).where(eq(accounts.id, accountId));
  },

  async getSocialEnabled(accountId: number): Promise<boolean> {
    const [row] = await db.select({ socialEnabled: accounts.socialEnabled }).from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    return row?.socialEnabled === true;
  },
};
