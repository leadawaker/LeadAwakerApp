import { useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const [name, setName] = useState("LeadAwaker Agency");
  const [email, setEmail] = useState("leadawaker@gmail.com");
  const { toast } = useToast();

  return (
    <CrmShell>
      <div className="py-4" data-testid="page-settings">
        <h1 className="text-2xl font-extrabold tracking-tight" data-testid="text-title">Settings</h1>

        <div className="mt-6 grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6" data-testid="grid-settings">
          <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden" data-testid="card-edit-profile">
            <div className="p-4 border-b border-border" data-testid="card-edit-profile-head">
              <div className="font-semibold" data-testid="text-profile-title">Edit profile</div>
              <div className="text-xs text-muted-foreground" data-testid="text-profile-sub">
                Update your display info (mock only).
              </div>
            </div>
            <div className="p-4 space-y-4" data-testid="card-edit-profile-body">
              <Field label="Name" value={name} onChange={setName} testId="input-profile-name" />
              <Field label="Email" value={email} onChange={setEmail} testId="input-profile-email" />

              <div className="flex justify-end" data-testid="row-profile-actions">
                <button
                  type="button"
                  className="h-10 px-3 rounded-xl border border-border bg-primary text-primary-foreground hover:opacity-90 text-sm font-semibold"
                  data-testid="button-save-profile"
                  onClick={() => toast({ variant: "success", title: "Profile saved", description: "Your changes have been saved." })}
                >
                  Save changes
                </button>
              </div>

            </div>
          </section>

          <div className="space-y-6" data-testid="col-settings-right">
            <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden" data-testid="card-toast-test">
              <div className="p-4 border-b border-border" data-testid="card-toast-test-head">
                <div className="font-semibold" data-testid="text-toast-title">Toast Notifications</div>
                <div className="text-xs text-muted-foreground" data-testid="text-toast-sub">
                  Preview notification styles.
                </div>
              </div>
              <div className="p-4 space-y-3" data-testid="card-toast-test-body">
                <button
                  type="button"
                  className="h-10 w-full rounded-xl border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-sm font-semibold text-green-700 dark:text-green-400"
                  data-testid="button-toast-success"
                  onClick={() => toast({ variant: "success", title: "Success", description: "Operation completed successfully." })}
                >
                  Show Success Toast
                </button>
                <button
                  type="button"
                  className="h-10 w-full rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-sm font-semibold text-red-700 dark:text-red-400"
                  data-testid="button-toast-error"
                  onClick={() => toast({ variant: "destructive", title: "Error", description: "Something went wrong. Please try again." })}
                >
                  Show Error Toast
                </button>
                <button
                  type="button"
                  className="h-10 w-full rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-sm font-semibold text-blue-700 dark:text-blue-400"
                  data-testid="button-toast-info"
                  onClick={() => toast({ variant: "info", title: "Info", description: "New campaign data is being synced." })}
                >
                  Show Info Toast
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden" data-testid="card-reset-password">
              <div className="p-4 border-b border-border" data-testid="card-reset-password-head">
                <div className="font-semibold" data-testid="text-password-title">Reset password</div>
                <div className="text-xs text-muted-foreground" data-testid="text-password-sub">
                  Generate a password reset flow (mock).
                </div>
              </div>
              <div className="p-4" data-testid="card-reset-password-body">
                <button
                  type="button"
                  className="h-10 w-full rounded-xl border border-border bg-muted/20 hover:bg-muted/30 text-sm font-semibold"
                  data-testid="button-reset-password"
                >
                  Send reset email
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden" data-testid="card-user-management">
              <div className="p-4 border-b border-border" data-testid="card-user-management-head">
                <div className="font-semibold" data-testid="text-users-title">User management</div>
                <div className="text-xs text-muted-foreground" data-testid="text-users-sub">
                  Invite users + set roles (mock).
                </div>
              </div>
              <div className="p-4 space-y-3" data-testid="card-user-management-body">
                <button
                  type="button"
                  className="h-10 w-full rounded-xl border border-border bg-muted/20 hover:bg-muted/30 text-sm font-semibold"
                  data-testid="button-invite-user"
                >
                  Invite user
                </button>
                <button
                  type="button"
                  className="h-10 w-full rounded-xl border border-border bg-muted/20 hover:bg-muted/30 text-sm font-semibold"
                  data-testid="button-manage-roles"
                >
                  Manage roles
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </CrmShell>
  );
}

function Field({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
}) {
  return (
    <div data-testid={`${testId}-wrap`}>
      <label className="text-xs text-muted-foreground" data-testid={`${testId}-label`}>
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-border bg-muted/20 px-3 text-sm"
        data-testid={testId}
      />
    </div>
  );
}
