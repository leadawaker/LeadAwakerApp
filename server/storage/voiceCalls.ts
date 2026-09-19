import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { interactions, leads, voiceCalls, type VoiceCall, type VoiceCallSummary } from "@shared/schema";

export interface VoiceCallListItem {
  callId: string;
  sessionId: string | null;
  leadsId: number | null;
  callerName: string | null;
  language: string | null;
  startedAt: string;
  durationSeconds: number | null;
  turnCount: number;
  bookedSlot: string | null;
  bookedIso: string | null;
  outcome: string | null;
  /** What the caller raised, from the recap; drives the avatar colour. */
  intents: string[];
  /** The linked lead's pipeline status, so a DND lead shows as such. */
  leadStatus: string | null;
}

export interface VoiceCallTurn {
  id: number;
  who: string | null;
  direction: string | null;
  content: string | null;
  createdAt: string | null;
}

export interface VoiceCallDetail extends VoiceCallListItem {
  summary: VoiceCallSummary | null;
  turns: VoiceCallTurn[];
}

/**
 * `record_summary` stores tool arguments verbatim, and `/voice/relay` is
 * unauthenticated, so `summary` in the DB may be `{}`, missing `items`, or
 * have non-string fields. Coerce it into something the detail pane can
 * safely `.items.length`/`.map` and render, dropping anything that does not
 * fit rather than throwing.
 */
function normalizeSummary(raw: unknown): VoiceCallSummary | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name : null;
  const outcome = typeof obj.outcome === "string" ? obj.outcome : null;
  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const items = rawItems
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      intent: typeof item.intent === "string" ? item.intent : "",
      interest: typeof item.interest === "string" ? item.interest : null,
      notes: typeof item.notes === "string" ? item.notes : null,
    }))
    .filter((item) => item.intent !== "");
  return { name, outcome, items };
}

// A call closed by wrap-up has ended_at. A tab closed first leaves it null, so
// fall back to the call's last transcript turn.
const lastTurnAt = sql<string | null>`(
  SELECT max(i.created_at) FROM ${interactions} i
  WHERE i.conversation_thread_id = ${voiceCalls.callId}
)`;

const leadStatusOf = sql<string | null>`(
  SELECT l."Conversion_Status" FROM ${leads} l WHERE l.id = ${voiceCalls.leadsId}
)`;

function toItem(row: VoiceCall, lastTurn: string | Date | null, leadStatus: string | null): VoiceCallListItem {
  const end = row.endedAt ?? (lastTurn ? new Date(lastTurn) : null);
  const durationSeconds = end
    ? Math.max(0, Math.round((end.getTime() - row.startedAt.getTime()) / 1000))
    : null;
  const summary = normalizeSummary(row.summary);
  return {
    callId: row.callId,
    sessionId: row.sessionId,
    leadsId: row.leadsId,
    callerName: summary?.name ?? null,
    language: row.language,
    startedAt: row.startedAt.toISOString(),
    durationSeconds,
    turnCount: row.turnCount,
    bookedSlot: row.bookedSlot,
    bookedIso: row.bookedIso ? row.bookedIso.toISOString() : null,
    outcome: summary?.outcome ?? null,
    intents: summary?.items.map((i) => i.intent) ?? [],
    leadStatus,
  };
}

export const voiceCallsStorage = {
  async listVoiceCalls({ limit, offset }: { limit: number; offset: number }): Promise<VoiceCallListItem[]> {
    const rows = await db
      .select({ call: voiceCalls, lastTurn: lastTurnAt, leadStatus: leadStatusOf })
      .from(voiceCalls)
      .orderBy(desc(voiceCalls.startedAt))
      .limit(limit)
      .offset(offset);
    return rows.map((r) => toItem(r.call, r.lastTurn, r.leadStatus));
  },

  async getVoiceCall(callId: string): Promise<VoiceCallDetail | undefined> {
    const [row] = await db
      .select({ call: voiceCalls, lastTurn: lastTurnAt, leadStatus: leadStatusOf })
      .from(voiceCalls)
      .where(eq(voiceCalls.callId, callId));
    if (!row) return undefined;
    const turns = await db
      .select({
        id: interactions.id,
        who: interactions.who,
        direction: interactions.direction,
        content: interactions.content,
        createdAt: interactions.createdAt,
      })
      .from(interactions)
      .where(and(
        eq(interactions.conversationThreadId, callId),
        eq(interactions.type, "voice_call"),
      ))
      .orderBy(asc(interactions.createdAt), asc(interactions.id));
    return {
      ...toItem(row.call, row.lastTurn, row.leadStatus),
      summary: normalizeSummary(row.call.summary),
      turns: turns.map((t) => ({
        id: t.id as number,
        who: t.who,
        direction: t.direction,
        content: t.content,
        createdAt: t.createdAt ? t.createdAt.toISOString() : null,
      })),
    };
  },
};
