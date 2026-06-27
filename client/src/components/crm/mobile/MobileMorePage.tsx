import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import {
  Building2,
  Receipt,
  BookOpen,
  ScrollText,
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
  X,
  Bird,
  BookUser,
  type LucideIcon,
} from "lucide-react";
import { FounderInbox } from "@/components/crm/FounderInbox";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MobileSheet } from "@/components/crm/mobile/MobileSheet";
import { useMobileChrome } from "@/contexts/MobileChromeContext";
import { ProfileSection } from "@/features/settings/components/ProfileSection";
import { NotificationsSection } from "@/features/settings/components/NotificationsSection";

const NAV_LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
] as const;

const THEME_CYCLE: { mode: ThemeMode; icon: LucideIcon; labelKey: string }[] = [
  { mode: "light", icon: Sun, labelKey: "sidebar.themeLight" },
  { mode: "dark", icon: Moon, labelKey: "sidebar.themeDark" },
  { mode: "system", icon: Monitor, labelKey: "sidebar.themeSystem" },
];

/** A standalone raised nav button (icon + label) — one per page. */
function NavButton({ icon: Icon, label, href, onClick, testId }: {
  icon: LucideIcon; label: string; href?: string; onClick?: () => void; testId?: string;
}) {
  const inner = (
    <>
      <span style={{ color: "var(--wine)", display: "flex" }}><Icon size={19} /></span>
      <span style={{ flex: 1, fontSize: 15.5, fontWeight: 600, color: "var(--ink)" }}>{label}</span>
      <span style={{ color: "var(--mute-2)", display: "flex" }}><ChevronRight size={16} /></span>
    </>
  );
  const style: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 14, width: "100%",
    padding: "15px 16px", borderRadius: "var(--r-card)", textAlign: "left",
    background: "var(--surface)", border: "none", cursor: "pointer", textDecoration: "none",
  };
  return href ? (
    <Link href={href} className="neu-raised-crisp" style={style} data-testid={testId}>{inner}</Link>
  ) : (
    <button onClick={onClick} className="neu-raised-crisp" style={style} data-testid={testId}>{inner}</button>
  );
}

/**
 * MobileMorePage — full-screen "More" tab.
 * Layout (top → bottom):
 *   1. Topbar: "More" title + Lead Awaker AI (owner)
 *   2. Account switcher (agency only) — chevron-down dropdown affordance
 *   3. Admin section — plain label + one raised button per page
 *   4. Backend section — plain label + one raised button per page
 *   5. Help section — plain label + Documentation + Assistance buttons
 *   6. Utility row (Notifications · Theme · Language) — above the profile
 *   7. Bottom panel — Profile + Logout, divider between
 */
export function MobileMorePage({
  open,
  onOpenAi,
  onToggleHelp: _onToggleHelp,
  onLogout,
}: {
  open: boolean;
  onOpenAi?: () => void;
  onToggleHelp: () => void;
  onLogout?: () => void;
}) {
  const { t, i18n } = useTranslation("crm");
  const [, setLocation] = useLocation();
  const { isAgencyUser, isAgencyView, isOwner, currentAccountId, setCurrentAccountId, currentAccount, accounts } = useWorkspace();
  const { themeMode, setThemeMode } = useTheme();
  const { openNotifications, unreadCount } = useMobileChrome();
  const [langOpen, setLangOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [acctSheetOpen, setAcctSheetOpen] = useState(false);
  const [inboxSheetOpen, setInboxSheetOpen] = useState(false);

  const switcherAccounts = [
    { id: 0, name: t("topbar.viewAsAgency", "Agency View") },
    ...[...accounts].sort((a, b) => (a.id === 1 ? -1 : b.id === 1 ? 1 : 0)).map((a) => ({ id: a.id, name: a.name })),
  ];

  const prefix = "/platform";

  const userName = localStorage.getItem("leadawaker_user_name") || localStorage.getItem("leadawaker_user_email") || "User";
  const userAvatar = localStorage.getItem("leadawaker_user_avatar") || "";
  const userRole = localStorage.getItem("leadawaker_user_role") || "Viewer";
  const userInitials = userName.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "U";

  const currentLang = i18n.language?.split("-")[0] || "en";
  const currentLanguage = NAV_LANGUAGES.find((l) => l.code === currentLang) ?? NAV_LANGUAGES[0];
  const handleChangeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("leadawaker_lang", lang);
    setLangOpen(false);
  };

  const themeIndex = Math.max(0, THEME_CYCLE.findIndex((o) => o.mode === themeMode));
  const ThemeIcon = THEME_CYCLE[themeIndex].icon;
  const cycleTheme = () => setThemeMode(THEME_CYCLE[(themeIndex + 1) % THEME_CYCLE.length].mode);

  // Nav items split into Admin and Backend sections
  type Item = { label: string; href: string; icon: LucideIcon };
  const adminItems: Item[] = [
    ...(isAgencyUser ? [{ label: t("sidebar.reactivation"), href: `${prefix}/campaigns`, icon: Bird }] : []),
    ...(isAgencyUser ? [{ label: t("sidebar.contacts"), href: `${prefix}/contacts`, icon: BookUser }] : []),
    ...(isAgencyUser && isAgencyView ? [{ label: t("sidebar.accounts"), href: `${prefix}/accounts`, icon: Building2 }] : []),
    ...(isAgencyUser ? [{ label: t("sidebar.billing"), href: `${prefix}/billing`, icon: Receipt }] : []),
  ];
  const backendItems: Item[] = [
    ...(isAgencyUser ? [{ label: t("sidebar.promptLibrary"), href: `${prefix}/prompt-library`, icon: BookOpen }] : []),
    ...(isOwner ? [{ label: t("sidebar.automations"), href: `${prefix}/automation-logs`, icon: ScrollText }] : []),
  ];

  const openFounderChat = () => {
    window.dispatchEvent(new CustomEvent("open-founder-chat"));
  };

  // Shared utility-tile style (Notifications · Theme · Language)
  const utilTileStyle: React.CSSProperties = {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7,
    padding: "14px 8px", borderRadius: "var(--r-card)", border: "none", background: "transparent",
    cursor: "pointer", position: "relative", transition: "transform 150ms",
  };
  const utilLabelStyle: React.CSSProperties = {
    fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--mute-2)", fontWeight: 600,
  };

  if (!open) return null;

  return (
    <div
      className="md:hidden"
      style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: "var(--bg)" }}
      data-testid="mobile-more-page"
    >
      {/* ── Topbar: title + Lead Awaker AI ── */}
      <div
        style={{
          flexShrink: 0,
          background: "var(--bg)",
          borderBottom: "1px solid var(--line)",
          padding: "12px 14px 12px 18px",
          paddingTop: "max(env(safe-area-inset-top, 0px), 14px)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span className="serif" style={{ flex: 1, minWidth: 0, fontSize: 30, color: "var(--ink)", letterSpacing: "-0.02em" }}>
          {t("sidebar.more")}
        </span>
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
          padding: "16px 14px",
          paddingBottom: "calc(var(--bottombar-h) + 24px)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Account switcher — agency users only */}
        {isAgencyUser && (
          <div className="neu-inset-crisp" style={{ borderRadius: "var(--r-card)" }}>
            <button
              onClick={() => setAcctSheetOpen(true)}
              className="row"
              style={{ gap: 12, padding: "13px 14px", border: "none", background: "transparent", width: "100%", textAlign: "left", cursor: "pointer" }}
              data-testid="mobile-more-account-switcher"
            >
              <span style={{ color: "var(--wine)", display: "flex" }}><Building2 size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)" }}>
                  {t("topbar.account", "Account")}
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {currentAccountId === 0 ? t("topbar.viewAsAgency", "Agency View") : (currentAccount?.name || t("topbar.account", "Account"))}
                </div>
              </div>
              <span style={{ color: "var(--mute-2)", display: "flex" }}><ChevronDown size={16} /></span>
            </button>
          </div>
        )}

        {/* Admin — plain label dividing the screen + one button per page */}
        {adminItems.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="eyebrow" style={{ padding: "2px 4px" }}>{t("sidebarSections.admin", "Admin")}</div>
            {adminItems.map((it) => (
              <NavButton key={it.href} icon={it.icon} label={it.label} href={it.href} testId={`mobile-more-link-${it.label.toLowerCase().replace(/\s+/g, "-")}`} />
            ))}
          </div>
        )}

        {/* Backend — plain label + one button per page */}
        {backendItems.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="eyebrow" style={{ padding: "2px 4px" }}>{t("sidebarSections.backend", "Backend")}</div>
            {backendItems.map((it) => (
              <NavButton key={it.href} icon={it.icon} label={it.label} href={it.href} testId={`mobile-more-link-${it.label.toLowerCase().replace(/\s+/g, "-")}`} />
            ))}
          </div>
        )}

        {/* Help — Documentation + Inbox (owner) or Assistance (others) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="eyebrow" style={{ padding: "2px 4px" }}>{t("sidebar.help", "Help")}</div>
          <NavButton icon={BookOpen} label={t("sidebar.documentation", "Documentation")} onClick={() => setLocation(`${prefix}/docs`)} testId="mobile-more-docs" />
          {isOwner ? (
            <NavButton icon={Inbox} label={t("sidebar.inbox", "Inbox")} onClick={() => setInboxSheetOpen(true)} testId="mobile-more-inbox" />
          ) : (
            <NavButton icon={MessageSquare} label={t("help.assistance", "Assistance")} onClick={openFounderChat} testId="mobile-more-assistance" />
          )}
        </div>

        {/* Utility row — Language · Theme · Notifications */}
        <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
          {/* Language — selected flag */}
          <Popover open={langOpen} onOpenChange={setLangOpen}>
            <PopoverTrigger asChild>
              <button className="neu-raised-crisp active:scale-95" style={utilTileStyle} data-testid="mobile-more-language">
                <span style={{ fontSize: 22, lineHeight: 1 }}>{currentLanguage.flag}</span>
                <span style={utilLabelStyle}>{t("sidebar.language", "Language")}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-48 p-1 rounded-2xl shadow-xl border-border bg-background">
              {NAV_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleChangeLanguage(lang.code)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm hover:bg-muted/50 transition-colors"
                  data-testid={`mobile-more-language-${lang.code}`}
                >
                  <span className="text-base leading-none">{lang.flag}</span>
                  <span className="flex-1 text-left">{lang.label}</span>
                  {lang.code === currentLang && <Check size={14} />}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Theme */}
          <button onClick={cycleTheme} className="neu-raised-crisp active:scale-95" style={utilTileStyle} data-testid="mobile-more-theme">
            <ThemeIcon size={22} style={{ color: "var(--wine)" }} />
            <span style={utilLabelStyle}>{t(THEME_CYCLE[themeIndex].labelKey)}</span>
          </button>

          {/* Notifications */}
          <button onClick={openNotifications} className="neu-raised-crisp active:scale-95" style={utilTileStyle} data-testid="mobile-more-notifications">
            <span style={{ position: "relative", display: "flex" }}>
              <Bell size={22} style={{ color: "var(--wine)" }} />
              {unreadCount > 0 && (
                <span style={{ position: "absolute", top: -4, right: -4, minWidth: 14, height: 14, padding: "0 3px", borderRadius: "var(--r-pill)", background: "var(--wine)", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </span>
            <span style={utilLabelStyle}>{t("topbar.notifications", "Alerts")}</span>
          </button>
        </div>

        {/* Bottom panel — Profile (above) + Logout, divider between */}
        <div className="neu-raised" style={{ padding: 6, borderRadius: "var(--r-card)" }}>
          <button
            onClick={() => setProfileSheetOpen(true)}
            className="row"
            style={{ gap: 12, padding: "10px 12px", border: "none", background: "transparent", width: "100%", textAlign: "left", cursor: "pointer" }}
            data-testid="mobile-more-profile"
          >
            <span
              className="la-profile-av"
              style={{ width: 42, height: 42, borderRadius: "var(--r-surface)", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {userAvatar
                ? <img src={userAvatar} alt={userName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "var(--r-surface)" }} />
                : userInitials}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{ fontSize: 15.5, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                data-testid="mobile-more-user-name"
              >
                {userName}
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)" }}>
                {userRole}
              </div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--mute)", whiteSpace: "nowrap" }}>
              {t("sidebar.editProfile", "Edit profile")}
            </span>
            <span style={{ color: "var(--mute-2)", display: "flex" }}><ChevronRight size={15} /></span>
          </button>

          <div style={{ margin: "2px 12px", borderTop: "1px solid var(--line)" }} />

          <button
            onClick={onLogout}
            className="row"
            style={{ gap: 14, padding: "14px 14px", border: "none", background: "transparent", width: "100%", textAlign: "left", cursor: "pointer", color: "#A24B3F" }}
            data-testid="mobile-more-logout"
          >
            <span style={{ display: "flex" }}><LogOut size={18} /></span>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{t("sidebar.logout") || "Log out"}</span>
          </button>
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
                  style={{ gap: 12, alignItems: "center", padding: "13px 2px", border: "none", borderBottom: "1px solid var(--line)", background: "transparent", width: "100%", textAlign: "left", cursor: "pointer" }}
                  data-testid={`mobile-account-option-${acc.id}`}
                >
                  <span style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--wine-tint)", color: "var(--wine)", fontWeight: 700, fontSize: 12, fontFamily: "var(--mono)" }}>
                    {acc.id === 0 ? <Building2 size={15} /> : (acc.name?.[0] || "?").toUpperCase()}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: active ? 700 : 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.name}</span>
                  {active && <Check size={16} style={{ color: "var(--wine)", flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        </MobileSheet>
      )}

      {/* ── Profile / notifications editing sheet ── */}
      {/* ── Inbox sheet (owner only) ── */}
      {isOwner && (
        <MobileSheet open={inboxSheetOpen} onClose={() => setInboxSheetOpen(false)} data-testid="mobile-inbox-sheet">
          <FounderInbox />
        </MobileSheet>
      )}

      <MobileSheet open={profileSheetOpen} onClose={() => setProfileSheetOpen(false)} data-testid="mobile-profile-sheet">
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 18px 12px", borderBottom: "1px solid var(--line)" }}>
          <span className="serif" style={{ fontSize: 24, color: "var(--ink)", letterSpacing: "-0.02em" }}>{t("sidebar.settings")}</span>
          <button
            onClick={() => setProfileSheetOpen(false)}
            aria-label={t("common.close", "Close")}
            style={{ width: 36, height: 36, borderRadius: "var(--r-pill)", border: "none", cursor: "pointer", background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", color: "var(--mute)", display: "flex", alignItems: "center", justifyContent: "center" }}
            data-testid="mobile-profile-sheet-close"
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 16px calc(24px + var(--safe-bottom))", display: "flex", flexDirection: "column", gap: 16 }}>
          <ProfileSection />
          <NotificationsSection />
        </div>
      </MobileSheet>
    </div>
  );
}
