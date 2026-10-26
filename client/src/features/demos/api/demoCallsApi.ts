// Demo phone calls (server/routes/voiceDemoCalls.ts, relayed to the engine's
// /voice/demo-calls): Sara rings the prospect, or the owner's phone rings first
// and the prospect is bridged in, with Sara brought in on demand.
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";

export type DemoCallMode = "sara" | "bridge";
export type DemoCallStatus = "dialing_owner" | "dialing_prospect" | "live" | "ended" | "failed";
export type DemoLegStatus = "idle" | "dialing" | "answered" | "ended" | "failed" | "busy" | "no_answer" | "voicemail";

export interface DemoCall {
  id: string;
  mode: DemoCallMode;
  status: DemoCallStatus;
  legs: { owner: DemoLegStatus; prospect: DemoLegStatus; ai: DemoLegStatus };
  sara_in: boolean;
  error: string | null;
  started_at: string | null;
  ended_at: string | null;
}

export const isFinished = (s: DemoCallStatus | undefined) => s === "ended" || s === "failed";

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string }).message || `Request failed (${res.status})`);
  return body as T;
}

const post = (path: string, body: unknown) =>
  apiFetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function startDemoCall(body: {
  token: string; toNumber: string; mode: DemoCallMode; locale?: string; voice?: string;
}): Promise<DemoCall> {
  return json<DemoCall>(await post("/api/voice/demo-calls", body));
}

export async function setSara(id: string, action: "join" | "leave"): Promise<DemoCall | null> {
  const res = await post(`/api/voice/demo-calls/${encodeURIComponent(id)}/sara`, { action });
  return res.status === 204 ? null : json<DemoCall>(res);
}

export async function endDemoCall(id: string): Promise<void> {
  const res = await post(`/api/voice/demo-calls/${encodeURIComponent(id)}/end`, {});
  if (res.status !== 204) await json<unknown>(res);
}

/** The call's state, polled every 1.5 s until it has ended. */
export function useDemoCall(id: string | null) {
  return useQuery({
    queryKey: ["demo-call", id],
    enabled: !!id,
    queryFn: async () => json<DemoCall>(await apiFetch(`/api/voice/demo-calls/${encodeURIComponent(id!)}`)),
    refetchInterval: (q) => (isFinished((q.state.data as DemoCall | undefined)?.status) ? false : 1500),
    refetchIntervalInBackground: true,
  });
}
