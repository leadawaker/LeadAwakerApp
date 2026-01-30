import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { accounts, campaigns, leads, interactions } from "@/data/mocks";

export default function AppAccounts() {
  const { isAgencyView } = useWorkspace();
  const rows = useMemo(() => {
    const clients = accounts.filter((a) => a.id !== 1);
    return clients.map((a) => {
      const leadsCount = leads.filter((l) => l.account_id === a.id).length;
      const campaignsActive = campaigns.filter((c) => c.account_id === a.id && c.status === "Active").length;
      const last = interactions
        .filter((i) => i.account_id === a.id)
        .sort((x, y) => y.created_at.localeCompare(x.created_at))[0];
      return {
        account: a,
        leadsCount,
        campaignsActive,
        lastInteraction: last?.created_at ?? null,
      };
    });
  }, []);

  return (
    <CrmShell>
      <div className="px-6 py-6" data-testid="page-accounts">
        <h1 className="text-2xl font-extrabold tracking-tight" data-testid="text-title">Accounts</h1>

        <div className="mt-4 rounded-2xl border border-border bg-background overflow-hidden" data-testid="table-accounts">
          <div className="grid grid-cols-[1.2fr_140px_160px_220px] text-xs font-semibold text-muted-foreground bg-muted/20 border-b border-border px-4 py-3">
            <div>name</div>
            <div>leads_count</div>
            <div>campaigns_active</div>
            <div>last_interaction</div>
          </div>
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.account.id} className="grid grid-cols-[1.2fr_140px_160px_220px] px-4 py-3 text-sm" data-testid={`row-account-${r.account.id}`}>
                <div className="min-w-0">
                  <div className="font-semibold truncate" data-testid={`text-account-name-${r.account.id}`}>{r.account.name}</div>
                  <div className="text-xs text-muted-foreground" data-testid={`text-account-meta-${r.account.id}`}>
                    type={r.account.type} • status={r.account.status} • owner={r.account.owner_email}
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid={`text-account-twilio-${r.account.id}`}>
                    twilio_sid={r.account.twilio_account_sid}
                  </div>
                </div>
                <div className="text-muted-foreground" data-testid={`text-account-leads-${r.account.id}`}>{r.leadsCount}</div>
                <div className="text-muted-foreground" data-testid={`text-account-campaigns-${r.account.id}`}>{r.campaignsActive}</div>
                <div className="text-muted-foreground" data-testid={`text-account-last-${r.account.id}`}>
                  {r.lastInteraction ? new Date(r.lastInteraction).toLocaleString() : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </CrmShell>
  );
}
