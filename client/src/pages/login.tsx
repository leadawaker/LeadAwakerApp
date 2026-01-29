import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function Login() {
  const { t } = useTranslation("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // MOCK AUTH: store a local token
    localStorage.setItem("leadawaker_auth", "mock-jwt");
    // REAL: authenticate via your backend, then store JWT
    window.location.href = "/agency/dashboard";
  };

  return (
    <div className="min-h-screen pt-24 pb-20 bg-gradient-to-br from-slate-50 to-slate-100">
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

            <div className="space-y-6">
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
            className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8"
          >
            <h2 className="text-2xl font-bold mb-6">{t("form.heading")}</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("form.email.label")}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="email"
                    placeholder={t("form.email.placeholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12"
                    required
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("form.password.label")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="password"
                    placeholder={t("form.password.placeholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-12"
                    required
                    data-testid="input-password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
                  <span className="text-gray-600">{t("form.rememberMe")}</span>
                </label>
                <a href="#" className="text-primary hover:underline">
                  {t("form.forgotPassword")}
                </a>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 bg-primary hover:bg-yellow-400 hover:text-black text-white shadow-lg shadow-primary/20 hover:shadow-yellow-400/35 transition-all"
                data-testid="button-login"
              >
                {t("form.submitButton")}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </form>

            <div className="mt-8 pt-8 border-t border-gray-200">
              <p className="text-center text-gray-600">
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
