import { useState, useMemo, useCallback } from "react";
import { LayoutGrid, TableIcon } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { CampaignsTable } from "../components/CampaignsTable";
import { CampaignCardGrid } from "../components/CampaignCardGrid";
import { CampaignDetailPanel } from "../components/CampaignDetailPanel";
import { useCampaignsData } from "../hooks/useCampaignsData";
import { useCampaignMetrics } from "@/hooks/useApiData";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/types/models";

type ViewMode = "cards" | "table";

function ViewToggle({
  viewMode,
  onViewModeChange,
}: {
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
}) {
  return (
    <div className="flex items-center rounded-lg border border-border bg-background overflow-hidden">
      <button
        onClick={() => onViewModeChange("cards")}
        className={cn(
          "flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium transition-colors",
          viewMode === "cards"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        )}
        title="Card view"
        data-testid="campaign-view-cards"
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        Cards
      </button>
      <button
        onClick={() => onViewModeChange("table")}
        className={cn(
          "flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium transition-colors",
          viewMode === "table"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        )}
        title="Table view"
        data-testid="campaign-view-table"
      >
        <TableIcon className="w-3.5 h-3.5" />
        Table
      </button>
    </div>
  );
}

export function CampaignsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { currentAccountId, isAgencyView } = useWorkspace();

  const handleCampaignClick = useCallback((campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false);
    setSelectedCampaign(null);
  }, []);

  // For agency view with account 1 selected (all accounts), don't filter
  const filterAccountId =
    isAgencyView && currentAccountId === 1 ? undefined : currentAccountId;

  const { campaigns, loading: campaignsLoading } = useCampaignsData(filterAccountId);
  const { metrics, loading: metricsLoading } = useCampaignMetrics();

  const loading = campaignsLoading || metricsLoading;

  // Filter campaigns by search in card view
  const filteredCampaigns = useMemo(() => {
    if (!search) return campaigns;
    const q = search.toLowerCase();
    return campaigns.filter((c) =>
      String(c.name || "").toLowerCase().includes(q)
    );
  }, [campaigns, search]);

  return (
    <CrmShell>
      <div className="flex flex-col h-full">
        {/* Card view toolbar */}
        {viewMode === "cards" && (
          <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
            <h2 className="text-sm font-semibold text-foreground">
              {campaigns.length > 0
                ? `${campaigns.length} Campaign${campaigns.length !== 1 ? "s" : ""}`
                : "Campaigns"}
            </h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search campaigns…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  "h-8 px-3 text-xs rounded-lg border border-border bg-background",
                  "placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50",
                  "w-44"
                )}
                data-testid="campaign-card-search"
              />
              <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
            </div>
          </div>
        )}

        {/* Table view toggle (table has its own search toolbar) */}
        {viewMode === "table" && (
          <div className="flex items-center justify-end px-4 pt-3 pb-1 shrink-0">
            <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {viewMode === "cards" ? (
            <CampaignCardGrid
              campaigns={filteredCampaigns}
              metrics={metrics}
              loading={loading}
              searchValue={search}
              onCampaignClick={handleCampaignClick}
              selectedCampaignId={selectedCampaign?.id ?? null}
            />
          ) : (
            <CampaignsTable />
          )}
        </div>
      </div>

      {/* Campaign detail panel */}
      <CampaignDetailPanel
        campaign={selectedCampaign}
        metrics={metrics}
        open={detailOpen}
        onClose={handleCloseDetail}
      />
    </CrmShell>
  );
}
