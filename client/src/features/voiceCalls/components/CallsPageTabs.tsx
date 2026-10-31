// Calls page navigation: Calls | Call settings in the desktop topbar (phones: a gear, as on Chats);
// People | All calls filter the list, so they head the list panel beside the scope switch (phones: the topbar's second row).
import { useTranslation } from "react-i18next";
import { ArrowLeft, AudioLines, Settings } from "lucide-react";
import { PillSwitch } from "@/components/crm/primitives/PillSwitch";
import { MobileHeaderIconBtn } from "@/components/crm/mobile/MobileListHeader";
import type { CallsTab } from "../callers";
import { CALLS_TAB_ICON, type CallsPageView } from "./callsTabs";

/**
 * Calls | Call settings, the page's main tabs in the desktop topbar. "Calls" goes back to the list tab used last.
 */
export function CallsViewTabs({ view, listView, onView }: { view: CallsPageView; listView: CallsTab; onView: (v: CallsPageView) => void }) {
  const { t } = useTranslation("voiceCalls");
  return (
    <PillSwitch<"list" | "settings">
      items={[
        { id: "list", label: t("pageTabs.calls"), icon: AudioLines },
        { id: "settings", label: t("pageTabs.callSettings"), icon: Settings },
      ]}
      value={view === "settings" ? "settings" : "list"}
      onChange={(id) => onView(id === "settings" ? "settings" : listView)}
      ariaLabel={t("callers.view.aria")}
      testId="voice-page-tabs"
      itemTestId={(id) => (id === "settings" ? "voice-view-settings" : "voice-view-back")}
    />
  );
}

/** The phone header's way in and out of settings: a round gear on the list, a labelled "Calls" pill in settings. */
export function CallsSettingsButton({ view, listView, onView }: { view: CallsPageView; listView: CallsTab; onView: (v: CallsPageView) => void }) {
  const { t } = useTranslation("voiceCalls");
  if (view !== "settings") {
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

/**
 * People · All calls. Desktop (`soft`): the soft pill at the top of the list panel, as Demos' Category | Date, filling
 * the row. Phones (`fill`): a solid pill, the topbar's second row.
 */
export function CallsListTabs({ tabs, view, onView, fill = false, soft = false }: { tabs: CallsTab[]; view: CallsTab; onView: (v: CallsTab) => void; fill?: boolean; soft?: boolean }) {
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
      variant={soft ? "soft" : "solid"}
      className={fill || soft ? "la-seg--fill" : undefined}
    />
  );
  return fill || soft ? <div style={{ flex: 1, minWidth: 0 }}>{pills}</div> : pills;
}
