import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Compass, Eye, Mail, Wrench } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useImpersonation } from "@/hooks/useImpersonation";
import { apiFetch, API_BASE } from "@/lib/apiUtils";
import type { UserProfile } from "../types";
import { parsePrefs, patchPreferences } from "./prefsSave";
import { ServicePagesCard } from "./ServicePagesCard";
import { SettingsCard } from "./SettingsCard";

const TILE = "rounded-lg border border-border bg-card p-4 space-y-3";

/**
 * Owner-only block on the Preferences tab: Outreach pages toggle, Service pages,
 * View as (impersonation) and the Gmail integration. Render only when isOwner.
 */
export function OwnerToolsCard({
  profile,
  onProfileUpdated,
}: {
  profile: UserProfile;
  onProfileUpdated: (p: UserProfile) => void;
}) {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const { accounts, currentAccountId } = useWorkspace();
  const { impersonate } = useImpersonation();

  // ── Outreach pages nav toggle ─────────────────────────────────────
  const [showOutreachPages, setShowOutreachPages] = useState(() => !!parsePrefs(profile.preferences).showOutreachPages);
  const [outreachToggleSaving, setOutreachToggleSaving] = useState(false);

  const handleToggleOutreachPages = async (checked: boolean) => {
    setOutreachToggleSaving(true);
    const prevValue = showOutreachPages;
    setShowOutreachPages(checked);
    try {
      const updated = await patchPreferences(profile, { showOutreachPages: checked });
      onProfileUpdated(updated);
      localStorage.setItem("leadawaker_show_outreach_pages", checked ? "1" : "0");
      window.dispatchEvent(new Event("leadawaker-prefs-changed"));
    } catch {
      setShowOutreachPages(prevValue);
      toast({ variant: "destructive", title: t("profile.saveFailed"), description: t("profile.saveFailedDescription") });
    } finally {
      setOutreachToggleSaving(false);
    }
  };

  // ── Gmail integration ─────────────────────────────────────────────
  const [gmailStatus, setGmailStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [gmailLoading, setGmailLoading] = useState(false);

  useEffect(() => {
    apiFetch("/api/gmail/oauth/status")
      .then((r) => r.json())
      .then((data) => setGmailStatus(data))
      .catch(() => setGmailStatus({ connected: false }));
  }, []);

  const handleGmailConnect = () => {
    setGmailLoading(true);
    window.location.href = `${API_BASE}/api/gmail/oauth/authorize`;
  };

  const handleGmailDisconnect = async () => {
    setGmailLoading(true);
    try {
      await apiFetch("/api/gmail/oauth/disconnect", { method: "POST" });
      setGmailStatus({ connected: false });
      toast({ title: t("gmail.disconnected") });
    } catch {
      toast({ title: t("gmail.disconnectError"), variant: "destructive" });
    } finally {
      setGmailLoading(false);
    }
  };

  // ── View as ───────────────────────────────────────────────────────
  const selectedAccount = currentAccountId > 0 ? accounts.find((a) => a.id === currentAccountId) : null;
  const clientLabel = selectedAccount
    ? t("profile.viewAsClient", { name: selectedAccount.name })
    : t("profile.viewAsClientSandbox");

  return (
    <SettingsCard
      icon={Wrench}
      title={t("preferences.ownerTools")}
      description={t("preferences.ownerToolsDescription")}
      data-testid="section-owner-tools"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Outreach pages nav toggle */}
        <div className={TILE}>
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
            <Compass className="h-4 w-4 text-muted-foreground" />
            {t("profile.outreachPages")}
          </div>
          <p className="text-xs text-muted-foreground">{t("profile.outreachPagesDescription")}</p>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-medium text-foreground">{t("profile.outreachPagesToggle")}</span>
            <Switch
              checked={showOutreachPages}
              onCheckedChange={handleToggleOutreachPages}
              disabled={outreachToggleSaving}
              data-testid="switch-outreach-pages"
            />
          </div>
        </div>

        {/* Service pages nav toggles (Speed to Lead / Reputation / Missed Calls) */}
        <ServicePagesCard profile={profile} onProfileUpdated={onProfileUpdated} />

        {/* View As */}
        <div className={TILE}>
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
            <Eye className="h-4 w-4 text-muted-foreground" />
            {t("profile.impersonation")}
          </div>
          <p className="text-xs text-muted-foreground">{t("profile.impersonationDescription")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => impersonate("Admin")} className="la-btn la-btn--soft la-btn--pill">
              <div className="h-4 w-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0 bg-primary text-primary-foreground">A</div>
              {t("profile.viewAsAdmin")}
            </button>
            <button
              type="button"
              onClick={() => impersonate("Manager", selectedAccount ? currentAccountId : undefined)}
              className="la-btn la-btn--soft la-btn--pill"
            >
              <div className="h-4 w-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0 bg-muted-foreground/20 text-muted-foreground">C</div>
              {clientLabel}
            </button>
          </div>
        </div>

        {/* Gmail Integration */}
        <div className={TILE}>
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
            <Mail className="h-4 w-4 text-brand-indigo" />
            {t("gmail.title")}
          </div>
          <p className="text-xs text-muted-foreground">{t("gmail.description")}</p>
          {gmailStatus?.connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-sm text-foreground truncate">{gmailStatus.email}</span>
              </div>
              <button
                onClick={handleGmailDisconnect}
                disabled={gmailLoading}
                className="text-xs text-destructive hover:opacity-80 transition-opacity font-medium"
              >
                {gmailLoading ? "..." : t("gmail.disconnect")}
              </button>
            </div>
          ) : (
            <button onClick={handleGmailConnect} disabled={gmailLoading} className="la-btn la-btn--wine">
              <Mail className="h-4 w-4" />
              {gmailLoading ? "..." : t("gmail.connect")}
            </button>
          )}
        </div>
      </div>
    </SettingsCard>
  );
}
