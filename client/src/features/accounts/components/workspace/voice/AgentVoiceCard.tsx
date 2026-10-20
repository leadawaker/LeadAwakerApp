// Who she is on the phone, the short version: her name, voice, language and
// how she says tricky words. Everything saves on its own. A name change is
// carried into the greeting, which says her name word for word.
import { useMemo, useState } from "react";
import { useVoiceT } from "./voiceGender";
import { ChevronDown, Mic, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { VOICE_LOCALES, nameForVoice, spokenAgentName, type PronunciationRow } from "../communication/setupConstants";
import { VoiceCardShell, FieldLabel, helpStyle, inputStyle } from "./voiceAtoms";
import { VoicePicker } from "./VoicePicker";
import { AutosaveBadge } from "./SharedPromptCard";
import { useAutosave, type AutosaveState } from "./useAutosave";
import type { VoiceLine, VoiceLinePatch } from "./voiceApi";

const titleCase = (v: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : "");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The greeting says her name word for word: carry a name change into it. */
const swapName = (text: string, from: string, to: string) =>
  from && to && from !== to ? text.replace(new RegExp(`\\b${escapeRe(from)}\\b`, "g"), to) : text;

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
  const savedName = line.agentNameCustom?.trim() || titleCase(line.agentName ?? "");
  const spokenNow = spokenAgentName(savedName, voice, locale);

  // Name: typed, saved a moment after typing stops.
  const [name, setName] = useState(savedName);
  const nameState = useAutosave(name, savedName, (next) => onSave({
    agentNameCustom: next.trim() || null,
    agentName: null,
    greeting: swapName(line.greeting ?? "", spokenNow, spokenAgentName(next.trim(), voice, locale)),
  }));

  // Voice and language: saved on pick. A default name follows the voice.
  const [pickState, setPickState] = useState<AutosaveState>("idle");
  const pick = async (patch: { voice?: string; locale?: string }) => {
    const v = patch.voice ?? voice;
    const l = patch.locale ?? locale;
    const followed = line.agentName && !line.agentNameCustom?.trim() ? null : nameForVoice(line.agentNameCustom?.trim() ?? "", v, l);
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
  const spoken = spokenAgentName(name.trim(), voice, locale);

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
        </div>
        <div>
          <FieldLabel>{cp("voiceSound.voiceLabel")}</FieldLabel>
          <VoicePicker value={voice} onChange={(v) => { void pick({ voice: v }); }} />
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
              <option key={k} value={k}>{(VOICE_LOCALES as readonly string[]).includes(k) ? cp(`voiceSound.locales.${k}`) : k}</option>
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
