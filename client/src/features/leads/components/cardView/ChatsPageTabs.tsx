// Chats page tabs, mirroring Calls: [chart] Stats · [chat] Chats.
import { useTranslation } from "react-i18next";
import { ChartColumn, MessageSquare, type LucideIcon } from "lucide-react";
import { MobileTabSeg } from "@/components/crm/mobile/MobileListHeader";

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
    <div className="la-seg shrink-0" role="tablist" aria-label={t("chatsTabs.aria")} data-testid="chats-page-tabs">
      {CHATS_TABS.map((id) => {
        const Icon = ICONS[id];
        return (
          <button key={id} type="button" role="tab" aria-selected={active === id} data-testid={`chats-tab-${id}`}
            className={`la-seg-btn${active === id ? " on" : ""}`} style={{ padding: "8px 13px", fontSize: 10, letterSpacing: "0.12em" }}
            onClick={() => onChange(id)}>
            <Icon size={13} className="shrink-0" />
            {t(`chatsTabs.${id}`)}
          </button>
        );
      })}
    </div>
  );
}
