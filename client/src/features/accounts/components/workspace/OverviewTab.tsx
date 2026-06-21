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
  onRefresh: () => void;
}

function OverviewRegular(p: OverviewData & { readOnly?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
      <AccountDetailsPanel account={p.account} onSave={p.readOnly ? async () => {} : p.onSave} cols={1} style={{ background: "var(--bone)" }} readOnly={p.readOnly} />
      <div className="neu-inset" style={{ borderRadius: "var(--r-card)", overflow: "hidden" }}>
        <CampaignsPanel campaigns={p.campaigns} loading={p.loadingCampaigns} onRefresh={p.onRefresh} naked />
        <div style={{ height: "1.5px", background: "var(--line)", margin: "0 20px" }} />
        <TeamPanel team={p.team} loading={p.loadingTeam} accountId={p.accountId} onRefresh={p.onRefresh} naked />
        <div style={{ height: "1.5px", background: "var(--line)", margin: "0 20px" }} />
        <ContractsPanel contracts={p.contracts} loading={p.loadingContracts} accountId={p.accountId} onRefresh={p.onRefresh} naked />
      </div>
    </div>
  );
}

function OverviewMobile(p: OverviewData) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <AccountDetailsPanel account={p.account} onSave={p.onSave} cols={1} />
      <CampaignsPanel campaigns={p.campaigns} loading={p.loadingCampaigns} onRefresh={p.onRefresh} />
      <TeamPanel team={p.team} loading={p.loadingTeam} accountId={p.accountId} onRefresh={p.onRefresh} />
      <ContractsPanel contracts={p.contracts} loading={p.loadingContracts} accountId={p.accountId} onRefresh={p.onRefresh} />
    </div>
  );
}

export function TabContent({ tab, isMobile, data, readOnly = false }: {
  tab: WorkspaceTab; isMobile: boolean; data: OverviewData; readOnly?: boolean;
}) {
  if (tab === "overview") {
    if (isMobile) return <OverviewMobile {...data} />;
    return <OverviewRegular {...data} readOnly={readOnly} />;
  }
  if (tab === "integrations") return (
    <IntegrationsPanel account={data.account} d={data.d} onSave={data.onSave} fieldCols={isMobile ? 1 : 3} stacked={isMobile} readOnly={readOnly} />
  );
  if (tab === "communication") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <CommunicationProfilePanel accountId={data.accountId} niche={data.account.business_niche} accountName={data.account.name} accountLogoUrl={data.account.logo_url} readOnly={readOnly} />
      {!readOnly && <KBPanel accountId={data.accountId} collapsible defaultCollapsed titleOverride="Company Intel" insetCrisp />}
    </div>
  );
  return null;
}

export type { OverviewData };
