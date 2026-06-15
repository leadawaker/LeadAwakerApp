import { AccountDetailsPanel } from "./AccountDetailsPanel";
import { CampaignsPanel } from "./CampaignsPanel";
import { TeamPanel } from "./TeamPanel";
import { ContractsPanel } from "./ContractsPanel";
import { IntegrationsPanel } from "./IntegrationsPanel";
import { KBPanel } from "./knowledge/KBPanel";
import { CommunicationProfilePanel } from "./communication/CommunicationProfilePanel";
import type { AccountRow, AccountDetail, WorkspaceTab, CampaignRowData, ContractRowData, TeamMemberData } from "./types";

interface OverviewData {
  account: AccountRow;
  d: AccountDetail;
  accountId: number;
  onSave: (field: string, value: string) => Promise<void>;
  campaigns: CampaignRowData[];
  contracts: ContractRowData[];
  team: TeamMemberData[];
  loadingCampaigns: boolean;
  loadingContracts: boolean;
  loadingTeam: boolean;
}

function OverviewRegular(p: OverviewData) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <AccountDetailsPanel account={p.account} onSave={p.onSave} cols={2} />
      <div style={{ display: "grid", gridTemplateColumns: "1.45fr 1fr", gap: 22, alignItems: "start" }}>
        <CampaignsPanel campaigns={p.campaigns} loading={p.loadingCampaigns} />
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <TeamPanel team={p.team} loading={p.loadingTeam} />
          <ContractsPanel contracts={p.contracts} loading={p.loadingContracts} />
        </div>
      </div>
    </div>
  );
}

function OverviewUltra(p: OverviewData) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <AccountDetailsPanel account={p.account} onSave={p.onSave} cols={2} />
        <IntegrationsPanel account={p.account} d={p.d} onSave={p.onSave} fieldCols={2} stacked />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <CampaignsPanel campaigns={p.campaigns} loading={p.loadingCampaigns} />
        <TeamPanel team={p.team} loading={p.loadingTeam} />
        <ContractsPanel contracts={p.contracts} loading={p.loadingContracts} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
        <KBPanel accountId={p.accountId} />
        <CommunicationProfilePanel accountId={p.accountId} fill={false} />
      </div>
    </div>
  );
}

function OverviewMobile(p: OverviewData) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <AccountDetailsPanel account={p.account} onSave={p.onSave} cols={1} />
      <CampaignsPanel campaigns={p.campaigns} loading={p.loadingCampaigns} />
      <TeamPanel team={p.team} loading={p.loadingTeam} />
      <ContractsPanel contracts={p.contracts} loading={p.loadingContracts} />
    </div>
  );
}

export function TabContent({ tab, ultra, isMobile, data }: {
  tab: WorkspaceTab; ultra: boolean; isMobile: boolean; data: OverviewData;
}) {
  if (tab === "overview") {
    if (isMobile) return <OverviewMobile {...data} />;
    return ultra ? <OverviewUltra {...data} /> : <OverviewRegular {...data} />;
  }
  if (tab === "integrations") return <IntegrationsPanel account={data.account} d={data.d} onSave={data.onSave} fieldCols={isMobile ? 1 : 3} stacked={isMobile} />;
  if (tab === "knowledge") return <KBPanel accountId={data.accountId} />;
  if (tab === "communication") return <CommunicationProfilePanel accountId={data.accountId} />;
  return null;
}

export type { OverviewData };
