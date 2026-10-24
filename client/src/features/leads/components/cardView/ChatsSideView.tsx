// The Chats page without its chat list: Settings (the chat receptionist's
// settings for one account, ?view=settings). Same topbar as the list: the page
// title and the Chats · Settings tabs.
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { MobileListHeader } from "@/components/crm/mobile/MobileListHeader";
import { useIsMobile } from "@/hooks/useIsMobile";
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
  // Settings on a desktop: the agency's account picker sits in the topbar, right after the tabs.
  // On a phone it keeps its own row above the sections (the phone header has no room for it).
  const [pickerSlot, setPickerSlot] = useState<HTMLElement | null>(null);
  return (
    <div className="flex flex-col h-full" data-onboarding="leads-table">
      {isPhone ? (
        <MobileListHeader title={t("page.chatsTitle")} tabSwitcher={<ChatsPageTabs variant="mobile" active={tab} onChange={onTab} />} />
      ) : (
        <div className="shrink-0 flex items-center gap-3" style={{ height: 60, borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--surface)", paddingLeft: 17, paddingRight: 17 }}>
          <span className="serif" style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em" }}>{t("page.chatsTitle")}</span>
          <ChatsPageTabs active={tab} onChange={onTab} />
          {tab === "settings" && <span ref={setPickerSlot} style={{ display: "contents" }} data-testid="chats-settings-picker-slot" />}
        </div>
      )}
      <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
        <ReceptionistSettings channel="chat" fallbackAccountId={fallbackAccountId} pickerSlot={isPhone ? undefined : pickerSlot} />
      </Suspense>
    </div>
  );
}
