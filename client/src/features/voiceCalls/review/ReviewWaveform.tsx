// The call review's timeline: the recording's waveform (wavesurfer.js, loaded with
// import() here only, so it never reaches the entry chunk) with a marker where each tool
// ran, a time scale under it (TimeScale, follows zoom and scroll) and one row of controls
// below: one zoom button (it opens − and +) and the Calls page's transcript `search` button at
// the left edge, back 10 s / play / forward 10 s centered, speed and download at the right edge. The decoded audio decides
// the drawing (waveStyle.ts): two channels draw as two lanes (caller, agent), one channel
// as one track coloured by who speaks. Without a recording the markers sit on an empty
// track with a one-line note. `seekRef` lets the transcript seek (and play) the audio.
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Download, Pause, Play, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import type WaveSurfer from "wavesurfer.js";
import type RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import { IconBtn } from "@/components/ui/icon-btn";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme } from "@/hooks/useTheme";
import type { RecordingState } from "./useCallReview";
import { toolTag } from "./toolTags";
import { useToolLabel } from "./useToolLabel";
import { MarkerTrack } from "./MarkerTrack";
import { peakOf } from "./speakerWave";
import { palette, tokenColor, trackHeight, waveMode, waveOptions } from "./waveStyle";
import { clampTime, formatTime, nextSpeed, nextZoom, SKIP_S, ZOOM_LEVELS, type CallReview } from "./reviewMath";
import { TimeScale } from "./TimeScale";

/** Seek to `s` seconds; `play` also starts playback (the Calls page's lines play from there). */
export type SeekRef = RefObject<((s: number, play?: boolean) => void) | null>;
export interface Speakers { agent: string; user: string }

// wavesurfer hides the part already played under its progress layer (a clip-path). In the
// speaker mode that layer is only a wash (waveStyle.ts), so the coloured bars must stay
// visible under it.
const SPEAKER_CSS = '[data-wave-mode="speakers"] > div::part(canvases) { clip-path: none !important; }';

// The control row: two buttons a side, skip / play / skip between. Inline, not a stylesheet
// class: the layout must hold even when a page still runs an older stylesheet.
const row = { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8 } as const;
const side = { display: "flex", alignItems: "center", gap: 6, minWidth: 0 } as const;

const note = { margin: 0, fontSize: 12, color: "var(--mute)" } as const;
const mono = { fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute)", fontVariantNumeric: "tabular-nums" } as const;

/** A tool's marker label: its tag (tone of the tool, like the transcript's tags) as a small pill. */
function markerContent(label: string, tone: string): HTMLElement {
  const el = document.createElement("span");
  el.textContent = label;
  el.title = label;
  Object.assign(el.style, {
    font: "600 10px var(--mono)", color: tokenColor(`color-mix(in srgb, ${tone} 78%, var(--ink))`),
    background: tokenColor(`color-mix(in srgb, ${tone} 14%, var(--card))`),
    border: `1px solid ${tokenColor(`color-mix(in srgb, ${tone} 35%, transparent)`)}`,
    padding: "0 5px", marginLeft: "2px", borderRadius: "var(--r-pill)", whiteSpace: "nowrap", cursor: "pointer", pointerEvents: "auto",
  });
  return el;
}

function Dot({ color, label }: { color: string; label: string }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "var(--r-pill)", background: color }} />{label}</span>;
}

function WaveTrack({ review, blob, url, ext, onTime, seekRef, onFail, onPlay, onPlaying, speakers, search }: {
  review: CallReview; blob: Blob; url: string; ext: string; onTime: (s: number) => void; seekRef: SeekRef; onFail: () => void;
  onPlay?: () => void; onPlaying?: (playing: boolean) => void; speakers: Speakers; search?: ReactNode;
}) {
  const { t } = useTranslation("voiceTab");
  const { isDark } = useTheme();
  const labelOf = useToolLabel();
  const boxRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const peakRef = useRef(0);
  const lanePeaksRef = useRef<number[]>([]);
  const cb = useRef({ onTime, onFail, onPlay, onPlaying });
  cb.current = { onTime, onFail, onPlay, onPlaying };
  const [ready, setReady] = useState(false);
  const [channels, setChannels] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<number>(1);
  const [zoom, setZoom] = useState(0);
  const [time, setTime] = useState(0);
  // The part of the call in view (zoomed in, the waveform scrolls): what the time scale shows.
  const [view, setView] = useState({ start: 0, end: review.durationSeconds });
  const mode = waveMode(channels, review.turns);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let ws: WaveSurfer | null = null;
    let cancelled = false;
    setReady(false);
    (async () => {
      try {
        const [{ default: WaveSurferLib }, { default: Regions }] = await Promise.all([
          import("wavesurfer.js"), import("wavesurfer.js/dist/plugins/regions.js"),
        ]);
        if (cancelled) return;
        const regions = Regions.create();
        // Drawn plain until the audio says how many channels it has (the options effect below).
        ws = WaveSurferLib.create({ container: box, ...waveOptions(palette(), "plain"), plugins: [regions] });
        wsRef.current = ws;
        regionsRef.current = regions;
        let tick = -1;
        const syncView = () => {
          const w = ws;
          if (!w) return;
          const d = w.getDuration();
          const total = w.getWrapper().scrollWidth;
          const width = w.getWidth();
          if (!(d > 0) || !(total > 0)) return;
          const start = (w.getScroll() / total) * d;
          setView({ start, end: Math.min(d, start + (width / total) * d) });
        };
        ws.on("scroll", syncView);
        ws.on("zoom", () => requestAnimationFrame(syncView));
        ws.on("redraw", syncView);
        ws.on("ready", (d) => {
          const audio = ws?.getDecodedData();
          peakRef.current = audio ? peakOf(audio.getChannelData(0)) : 0;
          lanePeaksRef.current = audio ? Array.from({ length: audio.numberOfChannels }, (_, i) => peakOf(audio.getChannelData(i))) : [];
          setChannels(audio?.numberOfChannels ?? 1);
          setView({ start: 0, end: d || review.durationSeconds });
          setReady(true);
        });
        ws.on("timeupdate", (s) => {
          const q = Math.floor(s * 4);
          if (q === tick) return;
          tick = q;
          setTime(s);
          cb.current.onTime(s);
        });
        ws.on("play", () => { setPlaying(true); cb.current.onPlay?.(); cb.current.onPlaying?.(true); });
        ws.on("pause", () => { setPlaying(false); cb.current.onPlaying?.(false); });
        ws.on("finish", () => setPlaying(false));
        ws.on("error", () => { if (!cancelled) cb.current.onFail(); });
        regions.on("region-clicked", (region, e) => { e.stopPropagation(); ws?.setTime(region.start); });
        await ws.loadBlob(blob);
      } catch {
        if (!cancelled) cb.current.onFail();
      }
    })();
    return () => {
      cancelled = true;
      seekRef.current = null;
      ws?.destroy();
      wsRef.current = null;
      regionsRef.current = null;
    };
    // review.durationSeconds is only the fallback before the audio says its own length.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob, seekRef]);

  useEffect(() => {
    if (!ready) return;
    seekRef.current = (s: number, play = false) => {
      const ws = wsRef.current;
      if (!ws) return;
      const to = clampTime(s, ws.getDuration());
      ws.setTime(to);
      setTime(to);
      cb.current.onTime(to);
      if (play && !ws.isPlaying()) void ws.play().catch(() => undefined);
    };
  }, [ready, seekRef]);

  // Colors and markers follow the theme. The theme class flips in the provider's effect,
  // which runs after this child's: read the colors on the next frame.
  useEffect(() => {
    if (!ready) return;
    const id = requestAnimationFrame(() => {
      const ws = wsRef.current, regions = regionsRef.current;
      if (!ws || !regions) return;
      const c = palette();
      ws.setOptions(waveOptions(c, mode, {
        turns: review.turns,
        duration: () => ws.getDuration(),
        peak: () => peakRef.current,
        totalWidth: () => ws.getWrapper().clientWidth,
      }, lanePeaksRef.current));
      regions.clearRegions();
      review.tools.forEach((x, i) => {
        const tag = toolTag(x.name);
        regions.addRegion({
          id: `tool-${i}`, start: clampTime(x.atS, ws.getDuration()), content: markerContent(labelOf(tag), tag.tone),
          color: tokenColor(tag.tone), drag: false, resize: false,
        });
      });
    });
    return () => cancelAnimationFrame(id);
    // labelOf follows the language: re-label when it changes (i18n.language).
  }, [ready, isDark, mode, review.turns, review.tools, labelOf]);

  const ws = () => wsRef.current;
  const cycleSpeed = () => { const r = nextSpeed(rate); setRate(r); ws()?.setPlaybackRate(r, true); };
  const zoomBy = (step: 1 | -1) => { const z = nextZoom(zoom, step); setZoom(z); ws()?.zoom(ZOOM_LEVELS[z]); };
  const download = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${review.callId}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const seekTo = (s: number) => {
    const w = ws();
    if (!w) return;
    const to = clampTime(s, w.getDuration());
    w.setTime(to);
    setTime(to);
    cb.current.onTime(to);
  };
  const speedLabel = `${rate}x`;

  // Speed shows only the current one; a click moves to the next.
  const speedBtn = (
    <IconBtn onClick={cycleSpeed} disabled={!ready} aria-label={`${t("test.panel.review.speed")}: ${speedLabel}`} title={`${t("test.panel.review.speed")}: ${speedLabel}`}
      style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, fontVariantNumeric: "tabular-nums" }} data-testid="voice-test-review-speed">
      {speedLabel}
    </IconBtn>
  );
  const downloadBtn = (
    <IconBtn onClick={download} aria-label={t("test.panel.review.download")} title={t("test.panel.review.download")} data-testid="voice-test-review-download"><Download className="h-4 w-4" /></IconBtn>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div className="neu-inset-super-crisp" style={{ borderRadius: "var(--r-flush)", padding: "6px 4px 0", minHeight: trackHeight(mode) + 34, position: "relative" }}>
        {mode === "speakers" && <style>{SPEAKER_CSS}</style>}
        <div ref={boxRef} aria-label={t("test.panel.review.recording")} role="group" data-testid="voice-test-review-waveform" data-wave-mode={ready ? mode : undefined} />
        {ready && <TimeScale startS={view.start} endS={view.end} currentS={time} onSeek={seekTo} />}
        {!ready && <p style={{ ...note, position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{t("test.panel.review.recordingLoading")}</p>}
      </div>
      {ready && (
        // The legend on the left, the time centered above the play button.
        <div style={{ position: "relative", display: "flex", alignItems: "center", minHeight: 16 }}>
          {mode !== "plain" ? (
            <div style={{ display: "flex", gap: 14, ...mono }} aria-hidden data-testid="voice-test-review-legend">
              <Dot color={mode === "stereo" ? "var(--mute-2)" : "var(--ink)"} label={speakers.user} />
              <Dot color="hsl(var(--chart-wine))" label={speakers.agent} />
            </div>
          ) : null}
          <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums" }} data-testid="voice-test-review-time">
            {formatTime(time)} / {formatTime(review.durationSeconds)}
          </span>
        </div>
      )}
      <div style={row} data-testid="voice-test-review-transport">
        <div style={side} data-testid="voice-test-review-zoom">
          <Popover>
            <PopoverTrigger asChild>
              <IconBtn active={zoom > 0} disabled={!ready} aria-label={t("test.panel.review.zoom")} title={t("test.panel.review.zoom")}><ZoomIn className="h-4 w-4" /></IconBtn>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="flex w-auto gap-1.5 p-1.5">
              <IconBtn onClick={() => zoomBy(-1)} disabled={!ready || zoom === 0} aria-label={t("test.panel.review.zoomOut")} title={t("test.panel.review.zoomOut")}><ZoomOut className="h-4 w-4" /></IconBtn>
              <IconBtn onClick={() => zoomBy(1)} disabled={!ready || zoom === ZOOM_LEVELS.length - 1} aria-label={t("test.panel.review.zoomIn")} title={t("test.panel.review.zoomIn")}><ZoomIn className="h-4 w-4" /></IconBtn>
            </PopoverContent>
          </Popover>
          {search}
        </div>
        <div style={{ ...side, gap: 8 }}>
          <IconBtn onClick={() => ws()?.skip(-SKIP_S)} disabled={!ready} aria-label={t("test.panel.review.back")} title={t("test.panel.review.back")}><RotateCcw className="h-4 w-4" /></IconBtn>
          <IconBtn onClick={() => { void ws()?.playPause(); }} disabled={!ready} active={playing} aria-label={playing ? t("test.panel.review.pause") : t("test.panel.review.play")} title={playing ? t("test.panel.review.pause") : t("test.panel.review.play")} data-testid="voice-test-review-play">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </IconBtn>
          <IconBtn onClick={() => ws()?.skip(SKIP_S)} disabled={!ready} aria-label={t("test.panel.review.forward")} title={t("test.panel.review.forward")}><RotateCw className="h-4 w-4" /></IconBtn>
        </div>
        <div style={{ ...side, justifyContent: "flex-end" }}>
          {speedBtn}
          {downloadBtn}
        </div>
      </div>
    </div>
  );
}

export function ReviewWaveform({ review, recording, currentS, onTime, seekRef, speakers, missingNote, onPlay, onPlaying, search }: {
  review: CallReview; recording: RecordingState; currentS: number; onTime: (s: number) => void; seekRef: SeekRef;
  /** The sides' names in the legend; defaults to the test panel's "You" / "Agent". */
  speakers?: Speakers;
  /** Replaces "no recording" (the Calls page says why: pending, expired, unavailable). */
  missingNote?: string;
  /** Playback started (the Calls page picks follow-scroll up again). */
  onPlay?: () => void;
  onPlaying?: (playing: boolean) => void;
  /** The transcript search (the Calls page): a round button after the zoom button. */
  search?: ReactNode;
}) {
  const { t } = useTranslation("voiceTab");
  const [failed, setFailed] = useState(false);
  const blob = recording.status === "ready" ? recording.blob : null;
  useEffect(() => setFailed(false), [blob]);
  const names = speakers ?? { agent: t("test.eleven.agent"), user: t("test.eleven.you") };

  if (recording.status === "ready" && !failed) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <WaveTrack review={review} blob={recording.blob} url={recording.url} ext={recording.ext} onTime={onTime} seekRef={seekRef}
          onFail={() => setFailed(true)} onPlay={onPlay} onPlaying={onPlaying} speakers={names} search={search} />
      </div>
    );
  }
  const line = recording.status === "loading" ? "recordingLoading" : failed ? "recordingFailed" : "noRecording";
  const text = line === "noRecording" && missingNote ? missingNote : t(`test.panel.review.${line}`);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <MarkerTrack tools={review.tools} durationS={review.durationSeconds} currentS={currentS} onSeek={onTime} />
      <p style={note} data-testid="voice-test-review-recording-note">{text}</p>
      {search && <div style={{ display: "flex" }}>{search}</div>}
    </div>
  );
}
