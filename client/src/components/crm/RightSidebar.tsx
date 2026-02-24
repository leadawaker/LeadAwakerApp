import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
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
  ChevronsUpDown,
  Check,
  Menu,
  X,
  Building2,
  LogOut,
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
  onOpenSearch: _onOpenSearch,
  onOpenNotifications: _onOpenNotifications,
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

  const [hoveredNav, setHoveredNav] = useState<{ label: string; active: boolean; y: number } | null>(null);

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
          "fixed left-0 top-16 bottom-0 bg-background hidden md:flex flex-col overflow-hidden transition-all duration-200",
          collapsed ? "w-[72px]" : "w-[216px]"
        )}
        data-sidebar-focus
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* HEADER — "Menu" label + collapse button */}
          <div
            className={cn(
              "flex items-center shrink-0 px-2 mt-7 mb-2 h-[48px]",
              collapsed ? "justify-center" : "justify-between"
            )}
          >
            {!collapsed && (
              <span className="text-2xl font-semibold font-heading text-foreground pl-1">Menu</span>
            )}
            <button
              onClick={() => onCollapse(!collapsed)}
              className="icon-circle-lg icon-circle-base"
              title={collapsed ? "Expand menu" : "Collapse menu"}
            >
              {collapsed ? (
                <PanelRightClose className="h-3.5 w-3.5" />
              ) : (
                <PanelRightOpen className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* NAV — categorized sections */}
          <nav className="px-2 flex-1 overflow-y-auto min-h-0 pb-2">
            {/* Section: (top — Dashboard) */}
            {visibleNavItems.filter(it => it.label === "Dashboard").map((it) => {
              const active = isActive(it.href);
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={cn(
                    "relative flex items-center gap-2.5 transition-colors mb-0.5 rounded-full",
                    collapsed ? "w-full h-[48px] justify-center" : "h-[48px] pl-[2px] pr-2",
                    active
                      ? "bg-[#FFF375] text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-card hover:text-foreground"
                  )}
                  data-testid={`link-${it.testId}`}
                  data-active={active || undefined}
                  onMouseEnter={collapsed ? (e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredNav({ label: it.label, active, y: rect.top });
                  } : undefined}
                  onMouseLeave={collapsed ? () => setHoveredNav(null) : undefined}
                >
                  <div className="h-[44px] w-[44px] rounded-full border-2 border-border/30 flex items-center justify-center shrink-0">
                    <Icon className="h-[17px] w-[17px]" />
                  </div>
                  {!collapsed && (
                    <span className="text-sm font-medium">{it.label}</span>
                  )}
                </Link>
              );
            })}

            {/* Section: Engage */}
            {(() => {
              const engageItems = visibleNavItems.filter(it =>
                ["Campaigns", "Leads", "Chats", "Calendar"].includes(it.label)
              );
              if (engageItems.length === 0) return null;
              return (
                <div className="mt-1">
                  {collapsed ? (
                    <div className="mx-auto w-5 border-t border-border/30 my-1.5" />
                  ) : (
                    <div className="px-1 pt-1.5 pb-0.5">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        Engage
                      </span>
                    </div>
                  )}
                  {engageItems.map((it) => {
                    const active = isActive(it.href);
                    const Icon = it.icon;
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        className={cn(
                          "relative flex items-center gap-2.5 rounded-full transition-colors mb-0.5",
                          collapsed ? "w-full h-[48px] justify-center" : "h-[48px] pl-[2px] pr-2",
                          active
                            ? "bg-[#FFF375] text-foreground font-semibold"
                            : "text-muted-foreground hover:bg-card hover:text-foreground"
                        )}
                        data-testid={`link-${it.testId}`}
                        data-active={active || undefined}
                        onMouseEnter={collapsed ? (e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredNav({ label: it.label, active, y: rect.top });
                        } : undefined}
                        onMouseLeave={collapsed ? () => setHoveredNav(null) : undefined}
                      >
                        <div className="h-[44px] w-[44px] rounded-full border-2 border-border/30 flex items-center justify-center shrink-0">
                          <Icon className="h-[17px] w-[17px]" />
                        </div>
                        {!collapsed && (
                          <span className="text-sm font-medium">{it.label}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              );
            })()}

            {/* Section: Admin (agency only) */}
            {(() => {
              const adminItems = visibleNavItems.filter(it =>
                ["Accounts", "Users", "Tags", "Library", "Automations"].includes(it.label)
              );
              if (adminItems.length === 0) return null;
              return (
                <div className="mt-1">
                  {collapsed ? (
                    <div className="mx-auto w-5 border-t border-border/30 my-1.5" />
                  ) : (
                    <div className="px-1 pt-1.5 pb-0.5">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        Admin
                      </span>
                    </div>
                  )}
                  {adminItems.map((it) => {
                    const active = isActive(it.href);
                    const Icon = it.icon;
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        className={cn(
                          "relative flex items-center gap-2.5 rounded-full transition-colors mb-0.5",
                          collapsed ? "w-full h-[48px] justify-center" : "h-[48px] pl-[2px] pr-2",
                          active
                            ? "bg-[#FFF375] text-foreground font-semibold"
                            : "text-muted-foreground hover:bg-card hover:text-foreground"
                        )}
                        data-testid={`link-${it.testId}`}
                        data-active={active || undefined}
                        onMouseEnter={collapsed ? (e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredNav({ label: it.label, active, y: rect.top });
                        } : undefined}
                        onMouseLeave={collapsed ? () => setHoveredNav(null) : undefined}
                      >
                        <div className="h-[44px] w-[44px] rounded-full border-2 border-border/30 flex items-center justify-center shrink-0">
                          <Icon className="h-[17px] w-[17px]" />
                        </div>
                        {!collapsed && (
                          <span className="text-sm font-medium">{it.label}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              );
            })()}
          </nav>

          {/* BOTTOM ACTIONS */}
          <div className="px-2 mb-2 shrink-0 pt-1">
            {/* HELP */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "w-full h-[48px] rounded-full flex items-center gap-2.5 text-muted-foreground hover:text-foreground hover:bg-card transition-colors",
                    collapsed ? "justify-center" : "px-2"
                  )}
                >
                  <div className="h-[44px] w-[44px] rounded-full border-2 border-border/30 flex items-center justify-center shrink-0">
                    <HelpCircle className="h-[17px] w-[17px]" />
                  </div>
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

        {/* Fixed-position pill tooltip — appears as an extension of the nav button */}
        {collapsed && hoveredNav && (
          <div
            className={cn(
              "fixed z-[150] pointer-events-none",
              "flex items-center h-10 px-3 pr-4 whitespace-nowrap",
              "text-sm font-semibold rounded-r-lg",
              "shadow-[2px_2px_10px_rgba(0,0,0,0.12)]",
              hoveredNav.active
                ? "bg-[#FFF375] text-foreground"
                : "bg-card text-foreground"
            )}
            style={{ left: 72, top: hoveredNav.y }}
          >
            {hoveredNav.label}
          </div>
        )}
      </aside>
    </>
  );
}