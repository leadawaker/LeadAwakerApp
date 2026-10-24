// The Voice tab's one test panel: the head (engine tab, pick, Test button), then the
// body for the phase: nothing when idle, the live view while a call connects, runs
// or ends (LiveCallView, Task 10), the review after it (CallReviewView, Task 11).
// Rendered in the sticky right column on wide screens (VoiceTab) or inline in
// Prompt & test (TestCard); the state lives in VoiceTestProvider.
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import type { VoiceLine, VoiceLinePatch } from "../voiceApi";
import { TestPanelHead } from "./TestPanelHead";
import { LiveCallView } from "./LiveCallView";
import { CallReviewView } from "./CallReviewView";
import { isCallBusy, useVoiceTest } from "./VoiceTestProvider";

export function VoiceTestPanel(props: {
  line: VoiceLine; canEdit: boolean; saving: boolean; onSave: (patch: VoiceLinePatch) => Promise<boolean>;
}) {
  const { t } = useTranslation("voiceTab");
  const { phase, reviewCallId, newTest } = useVoiceTest();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }} data-testid="voice-test-panel" data-phase={phase}>
      <TestPanelHead {...props} />
      {isCallBusy(phase) && <LiveCallView />}
      {phase === "review" && reviewCallId && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span className="eyebrow eyebrow-sm">{t("test.panel.phase.review")}</span>
            <button type="button" className="la-btn la-btn--soft" onClick={newTest} data-testid="voice-test-new">
              <RotateCcw size={13} />
              {t("test.panel.newTest")}
            </button>
          </div>
          <CallReviewView callId={reviewCallId} />
        </div>
      )}
    </div>
  );
}
