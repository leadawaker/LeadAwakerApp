import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Pause, Play } from "lucide-react";

export function VoiceMemoPlayer({ url, color = "#0ABFA3" }: { url: string; outbound?: boolean; color?: string }) {
  const { t } = useTranslation("conversations");
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const rafRef = useRef<number | null>(null);

  // rAF loop — polls audio.currentTime every frame while playing for smooth bar fill
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

  // Try to load duration as soon as element mounts
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onMeta = () => setDuration(isFinite(a.duration) ? a.duration : 0);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    if (isFinite(a.duration) && a.duration > 0) setDuration(a.duration);
    return () => { a.removeEventListener("loadedmetadata", onMeta); a.removeEventListener("durationchange", onMeta); };
  }, [url]);

  // Real waveform via Web Audio API — decode the audio and sample RMS per bar bucket
  const BAR_COUNT = 60;
  const [bars, setBars] = useState<number[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        if (cancelled) return;
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        ctx.close();
        if (cancelled) return;

        // Mix down to mono by averaging all channels
        const channelData: Float32Array[] = [];
        for (let c = 0; c < decoded.numberOfChannels; c++) {
          channelData.push(decoded.getChannelData(c));
        }
        const totalSamples = decoded.length;
        const samplesPerBar = Math.floor(totalSamples / BAR_COUNT);

        const heights = Array.from({ length: BAR_COUNT }, (_, i) => {
          const start = i * samplesPerBar;
          const end   = Math.min(start + samplesPerBar, totalSamples);
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

        // Normalize: map 0..max → 2..20 (px)
        const maxRms = Math.max(...heights, 0.001);
        const normalized = heights.map(v => Math.round(2 + (v / maxRms) * 18));
        if (!cancelled) setBars(normalized);
      } catch {
        // Fallback to hash-based fake waveform if decode fails
        if (!cancelled) {
          const seed = url.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
          setBars(Array.from({ length: BAR_COUNT }, (_, i) => {
            const h = Math.abs(Math.sin((seed + i * 137.5) * 0.1));
            return Math.round(2 + h * 18);
          }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  const fmt = (s: number) => {
    if (!isFinite(s) || isNaN(s) || s <= 0) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      stopRaf();
    } else {
      a.play().then(() => { setPlaying(true); startRaf(); }).catch((err) => console.error("[VoiceMemoPlayer] Audio play failed:", err));
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

  // Derive playedCount from live audio element (more accurate than state)
  const liveTime = audioRef.current?.currentTime ?? currentTime;
  const liveDur  = (audioRef.current && isFinite(audioRef.current.duration) && audioRef.current.duration > 0)
    ? audioRef.current.duration
    : duration;
  const progress    = liveDur > 0 ? liveTime / liveDur : 0;
  const playedCount = Math.round(progress * BAR_COUNT);

  return (
    <div className="flex items-center gap-2.5" style={{ minWidth: 220, maxWidth: 280 }}>
      <audio
        ref={audioRef}
        src={url}
        preload="auto"
        onLoadedMetadata={() => {
          const a = audioRef.current;
          if (a && isFinite(a.duration)) setDuration(a.duration);
        }}
        onEnded={() => { setPlaying(false); stopRaf(); setCurrentTime(0); }}
      />

      {/* Play/Pause circle */}
      <button
        type="button"
        onClick={toggle}
        className="h-10 w-10 rounded-full text-white flex items-center justify-center shrink-0 transition-colors shadow-sm"
        style={{ backgroundColor: color }}
        aria-label={playing ? t("chat.pause") : t("chat.play")}
      >
        {playing
          ? <Pause className="h-4 w-4 fill-white stroke-none" />
          : <Play  className="h-4 w-4 fill-white stroke-none ml-0.5" />}
      </button>

      {/* Waveform + time column */}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        {/* Waveform bars — color = played, transparent gray = unplayed, centered */}
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

        {/* Time + speed row */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] tabular-nums leading-none" style={{ color: "#888" }}>
            {playing || currentTime > 0 ? fmt(liveTime) : fmt(liveDur)}
          </span>
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
  );
}
