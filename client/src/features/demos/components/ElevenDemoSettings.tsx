// Demos > Settings > AI receptionist: which engine minted demos run on, then
// the voice per language for that engine only (ElevenLabs with a preview, or
// GPT-Live). Saves only its own fields: the server merges them into the voice
// row, so the Calls card is untouched.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, Square } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import type { ElevenDemoVoice } from "@/features/voiceDemo/types";
import {
  useDemoSettings,
  useElevenDemoOptions,
  useEngineVoiceOptions,
  useSaveVoiceSettings,
  type DemoEngine,
  type ElevenDemoLocale,
  type VoiceDemoSettings,
} from "../api/demoSettingsApi";
import { ENGINE_INPUT, SaveBar, Seg, SETTINGS_CARD, SETTINGS_LABEL, SETTINGS_RULE, SETTINGS_TITLE } from "./engineControls";

/** Shown until the engine answers, so the card is never empty. */
const LOCALES: ElevenDemoLocale[] = ["nl", "en-GB", "en-US", "pt-BR"];
const ENGINES: DemoEngine[] = ["elevenlabs", "gpt-live"];
const ROW = "flex items-center gap-2 max-sm:flex-wrap";

type Draft = Pick<VoiceDemoSettings, "demoEngine" | "elevenVoices" | "defaultVoices">;

export function ElevenDemoSettings() {
  const { t } = useTranslation("demos");
  const { data } = useDemoSettings();
  const save = useSaveVoiceSettings();
  const saved = (data?.settings?.voice || {}) as VoiceDemoSettings;
  const [draft, setDraft] = useState<Draft | null>(null);
  const current: Draft = draft ?? saved;
  const patch = (next: Partial<Draft>) => setDraft({ ...current, ...next });
  const engine = current.demoEngine ?? "elevenlabs";

  const onSave = async () => {
    if (!draft) return;
    try {
      await save.mutateAsync({
        demoEngine: engine,
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
      <div className={ROW}>
        <span style={{ ...SETTINGS_TITLE, flex: 1 }}>{t("settings.eleven.engineTitle")}</span>
        <Seg<DemoEngine>
          value={engine}
          options={ENGINES}
          ariaLabel={t("settings.eleven.engineTitle")}
          label={(o) => t(`settings.voice.engines.engine.${o}`)}
          onChange={(demoEngine) => patch({ demoEngine })}
        />
      </div>

      <div style={SETTINGS_RULE} />

      <span style={{ ...SETTINGS_TITLE, fontSize: 13, marginBottom: 8 }}>{t("settings.eleven.voicesTitle")}</span>
      {engine === "elevenlabs" ? (
        <ElevenVoices value={current.elevenVoices ?? {}} onChange={(elevenVoices) => patch({ elevenVoices })} />
      ) : (
        <LiveVoices value={current.defaultVoices ?? {}} onChange={(defaultVoices) => patch({ defaultVoices })} />
      )}

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

/** The ElevenLabs voice per demo locale, each with a sample to play. */
function ElevenVoices({ value, onChange }: {
  value: Partial<Record<ElevenDemoLocale, string>>; onChange: (v: Partial<Record<ElevenDemoLocale, string>>) => void;
}) {
  const { t } = useTranslation("demos");
  const { data: options, isLoading, error } = useElevenDemoOptions();
  const preview = usePreview();
  const locales = options?.locales?.length ? options.locales : LOCALES.map((id) => ({ id, label: id }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <EngineState loading={isLoading} error={error} />
      {locales.map((l) => {
        const voices = options?.voices?.[l.id] ?? [];
        const chosen = value[l.id] ?? "";
        const effective = chosen || options?.defaults?.[l.id] || "";
        const playable = voices.find((v) => v.id === effective)?.preview_url ?? null;
        const defaultName = voices.find((v) => v.id === options?.defaults?.[l.id])?.label;
        return (
          <div key={l.id} className={ROW}>
            <span style={SETTINGS_LABEL}>{l.label}</span>
            <div style={{ width: 210, maxWidth: "100%" }} className="max-sm:flex-1">
              <ElevenVoiceSelect
                voices={voices}
                value={chosen}
                emptyLabel={defaultName ? t("settings.voice.engineDefault", { voice: defaultName }) : t("settings.eleven.localeDefault")}
                onChange={(v) => onChange({ ...value, [l.id]: v })}
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
          </div>
        );
      })}
    </div>
  );
}

/** The GPT-Live voice per locale. Languages and voices come from the engine,
 *  so a voice added in Python shows up without a second edit. */
function LiveVoices({ value, onChange }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const { t } = useTranslation("demos");
  const { data: engine, isLoading, error } = useEngineVoiceOptions();
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <EngineState loading={isLoading} error={error} />
      {(engine?.locales ?? []).map((l) => (
        <label key={l.id} className={ROW}>
          <span style={SETTINGS_LABEL}>{l.label}</span>
          <select
            style={{ ...ENGINE_INPUT, width: 210, maxWidth: "100%" }}
            value={value[l.id] ?? ""}
            onChange={(e) => onChange({ ...value, [l.id]: e.target.value })}
          >
            {/* Empty is the engine's own default, named so nobody has to guess it. */}
            <option value="">{t("settings.voice.engineDefault", { voice: l.voice })}</option>
            {(["female", "male"] as const).map((gender) => {
              const voices = (engine?.voices ?? []).filter((v) => (v.gender ?? "female") === gender);
              return voices.length ? (
                <optgroup key={gender} label={t(`settings.voice.engines.gender.${gender}`)}>
                  {voices.map((v) => <option key={v.id} value={v.id}>{v.id} ({v.label})</option>)}
                </optgroup>
              ) : null;
            })}
          </select>
        </label>
      ))}
    </div>
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
