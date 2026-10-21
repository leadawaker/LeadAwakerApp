import { useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useClientNavFacts } from "@/components/crm/useClientNavFacts";
import { AccountDetailsPanel } from "./AccountDetailsPanel";
import { CampaignsPanel } from "./CampaignsPanel";
import { TeamPanel } from "./TeamPanel";
import { ServicesPanel } from "./ServicesPanel";
import { ContractsPanel } from "./ContractsPanel";
import { InvoicesPanel } from "./InvoicesPanel";
import { IntegrationsPanel } from "./IntegrationsPanel";
import type { ConnectionGroup } from "./ConnectionsOverview";
import { CommunicationProfilePanel } from "./communication/CommunicationProfilePanel";
import { CallNotes } from "./communication/CallNotes";
import { OnboardingEntry, BackToOverview } from "./communication/OnboardingEntry";
import { useCommunicationProfile } from "./communication/useCommunicationProfile";
import { VoiceTab } from "./voice/VoiceTab";
import { AlertsTab } from "./alerts/AlertsTab";
import { ChatTab } from "./chat/ChatTab";
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

// A hairline above a client panel. It lives on the wrapper, so a panel that
// renders nothing (no rows) leaves a zero-height wrapper and no stray line.
const clientRule: React.CSSProperties = {
  backgroundImage: "linear-gradient(var(--line), var(--line))",
  backgroundSize: "calc(100% - 40px) 1.5px", backgroundRepeat: "no-repeat", backgroundPosition: "top center",
};

/** The client's stack of panels under Account details: campaigns only with
 *  reactivation, team without Invite, contracts and invoices only with rows. */
function ClientPanels(p: OverviewData) {
  const { hasReactivation } = useClientNavFacts();
  return (
    <div className="neu-inset" style={{ borderRadius: "var(--r-card)", overflow: "hidden" }}>
      {hasReactivation && <CampaignsPanel campaigns={p.campaigns} loading={p.loadingCampaigns} onRefresh={p.onRefresh} naked clientView />}
      <div style={hasReactivation ? clientRule : undefined}>
        <TeamPanel team={p.team} loading={p.loadingTeam} accountId={p.accountId} onRefresh={p.onRefresh} naked clientView />
      </div>
      <div style={clientRule}><ContractsPanel contracts={p.contracts} loading={p.loadingContracts} accountId={p.accountId} onRefresh={p.onRefresh} naked clientView /></div>
      <div style={clientRule}><InvoicesPanel accountId={p.accountId} naked clientView /></div>
    </div>
  );
}

function OverviewRegular(p: OverviewData & { readOnly?: boolean; onOpenTab?: (t: WorkspaceTab) => void; trailing?: React.ReactNode }) {
  const { isAgencyUser } = useWorkspace();
  // Agency view: what the account runs first and largest, then its campaigns
  // when it has any, the team, and the reference details. Each is its own
  // raised white card so the page has depth. Contracts and invoices are on the
  // Billing page. A client login keeps the older layout below: the services
  // rows read agency-only data.
  if (!p.readOnly) {
    const card = { background: "var(--card)" };
    return (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)", gap: 28, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
          <ServicesPanel accountId={p.accountId} campaigns={p.campaigns} onOpenTab={p.onOpenTab} naked={false} eyebrow="01" />
          {p.campaigns.length > 0 && (
            <CampaignsPanel campaigns={p.campaigns} loading={p.loadingCampaigns} onRefresh={p.onRefresh} eyebrow="02" />
          )}
          <TeamPanel team={p.team} loading={p.loadingTeam} accountId={p.accountId} onRefresh={p.onRefresh} eyebrow={p.campaigns.length > 0 ? "03" : "02"} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
          <AccountDetailsPanel account={p.account} onSave={p.onSave} cols={1} style={card} eyebrow={p.campaigns.length > 0 ? "04" : "03"} />
          {p.trailing}
        </div>
      </div>
    );
  }
  if (!isAgencyUser) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>
        <AccountDetailsPanel account={p.account} onSave={p.onSave} cols={1} style={{ background: "var(--bone)" }} readOnly={p.readOnly} />
        <ClientPanels {...p} />
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
      <AccountDetailsPanel account={p.account} onSave={p.onSave} cols={1} style={{ background: "var(--bone)" }} readOnly={p.readOnly} />
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
  const { isAgencyUser } = useWorkspace();
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
  // A Manager edits the opening hours only; a Viewer gets no Edit (readOnly).
  if (!isAgencyUser) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <AccountDetailsPanel account={p.account} onSave={p.onSave} cols={1} readOnly={p.readOnly} />
        <ClientPanels {...p} />
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <AccountDetailsPanel account={p.account} onSave={p.onSave} cols={1} readOnly={p.readOnly} />
      <CampaignsPanel campaigns={p.campaigns} loading={p.loadingCampaigns} onRefresh={p.onRefresh} />
      <TeamPanel team={p.team} loading={p.loadingTeam} accountId={p.accountId} onRefresh={p.onRefresh} />
      <ContractsPanel contracts={p.contracts} loading={p.loadingContracts} accountId={p.accountId} onRefresh={p.onRefresh} />
      <InvoicesPanel accountId={p.accountId} />
    </div>
  );
}

/** Overview plus the way into onboarding: on top until the onboarding has been
 *  completed once, then a quiet card further down (it is rarely revisited). */
function OverviewWithOnboarding({ data, isMobile, readOnly, onOpenTab }: {
  data: OverviewData; isMobile: boolean; readOnly: boolean; onOpenTab?: (t: WorkspaceTab) => void;
}) {
  const { profile, loading } = useCommunicationProfile(data.accountId);
  const done = profile?.status === "completed";
  const { isAgencyUser } = useWorkspace();
  // The onboarding card is addressed to the agency: clients never see it.
  const entry = onOpenTab && !loading && isAgencyUser
    ? <OnboardingEntry onOpen={() => onOpenTab("communication")} done={done} />
    : null;
  const bottom = done ? entry : null;
  const overview = isMobile
    ? <OverviewMobile {...data} readOnly={readOnly} onOpenTab={onOpenTab} />
    : <OverviewRegular {...data} readOnly={readOnly} onOpenTab={onOpenTab} trailing={readOnly ? null : bottom} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 18 : 24 }}>
      {!done && entry}
      {overview}
      {done && (isMobile || readOnly) && entry}
    </div>
  );
}

export function TabContent({ tab, isMobile, data, readOnly = false, onOpenTab, integrationsGroup }: {
  tab: WorkspaceTab; isMobile: boolean; data: OverviewData; readOnly?: boolean;
  onOpenTab?: (t: WorkspaceTab) => void;
  /** The Integrations group to open first (Social, after the Instagram connect flow). */
  integrationsGroup?: ConnectionGroup;
}) {
  // While the onboarding wizard is on screen, the Company Intel panel below it
  // is hidden so the call stays focused on one thing at a time.
  const [commWizardActive, setCommWizardActive] = useState(false);
  if (tab === "overview") return <OverviewWithOnboarding data={data} isMobile={isMobile} readOnly={readOnly} onOpenTab={onOpenTab} />;
  if (tab === "integrations") return (
    <IntegrationsPanel account={data.account} d={data.d} onSave={data.onSave} fieldCols={isMobile ? 1 : 3} stacked={isMobile} readOnly={readOnly} initialGroup={integrationsGroup} />
  );
  if (tab === "communication") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {onOpenTab && <BackToOverview onBack={() => onOpenTab("overview")} />}
      <CommunicationProfilePanel accountId={data.accountId} niche={data.account.business_niche} accountName={data.account.name} accountLogoUrl={data.account.logo_url} readOnly={readOnly} onWizardActiveChange={setCommWizardActive} account={data.account} detail={data.d} onSaveAccount={data.onSave} />
      {!readOnly && <CallNotes account={data.account} onSave={data.onSave} />}
    </div>
  );
  if (tab === "voice") return <VoiceTab accountId={data.accountId} readOnly={readOnly} stacked={isMobile} onOpenIntegrations={onOpenTab ? () => onOpenTab("integrations") : undefined} />;
  if (tab === "chat") return <ChatTab accountId={data.accountId} inboundCampaignId={data.account.inbound_campaign_id} readOnly={readOnly} stacked={isMobile} onOpenIntegrations={onOpenTab ? () => onOpenTab("integrations") : undefined} />;
  if (tab === "alerts") return <AlertsTab accountId={data.accountId} stacked={isMobile} />;
  if (tab === "automations") return <ClientAutomationsTab accountId={data.accountId} onOpenTab={onOpenTab} />;
  return null;
}

export type { OverviewData };
