import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, LocateFixed, Search } from "lucide-react";
import type { VoiceCallDetail } from "../api/voiceCallsApi";
import { useCallAudio } from "../useCallAudio";
import { activeTurn, turnTimes } from "../turnTimes";
import { callerIni, callerTitle } from "./bits";
import { CallPlayer, type PlayerControls, type PlayerState } from "./CallPlayer";
import { CallTranscript } from "./CallTranscript";

/** The call itself: player with speaker tracks on top, searchable transcript below. */
// OpenAI needs a few minutes after hang-up to finish a recording, and keeps it
// for 30 days. Only blame the 30 days once the call is actually that old.
const RECORDING_PENDING_MS = 60 * 60 * 1000;
const RECORDING_KEPT_MS = 30 * 24 * 60 * 60 * 1000;
function recordingMissingKey(startedAt: string): string {
  const age = Date.now() - new Date(startedAt).getTime();
  if (age < RECORDING_PENDING_MS) return "recordingPending";
  return age > RECORDING_KEPT_MS ? "recordingExpired" : "recordingUnavailable";
}

export function CallConversation({ call }: { call: VoiceCallDetail }) {
  const { t } = useTranslation("voiceCalls");
  const audio = useCallAudio(call.sessionId);
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PlayerState>({ playing: false, current: 0, duration: 0, volume: 1, muted: false, rate: 1 });
  const [follow, setFollow] = useState(true);
  const [query, setQuery] = useState("");
  const [playFailed, setPlayFailed] = useState(false);

  const duration = audio.duration || state.duration || call.durationSeconds || 0;
  const times = useMemo(
    () => (audio.status === "ready" ? turnTimes(call.turns, call.startedAt, audio.caller, audio.ai, duration) : null),
    [audio, call.turns, call.startedAt, duration],
  );
  const active = times && (state.playing || state.current > 0) ? activeTurn(times, state.current) : -1;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? call.turns.filter((x) => (x.content ?? "").toLowerCase().includes(q)).length : 0;
  }, [query, call.turns]);

  // Keep the turn being spoken in the middle of the transcript while following.
  useEffect(() => {
    if (!follow || active < 0) return;
    const box = scrollRef.current;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-turn="${active}"]`);
    if (!box || !el) return;
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    box.scrollTo({ top: top - box.clientHeight / 2 + el.clientHeight / 2, behavior: "smooth" });
  }, [active, follow]);

  // timeupdate only fires about 4 times a second; follow the clock every frame
  // while playing so the playhead glides.
  useEffect(() => {
    if (!state.playing) return;
    let raf = 0;
    const tick = () => {
      const a = audioRef.current;
      if (a) setState((p) => (p.current === a.currentTime ? p : { ...p, current: a.currentTime }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state.playing]);

  const controls: PlayerControls = {
    toggle: () => {
      const a = audioRef.current;
      if (!a) return;
      if (a.paused) void a.play().catch(() => setPlayFailed(true));
      else a.pause();
    },
    seek: (s) => { if (audioRef.current) audioRef.current.currentTime = s; setState((p) => ({ ...p, current: s })); },
    skip: (d) => { const a = audioRef.current; if (a) a.currentTime = Math.max(0, Math.min(duration, a.currentTime + d)); },
    setVolume: (v) => { const a = audioRef.current; if (a) { a.volume = v; a.muted = v === 0; } setState((p) => ({ ...p, volume: v, muted: v === 0 })); },
    toggleMute: () => { const a = audioRef.current; if (a) a.muted = !a.muted; setState((p) => ({ ...p, muted: !p.muted })); },
    setRate: (r) => { if (audioRef.current) audioRef.current.playbackRate = r; setState((p) => ({ ...p, rate: r })); },
  };

  const seekAndPlay = useCallback((s: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = s;
    void a.play().catch(() => setPlayFailed(true));
  }, []);

  return (
    <div className="glass" style={{ flex: 1, minWidth: 0, minHeight: 0, borderRadius: "var(--r-card)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, padding: "16px 20px 12px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--ink)", lineHeight: 1 }}>{t("sections.transcript")}</span>
          {audio.url && (
            <a href={audio.url} download={`${call.callId}.wav`} className="la-btn la-btn--soft" style={{ textDecoration: "none" }}>
              <Download size={13} />{t("downloadShort")}
            </a>
          )}
        </div>

        {audio.status === "missing" ? (
          <div style={{ padding: "4px 0 6px", fontSize: 12.5, color: "var(--mute)" }}>{t(recordingMissingKey(call.startedAt))}</div>
        ) : audio.status === "loading" ? (
          <div style={{ padding: "4px 0 6px", fontSize: 12.5, color: "var(--mute)" }}>{t("loadingRecording")}</div>
        ) : (
          <>
            <audio
              ref={audioRef}
              src={audio.url ?? undefined}
              onError={() => setPlayFailed(true)}
              onPlay={() => { setPlayFailed(false); setState((p) => ({ ...p, playing: true })); }}
              onPause={() => setState((p) => ({ ...p, playing: false }))}
              onEnded={() => setState((p) => ({ ...p, playing: false }))}
              onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d)) setState((p) => ({ ...p, duration: d })); }}
              onTimeUpdate={(e) => { const c = e.currentTarget.currentTime; setState((p) => ({ ...p, current: c })); }}
            />
            {playFailed && <div style={{ padding: "0 0 8px", fontSize: 12.5, color: "var(--wine)" }}>{t("playbackFailed")}</div>}
            <CallPlayer
              state={{ ...state, duration }}
              controls={controls}
              caller={audio.caller}
              ai={audio.ai}
              callerLabel={callerIni(call, t("webCaller"))}
              callerTitle={callerTitle(call, t("caller"))}
            />
          </>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <label style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 14px", borderRadius: "var(--r-pill)", boxShadow: "var(--sh-inset-crisp)", color: "var(--mute)" }}>
            <Search size={14} style={{ flexShrink: 0 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchTranscript")}
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: "var(--ink)", fontSize: 13 }}
            />
            {query.trim() && <span style={{ fontSize: 11.5, flexShrink: 0 }}>{t("matches", { count: matches })}</span>}
          </label>
          {times && (
            <button
              onClick={() => setFollow((v) => !v)}
              aria-pressed={follow}
              title={t("followAudioHint")}
              style={{
                height: 36, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7, padding: "0 14px",
                borderRadius: "var(--r-pill)", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                background: follow ? "var(--ink)" : "transparent",
                color: follow ? "var(--paper)" : "var(--ink-soft)",
                boxShadow: follow ? "none" : "var(--sh-inset-crisp)",
              }}
            >
              <LocateFixed size={14} />{t("followAudio")}
            </button>
          )}
        </div>
      </div>
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "18px 18px 22px" }}>
        <CallTranscript ref={listRef} turns={call.turns} times={times} active={active} query={query} onSeek={seekAndPlay} />
      </div>
    </div>
  );
}
