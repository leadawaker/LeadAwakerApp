import { Topbar } from "@/components/crm/Topbar";
import { Sidebar } from "@/components/crm/Sidebar";
import { accounts } from "@/data/mocks";

export default function AppAccounts() {
  const a = accounts[0];
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/20 to-background" data-testid="page-app-accounts">
      <Topbar />
      <div className="mx-auto max-w-[1440px] px-4 md:px-6 py-6 flex gap-6">
        <Sidebar />
        <div className="flex-1 min-w-0">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight" data-testid="text-accounts-title">
              Accounts
            </h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-accounts-subtitle">
              Agency prototype: hardcoded account_id=1.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="grid-accounts">
            <div className="rounded-2xl border border-border bg-background p-4" data-testid="card-account-1">
              <div className="text-xs text-muted-foreground" data-testid="text-account-field-id">id</div>
              <div className="font-semibold" data-testid="text-account-id">{a.id}</div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground" data-testid="text-account-field-name">name</div>
                  <div className="font-semibold" data-testid="text-account-name">{a.name}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground" data-testid="text-account-field-type">type</div>
                  <div className="font-semibold" data-testid="text-account-type">{a.type}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground" data-testid="text-account-field-status">status</div>
                  <div className="font-semibold" data-testid="text-account-status">{a.status}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground" data-testid="text-account-field-timezone">timezone</div>
                  <div className="font-semibold" data-testid="text-account-timezone">{a.timezone}</div>
                </div>
              </div>

              <div className="mt-4 text-xs text-muted-foreground" data-testid="text-account-real-comment">
                REAL: fetch from NocoDB Accounts table
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
