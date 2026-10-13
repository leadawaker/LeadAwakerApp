import { useState } from "react";
import { AccountDetailsPanel } from "./AccountDetailsPanel";
import { CampaignsPanel } from "./CampaignsPanel";
import { TeamPanel } from "./TeamPanel";
import { ServicesPanel } from "./ServicesPanel";
import { ContractsPanel } from "./ContractsPanel";
import { InvoicesPanel } from "./InvoicesPanel";
import { IntegrationsPanel } from "./IntegrationsPanel";
import { CommunicationProfilePanel } from "./communication/CommunicationProfilePanel";
import { CallNotes } from "./communication/CallNotes";
import { VoiceTab } from "./voice/VoiceTab";
import { AlertsTab } from "./alerts/AlertsTab";
import { ClientAutomationsTab } from "@/features/automation/components/ClientAutomationsTab";
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

function OverviewRegular(p: OverviewData & { readOnly?: boolean; onOpenTab?: (t: WorkspaceTab) => void }) {
  // Agency view: what the account runs, its campaigns when it has any, and the
  // team. Contracts and invoices are on the Billing page. A client login keeps
  // the older layout below: the services rows read agency-only data.
  if (!p.readOnly) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>
        <AccountDetailsPanel account={p.account} onSave={p.onSave} cols={1} style={{ background: "var(--bone)" }} />
        <div className="neu-inset" style={{ borderRadius: "var(--r-card)", overflow: "hidden" }}>
          <ServicesPanel accountId={p.accountId} campaigns={p.campaigns} onOpenTab={p.onOpenTab} eyebrow="02" />
          {p.campaigns.length > 0 && (
            <>
              <div style={{ height: "1.5px", background: "var(--line)", margin: "0 20px" }} />
              <CampaignsPanel campaigns={p.campaigns} loading={p.loadingCampaigns} onRefresh={p.onRefresh} naked eyebrow="03" />
            </>
          )}
          <div style={{ height: "1.5px", background: "var(--line)", margin: "0 20px" }} />
          <TeamPanel team={p.team} loading={p.loadingTeam} accountId={p.accountId} onRefresh={p.onRefresh} naked eyebrow={p.campaigns.length > 0 ? "04" : "03"} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
      <AccountDetailsPanel account={p.account} onSave={p.readOnly ? async () => {} : p.onSave} cols={1} style={{ background: "var(--bone)" }} readOnly={p.readOnly} />
      <div className="neu-inset" style={{ borderRadius: "var(--r-card)", overflow: "hidden" }}>
        <CampaignsPanel campaigns={p.campaigns} loading={p.loadingCampaigns} onRefresh={p.onRefresh} naked />
        <div style={{ height: "1.5px", background: "var(--line)", margin: "0 20px" }} />
        <TeamPanel team={p.team} loading={p.loadingTeam} accountId={p.accountId} onRefresh={p.onRefresh} naked />
        <div style={{ height: "1.5px", background: "var(--line)", margin: "0 20px" }} />
        <ContractsPanel contracts={p.contracts} loading={p.loadingContracts} accountId={p.accountId} onRefresh={p.onRefresh} naked />
        <div style={{ height: "1.5px", background: "var(--line)", margin: "0 20px" }} />
        <InvoicesPanel accountId={p.accountId} naked />
      </div>
    </div>
  );
}

function OverviewMobile(p: OverviewData & { readOnly?: boolean; onOpenTab?: (t: WorkspaceTab) => void }) {
  // Agency view, same order of importance as on desktop: what the account
  // runs first, the reference details last. Contracts and invoices are on Billing.
  if (!p.readOnly) {
    const hasCampaigns = p.campaigns.length > 0;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <ServicesPanel accountId={p.accountId} campaigns={p.campaigns} onOpenTab={p.onOpenTab} naked={false} eyebrow="01" />
        {hasCampaigns && <CampaignsPanel campaigns={p.campaigns} loading={p.loadingCampaigns} onRefresh={p.onRefresh} eyebrow="02" />}
        <TeamPanel team={p.team} loading={p.loadingTeam} accountId={p.accountId} onRefresh={p.onRefresh} eyebrow={hasCampaigns ? "03" : "02"} />
        <AccountDetailsPanel account={p.account} onSave={p.onSave} cols={1} eyebrow={hasCampaigns ? "04" : "03"} />
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <AccountDetailsPanel account={p.account} onSave={p.onSave} cols={1} />
      <CampaignsPanel campaigns={p.campaigns} loading={p.loadingCampaigns} onRefresh={p.onRefresh} />
      <TeamPanel team={p.team} loading={p.loadingTeam} accountId={p.accountId} onRefresh={p.onRefresh} />
      <ContractsPanel contracts={p.contracts} loading={p.loadingContracts} accountId={p.accountId} onRefresh={p.onRefresh} />
      <InvoicesPanel accountId={p.accountId} />
    </div>
  );
}

export function TabContent({ tab, isMobile, data, readOnly = false, onOpenTab }: {
  tab: WorkspaceTab; isMobile: boolean; data: OverviewData; readOnly?: boolean;
  onOpenTab?: (t: WorkspaceTab) => void;
}) {
  // While the onboarding wizard is on screen, the Company Intel panel below it
  // is hidden so the call stays focused on one thing at a time.
  const [commWizardActive, setCommWizardActive] = useState(false);
  if (tab === "overview") {
    if (isMobile) return <OverviewMobile {...data} readOnly={readOnly} onOpenTab={onOpenTab} />;
    return <OverviewRegular {...data} readOnly={readOnly} onOpenTab={onOpenTab} />;
  }
  if (tab === "integrations") return (
    <IntegrationsPanel account={data.account} d={data.d} onSave={data.onSave} fieldCols={isMobile ? 1 : 3} stacked={isMobile} readOnly={readOnly} />
  );
  if (tab === "communication") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <CommunicationProfilePanel accountId={data.accountId} niche={data.account.business_niche} accountName={data.account.name} accountLogoUrl={data.account.logo_url} readOnly={readOnly} onWizardActiveChange={setCommWizardActive} account={data.account} detail={data.d} onSaveAccount={data.onSave} />
      {!readOnly && <CallNotes account={data.account} onSave={data.onSave} />}
    </div>
  );
  if (tab === "voice") return <VoiceTab accountId={data.accountId} readOnly={readOnly} onOpenIntegrations={onOpenTab ? () => onOpenTab("integrations") : undefined} />;
  if (tab === "alerts") return <AlertsTab accountId={data.accountId} readOnly={readOnly} />;
  if (tab === "automations") return <ClientAutomationsTab accountId={data.accountId} onOpenTab={onOpenTab} />;
  return null;
}

export type { OverviewData };
