// Chats page tabs, mirroring Calls: [chat] Chats · [gear] Settings. The figures live on the Stats page (/platform/home).
import { useTranslation } from "react-i18next";
import { MessageSquare, Settings, type LucideIcon } from "lucide-react";
import { MobileTabSeg } from "@/components/crm/mobile/MobileListHeader";
import { PillSwitch } from "@/components/crm/primitives/PillSwitch";

export type ChatsTab = "chats" | "settings";
export const CHATS_TABS: ChatsTab[] = ["chats", "settings"];
/** The tabs the page reopens on next time (both: leaving from Settings comes back to Settings). A remembered old "stats" opens Chats. */
export const CHATS_REMEMBERED_TABS: ChatsTab[] = ["chats", "settings"];
export const CHATS_LAST_TAB_PAGE = "chats";
const ICONS: Record<ChatsTab, LucideIcon> = { chats: MessageSquare, settings: Settings };

export function ChatsPageTabs({ active, onChange, variant = "topbar" }: { active: ChatsTab; onChange: (tab: ChatsTab) => void; variant?: "topbar" | "mobile" }) {
  const { t } = useTranslation("leads");
  if (variant === "mobile") {
    // Beside the title, search and filter buttons on a phone: only the open tab is labelled, the others are icons.
    return (
      <MobileTabSeg<ChatsTab>
        tabs={CHATS_TABS.map((id) => {
          const label = t(`chatsTabs.${id}`);
          const Icon = ICONS[id];
          return id === active
            ? { id, label, icon: Icon }
            : { id, label: "", iconNode: <span className="flex items-center" role="img" aria-label={label} title={label}><Icon size={14} /></span> };
        })}
        activeId={active}
        onChange={onChange}
      />
    );
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
