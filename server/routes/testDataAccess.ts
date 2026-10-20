import type { Request } from "express";
import { sql } from "drizzle-orm";
import { interactions, leads, voiceCalls } from "@shared/schema";
import { hidesTestData, resolveVoiceAccess } from "./voiceCallsAccess";

/** True when this request must not see is_test leads/calls (clients, and the Owner viewing as one). */
export function requestHidesTestData(req: Request): boolean {
  const user = req.user;
  if (!user) return true;
  return hidesTestData(
    resolveVoiceAccess({
      role: user.role,
      accountsId: user.accountsId ?? null,
      impersonatedAccountId: req.session?.impersonation?.accountId ?? null,
      impersonatedRole: req.session?.impersonation?.role ?? null,
    }),
  );
}

/** Drizzle fragment: interaction `interactions` row is not on a test lead and not part of a test call. */
export const notTestInteractionSql = sql`(
  NOT EXISTS (SELECT 1 FROM ${leads} tl WHERE tl.id = ${interactions.leadsId} AND tl.is_test = true)
  AND NOT EXISTS (SELECT 1 FROM ${voiceCalls} tv WHERE tv.call_id = ${interactions.conversationThreadId} AND tv.is_test = true)
)`;
