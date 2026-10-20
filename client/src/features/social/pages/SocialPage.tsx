// The Socials page (nav bar > Socials). Agency picks an account with Social switched on; a client
// user (Manager, Viewer) always sees their own account, and only once the agency switched Social on.
// Connect / disconnect and the on/off switch stay in Accounts > Integrations (account setup).
import { useMemo, useState } from "react";
import { Redirect } from "wouter";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { useSocialStatus } from "../components/InstagramConnectCard";
import { SocialAccountPicker } from "../components/SocialAccountPicker";
import { SocialTab } from "../components/SocialTab";
import { showSocialTab } from "../lib/posts";
import { pickSocialAccount, socialAccountOptions, socialSections, type SocialSection } from "../lib/socialPage";

export function SocialPage() {
  const { t } = useTranslation("social");
  const isMobile = useIsMobile(768);
  const { isAgencyUser, userRole, currentAccountId, setCurrentAccountId, accounts, currentAccount, isLoadingAccounts } = useWorkspace();
  const options = useMemo(() => (isAgencyUser ? socialAccountOptions(accounts) : []), [isAgencyUser, accounts]);
  const account = pickSocialAccount({ isAgency: isAgencyUser, currentAccountId, options, ownAccount: currentAccount });
  const accountId = account?.id ?? 0;
  const { data: status, isLoading: statusLoading } = useSocialStatus(accountId);
  const sections = socialSections({ isAgency: isAgencyUser, userRole });
  const [picked, setPicked] = useState<SocialSection>(sections[0]);
  const section = sections.includes(picked) ? picked : sections[0];

  // A client whose account does not have Social on has no Socials page.
  if (status && !showSocialTab({ isAgency: isAgencyUser, enabled: status.enabled })) return <Redirect to="/platform/home" />;

  const loading = (isAgencyUser && isLoadingAccounts) || (accountId > 0 && statusLoading);

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

        <div className="min-h-0 overflow-y-auto" style={{ flex: 1 }}>
          <div style={{ maxWidth: 1386, padding: isMobile ? "14px 16px 32px" : "20px 24px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
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
              section === "posts" && <SocialTab key={account.id} accountId={account.id} timeZone={account.timeZone} />
            )}
          </div>
        </div>
      </div>
    </CrmShell>
  );
}
