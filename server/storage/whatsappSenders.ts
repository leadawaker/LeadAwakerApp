/**
 * Per-client WhatsApp Cloud API sender (specs/receptionist-channels Phase 4).
 *
 * One row per account in `WhatsApp_Senders`. The app secret and the
 * system-user token are sealed with secretBox on the way in and never come
 * back out: every read answers `hasAppSecret` / `hasToken` only. The engine
 * opens them with the same key when it sends.
 */
import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { whatsappSenders, whatsappTemplates, type WhatsappSender, type WhatsappTemplate } from "@shared/schema";
import { seal } from "../lib/secretBox";

export type WhatsappSenderStatus = "pending" | "connected" | "error" | "disabled";

/** What the CRM may show about a sender. No secrets. */
export interface WhatsappSenderPublic {
  accountId: number;
  wabaId: string;
  phoneNumberId: string;
  appId: string;
  hasAppSecret: boolean;
  hasToken: boolean;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  nameStatus: string | null;
  qualityRating: string | null;
  status: WhatsappSenderStatus;
  /** The engine's error code for the last failed test (e.g. "token_rejected"). */
  lastErrorCode: string | null;
  /** The same failure as an English sentence, with Meta's own message. */
  lastError: string | null;
  connectedAt: string | null;
  updatedAt: string | null;
}

export interface WhatsappSenderInput {
  wabaId: string;
  phoneNumberId: string;
  appId: string;
  /** Empty or missing keeps the stored secret. */
  appSecret?: string;
  /** Empty or missing keeps the stored token. */
  accessToken?: string;
}

export class WhatsappSenderError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** The engine stores failures as "<code>: <sentence>". */
function splitError(lastError: string | null): { code: string | null; text: string | null } {
  if (!lastError) return { code: null, text: null };
  const m = /^([a-z_]+): ([\s\S]*)$/.exec(lastError);
  return m ? { code: m[1], text: m[2] } : { code: null, text: lastError };
}

function toPublic(row: WhatsappSender): WhatsappSenderPublic {
  const err = splitError(row.lastError);
  return {
    accountId: row.accountsId,
    wabaId: row.wabaId,
    phoneNumberId: row.phoneNumberId,
    appId: row.appId,
    hasAppSecret: !!row.appSecretEnc,
    hasToken: !!row.accessTokenEnc,
    displayPhoneNumber: row.displayPhoneNumber,
    verifiedName: row.verifiedName,
    nameStatus: row.nameStatus,
    qualityRating: row.qualityRating,
    status: row.status as WhatsappSenderStatus,
    lastErrorCode: err.code,
    lastError: err.text,
    connectedAt: row.connectedAt ? row.connectedAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

export const whatsappSendersStorage = {
  async getWhatsappSender(accountId: number): Promise<WhatsappSenderPublic | null> {
    const [row] = await db.select().from(whatsappSenders).where(eq(whatsappSenders.accountsId, accountId));
    return row ? toPublic(row) : null;
  },

  /**
   * Create or update the account's sender. A new sender needs both secrets; on
   * an update an empty secret keeps the stored one. Any change to the details
   * puts the sender back to `pending` (the engine does not send from it until
   * "Test connection" passes again) and clears what Meta said about the old one.
   */
  async saveWhatsappSender(accountId: number, input: WhatsappSenderInput): Promise<WhatsappSenderPublic> {
    const [existing] = await db.select().from(whatsappSenders).where(eq(whatsappSenders.accountsId, accountId));
    const appSecret = input.appSecret?.trim() || "";
    const accessToken = input.accessToken?.trim() || "";

    const [taken] = await db.select({ accountsId: whatsappSenders.accountsId })
      .from(whatsappSenders).where(eq(whatsappSenders.phoneNumberId, input.phoneNumberId));
    if (taken && taken.accountsId !== accountId) {
      throw new WhatsappSenderError(409, "number_in_use", "This phone number id is already connected to another account");
    }

    if (!existing) {
      if (!appSecret || !accessToken) {
        throw new WhatsappSenderError(422, "secrets_required", "The app secret and the token are both needed the first time");
      }
      const [created] = await db.insert(whatsappSenders).values({
        accountsId: accountId,
        wabaId: input.wabaId,
        phoneNumberId: input.phoneNumberId,
        appId: input.appId,
        appSecretEnc: seal(appSecret),
        accessTokenEnc: seal(accessToken),
        status: "pending",
      }).returning();
      return toPublic(created);
    }

    const changed = !!appSecret || !!accessToken
      || existing.wabaId !== input.wabaId
      || existing.phoneNumberId !== input.phoneNumberId
      || existing.appId !== input.appId;
    if (!changed) return toPublic(existing);

    const numberChanged = existing.phoneNumberId !== input.phoneNumberId || existing.wabaId !== input.wabaId;
    const [updated] = await db.update(whatsappSenders).set({
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      appId: input.appId,
      ...(appSecret ? { appSecretEnc: seal(appSecret) } : {}),
      ...(accessToken ? { accessTokenEnc: seal(accessToken) } : {}),
      ...(numberChanged
        ? { displayPhoneNumber: null, verifiedName: null, nameStatus: null, qualityRating: null }
        : {}),
      status: "pending",
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(whatsappSenders.id, existing.id)).returning();
    return toPublic(updated);
  },

  /** Stored template rows of the account (the catalog itself lives in the engine). */
  async listWhatsappTemplates(accountId: number): Promise<WhatsappTemplate[]> {
    return db.select().from(whatsappTemplates)
      .where(eq(whatsappTemplates.accountsId, accountId))
      .orderBy(asc(whatsappTemplates.name), asc(whatsappTemplates.language));
  },
};
