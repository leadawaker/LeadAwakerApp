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
  Bell, CalendarCheck, MessageSquare,
  MessageSquareWarning, Bot, AlertTriangle, Megaphone,
  Clock, CheckCircle, ChevronRight, Cpu,
  Lock, Shield, Eye, EyeOff, X as XIcon, Globe,
} from "lucide-react";
import { LanguageSelector } from "@/components/crm/LanguageSelector";

// ── Types ──────────────────────────────────────────────────────────
type NotificationPreferences = {
  telegram_enabled: boolean;
  telegram_chat_id: string;
  push_enabled: boolean;
  type_overrides: Record<string, { telegram: boolean; web_push: boolean }>;
};

type PushDevice = {
  id?: number;
  endpoint: string;
  device_label: string;
  created_at: string;
};

const NOTIF_TYPE_KEYS = [
  { key: "task_assigned", labelKey: "notifications.types.taskAssigned", icon: CheckCircle },
  { key: "task_due_soon", labelKey: "notifications.types.taskDueSoon", icon: Clock },
  { key: "task_overdue", labelKey: "notifications.types.taskOverdue", icon: AlertTriangle },
  { key: "booking_confirmed", labelKey: "notifications.types.bookingConfirmed", icon: CalendarCheck },
  { key: "lead_responded", labelKey: "notifications.types.leadResponded", icon: MessageSquareWarning },
  { key: "lead_manual_takeover", labelKey: "notifications.types.leadManualTakeover", icon: Bot },
  { key: "critical_automation_failure", labelKey: "notifications.types.criticalAutomationFailure", icon: AlertTriangle },
  { key: "campaign_finished", labelKey: "notifications.types.campaignFinished", icon: Megaphone },
] as const;

function getDefaultNotifPrefs(): NotificationPreferences {
  const type_overrides: Record<string, { telegram: boolean; web_push: boolean }> = {};
  for (const t of NOTIF_TYPE_KEYS)
    type_overrides[t.key] = { telegram: true, web_push: true };
  return {
    telegram_enabled: false,
    telegram_chat_id: "",
    push_enabled: false,
    type_overrides,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
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
  const [telegramChatIdInput, setTelegramChatIdInput] = useState("");
  const [pushDevices, setPushDevices] = useState<PushDevice[]>([]);
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);
  const [overridesOpen, setOverridesOpen] = useState(false);

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
    const uid = session.user.id;
    const aid = session.user.accountsId || 1;
    apiFetch(`/api/users/${uid}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setEmail(data.email ?? "");
      })
      .catch(() => {});
    // Fetch notification preferences from dedicated endpoint
    apiFetch(`/api/notifications/preferences?user_id=${uid}&account_id=${aid}`)
      .then(async (r) => {
        if (!r.ok) return;
        const prefs = await r.json();
        setNotifPrefs((prev) => ({
          ...prev,
          telegram_enabled: prefs.telegram_enabled ?? prev.telegram_enabled,
          telegram_chat_id: prefs.telegram_chat_id ?? prev.telegram_chat_id,
          push_enabled: prefs.push_enabled ?? prev.push_enabled,
          type_overrides: prefs.type_overrides
            ? { ...prev.type_overrides, ...prefs.type_overrides }
            : prev.type_overrides,
        }));
        setTelegramChatIdInput(prefs.telegram_chat_id ?? "");
      })
      .catch(() => {});
    // Fetch push subscriptions
    apiFetch(`/api/notifications/push-subscriptions?user_id=${uid}&account_id=${aid}`)
      .then(async (r) => {
        if (!r.ok) return;
        const subs = await r.json();
        if (Array.isArray(subs)) setPushDevices(subs);
      })
      .catch(() => {});
  }, [session.status]);

  // ── Save notif prefs ─────────────────────────────────────────────
  const saveNotifPrefs = useCallback(async (updated: Partial<NotificationPreferences>) => {
    if (session.status !== "authenticated") return;
    setIsSavingNotifs(true);
    try {
      const uid = session.user.id;
      const aid = session.user.accountsId || 1;
      await apiFetch(`/api/notifications/preferences?user_id=${uid}&account_id=${aid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch {
      toast({ variant: "destructive", title: t("security.error"), description: t("notifications.failedSave") });
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

  // ── Push subscription helpers ─────────────────────────────────────
  const handleEnablePush = useCallback(async () => {
    if (session.status !== "authenticated") return;
    setIsSubscribingPush(true);
    try {
      const vapidRes = await apiFetch("/api/notifications/vapid-public-key");
      if (!vapidRes.ok) throw new Error("Failed to get VAPID key");
      const { publicKey } = await vapidRes.json();
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const uid = session.user.id;
      const aid = session.user.accountsId || 1;
      const res = await apiFetch("/api/notifications/push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: uid,
          account_id: aid,
          subscription: subscription.toJSON(),
          device_label: navigator.userAgent,
        }),
      });
      if (!res.ok) throw new Error("Failed to save subscription");
      const saved = await res.json();
      setPushDevices((prev) => [...prev, {
        id: saved.id,
        endpoint: subscription.endpoint,
        device_label: navigator.userAgent,
        created_at: new Date().toISOString(),
      }]);
      updateNotifPrefs((p) => ({ ...p, push_enabled: true }));
      toast({ variant: "success", title: t("notifications.push.enabled") });
    } catch (err: any) {
      toast({ variant: "destructive", title: t("security.error"), description: err.message || t("notifications.push.failedSubscribe") });
    } finally {
      setIsSubscribingPush(false);
    }
  }, [session, toast, updateNotifPrefs]);

  const handleRemovePushDevice = useCallback(async (endpoint: string) => {
    try {
      await apiFetch("/api/notifications/push-subscription", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      setPushDevices((prev) => prev.filter((d) => d.endpoint !== endpoint));
      toast({ variant: "success", title: t("notifications.push.deviceRemoved") });
    } catch {
      toast({ variant: "destructive", title: t("security.error") });
    }
  }, [toast]);

  const handleSaveTelegramChatId = useCallback(async () => {
    const trimmed = telegramChatIdInput.trim();
    updateNotifPrefs((p) => ({ ...p, telegram_chat_id: trimmed }));
    toast({ variant: "success", title: t("notifications.telegram.saved") });
  }, [telegramChatIdInput, updateNotifPrefs, toast]);

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

  return (
    <div className="flex flex-col h-full" data-testid="settings-panel">
      <div className="flex-1 overflow-y-auto scrollbar-visible px-5 pt-3 pb-8 space-y-6 max-w-[1386px] w-full mr-auto">

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
            {isSavingNotifs && (
              <div className="text-xs text-muted-foreground italic">{t("notifications.saving")}</div>
            )}

            {/* ── Telegram ──────────────────────────────── */}
            <div className="rounded-xl bg-background/50 p-3 space-y-2.5" data-testid="section-telegram">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#229ED9] shrink-0" />
                  <div className="text-sm font-semibold">{t("notifications.telegram.title")}</div>
                </div>
                <Switch
                  checked={notifPrefs.telegram_enabled}
                  onCheckedChange={(checked) =>
                    updateNotifPrefs((p) => ({ ...p, telegram_enabled: checked }))
                  }
                  data-testid="toggle-telegram"
                  aria-label="Toggle Telegram notifications"
                />
              </div>
              {notifPrefs.telegram_enabled && (
                <div className="space-y-2 pl-6">
                  <label className="text-xs text-muted-foreground">{t("notifications.telegram.chatIdLabel")}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={telegramChatIdInput}
                      onChange={(e) => setTelegramChatIdInput(e.target.value)}
                      placeholder={t("notifications.telegram.chatIdPlaceholder")}
                      className="h-10 flex-1 rounded-xl border border-border/30 bg-input-bg px-3 text-sm"
                      data-testid="input-telegram-chat-id"
                    />
                    <button
                      type="button"
                      onClick={handleSaveTelegramChatId}
                      className="h-10 px-4 rounded-xl bg-brand-indigo text-white text-[13px] font-semibold hover:opacity-90 transition-opacity duration-150 shrink-0"
                      data-testid="button-save-telegram"
                    >
                      {t("notifications.telegram.save")}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {t("notifications.telegram.setupHint")}
                  </p>
                  <a
                    href="https://t.me/Lead_Awaker_bot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-indigo hover:underline mt-1"
                  >
                    {t("notifications.telegram.openBot")} &rarr;
                  </a>
                </div>
              )}
            </div>

            {/* ── Browser Push ──────────────────────────── */}
            <div className="rounded-xl bg-background/50 p-3 space-y-2.5" data-testid="section-push">
              <div className="flex items-center gap-2 mb-1">
                <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="text-sm font-semibold">{t("notifications.push.title")}</div>
              </div>
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={isSubscribingPush || !("serviceWorker" in navigator)}
                className="h-10 px-5 rounded-full bg-brand-indigo text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-150"
                data-testid="button-enable-push"
              >
                {isSubscribingPush ? t("notifications.push.subscribing") : t("notifications.push.enable")}
              </button>
              {!("serviceWorker" in navigator) && (
                <p className="text-[11px] text-amber-500">{t("notifications.push.notSupported")}</p>
              )}
              {pushDevices.length > 0 && (
                <div className="space-y-2 pt-2" style={{ borderTop: "1px solid hsl(var(--foreground) / 0.06)" }}>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {t("notifications.push.activeDevices")}
                  </div>
                  {pushDevices.map((device) => {
                    const shortLabel = device.device_label.length > 50
                      ? device.device_label.substring(0, 47) + "..."
                      : device.device_label;
                    const addedDate = device.created_at
                      ? new Date(device.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                      : "";
                    return (
                      <div
                        key={device.endpoint}
                        className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2"
                        data-testid={`push-device-${device.id ?? "unknown"}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] truncate">{shortLabel}</div>
                          {addedDate && (
                            <div className="text-[10px] text-muted-foreground">
                              {t("notifications.push.added")} {addedDate}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePushDevice(device.endpoint)}
                          className="text-[11px] font-semibold text-red-500 hover:text-red-600 shrink-0"
                        >
                          {t("notifications.push.remove")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Per-Type Overrides ────────────────────── */}
            <div className="rounded-xl bg-background/50 overflow-hidden" data-testid="section-type-overrides">
              <button
                type="button"
                onClick={() => setOverridesOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-3 px-3 py-3 hover:bg-muted/40 transition-colors duration-150"
                data-testid="button-toggle-overrides"
              >
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-semibold">{t("notifications.overrides.title")}</span>
                </div>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    overridesOpen && "rotate-90"
                  )}
                />
              </button>
              {overridesOpen && (
                <div className="px-3 pb-3 pt-1" style={{ borderTop: "1px solid hsl(var(--foreground) / 0.06)" }}>
                  <div className="grid grid-cols-[1fr_3.5rem_3.5rem] gap-1 mb-2 px-1">
                    <div />
                    <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider text-center">
                      {t("notifications.overrides.telegram")}
                    </div>
                    <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider text-center">
                      {t("notifications.overrides.webPush")}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    {NOTIF_TYPE_KEYS.map((nt) => {
                      const override = notifPrefs.type_overrides[nt.key] ?? { telegram: true, web_push: true };
                      const Icon = nt.icon;
                      return (
                        <div
                          key={nt.key}
                          className="grid grid-cols-[1fr_3.5rem_3.5rem] gap-1 items-center rounded-lg px-1 py-1.5 hover:bg-muted/40 transition-colors duration-150"
                          data-testid={`row-override-${nt.key}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-[12px] truncate">{t(nt.labelKey)}</span>
                          </div>
                          <div className="flex justify-center">
                            <Checkbox
                              checked={override.telegram}
                              onCheckedChange={(checked) =>
                                updateNotifPrefs((p) => ({
                                  ...p,
                                  type_overrides: {
                                    ...p.type_overrides,
                                    [nt.key]: { ...override, telegram: !!checked },
                                  },
                                }))
                              }
                              aria-label={`${t(nt.labelKey)} telegram`}
                              data-testid={`check-${nt.key}-telegram`}
                            />
                          </div>
                          <div className="flex justify-center">
                            <Checkbox
                              checked={override.web_push}
                              onCheckedChange={(checked) =>
                                updateNotifPrefs((p) => ({
                                  ...p,
                                  type_overrides: {
                                    ...p.type_overrides,
                                    [nt.key]: { ...override, web_push: !!checked },
                                  },
                                }))
                              }
                              aria-label={`${t(nt.labelKey)} web push`}
                              data-testid={`check-${nt.key}-push`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
