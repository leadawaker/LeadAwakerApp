import { useState, useEffect, useCallback } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useToast } from "@/hooks/use-toast";
import { useDashboardRefreshInterval, REFRESH_INTERVAL_OPTIONS } from "@/hooks/useDashboardRefreshInterval";
import { useSession } from "@/hooks/useSession";
import { apiFetch } from "@/lib/apiUtils";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ChangePasswordDialog } from "@/components/crm/ChangePasswordDialog";
import { cn } from "@/lib/utils";
import {
  Bell, Phone, CalendarCheck,
  MessageSquareWarning, Bot, AlertTriangle, Megaphone, TrendingDown,
  Clock, Receipt, FileText, CheckCircle, PenLine,
  Lock, Shield,
} from "lucide-react";

// ── Section navigation ───────────────────────────────────────────
type SettingsSection = "notifications" | "dashboard" | "security";

const SETTINGS_SECTIONS: { id: SettingsSection; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "notifications", label: "Notifications",  icon: Bell,       desc: "Alerts & channels" },
  { id: "dashboard",     label: "Dashboard",      icon: Clock,      desc: "Auto-refresh" },
  { id: "security",      label: "Security",       icon: Shield,     desc: "Password" },
];

// ── Types ──────────────────────────────────────────────────────────
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
  {
    label: "Billing",
    events: [
      { key: "invoice_received", label: "New Invoice Received", icon: Receipt, defaults: { in_app: true, email: true, sms: false }, roles: ["Manager", "Viewer"] },
      { key: "contract_received", label: "New Contract Received", icon: FileText, defaults: { in_app: true, email: true, sms: false }, roles: ["Manager", "Viewer"] },
      { key: "invoice_paid", label: "Invoice Marked Paid", icon: CheckCircle, defaults: { in_app: true, email: true, sms: false }, roles: ["Admin", "Operator"] },
      { key: "contract_signed", label: "Contract Signed", icon: PenLine, defaults: { in_app: true, email: true, sms: false }, roles: ["Admin", "Operator"] },
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

  // Section navigation
  const [activeSection, setActiveSection] = useState<SettingsSection>("notifications");
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  // Profile (kept for security section email display)
  const [email, setEmail] = useState("");

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(getDefaultNotifPrefs);
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);

  // Fetch email for security section display
  useEffect(() => {
    if (session.status !== "authenticated") return;
    apiFetch(`/api/users/${session.user.id}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setEmail(data.email ?? "");
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
          } catch { /* ignore */ }
        }
      })
      .catch(() => {});
  }, [session.status]);

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
      <div className="flex h-full gap-[3px]" data-testid="page-settings">

        {/* ── LEFT PANEL — Section Navigation ─────────────────────── */}
        <div className="w-[240px] shrink-0 flex flex-col bg-[#E8E8E8] rounded-lg overflow-hidden">
          <div className="px-3.5 pt-5 pb-1 shrink-0">
            <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">
              Settings
            </h2>
          </div>

          <nav className="px-2 pt-3 pb-3 flex-1 space-y-0.5">
            {SETTINGS_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "relative flex items-center rounded-full w-full",
                    "h-[43px] pl-[1.5px] pr-2 gap-2.5 transition-colors",
                    isActive
                      ? "bg-[#FFE35B] text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-card hover:text-foreground"
                  )}
                  data-testid={`nav-settings-${section.id}`}
                >
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                    !isActive && "border border-border/65"
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="text-sm font-bold leading-tight">{section.label}</span>
                    <span className={cn(
                      "text-[10px] truncate leading-tight",
                      isActive ? "text-foreground/50" : "text-muted-foreground/60"
                    )}>
                      {section.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── RIGHT PANEL — Active Section Content ────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden rounded-lg bg-card">
          <div className="flex-1 overflow-y-auto px-6 py-6">

            {/* ── Notifications Section ────────────────────────────── */}
            {activeSection === "notifications" && (
              <div className="max-w-2xl space-y-6" data-testid="card-notification-preferences">
                <div data-testid="card-notification-preferences-head">
                  <h3 className="text-lg font-semibold font-heading text-foreground" data-testid="text-notification-title">
                    Notification Preferences
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-notification-sub">
                    Control which events trigger notifications and how they reach you.
                  </p>
                </div>

                <div className="space-y-5" data-testid="card-notification-preferences-body">
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

                  {/* Event matrix */}
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
                                  className="grid grid-cols-[1fr_3rem_3rem_3rem] gap-1 items-center rounded-lg px-1 py-1.5 hover:bg-background/40 transition-colors"
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
                    <div className="pt-5 mt-5 space-y-3" style={{ borderTop: "1px solid hsl(var(--foreground) / 0.06)" }}>
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
                            className="h-10 rounded-xl border border-border/30 bg-background px-3 text-sm"
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
                            className="h-10 rounded-xl border border-border/30 bg-background px-3 text-sm"
                            data-testid="input-quiet-end"
                          />
                        </div>
                      )}
                    </div>

                    {/* Digest */}
                    <div className="pt-5 mt-5 space-y-3" style={{ borderTop: "1px solid hsl(var(--foreground) / 0.06)" }}>
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
              </div>
            )}

            {/* ── Dashboard Section ────────────────────────────────── */}
            {activeSection === "dashboard" && (
              <div className="max-w-lg space-y-6" data-testid="card-refresh-interval">
                <div data-testid="card-refresh-interval-head">
                  <h3 className="text-lg font-semibold font-heading text-foreground" data-testid="text-refresh-title">
                    Dashboard Auto-Refresh
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-refresh-sub">
                    How often the dashboard automatically refreshes live data. Default: 1 minute.
                  </p>
                </div>

                <div className="space-y-3" data-testid="card-refresh-interval-body">
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
                            ? "h-10 rounded-full border-2 border-brand-yellow bg-[#FFE35B]/30 text-sm font-bold text-foreground transition-colors"
                            : "h-10 rounded-full bg-background hover:bg-muted text-sm font-semibold text-muted-foreground transition-colors"
                        }
                        data-testid={`refresh-interval-option-${option.value}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Security Section ─────────────────────────────────── */}
            {activeSection === "security" && (
              <div className="max-w-lg space-y-6" data-testid="card-security">
                <div>
                  <h3 className="text-lg font-semibold font-heading text-foreground">
                    Security
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Manage your account password and security settings.
                  </p>
                </div>

                <div className="space-y-5">
                  {/* Password section */}
                  <div className="rounded-xl bg-background p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Password</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Update your password to keep your account secure.
                      {email && (
                        <> Signed in as <span className="font-medium text-foreground">{email}</span>.</>
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => setChangePasswordOpen(true)}
                      className="h-10 px-5 rounded-full bg-brand-blue text-white hover:opacity-90 text-sm font-semibold transition-opacity"
                      data-testid="button-change-password"
                    >
                      Change password
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Password Dialog ──────────────────────────────────────── */}
      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
        userEmail={email || null}
      />
    </CrmShell>
  );
}

