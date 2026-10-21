/**
 * Socials studio storage: per-account settings (caption style, voice guide, Sobre mim, DM mode),
 * topic ideas, scripts, their tags and the HeyGen videos already pulled. Every read and write is scoped to the
 * account: another account's id is simply not found.
 * Spec: docs/superpowers/specs/2026-10-20-caption-writer-and-studio-design.md
 */
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  socialHeygenPulls,
  socialScripts,
  socialSettings,
  socialTags,
  socialTopics,
  type InsertSocialScript,
  type InsertSocialTopic,
  type SocialHeygenPull,
  type SocialScript,
  type SocialSettings,
  type SocialTag,
  type SocialTopic,
} from "@shared/schema";

export type SocialSettingsFields = Partial<Pick<SocialSettings, "captionStyle" | "voiceGuide" | "aboutMe" | "dmMode" | "dmHourlyCap">>;

export const socialStudioStorage = {
  async getSocialSettings(accountId: number): Promise<SocialSettings | null> {
    const [row] = await db.select().from(socialSettings).where(eq(socialSettings.accountsId, accountId)).limit(1);
    return row ?? null;
  },

  /** Insert the account's row or change the given fields only. */
  async upsertSocialSettings(accountId: number, fields: SocialSettingsFields, userId: number | null): Promise<SocialSettings> {
    const now = new Date();
    const set = { ...fields, updatedByUserId: userId, updatedAt: now };
    const [row] = await db.insert(socialSettings)
      .values({ accountsId: accountId, ...set })
      .onConflictDoUpdate({ target: socialSettings.accountsId, set })
      .returning();
    return row;
  },

  async listSocialTopics(accountId: number): Promise<SocialTopic[]> {
    return db.select().from(socialTopics)
      .where(eq(socialTopics.accountsId, accountId))
      .orderBy(desc(socialTopics.createdAt), desc(socialTopics.id));
  },

  async insertSocialTopic(row: InsertSocialTopic): Promise<SocialTopic> {
    const [created] = await db.insert(socialTopics).values(row).returning();
    return created;
  },

  async updateSocialTopic(accountId: number, topicId: number, fields: Partial<InsertSocialTopic>): Promise<SocialTopic | null> {
    const [row] = await db.update(socialTopics)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(socialTopics.id, topicId), eq(socialTopics.accountsId, accountId)))
      .returning();
    return row ?? null;
  },

  async listSocialScripts(accountId: number): Promise<SocialScript[]> {
    return db.select().from(socialScripts)
      .where(eq(socialScripts.accountsId, accountId))
      .orderBy(desc(socialScripts.updatedAt), desc(socialScripts.id));
  },

  async getSocialScript(accountId: number, scriptId: number): Promise<SocialScript | null> {
    const [row] = await db.select().from(socialScripts)
      .where(and(eq(socialScripts.id, scriptId), eq(socialScripts.accountsId, accountId)))
      .limit(1);
    return row ?? null;
  },

  async insertSocialScript(row: InsertSocialScript): Promise<SocialScript> {
    const [created] = await db.insert(socialScripts).values(row).returning();
    return created;
  },

  async updateSocialScript(accountId: number, scriptId: number, fields: Partial<InsertSocialScript>): Promise<SocialScript | null> {
    const [row] = await db.update(socialScripts)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(socialScripts.id, scriptId), eq(socialScripts.accountsId, accountId)))
      .returning();
    return row ?? null;
  },

  /** A script still holds this upload (a pulled or uploaded video waiting to be scheduled). */
  async isUploadHeldByScript(uploadId: string): Promise<boolean> {
    const [row] = await db.select({ id: socialScripts.id }).from(socialScripts).where(eq(socialScripts.videoUploadId, uploadId)).limit(1);
    return !!row;
  },

  async listHeygenPulls(accountId: number): Promise<SocialHeygenPull[]> {
    return db.select().from(socialHeygenPulls).where(eq(socialHeygenPulls.accountsId, accountId));
  },

  async deleteHeygenPull(accountId: number, heygenVideoId: string): Promise<void> {
    await db.delete(socialHeygenPulls).where(and(eq(socialHeygenPulls.accountsId, accountId), eq(socialHeygenPulls.heygenVideoId, heygenVideoId)));
  },

  async listSocialTags(accountId: number): Promise<SocialTag[]> {
    return db.select().from(socialTags).where(eq(socialTags.accountsId, accountId)).orderBy(asc(socialTags.name), asc(socialTags.id));
  },

  /** Throws a unique violation (23505) when the account already has a tag with that name (ignoring case). */
  async insertSocialTag(row: { accountsId: number; name: string; color: string }): Promise<SocialTag> {
    const [created] = await db.insert(socialTags).values(row).returning();
    return created;
  },

  /** Throws 23505 on a rename to a name the account already uses. */
  async updateSocialTag(accountId: number, tagId: number, fields: { name?: string; color?: string }): Promise<SocialTag | null> {
    const [row] = await db.update(socialTags)
      .set(fields)
      .where(and(eq(socialTags.id, tagId), eq(socialTags.accountsId, accountId)))
      .returning();
    return row ?? null;
  },

  /** Sets an idea's tags. Leaves updated_at alone, so tagging does not reorder the list. */
  async setSocialTopicTags(accountId: number, topicId: number, tagIds: number[]): Promise<SocialTopic | null> {
    const [row] = await db.update(socialTopics).set({ tagIds })
      .where(and(eq(socialTopics.id, topicId), eq(socialTopics.accountsId, accountId)))
      .returning();
    return row ?? null;
  },

  /** Sets a script's tags. Leaves updated_at alone, so tagging does not reorder the board. */
  async setSocialScriptTags(accountId: number, scriptId: number, tagIds: number[]): Promise<SocialScript | null> {
    const [row] = await db.update(socialScripts).set({ tagIds })
      .where(and(eq(socialScripts.id, scriptId), eq(socialScripts.accountsId, accountId)))
      .returning();
    return row ?? null;
  },

  /** Removes the tag and takes its id off the account's ideas and scripts, in one transaction. */
  async deleteSocialTag(accountId: number, tagId: number): Promise<boolean> {
    return db.transaction(async (tx) => {
      const gone = await tx.delete(socialTags).where(and(eq(socialTags.id, tagId), eq(socialTags.accountsId, accountId))).returning({ id: socialTags.id });
      if (gone.length === 0) return false;
      await tx.update(socialTopics)
        .set({ tagIds: sql`array_remove(${socialTopics.tagIds}, ${tagId}::integer)` })
        .where(and(eq(socialTopics.accountsId, accountId), sql`${tagId}::integer = ANY(${socialTopics.tagIds})`));
      await tx.update(socialScripts)
        .set({ tagIds: sql`array_remove(${socialScripts.tagIds}, ${tagId}::integer)` })
        .where(and(eq(socialScripts.accountsId, accountId), sql`${tagId}::integer = ANY(${socialScripts.tagIds})`));
      return true;
    });
  },

  /** Throws a unique violation (23505) when this video was already pulled for the account. */
  async insertHeygenPull(row: { accountsId: number; heygenVideoId: string; scriptId: number | null; uploadId: string; pulledByUserId: number | null }): Promise<SocialHeygenPull> {
    const [created] = await db.insert(socialHeygenPulls).values(row).returning();
    return created;
  },
};
