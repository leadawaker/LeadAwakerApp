import { useTranslation } from "react-i18next";
import { Moon, Sun, LogOut, Check, User, Headphones, ClipboardList } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface TopbarUserMenuAccount {
  id: number;
  name: string;
  logo_url?: string | null;
}

export interface TopbarUserMenuProps {
  /** "desktop" renders the larger avatar without touch-target sizing;
   *  "mobile" renders the smaller avatar with touch-target sizing. */
  variant: "desktop" | "mobile";
  currentUserName: string;
  currentUserEmail: string;
  currentUserAvatar: string;
  userInitials: string;
  isAgencyUser: boolean;
  isAgencyView: boolean;
  currentAccountId: number;
  accounts: TopbarUserMenuAccount[];
  isDark: boolean;
  onToggleTheme: () => void;
  onAccountSelect: (id: number) => void;
  onNavigateSettings: () => void;
  onNavigateTasks: () => void;
  onToggleSupport: () => void;
  onLogout?: () => void;
}

export function TopbarUserMenu({
  variant,
  currentUserName,
  currentUserEmail,
  currentUserAvatar,
  userInitials,
  isAgencyUser,
  isAgencyView,
  currentAccountId,
  accounts,
  isDark,
  onToggleTheme,
  onAccountSelect,
  onNavigateSettings,
  onNavigateTasks,
  onToggleSupport,
  onLogout,
}: TopbarUserMenuProps) {
  const { t } = useTranslation("crm");

  const avatarRingClass = isAgencyUser && isAgencyView
    ? "ring-2 ring-brand-yellow ring-offset-1 ring-offset-background"
    : "";

  const avatarFallbackClass = cn(
    "text-xs font-bold",
    isAgencyUser && (currentAccountId === 0 || currentAccountId === 1)
      ? "bg-brand-yellow text-brand-yellow-foreground"
      : isAgencyUser
      ? "bg-brand-indigo text-brand-indigo-foreground"
      : "bg-primary text-primary-foreground"
  );

  const sortedAccounts = [...accounts].sort((a, b) => a.name.localeCompare(b.name));

  if (variant === "mobile") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center hover:opacity-80 transition-opacity shrink-0 min-h-[44px] min-w-[44px] justify-center touch-target"
            data-testid="button-user-avatar-mobile"
            aria-label={`${currentUserName} — ${t("topbar.myProfile")}`}
            title={currentUserName}
          >
            <Avatar className={cn("h-8 w-8", avatarRingClass)}>
              <AvatarImage src={currentUserAvatar} alt={currentUserName} />
              <AvatarFallback className={avatarFallbackClass}>
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 rounded-2xl shadow-xl border-black/[0.08] bg-white dark:bg-popover mt-2">
          {/* Header: name + email */}
          <div className="px-3 py-2.5 border-b border-border/40">
            <div className="text-sm font-semibold truncate">{currentUserName}</div>
            {currentUserEmail && <div className="text-xs text-muted-foreground truncate">{currentUserEmail}</div>}
          </div>

          {/* Theme toggle */}
          <DropdownMenuItem
            onClick={onToggleTheme}
            className="flex items-center gap-2 cursor-pointer min-h-[44px] rounded-xl mx-1 mt-1"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {t("topbar.toggleDarkMode")}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="mx-2" />

          {/* Account Switcher (agency admin only) */}
          {isAgencyUser && accounts.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {t("topbar.switchAccount")}
              </div>
              <div
                className="max-h-[220px] overflow-y-auto"
                data-testid="account-switcher-scroll-container"
              >
                <DropdownMenuItem
                  onClick={() => onAccountSelect(0)}
                  className={cn("flex items-center gap-2 cursor-pointer min-h-[44px] rounded-xl mx-1", currentAccountId === 0 && "font-semibold")}
                  data-testid="button-account-switcher-agency-mobile"
                >
                  <div className="h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 bg-brand-yellow text-brand-yellow-foreground">
                    <img src="/6. Favicon.svg" alt="" className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm truncate flex-1">{t("topbar.allAccounts")}</span>
                  {currentAccountId === 0 && <Check className="h-3 w-3 text-muted-foreground shrink-0" />}
                </DropdownMenuItem>
                {sortedAccounts.map((acc) => (
                  <DropdownMenuItem
                    key={acc.id}
                    onClick={() => onAccountSelect(acc.id)}
                    className={cn("flex items-center gap-2 cursor-pointer min-h-[44px] rounded-xl mx-1", currentAccountId === acc.id && "font-semibold")}
                    data-testid={`button-account-switcher-${acc.id}-mobile`}
                  >
                    {acc.logo_url ? (
                      <img src={acc.logo_url} alt="" className="h-5 w-5 rounded-md object-cover shrink-0" />
                    ) : (
                      <div className={cn(
                        "h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0",
                        acc.id === 1 ? "bg-brand-yellow text-brand-yellow-foreground" : "bg-brand-indigo text-brand-indigo-foreground"
                      )}>
                        {acc.name?.[0] || "?"}
                      </div>
                    )}
                    <span className="text-sm truncate flex-1">{acc.name}</span>
                    {currentAccountId === acc.id && <Check className="h-3 w-3 text-muted-foreground shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </div>
              <DropdownMenuSeparator className="mx-2 mt-1" />
            </>
          )}

          {/* Tasks link (agency admin only) */}
          {isAgencyUser && (
            <DropdownMenuItem
              onClick={onNavigateTasks}
              className="flex items-center gap-2 cursor-pointer min-h-[44px] rounded-xl mx-1"
              data-testid="button-tasks-mobile"
            >
              <ClipboardList className="h-4 w-4" />
              {t("sidebar.tasks")}
            </DropdownMenuItem>
          )}

          {/* My Profile / Settings */}
          <DropdownMenuItem
            onClick={onNavigateSettings}
            className="flex items-center gap-2 cursor-pointer min-h-[44px] rounded-xl mx-1"
            data-testid="button-view-my-profile-mobile"
          >
            <User className="h-4 w-4" />
            {t("topbar.myProfile")}
          </DropdownMenuItem>

          {/* Logout */}
          <DropdownMenuItem
            onClick={onLogout}
            className="flex items-center gap-2 cursor-pointer min-h-[44px] rounded-xl mx-1 mb-1 text-red-600 focus:text-red-600"
            data-testid="button-user-logout-mobile"
          >
            <LogOut className="h-4 w-4" />
            {t("topbar.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Desktop variant
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="ml-1 flex items-center gap-2 hover:opacity-80 transition-opacity"
          data-testid="button-user-avatar"
          title={currentUserName}
        >
          <Avatar className={cn(
            "h-10 w-10",
            isAgencyUser && isAgencyView && "ring-2 ring-brand-yellow ring-offset-2 ring-offset-background"
          )}>
            <AvatarImage src={currentUserAvatar} alt={currentUserName} />
            <AvatarFallback className={cn(
              "text-xs font-bold",
              isAgencyUser && (currentAccountId === 0 || currentAccountId === 1)
                ? "bg-brand-yellow text-brand-yellow-foreground"
                : isAgencyUser
                ? "bg-brand-indigo text-brand-indigo-foreground"
                : "bg-primary text-primary-foreground"
            )}>
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl shadow-xl border-black/[0.08] bg-white dark:bg-popover mt-2">
        <div className="px-3 py-2.5 border-b border-border/40">
          <div className="text-sm font-semibold truncate">{currentUserName}</div>
          {currentUserEmail && <div className="text-xs text-muted-foreground truncate">{currentUserEmail}</div>}
        </div>

        {/* Mobile-only items (hidden on md+) */}
        <div className="md:hidden">
          <DropdownMenuItem
            onClick={onToggleTheme}
            className="flex items-center gap-2 cursor-pointer py-2.5 rounded-xl mx-1 mt-1"
            data-testid="button-dark-mode-toggle-mobile"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {t("topbar.toggleDarkMode")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onToggleSupport}
            className="flex items-center gap-2 cursor-pointer py-2.5 rounded-xl mx-1"
            data-testid="button-support-chat-mobile"
          >
            <Headphones className="h-4 w-4" />
            {t("topbar.customerSupport")}
          </DropdownMenuItem>
          <DropdownMenuSeparator className="mx-2" />
        </div>

        {/* Account switcher moved to title dropdown for agency admins */}

        <DropdownMenuItem
          onClick={onNavigateSettings}
          className="flex items-center gap-2 cursor-pointer py-2.5 rounded-xl mx-1 mt-1"
          data-testid="button-view-my-profile"
        >
          <User className="h-4 w-4" />
          {t("topbar.myProfile")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onLogout}
          className="flex items-center gap-2 cursor-pointer py-2.5 rounded-xl mx-1 mb-1 text-red-600 focus:text-red-600"
          data-testid="button-user-logout"
        >
          <LogOut className="h-4 w-4" />
          {t("topbar.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
