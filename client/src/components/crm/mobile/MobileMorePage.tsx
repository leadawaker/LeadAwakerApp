import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import {
  Building2,
  Receipt,
  BookOpen,
  ScrollText,
  HelpCircle,
  Globe,
  LogOut,
  ChevronRight,
  Check,
  Bell,
  Bot,
  Sun,
  Moon,
  SunMoon,
  X,
  type LucideIcon,
} from "lucide-react";
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
  { mode: "system", icon: SunMoon, labelKey: "sidebar.themeSystem" },
];

/** Card shell matching the design file's MobCard (neu-raised, var(--r-card)). */
function MobCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="neu-raised" style={{ padding: 6, borderRadius: "var(--r-card)" }}>
      {children}
    </div>
  );
}

/**
 * MobileMorePage — full-screen "More" tab (ported from Design files/mobile-app.jsx MobMore).
 * Replaces the old slide-in left drawer: this is a whole-screen page, not an overlay.
 */
export function MobileMorePage({
  open,
  onOpenAi,
  onToggleHelp,
  onLogout,
}: {
  open: boolean;
  onOpenAi?: () => void;
  onToggleHelp: () => void;
  onLogout?: () => void;
}) {
  const { t, i18n } = useTranslation("crm");
  const { isAgencyUser, isAgencyView, isOwner, currentAccountId, setCurrentAccountId, currentAccount, accounts } = useWorkspace();
  const { themeMode, setThemeMode } = useTheme();
  const { openNotifications, unreadCount } = useMobileChrome();
  const [langOpen, setLangOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [acctSheetOpen, setAcctSheetOpen] = useState(false);

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
  const cycleTheme = () => setThemeMode(THEME_CYCLE[(themeIndex + 1) % THEME_CYCLE.length].mode);

  type Item = { label: string; href: string; icon: LucideIcon };
  const groups: { section: string; items: Item[] }[] = [
    {
      section: t("sidebarSections.admin", "Admin"),
      items: [
        ...(isAgencyUser && isAgencyView ? [{ label: t("sidebar.accounts"), href: `${prefix}/accounts`, icon: Building2 }] : []),
        ...(isAgencyUser ? [{ label: t("sidebar.billing"), href: `${prefix}/billing`, icon: Receipt }] : []),
      ],
    },
    {
      section: t("sidebarSections.backend", "Backend"),
      items: [
        ...(isAgencyUser ? [{ label: t("sidebar.promptLibrary"), href: `${prefix}/prompt-library`, icon: BookOpen }] : []),
        ...(isOwner ? [{ label: t("sidebar.automations"), href: `${prefix}/automation-logs`, icon: ScrollText }] : []),
      ],
    },
  ].filter((g) => g.items.length > 0);

  if (!open) return null;

  return (
    <div className="md:hidden" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: "var(--bg)" }} data-testid="mobile-more-page">
      <div style={{ flexShrink: 0, background: "var(--bg)", borderBottom: "1px solid var(--line)", padding: "16px 18px 14px", paddingTop: "max(env(safe-area-inset-top, 0px), 16px)" }}>
        <span className="serif" style={{ fontSize: 32, color: "var(--ink)", letterSpacing: "-0.02em" }}>{t("sidebar.more")}</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Profile card — taps open the profile/notifications sheet */}
        <MobCard>
          <button
            onClick={() => setProfileSheetOpen(true)}
            className="row"
            style={{ gap: 12, padding: "10px 12px", border: "none", background: "transparent", width: "100%", textAlign: "left", cursor: "pointer" }}
            data-testid="mobile-more-profile"
          >
            <span className="la-profile-av" style={{ width: 42, height: 42, borderRadius: "var(--r-surface)", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {userAvatar ? <img src={userAvatar} alt={userName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "var(--r-surface)" }} /> : userInitials}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} data-testid="mobile-more-user-name">{userName}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)" }}>{userRole}</div>
            </div>
            <span style={{ color: "var(--mute-2)", display: "flex" }}><ChevronRight size={15} /></span>
          </button>
        </MobCard>

        {/* Account switcher — agency users only */}
        {isAgencyUser && (
          <MobCard>
            <button
              onClick={() => setAcctSheetOpen(true)}
              className="row"
              style={{ gap: 12, padding: "12px 14px", border: "none", background: "transparent", width: "100%", textAlign: "left", cursor: "pointer" }}
              data-testid="mobile-more-account-switcher"
            >
              <span style={{ color: "var(--wine)", display: "flex" }}><Building2 size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)" }}>{t("topbar.account", "Account")}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {currentAccountId === 0 ? t("topbar.viewAsAgency", "Agency View") : (currentAccount?.name || t("topbar.account", "Account"))}
                </div>
              </div>
              <span style={{ color: "var(--mute-2)", display: "flex" }}><ChevronRight size={15} /></span>
            </button>
          </MobCard>
        )}

        {/* Nav groups */}
        {groups.map((g) => (
          <MobCard key={g.section}>
            <div className="eyebrow eyebrow-sm" style={{ padding: "12px 14px 6px" }}>{g.section}</div>
            {g.items.map((it, i) => {
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className="row"
                  style={{ gap: 14, padding: "13px 14px", borderTop: i ? "1px solid var(--line)" : "none", textDecoration: "none" }}
                  data-testid={`mobile-more-link-${it.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <span style={{ color: "var(--wine)", display: "flex" }}><Icon size={18} /></span>
                  <span style={{ flex: 1, fontSize: 14, color: "var(--ink)" }}>{it.label}</span>
                  <span style={{ color: "var(--mute-2)", display: "flex" }}><ChevronRight size={15} /></span>
                </Link>
              );
            })}
          </MobCard>
        ))}

        {/* AI (account owner only) */}
        {isOwner && (
          <MobCard>
            <button onClick={onOpenAi} className="row" style={{ gap: 14, padding: "13px 14px", border: "none", background: "transparent", width: "100%", textAlign: "left", cursor: "pointer" }} data-testid="mobile-more-ai">
              <span style={{ color: "var(--wine)", display: "flex" }}><Bot size={18} /></span>
              <span style={{ flex: 1, fontSize: 14, color: "var(--ink)" }}>Lead Awaker AI</span>
              <span style={{ color: "var(--mute-2)", display: "flex" }}><ChevronRight size={15} /></span>
            </button>
          </MobCard>
        )}

        {/* Utilities */}
        <MobCard>
          <button onClick={openNotifications} className="row" style={{ gap: 14, padding: "13px 14px", border: "none", background: "transparent", width: "100%", textAlign: "left", cursor: "pointer" }} data-testid="mobile-more-notifications">
            <span style={{ color: "var(--mute)", display: "flex" }}><Bell size={18} /></span>
            <span style={{ flex: 1, fontSize: 14, color: "var(--ink)" }}>{t("topbar.notifications") || "Notifications"}</span>
            {unreadCount > 0 && (
              <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: "var(--r-pill)", background: "var(--wine)", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <button onClick={cycleTheme} className="row" style={{ gap: 14, padding: "13px 14px", borderTop: "1px solid var(--line)", border: "none", background: "transparent", width: "100%", textAlign: "left", cursor: "pointer" }} data-testid="mobile-more-theme">
            <span style={{ color: "var(--mute)", display: "flex" }}>{(() => { const Icon = THEME_CYCLE[themeIndex].icon; return <Icon size={18} />; })()}</span>
            <span style={{ flex: 1, fontSize: 14, color: "var(--ink)" }}>{t(THEME_CYCLE[themeIndex].labelKey)}</span>
          </button>
          <Popover open={langOpen} onOpenChange={setLangOpen}>
            <PopoverTrigger asChild>
              <button className="row" style={{ gap: 14, padding: "13px 14px", borderTop: "1px solid var(--line)", border: "none", borderTopColor: "var(--line)", background: "transparent", width: "100%", textAlign: "left", cursor: "pointer" }} data-testid="mobile-more-language">
                <span style={{ color: "var(--mute)", display: "flex" }}><Globe size={18} /></span>
                <span style={{ flex: 1, fontSize: 14, color: "var(--ink)" }}>{t("sidebar.language") || "Language"}</span>
                <span style={{ fontSize: 14 }}>{currentLanguage.flag}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" className="w-48 p-1 rounded-2xl shadow-xl border-border bg-background">
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
          <button onClick={onToggleHelp} className="row" style={{ gap: 14, padding: "13px 14px", borderTop: "1px solid var(--line)", border: "none", background: "transparent", width: "100%", textAlign: "left", cursor: "pointer" }} data-testid="mobile-more-help">
            <span style={{ color: "var(--mute)", display: "flex" }}><HelpCircle size={18} /></span>
            <span style={{ flex: 1, fontSize: 14, color: "var(--ink)" }}>{t("sidebar.help")}</span>
          </button>
        </MobCard>

        {/* Logout */}
        <MobCard>
          <button onClick={onLogout} className="row" style={{ gap: 14, padding: "13px 14px", border: "none", background: "transparent", width: "100%", textAlign: "left", cursor: "pointer", color: "#A24B3F" }} data-testid="mobile-more-logout">
            <span style={{ display: "flex" }}><LogOut size={18} /></span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{t("sidebar.logout") || "Log out"}</span>
          </button>
        </MobCard>
      </div>

      {/* Account switcher sheet — agency users pick the scoped account */}
      {isAgencyUser && (
        <MobileSheet open={acctSheetOpen} onClose={() => setAcctSheetOpen(false)} data-testid="mobile-account-sheet">
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

      {/* Profile / notifications editing sheet (replaces the mobile Settings page) */}
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
