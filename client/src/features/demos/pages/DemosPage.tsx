import { useState } from "react";
import { useTranslation } from "react-i18next";
import { List, Settings, Users } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { PageTopbar, TopbarTabs, type TopbarTab } from "@/components/crm/primitives";
import { useLastTab } from "@/hooks/useLastTab";
import { SessionsBody } from "../components/sessions/SessionsBody";
import { SessionsTopbarActions } from "../components/sessions/SessionsTopbarActions";
import { useSessionsData } from "../components/sessions/useSessionsData";
import { useSessionsState } from "../components/sessions/useSessionsState";
import { DemoSettingsTab } from "../components/DemoSettingsTab";
import { useDemoDraft } from "../useDemoDraft";
// The Clients library lives here rather than on the Campaigns page: a Client is
// a demo persona, not a campaign setting, and this is where demos are made.
import { ClientsTab } from "@/features/campaigns/components/clients/ClientsTab";

type Tab = "sessions" | "clients" | "settings";
// A remembered tab outside this list (the retired "new") opens Sessions.
const TABS: readonly Tab[] = ["sessions", "clients", "settings"];

function DemosContent() {
  const { t } = useTranslation("demos");
  // Reopens on the tab used last.
  const [tab, setTab] = useLastTab<Tab>("demos", TABS, "sessions");
  const [selectedClientNiche, setSelectedClientNiche] = useState<string | null>(null);
  // Called here, once, so a tab switch (which unmounts the body) never loses the Sessions state or a half-filled draft.
  const state = useSessionsState();
  const draft = useDemoDraft();
  const data = useSessionsData();

  const openClient = (niche: string) => {
    setSelectedClientNiche(niche);
    setTab("clients");
  };

  const tabs: TopbarTab<Tab>[] = [
    { id: "sessions", label: t("tabs.sessions"), icon: List },
    { id: "clients", label: t("tabs.clients"), icon: Users },
    { id: "settings", label: t("tabs.settings"), icon: Settings },
  ];

  return (
    <div className="la-page" style={{ display: "flex", flexDirection: "column" }}>
      <PageTopbar
        title={t("title")}
        scroll
        left={<TopbarTabs tabs={tabs} value={tab} onChange={setTab} />}
        right={
          tab === "sessions" ? (
            <SessionsTopbarActions state={state} clients={data.clients} onRefresh={data.refresh} refreshing={data.refreshing} />
          ) : undefined
        }
      />

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {tab === "settings" ? (
          <DemoSettingsTab />
        ) : tab === "clients" ? (
          <div className="h-full min-h-0 overflow-hidden">
            <ClientsTab selectedNiche={selectedClientNiche} onSelectNiche={setSelectedClientNiche} showActions />
          </div>
        ) : (
          <SessionsBody
            state={state}
            draft={draft}
            rows={data.rows}
            isLoading={data.isLoading}
            error={data.error}
            onRetry={data.refresh}
            onOpenClient={openClient}
          />
        )}
      </div>
    </div>
  );
}

export function DemosPage() {
  return (
    <CrmShell>
      <DemosContent />
    </CrmShell>
  );
}
