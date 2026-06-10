import { Suspense, useEffect, useState, type ReactElement } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { CrmShell } from "@/components/crm/CrmShell";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { AgentWidgetProvider } from "@/contexts/AgentWidgetContext";
import { PageEntityProvider } from "@/contexts/PageEntityContext";
import { AgentChatWidget } from "@/features/ai-agents/components/AgentChatWidget";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";

import { LeadsPage as AppLeads } from "@/features/leads/pages/LeadsPage";
import OutreachInbox from "@/pages/OutreachInbox";
import LeadDetailPage from "@/pages/LeadDetail";
import ProspectDetailPage from "@/pages/ProspectDetail";
import AppCampaigns from "@/pages/AppCampaigns";
import AppAccounts from "@/pages/AppAccounts";
import AppProspects from "@/pages/AppProspects";
import AppCadence from "@/pages/AppCadence";
import CalendarPage from "@/pages/Calendar";
import AutomationLogsPage from "@/pages/AutomationLogs";
// UsersPage removed — user management now lives in Settings > Team tab
import PromptsPage from "@/features/prompts/pages/PromptsPage";
import { BillingPage } from "@/features/billing/pages/BillingPage";
import SettingsPage from "@/pages/Settings";
import DocsPage from "@/pages/Docs";
import TasksPage from "@/features/tasks/pages/TasksPage";
import { AgentsPage } from "@/features/ai-agents/pages/AgentsPage";
import { AgentChatPage } from "@/features/ai-agents/pages/AgentChatPage";
// OpportunitiesPage merged into Leads as "Pipeline" tab — route redirects below

function isAuthed() {
  return Boolean(localStorage.getItem("leadawaker_auth"));
}

/**
 * Checks if the current user has agency-level access.
 */
function isAgencyUser(): boolean {
  const role = localStorage.getItem("leadawaker_user_role") || "Viewer";
  return role === "Owner" || role === "Admin";
}

function Protected({ children }: { children: ReactElement }) {
  if (!isAuthed()) return <Redirect to="/login" />;
  return children;
}

/**
 * Route guard for agency-only pages (Accounts, Users, Tags, Prompts, Automation Logs).
 * Redirects non-agency users to campaigns.
 * Client users (Manager, Viewer) are blocked from these routes.
 */
function AgencyOnly({ children, prefix }: { children: ReactElement; prefix: string }) {
  if (!isAgencyUser()) {
    return <Redirect to={`${prefix}/campaigns`} />;
  }
  return children;
}

function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading...</p>
      </div>
    </div>
  );
}

export default function AppArea() {
  return (
    <Protected>
      <PageEntityProvider>
      <AgentWidgetProvider>
      <BreadcrumbProvider>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          {/* Unified CRM routes — agency vs client behaviour is derived from the
              user's role/session, no longer from the URL prefix. */}
          <Route path="/platform" component={() => <Redirect to="/platform/campaigns" />} />
          <Route path="/platform/dashboard" component={() => <Redirect to="/platform/campaigns" />} />
          <Route path="/platform/contacts" component={AppLeads} />
          <Route path="/platform/leads" component={AppLeads} />
          {/* Chats page retired — lead chat now lives on the Leads page */}
          <Route path="/platform/conversations" component={() => <Redirect to="/platform/contacts" />} />
          <Route path="/platform/outreach-inbox">
            <AgencyOnly prefix="/platform"><OutreachInbox /></AgencyOnly>
          </Route>
          <Route path="/platform/contacts/:id" component={LeadDetailPage} />
          <Route path="/platform/campaigns" component={AppCampaigns} />
          <Route path="/platform/calendar" component={CalendarPage} />
          <Route path="/platform/settings" component={SettingsPage} />

          <Route path="/platform/ai-agents/:agentId">
            <AgencyOnly prefix="/platform"><AgentChatPage /></AgencyOnly>
          </Route>
          <Route path="/platform/ai-agents">
            <AgencyOnly prefix="/platform"><AgentsPage /></AgencyOnly>
          </Route>

          {/* Agency-only routes (admin pages) */}
          <Route path="/platform/accounts">
            <AgencyOnly prefix="/platform"><AppAccounts /></AgencyOnly>
          </Route>
          <Route path="/platform/prospects/:id" component={ProspectDetailPage} />
          <Route path="/platform/prospects">
            <AgencyOnly prefix="/platform"><AppProspects /></AgencyOnly>
          </Route>
          <Route path="/platform/cadence">
            <AgencyOnly prefix="/platform"><AppCadence /></AgencyOnly>
          </Route>
          <Route path="/platform/users">
            <Redirect to="/platform/settings" />
          </Route>
          <Route path="/platform/tags">
            <Redirect to="/platform/campaigns" />
          </Route>
          <Route path="/platform/tasks">
            <AgencyOnly prefix="/platform"><TasksPage /></AgencyOnly>
          </Route>
          <Route path="/platform/automation-logs">
            <AgencyOnly prefix="/platform"><AutomationLogsPage /></AgencyOnly>
          </Route>
          <Route path="/platform/prompt-library">
            <AgencyOnly prefix="/platform"><PromptsPage /></AgencyOnly>
          </Route>
          <Route path="/platform/billing" component={BillingPage} />
          <Route path="/platform/invoices"><Redirect to="/platform/billing" /></Route>
          <Route path="/platform/expenses"><Redirect to="/platform/billing" /></Route>
          <Route path="/platform/contracts"><Redirect to="/platform/billing" /></Route>
          <Route path="/platform/docs" component={DocsPage} />
          <Route path="/platform/opportunities">
            <Redirect to="/platform/leads" />
          </Route>

          <Route component={() => (
            <CrmShell>
              <div className="py-4" data-testid="page-app-notfound">
                <div className="text-2xl font-extrabold tracking-tight">Not found</div>
                <div className="mt-1 text-sm text-muted-foreground">This CRM page doesn't exist.</div>
              </div>
            </CrmShell>
          )} />
        </Switch>
      </Suspense>
      </BreadcrumbProvider>
      {/* Persistent chat widget — rendered outside routes so it survives navigation */}
      <AgentChatWidget />
      </AgentWidgetProvider>
      </PageEntityProvider>
    </Protected>
  );
}
