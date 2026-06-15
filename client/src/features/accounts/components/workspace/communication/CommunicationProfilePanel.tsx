import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessagesSquare } from "lucide-react";
import { Panel, EditButton } from "../atoms";
import { useCommunicationProfile } from "./useCommunicationProfile";
import { useOnboardingFacts, type QAGrids } from "./useOnboardingFacts";
import { ProfileWizard } from "./ProfileWizard";
import { ProfileSummary } from "./ProfileSummary";
import { EMPTY_ANSWERS, type ProfileAnswers, type FactValues } from "./profileConstants";

export function CommunicationProfilePanel({ accountId, fill = true }: { accountId: number; fill?: boolean }) {
  const { t } = useTranslation("communicationProfile");
  const { profile, loading, saving, save } = useCommunicationProfile(accountId);
  const { values: factValues, grids, loading: factsLoading, saveAll } = useOnboardingFacts(accountId);
  const [editing, setEditing] = useState(false);
  const [startStep, setStartStep] = useState(0);

  const completed = profile?.status === "completed";
  const showSummary = completed && !editing;

  const openEditAt = (stepIndex: number) => { setStartStep(stepIndex); setEditing(true); };

  const handleFinish = async (answers: ProfileAnswers, facts: FactValues, qaGrids: QAGrids) => {
    await saveAll(facts, qaGrids);
    const ok = await save(answers, "completed");
    if (ok) setEditing(false);
  };

  return (
    <Panel
      icon={<MessagesSquare size={18} />}
      title={t("panel.title")}
      action={showSummary ? <EditButton label={t("summary.edit")} onClick={() => openEditAt(0)} /> : undefined}
      style={fill ? { height: "100%" } : undefined}
    >
      {loading || factsLoading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--mute-2)", fontSize: 13 }}>…</div>
      ) : showSummary ? (
        <ProfileSummary answers={profile!.answers} facts={factValues} grids={grids} onEditStep={openEditAt} />
      ) : (
        <ProfileWizard
          initial={profile?.answers ?? { ...EMPTY_ANSWERS }}
          initialFacts={factValues}
          initialGrids={grids}
          initialStep={startStep}
          saving={saving}
          onFinish={handleFinish}
          bodyMaxHeight={fill ? undefined : 460}
        />
      )}
    </Panel>
  );
}
