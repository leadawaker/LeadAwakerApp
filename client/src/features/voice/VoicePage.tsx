import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Inbox, BarChart3, Settings as SettingsIcon, CalendarDays, ChevronDown } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useLastTab } from "@/hooks/useLastTab";
import { PageTopbar, TopbarTabs, ExpandingSearch } from "@/components/crm/primitives";
import { getVoiceViews, VoiceInbox, VoiceInboxTopControls } from "./components/inbox";
import { VoiceDashboard } from "./components/dashboard";
import { VoiceSettings } from "./components/settings";
import { VOICE_DASH } from "./data";

const TABS = [
  { key: "inbox", Icon: Inbox },
  { key: "dashboard", Icon: BarChart3 },
  { key: "settings", Icon: SettingsIcon },
] as const;

type Tab = (typeof TABS)[number]["key"];
const TAB_KEYS: readonly Tab[] = TABS.map((x) => x.key);

function VoiceContent() {
  const { t } = useTranslation("accounts");
  const { t: tc } = useTranslation("crm");
  const [tab, setTab] = useLastTab<Tab>("missedCalls", TAB_KEYS, "inbox");
  const [selection, setSelection] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState("all");

  const views = useMemo(() => getVoiceViews(), []);

  return (
    <div className="la-page" style={{ display: "flex", flexDirection: "column" }}>
      {/* Topbar */}
      <PageTopbar
        title={tc("sidebar.missedCalls")}
        left={<>
          <TopbarTabs
            tabs={TABS.map((x) => ({ id: x.key, label: t(`servicePages.tabs.${x.key}`), icon: x.Icon }))}
            value={tab}
            onChange={setTab}
          />
          {tab === "inbox" && <VoiceInboxTopControls views={views} view={view} setView={setView} />}
        </>}
        right={<>
          {tab === "inbox" && (
            <ExpandingSearch value={query} onChange={setQuery} placeholder={t("servicePages.searchCalls")} />
          )}
          {tab === "dashboard" && (
            <button className="la-btn la-btn--inset" style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <CalendarDays size={13} style={{ color: "var(--mute)" }} />
              <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{VOICE_DASH.range}</span>
              <ChevronDown size={12} style={{ color: "var(--mute-2)" }} />
            </button>
          )}
        </>}
      />

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {tab === "inbox" && <VoiceInbox selection={selection} setSelection={setSelection} query={query} view={view} />}
        {tab === "dashboard" && <VoiceDashboard />}
        {tab === "settings" && <VoiceSettings />}
      </div>
    </div>
  );
}

export function VoicePage() {
  return (
    <CrmShell>
      <VoiceContent />
    </CrmShell>
  );
}
