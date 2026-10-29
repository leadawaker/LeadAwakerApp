import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import {
  Building2,
  Receipt,
  BookOpen,
  ScrollText,
  ChartNoAxesColumn,
  LogOut,
  ChevronRight,
  ChevronDown,
  Check,
  Bell,
  Bot,
  Sun,
  Moon,
  Monitor,
  MessageSquare,
  Inbox,
  BookUser,
  Star,
  MonitorPlay,
  type LucideIcon,
} from "lucide-react";
import { FounderInbox } from "@/components/crm/FounderInbox";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MobileSheet } from "@/components/crm/mobile/MobileSheet";
import { useMobileChrome } from "@/contexts/MobileChromeContext";
import { isNavItemVisible, useNavGateContext, type NavGate } from "@/components/crm/navVisibility";
import { APP_LANGUAGES } from "@/lib/languages";
import { agencyBottomBar, clientMoreItems, clientNavLabelKey, isSameRoute, CLIENT_NAV_HREF } from "@/components/crm/navGates";
import { NAV_ICON } from "@/components/crm/navIcons";
import { useClientNavFacts } from "@/components/crm/useClientNavFacts";
import { useCurrentUserIdentity } from "@/hooks/useCurrentUserIdentity";
import { displayName, initialsFor } from "@/lib/userIdentity";

const THEME_CYCLE: { mode: ThemeMode; icon: LucideIcon; labelKey: string }[] = [
  { mode: "light", icon: Sun, labelKey: "sidebar.themeLight" },
  { mode: "dark", icon: Moon, labelKey: "sidebar.themeDark" },
  { mode: "system", icon: Monitor, labelKey: "sidebar.themeSystem" },
];

/**
 * One row inside a grouped panel (icon + label + chevron). The overlay only
 * closes on a route change, so a link to the page already open closes it itself.
 */
function NavRow({ icon: Icon, label, href, onClick, onSameRoute, testId, tone = "ink" }: {
  icon: LucideIcon; label: string; href?: string; onClick?: () => void; onSameRoute?: () => void; testId?: string;
  tone?: "ink" | "danger";
}) {
  const [location] = useLocation();
  const danger = tone === "danger";
  const inner = (
    <>
      <span style={{ color: danger ? "hsl(var(--destructive))" : "var(--wine)", display: "flex" }}><Icon size={21} /></span>
      <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: danger ? "hsl(var(--destructive))" : "var(--ink)" }}>{label}</span>
      {!danger && <span style={{ color: "var(--mute-2)", display: "flex" }}><ChevronRight size={18} /></span>}
    </>
  );
  const style: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 16, width: "100%", minHeight: 56,
    padding: "15px 18px", textAlign: "left",
    background: "transparent", border: "none", cursor: "pointer", textDecoration: "none",
  };
  return href ? (
    <Link
      href={href}
      onClick={(e) => { if (isSameRoute(href, location)) { e.preventDefault(); onSameRoute?.(); } }}
      className="la-more-row"
      style={style}
      data-testid={testId}
    >{inner}</Link>
  ) : (
    <button type="button" onClick={onClick} className="la-more-row" style={style} data-testid={testId}>{inner}</button>
  );
}

/** One medium raised panel holding rows split by hairline dividers. */
function NavGroup({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <div className="neu-raised-crisp la-more-group" style={{ background: "var(--card)", borderRadius: "var(--r-card)", overflow: "hidden" }} data-testid={testId}>
      {children}
    </div>
  );
}

function Divider() {
  return <div aria-hidden style={{ margin: "0 18px", borderTop: "1px solid var(--line)" }} />;
}

/** Rows with a divider between each. */
function rowsWithDividers(nodes: React.ReactNode[]) {
  return nodes.flatMap((n, i) => (i === 0 ? [n] : [<Divider key={`d${i}`} />, n]));
}

/**
 * MobileMorePage — full-screen "More" tab.
 * Layout (top → bottom):
 *   1. Topbar: "More" title + Lead Awaker AI (owner)
 *   2. Account switcher (agency only) — chevron-down dropdown affordance
 *   3. Sales (Demos, Owner) / Services / Engage / Admin / Backend: one raised
 *      panel per section, rows split by dividers (grouped like the desktop nav bar)
 *   4. Help: Documentation + Support inbox (owner) or Assistance
 *   5. Account panel: flat Language · Theme · Notifications buttons, then the
 *      profile row (opens Settings, which holds the old My profile page) and
 *      Log out (dividers between).
 */
export function MobileMorePage({
  open,
  onClose,
  onOpenAi,
  onToggleHelp: _onToggleHelp,
  onLogout,
}: {
  open: boolean;
  onClose?: () => void;
  onOpenAi?: () => void;
  onToggleHelp: () => void;
  onLogout?: () => void;
}) {
  const { t, i18n } = useTranslation("crm");
  const [location, setLocation] = useLocation();
  const { isAgencyUser, isOwner, currentAccountId, setCurrentAccountId, currentAccount, accounts } = useWorkspace();
  const { themeMode, setThemeMode, isDark } = useTheme();
  const { openNotifications, unreadCount } = useMobileChrome();
  const [langOpen, setLangOpen] = useState(false);
  const [acctSheetOpen, setAcctSheetOpen] = useState(false);
  const [inboxSheetOpen, setInboxSheetOpen] = useState(false);
  // Same gates as the desktop nav bar (role, impersonation, voice line, Owner toggles).
  const navCtx = useNavGateContext();

  const switcherAccounts = [
    { id: 0, name: t("topbar.viewAsAgency", "Agency View") },
    ...[...accounts].sort((a, b) => (a.id === 1 ? -1 : b.id === 1 ? 1 : 0)).map((a) => ({ id: a.id, name: a.name })),
  ];

  const prefix = "/platform";

  const identity = useCurrentUserIdentity();
  const userName = displayName(identity);
  const userAvatar = identity?.avatar ?? "";
  const userRole = localStorage.getItem("leadawaker_user_role") || "Viewer";
  const userInitials = initialsFor(userName);

  const currentLang = i18n.language?.split("-")[0] || "en";
  const currentLanguage = APP_LANGUAGES.find((l) => l.code === currentLang) ?? APP_LANGUAGES[0];
  const handleChangeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("leadawaker_lang", lang);
    setLangOpen(false);
  };

  const themeIndex = Math.max(0, THEME_CYCLE.findIndex((o) => o.mode === themeMode));
  const ThemeIcon = THEME_CYCLE[themeIndex].icon;
  const cycleTheme = () => setThemeMode(THEME_CYCLE[(themeIndex + 1) % THEME_CYCLE.length].mode);

  // Nav items grouped like the desktop nav bar (Services, Engage, Admin, Backend).
  type Item = NavGate & { label: string; href: string; icon: LucideIcon };
  // Clients get their own flat list (clientMoreItems) instead of the agency groups.
  const clientFacts = useClientNavFacts();
  const clientItems = isAgencyUser ? [] : clientMoreItems(clientFacts).map((k) => ({
    key: k, label: t(clientNavLabelKey(k, clientFacts)), href: CLIENT_NAV_HREF[k], icon: NAV_ICON[k],
  }));
  const visible = (items: Item[]) => (isAgencyUser ? items.filter((it) => isNavItemVisible(it, navCtx)) : []);
  // Calendar lives here unless the bar already holds it.
  const calendarInBar = agencyBottomBar(navCtx.hasVoiceCalls).includes("calendar");
  // Speed to Lead and Missed calls are hidden until finished (list in RightSidebar.tsx).
  // Demos sits first, as on the desktop nav bar (right under Stats): Owner only.
  const salesItems = visible([
    { label: t("sidebar.demos"), href: `${prefix}/demos`, icon: MonitorPlay, ownerOnly: true },
  ]);
  const serviceItems = visible([
    { label: t("sidebar.reputation"), href: `${prefix}/reputation`, icon: Star, serviceKey: "reputation" },
  ]);
  const engageItems = visible([
    ...(calendarInBar ? [] : [{ label: t("sidebar.calendar"), href: `${prefix}/calendar`, icon: NAV_ICON.calendar }]),
    { label: t("sidebar.leads"), href: `${prefix}/contacts`, icon: BookUser, agencyOnly: true },
    { label: t("sidebar.social"), href: `${prefix}/social`, icon: NAV_ICON.social, agencyOnly: true },
  ]);
  const adminItems = visible([
    { label: t("sidebar.accounts"), href: `${prefix}/accounts`, icon: Building2, agencyOnly: true, agencyViewOnly: true },
    { label: t("sidebar.billing"), href: `${prefix}/billing`, icon: Receipt, agencyOnly: true },
  ]);
  const backendItems = visible([
    { label: t("sidebar.promptLibrary"), href: `${prefix}/prompt-library`, icon: BookOpen, agencyOnly: true },
    { label: t("sidebar.automations"), href: `${prefix}/automation-logs`, icon: ScrollText, ownerOnly: true },
    { label: t("sidebar.traffic"), href: `${prefix}/traffic`, icon: ChartNoAxesColumn, ownerOnly: true },
  ]);

  const openFounderChat = () => {
    window.dispatchEvent(new CustomEvent("open-founder-chat"));
  };

  // Flat utility buttons (Language · Theme · Notifications) inside the account panel.
  const utilBtnStyle: React.CSSProperties = {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
    minHeight: 72, padding: "12px 4px", borderRadius: "var(--r-button)", border: "none", background: "transparent",
    cursor: "pointer", position: "relative",
  };
  const utilLabelStyle: React.CSSProperties = {
    fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.02em", textTransform: "uppercase", color: "var(--mute)", fontWeight: 600,
    textAlign: "center", lineHeight: 1.25, maxWidth: "100%",
  };
  // The profile row opens Settings > Profile (the old My profile page lives there now).
  const openProfile = () => {
    const onSettings = isSameRoute(`${prefix}/settings`, location);
    setLocation(`${prefix}/settings?tab=profile`);
    if (onSettings) onClose?.();
  };

  if (!open) return null;

  return (
    <div
      className="md:hidden"
      style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: "var(--chrome-deep)" }}
      data-testid="mobile-more-page"
    >
      {/* ── Topbar: the Lead Awaker logo + Lead Awaker AI ── */}
      <div
        style={{
          flexShrink: 0,
          background: "var(--chrome-deep)",
          borderBottom: "1px solid var(--line)",
          padding: "12px 14px 12px 18px",
          paddingTop: "max(env(safe-area-inset-top, 0px), 14px)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <h1 style={{ flex: 1, minWidth: 0, margin: 0, display: "flex" }} aria-label={t("sidebar.more")}>
          <img
            src={isDark ? "/premium/logo-v2-dark.svg" : "/premium/logo-v2-outline.svg"}
            alt="Lead Awaker"
            style={{ height: 38 }}
            data-testid="mobile-more-logo"
          />
        </h1>
        {isOwner && (
          <button
            onClick={onOpenAi}
            className="neu-raised-crisp flex items-center justify-center active:scale-95"
            style={{ width: 42, height: 42, borderRadius: "var(--r-button)", border: "none", background: "transparent", cursor: "pointer", flexShrink: 0 }}
            aria-label="Lead Awaker AI"
            data-testid="mobile-more-ai"
          >
            <Bot size={22} style={{ color: "var(--wine)" }} />
          </button>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "18px 14px",
          paddingBottom: "calc(var(--bottombar-h) + 24px)",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Account switcher — agency users only */}
        {isAgencyUser && (
          <div className="neu-inset-crisp" style={{ borderRadius: "var(--r-card)" }}>
            <button
              onClick={() => setAcctSheetOpen(true)}
              className="row"
              style={{ gap: 14, padding: "15px 18px", border: "none", background: "transparent", width: "100%", textAlign: "left", cursor: "pointer" }}
              data-testid="mobile-more-account-switcher"
            >
              <span style={{ color: "var(--wine)", display: "flex" }}><Building2 size={21} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)" }}>
                  {t("topbar.account", "Account")}
                </div>
                <div style={{ fontSize: 17, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {currentAccountId === 0 ? t("topbar.viewAsAgency", "Agency View") : (currentAccount?.name || t("topbar.account", "Account"))}
                </div>
              </div>
              <span style={{ color: "var(--mute-2)", display: "flex" }}><ChevronDown size={18} /></span>
            </button>
          </div>
        )}

        {([
          ["sales", t("sidebarSections.outreach"), salesItems],
          ["services", t("sidebar.services"), serviceItems],
          ["engage", t("sidebarSections.engage"), engageItems],
          ["admin", t("sidebarSections.admin", "Admin"), adminItems],
          ["backend", t("sidebarSections.backend", "Backend"), backendItems],
        ] as const).map(([key, heading, items]) => items.length > 0 && (
          <div key={key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="eyebrow la-more-heading">{heading}</div>
            <NavGroup testId={`mobile-more-group-${key}`}>
              {rowsWithDividers(items.map((it) => (
                <NavRow key={it.href} icon={it.icon} label={it.label} href={it.href} onSameRoute={onClose} testId={`mobile-more-link-${it.label.toLowerCase().replace(/\s+/g, "-")}`} />
              )))}
            </NavGroup>
          </div>
        ))}

        {clientItems.length > 0 && (
          <NavGroup testId="mobile-more-group-client">
            {rowsWithDividers(clientItems.map((it) => (
              <NavRow key={it.href} icon={it.icon} label={it.label} href={it.href} onSameRoute={onClose} testId={`mobile-more-link-${it.key}`} />
            )))}
          </NavGroup>
        )}

        {/* Help: Documentation + Support inbox (owner) or Assistance (others) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="eyebrow la-more-heading">{t("sidebar.help", "Help")}</div>
          <NavGroup testId="mobile-more-group-help">
            {rowsWithDividers([
              <NavRow key="docs" icon={BookOpen} label={t("sidebar.documentation", "Documentation")} href={`${prefix}/docs`} onSameRoute={onClose} testId="mobile-more-docs" />,
              isOwner ? (
                <NavRow key="inbox" icon={Inbox} label={t("sidebar.founderInbox", "Support inbox")} onClick={() => setInboxSheetOpen(true)} testId="mobile-more-inbox" />
              ) : (
                <NavRow key="assist" icon={MessageSquare} label={isAgencyUser ? t("help.assistance", "Assistance") : t("sidebar.messageFounder", "Message Gabriel")} onClick={openFounderChat} testId="mobile-more-assistance" />
              ),
            ])}
          </NavGroup>
        </div>

        {/* Account panel: flat Language · Theme · Notifications, then the profile row (opens Settings) and Log out */}
        <div style={{ marginTop: "auto" }}>
          <NavGroup testId="mobile-more-account-panel">
            {/* Flat utility buttons on top of the panel */}
            <div style={{ display: "flex", gap: 4, padding: 10 }}>
              <Popover open={langOpen} onOpenChange={setLangOpen}>
                <PopoverTrigger asChild>
                  <button type="button" className="la-more-util" style={utilBtnStyle} data-testid="mobile-more-language">
                    <span style={{ fontSize: 24, lineHeight: 1 }}>{currentLanguage.flag}</span>
                    <span style={utilLabelStyle}>{t("sidebar.language", "Language")}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-48 p-1 rounded-2xl shadow-xl border-border bg-background">
                  {APP_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleChangeLanguage(lang.code)}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm hover:bg-muted/50 transition-colors"
                      data-testid={`mobile-more-language-${lang.code}`}
                    >
                      <span className="text-base leading-none">{lang.flag}</span>
                      <span className="flex-1 text-left">{lang.label}</span>
                      {lang.code === currentLang && <Check size={14} />}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              <button type="button" onClick={cycleTheme} className="la-more-util" style={utilBtnStyle} data-testid="mobile-more-theme">
                <ThemeIcon size={24} style={{ color: "var(--wine)" }} />
                <span style={utilLabelStyle}>{t(THEME_CYCLE[themeIndex].labelKey)}</span>
              </button>

              <button type="button" onClick={openNotifications} className="la-more-util" style={utilBtnStyle} data-testid="mobile-more-notifications">
                <span style={{ position: "relative", display: "flex" }}>
                  <Bell size={24} style={{ color: "var(--wine)" }} />
                  {unreadCount > 0 && (
                    <span style={{ position: "absolute", top: -4, right: -6, minWidth: 15, height: 15, padding: "0 3px", borderRadius: "var(--r-pill)", background: "var(--wine)", color: "var(--card)", fontSize: 9.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </span>
                <span style={utilLabelStyle}>{t("topbar.notifications", "Alerts")}</span>
              </button>
            </div>

            <Divider />
            <button
              type="button"
              onClick={openProfile}
              className="row la-more-row"
              style={{ gap: 14, padding: "14px 18px", minHeight: 76, border: "none", background: "transparent", width: "100%", textAlign: "left", cursor: "pointer" }}
              data-testid="mobile-more-profile"
            >
              <span
                className="la-profile-av"
                style={{ width: 48, height: 48, borderRadius: "var(--r-surface)", fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                {userAvatar
                  ? <img src={userAvatar} alt={userName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "var(--r-surface)" }} />
                  : userInitials}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  data-testid="mobile-more-user-name"
                >
                  {userName}
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)" }}>
                  {userRole}
                </div>
              </div>
              <span style={{ color: "var(--mute-2)", display: "flex" }}><ChevronRight size={18} /></span>
            </button>
            <Divider />
            <NavRow icon={LogOut} label={t("sidebar.logout") || "Log out"} onClick={onLogout} tone="danger" testId="mobile-more-logout" />
          </NavGroup>
        </div>
      </div>

      {/* ── Account switcher sheet ── */}
      {isAgencyUser && (
        <MobileSheet open={acctSheetOpen} onClose={() => setAcctSheetOpen(false)} fitContent data-testid="mobile-account-sheet">
          <div style={{ padding: "2px 18px calc(18px + var(--safe-bottom))", display: "flex", flexDirection: "column" }}>
            <span className="serif" style={{ fontSize: 21, color: "var(--ink)", letterSpacing: "-0.02em", padding: "0 2px 8px" }}>
              {t("topbar.switchAccount", "Switch Account")}
            </span>
            {switcherAccounts.map((acc) => {
              const active = currentAccountId === acc.id;
              return (
                <button
                  key={acc.id}
                  onClick={() => { setCurrentAccountId(acc.id); setAcctSheetOpen(false); }}
                  className="row"
                  style={{ gap: 14, alignItems: "center", padding: "15px 2px", minHeight: 56, border: "none", borderBottom: "1px solid var(--line)", background: "transparent", width: "100%", textAlign: "left", cursor: "pointer" }}
                  data-testid={`mobile-account-option-${acc.id}`}
                >
                  <span style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--wine-tint)", color: "var(--wine)", fontWeight: 700, fontSize: 13, fontFamily: "var(--mono)" }}>
                    {acc.id === 0 ? <Building2 size={17} /> : (acc.name?.[0] || "?").toUpperCase()}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 16.5, fontWeight: active ? 700 : 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.name}</span>
                  {active && <Check size={18} style={{ color: "var(--wine)", flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        </MobileSheet>
      )}

      {/* ── Inbox sheet (owner only) ── */}
      {isOwner && (
        <MobileSheet open={inboxSheetOpen} onClose={() => setInboxSheetOpen(false)} data-testid="mobile-inbox-sheet">
          <FounderInbox />
        </MobileSheet>
      )}
    </div>
  );
}
