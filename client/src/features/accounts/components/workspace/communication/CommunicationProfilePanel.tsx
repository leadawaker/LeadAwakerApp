import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessagesSquare, CheckCircle2, Pencil } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { Panel } from "../atoms";
import { useCommunicationProfile } from "./useCommunicationProfile";
import { useOnboardingFacts, type QAGrids } from "./useOnboardingFacts";
import { ProfileWizard } from "./ProfileWizard";
import { ProfileSummary, type BookingSnapshot } from "./ProfileSummary";
import { EMPTY_ANSWERS, recommendStatus, recommendedDefaults, type ProfileAnswers, type FactValues } from "./profileConstants";

export function CommunicationProfilePanel({ accountId, niche, accountName, accountLogoUrl, fill = true, fillHeight = false, readOnly = false, onWizardActiveChange }: { accountId: number; niche?: string | null; accountName?: string; accountLogoUrl?: string | null; fill?: boolean; fillHeight?: boolean; readOnly?: boolean; onWizardActiveChange?: (active: boolean) => void }) {
  const { t } = useTranslation("communicationProfile");
  const { profile, loading, saving, save } = useCommunicationProfile(accountId);
  const { values: factValues, grids, loading: factsLoading, saveAll } = useOnboardingFacts(accountId);
  const [editing, setEditing] = useState(false);
  const [startStep, setStartStep] = useState(0);
  const [celebrate, setCelebrate] = useState(false);

  const exists = profile !== null;
  const showSummary = exists && !editing;

  // Account-level answers (availability + meeting type) live on the Accounts
  // table, not the profile row — the wizard's custom steps PATCH them directly.
  // Fetched whenever the summary (re)shows so it reflects in-wizard edits.
  const [booking, setBooking] = useState<BookingSnapshot | null>(null);
  useEffect(() => {
    if (!showSummary) return;
    let cancelled = false;
    apiFetch(`/api/accounts/${accountId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setBooking({
          meetingType: data.meeting_type ?? null,
          callingNumber: data.calling_number ?? null,
          openDays: Array.isArray(data.open_days) ? data.open_days : null,
          start: data.business_hours_start ?? null,
          end: data.business_hours_end ?? null,
          durationMinutes: data.default_call_duration_minutes ?? null,
          noticeHours: data.min_booking_notice_hours ?? null,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [accountId, showSummary]);

  // Tell the parent when the wizard itself is on screen (used to hide the
  // Company Intel panel below so the onboarding call stays focused).
  const wizardActive = !readOnly && !loading && !factsLoading && !celebrate && !showSummary;
  useEffect(() => {
    onWizardActiveChange?.(wizardActive);
    return () => onWizardActiveChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardActive]);

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
        <ProfileSummary answers={profile!.answers} facts={factValues} grids={grids} booking={booking} onEditStep={readOnly ? undefined : openEditAt} />
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
