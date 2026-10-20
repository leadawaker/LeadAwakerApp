// The Socials page (nav bar > Socials). Agency picks an account with Social switched on; a client
// user (Manager, Viewer) always sees their own account, and only once the agency switched Social on.
// Connect / disconnect and the on/off switch stay in Accounts > Integrations (account setup).
import { useEffect, useMemo, useState } from "react";
import { Redirect, useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { useSocialStatus } from "../components/InstagramConnectCard";
import { SocialAccountPicker } from "../components/SocialAccountPicker";
import { SocialTab } from "../components/SocialTab";
import { AboutSection } from "../components/AboutSection";
import { ManagerHome } from "../components/ManagerHome";
import { SocialCalendar } from "../components/SocialCalendar";
import { SocialSettingsSection } from "../components/SocialSettingsSection";
import { StudioSection } from "../components/studio/StudioSection";
import { CommentsSection } from "../components/comments/CommentsSection";
import { showSocialTab } from "../lib/posts";
import { SocialApiError } from "../api/socialApi";
import { parseSocialDeepLink, pickSocialAccount, socialAccountOptions, socialSections, SOCIAL_PAGE_PATH, type SocialSection } from "../lib/socialPage";

export function SocialPage() {
  const { t } = useTranslation("social");
  const isMobile = useIsMobile(768);
  const { isAgencyUser, userRole, currentAccountId, setCurrentAccountId, accounts, currentAccount, isLoadingAccounts } = useWorkspace();
  const options = useMemo(() => (isAgencyUser ? socialAccountOptions(accounts) : []), [isAgencyUser, accounts]);
  const account = pickSocialAccount({ isAgency: isAgencyUser, currentAccountId, options, ownAccount: currentAccount });
  const accountId = account?.id ?? 0;
  const { data: status, isLoading: statusLoading, error: statusError } = useSocialStatus(accountId);
  const sections = socialSections({ isAgency: isAgencyUser, userRole });
  const [picked, setPicked] = useState<SocialSection>(sections[0]);
  const section = sections.includes(picked) ? picked : sections[0];

  // ?account=<id>&section=<name> (notifications, Integrations): agency switches to that account; then the URL is cleaned.
  const search = useSearch();
  const [, setLocation] = useLocation();
  useEffect(() => {
    const link = parseSocialDeepLink(search);
    if (link.accountId === null && link.section === null) return;
    if (isAgencyUser && link.accountId) setCurrentAccountId(link.accountId);
    if (link.section) setPicked(link.section as SocialSection);
    setLocation(SOCIAL_PAGE_PATH, { replace: true });
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // A client whose account does not have Social on has no Socials page (the server says 403 not_enabled).
  const refused = statusError instanceof SocialApiError && statusError.status === 403;
  if ((status && !showSocialTab({ isAgency: isAgencyUser, enabled: status.enabled })) || (!isAgencyUser && refused)) {
    return <Redirect to="/platform/home" replace />;
  }

  // A client's own account id can be 0 for a moment after login: wait instead of showing the agency message.
  const loading = (isAgencyUser && isLoadingAccounts) || (accountId > 0 && statusLoading) || (!isAgencyUser && !account);

  return (
    <CrmShell>
      <div className="la-page" style={{ background: "var(--bg)" }} data-testid="page-social">
        <div className="la-page-header" style={{ gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>{t("page.title")}</span>
          <span style={{ fontSize: 12.5, color: "var(--mute)" }} className="max-md:hidden">
            {status?.connection?.username && status.connection.status !== "disconnected" ? `@${status.connection.username}` : t("page.subtitle")}
          </span>
          {isAgencyUser && options.length > 0 && (
            <div style={{ marginLeft: "auto" }}>
              <SocialAccountPicker options={options} selectedId={account?.id ?? null} onSelect={setCurrentAccountId} />
            </div>
          )}
        </div>

        <div className="min-h-0 overflow-y-auto w-full max-w-[1386px] mr-auto" style={{ flex: 1 }}>
          <div style={{ padding: isMobile ? "14px 16px 32px" : "20px 24px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
            {sections.length > 1 && (
              <div className="la-seg la-seg--pill" role="tablist" aria-label={t("page.sections")} style={{ overflowX: "auto", scrollbarWidth: "none", alignSelf: "flex-start", maxWidth: "100%" }}>
                {sections.map((s) => (
                  <button key={s} type="button" role="tab" aria-selected={section === s} className={cn("la-seg-btn", section === s && "on")}
                    onClick={() => setPicked(s)} style={{ whiteSpace: "nowrap" }} data-testid={`social-section-tab-${s}`}>
                    {t(`page.tabs.${s}`)}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div role="status" aria-label={t("page.loading")} style={{ padding: 24, color: "var(--mute-2)" }}>
                <Loader2 size={16} className="animate-spin" />
              </div>
            ) : !account ? (
              <div className="neu-inset" style={{ borderRadius: "var(--r-card)", padding: "28px 20px", textAlign: "center" }} data-testid="social-no-accounts">
                <p style={{ margin: 0, fontSize: 13, color: "var(--mute)" }}>{t("page.noAccounts")}</p>
              </div>
            ) : (
              <div key={`${account.id}-${section}`} data-testid={`social-section-${section}-body`}>
                {section === "home" && <ManagerHome accountId={account.id} timeZone={account.timeZone} onOpen={setPicked} />}
                {section === "posts" && <SocialTab accountId={account.id} timeZone={account.timeZone} />}
                {section === "studio" && <StudioSection accountId={account.id} timeZone={account.timeZone} />}
                {section === "calendar" && <SocialCalendar accountId={account.id} timeZone={account.timeZone} />}
                {section === "comments" && <CommentsSection accountId={account.id} />}
                {section === "about" && <AboutSection accountId={account.id} />}
                {section === "settings" && <SocialSettingsSection accountId={account.id} />}
              </div>
            )}
          </div>
        </div>
      </div>
    </CrmShell>
  );
}
