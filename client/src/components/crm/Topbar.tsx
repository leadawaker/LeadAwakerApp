import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Bell, Search, Settings, Moon, Sun, Menu, X, LogOut, Check, BookOpen, Share2, Sparkles, Lock } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";
import { ChangePasswordDialog } from "@/components/crm/ChangePasswordDialog";
import { apiFetch } from "@/lib/apiUtils";

type NotifItem = { id: number; title: string; description: string; at: string };

const MOCK_NOTIFS: NotifItem[] = [
  { id: 1, title: "New inbound reply", description: "Lead replied: 'Ok, send me the link.'", at: new Date(Date.now() - 12 * 60 * 1000).toISOString() },
  { id: 2, title: "Automation error", description: "Twilio delivery failed (mock).", at: new Date(Date.now() - 48 * 60 * 1000).toISOString() },
  { id: 3, title: "Booked appointment", description: "A lead booked a call from the calendar link.", at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
];

export function Topbar({
  onOpenPanel,
  collapsed: _collapsed,
  isMobileMenuOpen,
  onToggleMobileMenu,
  onLogout,
}: {
  onOpenPanel: (panel: string) => void;
  collapsed: boolean;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
  onLogout?: () => void;
}) {
  const [location, setLocation] = useLocation();
  const { isAgencyView, isAgencyUser, currentAccountId, accounts, setCurrentAccountId, currentAccount } = useWorkspace();
  const { isDark, toggleTheme } = useTheme();

  // ── Notifications state ──────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<NotifItem[]>(MOCK_NOTIFS);
  const unreadCount = notifications.length;

  // ── Search state ─────────────────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!searchOpen) {
      setSearchQ("");
      return;
    }
    const params = new URLSearchParams();
    if (currentAccountId) params.set("accountId", String(currentAccountId));
    apiFetch(`/api/leads?${params}`).then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setAllLeads(Array.isArray(data) ? data : []);
      }
    }).catch(() => {});
  }, [searchOpen, currentAccountId]);

  const searchResults = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [] as { id: number; name: string; phone: string; email: string }[];
    return allLeads
      .filter((l: any) =>
        [l.full_name || "", l.name || "", l.phone || "", l.email || l.Email || ""].some((v: string) => v.toLowerCase().includes(q))
      )
      .slice(0, 8)
      .map((l: any) => ({
        id: l.Id || l.id,
        name: l.full_name || l.name || `Lead #${l.Id || l.id}`,
        phone: l.phone || "",
        email: l.email || l.Email || "",
      }));
  }, [searchQ, allLeads]);

  const handleLeadClick = (leadId: number) => {
    sessionStorage.setItem("pendingLeadId", String(leadId));
    setSearchOpen(false);
    const base = isAgencyView ? "/agency" : "/subaccount";
    setLocation(`${base}/leads`);
  };

  // ── Account switch ───────────────────────────────────────────────────────────
  const handleAccountSelect = (id: number) => {
    const prevIsAgency = currentAccountId === 1;
    const prevBase = prevIsAgency ? "/agency" : "/subaccount";
    setCurrentAccountId(id);
    const nextIsAgency = id === 1;
    const nextBase = nextIsAgency ? "/agency" : "/subaccount";
    const tail = location.startsWith(prevBase)
      ? location.slice(prevBase.length)
      : location.replace(/^\/(agency|subaccount)/, "");
    const agencyOnlyPaths = ["/accounts", "/tags", "/users", "/prompt-library", "/automation-logs"];
    const isAgencyOnlyPage = agencyOnlyPaths.some((p) => tail.startsWith(p));
    const safeTail = (!nextIsAgency && isAgencyOnlyPage) ? "/dashboard" : tail;
    setLocation(`${nextBase}${safeTail || "/dashboard"}`);
  };

  const titles: Record<string, string> = {
    "/agency/dashboard": "Dashboard",
    "/subaccount/dashboard": "Dashboard",
    "/agency/leads": "",
    "/subaccount/leads": "",
    "/agency/contacts": "",
    "/subaccount/contacts": "",
    "/agency/conversations": "Conversations",
    "/subaccount/conversations": "Conversations",
    "/agency/campaigns": "",
    "/subaccount/campaigns": "",
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
    "/agency/accounts": "",
    "/subaccount/accounts": "",
    "/agency/settings": "Settings",
    "/subaccount/settings": "Settings",
  };

  const currentTitle = titles[location] || "";

  const currentUserName = localStorage.getItem("leadawaker_user_name") || localStorage.getItem("leadawaker_account_name") || "User";
  const currentUserEmail = localStorage.getItem("leadawaker_user_email") || "";
  const currentUserAvatar = localStorage.getItem("leadawaker_user_avatar") || "";

  const userInitials = useMemo(() => {
    const parts = currentUserName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (parts[0]?.[0] || "U").toUpperCase();
  }, [currentUserName]);

  const { topbarActions } = useTopbarActions();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const accountLabel = isAgencyView ? "Agency View" : (currentAccount?.name || "");

  return (
    <header
      className="fixed top-0 left-0 right-0 h-16 bg-background z-50 flex items-center px-4 md:px-6"
      data-testid="header-crm-topbar"
    >
      {/* ── Branding ── */}
      <div className="hidden md:flex items-center gap-2.5 shrink-0 mr-4">
        <a href="/" className="shrink-0">
          <img src="/6. Favicon.svg" alt="Lead Awaker" className="h-6 w-6" />
        </a>
        <span className="font-heading font-bold text-xl text-foreground tracking-tight whitespace-nowrap">
          Lead Awaker
        </span>
        <span className="text-muted-foreground/30 text-xl leading-none select-none">|</span>
        <span className="text-xl font-heading text-foreground tracking-tight whitespace-nowrap">
          {accountLabel}
        </span>
      </div>

      <div className="flex-1 flex items-center justify-start gap-3 min-w-0">
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors shrink-0"
          data-testid="button-hamburger-menu"
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
        {currentTitle && (
          <h1 className="text-2xl font-semibold font-heading tracking-tight text-foreground shrink-0">{currentTitle}</h1>
        )}
        {topbarActions && (
          <>
            <div className="h-5 w-px bg-border/60 shrink-0" aria-hidden="true" />
            <div className="flex items-center">{topbarActions}</div>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 md:gap-2 shrink-0">

        {/* ── Search Popover ── */}
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <IconBtn
              className="hidden sm:flex"
              data-testid="button-search-top"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </IconBtn>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-80 p-0 rounded-2xl shadow-xl border-border/60 bg-popover overflow-hidden"
          >
            <div className="p-3 border-b border-border/20">
              <input
                ref={searchInputRef}
                autoFocus
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search leads by name, phone, email…"
                className="h-9 w-full rounded-xl bg-muted/40 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                data-testid="input-search"
              />
            </div>
            {!searchQ.trim() ? (
              <div className="px-4 py-3 text-xs text-muted-foreground">Start typing to search leads…</div>
            ) : searchResults.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">No results found.</div>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-border/10" data-testid="list-search-results">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleLeadClick(r.id)}
                    className="w-full text-left px-4 py-2.5 hover:bg-muted/40 flex flex-col gap-0.5"
                    data-testid={`search-result-lead-${r.id}`}
                  >
                    <span className="text-sm font-medium text-foreground">{r.name}</span>
                    {(r.phone || r.email) && (
                      <span className="text-xs text-muted-foreground">
                        {[r.phone, r.email].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Dark mode toggle */}
        <IconBtn
          onClick={toggleTheme}
          data-testid="button-dark-mode-toggle"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </IconBtn>

        {/* Help */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconBtn data-testid="button-help-top" title="Help" aria-label="Help">
              <span className="text-[13px] font-bold leading-none">?</span>
            </IconBtn>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-2xl shadow-xl border-border bg-background mt-2">
            <DropdownMenuItem className="flex items-center gap-2 cursor-pointer py-2.5 rounded-xl mx-1">
              <BookOpen className="h-4 w-4" />
              Documentation
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center gap-2 cursor-pointer py-2.5 rounded-xl mx-1">
              <Share2 className="h-4 w-4" />
              Social Media
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center gap-2 cursor-pointer py-2.5 rounded-xl mx-1">
              <Sparkles className="h-4 w-4" />
              What's New
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings */}
        <IconBtn
          onClick={() => setLocation(isAgencyView ? "/agency/settings" : "/subaccount/settings")}
          data-testid="button-settings-top"
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </IconBtn>

        {/* ── Notifications Popover ── */}
        <Popover>
          <PopoverTrigger asChild>
            <IconBtn
              className="relative"
              data-testid="button-notifications"
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <div
                  className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-brand-blue rounded-full flex items-center justify-center border-2 border-background"
                  data-testid="badge-notifications-count"
                  aria-hidden="true"
                >
                  <span className="text-[9px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>
                </div>
              )}
            </IconBtn>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-80 p-0 rounded-2xl shadow-xl border-border/60 bg-popover overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
              <span className="font-semibold text-sm" data-testid="text-notifications-title">Notifications</span>
              {notifications.length > 0 && (
                <button
                  onClick={() => setNotifications([])}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  data-testid="button-mark-all-read"
                >
                  Mark all as read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground text-center">All caught up!</div>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-border/10" data-testid="list-notifications">
                {notifications.map((n) => (
                  <div key={n.id} className="px-4 py-3" data-testid={`card-notification-${n.id}`}>
                    <div className="text-sm font-medium" data-testid={`text-notification-title-${n.id}`}>{n.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5" data-testid={`text-notification-desc-${n.id}`}>{n.description}</div>
                    <div className="text-[11px] text-muted-foreground/60 mt-1" data-testid={`text-notification-at-${n.id}`}>
                      {new Date(n.at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>

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
                <AvatarFallback className={cn(
                  "text-xs font-bold",
                  isAgencyUser && currentAccountId === 1
                    ? "bg-brand-yellow text-brand-yellow-foreground"
                    : isAgencyUser
                    ? "bg-brand-blue text-brand-blue-foreground"
                    : "bg-primary text-primary-foreground"
                )}>
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl shadow-xl border-border bg-background mt-2">
            <div className="px-3 py-2.5 border-b border-border/40">
              <div className="text-sm font-semibold truncate">{currentUserName}</div>
              {currentUserEmail && <div className="text-xs text-muted-foreground truncate">{currentUserEmail}</div>}
            </div>

            {isAgencyUser && (
              <>
                <div className="px-3 pt-2 pb-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Switch Account
                </div>
                {[...accounts].sort((a, b) => a.id === 1 ? -1 : b.id === 1 ? 1 : 0).map((acc) => (
                  <DropdownMenuItem
                    key={acc.id}
                    onClick={() => handleAccountSelect(acc.id)}
                    className={cn(
                      "flex items-center gap-2 cursor-pointer py-2 rounded-xl mx-1",
                      currentAccountId === acc.id && "font-semibold"
                    )}
                    data-testid={`topbar-account-option-${acc.id}`}
                  >
                    <div className={cn(
                      "h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0",
                      acc.id === 1 ? "bg-brand-yellow text-brand-yellow-foreground" : "bg-brand-blue text-brand-blue-foreground"
                    )}>
                      {acc.name?.[0] || "?"}
                    </div>
                    <span className="text-sm truncate flex-1">{acc.name}</span>
                    {currentAccountId === acc.id && (
                      <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="mx-2" />
              </>
            )}

            <DropdownMenuItem
              onClick={() => setPasswordDialogOpen(true)}
              className="flex items-center gap-2 cursor-pointer py-2.5 rounded-xl mx-1 mt-1"
              data-testid="button-user-password-settings"
            >
              <Lock className="h-4 w-4" />
              Password Settings
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

      <ChangePasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        userEmail={currentUserEmail || null}
      />
    </header>
  );
}
