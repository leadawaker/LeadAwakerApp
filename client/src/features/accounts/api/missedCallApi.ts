import { apiFetch } from "@/lib/apiUtils";

export type GreetingMode = "silent" | "voice";

export interface MissedCallStatus {
  enabled: boolean;
  number: string | null;
  campaignId: number | null;
  greetingMode: GreetingMode;
  greetingFileName: string | null;
  hasGreeting: boolean;
  voicemailEnabled: boolean;
  forwardCode: string | null;
  campaigns: Array<{ id: number; name: string }>;
}

// Single fetch chokepoint: runs the request, surfaces the server's `message` on
// failure (so the UI shows the real reason), and JSON-parses the success body.
async function request(url: string, init?: RequestInit): Promise<MissedCallStatus> {
  const res = await apiFetch(url, init);
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.message || `Request failed (${res.status})`);
  }
  return res.json();
}

function postJson(url: string, body: unknown): Promise<MissedCallStatus> {
  return request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const fetchMissedCallStatus = (accountId: number): Promise<MissedCallStatus> =>
  request(`/api/accounts/${accountId}/missed-call/status`);

export const saveMissedCall = (
  accountId: number,
  patch: Partial<{ enabled: boolean; voicemailEnabled: boolean; number: string; campaignId: number | null; greetingMode: GreetingMode }>,
): Promise<MissedCallStatus> => postJson(`/api/accounts/${accountId}/missed-call`, patch);

/** Stores a recorded/uploaded clip (transcoded to MP3 server-side), mode → 'voice'. */
export const uploadGreeting = (
  accountId: number,
  audioDataUrl: string,
  fileName: string,
): Promise<MissedCallStatus> =>
  postJson(`/api/accounts/${accountId}/missed-call/greeting`, { audioDataUrl, fileName });

/** Generates a greeting from typed text using the account's cloned voice for that locale. */
export const generateGreetingTts = (
  accountId: number,
  text: string,
  locale: string,
): Promise<MissedCallStatus> =>
  postJson(`/api/accounts/${accountId}/missed-call/greeting/tts`, { text, locale });

export const deleteGreeting = (accountId: number): Promise<MissedCallStatus> =>
  request(`/api/accounts/${accountId}/missed-call/greeting`, { method: "DELETE" });

/** Auth-gated preview URL for the stored greeting (cache-busted by the caller). */
export const greetingPreviewUrl = (accountId: number) =>
  `/api/accounts/${accountId}/missed-call/greeting.mp3`;
