/**
 * Number requests: the private link a client uses to hand in the details and
 * documents a carrier needs to register a phone number in their name.
 * The files themselves are never stored here (server/routes/numberRequests.ts
 * passes them on to Telnyx); a row keeps the answers and the Telnyx ids.
 */
import { randomBytes } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { numberRequests, type NumberRequest, type NumberRequestDocument, type NumberRequestOrder } from "@shared/schema";

export const NUMBER_DOC_KINDS = ["kvk", "id", "address"] as const;
export type NumberDocKind = (typeof NUMBER_DOC_KINDS)[number];

export const numberRequestsStorage = {
  /** The account's latest request, or null. */
  async getNumberRequest(accountId: number): Promise<NumberRequest | null> {
    const [row] = await db.select().from(numberRequests)
      .where(eq(numberRequests.accountsId, accountId)).orderBy(desc(numberRequests.id)).limit(1);
    return row ?? null;
  },

  async getNumberRequestByToken(token: string): Promise<NumberRequest | null> {
    const [row] = await db.select().from(numberRequests).where(eq(numberRequests.token, token));
    return row ?? null;
  },

  /** The account's open request, or a new one with a fresh link. */
  async openNumberRequest(accountId: number): Promise<NumberRequest> {
    const latest = await this.getNumberRequest(accountId);
    if (latest && latest.status === "open") return latest;
    const [row] = await db.insert(numberRequests)
      .values({ accountsId: accountId, token: randomBytes(18).toString("base64url") }).returning();
    return row;
  },

  async saveNumberRequestDetails(id: number, details: Record<string, string>): Promise<NumberRequest> {
    const [row] = await db.update(numberRequests)
      .set({ details, updatedAt: new Date() }).where(eq(numberRequests.id, id)).returning();
    return row;
  },

  /** Adds the document, replacing an earlier one of the same kind. Returns the replaced one, if any. */
  async putNumberRequestDocument(row: NumberRequest, doc: NumberRequestDocument): Promise<NumberRequestDocument | null> {
    const replaced = row.documents.find((d) => d.kind === doc.kind) ?? null;
    const documents = [...row.documents.filter((d) => d.kind !== doc.kind), doc];
    await db.update(numberRequests).set({ documents, updatedAt: new Date() }).where(eq(numberRequests.id, row.id));
    return replaced;
  },

  async saveNumberRequestPlan(id: number, plan: { areaCode?: string | null; preferredNumber?: string | null; autoOrder?: boolean }): Promise<NumberRequest> {
    const [row] = await db.update(numberRequests)
      .set({ ...plan, updatedAt: new Date() }).where(eq(numberRequests.id, id)).returning();
    return row;
  },

  async saveNumberRequestOrder(id: number, numberOrder: NumberRequestOrder): Promise<NumberRequest> {
    const [row] = await db.update(numberRequests)
      .set({ numberOrder, updatedAt: new Date() }).where(eq(numberRequests.id, id)).returning();
    return row;
  },

  /** Open -> submitted, once: null when another request got there first. */
  async submitNumberRequest(id: number): Promise<NumberRequest | null> {
    const now = new Date();
    const [row] = await db.update(numberRequests)
      .set({ status: "submitted", submittedAt: now, updatedAt: now })
      .where(and(eq(numberRequests.id, id), eq(numberRequests.status, "open"))).returning();
    return row ?? null;
  },
};
