import { motion } from "framer-motion";
import { Lock, User, Eye, EyeOff, ArrowRight, Loader2, CheckCircle, AlertCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";

const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const email = params.get("email");

export default function AcceptInvite() {
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [, setLocation] = useLocation();

  // Auto-redirect if already logged in
  useEffect(() => {
    if (localStorage.getItem("leadawaker_auth")) {
      const accountId = localStorage.getItem("leadawaker_current_account_id");
      setLocation(accountId === "1" ? "/agency/dashboard" : "/subaccount/dashboard");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation first
    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, email, password, confirmPassword, fullName: fullName.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message || "Failed to activate account. Please try again.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderRightCard = () => {
    // Invalid link state
    if (!token || !email) {
      return (
        <>
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-orange-500" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Invalid Invite Link</h2>
            <p className="text-muted-foreground max-w-sm">
              This invite link is missing required information. Please check your email for the correct link or contact your administrator.
            </p>
          </div>
        </>
      );
    }

    // Success state
    if (success) {
      return (
        <>
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Account Activated!</h2>
            <p className="text-muted-foreground mb-8">
              Your account is ready. Sign in with your email and password to get started.
            </p>
            <Button
              onClick={() => setLocation("/login")}
              className="w-full h-12 bg-primary hover:bg-brand-yellow hover:text-brand-yellow-foreground text-white shadow-lg shadow-primary/20 hover:shadow-brand-yellow/35 transition-all"
            >
              Go to Sign In
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </>
      );
    }

    // Form state
    return (
      <>
        <h2 className="text-2xl font-bold mb-2">Set Up Your Account</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Activating account for <strong>{email}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="pl-10 h-12"
                required
                disabled={isLoading}
                autoComplete="name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 h-12"
                required
                disabled={isLoading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type={showConfirm ? "text" : "password"}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 pr-10 h-12"
                required
                disabled={isLoading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-primary hover:bg-brand-yellow hover:text-brand-yellow-foreground text-white shadow-lg shadow-primary/20 hover:shadow-brand-yellow/35 transition-all"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Activating...
              </>
            ) : (
              <>
                Activate Account
                <ArrowRight className="ml-2 w-5 h-5" />
              </>
            )}
          </Button>
        </form>
      </>
    );
  };

  return (
    <div className="min-h-screen pt-24 pb-20 bg-slate-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left info panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Welcome to<br />Lead Awaker
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-lg">
              You've been invited to join the platform. Set up your password to get started.
            </p>

            <div className="hidden lg:block space-y-6">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-2">Secure Account</h3>
                  <p className="text-muted-foreground">
                    Create a strong password to protect your account and keep your data safe.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center text-accent shrink-0">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-2">Full Access</h3>
                  <p className="text-muted-foreground">
                    Once activated, you'll have access to leads, campaigns, conversations, and more.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right white card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8"
          >
            {renderRightCard()}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
