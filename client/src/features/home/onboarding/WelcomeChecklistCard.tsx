import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Check, ChevronRight, X } from "lucide-react";
import { SectionCard } from "@/components/crm/primitives";
import { IconBtn } from "@/components/ui/icon-btn";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useVoiceCapabilities } from "@/features/voiceCalls/api/voiceCallsApi";
import { useChatCampaign, receptionistCampaignId } from "@/features/accounts/components/workspace/chat/useChatCampaign";
import type { ChecklistKey } from "./checklist";
import { useOnboarding } from "./useOnboarding";

export function WelcomeChecklistCard() {
  const { t } = useTranslation("home");
  const [, setLocation] = useLocation();
  const { currentAccount } = useWorkspace();
  const { data: caps } = useVoiceCapabilities();
  const { campaign } = useChatCampaign(receptionistCampaignId(currentAccount?.inbound_campaign_id, null));
  const { checklist, ready, markVisited, markInstalled, dismiss } = useOnboarding();
  const [installOpen, setInstallOpen] = useState(false);

  if (!ready || !checklist.visible) return null;

  let firstName = "";
  try { firstName = (localStorage.getItem("leadawaker_user_name") || "").trim().split(/\s+/)[0] || ""; } catch { /* ignore */ }
  const agentName = String(campaign?.agent_name ?? "").trim() || t("onboarding.yourReceptionist");
  const company = currentAccount?.name ?? "";

  const go = (key: ChecklistKey) => {
    if (key === "details") setLocation("/platform/accounts");
    else if (key === "alerts") setLocation("/platform/settings?tab=alerts");
    else if (key === "call") {
      // Without live voice there is no call to open: opening Leads counts as the visit.
      if (!caps?.live) void markVisited("call");
      setLocation(caps?.live ? "/platform/voice-calls" : "/platform/contacts");
    }
    else setInstallOpen((v) => !v);
  };

  return (
    <SectionCard className="relative" data-testid="welcome-checklist">
      <IconBtn onClick={() => void dismiss()} aria-label={t("onboarding.close")} data-testid="welcome-checklist-close"
        className="absolute right-3 top-3">
        <X size={16} />
      </IconBtn>
      <h2 className="pr-8 text-[18px] font-bold" style={{ margin: 0, color: "var(--ink)" }}>
        {firstName ? t("onboarding.welcome", { firstName, agentName, company }) : t("onboarding.welcomeNoName", { agentName, company })}
      </h2>
      <p className="mt-2 text-[13px]" style={{ color: "var(--ink-soft)", margin: "8px 0 0" }}>{t("onboarding.where1", { calls: t("crm:sidebar.calls"), chats: t("crm:sidebar.chats"), calendar: t("crm:sidebar.calendar") })}</p>
      <p className="text-[13px]" style={{ color: "var(--ink-soft)", margin: "2px 0 0" }}>{t("onboarding.where2")}</p>
      <button type="button" onClick={() => setLocation("/platform/docs")} className="mt-2 text-[13px] font-semibold underline" style={{ color: "var(--ink)" }}>
        {t("onboarding.guide")}
      </button>

      <ul className="mt-4 flex flex-col gap-1" style={{ listStyle: "none", padding: 0, margin: "16px 0 0" }}>
        {checklist.items.map(({ key, done }) => (
          <li key={key}>
            <button type="button" onClick={() => go(key)} data-testid={`welcome-item-${key}`}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-[var(--r-button)] px-2 text-left hover:bg-[var(--bg-soft,transparent)]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                style={{ borderColor: "var(--ink-soft)", background: done ? "var(--ink)" : "transparent", color: "var(--bg)" }}>
                {done && <Check size={12} />}
              </span>
              <span className="flex-1 text-[14px]" style={{ color: done ? "var(--ink-soft)" : "var(--ink)", textDecoration: done ? "line-through" : "none" }}>
                {t(`onboarding.items.${key}`, { account: t("crm:sidebar.myReceptionist") })}
              </span>
              <ChevronRight size={16} style={{ color: "var(--ink-soft)" }} />
            </button>
            {key === "install" && installOpen && !done && (
              <div className="mb-2 ml-10 flex flex-col gap-1 text-[13px]" style={{ color: "var(--ink-soft)" }}>
                <p style={{ margin: 0 }}><strong>iOS Safari:</strong> {t("onboarding.installIos")}</p>
                <p style={{ margin: 0 }}><strong>Android Chrome:</strong> {t("onboarding.installAndroid")}</p>
                <button type="button" onClick={() => void markInstalled()} data-testid="welcome-install-done"
                  className="mt-1 self-start rounded-[var(--r-button)] px-3 py-1.5 text-[13px] font-semibold"
                  style={{ background: "var(--ink)", color: "var(--bg)" }}>
                  {t("onboarding.done")}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
