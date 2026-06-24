/**
 * Storage barrel — composes the domain storage modules in server/storage/
 * into a single `storage` object with the same method names as the old
 * DatabaseStorage class, so no consumer import changes.
 */
import { count, SQL } from "drizzle-orm";
import { db } from "./db";

import { accountsStorage } from "./storage/accounts";
import { prospectsStorage } from "./storage/prospects";
import { campaignsStorage } from "./storage/campaigns";
import { leadsStorage } from "./storage/leads";
import { interactionsStorage } from "./storage/interactions";
import { automationStorage } from "./storage/automation";
import { notificationsStorage } from "./storage/notifications";
import { billingStorage } from "./storage/billing";
import { tasksStorage } from "./storage/tasks";
import { agentsStorage } from "./storage/agents";
import { calendarStorage } from "./storage/calendar";
import { reviewsStorage } from "./storage/reviews";
import { miscStorage } from "./storage/misc";

export type { NotificationItem, ProspectsListParams } from "./storage/types";

// ─── Pagination helpers ───────────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  limit: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Generic paginated query. Works with any Drizzle table.
 * Pass an optional `where` clause to filter.
 */
export async function paginatedQuery<T>(
  table: any,
  params: PaginationParams,
  where?: SQL,
): Promise<PaginatedResult<T>> {
  const { page, limit } = params;
  const offset = (page - 1) * limit;

  // Count total and fetch page in parallel — both queries are independent
  let countQuery = db.select({ total: count() }).from(table);
  if (where) countQuery = countQuery.where(where) as any;

  let dataQuery = db.select().from(table);
  if (where) dataQuery = dataQuery.where(where) as any;
  dataQuery = dataQuery.limit(limit).offset(offset) as any;

  const [[{ total }], data] = await Promise.all([countQuery, dataQuery]);

  return { data: data as T[], total, page, limit };
}

// Composed storage object. `this.x()` calls inside modules still resolve
// because every method ends up on this one object.
export const storage = {
  ...accountsStorage,
  ...prospectsStorage,
  ...campaignsStorage,
  ...leadsStorage,
  ...interactionsStorage,
  ...automationStorage,
  ...notificationsStorage,
  ...billingStorage,
  ...tasksStorage,
  ...agentsStorage,
  ...calendarStorage,
  ...reviewsStorage,
  ...miscStorage,
};
