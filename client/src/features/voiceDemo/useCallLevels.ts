import { useCallback, useEffect, useRef } from "react";

/**
 * Per-side loudness and voice-band energy for the wave, read on demand.
 *
 * The wave has to tell the two voices apart (she talks in colour, the caller
 * gets a calm white line), so each side keeps its own analyser rather than
 * being merged into one "who is louder" number.
 *
 * Nothing here runs on a timer. The wave's own animation frame calls `read()`,
 * so there is exactly one loop, and a page with no call does no audio work.
 */

export type CallSide = "you" | "them";

export interface SideLevel {
  /** Overall loudness, 0..1, attack-fast / decay-slow. */
  level: number;
  /** Voice bands, 0..1: body (~80-300Hz), clarity (~300-1500Hz), air (~1.5-5kHz). */
  low: number;
  mid: number;
  high: number;
}

export type CallLevels = Record<CallSide, SideLevel>;

/** Raw RMS is small; this lifts a normal speaking voice to most of the range. */
const RMS_GAIN = 3.2;
const ATTACK = 0.35;
const DECAY = 0.12;
const FFT_SIZE = 512;

interface Side {
  side: CallSide;
  analyser: AnalyserNode;
  wave: Float32Array;
  freq: Uint8Array;
}

const silent = (): SideLevel => ({ level: 0, low: 0, mid: 0, high: 0 });

/** Mean of the byte spectrum between two frequencies, as 0..1. */
function band(freq: Uint8Array, binHz: number, from: number, to: number): number {
  const a = Math.max(1, Math.floor(from / binHz));
  const b = Math.min(freq.length - 1, Math.ceil(to / binHz));
  let sum = 0;
  for (let i = a; i <= b; i += 1) sum += freq[i];
  return b >= a ? sum / ((b - a + 1) * 255) : 0;
}

const ease = (prev: number, next: number) => prev + (next - prev) * (next > prev ? ATTACK : DECAY);

export function useCallLevels() {
  const ctxRef = useRef<AudioContext | null>(null);
  const sidesRef = useRef<Side[]>([]);
  const levelsRef = useRef<CallLevels>({ you: silent(), them: silent() });

  const attach = useCallback((stream: MediaStream, side: CallSide) => {
    try {
      if (!ctxRef.current) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        ctxRef.current = new Ctor();
      }
      const ctx = ctxRef.current;
      // Autoplay policy can leave the context suspended until a gesture. The
      // call always starts from a click, so resuming here is safe.
      void ctx.resume().catch(() => {});
      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.6;
      ctx.createMediaStreamSource(stream).connect(analyser);
      // Chrome will not pull audio through a graph that reaches no
      // destination, and a remote WebRTC track is the case where it shows:
      // the analyser reads pure silence while she is audibly speaking. A muted
      // sink gives the graph somewhere to go without playing her voice twice.
      const sink = ctx.createGain();
      sink.gain.value = 0;
      analyser.connect(sink);
      sink.connect(ctx.destination);
      sidesRef.current.push({
        side,
        analyser,
        wave: new Float32Array(analyser.fftSize),
        freq: new Uint8Array(analyser.frequencyBinCount),
      });
    } catch {
      // A browser that refuses an analyser on a remote track (Safari has, at
      // times) costs us the reactivity, not the call: the wave still moves
      // from the call state. Never let this throw into the connect path.
    }
  }, []);

  /** Sample every side once. Call from an animation frame. */
  const read = useCallback((): CallLevels => {
    const levels = levelsRef.current;
    const ctx = ctxRef.current;
    for (const s of sidesRef.current) {
      s.analyser.getFloatTimeDomainData(s.wave);
      let sum = 0;
      for (let i = 0; i < s.wave.length; i += 1) sum += s.wave[i] * s.wave[i];
      const rms = Math.min(1, Math.sqrt(sum / s.wave.length) * RMS_GAIN);

      s.analyser.getByteFrequencyData(s.freq);
      const binHz = (ctx?.sampleRate ?? 48000) / FFT_SIZE;
      const prev = levels[s.side];
      levels[s.side] = {
        level: ease(prev.level, rms),
        low: ease(prev.low, band(s.freq, binHz, 80, 300)),
        mid: ease(prev.mid, band(s.freq, binHz, 300, 1500)),
        high: ease(prev.high, band(s.freq, binHz, 1500, 5000)),
      };
    }
    return levels;
  }, []);

  const reset = useCallback(() => {
    sidesRef.current = [];
    levelsRef.current = { you: silent(), them: silent() };
    const ctx = ctxRef.current;
    ctxRef.current = null;
    void ctx?.close().catch(() => {});
  }, []);

  useEffect(() => reset, [reset]);

  return { attach, read, reset };
}
