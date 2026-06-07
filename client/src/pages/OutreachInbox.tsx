import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useCompactPanelState } from "@/components/crm/CompactEntityRail";
import { useListPanelState } from "@/hooks/useListPanelState";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { fetchProspectsByIds } from "@/features/prospects/api/prospectsApi";
import { InboxPanel } from "@/features/conversations/components/InboxPanel";
import { ProspectChatPanel } from "@/features/conversations/components/ProspectChatPanel";
import { ProspectDetailSidebar } from "@/features/conversations/components/ProspectDetailSidebar";
import { useProspectConversations } from "@/features/conversations/hooks/useProspectConversations";

/**
 * Outreach Inbox — prospect-only messaging page.
 *
 * Split out of the retired Chats (Conversations) page: lead chat now lives on the
 * Leads page, AI agents on /ai-agents. This page keeps only the prospect outreach
 * inbox, surfaced under the "Outreach" nav section.
 */
export default function OutreachInbox() {
  const { t } = useTranslation("crm");
  const { isAgencyUser } = useWorkspace();

  const [selectedProspectId, setSelectedProspectId] = useState<number | null>(null);
  const [dialOpenProspectId, setDialOpenProspectId] = useState<number | null>(null);
  const { data: prospectThreads = [] } = useProspectConversations();
  // Stores prospect data when selected from the "+" picker (not yet in prospectThreads)
  const [uncontactedProspect, setUncontactedProspect] = useState<{ id: number; name: string; company: string; phone?: string | null } | null>(null);

  const [mobileView, setMobileView] = useState<"inbox" | "chat">("inbox");

  const [showProspectPanel, setShowProspectPanel] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("la:prospect-panel-state");
      return v === null ? true : v === "1";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("la:prospect-panel-state", showProspectPanel ? "1" : "0");
    } catch {}
  }, [showProspectPanel]);

  // Deep link support: ?prospectId=123
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("prospectId");
    if (pid) {
      handleSelectProspect(Number(pid));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select newest prospect when nothing is selected
  useEffect(() => {
    if (!selectedProspectId && prospectThreads.length > 0) {
      setSelectedProspectId(prospectThreads[0].prospect_id);
    }
  }, [selectedProspectId, prospectThreads]);

  function handleSelectProspect(prospectId: number) {
    setSelectedProspectId(prospectId);
    setMobileView("chat");
    const inThreads = prospectThreads.some((p) => p.prospect_id === prospectId);
    if (inThreads) {
      setUncontactedProspect(null);
    } else {
      // Prospect has no messages yet — fetch their data on demand
      fetchProspectsByIds([prospectId])
        .then((items) => {
          const found = items[0];
          if (found) {
            setUncontactedProspect({
              id: prospectId,
              name: found.contact_name || found.contactName || found.company || found.name || "Unknown",
              company: found.company || found.name || "",
              phone: found.contact_phone || found.contactPhone || found.phone || null,
            });
          }
        })
        .catch(() => { /* Swallow: uncontacted banner stays empty */ });
    }
  }

  const handleDialProspect = (prospectId: number) => {
    handleSelectProspect(prospectId);
    setDialOpenProspectId(prospectId);
  };

  const isMobile = useIsMobile();

  // Shared global list-panel state (Prospects/Leads/Campaigns/Chats all cycle together).
  const { ref: chatPanelAreaRef, narrow: chatPanelNarrow } = useCompactPanelState(false, { activateBelow: 720, deactivateAbove: 960 });
  const { state: listPanelState } = useListPanelState();
  const isListCompact = !isMobile && (listPanelState === "compact" || (listPanelState === "full" && chatPanelNarrow));
  const isListHidden = listPanelState === "hidden";

  const selectedThread = useMemo(
    () => prospectThreads.find((p) => p.prospect_id === selectedProspectId) ?? null,
    [prospectThreads, selectedProspectId],
  );

  return (
    <CrmShell>
      <div className="h-full flex flex-col overflow-hidden" data-testid="page-outreach-inbox">
        {/* Mobile header */}
        <div className="px-4 md:px-6 pt-4 md:pt-6 pb-2 shrink-0 flex md:hidden items-center gap-3 min-w-0">
          {mobileView === "chat" && (
            <button
              onClick={() => {
                setSelectedProspectId(null);
                setMobileView("inbox");
              }}
              className="h-10 w-10 rounded-full border border-black/[0.125] bg-background grid place-items-center"
              data-testid="mobile-chat-back-button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <h1 className="text-2xl font-extrabold tracking-tight truncate min-w-0">
            {mobileView === "chat" && selectedProspectId
              ? (selectedThread?.company || uncontactedProspect?.company || "Prospect")
              : t("sidebar.inbox")}
          </h1>
        </div>

        <div
          className="flex-1 min-h-0 flex flex-col lg:flex-row gap-[var(--panel-gap)]"
          data-testid="layout-outreach-inbox"
        >
          {/* Left panel: prospect-only inbox list */}
          <InboxPanel
            prospectOnly
            threads={[]}
            loading={false}
            selectedLeadId={null}
            onSelectLead={() => {}}
            tab="prospects"
            onTabChange={() => {}}
            searchQuery=""
            groupBy="date"
            sortBy="newest"
            filterStatus={[]}
            selectedCampaignId="all"
            isAgencyUser={isAgencyUser}
            prospectThreads={prospectThreads}
            selectedProspectId={selectedProspectId}
            onSelectProspect={handleSelectProspect}
            onDialProspect={handleDialProspect}
            listPanelState={isListHidden ? "hidden" : isListCompact ? "compact" : "full"}
            className={cn(
              isListHidden
                ? cn(mobileView === "chat" ? "hidden" : "flex", "lg:hidden")
                : isListCompact
                  ? cn("w-[65px] lg:flex-shrink-0", mobileView === "chat" ? "hidden lg:flex" : "flex")
                  : cn("w-full lg:w-[340px] lg:flex-shrink-0", mobileView === "chat" ? "hidden lg:flex" : "flex")
            )}
            data-testid="outreach-inbox-panel"
          />

          {/* Right panel: prospect chat */}
          <div
            ref={chatPanelAreaRef}
            className={cn(
              "relative flex-1 min-w-0 flex flex-col overflow-hidden",
              mobileView === "inbox" ? "hidden lg:flex" : "flex"
            )}
            data-testid="outreach-inbox-chat-panel"
          >
            {selectedProspectId ? (() => {
              const pt = selectedThread;
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
                  dialerOpen={dialOpenProspectId === selectedProspectId}
                  onDialerClose={() => setDialOpenProspectId(null)}
                  onToggleRightPanel={() => setShowProspectPanel((v) => !v)}
                  rightPanelVisible={showProspectPanel}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  Select a prospect to view messages
                </div>
              );
            })() : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a prospect to view messages
              </div>
            )}
          </div>

          {/* Prospect detail sidebar */}
          {selectedProspectId && showProspectPanel && selectedThread && (
            <div className="hidden lg:flex w-[340px] flex-shrink-0 overflow-hidden">
              <ProspectDetailSidebar
                prospectId={selectedProspectId}
                thread={selectedThread}
                onClose={() => setShowProspectPanel(false)}
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>
    </CrmShell>
  );
}
