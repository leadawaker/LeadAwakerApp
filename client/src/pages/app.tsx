import type { ReactElement } from "react";
import { Switch, Route, Redirect } from "wouter";
import { CrmShell } from "@/components/crm/CrmShell";

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

export default function AppArea() {
  return (
    <Protected>
      <Switch>
        <Route path="/app" component={() => <Redirect to="/app/dashboard" />} />
        <Route path="/app/dashboard" component={AppDashboard} />
        <Route path="/app/contacts" component={AppLeads} />
        <Route path="/app/leads" component={AppLeads} />
        <Route path="/app/conversations" component={ConversationsPage} />
        <Route path="/app/contacts/:id" component={LeadDetailPage} />
        <Route path="/app/lead/:id" component={() => <Redirect to="/app/contacts" />} />
        <Route path="/app/campaigns" component={AppCampaigns} />
        <Route path="/app/accounts" component={AppAccounts} />
        <Route path="/app/calendar" component={CalendarPage} />
        <Route path="/app/automation-logs" component={AutomationLogsPage} />
        <Route path="/app/users" component={UsersPage} />
        <Route path="/app/tags" component={TagsPage} />
        <Route path="/app/prompt-library" component={PromptLibraryPage} />
        <Route path="/app/settings" component={SettingsPage} />
        <Route component={() => (
          <CrmShell>
            <div className="px-6 py-6" data-testid="page-app-notfound">
              <div className="text-2xl font-extrabold tracking-tight">Not found</div>
              <div className="mt-1 text-sm text-muted-foreground">This CRM page doesn’t exist.</div>
            </div>
          </CrmShell>
        )} />
      </Switch>
    </Protected>
  );
}

