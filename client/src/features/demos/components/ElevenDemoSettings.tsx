// Demos > Settings > AI receptionist: per demo language, which engine its
// browser demos run on (minted links and the homepage demo alike) and that
// engine's default voice (ElevenLabs with a preview, or GPT-Live). Saves only
// its own fields: the server merges them into the voice row, so the Calls card
// is untouched. Phone demos stay on ElevenLabs.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, Square } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import type { ElevenDemoVoice } from "@/features/voiceDemo/types";
import {
  demoEngineFor,
  useDemoSettings,
  useElevenDemoOptions,
  useEngineVoiceOptions,
  useSaveVoiceSettings,
  type DemoEngine,
  type ElevenDemoLocale,
  type VoiceDemoSettings,
} from "../api/demoSettingsApi";
import { ENGINE_INPUT, SaveBar, Seg, SETTINGS_CARD, SETTINGS_HINT, SETTINGS_LABEL, SETTINGS_TITLE } from "./engineControls";

const LOCALES: ElevenDemoLocale[] = ["nl", "en-GB", "en-US", "pt-BR"];
/** Language names in their own language; the engine's labels win once loaded. */
const LOCALE_NAMES: Record<ElevenDemoLocale, string> = {
  nl: "Nederlands", "en-GB": "English (UK)", "en-US": "English (US)", "pt-BR": "Português (BR)",
};
const ENGINES: DemoEngine[] = ["elevenlabs", "gpt-live"];
const ROW = "flex items-center gap-2 max-sm:flex-wrap";
const SELECT_W: React.CSSProperties = { width: 170, maxWidth: "100%" };

type Draft = Pick<VoiceDemoSettings, "engines" | "elevenVoices" | "defaultVoices">;

export function ElevenDemoSettings() {
  const { t } = useTranslation("demos");
  const { data } = useDemoSettings();
  const save = useSaveVoiceSettings();
  const saved = (data?.settings?.voice || {}) as VoiceDemoSettings;
  const [draft, setDraft] = useState<Draft | null>(null);
  const current: Draft = draft ?? saved;
  const patch = (next: Partial<Draft>) => setDraft({ ...current, ...next });
  const eleven = useElevenDemoOptions();
  const live = useEngineVoiceOptions();
  const preview = usePreview();

  const onSave = async () => {
    if (!draft) return;
    try {
      await save.mutateAsync({
        engines: Object.fromEntries(LOCALES.map((l) => [l, demoEngineFor(current, l)])),
        elevenVoices: current.elevenVoices ?? {},
        defaultVoices: current.defaultVoices ?? {},
      });
      setDraft(null);
    } catch {
      // The draft stays for another try; the reason shows under the button.
    }
  };

  return (
    <div className="neu-raised" style={SETTINGS_CARD} data-testid="eleven-demo-settings">
      <span style={SETTINGS_TITLE}>{t("settings.eleven.voicesTitle")}</span>
      <span style={SETTINGS_HINT}>{t("settings.eleven.hint")}</span>
      <EngineState loading={eleven.isLoading || live.isLoading} error={eleven.error || live.error} />
      <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
        {LOCALES.map((loc) => {
          const engine = demoEngineFor(current, loc);
          const label = eleven.data?.locales?.find((l) => l.id === loc)?.label ?? LOCALE_NAMES[loc];
          const onEngine = (next: DemoEngine) => patch({ engines: { ...(current.engines ?? {}), [loc]: next } });
          return (
            <div key={loc} className={ROW} data-testid={`demo-language-${loc}`}>
              <span style={SETTINGS_LABEL}>{label}</span>
              <Seg<DemoEngine>
                value={engine}
                options={ENGINES}
                ariaLabel={t("settings.eleven.engineFor", { language: label })}
                label={(o) => t(`settings.voice.engines.engine.${o}`)}
                onChange={onEngine}
              />
              {engine === "elevenlabs" ? (
                <ElevenVoiceRow
                  locale={loc}
                  value={current.elevenVoices ?? {}}
                  onChange={(elevenVoices) => patch({ elevenVoices })}
                  preview={preview}
                />
              ) : (
                <LiveVoiceRow
                  locale={loc}
                  value={current.defaultVoices ?? {}}
                  onChange={(defaultVoices) => patch({ defaultVoices })}
                />
              )}
            </div>
          );
        })}
      </div>

      <SaveBar
        dirty={!!draft}
        pending={save.isPending}
        error={save.isError ? (save.error as Error) : null}
        onSave={() => void onSave()}
        onCancel={() => setDraft(null)}
      />
    </div>
  );
}

function EngineState({ loading, error }: { loading: boolean; error: unknown }) {
  const { t } = useTranslation("demos");
  if (error) return <span style={{ fontSize: 12, color: "hsl(var(--destructive))" }}>{t("settings.voice.engineDown")}</span>;
  if (loading) return <span style={{ fontSize: 12, color: "var(--mute)" }}>{t("settings.voice.loading")}</span>;
  return null;
}

/** One locale's ElevenLabs voice, with a sample to play. */
function ElevenVoiceRow({ locale, value, onChange, preview }: {
  locale: ElevenDemoLocale;
  value: Partial<Record<ElevenDemoLocale, string>>;
  onChange: (v: Partial<Record<ElevenDemoLocale, string>>) => void;
  preview: ReturnType<typeof usePreview>;
}) {
  const { t } = useTranslation("demos");
  const { data: options } = useElevenDemoOptions();
  const voices = options?.voices?.[locale] ?? [];
  const chosen = value[locale] ?? "";
  const defaultId = options?.defaults?.[locale];
  const effective = chosen || defaultId || "";
  const playable = voices.find((v) => v.id === effective)?.preview_url ?? null;
  const defaultName = voices.find((v) => v.id === defaultId)?.label;
  return (
    <>
      <div style={SELECT_W} className="max-sm:flex-1">
        <ElevenVoiceSelect
          voices={voices}
          value={chosen}
          emptyLabel={defaultName ? t("settings.voice.engineDefault", { voice: defaultName }) : t("settings.eleven.localeDefault")}
          onChange={(v) => onChange({ ...value, [locale]: v })}
        />
      </div>
      <IconBtn
        aria-label={t("settings.eleven.preview")}
        title={t("settings.eleven.preview")}
        disabled={!playable}
        active={preview.playing === playable && !!playable}
        onClick={() => playable && preview.toggle(playable)}
      >
        {preview.playing === playable && playable ? <Square size={13} /> : <Play size={14} />}
      </IconBtn>
    </>
  );
}

/** One locale's GPT-Live voice. Voices come from the engine, so a voice added
 *  in Python shows up without a second edit. */
function LiveVoiceRow({ locale, value, onChange }: {
  locale: ElevenDemoLocale; value: Record<string, string>; onChange: (v: Record<string, string>) => void;
}) {
  const { t } = useTranslation("demos");
  const { data: engine } = useEngineVoiceOptions();
  const builtIn = engine?.locales?.find((l) => l.id === locale)?.voice ?? "";
  return (
    <>
      <select
        style={{ ...ENGINE_INPUT, ...SELECT_W }}
        className="max-sm:flex-1"
        aria-label={t("settings.eleven.voiceFor")}
        value={value[locale] ?? ""}
        onChange={(e) => onChange({ ...value, [locale]: e.target.value })}
      >
        {/* Empty is the engine's own default, named so nobody has to guess it. */}
        <option value="">{t("settings.voice.engineDefault", { voice: builtIn })}</option>
        {(["female", "male"] as const).map((gender) => {
          const voices = (engine?.voices ?? []).filter((v) => (v.gender ?? "female") === gender);
          return voices.length ? (
            <optgroup key={gender} label={t(`settings.voice.engines.gender.${gender}`)}>
              {voices.map((v) => <option key={v.id} value={v.id}>{v.id} ({v.label})</option>)}
            </optgroup>
          ) : null;
        })}
      </select>
      {/* Keeps the rows aligned: GPT-Live voices have no sample to play. */}
      <span aria-hidden style={{ width: 36, flexShrink: 0 }} className="max-sm:hidden" />
    </>
  );
}

/** An ElevenLabs voice list for one locale, female first. Names only: the ids are opaque. */
export function ElevenVoiceSelect({ voices, value, emptyLabel, onChange, style }: {
  voices: ElevenDemoVoice[]; value: string; emptyLabel: string; onChange: (v: string) => void; style?: React.CSSProperties;
}) {
  const { t } = useTranslation("demos");
  return (
    <select style={{ ...ENGINE_INPUT, width: "100%", ...style }} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{emptyLabel}</option>
      {(["female", "male"] as const).map((g) => {
        const group = voices.filter((v) => v.gender === g);
        return group.length ? (
          <optgroup key={g} label={t(`settings.voice.engines.gender.${g}`)}>
            {group.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </optgroup>
        ) : null;
      })}
    </select>
  );
}

/** One preview at a time: pressing another stops the first, pressing the same one stops it. */
function usePreview() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => { audio.current?.pause(); }, []);
  const toggle = (url: string) => {
    audio.current?.pause();
    if (playing === url) { setPlaying(null); return; }
    const a = new Audio(url);
    audio.current = a;
    a.onended = () => setPlaying((p) => (p === url ? null : p));
    a.onerror = () => setPlaying((p) => (p === url ? null : p));
    setPlaying(url);
    void a.play().catch(() => setPlaying(null));
  };
  return { playing, toggle };
}
