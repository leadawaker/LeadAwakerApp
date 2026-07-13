import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessagesSquare, CheckCircle2, Pencil } from "lucide-react";
import { Panel } from "../atoms";
import { useCommunicationProfile } from "./useCommunicationProfile";
import { useOnboardingFacts, type QAGrids } from "./useOnboardingFacts";
import { ProfileWizard } from "./ProfileWizard";
import { ProfileSummary } from "./ProfileSummary";
import { EMPTY_ANSWERS, recommendStatus, recommendedDefaults, type ProfileAnswers, type FactValues } from "./profileConstants";

export function CommunicationProfilePanel({ accountId, niche, accountName, accountLogoUrl, fill = true, fillHeight = false, readOnly = false }: { accountId: number; niche?: string | null; accountName?: string; accountLogoUrl?: string | null; fill?: boolean; fillHeight?: boolean; readOnly?: boolean }) {
  const { t } = useTranslation("communicationProfile");
  const { profile, loading, saving, save } = useCommunicationProfile(accountId);
  const { values: factValues, grids, loading: factsLoading, saveAll } = useOnboardingFacts(accountId);
  const [editing, setEditing] = useState(false);
  const [startStep, setStartStep] = useState(0);
  const [celebrate, setCelebrate] = useState(false);

  const exists = profile !== null;
  const showSummary = exists && !editing;

  const openEditAt = (stepIndex: number) => { setStartStep(stepIndex); setEditing(true); };

  const handleFinish = async (answers: ProfileAnswers, facts: FactValues, qaGrids: QAGrids) => {
    const finalAnswers = { ...answers, statusQuestion: recommendStatus(answers.openingStyle) };
    await saveAll(facts, qaGrids);
    const ok = await save(finalAnswers, "completed");
    if (ok) { setEditing(false); setCelebrate(true); }
  };

  const handleClose = async (answers: ProfileAnswers, facts: FactValues, qaGrids: QAGrids) => {
    const finalAnswers = { ...answers, statusQuestion: recommendStatus(answers.openingStyle) };
    await saveAll(facts, qaGrids);
    await save(finalAnswers, "in_progress");
    setEditing(false);
  };

  return (
    <Panel
      icon={<MessagesSquare size={18} />}
      title={t("panel.title")}
      action={showSummary && !readOnly ? (
        <button className="la-btn la-btn--soft" onClick={() => openEditAt(0)}>
          <Pencil size={12} />{t("summary.edit")}
        </button>
      ) : undefined}
      style={(fill || fillHeight) ? { height: "100%" } : undefined}
      bodyStyle={fillHeight ? { overflowY: "auto", minHeight: 0 } : undefined}
    >
      {loading || factsLoading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--mute-2)", fontSize: 13 }}>…</div>
      ) : celebrate ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "48px 24px", gap: 14, minHeight: 240 }}>
          <span className="neu-raised" style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--wine-tint)", color: "var(--wine)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle2 size={34} strokeWidth={2} />
          </span>
          <h3 className="serif" style={{ margin: 0, fontSize: 24, color: "var(--ink)", lineHeight: 1.2 }}>{t("done.title")}</h3>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--mute)", lineHeight: 1.5, maxWidth: 320 }}>{t("done.subtitle")}</p>
          <div className="neu-inset" style={{ textAlign: "left", padding: "16px 18px", borderRadius: 12, maxWidth: 420, width: "100%" }}>
            <div className="eyebrow eyebrow-sm" style={{ marginBottom: 10 }}>{t("done.nextSteps.title")}</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--mute)", lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 6 }}>
              <li>{t("done.nextSteps.step1")}</li>
              <li>{t("done.nextSteps.step2")}</li>
              <li>{t("done.nextSteps.step3")}</li>
              <li>{t("done.nextSteps.step4")}</li>
            </ol>
          </div>
          <button className="la-btn la-btn--wine" style={{ marginTop: 6 }} onClick={() => setCelebrate(false)}>{t("done.button")}</button>
        </div>
      ) : showSummary ? (
        <ProfileSummary answers={profile!.answers} facts={factValues} grids={grids} onEditStep={readOnly ? undefined : openEditAt} />
      ) : readOnly ? (
        <div style={{ padding: "24px 0", textAlign: "center", color: "var(--mute-2)", fontSize: 12.5, fontStyle: "italic" }}>No profile set up yet.</div>
      ) : (
        <ProfileWizard
          accountId={accountId}
          initial={profile?.answers ?? { ...EMPTY_ANSWERS, ...recommendedDefaults(niche) }}
          initialFacts={factValues}
          initialGrids={grids}
          initialStep={startStep}
          saving={saving}
          niche={niche}
          accountName={accountName}
          accountLogoUrl={accountLogoUrl}
          showPreview={fill}
          prefillWords={!exists}
          onFinish={handleFinish}
          onClose={handleClose}
          bodyMaxHeight={(fill || fillHeight) ? undefined : 460}
        />
      )}
    </Panel>
  );
}
