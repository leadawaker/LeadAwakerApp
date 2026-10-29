// The Chats page without its chat list: Chat settings (the chat receptionist's
// settings for one account, ?view=settings). Topbar: the title, a "Chats" back
// button, the agency's account picker, and (agency) a link to the account's
// Reactivation settings, which live on Accounts > Reactivation.
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { RefreshCw } from "lucide-react";
import { MobileHeaderIconBtn, MobileListHeader } from "@/components/crm/mobile/MobileListHeader";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useWorkspace } from "@/hooks/useWorkspace";
import { readSettingsParams } from "@/features/accounts/components/workspace/receptionist/settingsLink";
import { openAccountReactivation } from "@/features/accounts/components/workspace/reactivation/reactivationLink";
import { ChatsPageTabs, type ChatsTab } from "./ChatsPageTabs";

const ReceptionistSettings = lazy(() => import("@/features/accounts/components/workspace/receptionist/ReceptionistSettings").then((m) => ({ default: m.ReceptionistSettings })));

export function ChatsSideView({ tab, onTab, fallbackAccountId }: {
  tab: Exclude<ChatsTab, "chats">;
  onTab: (tab: ChatsTab) => void;
  /** Agency: the account the chat list is filtered to, used by Settings before the nav bar's account. */
  fallbackAccountId?: number;
}) {
  const { t } = useTranslation("leads");
  const isPhone = useIsMobile(768);
  const { isAgencyUser, currentAccountId } = useWorkspace();
  const [, setLocation] = useLocation();
  // Settings on a desktop: the agency's account picker sits in the topbar, right after the back button.
  // On a phone it keeps its own row above the sections (the phone header has no room for it).
  const [pickerSlot, setPickerSlot] = useState<HTMLElement | null>(null);
  // The account on screen: ReceptionistSettings keeps it in the address bar (&account=), read at click time.
  const openReactivation = () => {
    const shown = readSettingsParams(window.location.search).accountId ?? fallbackAccountId ?? (currentAccountId > 0 ? currentAccountId : undefined);
    openAccountReactivation(setLocation, shown);
  };
  const reactivationLabel = t("chatsTabs.reactivationSettings");
  return (
    <div className="flex flex-col h-full" data-onboarding="leads-table">
      {isPhone ? (
        <MobileListHeader
          title={t("chatsTabs.settingsTitle")}
          tabSwitcher={(
            <>
              {isAgencyUser && (
                <MobileHeaderIconBtn onClick={openReactivation} aria-label={reactivationLabel} title={reactivationLabel} data-testid="chats-reactivation-link">
                  <RefreshCw size={16} />
                </MobileHeaderIconBtn>
              )}
              <ChatsPageTabs variant="mobile" active={tab} onChange={onTab} />
            </>
          )}
        />
      ) : (
        <div className="la-page-header" style={{ gap: 12, padding: "0 17px" }}>
          <span className="la-page-title">{t("chatsTabs.settingsTitle")}</span>
          <ChatsPageTabs active={tab} onChange={onTab} />
          {tab === "settings" && <span ref={setPickerSlot} style={{ display: "contents" }} data-testid="chats-settings-picker-slot" />}
          <div className="flex-1 min-w-0" />
          {isAgencyUser && (
            <button type="button" onClick={openReactivation} className="la-btn la-btn--soft shrink-0" data-testid="chats-reactivation-link">
              <RefreshCw className="h-4 w-4 shrink-0" />
              {reactivationLabel}
            </button>
          )}
        </div>
      )}
      <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
        <ReceptionistSettings channel="chat" fallbackAccountId={fallbackAccountId} pickerSlot={isPhone ? undefined : pickerSlot} />
      </Suspense>
    </div>
  );
}
