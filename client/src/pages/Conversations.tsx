import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCampaigns } from "@/hooks/useApiData";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import { useConversationsData } from "@/features/conversations/hooks/useConversationsData";
import { InboxPanel } from "@/features/conversations/components/InboxPanel";
import { ChatPanel } from "@/features/conversations/components/ChatPanel";
import { ContactSidebar } from "@/features/conversations/components/ContactSidebar";

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

  // Clear all active filters at once (used by empty state CTA)
  const handleClearFilters = () => {
    setFilterAccountId("all");
    setCampaignId("all");
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
              className="h-10 w-10 rounded-full border border-border bg-background grid place-items-center"
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
              onSearchChange={setSearchQuery}
              selectedCampaignId={campaignId}
              onCampaignChange={setCampaignId}
              campaigns={campaigns}
              accounts={clientAccounts}
              selectedAccountId={filterAccountId}
              onAccountChange={handleAccountChange}
              isAgencyUser={isAgencyUser}
              onClearFilters={handleClearFilters}
              className={cn(
                "w-full md:w-[340px] flex-shrink-0",
                mobileView === "chat" ? "hidden md:flex" : "flex"
              )}
            />

            <ChatPanel
              selected={selected}
              loading={loading}
              sending={sending}
              onSend={handleSend}
              onToggleTakeover={handleToggleTakeover}
              onRetry={handleRetry}
              showContactPanel={showContactPanel}
              onShowContactPanel={() => setShowContactPanel(true)}
              className={cn(
                "flex-1 min-w-0",
                mobileView === "inbox" ? "hidden md:flex" : "flex"
              )}
            />

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
