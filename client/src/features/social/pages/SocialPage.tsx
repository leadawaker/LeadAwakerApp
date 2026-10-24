// The Socials page (nav bar > Socials). Agency picks an account with Social switched on; a client
// user (Manager, Viewer) always sees their own account, and only once the agency switched Social on.
// Connect / disconnect and the on/off switch stay in Accounts > Integrations (account setup).
import { useEffect, useMemo, useState } from "react";
import { Redirect, useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { ChartColumn, Clapperboard, Film, Home, Image as ImageIcon, Instagram, Loader2, MessageCircle, Settings } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { PillSwitch } from "@/components/crm/primitives/PillSwitch";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useWorkspace } from "@/hooks/useWorkspace";
import { readLastTab, writeLastTab } from "@/lib/lastTab";
import { SectionLayout, SectionRail, type SectionRailItem } from "@/features/accounts/components/workspace/SectionRail";
import { useSocialStatus } from "../components/InstagramConnectCard";
import { SocialAccountPicker } from "../components/SocialAccountPicker";
import { SocialTab } from "../components/SocialTab";
import { ManagerHome } from "../components/ManagerHome";
import { SocialSettingsSection } from "../components/SocialSettingsSection";
import { StudioSection } from "../components/studio/StudioSection";
import { CommentsSection } from "../components/comments/CommentsSection";
import { InsightsSection } from "../components/insights/InsightsSection";
import { ThumbnailsSection } from "../components/thumbnails/ThumbnailsSection";
import { showSocialTab } from "../lib/posts";
import { SocialApiError } from "../api/socialApi";
import { parseSocialDeepLink, pickSocialAccount, socialAccountOptions, socialSections, SOCIAL_PAGE_PATH, type SocialSection } from "../lib/socialPage";

const ALL_SECTIONS: readonly SocialSection[] = ["home", "posts", "studio", "thumbnails", "comments", "insights", "settings"];
const SECTION_ICON: Record<SocialSection, typeof Home> = {
  home: Home, posts: Film, studio: Clapperboard, thumbnails: ImageIcon, comments: MessageCircle, insights: ChartColumn, settings: Settings,
};
const LAST_TAB_PAGE = "social";
const LAST_WORK_PAGE = "social.work";

export function SocialPage() {
  const { t } = useTranslation("social");
  const isMobile = useIsMobile(768);
  const { isAgencyUser, userRole, currentAccountId, setCurrentAccountId, accounts, currentAccount, isLoadingAccounts } = useWorkspace();
  const options = useMemo(() => (isAgencyUser ? socialAccountOptions(accounts) : []), [isAgencyUser, accounts]);
  const account = pickSocialAccount({ isAgency: isAgencyUser, currentAccountId, options, ownAccount: currentAccount });
  const accountId = account?.id ?? 0;
  const { data: status, isLoading: statusLoading, error: statusError } = useSocialStatus(accountId);
  const sections = socialSections({ isAgency: isAgencyUser, userRole });
  // Insights sits apart from the other sections, the way Stats does on Chats and Calls.
  const workSections = sections.filter((s) => s !== "insights");
  const hasInsights = sections.includes("insights");
  // The page reopens on the section used last (per user); one this role does not get opens the first.
  const [picked, setPicked] = useState<SocialSection>(() => readLastTab(LAST_TAB_PAGE, ALL_SECTIONS, workSections[0] ?? sections[0]));
  const section = sections.includes(picked) ? picked : workSections[0] ?? sections[0];
  // The last section used outside Insights, so switching back lands where you were.
  const [lastWork, setLastWork] = useState<SocialSection>(() => readLastTab(LAST_WORK_PAGE, ALL_SECTIONS.filter((s) => s !== "insights"), workSections[0] ?? sections[0]));
  const pick = (s: SocialSection) => {
    setPicked(s);
    writeLastTab(LAST_TAB_PAGE, s);
    if (s !== "insights") {
      setLastWork(s);
      writeLastTab(LAST_WORK_PAGE, s);
    }
  };
  const mode: "insights" | "work" = section === "insights" ? "insights" : "work";

  // ?account=<id>&section=<name> (notifications, Integrations): agency switches to that account; then the URL is cleaned.
  const search = useSearch();
  const [, setLocation] = useLocation();
  useEffect(() => {
    const link = parseSocialDeepLink(search);
    if (link.accountId === null && link.section === null) return;
    if (isAgencyUser && link.accountId) setCurrentAccountId(link.accountId);
    if (link.section) pick(link.section as SocialSection);
    setLocation(SOCIAL_PAGE_PATH, { replace: true });
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // A client whose account does not have Social on has no Socials page (the server says 403 not_enabled).
  const refused = statusError instanceof SocialApiError && statusError.status === 403;
  if ((status && !showSocialTab({ isAgency: isAgencyUser, enabled: status.enabled })) || (!isAgencyUser && refused)) {
    return <Redirect to="/platform/home" replace />;
  }

  // A client's own account id can be 0 for a moment after login: wait instead of showing the agency message.
  const showRail = mode === "work" && workSections.length > 1;
  const rail = (layout: "rail" | "grid") => (
    <SectionRail<SocialSection>
      items={workSections.map((s): SectionRailItem<SocialSection> => {
        const Icon = SECTION_ICON[s];
        return { key: s, icon: <Icon className="h-4 w-4" />, label: t(`page.tabs.${s}`), detail: t(`page.rail.${s}`) };
      })}
      active={section} onSelect={pick} layout={layout} testId="social-tabs" ariaLabel={t("page.sections")}
    />
  );

  const loading = (isAgencyUser && isLoadingAccounts) || (accountId > 0 && statusLoading) || (!isAgencyUser && !account);

  return (
    <CrmShell>
      <div className="la-page" style={{ background: "var(--bg)" }} data-testid="page-social">
        <div className="la-page-header" style={{ gap: 12, padding: isMobile ? "0 12px" : "0 17px" }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", flexShrink: 0 }}>{t("page.title")}</span>
          {hasInsights && (
            <PillSwitch<"insights" | "work">
              items={[
                { id: "insights", label: t("page.tabs.insights"), icon: ChartColumn, color: "var(--wine)" },
                { id: "work", label: t("page.modes.work"), icon: Instagram, color: "var(--wine)" },
              ]}
              value={mode}
              onChange={(m) => pick(m === "insights" ? "insights" : sections.includes(lastWork) ? lastWork : workSections[0])}
              ariaLabel={t("page.modes.aria")}
              testId="social-mode-switch"
              itemTestId={(m) => (m === "insights" ? "social-section-tab-insights" : "social-mode-work")}
              compact={isMobile}
            />
          )}
          {/* The account picker sits right after the mode switch, as on Calls and Chats > Settings. */}
          {isAgencyUser && options.length > 0 && (
            <div style={{ flexShrink: 0 }}>
              <SocialAccountPicker options={options} selectedId={account?.id ?? null} onSelect={setCurrentAccountId} />
            </div>
          )}
        </div>

        <div className="min-h-0 overflow-y-auto w-full" style={{ flex: 1 }}>
          <div className="la-page-center" style={{ padding: isMobile ? "14px 16px 32px" : "20px 24px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
            {loading ? (
              <div role="status" aria-label={t("page.loading")} style={{ padding: 24, color: "var(--mute-2)" }}>
                <Loader2 size={16} className="animate-spin" />
              </div>
            ) : !account ? (
              <div className="neu-inset-crisp" style={{ borderRadius: "var(--r-card)", padding: "28px 20px", textAlign: "center" }} data-testid="social-no-accounts">
                <p style={{ margin: 0, fontSize: 13, color: "var(--mute)" }}>{t("page.noAccounts")}</p>
              </div>
            ) : (
              <SectionShell show={showRail} stacked={isMobile} rail={rail}>
              <div key={`${account.id}-${section}`} data-testid={`social-section-${section}-body`}>
                {section === "home" && <ManagerHome accountId={account.id} timeZone={account.timeZone} onOpen={pick} />}
                {section === "posts" && <SocialTab accountId={account.id} timeZone={account.timeZone} />}
                {section === "studio" && <StudioSection accountId={account.id} timeZone={account.timeZone} />}
                {section === "thumbnails" && <ThumbnailsSection accountId={account.id} />}
                {section === "comments" && <CommentsSection accountId={account.id} />}
                {section === "insights" && <InsightsSection accountId={account.id} />}
                {section === "settings" && <SocialSettingsSection accountId={account.id} />}
              </div>
              </SectionShell>
            )}
          </div>
        </div>
      </div>
    </CrmShell>
  );
}

/** The sections menu down the left on desktop, above the open section on a phone; no menu in Insights. */
function SectionShell({ show, stacked, rail, children }: {
  show: boolean; stacked: boolean; rail: (layout: "rail" | "grid") => React.ReactNode; children: React.ReactNode;
}) {
  if (!show) return <>{children}</>;
  return <SectionLayout stacked={stacked} rail={rail} testId="social-layout">{children}</SectionLayout>;
}
