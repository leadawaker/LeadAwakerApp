import { CrmShell } from "@/components/crm/CrmShell";

export default function SettingsPage() {
  return (
    <CrmShell>
      <div className="px-6 py-6" data-testid="page-settings">
        <h1 className="text-2xl font-extrabold tracking-tight" data-testid="text-title">Settings</h1>
        <p className="text-sm text-muted-foreground" data-testid="text-subtitle">Mock settings page.</p>

        <div className="mt-4 rounded-2xl border border-border bg-background p-4" data-testid="card-settings">
          <div className="text-sm font-semibold" data-testid="text-settings-section">General</div>
          <div className="mt-2 text-xs text-muted-foreground" data-testid="text-settings-real">
            REAL: store settings per account in NocoDB.
          </div>
        </div>
      </div>
    </CrmShell>
  );
}
