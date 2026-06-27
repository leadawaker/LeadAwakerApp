import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  accountReviews,
  type AccountReview,
  type InsertAccountReview,
} from "@shared/schema";

export const reviewsStorage = {
  async listReviewsForAccount(accountId: number, statuses?: string[]): Promise<AccountReview[]> {
    const where = statuses && statuses.length
      ? and(eq(accountReviews.accountsId, accountId), inArray(accountReviews.status, statuses))
      : eq(accountReviews.accountsId, accountId);
    return db
      .select()
      .from(accountReviews)
      .where(where)
      .orderBy(desc(accountReviews.reviewCreatedAt));
  },

  async getReviewById(id: number): Promise<AccountReview | undefined> {
    const [row] = await db.select().from(accountReviews).where(eq(accountReviews.id, id));
    return row;
  },

  async getReviewByExternalId(accountId: number, externalReviewId: string): Promise<AccountReview | undefined> {
    const [row] = await db
      .select()
      .from(accountReviews)
      .where(and(eq(accountReviews.accountsId, accountId), eq(accountReviews.externalReviewId, externalReviewId)));
    return row;
  },

  /** Insert a freshly-polled review. Dedup is enforced by the (account, external id) unique index. */
  async insertReview(data: InsertAccountReview): Promise<AccountReview> {
    const [row] = await db.insert(accountReviews).values(data as any).returning();
    return row;
  },

  async updateReview(id: number, patch: Partial<InsertAccountReview>): Promise<AccountReview | undefined> {
    const [row] = await db
      .update(accountReviews)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(accountReviews.id, id))
      .returning();
    return row;
  },

  /** Mark all still-pending reviews for an account as skipped (e.g. on disconnect). */
  async skipPendingReviews(accountId: number): Promise<void> {
    await db
      .update(accountReviews)
      .set({ status: "skipped", updatedAt: new Date() })
      .where(and(eq(accountReviews.accountsId, accountId), inArray(accountReviews.status, ["new", "drafted"])));
  },

  /** Reviews ready to post — drafted positives queued for auto-posting by the poller. */
  async listAutoPostable(accountId: number): Promise<AccountReview[]> {
    return db
      .select()
      .from(accountReviews)
      .where(and(eq(accountReviews.accountsId, accountId), eq(accountReviews.status, "drafted")));
  },
};
