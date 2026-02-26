import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiUtils";
import {
  Dialog,
  DialogPortal,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function ChangePasswordDialog({
  open,
  onOpenChange,
  userEmail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string | null;
}) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChanging, setIsChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const resetFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetFields();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All fields are required.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

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
      toast({ variant: "success", title: "Password changed", description: "Your password has been updated successfully." });
      handleOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to change password.");
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
        body: JSON.stringify({ email: userEmail }),
      });
      if (!res.ok) throw new Error();
      toast({ variant: "success", title: "Reset email sent", description: "Check your inbox for a password reset link." });
    } catch {
      toast({ variant: "info", title: "Not available", description: "Password reset via email is not yet available. Please contact your administrator." });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        {/* Lighter overlay — less dark, minimal blur */}
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] border bg-background p-6 shadow-lg duration-200 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-lg flex flex-col gap-4"
          data-testid="dialog-change-password"
        >
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6 6 18M6 6l12 12"/></svg>
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Change Password
            </DialogTitle>
            <DialogDescription>Update your account password.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {error && (
              <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2" data-testid="text-password-error">
                {error}
              </div>
            )}

            <PasswordField
              label="Current password"
              value={currentPassword}
              onChange={setCurrentPassword}
              show={showCurrent}
              onToggleShow={() => setShowCurrent((p) => !p)}
              testId="input-current-password"
              placeholder="Current password"
              autoComplete="current-password"
            />
            <PasswordField
              label="New password"
              value={newPassword}
              onChange={setNewPassword}
              show={showNew}
              onToggleShow={() => setShowNew((p) => !p)}
              testId="input-new-password"
              placeholder="New password (min 6 chars)"
              autoComplete="new-password"
            />
            <PasswordField
              label="Confirm new password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirm}
              onToggleShow={() => setShowConfirm((p) => !p)}
              testId="input-confirm-password"
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
          </div>

          {/* Centered change password button — no Cancel */}
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isChanging}
              className="h-10 px-6 rounded-xl border border-border bg-primary text-primary-foreground hover:opacity-90 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="button-change-password"
            >
              {isChanging ? "Changing…" : "Change Password"}
            </button>
          </div>

          {/* Separator */}
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {/* Reset password email */}
          <div className="text-center space-y-2">
            <div className="text-sm text-muted-foreground">Forgot your current password?</div>
            <button
              type="button"
              onClick={handleResetEmail}
              disabled={isResetting}
              className="h-9 px-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 text-sm font-semibold transition-colors disabled:opacity-50"
              data-testid="button-reset-password"
            >
              {isResetting ? "Sending…" : "Send Password Reset Email"}
            </button>
            {userEmail && (
              <div className="text-xs text-muted-foreground">
                A reset link will be sent to <span className="font-medium text-foreground">{userEmail}</span>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

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
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="relative mt-1">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-xl border border-border bg-muted/20 px-3 pr-10 text-sm"
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
