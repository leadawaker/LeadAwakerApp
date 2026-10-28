import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import {
  HelpCircle,
  Inbox,
  MessageSquare,
  Calendar,
  ScrollText,
  ChartNoAxesColumn,
  MonitorPlay,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  BookUser,
  Users,
  Check,
  Menu,
  Building2,
  UserSearch,
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
  Mic,
  Star,
  AudioLines,
} from "lucide-react";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { MobileMorePage } from "@/components/crm/mobile/MobileMorePage";
import { useVoiceRecorderState, toggleVoiceRecording, MAX_RECORDING_SECONDS } from "@/lib/voiceRecorder";
import { useToast } from "@/hooks/use-toast";
import { isNavItemVisible, useNavGateContext, type NavGate } from "@/components/crm/navVisibility";
import { agencyBottomBar, clientNavItems, clientBottomBar, clientNavLabelKey, CLIENT_NAV_HREF, type AgencyBarKey } from "@/components/crm/navGates";
import { NAV_ICON } from "@/components/crm/navIcons";
import { useClientNavFacts } from "@/components/crm/useClientNavFacts";
import { APP_LANGUAGES } from "@/lib/languages";
import type { ServicePageKey } from "@/hooks/useServicePageToggles";

const THEME_CYCLE: { mode: ThemeMode; icon: typeof Sun; labelKey: string }[] = [
  { mode: "light", icon: Sun,     labelKey: "sidebar.themeLight" },
  { mode: "dark",  icon: Moon,    labelKey: "sidebar.themeDark"  },
  { mode: "system", icon: SunMoon, labelKey: "sidebar.themeSystem" },
];

import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCurrentUserIdentity } from "@/hooks/useCurrentUserIdentity";
import { displayName, initialsFor, shortName } from "@/lib/userIdentity";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationCenter } from "@/components/crm/NotificationCenter";
/**
 * Trigger a short haptic feedback vibration (10ms) on mobile devices only.
 * Uses the Web Vibration API (navigator.vibrate). Gracefully degrades on
 * devices/browsers that don't support vibration. Never fires on desktop (768px+).
 */
/** Small wine count on a nav icon (unread chats, new calls); hidden at 0. */
function NavCountBadge({ count }: { count?: number }) {
  if (!count || count <= 0) return null;
  return (
    <span style={{
      position: "absolute", top: -6, right: -6,
      minWidth: 16, height: 16, padding: "0 4px",
      borderRadius: "var(--r-pill)",
      background: "var(--wine-grad)",
      color: "#FFFFFF", fontSize: 10, fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center",
      border: "1px solid var(--bg-2)",
    }}>
      {count > 9 ? "9+" : count}
    </span>
  );
}

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
  onOpenFounderChat,
  onOpenFounderInbox,
  notificationsCount,
  isMobileMenuOpen = false,
  onCloseMobileMenu,
  onToggleMobileMenu,
  onLogout,
  unreadChatCount,
  unreadCallCount,
  isDark = false,
  onToggleTheme,
}: {
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
  onOpenAi?: () => void;
  onOpenNotifications: () => void;
  onToggleHelp: () => void;
  onOpenFounderChat?: () => void;
  onOpenFounderInbox?: () => void;
  notificationsCount?: number;
  isMobileMenuOpen?: boolean;
  onCloseMobileMenu?: () => void;
  onToggleMobileMenu?: () => void;
  onLogout?: () => void;
  unreadChatCount?: number;
  /** Live calls since the Calls page was last opened. */
  unreadCallCount?: number;
  isDark?: boolean;
  onToggleTheme?: () => void;
}) {
  const { t, i18n } = useTranslation("crm");
  const [location, setLocation] = useLocation();


  const {
    currentAccount,
    currentAccountId,
    setCurrentAccountId,
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
  const currentLanguage = APP_LANGUAGES.find((l) => l.code === currentLang) ?? APP_LANGUAGES[0];
  const handleChangeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("leadawaker_lang", lang);
    setLangOpen(false);
    setProfileOpen(false);
  };

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Photo and name come from the signed-in user's server record, not the browser's localStorage.
  const identity = useCurrentUserIdentity();
  const userName = displayName(identity);
  const userAvatar = identity?.avatar ?? "";
  const userRole = localStorage.getItem("leadawaker_user_role") || "Viewer";

  // Role, impersonation, outreach pref, voice capabilities and the Owner's service
  // page toggles: the same context the mobile More page and landing picker use.
  const navCtx = useNavGateContext();
  // Client mode (!isAgencyUser): one flat list driven by what the account actually has.
  const clientFacts = useClientNavFacts();

  // Owner-only voice memo mic — recording state lives outside React (see voiceRecorder.ts)
  // so it survives navigation between pages, since every page remounts CrmShell.
  const { toast } = useToast();
  const voiceState = useVoiceRecorderState();
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ text?: string; error?: string }>).detail;
      if (detail?.text) {
        toast({ variant: "success", title: t("voiceNote.copied"), description: detail.text.length > 120 ? `${detail.text.slice(0, 120)}…` : detail.text, className: "!bg-[var(--glass-bg)] !border-[var(--glass-border)] text-foreground" });
      } else if (detail?.error) {
        toast({ variant: "destructive", title: t("voiceNote.failed"), description: detail.error });
      }
    };
    window.addEventListener("leadawaker-voice-note-result", handler);
    return () => window.removeEventListener("leadawaker-voice-note-result", handler);
  }, [toast, t]);
  const formatVoiceTimer = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const userInitials = initialsFor(userName);
  const shownName = shortName(userName);

  /** Switch the scoped account. The URL no longer changes — only data scope. */
  const handleAccountSelect = (id: number) => {
    setCurrentAccountId(id);
  };

  useEffect(() => {
    onCloseMobileMenu?.();
  }, [location]);

  const prefix = "/platform";
  /*
   * Hidden until finished (Gabriel, 2026-10-22). Their routes still work by URL
   * (pages/app.tsx); every way in was removed. To bring a page back, re-add:
   *  - AI agents (/platform/ai-agents): had no nav entry; nothing removed.
   *  - Cadence (/platform/cadence): navItems row { labelKey: "Cadence", icon: PhoneCall,
   *    testId: "nav-cadence", ownerOnly, outreachOnly } plus "Cadence" in the outreach
   *    section filter below; the CommandPalette row (keywords "cadence cold calls outreach").
   *  - Speed to Lead (/platform/speed-to-lead, mock data): the "speed" row in the
   *    Services group below (Icon Send); the CommandPalette and MobileMorePage rows
   *    (serviceKey "speed", agencyOnly); LANDING_OPTIONS in lib/landingPage.ts; its
   *    switch in features/settings/components/ServicePagesCard.tsx; its route guard
   *    back to ServicePageGuard service="speed".
   *  - Missed calls (/platform/missed-calls, mock data): the "missedcall" row in the
   *    Services group (Icon PhoneMissed); the CommandPalette and MobileMorePage rows
   *    (serviceKey "missedcall"); LANDING_OPTIONS; its ServicePagesCard switch; its
   *    route guard back to ServicePageGuard service="missedcall".
   *  - Reactivation (/platform/campaigns, the old Campaigns page): retired, not
   *    unfinished. Its settings are Accounts > Reactivation, its numbers Home >
   *    Reactivation, the receptionist's engine fields Chats > Settings > Advanced
   *    and the demo campaigns Demos > Settings. The route stays for the agency.
   */
  const navItems: (NavGate & {
    href: string;
    label: string;
    labelKey: string;
    icon: any;
    testId: string;
  })[] = [
    { href: `${prefix}/voice-calls`, label: t("sidebar.voiceCalls"), labelKey: "Voice calls", icon: AudioLines, testId: "nav-voice-calls", voiceCallsOnly: true },
    // Agency only here: clients get Chats from clientNavItems (only when website chat or WhatsApp is on).
    { href: `${prefix}/chat`, label: t("sidebar.conversations"), labelKey: "Conversations", icon: MessageSquare, testId: "nav-conversations", agencyOnly: true },
    { href: `${prefix}/calendar`, label: t("sidebar.calendar"), labelKey: "Calendar", icon: Calendar, testId: "nav-calendar" },
    { href: `${prefix}/contacts`, label: t("sidebar.leads"), labelKey: "Leads", icon: BookUser, testId: "nav-contacts" },
    // Clients get Socials from clientNavItems (only when the agency switched Social on for them).
    { href: `${prefix}/social`, label: t("sidebar.social"), labelKey: "Socials", icon: NAV_ICON.social, testId: "nav-social", agencyOnly: true },
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
    },
    {
      href: `${prefix}/prompt-library`,
      label: t("sidebar.promptLibrary"),
      labelKey: "Prompt Library",
      icon: BookOpen,
      testId: "nav-library",
      agencyOnly: true,
    },
    { href: `${prefix}/billing`, label: t("sidebar.billing"), labelKey: "Billing", icon: Receipt, testId: "nav-billing" },
    { href: `${prefix}/outreach-inbox`, label: t("sidebar.inbox"), labelKey: "Prospect inbox", icon: MessageSquare, testId: "nav-outreach-inbox", ownerOnly: true, outreachOnly: true },
    { href: `${prefix}/prospects`, label: t("sidebar.prospects"), labelKey: "Prospects", icon: UserSearch, testId: "nav-prospects", ownerOnly: true, outreachOnly: true },
    {
      href: `${prefix}/automation-logs`,
      label: t("sidebar.automations"),
      labelKey: "Automation logs",
      icon: ScrollText,
      testId: "nav-automations",
      ownerOnly: true,
    },
    { href: `${prefix}/traffic`, label: t("sidebar.traffic"), labelKey: "Traffic", icon: ChartNoAxesColumn, testId: "nav-traffic", ownerOnly: true },
    // Browser-demo links and their sessions. ownerOnly for the same reason the
    // API behind it is: the list names every prospect who has been demoed to.
    {
      href: `${prefix}/demos`,
      label: t("sidebar.demos"),
      labelKey: "Demos",
      icon: MonitorPlay,
      testId: "nav-demos",
      ownerOnly: true,
    },
  ];

  // Filter nav items based on user role and current view context
  const visibleNavItems = navItems.filter((it) => isNavItemVisible(it, navCtx));

  // Bottom bar tabs (More is appended by the bar). One icon map for every nav surface.
  const AGENCY_BAR: Record<AgencyBarKey, { href: string; labelKey: string }> = {
    home: { href: `${prefix}/home`, labelKey: "sidebar.home" },
    calls: { href: `${prefix}/voice-calls`, labelKey: "sidebar.voiceCalls" },
    chats: { href: `${prefix}/chat`, labelKey: "sidebar.conversations" },
    calendar: { href: `${prefix}/calendar`, labelKey: "sidebar.calendar" },
    tasks: { href: `${prefix}/tasks`, labelKey: "sidebar.tasks" },
    social: { href: `${prefix}/social`, labelKey: "sidebar.social" },
  };
  const barTabs = isAgencyUser
    ? agencyBottomBar(navCtx.hasVoiceCalls).map((k) => ({
        key: k, href: AGENCY_BAR[k].href, icon: NAV_ICON[k], label: t(AGENCY_BAR[k].labelKey), testId: `mobile-nav-${k}`,
      }))
    : clientBottomBar(clientFacts).map((k) => ({
        key: k,
        href: CLIENT_NAV_HREF[k],
        icon: NAV_ICON[k],
        label: t(k === "myReceptionist" ? "sidebar.myReceptionistShort" : clientNavLabelKey(k, clientFacts)),
        testId: `mobile-nav-${k === "myReceptionist" ? "accounts" : k}`,
      }));
  // Unselected: muted ink on the sand. Selected: a filled wine pill, bone icon + label.
  const barTabStyle = (active: boolean): React.CSSProperties => ({
    borderRadius: "var(--r-card)",
    color: active ? "var(--on-wine)" : "var(--chrome-deep-ink)",
    background: active ? "var(--wine)" : "transparent",
    transition: "background-color 160ms, color 160ms",
  });
  const barLabelStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: "var(--mono)",
    fontSize: 10,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "inherit",
    fontWeight: active ? 700 : 500,
    whiteSpace: "nowrap",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
  });

  /** Check if a nav item is active (exact match or sub-route match) */
  const isActive = (href: string) => {
    if (location === href) return true;
    // For sub-routes like /platform/contacts/123, highlight the parent nav item
    if (location.startsWith(href + '/')) return true;
    return false;
  };

  return (
    <>
      {/* MOBILE "MORE" FULL-SCREEN PAGE — replaces the old slide-in drawer */}
      <div className="md:hidden fixed inset-0 z-[80]" style={{ display: isMobileMenuOpen ? "block" : "none" }} data-testid="mobile-more-overlay">
        <MobileMorePage
          open={isMobileMenuOpen}
          onClose={onCloseMobileMenu}
          onOpenAi={() => { onOpenAi?.(); onCloseMobileMenu?.(); }}
          onToggleHelp={() => { onToggleHelp(); onCloseMobileMenu?.(); }}
          onLogout={() => { onLogout?.(); onCloseMobileMenu?.(); }}
        />
      </div>

      {/* MOBILE BOTTOM BAR — deep sand; the selected tab is a filled wine pill.
          Clients: Stats, Calls, Calendar, Chats (or Leads), More.
          Agency: Stats, Calls, Chats, Tasks, More. */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-[100] grid items-stretch"
        style={{
          gridTemplateColumns: `repeat(${barTabs.length + 1}, minmax(0, 1fr))`,
          height: "var(--bottombar-h)",
          paddingTop: 7,
          paddingBottom: "calc(var(--safe-bottom) + 9px)",
          background: "var(--chrome-deep)",
          borderTop: "1px solid var(--line)",
        }}
        data-testid="mobile-bottom-bar"
      >
        {barTabs.map((tab) => {
          // Don't double-highlight a tab when the More drawer is open over it.
          const active = isActive(tab.href) && !isMobileMenuOpen;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => {
                triggerHaptic();
                // Close founder chat when switching pages
                window.dispatchEvent(new CustomEvent("close-founder-chat"));
                setLocation(tab.href);
              }}
              className="flex flex-col items-center justify-center gap-[4px] mx-[4px] h-full min-w-0"
              style={barTabStyle(active)}
              data-testid={tab.testId}
              data-active={active || undefined}
            >
              <Icon className="h-[22px] w-[22px]" />
              <span style={barLabelStyle(active)}>{tab.label}</span>
            </button>
          );
        })}

        {/* More — opens the slide-in drawer (Settings + secondary nav live inside) */}
        <button
          onClick={() => {
            triggerHaptic();
            window.dispatchEvent(new CustomEvent("close-founder-chat"));
            onToggleMobileMenu?.();
          }}
          className="flex flex-col items-center justify-center gap-[4px] mx-[4px] h-full min-w-0"
          style={barTabStyle(isMobileMenuOpen)}
          data-testid="mobile-nav-more"
          data-active={isMobileMenuOpen || undefined}
        >
          <MoreHorizontal className="h-[22px] w-[22px]" />
          <span style={barLabelStyle(isMobileMenuOpen)}>{t("sidebar.more")}</span>
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
          <img src={isDark ? "/premium/logo-v2-dark.svg" : "/premium/logo-v2-outline.svg"} alt="Lead Awaker" style={{ height: 34, marginTop: 4 }} />
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
                  <span>{currentAccountId === 0 ? t("topbar.agencyView") : (currentAccount?.name || t("topbar.account"))}</span>
                  <span style={{ display: "flex", transform: "rotate(90deg)", color: "var(--muted-foreground)" }}>
                    <ChevronRight size={12} />
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-56 rounded-2xl shadow-xl border-border bg-background">
                <div className="px-3 pt-2 pb-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("sidebarSections.agency")}</div>
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

          {!isAgencyUser ? (
            clientNavItems(clientFacts).map((k) => {
              const href = CLIENT_NAV_HREF[k];
              const Icon = NAV_ICON[k];
              return (
                <Link key={k} href={href}
                  className={`la-nav-item ${isActive(href) ? "active" : ""}`}
                  data-testid={`link-client-${k}`}
                  data-active={isActive(href) || undefined}
                >
                  <span className="icon" style={{ position: "relative" }}>
                    <Icon size={16} />
                    {k === "calls" && <NavCountBadge count={unreadCallCount} />}
                  </span>
                  {t(clientNavLabelKey(k, clientFacts))}
                </Link>
              );
            })
          ) : (<>
          {/* Stats (/platform/home): the landing page with every figure, shown to every role. */}
          <Link
            href={`${prefix}/home`}
            className={`la-nav-item ${isActive(`${prefix}/home`) ? "active" : ""}`}
            data-testid="link-home"
            data-active={isActive(`${prefix}/home`) || undefined}
          >
            <span className="icon"><NAV_ICON.home size={16} /></span>
            {t("sidebar.home")}
          </Link>

          {/* Demos sits right under Stats: it is opened on most sales calls. */}
          {visibleNavItems.filter((it) => it.labelKey === "Demos").map((it) => {
            const Icon = it.icon;
            return (
              <Link key={it.href} href={it.href}
                className={`la-nav-item ${isActive(it.href) ? "active" : ""}`}
                data-testid={`link-${it.testId}`}
                data-active={isActive(it.href) || undefined}
              >
                <span className="icon"><Icon size={16} /></span>
                {it.label}
              </Link>
            );
          })}

          {/* Services group: each row is a service the agency runs. Reputation is
              live (mock workspace). Speed to Lead and Missed calls are hidden until
              finished (list above navItems). */}
          <div>
            {[
              { key: "reputation", labelKey: "sidebar.reputation", Icon: Star, href: `${prefix}/reputation` as string | null },
            ].filter(({ key }) => isNavItemVisible({ serviceKey: key as ServicePageKey }, navCtx)).map(({ key, labelKey, Icon, href }) =>
              href ? (
                <Link
                  key={key}
                  href={href}
                  className={`la-nav-item ${isActive(href) ? "active" : ""}`}
                  data-testid={`link-service-${key}`}
                  data-active={isActive(href) || undefined}
                >
                  <span className="icon"><Icon size={16} /></span>
                  {t(labelKey)}
                </Link>
              ) : (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: 10,
                  cursor: "default",
                }}
                data-testid={`link-service-${key}`}
                aria-disabled="true"
              >
                <span style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, fontWeight: 500, color: "var(--mute-2)" }}>
                  <span style={{ width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--mute-2)" }}>
                    <Icon size={16} />
                  </span>
                  {t(labelKey)}
                </span>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 8.5,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--mute-2)",
                    background: "var(--surface)",
                    boxShadow: "var(--sh-inset-crisp)",
                    borderRadius: "var(--r-pill)",
                    padding: "2px 7px",
                  }}
                >
                  {t("sidebar.soon")}
                </span>
              </div>
              )
            )}
          </div>

          {/* Nav section groups */}
          {(() => {
            const sections = [
              { section: "engage", items: visibleNavItems.filter(it => ["Voice calls", "Conversations", "Calendar", "Leads", "Socials"].includes(it.labelKey)) },
              { section: "admin", items: visibleNavItems.filter(it => ["Accounts", "Billing", "Tasks"].includes(it.labelKey)) },
              { section: "backend", items: visibleNavItems.filter(it => ["Prompt Library", "Automation logs", "Traffic"].includes(it.labelKey)) },
              { section: "outreach", items: visibleNavItems.filter(it => ["Prospect inbox", "Prospects"].includes(it.labelKey)) },
            ];
            return sections.map((g) => {
              if (g.items.length === 0) return null;
              return (
                <div key={g.section}>
                  <div className="la-nav-section">{t(`sidebarSections.${g.section}`)}</div>
                  {g.items.map((it) => {
                    const active = isActive(it.href);
                    const Icon = it.icon;
                    const unread = it.testId === "nav-conversations" ? unreadChatCount : it.testId === "nav-voice-calls" ? unreadCallCount : 0;
                    return (
                      <Link key={it.href} href={it.href}
                        className={`la-nav-item ${active ? "active" : ""}`}
                        data-testid={`link-${it.testId}`}
                        data-onboarding={it.testId}
                        data-active={active || undefined}
                      >
                        <span className="icon" style={{ position: "relative" }}>
                          <Icon size={16} />
                          <NavCountBadge count={unread} />
                        </span>
                        {it.label}
                      </Link>
                    );
                  })}
                </div>
              );
            });
          })()}

          </>)}
        </div>

        {/* ── Bottom: utilities + profile ── */}
        <div style={{
          padding: "12px 12px 14px",
          borderTop: "1px solid var(--line)",
        }}>
          {/* Voice memo mic — Owner only. Records, then copies the transcription to clipboard. */}
          {isOwner && (
            <button
              type="button"
              className="la-notif-btn"
              style={{ marginBottom: 6, ...(voiceState.recording ? { background: "var(--wine-tint)", color: "var(--wine)" } : {}) }}
              title={voiceState.recording ? t("voiceNote.stop") : t("voiceNote.start")}
              data-testid="nav-voice-note"
              onClick={toggleVoiceRecording}
              disabled={voiceState.transcribing}
            >
              <Mic size={14} className={voiceState.recording ? "animate-pulse" : undefined} />
              <span style={{ flex: 1, textAlign: "left", fontSize: 12, fontWeight: 600 }}>
                {voiceState.transcribing
                  ? t("voiceNote.transcribing")
                  : voiceState.recording
                  ? t("voiceNote.recording")
                  : t("voiceNote.title")}
              </span>
              {voiceState.recording && (
                <span style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {formatVoiceTimer(voiceState.elapsedSeconds)}
                </span>
              )}
            </button>
          )}

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
                {/* One way into Settings: Profile, Preferences and the rest are its own tabs. */}
                <button className="la-profile-menu-item" onClick={() => { setProfileOpen(false); setLocation(`${prefix}/settings`); }}
                  data-testid="nav-settings">
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
                <Popover open={helpOpen} onOpenChange={setHelpOpen}>
                  <PopoverTrigger asChild>
                    <button className="la-profile-menu-item">
                      <HelpCircle size={14} />
                      <span style={{ flex: 1, textAlign: "left" }}>{t("sidebar.helpAndDocs")}</span>
                      <ChevronRight size={14} style={{ color: "var(--muted-foreground)" }} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="right" align="start" sideOffset={4} className="w-56 p-1 rounded-2xl shadow-xl border-border bg-background">
                    <button
                      onClick={() => { setHelpOpen(false); setProfileOpen(false); setLocation(`${prefix}/docs`); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm hover:bg-muted/50 transition-colors"
                    >
                      <BookOpen size={14} />
                      <span className="flex-1 text-left">{t("sidebar.documentation")}</span>
                    </button>

                    <button
                      onClick={() => { setHelpOpen(false); setProfileOpen(false); onOpenFounderChat?.(); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm hover:bg-muted/50 transition-colors"
                    >
                      <MessageSquare size={14} />
                      <span className="flex-1 text-left">{t("sidebar.messageFounder")}</span>
                    </button>

                    {isOwner && (
                      <button
                        onClick={() => { setHelpOpen(false); setProfileOpen(false); onOpenFounderInbox?.(); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm hover:bg-muted/50 transition-colors"
                      >
                        <Inbox size={14} />
                        <span className="flex-1 text-left">{t("sidebar.founderInbox")}</span>
                      </button>
                    )}
                  </PopoverContent>
                </Popover>
                <Popover open={langOpen} onOpenChange={setLangOpen}>
                  <PopoverTrigger asChild>
                    <button className="la-profile-menu-item">
                      <Globe size={14} />
                      <span style={{ flex: 1, textAlign: "left" }}>{t("sidebar.language") || "Language"}</span>
                      <span style={{ fontSize: 13 }}>{currentLanguage.flag}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="right" align="start" sideOffset={4} className="w-48 p-1 rounded-2xl shadow-xl border-border bg-background">
                    {APP_LANGUAGES.map((lang) => (
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
                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shownName}</span>
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
