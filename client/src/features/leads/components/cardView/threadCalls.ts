/**
 * Voice calls inside a chat thread (C2, pure for node:test). The receptionist
 * stores every call turn as a `voice_call` interaction threaded by call id;
 * the thread shows each call as one compact line instead of its transcript.
 */
export interface ThreadCall { callId: string; startedAt: string; endedAt: string; turns: number }

type Msg = { type?: string | null; created_at?: string | null; createdAt?: string | null; conversation_thread_id?: string | null; conversationThreadId?: string | null };

export function splitThreadCalls<T extends Msg>(msgs: T[]): { chat: T[]; calls: ThreadCall[] } {
  const chat: T[] = [];
  const byId = new Map<string, ThreadCall>();
  for (const m of msgs) {
    const callId = (m.type ?? "").toLowerCase() === "voice_call" ? m.conversation_thread_id ?? m.conversationThreadId : null;
    const ts = m.created_at ?? m.createdAt ?? "";
    if (!callId) { chat.push(m); continue; }
    const c = byId.get(callId);
    if (!c) byId.set(callId, { callId, startedAt: ts, endedAt: ts, turns: 1 });
    else {
      c.turns++;
      if (ts && (!c.startedAt || ts < c.startedAt)) c.startedAt = ts;
      if (ts > c.endedAt) c.endedAt = ts;
    }
  }
  const calls = Array.from(byId.values()).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return { chat, calls };
}

/** "2:05" from the first to the last turn; null when the times are missing. */
export function callLength(c: ThreadCall): string | null {
  const ms = new Date(c.endedAt).getTime() - new Date(c.startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
