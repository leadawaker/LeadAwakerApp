import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";

export default function Login() {
  const { t } = useTranslation("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
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

      // Route to appropriate area based on account
      const isAgency = user.accountsId === 1;
      setLocation(isAgency ? "/agency/dashboard" : "/subaccount/dashboard");
    } catch {
      setError("Network error — please try again");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-20 bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              {t("title")}
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-lg">
              {t("subtitle")}
            </p>

            <div className="hidden lg:block space-y-6">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-2">{t("features.secureAccess.title")}</h3>
                  <p className="text-muted-foreground">{t("features.secureAccess.description")}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center text-accent shrink-0">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-2">{t("features.twoFactor.title")}</h3>
                  <p className="text-muted-foreground">{t("features.twoFactor.description")}</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-card rounded-2xl shadow-xl border border-border p-8"
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
                    type="password"
                    placeholder={t("form.password.placeholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-12"
                    required
                    disabled={isLoading}
                    data-testid="input-password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-border" disabled={isLoading} />
                  <span className="text-muted-foreground">{t("form.rememberMe")}</span>
                </label>
                <a href="#" className="text-primary hover:underline">
                  {t("form.forgotPassword")}
                </a>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 bg-primary hover:bg-yellow-400 hover:text-black text-white shadow-lg shadow-primary/20 hover:shadow-yellow-400/35 transition-all"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Connecting...
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
