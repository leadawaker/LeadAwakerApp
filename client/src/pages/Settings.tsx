import { useState, useEffect, useCallback, useRef, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { hapticSave } from "@/lib/haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { CrmShell } from "@/components/crm/CrmShell";
import { useToast } from "@/hooks/use-toast";
import { useDashboardRefreshInterval, REFRESH_INTERVAL_OPTIONS } from "@/hooks/useDashboardRefreshInterval";
import { useSession } from "@/hooks/useSession";
import { apiFetch, API_BASE } from "@/lib/apiUtils";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Mail, MessageSquare, Globe, Eye, EyeOff, Building2,
  User, Shield, Bell, Clock, Receipt, FileText, CheckCircle, PenLine,
  Phone, CalendarCheck, MessageSquareWarning, Bot, AlertTriangle,
  Megaphone, TrendingDown, Camera, X, Users, ChevronDown,
  ChevronRight, ArrowLeft, Sun, Moon, Instagram, Facebook, BookOpen,
  Palette, Languages, Cpu, ExternalLink,
} from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useTheme } from "@/hooks/useTheme";
import { SettingsTeamSection } from "@/features/users/components/SettingsTeamSection";
import { AccountDetailView } from "@/features/accounts/components/AccountDetailView";
import { updateAccount } from "@/features/accounts/api/accountsApi";
import type { AccountRow } from "@/features/accounts/components/AccountDetailsDialog";
import { SkeletonSettingsSection } from "@/components/ui/skeleton";
import { LanguageSelector } from "@/components/crm/LanguageSelector";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { OnboardingContext } from "@/components/onboarding/OnboardingProvider";

// ── User profile type ────────────────────────────────────────────────
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
  lastLoginAt: string | null;
};

// ── Notification types ───────────────────────────────────────────────
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

// ── Settings sections ────────────────────────────────────────────────
type SettingsSection = "profile" | "notifications" | "dashboard" | "team" | "account";

const BASE_SECTIONS: { id: SettingsSection; labelKey: string; icon: React.ElementType; agencyOnly?: boolean; scopedOnly?: boolean }[] = [
  { id: "account", labelKey: "sections.account", icon: Building2, scopedOnly: true },
  { id: "profile", labelKey: "sections.profile", icon: User },
  { id: "notifications", labelKey: "sections.notifications", icon: Bell },
  { id: "dashboard", labelKey: "sections.dashboard", icon: Clock },
  { id: "team", labelKey: "sections.team", icon: Users },
];

// ── Reusable field component ─────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  testId,
  placeholder,
  type = "text",
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
  placeholder?: string;
  type?: string;
  icon?: React.ElementType;
}) {
  return (
    <div data-testid={`${testId}-wrap`}>
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5" data-testid={`${testId}-label`}>
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-10 w-full rounded-xl border border-border/40 bg-white dark:bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-indigo/20 focus:border-brand-indigo/40"
        data-testid={testId}
        placeholder={placeholder}
      />
    </div>
  );
}

// ── Password field component ─────────────────────────────────────────
function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  testId,
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  testId: string;
  placeholder: string;
  autoComplete: string;
}) {
  const { t } = useTranslation("settings");
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative mt-1.5">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-xl border border-border/40 bg-white dark:bg-card px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-indigo/20 focus:border-brand-indigo/40"
          data-testid={testId}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={onToggleShow}
          aria-label={show ? t("security.hidePassword") : t("security.showPassword")}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}


// ── Main Settings Page ───────────────────────────────────────────────
function SettingsContent() {
  const { t, i18n } = useTranslation("settings");
  const { toast } = useToast();
  const { intervalSeconds, setIntervalSeconds, labelForInterval } = useDashboardRefreshInterval();
  const session = useSession();
  const { isAgencyUser, currentAccountId } = useWorkspace();
  const queryClient = useQueryClient();
  const { triggerRestart } = useContext(OnboardingContext);
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { isDark, toggleTheme } = useTheme();
  // Mobile hub state: null = hub list, string = open section
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const isScopedToAccount = currentAccountId > 0;
  const SECTIONS = BASE_SECTIONS.filter((s) => {
    if (s.agencyOnly && !isAgencyUser) return false;
    // "My Account" is for subaccount users only; agency admins navigate via the Accounts page
    if (s.scopedOnly && (!isScopedToAccount || isAgencyUser)) return false;
    return true;
  });

  const [activeSection, setActiveSection] = useState<SettingsSection>(
    isScopedToAccount && !isAgencyUser ? "account" : "profile"
  );

  // If account scope changes and current section is no longer valid, reset
  useEffect(() => {
    if (!isScopedToAccount && activeSection === "account") {
      setActiveSection("profile");
    }
  }, [isScopedToAccount, activeSection]);

  // Deep-link: other pages can set sessionStorage to open a specific section
  useEffect(() => {
    const pending = sessionStorage.getItem("pendingSettingsSection");
    if (pending) {
      sessionStorage.removeItem("pendingSettingsSection");
      if (SECTIONS.some(s => s.id === pending)) {
        setActiveSection(pending as SettingsSection);
      }
    }
  }, []);

  // ── Account detail state (when scoped to a specific account) ───────
  const [accountData, setAccountData] = useState<AccountRow | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);

  useEffect(() => {
    if (!isScopedToAccount) { setAccountData(null); return; }
    setAccountLoading(true);
    apiFetch(`/api/accounts/${currentAccountId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setAccountData(data))
      .catch(() => setAccountData(null))
      .finally(() => setAccountLoading(false));
  }, [currentAccountId, isScopedToAccount]);

  const handleAccountFieldSave = useCallback(async (field: string, value: string) => {
    if (!accountData) return;
    const aid = accountData.Id ?? accountData.id ?? 0;
    await updateAccount(aid, { [field]: value });
    setAccountData((prev) => prev ? { ...prev, [field]: value } : prev);
    toast({ title: t("account.saved"), description: t("account.savedDescription", { field }) });
  }, [accountData, toast]);

  // ── Profile state ──────────────────────────────────────────────────
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [timezone, setTimezone] = useState("");

  // ── Avatar upload ───────────────────────────────────────────────────
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // ── Crop dialog state ─────────────────────────────────────────────
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
  const cropDragging = useRef(false);
  const cropLastPointer = useRef({ x: 0, y: 0 });

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCropImage(reader.result);
        setCropZoom(1);
        setCropPos({ x: 0, y: 0 });
      }
    };
    reader.readAsDataURL(file);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const handleCropConfirm = useCallback(() => {
    if (!cropImage) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 256;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const imgSize = Math.min(img.width, img.height);
      const cropSize = imgSize / cropZoom;
      const cx = (img.width - cropSize) / 2 - (cropPos.x / 100) * imgSize;
      const cy = (img.height - cropSize) / 2 - (cropPos.y / 100) * imgSize;
      ctx.drawImage(img, cx, cy, cropSize, cropSize, 0, 0, size, size);
      setAvatarUrl(canvas.toDataURL("image/jpeg", 0.85));
      setCropImage(null);
    };
    img.src = cropImage;
  }, [cropImage, cropZoom, cropPos]);

  const handleCropPointerDown = useCallback((e: React.PointerEvent) => {
    cropDragging.current = true;
    cropLastPointer.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleCropPointerMove = useCallback((e: React.PointerEvent) => {
    if (!cropDragging.current) return;
    const dx = e.clientX - cropLastPointer.current.x;
    const dy = e.clientY - cropLastPointer.current.y;
    cropLastPointer.current = { x: e.clientX, y: e.clientY };
    // Convert pixel movement to percentage (relative to 200px preview area)
    const sensitivity = 100 / 200;
    setCropPos(prev => {
      const maxOffset = (cropZoom - 1) * 50 / cropZoom;
      return {
        x: Math.max(-maxOffset, Math.min(maxOffset, prev.x + dx * sensitivity)),
        y: Math.max(-maxOffset, Math.min(maxOffset, prev.y + dy * sensitivity)),
      };
    });
  }, [cropZoom]);

  const handleCropPointerUp = useCallback(() => {
    cropDragging.current = false;
  }, []);

  // ── Security state ─────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // ── Gmail integration state ──────────────────────────────────────
  const [gmailStatus, setGmailStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [gmailLoading, setGmailLoading] = useState(false);

  // ── Notification state ─────────────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(getDefaultNotifPrefs);
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);
  const [telegramChatIdInput, setTelegramChatIdInput] = useState("");
  const [pushDevices, setPushDevices] = useState<PushDevice[]>([]);
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);
  const [overridesOpen, setOverridesOpen] = useState(false);

  // ── Gmail integration effects & handlers ─────────────────────────
  useEffect(() => {
    apiFetch("/api/gmail/oauth/status")
      .then((r) => r.json())
      .then((data) => setGmailStatus(data))
      .catch(() => setGmailStatus({ connected: false }));
  }, []);

  const handleGmailConnect = () => {
    setGmailLoading(true);
    window.location.href = `${API_BASE}/api/gmail/oauth/authorize`;
  };

  const handleGmailDisconnect = async () => {
    setGmailLoading(true);
    try {
      await apiFetch("/api/gmail/oauth/disconnect", { method: "POST" });
      setGmailStatus({ connected: false });
      toast({ title: t("gmail.disconnected") });
    } catch {
      toast({ title: t("gmail.disconnectError"), variant: "destructive" });
    } finally {
      setGmailLoading(false);
    }
  };

  // ── Theme state ────────────────────────────────────────────────────

  const userRole = session.status === "authenticated" ? (session.user.role ?? "Viewer") : "Viewer";

  // ── Fetch profile ──────────────────────────────────────────────────
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
        setTimezone(data.timezone ?? "");

        // Load notification preferences from dedicated endpoint
        if (session.status === "authenticated") {
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
        }
      })
      .catch((err) => {
        setProfileError(err.message || "Failed to load profile");
      })
      .finally(() => {
        setProfileLoading(false);
      });
  }, [session.status]);

  // ── Save profile ───────────────────────────────────────────────────
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

      // Update localStorage so topbar reflects changes immediately
      if (updated.fullName1) localStorage.setItem("leadawaker_user_name", updated.fullName1);
      if (updated.email) localStorage.setItem("leadawaker_user_email", updated.email);
      if (updated.avatarUrl) {
        localStorage.setItem("leadawaker_user_avatar", updated.avatarUrl);
        window.dispatchEvent(new Event("leadawaker-avatar-changed"));
      }

      hapticSave();
      toast({ variant: "success", title: t("profile.profileSaved"), description: t("profile.profileSavedDescription") });
    } catch (err: any) {
      toast({ variant: "destructive", title: t("profile.saveFailed"), description: err.message || t("profile.saveFailedDescription") });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Change password ────────────────────────────────────────────────
  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t("security.allFieldsRequired"));
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError(t("security.minLength"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("security.passwordsMismatch"));
      return;
    }
    setIsChangingPassword(true);
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
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      toast({ variant: "success", title: t("security.passwordChanged"), description: t("security.passwordUpdated") });
    } catch (err: any) {
      setPasswordError(err.message || t("security.failedChangePassword"));
      toast({ variant: "destructive", title: t("security.error"), description: err.message || t("security.failedChangePassword") });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // ── Reset password email ───────────────────────────────────────────
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


  // ── User initials for avatar ───────────────────────────────────────
  const userInitials = (() => {
    const n = name || email || "U";
    const parts = n.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0]?.[0] || "U").toUpperCase();
  })();

  // ── Render sections ────────────────────────────────────────────────
  const renderProfile = () => (
    <div className="space-y-8" data-testid="section-profile">
      {profileLoading ? (
        <SkeletonSettingsSection rows={4} />
      ) : profileError ? (
        <div className="text-sm text-red-500 py-4">{profileError}</div>
      ) : (
        <>
          {/* Avatar + Identity Card */}
          <div className="flex items-center gap-5 rounded-2xl bg-muted/40 p-5">
            <div className="relative shrink-0 group/avatar">
              <div
                className={cn(
                  "h-[72px] w-[72px] rounded-full overflow-hidden cursor-pointer ring-2 ring-border/20 ring-offset-2 ring-offset-card",
                  !avatarUrl && "flex items-center justify-center text-xl font-bold"
                )}
                onClick={() => avatarInputRef.current?.click()}
                title={t("profile.clickToUpload")}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={t("profile.avatarAlt")}
                    className="h-full w-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="h-full w-full rounded-full bg-brand-indigo text-white flex items-center justify-center text-xl font-bold">
                    {userInitials}
                  </div>
                )}
              </div>
              {/* Camera overlay on hover (always visible at low opacity on mobile) */}
              <div
                className={cn(
                  "absolute inset-0 rounded-full bg-black/40 flex items-center justify-center transition-opacity cursor-pointer pointer-events-none",
                  isMobile ? "opacity-40" : "opacity-0 group-hover/avatar:opacity-100"
                )}
              >
                <Camera className="w-6 h-6 text-white" />
              </div>
              {/* Remove button — hover-only, top-right */}
              {avatarUrl && (
                <button
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-white dark:bg-card border border-black/[0.125] flex items-center justify-center text-foreground/50 hover:text-red-500 hover:border-red-300 transition-colors z-10 opacity-0 group-hover/avatar:opacity-100"
                  onClick={(e) => { e.stopPropagation(); setAvatarUrl(""); }}
                  title={t("profile.removePhoto")}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileChange}
            />

            {/* ── Crop/Zoom Dialog ──────────────────────────────── */}
            <Dialog open={!!cropImage} onOpenChange={(open) => { if (!open) setCropImage(null); }}>
              <DialogContent className="max-w-[90vw] sm:max-w-[360px]">
                <DialogHeader>
                  <DialogTitle>{t("cropDialog.title")}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4 py-2">
                  {/* Circular crop preview */}
                  <div
                    className="relative w-[200px] h-[200px] rounded-full overflow-hidden border-2 border-border bg-muted cursor-grab active:cursor-grabbing select-none touch-none"
                    onPointerDown={handleCropPointerDown}
                    onPointerMove={handleCropPointerMove}
                    onPointerUp={handleCropPointerUp}
                    onPointerCancel={handleCropPointerUp}
                  >
                    {cropImage && (
                      <img
                        src={cropImage}
                        alt={t("cropDialog.previewAlt")}
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                        style={{
                          transform: `scale(${cropZoom}) translate(${cropPos.x}%, ${cropPos.y}%)`,
                          transformOrigin: "center center",
                        }}
                      />
                    )}
                  </div>
                  {/* Zoom slider */}
                  <div className="w-full flex items-center gap-3 px-2">
                    <span className="text-xs text-muted-foreground shrink-0">1x</span>
                    <Slider
                      min={1}
                      max={3}
                      step={0.1}
                      value={[cropZoom]}
                      onValueChange={([v]) => {
                        setCropZoom(v);
                        // Clamp position when zoom decreases
                        const maxOffset = (v - 1) * 50 / v;
                        setCropPos(prev => ({
                          x: Math.max(-maxOffset, Math.min(maxOffset, prev.x)),
                          y: Math.max(-maxOffset, Math.min(maxOffset, prev.y)),
                        }));
                      }}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">3x</span>
                  </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <button
                    type="button"
                    onClick={() => setCropImage(null)}
                    className="px-4 py-2 text-sm font-medium rounded-md border border-border text-foreground hover:bg-muted transition-colors"
                  >
                    {t("cropDialog.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleCropConfirm}
                    className="px-4 py-2 text-sm font-medium rounded-md bg-brand-indigo text-white hover:opacity-90 transition-opacity"
                  >
                    {t("cropDialog.confirm")}
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="flex-1 min-w-0">
              <div className="text-xl font-bold font-heading text-foreground truncate">{name || t("profile.noName")}</div>
              <span className={cn(
                "inline-block mt-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full",
                profile?.role === "Admin" ? "bg-brand-indigo/10 text-brand-indigo" :
                profile?.role === "Manager" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                profile?.role === "Editor" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                "bg-muted text-muted-foreground"
              )}>
                {profile?.role || t("profile.userFallback")}
              </span>
              {profile?.lastLoginAt && (
                <div className="text-[11px] text-muted-foreground/60 mt-1.5 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t("profile.lastLogin")}: {new Date(profile.lastLoginAt).toLocaleDateString(undefined, { dateStyle: "medium" })}{", "}{new Date(profile.lastLoginAt).toLocaleTimeString(undefined, { timeStyle: "short" })}
                </div>
              )}
            </div>
          </div>

          {/* Personal Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold font-heading text-foreground">{t("profile.description")}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-onboarding="profile-name">
            <Field
              label={t("profile.fullName")}
              value={name}
              onChange={setName}
              testId="input-profile-name"
              placeholder={t("profile.fullNamePlaceholder")}
              icon={User}
            />
            <Field
              label={t("profile.email")}
              value={email}
              onChange={setEmail}
              testId="input-profile-email"
              placeholder="your@email.com"
              type="email"
              icon={Mail}
            />
            <Field
              label={t("profile.phone")}
              value={phone}
              onChange={setPhone}
              testId="input-profile-phone"
              placeholder="+1 (555) 000-0000"
              type="tel"
              icon={Phone}
            />
            <div data-testid="input-profile-timezone-wrap" data-onboarding="profile-timezone">
              <label
                htmlFor="profile-timezone-select"
                className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"
                data-testid="input-profile-timezone-label"
              >
                <Globe className="h-3 w-3" />
                {t("profile.timezone")}
              </label>
              <select
                id="profile-timezone-select"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-xl border border-border/40 bg-white dark:bg-card px-3 pr-8 text-sm appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat focus:outline-none focus:ring-2 focus:ring-brand-indigo/20 focus:border-brand-indigo/40"
                data-testid="select-profile-timezone"
                aria-label={t("profile.timezone")}
              >
                <option value="">{t("profile.selectTimezone")}</option>
                <option value="America/Sao_Paulo">America/Sao Paulo</option>
                <option value="Europe/Amsterdam">Europe/Amsterdam</option>
              </select>
              {timezone && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("profile.currentTimezone")} <span className="font-medium text-foreground">{timezone.replace(/_/g, " ")}</span>
                </p>
              )}
            </div>
          </div>

          {/* Save button */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                className="h-11 px-6 rounded-full bg-brand-indigo text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-150"
                data-testid="button-save-profile"
                data-onboarding="save-profile"
                onClick={handleSaveProfile}
                disabled={isSaving}
              >
                {isSaving ? t("profile.saving") : t("profile.saveChanges")}
              </button>
            </div>
          </div>

          {/* Security — collapsible password section */}
          <div className="rounded-2xl bg-muted/40 overflow-hidden" data-testid="section-security">
            <button
              type="button"
              onClick={() => setShowPasswordSection((p) => !p)}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/60 transition-colors duration-150"
              data-testid="toggle-password-section"
            >
              <div className="h-9 w-9 rounded-full bg-background flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold text-foreground">{t("security.changePassword")}</div>
                <div className="text-xs text-muted-foreground">{t("security.changePasswordDescription")}</div>
              </div>
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
                showPasswordSection && "rotate-180"
              )} />
            </button>

            <div
              className="grid transition-[grid-template-rows] duration-200 ease-out"
              style={{ gridTemplateRows: showPasswordSection ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <div className="px-5 pb-5 pt-1 space-y-4">
                  {passwordError && (
                    <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2" data-testid="text-password-error">
                      {passwordError}
                    </div>
                  )}

                  <div className="space-y-3">
                    <PasswordField
                      label={t("security.currentPassword")}
                      value={currentPassword}
                      onChange={setCurrentPassword}
                      show={showCurrentPassword}
                      onToggleShow={() => setShowCurrentPassword((p) => !p)}
                      testId="input-current-password"
                      placeholder={t("security.currentPasswordPlaceholder")}
                      autoComplete="current-password"
                    />
                    <PasswordField
                      label={t("security.newPassword")}
                      value={newPassword}
                      onChange={setNewPassword}
                      show={showNewPassword}
                      onToggleShow={() => setShowNewPassword((p) => !p)}
                      testId="input-new-password"
                      placeholder={t("security.newPasswordPlaceholder")}
                      autoComplete="new-password"
                    />
                    <PasswordField
                      label={t("security.confirmPassword")}
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      show={showConfirmPassword}
                      onToggleShow={() => setShowConfirmPassword((p) => !p)}
                      testId="input-confirm-password"
                      placeholder={t("security.confirmPasswordPlaceholder")}
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={handleResetEmail}
                      disabled={isResetting}
                      className="text-xs font-semibold text-brand-indigo hover:opacity-80 disabled:opacity-50 transition-opacity duration-150"
                      data-testid="button-reset-password"
                    >
                      {isResetting ? t("security.sendingReset") : t("security.forgotSendReset")}
                    </button>
                    <button
                      type="button"
                      onClick={handleChangePassword}
                      disabled={isChangingPassword}
                      className="h-11 px-6 rounded-full bg-brand-indigo text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-150"
                      data-testid="button-change-password"
                    >
                      {isChangingPassword ? t("security.changing") : t("security.updatePassword")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Language selector */}
          <div className="rounded-2xl bg-muted/40 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="h-9 w-9 rounded-full bg-background flex items-center justify-center shrink-0">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{t("language.label")}</p>
                  <p className="text-xs text-muted-foreground truncate">{t("language.description")}</p>
                </div>
              </div>
              <LanguageSelector />
            </div>
          </div>

          {/* Tutorial restart */}
          <div className="rounded-2xl bg-muted/40 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="h-9 w-9 rounded-full bg-background flex items-center justify-center shrink-0">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{t("profile.onboardingTutorial")}</p>
                  <p className="text-xs text-muted-foreground truncate">{t("profile.onboardingDescription")}</p>
                </div>
              </div>
              <button
                type="button"
                className="text-xs font-semibold px-4 py-2 rounded-full border border-border/60 hover:bg-background transition-colors shrink-0"
                data-testid="button-restart-tutorial"
                onClick={async () => {
                  try {
                    // Enable dev override for agency users
                    if (isAgencyUser) {
                      localStorage.setItem("dev-onboarding", "true");
                      window.dispatchEvent(new CustomEvent("dev-onboarding-changed"));
                    }
                    const res = await apiFetch("/api/onboarding/restart", { method: "POST" });
                    if (res.ok) {
                      toast({ title: t("profile.tutorialRestarted"), description: t("profile.tutorialRestartedDescription") });
                      triggerRestart();
                    } else {
                      toast({ title: t("security.error"), description: t("profile.tutorialRestartFailed"), variant: "destructive" });
                    }
                  } catch {
                    toast({ title: t("security.error"), description: t("profile.tutorialRestartFailed"), variant: "destructive" });
                  }
                }}
              >
                {t("profile.restartTutorial")}
              </button>
            </div>
          </div>

          {/* ── Gmail Integration (Agency only) ────────────────────── */}
          {isAgencyUser && <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
              <Mail className="h-4 w-4 text-brand-indigo" />
              {t("gmail.title")}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("gmail.description")}
            </p>
            {gmailStatus?.connected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-sm text-foreground">{gmailStatus.email}</span>
                </div>
                <button
                  onClick={handleGmailDisconnect}
                  disabled={gmailLoading}
                  className="text-xs text-red-500 hover:text-red-600 transition-colors font-medium"
                >
                  {gmailLoading ? "..." : t("gmail.disconnect")}
                </button>
              </div>
            ) : (
              <button
                onClick={handleGmailConnect}
                disabled={gmailLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-indigo px-4 py-2 text-sm font-medium text-white hover:bg-brand-indigo/90 transition-colors"
              >
                <Mail className="h-4 w-4" />
                {gmailLoading ? "..." : t("gmail.connect")}
              </button>
            )}
          </div>}
        </>
      )}
    </div>
  );

  const renderNotifications = () => (
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

  const renderDashboard = () => (
    <div className="space-y-6" data-testid="section-dashboard">
      <p className="text-sm text-muted-foreground">
        {t("dashboard.description")}
      </p>

      <div className="rounded-xl bg-muted/60 p-5 space-y-4">
        <div>
          <div className="text-sm font-semibold">{t("dashboard.autoRefresh")}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {t("dashboard.current")} <span className="font-semibold text-foreground" data-testid="text-current-interval">{labelForInterval}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="refresh-interval-options">
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
                  ? "border-2 border-[#FCB803] bg-[#FCB803]/15 text-foreground"
                  : "bg-background border border-black/[0.125] hover:bg-card text-muted-foreground"
              )}
              data-testid={`refresh-interval-option-${option.value}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderActiveSection = () => {
    switch (activeSection) {
      case "account":
        if (accountLoading) return <SkeletonSettingsSection rows={6} />;
        if (!accountData) return <div className="text-muted-foreground text-sm py-8 text-center">{t("account.notFound")}</div>;
        return (
          <AccountDetailView
            account={accountData}
            onSave={handleAccountFieldSave}
            onAddAccount={() => {}}
            onDelete={() => {}}
            onToggleStatus={() => {}}
          />
        );
      case "profile": return renderProfile();
      case "notifications": return renderNotifications();
      case "dashboard": return renderDashboard();
      case "team": return <SettingsTeamSection />;
    }
  };

  // ── Mobile Hub ────────────────────────────────────────────────────
  type MobileHubItem = {
    id: string;
    labelKey: string;
    descKey?: string;
    icon: React.ElementType;
    agencyOnly?: boolean;
    action: "section" | "navigate" | "toggle";
    target?: string;
  };

  const MOBILE_HUB_ITEMS: MobileHubItem[] = [
    { id: "profile",   labelKey: "hub.profile",   descKey: "hub.profileDesc",   icon: User,        action: "section" },
    { id: "theme",     labelKey: "hub.theme",     descKey: "hub.themeDesc",     icon: Palette,     action: "section" },
    { id: "language",  labelKey: "hub.language",  descKey: "hub.languageDesc",  icon: Languages,   action: "section" },
    { id: "billing",   labelKey: "hub.billing",   descKey: "hub.billingDesc",   icon: Receipt,     action: "navigate", target: "invoices" },
    { id: "social",    labelKey: "hub.social",    descKey: "hub.socialDesc",    icon: MessageSquare, action: "section" },
    { id: "docs",      labelKey: "hub.docs",      descKey: "hub.docsDesc",      icon: BookOpen,    action: "navigate", target: "docs" },
    { id: "accounts",  labelKey: "hub.accounts",  descKey: "hub.accountsDesc",  icon: Building2,   action: "navigate", target: "accounts",      agencyOnly: true },
    { id: "automations", labelKey: "hub.automations", descKey: "hub.automationsDesc", icon: Cpu,   action: "navigate", target: "automation-logs", agencyOnly: true },
    { id: "prompts",   labelKey: "hub.prompts",   descKey: "hub.promptsDesc",   icon: Bot,         action: "navigate", target: "prompt-library", agencyOnly: true },
  ];

  const SOCIAL_HUB_LINKS = [
    { label: "Instagram", handle: "@leadawaker", href: "https://www.instagram.com/leadawaker/", Icon: Instagram, color: "text-pink-600" },
    { label: "Facebook",  handle: "Lead Awaker",  href: "https://www.facebook.com/profile.php?id=61552291063345", Icon: Facebook, color: "text-blue-600" },
    { label: "Email",     handle: "gabriel@leadawaker.com", href: "mailto:gabriel@leadawaker.com", Icon: Mail, color: "text-foreground/70" },
    { label: "WhatsApp",  handle: "+(55) 47 9740-02162", href: "https://wa.me/5547974002162", Icon: Phone, color: "text-emerald-600" },
  ];

  const routePrefix = location.startsWith("/agency") ? "/agency" : "/subaccount";

  const renderMobileHubSectionContent = () => {
    switch (mobileSection) {
      case "profile":
        return renderProfile();
      case "language": {
        const LANG_OPTIONS = [
          { code: "en", label: "English",    nativeLabel: "English",    flag: "🇬🇧" },
          { code: "pt", label: "Portuguese", nativeLabel: "Português",  flag: "🇧🇷" },
          { code: "nl", label: "Dutch",      nativeLabel: "Nederlands", flag: "🇳🇱" },
        ] as const;
        const currentLangCode = i18n.language?.split("-")[0] || "en";
        return (
          <div className="px-4 pt-4 space-y-3" data-testid="section-language">
            <p className="text-sm text-muted-foreground">{t("hub.languageDesc")}</p>
            <div className="flex flex-col gap-3">
              {LANG_OPTIONS.map((lang) => {
                const isActive = currentLangCode === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      i18n.changeLanguage(lang.code);
                      localStorage.setItem("leadawaker_lang", lang.code);
                    }}
                    className={cn(
                      "flex items-center gap-3 px-4 py-4 rounded-2xl border-2 transition-all text-left",
                      isActive
                        ? "border-brand-indigo bg-brand-indigo/5 text-brand-indigo"
                        : "border-border text-foreground"
                    )}
                    data-testid={`language-option-${lang.code}`}
                  >
                    <span className="text-2xl leading-none">{lang.flag}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{lang.nativeLabel}</p>
                      <p className="text-xs text-muted-foreground">{lang.label}</p>
                    </div>
                    {isActive && (
                      <CheckCircle className="h-5 w-5 text-brand-indigo shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }
      case "theme":
        return (
          <div className="px-4 pt-4 space-y-3" data-testid="section-theme">
            <p className="text-sm text-muted-foreground">{t("hub.themeDesc")}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { if (isDark) toggleTheme(); }}
                className={cn(
                  "flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all",
                  !isDark ? "border-brand-indigo bg-brand-indigo/5 text-brand-indigo" : "border-border text-muted-foreground"
                )}
                data-testid="theme-option-light"
              >
                <Sun className="h-6 w-6" />
                <span className="text-sm font-medium">{t("hub.themeLight")}</span>
              </button>
              <button
                type="button"
                onClick={() => { if (!isDark) toggleTheme(); }}
                className={cn(
                  "flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all",
                  isDark ? "border-brand-indigo bg-brand-indigo/5 text-brand-indigo" : "border-border text-muted-foreground"
                )}
                data-testid="theme-option-dark"
              >
                <Moon className="h-6 w-6" />
                <span className="text-sm font-medium">{t("hub.themeDark")}</span>
              </button>
            </div>
          </div>
        );
      case "social":
        return (
          <div className="px-4 pt-4 space-y-2" data-testid="section-social">
            {SOCIAL_HUB_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.href.startsWith("mailto:") ? undefined : "_blank"}
                rel={link.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                className="flex items-center gap-3 rounded-2xl border border-border/40 px-4 py-4 hover:bg-muted/30 transition-colors min-h-[56px]"
              >
                <div className={cn("w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0", link.color)}>
                  <link.Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{link.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{link.handle}</div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              </a>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  const renderMobileHub = () => {
    const visibleItems = MOBILE_HUB_ITEMS.filter((item) => {
      if (item.agencyOnly && !isAgencyUser) return false;
      return true;
    });

    if (mobileSection !== null) {
      // Show section detail with back button
      const activeItem = MOBILE_HUB_ITEMS.find((i) => i.id === mobileSection);
      const Icon = activeItem?.icon ?? User;
      return (
        <div className="h-full flex flex-col overflow-hidden" data-testid="mobile-settings-section">
          {/* Section header with back button */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/20 bg-background shrink-0">
            <button
              type="button"
              onClick={() => setMobileSection(null)}
              className="icon-circle-lg icon-circle-base"
              aria-label={t("hub.back")}
              data-testid="mobile-settings-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">{t(activeItem?.labelKey ?? "")}</h2>
            </div>
          </div>
          {/* Section content */}
          <div className="flex-1 overflow-y-auto pb-8">
            {mobileSection === "profile" && (
              <div className="px-4 max-w-2xl">
                {renderProfile()}
              </div>
            )}
            {mobileSection !== "profile" && renderMobileHubSectionContent()}
          </div>
        </div>
      );
    }

    // Hub list view
    return (
      <div className="h-full overflow-y-auto" data-testid="mobile-settings-hub">
        {/* Header */}
        <div className="px-4 pt-8 pb-4">
          <h1 className="text-2xl font-semibold font-heading">{t("title")}</h1>
        </div>
        {/* Menu rows */}
        <div className="px-3 space-y-1 pb-8">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isToggle = item.action === "toggle";
            const isNav = item.action === "navigate";
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (isNav && item.target) {
                    setLocation(`${routePrefix}/${item.target}`);
                  } else if (isToggle) {
                    toggleTheme();
                  } else {
                    setMobileSection(item.id);
                  }
                }}
                className="w-full flex items-center gap-3 rounded-2xl px-4 bg-card hover:bg-card-hover transition-colors min-h-[56px] border border-border/30"
                data-testid={`mobile-hub-row-${item.id}`}
              >
                {/* Icon */}
                <div className="w-9 h-9 rounded-full bg-muted/60 flex items-center justify-center shrink-0 text-muted-foreground">
                  {item.id === "theme" ? (isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />) : <Icon className="h-4 w-4" />}
                </div>
                {/* Label + desc */}
                <div className="flex-1 min-w-0 text-left py-3.5">
                  <div className="text-sm font-medium text-foreground">{t(item.labelKey)}</div>
                  {item.descKey && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {item.id === "theme" ? (isDark ? t("hub.themeDark") : t("hub.themeLight")) : t(item.descKey)}
                    </div>
                  )}
                </div>
                {/* Right indicator */}
                {isNav ? (
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col" data-testid="page-settings">
      {/* Mobile: show hub or section detail */}
      {isMobile && renderMobileHub()}

      {/* Desktop layout (unchanged) */}
      {!isMobile && <div className={cn(
        "flex-1 gap-0 min-h-0 overflow-hidden",
        "flex"
      )}>
        {/* Left sidebar navigation / top pill bar on mobile */}
        <nav
          className={cn(
            isMobile
              ? "flex flex-row gap-1 px-3 py-2 overflow-x-auto [scrollbar-width:none] border-b border-border/20 shrink-0 bg-background"
              : "w-[340px] shrink-0 bg-muted rounded-lg overflow-y-auto"
          )}
          data-testid="settings-nav"
        >
          {!isMobile && (
            <div className="pl-[17px] pr-3.5 pt-10 pb-3">
              <h1 className="text-2xl font-semibold font-heading text-foreground leading-tight">{t("title")}</h1>
            </div>
          )}
          <div className={cn(
            isMobile
              ? "flex flex-row gap-1"
              : "flex flex-col gap-[3px] py-2 px-[3px]"
          )}>
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    isMobile
                      ? cn(
                          "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150 touch-target",
                          isActive ? "bg-[#FFF9D9] text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                        )
                      : cn(
                          "w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                          isActive
                            ? "bg-highlight-selected text-foreground font-semibold"
                            : "bg-card hover:bg-card-hover text-muted-foreground hover:text-foreground"
                        )
                  )}
                  data-testid={`settings-nav-${section.id}`}
                  data-active={isActive || undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{t(section.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Right content area */}
        <div className={cn(
          "flex-1 bg-card rounded-lg w-full",
          !isMobile && "ml-1.5",
          (activeSection === "team" || activeSection === "account") ? "overflow-hidden flex flex-col" : "overflow-y-auto pb-8",
        )} data-testid="settings-content">
          {activeSection !== "team" && activeSection !== "account" && (
            <div className="pl-[17px] pr-3.5 pt-10 pb-3">
              <h1 className="text-2xl font-semibold font-heading text-foreground leading-tight">
                {t(SECTIONS.find(s => s.id === activeSection)?.labelKey ?? "")}
              </h1>
            </div>
          )}
          <div className={cn(
            (activeSection === "team" || activeSection === "account")
              ? "flex-1 flex flex-col min-h-0 overflow-y-auto"
              : "px-4 md:px-6 max-w-2xl",
          )}>
            {renderActiveSection()}
          </div>
        </div>
      </div>}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <CrmShell>
      <SettingsContent />
    </CrmShell>
  );
}
