// The receptionist voice picker: a popover listing the voices by gender, each
// tagged Natural (recorded from a person) or Generated (synthesised), with a
// short greeting to play in English, Dutch and Portuguese, so a voice can be
// heard before it is picked. The clips are fixed files in
// /public/voice-samples (script/gen-voice-samples.py makes them).
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Pause, Play } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pill } from "@/components/crm/primitives/Pill";
import { FEMININE_VOICE_OPTIONS, MASCULINE_VOICE_OPTIONS, VOICE_OPTIONS, isGeneratedVoice } from "../communication/setupConstants";
import { helpStyle, inputStyle } from "./voiceAtoms";

const SAMPLE_LANGS = ["en", "nl", "pt"] as const;
type SampleLang = (typeof SAMPLE_LANGS)[number];

const GROUPS = [
  { gender: "female", options: FEMININE_VOICE_OPTIONS },
  { gender: "male", options: MASCULINE_VOICE_OPTIONS },
] as const;

export const voiceSampleUrl = (voice: string, lang: SampleLang) => `/voice-samples/${voice}-${lang}.mp3`;
const titleCase = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

/** Natural or Generated, as OpenAI's voice table splits them. */
function KindTag({ voice }: { voice: string }) {
  const { t } = useTranslation("voiceTab");
  const generated = isGeneratedVoice(voice);
  return (
    <Pill
      color={generated ? undefined : "var(--wine)"}
      title={t(generated ? "agent.generatedHelp" : "agent.naturalHelp")}
      data-testid={`voice-kind-${voice}`}
      style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}
    >
      {t(generated ? "agent.generated" : "agent.natural")}
    </Pill>
  );
}

/** One audio element for the whole list; the picker stops it when the popover closes. */
function useSamplePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const toggle = (voice: string, lang: SampleLang) => {
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
    a.src = voiceSampleUrl(voice, lang);
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

export function VoicePicker({ value, onChange }: { value: string; onChange: (voice: string) => void }) {
  const { t } = useTranslation(["voiceTab", "communicationProfile"]);
  const [open, setOpen] = useState(false);
  const player = useSamplePlayer();
  const known = (VOICE_OPTIONS as readonly string[]).includes(value);

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
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: value ? "var(--ink)" : "var(--mute)" }}>
              {value ? titleCase(value) : t("voiceTab:agent.pickVoice")}
              {known && <span style={{ marginLeft: 8, verticalAlign: "1px" }}><KindTag voice={value} /></span>}
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
        <p style={{ ...helpStyle, margin: "4px 8px 8px" }}>{t("voiceTab:agent.samplesHelp")}</p>
        {GROUPS.map(({ gender, options }) => (
          <div key={gender} style={{ marginBottom: 6 }}>
            <div className="eyebrow eyebrow-sm" style={{ padding: "6px 10px 4px" }}>
              {t(`communicationProfile:questions.agentName.${gender}`)}
            </div>
            {options.map((v) => (
              <VoiceRow key={v} voice={v} selected={value === v} player={player} onPick={() => { onChange(v); setOpen(false); player.stop(); }} />
            ))}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
