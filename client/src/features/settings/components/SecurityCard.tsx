import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiUtils";
import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/crm/primitives";
import { PasswordField } from "./SettingsFields";

/** Collapsible change-password block with a "send reset email" fallback. */
export function SecurityCard({ email }: { email: string }) {
  const { t } = useTranslation("settings");
  const { toast } = useToast();

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
    <SectionCard padded={false} className="overflow-hidden" data-testid="section-security">
      <button
        type="button"
        onClick={() => setShowPasswordSection((p) => !p)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/60 transition-colors duration-150"
        data-testid="toggle-password-section"
      >
        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Shield className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-semibold text-foreground">{t("security.changePassword")}</div>
          <div className="text-xs text-muted-foreground">{t("security.changePasswordDescription")}</div>
        </div>
        <ChevronDown className={cn(
          "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
          showPasswordSection && "rotate-180",
        )} />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: showPasswordSection ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 pt-1 space-y-4">
            {passwordError && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2" data-testid="text-password-error">
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
    </SectionCard>
  );
}
