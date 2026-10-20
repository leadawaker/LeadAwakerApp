/**
 * Insights storage (Phase D): the account's media as Instagram lists them, metric snapshots keyed by
 * bucket (writing a bucket again replaces it), and the collector's per-account state.
 * Spec: docs/superpowers/specs/2026-10-20-insights-design.md
 */
import { and, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import {
  socialInsightMedia,
  socialInsightSnapshots,
  socialInsightState,
  type InsertSocialInsightSnapshot,
  type SocialInsightMedia,
} from "@shared/schema";

const S = "p2mxx34fvbf3ll6";

export const socialInsightsStorage = {
  async getInsightState(accountId: number) {
    const [row] = await db.select().from(socialInsightState).where(eq(socialInsightState.accountsId, accountId)).limit(1);
    return row ?? null;
  },

  async setInsightState(accountId: number, fields: { backfilledAt?: Date; lastAccountRunAt?: Date; lastError?: string | null }): Promise<void> {
    await db.insert(socialInsightState).values({ accountsId: accountId, ...fields })
      .onConflictDoUpdate({ target: socialInsightState.accountsId, set: fields });
  },

  /** New media are added, known ones get their permalink and caption refreshed; then CRM posts are linked by media id. */
  async upsertInsightMedia(accountId: number, media: { id: string; mediaType: string | null; productType: string | null; permalink: string | null; caption: string; postedAt: Date | null }[]): Promise<void> {
    for (const m of media) {
      const values = { mediaType: m.mediaType, productType: m.productType, permalink: m.permalink, caption: m.caption.slice(0, 2200), postedAt: m.postedAt };
      await db.insert(socialInsightMedia).values({ accountsId: accountId, igMediaId: m.id, ...values })
        .onConflictDoUpdate({ target: [socialInsightMedia.accountsId, socialInsightMedia.igMediaId], set: values });
    }
    await db.execute(sql`
      UPDATE ${sql.raw(`"${S}"."Social_Insight_Media"`)} m SET post_id = p.id
      FROM ${sql.raw(`"${S}"."Social_Posts"`)} p
      WHERE m.accounts_id = ${accountId} AND m.post_id IS NULL AND p.accounts_id = m.accounts_id AND p.ig_media_id = m.ig_media_id`);
  },

  async listInsightMedia(accountId: number, limit: number): Promise<SocialInsightMedia[]> {
    return db.select().from(socialInsightMedia).where(eq(socialInsightMedia.accountsId, accountId))
      .orderBy(sql`${socialInsightMedia.postedAt} DESC NULLS LAST`, desc(socialInsightMedia.id)).limit(limit);
  },

  async markInsightMediaPolled(accountId: number, igMediaId: string, at: Date): Promise<void> {
    await db.update(socialInsightMedia).set({ lastPolledAt: at })
      .where(and(eq(socialInsightMedia.accountsId, accountId), eq(socialInsightMedia.igMediaId, igMediaId)));
  },

  async upsertInsightSnapshots(rows: InsertSocialInsightSnapshot[]): Promise<void> {
    if (rows.length === 0) return;
    await db.insert(socialInsightSnapshots).values(rows).onConflictDoUpdate({
      target: [socialInsightSnapshots.accountsId, socialInsightSnapshots.scope, socialInsightSnapshots.igMediaId, socialInsightSnapshots.metric, socialInsightSnapshots.bucket],
      set: { value: sql`excluded.value`, skippedReason: sql`excluded.skipped_reason`, capturedAt: sql`now()` },
    });
  },

  /** Each media item's newest value per metric (skips left out). */
  async latestMediaValues(accountId: number): Promise<{ igMediaId: string; metric: string; value: number; bucket: string }[]> {
    const r = await db.execute(sql`
      SELECT DISTINCT ON (ig_media_id, metric) ig_media_id AS "igMediaId", metric, value, bucket
      FROM ${sql.raw(`"${S}"."Social_Insight_Snapshots"`)}
      WHERE accounts_id = ${accountId} AND scope = 'media' AND value IS NOT NULL
      ORDER BY ig_media_id, metric, bucket DESC`);
    return (r.rows as any[]).map((x) => ({ igMediaId: String(x.igMediaId), metric: String(x.metric), value: Number(x.value), bucket: String(x.bucket) }));
  },

  /** Account rows (day totals, followers) from a day on. */
  async accountSnapshots(accountId: number, sinceDay: string): Promise<{ metric: string; bucket: string; value: number }[]> {
    const rows = await db.select({ metric: socialInsightSnapshots.metric, bucket: socialInsightSnapshots.bucket, value: socialInsightSnapshots.value })
      .from(socialInsightSnapshots)
      .where(and(eq(socialInsightSnapshots.accountsId, accountId), eq(socialInsightSnapshots.scope, "account"), gte(socialInsightSnapshots.bucket, sinceDay), isNotNull(socialInsightSnapshots.value)));
    return rows.map((r) => ({ metric: r.metric, bucket: r.bucket, value: Number(r.value) }));
  },

  /** Metrics Meta refused for this account since a moment (shown in the UI as "not available"). */
  async skippedMetrics(accountId: number, since: Date): Promise<string[]> {
    const rows = await db.selectDistinct({ metric: socialInsightSnapshots.metric }).from(socialInsightSnapshots)
      .where(and(eq(socialInsightSnapshots.accountsId, accountId), isNull(socialInsightSnapshots.value), gte(socialInsightSnapshots.capturedAt, since)));
    return rows.map((r) => r.metric).sort();
  },
};
