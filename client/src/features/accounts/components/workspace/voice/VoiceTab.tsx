// Account workspace "Voice" tab (specs/voice-tab): readiness, the monthly
// dashboard, and one card per piece of a live voice client's setup.
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useVoiceLine } from "./useVoiceLine";
import { ReadinessChecklist } from "./ReadinessChecklist";
import { VoiceStatsRow } from "./VoiceStatsRow";
import { NumberCard } from "./NumberCard";
import { PersonaCard } from "./PersonaCard";
import { AgentVoiceCard } from "./AgentVoiceCard";
import { TransferCard } from "./TransferCard";
import { UnwantedCallsCard } from "./UnwantedCallsCard";
import { ExtraInstructionsCard } from "./ExtraInstructionsCard";
import { HoursCard, KnowledgeCard } from "./ReuseCards";
import { TestCard } from "./TestCard";

export function VoiceTab({ accountId, readOnly = false }: { accountId: number; readOnly?: boolean }) {
  const { t } = useTranslation("voiceTab");
  const { line, loading, error, saving, save, refetch } = useVoiceLine(accountId);
  const canEdit = !readOnly;

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ padding: 48, color: "var(--mute)" }}>
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (error || !line) {
    return (
      <div className="neu-inset" style={{ borderRadius: "var(--r-card)", padding: 32, textAlign: "center", color: "var(--mute)", fontSize: 13.5 }}>
        {t("common.loadFailed")}
      </div>
    );
  }

  const card = { line, canEdit, saving, onSave: save };
  const onChanged = () => { void refetch(); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }} data-testid="voice-tab">
      <ReadinessChecklist line={line} />
      <VoiceStatsRow accountId={accountId} />
      {canEdit && <TestCard line={line} />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 22, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}>
          <NumberCard {...card} />
          <PersonaCard {...card} />
          <TransferCard {...card} />
          <HoursCard line={line} canEdit={canEdit} onChanged={onChanged} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}>
          <AgentVoiceCard {...card} />
          <ExtraInstructionsCard {...card} />
          <UnwantedCallsCard {...card} />
        </div>
      </div>
      <KnowledgeCard line={line} canEdit={canEdit} onChanged={onChanged} />
    </div>
  );
}
