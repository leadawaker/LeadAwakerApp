import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/useIsMobile";
import { CrmShell } from "@/components/crm/CrmShell";
import { useToast } from "@/hooks/use-toast";
import { useDashboardRefreshInterval, REFRESH_INTERVAL_OPTIONS } from "@/hooks/useDashboardRefreshInterval";
import { useSession } from "@/hooks/useSession";
import { apiFetch } from "@/lib/apiUtils";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Mail, MessageSquare, Globe, Lock, Eye, EyeOff, Building2,
  User, Shield, Bell, Clock, Receipt, FileText, CheckCircle, PenLine,
  Phone, CalendarCheck, MessageSquareWarning, Bot, AlertTriangle,
  Megaphone, TrendingDown, Camera, X, Users,
} from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { SettingsTeamSection } from "@/features/users/components/SettingsTeamSection";
import { AccountDetailView } from "@/features/accounts/components/AccountDetailView";
import { updateAccount } from "@/features/accounts/api/accountsApi";
import type { AccountRow } from "@/features/accounts/components/AccountDetailsDialog";
import { SkeletonSettingsSection } from "@/components/ui/skeleton";
import { LanguageSelector } from "@/components/crm/LanguageSelector";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

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
};

// ── Notification types ───────────────────────────────────────────────
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

type NotifCategory = { label: string; events: NotifEventDef[] };

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

// ── Settings sections ────────────────────────────────────────────────
type SettingsSection = "profile" | "security" | "notifications" | "dashboard" | "team" | "account";

const BASE_SECTIONS: { id: SettingsSection; label: string; icon: React.ElementType; agencyOnly?: boolean; scopedOnly?: boolean }[] = [
  { id: "account", label: "My Account", icon: Building2, scopedOnly: true },
  { id: "profile", label: "My Profile", icon: User },
  { id: "security", label: "Security", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "dashboard", label: "Dashboard", icon: Clock },
  { id: "team", label: "Team", icon: Users, agencyOnly: true },
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
        className="mt-1.5 h-10 w-full rounded-xl border border-border/40 bg-input-bg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-indigo/20 focus:border-brand-indigo/40"
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
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative mt-1.5">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-xl border border-border/40 bg-input-bg px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-indigo/20 focus:border-brand-indigo/40"
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


// ── Main Settings Page ───────────────────────────────────────────────
function SettingsContent() {
  const { toast } = useToast();
  const { intervalSeconds, setIntervalSeconds, labelForInterval } = useDashboardRefreshInterval();
  const session = useSession();
  const { isAgencyUser, currentAccountId } = useWorkspace();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
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
    toast({ title: "Saved", description: `Account ${field} updated.` });
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

  // ── Notification state ─────────────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(getDefaultNotifPrefs);
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);

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

        // Also load notification preferences
        if ((data as any).preferences) {
          try {
            const parsed = typeof (data as any).preferences === "string"
              ? JSON.parse((data as any).preferences)
              : (data as any).preferences;
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

      toast({ variant: "success", title: "Profile saved", description: "Your changes have been saved." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Save failed", description: err.message || "Could not save profile." });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Change password ────────────────────────────────────────────────
  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
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
      toast({ variant: "success", title: "Password changed", description: "Your password has been updated successfully." });
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password.");
      toast({ variant: "destructive", title: "Error", description: err.message || "Failed to change password." });
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
      toast({ variant: "success", title: "Reset email sent", description: "Check your inbox for a password reset link." });
    } catch {
      toast({ variant: "info", title: "Not available", description: "Password reset via email is not yet available." });
    } finally {
      setIsResetting(false);
    }
  };

  // ── Notification prefs ─────────────────────────────────────────────
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


  // ── User initials for avatar ───────────────────────────────────────
  const userInitials = (() => {
    const n = name || email || "U";
    const parts = n.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0]?.[0] || "U").toUpperCase();
  })();

  // ── Render sections ────────────────────────────────────────────────
  const renderProfile = () => (
    <div className="space-y-6" data-testid="section-profile">
      {/* Language */}
      <div className="flex items-center gap-3">
        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground">Language</span>
        <div className="ml-auto"><LanguageSelector /></div>
      </div>

      <p className="text-sm text-muted-foreground">
        Update your personal information and preferences.
      </p>

      {profileLoading ? (
        <SkeletonSettingsSection rows={4} />
      ) : profileError ? (
        <div className="text-sm text-red-500 py-4">{profileError}</div>
      ) : (
        <>
          {/* Avatar display — clickable with upload */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0 group/avatar">
              {/* Avatar circle — click to upload */}
              <div
                className={cn(
                  "h-[72px] w-[72px] rounded-full overflow-hidden cursor-pointer",
                  !avatarUrl && "flex items-center justify-center text-xl font-bold"
                )}
                onClick={() => avatarInputRef.current?.click()}
                title="Click to upload photo"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
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
                  title="Remove photo"
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
              <DialogContent className="sm:max-w-[360px]">
                <DialogHeader>
                  <DialogTitle>Crop Photo</DialogTitle>
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
                        alt="Crop preview"
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
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCropConfirm}
                    className="px-4 py-2 text-sm font-medium rounded-md bg-brand-indigo text-white hover:opacity-90 transition-opacity"
                  >
                    Confirm
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div>
              <div className="text-sm font-semibold text-foreground">{name || "No name set"}</div>
              <div className="text-xs text-muted-foreground">{profile?.role || "User"}</div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="mt-1 text-xs font-semibold text-brand-indigo hover:opacity-80 transition-opacity"
              >
                Upload photo
              </button>
            </div>
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-onboarding="profile-name">
            <Field
              label="Full Name"
              value={name}
              onChange={setName}
              testId="input-profile-name"
              placeholder="Your full name"
              icon={User}
            />
            <Field
              label="Email"
              value={email}
              onChange={setEmail}
              testId="input-profile-email"
              placeholder="your@email.com"
              type="email"
              icon={Mail}
            />
            <Field
              label="Phone"
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
                Timezone
              </label>
              <select
                id="profile-timezone-select"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-xl border border-border/40 bg-input-bg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-indigo/20 focus:border-brand-indigo/40"
                data-testid="select-profile-timezone"
                aria-label="Select timezone"
              >
                <option value="">-- Select timezone --</option>
                <option value="America/Sao_Paulo">America/Sao Paulo</option>
                <option value="Europe/Amsterdam">Europe/Amsterdam</option>
              </select>
              {timezone && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Current: <span className="font-medium text-foreground">{timezone.replace(/_/g, " ")}</span>
                </p>
              )}
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              className="h-10 px-6 rounded-full bg-brand-indigo text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-150"
              data-testid="button-save-profile"
              data-onboarding="save-profile"
              onClick={handleSaveProfile}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>

          {/* Tutorial restart — only for subaccount users */}
          {!isAgencyUser && (
            <div className="pt-4 mt-4 border-t border-border/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Onboarding Tutorial</p>
                  <p className="text-xs text-muted-foreground">Restart the guided setup walkthrough</p>
                </div>
                <button
                  type="button"
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  data-testid="button-restart-tutorial"
                  onClick={async () => {
                    try {
                      const res = await apiFetch("/api/onboarding/restart", { method: "POST" });
                      if (res.ok) {
                        const data = await res.json();
                        queryClient.setQueryData(["/api/onboarding/status"], data);
                        toast({ title: "Tutorial restarted", description: "The onboarding walkthrough is starting." });
                        // Navigate to campaigns — fresh OnboardingProvider mounts and
                        // immediately shows the WelcomeModal since startedAt is null
                        setTimeout(() => setLocation("/subaccount/campaigns"), 400);
                      } else {
                        toast({ title: "Error", description: "Failed to restart tutorial", variant: "destructive" });
                      }
                    } catch {
                      toast({ title: "Error", description: "Failed to restart tutorial", variant: "destructive" });
                    }
                  }}
                >
                  Restart Tutorial
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderSecurity = () => (
    <div className="space-y-6" data-testid="section-security">
      <p className="text-sm text-muted-foreground">
        Manage your password and account security.
      </p>

      {/* Change Password */}
      <div className="rounded-xl bg-muted/60 p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-full bg-background flex items-center justify-center shrink-0">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold">Change Password</div>
            <div className="text-xs text-muted-foreground">Update your account password.</div>
          </div>
        </div>

        {passwordError && (
          <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2" data-testid="text-password-error">
            {passwordError}
          </div>
        )}

        <div className="space-y-3">
          <PasswordField
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrentPassword}
            onToggleShow={() => setShowCurrentPassword((p) => !p)}
            testId="input-current-password"
            placeholder="Current password"
            autoComplete="current-password"
          />
          <PasswordField
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            show={showNewPassword}
            onToggleShow={() => setShowNewPassword((p) => !p)}
            testId="input-new-password"
            placeholder="New password (min 6 chars)"
            autoComplete="new-password"
          />
          <PasswordField
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirmPassword}
            onToggleShow={() => setShowConfirmPassword((p) => !p)}
            testId="input-confirm-password"
            placeholder="Confirm new password"
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
            {isResetting ? "Sending..." : "Forgot? Send reset email"}
          </button>
          <button
            type="button"
            onClick={handleChangePassword}
            disabled={isChangingPassword}
            className="h-10 px-6 rounded-full bg-brand-indigo text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-150"
            data-testid="button-change-password"
          >
            {isChangingPassword ? "Changing..." : "Update Password"}
          </button>
        </div>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-6" data-testid="section-notifications">
      <p className="text-sm text-muted-foreground">
        Choose how and when you receive notifications.
      </p>

      {/* Master toggle */}
      <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/60 px-4 py-3">
        <div>
          <div className="text-sm font-semibold">All Notifications</div>
          <div className="text-xs text-muted-foreground h-4">
            {isSavingNotifs && <span className="italic">Saving...</span>}
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
        <div className="grid grid-cols-[1fr_3.5rem_3.5rem_3.5rem] gap-1 mb-2 px-1">
          <div />
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">App</div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">Email</div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">SMS</div>
        </div>

        {NOTIF_CATEGORIES.map((cat) => {
          const visibleEvents = cat.events.filter((ev) => !ev.roles || ev.roles.includes(userRole));
          if (visibleEvents.length === 0) return null;
          return (
            <div key={cat.label} className="mb-5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
                {cat.label}
              </div>
              <div className="space-y-0.5">
                {visibleEvents.map((ev) => {
                  const channel = notifPrefs.events[ev.key] ?? ev.defaults;
                  const Icon = ev.icon;
                  return (
                    <div
                      key={ev.key}
                      className="grid grid-cols-[1fr_3.5rem_3.5rem_3.5rem] gap-1 items-center rounded-lg px-1 py-1.5 hover:bg-muted/40 transition-colors duration-150"
                      data-testid={`row-notif-${ev.key}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-[13px] truncate">{ev.label}</span>
                      </div>
                      {(["in_app", "email", "sms"] as const).map((ch) => (
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
        <div className="pt-4 mt-2 space-y-3 border-t border-border/20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div>
                <div className="text-[13px] font-semibold">Quiet Hours</div>
                <div className="text-xs text-muted-foreground mt-0.5">Email and SMS held. In-app still appears.</div>
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
            <div className="flex items-center gap-3 pl-6 flex-wrap">
              <label className="text-xs text-muted-foreground">Start</label>
              <input
                type="time"
                value={notifPrefs.quiet_hours.start}
                onChange={(e) =>
                  updateNotifPrefs((p) => ({ ...p, quiet_hours: { ...p.quiet_hours, start: e.target.value } }))
                }
                className="h-10 rounded-xl border border-border/40 bg-input-bg px-3 text-sm"
                data-testid="input-quiet-start"
              />
              <label className="text-xs text-muted-foreground">End</label>
              <input
                type="time"
                value={notifPrefs.quiet_hours.end}
                onChange={(e) =>
                  updateNotifPrefs((p) => ({ ...p, quiet_hours: { ...p.quiet_hours, end: e.target.value } }))
                }
                className="h-10 rounded-xl border border-border/40 bg-input-bg px-3 text-sm"
                data-testid="input-quiet-end"
              />
            </div>
          )}
        </div>

        {/* Digest */}
        <div className="pt-4 mt-4 space-y-3 border-t border-border/20">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Digest</div>
          <div className="flex items-center justify-between gap-4">
            <div className="text-[13px]">Daily Summary Email</div>
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
            <div className="text-[13px]">Weekly Report Email</div>
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
  );

  const renderDashboard = () => (
    <div className="space-y-6" data-testid="section-dashboard">
      <p className="text-sm text-muted-foreground">
        Configure dashboard behavior and auto-refresh intervals.
      </p>

      <div className="rounded-xl bg-muted/60 p-5 space-y-4">
        <div>
          <div className="text-sm font-semibold">Auto-Refresh Interval</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Current: <span className="font-semibold text-foreground" data-testid="text-current-interval">{labelForInterval}</span>
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
                  title: "Refresh interval updated",
                  description: option.value === 0 ? "Auto-refresh disabled." : `Refreshes every ${option.label}.`,
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
        if (!accountData) return <div className="text-muted-foreground text-sm py-8 text-center">Account not found</div>;
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
      case "security": return renderSecurity();
      case "notifications": return renderNotifications();
      case "dashboard": return renderDashboard();
      case "team": return <SettingsTeamSection />;
    }
  };

  return (
    <div className="h-full flex flex-col" data-testid="page-settings">
      {/* Layout: sidebar + content */}
      <div className={cn(
        "flex-1 gap-0 min-h-0 overflow-hidden",
        isMobile ? "flex flex-col" : "flex"
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
              <h1 className="text-2xl font-semibold font-heading text-foreground leading-tight">Settings</h1>
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
                          "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150",
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
                  <span>{section.label}</span>
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
                {SECTIONS.find(s => s.id === activeSection)?.label}
              </h1>
            </div>
          )}
          <div className={cn(
            (activeSection === "team" || activeSection === "account")
              ? "flex-1 flex flex-col min-h-0 overflow-y-auto"
              : "px-6 max-w-2xl",
          )}>
            {renderActiveSection()}
          </div>
        </div>
      </div>
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
