// The test panel's head: the GPT Live | ElevenLabs tab, the GPT Live pick under it
// (Sol | Terra | Luna; ElevenLabs always runs Realtime Max), the A/B prompt switch on
// GPT Live (agency), and the one Test button (Hang up during a call).
// All picks are test only (testPanelPrefs); they never change the line.
import { useTranslation } from "react-i18next";
import { Loader2, PhoneCall, PhoneOff } from "lucide-react";
import { Seg } from "@/features/demos/components/engineControls";
import { useWorkspace } from "@/hooks/useWorkspace";
import { FieldLabel, helpStyle } from "../voiceAtoms";
import { LLM_KEYS, llmLabel } from "../llmOptions";
import { TestPromptSwitch } from "../TestPromptSwitch";
import type { VoiceLine, VoiceLinePatch } from "../voiceApi";
import { TEST_ENGINES } from "./testPanelPrefs";
import { isCallBusy, useVoiceTest } from "./VoiceTestProvider";

const noteStyle = { ...helpStyle, margin: 0 } as const;
const bigBtn = { width: "100%", justifyContent: "center", padding: "14px 20px", fontSize: 14 } as const;

export function TestPanelHead({ line, canEdit, saving, onSave }: {
  line: VoiceLine; canEdit: boolean; saving: boolean; onSave: (patch: VoiceLinePatch) => Promise<boolean>;
}) {
  const { t } = useTranslation("voiceTab");
  const { isAgencyUser } = useWorkspace();
  const test = useVoiceTest();
  const { engine, phase } = test;
  const busy = isCallBusy(phase);
  const canTest = !!line.persona;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }} data-testid="voice-test-head">
      <div className="la-seg la-seg--fill" role="tablist" aria-label={t("test.panel.engine")}>
        {TEST_ENGINES.map((e) => (
          <button
            key={e} type="button" role="tab" aria-selected={engine === e}
            className={engine === e ? "la-seg-btn on" : "la-seg-btn"}
            disabled={busy || (e === "elevenlabs" && !test.elevenAvailable)}
            onClick={() => test.setEngine(e)}
            data-testid={`voice-test-engine-${e}`}
          >
            {t(`test.panel.engines.${e}`)}
          </button>
        ))}
      </div>

      {engine === "gpt-live" && (
        <div>
          <FieldLabel>{t("lineEngine.llm.label")}</FieldLabel>
          <Seg value={test.llm} options={[...LLM_KEYS]} ariaLabel={t("lineEngine.llm.label")} label={(k) => llmLabel(t, k)}
            disabledOptions={busy ? [...LLM_KEYS] : undefined} onChange={test.setLlm} />
        </div>
      )}
      <p style={noteStyle}>{t("test.panel.testOnly")}</p>
      {isAgencyUser && !line.number && <p style={noteStyle} data-testid="voice-test-eleven-no-number">{t("test.panel.elevenNoNumber")}</p>}

      {engine === "gpt-live" && isAgencyUser && canTest && (
        <TestPromptSwitch line={line} canEdit={canEdit} saving={saving} onSave={onSave} />
      )}

      <TestButton canTest={canTest} />

      {!canTest && <p style={{ ...noteStyle, textAlign: "center" }}>{t("test.needsPersona")}</p>}
      {canTest && engine === "elevenlabs" && <p style={noteStyle}>{t("test.eleven.note")}</p>}
      {phase === "live" && <p style={{ ...noteStyle, color: "var(--ink-soft)" }} data-testid="voice-test-live-note">{t("test.panel.liveNote")}</p>}
      {test.error && (
        <p role="alert" style={{ ...noteStyle, color: "hsl(var(--destructive))" }} data-testid="voice-test-error">
          {test.error.engine === "elevenlabs" ? t(`test.eleven.error.${test.error.key}`) : t("test.panel.error.gptLive")}
          {test.error.engine === "gpt-live" && (
            <span style={{ display: "block", fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute)", marginTop: 4 }}>{test.error.message}</span>
          )}
        </p>
      )}
    </div>
  );
}

function TestButton({ canTest }: { canTest: boolean }) {
  const { t } = useTranslation("voiceTab");
  const { phase, start, hangup } = useVoiceTest();

  if (phase !== "idle" && phase !== "review") {
    // A call that is still connecting can be cancelled too (both engines).
    return (
      <button type="button" className="la-btn la-btn--wine" onClick={hangup} disabled={phase === "ending"} style={bigBtn} data-testid="voice-test-hangup">
        {phase === "live" ? <PhoneOff size={16} /> : <Loader2 size={16} className="animate-spin" />}
        {phase === "ending" ? t("test.panel.ending") : t("test.panel.hangUp")}
      </button>
    );
  }
  return (
    <button
      type="button" className="la-btn la-btn--wine" onClick={() => { void start(); }}
      disabled={!canTest} style={{ ...bigBtn, ...(canTest ? {} : { opacity: 0.5 }) }} data-testid="voice-test-call"
    >
      <PhoneCall size={16} />
      {t("test.panel.start")}
    </button>
  );
}
