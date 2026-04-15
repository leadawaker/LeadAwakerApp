import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Pause, Play, Download, Loader2 } from "lucide-react";

// Global audio manager: only one player at a time
let _activeAudio: HTMLAudioElement | null = null;
let _activePauseCb: (() => void) | null = null;

function claimPlayback(audio: HTMLAudioElement, onPaused: () => void) {
  if (_activeAudio && _activeAudio !== audio) {
    _activeAudio.pause();
    _activePauseCb?.();
  }
  _activeAudio = audio;
  _activePauseCb = onPaused;
}

function releasePlayback(audio: HTMLAudioElement) {
  if (_activeAudio === audio) {
    _activeAudio = null;
    _activePauseCb = null;
  }
}

export function VoiceMemoPlayer({ url, color = "#0ABFA3" }: { url: string; outbound?: boolean; color?: string }) {
  const { t } = useTranslation("conversations");
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const [loading, setLoading] = useState(false);
  const rafRef = useRef<number | null>(null);

  const BAR_COUNT = 60;
  const [bars, setBars] = useState<number[] | null>(null);
  const waveformDecoded = useRef(false);

  // rAF loop for smooth progress
  const startRaf = useCallback(() => {
    const tick = () => {
      const a = audioRef.current;
      if (!a) return;
      setCurrentTime(a.currentTime);
      if (!a.paused && !a.ended) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  useEffect(() => () => stopRaf(), [stopRaf]);

  // Duration from metadata (fires after first play with preload=none)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onMeta = () => setDuration(isFinite(a.duration) ? a.duration : 0);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    if (isFinite(a.duration) && a.duration > 0) setDuration(a.duration);
    return () => { a.removeEventListener("loadedmetadata", onMeta); a.removeEventListener("durationchange", onMeta); };
  }, [url]);

  // Generate hash-based waveform immediately (fast, no decode)
  useEffect(() => {
    const seed = url.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    setBars(Array.from({ length: BAR_COUNT }, (_, i) => {
      const h = Math.abs(Math.sin((seed + i * 137.5) * 0.1));
      return Math.round(2 + h * 18);
    }));
  }, [url]);

  // Decode real waveform lazily (after first play)
  const decodeWaveform = useCallback(async () => {
    if (waveformDecoded.current) return;
    waveformDecoded.current = true;
    try {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const ctx = new AudioContext();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      ctx.close();

      const channelData: Float32Array[] = [];
      for (let c = 0; c < decoded.numberOfChannels; c++) {
        channelData.push(decoded.getChannelData(c));
      }
      const totalSamples = decoded.length;
      const samplesPerBar = Math.floor(totalSamples / BAR_COUNT);

      const heights = Array.from({ length: BAR_COUNT }, (_, i) => {
        const start = i * samplesPerBar;
        const end = Math.min(start + samplesPerBar, totalSamples);
        let sum = 0, count = 0;
        for (let s = start; s < end; s++) {
          let val = 0;
          for (const ch of channelData) val += ch[s];
          val /= channelData.length;
          sum += val * val;
          count++;
        }
        return count > 0 ? Math.sqrt(sum / count) : 0;
      });

      const maxRms = Math.max(...heights, 0.001);
      setBars(heights.map(v => Math.round(2 + (v / maxRms) * 18)));
    } catch {
      // Keep the hash-based waveform
    }
  }, [url]);

  const fmt = (s: number) => {
    if (!isFinite(s) || isNaN(s) || s <= 0) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a || loading) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      stopRaf();
      releasePlayback(a);
    } else {
      // Pause any other playing audio
      claimPlayback(a, () => { setPlaying(false); stopRaf(); });
      setLoading(true);
      a.play().then(() => {
        setPlaying(true);
        setLoading(false);
        startRaf();
        decodeWaveform(); // start real waveform decode in background
      }).catch((err) => {
        setLoading(false);
        releasePlayback(a);
        console.error("[VoiceMemoPlayer] Audio play failed:", err);
      });
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a) return;
    const dur = isFinite(a.duration) && a.duration > 0 ? a.duration : duration;
    if (!dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * dur;
    setCurrentTime(a.currentTime);
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = audioRef.current;
    const next: 1 | 1.5 | 2 = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (a) a.playbackRate = next;
  };

  const downloadAudio = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `voice-memo.${url.includes("ogg") ? "ogg" : "webm"}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error("[VoiceMemoPlayer] Download failed:", err);
    }
  };

  const liveTime = audioRef.current?.currentTime ?? currentTime;
  const liveDur = (audioRef.current && isFinite(audioRef.current.duration) && audioRef.current.duration > 0)
    ? audioRef.current.duration
    : duration;
  const progress = liveDur > 0 ? liveTime / liveDur : 0;
  const playedCount = Math.round(progress * BAR_COUNT);

  return (
    <div className="flex items-center gap-2.5" style={{ minWidth: 220, maxWidth: 280 }}>
      <audio
        ref={audioRef}
        src={url}
        preload="none"
        onLoadedMetadata={() => {
          const a = audioRef.current;
          if (a && isFinite(a.duration)) setDuration(a.duration);
        }}
        onEnded={() => {
          setPlaying(false);
          stopRaf();
          setCurrentTime(0);
          releasePlayback(audioRef.current!);
        }}
      />

      {/* Play/Pause circle */}
      <button
        type="button"
        onClick={toggle}
        className="h-10 w-10 rounded-full text-white flex items-center justify-center shrink-0 transition-colors shadow-sm"
        style={{ backgroundColor: color }}
        aria-label={playing ? t("chat.pause") : t("chat.play")}
      >
        {loading
          ? <Loader2 className="h-4 w-4 text-white animate-spin" />
          : playing
            ? <Pause className="h-4 w-4 fill-white stroke-none" />
            : <Play  className="h-4 w-4 fill-white stroke-none ml-0.5" />}
      </button>

      {/* Waveform + time column */}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div
          className="flex items-center gap-[1px] cursor-pointer"
          style={{ height: 24 }}
          onClick={seek}
          title={t("chat.seek")}
        >
          {bars === null
            ? Array.from({ length: BAR_COUNT }, (_, i) => (
                <div key={i} className="shrink-0 animate-pulse" style={{ width: 2, height: 4, borderRadius: 1, backgroundColor: "rgba(160,160,160,0.25)" }} />
              ))
            : bars.map((h, i) => (
                <div
                  key={i}
                  className="shrink-0"
                  style={{
                    width: 2,
                    height: h,
                    borderRadius: 1,
                    backgroundColor: i < playedCount ? color : "rgba(160,160,160,0.35)",
                    transition: "background-color 60ms linear",
                  }}
                />
              ))
          }
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] tabular-nums leading-none" style={{ color: "#888" }}>
            {playing || currentTime > 0 ? fmt(liveTime) : fmt(liveDur)}
          </span>
          <div className="flex flex-col items-center gap-0.5">
            <button
              type="button"
              onClick={downloadAudio}
              className="opacity-40 hover:opacity-80 transition-opacity"
              title={t("chat.download")}
            >
              <Download className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={cycleSpeed}
              className="text-[9px] font-bold tabular-nums leading-none"
              style={{ color: "#999" }}
              title={t("chat.playbackSpeed")}
            >
              {speed}×
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
