import { useState, useMemo, useCallback, useEffect } from "react";
import { TableIcon, LayoutList } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { CampaignsTable } from "../components/CampaignsTable";
import { CampaignListView } from "../components/CampaignListView";
import { CampaignDetailPanel } from "../components/CampaignDetailPanel";
import { useCampaignsData } from "../hooks/useCampaignsData";
import { useCampaignMetrics } from "@/hooks/useApiData";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/types/models";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";
import { ViewTabStrip, type ViewTab } from "@/components/crm/ViewTabStrip";

type ViewMode = "list" | "table";

const CAMPAIGN_VIEW_TABS: ViewTab<"list" | "table">[] = [
  { id: "list", label: "List", icon: LayoutList, testId: "campaign-view-list" },
  { id: "table", label: "Table", icon: TableIcon, testId: "campaign-view-table" },
];

export function CampaignsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const { setTopbarActions, clearTopbarActions } = useTopbarActions();

  useEffect(() => {
    setTopbarActions(
      <ViewTabStrip tabs={CAMPAIGN_VIEW_TABS} activeTab={viewMode} onTabChange={setViewMode} />
    );
    return () => clearTopbarActions();
  }, [viewMode, setTopbarActions, clearTopbarActions]);

  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Slide-over edit panel (reuses existing CampaignDetailPanel)
  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);

  // Account filter for table view (agency only)
  const [filterAccountId] = useState<number | "all">("all");

  const { currentAccountId, isAgencyUser } = useWorkspace();

  const effectiveAccountId = useMemo(() => {
    if (!isAgencyUser) return currentAccountId;
    if (filterAccountId === "all") return undefined;
    return filterAccountId as number;
  }, [isAgencyUser, filterAccountId, currentAccountId]);

  const { campaigns, loading: campaignsLoading, updateCampaignRow } = useCampaignsData(effectiveAccountId);
  const { metrics, loading: metricsLoading } = useCampaignMetrics();

  const loading = campaignsLoading || metricsLoading;

  // Auto-select first campaign when data arrives (only if nothing is selected yet)
  useEffect(() => {
    if (!selectedCampaign && campaigns.length > 0) {
      setSelectedCampaign(campaigns[0]);
    }
  }, [campaigns, selectedCampaign]);

  // Keep selectedCampaign in sync if the campaigns list refreshes
  useEffect(() => {
    if (selectedCampaign && campaigns.length > 0) {
      const cid = selectedCampaign.id || selectedCampaign.Id;
      const refreshed = campaigns.find((c) => (c.id || c.Id) === cid);
      if (refreshed) setSelectedCampaign(refreshed);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaigns]);

  const handleSelectCampaign = useCallback((campaign: Campaign) => {
    setSelectedCampaign(campaign);
  }, []);

  const handleEditCampaign = useCallback((campaign: Campaign) => {
    setEditCampaign(campaign);
    setEditPanelOpen(true);
  }, []);

  const handleCloseEditPanel = useCallback(() => {
    setEditPanelOpen(false);
    setEditCampaign(null);
  }, []);

  const handleToggleStatus = useCallback((campaign: Campaign) => {
    const cid = campaign.id || campaign.Id;
    const newStatus = String(campaign.status) === "Active" ? "Paused" : "Active";
    updateCampaignRow(cid, "status", newStatus);
    // Optimistic update on selected campaign
    setSelectedCampaign((prev) =>
      prev && (prev.id || prev.Id) === cid ? { ...prev, status: newStatus } : prev
    );
  }, [updateCampaignRow]);

  return (
    <CrmShell>
      <div className="flex flex-col h-full">

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {viewMode === "list" ? (
            <CampaignListView
              campaigns={campaigns}
              metrics={metrics}
              loading={loading}
              selectedCampaign={selectedCampaign}
              onSelectCampaign={handleSelectCampaign}
              onEditCampaign={handleEditCampaign}
              onToggleStatus={handleToggleStatus}
            />
          ) : (
            <CampaignsTable
              accountId={effectiveAccountId}
              externalStatusFilter="all"
            />
          )}
        </div>
      </div>

      {/* Edit slide-over — reuses existing CampaignDetailPanel */}
      <CampaignDetailPanel
        campaign={editCampaign}
        metrics={metrics}
        open={editPanelOpen}
        onClose={handleCloseEditPanel}
      />
    </CrmShell>
  );
}
