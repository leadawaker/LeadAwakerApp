import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { hapticSave } from "@/lib/haptics";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/useSession";
import { apiFetch, API_BASE } from "@/lib/apiUtils";
import { cn } from "@/lib/utils";
import {
  Mail, Globe, User, Shield, Clock,
  Phone, Camera, X, ChevronDown, Eye, Compass,
} from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useImpersonation } from "@/hooks/useImpersonation";
import { SkeletonSettingsSection } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { UserProfile } from "../types";
import { Field, PasswordField } from "./SettingsFields";

function parsePrefs(raw: UserProfile["preferences"]): Record<string, any> {
  try {
    return typeof raw === "string" ? JSON.parse(raw || "{}") : (raw ?? {});
  } catch {
    return {};
  }
}

export function ProfileSection() {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const session = useSession();
  const { isAgencyUser, isOwner, accounts, currentAccountId } = useWorkspace();
  const { impersonate } = useImpersonation();
  const isMobile = useIsMobile();

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

  // ── Outreach pages nav toggle (Owner-only) ────────────────────────
  const [showOutreachPages, setShowOutreachPages] = useState(false);
  const [outreachToggleSaving, setOutreachToggleSaving] = useState(false);

  const handleToggleOutreachPages = async (checked: boolean) => {
    if (!profile) return;
    setOutreachToggleSaving(true);
    const prevValue = showOutreachPages;
    setShowOutreachPages(checked);
    try {
      const existingPrefs = parsePrefs(profile.preferences);
      const newPrefs = { ...existingPrefs, showOutreachPages: checked };
      const res = await apiFetch(`/api/users/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: JSON.stringify(newPrefs) }),
      });
      if (!res.ok) throw new Error();
      const updated: UserProfile = await res.json();
      setProfile(updated);
      localStorage.setItem("leadawaker_show_outreach_pages", checked ? "1" : "0");
      window.dispatchEvent(new Event("leadawaker-prefs-changed"));
    } catch {
      setShowOutreachPages(prevValue);
      toast({ variant: "destructive", title: t("profile.saveFailed"), description: t("profile.saveFailedDescription") });
    } finally {
      setOutreachToggleSaving(false);
    }
  };

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
        setShowOutreachPages(!!parsePrefs(data.preferences).showOutreachPages);
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

  // ── User initials for avatar ───────────────────────────────────────
  const userInitials = (() => {
    const n = name || email || "U";
    const parts = n.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0]?.[0] || "U").toUpperCase();
  })();

  return (
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
                    className="la-btn la-btn--soft"
                  >
                    {t("cropDialog.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleCropConfirm}
                    className="la-btn la-btn--wine"
                  >
                    {t("cropDialog.confirm")}
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="flex-1 min-w-0">
              <div className="text-3xl font-bold font-heading text-foreground truncate">{name || t("profile.noName")}</div>
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
            <div className="text-sm font-semibold text-foreground">{t("profile.description")}</div>
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
                style={{ borderRadius: "var(--r-button)", backgroundColor: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }}
                className="mt-1.5 h-10 w-full text-foreground px-3 pr-8 text-sm appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat focus:outline-none focus:ring-2 focus:ring-brand-indigo/20"
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
                className="la-btn la-btn--wine la-btn--lg la-btn--pill disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className="text-xs font-semibold hover:opacity-80 disabled:opacity-50 transition-opacity duration-150"
                      style={{ color: "var(--wine)" }}
                      data-testid="button-reset-password"
                    >
                      {isResetting ? t("security.sendingReset") : t("security.forgotSendReset")}
                    </button>
                    <button
                      type="button"
                      onClick={handleChangePassword}
                      disabled={isChangingPassword}
                      className="la-btn la-btn--wine la-btn--lg la-btn--pill disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="button-change-password"
                    >
                      {isChangingPassword ? t("security.changing") : t("security.updatePassword")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── View As + Gmail Integration side by side (Owner only) ── */}
          {isOwner && (() => {
            const selectedAccount = currentAccountId > 0 ? accounts.find(a => a.id === currentAccountId) : null;
            const clientLabel = selectedAccount
              ? `View as Client: ${selectedAccount.name}`
              : "View as Client (sandbox)";
            return (
              <div className="grid grid-cols-3 gap-4">
                {/* Outreach pages nav toggle */}
                <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <Compass className="h-4 w-4 text-muted-foreground" />
                    {t("profile.outreachPages")}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("profile.outreachPagesDescription")}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-medium text-foreground">{t("profile.outreachPagesToggle")}</span>
                    <Switch
                      checked={showOutreachPages}
                      onCheckedChange={handleToggleOutreachPages}
                      disabled={outreachToggleSaving}
                      data-testid="switch-outreach-pages"
                    />
                  </div>
                </div>

                {/* View As */}
                <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    {t("profile.impersonation")}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("profile.impersonationDescription")}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => impersonate("Admin")}
                      className="la-btn la-btn--soft la-btn--pill"
                    >
                      <div className="h-4 w-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0 bg-primary text-primary-foreground">A</div>
                      {t("profile.viewAsAdmin")}
                    </button>
                    <button
                      type="button"
                      onClick={() => impersonate("Manager", selectedAccount ? currentAccountId : undefined)}
                      className="la-btn la-btn--soft la-btn--pill"
                    >
                      <div className="h-4 w-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0 bg-muted-foreground/20 text-muted-foreground">C</div>
                      {clientLabel}
                    </button>
                  </div>
                </div>

                {/* Gmail Integration */}
                <div className="rounded-lg border border-border bg-card p-4 space-y-3">
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
                      className="la-btn la-btn--wine"
                    >
                      <Mail className="h-4 w-4" />
                      {gmailLoading ? "..." : t("gmail.connect")}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
