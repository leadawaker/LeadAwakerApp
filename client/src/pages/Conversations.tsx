import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePublishEntityData } from "@/contexts/PageEntityContext";
import { useTranslation } from "react-i18next";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CrmShell } from "@/components/crm/CrmShell";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCampaigns } from "@/hooks/useApiData";
import { cn } from "@/lib/utils";
import { ChevronLeft, Layers, ArrowUpDown, Filter, Check, Plus, Settings, Zap, Cpu } from "lucide-react";
import { useConversationsData } from "@/features/conversations/hooks/useConversationsData";
import { InboxPanel, type ChatGroupBy, type ChatSortBy, type InboxTab, GROUP_LABELS, SORT_LABELS } from "@/features/conversations/components/InboxPanel";
import { ChatPanel } from "@/features/conversations/components/ChatPanel";
import { ContactSidebar } from "@/features/conversations/components/ContactSidebar";
import { AgentChatView } from "@/features/ai-agents/components/AgentChatView";
import { AgentSettingsSheet } from "@/features/ai-agents/components/AgentSettingsSheet";
import { ModelSwitcher } from "@/features/ai-agents/components/ModelSwitcher";
import { ThinkingToggle } from "@/features/ai-agents/components/ThinkingToggle";
import { useAgentChat } from "@/features/ai-agents/hooks/useAgentChat";
import { SearchPill } from "@/components/ui/search-pill";
import { SupportChatWidget } from "@/components/crm/SupportChatWidget";
import { useSupportChat } from "@/hooks/useSupportChat";
import { apiFetch } from "@/lib/apiUtils";

type AiAgent = { id: number; name: string; type: string; photoUrl: string | null; enabled: boolean };
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
  const { t } = useTranslation("conversations");
  const { currentAccountId, accounts, isAgencyUser } = useWorkspace();
  const [, setLocation] = useLocation();
  const basePath = isAgencyUser ? "/agency" : "/subaccount";

  // Conversation list filter state — default to current workspace account
  const [filterAccountId, setFilterAccountId] = useState<number | "all">(() =>
    currentAccountId > 0 ? currentAccountId : "all"
  );
  const [campaignId, setCampaignId] = useState<number | "all">("all");

  // Keep in sync when workspace account changes
  useEffect(() => {
    setFilterAccountId(currentAccountId > 0 ? currentAccountId : "all");
  }, [currentAccountId]);

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
  // Agent selection state — persisted to sessionStorage
  const [selectedAgentId, setSelectedAgentIdRaw] = useState<number | null>(() => {
    try {
      const stored = sessionStorage.getItem("selected-agent-id");
      return stored ? Number(stored) : null;
    } catch { return null; }
  });
  const setSelectedAgentId = (id: number | null) => {
    setSelectedAgentIdRaw(id);
    try {
      if (id !== null) sessionStorage.setItem("selected-agent-id", String(id));
      else sessionStorage.removeItem("selected-agent-id");
    } catch {}
  };

  const handleSelectAgent = (agentId: number) => {
    setSelectedAgentId(agentId);
    setSelectedLeadId(null);
    setTab("all");
    setMobileView("chat");
  };

  const isAgentSelected = selectedAgentId !== null;

  // Agent chat hook — used when an agent is selected in the right panel
  const {
    agent: chatAgent,
    setAgent: setChatAgent,
    session: agentSession,
    messages: agentMessages,
    streaming: agentStreaming,
    streamingText: agentStreamingText,
    loading: agentLoading,
    initialize: agentInitialize,
    sendMessage: agentSendMessage,
    newSession: agentNewSession,
    updateSessionModel: agentUpdateSessionModel,
    updateSessionThinking: agentUpdateSessionThinking,
  } = useAgentChat();

  // Agent settings sheet state
  const [agentSettingsOpen, setAgentSettingsOpen] = useState(false);

  // Initialize agent chat when agent selection changes
  useEffect(() => {
    if (selectedAgentId !== null) {
      agentInitialize(selectedAgentId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgentId]);

  // Listen for agent selection dispatched by the floating support widget (same-page navigation)
  useEffect(() => {
    const handler = (e: Event) => {
      const { agentId } = (e as CustomEvent<{ agentId: number }>).detail;
      handleSelectAgent(agentId);
    };
    window.addEventListener("select-agent", handler);
    return () => window.removeEventListener("select-agent", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [mobileView, setMobileView] = useState<"inbox" | "chat">("inbox");
  const [mobileTransitioning, setMobileTransitioning] = useState(false);

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

  // Group / Sort / Filter state (persisted)
  const [convoPrefs, setConvoPrefs] = usePersistedState("conversations-prefs", {
    groupBy: "date" as ChatGroupBy,
    sortBy: "newest" as ChatSortBy,
    filterStatus: [] as string[],
  });
  const groupBy = convoPrefs.groupBy;
  const sortBy = convoPrefs.sortBy;
  const filterStatus = convoPrefs.filterStatus;
  const setGroupBy = useCallback((v: ChatGroupBy) => setConvoPrefs(p => ({ ...p, groupBy: v })), [setConvoPrefs]);
  const setSortBy = useCallback((v: ChatSortBy) => setConvoPrefs(p => ({ ...p, sortBy: v })), [setConvoPrefs]);
  const setFilterStatus = useCallback((v: string[] | ((p: string[]) => string[])) => setConvoPrefs(p => ({ ...p, filterStatus: typeof v === "function" ? v(p.filterStatus) : v })), [setConvoPrefs]);
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

  // AI agents — fetched only for agency users; used for pinned agent rows in InboxPanel
  const { data: aiAgents = [] } = useQuery<AiAgent[]>({
    queryKey: ["/api/ai-agents"],
    queryFn: async () => {
      const res = await apiFetch("/api/ai-agents");
      if (!res.ok) return [];
      return res.json() as Promise<AiAgent[]>;
    },
    enabled: isAgencyUser,
    staleTime: 60_000,
  });

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

  // Publish selected conversation entity data for AI agent context
  const publishEntity = usePublishEntityData();
  useEffect(() => {
    if (selected?.lead) {
      const lead = selected.lead;
      publishEntity({
        entityType: "conversation",
        entityId: lead.id,
        entityName: lead.full_name || `${lead.first_name || ""} ${lead.last_name || ""}`.trim(),
        summary: {
          leadId: lead.id,
          name: lead.full_name || `${lead.first_name || ""} ${lead.last_name || ""}`.trim(),
          email: lead.email,
          phone: lead.phone,
          status: lead.conversion_status,
          messageCount: selected.msgs?.length ?? 0,
          unreadCount: selected.unreadCount ?? 0,
          lastMessage: selected.last?.content?.slice(0, 200),
          campaignId: lead.campaign_id || lead.campaigns_id,
        },
        updatedAt: Date.now(),
      });
    }
  }, [selected, publishEntity]);

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
    setSelectedAgentId(null);
    setMobileView("chat");
    setMobileTransitioning(false);
    markAsRead(id);
  };

  const handleBackToInbox = useCallback(() => {
    setMobileTransitioning(true);
    setTimeout(() => {
      setMobileView("inbox");
      setMobileTransitioning(false);
    }, 280);
  }, []);

  const clientAccounts = useMemo(
    () => accounts,
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
              onClick={() => {
                if (isAgentSelected) {
                  setSelectedAgentId(null);
                  setMobileView("inbox");
                } else {
                  handleBackToInbox();
                }
              }}
              className="h-10 w-10 rounded-full border border-black/[0.125] bg-background grid place-items-center"
              data-testid="mobile-chat-back-button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <h1 className="text-2xl font-extrabold tracking-tight">
            {mobileView === "chat" && isAgentSelected
              ? (chatAgent?.name ?? aiAgents.find(a => a.id === selectedAgentId)?.name ?? "AI Agent")
              : mobileView === "chat" && selected && !isSupport
              ? selected.lead.full_name ||
                `${selected.lead.first_name ?? ""} ${selected.lead.last_name ?? ""}`.trim()
              : isSupport
              ? supportBotConfig.name
              : t("page.title")}
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
            data-onboarding="conversations-inbox"
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
              onRefresh={refresh}
              supportBotConfig={supportBotConfig}
              onSelectSupport={() => setMobileView("chat")}
              onSearchChange={setSearchQuery}
              aiAgents={isAgencyUser ? aiAgents : []}
              selectedAgentId={selectedAgentId}
              onSelectAgent={handleSelectAgent}
              className={cn(
                "w-full md:w-[340px] flex-shrink-0",
                mobileView === "chat" ? "hidden md:flex" : "flex"
              )}
              data-testid="mobile-inbox-panel"
            />

            {/* Support chat (inline) */}
            {isSupport && (
              <div className={cn(
                "flex-1 min-w-0",
                mobileView === "inbox"
                  ? "hidden md:block"
                  : mobileTransitioning
                  ? "block animate-slide-out-to-right md:animate-none"
                  : "block animate-slide-in-from-right md:animate-none"
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
              <div
                className={cn(
                  "flex-1 min-w-0 flex flex-col max-w-[1386px]",
                  mobileView === "inbox"
                    ? "hidden md:flex"
                    : mobileTransitioning
                    ? "flex animate-slide-out-to-right md:animate-none"
                    : "flex animate-slide-in-from-right md:animate-none"
                )}
                data-testid="mobile-chat-panel"
                data-onboarding="conversations-chat"
              >
                {isAgentSelected ? (
                  <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    {chatAgent && (
                      <>
                        {/* Agent chat header with controls */}
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 bg-background shrink-0" data-testid="agent-chat-header">
                          <div className="h-8 w-8 rounded-full bg-brand-indigo/10 flex items-center justify-center shrink-0">
                            {chatAgent.photoUrl ? (
                              <img src={chatAgent.photoUrl} alt={chatAgent.name} className="h-8 w-8 rounded-full object-cover" />
                            ) : chatAgent.type === "code_runner" ? (
                              <Zap className="h-4 w-4 text-brand-indigo" />
                            ) : (
                              <Cpu className="h-4 w-4 text-brand-indigo" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">{chatAgent.name}</div>
                            {agentSession?.title && (
                              <div className="text-[10px] text-muted-foreground font-medium truncate mt-0.5" data-testid="conversation-title">
                                {agentSession.title}
                              </div>
                            )}
                          </div>
                          {agentSession && (
                            <>
                              <ModelSwitcher
                                currentModel={agentSession.model}
                                onModelChange={agentUpdateSessionModel}
                                disabled={agentStreaming}
                              />
                              <ThinkingToggle
                                currentLevel={agentSession.thinkingLevel}
                                onLevelChange={agentUpdateSessionThinking}
                                disabled={agentStreaming}
                              />
                            </>
                          )}
                          <button
                            onClick={() => setAgentSettingsOpen(true)}
                            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
                            title="Agent settings"
                            data-testid="agent-settings-btn"
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </button>
                          {agentSession && (
                            <button
                              onClick={agentNewSession}
                              className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
                              title="New conversation"
                              data-testid="agent-new-session-btn"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <AgentChatView
                          agent={chatAgent}
                          messages={agentMessages}
                          streaming={agentStreaming}
                          streamingText={agentStreamingText}
                          loading={agentLoading}
                          onSend={agentSendMessage}
                          onNewSession={agentNewSession}
                          sessionId={agentSession?.sessionId}
                        />
                        <AgentSettingsSheet
                          agent={chatAgent}
                          open={agentSettingsOpen}
                          onOpenChange={setAgentSettingsOpen}
                          onAgentUpdated={(updated) => setChatAgent(updated)}
                        />
                      </>
                    )}
                  </div>
                ) : (
                  <ChatPanel
                    selected={selected}
                    loading={loading}
                    sending={sending}
                    onSend={handleSend}
                    onToggleTakeover={handleToggleTakeover}
                    onRetry={handleRetry}
                    showContactPanel={showContactPanel}
                    onShowContactPanel={() => setShowContactPanel(true)}
                    onNavigateToLead={(leadId) => {
                      localStorage.setItem("selected-lead-id", String(leadId));
                      localStorage.setItem("leads-view-mode", "list");
                      setLocation(`${basePath}/contacts`);
                    }}
                    className="flex-1 min-w-0"
                    headerActions={
                      <>
                        {/* Search — starts expanded */}
                        <SearchPill
                          value={searchQuery}
                          onChange={setSearchQuery}
                          open={searchOpen}
                          onOpenChange={setSearchOpen}
                          placeholder={t("page.searchPlaceholder")}
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
                              title={t("page.groupBy")}
                            >
                              <Layers className="h-4 w-4 shrink-0" />
                              <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">{t("page.group")}</span>
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
                              title={t("page.sort")}
                            >
                              <ArrowUpDown className="h-4 w-4 shrink-0" />
                              <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">{t("page.sort")}</span>
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
                              title={t("page.filter")}
                              data-testid="button-toggle-filters"
                            >
                              <Filter className="h-4 w-4 shrink-0" />
                              <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">{t("page.filter")}</span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {/* Status */}
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="text-[12px]">
                                {t("page.status")}
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
                                  {t("page.account")}
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
                                    {t("page.allAccounts")}
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
                                          {t("page.allCampaigns")}
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
                )}
              </div>
            )}

            {/* Contact sidebar — hidden in support mode and agent mode */}
            {!isSupport && !isAgentSelected && showContactPanel && (
              <ContactSidebar
                selected={selected}
                loading={loading}
                onClose={() => setShowContactPanel(false)}
                onUpdateLead={handleUpdateLead}
                onNavigateToLead={(leadId) => {
                  localStorage.setItem("selected-lead-id", String(leadId));
                  localStorage.setItem("leads-view-mode", "list");
                  setLocation(`${basePath}/contacts`);
                }}
                onRefresh={refresh}
                className="hidden xl:flex w-[340px] flex-shrink-0"
              />
            )}
          </div>
        )}
      </div>
    </CrmShell>
  );
}
