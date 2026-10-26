// Demos > Settings > Voice: which engine minted demos run on, the ElevenLabs
// voice per demo locale (with a preview), and the phones "Call me + prospect"
// rings first. Saves only its own fields: the server merges them into the
// voice row, so the card above it (voices, password, limits) is untouched.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Play, Square } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import type { ElevenDemoVoice } from "@/features/voiceDemo/types";
import {
  DEFAULT_OWNER_PHONE,
  DEFAULT_OWNER_PHONE_BACKUP,
  useDemoSettings,
  useElevenDemoOptions,
  useSaveVoiceSettings,
  type DemoEngine,
  type ElevenDemoLocale,
  type VoiceDemoSettings,
} from "../api/demoSettingsApi";
import { ENGINE_INPUT, Seg } from "./engineControls";

const CARD: React.CSSProperties = {
  borderRadius: "var(--r-card)",
  background: "var(--bone)",
  padding: "20px 22px",
  maxWidth: 560,
};
const TITLE: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)" };
const HINT: React.CSSProperties = { display: "block", fontSize: 12, color: "var(--mute)", margin: "2px 0 8px" };

/** Shown until the engine answers, so the card is never empty. */
const LOCALES: ElevenDemoLocale[] = ["nl", "en-GB", "en-US", "pt-BR"];
const ENGINES: DemoEngine[] = ["elevenlabs", "gpt-live"];

type Draft = Pick<VoiceDemoSettings, "demoEngine" | "elevenVoices" | "ownerPhone" | "ownerPhoneBackup" | "ownerPhoneUse">;

export function ElevenDemoSettings() {
  const { t } = useTranslation("demos");
  const { data } = useDemoSettings();
  const { data: options, isLoading, error } = useElevenDemoOptions();
  const save = useSaveVoiceSettings();
  const saved = (data?.settings?.voice || {}) as VoiceDemoSettings;
  const [draft, setDraft] = useState<Draft | null>(null);
  const current: Draft = draft ?? saved;
  const patch = (next: Partial<Draft>) => setDraft({ ...current, ...next });
  const engine = current.demoEngine ?? "elevenlabs";

  const preview = usePreview();

  const onSave = async () => {
    if (!draft) return;
    try {
      await save.mutateAsync({
        demoEngine: engine,
        elevenVoices: current.elevenVoices ?? {},
        ownerPhone: current.ownerPhone?.trim() || null,
        ownerPhoneBackup: current.ownerPhoneBackup?.trim() || null,
        ownerPhoneUse: current.ownerPhoneUse ?? "primary",
      });
      setDraft(null);
    } catch {
      // The draft stays for another try; the reason shows under the button.
    }
  };

  const locales = options?.locales?.length ? options.locales : LOCALES.map((id) => ({ id, label: id }));

  return (
    <div className="neu-raised" style={CARD} data-testid="eleven-demo-settings">
      <span style={{ ...TITLE, fontSize: 14 }}>{t("settings.eleven.title")}</span>
      <span style={HINT}>{t("settings.eleven.hint")}</span>

      <span style={{ ...TITLE, marginTop: 12 }}>{t("settings.eleven.engineTitle")}</span>
      <span style={HINT}>{t("settings.eleven.engineHint")}</span>
      <Seg<DemoEngine>
        value={engine}
        options={ENGINES}
        ariaLabel={t("settings.eleven.engineTitle")}
        label={(o) => t(`settings.voice.engines.engine.${o}`)}
        onChange={(demoEngine) => patch({ demoEngine })}
      />

      <div style={{ height: 1, background: "var(--line)", margin: "18px 0" }} />

      <span style={TITLE}>{t("settings.eleven.voicesTitle")}</span>
      <span style={HINT}>{t("settings.eleven.voicesHint")}</span>
      {error && <span style={{ fontSize: 12, color: "hsl(var(--destructive))" }}>{t("settings.voice.engineDown")}</span>}
      {isLoading && <span style={{ fontSize: 12, color: "var(--mute)" }}>{t("settings.voice.loading")}</span>}
      <div style={{ display: "grid", gap: 8 }}>
        {locales.map((l) => {
          const voices = options?.voices?.[l.id] ?? [];
          const chosen = current.elevenVoices?.[l.id] ?? "";
          const effective = chosen || options?.defaults?.[l.id] || "";
          const playable = voices.find((v) => v.id === effective)?.preview_url ?? null;
          const defaultName = voices.find((v) => v.id === options?.defaults?.[l.id])?.label;
          return (
            <div key={l.id} className="flex items-center gap-2 max-sm:flex-wrap">
              <span style={{ flex: 1, minWidth: 90, fontSize: 13, color: "var(--ink)" }}>{l.label}</span>
              <div style={{ width: 210, maxWidth: "100%" }} className="max-sm:flex-1">
                <ElevenVoiceSelect
                  voices={voices}
                  value={chosen}
                  emptyLabel={defaultName ? t("settings.voice.engineDefault", { voice: defaultName }) : t("settings.eleven.localeDefault")}
                  onChange={(v) => patch({ elevenVoices: { ...(current.elevenVoices ?? {}), [l.id]: v } })}
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

      <div style={{ height: 1, background: "var(--line)", margin: "18px 0" }} />

      <span style={TITLE}>{t("settings.eleven.phonesTitle")}</span>
      <span style={HINT}>{t("settings.eleven.phonesHint")}</span>
      <div style={{ display: "grid", gap: 8 }}>
        <label className="flex items-center gap-2">
          <span style={{ flex: 1, fontSize: 13, color: "var(--ink)" }}>{t("settings.eleven.ownerPhone")}</span>
          <input
            style={{ ...ENGINE_INPUT, width: 180, maxWidth: "55%" }}
            inputMode="tel"
            value={current.ownerPhone ?? ""}
            placeholder={DEFAULT_OWNER_PHONE}
            onChange={(e) => patch({ ownerPhone: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-2">
          <span style={{ flex: 1, fontSize: 13, color: "var(--ink)" }}>{t("settings.eleven.ownerPhoneBackup")}</span>
          <input
            style={{ ...ENGINE_INPUT, width: 180, maxWidth: "55%" }}
            inputMode="tel"
            value={current.ownerPhoneBackup ?? ""}
            placeholder={DEFAULT_OWNER_PHONE_BACKUP}
            onChange={(e) => patch({ ownerPhoneBackup: e.target.value })}
          />
        </label>
        <div className="flex items-center gap-2">
          <span style={{ flex: 1, fontSize: 13, color: "var(--ink)" }}>{t("settings.eleven.ownerPhoneUse")}</span>
          <Seg<"primary" | "backup">
            value={current.ownerPhoneUse ?? "primary"}
            options={["primary", "backup"]}
            ariaLabel={t("settings.eleven.ownerPhoneUse")}
            label={(o) => t(`settings.eleven.use.${o}`)}
            onChange={(ownerPhoneUse) => patch({ ownerPhoneUse })}
          />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        <button
          type="button"
          className="la-btn la-btn--primary"
          disabled={!draft || save.isPending}
          onClick={() => void onSave()}
        >
          {save.isPending && <Loader2 size={13} className="animate-spin" />}
          {t("settings.voice.save")}
        </button>
        {draft && (
          <button type="button" className="la-btn la-btn--soft" onClick={() => setDraft(null)}>
            {t("settings.voice.cancel")}
          </button>
        )}
        {save.isError && <span style={{ fontSize: 12, color: "hsl(var(--destructive))" }}>{(save.error as Error)?.message}</span>}
      </div>
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
