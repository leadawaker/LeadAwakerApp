import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { voiceCallEvents } from "@shared/schema";

/** One tool call or backend delegation in a call (engine tools/db/voice_call_events.py). */
export interface VoiceCallEventItem {
  id: number;
  /** 'delegation' | 'tool' | 'refused' */
  kind: string;
  toolName: string | null;
  status: string | null;
  error: string | null;
  args: unknown;
  result: unknown;
  startedAt: string;
  endedAt: string | null;
  latencyMs: number | null;
}

/** A call's events in the order they started. Empty when logging was off or the table is missing. */
export async function listVoiceCallEvents(callId: string): Promise<VoiceCallEventItem[]> {
  try {
    const rows = await db
      .select()
      .from(voiceCallEvents)
      .where(eq(voiceCallEvents.callId, callId))
      .orderBy(asc(voiceCallEvents.startedAt), asc(voiceCallEvents.id));
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      toolName: r.toolName,
      status: r.status,
      error: r.error,
      args: r.args,
      result: r.result,
      startedAt: r.startedAt.toISOString(),
      endedAt: r.endedAt ? r.endedAt.toISOString() : null,
      latencyMs: r.latencyMs,
    }));
  } catch (err) {
    console.warn("[voiceCalls] events unavailable:", (err as Error).message);
    return [];
  }
}
