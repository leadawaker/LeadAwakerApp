// Colours and wavesurfer options for the review's waveform. Canvas needs real colours, so
// tokens are resolved the way the page paints them (light or dark).
//
// Two channels (GPT Live: caller left, agent right) draw as two lanes, as before. One
// channel (ElevenLabs) draws as one track coloured by who speaks (speakerWave.ts); the
// part already played is washed toward the card colour, so the hues stay readable.
// Without turns a one-channel track keeps the plain look (neutral, wine once played).
import type { WaveSurferOptions } from "wavesurfer.js";
import { speakerRender } from "./speakerWave";
import type { ReviewTurn } from "./reviewMath";

export const LANE_PX = 40;

/** Canvas needs real colors: resolve a token expression the way the page paints it. */
export function tokenColor(expr: string): string {
  const el = document.createElement("span");
  el.style.color = expr;
  el.style.display = "none";
  document.body.appendChild(el);
  const c = getComputedStyle(el).color;
  el.remove();
  return c;
}

/** "rgb(r, g, b)" as "rgba(r, g, b, a)": plain syntax every canvas accepts. */
function withAlpha(rgb: string, a: number): string {
  const m = rgb.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${a})` : rgb;
}

export function palette() {
  return {
    wave: tokenColor("var(--mute-2)"), progress: tokenColor("var(--ink-soft)"), cursor: tokenColor("var(--ink)"),
    agentWave: tokenColor("hsl(var(--chart-wine) / 0.45)"), agentProgress: tokenColor("hsl(var(--chart-wine))"),
    // One-track speaker colours: the agent in the lighter chart wine (the brand wine is too dark
    // beside the ink), the caller in ink, silence neutral.
    speakerAgent: tokenColor("hsl(var(--chart-wine))"), speakerUser: tokenColor("var(--ink)"), silence: tokenColor("var(--mute-2)"),
    playedWash: withAlpha(tokenColor("var(--card)"), 0.45),
  };
}
export type Palette = ReturnType<typeof palette>;

/** How the track is drawn: two lanes, one track coloured by speaker, or one plain track. */
export type WaveMode = "stereo" | "speakers" | "plain";

export function waveMode(channels: number, turns: readonly ReviewTurn[]): WaveMode {
  if (channels >= 2) return "stereo";
  return turns.length ? "speakers" : "plain";
}

export function trackHeight(mode: WaveMode): number {
  return mode === "stereo" ? LANE_PX * 2 : LANE_PX * 1.5;
}

/** What the speaker colouring reads from the player: the turns and the audio's length, peak and drawn width. */
export type SpeakerSource = Omit<Parameters<typeof speakerRender>[0], "colors">;

const base = (c: Palette, mode: WaveMode): Partial<WaveSurferOptions> => ({
  height: mode === "stereo" ? LANE_PX : LANE_PX * 1.5, cursorColor: c.cursor, cursorWidth: 1.5,
  barWidth: 2, barGap: 1, barRadius: 2, normalize: true, dragToSeek: true, autoScroll: true, autoCenter: true,
});

/** Quietest peak a lane is stretched from: below it the lane is silence and draws flat, not full bars. */
const SILENCE_FLOOR = 0.05;

/** A lane's normalisation peak: its own loudest sample (the whole call, not per canvas slice), never below the floor. */
const lanePeak = (peaks: readonly number[] | undefined, lane: number) =>
  peaks ? Math.max(peaks[lane] ?? 0, SILENCE_FLOOR) : undefined;

export function waveOptions(c: Palette, mode: WaveMode, speaker?: SpeakerSource, lanePeaks?: readonly number[]): Partial<WaveSurferOptions> {
  if (mode === "stereo") {
    return {
      ...base(c, mode), waveColor: c.wave, progressColor: c.progress,
      splitChannels: [
        { waveColor: c.wave, progressColor: c.progress, height: LANE_PX, maxPeak: lanePeak(lanePeaks, 0) },
        { waveColor: c.agentWave, progressColor: c.agentProgress, height: LANE_PX, maxPeak: lanePeak(lanePeaks, 1) },
      ],
    };
  }
  if (mode === "speakers" && speaker) {
    return { ...base(c, mode), waveColor: c.silence, progressColor: c.playedWash, renderFunction: speakerRender({ ...speaker, colors: { agent: c.speakerAgent, user: c.speakerUser, silence: c.silence } }) };
  }
  return { ...base(c, mode), waveColor: c.wave, progressColor: c.agentProgress, renderFunction: undefined };
}
