import { useState, useEffect, useCallback, useRef, useContext } from "react";
import { useTranslation } from "react-i18next";
import { hapticSave } from "@/lib/haptics";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/useSession";
import { apiFetch, API_BASE } from "@/lib/apiUtils";
import { cn } from "@/lib/utils";
import {
  Mail, Globe, User, Shield, Clock,
  Phone, Camera, X, ChevronDown, BookOpen,
} from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { SkeletonSettingsSection } from "@/components/ui/skeleton";
import { LanguageSelector } from "@/components/crm/LanguageSelector";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { OnboardingContext } from "@/components/onboarding/OnboardingProvider";
import type { UserProfile } from "../types";
import { Field, PasswordField } from "./SettingsFields";

export function ProfileSection() {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const session = useSession();
  const { isAgencyUser } = useWorkspace();
  const { triggerRestart } = useContext(OnboardingContext);
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
}
