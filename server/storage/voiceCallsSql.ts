import { sql } from "drizzle-orm";
import { accounts, campaigns, interactions, leads, voiceCalls } from "@shared/schema";

/*
 * Live-table names this file relies on (schema p2mxx34fvbf3ll6, checked with \d):
 *   Campaigns:     id, is_demo
 *   Leads:         id, demo_niche, channel_identifier, phone, "Conversion_Status"
 *   Voice_Numbers: id, accounts_id, client_niche, enabled
 *   Accounts:      id, name
 * Voice_Numbers has no Drizzle table, so it is written out below.
 */
const VOICE_NUMBERS = sql.raw(`"p2mxx34fvbf3ll6"."Voice_Numbers"`);

/**
 * A call is Demo when ANY of these holds (spec "Classification"), else Live:
 *  1. its campaign is a demo campaign,
 *  2. its lead carries a demo marker,
 *  3. its voice line is the agency demo line (client_niche IS NULL), or it has
 *     no line and no campaign at all (the browser /voice-demo).
 * Computed per query, never stored, so there is nothing to backfill.
 */
export const isDemoSql = sql<boolean>`(
  EXISTS (SELECT 1 FROM ${campaigns} c WHERE c.id = ${voiceCalls.campaignsId} AND c.is_demo = true)
  OR EXISTS (SELECT 1 FROM ${leads} l WHERE l.id = ${voiceCalls.leadsId}
             AND (l.demo_niche IS NOT NULL
                  OR l.channel_identifier LIKE 'wa-demo:%'
                  OR l.channel_identifier LIKE 'web-demo:%'))
  OR EXISTS (SELECT 1 FROM ${VOICE_NUMBERS} n WHERE n.id = ${voiceCalls.voiceNumbersId} AND n.client_niche IS NULL)
  OR (${voiceCalls.voiceNumbersId} IS NULL AND ${voiceCalls.campaignsId} IS NULL)
)`;

// A call closed by wrap-up has ended_at. A tab closed first leaves it null, so
// fall back to the call's last transcript turn.
export const lastTurnAt = sql<string | null>`(
  SELECT max(i.created_at) FROM ${interactions} i
  WHERE i.conversation_thread_id = ${voiceCalls.callId}
)`;

export const durationSecondsSql = sql<number | null>`EXTRACT(EPOCH FROM (COALESCE(${voiceCalls.endedAt}, ${lastTurnAt}) - ${voiceCalls.startedAt}))`;

export const leadStatusOf = sql<string | null>`(
  SELECT l."Conversion_Status" FROM ${leads} l WHERE l.id = ${voiceCalls.leadsId}
)`;

// Calls from before the demo made up numbers share a lead whose phone is the
// placeholder "web": that is not a number, so it reads as none.
export const leadPhoneOf = sql<string | null>`(
  SELECT NULLIF(l.phone, 'web') FROM ${leads} l WHERE l.id = ${voiceCalls.leadsId}
)`;

export const accountNameOf = sql<string | null>`(
  SELECT a.name FROM ${accounts} a WHERE a.id = ${voiceCalls.accountsId}
)`;

/** `EXISTS` over enabled client lines (client_niche set), for one account or any. */
export function hasEnabledClientLineSql(accountId: number | null) {
  return sql<boolean>`EXISTS (
    SELECT 1 FROM ${VOICE_NUMBERS} n
    WHERE n.enabled = true AND n.client_niche IS NOT NULL
    ${accountId === null ? sql`` : sql`AND n.accounts_id = ${accountId}`}
  )`;
}
