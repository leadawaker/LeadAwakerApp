import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Bell, Search, Settings, Moon, Sun, Menu, X, LogOut, Check, BookOpen, Share2, Sparkles, User, Headphones } from "lucide-react";
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
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";
import { apiFetch } from "@/lib/apiUtils";
import { BookedCallsKpi } from "@/components/crm/BookedCallsKpi";
import { NotificationCenter } from "@/components/crm/NotificationCenter";
import { SupportChatWidget } from "@/components/crm/SupportChatWidget";
import { useQuery } from "@tanstack/react-query";

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

  // ── Notification Center ─────────────────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Lightweight poll for the badge count (every 60s)
  const { data: countData } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/notifications/count"],
    queryFn: async () => {
      const res = await apiFetch("/api/notifications/count");
      if (!res.ok) return { unreadCount: 0 };
      return res.json() as Promise<{ unreadCount: number }>;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (countData) setUnreadCount(countData.unreadCount);
  }, [countData]);

  const handleUnreadCountChange = useCallback((count: number) => {
    setUnreadCount(count);
  }, []);

  // ── Search state ─────────────────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
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

    if (isAgencyUser) {
      apiFetch('/api/users').then(async (res) => {
        if (res.ok) { const data = await res.json(); setAllUsers(Array.isArray(data) ? data : []); }
      }).catch(() => {});
    }
  }, [searchOpen, currentAccountId, isAgencyUser]);

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

  const accountResults = useMemo(() => {
    if (!isAgencyUser || !searchQ.trim()) return [];
    const q = searchQ.trim().toLowerCase();
    return accounts.filter(a => (a.name || '').toLowerCase().includes(q)).slice(0, 5).map(a => ({ id: a.id, name: a.name || '', type: 'account' as const }));
  }, [searchQ, accounts, isAgencyUser]);

  const userResults = useMemo(() => {
    if (!isAgencyUser || !searchQ.trim()) return [];
    const q = searchQ.trim().toLowerCase();
    return allUsers.filter(u => [u.name || '', u.email || ''].some((v: string) => v.toLowerCase().includes(q))).slice(0, 5).map(u => ({ id: u.id, name: u.name || u.email || `User #${u.id}`, role: u.role || '', type: 'user' as const }));
  }, [searchQ, allUsers, isAgencyUser]);

  const handleLeadClick = (leadId: number) => {
    sessionStorage.setItem("pendingLeadId", String(leadId));
    setSearchOpen(false);
    const base = isAgencyView ? "/agency" : "/subaccount";
    setLocation(`${base}/leads`);
  };

  const handleAccountClick = () => { setSearchOpen(false); setLocation(`/agency/accounts`); };
  const handleUserClick = () => {
    setSearchOpen(false);
    sessionStorage.setItem("pendingSettingsSection", "team");
    const base = isAgencyView ? "/agency" : "/subaccount";
    setLocation(`${base}/settings`);
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
    const agencyOnlyPaths = ["/accounts", "/prompt-library", "/automation-logs", "/invoices"];
    const isAgencyOnlyPage = agencyOnlyPaths.some((p) => tail.startsWith(p));
    const safeTail = (!nextIsAgency && isAgencyOnlyPage) ? "/dashboard" : tail;
    setLocation(`${nextBase}${safeTail || "/dashboard"}`);
  };


  const currentUserName = localStorage.getItem("leadawaker_user_name") || localStorage.getItem("leadawaker_account_name") || "User";
  const currentUserEmail = localStorage.getItem("leadawaker_user_email") || "";
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string>(() => localStorage.getItem("leadawaker_user_avatar") || "");
  useEffect(() => {
    const handler = () => setCurrentUserAvatar(localStorage.getItem("leadawaker_user_avatar") || "");
    window.addEventListener("leadawaker-avatar-changed", handler);
    return () => window.removeEventListener("leadawaker-avatar-changed", handler);
  }, []);

  const userInitials = useMemo(() => {
    const parts = currentUserName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (parts[0]?.[0] || "U").toUpperCase();
  }, [currentUserName]);

  const { topbarActions } = useTopbarActions();

  const accountLabel = isAgencyView ? "Agency View" : (currentAccount?.name || "");

  return (
    <header
      className="fixed top-0 left-0 right-0 h-[62px] bg-background z-50 flex items-end pb-[7px] px-4 md:px-6"
      data-testid="header-crm-topbar"
    >
      {/* ── Branding ── */}
      <div className="hidden md:flex items-center gap-2.5 shrink-0 mr-4">
        <a href="/" className="shrink-0">
          <img src="/6. Favicon.svg" alt="Lead Awaker" className="h-7 w-7" />
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
          {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
        {topbarActions && (
          <>
            <div className="h-5 w-px bg-border/60 shrink-0" aria-hidden="true" />
            <div className="flex items-center">{topbarActions}</div>
          </>
        )}
      </div>

      <TooltipProvider delayDuration={400}>
        <div className="flex items-center gap-1 md:gap-2 shrink-0">

          {/* ── Booked Calls KPI (compact) ── */}
          <BookedCallsKpi
            variant="compact"
            accountId={currentAccountId !== 1 ? currentAccountId : undefined}
          />

          {/* ── Search Popover ── */}
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <IconBtn
                    className="hidden sm:flex"
                    data-testid="button-search-top"
                    aria-label="Search"
                  >
                    <Search className="h-4 w-4" />
                  </IconBtn>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent className="bg-popover text-popover-foreground border border-border/40 shadow-sm rounded-lg text-xs font-medium">
                Search
              </TooltipContent>
            </Tooltip>
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
                <div className="px-4 py-3 text-xs text-muted-foreground">Start typing to search…</div>
              ) : (searchResults.length === 0 && accountResults.length === 0 && userResults.length === 0) ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">No results found.</div>
              ) : (
                <div className="max-h-64 overflow-y-auto divide-y divide-border/10" data-testid="list-search-results">
                  {/* Leads section */}
                  {searchResults.length > 0 && (
                    <div>
                      <div className="px-4 pt-2 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Leads</div>
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
                  {/* Accounts section */}
                  {accountResults.length > 0 && (
                    <div>
                      <div className="px-4 pt-2 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Accounts</div>
                      {accountResults.map(a => (
                        <button key={`acc-${a.id}`} onClick={handleAccountClick} className="w-full text-left px-4 py-2.5 hover:bg-muted/40 flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-foreground">{a.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Users section */}
                  {userResults.length > 0 && (
                    <div>
                      <div className="px-4 pt-2 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Users</div>
                      {userResults.map(u => (
                        <button key={`usr-${u.id}`} onClick={handleUserClick} className="w-full text-left px-4 py-2.5 hover:bg-muted/40 flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-foreground">{u.name}</span>
                          {u.role && <span className="text-xs text-muted-foreground">{u.role}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Dark mode toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <IconBtn
                onClick={toggleTheme}
                data-testid="button-dark-mode-toggle"
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </IconBtn>
            </TooltipTrigger>
            <TooltipContent className="bg-popover text-popover-foreground border border-border/40 shadow-sm rounded-lg text-xs font-medium">
              {isDark ? "Light mode" : "Dark mode"}
            </TooltipContent>
          </Tooltip>

          {/* Customer Support Chat */}
          <Popover open={supportOpen} onOpenChange={setSupportOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <IconBtn data-testid="button-support-chat" aria-label="Customer Support">
                    <Headphones className="h-4 w-4" />
                  </IconBtn>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent className="bg-popover text-popover-foreground border border-border/40 shadow-sm rounded-lg text-xs font-medium">
                Customer Support
              </TooltipContent>
            </Tooltip>
            <PopoverContent
              align="end"
              sideOffset={8}
              className="p-0 border-0 bg-transparent shadow-none rounded-2xl w-auto"
            >
              <SupportChatWidget onClose={() => setSupportOpen(false)} />
            </PopoverContent>
          </Popover>

          {/* Help */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <IconBtn data-testid="button-help-top" aria-label="Help">
                    <span className="text-[13px] font-bold leading-none">?</span>
                  </IconBtn>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent className="bg-popover text-popover-foreground border border-border/40 shadow-sm rounded-lg text-xs font-medium">
                Help
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-44 rounded-2xl shadow-xl border-border bg-background mt-2">
              <DropdownMenuItem
                className="flex items-center gap-2 cursor-pointer py-2.5 rounded-xl mx-1"
                onClick={() => setLocation(`${isAgencyView ? "/agency" : "/subaccount"}/docs`)}
              >
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
          <Tooltip>
            <TooltipTrigger asChild>
              <IconBtn
                onClick={() => setLocation(`${isAgencyView ? "/agency" : "/subaccount"}/settings`)}
                data-testid="button-settings-top"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </IconBtn>
            </TooltipTrigger>
            <TooltipContent className="bg-popover text-popover-foreground border border-border/40 shadow-sm rounded-lg text-xs font-medium">
              Settings
            </TooltipContent>
          </Tooltip>

          {/* ── Notifications ── */}
          <Tooltip>
            <TooltipTrigger asChild>
              <IconBtn
                className="relative"
                onClick={() => setNotifOpen(true)}
                data-testid="button-notifications"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <div
                    className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-brand-indigo rounded-full flex items-center justify-center border-2 border-background"
                    data-testid="badge-notifications-count"
                    aria-hidden="true"
                  >
                    <span className="text-[9px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>
                  </div>
                )}
              </IconBtn>
            </TooltipTrigger>
            <TooltipContent className="bg-popover text-popover-foreground border border-border/40 shadow-sm rounded-lg text-xs font-medium">
              Notifications
            </TooltipContent>
          </Tooltip>
          <NotificationCenter
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
            onUnreadCountChange={handleUnreadCountChange}
          />

          {/* User avatar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="ml-1 flex items-center gap-2 hover:opacity-80 transition-opacity"
                data-testid="button-user-avatar"
                title={currentUserName}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={currentUserAvatar} alt={currentUserName} />
                  <AvatarFallback className={cn(
                    "text-xs font-bold",
                    isAgencyUser && currentAccountId === 1
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
                        "h-4 w-4 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0",
                        acc.id === 1 ? "bg-brand-yellow text-brand-yellow-foreground" : "bg-brand-indigo text-brand-indigo-foreground"
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
                onClick={() => setLocation(`${isAgencyView ? "/agency" : "/subaccount"}/settings`)}
                className="flex items-center gap-2 cursor-pointer py-2.5 rounded-xl mx-1 mt-1"
                data-testid="button-view-my-profile"
              >
                <User className="h-4 w-4" />
                My Profile & Settings
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
      </TooltipProvider>

    </header>
  );
}
