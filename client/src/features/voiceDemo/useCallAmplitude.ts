import { useCallback, useEffect, useRef } from "react";
import { useAnimationFrame, useMotionValue } from "framer-motion";

/**
 * A single 0..1 loudness signal for the orb, taken from both sides of the call.
 *
 * SmoothUI ships `useAudioAmplitude`, but it only listens to the microphone. A
 * call has two voices and the orb should answer to whichever is talking, so
 * this runs an analyser over the caller's mic AND the remote track and reports
 * the louder of the two.
 *
 * The value is a MotionValue on purpose: it updates every animation frame, and
 * as React state that would re-render the page sixty times a second for a
 * number nothing but a CSS variable ever reads.
 */

/** Raw RMS is small; this lifts a normal speaking voice to most of the range. */
const RMS_GAIN = 3.2;
/** Peaks land fast, decay slowly, so the orb pulses rather than flickers. */
const ATTACK = 0.35;
const DECAY = 0.12;
const FFT_SIZE = 512;

interface Side {
  analyser: AnalyserNode;
  buffer: Float32Array;
}

export function useCallAmplitude() {
  const amplitude = useMotionValue(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const sidesRef = useRef<Side[]>([]);
  const levelRef = useRef(0);

  const attach = useCallback((stream: MediaStream) => {
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
      ctx.createMediaStreamSource(stream).connect(analyser);
      // Chrome will not pull audio through a graph that reaches no
      // destination, and a remote WebRTC track is the case where it shows:
      // the analyser reads pure silence while she is audibly speaking, so the
      // orb reacts to the caller and sits still for her. A muted sink gives
      // the graph somewhere to go without playing her voice a second time.
      const sink = ctx.createGain();
      sink.gain.value = 0;
      analyser.connect(sink);
      sink.connect(ctx.destination);
      sidesRef.current.push({ analyser, buffer: new Float32Array(analyser.fftSize) });
    } catch {
      // A browser that refuses an analyser on a remote track (Safari has, at
      // times) costs us the pulse, not the call: the orb still animates from
      // its call state. Never let this throw into the connect path.
    }
  }, []);

  const reset = useCallback(() => {
    sidesRef.current = [];
    levelRef.current = 0;
    amplitude.set(0);
    const ctx = ctxRef.current;
    ctxRef.current = null;
    void ctx?.close().catch(() => {});
  }, [amplitude]);

  useAnimationFrame(() => {
    const sides = sidesRef.current;
    if (!sides.length) return;
    let peak = 0;
    for (const side of sides) {
      side.analyser.getFloatTimeDomainData(side.buffer);
      let sum = 0;
      for (let i = 0; i < side.buffer.length; i += 1) sum += side.buffer[i] * side.buffer[i];
      peak = Math.max(peak, Math.sqrt(sum / side.buffer.length) * RMS_GAIN);
    }
    const target = Math.min(1, peak);
    const smoothing = target > levelRef.current ? ATTACK : DECAY;
    levelRef.current += (target - levelRef.current) * smoothing;
    amplitude.set(levelRef.current);
  });

  useEffect(() => reset, [reset]);

  return { amplitude, attach, reset };
}
