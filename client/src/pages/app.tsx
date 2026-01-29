import type { ReactElement } from "react";
import { Switch, Route, Redirect } from "wouter";
import AppDashboard from "@/pages/AppDashboard";
import AppLeads from "@/pages/AppLeads";
import AppCampaigns from "@/pages/AppCampaigns";
import AppAccounts from "@/pages/AppAccounts";

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
        <Route path="/app/leads" component={AppLeads} />
        <Route path="/app/campaigns" component={AppCampaigns} />
        <Route path="/app/accounts" component={AppAccounts} />
      </Switch>
    </Protected>
  );
}
