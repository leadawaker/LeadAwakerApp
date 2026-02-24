import { useState, useEffect, useCallback } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useToast } from "@/hooks/use-toast";
import { useDashboardRefreshInterval, REFRESH_INTERVAL_OPTIONS } from "@/hooks/useDashboardRefreshInterval";
import { useSession } from "@/hooks/useSession";
import { apiFetch } from "@/lib/apiUtils";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ChangePasswordDialog } from "@/components/crm/ChangePasswordDialog";
import {
  Globe, Bell, Phone, CalendarCheck,
  MessageSquareWarning, Bot, AlertTriangle, Megaphone, TrendingDown,
  Clock,
} from "lucide-react";

// ── Timezone list ──────────────────────────────────────────────────
const TIMEZONE_LIST: string[] = (() => {
  try {
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      return (Intl as any).supportedValuesOf("timeZone") as string[];
    }
  } catch { /* fallback */ }
  return [
    "Africa/Abidjan","Africa/Accra","Africa/Cairo","Africa/Johannesburg","Africa/Lagos","Africa/Nairobi",
    "America/Anchorage","America/Argentina/Buenos_Aires","America/Bogota","America/Chicago",
    "America/Denver","America/Halifax","America/Lima","America/Los_Angeles","America/Mexico_City",
    "America/New_York","America/Phoenix","America/Santiago","America/Sao_Paulo","America/Toronto",
    "America/Vancouver","Asia/Bangkok","Asia/Colombo","Asia/Dubai","Asia/Hong_Kong","Asia/Jakarta",
    "Asia/Karachi","Asia/Kolkata","Asia/Kuala_Lumpur","Asia/Manila","Asia/Seoul","Asia/Shanghai",
    "Asia/Singapore","Asia/Taipei","Asia/Tehran","Asia/Tokyo","Atlantic/Reykjavik",
    "Australia/Adelaide","Australia/Brisbane","Australia/Melbourne","Australia/Perth","Australia/Sydney",
    "Europe/Amsterdam","Europe/Athens","Europe/Berlin","Europe/Brussels","Europe/Budapest",
    "Europe/Copenhagen","Europe/Dublin","Europe/Helsinki","Europe/Istanbul","Europe/Kiev",
    "Europe/Lisbon","Europe/London","Europe/Madrid","Europe/Moscow","Europe/Oslo",
    "Europe/Paris","Europe/Prague","Europe/Rome","Europe/Sofia","Europe/Stockholm",
    "Europe/Vienna","Europe/Warsaw","Europe/Zurich","Pacific/Auckland","Pacific/Fiji",
    "Pacific/Guam","Pacific/Honolulu","Pacific/Midway","UTC",
  ];
})();

// ── Types ──────────────────────────────────────────────────────────
type UserProfile = {
  id: number;
  fullName1: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  timezone: string | null;
  role: string | null;
  status: string | null;
  accountsId: number | null;
};

type NotificationChannel = { in_app: boolean; email: boolean; sms: boolean };

type NotificationPreferences = {
  master_enabled: boolean;
  events: Record<string, NotificationChannel>;
  quiet_hours: { enabled: boolean; start: string; end: string };
  digest: { daily_summary: boolean; weekly_report: boolean };
};

// ── Notification event definitions ─────────────────────────────────
type NotifEventDef = {
  key: string;
  label: string;
  icon: React.ElementType;
  defaults: NotificationChannel;
  /** Roles that can see this event. undefined = all roles */
  roles?: string[];
};

type NotifCategory = {
  label: string;
  events: NotifEventDef[];
};

const NOTIF_CATEGORIES: NotifCategory[] = [
  {
    label: "Lead Activity",
    events: [
      { key: "call_booked", label: "Call Booked", icon: CalendarCheck, defaults: { in_app: true, email: true, sms: true } },
      { key: "lead_responded", label: "Lead Responded", icon: MessageSquareWarning, defaults: { in_app: true, email: true, sms: false } },
      { key: "lead_qualified", label: "Lead Qualified", icon: TrendingDown, defaults: { in_app: true, email: false, sms: false }, roles: ["Admin", "Operator", "Manager"] },
      { key: "lead_opted_out", label: "Lead Opted Out / DND", icon: Phone, defaults: { in_app: true, email: false, sms: false }, roles: ["Admin", "Operator", "Manager"] },
    ],
  },
  {
    label: "AI & Automation",
    events: [
      { key: "ai_needs_takeover", label: "AI Needs Takeover", icon: Bot, defaults: { in_app: true, email: true, sms: true }, roles: ["Admin", "Operator", "Manager"] },
      { key: "automation_error", label: "Automation Error", icon: AlertTriangle, defaults: { in_app: true, email: true, sms: false }, roles: ["Admin", "Operator"] },
    ],
  },
  {
    label: "Campaigns",
    events: [
      { key: "campaign_completed", label: "Campaign Completed", icon: Megaphone, defaults: { in_app: true, email: false, sms: false } },
      { key: "performance_alert", label: "Performance Alert", icon: TrendingDown, defaults: { in_app: true, email: true, sms: false }, roles: ["Admin", "Operator", "Manager"] },
    ],
  },
];

function getDefaultNotifPrefs(): NotificationPreferences {
  const events: Record<string, NotificationChannel> = {};
  for (const cat of NOTIF_CATEGORIES) {
    for (const ev of cat.events) {
      events[ev.key] = { ...ev.defaults };
    }
  }
  return {
    master_enabled: true,
    events,
    quiet_hours: { enabled: false, start: "22:00", end: "08:00" },
    digest: { daily_summary: false, weekly_report: false },
  };
}

// ── Main Component ─────────────────────────────────────────────────
export default function SettingsPage() {
  const { toast } = useToast();

  const { intervalSeconds, setIntervalSeconds, labelForInterval } = useDashboardRefreshInterval();
  const session = useSession();

  // Profile
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [timezone, setTimezone] = useState("");

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(getDefaultNotifPrefs);
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);

  // Fetch profile + preferences on session load
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
        const data = await res.json();
        setProfile(data);
        setName(data.fullName1 ?? "");
        setEmail(data.email ?? "");
        setPhone(data.phone ?? "");
        setAvatarUrl(data.avatarUrl ?? "");
        setTimezone(data.timezone ?? "");

        // Load notification preferences from preferences JSON
        if (data.preferences) {
          try {
            const parsed = typeof data.preferences === "string" ? JSON.parse(data.preferences) : data.preferences;
            if (parsed.notifications) {
              setNotifPrefs((prev) => ({
                ...prev,
                ...parsed.notifications,
                events: { ...prev.events, ...parsed.notifications.events },
                quiet_hours: { ...prev.quiet_hours, ...parsed.notifications.quiet_hours },
                digest: { ...prev.digest, ...parsed.notifications.digest },
              }));
            }
          } catch { /* ignore malformed JSON */ }
        }
      })
      .catch((err) => setProfileError(err.message || "Failed to load profile"))
      .finally(() => setProfileLoading(false));
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
          timezone: timezone.trim() || null,
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
      setTimezone(updated.timezone ?? "");
      toast({ variant: "success", title: "Profile saved", description: "Your changes have been saved." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Save failed", description: err.message || "Could not save profile." });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Save notification preferences ────────────────────────────────
  const saveNotifPrefs = useCallback(async (updated: NotificationPreferences) => {
    if (session.status !== "authenticated") return;
    setIsSavingNotifs(true);
    try {
      const existingPrefsStr = localStorage.getItem("leadawaker_user_preferences") ?? "{}";
      let existingPrefs: Record<string, unknown> = {};
      try { existingPrefs = JSON.parse(existingPrefsStr); } catch { existingPrefs = {}; }
      const merged = { ...existingPrefs, notifications: updated };
      localStorage.setItem("leadawaker_user_preferences", JSON.stringify(merged));

      await apiFetch(`/api/users/${session.user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: JSON.stringify(merged) }),
      });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to save notification preferences." });
    } finally {
      setIsSavingNotifs(false);
    }
  }, [session, toast]);

  const updateNotifPrefs = useCallback((updater: (prev: NotificationPreferences) => NotificationPreferences) => {
    setNotifPrefs((prev) => {
      const next = updater(prev);
      saveNotifPrefs(next);
      return next;
    });
  }, [saveNotifPrefs]);

  const userRole = session.status === "authenticated" ? (session.user.role ?? "Viewer") : "Viewer";

  return (
    <CrmShell>
      <div className="py-4" data-testid="page-settings">
        {/* ── Two-column grid ──────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start" data-testid="grid-settings">

          {/* LEFT COLUMN — Edit Profile */}
          <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden" data-testid="card-edit-profile">
            <div className="p-4 border-b border-border" data-testid="card-edit-profile-head">
              <div className="font-semibold" data-testid="text-profile-title">Edit profile</div>
              <div className="text-xs text-muted-foreground" data-testid="text-profile-sub">
                Update your display name, email, phone, and avatar.
              </div>
            </div>
            <div className="p-4 space-y-4" data-testid="card-edit-profile-body">
              {profileLoading ? (
                <div className="text-sm text-muted-foreground" data-testid="profile-loading">Loading profile…</div>
              ) : profileError ? (
                <div className="text-sm text-red-500" data-testid="profile-error">{profileError}</div>
              ) : (
                <>
                  <Field label="Name" value={name} onChange={setName} testId="input-profile-name" placeholder="Your full name" />
                  <Field label="Email" value={email} onChange={setEmail} testId="input-profile-email" placeholder="your@email.com" type="email" />
                  <Field label="Phone" value={phone} onChange={setPhone} testId="input-profile-phone" placeholder="+1 (555) 000-0000" type="tel" />
                  <Field label="Avatar URL" value={avatarUrl} onChange={setAvatarUrl} testId="input-profile-avatar-url" placeholder="https://example.com/avatar.png" />

                  <div data-testid="input-profile-timezone-wrap">
                    <label htmlFor="profile-timezone-select" className="text-xs text-muted-foreground flex items-center gap-1" data-testid="input-profile-timezone-label">
                      <Globe className="h-3 w-3" /> Timezone
                    </label>
                    <select
                      id="profile-timezone-select"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="mt-1 h-10 w-full rounded-xl border border-border bg-muted/20 px-3 text-sm dark:bg-muted/10 dark:text-foreground"
                      data-testid="select-profile-timezone"
                      aria-label="Select timezone"
                    >
                      <option value="">— Select timezone —</option>
                      {TIMEZONE_LIST.map((tz) => (
                        <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                    {timezone && (
                      <p className="mt-1 text-xs text-muted-foreground" data-testid="text-current-timezone">
                        Current: <span className="font-medium text-foreground">{timezone.replace(/_/g, " ")}</span>
                      </p>
                    )}
                  </div>

                  {avatarUrl && (
                    <div className="flex items-center gap-3" data-testid="avatar-preview">
                      <img
                        src={avatarUrl}
                        alt="Avatar preview"
                        className="h-12 w-12 rounded-full object-cover border border-border"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
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

          {/* RIGHT COLUMN — Notifications + Dashboard Refresh */}
          <div className="space-y-6">
            {/* ── Notification Preferences ─────────────────────────── */}
            <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden" data-testid="card-notification-preferences">
              <div className="p-4 border-b border-border" data-testid="card-notification-preferences-head">
                <div className="font-semibold flex items-center gap-2" data-testid="text-notification-title">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  Notification Preferences
                </div>
                <div className="text-xs text-muted-foreground" data-testid="text-notification-sub">
                  Control which events trigger notifications and how they reach you.
                </div>
              </div>
              <div className="p-4 space-y-5" data-testid="card-notification-preferences-body">
                {/* Master toggle */}
                <div className="flex items-center justify-between gap-4" data-testid="row-notification-master">
                  <div>
                    <div className="text-sm font-medium">All Notifications</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {isSavingNotifs && <span className="italic">Saving…</span>}
                    </div>
                  </div>
                  <Switch
                    checked={notifPrefs.master_enabled}
                    onCheckedChange={(checked) => updateNotifPrefs((p) => ({ ...p, master_enabled: checked }))}
                    data-testid="toggle-notification-master"
                    aria-label="Toggle all notifications"
                  />
                </div>

                {/* Event matrix — grayed out when master is off */}
                <div className={notifPrefs.master_enabled ? "" : "opacity-50 pointer-events-none"}>
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_3rem_3rem_3rem] gap-1 mb-2 px-1">
                    <div />
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">App</div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">Email</div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">SMS</div>
                  </div>

                  {NOTIF_CATEGORIES.map((cat) => {
                    const visibleEvents = cat.events.filter(
                      (ev) => !ev.roles || ev.roles.includes(userRole)
                    );
                    if (visibleEvents.length === 0) return null;

                    return (
                      <div key={cat.label} className="mb-4">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                          {cat.label}
                        </div>
                        <div className="space-y-1">
                          {visibleEvents.map((ev) => {
                            const channel = notifPrefs.events[ev.key] ?? ev.defaults;
                            const Icon = ev.icon;
                            return (
                              <div
                                key={ev.key}
                                className="grid grid-cols-[1fr_3rem_3rem_3rem] gap-1 items-center rounded-lg px-1 py-1.5 hover:bg-muted/30 transition-colors"
                                data-testid={`row-notif-${ev.key}`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="text-sm truncate">{ev.label}</span>
                                </div>
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={channel.in_app}
                                    onCheckedChange={(checked) =>
                                      updateNotifPrefs((p) => ({
                                        ...p,
                                        events: { ...p.events, [ev.key]: { ...channel, in_app: !!checked } },
                                      }))
                                    }
                                    aria-label={`${ev.label} in-app`}
                                    data-testid={`check-${ev.key}-in-app`}
                                  />
                                </div>
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={channel.email}
                                    onCheckedChange={(checked) =>
                                      updateNotifPrefs((p) => ({
                                        ...p,
                                        events: { ...p.events, [ev.key]: { ...channel, email: !!checked } },
                                      }))
                                    }
                                    aria-label={`${ev.label} email`}
                                    data-testid={`check-${ev.key}-email`}
                                  />
                                </div>
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={channel.sms}
                                    onCheckedChange={(checked) =>
                                      updateNotifPrefs((p) => ({
                                        ...p,
                                        events: { ...p.events, [ev.key]: { ...channel, sms: !!checked } },
                                      }))
                                    }
                                    aria-label={`${ev.label} SMS`}
                                    data-testid={`check-${ev.key}-sms`}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Quiet Hours */}
                  <div className="border-t border-border pt-4 mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">Quiet Hours</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Email and SMS held during quiet hours. In-app still appears.
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={notifPrefs.quiet_hours.enabled}
                        onCheckedChange={(checked) =>
                          updateNotifPrefs((p) => ({
                            ...p,
                            quiet_hours: { ...p.quiet_hours, enabled: checked },
                          }))
                        }
                        data-testid="toggle-quiet-hours"
                        aria-label="Toggle quiet hours"
                      />
                    </div>
                    {notifPrefs.quiet_hours.enabled && (
                      <div className="flex items-center gap-3 pl-6">
                        <label className="text-xs text-muted-foreground">Start</label>
                        <input
                          type="time"
                          value={notifPrefs.quiet_hours.start}
                          onChange={(e) =>
                            updateNotifPrefs((p) => ({
                              ...p,
                              quiet_hours: { ...p.quiet_hours, start: e.target.value },
                            }))
                          }
                          className="h-9 rounded-xl border border-border bg-muted/20 px-3 text-sm"
                          data-testid="input-quiet-start"
                        />
                        <label className="text-xs text-muted-foreground">End</label>
                        <input
                          type="time"
                          value={notifPrefs.quiet_hours.end}
                          onChange={(e) =>
                            updateNotifPrefs((p) => ({
                              ...p,
                              quiet_hours: { ...p.quiet_hours, end: e.target.value },
                            }))
                          }
                          className="h-9 rounded-xl border border-border bg-muted/20 px-3 text-sm"
                          data-testid="input-quiet-end"
                        />
                      </div>
                    )}
                  </div>

                  {/* Digest */}
                  <div className="border-t border-border pt-4 mt-4 space-y-3">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Digest</div>
                    <div className="flex items-center justify-between gap-4 px-1">
                      <div className="text-sm">Daily Summary Email</div>
                      <Switch
                        checked={notifPrefs.digest.daily_summary}
                        onCheckedChange={(checked) =>
                          updateNotifPrefs((p) => ({
                            ...p,
                            digest: { ...p.digest, daily_summary: checked },
                          }))
                        }
                        data-testid="toggle-digest-daily"
                        aria-label="Toggle daily summary email"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 px-1">
                      <div className="text-sm">Weekly Report Email</div>
                      <Switch
                        checked={notifPrefs.digest.weekly_report}
                        onCheckedChange={(checked) =>
                          updateNotifPrefs((p) => ({
                            ...p,
                            digest: { ...p.digest, weekly_report: checked },
                          }))
                        }
                        data-testid="toggle-digest-weekly"
                        aria-label="Toggle weekly report email"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Dashboard Auto-Refresh ───────────────────────────── */}
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
          </div>
        </div>

      </div>
    </CrmShell>
  );
}

// ── Reusable text field ────────────────────────────────────────────
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
