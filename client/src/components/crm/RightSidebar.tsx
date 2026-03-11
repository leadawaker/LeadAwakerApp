import { useEffect, useState } from "react";
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
  ClipboardList,
  LogOut,
  Receipt,
  Settings,
  Settings2,
  Palette,
} from "lucide-react";
import { ColorPickerWidget } from "@/components/ui/color-picker-widget";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  onOpenSearch: _onOpenSearch,
  onOpenNotifications: _onOpenNotifications,
  onToggleHelp,
  onOpenSettings,
  notificationsCount,
  isMobileMenuOpen = false,
  onCloseMobileMenu,
  onToggleMobileMenu,
  onLogout,
  unreadChatCount,
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
}) {
  const { t } = useTranslation("crm");
  const [location, setLocation] = useLocation();
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const { crumb } = useBreadcrumb();
  const {
    currentAccount,
    currentAccountId,
    setCurrentAccountId,
    isAgencyView,
    accounts,
    isAgencyUser,
  } = useWorkspace();

  // Read current user info from localStorage
  const userName = localStorage.getItem("leadawaker_user_name") || localStorage.getItem("leadawaker_user_email") || "User";
  const userRole = localStorage.getItem("leadawaker_user_role") || "Viewer";
  const userInitials = userName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  /** Handle account switch with route transition */
  const handleAccountSelect = (id: number) => {
    const prevIsAgency = currentAccountId === 0 || currentAccountId === 1;
    const prevBase = prevIsAgency ? "/agency" : "/subaccount";

    setCurrentAccountId(id);

    // Admin always stays on /agency prefix — never redirected to /subaccount
    if (isAgencyUser && location.startsWith("/agency")) return;

    const nextIsAgency = id === 0 || id === 1;
    const nextBase = nextIsAgency ? "/agency" : "/subaccount";

    const tail = location.startsWith(prevBase)
      ? location.slice(prevBase.length)
      : location.replace(/^\/(agency|subaccount)/, "");

    // Agency-only pages don't exist in subaccount view — always go to campaigns
    const agencyOnlyPaths = ["/accounts", "/tasks", "/prompt-library", "/automation-logs", "/expenses", "/contracts"];
    const isAgencyOnlyPage = agencyOnlyPaths.some((p) => tail.startsWith(p));
    const safeTail = (!nextIsAgency && isAgencyOnlyPage) ? "/campaigns" : tail;

    const nextPath = `${nextBase}${safeTail || "/campaigns"}`;
    setLocation(nextPath);
  };

  useEffect(() => {
    onCloseMobileMenu?.();
  }, [location]);

  const prefix = isAgencyView ? "/agency" : "/subaccount";

  const navItems: {
    href: string;
    label: string;
    labelKey: string;
    icon: any;
    testId: string;
    adminOnly?: boolean;
    agencyOnly?: boolean;
    agencyViewOnly?: boolean;
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
    { href: `${prefix}/conversations`, label: t("sidebar.chats"), labelKey: "Chats", icon: MessageSquare, testId: "nav-chats" },
    { href: `${prefix}/calendar`, label: t("sidebar.calendar"), labelKey: "Calendar", icon: Calendar, testId: "nav-calendar" },
    {
      href: `${prefix}/prompt-library`,
      label: t("sidebar.promptLibrary"),
      labelKey: "Prompt Library",
      icon: BookOpen,
      testId: "nav-library",
      agencyOnly: true,
    },
    { href: `${prefix}/invoices`, label: t("sidebar.billing"), labelKey: "Billing", icon: Receipt, testId: "nav-billing" },
    {
      href: `${prefix}/tasks`,
      label: t("sidebar.tasks"),
      labelKey: "Tasks",
      icon: ClipboardList,
      testId: "nav-tasks",
      agencyOnly: true,
    },
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
    if (it.adminOnly && !isAgencyUser) return false;
    if (it.agencyOnly && !isAgencyUser) return false;
    if (it.agencyViewOnly && !isAgencyView) return false;
    return true;
  });

  const PAGE_LABELS: Record<string, string> = {
    campaigns: t("sidebar.campaigns"),
    contacts: t("sidebar.leads"),
    conversations: t("sidebar.chats"),
    calendar: t("sidebar.calendar"),
    accounts: t("sidebar.accounts"),
    invoices: t("sidebar.billing"),
    expenses: t("sidebar.billing"),
    contracts: t("sidebar.billing"),
    "prompt-library": t("sidebar.promptLibrary"),
    tasks: t("sidebar.tasks"),
    "automation-logs": t("sidebar.automations"),
    settings: t("sidebar.settings"),
    docs: t("sidebar.docs"),
  };
  const pageLabel = PAGE_LABELS[location.split("/").filter(Boolean)[1] ?? ""] ?? "";

  /** Check if a nav item is active (exact match or sub-route match) */
  const isActive = (href: string) => {
    if (location === href) return true;
    // For sub-routes like /agency/contacts/123, highlight the parent nav item
    // But don't let /agency/campaigns match sub-routes (campaigns has no sub-routes)
    if (href !== `${prefix}/campaigns` && location.startsWith(href + '/')) return true;
    // Billing nav highlights for all billing sub-routes
    if (href === `${prefix}/invoices` && (location === `${prefix}/expenses` || location === `${prefix}/contracts`)) return true;
    return false;
  };

  /** Render a single desktop nav link with Radix Tooltip support */
  const renderDesktopNavLink = (it: typeof navItems[0]) => {
    const active = isActive(it.href);
    const Icon = it.icon;
    const showUnreadCount = it.testId === "nav-chats" && !!unreadChatCount && unreadChatCount > 0;

    return (
      <Tooltip key={it.href}>
        <TooltipTrigger asChild>
          <Link
            href={it.href}
            className={cn(
              "relative flex items-center rounded-full transition-colors mb-0.5",
              collapsed
                ? "h-[44px] w-[44px] justify-center mx-auto"
                : "h-[44px] pl-[1.5px] pr-2 gap-2.5",
              active
                ? "bg-highlight-active text-foreground font-semibold"
                : "text-foreground/70 hover:bg-card hover:text-foreground"
            )}
            data-testid={`link-${it.testId}`}
            data-onboarding={it.testId}
            data-active={active || undefined}
          >
            <div className="relative h-10 w-10 rounded-full flex items-center justify-center shrink-0 border border-black/[0.125]">
              <Icon className="h-4 w-4" />
              {showUnreadCount && (
                <span className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 rounded-full bg-brand-indigo text-white text-[10px] font-bold flex items-center justify-center border border-background">
                  {unreadChatCount! > 9 ? "9+" : unreadChatCount}
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
                ? "bg-highlight-active text-foreground"
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
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
            data-testid="mobile-sidebar-panel"
          >
            {/* LOGO */}
            <div className="py-5 px-5 flex items-center gap-3 border-b border-border/40">
              <Link href="/" onClick={onCloseMobileMenu}>
                <img
                  src="/6. Favicon.svg"
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
        style={{ height: "calc(64px + env(safe-area-inset-bottom, 0px))", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
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

        {/* Chats */}
        <button
          onClick={() => { triggerHaptic(); setLocation(`${prefix}/conversations`); }}
          className={cn(
            "relative flex flex-col items-center gap-1 px-3 py-2 min-h-[44px] rounded-xl transition-colors",
            isActive(`${prefix}/conversations`)
              ? "text-brand-indigo"
              : "text-muted-foreground"
          )}
          data-testid="mobile-nav-conversations"
          data-active={isActive(`${prefix}/conversations`) || undefined}
        >
          <MessageCircle className="h-[18px] w-[18px]" />
          <span className="text-[10px] font-semibold">{t("sidebar.chats")}</span>
          {isActive(`${prefix}/conversations`) && (
            <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-indigo" />
          )}
        </button>

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

      {/* DESKTOP SIDEBAR */}
      <aside
        className={cn(
          "fixed left-0 top-[62px] bottom-0 bg-background hidden md:flex flex-col overflow-hidden transition-[width] duration-200",
          collapsed ? "w-[56px]" : "w-[225px]"
        )}
        data-sidebar-focus
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* HEADER — "Menu" label + collapse button */}
          <div
            className={cn(
              "flex items-center shrink-0 mt-[45px] mb-6 h-10",
              collapsed ? "px-1.5" : "px-2.5",
              collapsed ? "justify-center" : "justify-between"
            )}
          >
            {!collapsed && (
              <span className="text-2xl font-semibold font-heading text-foreground pl-1">{t("sidebar.menu")}</span>
            )}
            <button
              onClick={() => onCollapse(!collapsed)}
              className="icon-circle-lg icon-circle-base"
              title={collapsed ? "Expand menu" : "Collapse menu"}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* NAV — categorized sections */}
          <TooltipProvider delayDuration={300}>
            <nav className={cn("flex-1 overflow-y-auto min-h-0 pb-2", collapsed ? "px-1.5" : "px-2.5")}>
              {/* Section: (top — Campaigns) */}
              {visibleNavItems.filter(it => it.labelKey === "Campaigns").map((it) => renderDesktopNavLink(it))}

              {/* Section: Engage */}
              {(() => {
                const engageItems = visibleNavItems.filter(it =>
                  ["Leads", "Chats", "Calendar"].includes(it.labelKey)
                );
                if (engageItems.length === 0) return null;
                return (
                  <div className="mt-4">
                    {collapsed ? (
                      <div className="mx-auto w-5 border-t border-border/30 my-3" />
                    ) : (
                      <div className="px-1 pt-1.5 pb-3">
                        <span className="text-[11px] font-bold tracking-wide text-foreground">
                          {t("sidebarSections.engage")}
                        </span>
                      </div>
                    )}
                    {engageItems.map((it) => renderDesktopNavLink(it))}
                  </div>
                );
              })()}

              {/* Section: Admin (agency only) + Billing */}
              {(() => {
                const adminItems = visibleNavItems.filter(it =>
                  ["Accounts", "Tasks", "Billing"].includes(it.labelKey)
                );
                if (adminItems.length === 0) return null;
                return (
                  <div className="mt-4">
                    {collapsed ? (
                      <div className="mx-auto w-5 border-t border-border/30 my-3" />
                    ) : (
                      <div className="px-1 pt-1.5 pb-3">
                        <span className="text-[11px] font-bold tracking-wide text-foreground">
                          {t("sidebarSections.admin")}
                        </span>
                      </div>
                    )}
                    {adminItems.map((it) => renderDesktopNavLink(it))}
                  </div>
                );
              })()}

              {/* Section: Backend (agency only) */}
              {(() => {
                const backendItems = visibleNavItems.filter(it =>
                  ["Prompt Library", "Automations"].includes(it.labelKey)
                );
                if (backendItems.length === 0) return null;
                return (
                  <div className="mt-4">
                    {collapsed ? (
                      <div className="mx-auto w-5 border-t border-border/30 my-3" />
                    ) : (
                      <div className="px-1 pt-1.5 pb-3">
                        <span className="text-[11px] font-bold tracking-wide text-foreground">
                          {t("sidebarSections.backend")}
                        </span>
                      </div>
                    )}
                    {backendItems.map((it) => renderDesktopNavLink(it))}
                  </div>
                );
              })()}

            </nav>
          </TooltipProvider>

          {/* Color Picker toggle — round 40px button */}
          <div className={cn("shrink-0 pb-2", collapsed ? "px-1.5" : "px-2.5")}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setColorPickerOpen((p) => !p)}
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center border border-black/[0.125] transition-colors",
                    colorPickerOpen
                      ? "bg-brand-indigo text-white border-brand-indigo"
                      : "text-foreground/50 hover:text-foreground hover:bg-card"
                  )}
                  title="Color Tester"
                >
                  <Palette className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Color Tester
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Breadcrumb — current page + selected item */}
          {!collapsed && pageLabel && (
            <div className="shrink-0 px-4 pb-3 min-w-0 flex items-center gap-1 overflow-hidden">
              <span className="text-[12px] font-medium text-muted-foreground shrink-0">{pageLabel}</span>
              {crumb && (
                <>
                  <span className="text-[12px] text-muted-foreground/50 shrink-0">/</span>
                  <span className="text-[12px] font-semibold text-foreground truncate">{crumb}</span>
                </>
              )}
            </div>
          )}

          {/* Settings — pinned to bottom */}
          <TooltipProvider delayDuration={300}>
            <div className={cn("shrink-0 pb-4 pt-2 border-t border-border/30", collapsed ? "px-1.5" : "px-2.5")}>
              {renderDesktopNavLink({
                href: `${prefix}/settings`,
                label: t("sidebar.settings"),
                labelKey: "Settings",
                icon: Settings,
                testId: "nav-settings",
              })}
            </div>
          </TooltipProvider>

          {/* Color Picker Widget */}
          <ColorPickerWidget
            open={colorPickerOpen}
            onClose={() => setColorPickerOpen(false)}
          />
        </div>
      </aside>
    </>
  );
}
