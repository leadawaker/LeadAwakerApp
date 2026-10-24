/**
 * Thumbnail creator storage: reference images, saved styles and generated thumbnails. Every read and
 * write is scoped to the account: another account's id is simply not found.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  socialThumbnailRefs,
  socialThumbnailStyles,
  socialThumbnails,
  type InsertSocialThumbnail,
  type InsertSocialThumbnailRef,
  type InsertSocialThumbnailStyle,
  type SocialThumbnail,
  type SocialThumbnailRef,
  type SocialThumbnailStyle,
} from "@shared/schema";

/** The gallery shows the newest ones; older rows stay in the table. */
const THUMBNAIL_LIST_LIMIT = 120;

export const socialThumbnailsStorage = {
  // ─── Reference images ─────────────────────────────────────────────────────
  async listThumbnailRefs(accountId: number): Promise<SocialThumbnailRef[]> {
    return db.select().from(socialThumbnailRefs)
      .where(eq(socialThumbnailRefs.accountsId, accountId))
      .orderBy(desc(socialThumbnailRefs.createdAt), desc(socialThumbnailRefs.id));
  },

  async getThumbnailRef(accountId: number, refId: number): Promise<SocialThumbnailRef | null> {
    const [row] = await db.select().from(socialThumbnailRefs)
      .where(and(eq(socialThumbnailRefs.id, refId), eq(socialThumbnailRefs.accountsId, accountId)))
      .limit(1);
    return row ?? null;
  },

  async insertThumbnailRef(row: InsertSocialThumbnailRef): Promise<SocialThumbnailRef> {
    const [created] = await db.insert(socialThumbnailRefs).values(row).returning();
    return created;
  },

  async deleteThumbnailRef(accountId: number, refId: number): Promise<SocialThumbnailRef | null> {
    const [row] = await db.delete(socialThumbnailRefs)
      .where(and(eq(socialThumbnailRefs.id, refId), eq(socialThumbnailRefs.accountsId, accountId)))
      .returning();
    return row ?? null;
  },

  // ─── Styles ───────────────────────────────────────────────────────────────
  async listThumbnailStyles(accountId: number): Promise<SocialThumbnailStyle[]> {
    return db.select().from(socialThumbnailStyles)
      .where(eq(socialThumbnailStyles.accountsId, accountId))
      .orderBy(socialThumbnailStyles.name);
  },

  async insertThumbnailStyle(row: InsertSocialThumbnailStyle): Promise<SocialThumbnailStyle> {
    const [created] = await db.insert(socialThumbnailStyles).values(row).returning();
    return created;
  },

  async updateThumbnailStyle(accountId: number, styleId: number, fields: Partial<InsertSocialThumbnailStyle>): Promise<SocialThumbnailStyle | null> {
    const [row] = await db.update(socialThumbnailStyles)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(socialThumbnailStyles.id, styleId), eq(socialThumbnailStyles.accountsId, accountId)))
      .returning();
    return row ?? null;
  },

  async deleteThumbnailStyle(accountId: number, styleId: number): Promise<boolean> {
    const rows = await db.delete(socialThumbnailStyles)
      .where(and(eq(socialThumbnailStyles.id, styleId), eq(socialThumbnailStyles.accountsId, accountId)))
      .returning({ id: socialThumbnailStyles.id });
    return rows.length > 0;
  },

  // ─── Thumbnails ───────────────────────────────────────────────────────────
  async listThumbnails(accountId: number): Promise<SocialThumbnail[]> {
    return db.select().from(socialThumbnails)
      .where(eq(socialThumbnails.accountsId, accountId))
      .orderBy(desc(socialThumbnails.createdAt), desc(socialThumbnails.id))
      .limit(THUMBNAIL_LIST_LIMIT);
  },

  async getThumbnail(accountId: number, thumbId: number): Promise<SocialThumbnail | null> {
    const [row] = await db.select().from(socialThumbnails)
      .where(and(eq(socialThumbnails.id, thumbId), eq(socialThumbnails.accountsId, accountId)))
      .limit(1);
    return row ?? null;
  },

  async insertThumbnails(rows: InsertSocialThumbnail[]): Promise<SocialThumbnail[]> {
    if (rows.length === 0) return [];
    return db.insert(socialThumbnails).values(rows).returning();
  },

  /** Not scoped to an account: the generation job only knows the row ids it created. */
  async updateThumbnails(ids: number[], fields: Partial<InsertSocialThumbnail>): Promise<void> {
    if (ids.length === 0) return;
    await db.update(socialThumbnails).set({ ...fields, updatedAt: new Date() }).where(inArray(socialThumbnails.id, ids));
  },

  async setThumbnailStarred(accountId: number, thumbId: number, starred: boolean): Promise<SocialThumbnail | null> {
    const [row] = await db.update(socialThumbnails)
      .set({ starred, updatedAt: new Date() })
      .where(and(eq(socialThumbnails.id, thumbId), eq(socialThumbnails.accountsId, accountId)))
      .returning();
    return row ?? null;
  },

  async deleteThumbnail(accountId: number, thumbId: number): Promise<SocialThumbnail | null> {
    const [row] = await db.delete(socialThumbnails)
      .where(and(eq(socialThumbnails.id, thumbId), eq(socialThumbnails.accountsId, accountId)))
      .returning();
    return row ?? null;
  },
};
