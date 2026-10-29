// Calls page navigation: a "Call settings" button in the topbar (a "Calls" back button inside settings; phones: as on Chats);
// People | All calls is the page's main tab switcher: a solid pill switch after the topbar title (phones: the topbar's second row).
import { useTranslation } from "react-i18next";
import { ArrowLeft, Settings } from "lucide-react";
import { PillSwitch } from "@/components/crm/primitives/PillSwitch";
import { MobileHeaderIconBtn } from "@/components/crm/mobile/MobileListHeader";
import type { CallsTab } from "../callers";
import { CALLS_TAB_ICON, type CallsPageView } from "./callsTabs";

/**
 * List view: "Call settings" (gear). Settings: "Calls" (arrow), back to the list tab used last.
 * `mobile`: the phone header's look, as on Chats: a round gear on the list, a labelled "Calls" pill in settings.
 */
export function CallsSettingsButton({ view, listView, onView, variant = "topbar" }: { view: CallsPageView; listView: CallsTab; onView: (v: CallsPageView) => void; variant?: "topbar" | "mobile" }) {
  const { t } = useTranslation("voiceCalls");
  const inSettings = view === "settings";
  if (variant === "mobile") {
    if (!inSettings) {
      const label = t("pageTabs.callSettings");
      return (
        <MobileHeaderIconBtn onClick={() => onView("settings")} aria-label={label} title={label} data-testid="voice-view-settings">
          <Settings size={16} />
        </MobileHeaderIconBtn>
      );
    }
    return (
      <MobileHeaderIconBtn onClick={() => onView(listView)} aria-label={t("pageTabs.calls")} data-testid="voice-view-back"
        style={{ width: "auto", padding: "0 15px 0 12px", gap: 7, fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
        <ArrowLeft size={16} />
        {t("pageTabs.calls")}
      </MobileHeaderIconBtn>
    );
  }
  if (inSettings) {
    return (
      <button
        type="button"
        className="la-btn la-btn--soft shrink-0"
        onClick={() => onView(listView)}
        data-testid="voice-view-back"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" />
        {t("pageTabs.calls")}
      </button>
    );
  }
  return (
    <button
      type="button"
      className="la-btn la-btn--wine shrink-0"
      onClick={() => onView("settings")}
      data-testid="voice-view-settings"
    >
      <Settings className="h-4 w-4 shrink-0" />
      {t("pageTabs.callSettings")}
    </button>
  );
}

/**
 * People · All calls, the page's main tabs, as a solid raised pill switch (PillSwitch default): in the desktop topbar right after
 * the page title (sized like the topbar tabs there), and on phones the topbar's second row (`fill`: full width).
 */
export function CallsListTabs({ tabs, view, onView, fill = false }: { tabs: CallsTab[]; view: CallsTab; onView: (v: CallsTab) => void; fill?: boolean }) {
  const { t } = useTranslation("voiceCalls");
  if (tabs.length < 2) return null;
  const pills = (
    <PillSwitch<CallsTab>
      items={tabs.map((v) => ({ id: v, label: t(`tabs.${v}`), icon: CALLS_TAB_ICON[v] }))}
      value={view}
      onChange={onView}
      ariaLabel={t("callers.view.aria")}
      testId="voice-list-tabs"
      itemTestId={(v) => `voice-view-${v}`}
      className={fill ? "la-seg--fill" : undefined}
    />
  );
  return fill ? <div style={{ flex: 1, minWidth: 0 }}>{pills}</div> : pills;
}
