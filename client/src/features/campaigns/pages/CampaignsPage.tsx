import { useState, useMemo, useCallback } from "react";
import { ChevronDown, LayoutGrid, TableIcon } from "lucide-react";
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

  // Local account filter state (agency users can switch; client users are auto-scoped)
  const [filterAccountId, setFilterAccountId] = useState<number | "all">("all");

  const { currentAccountId, isAgencyUser, accounts } = useWorkspace();

  const handleCampaignClick = useCallback((campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false);
    setSelectedCampaign(null);
  }, []);

  // Resolve effective account ID to pass to API:
  // - Agency users: use local filterAccountId ("all" = undefined = no filter)
  // - Client users: use their own account (backend also enforces this via scopeToAccount)
  const effectiveAccountId = useMemo(() => {
    if (!isAgencyUser) return currentAccountId;
    if (filterAccountId === "all") return undefined;
    return filterAccountId as number;
  }, [isAgencyUser, filterAccountId, currentAccountId]);

  const { campaigns, loading: campaignsLoading } = useCampaignsData(effectiveAccountId);
  const { metrics, loading: metricsLoading } = useCampaignMetrics();

  const loading = campaignsLoading || metricsLoading;

  // Exclude agency account (id=1) from the account filter dropdown
  const clientAccounts = useMemo(
    () => accounts.filter((a) => a.id !== 1),
    [accounts]
  );

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
          <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0 gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-foreground">
              {campaigns.length > 0
                ? `${campaigns.length} Campaign${campaigns.length !== 1 ? "s" : ""}`
                : "Campaigns"}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Account filter — only for agency/admin users */}
              {isAgencyUser && clientAccounts.length > 0 && (
                <div className="relative" data-testid="campaign-account-filter-wrap">
                  <select
                    value={filterAccountId === "all" ? "all" : String(filterAccountId)}
                    onChange={(e) =>
                      setFilterAccountId(
                        e.target.value === "all" ? "all" : Number(e.target.value)
                      )
                    }
                    className={cn(
                      "h-8 pl-3 pr-8 text-xs rounded-lg border border-border bg-background",
                      "appearance-none outline-none focus:ring-1 focus:ring-primary/50",
                      "text-foreground"
                    )}
                    data-testid="select-campaign-account-filter"
                    aria-label="Filter campaigns by account"
                  >
                    <option value="all">All Accounts</option>
                    {clientAccounts.map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                </div>
              )}

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

        {/* Table view toolbar */}
        {viewMode === "table" && (
          <div className="flex items-center justify-between px-4 pt-3 pb-1 shrink-0 gap-2">
            {/* Account filter for table view — agency only */}
            {isAgencyUser && clientAccounts.length > 0 ? (
              <div className="relative" data-testid="campaign-account-filter-wrap-table">
                <select
                  value={filterAccountId === "all" ? "all" : String(filterAccountId)}
                  onChange={(e) =>
                    setFilterAccountId(
                      e.target.value === "all" ? "all" : Number(e.target.value)
                    )
                  }
                  className={cn(
                    "h-8 pl-3 pr-8 text-xs rounded-lg border border-border bg-background",
                    "appearance-none outline-none focus:ring-1 focus:ring-primary/50",
                    "text-foreground"
                  )}
                  data-testid="select-campaign-account-filter-table"
                  aria-label="Filter campaigns by account"
                >
                  <option value="all">All Accounts</option>
                  {clientAccounts.map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            ) : (
              <div />
            )}
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
            <CampaignsTable accountId={effectiveAccountId} />
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
