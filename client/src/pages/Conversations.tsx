import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { ChevronLeft, Plus, Settings, Zap, Cpu } from "lucide-react";
import { useConversationsData } from "@/features/conversations/hooks/useConversationsData";
import { InboxPanel, type ChatGroupBy, type ChatSortBy, type InboxTab } from "@/features/conversations/components/InboxPanel";
import { ChatPanel } from "@/features/conversations/components/ChatPanel";
import { ProspectChatPanel } from "@/features/conversations/components/ProspectChatPanel";
import { useProspectConversations } from "@/features/conversations/hooks/useProspectConversations";
import { ContactSidebar } from "@/features/conversations/components/ContactSidebar";
import { AgentChatView } from "@/features/ai-agents/components/AgentChatView";
import { AgentConversationList } from "@/features/ai-agents/components/AgentConversationList";
import { AgentSettingsSheet } from "@/features/ai-agents/components/AgentSettingsSheet";
import { ModelSwitcher } from "@/features/ai-agents/components/ModelSwitcher";
import { ThinkingToggle } from "@/features/ai-agents/components/ThinkingToggle";
import { useAgentChat } from "@/features/ai-agents/hooks/useAgentChat";
import { SupportChatWidget } from "@/components/crm/SupportChatWidget";
import { FounderInbox } from "@/components/crm/FounderInbox";
import { useSupportChat } from "@/hooks/useSupportChat";
import { useFounderChat } from "@/hooks/useFounderChat";
import { apiFetch } from "@/lib/apiUtils";
import { useChatDoodle } from "@/hooks/useChatDoodle";
import { useTheme } from "@/hooks/useTheme";
import { getDoodleStyle } from "@/components/ui/doodle-patterns";
import { useBgSlotLayers } from "@/hooks/useBgSlots";
import { layerToStyle } from "@/components/ui/gradient-tester";

type AiAgent = { id: number; name: string; type: string; photoUrl: string | null; enabled: boolean };

export default function ConversationsPage() {
  const { t } = useTranslation("conversations");
  const { currentAccountId, accounts, isAgencyUser } = useWorkspace();
  const queryClient = useQueryClient();
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

  // Prospect selection state (hooks only — effects that depend on `tab` are below its declaration)
  const [selectedProspectId, setSelectedProspectId] = useState<number | null>(null);
  const { data: prospectThreads = [] } = useProspectConversations();
  // Stores prospect data when selected from the "+" picker (not yet in prospectThreads)
  const [uncontactedProspect, setUncontactedProspect] = useState<{ id: number; name: string; company: string; phone?: string | null } | null>(null);

  const handleSelectProspect = (prospectId: number) => {
    setSelectedProspectId(prospectId);
    setSelectedLeadId(null);
    setSelectedAgentId(null);
    setMobileView("chat");
    const inThreads = prospectThreads.some((p) => p.prospect_id === prospectId);
    if (inThreads) {
      setUncontactedProspect(null);
    } else {
      // Prospect has no messages yet — look up their data from the all-prospects cache
      const cached = queryClient.getQueryData<any[]>(["/api/prospects"]);
      const found = cached?.find((p: any) => (p.id ?? p.Id) === prospectId);
      if (found) {
        setUncontactedProspect({
          id: prospectId,
          name: found.contact_name || found.contactName || found.company || found.name || "Unknown",
          company: found.company || found.name || "",
          phone: found.contact_phone || found.contactPhone || found.phone || null,
        });
      }
    }
  };

  const handleSelectAgent = (agentId: number) => {
    setSelectedAgentId(agentId);
    setSelectedLeadId(null);
    setSelectedProspectId(null);
    setTab("all");
    setMobileView("chat");
  };

  /** Select an agent chat from the support tab — stays on the support tab */
  const handleSelectAgentChat = useCallback((agentId: number, sessionId?: string) => {
    setSelectedAgentId(agentId);
    setSelectedLeadId(null);
    // Stay on support tab — don't switch to "all"
    setMobileView("chat");
    // If a specific session was picked, load it after agent initializes
    if (sessionId) {
      // Small delay to let agentInitialize run from the useEffect
      setTimeout(() => agentLoadSession(sessionId), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAgentSettings = (agentId: number) => {
    // Select the agent first (loads its data), then open settings
    if (selectedAgentId !== agentId) {
      setSelectedAgentId(agentId);
      setSelectedLeadId(null);
      setTab("all");
    }
    // Delay settings open slightly to let agent data load
    setTimeout(() => setAgentSettingsOpen(true), 100);
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
    loadSession: agentLoadSession,
    updateSessionModel: agentUpdateSessionModel,
    updateSessionThinking: agentUpdateSessionThinking,
    pendingConfirmation: agentPendingConfirmation,
    activity: agentActivity,
    confirmDestructiveActions: agentConfirmDestructive,
    cancelDestructiveActions: agentCancelDestructive,
    abortStream: agentAbortStream,
  } = useAgentChat();

  // Agent settings sheet state
  const [agentSettingsOpen, setAgentSettingsOpen] = useState(false);

  // Chat background (gradient/doodle) — shared with SupportChatWidget & ChatPanel
  const { config: doodleConfig } = useChatDoodle();
  const { isDark } = useTheme();
  const activeSlotLayers = useBgSlotLayers("social1", isDark);

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

  // Inbox tab
  const [tab, setTab] = useState<InboxTab>("all");

  // Read URL params on mount for deep linking (prospect tab)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "prospects") {
      setTab("prospects");
      const pid = params.get("prospectId");
      if (pid) setSelectedProspectId(Number(pid));
    }
  }, []);

  // Auto-select newest prospect when switching to prospects tab with nothing selected
  useEffect(() => {
    if (tab === "prospects" && !selectedProspectId && prospectThreads.length > 0) {
      setSelectedProspectId(prospectThreads[0].prospect_id);
    }
  }, [tab, selectedProspectId, prospectThreads]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(true); // starts expanded

  // Group / Sort / Filter state (persisted)
  const [convoPrefs, setConvoPrefs] = usePersistedState("conversations-prefs", {
    groupBy: "date" as ChatGroupBy,
    sortBy: "newest" as ChatSortBy,
    filterStatus: [] as string[],
    groupDirection: "asc" as "asc" | "desc",
  });
  const groupBy = convoPrefs.groupBy;
  const sortBy = convoPrefs.sortBy;
  const filterStatus = convoPrefs.filterStatus;
  const groupDirection = convoPrefs.groupDirection ?? "asc";
  const setGroupBy = useCallback((v: ChatGroupBy) => setConvoPrefs(p => ({ ...p, groupBy: v })), [setConvoPrefs]);
  const setGroupDirection = useCallback((v: "asc" | "desc") => setConvoPrefs(p => ({ ...p, groupDirection: v })), [setConvoPrefs]);
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
    tab === "support" || tab === "prospects" ? "all" : tab,
    searchQuery,
    "all",
    "newest",
    lastReadAt,
  );

  // All campaigns (no account filter) for the Filter > Account > Campaign drill-down
  const { campaigns: allCampaigns } = useCampaigns(undefined);
  const campaignsMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of allCampaigns) m.set(c.id, c.name);
    return m;
  }, [allCampaigns]);

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
  const founderChat = useFounderChat();
  const [showFounderInbox, setShowFounderInbox] = useState(false);

  // Auto-open founder chat when navigated from sidebar "Message Gabriel" button
  // (temporarily disabled for debugging)

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
    setGroupDirection("asc");
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
    setSelectedProspectId(null);
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

  const isSupport = tab === "support";
  const isProspects = tab === "prospects";

  return (
    <CrmShell>
      <div
        className="h-full flex flex-col overflow-hidden"
        data-testid="page-conversations"
      >
        {/* Mobile header */}
        <div className="px-4 md:px-6 pt-4 md:pt-6 pb-2 shrink-0 flex md:hidden items-center gap-3 min-w-0">
          {mobileView === "chat" && (
            <button
              onClick={() => {
                if (isAgentSelected && isSupport) {
                  // Back from agent chat to support tab inbox
                  setSelectedAgentId(null);
                  setMobileView("inbox");
                } else if (isProspects) {
                  setSelectedProspectId(null);
                  setMobileView("inbox");
                } else if (isAgentSelected) {
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
          <h1 className="text-2xl font-extrabold tracking-tight truncate min-w-0">
            {mobileView === "chat" && isAgentSelected
              ? (chatAgent?.name ?? aiAgents.find(a => a.id === selectedAgentId)?.name ?? "AI Agent")
              : mobileView === "chat" && isProspects && selectedProspectId
              ? (prospectThreads.find(p => p.prospect_id === selectedProspectId)?.company || "Prospect")
              : mobileView === "chat" && selected && !isSupport && !isProspects
              ? selected.lead.full_name ||
                `${selected.lead.first_name ?? ""} ${selected.lead.last_name ?? ""}`.trim()
              : isSupport
              ? supportBotConfig.name
              : isProspects
              ? "Prospects"
              : t("page.title")}
          </h1>
        </div>

        {error && threads.length === 0 && !loading && !isSupport && !isProspects ? (
          <ApiErrorFallback
            error={error}
            onRetry={() => refresh()}
            isRetrying={loading}
          />
        ) : (
          <div
            className={cn(
              "flex-1 min-h-0 flex gap-[3px]",
              mobileView === "chat" ? "flex-col lg:flex-row" : "flex-col lg:flex-row"
            )}
            data-testid="layout-conversations"
          >
            {/* Left panel: AgentConversationList (agent selected, NOT support tab) or InboxPanel */}
            {isAgentSelected && selectedAgentId !== null && !isSupport && !isProspects ? (
              <div
                className={cn(
                  "w-full lg:w-[340px] lg:flex-shrink-0 bg-muted rounded-lg overflow-hidden h-full",
                  mobileView === "chat" ? "hidden lg:flex" : "flex"
                )}
                data-testid="agent-conversations-panel"
              >
                <AgentConversationList
                  agentId={selectedAgentId}
                  agentName={chatAgent?.name ?? aiAgents.find(a => a.id === selectedAgentId)?.name ?? "AI Agent"}
                  agentType={chatAgent?.type ?? aiAgents.find(a => a.id === selectedAgentId)?.type ?? "custom"}
                  agentPhotoUrl={chatAgent?.photoUrl ?? aiAgents.find(a => a.id === selectedAgentId)?.photoUrl ?? null}
                  currentSessionId={agentSession?.sessionId ?? null}
                  onSelectConversation={(sessionId) => {
                    agentLoadSession(sessionId);
                    setMobileView("chat");
                  }}
                  onNewConversation={() => {
                    agentNewSession();
                    setMobileView("chat");
                  }}
                  onBack={() => {
                    setSelectedAgentId(null);
                    setTab("all");
                  }}
                  className="w-full"
                />
              </div>
            ) : (
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
                onSelectSupport={() => {
                  setSelectedAgentId(null);
                  setShowFounderInbox(false);
                  setMobileView("chat");
                }}
                onSearchChange={setSearchQuery}
                aiAgents={isAgencyUser ? aiAgents : []}
                selectedAgentId={selectedAgentId}
                onSelectAgent={handleSelectAgent}
                onSelectAgentChat={handleSelectAgentChat}
                activeAgentSessionId={agentSession?.sessionId ?? null}
                onAgentSettings={handleAgentSettings}
                onDeselectAgent={() => setSelectedAgentId(null)}
                campaignsMap={campaignsMap}
                prospectThreads={prospectThreads}
                selectedProspectId={selectedProspectId}
                onSelectProspect={handleSelectProspect}
                showFounderInbox={showFounderInbox}
                onToggleFounderInbox={() => {
                  setShowFounderInbox(true);
                  setSelectedAgentId(null);
                  setMobileView("chat");
                }}
                clientAccounts={clientAccounts}
                allCampaigns={allCampaigns}
                onSetGroupBy={setGroupBy}
                groupDirection={groupDirection}
                onSetGroupDirection={setGroupDirection}
                onSetSortBy={setSortBy}
                onToggleFilterStatus={handleToggleFilterStatus}
                onSetFilterAccountId={handleAccountChange}
                onSetCampaignId={setCampaignId}
                searchOpen={searchOpen}
                onSearchOpenChange={setSearchOpen}
                filterOpen={filterOpen}
                onFilterOpenChange={setFilterOpen}
                className={cn(
                  "w-full lg:w-[340px] lg:flex-shrink-0",
                  mobileView === "chat" ? "hidden lg:flex" : "flex"
                )}
                data-testid="mobile-inbox-panel"
              />
            )}

            {/* Right panel — single persistent container, all views toggled via CSS to prevent layout reflow */}
              <div
                className={cn(
                  "flex-1 min-w-0 flex flex-col overflow-hidden",
                  mobileView === "inbox" ? "hidden lg:flex" : "flex"
                )}
                data-testid="mobile-chat-panel"
                data-onboarding="conversations-chat"
              >
                {/* Support chat or Founder inbox — visible on support tab when no agent selected */}
                <div className={cn("flex-1 min-h-0 flex flex-col", isSupport && !isAgentSelected ? "flex" : "hidden")}>
                  {isAdmin && showFounderInbox ? (
                    <FounderInbox />
                  ) : (
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
                      founderChat={{
                        messages: founderChat.messages as any,
                        sending: founderChat.sending,
                        loading: founderChat.loading,
                        initialize: founderChat.initialize,
                        sendMessage: founderChat.sendMessage,
                        closeSession: founderChat.closeSession,
                        clearContext: founderChat.clearContext,
                      }}
                    />
                  )}
                </div>

                {/* Prospect chat panel — visible on prospects tab when a prospect is selected */}
                <div className={cn("flex-1 min-h-0 flex flex-col", isProspects && selectedProspectId && !isAgentSelected ? "flex" : "hidden")}>
                  {selectedProspectId && (() => {
                    const pt = prospectThreads.find((p) => p.prospect_id === selectedProspectId);
                    const prospectData = pt
                      ? { name: pt.contact_name || pt.name, company: pt.company, email: pt.contact_email, phone: pt.contact_phone || pt.phone, status: pt.outreach_status }
                      : uncontactedProspect?.id === selectedProspectId
                      ? { name: uncontactedProspect.name, company: uncontactedProspect.company, email: "", phone: uncontactedProspect.phone, status: "new" }
                      : null;
                    return prospectData ? (
                      <ProspectChatPanel
                        prospectId={selectedProspectId}
                        prospectName={prospectData.name}
                        prospectCompany={prospectData.company}
                        contactEmail={prospectData.email}
                        outreachStatus={prospectData.status}
                        contactPhone={prospectData.phone}
                      />
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        Select a prospect to view messages
                      </div>
                    );
                  })()}
                </div>
                {/* Prospect empty state — visible on prospects tab when no prospect selected */}
                <div className={cn("flex-1 min-h-0 flex items-center justify-center text-muted-foreground", isProspects && !selectedProspectId && !isAgentSelected ? "flex" : "hidden")}>
                  Select a prospect to view messages
                </div>

                {/* Agent chat — visible when any agent is selected on any tab */}
                <div className={cn("flex-1 min-h-0 flex flex-col rounded-lg overflow-hidden relative", isAgentSelected && chatAgent ? "flex" : "hidden")}>
                  {/* Gradient / doodle background — matches SupportChatWidget & ChatPanel */}
                  {doodleConfig.bgStyle === "crm" && (
                    <div className="absolute inset-0 bg-card" />
                  )}
                  {doodleConfig.bgStyle !== "crm" && activeSlotLayers.map((layer: any) => {
                    const style = layerToStyle(layer);
                    if (!style) return null;
                    return <div key={layer.id} className="absolute inset-0" style={style} />;
                  })}
                  {doodleConfig.enabled && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={getDoodleStyle(doodleConfig.patternId, doodleConfig.color, doodleConfig.size, isDark ? 100 : 0, isDark ? "screen" : "multiply")}
                    />
                  )}

                  {/* Content above background */}
                  <div className="relative flex flex-col h-full overflow-hidden">
                    {chatAgent && (
                      <>
                        <div className="flex items-center gap-2.5 px-4 py-3 bg-white dark:bg-card border-b border-black/[0.06] shrink-0">
                          <div className="h-9 w-9 rounded-full bg-brand-indigo/10 flex items-center justify-center shrink-0 overflow-hidden">
                            {chatAgent.photoUrl ? (
                              <img src={chatAgent.photoUrl} alt={chatAgent.name} className="h-9 w-9 rounded-full object-cover" />
                            ) : chatAgent.type === "code_runner" ? (
                              <Zap className="h-4 w-4 text-green-600" />
                            ) : (
                              <Cpu className="h-4 w-4 text-brand-indigo" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[27px] font-heading font-semibold leading-tight truncate text-foreground">
                              {chatAgent.name}
                            </p>
                            {agentSession?.title && (
                              <p className="text-[11px] text-muted-foreground font-medium truncate mt-0.5">
                                {agentSession.title}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 ml-auto">
                            {agentSession && (
                              <>
                                <div className="hidden sm:flex items-center gap-1.5">
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
                                </div>
                                <button
                                  onClick={agentNewSession}
                                  className="inline-flex items-center justify-center h-9 w-9 rounded-full text-[12px] font-medium border border-black/[0.125] bg-transparent text-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
                                  title="New conversation"
                                  data-testid="agent-support-new-session-btn"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => setAgentSettingsOpen(true)}
                              className="inline-flex items-center justify-center h-9 w-9 rounded-full text-[12px] font-medium border border-black/[0.125] bg-transparent text-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
                              title="Agent settings"
                              data-testid="agent-support-settings-btn"
                            >
                              <Settings className="h-3.5 w-3.5" />
                            </button>
                          </div>
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
                          pendingConfirmation={agentPendingConfirmation}
                          activity={agentActivity}
                          onConfirmDestructive={agentConfirmDestructive}
                          onCancelDestructive={agentCancelDestructive}
                          onAbort={agentAbortStream}
                        />
                        <AgentSettingsSheet
                          agent={chatAgent}
                          open={agentSettingsOpen}
                          onOpenChange={setAgentSettingsOpen}
                          onAgentUpdated={(updated) => setChatAgent(updated)}
                          onAgentDeleted={() => {
                            setChatAgent(null as any);
                            setSelectedAgentId(null);
                          }}
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* Lead ChatPanel — visible when no agent selected and not on support tab */}
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
                  className={cn("flex-1 min-w-0", !isSupport && !isProspects && !isAgentSelected ? "flex" : "hidden")}
                />
              </div>

            {/* Contact sidebar — hidden in support mode and agent mode */}
            {!isSupport && !isProspects && !isAgentSelected && showContactPanel && (
              <div data-onboarding="conversations-contact" className="hidden lg:flex w-[340px] flex-shrink-0">
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
                  campaignsMap={campaignsMap}
                  className="w-full"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </CrmShell>
  );
}
