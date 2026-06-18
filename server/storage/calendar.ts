import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import {
  calendarConnections,
  type CalendarConnection,
  type InsertCalendarConnection,
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
};
