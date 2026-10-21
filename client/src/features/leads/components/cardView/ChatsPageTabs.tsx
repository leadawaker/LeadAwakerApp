// Chats page tabs, mirroring Calls: [chart] Stats · [chat] Chats.
import { useTranslation } from "react-i18next";
import { ChartColumn, MessageSquare, type LucideIcon } from "lucide-react";
import { MobileTabSeg } from "@/components/crm/mobile/MobileListHeader";
import { PillSwitch } from "@/components/crm/primitives/PillSwitch";

export type ChatsTab = "stats" | "chats";
export const CHATS_TABS: ChatsTab[] = ["stats", "chats"];
export const CHATS_LAST_TAB_PAGE = "chats";
const ICONS: Record<ChatsTab, LucideIcon> = { stats: ChartColumn, chats: MessageSquare };

export function ChatsPageTabs({ active, onChange, variant = "topbar" }: { active: ChatsTab; onChange: (tab: ChatsTab) => void; variant?: "topbar" | "mobile" }) {
  const { t } = useTranslation("leads");
  if (variant === "mobile") {
    return <MobileTabSeg tabs={CHATS_TABS.map((id) => ({ id, label: t(`chatsTabs.${id}`), icon: ICONS[id] }))} activeId={active} onChange={onChange} />;
  }
  return (
    <PillSwitch<ChatsTab>
      items={CHATS_TABS.map((id) => ({ id, label: t(`chatsTabs.${id}`), icon: ICONS[id], color: "var(--wine)" }))}
      value={active}
      onChange={onChange}
      ariaLabel={t("chatsTabs.aria")}
      testId="chats-page-tabs"
      itemTestId={(id) => `chats-tab-${id}`}
    />
  );
}
