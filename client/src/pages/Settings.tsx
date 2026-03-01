import { useState, useEffect, useCallback, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useToast } from "@/hooks/use-toast";
import { useDashboardRefreshInterval, REFRESH_INTERVAL_OPTIONS } from "@/hooks/useDashboardRefreshInterval";
import { useSession } from "@/hooks/useSession";
import { apiFetch } from "@/lib/apiUtils";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Mail, MessageSquare, Globe, Lock, Eye, EyeOff,
  User, Shield, Bell, Clock, Receipt, FileText, CheckCircle, PenLine,
  Phone, CalendarCheck, MessageSquareWarning, Bot, AlertTriangle,
  Megaphone, TrendingDown, Camera, X, Headphones, Users,
} from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SettingsTeamSection } from "@/features/users/components/SettingsTeamSection";

// ── Timezone list ────────────────────────────────────────────────────
const TIMEZONE_LIST: string[] = (() => {
  try {
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      return (Intl as any).supportedValuesOf("timeZone") as string[];
    }
  } catch {
    // fall through to fallback
  }
  return [
    "Africa/Abidjan", "Africa/Accra", "Africa/Cairo", "Africa/Johannesburg", "Africa/Lagos", "Africa/Nairobi",
    "America/Anchorage", "America/Argentina/Buenos_Aires", "America/Bogota", "America/Chicago",
    "America/Denver", "America/Halifax", "America/Lima", "America/Los_Angeles", "America/Mexico_City",
    "America/New_York", "America/Phoenix", "America/Santiago", "America/Sao_Paulo", "America/Toronto",
    "America/Vancouver", "Asia/Bangkok", "Asia/Colombo", "Asia/Dubai", "Asia/Hong_Kong", "Asia/Jakarta",
    "Asia/Karachi", "Asia/Kolkata", "Asia/Kuala_Lumpur", "Asia/Manila", "Asia/Seoul", "Asia/Shanghai",
    "Asia/Singapore", "Asia/Taipei", "Asia/Tehran", "Asia/Tokyo", "Atlantic/Reykjavik",
    "Australia/Adelaide", "Australia/Brisbane", "Australia/Melbourne", "Australia/Perth", "Australia/Sydney",
    "Europe/Amsterdam", "Europe/Athens", "Europe/Berlin", "Europe/Brussels", "Europe/Budapest",
    "Europe/Copenhagen", "Europe/Dublin", "Europe/Helsinki", "Europe/Istanbul", "Europe/Kiev",
    "Europe/Lisbon", "Europe/London", "Europe/Madrid", "Europe/Moscow", "Europe/Oslo",
    "Europe/Paris", "Europe/Prague", "Europe/Rome", "Europe/Sofia", "Europe/Stockholm",
    "Europe/Vienna", "Europe/Warsaw", "Europe/Zurich", "Pacific/Auckland", "Pacific/Fiji",
    "Pacific/Guam", "Pacific/Honolulu", "Pacific/Midway", "UTC",
  ];
})();

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
type SettingsSection = "profile" | "security" | "notifications" | "dashboard" | "team" | "support_bot";

const BASE_SECTIONS: { id: SettingsSection; label: string; icon: React.ElementType; agencyOnly?: boolean }[] = [
  { id: "profile", label: "My Profile", icon: User },
  { id: "security", label: "Security", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "dashboard", label: "Dashboard", icon: Clock },
  { id: "team", label: "Team", icon: Users, agencyOnly: true },
  { id: "support_bot", label: "Support Bot", icon: Headphones, agencyOnly: true },
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

// ── Bot Photo Crop Modal ─────────────────────────────────────────────
function BotPhotoCropModal({ srcUrl, onSave, onCancel }: {
  srcUrl: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const PREVIEW = 240;
  const OUTPUT = 128;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  useEffect(() => {
    const img = new globalThis.Image();
    img.onload = () => {
      imgRef.current = img;
      setZoom(Math.min(PREVIEW / img.width, PREVIEW / img.height));
      setOffset({ x: 0, y: 0 });
    };
    img.src = srcUrl;
  }, [srcUrl]);

  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, PREVIEW, PREVIEW);
    const w = img.width * zoom;
    const h = img.height * zoom;
    ctx.drawImage(img, (PREVIEW - w) / 2 + offset.x, (PREVIEW - h) / 2 + offset.y, w, h);
  }, [zoom, offset]);

  const handleSave = () => {
    const img = imgRef.current;
    if (!img) return;
    const out = document.createElement("canvas");
    out.width = OUTPUT; out.height = OUTPUT;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    const f = OUTPUT / PREVIEW;
    const w = img.width * zoom * f;
    const h = img.height * zoom * f;
    ctx.drawImage(img, (OUTPUT - w) / 2 + offset.x * f, (OUTPUT - h) / 2 + offset.y * f, w, h);
    onSave(out.toDataURL("image/jpeg", 0.85));
  };

  const onMouseDown = (e: ReactMouseEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = (e: ReactMouseEvent) => {
    if (!dragging.current) return;
    setOffset({
      x: dragStart.current.ox + e.clientX - dragStart.current.x,
      y: dragStart.current.oy + e.clientY - dragStart.current.y,
    });
  };
  const onMouseUp = () => { dragging.current = false; };

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Crop Photo</DialogTitle>
          <DialogDescription>Drag to reposition · use slider to zoom</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-full overflow-hidden ring-2 ring-brand-indigo/20" style={{ width: PREVIEW, height: PREVIEW }}>
            <canvas
              ref={canvasRef}
              width={PREVIEW}
              height={PREVIEW}
              className="cursor-grab active:cursor-grabbing"
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            />
          </div>
          <div className="flex items-center gap-3 w-full px-2">
            <button type="button" onClick={() => setZoom((z) => Math.max(0.05, parseFloat((z - 0.1).toFixed(2))))}
              className="h-6 w-6 rounded-full flex items-center justify-center text-[14px] font-bold text-muted-foreground hover:bg-muted transition-colors select-none shrink-0">−</button>
            <input type="range" min="0.05" max="8" step="0.05" value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-brand-indigo" />
            <button type="button" onClick={() => setZoom((z) => Math.min(8, parseFloat((z + 0.1).toFixed(2))))}
              className="h-6 w-6 rounded-full flex items-center justify-center text-[14px] font-bold text-muted-foreground hover:bg-muted transition-colors select-none shrink-0">+</button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave}>Save Photo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Settings Page ───────────────────────────────────────────────
function SettingsContent() {
  const { toast } = useToast();
  const { intervalSeconds, setIntervalSeconds, labelForInterval } = useDashboardRefreshInterval();
  const session = useSession();
  const { isAgencyUser } = useWorkspace();
  const SECTIONS = BASE_SECTIONS.filter((s) => !s.agencyOnly || isAgencyUser);

  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");

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
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

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

  // ── Support Bot state ─────────────────────────────────────────────
  const [botName, setBotName] = useState("Sophie");
  const [botPhotoUrl, setBotPhotoUrl] = useState("");
  const [botEnabled, setBotEnabled] = useState(true);
  const [isSavingBot, setIsSavingBot] = useState(false);
  const [botLoaded, setBotLoaded] = useState(false);
  const botPhotoInputRef = useRef<HTMLInputElement>(null);

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
      <p className="text-sm text-muted-foreground">
        Update your personal information and preferences.
      </p>

      {profileLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading profile...</div>
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
              {/* Camera overlay on hover */}
              <div
                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer pointer-events-none"
              >
                <Camera className="w-6 h-6 text-white" />
              </div>
              {/* Remove button — hover-only, top-right */}
              {avatarUrl && (
                <button
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-white border border-black/[0.125] flex items-center justify-center text-foreground/50 hover:text-red-500 hover:border-red-300 transition-colors z-10 opacity-0 group-hover/avatar:opacity-100"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div data-testid="input-profile-timezone-wrap">
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
                {TIMEZONE_LIST.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              {timezone && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Current: <span className="font-medium text-foreground">{timezone.replace(/_/g, " ")}</span>
                </p>
              )}
            </div>
          </div>

          {/* Avatar URL */}
          <Field
            label="Avatar URL"
            value={avatarUrl}
            onChange={setAvatarUrl}
            testId="input-profile-avatar-url"
            placeholder="https://example.com/avatar.png"
          />

          {/* Save button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              className="h-10 px-6 rounded-full bg-brand-indigo text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-150"
              data-testid="button-save-profile"
              onClick={handleSaveProfile}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
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
            <div className="flex items-center gap-3 pl-6">
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

  // ── Chat Wallpaper Section ──────────────────────────────────────────
  // ── Support Bot: load config ───────────────────────────────────────
  useEffect(() => {
    if (activeSection !== "support_bot" || botLoaded) return;
    (async () => {
      try {
        const res = await apiFetch("/api/support-chat/config");
        if (res.ok) {
          const cfg = await res.json();
          setBotName(cfg.name || "Sophie");
          setBotPhotoUrl(cfg.photoUrl || "");
          setBotEnabled(cfg.enabled !== false);
        }
      } catch { /* use defaults */ }
      setBotLoaded(true);
    })();
  }, [activeSection, botLoaded]);

  const [botCropSrc, setBotCropSrc] = useState<string | null>(null);

  const handleBotPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setBotCropSrc(reader.result);
    };
    reader.readAsDataURL(file);
    if (botPhotoInputRef.current) botPhotoInputRef.current.value = "";
  };

  const handleSaveBotConfig = async () => {
    setIsSavingBot(true);
    try {
      const res = await apiFetch("/api/support-chat/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: botName.trim() || "Sophie", photoUrl: botPhotoUrl || null, enabled: botEnabled }),
      });
      if (res.ok) {
        toast({ title: "Support bot settings saved", variant: "success" as any });
      } else {
        toast({ title: "Failed to save", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setIsSavingBot(false);
    }
  };

  const renderSupportBot = () => (
    <div className="space-y-6 py-2" data-testid="settings-support-bot">
      {/* Bot photo crop modal */}
      {botCropSrc && (
        <BotPhotoCropModal
          srcUrl={botCropSrc}
          onSave={(dataUrl) => { setBotPhotoUrl(dataUrl); setBotCropSrc(null); }}
          onCancel={() => setBotCropSrc(null)}
        />
      )}

      {/* Bot avatar */}
      <div className="flex items-start gap-6">
        <div className="relative group cursor-pointer" onClick={() => botPhotoInputRef.current?.click()}>
          <div className={cn(
            "h-20 w-20 rounded-full overflow-hidden border-2 border-border/40",
            !botPhotoUrl && "flex items-center justify-center bg-brand-indigo/10"
          )}>
            {botPhotoUrl ? (
              <img src={botPhotoUrl} alt={botName} className="h-full w-full object-cover" />
            ) : (
              <Headphones className="h-8 w-8 text-brand-indigo" />
            )}
          </div>
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-6 h-6 text-white" />
          </div>
          {botPhotoUrl && (
            <button
              onClick={(e) => { e.stopPropagation(); setBotPhotoUrl(""); }}
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <input ref={botPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleBotPhotoChange} />
        </div>
        <div className="flex-1 pt-1">
          <p className="text-sm font-medium text-foreground">Bot Photo</p>
          <p className="text-xs text-muted-foreground mt-1">Click to upload a photo for your support assistant. Shown in the chat widget header and next to messages.</p>
        </div>
      </div>

      {/* Bot name */}
      <Field
        label="Bot Name"
        value={botName}
        onChange={setBotName}
        testId="bot-name"
        placeholder="Sophie"
        icon={Headphones}
      />

      {/* Enable/disable */}
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-sm font-medium text-foreground">Enable Support Bot</p>
          <p className="text-xs text-muted-foreground mt-0.5">Show the support chat button in the top bar for all users.</p>
        </div>
        <Switch checked={botEnabled} onCheckedChange={setBotEnabled} />
      </div>

      {/* Prompt link */}
      <div className="rounded-xl bg-muted/50 p-4">
        <p className="text-sm font-medium text-foreground">System Prompt</p>
        <p className="text-xs text-muted-foreground mt-1">
          The bot's behavior is controlled by the <strong>"Lead Awaker Support Bot"</strong> entry in your Prompt Library.
          Edit it there to change how the bot responds, what it knows, and when it escalates to a human.
        </p>
      </div>

      {/* Save */}
      <button
        onClick={handleSaveBotConfig}
        disabled={isSavingBot}
        className="h-10 px-6 rounded-xl bg-brand-indigo text-white text-sm font-medium hover:bg-brand-indigo/90 transition-colors disabled:opacity-50"
      >
        {isSavingBot ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );

  const renderActiveSection = () => {
    switch (activeSection) {
      case "profile": return renderProfile();
      case "security": return renderSecurity();
      case "notifications": return renderNotifications();
      case "dashboard": return renderDashboard();
      case "team": return <SettingsTeamSection />;
      case "support_bot": return renderSupportBot();
    }
  };

  return (
    <div className="h-full flex flex-col" data-testid="page-settings">
      {/* Layout: sidebar + content */}
      <div className="flex-1 flex gap-0 min-h-0 overflow-hidden">
        {/* Left sidebar navigation */}
        <nav className="w-[340px] shrink-0 bg-muted rounded-lg overflow-y-auto" data-testid="settings-nav">
          <div className="px-3.5 pt-5 pb-1">
            <h1 className="text-2xl font-semibold font-heading text-foreground leading-tight">Settings</h1>
          </div>
          <div className="flex flex-col gap-[3px] py-2 px-[3px]">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                    isActive
                      ? "bg-highlight-selected text-foreground font-semibold"
                      : "bg-card hover:bg-card-hover text-muted-foreground hover:text-foreground"
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
          "flex-1 ml-1.5 bg-card rounded-lg",
          activeSection === "team" ? "overflow-hidden flex flex-col" : "overflow-y-auto pb-8",
        )} data-testid="settings-content">
          {activeSection !== "team" && (
            <div className="px-3.5 pt-5 pb-3">
              <h1 className="text-2xl font-semibold font-heading text-foreground leading-tight">
                {SECTIONS.find(s => s.id === activeSection)?.label}
              </h1>
            </div>
          )}
          <div className={cn(
            activeSection === "team"
              ? "flex-1 flex flex-col min-h-0"
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
