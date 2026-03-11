import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { API_BASE } from "@/lib/apiUtils";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";

const HERO_IMAGES = ["/login-hero.webp", "/login-hero-2.webp"] as const;

export default function Login() {
  const { t } = useTranslation("login");
  const [heroSrc] = useState(() => {
    const prev = Number(localStorage.getItem("leadawaker_hero_idx") || "0");
    const next = (prev + 1) % HERO_IMAGES.length;
    localStorage.setItem("leadawaker_hero_idx", String(next));
    return HERO_IMAGES[next];
  });
  const isLady = heroSrc === "/login-hero.webp";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  // Auto-redirect if previously logged in with "Remember Me"
  useEffect(() => {
    const isAuthed = Boolean(localStorage.getItem("leadawaker_auth"));
    const remembered = localStorage.getItem("leadawaker_remember_me") === "true";
    if (isAuthed && remembered) {
      const role = localStorage.getItem("leadawaker_user_role") || "Viewer";
      const isAgency = role === "Admin" || role === "Operator";
      setLocation(isAgency ? "/agency/campaigns" : "/subaccount/campaigns");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message || "Invalid email or password");
        return;
      }

      const { user } = await res.json();

      // Keep localStorage in sync so existing hooks continue to work
      localStorage.setItem("leadawaker_auth", "session");
      localStorage.setItem("leadawaker_user_email", user.email ?? email);
      localStorage.setItem("leadawaker_user_role", user.role ?? "Viewer");
      localStorage.setItem("leadawaker_user_name", user.fullName1 ?? user.email ?? email);
      if (user.avatarUrl) {
        localStorage.setItem("leadawaker_user_avatar", user.avatarUrl);
      }
      localStorage.setItem(
        "leadawaker_current_account_id",
        String(user.accountsId ?? 1),
      );

      // Persist remember-me preference
      if (rememberMe) {
        localStorage.setItem("leadawaker_remember_me", "true");
      } else {
        localStorage.removeItem("leadawaker_remember_me");
      }

      // Route to appropriate area based on role (not account ID)
      const isAgency = user.role === "Admin" || user.role === "Operator";
      setLocation(isAgency ? "/agency/campaigns" : "/subaccount/campaigns");
    } catch {
      setError("Network error — please try again");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center bg-slate-50 dark:bg-background py-12">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center text-center"
          >
            <h1 className="text-3xl md:text-4xl font-bold mb-6 mt-6">
              {t("titleStart")}{" "}
              <span className={isLady ? "text-[#FAB301]" : "text-[#496FFC]"}>
                {t("titleHighlight")}
              </span>
              .
            </h1>
            <div className="relative w-full max-w-[30rem] mt-8">
              <img
                src={heroSrc}
                alt="Lead reactivation — qualifying leads, closing deals"
                className="w-full"
                draggable={false}
              />
              {/* Translated text overlaid on the empty chat bubble */}
              <span className="absolute bottom-[3.4%] left-[calc(27%)] right-[27%] text-white text-[0.5rem] sm:text-[0.8rem] leading-tight text-left pointer-events-none">
                {t(isLady ? "heroBubbleMaria" : "heroBubbleJohn")}
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white dark:bg-card rounded-2xl shadow-xl border border-slate-200 dark:border-white/[0.08] p-8"
          >
            <h2 className="text-2xl font-bold mb-6">{t("form.heading")}</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t("form.email.label")}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder={t("form.email.placeholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12"
                    required
                    disabled={isLoading}
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t("form.password.label")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder={t("form.password.placeholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12"
                    required
                    disabled={isLoading}
                    data-testid="input-password"
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

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-border"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={isLoading}
                  />
                  <span className="text-muted-foreground">{t("form.rememberMe")}</span>
                </label>
                <a href="#" className="text-primary hover:underline">
                  {t("form.forgotPassword")}
                </a>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 bg-primary hover:bg-brand-yellow hover:text-brand-yellow-foreground text-white shadow-lg shadow-primary/20 hover:shadow-brand-yellow/35 transition-colors"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("form.connecting")}
                  </>
                ) : (
                  <>
                    {t("form.submitButton")}
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-8 pt-8 border-t border-border">
              <p className="text-center text-muted-foreground">
                {t("form.noAccount")}{" "}
                <a href="/book-demo" className="text-primary font-medium hover:underline">
                  {t("form.scheduleDemo")}
                </a>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
