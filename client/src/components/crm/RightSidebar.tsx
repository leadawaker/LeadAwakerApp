import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import {
  HelpCircle,
  Headphones,
  MessageSquare,
  MessageCircle,
  Megaphone,
  Calendar,
  CalendarDays,
  ScrollText,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  BookUser,
  Users,
  ChevronsUpDown,
  Check,
  Menu,
  X,
  Building2,
  UserSearch,
  PhoneCall,
  ClipboardList,
  LogOut,
  Receipt,
  Settings,
  Settings2,

  Bell,
  Search,
  Moon,
  Sun,
  Eye,
  ArrowLeft,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  onOpenSupport,
  onOpenSearch,
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
  onOpenSupport: () => void;
  onOpenSearch: () => void;
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
  const { t } = useTranslation("crm");
  const [location, setLocation] = useLocation();


  const {
    currentAccount,
    currentAccountId,
    setCurrentAccountId,
    isAgencyView,
    accounts,
    isAgencyUser,
    isOwner,
    isImpersonating,
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

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [impersonationOpen, setImpersonationOpen] = useState(false);

  // Read current user info from localStorage
  const userName = localStorage.getItem("leadawaker_user_name") || localStorage.getItem("leadawaker_user_email") || "User";
  const userEmail = localStorage.getItem("leadawaker_user_email") || "";
  const userAvatar = localStorage.getItem("leadawaker_user_avatar") || "";
  const userRole = localStorage.getItem("leadawaker_user_role") || "Viewer";
  const userInitials = userName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  /** Switch the scoped account. The URL no longer changes — only data scope. */
  const handleAccountSelect = (id: number) => {
    setCurrentAccountId(id);
  };

  const queryClient = useQueryClient();

  // Role/account changes re-render the app via the effective role; no URL prefix
  // to switch under the unified /platform area.
  const handleImpersonate = async (role: string, accountId?: number) => {
    try {
      await apiFetch("/api/auth/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, accountId }),
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err) {
      console.error("Failed to start impersonation", err);
    }
  };

  const handleStopImpersonation = async () => {
    try {
      await apiFetch("/api/auth/impersonate/stop", { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err) {
      console.error("Failed to stop impersonation", err);
    }
  };

  useEffect(() => {
    onCloseMobileMenu?.();
  }, [location]);

  const prefix = "/platform";

  const clientImpersonationId = currentAccountId > 0 ? currentAccountId : 1;
  const selectedAccount = currentAccountId > 0 ? accounts.find(a => a.id === currentAccountId) : null;
  const clientImpersonationLabel = selectedAccount
    ? t("topbar.viewAsClient", { name: selectedAccount.name })
    : t("topbar.viewAsClientSandbox");

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
    {
      href: `${prefix}/accounts`,
      label: t("sidebar.accounts"),
      labelKey: "Accounts",
      icon: Building2,
      testId: "nav-accounts",
      agencyOnly: true,
      agencyViewOnly: true,
    },
    { href: `${prefix}/contacts`, label: t("sidebar.leads"), labelKey: "Leads", icon: BookUser, testId: "nav-contacts" },
    { href: `${prefix}/calendar`, label: t("sidebar.calendar"), labelKey: "Calendar", icon: Calendar, testId: "nav-calendar" },
    {
      href: `${prefix}/prompt-library`,
      label: t("sidebar.promptLibrary"),
      labelKey: "Prompt Library",
      icon: BookOpen,
      testId: "nav-library",
      agencyOnly: true,
    },
    { href: `${prefix}/invoices`, label: t("sidebar.invoices"), labelKey: "Invoices", icon: Receipt, testId: "nav-invoices", agencyOnly: true },
    { href: `${prefix}/expenses`, label: t("sidebar.expenses"), labelKey: "Expenses", icon: Receipt, testId: "nav-expenses", agencyOnly: true, ownerOnly: true },
    { href: `${prefix}/contracts`, label: t("sidebar.contracts"), labelKey: "Contracts", icon: Receipt, testId: "nav-contracts", agencyOnly: true },
    {
      href: `${prefix}/tasks`,
      label: t("sidebar.tasks"),
      labelKey: "Tasks",
      icon: ClipboardList,
      testId: "nav-tasks",
      agencyOnly: true,
    },
    { href: `${prefix}/outreach-inbox`, label: t("sidebar.inbox"), labelKey: "Inbox", icon: MessageSquare, testId: "nav-outreach-inbox", ownerOnly: true },
    { href: `${prefix}/prospects`, label: t("sidebar.prospects"), labelKey: "Prospects", icon: UserSearch, testId: "nav-prospects", ownerOnly: true },
    { href: `${prefix}/cadence`, label: t("sidebar.cadence"), labelKey: "Cadence", icon: PhoneCall, testId: "nav-cadence", ownerOnly: true },
    {
      href: `${prefix}/automation-logs`,
      label: t("sidebar.automations"),
      labelKey: "Automations",
      icon: ScrollText,
      testId: "nav-automations",
      agencyOnly: true,
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

  // Debug: Log all nav items and visible items
  console.log("📋 All navItems:", navItems.map(it => ({ label: it.label, testId: it.testId, agencyOnly: it.agencyOnly, ownerOnly: it.ownerOnly })));
  console.log("👁️ visibleNavItems:", visibleNavItems.map(it => ({ label: it.label, testId: it.testId })));
  console.log("🔐 User flags - isAgencyUser:", isAgencyUser, "isOwner:", isOwner, "isAgencyView:", isAgencyView);

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
      {/* MOBILE SIDEBAR OVERLAY */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[80]" data-testid="mobile-sidebar-overlay">
          {/* Backdrop - tap outside to close */}
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={onCloseMobileMenu}
            aria-label="Close menu"
            data-testid="mobile-sidebar-backdrop"
          />
          {/* Slide-in sidebar */}
          <aside
            className="absolute left-0 top-0 bottom-0 w-[260px] bg-background shadow-[4px_0_24px_rgba(0,0,0,0.12)] flex flex-col animate-in slide-in-from-left duration-250 ease-out"
            style={{ paddingTop: "var(--safe-top)" }}
            data-testid="mobile-sidebar-panel"
          >
            {/* LOGO */}
            <div className="py-5 px-5 flex items-center gap-3 border-b border-border/40">
              <Link href="/" onClick={onCloseMobileMenu}>
                <img
                  src="/premium/favicon.svg"
                  alt="Lead Awaker"
                  className="h-9 w-9"
                />
              </Link>
              <span className="text-sm font-bold text-foreground">Lead Awaker</span>
            </div>

            {/* ACCOUNT SWITCHER — mobile, agency users only */}
            {isAgencyUser && (
              <div className="px-3 pt-3" data-testid="mobile-sidebar-account-switcher">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "w-full rounded-xl border border-border/60 px-3 py-2.5 flex items-center gap-2 hover:bg-muted/60 transition-colors text-left",
                        currentAccountId === 0 || currentAccountId === 1
                          ? "bg-brand-yellow/10 dark:bg-brand-yellow/10"
                          : "bg-brand-indigo/10 dark:bg-brand-indigo/10"
                      )}
                      data-testid="mobile-sidebar-account-switcher-trigger"
                    >
                      <div
                        className={cn(
                          "h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0",
                          currentAccountId === 0 || currentAccountId === 1
                            ? "bg-brand-yellow text-brand-yellow-foreground"
                            : "bg-brand-indigo text-brand-indigo-foreground"
                        )}
                      >
                        {currentAccount?.name?.[0] || "?"}
                      </div>
                      <span className="text-xs font-semibold truncate flex-1">
                        {currentAccount?.name || "Select Account"}
                      </span>
                      <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="bottom"
                    align="start"
                    className="w-56 rounded-2xl shadow-xl border-border bg-background"
                  >
                    <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {t("topbar.switchAccount")}
                    </div>
                    {[...accounts].sort((a, b) => a.id === 1 ? -1 : b.id === 1 ? 1 : 0).map((acc) => (
                      <DropdownMenuItem
                        key={acc.id}
                        onClick={() => handleAccountSelect(acc.id)}
                        className={cn(
                          "flex items-center gap-2 cursor-pointer py-2.5 rounded-xl mx-1",
                          currentAccountId === acc.id && "bg-muted font-bold"
                        )}
                        data-testid={`mobile-sidebar-account-option-${acc.id}`}
                      >
                        <div
                          className={cn(
                            "h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0",
                            acc.id === 1
                              ? "bg-brand-yellow text-brand-yellow-foreground"
                              : "bg-brand-indigo text-brand-indigo-foreground"
                          )}
                        >
                          {acc.name?.[0] || "?"}
                        </div>
                        <span className="text-sm truncate flex-1">{acc.name}</span>
                        {currentAccountId === acc.id && (
                          <Check className="h-4 w-4 text-brand-indigo shrink-0" />
                        )}
                        {acc.id === 1 && (
                          <span className="text-[9px] bg-brand-yellow/15 text-brand-yellow px-1 rounded uppercase font-bold tracking-tighter shrink-0">
                            {t("sidebarSections.agency")}
                          </span>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* NAV */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {visibleNavItems.map((it) => {
                const Icon = it.icon;
                const active = isActive(it.href);
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl transition-colors",
                      active
                        ? "bg-highlight-active text-foreground font-bold shadow-sm"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                    data-testid={`mobile-${it.testId}`}
                    data-active={active || undefined}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-semibold">{it.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* BOTTOM ACTIONS */}
            <div className="px-3 pb-3 pt-2 space-y-2 border-t border-border/40">
              <Link
                href={`${prefix}/settings`}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors",
                  isActive(`${prefix}/settings`)
                    ? "bg-highlight-active text-foreground font-bold shadow-sm"
                    : "text-muted-foreground hover:bg-muted"
                )}
                data-testid="mobile-nav-settings"
              >
                <Settings className="h-4 w-4" />
                <span className="text-sm font-semibold">{t("sidebar.settings")}</span>
              </Link>
              <button
                onClick={() => { onOpenSupport(); onCloseMobileMenu?.(); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-muted-foreground hover:bg-muted transition-colors"
              >
                <Headphones className="h-4 w-4" />
                <span className="text-sm font-semibold">{t("sidebar.support")}</span>
              </button>
              <button
                onClick={() => { onToggleHelp(); onCloseMobileMenu?.(); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-muted-foreground hover:bg-muted transition-colors"
              >
                <HelpCircle className="h-4 w-4" />
                <span className="text-sm font-semibold">{t("sidebar.help")}</span>
              </button>
            </div>

            {/* USER FOOTER */}
            <div className="px-3 pb-6 pt-2 border-t border-border/40" data-testid="mobile-sidebar-user-footer">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {userInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" data-testid="mobile-sidebar-user-name">{userName}</div>
                  <div className="text-[11px] text-muted-foreground truncate" data-testid="mobile-sidebar-user-role">{userRole}</div>
                </div>
                <button
                  onClick={() => { onLogout?.(); onCloseMobileMenu?.(); }}
                  className="icon-circle-lg icon-circle-base hover:text-red-600 hover:border-red-400/40 hover:bg-red-50 dark:hover:bg-red-950/30"
                  title="Logout"
                  data-testid="mobile-sidebar-logout-btn"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* MOBILE BOTTOM BAR — 5 tabs: Campaigns, Leads, Chats, Calendar, Settings */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border/50 bg-background/95 z-[100] flex justify-around items-start pt-2"
        style={{ height: "var(--bottombar-h)", paddingBottom: "var(--safe-bottom)" }}
        data-testid="mobile-bottom-bar"
      >
        {/* Campaigns */}
        <button
          onClick={() => { triggerHaptic(); setLocation(`${prefix}/campaigns`); }}
          className={cn(
            "relative flex flex-col items-center gap-1 px-3 py-2 min-h-[44px] rounded-xl transition-colors",
            isActive(`${prefix}/campaigns`)
              ? "text-brand-indigo"
              : "text-muted-foreground"
          )}
          data-testid="mobile-nav-campaigns"
          data-active={isActive(`${prefix}/campaigns`) || undefined}
        >
          <Megaphone className="h-[18px] w-[18px]" />
          <span className="text-[10px] font-semibold">{t("sidebar.campaigns")}</span>
          {isActive(`${prefix}/campaigns`) && (
            <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-indigo" />
          )}
        </button>

        {/* Leads */}
        <button
          onClick={() => { triggerHaptic(); setLocation(`${prefix}/contacts`); }}
          className={cn(
            "relative flex flex-col items-center gap-1 px-3 py-2 min-h-[44px] rounded-xl transition-colors",
            isActive(`${prefix}/contacts`)
              ? "text-brand-indigo"
              : "text-muted-foreground"
          )}
          data-testid="mobile-nav-contacts"
          data-active={isActive(`${prefix}/contacts`) || undefined}
        >
          <Users className="h-[18px] w-[18px]" />
          <span className="text-[10px] font-semibold">{t("sidebar.leads")}</span>
          {isActive(`${prefix}/contacts`) && (
            <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-indigo" />
          )}
        </button>

        {/* Outreach Inbox — owner only */}
        {isOwner && (
          <button
            onClick={() => { triggerHaptic(); setLocation(`${prefix}/outreach-inbox`); }}
            className={cn(
              "relative flex flex-col items-center gap-1 px-3 py-2 min-h-[44px] rounded-xl transition-colors",
              isActive(`${prefix}/outreach-inbox`)
                ? "text-brand-indigo"
                : "text-muted-foreground"
            )}
            data-testid="mobile-nav-outreach-inbox"
            data-active={isActive(`${prefix}/outreach-inbox`) || undefined}
          >
            <MessageCircle className="h-[18px] w-[18px]" />
            <span className="text-[10px] font-semibold">{t("sidebar.inbox")}</span>
            {isActive(`${prefix}/outreach-inbox`) && (
              <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-indigo" />
            )}
          </button>
        )}

        {/* Calendar */}
        <button
          onClick={() => { triggerHaptic(); setLocation(`${prefix}/calendar`); }}
          className={cn(
            "relative flex flex-col items-center gap-1 px-3 py-2 min-h-[44px] rounded-xl transition-colors",
            isActive(`${prefix}/calendar`)
              ? "text-brand-indigo"
              : "text-muted-foreground"
          )}
          data-testid="mobile-nav-calendar"
          data-active={isActive(`${prefix}/calendar`) || undefined}
        >
          <CalendarDays className="h-[18px] w-[18px]" />
          <span className="text-[10px] font-semibold">{t("sidebar.calendar")}</span>
          {isActive(`${prefix}/calendar`) && (
            <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-indigo" />
          )}
        </button>

        {/* Settings */}
        <button
          onClick={() => { triggerHaptic(); setLocation(`${prefix}/settings`); }}
          className={cn(
            "relative flex flex-col items-center gap-1 px-3 py-2 min-h-[44px] rounded-xl transition-colors",
            isActive(`${prefix}/settings`)
              ? "text-brand-indigo"
              : "text-muted-foreground"
          )}
          data-testid="mobile-nav-settings-bar"
          data-active={isActive(`${prefix}/settings`) || undefined}
        >
          <Settings2 className="h-[18px] w-[18px]" />
          <span className="text-[10px] font-semibold">{t("sidebar.settings")}</span>
          {isActive(`${prefix}/settings`) && (
            <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-indigo" />
          )}
        </button>
      </div>

      {/* DESKTOP SIDEBAR — Neumorphic design system */}
      <aside
        className="hidden md:flex flex-col fixed left-0 bottom-0"
        style={{
          width: 188,
          top: "var(--banner-h, 0px)",
          background: "var(--color-sidebar-bg)",
          borderRight: "1px solid var(--line)",
          height: "100%",
          flexShrink: 0,
          boxShadow: "4px 0 14px -4px rgba(90, 65, 35, 0.18)",
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
          <img src="/premium/logo-v2.svg" alt="Lead Awaker" style={{ height: 34, marginTop: 4 }} />
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
                  <span className="row" style={{ gap: 8 }}>
                    <ChevronsUpDown size={13} />
                    <span>{currentAccountId === 0 ? "Agency View" : (currentAccount?.name || "Account")}</span>
                  </span>
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
              { section: "Menu", items: visibleNavItems.filter(it => it.labelKey === "Campaigns") },
              { section: "Engage", items: visibleNavItems.filter(it => ["Leads", "Calendar"].includes(it.labelKey)) },
              { section: "Outreach", items: visibleNavItems.filter(it => ["Inbox", "Prospects", "Cadence"].includes(it.labelKey)) },
              { section: "Admin", items: visibleNavItems.filter(it => ["Accounts", "Billing", "Tasks"].includes(it.labelKey)) },
              { section: "Backend", items: visibleNavItems.filter(it => ["Prompt Library", "Automations"].includes(it.labelKey)) },
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
          <div className="la-util-row">
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <button className="la-util-btn" title={t("sidebar.search") || "Search"}
                  data-testid="nav-search">
                  <Search size={15} />
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" align="end" sideOffset={8}
                className="w-[300px] p-3 rounded-2xl shadow-xl border-border bg-background">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl border border-border/50 bg-muted/40">
                  <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <input autoFocus placeholder={t("sidebar.search") || "Search..."}
                    className="flex-1 bg-transparent outline-none text-sm"
                    onKeyDown={(e) => { if (e.key === "Escape") setSearchOpen(false); }} />
                </div>
              </PopoverContent>
            </Popover>

            <Popover open={notifOpen} onOpenChange={setNotifOpen}>
              <PopoverTrigger asChild>
                <button className="la-util-btn" title={t("sidebar.notifications") || "Notifications"}
                  data-testid="nav-notifications">
                  <Bell size={15} />
                  {unreadNotifCount > 0 && <span className="la-util-dot" />}
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" align="end" sideOffset={8}
                className="w-[380px] p-0 rounded-2xl shadow-xl border-border bg-background overflow-hidden">
                <NotificationCenter open={notifOpen} onClose={() => setNotifOpen(false)} />
              </PopoverContent>
            </Popover>

            <button className="la-util-btn" title="Theme" onClick={() => onToggleTheme?.()}>
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <button className="la-util-btn" title={t("sidebar.help")} onClick={onToggleHelp}>
              <HelpCircle size={15} />
            </button>

            <button className="la-util-btn" title={t("sidebar.support")} onClick={onOpenSupport}>
              <Headphones size={15} />
            </button>
          </div>

          {/* Profile card */}
          <div style={{ position: "relative", marginTop: 10 }}>
            {profileOpen && (
              <div className="la-profile-menu">
                <button className="la-profile-menu-item" onClick={() => { setProfileOpen(false); setLocation(`${prefix}/settings`); }}>
                  <Settings size={14} />{t("sidebar.settings")}
                </button>
                {isOwner && !isImpersonating && (
                  <Popover open={impersonationOpen} onOpenChange={setImpersonationOpen}>
                    <PopoverTrigger asChild>
                      <button className="la-profile-menu-item">
                        <Eye size={14} />Impersonation
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="right" align="start" sideOffset={4} className="w-48 p-1 rounded-2xl shadow-xl border-border bg-background">
                      <div className="px-3 pt-2 pb-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {t("topbar.viewAsRole")}
                      </div>
                      <button onClick={() => { setImpersonationOpen(false); setProfileOpen(false); handleImpersonate("Admin"); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm hover:bg-muted/50 transition-colors">
                        <div className="h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 bg-brand-indigo text-brand-indigo-foreground">A</div>
                        <span>{t("topbar.viewAsAdmin")}</span>
                      </button>
                      <button onClick={() => { setImpersonationOpen(false); setProfileOpen(false); handleImpersonate("Manager", clientImpersonationId); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm hover:bg-muted/50 transition-colors">
                        <div className="h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 bg-muted text-muted-foreground">C</div>
                        <span>{clientImpersonationLabel}</span>
                      </button>
                    </PopoverContent>
                  </Popover>
                )}
                {isImpersonating && (
                  <button className="la-profile-menu-item" onClick={() => { setProfileOpen(false); handleStopImpersonation(); }}
                    style={{ color: "var(--warn)" }}>
                    <X size={14} />{t("topbar.exitImpersonation")}
                  </button>
                )}
                <button className="la-profile-menu-item" onClick={onToggleHelp}>
                  <HelpCircle size={14} />Help &amp; docs
                </button>
                <div className="rule" style={{ margin: "6px 8px" }} />
                <button className="la-profile-menu-item" onClick={() => { setProfileOpen(false); onLogout?.(); }}
                  style={{ color: "#A24B3F" }}>
                  <LogOut size={14} />{t("sidebar.logout") || "Sign out"}
                </button>
              </div>
            )}
            <button className={`la-profile ${profileOpen ? "open" : ""}`} onClick={() => setProfileOpen(o => !o)} data-testid="nav-profile">
              <span className="la-profile-av">{userInitials}</span>
              <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</span>
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
