// Calls page tabs, mirroring Chats: [audio] Calls · [gear] Settings, then (agency) People · All calls.
// The figures moved to the Stats page (/platform/home).
import { useTranslation } from "react-i18next";
import { AudioLines, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileTabSeg } from "@/components/crm/mobile/MobileListHeader";
import { PillSwitch } from "@/components/crm/primitives/PillSwitch";
import type { CallsTab } from "../callers";
import { CALLS_TAB_ICON, type CallsPageView } from "./callsTabs";

type PageTab = "list" | "settings";

/** Calls | Settings, the same pill switch as the Chats page. "Calls" opens the list tab used last. */
export function CallsPageTabs({ view, listView, onView }: { view: CallsPageView; listView: CallsTab; onView: (v: CallsPageView) => void }) {
  const { t } = useTranslation("voiceCalls");
  return (
    <PillSwitch<PageTab>
      items={[
        { id: "list", label: t("pageTabs.calls"), icon: AudioLines, color: "var(--wine)" },
        { id: "settings", label: t("pageTabs.settings"), icon: Settings, color: "var(--wine)" },
      ]}
      value={view === "settings" ? "settings" : "list"}
      onChange={(id) => onView(id === "list" ? listView : id)}
      ariaLabel={t("pageTabs.aria")}
      testId="calls-page-tabs"
      itemTestId={(id) => `voice-view-${id}`}
    />
  );
}

/** People · All calls (agency only; clients have one list), drawn like the Chats channel tabs. */
export function CallsListTabs({ tabs, view, onView }: { tabs: CallsTab[]; view: CallsPageView; onView: (v: CallsTab) => void }) {
  const { t } = useTranslation("voiceCalls");
  const list = tabs;
  if (list.length < 2 || view === "settings") return null;
  return (
    <div className="la-seg shrink-0" role="tablist" aria-label={t("callers.view.aria")}>
      {list.map((v) => {
        const Icon = CALLS_TAB_ICON[v];
        return (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            data-testid={`voice-view-${v}`}
            className={cn("la-seg-btn", view === v && "on")}
            style={{ padding: "8px 13px", fontSize: 10, letterSpacing: "0.12em" }}
            onClick={() => onView(v)}
          >
            <Icon size={13} />
            {t(`tabs.${v}`)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Phone: one segmented row. Clients see Calls; the agency keeps People and All calls apart.
 * Settings closes the row as a gear without a label, so the row still fits a phone.
 */
export function CallsMobileTabs({ tabs, view, onView }: { tabs: CallsTab[]; view: CallsPageView; onView: (v: CallsPageView) => void }) {
  const { t } = useTranslation("voiceCalls");
  const oneList = !tabs.includes("calls");
  const settings = t("pageTabs.settings");
  return (
    <MobileTabSeg<CallsPageView>
      tabs={[
        ...tabs.map((v) => ({ id: v, label: oneList && v === "people" ? t("pageTabs.calls") : t(`tabs.${v}`), icon: oneList && v === "people" ? AudioLines : CALLS_TAB_ICON[v] })),
        { id: "settings", label: "", iconNode: <span className="flex items-center" role="img" aria-label={settings} title={settings}><Settings size={14} /></span> },
      ]}
      activeId={view}
      onChange={onView}
    />
  );
}
