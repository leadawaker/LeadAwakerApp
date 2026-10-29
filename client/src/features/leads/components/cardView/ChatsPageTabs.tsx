// The Chats page's way into its settings, mirroring Calls: a "Chat settings" button (gear) in the
// topbar, and inside the settings a "Chats" back button (arrow). The figures live on Home (/platform/home).
import { useTranslation } from "react-i18next";
import { ArrowLeft, Settings } from "lucide-react";
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
  const Icon = inSettings ? ArrowLeft : Settings;
  return (
    <button
      type="button"
      onClick={go}
      className={`la-btn ${inSettings ? "la-btn--soft" : "la-btn--wine"} shrink-0`}
      data-testid={inSettings ? "chats-back" : "chats-open-settings"}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}
