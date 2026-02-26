import { useLocation } from "wouter";
import { Bell, Search, Settings, Moon, Sun, Menu, X, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";

export function Topbar({
  onOpenPanel,
  collapsed,
  isMobileMenuOpen,
  onToggleMobileMenu,
  notificationsCount = 0,
  onLogout,
}: {
  onOpenPanel: (panel: string) => void;
  collapsed: boolean;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
  notificationsCount?: number;
  onLogout?: () => void;
}) {
  const [location, setLocation] = useLocation();
  const { isAgencyView } = useWorkspace();
  const { isDark, toggleTheme } = useTheme();

  const titles: Record<string, string> = {
    "/agency/leads": "Leads",
    "/subaccount/leads": "Leads",
    "/agency/contacts": "Leads",
    "/subaccount/contacts": "Leads",
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

  const { topbarActions } = useTopbarActions();

  return (
    <header
      className={cn(
        "fixed top-0 right-0 h-16 bg-background/95 backdrop-blur-xl z-50 flex items-center px-4 md:px-8 transition-all duration-200 ease-out border-b border-border",
        "left-0",
        "md:left-[60px]",
        !collapsed && "md:left-[180px]"
      )}
      data-testid="header-crm-topbar"
    >
      <div className="flex-1 flex items-center justify-start gap-3 min-w-0">
        {/* Hamburger button - mobile only */}
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors shrink-0"
          data-testid="button-hamburger-menu"
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-foreground shrink-0">{currentTitle}</h1>
        {topbarActions && (
          <>
            <div className="h-5 w-px bg-border/60 shrink-0" aria-hidden="true" />
            <div className="flex items-center">{topbarActions}</div>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 md:gap-2 shrink-0">
        <button
          onClick={() => onOpenPanel('search')}
          className="hidden sm:flex p-2 md:p-3 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all relative"
          data-testid="button-search-top"
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 md:p-3 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all relative"
          data-testid="button-dark-mode-toggle"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* Notifications */}
        <button
          onClick={() => onOpenPanel('notifications')}
          className="p-2 md:p-3 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all relative"
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

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
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
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-2xl shadow-xl border-border bg-background mt-2">
            <div className="px-3 py-2.5 border-b border-border/40">
              <div className="text-sm font-semibold truncate">{currentUserName}</div>
              {currentUserEmail && <div className="text-xs text-muted-foreground truncate">{currentUserEmail}</div>}
            </div>
            <DropdownMenuItem
              onClick={() => setLocation(isAgencyView ? "/agency/settings" : "/subaccount/settings")}
              className="flex items-center gap-2 cursor-pointer py-2.5 rounded-xl mx-1 mt-1"
              data-testid="button-user-settings"
            >
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onLogout}
              className="flex items-center gap-2 cursor-pointer py-2.5 rounded-xl mx-1 mb-1 text-red-600 focus:text-red-600"
              data-testid="button-user-logout"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
