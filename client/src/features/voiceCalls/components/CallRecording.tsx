import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, Pause, Download } from "lucide-react";
import { ENGINE_BASE_URL } from "@/features/voiceDemo/engine";
import { formatDuration } from "../format";

const BARS = 56;

/** Stable decorative waveform per recording (no audio analysis needed). */
function waveFor(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Array.from({ length: BARS }, (_, i) => {
    h = (h * 1103515245 + 12345) | 0;
    const noise = ((h >>> 8) & 0xff) / 255;
    return 0.25 + 0.6 * noise * (0.6 + 0.4 * Math.sin(i / 3));
  });
}

/** Voicemail-style player (Missed Calls look) over OpenAI's 30-day recording. */
export function CallRecording({ sessionId, fallbackSeconds }: { sessionId: string | null; fallbackSeconds: number | null }) {
  const { t } = useTranslation("voiceCalls");
  const audioRef = useRef<HTMLAudioElement>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const wave = useMemo(() => waveFor(sessionId ?? ""), [sessionId]);

  if (!sessionId || failed) {
    return (
      <div style={{ borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", padding: "12px 14px", fontSize: 13, color: "var(--mute)" }}>
        {t("recordingExpired")}
      </div>
    );
  }

  const src = `${ENGINE_BASE_URL}/voice/live/recording/${encodeURIComponent(sessionId)}`;
  const total = duration ?? fallbackSeconds;
  const progress = total ? Math.min(current / total, 1) : 0;

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => setFailed(true));
    else a.pause();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  return (
    <div className="neu-raised" style={{ borderRadius: "var(--r-surface)", background: "var(--card)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 14 }}>
      <audio
        key={sessionId}
        ref={audioRef}
        preload="none"
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d)) setDuration(d); }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onError={() => setFailed(true)}
      />
      <button
        onClick={toggle}
        aria-label={playing ? t("pause") : t("play")}
        style={{ width: 38, height: 38, flexShrink: 0, borderRadius: "50%", border: "none", cursor: "pointer", background: "var(--wine-grad)", color: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--sh-raised-crisp)" }}
      >
        {playing ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
      </button>
      <div onClick={seek} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 2, height: 34, cursor: duration ? "pointer" : "default" }}>
        {wave.map((h, i) => (
          <span key={i} style={{ flex: 1, height: `${Math.round(h * 100)}%`, minWidth: 2, borderRadius: 2, background: i / BARS < progress ? "var(--wine)" : "var(--line-strong)" }} />
        ))}
      </div>
      <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--mute)", flexShrink: 0 }}>
        {current > 0 ? `${formatDuration(current)} / ` : ""}{formatDuration(total != null ? Math.round(total) : null)}
      </span>
      <a
        href={src}
        download
        target="_blank"
        rel="noreferrer"
        className="la-btn la-btn--icon"
        aria-label={t("download")}
        style={{ background: "transparent", boxShadow: "none", color: "var(--mute-2)", flexShrink: 0 }}
      >
        <Download size={14} />
      </a>
    </div>
  );
}
