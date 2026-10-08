import { useState, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { CrmShell } from "@/components/crm/CrmShell";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiUtils";
import { cn } from "@/lib/utils";
import { Building2, SlidersHorizontal, UserRound, Users } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { SettingsTeamSection } from "@/features/users/components/SettingsTeamSection";
import { AccountDetailView } from "@/features/accounts/components/AccountDetailView";
import { updateAccount } from "@/features/accounts/api/accountsApi";
import type { AccountRow } from "@/features/accounts/components/AccountDetailsDialog";
import { SkeletonSettingsSection } from "@/components/ui/skeleton";
import { MobileAgencySwitcher } from "@/components/crm/mobile/MobileAgencySwitcher";
import { MyProfileGate } from "@/features/settings/components/MyProfileGate";
import { ProfileTab } from "@/features/settings/components/ProfileTab";
import { PreferencesTab } from "@/features/settings/components/PreferencesTab";

// ── Settings sections ────────────────────────────────────────────────
// URL contract: /platform/settings?tab=profile|preferences|team|account.
// The tab lives in the query string (not local state) so nav links that only
// change ?tab= switch the tab even while this page is already open.
type SettingsSection = "profile" | "preferences" | "team" | "account";
const DEFAULT_SECTION: SettingsSection = "profile";

const BASE_SECTIONS: { id: SettingsSection; labelKey: string; icon: React.ElementType; scopedOnly?: boolean }[] = [
  { id: "profile", labelKey: "sections.profile", icon: UserRound },
  { id: "preferences", labelKey: "sections.preferences", icon: SlidersHorizontal },
  { id: "team", labelKey: "sections.team", icon: Users },
  // "My Account" shown only for agency users scoped to a specific client account
  { id: "account", labelKey: "sections.account", icon: Building2, scopedOnly: true },
];

const isSection = (v: string | null): v is SettingsSection => BASE_SECTIONS.some((s) => s.id === v);

// ── Main Settings Page ───────────────────────────────────────────────
function SettingsContent() {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const { isAgencyUser, currentAccountId } = useWorkspace();
  const isScopedToAccount = currentAccountId > 0;
  const [location, navigate] = useLocation();
  const search = useSearch();

  const SECTIONS = BASE_SECTIONS.filter((s) => !(s.scopedOnly && !(isScopedToAccount && isAgencyUser)));

  // ── Active tab: derived from ?tab=, unknown / unauthorized falls back to profile
  const requested = new URLSearchParams(search).get("tab");
  const activeSection: SettingsSection =
    isSection(requested) && SECTIONS.some((s) => s.id === requested) ? requested : DEFAULT_SECTION;

  const setActiveSection = useCallback((id: SettingsSection) => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", id);
    navigate(`${location}?${params.toString()}`, { replace: true });
  }, [location, navigate]);

  // Deep-link: other pages can set sessionStorage to open a tab
  useEffect(() => {
    const pending = sessionStorage.getItem("pendingSettingsSection");
    if (!pending) return;
    sessionStorage.removeItem("pendingSettingsSection");
    if (isSection(pending)) setActiveSection(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Account detail state (when scoped to a specific account) ───────
  const [accountData, setAccountData] = useState<AccountRow | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);

  useEffect(() => {
    if (!isScopedToAccount) { setAccountData(null); return; }
    setAccountLoading(true);
    apiFetch(`/api/accounts/${currentAccountId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setAccountData(data))
      .catch(() => setAccountData(null))
      .finally(() => setAccountLoading(false));
  }, [currentAccountId, isScopedToAccount]);

  const handleAccountFieldSave = useCallback(async (field: string, value: string) => {
    if (!accountData) return;
    const aid = accountData.Id ?? accountData.id ?? 0;
    await updateAccount(aid, { [field]: value });
    setAccountData((prev) => prev ? { ...prev, [field]: value } : prev);
    toast({ title: t("account.saved"), description: t("account.savedDescription", { field }) });
  }, [accountData, toast]);

  const renderAccountSection = () => {
    if (accountLoading) return <SkeletonSettingsSection rows={6} />;
    if (!accountData) return <div className="text-muted-foreground text-sm py-8 text-center">{t("account.notFound")}</div>;
    return (
      <AccountDetailView
        account={accountData}
        onSave={handleAccountFieldSave}
        onAddAccount={() => {}}
        onDelete={() => {}}
        onToggleStatus={() => {}}
      />
    );
  };

  return (
    <div className="la-page" data-testid="page-settings">
      {/* Agency/account switcher, relocated here from the mobile list header */}
      {isAgencyUser && (
        <div className="md:hidden px-4 pt-3 pb-1" style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}>
          <MobileAgencySwitcher />
        </div>
      )}
      <div className="la-page-header flex items-center gap-4 min-w-0">
        <span className="serif shrink-0" style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em" }}>
          {t("title")}
        </span>
        {/* Tabs immediately next to title */}
        <div className="la-seg min-w-0 max-w-full overflow-x-auto" role="tablist" data-testid="settings-tabs">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={activeSection === s.id}
              className={cn("la-seg-btn", activeSection === s.id && "on")}
              onClick={() => setActiveSection(s.id)}
              data-testid={`settings-tab-${s.id}`}
            >
              <s.icon className="h-3.5 w-3.5" />
              {t(s.labelKey)}
            </button>
          ))}
        </div>
        {/* Toolbar portal slot: the team toolbar mounts here on the topbar */}
        {activeSection === "team" && (
          <div id="settings-team-toolbar-slot" className="flex-1 flex items-center justify-end gap-1.5 px-2" style={{ overflow: "visible" }} />
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeSection === "team" ? (
          // Team: full-height layout, toolbar (cards) flush left, divider spans full height
          <div className="h-full" data-testid="settings-panel-team">
            <SettingsTeamSection isUltrawide={false} />
          </div>
        ) : activeSection === "account" ? (
          // Account: centered layout
          <div className="flex justify-center">
            <div className="w-full max-w-[500px] px-4 md:px-6 py-6">
              <div className="neu-raised p-5 mb-4" data-testid="settings-panel-account">
                {renderAccountSection()}
              </div>
            </div>
          </div>
        ) : (
          // Profile / Preferences: centered single column of cards
          <div className="flex justify-center">
            <div className="w-full max-w-[720px] px-4 md:px-6 py-6" data-testid={`settings-panel-${activeSection}`}>
              <MyProfileGate key={activeSection} testId={activeSection === "profile" ? "section-profile" : "section-preferences"}>
                {(profile, setProfile) =>
                  activeSection === "profile"
                    ? <ProfileTab profile={profile} onProfileUpdated={setProfile} />
                    : <PreferencesTab profile={profile} onProfileUpdated={setProfile} />
                }
              </MyProfileGate>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <CrmShell>
      <SettingsContent />
    </CrmShell>
  );
}
