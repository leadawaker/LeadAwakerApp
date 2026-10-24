// Voice tab "Prompt & test" (agency only): what kind of line this is, which
// engine answers real calls (GPT Live or ElevenLabs; ElevenLabs is disabled on a
// client line while the engine says it is not allowed there), the GPT Live
// language model (Sol | Terra | Luna, on every line). ElevenLabs always runs Realtime Max.
// Saves on change, except the language model of a client line: that asks first in an
// inline row, since real callers get it at once. The voice is picked in the agent card (AgentVoiceCard).
import { useId, useState } from "react";
import { Loader2, Radio } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Seg } from "@/features/demos/components/engineControls";
import { useEngineOptions } from "@/features/demos/api/demoSettingsApi";
import { VoiceCardShell, FieldLabel, helpStyle } from "./voiceAtoms";
import { normalizePhone, type LineEngine, type LinePurpose, type VoiceLine, type VoiceNumber } from "./voiceApi";
import { effectiveLlm, needsConfirm, runsOnEleven } from "./lineEngine";
import { LLM_KEYS, llmLabel, type LlmKey } from "./llmOptions";
import { useSaveLineEngine, type LineEnginePatch } from "./useLineEngine";

const PURPOSES: LinePurpose[] = ["client", "demo", "test"];
const ENGINES: LineEngine[] = ["gpt-live", "elevenlabs"];
const warnStyle = { ...helpStyle, color: "var(--stage-lost)", margin: "10px 0 0" } as const;

/** Renders nothing unless the server sent the agency-only fields. */
export function LineEngineCard({ line }: { line: VoiceLine }) {
  const n = line.number;
  if (!n || n.purpose === undefined) return null;
  return <LineEngineBody line={line} number={n} purpose={n.purpose} />;
}

function LineEngineBody({ line, number, purpose }: { line: VoiceLine; number: VoiceNumber; purpose: LinePurpose }) {
  const { t } = useTranslation("voiceTab");
  const { t: td } = useTranslation("demos");
  const options = useEngineOptions();
  const save = useSaveLineEngine(line.accountId);
  const offNoteId = useId();
  const send = (patch: LineEnginePatch) => save.mutate({ numberId: number.id, patch });
  // A client line's model pick waiting for Confirm; null when nothing is pending.
  const [pendingLlm, setPendingLlm] = useState<LlmKey | null>(null);
  const liveLlm = effectiveLlm(number, "gpt-live");
  const pickLlm = (k: LlmKey) => {
    if (k === liveLlm) { setPendingLlm(null); return; }
    if (needsConfirm(purpose, "liveLlm")) setPendingLlm(k);
    else send({ liveLlm: k });
  };

  // Client lines can only run ElevenLabs once the engine allows it (line.clientElevenAllowed).
  const elevenOff = purpose === "client" && !line.clientElevenAllowed;
  const isEleven = runsOnEleven(number) || (purpose === "client" && !elevenOff && number.engine === "elevenlabs");
  const setUp = options.data?.eleven?.numbers.map(normalizePhone).includes(normalizePhone(number.phoneNumber)) ?? true;

  return (
    <VoiceCardShell
      card="lineEngine" icon={<Radio size={17} />} title={t("lineEngine.title")}
      action={save.isPending ? <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute)" }} /> : undefined}
    >
      <p style={helpStyle}>{t("lineEngine.help")}</p>
      <FieldLabel>{t("lineEngine.type")}</FieldLabel>
      <Seg value={purpose} options={PURPOSES} ariaLabel={t("lineEngine.type")} label={(p) => t(`lineEngine.purpose.${p}`)} onChange={(p) => { if (p !== purpose) send({ purpose: p }); }} />
      <p style={{ ...helpStyle, margin: "8px 0 0" }}>{t(`lineEngine.purposeHelp.${purpose}`)}</p>

      <div style={{ marginTop: 18 }}>
        <FieldLabel>{t("lineEngine.realCalls")}</FieldLabel>
        <Seg value={isEleven ? "elevenlabs" : "gpt-live"} options={ENGINES} ariaLabel={t("lineEngine.realCalls")} label={(e) => td(`settings.voice.engines.engine.${e}`)}
          disabledOptions={elevenOff ? ["elevenlabs"] : undefined} describedBy={elevenOff ? { elevenlabs: offNoteId } : undefined}
          onChange={(e) => { if (e !== (isEleven ? "elevenlabs" : "gpt-live")) send({ engine: e }); }} />
        {elevenOff && <p id={offNoteId} style={{ ...helpStyle, margin: "8px 0 0" }} data-testid="line-engine-client-eleven-off">{t("lineEngine.clientElevenOff")}</p>}
      </div>

      <div style={{ marginTop: 18 }}>
        <FieldLabel>{t("lineEngine.llm.realLabel")}</FieldLabel>
        <Seg value={pendingLlm ?? liveLlm} options={[...LLM_KEYS]} ariaLabel={t("lineEngine.llm.realLabel")} label={(k) => llmLabel(t, k)}
          onChange={pickLlm} />
        {pendingLlm && (
          <div style={{ marginTop: 10 }} data-testid="line-engine-llm-confirm">
            <p style={{ ...helpStyle, margin: "0 0 8px" }}>{t("lineEngine.llm.confirm", { model: llmLabel(t, pendingLlm) })}</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="la-btn la-btn--wine" disabled={save.isPending}
                onClick={() => { send({ liveLlm: pendingLlm }); setPendingLlm(null); }}>
                {t("lineEngine.llm.confirmYes")}
              </button>
              <button type="button" className="la-btn la-btn--soft" onClick={() => setPendingLlm(null)}>
                {t("lineEngine.llm.confirmNo")}
              </button>
            </div>
          </div>
        )}
        <p style={{ ...helpStyle, margin: "8px 0 0" }}>{t("lineEngine.llm.help")}</p>
      </div>

      {isEleven && !setUp && <p style={warnStyle} data-testid="line-engine-not-set-up">{t("lineEngine.notSetUp")}</p>}
      {save.isError && <p role="alert" style={warnStyle}>{(save.error as Error).message}</p>}
    </VoiceCardShell>
  );
}
