import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCampaigns } from "@/hooks/useApiData";
import { cn } from "@/lib/utils";
import { ChevronLeft, Plus, Search, SlidersHorizontal, Layers, ArrowUpDown, Filter, Check } from "lucide-react";
import { useConversationsData } from "@/features/conversations/hooks/useConversationsData";
import { InboxPanel, type ChatGroupBy, type ChatSortBy, GROUP_LABELS, SORT_LABELS } from "@/features/conversations/components/InboxPanel";
import { ChatPanel } from "@/features/conversations/components/ChatPanel";
import { ContactSidebar } from "@/features/conversations/components/ContactSidebar";
import { IconBtn } from "@/components/ui/icon-btn";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  const { currentAccountId, setCurrentAccountId, accounts, isAgencyUser } = useWorkspace();

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
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Group / Sort / Filter state (lifted from InboxPanel so toolbar can live in chat area)
  const [groupBy, setGroupBy] = useState<ChatGroupBy>("date");
  const [sortBy, setSortBy] = useState<ChatSortBy>("newest");
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  // Persist lastReadAt to localStorage on every change
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

  // Contact sidebar visibility
  const [showContactPanel, setShowContactPanel] = useState(true);

  // Resolve which account ID to scope data to
  // Agency users can pick "all" to see all accounts, or a specific one
  // Client users always see their account only
  const effectiveAccountId = useMemo(() => {
    if (!isAgencyUser) return currentAccountId;
    if (filterAccountId === "all") return undefined; // no filter = all accounts
    return filterAccountId as number;
  }, [isAgencyUser, filterAccountId, currentAccountId]);

  const { threads, loading, error, sending, handleSend, handleToggleTakeover, handleUpdateLead, handleRetry, refresh } = useConversationsData(
    effectiveAccountId,
    campaignId,
    tab,
    searchQuery,
    "all",
    "newest",
    lastReadAt,
  );

  // Load campaigns for the filter dropdown
  const { campaigns } = useCampaigns(effectiveAccountId);

  // When account filter changes for agency, also reset campaign filter
  const handleAccountChange = (id: number | "all") => {
    setFilterAccountId(id);
    setCampaignId("all");
  };

  // Settings helpers
  const isGroupNonDefault = groupBy !== "date";
  const isSortNonDefault = sortBy !== "newest";
  const hasNonDefaultControls =
    isGroupNonDefault ||
    isSortNonDefault ||
    filterStatus.length > 0 ||
    campaignId !== "all" ||
    (isAgencyUser && filterAccountId !== "all");

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

  // Clear all active filters at once (used by empty state CTA)
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

  // Auto-mark the currently visible thread as read whenever it changes
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
    // Mark this conversation as read (clears unread badge)
    markAsRead(id);
  };

  // Filter accounts to exclude the agency account (id=1) for the account filter dropdown
  const clientAccounts = useMemo(
    () => accounts.filter((a) => a.id !== 1),
    [accounts],
  );

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
            {mobileView === "chat" && selected
              ? selected.lead.full_name ||
                `${selected.lead.first_name ?? ""} ${selected.lead.last_name ?? ""}`.trim()
              : "Conversations"}
          </h1>
        </div>

        {error && threads.length === 0 && !loading ? (
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
              className={cn(
                "w-full md:w-[340px] flex-shrink-0",
                mobileView === "chat" ? "hidden md:flex" : "flex"
              )}
            />

            {/* Chat area */}
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
                    <IconBtn title="New Conversation" onClick={() => {/* TODO: new conversation flow */}}>
                      <Plus className="h-4 w-4" />
                    </IconBtn>

                    <Popover open={searchOpen} onOpenChange={(open) => { setSearchOpen(open); if (!open) setSearchQuery(""); }}>
                      <PopoverTrigger asChild>
                        <IconBtn active={searchOpen || !!searchQuery} title="Search contacts">
                          <Search className="h-4 w-4" />
                        </IconBtn>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-56 p-2" sideOffset={4}>
                        <input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search contacts..."
                          autoFocus
                          className="w-full h-8 px-3 rounded-lg bg-muted/60 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-indigo/30 placeholder:text-muted-foreground/60"
                        />
                      </PopoverContent>
                    </Popover>

                    <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
                      <DropdownMenuTrigger asChild>
                        <IconBtn
                          active={settingsOpen || hasNonDefaultControls}
                          title="Group, Sort & Filter"
                          data-testid="button-toggle-filters"
                        >
                          <SlidersHorizontal className="h-4 w-4" />
                        </IconBtn>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="text-[12px]">
                            <Layers className="h-3.5 w-3.5 mr-2" />
                            Group
                            {isGroupNonDefault && <span className="ml-auto text-[10px] text-brand-indigo font-medium">{GROUP_LABELS[groupBy]}</span>}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-40">
                            {(Object.keys(GROUP_LABELS) as ChatGroupBy[]).map((opt) => (
                              <DropdownMenuItem key={opt} onClick={() => setGroupBy(opt)} className={cn("text-[12px]", groupBy === opt && "font-semibold text-brand-indigo")}>
                                {GROUP_LABELS[opt]}
                                {groupBy === opt && <Check className="h-3 w-3 ml-auto" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="text-[12px]">
                            <ArrowUpDown className="h-3.5 w-3.5 mr-2" />
                            Sort
                            {isSortNonDefault && <span className="ml-auto text-[10px] text-brand-indigo font-medium">{SORT_LABELS[sortBy]}</span>}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-44">
                            {(Object.keys(SORT_LABELS) as ChatSortBy[]).map((opt) => (
                              <DropdownMenuItem key={opt} onClick={() => setSortBy(opt)} className={cn("text-[12px]", sortBy === opt && "font-semibold text-brand-indigo")}>
                                {SORT_LABELS[opt]}
                                {sortBy === opt && <Check className="h-3 w-3 ml-auto" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        <DropdownMenuSeparator />

                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="text-[12px]">
                            <Filter className="h-3.5 w-3.5 mr-2" />
                            Filter Status
                            {filterStatus.length > 0 && <span className="ml-auto text-[10px] text-brand-indigo font-medium">{filterStatus.length}</span>}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-48 max-h-60 overflow-y-auto">
                            {PIPELINE_STATUSES.map((s) => (
                              <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); handleToggleFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PIPELINE_HEX[s] ?? "#6B7280" }} />
                                <span className="flex-1">{s}</span>
                                {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        {isAgencyUser && clientAccounts.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="text-[12px]">
                                Account
                                {filterAccountId !== "all" && (
                                  <span className="ml-auto text-[10px] text-brand-indigo font-medium truncate max-w-[80px]">
                                    {clientAccounts.find((a) => a.id === filterAccountId)?.name ?? ""}
                                  </span>
                                )}
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="w-44 max-h-60 overflow-y-auto">
                                <DropdownMenuItem onClick={() => handleAccountChange("all")} className={cn("text-[12px]", filterAccountId === "all" && "font-semibold text-brand-indigo")}>
                                  All Accounts
                                  {filterAccountId === "all" && <Check className="h-3 w-3 ml-auto" />}
                                </DropdownMenuItem>
                                {clientAccounts.map((a) => (
                                  <DropdownMenuItem key={a.id} onClick={() => handleAccountChange(a.id)} className={cn("text-[12px]", filterAccountId === a.id && "font-semibold text-brand-indigo")}>
                                    {a.name}
                                    {filterAccountId === a.id && <Check className="h-3 w-3 ml-auto" />}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          </>
                        )}

                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="text-[12px]">
                            Campaign
                            {campaignId !== "all" && (
                              <span className="ml-auto text-[10px] text-brand-indigo font-medium truncate max-w-[80px]">
                                {campaigns.find((c: any) => c.id === campaignId)?.name ?? ""}
                              </span>
                            )}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-44 max-h-60 overflow-y-auto">
                            <DropdownMenuItem onClick={() => setCampaignId("all")} className={cn("text-[12px]", campaignId === "all" && "font-semibold text-brand-indigo")}>
                              All Campaigns
                              {campaignId === "all" && <Check className="h-3 w-3 ml-auto" />}
                            </DropdownMenuItem>
                            {campaigns.map((c: any) => (
                              <DropdownMenuItem key={c.id} onClick={() => setCampaignId(c.id)} className={cn("text-[12px]", campaignId === c.id && "font-semibold text-brand-indigo")}>
                                {c.name}
                                {campaignId === c.id && <Check className="h-3 w-3 ml-auto" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        {hasNonDefaultControls && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleResetControls} className="text-[12px] text-destructive">
                              Reset all settings
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                }
              />
            </div>

            {showContactPanel && (
              <ContactSidebar
                selected={selected}
                loading={loading}
                onClose={() => setShowContactPanel(false)}
                onUpdateLead={handleUpdateLead}
                className="hidden xl:flex w-[340px] flex-shrink-0"
              />
            )}
          </div>
        )}
      </div>
    </CrmShell>
  );
}
