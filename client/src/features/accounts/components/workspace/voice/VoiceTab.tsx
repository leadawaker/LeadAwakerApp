// Account workspace "Voice" tab (specs/voice-tab): a menu of sections, one
// open at a time, the way the Integrations tab works. Overview is the month's
// calls and the number (readiness is the hover on the header's phone figure);
// Prompt & test (Owner only) is who she is, what she is told and a test call;
// the others hold what she knows, the call and what follows it.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RequestChangeNote } from "@/components/crm/RequestChangeNote";
import { VoiceGenderProvider, useVoiceT, voiceGender } from "./voiceGender";
import { Loader2 } from "lucide-react";
import { useVoiceLine } from "./useVoiceLine";
import { VoiceStatsRow } from "./VoiceStatsRow";
import { NumberSummaryCard } from "./NumberSummaryCard";
import { PersonaCard } from "./PersonaCard";
import { ConversationCard } from "./ConversationCard";
import { OnTheLineCard } from "./OnTheLineCard";
import { TransferCard } from "./TransferCard";
import { UnwantedCallsCard } from "./UnwantedCallsCard";
import { FollowUpCard } from "./FollowUpCard";
import { HoursCard, KnowledgeCard } from "./ReuseCards";
import { PromptSection } from "./PromptSection";
import { useWorkspace } from "@/hooks/useWorkspace";
import { VoiceRail, sectionAnchorId } from "./VoiceRail";
import { SectionHeader, SectionLayout } from "../SectionRail";
import { VOICE_SECTIONS, type VoiceSection } from "./readiness";

const gap = 22;

export function VoiceTab({ accountId, readOnly = false, stacked = false, onOpenIntegrations }: {
  accountId: number; readOnly?: boolean; stacked?: boolean; onOpenIntegrations?: () => void;
}) {
  const { t } = useVoiceT();
  const { t: tc } = useTranslation("crm");
  const { line, loading, error, saving, save, refetch } = useVoiceLine(accountId);
  const [section, setSection] = useState<VoiceSection>("overview");
  const canEdit = !readOnly;
  // Prompt & test edits prompts every client line shares: the Owner's alone.
  const { isOwner } = useWorkspace();
  const sections = isOwner && canEdit ? VOICE_SECTIONS : VOICE_SECTIONS.filter((s) => s !== "prompt");

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
  const index = sections.indexOf(section) + 1;

  const body = (
    <section id={sectionAnchorId(section)} style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }} data-testid={`voice-section-${section}`}>
      <SectionHeader
        index={index}
        // Rendered above the gender provider: pass her/his explicitly.
        title={t(`rail.${section}.label`, { context: voiceGender(line.voice) })}
        help={t(`rail.${section}.help`, { context: voiceGender(line.voice) })}
      />

      {!canEdit && <RequestChangeNote area={tc("requestChange.areas.phone")} />}

      {section === "overview" && (
        <>
          <VoiceStatsRow accountId={accountId} />
          <NumberSummaryCard line={line} onManage={canEdit ? onOpenIntegrations : undefined} />
        </>
      )}

      {section === "prompt" && sections.includes("prompt") && <PromptSection {...card} />}

      {section === "knowledge" && (
        <>
          <HoursCard line={line} canEdit={canEdit} onChanged={onChanged} />
          <KnowledgeCard line={line} canEdit={canEdit} onChanged={onChanged} persona={<PersonaCard {...card} bare />} />
        </>
      )}

      {section === "call" && (
        <>
          <TransferCard {...card} />
          <ConversationCard {...card} />
          <OnTheLineCard {...card} />
          <UnwantedCallsCard {...card} />
        </>
      )}

      {section === "after" && <FollowUpCard {...card} />}
    </section>
  );

  return (
    <VoiceGenderProvider value={voiceGender(line.voice)}>
      <SectionLayout
        stacked={stacked}
        testId="voice-tab"
        rail={(layout) => <VoiceRail line={line} sections={sections} active={section} onSelect={setSection} layout={layout} />}
      >
        {body}
      </SectionLayout>
    </VoiceGenderProvider>
  );
}
