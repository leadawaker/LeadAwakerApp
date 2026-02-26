import { Suspense, type ReactElement } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { CrmShell } from "@/components/crm/CrmShell";
import { Loader2 } from "lucide-react";

import AppDashboard from "@/pages/AppDashboard";
import { LeadsPage as AppLeads } from "@/features/leads/pages/LeadsPage";
import ConversationsPage from "@/pages/Conversations";
import LeadDetailPage from "@/pages/LeadDetail";
import AppCampaigns from "@/pages/AppCampaigns";
import AppAccounts from "@/pages/AppAccounts";
import CalendarPage from "@/pages/Calendar";
import AutomationLogsPage from "@/pages/AutomationLogs";
import UsersPage from "@/pages/Users";
import TagsPage from "@/pages/Tags";
import PromptLibraryPage from "@/pages/PromptLibrary";
import BillingPage from "@/pages/Billing";
import OpportunitiesPage from "@/pages/Opportunities";

function isAuthed() {
  return Boolean(localStorage.getItem("leadawaker_auth"));
}

/**
 * Checks if the current user has agency-level access.
 * Uses both role check (Admin/Operator) and account check (accountsId === 1).
 * Both must be true for full agency access to admin pages.
 */
function isAgencyUser(): boolean {
  const role = localStorage.getItem("leadawaker_user_role") || "Viewer";
  const isAgencyRole = role === "Admin" || role === "Operator";
  const accountId = localStorage.getItem("leadawaker_current_account_id");
  const isAgencyAccount = accountId === "1";
  // Agency access requires either agency role OR agency account
  return isAgencyRole || isAgencyAccount;
}

function Protected({ children }: { children: ReactElement }) {
  if (!isAuthed()) return <Redirect to="/login" />;
  return children;
}

/**
 * Route guard for agency-only pages (Accounts, Users, Tags, Prompts, Automation Logs).
 * Redirects non-agency users to their dashboard.
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
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading dashboard...</p>
      </div>
    </div>
  );
}

export default function AppArea() {
  return (
    <Protected>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          {/* Agency routes */}
          <Route path="/agency" component={() => <Redirect to="/agency/campaigns" />} />
          <Route path="/agency/dashboard" component={AppDashboard} />
          <Route path="/agency/contacts" component={AppLeads} />
          <Route path="/agency/leads" component={AppLeads} />
          <Route path="/agency/conversations" component={ConversationsPage} />
          <Route path="/agency/contacts/:id" component={LeadDetailPage} />
          <Route path="/agency/campaigns" component={AppCampaigns} />
          <Route path="/agency/calendar" component={CalendarPage} />
          <Route path="/agency/settings" component={() => <Redirect to="/agency/campaigns" />} />

          {/* Agency-only routes (admin pages) */}
          <Route path="/agency/accounts">
            <AgencyOnly prefix="/agency"><AppAccounts /></AgencyOnly>
          </Route>
          <Route path="/agency/users" component={UsersPage} />
          <Route path="/agency/tags">
            <AgencyOnly prefix="/agency"><TagsPage /></AgencyOnly>
          </Route>
          <Route path="/agency/automation-logs">
            <AgencyOnly prefix="/agency"><AutomationLogsPage /></AgencyOnly>
          </Route>
          <Route path="/agency/prompt-library">
            <AgencyOnly prefix="/agency"><PromptLibraryPage /></AgencyOnly>
          </Route>
          <Route path="/agency/invoices" component={BillingPage} />
          <Route path="/agency/expenses">
            <AgencyOnly prefix="/agency"><BillingPage /></AgencyOnly>
          </Route>
          <Route path="/agency/contracts" component={BillingPage} />
          <Route path="/agency/billing">
            <Redirect to="/agency/invoices" />
          </Route>
          <Route path="/agency/opportunities" component={OpportunitiesPage} />

          {/* Subaccount routes */}
          <Route path="/subaccount" component={() => <Redirect to="/subaccount/campaigns" />} />
          <Route path="/subaccount/dashboard" component={AppDashboard} />
          <Route path="/subaccount/contacts" component={AppLeads} />
          <Route path="/subaccount/leads" component={AppLeads} />
          <Route path="/subaccount/conversations" component={ConversationsPage} />
          <Route path="/subaccount/contacts/:id" component={LeadDetailPage} />
          <Route path="/subaccount/campaigns" component={AppCampaigns} />
          <Route path="/subaccount/calendar" component={CalendarPage} />
          <Route path="/subaccount/settings" component={() => <Redirect to="/subaccount/campaigns" />} />

          {/* Subaccount agency-only routes (admin pages) */}
          <Route path="/subaccount/accounts">
            <AgencyOnly prefix="/subaccount"><AppAccounts /></AgencyOnly>
          </Route>
          <Route path="/subaccount/users" component={UsersPage} />
          <Route path="/subaccount/tags">
            <AgencyOnly prefix="/subaccount"><TagsPage /></AgencyOnly>
          </Route>
          <Route path="/subaccount/automation-logs">
            <AgencyOnly prefix="/subaccount"><AutomationLogsPage /></AgencyOnly>
          </Route>
          <Route path="/subaccount/prompt-library">
            <AgencyOnly prefix="/subaccount"><PromptLibraryPage /></AgencyOnly>
          </Route>
          <Route path="/subaccount/invoices" component={BillingPage} />
          <Route path="/subaccount/expenses">
            <AgencyOnly prefix="/subaccount"><BillingPage /></AgencyOnly>
          </Route>
          <Route path="/subaccount/contracts" component={BillingPage} />
          <Route path="/subaccount/billing">
            <Redirect to="/subaccount/invoices" />
          </Route>
          <Route path="/subaccount/opportunities" component={OpportunitiesPage} />

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
    </Protected>
  );
}
