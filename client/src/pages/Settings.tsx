import { useEffect, useCallback, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { CrmShell } from "@/components/crm/CrmShell";
import { BellRing, Receipt, ShieldCheck, SlidersHorizontal, UserRound, Users } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { readLastTab, writeLastTab } from "@/lib/lastTab";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useClientNavFacts } from "@/components/crm/useClientNavFacts";
import { SettingsTeamSection } from "@/features/users/components/SettingsTeamSection";
import { BillingContent } from "@/features/billing/pages/BillingPage";
import { SectionHeader, SectionRail, type SectionRailItem, type SectionState } from "@/features/accounts/components/workspace/SectionRail";
import { MobileAgencySwitcher } from "@/components/crm/mobile/MobileAgencySwitcher";
import { MyProfileGate } from "@/features/settings/components/MyProfileGate";
import { ProfileTab } from "@/features/settings/components/ProfileTab";
import { PreferencesTab } from "@/features/settings/components/PreferencesTab";
import { SecurityTab } from "@/features/settings/components/SecurityTab";
import { AlertsSection } from "@/features/settings/components/AlertsSection";
import { useTwoFactor } from "@/features/settings/twoFactor/useTwoFactor";

// ── Settings sections ────────────────────────────────────────────────
// URL contract: /platform/settings?tab=profile|security|preferences|alerts|users|billing.
// The tab lives in the query string (not local state) so nav links that only
// change ?tab= switch the tab even while this page is already open.
// Old links still work: ?tab=team opens Users, ?tab=notifications opens Alerts, ?tab=account (removed: the
// Accounts page edits the account) falls back to Profile.
type SettingsSection = "profile" | "security" | "preferences" | "alerts" | "users" | "billing";
const DEFAULT_SECTION: SettingsSection = "profile";
const ALIASES: Record<string, SettingsSection> = { team: "users", notifications: "alerts" };

const SECTION_ICON: Record<SettingsSection, React.ElementType> = {
  profile: UserRound,
  security: ShieldCheck,
  preferences: SlidersHorizontal,
  alerts: BellRing,
  users: Users,
  billing: Receipt,
};

const ALL_SECTIONS = Object.keys(SECTION_ICON) as SettingsSection[];
const LAST_TAB_PAGE = "settings";

/** Users and Billing are whole workspaces (list + detail): they fill the page instead of a column of cards. */
const FULL_HEIGHT: SettingsSection[] = ["users", "billing"];

function toSection(v: string | null): SettingsSection | null {
  if (!v) return null;
  if (ALIASES[v]) return ALIASES[v];
  return v in SECTION_ICON ? (v as SettingsSection) : null;
}

// ── Main Settings Page ───────────────────────────────────────────────
function SettingsContent() {
  const { t } = useTranslation("settings");
  const { isAgencyUser } = useWorkspace();
  const { hasInvoices } = useClientNavFacts();
  const stacked = useIsMobile(768);
  const [location, navigate] = useLocation();
  const search = useSearch();
  const twoFactor = useTwoFactor();

  // A client's own billing (invoices and contracts) is a Settings section; the agency keeps its Billing page.
  const sections: SettingsSection[] = ["profile", "security", "preferences", "alerts", "users"];
  if (!isAgencyUser && hasInvoices) sections.push("billing");

  // ── Active section: derived from ?tab=, else the section used last; unknown / unauthorized falls back to profile
  const linked = toSection(new URLSearchParams(search).get("tab"));
  const requested = linked ?? readLastTab<SettingsSection>(LAST_TAB_PAGE, ALL_SECTIONS, DEFAULT_SECTION);
  const active: SettingsSection = sections.includes(requested) ? requested : DEFAULT_SECTION;

  // Remember the section a ?tab= opens (a link or a pick), so coming back to Settings lands on it.
  useEffect(() => {
    if (linked && sections.includes(linked)) writeLastTab(LAST_TAB_PAGE, linked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked, sections.length]);

  const setActive = useCallback((id: SettingsSection) => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", id);
    writeLastTab(LAST_TAB_PAGE, id);
    navigate(`${location}?${params.toString()}`, { replace: true });
  }, [location, navigate]);

  // Deep-link: other pages can set sessionStorage to open a section
  useEffect(() => {
    const pending = toSection(sessionStorage.getItem("pendingSettingsSection"));
    sessionStorage.removeItem("pendingSettingsSection");
    if (pending) setActive(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The Security tile shows whether 2FA is on: re-read it when you leave a section
  // (the hook already loads it once on mount).
  const { refresh: refreshTwoFactor } = twoFactor;
  const firstSection = useRef(active);
  useEffect(() => {
    if (active === firstSection.current) return;
    firstSection.current = active;
    void refreshTwoFactor();
  }, [active, refreshTwoFactor]);
  const tfa = twoFactor.status;
  const tfaOn = !!tfa && (tfa.totp || tfa.email || tfa.passkeys > 0);
  const securityState: SectionState | undefined = !tfa ? undefined : tfaOn ? "on" : tfa.required ? "pending" : "off";

  const detail: Record<SettingsSection, string> = {
    profile: t("rail.profile"),
    security: t("rail.security"),
    preferences: t("rail.preferences"),
    alerts: t("rail.alerts"),
    users: t("rail.users"),
    billing: t("rail.billing"),
  };
  const items: SectionRailItem<SettingsSection>[] = sections.map((id) => {
    const Icon = SECTION_ICON[id];
    return {
      key: id,
      icon: <Icon className="h-4 w-4" />,
      label: t(`sections.${id}`),
      detail: detail[id],
      state: id === "security" ? securityState : undefined,
    };
  });

  const rail = (layout: "rail" | "grid") => (
    <SectionRail items={items} active={active} onSelect={setActive} layout={layout} testId="settings-tabs" />
  );

  const full = FULL_HEIGHT.includes(active);

  const cards = (
    <div className="space-y-4" data-testid={`settings-panel-${active}`}>
      <SectionHeader index={sections.indexOf(active) + 1} title={t(`sections.${active}`)} help={detail[active]} />
      <MyProfileGate key={active} testId={`section-${active}`}>
        {(profile, setProfile) =>
          active === "profile" ? (
            <ProfileTab profile={profile} onProfileUpdated={setProfile} withSecurity={false} />
          ) : active === "security" ? (
            <SecurityTab profile={profile} />
          ) : active === "alerts" ? (
            <AlertsSection />
          ) : (
            <PreferencesTab profile={profile} onProfileUpdated={setProfile} showNotifications={false} showSecurity={false} />
          )
        }
      </MyProfileGate>
    </div>
  );

  const workspace = active === "users" ? (
    <div className="h-full" data-testid="settings-panel-users">
      <SettingsTeamSection isUltrawide={false} />
    </div>
  ) : (
    <div className="h-full" data-testid="settings-panel-billing">
      <BillingContent />
    </div>
  );

  return (
    <div className="la-page" data-testid="page-settings">
      {/* Agency/account switcher, relocated here from the mobile list header */}
      {isAgencyUser && (
        <div className="md:hidden px-4 pt-3 pb-1" style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}>
          <MobileAgencySwitcher />
        </div>
      )}
      <div className="la-page-header flex items-center gap-4 min-w-0">
        <span className="la-page-title">{t("title")}</span>
        {/* Toolbar portal slot: the Users toolbar mounts here on the topbar */}
        {active === "users" && (
          <div id="settings-team-toolbar-slot" className="flex-1 flex items-center justify-end gap-1.5 px-2" style={{ overflow: "visible" }} />
        )}
      </div>

      {stacked ? (
        // Phone: the tiles in a grid above the open section, one scroll.
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-4 py-4 space-y-6">
            {rail("grid")}
            {full ? <div style={{ minHeight: 560 }}>{workspace}</div> : cards}
          </div>
        </div>
      ) : (
        // Desktop: the menu stays put on the left, the open section beside it.
        <div className="flex-1 min-h-0 flex w-full mx-auto" style={{ maxWidth: full ? 1386 : 1042 }}>
          <div className="shrink-0 overflow-y-auto" style={{ width: 282, padding: "24px 14px 24px 24px" }}>
            {rail("rail")}
          </div>
          {full ? (
            <div className="flex-1 min-w-0 min-h-0" style={{ paddingLeft: 24 }}>{workspace}</div>
          ) : (
            <div className="flex-1 min-w-0 min-h-0 overflow-y-auto">
              <div className="w-full max-w-[760px] py-6 px-7">{cards}</div>
            </div>
          )}
        </div>
      )}
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
