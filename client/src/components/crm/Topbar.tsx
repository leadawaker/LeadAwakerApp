import { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Bell, Moon, Sun, Menu, X, Headphones, ChevronDown, Check, Bot } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
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
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { setPersistedSelection } from "@/hooks/usePersistedSelection";
import { apiFetch } from "@/lib/apiUtils";
import { BookedCallsKpi } from "@/components/crm/BookedCallsKpi";
import { NotificationCenter } from "@/components/crm/NotificationCenter";
import { SupportChatWidget } from "@/components/crm/SupportChatWidget";
import { MobileSupportPanel } from "@/components/crm/MobileSupportPanel";
import { MobileNotificationsPanel } from "@/components/crm/MobileNotificationsPanel";
import { useSupportChat } from "@/hooks/useSupportChat";
import { useFounderChat } from "@/hooks/useFounderChat";
import { useAgentWidget } from "@/contexts/AgentWidgetContext";
import { useQuery } from "@tanstack/react-query";
import { TopbarSearch } from "@/components/crm/TopbarSearch";
import { TopbarUserMenu } from "@/components/crm/TopbarUserMenu";
import { TopbarHelp } from "@/components/crm/TopbarHelp";


export function Topbar({
  onOpenPanel,
  collapsed,
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
  const { t } = useTranslation("crm");
  const [location, setLocation] = useLocation();
  const { isAgencyView, isAgencyUser, currentAccountId, accounts, setCurrentAccountId, currentAccount } = useWorkspace();
  const { crumb } = useBreadcrumb();
  const { isDark, toggleTheme } = useTheme();
  const { toggleWidget: toggleAiWidget } = useAgentWidget();

  const PAGE_LABELS: Record<string, string> = {
    campaigns: t("sidebar.campaigns"),
    contacts: t("sidebar.leads"),
    conversations: t("sidebar.chats"),
    calendar: t("sidebar.calendar"),
    accounts: t("sidebar.accounts"),
    prospects: t("sidebar.prospects"),
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

  // ── Support Chat ─────────────────────────────────────────────────────────────
  const {
    messages: supportMessages,
    sending: supportSending,
    loading: supportLoading,
    escalated: supportEscalated,
    botConfig: supportBotConfig,
    initialize: supportInitialize,
    sendMessage: supportSendMessage,
    closeSession: supportCloseSession,
    updateBotConfig: supportUpdateBotConfig,
    clearContext: supportClearContext,
    resetInit: supportResetInit,
    unreadCount: supportUnreadCount,
    markAsRead: supportMarkAsRead,
    notifyOpen: supportNotifyOpen,
  } = useSupportChat();

  const founderChat = useFounderChat();

  const [supportOpen, setSupportOpen] = useState(false);
  const [mobileSupportOpen, setMobileSupportOpen] = useState(false);
  // Determine admin status from localStorage role (stored as "Admin" with capital A)
  const currentUserRole = localStorage.getItem("leadawaker_user_role") || "";
  const isAdmin = currentUserRole === "Admin";

  // Open the support chat in the Conversations page (support tab) instead of floating widget
  const handleSupportOpenInChats = () => {
    // Reset so the floating widget re-fetches fresh messages when reopened later
    supportResetInit();
    setSupportOpen(false);
    try { sessionStorage.setItem("support-chat-open", "1"); } catch {}
    setLocation(`${isAgencyView ? "/agency" : "/subaccount"}/conversations`);
  };

  // AI agents (agency users only) — fetched for the Sophie "Switch to" footer
  const { data: topbarAiAgents = [] } = useQuery<{ id: number; name: string; type: string; photoUrl: string | null; enabled: boolean }[]>({
    queryKey: ["/api/ai-agents"],
    queryFn: async () => {
      const res = await apiFetch("/api/ai-agents");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAgencyUser,
    staleTime: 60_000,
  });

  const handleOpenAgent = (agentId: number) => {
    try { sessionStorage.setItem("selected-agent-id", String(agentId)); } catch {}
    setSupportOpen(false);
    setMobileSupportOpen(false);
    window.dispatchEvent(new CustomEvent("select-agent", { detail: { agentId } }));
    setLocation(`${isAgencyView ? "/agency" : "/subaccount"}/conversations`);
  };

  // Sync open state with hook so it knows when to count unreads
  useEffect(() => {
    const isOpen = supportOpen || mobileSupportOpen;
    supportNotifyOpen(isOpen);
    if (isOpen) supportMarkAsRead();
  }, [supportOpen, mobileSupportOpen, supportNotifyOpen, supportMarkAsRead]);

  // ── Notification Center ─────────────────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileNotifOpen, setMobileNotifOpen] = useState(false);
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
  const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
  const [allProspects, setAllProspects] = useState<any[]>([]);

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

    apiFetch(`/api/campaigns?${params}`).then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setAllCampaigns(Array.isArray(data) ? data : data?.list || data?.data || []);
      }
    }).catch(() => {});

    if (isAgencyUser) {
      apiFetch('/api/users').then(async (res) => {
        if (res.ok) { const data = await res.json(); setAllUsers(Array.isArray(data) ? data : []); }
      }).catch(() => {});
      apiFetch('/api/prospects').then(async (res) => {
        if (res.ok) { const data = await res.json(); setAllProspects(Array.isArray(data) ? data : data?.list || data?.data || []); }
      }).catch(() => {});
    }
  }, [searchOpen, currentAccountId, isAgencyUser]);

  const searchResults = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [] as { id: number; displayName: string; subtitle: string }[];
    return allLeads
      .filter((l: any) => {
        const first = l.first_name || "";
        const last = l.last_name || "";
        const full = l.full_name || l.name || "";
        return [full, first, last, `${first} ${last}`, l.phone || "", l.email || l.Email || ""]
          .some((v: string) => v.toLowerCase().includes(q));
      })
      .slice(0, 8)
      .map((l: any) => {
        const id = l.Id || l.id;
        const firstName = l.first_name || "";
        const lastName = l.last_name || "";
        const fullName = l.full_name || l.name || (firstName || lastName ? `${firstName} ${lastName}`.trim() : "");
        return {
          id,
          displayName: fullName || `Lead #${id}`,
          subtitle: fullName ? `Lead #${id}` : [l.phone, l.email || l.Email].filter(Boolean).join(" · "),
        };
      });
  }, [searchQ, allLeads]);

  const campaignResults = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [];
    return allCampaigns
      .filter((c: any) => (c.name || c.title || "").toLowerCase().includes(q))
      .slice(0, 5)
      .map((c: any) => ({ id: c.id || c.Id, name: c.name || c.title || `Campaign #${c.id || c.Id}`, status: c.status || "" }));
  }, [searchQ, allCampaigns]);

  const prospectResults = useMemo(() => {
    if (!isAgencyUser) return [];
    const q = searchQ.trim().toLowerCase();
    if (!q) return [];
    return allProspects
      .filter((p: any) => [p.company || "", p.name || "", p.contact_name || "", p.email || ""].some((v: string) => v.toLowerCase().includes(q)))
      .slice(0, 5)
      .map((p: any) => ({ id: p.id || p.Id, company: p.company || p.name || "", contact: p.contact_name || "", status: p.status || "" }));
  }, [searchQ, allProspects, isAgencyUser]);

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
    setSearchOpen(false);
    setPersistedSelection("selected-lead-id", leadId);
    const base = isAgencyView ? "/agency" : "/subaccount";
    setLocation(`${base}/contacts`);
  };

  const handleCampaignClick = (campaignId: number) => {
    setSearchOpen(false);
    setPersistedSelection("selected-campaign-id", campaignId);
    const base = isAgencyView ? "/agency" : "/subaccount";
    setLocation(`${base}/campaigns`);
  };
  const handleProspectClick = (prospectId: number) => {
    setSearchOpen(false);
    setPersistedSelection("selected-prospect-id", prospectId);
    setLocation(`/agency/prospects`);
  };
  const handleAccountClick = () => { setSearchOpen(false); setLocation(`/agency/accounts`); };
  const handleUserClick = () => {
    setSearchOpen(false);
    sessionStorage.setItem("pendingSettingsSection", "team");
    const base = isAgencyView ? "/agency" : "/subaccount";
    setLocation(`${base}/settings`);
  };

  // ── Account switch ───────────────────────────────────────────────────────────
  // id=0 means "All Accounts" (agency-wide, no scoping)
  const handleAccountSelect = (id: number) => {
    setCurrentAccountId(id);
    // Admin stays in agency view regardless of which account is selected
    if (isAdmin && isAgencyView) return;
    const prevBase = isAgencyView ? "/agency" : "/subaccount";
    const nextIsAgency = id === 0 || id === 1;
    const nextBase = nextIsAgency ? "/agency" : "/subaccount";
    if (prevBase === nextBase) return;
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

  const accountLabel = isAgencyView
    ? (currentAccountId === 0 ? t("topbar.agencyView") : currentAccount?.name || t("topbar.agencyView"))
    : (currentAccount?.name || "");

  // Shared props for the user menu
  const userMenuSharedProps = {
    currentUserName,
    currentUserEmail,
    currentUserAvatar,
    userInitials,
    isAgencyUser,
    isAgencyView,
    currentAccountId,
    accounts,
    isDark,
    onToggleTheme: toggleTheme,
    onAccountSelect: handleAccountSelect,
    onNavigateSettings: () => {
      sessionStorage.setItem("pendingSettingsSection", isAgencyUser ? "profile" : "account");
      setLocation(`${isAgencyView ? "/agency" : "/subaccount"}/settings`);
    },
    onNavigateTasks: () => setLocation(`${isAgencyView ? "/agency" : "/subaccount"}/tasks`),
    onToggleSupport: () => setSupportOpen((v) => !v),
    onLogout,
  };

  return (
    <>
    <header
      className="fixed top-0 left-0 right-0 bg-background z-50 flex items-center md:items-end px-4 md:pl-6"
      style={{ height: "var(--topbar-h)", paddingTop: "var(--safe-top)", paddingBottom: "7px" }}
      data-testid="header-crm-topbar"
    >
      {/* ══ MOBILE TOP BAR (< 768px) ══
          Absolute overlay fills the header. 4 elements: KPI strip, Bell, Support, Avatar.
          glass-nav + semi-transparent bg gives the glassmorphism blur effect on mobile. */}
      <div
        className="md:hidden absolute inset-0 flex items-center gap-2 px-4 glass-nav bg-background/80"
        style={{ paddingTop: "var(--safe-top)" }}
        data-testid="mobile-topbar"
      >
        {/* KPI strip — flex-1 (occupies most of the width) */}
        <div className="flex-1 min-w-0">
          <BookedCallsKpi
            variant="mobile"
            accountId={currentAccountId > 0 ? currentAccountId : undefined}
          />
        </div>

        {/* Bell / Notifications — opens full-screen panel on mobile */}
        <IconBtn
          className="relative shrink-0 touch-target"
          data-testid="button-notifications-mobile"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
          onClick={() => setMobileNotifOpen(true)}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <div
              className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-brand-indigo rounded-full flex items-center justify-center border-2 border-background shadow-[0_0_8px_rgba(99,102,241,0.35)]"
              data-testid="badge-notifications-count-mobile"
              aria-hidden="true"
            >
              <span className="text-[9px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>
            </div>
          )}
        </IconBtn>

        {/* Support / Headphones */}
        <div className="relative shrink-0">
          <IconBtn
            onClick={() => setMobileSupportOpen((v) => !v)}
            data-testid="button-support-chat-mobile-topbar"
            aria-label={`Customer Support${supportUnreadCount > 0 ? ` (${supportUnreadCount} unread)` : ""}`}
            className="min-h-[44px] min-w-[44px]"
          >
            <Headphones className="h-4 w-4" />
          </IconBtn>
          {supportUnreadCount > 0 && (
            <div
              className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center border-2 border-background pointer-events-none"
              data-testid="badge-support-count-mobile"
              aria-hidden="true"
            >
              <span className="text-[9px] font-bold text-white">{supportUnreadCount > 9 ? "9+" : supportUnreadCount}</span>
            </div>
          )}
        </div>

        {/* AI Agent button intentionally hidden on mobile — widget is desktop-only */}

        {/* User Avatar (mobile) */}
        <TopbarUserMenu variant="mobile" {...userMenuSharedProps} />
      </div>

      {/* ── Branding (desktop only) ── */}
      <div className="hidden md:flex items-center gap-2.5 shrink-0 mr-4">
        <a href="/" className="shrink-0">
          <img src="/6. Favicon.svg" alt="Lead Awaker" className="h-7 w-7" />
        </a>
        <span className="font-heading font-bold text-xl text-foreground tracking-tight whitespace-nowrap">
          Lead Awaker
        </span>
        <span className="text-muted-foreground/30 text-xl leading-none select-none">|</span>
        {isAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1 text-xl font-heading text-foreground tracking-tight whitespace-nowrap hover:opacity-70 transition-opacity focus:outline-none">
                {currentAccountId !== 0 && currentAccount?.logo_url ? (
                  <img src={currentAccount.logo_url} alt="" className="h-5 w-5 rounded-md object-cover shrink-0" />
                ) : null}
                {accountLabel}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 rounded-2xl shadow-xl border-border bg-background mt-2">
              <DropdownMenuItem
                onClick={() => handleAccountSelect(0)}
                className={cn("flex items-center gap-2 cursor-pointer py-2 rounded-xl mx-1", currentAccountId === 0 && "font-semibold")}
              >
                <div className="h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 bg-brand-yellow text-brand-yellow-foreground">
                  <img src="/6. Favicon.svg" alt="" className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm truncate flex-1">{t("topbar.allAccounts")}</span>
                {currentAccountId === 0 && <Check className="h-3 w-3 text-muted-foreground shrink-0" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="mx-2" />
              {[...accounts].sort((a, b) => a.name.localeCompare(b.name)).map((acc) => (
                <DropdownMenuItem
                  key={acc.id}
                  onClick={() => handleAccountSelect(acc.id)}
                  className={cn("flex items-center gap-2 cursor-pointer py-2 rounded-xl mx-1", currentAccountId === acc.id && "font-semibold")}
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
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-xl font-heading text-foreground tracking-tight whitespace-nowrap">
            {accountLabel}
          </span>
        )}
      </div>

      {/* Desktop left section: hamburger + topbar actions (hidden on mobile — replaced by mobile overlay) */}
      <div className="hidden md:flex flex-1 items-center justify-start gap-3 min-w-0">
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

      {/* Desktop right icons (hidden on mobile — replaced by mobile overlay) */}
      <TooltipProvider delayDuration={400}>
        <div className="hidden md:flex items-center gap-1 md:gap-2 shrink-0">

          {/* ── Breadcrumb — page + selected item ── */}
          {pageLabel && (
            <div className="flex items-center gap-1.5 min-w-0 overflow-hidden mr-1">
              <span className="text-sm font-medium text-muted-foreground shrink-0">{pageLabel}</span>
              {crumb && (
                <>
                  <span className="text-muted-foreground/40 leading-none select-none">/</span>
                  <span className="text-sm font-semibold text-foreground truncate max-w-[180px]">{crumb}</span>
                </>
              )}
            </div>
          )}

          {/* ── Search Popover ── */}
          <TopbarSearch
            open={searchOpen}
            onOpenChange={setSearchOpen}
            searchQ={searchQ}
            onSearchQChange={setSearchQ}
            searchResults={searchResults}
            campaignResults={campaignResults}
            prospectResults={prospectResults}
            accountResults={accountResults}
            userResults={userResults}
            onLeadClick={handleLeadClick}
            onCampaignClick={handleCampaignClick}
            onProspectClick={handleProspectClick}
            onAccountClick={handleAccountClick}
            onUserClick={handleUserClick}
          />

          {/* Dark mode toggle — hidden on mobile */}
          <span className="hidden md:contents">
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
                {isDark ? t("topbar.lightMode") : t("topbar.darkMode")}
              </TooltipContent>
            </Tooltip>
          </span>

          {/* Customer Support Chat — hidden on mobile */}
          <span className="hidden md:contents">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <IconBtn
                    onClick={() => setSupportOpen((v) => !v)}
                    data-testid="button-support-chat"
                    data-onboarding="topbar-support"
                    aria-label={`Customer Support${supportUnreadCount > 0 ? ` (${supportUnreadCount} unread)` : ""}`}
                  >
                    <Headphones className="h-4 w-4" />
                  </IconBtn>
                  {supportUnreadCount > 0 && (
                    <div
                      className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center border-2 border-background pointer-events-none"
                      data-testid="badge-support-count"
                      aria-hidden="true"
                    >
                      <span className="text-[9px] font-bold text-white">{supportUnreadCount > 9 ? "9+" : supportUnreadCount}</span>
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-popover text-popover-foreground border border-border/40 shadow-sm rounded-lg text-xs font-medium">
                {t("topbar.customerSupport")}
              </TooltipContent>
            </Tooltip>
          </span>

          {/* AI Agent — agency users only, hidden on mobile */}
          {isAgencyUser && (
            <span className="hidden md:contents">
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconBtn
                    onClick={toggleAiWidget}
                    data-testid="button-ai-agent"
                    aria-label="AI Agent"
                  >
                    <Bot className="h-4 w-4" />
                  </IconBtn>
                </TooltipTrigger>
                <TooltipContent className="bg-popover text-popover-foreground border border-border/40 shadow-sm rounded-lg text-xs font-medium">
                  AI Agent
                </TooltipContent>
              </Tooltip>
            </span>
          )}

          {/* Help — hidden on mobile */}
          <TopbarHelp
            onNavigateDocs={() => setLocation(`${isAgencyView ? "/agency" : "/subaccount"}/docs`)}
          />

          {/* ── Notifications ── */}
          <Popover open={notifOpen} onOpenChange={(v) => { if (!v) setNotifOpen(false); else setNotifOpen(true); }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <IconBtn
                    className="relative"
                    data-testid="button-notifications"
                    data-onboarding="topbar-notifications"
                    aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <div
                        className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-brand-indigo rounded-full flex items-center justify-center border-2 border-background shadow-[0_0_8px_rgba(99,102,241,0.35)]"
                        data-testid="badge-notifications-count"
                        aria-hidden="true"
                      >
                        <span className="text-[9px] font-bold text-white tabular-nums">{unreadCount > 9 ? "9+" : unreadCount}</span>
                      </div>
                    )}
                  </IconBtn>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent className="bg-popover text-popover-foreground border border-border/40 shadow-sm rounded-lg text-xs font-medium">
                {t("topbar.notifications")}
              </TooltipContent>
            </Tooltip>
            <PopoverContent
              align="end"
              sideOffset={8}
              className="w-80 p-0 rounded-2xl shadow-2xl border-border/40 bg-popover overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
            >
              <NotificationCenter
                open={notifOpen}
                onClose={() => setNotifOpen(false)}
                onUnreadCountChange={handleUnreadCountChange}
              />
            </PopoverContent>
          </Popover>

          {/* User avatar dropdown (desktop) */}
          <TopbarUserMenu variant="desktop" {...userMenuSharedProps} />
        </div>
      </TooltipProvider>

      {/* Right gutter — aligns buttons with leads detail panel edge on ultra-wide screens.
          Formula: max(20px, 50vw - Xpx) mirrors the leads panel max-w centering:
          sidebar + leads-max-w(1729) + pr-5(20) = transition point → point/2 - 20 = X
          Expanded: (225+1729+20)/2 - 20 = 967   Collapsed: (56+1729+20)/2 - 20 = 882.5 */}
      <div
        className="hidden md:block shrink-0 grow-0 transition-[flex-basis] duration-200"
        style={{ flexBasis: collapsed ? "max(20px, calc(50vw - 882.5px))" : "max(20px, calc(50vw - 967px))" }}
      />

    </header>
    {/* Desktop floating widget (hidden on mobile) */}
    {supportOpen && (
      <SupportChatWidget
        messages={supportMessages}
        sending={supportSending}
        loading={supportLoading}
        escalated={supportEscalated}
        botConfig={supportBotConfig}
        initialize={supportInitialize}
        sendMessage={supportSendMessage}
        closeSession={supportCloseSession}
        updateBotConfig={supportUpdateBotConfig}
        clearContext={supportClearContext}
        isAdmin={isAdmin}
        onClose={() => setSupportOpen(false)}
        mode="floating"
        onOpenInChats={handleSupportOpenInChats}
        aiAgents={topbarAiAgents}
        onOpenAgent={handleOpenAgent}
        founderChat={!isAgencyUser ? {
          messages: founderChat.messages as any,
          sending: founderChat.sending,
          loading: founderChat.loading,
          initialize: founderChat.initialize,
          sendMessage: founderChat.sendMessage,
          closeSession: founderChat.closeSession,
          clearContext: founderChat.clearContext,
        } : undefined}
      />
    )}

    {/* Mobile full-screen notifications panel (mobile only, < 768px) */}
    <MobileNotificationsPanel
      open={mobileNotifOpen}
      onClose={() => setMobileNotifOpen(false)}
      onUnreadCountChange={handleUnreadCountChange}
    />

    {/* Mobile full-screen support panel (mobile only, < 768px) */}
    <MobileSupportPanel
      open={mobileSupportOpen}
      onClose={() => setMobileSupportOpen(false)}
      messages={supportMessages}
      sending={supportSending}
      loading={supportLoading}
      escalated={supportEscalated}
      botConfig={supportBotConfig}
      initialize={supportInitialize}
      sendMessage={supportSendMessage}
      closeSession={supportCloseSession}
      clearContext={supportClearContext}
      updateBotConfig={supportUpdateBotConfig}
      isAdmin={isAdmin}
      founderChat={!isAgencyUser ? {
        messages: founderChat.messages as any,
        sending: founderChat.sending,
        loading: founderChat.loading,
        initialize: founderChat.initialize,
        sendMessage: founderChat.sendMessage,
        closeSession: founderChat.closeSession,
        clearContext: founderChat.clearContext,
      } : undefined}
    />
    </>
  );
}
