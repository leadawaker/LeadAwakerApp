import { eq, and, desc, gte, lte } from "drizzle-orm";
import { db } from "../db";
import {
  calendarConnections,
  calendarBlocks,
  type CalendarConnection,
  type InsertCalendarConnection,
  type CalendarBlock,
} from "@shared/schema";

export const calendarStorage = {
  async listCalendarConnections(accountId: number): Promise<CalendarConnection[]> {
    return db
      .select()
      .from(calendarConnections)
      .where(eq(calendarConnections.accountId, accountId))
      .orderBy(desc(calendarConnections.updatedAt));
  },

  async getCalendarConnection(accountId: number, provider: string): Promise<CalendarConnection | undefined> {
    const [row] = await db
      .select()
      .from(calendarConnections)
      .where(and(eq(calendarConnections.accountId, accountId), eq(calendarConnections.provider, provider)));
    return row;
  },

  /** Upsert keyed by (accountId, provider). */
  async upsertCalendarConnection(data: InsertCalendarConnection): Promise<CalendarConnection> {
    const existing = await this.getCalendarConnection(data.accountId, data.provider);
    if (existing) {
      const [row] = await db
        .update(calendarConnections)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(calendarConnections.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db.insert(calendarConnections).values(data as any).returning();
    return row;
  },

  async deleteCalendarConnection(accountId: number, provider: string): Promise<boolean> {
    const result = await db
      .delete(calendarConnections)
      .where(and(eq(calendarConnections.accountId, accountId), eq(calendarConnections.provider, provider)))
      .returning();
    return result.length > 0;
  },

  // ─── White-label custom booking domain (stored on the `caldiy` row) ─────────

  /** Set / clear the account's custom booking domain + status on its caldiy row. */
  async setCustomDomain(
    accountId: number,
    customDomain: string | null,
    customDomainStatus: string | null,
  ): Promise<CalendarConnection | undefined> {
    const [row] = await db
      .update(calendarConnections)
      .set({ customDomain, customDomainStatus, updatedAt: new Date() })
      .where(and(eq(calendarConnections.accountId, accountId), eq(calendarConnections.provider, "caldiy")))
      .returning();
    return row;
  },

  /** Reverse lookup by host — used by the Cloudflare Worker rewrite layer. */
  async getCalendarConnectionByCustomDomain(domain: string): Promise<CalendarConnection | undefined> {
    const [row] = await db
      .select()
      .from(calendarConnections)
      .where(eq(calendarConnections.customDomain, domain));
    return row;
  },

  /** Lookup by caldiy username — used by the Cal.diy email white-labelling. */
  async getCaldiyConnectionByUsername(username: string): Promise<CalendarConnection | undefined> {
    const [row] = await db
      .select()
      .from(calendarConnections)
      .where(and(eq(calendarConnections.provider, "caldiy"), eq(calendarConnections.externalId, username)));
    return row;
  },

  // ─── Calendar Blocks ──────────────────────────────────────────────────────

  async getCalendarBlock(id: number): Promise<CalendarBlock | undefined> {
    const [row] = await db.select().from(calendarBlocks).where(eq(calendarBlocks.id, id));
    return row;
  },

  async listCalendarBlocks(accountId: number, from?: Date, to?: Date): Promise<CalendarBlock[]> {
    return db
      .select()
      .from(calendarBlocks)
      .where(
        and(
          eq(calendarBlocks.accountId, accountId),
          ...(from ? [gte(calendarBlocks.endsAt, from)] : []),
          ...(to ? [lte(calendarBlocks.startsAt, to)] : []),
        ),
      );
  },

  async createCalendarBlock(data: {
    accountId: number;
    startsAt: Date;
    endsAt: Date;
    allDay: boolean;
    label?: string | null;
    createdBy?: number | null;
  }): Promise<CalendarBlock> {
    const [row] = await db
      .insert(calendarBlocks)
      .values({ ...data, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return row;
  },

  async updateCalendarBlock(id: number, accountId: number, data: {
    startsAt?: Date;
    endsAt?: Date;
    allDay?: boolean;
    label?: string | null;
  }): Promise<CalendarBlock | undefined> {
    const [row] = await db
      .update(calendarBlocks)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(calendarBlocks.id, id), eq(calendarBlocks.accountId, accountId)))
      .returning();
    return row;
  },

  async deleteCalendarBlock(id: number, accountId: number): Promise<boolean> {
    const result = await db
      .delete(calendarBlocks)
      .where(and(eq(calendarBlocks.id, id), eq(calendarBlocks.accountId, accountId)))
      .returning();
    return result.length > 0;
  },
};
