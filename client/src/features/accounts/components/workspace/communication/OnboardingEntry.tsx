// The way into the onboarding wizard from the account's Overview. Onboarding
// is a one-off call, so it is a button here instead of a tab of its own.
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList } from "lucide-react";

/** Not done yet: a raised card that asks for it. Done: a quiet inset row to reopen it. */
export function OnboardingEntry({ onOpen, done = false }: { onOpen: () => void; done?: boolean }) {
  const { t } = useTranslation("accounts");
  return (
    <div
      className={done ? "neu-inset-crisp" : "neu-raised"}
      style={{ borderRadius: "var(--r-card)", background: done ? undefined : "var(--card)", padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}
      data-testid="onboarding-entry"
    >
      {done ? <CheckCircle2 size={18} style={{ color: "var(--good)", flexShrink: 0 }} /> : <ClipboardList size={18} style={{ color: "var(--wine)", flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{t(done ? "onboardingEntry.doneTitle" : "onboardingEntry.title")}</div>
        <div style={{ fontSize: 12.5, color: "var(--mute)", marginTop: 2 }}>{t(done ? "onboardingEntry.doneHelp" : "onboardingEntry.help")}</div>
      </div>
      <button type="button" className={`la-btn ${done ? "la-btn--soft" : "la-btn--wine"}`} onClick={onOpen} data-testid="onboarding-open">
        {t(done ? "onboardingEntry.reopen" : "onboardingEntry.open")} <ArrowRight size={13} />
      </button>
    </div>
  );
}

export function BackToOverview({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation("accounts");
  return (
    <button type="button" className="la-btn la-btn--soft" onClick={onBack} style={{ alignSelf: "flex-start" }} data-testid="onboarding-back">
      <ArrowLeft size={13} /> {t("onboardingEntry.back")}
    </button>
  );
}
