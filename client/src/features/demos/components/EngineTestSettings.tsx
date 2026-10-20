// Demos → Settings → Voice: engine tests.
//
// A tester's own phone number gets a chosen engine (OpenAI GPT-Live or xAI
// Grok), voice and prompt on a conference-route line, so both can be heard
// side by side on the same number while every other caller keeps the line's
// own setup. The engine reads this per call (automations voice_engines.py,
// 30 s cache) and falls back to GPT-Live when Grok is not set up.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  useDemoSettings,
  useEngineOptions,
  useSaveVoiceSettings,
  type EngineTest,
  type EngineVoice,
  type VoiceDemoSettings,
  type VoiceEngine,
} from "../api/demoSettingsApi";

const CARD: React.CSSProperties = {
  borderRadius: "var(--r-card)",
  background: "var(--bone)",
  padding: "20px 22px",
  maxWidth: 560,
};
const INPUT: React.CSSProperties = {
  height: 34,
  borderRadius: "var(--r-field, 8px)",
  border: "1px solid var(--line)",
  background: "var(--card)",
  color: "var(--ink)",
  padding: "0 9px",
  fontSize: 13,
};
const SEG_BTN: React.CSSProperties = { padding: "6px 11px", fontSize: 11, letterSpacing: "0.08em" };
const ENGINES: VoiceEngine[] = ["gpt-live", "xai"];
const GENDERS = ["female", "male", "neutral", null] as const;
const MAX_TESTS = 10;

function Seg<T extends string>({ value, options, label, onChange }: {
  value: T; options: T[]; label: (o: T) => string; onChange: (o: T) => void;
}) {
  return (
    <div className="la-seg" role="radiogroup" style={{ alignSelf: "flex-start" }}>
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={value === o}
          className={value === o ? "la-seg-btn on" : "la-seg-btn"} style={SEG_BTN} onClick={() => onChange(o)}>
          {label(o)}
        </button>
      ))}
    </div>
  );
}

function VoiceSelect({ voices, value, onChange }: {
  voices: EngineVoice[]; value: string; onChange: (v: string) => void;
}) {
  const { t } = useTranslation("demos");
  return (
    <select style={{ ...INPUT, width: "100%" }} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t("settings.voice.engines.lineVoice")}</option>
      {GENDERS.map((g) => {
        const group = voices.filter((v) => v.gender === g);
        return group.length ? (
          <optgroup key={g ?? "other"} label={t(`settings.voice.engines.gender.${g ?? "other"}`)}>
            {group.map((v) => <option key={v.id} value={v.id}>{v.id} — {v.label}</option>)}
          </optgroup>
        ) : null;
      })}
    </select>
  );
}

export function EngineTestSettings() {
  const { t } = useTranslation("demos");
  const { data } = useDemoSettings();
  const options = useEngineOptions();
  const save = useSaveVoiceSettings();

  const saved = ((data?.settings?.voice || {}) as VoiceDemoSettings).engineTests ?? [];
  const [draft, setDraft] = useState<EngineTest[] | null>(null);
  const tests = draft ?? saved;
  const xai = options.data?.xai;

  const update = (i: number, next: Partial<EngineTest>) =>
    setDraft(tests.map((row, j) => (j === i ? { ...row, ...next } : row)));

  const onSave = async () => {
    if (!draft) return;
    try {
      await save.mutateAsync({ engineTests: draft.filter((row) => row.number.trim()) });
      setDraft(null);
    } catch {
      // The draft stays; the reason shows under the button.
    }
  };

  return (
    <div className="neu-raised" style={CARD}>
      <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
        {t("settings.voice.engines.title")}
      </span>
      <span style={{ display: "block", fontSize: 12, color: "var(--mute)", marginTop: 2 }}>
        {t("settings.voice.engines.hint")}
      </span>

      {options.isLoading ? (
        <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute)", marginTop: 10 }} />
      ) : options.error ? (
        <span style={{ display: "block", fontSize: 12, color: "var(--danger, #B3261E)", marginTop: 10 }}>
          {t("settings.voice.engineDown")}
        </span>
      ) : (
        <span style={{ display: "block", fontSize: 12, marginTop: 10, color: xai?.ready ? "var(--ink-soft)" : "var(--mute-2)" }}>
          {xai?.ready
            ? t("settings.voice.engines.xaiReady", { numbers: xai.numbers.join(", ") })
            : t("settings.voice.engines.xaiMissing", { missing: (xai?.missing ?? []).join(", ") })}
        </span>
      )}

      <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
        {tests.map((row, i) => {
          const isXai = row.engine === "xai";
          return (
            <div key={i} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-field, 8px)", padding: 12, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input style={{ ...INPUT, flex: 1, minWidth: 0 }} value={row.number} inputMode="tel"
                  placeholder={t("settings.voice.engines.numberPlaceholder")}
                  aria-label={t("settings.voice.engines.number")}
                  onChange={(e) => update(i, { number: e.target.value })} />
                <input style={{ ...INPUT, width: 130 }} value={row.label ?? ""}
                  placeholder={t("settings.voice.engines.labelPlaceholder")}
                  aria-label={t("settings.voice.engines.label")}
                  onChange={(e) => update(i, { label: e.target.value })} />
                <Switch checked={row.enabled !== false} aria-label={t("settings.voice.engines.enabled")}
                  onCheckedChange={(v) => update(i, { enabled: v })} />
                <button type="button" className="la-btn la-btn--soft" aria-label={t("settings.voice.engines.remove")}
                  onClick={() => setDraft(tests.filter((_, j) => j !== i))}>
                  <Trash2 size={13} />
                </button>
              </div>
              <Seg value={row.engine} options={ENGINES} label={(e) => t(`settings.voice.engines.engine.${e}`)}
                // A voice belongs to one engine: switching clears it.
                onChange={(engine) => update(i, { engine, voice: "" })} />
              <VoiceSelect voices={options.data?.voices[row.engine] ?? []} value={row.voice ?? ""}
                onChange={(voice) => update(i, { voice })} />
              {isXai && (
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--mute)" }}>{t("settings.voice.engines.prompt")}</span>
                  <Seg value={row.prompt ?? "standard"} options={["standard", "lean"]}
                    label={(p) => t(`settings.voice.engines.promptOption.${p}`)}
                    onChange={(prompt) => update(i, { prompt })} />
                  <span style={{ fontSize: 12, color: "var(--mute)" }}>{t("settings.voice.engines.reasoning")}</span>
                  <Seg value={row.reasoning ?? "high"} options={["high", "none"]}
                    label={(r) => t(`settings.voice.engines.reasoningOption.${r}`)}
                    onChange={(reasoning) => update(i, { reasoning })} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {tests.length < MAX_TESTS && (
        <button type="button" className="la-btn la-btn--soft" style={{ marginTop: 12 }}
          onClick={() => setDraft([...tests, { number: "", engine: "xai", prompt: "standard", enabled: true }])}>
          <Plus size={13} />
          {t("settings.voice.engines.add")}
        </button>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18 }}>
        <button type="button" className="la-btn la-btn--primary" disabled={!draft || save.isPending}
          onClick={() => void onSave()}>
          {save.isPending && <Loader2 size={13} className="animate-spin" />}
          {t("settings.voice.save")}
        </button>
        {draft && (
          <button type="button" className="la-btn la-btn--soft" onClick={() => setDraft(null)}>
            {t("settings.voice.cancel")}
          </button>
        )}
        {save.isError && (
          <span style={{ fontSize: 12, color: "var(--danger, #B3261E)" }}>{(save.error as Error)?.message}</span>
        )}
      </div>
    </div>
  );
}
