import { Suspense, type ReactElement } from "react";
import { Switch, Route, Redirect } from "wouter";
import { CrmShell } from "@/components/crm/CrmShell";
import { Loader2 } from "lucide-react";

import AppDashboard from "@/pages/AppDashboard";
import AppLeads from "@/pages/AppLeads";
import ConversationsPage from "@/pages/Conversations";
import LeadDetailPage from "@/pages/LeadDetail";
import AppCampaigns from "@/pages/AppCampaigns";
import AppAccounts from "@/pages/AppAccounts";
import CalendarPage from "@/pages/Calendar";
import AutomationLogsPage from "@/pages/AutomationLogs";
import UsersPage from "@/pages/Users";
import TagsPage from "@/pages/Tags";
import PromptLibraryPage from "@/pages/PromptLibrary";
import SettingsPage from "@/pages/Settings";

function isAuthed() {
  return Boolean(localStorage.getItem("leadawaker_auth"));
}

function Protected({ children }: { children: ReactElement }) {
  if (!isAuthed()) return <Redirect to="/login" />;
  return children;
}

function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium text-slate-500 animate-pulse">Loading dashboard...</p>
      </div>
    </div>
  );
}

export default function AppArea() {
  // Admin check
  const currentUserEmail = localStorage.getItem("leadawaker_user_email") || "leadawaker@gmail.com";
  const isAdmin = currentUserEmail === "leadawaker@gmail.com";

  return (
    <Protected>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/agency" component={() => <Redirect to="/agency/dashboard" />} />
          <Route path="/agency/dashboard" component={AppDashboard} />
          <Route path="/agency/contacts" component={AppLeads} />
          <Route path="/agency/leads" component={AppLeads} />
          <Route path="/agency/conversations" component={ConversationsPage} />
          <Route path="/agency/contacts/:id" component={LeadDetailPage} />
          <Route path="/agency/campaigns" component={AppCampaigns} />
          <Route path="/agency/accounts" component={AppAccounts} />
          <Route path="/agency/calendar" component={CalendarPage} />
          <Route path="/agency/users" component={UsersPage} />

          {/* Admin Protected Routes */}
          <Route path="/agency/automation-logs">
            {isAdmin ? <AutomationLogsPage /> : <Redirect to="/agency/dashboard" />}
          </Route>
          <Route path="/agency/prompt-library">
            {isAdmin ? <PromptLibraryPage /> : <Redirect to="/agency/dashboard" />}
          </Route>

          <Route path="/agency/tags" component={TagsPage} />
          <Route path="/agency/settings" component={SettingsPage} />

          <Route path="/subaccount" component={() => <Redirect to="/subaccount/dashboard" />} />
          <Route path="/subaccount/dashboard" component={AppDashboard} />
          <Route path="/subaccount/contacts" component={AppLeads} />
          <Route path="/subaccount/leads" component={AppLeads} />
          <Route path="/subaccount/conversations" component={ConversationsPage} />
          <Route path="/subaccount/contacts/:id" component={LeadDetailPage} />
          <Route path="/subaccount/campaigns" component={AppCampaigns} />
          <Route path="/subaccount/accounts" component={AppAccounts} />
          <Route path="/subaccount/calendar" component={CalendarPage} />
          <Route path="/subaccount/users" component={UsersPage} />

          {/* Admin Protected Routes */}
          <Route path="/subaccount/automation-logs">
            {isAdmin ? <AutomationLogsPage /> : <Redirect to="/subaccount/dashboard" />}
          </Route>
          <Route path="/subaccount/prompt-library">
            {isAdmin ? <PromptLibraryPage /> : <Redirect to="/subaccount/dashboard" />}
          </Route>

          <Route path="/subaccount/tags" component={TagsPage} />
          <Route path="/subaccount/settings" component={SettingsPage} />
          <Route component={() => (
            <CrmShell>
              <div className="px-6 py-6" data-testid="page-app-notfound">
                <div className="text-2xl font-extrabold tracking-tight">Not found</div>
                <div className="mt-1 text-sm text-muted-foreground">This CRM page doesn’t exist.</div>
              </div>
            </CrmShell>
          )} />
        </Switch>
      </Suspense>
    </Protected>
  );
}

