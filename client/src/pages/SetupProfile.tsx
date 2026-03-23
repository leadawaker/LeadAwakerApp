import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { User, Globe, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, API_BASE } from "@/lib/apiUtils";
import { useSession } from "@/hooks/useSession";

const TIMEZONE_OPTIONS = [
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo (BRT)" },
  { value: "Europe/Amsterdam", label: "Europe/Amsterdam (CET)" },
  { value: "America/New_York", label: "America/New_York (EST)" },
  { value: "America/Chicago", label: "America/Chicago (CST)" },
  { value: "America/Denver", label: "America/Denver (MST)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST)" },
  { value: "Europe/London", label: "Europe/London (GMT)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST)" },
];

function detectBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // If the browser timezone matches one of our options, use it
    if (TIMEZONE_OPTIONS.some((o) => o.value === tz)) return tz;
    // Otherwise default to Amsterdam
    return "Europe/Amsterdam";
  } catch {
    return "Europe/Amsterdam";
  }
}

export default function SetupProfile() {
  const { t } = useTranslation("setup");
  const [, setLocation] = useLocation();
  const session = useSession();

  const [fullName, setFullName] = useState("");
  const [timezone, setTimezone] = useState(() => detectBrowserTimezone());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);

  // Pre-fill name from session, check if setup is needed
  useEffect(() => {
    if (session.status === "authenticated") {
      const user = session.user;
      setUserId(user.id);
      if (user.fullName) setFullName(user.fullName);

      // If user already has a timezone set (setup already done), redirect to CRM
      // We check by fetching the full profile to see if timezone is populated
      apiFetch(`/api/users/${user.id}`)
        .then((res) => res.ok ? res.json() : null)
        .then((profile) => {
          if (profile?.timezone) {
            // Setup already completed, go to CRM
            const role = localStorage.getItem("leadawaker_user_role") || "Viewer";
            const isAgency = role === "Admin" || role === "Operator";
            setLocation(isAgency ? "/agency/campaigns" : "/subaccount/campaigns");
          }
        })
        .catch(() => {});
    } else if (session.status === "unauthenticated") {
      setLocation("/login");
    }
  }, [session.status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    if (!fullName.trim()) {
      setError(t("errors.nameRequired"));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName1: fullName.trim(),
          timezone: timezone,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Save failed");
      }

      // Update localStorage so the CRM reflects changes immediately
      localStorage.setItem("leadawaker_user_name", fullName.trim());

      // Redirect to CRM (campaigns page where Joyride will start)
      const role = localStorage.getItem("leadawaker_user_role") || "Viewer";
      const isAgency = role === "Admin" || role === "Operator";
      setLocation(isAgency ? "/agency/campaigns" : "/subaccount/campaigns");
    } catch (err: any) {
      setError(err.message || t("errors.saveFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  // Show nothing while session is loading
  if (session.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src="/4.SideLogo.svg"
            alt="Lead Awaker"
            className="h-10 object-contain"
          />
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-card rounded-2xl shadow-xl border border-slate-200 dark:border-border/30 p-8">
          <h1 className="text-2xl font-bold font-heading tracking-tight text-center mb-2">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            {t("subtitle")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("fields.fullName")}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t("fields.fullNamePlaceholder")}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10 h-12"
                  required
                  disabled={isLoading}
                  autoComplete="name"
                  autoFocus
                />
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("fields.timezone")}
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none z-10" />
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  disabled={isLoading}
                  className="w-full h-12 pl-10 pr-4 rounded-md border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-indigo focus:ring-offset-2"
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-12 bg-primary hover:bg-brand-yellow hover:text-brand-yellow-foreground text-white shadow-lg shadow-primary/20 hover:shadow-brand-yellow/35 transition-colors"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                <>
                  {t("continue")}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </>
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
