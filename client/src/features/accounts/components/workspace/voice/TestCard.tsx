// "Try her out" in Prompt & test: the test panel (VoiceTestPanel: engine tab, pick,
// one Test button, the live call and its review) and the recent test calls folded
// underneath. From 1440px the panel itself is the sticky column beside the tab
// (VoiceTab), so this card then holds only the list. The prompts she is given are
// edited further down the section; a test runs on the saved ones.
import { useCallback, useRef } from "react";
import { useVoiceT } from "./voiceGender";
import { Headphones } from "lucide-react";
import { VoiceCardShell, helpStyle } from "./voiceAtoms";
import type { VoiceLine, VoiceLinePatch } from "./voiceApi";
import { TestCallsList } from "./TestCallsList";
import { VoiceTestPanel } from "./test/VoiceTestPanel";
import { useVoiceTest } from "./test/VoiceTestProvider";

export function TestCard({ line, canEdit, saving, onSave }: {
  line: VoiceLine; canEdit: boolean; saving: boolean; onSave: (patch: VoiceLinePatch) => Promise<boolean>;
}) {
  const { t } = useVoiceT();
  const { column } = useVoiceTest();
  const canTest = !!line.persona;
  // Narrow layout: the panel sits above the list, so opening a row brings it into view.
  const panelRef = useRef<HTMLDivElement>(null);
  const showPanel = useCallback(() => {
    if (column) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
  }, [column]);

  return (
    <VoiceCardShell card="test" icon={<Headphones size={17} />} title={t("test.title")}>
      {column
        ? <p style={{ ...helpStyle, margin: 0 }} data-testid="voice-test-beside">{t("test.panel.besideNote")}</p>
        : (
          <>
            <div ref={panelRef} style={{ scrollMarginTop: 80 }}>
              <VoiceTestPanel line={line} canEdit={canEdit} saving={saving} onSave={onSave} />
            </div>
            {canTest && <p style={{ ...helpStyle, margin: "12px 0 0", textAlign: "center" }}>{t("test.panel.filedNote")}</p>}
          </>
        )}
      {canTest && <TestCallsList accountId={line.accountId} onOpened={showPanel} />}
    </VoiceCardShell>
  );
}
