import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import { CrmShell } from "@/components/crm/CrmShell";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiUtils";
import { cn } from "@/lib/utils";
import { Building2, User, Bell, Clock, Users, ExternalLink } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { SettingsTeamSection } from "@/features/users/components/SettingsTeamSection";
import { AccountDetailView } from "@/features/accounts/components/AccountDetailView";
import { updateAccount } from "@/features/accounts/api/accountsApi";
import type { AccountRow } from "@/features/accounts/components/AccountDetailsDialog";
import { SkeletonSettingsSection } from "@/components/ui/skeleton";
import { ProfileSection } from "@/features/settings/components/ProfileSection";
import { NotificationsSection } from "@/features/settings/components/NotificationsSection";
import { DashboardSection } from "@/features/settings/components/DashboardSection";
import { SettingsMobileHub } from "@/features/settings/components/SettingsMobileHub";

// ── Settings sections ────────────────────────────────────────────────
type SettingsSection = "profile" | "notifications" | "dashboard" | "team" | "account";

const BASE_SECTIONS: { id: SettingsSection; labelKey: string; icon: React.ElementType; agencyOnly?: boolean; scopedOnly?: boolean }[] = [
  { id: "account", labelKey: "sections.account", icon: Building2, scopedOnly: true },
  { id: "profile", labelKey: "sections.profile", icon: User },
  { id: "notifications", labelKey: "sections.notifications", icon: Bell },
  { id: "dashboard", labelKey: "sections.dashboard", icon: Clock },
  { id: "team", labelKey: "sections.team", icon: Users },
];

// ── Main Settings Page ───────────────────────────────────────────────
function SettingsContent() {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const { isAgencyUser, currentAccountId } = useWorkspace();
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const isScopedToAccount = currentAccountId > 0;
  const SECTIONS = BASE_SECTIONS.filter((s) => {
    if (s.agencyOnly && !isAgencyUser) return false;
    // "My Account" is for subaccount users only; agency admins navigate via the Accounts page
    if (s.scopedOnly && (!isScopedToAccount || isAgencyUser)) return false;
    return true;
  });

  const [activeSection, setActiveSection] = useState<SettingsSection>(
    isScopedToAccount && !isAgencyUser ? "account" : "profile"
  );

  // If account scope changes and current section is no longer valid, reset
  useEffect(() => {
    if (!isScopedToAccount && activeSection === "account") {
      setActiveSection("profile");
    }
  }, [isScopedToAccount, activeSection]);

  // Deep-link: other pages can set sessionStorage to open a specific section
  useEffect(() => {
    const pending = sessionStorage.getItem("pendingSettingsSection");
    if (pending) {
      sessionStorage.removeItem("pendingSettingsSection");
      if (SECTIONS.some(s => s.id === pending)) {
        setActiveSection(pending as SettingsSection);
      }
    }
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

  const routePrefix = "/platform";

  const renderActiveSection = () => {
    switch (activeSection) {
      case "account":
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
      case "profile": return <ProfileSection />;
      case "notifications": return <NotificationsSection />;
      case "dashboard": return <DashboardSection />;
      case "team": return <SettingsTeamSection />;
    }
  };

  return (
    <div className="h-full flex flex-col" data-testid="page-settings">
      {/* Mobile: show hub or section detail */}
      {isMobile && <SettingsMobileHub />}

      {/* Desktop layout (unchanged) */}
      {!isMobile && <div className={cn(
        "flex-1 gap-0 min-h-0 overflow-hidden",
        "flex"
      )}>
        {/* Left sidebar navigation / top pill bar on mobile */}
        <nav
          className={cn(
            isMobile
              ? "flex flex-row gap-1 px-3 py-2 overflow-x-auto [scrollbar-width:none] border-b border-border/20 shrink-0 bg-background"
              : "w-[340px] shrink-0 bg-muted rounded-lg overflow-y-auto"
          )}
          data-testid="settings-nav"
        >
          {!isMobile && (
            <div className="pl-[17px] pr-[3px] pt-3 pb-3">
              <h1 className="text-2xl font-semibold font-heading text-foreground leading-tight">{t("title")}</h1>
            </div>
          )}
          <div className={cn(
            isMobile
              ? "flex flex-row gap-1"
              : "flex flex-col gap-[3px] py-2 px-[3px]"
          )}>
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    isMobile
                      ? cn(
                          "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150 touch-target",
                          isActive ? "bg-[#FFF9D9] text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                        )
                      : cn(
                          "w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                          isActive
                            ? "bg-highlight-selected text-foreground font-semibold"
                            : "bg-card hover:bg-card-hover text-muted-foreground hover:text-foreground"
                        )
                  )}
                  data-testid={`settings-nav-${section.id}`}
                  data-active={isActive || undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{t(section.labelKey)}</span>
                </button>
              );
            })}
            {/* Desktop-only navigation links */}
            {!isMobile && isAgencyUser && (
              <>
                <div className="my-1 h-px bg-border/30" />
                <button
                  type="button"
                  onClick={() => setLocation(`${routePrefix}/prospects`)}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 bg-card hover:bg-card-hover text-muted-foreground hover:text-foreground"
                  data-testid="settings-nav-prospects"
                >
                  <Users className="h-4 w-4 shrink-0" />
                  <span>{t("hub.prospects")}</span>
                  <ExternalLink className="h-3.5 w-3.5 ml-auto shrink-0 opacity-50" />
                </button>
              </>
            )}
          </div>
        </nav>

        {/* Right content area */}
        <div className={cn(
          "flex-1 bg-card rounded-lg w-full",
          !isMobile && "ml-1.5",
          (activeSection === "team" || activeSection === "account") ? "overflow-hidden flex flex-col" : "overflow-y-auto pb-8",
        )} data-testid="settings-content">
          {activeSection !== "team" && activeSection !== "account" && (
            <div className="pl-[17px] pr-[3px] pt-10 pb-3">
              <h1 className="text-2xl font-semibold font-heading text-foreground leading-tight">
                {t(SECTIONS.find(s => s.id === activeSection)?.labelKey ?? "")}
              </h1>
            </div>
          )}
          <div className={cn(
            (activeSection === "team" || activeSection === "account")
              ? "flex-1 flex flex-col min-h-0 overflow-y-auto"
              : "px-4 md:px-6 max-w-2xl",
          )}>
            {renderActiveSection()}
          </div>
        </div>
      </div>}
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
