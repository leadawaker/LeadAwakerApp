import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronsDownUp, ChevronsUpDown, Download } from "lucide-react";
import type { VoiceCallDetail } from "../api/voiceCallsApi";
import { useCallAudio } from "../useCallAudio";
import { activeTurn, turnTimes } from "../turnTimes";
import { callerIni, callerTitle } from "./bits";
import { CallPlayer, type PlayerControls, type PlayerState } from "./CallPlayer";
import { CallTranscript } from "./CallTranscript";
import { TranscriptSearch } from "./TranscriptSearch";
import { recordingMissingKey } from "../recordingNote";

/**
 * The call itself: player with speaker tracks on top, searchable transcript below.
 * Only the Calendar's appointment detail still uses it; the Calls page shows the call
 * review (CallReviewPanel).
 */

const NO_EVENTS: VoiceCallDetail["events"] = [];

export function CallConversation({ call }: { call: VoiceCallDetail }) {
  const { t } = useTranslation("voiceCalls");
  const audio = useCallAudio(call.callId, call.sessionId);
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PlayerState>({ playing: false, current: 0, duration: 0, volume: 1, muted: false, rate: 1 });
  // The transcript keeps the spoken line in view. Scrolling it by hand pauses
  // that; playing (the player or a line) picks it up again.
  const [follow, setFollow] = useState(true);
  const [showTracks, setShowTracks] = useState(true);
  const [query, setQuery] = useState("");
  const [playFailed, setPlayFailed] = useState(false);
  const hasPlayer = audio.status === "ready";

  const duration = audio.duration || state.duration || call.durationSeconds || 0;
  // A Grok recording starts once the caller is in, after the call opened.
  const t0 = call.recordingStartedAt ?? call.startedAt;
  const times = useMemo(
    () => (audio.status === "ready" ? turnTimes(call.turns, t0, audio.caller, audio.ai, duration) : null),
    [audio, call.turns, t0, duration],
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
      if (a.paused) {
        setFollow(true);
        void a.play().catch(() => setPlayFailed(true));
      } else a.pause();
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
    // Move the highlight now, even while paused or before timeupdate fires.
    setState((p) => ({ ...p, current: s }));
    setFollow(true);
    void a.play().catch(() => setPlayFailed(true));
  }, []);

  return (
    <div className="glass" style={{ flex: 1, minWidth: 0, minHeight: 0, borderRadius: "var(--r-card)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, padding: "16px 20px 14px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <span style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--ink)", lineHeight: 1, flexShrink: 0 }}>{t("sections.transcript")}</span>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
            {hasPlayer && (
              <button
                type="button"
                onClick={() => setShowTracks((v) => !v)}
                aria-pressed={showTracks}
                aria-label={showTracks ? t("hideSpeakers") : t("showSpeakers")}
                title={showTracks ? t("hideSpeakers") : t("showSpeakers")}
                className="la-btn la-btn--soft la-btn--icon la-btn--pill"
                style={{ width: 36, height: 36, flexShrink: 0 }}
              >
                {showTracks ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
              </button>
            )}
            <TranscriptSearch query={query} onQuery={setQuery} matches={matches} />
            {audio.url && (
              <a
                href={audio.url}
                download={`${call.callId}.wav`}
                aria-label={t("downloadShort")}
                title={t("downloadShort")}
                className="la-btn la-btn--soft la-btn--pill"
                style={{ textDecoration: "none", height: 36, flexShrink: 0 }}
              >
                <Download size={13} /><span className="hidden sm:inline">{t("downloadShort")}</span>
              </a>
            )}
          </div>
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
              showTracks={showTracks}
            />
          </>
        )}
      </div>
      <div
        ref={scrollRef}
        onWheel={() => setFollow(false)}
        onTouchMove={() => setFollow(false)}
        style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "18px 18px 22px" }}
      >
        <CallTranscript ref={listRef} turns={call.turns} events={call.events ?? NO_EVENTS} t0={t0} times={times} active={active} query={query} onSeek={seekAndPlay} />
      </div>
    </div>
  );
}
