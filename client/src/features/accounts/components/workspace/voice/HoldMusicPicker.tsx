// The hold music picker: a popover that plays each track, by default through
// the narrow band of a phone line, and shades how much of it fits in the time
// the owner's phone rings.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Music, Pause, Play } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Chip } from "../communication/wizardAtoms";
import { helpStyle } from "./voiceAtoms";
import { HOLD_TRACKS, RING_SECONDS, holdTrackUrl } from "./holdMusic";

interface Graph { ctx: AudioContext; src: MediaElementAudioSourceNode; hp: BiquadFilterNode; lp: BiquadFilterNode }

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** One audio element for the whole list, optionally heard as a caller hears it. */
function useHoldPlayer(phone: boolean, loop: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [failed, setFailed] = useState(false);

  const audio = () => {
    if (!audioRef.current) {
      const a = new Audio();
      // The phone filter reads the samples, which a cross-origin file only allows with CORS.
      a.crossOrigin = "anonymous";
      a.preload = "none";
      a.addEventListener("timeupdate", () => setTime(a.currentTime));
      a.addEventListener("play", () => setPlaying(true));
      a.addEventListener("pause", () => setPlaying(false));
      a.addEventListener("ended", () => setTime(0));
      a.addEventListener("error", () => { setPlaying(false); setFailed(true); });
      audioRef.current = a;
    }
    return audioRef.current;
  };

  const route = (g: Graph, narrow: boolean) => {
    g.src.disconnect();
    g.lp.disconnect();
    if (narrow) { g.src.connect(g.hp); g.lp.connect(g.ctx.destination); } else g.src.connect(g.ctx.destination);
  };

  /** Built on the first play, which is a click: browsers start no audio graph before one. */
  const graph = () => {
    if (graphRef.current) return graphRef.current;
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaElementSource(audio());
      // A phone line passes roughly 300 to 3400 Hz.
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 300; hp.Q.value = 0.7;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 3400; lp.Q.value = 0.7;
      hp.connect(lp);
      graphRef.current = { ctx, src, hp, lp };
      route(graphRef.current, phone);
    } catch {
      // No Web Audio: the track still plays, unfiltered.
    }
    return graphRef.current;
  };

  useEffect(() => { if (graphRef.current) route(graphRef.current, phone); }, [phone]);
  useEffect(() => { if (audioRef.current) audioRef.current.loop = loop; }, [loop]);
  // The popover closing unmounts the list: the music stops with it.
  useEffect(() => () => {
    audioRef.current?.pause();
    void graphRef.current?.ctx.close();
  }, []);

  /** Play this track (from `at` seconds when given), or pause it when it is the one playing. */
  const toggle = (id: string, at?: number) => {
    const a = audio();
    void graph()?.ctx.resume();
    if (current === id && !a.paused && at === undefined) { a.pause(); return; }
    if (current !== id) {
      a.src = holdTrackUrl(id);
      a.loop = loop;
      setCurrent(id);
      setTime(0);
      setFailed(false);
    }
    if (at !== undefined) a.currentTime = at;
    a.play().catch(() => { /* the error event reports it */ });
  };

  return { current, playing, time, failed, toggle };
}

function HoldMusicList({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t } = useTranslation("voiceTab");
  const hm = (k: string, o?: Record<string, unknown>) => t(`transfer.holdMusic.${k}`, o);
  const [phone, setPhone] = useState(true);
  const [loop, setLoop] = useState(true);
  const player = useHoldPlayer(phone, loop);

  return (
    <div style={{ padding: 16 }}>
      <div className="eyebrow eyebrow-sm" style={{ marginBottom: 6 }}>{hm("title")}</div>
      <p style={helpStyle}>{hm("help", { seconds: RING_SECONDS })}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <Chip selected={phone} onClick={() => setPhone((v) => !v)} label={hm("phone")} />
        <Chip selected={loop} onClick={() => setLoop((v) => !v)} label={hm("loop")} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {HOLD_TRACKS.map(({ id, seconds }) => {
          const title = hm(`tracks.${id}.title`);
          const isCurrent = player.current === id;
          const isPlaying = isCurrent && player.playing;
          const chosen = value === id;
          const at = isCurrent ? Math.min(player.time, seconds) : 0;
          const ring = `${(RING_SECONDS / seconds) * 100}%`;
          return (
            <div
              key={id}
              className={chosen ? undefined : "neu-inset-crisp"}
              data-testid={`hold-track-${id}`}
              style={{
                padding: "11px 12px", borderRadius: "var(--r-button)",
                border: chosen ? "1px solid var(--wine)" : "1px solid transparent",
                background: chosen ? "var(--wine-tint)" : "var(--bg)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  className={`la-btn la-btn--icon la-btn--pill ${isPlaying ? "la-btn--wine" : "la-btn--soft"}`}
                  onClick={() => player.toggle(id)}
                  aria-label={hm(isPlaying ? "pause" : "play", { title })}
                  title={hm(isPlaying ? "pause" : "play", { title })}
                  style={{ flexShrink: 0 }}
                >
                  {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
                  <div style={{ fontSize: 12, color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hm(`tracks.${id}.by`)}</div>
                </div>
                {chosen ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--wine)", flexShrink: 0 }}>
                    <Check size={13} />{hm("chosen")}
                  </span>
                ) : (
                  <button type="button" className="la-btn la-btn--soft" onClick={() => onChange(id)} style={{ flexShrink: 0 }}>
                    {hm("choose")}
                  </button>
                )}
              </div>
              {/* Click anywhere on the line to play from there; the shaded start is the ring time. */}
              <div
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  player.toggle(id, Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * seconds);
                }}
                style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 9, cursor: "pointer" }}
              >
                <div style={{ position: "relative", flex: 1, height: 14 }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: ring, background: "var(--wine-tint)", borderRight: "1px solid var(--wine)", borderRadius: "3px 0 0 3px" }} />
                  <div style={{ position: "absolute", left: 0, right: 0, top: 6, height: 2, background: "var(--line)" }} />
                  <div style={{ position: "absolute", left: 0, top: 6, height: 2, width: `${(at / seconds) * 100}%`, background: "var(--wine)" }} />
                </div>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute)", flexShrink: 0 }}>
                  {clock(at)} / {clock(seconds)}
                </span>
              </div>
              {isCurrent && player.failed && (
                <p role="alert" style={{ ...helpStyle, margin: "8px 0 0", color: "var(--stage-lost)" }}>{hm("loadFailed")}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HoldMusicPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t } = useTranslation("voiceTab");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--ink-soft)", minWidth: 0 }}>
        <Music size={14} style={{ color: "var(--mute)", flexShrink: 0 }} />
        {t(`transfer.holdMusic.tracks.${value}.title`)}
        <span style={{ color: "var(--mute)" }}>{t(`transfer.holdMusic.tracks.${value}.by`)}</span>
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="la-btn la-btn--soft" data-testid="hold-music-open">
            {t("transfer.holdMusic.open")}
          </button>
        </PopoverTrigger>
        {/* Beside the button, where the whole height of the window is free; it scrolls inside past that. */}
        <PopoverContent
          side="right"
          align="start"
          collisionPadding={12}
          className="p-0"
          style={{ width: "min(92vw, 420px)", maxHeight: "min(var(--radix-popover-content-available-height), 720px)", overflowY: "auto" }}
        >
          <HoldMusicList value={value} onChange={onChange} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
