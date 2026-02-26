import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  HelpCircle,
  Headphones,
  MessageSquare,
  Megaphone,
  Calendar,
  ScrollText,
  Users,
  Tag,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  BookUser,
  ChevronsUpDown,
  Check,
  Menu,
  X,
  Building2,
  LogOut,
  Lightbulb,
  Receipt,
  ReceiptText,
  FileText,
} from "lucide-react";
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
  const [location, setLocation] = useLocation();
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
    const prevIsAgency = currentAccountId === 1;
    const prevBase = prevIsAgency ? "/agency" : "/subaccount";

    setCurrentAccountId(id);

    const nextIsAgency = id === 1;
    const nextBase = nextIsAgency ? "/agency" : "/subaccount";

    const tail = location.startsWith(prevBase)
      ? location.slice(prevBase.length)
      : location.replace(/^\/(agency|subaccount)/, "");

    // Agency-only pages don't exist in subaccount view — always go to campaigns
    const agencyOnlyPaths = ["/accounts", "/tags", "/prompt-library", "/automation-logs", "/expenses"];
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
    icon: any;
    testId: string;
    adminOnly?: boolean;
    agencyOnly?: boolean;
    agencyViewOnly?: boolean;
  }[] = [
    { href: `${prefix}/campaigns`, label: "Campaigns", icon: Megaphone, testId: "nav-campaigns" },
    {
      href: `${prefix}/accounts`,
      label: "Accounts",
      icon: Building2,
      testId: "nav-accounts",
      agencyOnly: true,
      agencyViewOnly: true,
    },
    { href: `${prefix}/contacts`, label: "Leads", icon: BookUser, testId: "nav-contacts" },
    { href: `${prefix}/opportunities`, label: "Opportunities", icon: Lightbulb, testId: "nav-opportunities" },
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
    { href: `${prefix}/users`, label: "Users", icon: Users, testId: "nav-users" },
    {
      href: `${prefix}/invoices`,
      label: "Invoices",
      icon: Receipt,
      testId: "nav-invoices",
    },
    {
      href: `${prefix}/expenses`,
      label: "Expenses",
      icon: ReceiptText,
      testId: "nav-expenses",
      agencyOnly: true,
    },
    {
      href: `${prefix}/contracts`,
      label: "Contracts",
      icon: FileText,
      testId: "nav-contracts",
    },
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
    // But don't let /agency/campaigns match sub-routes (campaigns has no sub-routes)
    if (href !== `${prefix}/campaigns` && location.startsWith(href + '/')) return true;
    return false;
  };

  /** Render a single desktop nav link with Radix Tooltip support */
  const renderDesktopNavLink = (it: typeof navItems[0]) => {
    const active = isActive(it.href);
    const Icon = it.icon;
    const showUnreadDot = it.testId === "nav-chats" && !!unreadChatCount && unreadChatCount > 0;

    return (
      <Tooltip key={it.href}>
        <TooltipTrigger asChild>
          <Link
            href={it.href}
            className={cn(
              "relative flex items-center rounded-full transition-colors mb-0.5",
              collapsed
                ? "h-10 w-10 mx-auto justify-center"
                : "h-[43px] pl-[1.5px] pr-2 gap-2.5",
              active
                ? collapsed
                  ? "text-foreground font-semibold"
                  : "bg-[var(--highlight-active)] text-foreground font-semibold"
                : "text-muted-foreground hover:bg-card hover:text-foreground"
            )}
            data-testid={`link-${it.testId}`}
            data-active={active || undefined}
          >
            <div className={cn(
              "relative h-10 w-10 rounded-full flex items-center justify-center shrink-0",
              active && collapsed
                ? "bg-[var(--highlight-active)]"
                : !active ? "border border-border/65" : ""
            )}>
              <Icon className="h-4 w-4" />
              {showUnreadDot && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 border border-background" />
              )}
            </div>
            {!collapsed && (
              <span className="text-sm font-bold">{it.label}</span>
            )}
            {it.testId === "nav-chats" && !collapsed && !!unreadChatCount && unreadChatCount > 0 && (
              <span className="ml-auto h-4 min-w-[1rem] px-1 rounded-full bg-brand-blue text-white text-[10px] font-bold flex items-center justify-center">
                {unreadChatCount > 9 ? "9+" : unreadChatCount}
              </span>
            )}
          </Link>
        </TooltipTrigger>
        {collapsed && (
          <TooltipContent
            side="right"
            className={cn(
              "rounded-lg px-3 h-10 flex items-center text-sm font-semibold shadow-md border-0 ml-1",
              isActive(it.href) ? "bg-[var(--highlight-active)] text-foreground" : "bg-card text-foreground"
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
                        ? "bg-[var(--highlight-active)] text-foreground font-bold shadow-sm"
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
              <button
                onClick={() => { onOpenSupport(); onCloseMobileMenu?.(); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-muted-foreground hover:bg-muted transition-colors"
              >
                <Headphones className="h-4 w-4" />
                <span className="text-sm font-semibold">Support</span>
              </button>
              <button
                onClick={() => { onToggleHelp(); onCloseMobileMenu?.(); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-muted-foreground hover:bg-muted transition-colors"
              >
                <HelpCircle className="h-4 w-4" />
                <span className="text-sm font-semibold">Help</span>
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

      {/* MOBILE BOTTOM BAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-[64px] border-t border-border/50 bg-white/80 dark:bg-card/80 glass-nav z-[100] flex justify-around items-center">
        <button
          onClick={() => setLocation(`${prefix}/campaigns`)}
          className={cn(
            "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors",
            isActive(`${prefix}/campaigns`)
              ? "text-brand-indigo"
              : "text-muted-foreground"
          )}
          data-testid="mobile-nav-campaigns"
          data-active={isActive(`${prefix}/campaigns`) || undefined}
        >
          <Megaphone className="h-4 w-4" />
          <span className="text-[10px] font-semibold">Campaigns</span>
        </button>
        <button
          onClick={() => setLocation(`${prefix}/contacts`)}
          className={cn(
            "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors",
            isActive(`${prefix}/contacts`)
              ? "text-brand-indigo"
              : "text-muted-foreground"
          )}
          data-testid="mobile-nav-contacts"
          data-active={isActive(`${prefix}/contacts`) || undefined}
        >
          <BookUser className="h-4 w-4" />
          <span className="text-[10px] font-semibold">Contacts</span>
        </button>
        <button
          onClick={() => setLocation(`${prefix}/conversations`)}
          className={cn(
            "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors",
            isActive(`${prefix}/conversations`)
              ? "text-brand-indigo"
              : "text-muted-foreground"
          )}
          data-testid="mobile-nav-conversations"
          data-active={isActive(`${prefix}/conversations`) || undefined}
        >
          <MessageSquare className="h-4 w-4" />
          <span className="text-[10px] font-semibold">Chats</span>
        </button>
        <button
          onClick={onToggleMobileMenu}
          className={cn(
            "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors",
            isMobileMenuOpen ? "text-brand-indigo" : "text-muted-foreground"
          )}
          data-testid="mobile-nav-menu"
        >
          {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          <span className="text-[10px] font-semibold">Menu</span>
        </button>
      </div>

      {/* DESKTOP SIDEBAR */}
      <aside
        className={cn(
          "fixed left-0 top-14 bottom-0 bg-background hidden md:flex flex-col overflow-hidden transition-[width] duration-200",
          collapsed ? "w-[86px]" : "w-[259px]"
        )}
        data-sidebar-focus
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* HEADER — "Menu" label + collapse button */}
          <div
            className={cn(
              "flex items-center shrink-0 px-2 mt-7 mb-2 h-10",
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
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* NAV — categorized sections */}
          <TooltipProvider delayDuration={300}>
            <nav className="px-2 flex-1 overflow-y-auto min-h-0 pb-2">
              {/* Section: (top — Campaigns) */}
              {visibleNavItems.filter(it => it.label === "Campaigns").map((it) => renderDesktopNavLink(it))}

              {/* Section: Engage */}
              {(() => {
                const engageItems = visibleNavItems.filter(it =>
                  ["Leads", "Opportunities", "Chats", "Calendar"].includes(it.label)
                );
                if (engageItems.length === 0) return null;
                return (
                  <div className="mt-4">
                    {collapsed ? (
                      <div className="mx-auto w-5 border-t border-border/30 my-3" />
                    ) : (
                      <div className="px-1 pt-1.5 pb-0.5">
                        <span className="text-[11px] font-bold tracking-wide text-muted-foreground/60">
                          Engage
                        </span>
                      </div>
                    )}
                    {engageItems.map((it) => renderDesktopNavLink(it))}
                  </div>
                );
              })()}

              {/* Section: Admin (agency only) */}
              {(() => {
                const adminItems = visibleNavItems.filter(it =>
                  ["Accounts", "Users"].includes(it.label)
                );
                if (adminItems.length === 0) return null;
                return (
                  <div className="mt-4">
                    {collapsed ? (
                      <div className="mx-auto w-5 border-t border-border/30 my-3" />
                    ) : (
                      <div className="px-1 pt-1.5 pb-0.5">
                        <span className="text-[11px] font-bold tracking-wide text-muted-foreground/60">
                          Admin
                        </span>
                      </div>
                    )}
                    {adminItems.map((it) => renderDesktopNavLink(it))}
                  </div>
                );
              })()}

              {/* Section: Billing */}
              {(() => {
                const billingItems = visibleNavItems.filter(it =>
                  ["Invoices", "Expenses", "Contracts"].includes(it.label)
                );
                if (billingItems.length === 0) return null;
                return (
                  <div className="mt-4">
                    {collapsed ? (
                      <div className="mx-auto w-5 border-t border-border/30 my-3" />
                    ) : (
                      <div className="px-1 pt-1.5 pb-0.5">
                        <span className="text-[11px] font-bold tracking-wide text-muted-foreground/60">
                          Billing
                        </span>
                      </div>
                    )}
                    {billingItems.map((it) => renderDesktopNavLink(it))}
                  </div>
                );
              })()}

              {/* Section: Backend (agency only) */}
              {(() => {
                const backendItems = visibleNavItems.filter(it =>
                  ["Tags", "Library", "Automations"].includes(it.label)
                );
                if (backendItems.length === 0) return null;
                return (
                  <div className="mt-4">
                    {collapsed ? (
                      <div className="mx-auto w-5 border-t border-border/30 my-3" />
                    ) : (
                      <div className="px-1 pt-1.5 pb-0.5">
                        <span className="text-[11px] font-bold tracking-wide text-muted-foreground/60">
                          Backend
                        </span>
                      </div>
                    )}
                    {backendItems.map((it) => renderDesktopNavLink(it))}
                  </div>
                );
              })()}
            </nav>
          </TooltipProvider>


        </div>
      </aside>
    </>
  );
}
