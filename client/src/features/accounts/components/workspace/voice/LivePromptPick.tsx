// Agency pick of the GPT Live voice layer this account's calls run on: the shared
// standard one (voice_layer_*) or the lean one (voice_lean_layer_*, the default).
// Phone calls and the Test button both read it (engine client_setup.test_prompt);
// "Hoe hij spreekt" below edits whichever row is picked.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Seg } from "@/features/demos/components/engineControls";
import { FieldLabel, helpStyle } from "./voiceAtoms";
import type { TestPrompt, VoiceLine, VoiceLinePatch } from "./voiceApi";

const OPTIONS: TestPrompt[] = ["lean", "standard"];

export function LivePromptPick({ line, canEdit, saving, onSave }: {
  line: VoiceLine; canEdit: boolean; saving: boolean; onSave: (patch: VoiceLinePatch) => Promise<boolean>;
}) {
  const { t } = useTranslation("voiceTab");
  const [error, setError] = useState<string | null>(null);

  const current = line.testPrompt ?? "lean";

  const pick = async (testPrompt: TestPrompt) => {
    if (testPrompt === current) return;
    setError(null);
    if (!(await onSave({ testPrompt }))) setError(t("common.saveFailed"));
  };

  return (
    <div style={{ marginBottom: 14 }} data-testid="voice-live-prompt">
      <FieldLabel>{t("test.prompt.label")}</FieldLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Seg value={current} options={OPTIONS} ariaLabel={t("test.prompt.label")}
          label={(p) => t(`test.prompt.${p}`)} disabledOptions={!canEdit || saving ? OPTIONS : undefined} onChange={pick} />
        {saving && <Loader2 size={13} className="animate-spin" style={{ color: "var(--mute-2)" }} />}
      </div>
      <p style={{ ...helpStyle, margin: "8px 0 0" }}>{t("test.prompt.help")}</p>
      {error && (
        <p role="alert" style={{ ...helpStyle, margin: "8px 0 0", color: "var(--stage-lost)" }}>{error}</p>
      )}
    </div>
  );
}
