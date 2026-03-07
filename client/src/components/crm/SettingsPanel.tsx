import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useDashboardRefreshInterval, REFRESH_INTERVAL_OPTIONS } from "@/hooks/useDashboardRefreshInterval";
import { useSession } from "@/hooks/useSession";
import { apiFetch } from "@/lib/apiUtils";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Bell, Phone, CalendarCheck,
  MessageSquareWarning, Bot, AlertTriangle, Megaphone, TrendingDown,
  Clock, Receipt, FileText, CheckCircle, PenLine,
  Lock, Shield, Eye, EyeOff, X as XIcon, Globe,
} from "lucide-react";
import { LanguageSelector } from "@/components/crm/LanguageSelector";

// ── Types ──────────────────────────────────────────────────────────
type NotificationChannel = { in_app: boolean; email: boolean; sms: boolean };

type NotificationPreferences = {
  master_enabled: boolean;
  events: Record<string, NotificationChannel>;
  quiet_hours: { enabled: boolean; start: string; end: string };
  digest: { daily_summary: boolean; weekly_report: boolean };
};

type NotifEventDef = {
  key: string;
  label: string;
  icon: React.ElementType;
  defaults: NotificationChannel;
  roles?: string[];
};

type NotifCategory = { labelKey: string; events: NotifEventDef[] };

// Translation keys for category and event labels
const NOTIF_CAT_KEYS: Record<string, string> = {
  "Lead Activity": "notifications.categories.leadActivity",
  "AI & Automation": "notifications.categories.aiAutomation",
  "Campaigns": "notifications.categories.campaigns",
  "Billing": "notifications.categories.billing",
};

const NOTIF_EVENT_KEYS: Record<string, string> = {
  call_booked: "notifications.events.callBooked",
  lead_responded: "notifications.events.leadResponded",
  lead_qualified: "notifications.events.leadQualified",
  lead_opted_out: "notifications.events.leadOptedOut",
  ai_needs_takeover: "notifications.events.aiNeedsTakeover",
  automation_error: "notifications.events.automationError",
  campaign_completed: "notifications.events.campaignCompleted",
  performance_alert: "notifications.events.performanceAlert",
  invoice_received: "notifications.events.invoiceReceived",
  contract_received: "notifications.events.contractReceived",
  invoice_paid: "notifications.events.invoicePaid",
  contract_signed: "notifications.events.contractSigned",
};

const NOTIF_CATEGORIES: NotifCategory[] = [
  {
    labelKey: "Lead Activity",
    events: [
      { key: "call_booked",    label: "Call Booked",          icon: CalendarCheck,        defaults: { in_app: true,  email: true,  sms: true  } },
      { key: "lead_responded", label: "Lead Responded",       icon: MessageSquareWarning, defaults: { in_app: true,  email: true,  sms: false } },
      { key: "lead_qualified", label: "Lead Qualified",       icon: TrendingDown,         defaults: { in_app: true,  email: false, sms: false }, roles: ["Admin","Operator","Manager"] },
      { key: "lead_opted_out", label: "Lead Opted Out / DND", icon: Phone,                defaults: { in_app: true,  email: false, sms: false }, roles: ["Admin","Operator","Manager"] },
    ],
  },
  {
    labelKey: "AI & Automation",
    events: [
      { key: "ai_needs_takeover", label: "AI Needs Takeover", icon: Bot,           defaults: { in_app: true, email: true, sms: true  }, roles: ["Admin","Operator","Manager"] },
      { key: "automation_error",  label: "Automation Error",  icon: AlertTriangle, defaults: { in_app: true, email: true, sms: false }, roles: ["Admin","Operator"] },
    ],
  },
  {
    labelKey: "Campaigns",
    events: [
      { key: "campaign_completed", label: "Campaign Completed", icon: Megaphone,    defaults: { in_app: true, email: false, sms: false } },
      { key: "performance_alert",  label: "Performance Alert",  icon: TrendingDown, defaults: { in_app: true, email: true,  sms: false }, roles: ["Admin","Operator","Manager"] },
    ],
  },
  {
    labelKey: "Billing",
    events: [
      { key: "invoice_received",  label: "New Invoice Received",  icon: Receipt,     defaults: { in_app: true, email: true, sms: false }, roles: ["Manager","Viewer"] },
      { key: "contract_received", label: "New Contract Received", icon: FileText,    defaults: { in_app: true, email: true, sms: false }, roles: ["Manager","Viewer"] },
      { key: "invoice_paid",      label: "Invoice Marked Paid",   icon: CheckCircle, defaults: { in_app: true, email: true, sms: false }, roles: ["Admin","Operator"] },
      { key: "contract_signed",   label: "Contract Signed",       icon: PenLine,     defaults: { in_app: true, email: true, sms: false }, roles: ["Admin","Operator"] },
    ],
  },
];

function getDefaultNotifPrefs(): NotificationPreferences {
  const events: Record<string, NotificationChannel> = {};
  for (const cat of NOTIF_CATEGORIES)
    for (const ev of cat.events)
      events[ev.key] = { ...ev.defaults };
  return {
    master_enabled: true,
    events,
    quiet_hours: { enabled: false, start: "22:00", end: "08:00" },
    digest: { daily_summary: false, weekly_report: false },
  };
}

// ── Section divider ────────────────────────────────────────────────
function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ── Password field ─────────────────────────────────────────────────
function PasswordField({
  label, value, onChange, show, onToggleShow, testId, placeholder, autoComplete,
}: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggleShow: () => void;
  testId: string; placeholder: string; autoComplete: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="relative mt-1">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-xl border border-border/30 bg-input-bg px-3 pr-10 text-sm"
          data-testid={testId}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={onToggleShow}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ── SettingsPanel ──────────────────────────────────────────────────
export function SettingsPanel() {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const { intervalSeconds, setIntervalSeconds, labelForInterval } = useDashboardRefreshInterval();
  const session = useSession();

  const [email, setEmail] = useState("");
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(getDefaultNotifPrefs);
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);

  // ── Password card state ──────────────────────────────────────────
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChanging, setIsChanging] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const closePwCard = () => {
    setPwOpen(false);
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    setPwError(null);
    setShowCurrent(false); setShowNew(false); setShowConfirm(false);
  };

  // ── Fetch user prefs ─────────────────────────────────────────────
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

  // ── Save notif prefs ─────────────────────────────────────────────
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
      toast({ variant: "destructive", title: t("security.error"), description: t("security.failedSave") });
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

  // ── Change password ──────────────────────────────────────────────
  const handleChangePassword = async () => {
    setPwError(null);
    if (!currentPassword || !newPassword || !confirmPassword) { setPwError(t("security.allFieldsRequired")); return; }
    if (newPassword.length < 6) { setPwError(t("security.minLength")); return; }
    if (newPassword !== confirmPassword) { setPwError(t("security.passwordsMismatch")); return; }
    setIsChanging(true);
    try {
      const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed (${res.status})`);
      }
      toast({ variant: "success", title: t("security.passwordChanged"), description: t("security.passwordUpdated") });
      closePwCard();
    } catch (err: any) {
      setPwError(err.message || "Failed to change password.");
    } finally {
      setIsChanging(false);
    }
  };

  const handleResetEmail = async () => {
    setIsResetting(true);
    try {
      const res = await apiFetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      toast({ variant: "success", title: t("security.resetEmailSent"), description: t("security.checkInbox") });
    } catch {
      toast({ variant: "info", title: t("security.notAvailable"), description: t("security.resetNotAvailable") });
    } finally {
      setIsResetting(false);
    }
  };

  const userRole = session.status === "authenticated" ? (session.user.role ?? "Viewer") : "Viewer";

  return (
    <div className="flex flex-col h-full" data-testid="settings-panel">
      <div className="flex-1 overflow-y-auto scrollbar-visible px-5 pt-3 pb-8 space-y-6">

        {/* ── LANGUAGE ─────────────────────────────────────────── */}
        <section data-testid="card-language">
          <SectionLabel icon={Globe} label={t("language.label")} />
          <div className="mt-3">
            <LanguageSelector />
          </div>
        </section>

        {/* ── NOTIFICATIONS ─────────────────────────────────────── */}
        <section style={{ borderTop: "1px solid hsl(var(--foreground) / 0.06)" }} className="pt-5" data-testid="card-notification-preferences">
          <SectionLabel icon={Bell} label={t("notifications.title")} />

          <div className="mt-3 space-y-5">
            {/* Master toggle */}
            <div className="flex items-center justify-between gap-4" data-testid="row-notification-master">
              <div>
                <div className="text-sm font-semibold">{t("notifications.allNotifications")}</div>
                <div className="text-xs text-muted-foreground h-4">
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
              <div className="grid grid-cols-[1fr_3rem_3rem_3rem] gap-1 mb-1.5 px-1">
                <div />
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">{t("notifications.channels.app")}</div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">{t("notifications.channels.email")}</div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">{t("notifications.channels.sms")}</div>
              </div>

              {NOTIF_CATEGORIES.map((cat) => {
                const visibleEvents = cat.events.filter((ev) => !ev.roles || ev.roles.includes(userRole));
                if (visibleEvents.length === 0) return null;
                return (
                  <div key={cat.labelKey} className="mb-4">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
                      {t(NOTIF_CAT_KEYS[cat.labelKey] ?? cat.labelKey)}
                    </div>
                    <div className="space-y-0.5">
                      {visibleEvents.map((ev) => {
                        const channel = notifPrefs.events[ev.key] ?? ev.defaults;
                        const Icon = ev.icon;
                        return (
                          <div
                            key={ev.key}
                            className="grid grid-cols-[1fr_3rem_3rem_3rem] gap-1 items-center rounded-lg px-1 py-1.5 hover:bg-background/50 transition-colors duration-150"
                            data-testid={`row-notif-${ev.key}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-[13px] truncate">{t(NOTIF_EVENT_KEYS[ev.key] ?? ev.label)}</span>
                            </div>
                            {(["in_app","email","sms"] as const).map((ch) => (
                              <div key={ch} className="flex justify-center">
                                <Checkbox
                                  checked={channel[ch]}
                                  onCheckedChange={(checked) =>
                                    updateNotifPrefs((p) => ({
                                      ...p,
                                      events: { ...p.events, [ev.key]: { ...channel, [ch]: !!checked } },
                                    }))
                                  }
                                  aria-label={`${ev.label} ${ch}`}
                                  data-testid={`check-${ev.key}-${ch}`}
                                />
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Quiet Hours */}
              <div className="pt-4 mt-2 space-y-3" style={{ borderTop: "1px solid hsl(var(--foreground) / 0.06)" }}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div>
                      <div className="text-[13px] font-semibold">{t("notifications.quietHours.title")}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{t("notifications.quietHours.description")}</div>
                    </div>
                  </div>
                  <Switch
                    checked={notifPrefs.quiet_hours.enabled}
                    onCheckedChange={(checked) =>
                      updateNotifPrefs((p) => ({ ...p, quiet_hours: { ...p.quiet_hours, enabled: checked } }))
                    }
                    data-testid="toggle-quiet-hours"
                    aria-label="Toggle quiet hours"
                  />
                </div>
                {notifPrefs.quiet_hours.enabled && (
                  <div className="flex items-center gap-3 pl-6">
                    <label className="text-xs text-muted-foreground">{t("notifications.quietHours.start")}</label>
                    <input
                      type="time"
                      value={notifPrefs.quiet_hours.start}
                      onChange={(e) =>
                        updateNotifPrefs((p) => ({ ...p, quiet_hours: { ...p.quiet_hours, start: e.target.value } }))
                      }
                      className="h-10 rounded-xl border border-border/30 bg-input-bg px-3 text-sm"
                      data-testid="input-quiet-start"
                    />
                    <label className="text-xs text-muted-foreground">{t("notifications.quietHours.end")}</label>
                    <input
                      type="time"
                      value={notifPrefs.quiet_hours.end}
                      onChange={(e) =>
                        updateNotifPrefs((p) => ({ ...p, quiet_hours: { ...p.quiet_hours, end: e.target.value } }))
                      }
                      className="h-10 rounded-xl border border-border/30 bg-input-bg px-3 text-sm"
                      data-testid="input-quiet-end"
                    />
                  </div>
                )}
              </div>

              {/* Digest */}
              <div className="pt-4 mt-4 space-y-3" style={{ borderTop: "1px solid hsl(var(--foreground) / 0.06)" }}>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("notifications.digest.title")}</div>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-[13px]">{t("notifications.digest.dailySummary")}</div>
                  <Switch
                    checked={notifPrefs.digest.daily_summary}
                    onCheckedChange={(checked) =>
                      updateNotifPrefs((p) => ({ ...p, digest: { ...p.digest, daily_summary: checked } }))
                    }
                    data-testid="toggle-digest-daily"
                    aria-label="Toggle daily summary email"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-[13px]">{t("notifications.digest.weeklyReport")}</div>
                  <Switch
                    checked={notifPrefs.digest.weekly_report}
                    onCheckedChange={(checked) =>
                      updateNotifPrefs((p) => ({ ...p, digest: { ...p.digest, weekly_report: checked } }))
                    }
                    data-testid="toggle-digest-weekly"
                    aria-label="Toggle weekly report email"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── DASHBOARD ─────────────────────────────────────────── */}
        <section style={{ borderTop: "1px solid hsl(var(--foreground) / 0.06)" }} className="pt-5" data-testid="card-refresh-interval">
          <SectionLabel icon={Clock} label={t("dashboard.title")} />

          <div className="mt-3 space-y-3">
            <div>
              <div className="text-sm font-semibold" data-testid="text-refresh-title">{t("dashboard.autoRefresh")}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {t("dashboard.current")}: <span className="font-semibold text-foreground" data-testid="text-current-interval">{labelForInterval}</span>
              </div>
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
                      title: t("dashboard.refreshUpdated"),
                      description: option.value === 0 ? t("dashboard.autoRefreshDisabled") : t("dashboard.refreshEvery", { interval: option.label }),
                    });
                  }}
                  className={cn(
                    "h-10 rounded-full text-[13px] font-semibold transition-colors duration-150",
                    intervalSeconds === option.value
                      ? "border-2 border-highlight-active bg-highlight-active/30 text-foreground"
                      : "bg-background hover:bg-muted text-muted-foreground"
                  )}
                  data-testid={`refresh-interval-option-${option.value}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── SECURITY ──────────────────────────────────────────── */}
        <section style={{ borderTop: "1px solid hsl(var(--foreground) / 0.06)" }} className="pt-5" data-testid="card-security">
          <SectionLabel icon={Shield} label={t("security.title")} />

          <div className="mt-3">
            {/* Password card */}
            <div className="rounded-xl bg-muted overflow-hidden">
              {/* Card header row — always visible */}
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center shrink-0">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold leading-tight">{t("security.password")}</div>
                    {email && (
                      <div className="text-[11px] text-muted-foreground truncate">{email}</div>
                    )}
                  </div>
                </div>
                {pwOpen ? (
                  <button
                    type="button"
                    onClick={closePwCard}
                    className="icon-circle-lg icon-circle-base shrink-0"
                    aria-label="Close password form"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPwOpen(true)}
                    className="h-9 px-4 rounded-full bg-background border border-black/[0.125] text-[12px] font-semibold text-foreground/80 hover:text-foreground hover:border-border/80 transition-colors duration-150 shrink-0"
                    data-testid="button-change-password"
                  >
                    {t("security.changePassword")}
                  </button>
                )}
              </div>

              {/* Collapsible form */}
              {pwOpen && (
                <div className="px-4 pb-4 space-y-3" data-testid="inline-password-form">
                  <div style={{ borderTop: "1px solid hsl(var(--foreground) / 0.06)" }} className="pt-3 space-y-3">
                    {pwError && (
                      <div
                        className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
                        data-testid="text-password-error"
                      >
                        {pwError}
                      </div>
                    )}
                    <PasswordField
                      label={t("security.currentPassword")}
                      value={currentPassword}
                      onChange={setCurrentPassword}
                      show={showCurrent}
                      onToggleShow={() => setShowCurrent((p) => !p)}
                      testId="input-current-password"
                      placeholder={t("security.currentPassword")}
                      autoComplete="current-password"
                    />
                    <PasswordField
                      label={t("security.newPassword")}
                      value={newPassword}
                      onChange={setNewPassword}
                      show={showNew}
                      onToggleShow={() => setShowNew((p) => !p)}
                      testId="input-new-password"
                      placeholder={t("security.newPasswordPlaceholder")}
                      autoComplete="new-password"
                    />
                    <PasswordField
                      label={t("security.confirmPassword")}
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      show={showConfirm}
                      onToggleShow={() => setShowConfirm((p) => !p)}
                      testId="input-confirm-password"
                      placeholder={t("security.confirmPassword")}
                      autoComplete="new-password"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={isChanging}
                    className="w-full h-10 rounded-full bg-brand-indigo text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-150"
                    data-testid="button-change-password-submit"
                  >
                    {isChanging ? t("security.changing") : t("security.updatePassword")}
                  </button>

                  {/* Reset via email */}
                  <div className="flex items-center gap-3 pt-1" style={{ borderTop: "1px solid hsl(var(--foreground) / 0.06)" }}>
                    <span className="text-xs text-muted-foreground">{t("security.forgotCurrent")}</span>
                    <button
                      type="button"
                      onClick={handleResetEmail}
                      disabled={isResetting}
                      className="text-xs font-semibold text-brand-indigo hover:opacity-80 disabled:opacity-50 transition-opacity duration-150"
                      data-testid="button-reset-password"
                    >
                      {isResetting ? t("security.sending") : t("security.sendResetEmail")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
