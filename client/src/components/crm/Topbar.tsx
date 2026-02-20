import { useLocation, Link } from "wouter";
import { Bell, Search, Settings, ChevronDown, Moon, Sun, ChevronRight, Home, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Campaign = {
  id: number;
  Accounts_id?: number;
  account_id?: number;
  name: string;
  [key: string]: unknown;
};

export function Topbar({
  onOpenPanel,
  collapsed,
  isMobileMenuOpen,
  onToggleMobileMenu,
  notificationsCount = 0,
}: {
  onOpenPanel: (panel: string) => void;
  collapsed: boolean;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
  notificationsCount?: number;
}) {
  const [location, setLocation] = useLocation();
  const { currentAccountId, currentAccount, setCurrentAccountId, isAgencyView, accounts, isAdmin } = useWorkspace();
  const { isDark, toggleTheme } = useTheme();

  // Fetch campaigns from API
  const { data: campaignsData } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 5 * 60 * 1000,
  });

  const campaignOptions = useMemo(() => {
    if (!campaignsData) return [];
    return campaignsData.filter((c) => (c.Accounts_id ?? c.account_id) === currentAccountId);
  }, [campaignsData, currentAccountId]);

  const handleAccountSelect = (id: number) => {
    const prevIsAgency = currentAccountId === 1;
    const prevBase = prevIsAgency ? "/agency" : "/subaccount";

    setCurrentAccountId(id);

    const nextIsAgency = id === 1;
    const nextBase = nextIsAgency ? "/agency" : "/subaccount";

    const tail = location.startsWith(prevBase)
      ? location.slice(prevBase.length)
      : location.replace(/^\/(agency|subaccount)/, "");

    const nextPath = `${nextBase}${tail || "/dashboard"}`;
    setLocation(nextPath);
  };

  const titles: Record<string, string> = {
    "/agency/dashboard": "Dashboard",
    "/subaccount/dashboard": "Dashboard",
    "/agency/leads": "Contacts",
    "/subaccount/leads": "Contacts",
    "/agency/contacts": "Contacts",
    "/subaccount/contacts": "Contacts",
    "/agency/conversations": "Conversations",
    "/subaccount/conversations": "Conversations",
    "/agency/campaigns": "Campaigns",
    "/subaccount/campaigns": "Campaigns",
    "/agency/automation-logs": "Automation",
    "/subaccount/automation-logs": "Automation",
    "/agency/calendar": "Calendar",
    "/subaccount/calendar": "Calendar",
    "/agency/users": "Users",
    "/subaccount/users": "Users",
    "/agency/tags": "Tags",
    "/subaccount/tags": "Tags",
    "/agency/prompt-library": "Prompts",
    "/subaccount/prompt-library": "Prompts",
    "/agency/accounts": "Accounts",
    "/subaccount/accounts": "Accounts",
    "/agency/settings": "Settings",
    "/subaccount/settings": "Settings",
  };

  const currentTitle = titles[location] || "";

  // Build breadcrumb trail from location
  const breadcrumbs = useMemo(() => {
    const prefix = isAgencyView ? "/agency" : "/subaccount";
    const crumbs: { label: string; href: string }[] = [];

    // Always start with home/dashboard
    crumbs.push({ label: "Home", href: `${prefix}/dashboard` });

    // Get the path after the prefix
    const pathAfterPrefix = location.startsWith(prefix)
      ? location.slice(prefix.length)
      : "";
    const segments = pathAfterPrefix.split("/").filter(Boolean);

    // Map known segments to labels
    const segmentLabels: Record<string, string> = {
      dashboard: "Dashboard",
      leads: "Contacts",
      contacts: "Contacts",
      conversations: "Conversations",
      campaigns: "Campaigns",
      calendar: "Calendar",
      settings: "Settings",
      accounts: "Accounts",
      users: "Users",
      tags: "Tags",
      "prompt-library": "Prompts",
      "automation-logs": "Automations",
    };

    let builtPath = prefix;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      builtPath += `/${seg}`;
      const label = segmentLabels[seg] || (seg.match(/^\d+$/) ? `#${seg}` : seg);
      // Don't duplicate "Dashboard" since Home already represents it
      if (seg === "dashboard") continue;
      crumbs.push({ label, href: builtPath });
    }

    return crumbs;
  }, [location, isAgencyView]);

  // User info from localStorage (set at login)
  const currentUserName = localStorage.getItem("leadawaker_user_name") || localStorage.getItem("leadawaker_account_name") || "User";
  const currentUserEmail = localStorage.getItem("leadawaker_user_email") || "";
  const currentUserAvatar = localStorage.getItem("leadawaker_user_avatar") || "";

  // Generate initials from user name
  const userInitials = useMemo(() => {
    const parts = currentUserName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (parts[0]?.[0] || "U").toUpperCase();
  }, [currentUserName]);

  return (
    <header
      className={cn(
        "fixed top-0 right-0 h-20 bg-background/50 backdrop-blur-xl z-50 flex items-center px-4 md:px-10 transition-all duration-200 ease-out border-b border-border/50 [mask-image:linear-gradient(to_bottom,black_85%,transparent_100%)] pt-4",
        "left-0",
        "md:left-[80px]",
        !collapsed && "md:left-[200px]"
      )}
      data-testid="header-crm-topbar"
    >
      <div className="flex-1 flex items-center justify-start gap-3 min-w-0">
        {/* Hamburger button - mobile only */}
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-xl hover:bg-muted/40 text-foreground transition-colors shrink-0"
          data-testid="button-hamburger-menu"
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
        <div className="h-8 w-1.5 bg-brand-blue rounded-full hidden md:block shrink-0" />
        <div className="flex flex-col gap-0.5 min-w-0">
          <h1 className="text-lg md:text-2xl font-bold tracking-tight text-foreground truncate">{currentTitle}</h1>
          <nav aria-label="Breadcrumb" data-testid="breadcrumb-nav" className="hidden sm:block">
            <ol className="flex items-center gap-1 text-xs text-muted-foreground">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <li key={crumb.href} className="flex items-center gap-1">
                    {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
                    {isLast ? (
                      <span className="font-medium text-foreground/70" data-testid={`breadcrumb-current`}>
                        {idx === 0 && <Home className="h-3 w-3 inline mr-1 -mt-0.5" />}
                        {crumb.label}
                      </span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="hover:text-foreground transition-colors font-medium"
                        data-testid={`breadcrumb-link-${idx}`}
                      >
                        {idx === 0 && <Home className="h-3 w-3 inline mr-1 -mt-0.5" />}
                        {crumb.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-6 shrink-0">
        <div className="hidden lg:flex items-center gap-3">
          {isAdmin ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "h-11 px-4 w-56 justify-between hover:bg-white dark:hover:bg-muted border border-border bg-white dark:bg-card rounded-xl text-sm font-semibold flex items-center gap-2",
                    isAgencyView ? "text-brand-yellow" : "text-brand-blue"
                  )}
                  data-testid="button-account-selector"
                >
                  <span className="truncate">{currentAccount?.name || "Select Account"}</span>
                  <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-2xl shadow-xl border-border bg-background mt-2">
                {accounts.map((acc) => (
                  <DropdownMenuItem
                    key={acc.id}
                    onClick={() => handleAccountSelect(acc.id)}
                    className={cn(
                      "flex items-center gap-2 cursor-pointer py-3 rounded-xl m-1",
                      currentAccountId === acc.id && "bg-muted font-bold"
                    )}
                  >
                    <div
                      className={cn(
                        "h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold",
                        acc.id === 1 ? "bg-brand-yellow text-brand-yellow-foreground" : "bg-brand-blue text-brand-blue-foreground",
                      )}
                    >
                      {acc.name?.[0] || "?"}
                    </div>
                    {acc.name}
                    {acc.id === 1 && <span className="ml-auto text-[10px] bg-brand-yellow/15 text-brand-yellow px-1 rounded uppercase font-bold tracking-tighter">Agency</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className={cn(
              "h-11 px-4 w-56 justify-start border border-border bg-white dark:bg-card rounded-xl text-sm font-semibold flex items-center gap-2",
              isAgencyView ? "text-brand-yellow" : "text-brand-blue"
            )}>
              <span className="truncate">{currentAccount?.name || "My Account"}</span>
            </div>
          )}

          {!isAgencyView && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-11 px-4 w-[180px] justify-between hover:bg-white dark:hover:bg-muted border border-border bg-white dark:bg-card rounded-xl text-sm font-semibold flex items-center gap-2"
                  data-testid="select-campaign-topbar-custom"
                >
                  <span className="truncate">
                    {campaignOptions.find(c => c.id === Number(localStorage.getItem("leadawaker_selected_campaign")))?.name || "All campaigns"}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-2xl shadow-xl border-border bg-background mt-2">
                <DropdownMenuItem
                  onClick={() => {
                    localStorage.setItem("leadawaker_selected_campaign", "all");
                    window.dispatchEvent(new Event("storage"));
                  }}
                  className="py-3 rounded-xl m-1 cursor-pointer"
                >
                  All campaigns
                </DropdownMenuItem>
                {campaignOptions.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => {
                      localStorage.setItem("leadawaker_selected_campaign", String(c.id));
                      window.dispatchEvent(new Event("storage"));
                    }}
                    className="py-3 rounded-xl m-1 cursor-pointer"
                  >
                    {c.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>


        <div className="flex items-center gap-1 md:gap-2">
          <button
            onClick={() => onOpenPanel('search')}
            className="hidden sm:flex p-2 md:p-3 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-full transition-all relative"
            data-testid="button-search-top"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 md:p-3 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-full transition-all relative"
            data-testid="button-dark-mode-toggle"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {/* Notifications */}
          <button
            onClick={() => onOpenPanel('notifications')}
            className="p-2 md:p-3 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-full transition-all relative"
            data-testid="button-notifications"
            aria-label={`Notifications${notificationsCount > 0 ? ` (${notificationsCount} unread)` : ''}`}
          >
            <Bell className="h-5 w-5" />
            {notificationsCount > 0 && (
              <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 h-5 w-5 bg-brand-blue rounded-full flex items-center justify-center border-2 border-background" data-testid="badge-notifications-count" aria-hidden="true">
                <span className="text-[10px] font-bold text-white">{notificationsCount > 9 ? '9+' : notificationsCount}</span>
              </div>
            )}
          </button>

          {/* Settings */}
          <button
            onClick={() => onOpenPanel('settings')}
            className="hidden sm:flex p-2 md:p-3 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-full transition-all relative"
            data-testid="button-settings-top"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>

          {/* User avatar */}
          <button
            onClick={() => onOpenPanel('settings')}
            className="ml-1 flex items-center gap-2 hover:opacity-80 transition-opacity"
            data-testid="button-user-avatar"
            title={currentUserName}
          >
            <Avatar className="h-8 w-8 md:h-9 md:w-9 border-2 border-primary/20">
              <AvatarImage src={currentUserAvatar} alt={currentUserName} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </button>
        </div>
      </div>
    </header>
  );
}
