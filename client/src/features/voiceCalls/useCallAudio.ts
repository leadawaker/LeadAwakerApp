import { useEffect, useState } from "react";
import { ENGINE_BASE_URL } from "@/features/voiceDemo/engine";

/** A stretch of speech on one side of the call, in seconds. */
export interface Segment { start: number; end: number }

export interface CallAudio {
  status: "loading" | "ready" | "missing";
  /** Object URL of the downloaded recording, so the player never fetches it twice. */
  url: string | null;
  duration: number;
  caller: Segment[];
  ai: Segment[];
}

const WINDOW_S = 0.1;
const THRESHOLD = 0.012; // RMS; well above line hiss, below quiet speech
const MERGE_GAP_S = 0.8;
const MIN_LEN_S = 0.3;

/** Where one channel has speech, as merged segments. */
function speechSegments(data: Float32Array, rate: number): Segment[] {
  const win = Math.max(1, Math.round(rate * WINDOW_S));
  const raw: Segment[] = [];
  let open: number | null = null;
  for (let i = 0; i + win <= data.length; i += win) {
    let sum = 0;
    for (let j = i; j < i + win; j++) sum += data[j] * data[j];
    const loud = Math.sqrt(sum / win) > THRESHOLD;
    const t = i / rate;
    if (loud && open == null) open = t;
    if (!loud && open != null) { raw.push({ start: open, end: t }); open = null; }
  }
  if (open != null) raw.push({ start: open, end: data.length / rate });
  const merged: Segment[] = [];
  for (const s of raw) {
    const last = merged[merged.length - 1];
    if (last && s.start - last.end < MERGE_GAP_S) last.end = s.end;
    else merged.push({ ...s });
  }
  return merged.filter((s) => s.end - s.start >= MIN_LEN_S);
}

const EMPTY: CallAudio = { status: "loading", url: null, duration: 0, caller: [], ai: [] };
const MISSING: CallAudio = { status: "missing", url: null, duration: 0, caller: [], ai: [] };

// Recent recordings stay in memory so flicking between calls does not download
// and decode 15MB each time. Evicted entries release their blob URL.
const CACHE_SIZE = 4;
const cache = new Map<string, CallAudio>();
function remember(id: string, audio: CallAudio) {
  cache.delete(id);
  cache.set(id, audio);
  while (cache.size > CACHE_SIZE) {
    const oldest = cache.keys().next().value as string;
    const gone = cache.get(oldest);
    if (gone?.url) URL.revokeObjectURL(gone.url);
    cache.delete(oldest);
  }
}

/**
 * Downloads the call's stereo recording (caller left, AI right) once, hands the
 * player a local URL and works out who spoke when from each channel. If the
 * browser cannot analyse the file it is still playable, just without the
 * speaker lines.
 */
export function useCallAudio(sessionId: string | null): CallAudio {
  const [state, setState] = useState<CallAudio>(EMPTY);

  useEffect(() => {
    if (!sessionId) { setState(MISSING); return; }
    const cached = cache.get(sessionId);
    if (cached) { remember(sessionId, cached); setState(cached); return; }
    const ctl = new AbortController();
    setState(EMPTY);
    (async () => {
      try {
        const res = await fetch(`${ENGINE_BASE_URL}/voice/live/recording/${encodeURIComponent(sessionId)}`, { signal: ctl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const buf = await res.arrayBuffer();
        // The Blob copies the bytes, so the buffer can go straight to the decoder.
        const url = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
        let ready: CallAudio = { status: "ready", url, duration: 0, caller: [], ai: [] };
        try {
          // Decode at a low rate: enough to see speech, a fraction of the memory.
          const audio = await new OfflineAudioContext(2, 1, 8000).decodeAudioData(buf);
          const left = audio.getChannelData(0);
          ready = {
            status: "ready",
            url,
            duration: audio.duration,
            caller: speechSegments(left, audio.sampleRate),
            ai: audio.numberOfChannels > 1 ? speechSegments(audio.getChannelData(1), audio.sampleRate) : [],
          };
        } catch { /* playable without the speaker lines */ }
        if (ctl.signal.aborted) { URL.revokeObjectURL(url); return; }
        remember(sessionId, ready);
        setState(ready);
      } catch {
        if (!ctl.signal.aborted) setState(MISSING);
      }
    })();
    return () => ctl.abort();
  }, [sessionId]);

  return state;
}

/** Share of the call's speaking time per side, as whole percentages. */
export function talkShare(caller: Segment[], ai: Segment[]): { caller: number; ai: number } {
  const len = (s: Segment[]) => s.reduce((n, x) => n + x.end - x.start, 0);
  const c = len(caller), a = len(ai);
  if (c + a === 0) return { caller: 0, ai: 0 };
  const cp = Math.round((c / (c + a)) * 100);
  return { caller: cp, ai: 100 - cp };
}
