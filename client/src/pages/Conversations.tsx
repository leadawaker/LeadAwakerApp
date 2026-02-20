import { useEffect, useMemo, useRef, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCampaigns } from "@/hooks/useApiData";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import { useConversationsData, type AiStateFilter, type SortOrder } from "@/features/conversations/hooks/useConversationsData";
import { InboxPanel } from "@/features/conversations/components/InboxPanel";
import { ChatPanel } from "@/features/conversations/components/ChatPanel";
import { ContactSidebar } from "@/features/conversations/components/ContactSidebar";

export default function ConversationsPage() {
  const { currentAccountId, setCurrentAccountId, accounts, isAgencyUser } = useWorkspace();

  // Conversation list filter state
  const [filterAccountId, setFilterAccountId] = useState<number | "all">("all");
  const [campaignId, setCampaignId] = useState<number | "all">("all");
  const [aiStateFilter, setAiStateFilter] = useState<AiStateFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  // Chat state
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<"inbox" | "chat">("inbox");
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [searchQuery, setSearchQuery] = useState("");
  // Track which lead IDs have been "read" (opened) in this session
  const [readLeadIds, setReadLeadIds] = useState<Set<number>>(new Set());

  // Resolve which account ID to scope data to
  // Agency users can pick "all" to see all accounts, or a specific one
  // Client users always see their account only
  const effectiveAccountId = useMemo(() => {
    if (!isAgencyUser) return currentAccountId;
    if (filterAccountId === "all") return undefined; // no filter = all accounts
    return filterAccountId as number;
  }, [isAgencyUser, filterAccountId, currentAccountId]);

  const { threads, loading, error, sending, handleSend, handleToggleTakeover, refresh } = useConversationsData(
    effectiveAccountId,
    campaignId,
    tab,
    searchQuery,
    aiStateFilter,
    sortOrder,
  );

  // Load campaigns for the filter dropdown
  const { campaigns } = useCampaigns(effectiveAccountId);

  // When account filter changes for agency, also reset campaign filter
  const handleAccountChange = (id: number | "all") => {
    setFilterAccountId(id);
    setCampaignId("all");
  };

  // Clear all active filters at once (used by empty state CTA)
  const handleClearFilters = () => {
    setFilterAccountId("all");
    setCampaignId("all");
    setAiStateFilter("all");
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
      setReadLeadIds((prev) => {
        const next = new Set(prev);
        next.add(currentId);
        return next;
      });
    }
  }, [selected]);

  const handleSelectLead = (id: number) => {
    setSelectedLeadId(id);
    setMobileView("chat");
    // Mark this conversation as read (clears unread badge)
    setReadLeadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // Filter accounts to exclude the agency account (id=1) for the account filter dropdown
  const clientAccounts = useMemo(
    () => accounts.filter((a) => a.id !== 1),
    [accounts],
  );

  return (
    <CrmShell>
      <div
        className="h-[calc(100vh-100px)] flex flex-col overflow-hidden pb-3"
        data-testid="page-conversations"
      >
        {/* Mobile header */}
        <div className="px-4 md:px-6 pt-4 md:pt-6 pb-2 shrink-0 flex md:hidden items-center gap-3">
          {mobileView === "chat" && (
            <button
              onClick={() => setMobileView("inbox")}
              className="h-9 w-9 rounded-full border border-border bg-background grid place-items-center"
            >
              <ChevronLeft className="h-5 w-5" />
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
            className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[400px_1fr_340px] gap-4"
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
              onSearchChange={setSearchQuery}
              selectedCampaignId={campaignId}
              onCampaignChange={setCampaignId}
              aiStateFilter={aiStateFilter}
              onAiStateFilterChange={setAiStateFilter}
              campaigns={campaigns}
              accounts={clientAccounts}
              selectedAccountId={filterAccountId}
              onAccountChange={handleAccountChange}
              isAgencyUser={isAgencyUser}
              readLeadIds={readLeadIds}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              onClearFilters={handleClearFilters}
              className={cn(mobileView === "chat" ? "hidden md:flex" : "flex")}
            />

            <ChatPanel
              selected={selected}
              loading={loading}
              sending={sending}
              onSend={handleSend}
              onToggleTakeover={handleToggleTakeover}
              className={cn(mobileView === "inbox" ? "hidden md:flex" : "flex")}
            />

            <ContactSidebar selected={selected} loading={loading} />
          </div>
        )}
      </div>
    </CrmShell>
  );
}
