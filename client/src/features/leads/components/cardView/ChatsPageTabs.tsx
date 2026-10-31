// The Chats page's main tabs, mirroring Calls: Chats | Chat settings in the topbar (phones: a gear,
// and a "Chats" back pill inside the settings). The figures live on Home (/platform/home).
import { useTranslation } from "react-i18next";
import { ArrowLeft, MessagesSquare, Settings } from "lucide-react";
import { PillSwitch } from "@/components/crm/primitives/PillSwitch";
import { MobileHeaderIconBtn } from "@/components/crm/mobile/MobileListHeader";

export type ChatsTab = "chats" | "settings";
export const CHATS_TABS: ChatsTab[] = ["chats", "settings"];

export function ChatsPageTabs({ active, onChange, variant = "topbar" }: { active: ChatsTab; onChange: (tab: ChatsTab) => void; variant?: "topbar" | "mobile" }) {
  const { t } = useTranslation("leads");
  const inSettings = active === "settings";
  const label = inSettings ? t("chatsTabs.back") : t("chatsTabs.openSettings");
  const go = () => onChange(inSettings ? "chats" : "settings");
  if (variant === "mobile") {
    // Phone header: a round gear on the list; in the settings a labelled pill back to the chats.
    if (!inSettings) {
      return (
        <MobileHeaderIconBtn onClick={go} aria-label={label} title={label} data-testid="chats-open-settings">
          <Settings size={16} />
        </MobileHeaderIconBtn>
      );
    }
    return (
      <MobileHeaderIconBtn onClick={go} aria-label={label} data-testid="chats-back"
        style={{ width: "auto", padding: "0 15px 0 12px", gap: 7, fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
        <ArrowLeft size={16} />
        {label}
      </MobileHeaderIconBtn>
    );
  }
  return (
    <PillSwitch<ChatsTab>
      items={[
        { id: "chats", label: t("chatsTabs.chats"), icon: MessagesSquare },
        { id: "settings", label: t("chatsTabs.openSettings"), icon: Settings },
      ]}
      value={active}
      onChange={onChange}
      ariaLabel={t("chatsTabs.aria")}
      itemTestId={(id) => (id === "settings" ? "chats-open-settings" : "chats-back")}
    />
  );
}
