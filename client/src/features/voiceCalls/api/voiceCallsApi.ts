import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";

export type VoiceOutcome = "booked" | "callback" | "transferred" | "hung_up" | "other";
export type VoiceScope = "live" | "demo";

export const VOICE_OUTCOMES: VoiceOutcome[] = ["booked", "callback", "transferred", "hung_up", "other"];

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
  /** Always set by the server (derived when the column is empty). Treat unknown values as "other". */
  outcome: VoiceOutcome;
  /** The old free-text summary outcome ("Booked a quote visit for Thursday"). */
  conclusion: string | null;
  intents: string[];
  leadStatus: string | null;
  callerNumber: string | null;
  scope: VoiceScope;
  /** Null on Live calls. */
  personaCompany: string | null;
  personaNiche: string | null;
  accountId: number;
  /** Only populated for agency users. */
  accountName: string | null;
}

export interface VoiceStats {
  calls: number;
  bookedRate: number;
  avgDurationSeconds: number | null;
}

export interface VoiceCapabilities {
  live: boolean;
  demo: boolean;
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

export function useVoiceCalls(scope: VoiceScope, accountId?: number) {
  return useQuery<VoiceCallListItem[]>({
    queryKey: [...LIST_KEY, scope, accountId ?? null],
    queryFn: async () => {
      const qs = new URLSearchParams({ scope, limit: "200" });
      if (accountId != null) qs.set("accountId", String(accountId));
      const res = await apiFetch(`/api/voice-calls?${qs}`);
      if (!res.ok) throw new Error("Failed to load voice calls");
      return (await res.json()).calls ?? [];
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/** Rolling 7 days, computed server-side so the 200-row list cap does not matter. */
export function useVoiceStats(scope: VoiceScope, accountId?: number) {
  return useQuery<VoiceStats>({
    queryKey: ["/api/voice-calls/stats", scope, accountId ?? null],
    queryFn: async () => {
      const qs = new URLSearchParams({ scope });
      if (accountId != null) qs.set("accountId", String(accountId));
      const res = await apiFetch(`/api/voice-calls/stats?${qs}`);
      if (!res.ok) throw new Error("Failed to load voice stats");
      return res.json();
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/** What this user may see: drives the tab bar, the nav entry and the route guard. */
export function useVoiceCapabilities() {
  return useQuery<VoiceCapabilities>({
    queryKey: ["/api/voice-calls/capabilities"],
    queryFn: async () => {
      const res = await apiFetch("/api/voice-calls/capabilities");
      if (!res.ok) throw new Error("Failed to load voice capabilities");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
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
