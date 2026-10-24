// Demos → Settings → Voice: engine tests.
//
// A tester's own phone number gets a chosen engine (OpenAI GPT-Live or
// ElevenLabs), voice and prompt on a conference-route line, so they can be
// heard side by side on the same number while every other caller keeps the
// line's own setup. The engine reads this per call (automations
// voice_engines.py, 30 s cache) and falls back to GPT-Live when
// ElevenLabs is not set up. Grok is retired: no longer offered, and a saved
// "xai" row is answered by GPT-Live (shown with a note). "Memory off" per row
// makes the tester sound like a first-time caller (phone_voice_routes.py).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  useDemoSettings,
  useEngineOptions,
  useSaveVoiceSettings,
  type EngineTest,
  type VoiceDemoSettings,
  type VoiceEngine,
} from "../api/demoSettingsApi";
import { ENGINE_INPUT as INPUT, Seg, VoiceSelect } from "./engineControls";

const CARD: React.CSSProperties = {
  borderRadius: "var(--r-card)",
  background: "var(--bone)",
  padding: "20px 22px",
  maxWidth: 560,
};
const ENGINES: VoiceEngine[] = ["gpt-live", "elevenlabs"];
const MAX_TESTS = 10;

export function EngineTestSettings() {
  const { t } = useTranslation("demos");
  const { data } = useDemoSettings();
  const options = useEngineOptions();
  const save = useSaveVoiceSettings();

  const saved = ((data?.settings?.voice || {}) as VoiceDemoSettings).engineTests ?? [];
  const [draft, setDraft] = useState<EngineTest[] | null>(null);
  const tests = draft ?? saved;
  // Absent until the engine ships ElevenLabs: then the line stays hidden.
  const eleven = options.data?.eleven;

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
        <>
          {eleven && (
            <span style={{ display: "block", fontSize: 12, marginTop: 10, color: eleven.ready ? "var(--ink-soft)" : "var(--mute-2)" }}>
              {eleven.ready
                ? t("settings.voice.engines.elevenReady", { numbers: eleven.numbers.join(", ") })
                : t("settings.voice.engines.elevenMissing", { missing: eleven.missing.join(", ") })}
            </span>
          )}
        </>
      )}

      <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
        {tests.map((row, i) => {
          // Grok is retired: an old saved row is answered by GPT-Live.
          const isRetired = row.engine === "xai";
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
              <VoiceSelect voices={options.data?.voices?.[row.engine] ?? []} value={row.voice ?? ""}
                emptyLabel={t("settings.voice.engines.lineVoice")}
                onChange={(voice) => update(i, { voice })} />
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Switch checked={row.freshCaller === true} aria-label={t("settings.voice.engines.freshCaller")}
                  onCheckedChange={(v) => update(i, { freshCaller: v })} />
                <div style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 12, color: "var(--ink)" }}>
                    {t("settings.voice.engines.freshCaller")}
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--mute)", marginTop: 2 }}>
                    {t("settings.voice.engines.freshCallerHint")}
                  </span>
                </div>
              </div>
              {isRetired && (
                <span style={{ fontSize: 12, color: "var(--mute-2)" }}>{t("settings.voice.engines.retired")}</span>
              )}
            </div>
          );
        })}
      </div>

      {tests.length < MAX_TESTS && (
        <button type="button" className="la-btn la-btn--soft" style={{ marginTop: 12 }}
          onClick={() => setDraft([...tests, { number: "", engine: "gpt-live", enabled: true }])}>
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
