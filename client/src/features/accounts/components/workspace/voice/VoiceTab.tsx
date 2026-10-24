// The phone receptionist's settings (specs/voice-tab), shown as Calls > Settings
// (receptionist/ReceptionistSettings.tsx): a menu of sections, one open at a
// time. Overview is the month's calls and the number (readiness is the hover on
// the Accounts header's phone figure); Prompt & test (Owner only) is who she is,
// what she is told and a test call; the others hold what she knows, the call
// and what follows it.
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RequestChangeNote } from "@/components/crm/RequestChangeNote";
import { VoiceGenderProvider, useVoiceT, voiceGender } from "./voiceGender";
import { effectiveVoice } from "./lineEngine";
import { Headphones, Loader2 } from "lucide-react";
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
import { useLastTab } from "@/hooks/useLastTab";
import { VoiceRail, sectionAnchorId } from "./VoiceRail";
import { SectionHeader, SectionLayout } from "../SectionRail";
import { CARD_SECTION, VOICE_SECTIONS, focusCard, type VoiceCard, type VoiceSection } from "./readiness";
import { Panel } from "../atoms";
import { VoiceTestProvider } from "./test/VoiceTestProvider";
import { VoiceTestPanel } from "./test/VoiceTestPanel";
import { CallInProgressBar } from "./test/CallInProgressBar";
import { TEST_PANEL_COLUMN_PX, useWideTestPanel } from "./test/useWideTestPanel";

const gap = 22;

export function VoiceTab({ accountId, readOnly = false, stacked = false, onOpenIntegrations, initialSection, focus, knowledgeNote }: {
  accountId: number; readOnly?: boolean; stacked?: boolean; onOpenIntegrations?: () => void;
  /** The section a link opens on (?section=). */
  initialSection?: VoiceSection;
  /** A card to open and scroll to (?focus=, e.g. a readiness item's card). Wins over initialSection. */
  focus?: VoiceCard;
  /** One line at the top of "What she knows" (the hours and Company Intel are shared with Chats). */
  knowledgeNote?: ReactNode;
}) {
  const { t } = useVoiceT();
  const { t: tc } = useTranslation("crm");
  const { line, loading, error, saving, save, refetch } = useVoiceLine(accountId);
  // A ?focus= card or ?section= link wins; otherwise the section used last reopens.
  const [picked, setSection] = useLastTab<VoiceSection>("calls.settings", VOICE_SECTIONS, "overview", (focus ? CARD_SECTION[focus] : initialSection) ?? null);
  const canEdit = !readOnly;
  // Prompt & test edits prompts every client line shares: the Owner's alone.
  const { isOwner } = useWorkspace();
  const sections = isOwner && canEdit ? VOICE_SECTIONS : VOICE_SECTIONS.filter((s) => s !== "prompt");
  const section: VoiceSection = sections.includes(picked) ? picked : "overview";
  // The test call (Prompt & test's) belongs to the whole tab: from 1440px its panel is a
  // sticky column beside every section, below that it sits in Prompt & test.
  const testable = sections.includes("prompt");
  const wideTest = useWideTestPanel() && !stacked && testable;
  // Scroll to the linked card once the line has loaded and its section is on screen.
  const [pendingFocus, setPendingFocus] = useState<VoiceCard | undefined>(focus);
  useEffect(() => {
    if (!pendingFocus || !line) return;
    const id = window.setTimeout(() => { focusCard(pendingFocus); setPendingFocus(undefined); }, 150);
    return () => window.clearTimeout(id);
  }, [pendingFocus, line]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ padding: 48, color: "var(--mute)" }}>
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  // Only without data: a failed background refetch keeps the tab (and a live test call) up.
  if (!line) {
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
        title={t(`rail.${section}.label`, { context: voiceGender(effectiveVoice(line.voice, line.agentGender)) })}
        help={t(`rail.${section}.help`, { context: voiceGender(effectiveVoice(line.voice, line.agentGender)) })}
      />

      {!canEdit && <RequestChangeNote area={tc("requestChange.areas.phone")} />}
      {error && (
        <p role="status" style={{ margin: 0, fontSize: 12.5, color: "var(--mute)" }} data-testid="voice-refetch-failed">{t("common.loadFailed")}</p>
      )}

      {testable && !wideTest && section !== "prompt" && <CallInProgressBar onOpen={() => setSection("prompt")} />}

      {section === "overview" && (
        <>
          <VoiceStatsRow accountId={accountId} />
          <NumberSummaryCard line={line} onManage={canEdit ? onOpenIntegrations : undefined} />
        </>
      )}

      {section === "prompt" && sections.includes("prompt") && <PromptSection {...card} />}

      {section === "knowledge" && (
        <>
          {knowledgeNote}
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

  const content = wideTest ? (
    <div style={{ display: "grid", gridTemplateColumns: `minmax(0, 1fr) ${TEST_PANEL_COLUMN_PX}px`, gap, alignItems: "start" }} data-testid="voice-tab-test-column">
      {body}
      {/* Sticks where the section menu does (SectionLayout). Scrolls on its own when taller than
          the window; the padding keeps the card's shadow from being clipped by that scroll box. It
          reaches 12px into the gap on the left and ends at its column's right edge, so nothing
          overflows the content width. */}
      <aside style={{
        position: "sticky", top: "calc(var(--ws-sticky-top, 0px) + 20px)", minWidth: 0,
        maxHeight: "calc(100dvh - 120px)", overflowX: "hidden", overflowY: "auto",
        padding: 12, margin: "-12px 0 -12px -12px",
      }}>
        <Panel icon={<Headphones size={17} />} title={t("test.panel.title")} pad={20}>
          <VoiceTestPanel {...card} />
        </Panel>
      </aside>
    </div>
  ) : body;

  const tab = (
    <VoiceGenderProvider value={voiceGender(effectiveVoice(line.voice, line.agentGender))}>
      <SectionLayout
        stacked={stacked}
        testId="voice-tab"
        rail={(layout) => <VoiceRail line={line} sections={sections} active={section} onSelect={setSection} layout={layout} />}
      >
        {content}
      </SectionLayout>
    </VoiceGenderProvider>
  );
  // Only where a test can be made (Prompt & test, the Owner's): the call hooks stay off the other views.
  return testable ? <VoiceTestProvider line={line} column={wideTest}>{tab}</VoiceTestProvider> : tab;
}
