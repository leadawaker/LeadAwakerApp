import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDuration } from "../format";
import { talkShare, type Segment } from "../useCallAudio";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const ROW = 30;

export interface PlayerState {
  playing: boolean;
  current: number;
  duration: number;
  volume: number;
  muted: boolean;
  rate: number;
}

export interface PlayerControls {
  toggle: () => void;
  seek: (seconds: number) => void;
  skip: (delta: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setRate: (r: number) => void;
}

interface Track { label: string; title: string; fill: string; edge: string; segments: Segment[]; share: number }

function SkipButton({ back, onClick, label }: { back?: boolean; onClick: () => void; label: string }) {
  const Icon = back ? RotateCcw : RotateCw;
  return (
    <button onClick={onClick} aria-label={label} title={label} style={{ position: "relative", width: 38, height: 38, border: "none", background: "transparent", cursor: "pointer", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icon size={32} strokeWidth={1.8} />
      <span style={{ position: "absolute", fontSize: 10, fontWeight: 700, top: 13 }}>15</span>
    </button>
  );
}

/**
 * Call player in the HubSpot layout: transport controls on top, then one line
 * per speaker showing when each side talked, with a playhead across both.
 */
export function CallPlayer({
  state, controls, caller, ai, callerLabel, callerTitle,
}: {
  state: PlayerState;
  controls: PlayerControls;
  caller: Segment[];
  ai: Segment[];
  callerLabel: string;
  callerTitle: string;
}) {
  const { t } = useTranslation("voiceCalls");
  const [showTracks, setShowTracks] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const { playing, current, duration, volume, muted, rate } = state;
  const pct = (s: number) => (duration > 0 ? `${Math.min(100, (s / duration) * 100)}%` : "0%");
  const share = talkShare(caller, ai);
  const tracks: Track[] = [
    { label: callerLabel, title: callerTitle, fill: "var(--paper)", edge: "var(--ink)", segments: caller, share: share.caller },
    { label: t("aiShort"), title: t("ai"), fill: "var(--ink)", edge: "var(--ink)", segments: ai, share: share.ai },
  ];

  const seekAt = (clientX: number) => {
    const el = trackRef.current;
    if (!el || !duration) return;
    const rect = el.getBoundingClientRect();
    controls.seek(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * duration);
  };

  const labelCol = { width: 40, flexShrink: 0, fontSize: 12, fontWeight: 700, color: "var(--mute)" } as const;
  const valueCol = { width: 44, flexShrink: 0, textAlign: "right", fontSize: 12, color: "var(--mute)" } as const;
  const rowStyle = { height: ROW, display: "flex", alignItems: "center" } as const;

  return (
    <div>
      {/* Transport */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <button onClick={controls.toggleMute} aria-label={t("volume")} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-soft)", display: "flex", padding: 2 }}>
            {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
            onChange={(e) => controls.setVolume(Number(e.target.value))}
            aria-label={t("volume")}
            className="hidden sm:block"
            style={{ width: 110, accentColor: "var(--ink)" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <SkipButton back onClick={() => controls.skip(-15)} label={t("skipBack")} />
          <button
            onClick={controls.toggle}
            aria-label={playing ? t("pause") : t("play")}
            style={{ width: 46, height: 46, borderRadius: "50%", cursor: "pointer", background: "transparent", border: "1.5px solid var(--line-strong)", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />}
          </button>
          <SkipButton onClick={() => controls.skip(15)} label={t("skipForward")} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--wine)", fontWeight: 700, fontSize: 13.5, display: "inline-flex", alignItems: "center", gap: 4 }}>
                {t("speed")} {rate}x <ChevronDown size={15} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-28 glass-strong border-none">
              {SPEEDS.map((s) => (
                <DropdownMenuItem key={s} onClick={() => controls.setRate(s)} style={{ fontWeight: s === rate ? 700 : 400 }}>
                  {s}x
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Timeline: overall progress, then one line per speaker */}
      <div style={{ display: "flex", marginTop: 16, userSelect: "none" }}>
        <div>
          <div style={{ ...rowStyle, ...labelCol, fontFamily: "var(--mono)", color: "var(--ink)" }}>{formatDuration(current)}</div>
          {showTracks && tracks.map((tr) => (
            <div key={tr.label} title={tr.title} style={{ ...rowStyle, ...labelCol }}>{tr.label}</div>
          ))}
        </div>
        <div
          ref={trackRef}
          onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); seekAt(e.clientX); }}
          onPointerMove={(e) => { if (dragging.current) seekAt(e.clientX); }}
          onPointerUp={() => { dragging.current = false; }}
          style={{ flex: 1, minWidth: 0, position: "relative", margin: "0 12px", cursor: duration ? "pointer" : "default", touchAction: "none" }}
        >
          <div style={rowStyle}>
            <div style={{ position: "relative", width: "100%", height: 5, borderRadius: 3, background: "var(--line)" }}>
              <div style={{ position: "absolute", inset: 0, width: pct(current), borderRadius: 3, background: "var(--mute-2)" }} />
            </div>
          </div>
          {showTracks && tracks.map((tr) => (
            <div key={tr.label} style={rowStyle}>
              <div style={{ position: "relative", width: "100%", height: 2, background: "var(--line)" }}>
                {tr.segments.map((s) => (
                  <span key={s.start} style={{ position: "absolute", top: -4, height: 10, borderRadius: 5, left: pct(s.start), width: `max(4px, calc(${pct(s.end)} - ${pct(s.start)}))`, background: tr.fill, border: `1.5px solid ${tr.edge}`, boxSizing: "border-box" }} />
                ))}
              </div>
            </div>
          ))}
          {/* Playhead */}
          <div style={{ position: "absolute", top: 4, bottom: 4, left: pct(current), width: 0, pointerEvents: "none" }}>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: -0.75, width: 1.5, background: "var(--ink)" }} />
            <div style={{ position: "absolute", top: -2, left: -6, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "7px solid var(--ink)" }} />
            <div style={{ position: "absolute", bottom: -2, left: -6, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: "7px solid var(--ink)" }} />
          </div>
        </div>
        <div>
          <div style={{ ...rowStyle, ...valueCol, justifyContent: "flex-end", fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink)" }}>{formatDuration(Math.round(duration))}</div>
          {showTracks && tracks.map((tr) => (
            <div key={tr.label} style={{ ...rowStyle, ...valueCol, justifyContent: "flex-end" }}>{tr.share}%</div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}>
        <button onClick={() => setShowTracks((v) => !v)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px" }}>
          {showTracks ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          {showTracks ? t("hideSpeakers") : t("showSpeakers")}
        </button>
      </div>
    </div>
  );
}
