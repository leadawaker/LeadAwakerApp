import { useCallback, useEffect, useRef, useState } from "react";
import ambienceUrl from "@/assets/office-ambience.mp3";

/**
 * A quiet office under the call, so she sounds like she is sitting at a desk
 * rather than in a studio. The way Zonneplan's line sounds.
 *
 * Played in the page, not mixed into the call: the call is browser WebRTC and
 * there is no phone leg to mix it into. So OpenAI's recording of the call does
 * not have it, and only the person on the page hears it.
 *
 * The file is a seamless loop (its tail crossfades into its head), mono, and
 * already quiet (about -35 LUFS), so the gains below sit it well under her
 * voice. It dips further while she speaks, the way a room recedes behind
 * someone talking to you.
 *
 * Its own AudioContext, kept apart from useCallLevels: the wave reads that one,
 * and an office in it would read as someone talking.
 */

const STORAGE_KEY = "voiceDemo.ambience";
const BED_GAIN = 0.45;
const DUCKED_GAIN = 0.25;
const FADE_IN_S = 1.5;
const FADE_OUT_S = 0.6;
const DUCK_S = 0.25;
const DUCK_HOLD_MS = 900;

function readPref(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

/** The on/off preference, remembered per browser. On unless switched off. */
export function useAmbiencePref() {
  const [enabled, setEnabledState] = useState(readPref);
  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      /* private mode: holds for this tab */
    }
  }, []);
  return [enabled, setEnabled] as const;
}

/**
 * True while she is talking. `streaming` alone stays set until the caller next
 * speaks, so it is held only while her words keep arriving (`pulse` changes
 * with every transcript delta) and lets go a beat after the last one.
 */
function useSpeakingNow(streaming: boolean, pulse: unknown): boolean {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (!streaming) {
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    const id = window.setTimeout(() => setSpeaking(false), DUCK_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [streaming, pulse]);
  return speaking;
}

/**
 * Plays while `playing`, dips while she speaks. Safe to leave mounted: nothing
 * is fetched or decoded until the first call starts.
 */
export function useOfficeAmbience({
  playing,
  streaming,
  pulse,
}: {
  playing: boolean;
  /** Her side is producing transcript (orbState "streaming"). */
  streaming: boolean;
  /** Anything that changes with each of her words, e.g. the turns array. */
  pulse: unknown;
}) {
  const ducked = useSpeakingNow(streaming, pulse);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bufferRef = useRef<Promise<AudioBuffer | null> | null>(null);
  const playingRef = useRef(playing);
  const duckedRef = useRef(ducked);
  playingRef.current = playing;
  duckedRef.current = ducked;

  const ensureCtx = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    ctxRef.current = ctx;
    gainRef.current = gain;
    return ctx;
  }, []);

  const loadBuffer = useCallback((ctx: AudioContext) => {
    // Cached as a promise so a quick hang-up and redial never fetches twice.
    // A failed load is cached too: no office is not worth retrying mid-call.
    bufferRef.current ??= fetch(ambienceUrl)
      .then((r) => r.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .catch(() => null);
    return bufferRef.current;
  }, []);

  useEffect(() => {
    if (!playing) {
      const ctx = ctxRef.current;
      const gain = gainRef.current;
      const source = sourceRef.current;
      if (!ctx || !gain || !source) return;
      sourceRef.current = null;
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setTargetAtTime(0, ctx.currentTime, FADE_OUT_S / 3);
      try {
        source.stop(ctx.currentTime + FADE_OUT_S);
      } catch {
        /* already stopped */
      }
      return;
    }

    let cancelled = false;
    const ctx = ensureCtx();
    if (!ctx) return;
    // The mic is live by now, which is what lets a page play sound without a
    // fresh click, so resuming here is allowed.
    void ctx.resume().catch(() => {});
    void loadBuffer(ctx).then((buffer) => {
      if (cancelled || !buffer || !playingRef.current || sourceRef.current) return;
      const gain = gainRef.current!;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      // A random start point, so every call does not open on the same cough.
      source.start(0, Math.random() * buffer.duration);
      sourceRef.current = source;
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(duckedRef.current ? DUCKED_GAIN : BED_GAIN, ctx.currentTime + FADE_IN_S);
    });
    return () => {
      cancelled = true;
    };
  }, [playing, ensureCtx, loadBuffer]);

  useEffect(() => {
    const ctx = ctxRef.current;
    const gain = gainRef.current;
    if (!ctx || !gain || !sourceRef.current) return;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setTargetAtTime(ducked ? DUCKED_GAIN : BED_GAIN, ctx.currentTime, DUCK_S / 3);
  }, [ducked]);

  useEffect(
    () => () => {
      const ctx = ctxRef.current;
      ctxRef.current = null;
      gainRef.current = null;
      sourceRef.current = null;
      void ctx?.close().catch(() => {});
    },
    [],
  );
}
