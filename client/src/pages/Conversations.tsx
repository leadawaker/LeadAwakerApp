import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { CrmShell } from "@/components/crm/CrmShell";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCampaigns } from "@/hooks/useApiData";
import { cn } from "@/lib/utils";
import { ChevronLeft, Layers, ArrowUpDown, Filter, Check } from "lucide-react";
import { useConversationsData } from "@/features/conversations/hooks/useConversationsData";
import { InboxPanel, type ChatGroupBy, type ChatSortBy, type InboxTab, GROUP_LABELS, SORT_LABELS } from "@/features/conversations/components/InboxPanel";
import { ChatPanel } from "@/features/conversations/components/ChatPanel";
import { ContactSidebar } from "@/features/conversations/components/ContactSidebar";
import { SearchPill } from "@/components/ui/search-pill";
import { SupportChatWidget } from "@/components/crm/SupportChatWidget";
import { useSupportChat } from "@/hooks/useSupportChat";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PIPELINE_STATUSES,
  PIPELINE_HEX,
} from "@/features/conversations/utils/conversationHelpers";

export default function ConversationsPage() {
  const { currentAccountId, accounts, isAgencyUser } = useWorkspace();
  const [, setLocation] = useLocation();
  const basePath = isAgencyUser ? "/agency" : "/subaccount";

  // Conversation list filter state
  const [filterAccountId, setFilterAccountId] = useState<number | "all">("all");
  const [campaignId, setCampaignId] = useState<number | "all">("all");

  // Chat state — persisted across navigation
  const [selectedLeadId, setSelectedLeadIdRaw] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem("selected-conversation-lead-id");
      return stored ? Number(stored) : null;
    } catch { return null; }
  });
  const setSelectedLeadId = (id: number | null) => {
    setSelectedLeadIdRaw(id);
    try {
      if (id) localStorage.setItem("selected-conversation-lead-id", String(id));
      else localStorage.removeItem("selected-conversation-lead-id");
    } catch {}
  };
  const [mobileView, setMobileView] = useState<"inbox" | "chat">("inbox");

  // Inbox tab — check sessionStorage for support-chat-open flag set by widget's "expand" button
  const [tab, setTab] = useState<InboxTab>(() => {
    try {
      if (sessionStorage.getItem("support-chat-open") === "1") {
        sessionStorage.removeItem("support-chat-open");
        return "support";
      }
    } catch {}
    return "all";
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(true); // starts expanded

  // Group / Sort / Filter state
  const [groupBy, setGroupBy] = useState<ChatGroupBy>("date");
  const [sortBy, setSortBy] = useState<ChatSortBy>("newest");
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  // Track when each lead was last read — persisted across refreshes
  const [lastReadAt, setLastReadAt] = useState<Map<number, string>>(() => {
    try {
      const stored = localStorage.getItem("conversations-last-read-at");
      if (stored) {
        const entries: [number, string][] = JSON.parse(stored);
        return new Map(entries);
      }
    } catch {}
    return new Map();
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        "conversations-last-read-at",
        JSON.stringify(Array.from(lastReadAt.entries())),
      );
    } catch {}
  }, [lastReadAt]);

  const markAsRead = useCallback((leadId: number) => {
    setLastReadAt((prev) => {
      const next = new Map(prev);
      next.set(leadId, new Date().toISOString());
      return next;
    });
  }, []);

  const [showContactPanel, setShowContactPanel] = useState(true);

  const effectiveAccountId = useMemo(() => {
    if (!isAgencyUser) return currentAccountId;
    if (filterAccountId === "all") return undefined;
    return filterAccountId as number;
  }, [isAgencyUser, filterAccountId, currentAccountId]);

  const { threads, loading, error, sending, handleSend, handleToggleTakeover, handleUpdateLead, handleRetry, refresh } = useConversationsData(
    effectiveAccountId,
    campaignId,
    tab === "support" ? "all" : tab,
    searchQuery,
    "all",
    "newest",
    lastReadAt,
  );

  // All campaigns (no account filter) for the Filter > Account > Campaign drill-down
  const { campaigns: allCampaigns } = useCampaigns(undefined);

  // ── Support chat (inline mode) ─────────────────────────────────────────────
  const isAdmin = localStorage.getItem("leadawaker_user_role") === "Admin";
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
    notifyOpen: supportNotifyOpen,
  } = useSupportChat();

  // Mark support chat as "open" when the support tab is visible
  useEffect(() => {
    supportNotifyOpen(tab === "support");
  }, [tab, supportNotifyOpen]);

  const handleAccountChange = (id: number | "all") => {
    setFilterAccountId(id);
    setCampaignId("all");
  };

  const handleToggleFilterStatus = (status: string) => {
    setFilterStatus((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const handleResetControls = () => {
    setGroupBy("date");
    setSortBy("newest");
    setFilterStatus([]);
    setCampaignId("all");
    if (isAgencyUser) setFilterAccountId("all");
  };

  const handleClearFilters = () => {
    handleResetControls();
    setSearchQuery("");
    setTab("all");
  };

  const selected = useMemo(() => {
    const byId = selectedLeadId
      ? threads.find((t) => t.lead.id === selectedLeadId) ?? null
      : null;
    return byId ?? threads[0] ?? null;
  }, [threads, selectedLeadId]);

  const prevSelectedRef = useRef<number | null>(null);
  useEffect(() => {
    const currentId = selected?.lead.id ?? null;
    if (currentId !== null && currentId !== prevSelectedRef.current) {
      prevSelectedRef.current = currentId;
      markAsRead(currentId);
    }
  }, [selected, markAsRead]);

  const handleSelectLead = (id: number) => {
    setSelectedLeadId(id);
    setMobileView("chat");
    markAsRead(id);
  };

  const clientAccounts = useMemo(
    () => accounts.filter((a) => a.id !== 1),
    [accounts],
  );

  const isGroupNonDefault = groupBy !== "date";
  const isSortNonDefault = sortBy !== "newest";
  const filterActive =
    filterOpen ||
    filterStatus.length > 0 ||
    campaignId !== "all" ||
    (isAgencyUser && filterAccountId !== "all");

  const isSupport = tab === "support";

  return (
    <CrmShell>
      <div
        className="h-full flex flex-col overflow-hidden"
        data-testid="page-conversations"
      >
        {/* Mobile header */}
        <div className="px-4 md:px-6 pt-4 md:pt-6 pb-2 shrink-0 flex md:hidden items-center gap-3">
          {mobileView === "chat" && (
            <button
              onClick={() => setMobileView("inbox")}
              className="h-10 w-10 rounded-full border border-black/[0.125] bg-background grid place-items-center"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <h1 className="text-2xl font-extrabold tracking-tight">
            {mobileView === "chat" && selected && !isSupport
              ? selected.lead.full_name ||
                `${selected.lead.first_name ?? ""} ${selected.lead.last_name ?? ""}`.trim()
              : isSupport
              ? supportBotConfig.name
              : "Conversations"}
          </h1>
        </div>

        {error && threads.length === 0 && !loading && !isSupport ? (
          <ApiErrorFallback
            error={error}
            onRetry={() => refresh()}
            isRetrying={loading}
          />
        ) : (
          <div
            className={cn(
              "flex-1 min-h-0 flex gap-[3px]",
              mobileView === "chat" ? "flex-col md:flex-row" : "flex-col md:flex-row"
            )}
            data-testid="layout-conversations"
          >
            <InboxPanel
              threads={threads}
              loading={loading}
              selectedLeadId={selected?.lead.id ?? null}
              scrollToLeadId={selectedLeadId}
              onSelectLead={handleSelectLead}
              tab={tab}
              onTabChange={setTab}
              searchQuery={searchQuery}
              groupBy={groupBy}
              sortBy={sortBy}
              filterStatus={filterStatus}
              selectedCampaignId={campaignId}
              selectedAccountId={filterAccountId}
              isAgencyUser={isAgencyUser}
              onClearAll={handleClearFilters}
              supportBotConfig={supportBotConfig}
              className={cn(
                "w-full md:w-[340px] flex-shrink-0",
                mobileView === "chat" ? "hidden md:flex" : "flex"
              )}
            />

            {/* Support chat (inline) */}
            {isSupport && (
              <div className={cn(
                "flex-1 min-w-0",
                mobileView === "inbox" ? "hidden md:block" : "block"
              )}>
                <SupportChatWidget
                  mode="inline"
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
                  onClose={() => setTab("all")}
                />
              </div>
            )}

            {/* Normal chat area */}
            {!isSupport && (
              <div className={cn(
                "flex-1 min-w-0 flex flex-col",
                mobileView === "inbox" ? "hidden md:flex" : "flex"
              )}>
                <ChatPanel
                  selected={selected}
                  loading={loading}
                  sending={sending}
                  onSend={handleSend}
                  onToggleTakeover={handleToggleTakeover}
                  onRetry={handleRetry}
                  showContactPanel={showContactPanel}
                  onShowContactPanel={() => setShowContactPanel(true)}
                  className="flex-1 min-w-0"
                  headerActions={
                    <>
                      {/* Search — starts expanded */}
                      <SearchPill
                        value={searchQuery}
                        onChange={setSearchQuery}
                        open={searchOpen}
                        onOpenChange={setSearchOpen}
                        placeholder="Search chats..."
                      />

                      {/* Group */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={cn(
                              "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0",
                              "transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[120px]",
                              isGroupNonDefault
                                ? "border-brand-indigo text-brand-indigo"
                                : "border-black/[0.125] text-foreground/60 hover:text-foreground"
                            )}
                            title="Group by"
                          >
                            <Layers className="h-4 w-4 shrink-0" />
                            <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">Group</span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {(Object.keys(GROUP_LABELS) as ChatGroupBy[]).map((opt) => (
                            <DropdownMenuItem
                              key={opt}
                              onClick={() => setGroupBy(opt)}
                              className={cn("text-[12px]", groupBy === opt && "font-semibold text-brand-indigo")}
                            >
                              {GROUP_LABELS[opt]}
                              {groupBy === opt && <Check className="h-3 w-3 ml-auto" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Sort */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={cn(
                              "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0",
                              "transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[100px]",
                              isSortNonDefault
                                ? "border-brand-indigo text-brand-indigo"
                                : "border-black/[0.125] text-foreground/60 hover:text-foreground"
                            )}
                            title="Sort"
                          >
                            <ArrowUpDown className="h-4 w-4 shrink-0" />
                            <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">Sort</span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {(Object.keys(SORT_LABELS) as ChatSortBy[]).map((opt) => (
                            <DropdownMenuItem
                              key={opt}
                              onClick={() => setSortBy(opt)}
                              className={cn("text-[12px]", sortBy === opt && "font-semibold text-brand-indigo")}
                            >
                              {SORT_LABELS[opt]}
                              {sortBy === opt && <Check className="h-3 w-3 ml-auto" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Filter — Status + Account → Campaign */}
                      <DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={cn(
                              "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0",
                              "transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[110px]",
                              filterActive
                                ? "border-brand-indigo text-brand-indigo"
                                : "border-black/[0.125] text-foreground/60 hover:text-foreground"
                            )}
                            title="Filter"
                            data-testid="button-toggle-filters"
                          >
                            <Filter className="h-4 w-4 shrink-0" />
                            <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">Filter</span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {/* Status */}
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="text-[12px]">
                              Status
                              {filterStatus.length > 0 && (
                                <span className="ml-auto text-[10px] text-brand-indigo font-medium">{filterStatus.length}</span>
                              )}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-48 max-h-60 overflow-y-auto">
                              {PIPELINE_STATUSES.map((s) => (
                                <DropdownMenuItem
                                  key={s}
                                  onClick={(e) => { e.preventDefault(); handleToggleFilterStatus(s); }}
                                  className="flex items-center gap-2 text-[12px]"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PIPELINE_HEX[s] ?? "#6B7280" }} />
                                  <span className="flex-1">{s}</span>
                                  {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>

                          {/* Account → Campaign drill-down (agency users only) */}
                          {isAgencyUser && clientAccounts.length > 0 && (
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="text-[12px]">
                                Account
                                {filterAccountId !== "all" && (
                                  <span className="ml-auto text-[10px] text-brand-indigo font-medium truncate max-w-[70px]">
                                    {clientAccounts.find((a) => a.id === filterAccountId)?.name ?? ""}
                                  </span>
                                )}
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="w-48 max-h-60 overflow-y-auto">
                                <DropdownMenuItem
                                  onClick={() => handleAccountChange("all")}
                                  className={cn("text-[12px]", filterAccountId === "all" && "font-semibold text-brand-indigo")}
                                >
                                  All Accounts
                                  {filterAccountId === "all" && <Check className="h-3 w-3 ml-auto" />}
                                </DropdownMenuItem>
                                {clientAccounts.map((account) => (
                                  <DropdownMenuSub key={account.id}>
                                    <DropdownMenuSubTrigger
                                      className={cn("text-[12px]", filterAccountId === account.id && "font-semibold text-brand-indigo")}
                                      onClick={() => handleAccountChange(account.id)}
                                    >
                                      {account.name}
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="w-44 max-h-48 overflow-y-auto">
                                      <DropdownMenuItem
                                        onClick={() => { handleAccountChange(account.id); setCampaignId("all"); }}
                                        className={cn("text-[12px]", filterAccountId === account.id && campaignId === "all" && "font-semibold text-brand-indigo")}
                                      >
                                        All Campaigns
                                        {filterAccountId === account.id && campaignId === "all" && <Check className="h-3 w-3 ml-auto" />}
                                      </DropdownMenuItem>
                                      {allCampaigns
                                        .filter((c) => c.account_id === account.id || (c as any).accounts_id === account.id)
                                        .map((c) => (
                                          <DropdownMenuItem
                                            key={c.id}
                                            onClick={() => { handleAccountChange(account.id); setCampaignId(c.id); }}
                                            className={cn("text-[12px]", filterAccountId === account.id && campaignId === c.id && "font-semibold text-brand-indigo")}
                                          >
                                            {c.name}
                                            {filterAccountId === account.id && campaignId === c.id && <Check className="h-3 w-3 ml-auto" />}
                                          </DropdownMenuItem>
                                        ))
                                      }
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  }
                />
              </div>
            )}

            {/* Contact sidebar — hidden in support mode */}
            {!isSupport && showContactPanel && (
              <ContactSidebar
                selected={selected}
                loading={loading}
                onClose={() => setShowContactPanel(false)}
                onUpdateLead={handleUpdateLead}
                onNavigateToLead={(leadId) => {
                  localStorage.setItem("selected-lead-id", String(leadId));
                  setLocation(`${basePath}/contacts`);
                }}
                className="hidden xl:flex w-[340px] flex-shrink-0"
              />
            )}
          </div>
        )}
      </div>
    </CrmShell>
  );
}
