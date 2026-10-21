import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SettingsCard } from "./SettingsCard";
import { inputClass, inputStyle } from "../twoFactor/TwoFactorPrimitives";
import { twoFactorRequest } from "../twoFactor/useTwoFactor";

type Mode = "off" | "admins" | "everyone";
type Policy = { requireTwoFactor: Mode; graceDays: number; accounts: { id: number; name: string | null; requireTwoFactor: Mode | null }[] };
const MODES: Mode[] = ["off", "admins", "everyone"];

/** Owner only: require 2FA globally, with a per-account override and a grace period. */
export function TwoFactorPolicyCard({ flat = false }: { flat?: boolean }) {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [mode, setMode] = useState<Mode>("off");
  const [days, setDays] = useState("7");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void twoFactorRequest<Policy>("GET", "/api/admin/security-policy").then((r) => {
      if (!r.ok) return;
      setPolicy(r.data);
      setMode(r.data.requireTwoFactor);
      setDays(String(r.data.graceDays));
    });
  }, []);

  if (!policy) return null;

  const save = async () => {
    setSaving(true);
    const r = await twoFactorRequest("PUT", "/api/admin/security-policy", { requireTwoFactor: mode, graceDays: Number(days) });
    setSaving(false);
    if (r.ok) {
      setPolicy({ ...policy, requireTwoFactor: mode, graceDays: Number(days) });
      toast({ variant: "success", title: t("twoFactorPolicy.saved") });
    } else toast({ variant: "destructive", title: r.data?.message || t("twoFactor.genericError") });
  };

  const setOverride = async (accountId: number, value: string) => {
    const next = value === "inherit" ? null : (value as Mode);
    const r = await twoFactorRequest("PATCH", `/api/admin/accounts/${accountId}/require-2fa`, { requireTwoFactor: next });
    if (r.ok) setPolicy({ ...policy, accounts: policy.accounts.map((a) => (a.id === accountId ? { ...a, requireTwoFactor: next } : a)) });
    else toast({ variant: "destructive", title: r.data?.message || t("twoFactor.genericError") });
  };

  const dirty = mode !== policy.requireTwoFactor || Number(days) !== policy.graceDays;

  return (
    <SettingsCard icon={ShieldAlert} title={t("twoFactorPolicy.title")} description={t("twoFactorPolicy.description")} flat={flat} data-testid="section-two-factor-policy">
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">{t("twoFactorPolicy.global")}</label>
          <div className="la-seg w-full mt-1.5" role="tablist">
            {MODES.map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("la-seg-btn flex-1", mode === m && "on")} data-testid={`policy-mode-${m}`}>
                {t(`twoFactorPolicy.modes.${m}`)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">{t(`twoFactorPolicy.modeHelp.${mode}`)}</p>
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("twoFactorPolicy.graceDays")}</label>
            <input
              type="number"
              min={0}
              max={90}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className={cn("mt-1.5 w-24", inputClass)}
              style={inputStyle}
              data-testid="input-policy-grace"
            />
          </div>
          <button type="button" onClick={save} disabled={saving || !dirty || days === ""} className="la-btn la-btn--wine la-btn--lg la-btn--pill disabled:opacity-50" data-testid="button-policy-save">
            {t("twoFactorPolicy.save")}
          </button>
        </div>

        <div className="space-y-2">
          <div className="eyebrow eyebrow-sm">{t("twoFactorPolicy.perAccount")}</div>
          <p className="text-xs text-muted-foreground">{t("twoFactorPolicy.perAccountHelp")}</p>
          <div className="divide-y divide-border rounded-lg border border-border">
            {policy.accounts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-3 py-2 min-h-11">
                <span className="flex-1 min-w-0 truncate text-sm text-foreground">{a.name || `#${a.id}`}</span>
                <select
                  value={a.requireTwoFactor ?? "inherit"}
                  onChange={(e) => void setOverride(a.id, e.target.value)}
                  className="h-9 text-sm neu-inset-crisp px-2 text-foreground"
                  style={inputStyle}
                  data-testid={`select-account-2fa-${a.id}`}
                >
                  <option value="inherit">{t("twoFactorPolicy.inherit")}</option>
                  {MODES.map((m) => <option key={m} value={m}>{t(`twoFactorPolicy.modes.${m}`)}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}
