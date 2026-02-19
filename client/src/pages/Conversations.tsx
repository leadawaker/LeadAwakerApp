import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { FiltersBar } from "@/components/crm/FiltersBar";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import { useConversationsData } from "@/features/conversations/hooks/useConversationsData";
import { InboxPanel } from "@/features/conversations/components/InboxPanel";
import { ChatPanel } from "@/features/conversations/components/ChatPanel";
import { ContactSidebar } from "@/features/conversations/components/ContactSidebar";

export default function ConversationsPage() {
  const { currentAccountId } = useWorkspace();
  const [campaignId, setCampaignId] = useState<number | "all">("all");
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<"inbox" | "chat">("inbox");
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { threads, loading, error, sending, handleSend, refresh } = useConversationsData(
    currentAccountId,
    campaignId,
    tab,
    searchQuery,
  );

  const selected = useMemo(() => {
    const byId = selectedLeadId
      ? threads.find((t) => t.lead.id === selectedLeadId) ?? null
      : null;
    return byId ?? threads[0] ?? null;
  }, [threads, selectedLeadId]);

  const handleSelectLead = (id: number) => {
    setSelectedLeadId(id);
    setMobileView("chat");
  };

  return (
    <CrmShell>
      <div
        className="h-[calc(100vh-100px)] flex flex-col overflow-hidden pb-3"
        data-testid="page-conversations"
      >
        <div className="px-4 md:px-6 pt-4 md:pt-6 pb-2 shrink-0 hidden">
          <div className="flex items-center gap-4">
            {mobileView === "chat" && (
              <button
                onClick={() => setMobileView("inbox")}
                className="md:hidden h-9 w-9 rounded-full border border-border bg-background grid place-items-center"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {mobileView === "chat" && selected
                ? selected.lead.full_name
                : "Conversations"}
            </h1>
            <div
              className={cn(
                "flex-1 md:flex-none",
                mobileView === "chat" && "hidden md:block",
              )}
            >
              <FiltersBar
                selectedCampaignId={campaignId}
                setSelectedCampaignId={setCampaignId}
              />
            </div>
          </div>
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
            className={cn(mobileView === "chat" ? "hidden md:flex" : "flex")}
          />

          <ChatPanel
            selected={selected}
            sending={sending}
            onSend={handleSend}
            className={cn(mobileView === "inbox" ? "hidden md:flex" : "flex")}
          />

          <ContactSidebar selected={selected} />
        </div>
        )}
      </div>
    </CrmShell>
  );
}
