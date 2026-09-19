import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";

/** Mirrors VoiceCallListItem in server/storage/voiceCalls.ts. */
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
  intents: string[];
  leadStatus: string | null;
}

export interface VoiceCallSummaryItem {
  intent: string;
  interest: string | null;
  notes: string | null;
}

export interface VoiceCallTurn {
  id: number;
  who: string | null;
  direction: string | null;
  content: string | null;
  createdAt: string | null;
}

export interface VoiceCallDetail extends VoiceCallListItem {
  summary: { name: string | null; outcome?: string | null; items: VoiceCallSummaryItem[] } | null;
  turns: VoiceCallTurn[];
}

const LIST_KEY = ["/api/voice-calls"];
// A demo call lasts at most 5 minutes; after this, a missing summary is final.
const STILL_LIVE_MS = 15 * 60 * 1000;

export function useVoiceCalls() {
  return useQuery<VoiceCallListItem[]>({
    queryKey: LIST_KEY,
    queryFn: async () => {
      const res = await apiFetch("/api/voice-calls?limit=200");
      if (!res.ok) throw new Error("Failed to load voice calls");
      return (await res.json()).calls ?? [];
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useVoiceCall(callId: string | null) {
  return useQuery<VoiceCallDetail | null>({
    queryKey: [...LIST_KEY, callId],
    enabled: !!callId,
    queryFn: async () => {
      const res = await apiFetch(`/api/voice-calls/${encodeURIComponent(callId as string)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to load voice call");
      return res.json();
    },
    staleTime: 30 * 1000,
    // Poll while a call is still in progress (no summary written yet); stop
    // once wrap-up has landed, or once the call is old enough that it never will
    // (a tab closed before wrap-up leaves the summary empty for good).
    refetchInterval: (query) => {
      const call = query.state.data;
      if (!call || call.summary) return false;
      return Date.now() - new Date(call.startedAt).getTime() < STILL_LIVE_MS ? 15_000 : false;
    },
  });
}
