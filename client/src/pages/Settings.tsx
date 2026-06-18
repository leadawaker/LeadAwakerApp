import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CrmShell } from "@/components/crm/CrmShell";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiUtils";
import { cn } from "@/lib/utils";
import { Building2, Bell, Users } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { SettingsTeamSection } from "@/features/users/components/SettingsTeamSection";
import { AccountDetailView } from "@/features/accounts/components/AccountDetailView";
import { updateAccount } from "@/features/accounts/api/accountsApi";
import type { AccountRow } from "@/features/accounts/components/AccountDetailsDialog";
import { SkeletonSettingsSection } from "@/components/ui/skeleton";
import { NotificationsSection } from "@/features/settings/components/NotificationsSection";
import { MobileAgencySwitcher } from "@/components/crm/mobile/MobileAgencySwitcher";

// ── Settings sections ────────────────────────────────────────────────
type SettingsSection = "notifications" | "team" | "account";

const BASE_SECTIONS: { id: SettingsSection; labelKey: string; icon: React.ElementType; agencyOnly?: boolean; scopedOnly?: boolean }[] = [
  { id: "account", labelKey: "sections.account", icon: Building2, scopedOnly: true },
  { id: "team", labelKey: "sections.team", icon: Users },
  { id: "notifications", labelKey: "sections.notifications", icon: Bell },
];

// ── Main Settings Page ───────────────────────────────────────────────
function SettingsContent() {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const { isAgencyUser, currentAccountId } = useWorkspace();
  const isScopedToAccount = currentAccountId > 0;

  // "My Account" shown only for agency users scoped to a specific client account
  const SECTIONS = BASE_SECTIONS.filter((s) => {
    if (s.agencyOnly && !isAgencyUser) return false;
    if (s.scopedOnly && !(isScopedToAccount && isAgencyUser)) return false;
    return true;
  });

  // ── Active tab (normal screens) ────────────────────────────────────
  const [activeSection, setActiveSection] = useState<SettingsSection>("team");

  // Deep-link: other pages can set sessionStorage to open/scroll to a panel
  useEffect(() => {
    const pending = sessionStorage.getItem("pendingSettingsSection") as SettingsSection | null;
    if (!pending) return;
    sessionStorage.removeItem("pendingSettingsSection");
    if (BASE_SECTIONS.some((s) => s.id === pending)) setActiveSection(pending);
  }, []);

  // Keep activeSection valid when the available sections change
  useEffect(() => {
    if (!SECTIONS.some((s) => s.id === activeSection)) setActiveSection(SECTIONS[0]?.id ?? "team");
  }, [SECTIONS, activeSection]);

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

  const showAccountPanel = SECTIONS.some((s) => s.id === "account");
  const tabSections = SECTIONS.filter((s) => s.id !== "account");

  return (
    <div className="la-page" data-testid="page-settings">
      {/* Agency/account switcher — relocated here from the mobile list header */}
      {isAgencyUser && (
        <div className="md:hidden px-4 pt-3 pb-1" style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}>
          <MobileAgencySwitcher />
        </div>
      )}
      <div className="la-page-header flex items-center gap-4">
        <span className="serif shrink-0" style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em" }}>
          {t("title")}
        </span>
        {/* Tabs immediately next to title */}
        <div className="la-seg shrink-0" role="tablist" data-testid="settings-tabs">
          {tabSections.map((s) => (
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
        {/* Toolbar portal slot — team toolbar mounts here on the topbar */}
        {activeSection === "team" && (
          <div id="settings-team-toolbar-slot" className="flex-1 flex items-center gap-1.5 overflow-x-auto min-w-0" />
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[1386px] mr-auto px-4 md:px-6 py-6">
          {showAccountPanel && activeSection === "account" && (
            <div className="neu-raised p-5 mb-6" data-testid="settings-panel-account">
              {renderAccountSection()}
            </div>
          )}
          {activeSection !== "account" && (
            activeSection === "team" ? (
              // Team: no outer panel — cards float on page bg
              <div
                className="flex flex-col min-h-0 overflow-hidden h-[calc(100dvh-13rem)]"
                data-testid="settings-panel-team"
              >
                <SettingsTeamSection isUltrawide={false} />
              </div>
            ) : (
              <div
                className="neu-raised flex flex-col min-h-0 p-5"
                data-testid={`settings-panel-${activeSection}`}
                key={activeSection}
              >
                {activeSection === "notifications" && (
                  <NotificationsSection />
                )}
              </div>
            )
          )}
        </div>
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
