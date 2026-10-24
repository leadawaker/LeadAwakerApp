// The receptionist voice picker: a popover listing the voices by gender, each
// marked with an icon, Natural (green, recorded from a person) or Generated
// (blue, synthesised), with a short greeting to play in English, Dutch and
// Portuguese, so a voice can be heard before it is picked. The clips are fixed files in
// /public/voice-samples (script/gen-voice-samples.py makes them). On a line that
// runs ElevenLabs the same picker lists the ElevenLabs voices instead, each with
// its one preview clip.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Mic, Pause, Play, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { VOICE_OPTIONS, isGeneratedVoice } from "../communication/setupConstants";
import { helpStyle, inputStyle } from "./voiceAtoms";
import { openAiVoiceGroups } from "./lineEngine";
import type { ElevenVoice } from "./useElevenVoices";
import type { AgentGender } from "./voiceApi";

const SAMPLE_LANGS = ["en", "nl", "pt"] as const;
type SampleLang = (typeof SAMPLE_LANGS)[number];

export const voiceSampleUrl = (voice: string, lang: SampleLang) => `/voice-samples/${voice}-${lang}.mp3`;
const titleCase = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

/** Natural or Generated, as OpenAI's voice table splits them: a green mic for
 *  a voice recorded from a person, a blue sparkle for a synthesised one. */
function KindTag({ voice }: { voice: string }) {
  const { t } = useTranslation("voiceTab");
  const generated = isGeneratedVoice(voice);
  const Icon = generated ? Sparkles : Mic;
  const label = t(generated ? "agent.generatedVoice" : "agent.naturalVoice");
  const help = t(generated ? "agent.generatedHelp" : "agent.naturalHelp");
  return (
    <span
      role="img"
      aria-label={label}
      title={`${label}: ${help}`}
      data-testid={`voice-kind-${voice}`}
      style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, color: generated ? "var(--voice-generated)" : "var(--voice-natural)" }}
    >
      <Icon size={13} strokeWidth={2.25} aria-hidden="true" />
    </span>
  );
}

/** One audio element for the whole list; the picker stops it when the popover closes. */
function useSamplePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const toggle = (voice: string, lang: SampleLang | "eleven", url?: string) => {
    const key = `${voice}-${lang}`;
    if (!audioRef.current) {
      const a = new Audio();
      a.addEventListener("ended", () => setPlaying(null));
      a.addEventListener("pause", () => setPlaying(null));
      audioRef.current = a;
    }
    const a = audioRef.current;
    if (playing === key) { a.pause(); return; }
    a.pause();
    a.src = url ?? voiceSampleUrl(voice, lang as SampleLang);
    setFailed(null);
    a.play().then(() => setPlaying(key)).catch(() => { setPlaying(null); setFailed(key); });
  };
  const stop = () => audioRef.current?.pause();
  return { playing, failed, toggle, stop };
}

function VoiceRow({ voice, selected, player, onPick }: {
  voice: string; selected: boolean; player: ReturnType<typeof useSamplePlayer>; onPick: () => void;
}) {
  const { t } = useTranslation(["voiceTab", "communicationProfile"]);
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: "var(--r-button)",
        background: selected ? "var(--wine-tint)" : undefined,
      }}
      data-testid={`voice-option-${voice}`}
    >
      <button
        type="button"
        onClick={onPick}
        style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: 0, padding: 0, cursor: "pointer" }}
        aria-pressed={selected}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 700, color: selected ? "var(--wine)" : "var(--ink)" }}>
          {titleCase(voice)}
          <KindTag voice={voice} />
          {selected && <Check size={13} />}
        </span>
        <span style={{ display: "block", fontSize: 12, color: "var(--mute)", lineHeight: 1.4, marginTop: 2 }}>
          {t(`communicationProfile:questions.voiceSound.voices.${voice}`)}
        </span>
      </button>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {SAMPLE_LANGS.map((lang) => {
          const key = `${voice}-${lang}`;
          const on = player.playing === key;
          return (
            <button
              key={lang}
              type="button"
              onClick={() => player.toggle(voice, lang)}
              className={`la-btn ${on ? "la-btn--wine" : "la-btn--soft"}`}
              style={{ padding: "5px 8px", gap: 4, fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.06em", color: player.failed === key ? "var(--stage-lost)" : undefined }}
              aria-label={t("voiceTab:agent.playSample", { voice: titleCase(voice), lang: lang.toUpperCase() })}
              title={player.failed === key ? t("voiceTab:agent.sampleFailed") : undefined}
            >
              {on ? <Pause size={10} /> : <Play size={10} />}
              {lang.toUpperCase()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** An ElevenLabs voice: its name, a line about it (age, accent, description) and one preview clip. */
function ElevenRow({ voice, selected, player, onPick }: {
  voice: ElevenVoice; selected: boolean; player: ReturnType<typeof useSamplePlayer>; onPick: () => void;
}) {
  const { t } = useTranslation("voiceTab");
  const key = `${voice.id}-eleven`;
  const on = player.playing === key;
  const about = [voice.age, voice.accent, voice.description].filter(Boolean).join(", ").replace(/_/g, " ");
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: "var(--r-button)", background: selected ? "var(--wine-tint)" : undefined }}
      data-testid={`voice-option-${voice.id}`}
    >
      <button type="button" onClick={onPick} aria-pressed={selected}
        style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: 0, padding: 0, cursor: "pointer" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 700, color: selected ? "var(--wine)" : "var(--ink)" }}>
          {voice.label}{selected && <Check size={13} />}
        </span>
        {about && <span style={{ display: "block", fontSize: 12, color: "var(--mute)", lineHeight: 1.4, marginTop: 2 }}>{about}</span>}
      </button>
      {voice.preview && (
        <button
          type="button"
          onClick={() => player.toggle(voice.id, "eleven", voice.preview ?? undefined)}
          className={`la-btn ${on ? "la-btn--wine" : "la-btn--soft"}`}
          style={{ padding: "5px 8px", gap: 4, flexShrink: 0, fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.06em", color: player.failed === key ? "var(--stage-lost)" : undefined }}
          aria-label={t("agent.playElevenSample", { voice: voice.label })}
          title={player.failed === key ? t("agent.sampleFailed") : undefined}
        >
          {on ? <Pause size={10} /> : <Play size={10} />}
        </button>
      )}
    </div>
  );
}

/** What the picker lists. `eleven` set = the line runs ElevenLabs; `gender` = the agent's set gender (GPT Live list only). */
export interface VoicePickerProps {
  value: string;
  onChange: (voice: string) => void;
  gender?: AgentGender | null;
  eleven?: { voices: ElevenVoice[]; defaultLabel: string };
}

export function VoicePicker({ value, onChange, gender, eleven }: VoicePickerProps) {
  const { t } = useTranslation(["voiceTab", "communicationProfile"]);
  const [open, setOpen] = useState(false);
  const player = useSamplePlayer();
  const groups = openAiVoiceGroups(gender, value);
  const known = !eleven && (VOICE_OPTIONS as readonly string[]).includes(value);
  const picked = eleven?.voices.find((v) => v.id === value);
  const title = eleven ? (picked?.label ?? (value || eleven.defaultLabel)) : value ? titleCase(value) : t("voiceTab:agent.pickVoice");
  const choose = (v: string) => { onChange(v); setOpen(false); player.stop(); };
  const elevenGroups = eleven ? (["female", "male"] as const)
    .map((g) => ({ gender: g, voices: eleven.voices.filter((v) => v.gender === g) })).filter((g) => g.voices.length) : [];
  const elevenOther = eleven?.voices.filter((v) => v.gender !== "female" && v.gender !== "male") ?? [];

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) player.stop(); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="neu-inset-crisp"
          style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer", height: "auto", padding: "10px 13px" }}
          data-testid="voice-picker"
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: value || eleven ? "var(--ink)" : "var(--mute)" }}>
              {title}
              {known && <span style={{ marginLeft: 6, verticalAlign: "-2px", display: "inline-flex" }}><KindTag voice={value} /></span>}
            </span>
            {known && (
              <span style={{ display: "block", fontSize: 12, color: "var(--mute)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t(`communicationProfile:questions.voiceSound.voices.${value}`)}
              </span>
            )}
          </span>
          <ChevronDown size={15} style={{ color: "var(--mute)", flexShrink: 0 }} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        className="p-2"
        style={{ width: "min(92vw, 440px)", maxHeight: "min(var(--radix-popover-content-available-height), 560px)", overflowY: "auto" }}
      >
        <p style={{ ...helpStyle, margin: "4px 8px 8px" }}>{t(eleven ? "voiceTab:agent.elevenSamplesHelp" : "voiceTab:agent.samplesHelp")}</p>
        {eleven ? (
          <>
            <button type="button" onClick={() => choose("")} aria-pressed={!value}
              style={{ display: "block", width: "100%", textAlign: "left", background: !value ? "var(--wine-tint)" : "none", border: 0, cursor: "pointer", padding: "9px 10px", borderRadius: "var(--r-button)", fontSize: 13.5, fontWeight: 700, color: !value ? "var(--wine)" : "var(--ink)" }}
              data-testid="voice-option-default">
              {eleven.defaultLabel}
            </button>
            {[...elevenGroups, ...(elevenOther.length ? [{ gender: "other" as const, voices: elevenOther }] : [])].map(({ gender: g, voices }) => (
              <div key={g} style={{ marginBottom: 6 }}>
                {g !== "other" && <div className="eyebrow eyebrow-sm" style={{ padding: "6px 10px 4px" }}>{t(`communicationProfile:questions.agentName.${g}`)}</div>}
                {voices.map((v) => <ElevenRow key={v.id} voice={v} selected={value === v.id} player={player} onPick={() => choose(v.id)} />)}
              </div>
            ))}
          </>
        ) : groups.map(({ gender: g, voices }) => (
          <div key={g} style={{ marginBottom: 6 }}>
            <div className="eyebrow eyebrow-sm" style={{ padding: "6px 10px 4px" }}>
              {t(`communicationProfile:questions.agentName.${g}`)}
            </div>
            {voices.map((v) => (
              <VoiceRow key={v} voice={v} selected={value === v} player={player} onPick={() => choose(v)} />
            ))}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
