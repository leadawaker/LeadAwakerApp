import { useState, useEffect } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useToast } from "@/hooks/use-toast";
import { useDashboardRefreshInterval, REFRESH_INTERVAL_OPTIONS } from "@/hooks/useDashboardRefreshInterval";
import { useSession } from "@/hooks/useSession";
import { apiFetch } from "@/lib/apiUtils";
import { Switch } from "@/components/ui/switch";
import { Mail, MessageSquare } from "lucide-react";

// Full user profile shape returned by GET /api/users/:id
type UserProfile = {
  id: number;
  fullName1: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: string | null;
  status: string | null;
  accountsId: number | null;
};

export default function SettingsPage() {
  const { toast } = useToast();
  const { intervalSeconds, setIntervalSeconds, labelForInterval } = useDashboardRefreshInterval();
  const session = useSession();

  // Profile form state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form field values (local editable state)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Fetch user profile once session is loaded
  useEffect(() => {
    if (session.status === "loading") return;
    if (session.status === "unauthenticated") {
      setProfileLoading(false);
      setProfileError("Not authenticated");
      return;
    }

    const userId = session.user.id;
    setProfileLoading(true);
    setProfileError(null);

    apiFetch(`/api/users/${userId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load profile (${res.status})`);
        const data: UserProfile = await res.json();
        setProfile(data);
        setName(data.fullName1 ?? "");
        setEmail(data.email ?? "");
        setPhone(data.phone ?? "");
        setAvatarUrl(data.avatarUrl ?? "");
      })
      .catch((err) => {
        setProfileError(err.message || "Failed to load profile");
      })
      .finally(() => {
        setProfileLoading(false);
      });
  }, [session.status]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      const res = await apiFetch(`/api/users/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName1: name.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          avatarUrl: avatarUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Save failed (${res.status})`);
      }
      const updated: UserProfile = await res.json();
      setProfile(updated);
      setName(updated.fullName1 ?? "");
      setEmail(updated.email ?? "");
      setPhone(updated.phone ?? "");
      setAvatarUrl(updated.avatarUrl ?? "");
      toast({ variant: "success", title: "Profile saved", description: "Your changes have been saved." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Save failed", description: err.message || "Could not save profile." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <CrmShell>
      <div className="py-4" data-testid="page-settings">
        <h1 className="text-2xl font-extrabold tracking-tight" data-testid="text-title">Settings</h1>

        <div className="mt-6 grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6" data-testid="grid-settings">
          <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden" data-testid="card-edit-profile">
            <div className="p-4 border-b border-border" data-testid="card-edit-profile-head">
              <div className="font-semibold" data-testid="text-profile-title">Edit profile</div>
              <div className="text-xs text-muted-foreground" data-testid="text-profile-sub">
                Update your display name, email, phone, and avatar.
              </div>
            </div>
            <div className="p-4 space-y-4" data-testid="card-edit-profile-body">
              {profileLoading ? (
                <div className="text-sm text-muted-foreground" data-testid="profile-loading">
                  Loading profile…
                </div>
              ) : profileError ? (
                <div className="text-sm text-red-500" data-testid="profile-error">
                  {profileError}
                </div>
              ) : (
                <>
                  <Field
                    label="Name"
                    value={name}
                    onChange={setName}
                    testId="input-profile-name"
                    placeholder="Your full name"
                  />
                  <Field
                    label="Email"
                    value={email}
                    onChange={setEmail}
                    testId="input-profile-email"
                    placeholder="your@email.com"
                    type="email"
                  />
                  <Field
                    label="Phone"
                    value={phone}
                    onChange={setPhone}
                    testId="input-profile-phone"
                    placeholder="+1 (555) 000-0000"
                    type="tel"
                  />
                  <Field
                    label="Avatar URL"
                    value={avatarUrl}
                    onChange={setAvatarUrl}
                    testId="input-profile-avatar-url"
                    placeholder="https://example.com/avatar.png"
                  />

                  {/* Avatar preview */}
                  {avatarUrl && (
                    <div className="flex items-center gap-3" data-testid="avatar-preview">
                      <img
                        src={avatarUrl}
                        alt="Avatar preview"
                        className="h-12 w-12 rounded-full object-cover border border-border"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <span className="text-xs text-muted-foreground">Avatar preview</span>
                    </div>
                  )}

                  <div className="flex justify-end" data-testid="row-profile-actions">
                    <button
                      type="button"
                      className="h-10 px-4 rounded-xl border border-border bg-primary text-primary-foreground hover:opacity-90 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="button-save-profile"
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>

          <div className="space-y-6" data-testid="col-settings-right">
            {/* Dashboard auto-refresh interval setting */}
            <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden" data-testid="card-refresh-interval">
              <div className="p-4 border-b border-border" data-testid="card-refresh-interval-head">
                <div className="font-semibold" data-testid="text-refresh-title">Dashboard Auto-Refresh</div>
                <div className="text-xs text-muted-foreground" data-testid="text-refresh-sub">
                  How often the dashboard automatically refreshes live data. Default: 1 minute.
                </div>
              </div>
              <div className="p-4 space-y-3" data-testid="card-refresh-interval-body">
                <div className="text-xs text-muted-foreground mb-1">
                  Current interval: <span className="font-bold text-foreground" data-testid="text-current-interval">{labelForInterval}</span>
                </div>
                <div className="grid grid-cols-3 gap-2" data-testid="refresh-interval-options">
                  {REFRESH_INTERVAL_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setIntervalSeconds(option.value);
                        toast({
                          variant: "success",
                          title: "Refresh interval updated",
                          description: option.value === 0
                            ? "Auto-refresh is now disabled."
                            : `Dashboard will refresh every ${option.label}.`,
                        });
                      }}
                      className={
                        intervalSeconds === option.value
                          ? "h-9 rounded-xl border-2 border-brand-yellow bg-brand-yellow/10 text-sm font-bold text-foreground transition-all"
                          : "h-9 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 text-sm font-semibold transition-all"
                      }
                      data-testid={`refresh-interval-option-${option.value}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

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
                  className="h-10 w-full rounded-xl border border-brand-blue/30 bg-brand-blue/10 hover:bg-brand-blue/20 text-sm font-semibold text-brand-blue"
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
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div data-testid={`${testId}-wrap`}>
      <label className="text-xs text-muted-foreground" data-testid={`${testId}-label`}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-border bg-muted/20 px-3 text-sm"
        data-testid={testId}
        placeholder={placeholder}
      />
    </div>
  );
}
