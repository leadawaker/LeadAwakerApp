// A one-track recording (ElevenLabs is mono) coloured by who speaks, from the review's
// turn timings: a turn runs from its start to the next turn's start (the last one to the
// end of the audio). Agent stretches draw in wine, caller stretches in ink, silence (before
// the first turn, and bars too quiet to be speech) neutral.
//
// `speakerAt` is pure (speakerWave.test.ts). `speakerRender` is a wavesurfer.js 7
// renderFunction: wavesurfer cuts a long waveform into several canvases and hands each one
// only its slice, so the slice's place on the timeline is read from the canvas's own left
// offset and the wrapper's width.
export type Speaker = "agent" | "user" | "silence";

export interface SpeakerColors { agent: string; user: string; silence: string }

/** Who speaks at `s` seconds: the last turn that has started (turns are in call order). */
export function speakerAt(turns: readonly { role: "user" | "agent"; atS: number }[], s: number): Speaker {
  let lo = 0, hi = turns.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (turns[mid].atS <= s) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return found < 0 ? "silence" : turns[found].role;
}

/** Turns sorted by start (call order normally is; a late row must not break the search). */
export function sortedTurns<T extends { atS: number }>(turns: readonly T[]): T[] {
  return [...turns].sort((a, b) => a.atS - b.atS);
}

/** Bars below this share of the loudest peak count as silence. */
export const QUIET_SHARE = 0.06;

const BAR_W = 2, BAR_GAP = 1, BAR_RADIUS = 2;

/** Loudest absolute sample of the first channel: one normalisation for every canvas slice. */
export function peakOf(data: ArrayLike<number>): number {
  let max = 0;
  for (let i = 0; i < data.length; i++) {
    const v = Math.abs(data[i]);
    if (v > max) max = v;
  }
  return max;
}

export function speakerRender(opts: {
  turns: readonly { role: "user" | "agent"; atS: number }[];
  colors: SpeakerColors;
  /** Seconds of audio, and the loudest peak of the whole recording. */
  duration: () => number;
  peak: () => number;
  /** CSS width of the whole waveform (wavesurfer's wrapper). */
  totalWidth: () => number;
}): (peaks: Array<Float32Array | number[]>, ctx: CanvasRenderingContext2D) => void {
  const turns = sortedTurns(opts.turns);
  return (peaks, ctx) => {
    const data = peaks[0];
    if (!data || !data.length) return;
    const { width, height } = ctx.canvas;
    const pr = window.devicePixelRatio || 1;
    const barW = BAR_W * pr, step = (BAR_W + BAR_GAP) * pr;
    const bars = Math.max(1, Math.floor(width / step));
    const per = data.length / bars;
    const half = height / 2;
    const max = opts.peak() || 1;
    const offsetCss = parseFloat(ctx.canvas.style.left) || 0;
    const total = opts.totalWidth() || width / pr;
    const duration = opts.duration();
    const paths: Record<Speaker, Path2D> = { agent: new Path2D(), user: new Path2D(), silence: new Path2D() };
    for (let b = 0; b < bars; b++) {
      let v = 0;
      const from = Math.floor(b * per), to = Math.min(data.length, Math.floor((b + 1) * per));
      for (let i = from; i < to; i++) {
        const a = Math.abs(data[i]);
        if (a > v) v = a;
      }
      const share = v / max;
      const x = b * step;
      const s = ((offsetCss + (x + barW / 2) / pr) / total) * duration;
      const who: Speaker = share < QUIET_SHARE ? "silence" : speakerAt(turns, s);
      const h = Math.max(pr, share * half);
      const path = paths[who];
      if ("roundRect" in path) path.roundRect(x, half - h, barW, h * 2, BAR_RADIUS * pr);
      else (path as Path2D).rect(x, half - h, barW, h * 2);
    }
    (["silence", "user", "agent"] as const).forEach((who) => {
      ctx.fillStyle = opts.colors[who];
      ctx.fill(paths[who]);
    });
  };
}
