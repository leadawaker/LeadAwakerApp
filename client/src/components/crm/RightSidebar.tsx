import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import {
  HelpCircle,
  MessageSquare,
  Megaphone,
  Calendar,
  CalendarDays,
  ScrollText,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  BookUser,
  Users,
  Check,
  Menu,
  Building2,
  UserSearch,
  PhoneCall,
  ClipboardList,
  MoreHorizontal,
  LogOut,
  Receipt,
  CreditCard,
  FileCheck,
  Settings,

  Bell,
  Bot,
  Moon,
  Sun,
  SunMoon,
  ArrowLeft,
  Globe,
} from "lucide-react";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { MobileMorePage } from "@/components/crm/mobile/MobileMorePage";

const NAV_LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
] as const;

const THEME_CYCLE: { mode: ThemeMode; icon: typeof Sun; labelKey: string }[] = [
  { mode: "light", icon: Sun,     labelKey: "sidebar.themeLight" },
  { mode: "dark",  icon: Moon,    labelKey: "sidebar.themeDark"  },
  { mode: "system", icon: SunMoon, labelKey: "sidebar.themeSystem" },
];

import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationCenter } from "@/components/crm/NotificationCenter";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
/**
 * Trigger a short haptic feedback vibration (10ms) on mobile devices only.
 * Uses the Web Vibration API (navigator.vibrate). Gracefully degrades on
 * devices/browsers that don't support vibration. Never fires on desktop (768px+).
 */
function triggerHaptic() {
  if (typeof window !== "undefined" && window.innerWidth < 768 && navigator.vibrate) {
    navigator.vibrate(10);
  }
}

export function RightSidebar({
  collapsed,
  onCollapse,
  onOpenAi,
  onOpenNotifications,
  onToggleHelp,
  onOpenSettings,
  notificationsCount,
  isMobileMenuOpen = false,
  onCloseMobileMenu,
  onToggleMobileMenu,
  onLogout,
  unreadChatCount,
  isDark = false,
  onToggleTheme,
}: {
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
  onOpenAi?: () => void;
  onOpenNotifications: () => void;
  onToggleHelp: () => void;
  onOpenSettings?: () => void;
  notificationsCount?: number;
  isMobileMenuOpen?: boolean;
  onCloseMobileMenu?: () => void;
  onToggleMobileMenu?: () => void;
  onLogout?: () => void;
  unreadChatCount?: number;
  isDark?: boolean;
  onToggleTheme?: () => void;
}) {
  const { t, i18n } = useTranslation("crm");
  const [location, setLocation] = useLocation();


  const {
    currentAccount,
    currentAccountId,
    setCurrentAccountId,
    isAgencyView,
    accounts,
    isAgencyUser,
    isOwner,
  } = useWorkspace();

  // Booked calls this month (badge on Calendar icon)
  // Matches Calendar.tsx logic: only count leads with status "Booked" AND a real booking date
  const { data: bookedThisMonth = 0 } = useQuery<number>({
    queryKey: ["/api/leads", "booked-badge", currentAccountId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentAccountId > 0) params.set("accountId", String(currentAccountId));
      const qs = params.toString();
      const res = await apiFetch(`/api/leads${qs ? `?${qs}` : ""}`);
      if (!res.ok) return 0;
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.list || data?.data || [];
      const now = new Date();
      return list.filter((l: any) => {
        const status = l.conversion_status || l.Conversion_Status || "";
        if (status !== "Booked") return false;
        const dateStr = l.booked_call_date || l.booking_confirmed_at || l.bookingConfirmedAt;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return !isNaN(d.getTime()) && d >= now;
      }).length;
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  // Notification unread count for the bell badge
  const { data: notifCountData } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/notifications/count"],
    queryFn: async () => {
      const res = await apiFetch("/api/notifications/count");
      if (!res.ok) return { unreadCount: 0 };
      return res.json();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const unreadNotifCount = notifCountData?.unreadCount ?? 0;

  const { themeMode, setThemeMode } = useTheme();
  const themeIndex = Math.max(0, THEME_CYCLE.findIndex((o) => o.mode === themeMode));
  const activeTheme = THEME_CYCLE[themeIndex];
  const cycleTheme = () => setThemeMode(THEME_CYCLE[(themeIndex + 1) % THEME_CYCLE.length].mode);

  const currentLang = i18n.language?.split("-")[0] || "en";
  const currentLanguage = NAV_LANGUAGES.find((l) => l.code === currentLang) ?? NAV_LANGUAGES[0];
  const handleChangeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("leadawaker_lang", lang);
    setLangOpen(false);
    setProfileOpen(false);
  };

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  // Read current user info from localStorage
  const userName = localStorage.getItem("leadawaker_user_name") || localStorage.getItem("leadawaker_user_email") || "User";
  const userEmail = localStorage.getItem("leadawaker_user_email") || "";
  const [userAvatar, setUserAvatar] = useState<string>(() => localStorage.getItem("leadawaker_user_avatar") || "");
  const userRole = localStorage.getItem("leadawaker_user_role") || "Viewer";
  useEffect(() => {
    const handler = () => setUserAvatar(localStorage.getItem("leadawaker_user_avatar") || "");
    window.addEventListener("leadawaker-avatar-changed", handler);
    return () => window.removeEventListener("leadawaker-avatar-changed", handler);
  }, []);
  const userInitials = userName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  const formatDisplayName = (fullName: string): string => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "User";
    if (parts.length === 1) return parts[0];
    const firstName = parts[0];
    const initials = parts.slice(1).map(p => p[0].toUpperCase() + ".").join(" ");
    return `${firstName} ${initials}`;
  };
  const displayName = formatDisplayName(userName);

  /** Switch the scoped account. The URL no longer changes — only data scope. */
  const handleAccountSelect = (id: number) => {
    setCurrentAccountId(id);
  };

  useEffect(() => {
    onCloseMobileMenu?.();
  }, [location]);

  const prefix = "/platform";

  const navItems: {
    href: string;
    label: string;
    labelKey: string;
    icon: any;
    testId: string;
    adminOnly?: boolean;
    agencyOnly?: boolean;
    agencyViewOnly?: boolean;
    ownerOnly?: boolean;
  }[] = [
    { href: `${prefix}/campaigns`, label: t("sidebar.campaigns"), labelKey: "Campaigns", icon: Megaphone, testId: "nav-campaigns" },
    { href: `${prefix}/contacts`, label: t("sidebar.leads"), labelKey: "Leads", icon: BookUser, testId: "nav-contacts" },
    { href: `${prefix}/calendar`, label: t("sidebar.calendar"), labelKey: "Calendar", icon: Calendar, testId: "nav-calendar" },
    {
      href: `${prefix}/tasks`,
      label: t("sidebar.tasks"),
      labelKey: "Tasks",
      icon: ClipboardList,
      testId: "nav-tasks",
      agencyOnly: true,
    },
    {
      href: `${prefix}/accounts`,
      label: t("sidebar.accounts"),
      labelKey: "Accounts",
      icon: Building2,
      testId: "nav-accounts",
      agencyOnly: true,
      agencyViewOnly: true,
    },
    {
      href: `${prefix}/prompt-library`,
      label: t("sidebar.promptLibrary"),
      labelKey: "Prompt Library",
      icon: BookOpen,
      testId: "nav-library",
      agencyOnly: true,
    },
    { href: `${prefix}/billing`, label: t("sidebar.billing"), labelKey: "Billing", icon: Receipt, testId: "nav-billing", agencyOnly: true },
    { href: `${prefix}/outreach-inbox`, label: t("sidebar.inbox"), labelKey: "Inbox", icon: MessageSquare, testId: "nav-outreach-inbox", ownerOnly: true },
    { href: `${prefix}/prospects`, label: t("sidebar.prospects"), labelKey: "Prospects", icon: UserSearch, testId: "nav-prospects", ownerOnly: true },
    { href: `${prefix}/cadence`, label: t("sidebar.cadence"), labelKey: "Cadence", icon: PhoneCall, testId: "nav-cadence", ownerOnly: true },
    {
      href: `${prefix}/automation-logs`,
      label: t("sidebar.automations"),
      labelKey: "Automations",
      icon: ScrollText,
      testId: "nav-automations",
      ownerOnly: true,
    },
  ];

  // Filter nav items based on user role and current view context
  const visibleNavItems = navItems.filter((it) => {
    if (it.ownerOnly && !isOwner) return false;
    if (it.adminOnly && !isAgencyUser) return false;
    if (it.agencyOnly && !isAgencyUser) return false;
    if (it.agencyViewOnly && !isAgencyView) return false;
    return true;
  });

  /** Check if a nav item is active (exact match or sub-route match) */
  const isActive = (href: string) => {
    if (location === href) return true;
    // For sub-routes like /platform/contacts/123, highlight the parent nav item
    // But don't let /platform/campaigns match sub-routes (campaigns has no sub-routes)
    if (href !== `${prefix}/campaigns` && location.startsWith(href + '/')) return true;
    return false;
  };

  /** Render a single desktop nav link with Radix Tooltip support */
  const renderDesktopNavLink = (it: typeof navItems[0]) => {
    const active = isActive(it.href);
    const Icon = it.icon;
    const showUnreadCount = it.testId === "nav-chats" && !!unreadChatCount && unreadChatCount > 0;
    const isCalendar = it.testId === "nav-calendar" && bookedThisMonth > 0;
    const showBookedBadge = isCalendar && active;
    const showBookedOnHover = isCalendar && !active;

    return (
      <Tooltip key={it.href}>
        <TooltipTrigger asChild>
          <Link
            href={it.href}
            className={cn(
              "group/nav relative flex items-center rounded-full transition-colors mb-0.5",
              collapsed
                ? "h-[44px] w-[44px] justify-center mx-auto"
                : "h-[44px] pl-[1.5px] pr-2 gap-2.5",
              active
                ? "bg-sidebar-active text-sidebar-active-foreground font-semibold"
                : "text-foreground/70 hover:bg-card hover:text-foreground"
            )}
            data-testid={`link-${it.testId}`}
            data-onboarding={it.testId}
            data-active={active || undefined}
          >
            <div className={cn("relative h-10 w-10 rounded-full flex items-center justify-center shrink-0", active ? "border border-white/25" : "")}>
              <Icon className="h-4 w-4" />
              {showUnreadCount && (
                <span className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 rounded-full bg-brand-indigo text-white text-[10px] font-bold flex items-center justify-center border border-background">
                  {unreadChatCount! > 9 ? "9+" : unreadChatCount}
                </span>
              )}
              {showBookedBadge && (
                <span className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 rounded-full bg-[#DA9426] text-[#1F1A14] text-[10px] font-bold flex items-center justify-center border border-background">
                  {bookedThisMonth > 9 ? "9+" : bookedThisMonth}
                </span>
              )}
              {showBookedOnHover && (
                <span className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 rounded-full bg-[#DA9426] text-[#1F1A14] text-[10px] font-bold flex items-center justify-center border border-background opacity-0 group-hover/nav:opacity-100 transition-opacity">
                  {bookedThisMonth > 9 ? "9+" : bookedThisMonth}
                </span>
              )}
            </div>
            {!collapsed && (
              <span className="text-sm font-bold">{it.label}</span>
            )}

          </Link>
        </TooltipTrigger>
        {collapsed && (
          <TooltipContent
            side="right"
            className={cn(
              "rounded-lg px-3 h-10 flex items-center text-sm font-semibold shadow-md border-0 ml-1",
              isActive(it.href)
                ? "bg-sidebar-active text-sidebar-active-foreground"
                : "bg-card text-foreground"
            )}
          >
            {it.label}
          </TooltipContent>
        )}
      </Tooltip>
    );
  };

  return (
    <>
      {/* MOBILE "MORE" FULL-SCREEN PAGE — replaces the old slide-in drawer */}
      <div className="md:hidden fixed inset-0 z-[80]" style={{ display: isMobileMenuOpen ? "block" : "none" }} data-testid="mobile-more-overlay">
        <MobileMorePage
          open={isMobileMenuOpen}
          onOpenAi={() => { onOpenAi?.(); onCloseMobileMenu?.(); }}
          onToggleHelp={() => { onToggleHelp(); onCloseMobileMenu?.(); }}
          onLogout={() => { onLogout?.(); onCloseMobileMenu?.(); }}
        />
      </div>

      {/* MOBILE BOTTOM BAR — wine/paper neumorphic, 5 tabs: Campaigns, Leads, Calendar, Tasks, More */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-[100] grid grid-cols-5 items-stretch"
        style={{
          height: "var(--bottombar-h)",
          paddingTop: 7,
          paddingBottom: "calc(var(--safe-bottom) + 9px)",
          background: "var(--bg-2)",
          borderTop: "1px solid var(--line)",
        }}
        data-testid="mobile-bottom-bar"
      >
        {([
          { key: "campaigns", href: `${prefix}/campaigns`, icon: Megaphone, label: t("sidebar.campaigns"), testId: "mobile-nav-campaigns" },
          { key: "contacts", href: `${prefix}/contacts`, icon: Users, label: t("sidebar.leads"), testId: "mobile-nav-contacts" },
          { key: "calendar", href: `${prefix}/calendar`, icon: CalendarDays, label: t("sidebar.calendar"), testId: "mobile-nav-calendar" },
          // Agency users get Tasks; client users get their Accounts page instead.
          isAgencyUser
            ? { key: "tasks", href: `${prefix}/tasks`, icon: ClipboardList, label: t("sidebar.tasks"), testId: "mobile-nav-tasks" }
            : { key: "accounts", href: `${prefix}/accounts`, icon: Building2, label: t("sidebar.accounts"), testId: "mobile-nav-accounts" },
        ]).map((tab) => {
          // Don't double-highlight a tab when the More drawer is open over it.
          const active = isActive(tab.href) && !isMobileMenuOpen;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => { triggerHaptic(); setLocation(tab.href); }}
              className="flex flex-col items-center justify-center gap-[5px] mx-[5px] h-full"
              style={{
                borderRadius: "var(--r-card)",
                color: active ? "var(--wine)" : "var(--mute)",
                background: active ? "var(--card)" : "transparent",
                boxShadow: active ? "var(--sh-raised-crisp)" : "none",
                transition: "background-color 160ms, color 160ms, box-shadow 160ms",
              }}
              data-testid={tab.testId}
              data-active={active || undefined}
            >
              <Icon className="h-6 w-6" />
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: active ? "var(--wine)" : "var(--mute-2)",
                  fontWeight: active ? 700 : 400,
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* More — opens the slide-in drawer (Settings + secondary nav live inside) */}
        <button
          onClick={() => { triggerHaptic(); onToggleMobileMenu?.(); }}
          className="flex flex-col items-center justify-center gap-[5px] mx-[5px] h-full"
          style={{
            borderRadius: "var(--r-card)",
            color: isMobileMenuOpen ? "var(--wine)" : "var(--mute)",
            background: isMobileMenuOpen ? "var(--card)" : "transparent",
            boxShadow: isMobileMenuOpen ? "var(--sh-raised-crisp)" : "none",
            transition: "background-color 160ms, color 160ms, box-shadow 160ms",
          }}
          data-testid="mobile-nav-more"
          data-active={isMobileMenuOpen || undefined}
        >
          <MoreHorizontal className="h-6 w-6" />
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: isMobileMenuOpen ? "var(--wine)" : "var(--mute-2)",
              fontWeight: isMobileMenuOpen ? 700 : 400,
              whiteSpace: "nowrap",
            }}
          >
            {t("sidebar.more")}
          </span>
        </button>
      </div>

      {/* DESKTOP SIDEBAR — Neumorphic design system */}
      <aside
        className="hidden md:flex flex-col fixed left-0 bottom-0"
        style={{
          width: 188,
          top: "var(--banner-h, 0px)",
          background: "var(--chrome)",
          borderRight: "1px solid var(--line)",
          height: "100%",
          flexShrink: 0,
          boxShadow: "none",
          zIndex: 46,
        }}
        data-sidebar-focus
      >
        {/* ── Top: Logo row (60px to align with page toolbar divider) ── */}
        <a href="/" style={{
          height: 60, flexShrink: 0, padding: "0 12px",
          display: "flex", alignItems: "center",
          borderBottom: "1px solid var(--line)",
          cursor: "pointer",
        }}>
          <img src={isDark ? "/premium/logo-v2-dark.svg" : "/premium/logo-v2.svg"} alt="Lead Awaker" style={{ height: 34, marginTop: 4 }} />
        </a>

        {/* ── Nav (scrolls) ── */}
        <div style={{
          flex: 1, overflowY: "auto",
          padding: "14px 12px",
          display: "flex", flexDirection: "column", gap: 3,
        }}>
          {/* Account Switcher — agency users only */}
          {isAgencyUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="la-switcher" style={{ marginBottom: 12 }}>
                  <span>{currentAccountId === 0 ? "Agency View" : (currentAccount?.name || "Account")}</span>
                  <span style={{ display: "flex", transform: "rotate(90deg)", color: "var(--muted-foreground)" }}>
                    <ChevronRight size={12} />
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-56 rounded-2xl shadow-xl border-border bg-background">
                <div className="px-3 pt-2 pb-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Agency</div>
                <DropdownMenuItem onClick={() => handleAccountSelect(0)}
                  className={cn("flex items-center gap-2 cursor-pointer py-2.5 rounded-xl mx-1", currentAccountId === 0 && "bg-muted font-bold")}>
                  <div className="h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 bg-brand-yellow text-brand-yellow-foreground">
                    <img src="/premium/favicon.svg" alt="" className="h-4 w-4" />
                  </div>
                  <span className="text-sm truncate flex-1">{t("topbar.viewAsAgency")}</span>
                  {currentAccountId === 0 && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="mx-2" />
                <div className="px-3 pt-2 pb-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("topbar.switchAccount")}</div>
                {[...accounts].sort((a, b) => a.id === 1 ? -1 : b.id === 1 ? 1 : 0).map((acc) => (
                  <DropdownMenuItem key={acc.id} onClick={() => handleAccountSelect(acc.id)}
                    className={cn("flex items-center gap-2 cursor-pointer py-2.5 rounded-xl mx-1", currentAccountId === acc.id && "bg-muted font-bold")}>
                    <div className={cn("h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0", acc.id === 1 ? "bg-brand-yellow text-brand-yellow-foreground" : "bg-brand-indigo text-brand-indigo-foreground")}>
                      {acc.name?.[0] || "?"}
                    </div>
                    <span className="text-sm truncate flex-1">{acc.name}</span>
                    {currentAccountId === acc.id && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Nav section groups */}
          {(() => {
            const sections = [
              { section: "Engage", items: visibleNavItems.filter(it => ["Campaigns", "Leads", "Calendar"].includes(it.labelKey)) },
              { section: "Admin", items: visibleNavItems.filter(it => ["Accounts", "Billing", "Tasks"].includes(it.labelKey)) },
              { section: "Backend", items: visibleNavItems.filter(it => ["Prompt Library", "Automations"].includes(it.labelKey)) },
              { section: "Outreach", items: visibleNavItems.filter(it => ["Inbox", "Prospects", "Cadence"].includes(it.labelKey)) },
            ];
            return sections.map((g) => {
              if (g.items.length === 0) return null;
              return (
                <div key={g.section}>
                  <div className="la-nav-section">{g.section}</div>
                  {g.items.map((it) => {
                    const active = isActive(it.href);
                    const Icon = it.icon;
                    const showUnreadCount = it.testId === "nav-chats" && !!unreadChatCount && unreadChatCount > 0;
                    return (
                      <Link key={it.href} href={it.href}
                        className={`la-nav-item ${active ? "active" : ""}`}
                        data-testid={`link-${it.testId}`}
                        data-onboarding={it.testId}
                        data-active={active || undefined}
                      >
                        <span className="icon" style={{ position: "relative" }}>
                          <Icon size={16} />
                          {showUnreadCount && (
                            <span style={{
                              position: "absolute", top: -6, right: -6,
                              minWidth: 16, height: 16, padding: "0 4px",
                              borderRadius: "var(--r-pill)",
                              background: "var(--wine-grad)",
                              color: "#FFFFFF", fontSize: 10, fontWeight: 700,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              border: "1px solid var(--bg-2)",
                            }}>
                              {unreadChatCount! > 9 ? "9+" : unreadChatCount}
                            </span>
                          )}
                        </span>
                        {it.label}
                      </Link>
                    );
                  })}
                </div>
              );
            });
          })()}
        </div>

        {/* ── Bottom: utilities + profile ── */}
        <div style={{
          padding: "12px 12px 14px",
          borderTop: "1px solid var(--line)",
        }}>
          {/* Notifications button — full-width pill with bell + label + badge */}
          <Popover open={notifOpen} onOpenChange={setNotifOpen}>
            <PopoverTrigger asChild>
              <button
                className="la-notif-btn"
                title={t("notifications.title")}
                data-testid="nav-notifications"
              >
                <Bell size={14} />
                <span style={{ flex: 1, textAlign: "left", fontSize: 12, fontWeight: 600 }}>
                  {t("notifications.title")}
                </span>
                {unreadNotifCount > 0 && (
                  <span style={{
                    minWidth: 18, height: 18, padding: "0 5px",
                    borderRadius: "var(--r-pill)",
                    background: "var(--wine-grad)",
                    color: "#fff", fontSize: 10, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="end" sideOffset={8}
              className="w-[380px] p-0 rounded-2xl shadow-xl border-border overflow-hidden"
              style={{ background: isDark ? "rgba(10, 8, 6, 0.88)" : "rgba(255, 250, 240, 0.65)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)" }}>
              <NotificationCenter open={notifOpen} onClose={() => setNotifOpen(false)} />
            </PopoverContent>
          </Popover>

          {/* Profile card */}
          <div style={{ position: "relative", marginTop: 8 }}>
            {profileOpen && (
              <div className="la-profile-menu">
                <button className="la-profile-menu-item" onClick={() => { setProfileOpen(false); setLocation(`${prefix}/settings`); }}>
                  <Settings size={14} />{t("sidebar.settings")}
                </button>
                {isOwner && (
                  <button className="la-profile-menu-item" onClick={() => { setProfileOpen(false); onOpenAi?.(); }}
                    data-testid="nav-ai">
                    <Bot size={14} />Lead Awaker AI
                  </button>
                )}
                <button className="la-profile-menu-item" onClick={cycleTheme} data-testid="nav-theme-cycle">
                  <activeTheme.icon size={14} />
                  {t(activeTheme.labelKey)}
                </button>
                <button className="la-profile-menu-item" onClick={onToggleHelp}>
                  <HelpCircle size={14} />Help &amp; docs
                </button>
                <Popover open={langOpen} onOpenChange={setLangOpen}>
                  <PopoverTrigger asChild>
                    <button className="la-profile-menu-item">
                      <Globe size={14} />
                      <span style={{ flex: 1, textAlign: "left" }}>{t("sidebar.language") || "Language"}</span>
                      <span style={{ fontSize: 13 }}>{currentLanguage.flag}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="right" align="start" sideOffset={4} className="w-48 p-1 rounded-2xl shadow-xl border-border bg-background">
                    {NAV_LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleChangeLanguage(lang.code)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm hover:bg-muted/50 transition-colors"
                        data-testid={`nav-language-${lang.code}`}
                      >
                        <span className="text-base leading-none">{lang.flag}</span>
                        <span className="flex-1 text-left">{lang.label}</span>
                        {lang.code === currentLang && <Check size={14} />}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
                <div className="rule" style={{ margin: "6px 8px" }} />
                <button className="la-profile-menu-item" onClick={() => { setProfileOpen(false); onLogout?.(); }}
                  style={{ color: "#A24B3F" }}>
                  <LogOut size={14} />{t("sidebar.logout") || "Log out"}
                </button>
              </div>
            )}
            <button className={`la-profile ${profileOpen ? "open" : ""}`} onClick={() => setProfileOpen(o => !o)} data-testid="nav-profile">
              <span className="la-profile-av">
                {userAvatar
                  ? <img src={userAvatar} alt={userName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 9 }} />
                  : userInitials
                }
              </span>
              <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</span>
                <span style={{ display: "block", fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>{userRole}</span>
              </span>
              <span style={{ display: "flex", transform: profileOpen ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform 160ms", color: "var(--muted-foreground)" }}>
                <ChevronRight size={12} />
              </span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
