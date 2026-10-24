// Agency A/B switch for the Test button: the shared voice layer, or the lean
// one under test (Prompt_Library voice_lean_layer_*). Only the browser test
// reads it (engine live_voice_routes); phone calls and demos never do.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { FieldLabel, helpStyle } from "./voiceAtoms";
import type { VoiceLine, VoiceLinePatch } from "./voiceApi";

export function TestPromptSwitch({ line, canEdit, saving, onSave }: {
  line: VoiceLine; canEdit: boolean; saving: boolean; onSave: (patch: VoiceLinePatch) => Promise<boolean>;
}) {
  const { t } = useTranslation("voiceTab");
  const [error, setError] = useState<string | null>(null);
  const lean = line.testPrompt === "lean";

  const flip = async (on: boolean) => {
    setError(null);
    if (!(await onSave({ testPrompt: on ? "lean" : "standard" }))) setError(t("common.saveFailed"));
  };

  return (
    <div style={{ marginTop: 16 }} data-testid="voice-test-prompt">
      <FieldLabel>{t("test.prompt.label")}</FieldLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Switch checked={lean} onCheckedChange={flip} disabled={!canEdit || saving}
          aria-label={t("test.prompt.label")} />
        <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          {t(lean ? "test.prompt.lean" : "test.prompt.standard")}
        </span>
        {saving && <Loader2 size={13} className="animate-spin" style={{ color: "var(--mute-2)" }} />}
      </div>
      <p style={{ ...helpStyle, margin: "8px 0 0" }}>{t("test.prompt.help")}</p>
      {error && (
        <p role="alert" style={{ ...helpStyle, margin: "8px 0 0", color: "var(--stage-lost)" }}>{error}</p>
      )}
    </div>
  );
}
