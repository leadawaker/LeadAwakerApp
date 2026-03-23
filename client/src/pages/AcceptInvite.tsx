import { motion } from "framer-motion";
import { Lock, User, Eye, EyeOff, ArrowRight, Loader2, AlertCircle, Globe, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { API_BASE } from "@/lib/apiUtils";
import { useLocation } from "wouter";

const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const email = params.get("email");

const TIMEZONE_OPTIONS = [
  { value: "America/Sao_Paulo", label: "Sao Paulo (BRT)" },
  { value: "Europe/Amsterdam", label: "Amsterdam (CET)" },
  { value: "America/New_York", label: "New York (EST)" },
  { value: "America/Chicago", label: "Chicago (CST)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "nl", label: "Nederlands" },
  { value: "pt", label: "Portugues" },
];

function detectTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TIMEZONE_OPTIONS.some((o) => o.value === tz)) return tz;
    return "Europe/Amsterdam";
  } catch {
    return "Europe/Amsterdam";
  }
}

function detectLanguage(): string {
  try {
    const lang = navigator.language?.slice(0, 2);
    if (LANGUAGE_OPTIONS.some((o) => o.value === lang)) return lang;
    return "en";
  } catch {
    return "en";
  }
}

export default function AcceptInvite() {
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [timezone, setTimezone] = useState(() => detectTimezone());
  const [language, setLanguage] = useState(() => detectLanguage());
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  // If there's a valid invite token, always show the form (even if another session is active)
  // Only redirect if there's NO invite token and the user is already logged in
  useEffect(() => {
    if (!token && !email && localStorage.getItem("leadawaker_auth")) {
      setLocation("/subaccount/campaigns");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      const res = await fetch(`${API_BASE}/api/auth/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token, email, password, confirmPassword,
          fullName: fullName.trim(),
          timezone,
          language,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.message || "Failed to activate account. Please try again.");
        return;
      }

      // Auto-login succeeded: store session info and redirect to CRM
      if (data.user) {
        localStorage.setItem("leadawaker_auth", "true");
        localStorage.setItem("leadawaker_user_id", String(data.user.id));
        localStorage.setItem("leadawaker_user_email", data.user.email || "");
        localStorage.setItem("leadawaker_user_role", data.user.role || "Viewer");
        localStorage.setItem("leadawaker_user_name", data.user.fullName1 || fullName.trim());
        if (data.user.accountsId) {
          localStorage.setItem("leadawaker_current_account_id", String(data.user.accountsId));
        }
      }

      // Redirect to CRM (tour will start automatically)
      const isAgency = data.user?.role === "Admin" || data.user?.role === "Operator";
      const dest = isAgency ? "/agency/campaigns" : "/subaccount/campaigns";
      window.location.href = dest;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Invalid link
  if (!token || !email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background px-4">
        <div className="bg-white dark:bg-card rounded-2xl shadow-xl border border-slate-200 dark:border-border/30 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Invalid Invite Link</h2>
          <p className="text-muted-foreground">
            This invite link is missing required information. Please check your email for the correct link or contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src="/4.SideLogo.svg" alt="Lead Awaker" className="h-10 object-contain" />
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-card rounded-2xl shadow-xl border border-slate-200 dark:border-border/30 p-8">
          <h1 className="text-2xl font-bold font-heading tracking-tight text-center mb-2">
            Welcome to LeadAwaker
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Setting up account for <strong className="text-foreground">{email}</strong>
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10 h-11"
                  required
                  disabled={isLoading}
                  autoComplete="name"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11"
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10 h-11"
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Timezone + Language row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Timezone</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    disabled={isLoading}
                    className="w-full h-11 pl-10 pr-2 rounded-md border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Language</label>
                <div className="relative">
                  <Languages className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    disabled={isLoading}
                    className="w-full h-11 pl-10 pr-2 rounded-md border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {LANGUAGE_OPTIONS.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
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
                  Get Started
                  <ArrowRight className="ml-2 w-5 h-5" />
                </>
              )}
            </Button>

            <p className="text-[11px] text-muted-foreground text-center">
              You can change these settings later in your profile.
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
