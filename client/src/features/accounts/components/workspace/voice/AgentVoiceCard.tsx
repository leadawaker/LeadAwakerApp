// Agent name, voice, language, greeting, pronunciation and after-hours behaviour.
// Options and labels are the onboarding wizard's (setupConstants + the
// communicationProfile namespace), so the tab and the wizard cannot drift.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Plus, X } from "lucide-react";
import { Chip } from "../communication/wizardAtoms";
import { AGENT_NAMES } from "../communication/profileConstants";
import {
  AFTER_HOURS, FEMININE_VOICE_OPTIONS, MASCULINE_VOICE_OPTIONS, VOICE_LOCALES, VOICE_OPTIONS, nameForVoice,
  type PronunciationRow,
} from "../communication/setupConstants";
import { VoiceCardShell, FieldLabel, ReadOnlyValue, SaveRow, helpStyle, inputStyle, useDraft } from "./voiceAtoms";
import type { AfterHoursMode, VoiceLine, VoiceLinePatch } from "./voiceApi";

interface AgentDraft {
  agentName: string;
  agentNameCustom: string;
  voice: string;
  locale: string;
  greeting: string;
  pronunciation: PronunciationRow[];
  afterHours: AfterHoursMode | "";
}

const fromLine = (l: VoiceLine): AgentDraft => ({
  agentName: l.agentName ?? "",
  agentNameCustom: l.agentNameCustom ?? "",
  voice: l.voice ?? "",
  locale: l.locale ?? "",
  greeting: l.greeting ?? "",
  pronunciation: l.pronunciation ?? [],
  afterHours: l.afterHours ?? "",
});

const withCurrent = (options: readonly string[], current: string) =>
  current && !options.includes(current) ? [...options, current] : [...options];

const VOICE_GROUPS = [
  { gender: "female", options: FEMININE_VOICE_OPTIONS },
  { gender: "male", options: MASCULINE_VOICE_OPTIONS },
] as const;

export function AgentVoiceCard({ line, canEdit, saving, onSave }: {
  line: VoiceLine; canEdit: boolean; saving: boolean;
  onSave: (patch: VoiceLinePatch) => Promise<boolean>;
}) {
  const { t } = useTranslation(["voiceTab", "communicationProfile"]);
  const cp = (k: string) => t(`communicationProfile:questions.${k}`);
  const server = useMemo(() => fromLine(line), [line]);
  const { draft, setDraft, dirty, reset } = useDraft(server);
  const set = (patch: Partial<AgentDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const rows = draft.pronunciation.length ? draft.pronunciation : [{ word: "", sayAs: "" }];
  const setRows = (pronunciation: PronunciationRow[]) => set({ pronunciation });
  const agentLabel = (n: string) => (AGENT_NAMES as readonly string[]).includes(n) ? cp(`agentName.options.${n}.label`) : n;

  const [failed, setFailed] = useState(false);
  const submit = async () => {
    setFailed(false);
    const ok = await onSave({
      agentName: draft.agentName || null,
      agentNameCustom: draft.agentNameCustom.trim() || null,
      voice: draft.voice || null,
      locale: draft.locale || null,
      greeting: draft.greeting,
      pronunciation: draft.pronunciation.filter((r) => r.word.trim() && r.sayAs.trim()),
      afterHours: draft.afterHours || null,
    });
    if (!ok) setFailed(true);
  };

  const effectiveName = draft.agentNameCustom.trim() || (draft.agentName ? agentLabel(draft.agentName) : "");

  // A default name (Sara, Harry, Daan, Pedro) follows the voice and language;
  // a picked name chip or a typed name stays as it is.
  const followName = (voice: string, locale: string) =>
    draft.agentName && !draft.agentNameCustom.trim()
      ? {}
      : { agentNameCustom: nameForVoice(draft.agentNameCustom.trim(), voice, locale) };
  const otherVoice = draft.voice && !(VOICE_OPTIONS as readonly string[]).includes(draft.voice) ? draft.voice : null;

  return (
    <VoiceCardShell card="agent" icon={<Mic size={17} />} title={t("voiceTab:agent.title")}>
      <p style={helpStyle}>{t("voiceTab:agent.help")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <FieldLabel>{t("voiceTab:agent.name")}</FieldLabel>
          {canEdit ? (
            <>
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 10 }}>
                {withCurrent(AGENT_NAMES, draft.agentName).map((n) => (
                  <Chip key={n} selected={draft.agentName === n && !draft.agentNameCustom.trim()} onClick={() => set({ agentName: n, agentNameCustom: "" })} label={agentLabel(n)} />
                ))}
              </div>
              <input
                value={draft.agentNameCustom}
                onChange={(e) => set({ agentNameCustom: e.target.value })}
                placeholder={cp("agentName.customPlaceholder")}
                className="neu-inset-crisp"
                style={inputStyle}
              />
            </>
          ) : <ReadOnlyValue value={effectiveName} />}
        </div>

        <div>
          <FieldLabel>{cp("voiceSound.voiceLabel")}</FieldLabel>
          {canEdit ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {VOICE_GROUPS.map(({ gender, options }) => (
                <div key={gender}>
                  <p style={{ ...helpStyle, margin: "0 0 6px" }}>{cp(`agentName.${gender}`)}</p>
                  <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                    {[...options, ...(gender === "female" && otherVoice ? [otherVoice] : [])].map((k) => (
                      <Chip key={k} selected={draft.voice === k} onClick={() => set({ voice: k, ...followName(k, draft.locale) })} label={k.charAt(0).toUpperCase() + k.slice(1)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : <ReadOnlyValue value={draft.voice} />}
          {draft.voice && (VOICE_OPTIONS as readonly string[]).includes(draft.voice) && (
            <p style={{ ...helpStyle, margin: "8px 0 0" }}>{cp(`voiceSound.voices.${draft.voice}`)}</p>
          )}
        </div>

        <div>
          <FieldLabel>{cp("voiceSound.localeLabel")}</FieldLabel>
          {canEdit ? (
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              {withCurrent(VOICE_LOCALES, draft.locale).map((k) => (
                <Chip key={k} selected={draft.locale === k} onClick={() => set({ locale: k, ...followName(draft.voice, k) })} label={(VOICE_LOCALES as readonly string[]).includes(k) ? cp(`voiceSound.locales.${k}`) : k} />
              ))}
            </div>
          ) : <ReadOnlyValue value={draft.locale} />}
        </div>

        <div>
          <FieldLabel>{cp("voiceSound.greetingLabel")}</FieldLabel>
          {canEdit ? (
            <>
              <p style={helpStyle}>{cp("voiceSound.greetingHelp")}</p>
              <textarea
                value={draft.greeting}
                onChange={(e) => set({ greeting: e.target.value })}
                placeholder={cp("voiceSound.greetingPlaceholder")}
                rows={3}
                className="neu-inset-crisp"
                style={{ ...inputStyle, padding: "11px 13px", resize: "vertical", lineHeight: 1.5 }}
              />
            </>
          ) : <ReadOnlyValue value={draft.greeting} />}
        </div>

        <div>
          <FieldLabel>{t("voiceTab:agent.pronunciation")}</FieldLabel>
          {canEdit ? (
            <>
              <p style={helpStyle}>{cp("voicePronunciation.help")}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rows.map((row, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      value={row.word}
                      onChange={(e) => setRows(rows.map((r, idx) => (idx === i ? { ...r, word: e.target.value } : r)))}
                      placeholder={cp("voicePronunciation.wordPlaceholder")}
                      className="neu-inset-crisp"
                      style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                    />
                    <input
                      value={row.sayAs}
                      onChange={(e) => setRows(rows.map((r, idx) => (idx === i ? { ...r, sayAs: e.target.value } : r)))}
                      placeholder={cp("voicePronunciation.sayAsPlaceholder")}
                      className="neu-inset-crisp"
                      style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                    />
                    <button type="button" onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="la-btn la-btn--soft la-btn--icon" title={cp("voicePronunciation.remove")} style={{ width: 34, height: 34, flexShrink: 0 }}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="la-btn la-btn--inset" style={{ marginTop: 12 }} onClick={() => setRows([...rows, { word: "", sayAs: "" }])}>
                <Plus size={13} />{cp("voicePronunciation.add")}
              </button>
            </>
          ) : draft.pronunciation.length ? (
            <ReadOnlyValue value={draft.pronunciation.map((r) => `${r.word} → ${r.sayAs}`).join("\n")} />
          ) : <ReadOnlyValue />}
        </div>

        <div>
          <FieldLabel>{cp("voiceAfterHours.short")}</FieldLabel>
          {canEdit ? (
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              {AFTER_HOURS.map((k) => (
                <Chip key={k} selected={draft.afterHours === k} onClick={() => set({ afterHours: k })} label={cp(`voiceAfterHours.options.${k}.label`)} />
              ))}
            </div>
          ) : <ReadOnlyValue value={draft.afterHours ? cp(`voiceAfterHours.options.${draft.afterHours}.label`) : ""} />}
          {draft.afterHours && (
            <p style={{ ...helpStyle, margin: "8px 0 0" }}>{cp(`voiceAfterHours.options.${draft.afterHours}.help`)}</p>
          )}
        </div>
      </div>
      {canEdit && <SaveRow dirty={dirty} saving={saving} error={failed ? t("voiceTab:common.saveFailed") : null} onSave={submit} onReset={reset} />}
    </VoiceCardShell>
  );
}
