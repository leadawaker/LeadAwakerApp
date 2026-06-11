import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/useSession";
import { apiFetch } from "@/lib/apiUtils";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { MessageSquare, Bell, AlertTriangle, Cpu, ChevronRight } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  type NotificationPreferences,
  type PushDevice,
  NOTIF_TYPE_KEYS,
  getDefaultNotifPrefs,
  urlBase64ToUint8Array,
} from "../types";

export function NotificationsSection() {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const session = useSession();
  const { currentAccountId } = useWorkspace();

  // ── Notification state ─────────────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(getDefaultNotifPrefs);
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);
  const [telegramChatIdInput, setTelegramChatIdInput] = useState("");
  const [pushDevices, setPushDevices] = useState<PushDevice[]>([]);
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);
  const [overridesOpen, setOverridesOpen] = useState(false);

  // ── Load preferences + push subscriptions ──────────────────────────
  useEffect(() => {
    if (session.status !== "authenticated") return;
    const uid = session.user.id;
    const aid = currentAccountId || session.user.accountsId || 1;
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
    // Load push subscriptions
    apiFetch(`/api/notifications/push-subscriptions?user_id=${uid}&account_id=${aid}`)
      .then(async (r) => {
        if (!r.ok) return;
        const subs = await r.json();
        if (Array.isArray(subs)) setPushDevices(subs);
      })
      .catch(() => {});
  }, [session.status]);

  // ── Notification prefs ─────────────────────────────────────────────
  const saveNotifPrefs = useCallback(async (updated: Partial<NotificationPreferences>) => {
    if (session.status !== "authenticated") return;
    setIsSavingNotifs(true);
    try {
      const uid = session.user.id;
      const aid = currentAccountId || session.user.accountsId || 1;
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
  }, [session, toast, currentAccountId]);

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
      // 0. Check browser permission status
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        toast({ variant: "destructive", title: t("notifications.push.permissionDenied", "Notifications are blocked. Please allow them in your browser settings.") });
        return;
      }

      // 1. Get VAPID key
      const vapidRes = await apiFetch("/api/notifications/vapid-public-key");
      if (!vapidRes.ok) throw new Error("Failed to get VAPID key");
      const { publicKey } = await vapidRes.json();

      if (!publicKey) {
        toast({ variant: "destructive", title: t("notifications.push.notConfigured", "Push notifications are not configured on this server.") });
        return;
      }

      // 2. Register service worker and subscribe
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // 3. Send subscription to server
      const uid = session.user.id;
      const aid = currentAccountId || session.user.accountsId || 1;
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

      // If server POST failed, unsubscribe from pushManager and show error
      if (!res.ok) {
        await subscription.unsubscribe();
        throw new Error(t("notifications.push.serverRegistrationFailed", "Could not register, please try again."));
      }

      // 4. Update local state only after server confirmed
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
      console.error("Push subscription failed:", err);
      toast({ variant: "destructive", title: t("security.error"), description: err.message || t("notifications.push.failedSubscribe") });
    } finally {
      setIsSubscribingPush(false);
    }
  }, [session, currentAccountId, toast, updateNotifPrefs]);

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

  return (
    <div className="space-y-6" data-testid="section-notifications">
      <p className="text-sm text-muted-foreground leading-relaxed">
        {t("notifications.description")}
      </p>

      {isSavingNotifs && (
        <div className="flex items-center gap-2 text-xs text-brand-indigo">
          <div className="h-3 w-3 border-[1.5px] border-brand-indigo/30 border-t-brand-indigo rounded-full animate-spin" />
          <span className="italic">{t("notifications.saving")}</span>
        </div>
      )}

      {/* ── Section A: Telegram ──────────────────────────────── */}
      <div className="rounded-xl border border-border/20 bg-muted/40 overflow-hidden" data-testid="section-telegram">
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[#229ED9]/10 flex items-center justify-center shrink-0">
              <MessageSquare className="h-4 w-4 text-[#229ED9]" />
            </div>
            <div>
              <div className="text-sm font-semibold">{t("notifications.telegram.title")}</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5">
                {notifPrefs.telegram_enabled ? t("notifications.telegram.connected", "Connected") : t("notifications.telegram.disconnected", "Not connected")}
              </div>
            </div>
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
          <div className="px-4 pb-4 pt-1 border-t border-border/15 space-y-2.5">
            <label className="text-xs font-medium text-muted-foreground">{t("notifications.telegram.chatIdLabel")}</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={telegramChatIdInput}
                onChange={(e) => setTelegramChatIdInput(e.target.value)}
                placeholder={t("notifications.telegram.chatIdPlaceholder")}
                className="h-10 flex-1 rounded-xl border border-border/40 bg-white dark:bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-indigo/20 focus:border-brand-indigo/40 transition-shadow duration-200"
                data-testid="input-telegram-chat-id"
              />
              <button
                type="button"
                onClick={handleSaveTelegramChatId}
                className="h-10 px-4 rounded-xl bg-brand-indigo text-white text-[13px] font-semibold hover:opacity-90 active:scale-[0.98] transition-all duration-150 shrink-0"
                data-testid="button-save-telegram"
              >
                {t("notifications.telegram.save")}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
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

      {/* ── Section B: Browser Push ──────────────────────────── */}
      <div className="rounded-xl border border-border/20 bg-muted/40 overflow-hidden" data-testid="section-push">
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-brand-indigo/8 flex items-center justify-center shrink-0">
              <Bell className="h-4 w-4 text-brand-indigo" />
            </div>
            <div>
              <div className="text-sm font-semibold">{t("notifications.push.title")}</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5">
                {pushDevices.length > 0
                  ? t("notifications.push.deviceCount", { count: pushDevices.length, defaultValue: "{{count}} device(s) registered" })
                  : t("notifications.push.noDevices", "No devices registered")}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleEnablePush}
            disabled={isSubscribingPush || !("serviceWorker" in navigator)}
            className="h-9 px-4 rounded-full bg-brand-indigo text-white text-[12px] font-semibold hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 shrink-0"
            data-testid="button-enable-push"
          >
            {isSubscribingPush ? t("notifications.push.subscribing") : t("notifications.push.enable")}
          </button>
        </div>

        {!("serviceWorker" in navigator) && (
          <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg bg-amber-500/8 border border-amber-500/15 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <p className="text-[11px] text-amber-600 dark:text-amber-400">{t("notifications.push.notSupported")}</p>
          </div>
        )}

        {pushDevices.length > 0 && (
          <div className="px-4 pb-4 pt-1 border-t border-border/15 space-y-2">
            <div className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest pt-1">
              {t("notifications.push.activeDevices")}
            </div>
            {pushDevices.map((device) => {
              const shortLabel = device.device_label.length > 60
                ? device.device_label.substring(0, 57) + "..."
                : device.device_label;
              const addedDate = device.created_at
                ? new Date(device.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                : "";
              return (
                <div
                  key={device.endpoint}
                  className="flex items-center justify-between gap-2 rounded-lg bg-background/50 border border-border/10 px-3 py-2.5 hover:bg-background/70 transition-colors duration-150"
                  data-testid={`push-device-${device.id ?? "unknown"}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium truncate">{shortLabel}</div>
                    {addedDate && (
                      <div className="text-[10px] text-muted-foreground/50 mt-0.5">
                        {t("notifications.push.added")} {addedDate}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePushDevice(device.endpoint)}
                    className="text-[11px] font-semibold text-red-500/80 hover:text-red-600 active:scale-95 transition-all duration-150 shrink-0"
                    data-testid={`button-remove-device-${device.id ?? "unknown"}`}
                  >
                    {t("notifications.push.remove")}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section C: Per-Type Overrides ────────────────────── */}
      <div className="rounded-xl border border-border/20 bg-muted/40 overflow-hidden" data-testid="section-type-overrides">
        <button
          type="button"
          onClick={() => setOverridesOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-muted/60 transition-colors duration-150"
          data-testid="button-toggle-overrides"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-left">
              <span className="text-sm font-semibold block">{t("notifications.overrides.title")}</span>
              <span className="text-[11px] text-muted-foreground/60">{t("notifications.overrides.subtitle", "Fine-tune per notification type")}</span>
            </div>
          </div>
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground/50 transition-transform duration-200",
              overridesOpen && "rotate-90"
            )}
          />
        </button>

        {overridesOpen && (
          <div className="px-4 pb-4 pt-2 border-t border-border/15">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 mb-2.5 px-1">
              <div />
              <div className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest text-center">
                {t("notifications.overrides.telegram")}
              </div>
              <div className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest text-center">
                {t("notifications.overrides.webPush")}
              </div>
            </div>

            <div className="space-y-px">
              {NOTIF_TYPE_KEYS.map((nt) => {
                const override = notifPrefs.type_overrides[nt.key] ?? { telegram: true, web_push: true };
                const Icon = nt.icon;
                return (
                  <div
                    key={nt.key}
                    className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 items-center rounded-lg px-1 py-2 hover:bg-background/40 transition-colors duration-150 group"
                    data-testid={`row-override-${nt.key}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-muted-foreground shrink-0 transition-colors duration-150" />
                      <span className="text-[13px] truncate">{t(nt.labelKey)}</span>
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
  );
}
