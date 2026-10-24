// Data for the call review (CallReviewView): the review itself from
// GET /api/voice-calls/:callId/review, and the recording as a Blob.
//
// Right after a test the engine may not have written the call row yet (404) or its
// transcript, turn metrics and cost (written at wrap-up; ElevenLabs loads its transcript
// up to 120 s after the call, plus the recap): a 404 is retried for about half a minute,
// and while turns or cost (Owner only) are missing the review is fetched again every 5 s,
// up to 3 minutes after the call ended, or after the first fetch while the call has no
// turns and no end yet (stillProcessing). The recording is fetched once with the
// session cookie (apiFetch) and handed to wavesurfer as a Blob; the same object URL
// serves the download, so the file is never fetched twice. Shared by the test panel's
// review and the Calls page's call detail.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { stillProcessing, type CallReview } from "./reviewMath";
import { reviewViewerKey } from "./reviewViewer";

class NotYet extends Error {}

const NOT_YET_RETRIES = 15;
const NOT_YET_DELAY_MS = 2000;
const PROCESSING_REFETCH_MS = 5000;

/** Per viewer (reviewViewer.ts): the server cuts the review by role, so "view as client" gets its own entry. */
export const callReviewKey = (callId: string, viewer: string) => ["/api/voice-calls", callId, "review", viewer] as const;

function storedUserId(): string | null {
  try { return localStorage.getItem("leadawaker_user_id"); } catch { return null; }
}

async function fetchReview(callId: string): Promise<CallReview> {
  const res = await apiFetch(`/api/voice-calls/${encodeURIComponent(callId)}/review`);
  if (res.status === 404) throw new NotYet("Call not written yet");
  if (!res.ok) throw new Error(`Failed to load the review (${res.status})`);
  return (await res.json()) as CallReview;
}

export type ReviewStatus = "loading" | "waiting" | "ready" | "failed";

export function useCallReview(callId: string): {
  review: CallReview | null; status: ReviewStatus; retry: () => void;
  /** Turns or cost may still come in: show "still processing" rather than an empty call. */
  processing: boolean;
} {
  // Only the Owner gets a cost (the route nulls it for everyone else): nobody else waits for one.
  const { isOwner, impersonation } = useWorkspace();
  const viewer = reviewViewerKey(storedUserId(), impersonation);
  // When this call's review first came back: the processing window of a call whose end is not stored yet.
  const firstSeenRef = useRef<{ callId: string; at: number } | null>(null);
  const opts = () => ({
    firstSeenMs: firstSeenRef.current?.callId === callId ? firstSeenRef.current.at : null,
    costExpected: isOwner,
  });
  const q = useQuery({
    queryKey: callReviewKey(callId, viewer),
    queryFn: async () => {
      const review = await fetchReview(callId);
      if (firstSeenRef.current?.callId !== callId) firstSeenRef.current = { callId, at: Date.now() };
      return review;
    },
    retry: (count, err) => err instanceof NotYet && count < NOT_YET_RETRIES,
    retryDelay: NOT_YET_DELAY_MS,
    refetchOnWindowFocus: false,
    // Timed from the last fetch, as `processing` below, so the two always agree.
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && stillProcessing(data, query.state.dataUpdatedAt, opts()) ? PROCESSING_REFETCH_MS : false;
    },
  });
  const status: ReviewStatus = q.data
    ? "ready"
    : q.isError ? "failed"
    : q.failureCount > 0 ? "waiting"
    : "loading";
  const processing = !!q.data && stillProcessing(q.data, q.dataUpdatedAt, opts());
  return { review: q.data ?? null, status, retry: () => { void q.refetch(); }, processing };
}

export type RecordingState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; blob: Blob; url: string; ext: string };

const RECORDING_TRIES = 3;
const RECORDING_RETRY_MS = 3000;

function extOf(type: string): string {
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("webm")) return "webm";
  return "wav";
}

// Recent recordings stay in memory so flicking between calls on the Calls page does not
// download a large file again. An entry in use is never evicted; an evicted one releases
// its object URL.
const CACHE_SIZE = 4;
type Ready = Extract<RecordingState, { status: "ready" }>;
const cache = new Map<string, { rec: Ready; users: number }>();

function take(url: string): Ready | null {
  const hit = cache.get(url);
  if (!hit) return null;
  cache.delete(url);
  cache.set(url, hit);
  hit.users++;
  return hit.rec;
}

function release(url: string) {
  const hit = cache.get(url);
  if (hit) hit.users = Math.max(0, hit.users - 1);
  for (const [key, entry] of Array.from(cache.entries())) {
    if (cache.size <= CACHE_SIZE) break;
    if (entry.users > 0) continue;
    URL.revokeObjectURL(entry.rec.url);
    cache.delete(key);
  }
}

/**
 * The recording behind `url` (the review's recordingUrl), or "missing" when there is none.
 * `tries`: how often to ask before giving up (a fresh call's recording may lag a moment;
 * an old call's answer is final at once).
 */
export function useRecording(url: string | null, tries = RECORDING_TRIES): RecordingState {
  const [state, setState] = useState<RecordingState>(url ? { status: "loading" } : { status: "missing" });

  useEffect(() => {
    if (!url) { setState({ status: "missing" }); return; }
    const cached = take(url);
    if (cached) {
      setState(cached);
      return () => release(url);
    }
    const ctl = new AbortController();
    let held = false;
    setState({ status: "loading" });
    (async () => {
      // A recording can take a moment to be ready after the call: try again a couple of times.
      for (let attempt = 1; attempt <= tries; attempt++) {
        try {
          const res = await apiFetch(url, { signal: ctl.signal });
          if (res.ok) {
            const type = res.headers.get("content-type") || "audio/wav";
            const blob = new Blob([await res.arrayBuffer()], { type });
            if (ctl.signal.aborted) return;
            // Another view may have fetched the same recording meanwhile: share that one.
            const rec: Ready = take(url) ?? { status: "ready", blob, url: URL.createObjectURL(blob), ext: extOf(type) };
            if (!cache.has(url)) cache.set(url, { rec, users: 1 });
            held = true;
            release(""); // trim the cache past its size, sparing entries in use
            setState(rec);
            return;
          }
          if (res.status === 404 || res.status === 403) break;
        } catch {
          if (ctl.signal.aborted) return;
        }
        if (attempt < tries) await new Promise((r) => setTimeout(r, RECORDING_RETRY_MS));
        if (ctl.signal.aborted) return;
      }
      if (!ctl.signal.aborted) setState({ status: "missing" });
    })();
    return () => {
      ctl.abort();
      if (held) release(url);
    };
  }, [url, tries]);

  return state;
}
