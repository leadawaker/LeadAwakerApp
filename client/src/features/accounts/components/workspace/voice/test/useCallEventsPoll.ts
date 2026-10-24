// The tools an ElevenLabs test call runs happen on the engine, which writes them as
// Voice_Call_Events; the browser never sees them. While the call is live this polls
// GET /api/voice-calls/:callId (agency users get `events`) and returns them. The poll
// stops as soon as `active` is false (the call is over: the review loads the final list).
// Until the engine has written the call row the route answers 404: that is just "no
// events yet", not an error.
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import type { CallEventLike } from "./liveMetrics";

export const CALL_EVENTS_POLL_MS = 1500;

const NONE: CallEventLike[] = [];

export const callEventsKey = (callId: string) => ["/api/voice-calls", callId, "live-events"] as const;

async function fetchCallEvents(callId: string): Promise<CallEventLike[]> {
  const res = await apiFetch(`/api/voice-calls/${encodeURIComponent(callId)}`);
  if (res.status === 404) return NONE;
  if (!res.ok) throw new Error(`Failed to load call events (${res.status})`);
  const body = (await res.json()) as { events?: CallEventLike[] };
  return Array.isArray(body.events) ? body.events : NONE;
}

export function useCallEventsPoll(callId: string | null, active: boolean, intervalMs = CALL_EVENTS_POLL_MS): CallEventLike[] {
  const on = active && !!callId;
  const q = useQuery({
    queryKey: callEventsKey(callId ?? ""),
    queryFn: () => fetchCallEvents(callId as string),
    enabled: on,
    refetchInterval: on ? intervalMs : false,
    refetchIntervalInBackground: false,
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });
  // Keep what was fetched once polling stops; never show another call's events.
  return callId && q.data ? q.data : NONE;
}
