// Who she is on the phone, the short version: her name, voice, language and
// how she says tricky words. Everything saves on its own. A name change is
// carried into the greeting, which says her name word for word. The gender
// button next to the name decides her gender for both engines; the voice
// picker lists the voices of the engine the line runs.
import { useMemo, useState } from "react";
import { useVoiceT } from "./voiceGender";
import { ChevronDown, Mic, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { VOICE_LOCALES, nameForVoice, spokenAgentName, type PronunciationRow } from "../communication/setupConstants";
import { VoiceCardShell, FieldLabel, helpStyle, inputStyle } from "./voiceAtoms";
import { VOICE_LOCALE_FLAGS } from "@/lib/languages";
import { VoicePicker } from "./VoicePicker";
import { Seg } from "@/features/demos/components/engineControls";
import { effectiveVoice, elevenVoicesFor, pickFits, runsOnEleven } from "./lineEngine";
import { useElevenVoices } from "./useElevenVoices";
import { useSaveLineEngine } from "./useLineEngine";
import { AutosaveBadge } from "./SharedPromptCard";
import { useAutosave, type AutosaveState } from "./useAutosave";
import type { AgentGender, VoiceLine, VoiceLinePatch } from "./voiceApi";

const titleCase = (v: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : "");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The greeting says her name word for word: carry a name change into it. */
const swapName = (text: string, from: string, to: string) =>
  from && to && from !== to ? text.replace(new RegExp(`\\b${escapeRe(from)}\\b`, "g"), to) : text;

const GENDER_CHOICES: ("auto" | "female" | "male")[] = ["auto", "female", "male"];
const warnStyle = { ...helpStyle, color: "var(--stage-lost)", margin: "6px 0 0" } as const;

const withCurrent = (options: readonly string[], current: string) =>
  current && !options.includes(current) ? [...options, current] : [...options];

export function AgentVoiceCard({ line, onSave }: {
  line: VoiceLine; canEdit: boolean; saving: boolean;
  onSave: (patch: VoiceLinePatch) => Promise<boolean>;
}) {
  const { t } = useVoiceT();
  const cp = (k: string) => t(`communicationProfile:questions.${k}`);
  const voice = line.voice ?? "";
  const locale = line.locale ?? "";
  const gender = line.agentGender ?? null;
  // The voice the engine ends up with: a set gender swaps a voice of the other gender.
  const gv = effectiveVoice(voice, gender);
  const savedName = line.agentNameCustom?.trim() || titleCase(line.agentName ?? "");
  const spokenNow = spokenAgentName(savedName, gv, locale);
  const eleven = runsOnEleven(line.number);
  const elevenVoices = useElevenVoices(eleven);
  const saveEngine = useSaveLineEngine(line.accountId);
  const allEleven = elevenVoices.data ?? [];
  const elevenPick = line.number?.engineVoice ?? "";
  const alsoUsedBy = (line.otherLines ?? []).map((l) => l.phoneNumber).join(", ");

  // Name: typed, saved a moment after typing stops.
  const [name, setName] = useState(savedName);
  const nameState = useAutosave(name, savedName, (next) => onSave({
    agentNameCustom: next.trim() || null,
    agentName: null,
    greeting: swapName(line.greeting ?? "", spokenNow, spokenAgentName(next.trim(), gv, locale)),
  }));

  // Voice, language and gender: saved on pick. A default name follows the voice and gender.
  const [pickState, setPickState] = useState<AutosaveState>("idle");
  const pick = async (patch: { voice?: string; locale?: string; agentGender?: AgentGender | null }) => {
    const g = patch.agentGender !== undefined ? patch.agentGender : gender;
    const v = effectiveVoice(patch.voice ?? voice, g);
    const l = patch.locale ?? locale;
    const followed = line.agentName && !line.agentNameCustom?.trim() ? null : nameForVoice(line.agentNameCustom?.trim() ?? "", v, l, locale);
    const nextName = followed ?? savedName;
    setPickState("saving");
    const ok = await onSave({
      ...patch,
      ...(followed !== null ? { agentNameCustom: followed || null } : {}),
      greeting: swapName(line.greeting ?? "", spokenNow, spokenAgentName(nextName, v, l)),
    });
    if (ok && followed !== null) setName(followed);
    setPickState(ok ? "saved" : "error");
  };
  // The ElevenLabs pick belongs to the line, not the account: the line-engine save.
  const pickEleven = async (id: string) => {
    if (!line.number) return;
    setPickState("saving");
    try {
      await saveEngine.mutateAsync({ numberId: line.number.id, patch: { engine: "elevenlabs", engineVoice: id || null } });
      setPickState("saved");
    } catch { setPickState("error"); }
  };

  // Pronunciation: edited in a popover, saved when it closes.
  const serverRows = useMemo(() => line.pronunciation ?? [], [line.pronunciation]);
  const [rows, setRows] = useState<PronunciationRow[]>(serverRows);
  const filled = (r: PronunciationRow[]) => r.filter((x) => x.word.trim() && x.sayAs.trim());
  const shownRows = rows.length ? rows : [{ word: "", sayAs: "" }];
  const closePronunciation = async (open: boolean) => {
    if (open) { setRows(serverRows); return; }
    if (JSON.stringify(filled(rows)) === JSON.stringify(serverRows)) return;
    setPickState("saving");
    const ok = await onSave({ pronunciation: filled(rows) });
    setPickState(ok ? "saved" : "error");
  };

  const state: AutosaveState = nameState === "saving" || pickState === "saving" ? "saving"
    : nameState === "error" || pickState === "error" ? "error"
    : nameState === "saved" || pickState === "saved" ? "saved" : "idle";
  const spoken = spokenAgentName(name.trim(), gv, locale);

  return (
    <VoiceCardShell card="agent" icon={<Mic size={17} />} title={t("voiceTab:agent.title")} action={<AutosaveBadge state={state} />}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 16 }}>
        <div>
          <FieldLabel>{t("voiceTab:agent.name")}</FieldLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={cp("agentName.customPlaceholder")}
            className="neu-inset-crisp"
            style={inputStyle}
            aria-label={t("voiceTab:agent.name")}
            data-testid="voice-agent-name"
          />
          {spoken && spoken !== name.trim() && (
            <p style={{ ...helpStyle, margin: "6px 0 0" }} data-testid="voice-spoken-name">{t("voiceTab:agent.spokenAs", { name: spoken })}</p>
          )}
          {line.number?.purpose !== undefined && (
            <div style={{ marginTop: 10 }} data-testid="voice-gender">
              <Seg
                value={gender ?? "auto"}
                options={GENDER_CHOICES}
                ariaLabel={t("voiceTab:agent.gender")}
                label={(g) => t(`voiceTab:agent.genderOption.${g}`)}
                onChange={(g) => { const next = g === "auto" ? null : g; if (next !== gender) void pick({ agentGender: next }); }}
              />
              {alsoUsedBy && <p style={{ ...helpStyle, margin: "6px 0 0" }} data-testid="voice-gender-shared">{t("voiceTab:agent.alsoUsedBy", { number: alsoUsedBy })}</p>}
            </div>
          )}
        </div>
        <div>
          <FieldLabel>{cp("voiceSound.voiceLabel")}</FieldLabel>
          {eleven ? (
            <>
              <VoicePicker
                value={elevenPick}
                onChange={(id) => { void pickEleven(id); }}
                eleven={{ voices: elevenVoicesFor(allEleven, gender, voice, elevenPick), defaultLabel: t("voiceTab:lineEngine.defaultVoice", { name: spoken || savedName }) }}
              />
              {elevenVoices.isError && <p style={warnStyle} data-testid="line-engine-voices-failed">{t("voiceTab:lineEngine.voicesFailed")}</p>}
              {allEleven.length > 0 && !pickFits(elevenPick, allEleven, gv) && (
                <p style={warnStyle} data-testid="line-engine-mismatch">{t("voiceTab:lineEngine.mismatch", { name: spoken || savedName })}</p>
              )}
            </>
          ) : (
            <VoicePicker value={voice} gender={gender} onChange={(v) => { void pick({ voice: v }); }} />
          )}
        </div>
        <div>
          <FieldLabel>{cp("voiceSound.localeLabel")}</FieldLabel>
          <select
            value={locale}
            onChange={(e) => { void pick({ locale: e.target.value }); }}
            className="neu-inset-crisp"
            style={inputStyle}
            aria-label={cp("voiceSound.localeLabel")}
            data-testid="voice-locale"
          >
            {!locale && <option value="">{"–"}</option>}
            {withCurrent(VOICE_LOCALES, locale).map((k) => (
              <option key={k} value={k}>{(VOICE_LOCALES as readonly string[]).includes(k) ? `${VOICE_LOCALE_FLAGS[k]} ${cp(`voiceSound.locales.${k}`)}` : k}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <Popover onOpenChange={(o) => { void closePronunciation(o); }}>
          <PopoverTrigger asChild>
            <button type="button" className="la-btn la-btn--soft" data-testid="voice-pronunciation-open">
              {serverRows.length ? t("voiceTab:agent.pronunciationCount", { count: serverRows.length }) : t("voiceTab:agent.pronunciationAdd")}
              <ChevronDown size={13} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" collisionPadding={12} style={{ width: "min(92vw, 460px)", maxHeight: "min(var(--radix-popover-content-available-height), 560px)", overflowY: "auto" }}>
            <p style={helpStyle}>{cp("voicePronunciation.help")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {shownRows.map((row, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    value={row.word}
                    onChange={(e) => setRows(shownRows.map((r, idx) => (idx === i ? { ...r, word: e.target.value } : r)))}
                    placeholder={cp("voicePronunciation.wordPlaceholder")}
                    className="neu-inset-crisp"
                    style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                  />
                  <input
                    value={row.sayAs}
                    onChange={(e) => setRows(shownRows.map((r, idx) => (idx === i ? { ...r, sayAs: e.target.value } : r)))}
                    placeholder={cp("voicePronunciation.sayAsPlaceholder")}
                    className="neu-inset-crisp"
                    style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                  />
                  <button type="button" onClick={() => setRows(shownRows.filter((_, idx) => idx !== i))} className="la-btn la-btn--soft la-btn--icon" title={cp("voicePronunciation.remove")} style={{ width: 34, height: 34, flexShrink: 0 }}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="la-btn la-btn--inset" style={{ marginTop: 12 }} onClick={() => setRows([...shownRows, { word: "", sayAs: "" }])}>
              <Plus size={13} />{cp("voicePronunciation.add")}
            </button>
            <p style={{ ...helpStyle, margin: "12px 0 0" }}>{t("voiceTab:agent.pronunciationAutosave")}</p>
          </PopoverContent>
        </Popover>
      </div>
    </VoiceCardShell>
  );
}
