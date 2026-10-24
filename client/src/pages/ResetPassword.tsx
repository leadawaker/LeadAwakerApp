import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { API_BASE } from "@/lib/apiUtils";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const email = params.get("email");
const linkLang = params.get("lang");
const SUPPORTED = ["en", "nl", "pt"];

const SHELL = "min-h-screen flex items-center justify-center bg-background px-4 py-12";
const CARD = "bg-card rounded-2xl shadow-xl border border-border/30 p-8";

function PasswordField(props: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{props.label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type={show ? "text" : "password"}
          placeholder={props.placeholder}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="pl-10 pr-10 h-11"
          required
          disabled={props.disabled}
          autoComplete="new-password"
          autoFocus={props.autoFocus}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default function ResetPassword() {
  const { t } = useTranslation("users");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkBroken, setLinkBroken] = useState(false);
  const [done, setDone] = useState(false);

  // The reset email carries the user's language; fall back to the browser's.
  useEffect(() => {
    const browser = navigator.language?.slice(0, 2);
    const lang = SUPPORTED.includes(linkLang ?? "") ? linkLang! : SUPPORTED.includes(browser) ? browser : "en";
    if (i18n.language !== lang) i18n.changeLanguage(lang);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return setError(t("resetPassword.errPasswordShort"));
    if (password !== confirmPassword) return setError(t("resetPassword.errPasswordMismatch"));

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password, confirmPassword }),
      });
      if (res.ok) {
        setDone(true);
        return;
      }
      if (res.status === 429) setError(t("resetPassword.errTooMany"));
      else if (res.status === 400) {
        const data = await res.json().catch(() => ({}));
        // The server's generic reply for any bad, used, or expired link.
        if (data.message === "Invalid or expired link") setLinkBroken(true);
        else setError(t("resetPassword.errFailed"));
      } else setError(t("resetPassword.errFailed"));
    } catch {
      setError(t("resetPassword.errNetwork"));
    } finally {
      setIsLoading(false);
    }
  };

  if (!token || !email || linkBroken) {
    return (
      <div className={SHELL}>
        <div className={`${CARD} max-w-md w-full text-center`}>
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold mb-3">{t("resetPassword.invalidTitle")}</h2>
          <p className="text-muted-foreground mb-6">
            {linkBroken ? t("resetPassword.errLinkInvalid") : t("resetPassword.invalidBody")}
          </p>
          <Button asChild className="w-full h-12">
            <a href="/login">{t("resetPassword.requestNew")}</a>
          </Button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className={SHELL}>
        <div className={`${CARD} max-w-md w-full text-center`}>
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-3">{t("resetPassword.successTitle")}</h2>
          <p className="text-muted-foreground mb-6">{t("resetPassword.successBody")}</p>
          <Button asChild className="w-full h-12">
            <a href="/login?reset=1">
              {t("resetPassword.toLogin")}
              <ArrowRight className="ml-2 w-5 h-5" />
            </a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={SHELL}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <img src="/premium/logo-v2.svg" alt="Lead Awaker" className="h-10 object-contain" style={{ background: "var(--logo-plate)", borderRadius: 10, padding: "2px 8px" }} />
        </div>
        <div className={CARD}>
          <h1 className="text-2xl font-bold font-heading tracking-tight text-center mb-2">{t("resetPassword.title")}</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {t("resetPassword.subtitle")} <strong className="text-foreground">{email}</strong>
          </p>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <PasswordField label={t("resetPassword.password")} placeholder={t("resetPassword.passwordPlaceholder")} value={password} onChange={setPassword} disabled={isLoading} autoFocus />
            <PasswordField label={t("resetPassword.confirmPassword")} placeholder={t("resetPassword.confirmPlaceholder")} value={confirmPassword} onChange={setConfirmPassword} disabled={isLoading} />
            <Button type="submit" className="w-full h-12" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("resetPassword.saving")}
                </>
              ) : (
                <>
                  {t("resetPassword.submit")}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </>
              )}
            </Button>
            <p className="text-center text-sm">
              <a href="/login" className="text-primary hover:underline">{t("resetPassword.backToLogin")}</a>
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
