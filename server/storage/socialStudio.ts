/**
 * Socials studio storage: per-account settings (caption style, voice guide, Sobre mim, DM mode),
 * topic ideas, scripts and the HeyGen videos already pulled. Every read and write is scoped to the
 * account: another account's id is simply not found.
 * Spec: docs/superpowers/specs/2026-10-20-caption-writer-and-studio-design.md
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import {
  socialHeygenPulls,
  socialScripts,
  socialSettings,
  socialTopics,
  type InsertSocialScript,
  type InsertSocialTopic,
  type SocialHeygenPull,
  type SocialScript,
  type SocialSettings,
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

  /** Throws a unique violation (23505) when this video was already pulled for the account. */
  async insertHeygenPull(row: { accountsId: number; heygenVideoId: string; scriptId: number | null; uploadId: string; pulledByUserId: number | null }): Promise<SocialHeygenPull> {
    const [created] = await db.insert(socialHeygenPulls).values(row).returning();
    return created;
  },
};
