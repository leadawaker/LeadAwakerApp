import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Search,
  Bell,
  Moon,
  HelpCircle,
  Headphones,
  LayoutDashboard,
  MessageSquare,
  Megaphone,
  Calendar,
  ScrollText,
  Users,
  Tag,
  BookOpen,
  PanelRightClose,
  PanelRightOpen,
  BookUser,
  ChevronDown,
  ChevronsUpDown,
  Check,
  Menu,
  X,
  Building2,
  LogOut,
  User,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { DbStatusIndicator } from "@/components/crm/DbStatusIndicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function RightSidebar({
  collapsed,
  onCollapse,
  onOpenSupport,
  onOpenSearch,
  onOpenNotifications,
  onToggleHelp,
  notificationsCount,
  isMobileMenuOpen = false,
  onCloseMobileMenu,
  onToggleMobileMenu,
  onLogout,
}: {
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
  onOpenSupport: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onToggleHelp: () => void;
  notificationsCount?: number;
  isMobileMenuOpen?: boolean;
  onCloseMobileMenu?: () => void;
  onToggleMobileMenu?: () => void;
  onLogout?: () => void;
}) {
  const [location, setLocation] = useLocation();
  const {
    currentAccount,
    currentAccountId,
    setCurrentAccountId,
    isAgencyView,
    accounts,
    isAgencyUser,
  } = useWorkspace();

  const [openSwitcher, setOpenSwitcher] = useState(false);
  const [dark, setDark] = useState(false);

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

  const count = notificationsCount ?? 0;

  /** Handle account switch with route transition */
  const handleAccountSelect = (id: number) => {
    const prevIsAgency = currentAccountId === 1;
    const prevBase = prevIsAgency ? "/agency" : "/subaccount";

    setCurrentAccountId(id);

    const nextIsAgency = id === 1;
    const nextBase = nextIsAgency ? "/agency" : "/subaccount";

    const tail = location.startsWith(prevBase)
      ? location.slice(prevBase.length)
      : location.replace(/^\/(agency|subaccount)/, "");

    // Agency-only pages don't exist in subaccount view — always go to dashboard
    const agencyOnlyPaths = ["/accounts", "/tags", "/users", "/prompt-library", "/automation-logs"];
    const isAgencyOnlyPage = agencyOnlyPaths.some((p) => tail.startsWith(p));
    const safeTail = (!nextIsAgency && isAgencyOnlyPage) ? "/dashboard" : tail;

    const nextPath = `${nextBase}${safeTail || "/dashboard"}`;
    setLocation(nextPath);
  };

  // ✅ AGENCY CHECK — agency users have accountsId === 1
  const isAgency =
    localStorage.getItem("leadawaker_current_account_id") === "1";

  useEffect(() => {
    onCloseMobileMenu?.();
  }, [location]);

  const prefix = isAgencyView ? "/agency" : "/subaccount";

  const navItems: {
    href: string;
    label: string;
    icon: any;
    testId: string;
    adminOnly?: boolean;
    agencyOnly?: boolean;
    agencyViewOnly?: boolean;
  }[] = [
    { href: `${prefix}/dashboard`, label: "Dashboard", icon: LayoutDashboard, testId: "nav-home" },
    {
      href: `${prefix}/accounts`,
      label: "Accounts",
      icon: Building2,
      testId: "nav-accounts",
      agencyOnly: true,
      agencyViewOnly: true,
    },
    { href: `${prefix}/campaigns`, label: "Campaigns", icon: Megaphone, testId: "nav-campaigns" },
    { href: `${prefix}/contacts`, label: "Leads", icon: BookUser, testId: "nav-contacts" },
    { href: `${prefix}/conversations`, label: "Chats", icon: MessageSquare, testId: "nav-chats" },
    { href: `${prefix}/calendar`, label: "Calendar", icon: Calendar, testId: "nav-calendar" },
    { href: `${prefix}/tags`, label: "Tags", icon: Tag, testId: "nav-tags", agencyOnly: true },
    {
      href: `${prefix}/prompt-library`,
      label: "Library",
      icon: BookOpen,
      testId: "nav-library",
      agencyOnly: true,
    },
    { href: `${prefix}/users`, label: "Users", icon: Users, testId: "nav-users", agencyOnly: true },
    {
      href: `${prefix}/automation-logs`,
      label: "Automations",
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

  /** Check if a nav item is active (exact match or sub-route match) */
  const isActive = (href: string) => {
    if (location === href) return true;
    // For sub-routes like /agency/contacts/123, highlight the parent nav item
    // But don't let /agency/contacts match /agency/contact (partial word)
    if (href !== `${prefix}/dashboard` && location.startsWith(href + '/')) return true;
    return false;
  };

  return (
    <>
      {/* MOBILE SIDEBAR OVERLAY */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[80]" data-testid="mobile-sidebar-overlay">
          {/* Backdrop - tap outside to close */}
          <button
            type="button"
            className="absolute inset-0 bg-black/25 glass-overlay"
            onClick={onCloseMobileMenu}
            aria-label="Close menu"
            data-testid="mobile-sidebar-backdrop"
          />
          {/* Slide-in sidebar */}
          <aside
            className="absolute left-0 top-0 bottom-0 w-[260px] bg-white/90 dark:bg-card/90 glass-accent shadow-2xl flex flex-col animate-in slide-in-from-left duration-250 ease-out"
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
                        currentAccountId === 1
                          ? "bg-brand-yellow/10 dark:bg-brand-yellow/10"
                          : "bg-brand-blue/10 dark:bg-brand-blue/10"
                      )}
                      data-testid="mobile-sidebar-account-switcher-trigger"
                    >
                      <div
                        className={cn(
                          "h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0",
                          currentAccountId === 1
                            ? "bg-brand-yellow text-brand-yellow-foreground"
                            : "bg-brand-blue text-brand-blue-foreground"
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
                      Switch Account
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
                              : "bg-brand-blue text-brand-blue-foreground"
                          )}
                        >
                          {acc.name?.[0] || "?"}
                        </div>
                        <span className="text-sm truncate flex-1">{acc.name}</span>
                        {currentAccountId === acc.id && (
                          <Check className="h-4 w-4 text-brand-blue shrink-0" />
                        )}
                        {acc.id === 1 && (
                          <span className="text-[9px] bg-brand-yellow/15 text-brand-yellow px-1 rounded uppercase font-bold tracking-tighter shrink-0">
                            Agency
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
                        ? "bg-brand-blue text-brand-blue-foreground font-bold shadow-sm"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                    data-testid={`mobile-${it.testId}`}
                    data-active={active || undefined}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-semibold">{it.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* BOTTOM ACTIONS */}
            <div className="px-3 pb-3 pt-2 space-y-2 border-t border-border/40">
              <button
                onClick={() => { onOpenSupport(); onCloseMobileMenu?.(); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-muted-foreground hover:bg-muted transition-colors"
              >
                <Headphones className="h-5 w-5" />
                <span className="text-sm font-semibold">Support</span>
              </button>
              <button
                onClick={() => { onToggleHelp(); onCloseMobileMenu?.(); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-muted-foreground hover:bg-muted transition-colors"
              >
                <HelpCircle className="h-5 w-5" />
                <span className="text-sm font-semibold">Help</span>
              </button>
            </div>

            {/* USER FOOTER */}
            <div className="px-3 pb-6 pt-2 border-t border-border/40" data-testid="mobile-sidebar-user-footer">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {userInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" data-testid="mobile-sidebar-user-name">{userName}</div>
                  <div className="text-[11px] text-muted-foreground truncate" data-testid="mobile-sidebar-user-role">{userRole}</div>
                </div>
                <button
                  onClick={() => { onLogout?.(); onCloseMobileMenu?.(); }}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
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

      {/* MOBILE BOTTOM BAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-[64px] border-t border-border/50 bg-white/80 dark:bg-card/80 glass-nav z-[100] flex justify-around items-center">
        <button
          onClick={() => setLocation(`${prefix}/dashboard`)}
          className={cn(
            "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors",
            isActive(`${prefix}/dashboard`)
              ? "text-brand-blue"
              : "text-muted-foreground"
          )}
          data-testid="mobile-nav-dashboard"
          data-active={isActive(`${prefix}/dashboard`) || undefined}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Dashboard</span>
        </button>
        <button
          onClick={() => setLocation(`${prefix}/contacts`)}
          className={cn(
            "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors",
            isActive(`${prefix}/contacts`)
              ? "text-brand-blue"
              : "text-muted-foreground"
          )}
          data-testid="mobile-nav-contacts"
          data-active={isActive(`${prefix}/contacts`) || undefined}
        >
          <BookUser className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Contacts</span>
        </button>
        <button
          onClick={() => setLocation(`${prefix}/conversations`)}
          className={cn(
            "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors",
            isActive(`${prefix}/conversations`)
              ? "text-brand-blue"
              : "text-muted-foreground"
          )}
          data-testid="mobile-nav-conversations"
          data-active={isActive(`${prefix}/conversations`) || undefined}
        >
          <MessageSquare className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Chats</span>
        </button>
        <button
          onClick={onToggleMobileMenu}
          className={cn(
            "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors",
            isMobileMenuOpen ? "text-brand-blue" : "text-muted-foreground"
          )}
          data-testid="mobile-nav-menu"
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          <span className="text-[10px] font-semibold">Menu</span>
        </button>
      </div>

      {/* DESKTOP SIDEBAR */}
      <aside
        className={cn(
          "fixed left-0 top-0 bottom-0 bg-stone-200 dark:bg-stone-900 border-r border-stone-300/70 dark:border-stone-700/60 hidden md:flex flex-col overflow-hidden transition-all duration-200",
          collapsed ? "w-[60px]" : "w-[180px]"
        )}
        data-sidebar-focus
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* LOGO — fixed 64px header matching topbar */}
          <div
            className={cn(
              "h-16 flex items-center border-b border-stone-300/70 dark:border-stone-700/60 shrink-0",
              collapsed ? "justify-center" : "px-4 gap-2.5"
            )}
          >
            <Link href="/">
              <img
                src="/6. Favicon.svg"
                alt="Lead Awaker"
                className="h-8 w-8 shrink-0"
              />
            </Link>
            {!collapsed && (
              <div className="flex flex-col gap-0 min-w-0">
                <span className="text-[13px] font-bold text-foreground tracking-tight leading-none truncate">
                  Lead Awaker
                </span>
                <span className="text-[10px] text-muted-foreground font-medium tracking-tight leading-tight">
                  Sales CRM
                </span>
              </div>
            )}
          </div>

          {/* ACCOUNT SWITCHER — agency users only */}
          {isAgencyUser && (
            <div className="px-3 mb-3" data-testid="sidebar-account-switcher">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {collapsed ? (
                    <button
                      className="relative group w-full h-10 rounded-xl flex items-center justify-center hover:bg-black/8 dark:hover:bg-white/10 transition-colors"
                      data-testid="sidebar-account-switcher-trigger"
                    >
                      <div
                        className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                          currentAccountId === 1
                            ? "bg-brand-yellow text-brand-yellow-foreground"
                            : "bg-brand-blue text-brand-blue-foreground"
                        )}
                      >
                        {currentAccount?.name?.[0] || "?"}
                      </div>
                      {/* Tooltip on hover */}
                      <div className="absolute left-[40px] opacity-0 group-hover:opacity-100 transition-opacity z-[120] pointer-events-none">
                        <div className="px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap bg-card text-foreground shadow-lg">
                          {currentAccount?.name || "Select Account"}
                        </div>
                      </div>
                    </button>
                  ) : (
                    <button
                      className={cn(
                        "w-full rounded-xl border border-stone-300/80 dark:border-stone-600/60 px-3 py-2.5 flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-left",
                        currentAccountId === 1
                          ? "bg-brand-yellow/10"
                          : "bg-brand-blue/10"
                      )}
                      data-testid="sidebar-account-switcher-trigger"
                    >
                      <div
                        className={cn(
                          "h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0",
                          currentAccountId === 1
                            ? "bg-brand-yellow text-brand-yellow-foreground"
                            : "bg-brand-blue text-brand-blue-foreground"
                        )}
                      >
                        {currentAccount?.name?.[0] || "?"}
                      </div>
                      <span className="text-xs font-semibold truncate flex-1 text-foreground">
                        {currentAccount?.name || "Select Account"}
                      </span>
                      <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </button>
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="right"
                  align="start"
                  className="w-56 rounded-2xl shadow-xl border-border bg-background"
                >
                  <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Switch Account
                  </div>
                  {[...accounts].sort((a, b) => a.id === 1 ? -1 : b.id === 1 ? 1 : 0).map((acc) => (
                    <DropdownMenuItem
                      key={acc.id}
                      onClick={() => handleAccountSelect(acc.id)}
                      className={cn(
                        "flex items-center gap-2 cursor-pointer py-2.5 rounded-xl mx-1",
                        currentAccountId === acc.id && "bg-muted font-bold"
                      )}
                      data-testid={`sidebar-account-option-${acc.id}`}
                    >
                      <div
                        className={cn(
                          "h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0",
                          acc.id === 1
                            ? "bg-brand-yellow text-brand-yellow-foreground"
                            : "bg-brand-blue text-brand-blue-foreground"
                        )}
                      >
                        {acc.name?.[0] || "?"}
                      </div>
                      <span className="text-sm truncate flex-1">{acc.name}</span>
                      {currentAccountId === acc.id && (
                        <Check className="h-4 w-4 text-brand-blue shrink-0" />
                      )}
                      {acc.id === 1 && (
                        <span className="text-[9px] bg-brand-yellow/15 text-brand-yellow px-1 rounded uppercase font-bold tracking-tighter shrink-0">
                          Agency
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* NAV */}
          <nav className="px-2 space-y-0.5 flex-1 overflow-y-auto min-h-0 py-2">
            {visibleNavItems.map((it) => {
              const active = isActive(it.href);
              const Icon = it.icon;

              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={cn(
                    "relative group flex items-center gap-3 rounded-lg transition-colors",
                    collapsed ? "h-10 w-10 mx-auto justify-center" : "px-3 h-9",
                    active
                      ? "bg-brand-blue text-white font-semibold shadow-sm"
                      : "text-stone-600 dark:text-stone-400 hover:bg-black/8 dark:hover:bg-white/10 hover:text-foreground"
                  )}
                  data-testid={`link-${it.testId}`}
                  data-active={active || undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <span className="text-sm font-medium">
                      {it.label}
                    </span>
                  )}

                  {/* Collapsed tooltip */}
                  {collapsed && (
                    <div className="absolute left-[44px] opacity-0 group-hover:opacity-100 transition-opacity z-[120] pointer-events-none">
                      <div
                        className={cn(
                          "px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap shadow-lg",
                          active
                            ? "bg-brand-blue text-white"
                            : "bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-foreground"
                        )}
                      >
                        {it.label}
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* BOTTOM ACTIONS */}
          <div className="px-2 mb-2 space-y-0.5 shrink-0 border-t border-stone-300/70 dark:border-stone-700/60 pt-2">
            {/* COLLAPSE */}
            <button
              onClick={() => onCollapse(!collapsed)}
              className={cn(
                "w-full h-9 rounded-lg flex items-center gap-3 text-stone-500 dark:text-stone-400 hover:text-foreground hover:bg-black/8 dark:hover:bg-white/10 transition-colors",
                collapsed ? "justify-center" : "px-3"
              )}
            >
              {collapsed ? (
                <PanelRightClose className="h-5 w-5" />
              ) : (
                <PanelRightOpen className="h-5 w-5" />
              )}
              {!collapsed && <span className="font-bold text-sm">Collapse</span>}
            </button>

            {/* HELP */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "w-full h-9 rounded-lg flex items-center gap-3 text-stone-500 dark:text-stone-400 hover:text-foreground hover:bg-black/8 dark:hover:bg-white/10 transition-colors",
                    collapsed ? "justify-center" : "px-3"
                  )}
                >
                  <HelpCircle className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="font-medium text-sm">Help</span>}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start">
                <DropdownMenuItem onClick={onOpenSupport}>
                  <Headphones className="h-4 w-4 mr-2" />
                  Support
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleHelp}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Documentation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* DB STATUS INDICATOR */}
          <div className="px-3 mb-1 shrink-0">
            <DbStatusIndicator collapsed={collapsed} />
          </div>

        </div>
      </aside>
    </>
  );
}