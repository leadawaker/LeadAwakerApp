// +New Demo: which voice the prospect's AI receptionist demo speaks with. Lists
// the voices of the engine the demo's locale runs on (Demos settings, per
// language): ElevenLabs' own for that locale, or GPT-Live's. Empty = the
// settings default.
import { useTranslation } from "react-i18next";
import type { DemoLang } from "@/features/campaigns/api/demoClientsApi";
import {
  demoEngineFor,
  useDemoSettings,
  useElevenDemoOptions,
  useEngineVoiceOptions,
  type ElevenDemoLocale,
  type VoiceDemoSettings,
} from "../api/demoSettingsApi";
import { ElevenVoiceSelect } from "./ElevenDemoSettings";

/** The demo's accent: language plus, for English, the market (a Dutch firm demoed in English hears British). */
export function demoVoiceLocale(language: DemoLang, market: "" | "uk" | "us" | "nl"): ElevenDemoLocale {
  if (language === "nl") return "nl";
  if (language === "pt") return "pt-BR";
  return market === "us" ? "en-US" : "en-GB";
}

export function DemoVoicePicker({ locale, value, onChange, style }: {
  locale: ElevenDemoLocale;
  value: string;
  onChange: (voice: string) => void;
  style: React.CSSProperties;
}) {
  const { t } = useTranslation("demos");
  const { data: settings } = useDemoSettings();
  const engine = demoEngineFor((settings?.settings?.voice || {}) as VoiceDemoSettings, locale);
  const eleven = useElevenDemoOptions();
  const live = useEngineVoiceOptions();

  if (engine === "elevenlabs") {
    const voices = eleven.data?.voices?.[locale] ?? [];
    const defaultId = eleven.data?.defaults?.[locale];
    const defaultName = voices.find((v) => v.id === defaultId)?.label;
    return (
      <ElevenVoiceSelect
        style={style}
        voices={voices}
        value={value}
        emptyLabel={defaultName ? t("new.voiceDefaultNamed", { voice: defaultName }) : t("new.voiceDefault")}
        onChange={onChange}
      />
    );
  }

  const voices = live.data?.voices ?? [];
  return (
    <select style={style} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t("new.voiceDefault")}</option>
      {(["female", "male"] as const).map((g) => {
        const group = voices.filter((v) => (v.gender ?? "female") === g);
        return group.length ? (
          <optgroup key={g} label={t(`settings.voice.engines.gender.${g}`)}>
            {group.map((v) => <option key={v.id} value={v.id}>{v.label === v.id ? v.id : `${v.label} (${v.id})`}</option>)}
          </optgroup>
        ) : null;
      })}
    </select>
  );
}
