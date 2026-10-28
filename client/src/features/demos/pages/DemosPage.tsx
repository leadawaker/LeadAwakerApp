import { useTranslation } from "react-i18next";
import { Settings, Users } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { PageTopbar, TopbarTabs, type TopbarTab } from "@/components/crm/primitives";
import { useLastTab } from "@/hooks/useLastTab";
import { useDemoClients } from "@/features/campaigns/api/demoClientsApi";
// The persona library lives here rather than on the Campaigns page: a persona is
// a demo persona, not a campaign setting, and this is where demos are made.
import { usePersonaView } from "@/features/campaigns/components/clients/usePersonaView";
import { DemoSettingsTab } from "../components/DemoSettingsTab";
import { DemosViewSwitch } from "../components/DemosViewSwitch";
import { DemosPanelSlot } from "../components/personas/DemosPanelSlot";
import { DemosTopbarActions } from "../components/personas/DemosTopbarActions";
import { PersonasWithDemos } from "../components/personas/PersonasWithDemos";
import { FLASH_WAIT_MS, useDemosPageState } from "../components/personas/useDemosPageState";
import { usePersonaActivity } from "../components/personas/usePersonaActivity";
import { usePersonaSeen } from "../components/personas/usePersonaSeen";
import { useProspectData } from "../components/personas/useProspectData";
import { NO_PERSONA_KEY } from "../personaDemos";
import { useDemoDraft } from "../useDemoDraft";

type Tab = "personas" | "settings";
// Any other remembered tab ("sessions", "clients", the retired "new") opens Personas.
const TABS: readonly Tab[] = ["personas", "settings"];

function DemosContent() {
  const { t } = useTranslation("demos");
  // Reopens on the tab used last.
  const [tab, setTab] = useLastTab<Tab>("demos", TABS, "personas");
  // Called here, once (R22): a tab switch (which unmounts the body) never loses the page state or a half-filled draft.
  const state = useDemosPageState();
  const draft = useDemoDraft();
  const data = useProspectData();
  const personaView = usePersonaView();
  const seen = usePersonaSeen();
  const { data: clients } = useDemoClients();
  const activity = usePersonaActivity(data.rows, clients, seen.seen);

  // Opening a card clears its dot; closing it too, so activity that came in while it was open counts as seen.
  const select = (key: string | null) => {
    if (state.selected) seen.markSeen(state.selected);
    if (key) seen.markSeen(key);
    state.setSelected(key);
  };
  const addProspect = (clientNiche: string) => {
    draft.update({ mode: "existing", clientNiche });
    state.setPanel({ kind: "create" });
  };
  // The new row's card opens with the row highlighted; a persona that no longer exists files it under No persona.
  const onAdded = (group: string, clientNiche: string) => {
    state.flash(group, FLASH_WAIT_MS);
    select(clientNiche && clients?.some((c) => c.niche === clientNiche) ? clientNiche : NO_PERSONA_KEY);
  };

  const tabs: TopbarTab<Tab>[] = [
    { id: "personas", label: t("tabs.personas"), icon: Users },
    { id: "settings", label: t("tabs.settings"), icon: Settings },
  ];

  return (
    <div className="la-page" style={{ display: "flex", flexDirection: "column" }}>
      <PageTopbar
        title={t("title")}
        scroll
        left={
          <>
            <TopbarTabs tabs={tabs} value={tab} onChange={setTab} className="max-md:[&_.la-seg-btn]:min-h-11" />
            <DemosViewSwitch tab={tab} personas={personaView} />
          </>
        }
        right={
          tab === "personas" ? (
            <DemosTopbarActions
              view={personaView}
              followUp={state.followUp}
              followUpCount={activity.followUp.size}
              onFollowUp={state.setFollowUp}
              onNewDemo={() => state.setPanel({ kind: "create" })}
            />
          ) : undefined
        }
      />

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {tab === "settings" ? (
          <DemoSettingsTab />
        ) : (
          <div className="flex h-full min-h-0 overflow-hidden">
            <div className="h-full min-h-0 min-w-0 flex-1 overflow-hidden">
              <PersonasWithDemos
                state={state}
                view={personaView}
                data={data}
                activity={activity}
                select={select}
                onAddProspect={addProspect}
              />
            </div>
            <DemosPanelSlot
              panel={state.panel}
              onClose={() => state.setPanel(null)}
              draft={draft}
              rows={data.rows}
              onAdded={onAdded}
            />
          </div>
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
