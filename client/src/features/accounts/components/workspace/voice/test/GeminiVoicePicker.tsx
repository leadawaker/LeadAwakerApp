// The Gemini Live voice for this browser's test calls: every voice, grouped
// female/male, each with a play button for its Dutch sample (geminiAccess.ts).
// Test only: the pick is kept per browser and never changes the line.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Pause, Play } from "lucide-react";
import { FieldLabel, helpStyle } from "../voiceAtoms";
import { GEMINI_TEST_VOICES, geminiSampleUrl, type VoiceGender } from "./geminiAccess";
import { isCallBusy, useVoiceTest } from "./VoiceTestProvider";

const GENDERS: VoiceGender[] = ["female", "male"];

export function GeminiVoicePicker() {
  const { t } = useTranslation("voiceTab");
  const { geminiVoice, setGeminiVoice, phase } = useVoiceTest();
  const busy = isCallBusy(phase);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => () => { audio.current?.pause(); }, []);
  // A call is starting: the sample stops so it does not play over her.
  useEffect(() => { if (busy) { audio.current?.pause(); setPlaying(null); } }, [busy]);

  const toggle = (voice: string) => {
    if (playing === voice) { audio.current?.pause(); setPlaying(null); return; }
    audio.current?.pause();
    const a = new Audio(geminiSampleUrl(voice));
    audio.current = a;
    a.onended = () => setPlaying((p) => (p === voice ? null : p));
    a.onerror = () => setPlaying((p) => (p === voice ? null : p));
    setPlaying(voice);
    void a.play().catch(() => setPlaying(null));
  };

  return (
    <div data-testid="gemini-voice-picker">
      <FieldLabel>{t("test.panel.gemini.voice")}</FieldLabel>
      <p style={{ ...helpStyle, margin: "0 0 8px" }}>{t("test.panel.gemini.voiceHelp")}</p>
      <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {GENDERS.map((g) => (
          <div key={g}>
            <div style={{ ...helpStyle, margin: "0 0 4px", fontWeight: 600 }}>{t(`test.panel.gemini.gender.${g}`)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
              {GEMINI_TEST_VOICES.filter((v) => v.gender === g).map(({ name }) => {
                const on = name === geminiVoice;
                const isPlaying = playing === name;
                const playLabel = `${t(isPlaying ? "notice.pause" : "notice.play")}: ${name}`;
                return (
                  <div key={name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button
                      type="button"
                      className={on ? "la-btn la-btn--wine" : "la-btn la-btn--soft"}
                      style={{ flex: 1, justifyContent: "flex-start", padding: "6px 10px", fontSize: 13 }}
                      disabled={busy}
                      aria-pressed={on}
                      onClick={() => setGeminiVoice(name)}
                      data-testid={`gemini-voice-${name}`}
                    >
                      {on && <Check size={13} />}
                      {name}
                    </button>
                    <button
                      type="button"
                      className={`la-btn la-btn--icon la-btn--pill ${isPlaying ? "la-btn--wine" : "la-btn--soft"}`}
                      onClick={() => toggle(name)}
                      disabled={busy}
                      aria-label={playLabel}
                      title={playLabel}
                      style={{ flexShrink: 0 }}
                    >
                      {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
