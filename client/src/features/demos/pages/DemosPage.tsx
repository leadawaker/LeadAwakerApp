import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { List, Plus, RefreshCw, Settings, Users } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useLastTab } from "@/hooks/useLastTab";
import { cn } from "@/lib/utils";
import { useDemoProspects } from "../api/demoProspectsApi";
import { useDemoSessions } from "../api/demoSessionsApi";
import { DemosLoading } from "../components/DemosLoading";
import { SessionsTable } from "../components/table/SessionsTable";
import { buildProspectRows } from "../prospectRows";
import { DEFAULT_FILTERS, visibleRows } from "../sessionsView";
import { NewDemoForm } from "../components/NewDemoForm";
import { DemoSettingsTab } from "../components/DemoSettingsTab";
// The Clients library lives here rather than on the Campaigns page: a Client is
// a demo persona, not a campaign setting, and this is where demos are made.
import { ClientsTab } from "@/features/campaigns/components/clients/ClientsTab";

type Tab = "sessions" | "new" | "clients" | "settings";
const TABS: readonly Tab[] = ["sessions", "new", "clients", "settings"];

function DemosContent() {
  const { t } = useTranslation("demos");
  // Reopens on the tab used last.
  const [tab, setTab] = useLastTab<Tab>("demos", TABS, "sessions");
  const [selectedClientNiche, setSelectedClientNiche] = useState<string | null>(null);
  const { data: sessions, isLoading: sessionsLoading, error, refetch, isFetching } = useDemoSessions();
  const { data: prospects, isLoading: prospectsLoading } = useDemoProspects();
  const isLoading = sessionsLoading || prospectsLoading;
  const rows = useMemo(
    () => visibleRows(buildProspectRows(prospects ?? [], sessions ?? []), DEFAULT_FILTERS, "", "newest"),
    [prospects, sessions],
  );

  const openClient = (niche: string) => {
    setSelectedClientNiche(niche);
    setTab("clients");
  };

  const tabs: Array<{ key: Tab; Icon: typeof List }> = [
    { key: "sessions", Icon: List },
    { key: "new", Icon: Plus },
    { key: "clients", Icon: Users },
    { key: "settings", Icon: Settings },
  ];

  return (
    <div className="la-page" style={{ display: "flex", flexDirection: "column" }}>
      <div className="la-page-header" style={{ gap: 12, padding: "0 17px" }}>
        <span
          className="serif"
          style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em", flexShrink: 0 }}
        >
          {t("title")}
        </span>

        <div className="la-seg la-seg--fill shrink-0" role="tablist" style={{ marginLeft: 4 }}>
          {tabs.map((x) => (
            <button
              key={x.key}
              role="tab"
              aria-selected={tab === x.key}
              className={cn("la-seg-btn", tab === x.key && "on")}
              style={{ padding: "8px 12px", fontSize: 11, letterSpacing: "0.13em" }}
              onClick={() => setTab(x.key)}
              title={t(`tabs.${x.key}`)}
            >
              <span className="flex items-center">
                <x.Icon size={13} />
              </span>
              {/* On a phone only the open tab keeps its label, so the four tabs fit the screen. */}
              <span className={cn(tab !== x.key && "max-md:sr-only")}>{t(`tabs.${x.key}`)}</span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {tab === "sessions" && (
          <button
            type="button"
            onClick={() => refetch()}
            title={t("actions.refresh")}
            aria-label={t("actions.refresh")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
            style={{ color: "var(--mute-2)" }}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {tab === "settings" ? (
          <DemoSettingsTab />
        ) : tab === "clients" ? (
          <div className="h-full min-h-0 overflow-hidden">
            <ClientsTab selectedNiche={selectedClientNiche} onSelectNiche={setSelectedClientNiche} showActions />
          </div>
        ) : tab === "new" ? (
          <div className="h-full min-h-0 overflow-y-auto" style={{ padding: "22px 24px" }}>
            <div className="la-page-center">
              <NewDemoForm />
            </div>
          </div>
        ) : isLoading ? (
          <DemosLoading />
        ) : error ? (
          <div className="flex flex-1 items-center justify-center" style={{ fontSize: 13, color: "var(--mute)" }}>
            {t("error.load")}
          </div>
        ) : !rows.length ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1">
            <span className="serif" style={{ fontSize: 16, color: "var(--ink)" }}>
              {t("empty.title")}
            </span>
            <span style={{ fontSize: 12.5, color: "var(--mute-2)" }}>{t("empty.body")}</span>
          </div>
        ) : (
          <div className="h-full min-h-0 overflow-hidden" style={{ padding: "14px 24px 0" }}>
            <div className="la-page-center flex h-full min-h-0 flex-col">
              {/* The prospect detail panel arrives with the sessions body; until then a name has nothing to open. */}
              <SessionsTable rows={rows} highlightKey={null} onOpenRow={() => {}} onOpenClient={openClient} />
            </div>
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
