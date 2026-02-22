import { useState, useMemo, useEffect } from "react";
import { Search, Zap, ChevronRight } from "lucide-react";
import type { Campaign, CampaignMetricsHistory } from "@/types/models";
import { cn } from "@/lib/utils";
import { CampaignDetailView, CampaignDetailViewEmpty } from "./CampaignDetailView";

// ── Helpers ──────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "Active" | "Paused" | "Completed" | "Inactive";

function getStatusAccent(status: string): string {
  switch (status) {
    case "Active":    return "bg-emerald-500";
    case "Paused":    return "bg-amber-500";
    case "Completed":
    case "Finished":  return "bg-blue-500";
    case "Inactive":
    case "Archived":  return "bg-slate-400";
    default:          return "bg-indigo-500";
  }
}

function getStatusPillColors(status: string): string {
  switch (status) {
    case "Active":    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "Paused":    return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "Completed":
    case "Finished":  return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    default:          return "bg-slate-400/15 text-slate-600 dark:text-slate-400";
  }
}

function getCampaignLeads(campaign: Campaign): number {
  return Number(campaign.Leads ?? campaign.total_leads_targeted ?? 0);
}

function getCampaignResponseRate(campaign: Campaign): number {
  return Number(campaign.response_rate_percent ?? 0);
}

// ── List row skeleton ────────────────────────────────────────────────────────

function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <div className="w-1 h-10 rounded-full bg-muted shrink-0" />
      <div className="w-7 h-7 rounded-lg bg-muted shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-3 w-3/4 bg-muted rounded" />
        <div className="h-2.5 w-1/2 bg-muted rounded" />
      </div>
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface CampaignListViewProps {
  campaigns: Campaign[];
  metrics: CampaignMetricsHistory[];
  loading: boolean;
  selectedCampaign: Campaign | null;
  onSelectCampaign: (campaign: Campaign) => void;
  onEditCampaign: (campaign: Campaign) => void;
  onToggleStatus: (campaign: Campaign) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function CampaignListView({
  campaigns,
  metrics,
  loading,
  selectedCampaign,
  onSelectCampaign,
  onEditCampaign,
  onToggleStatus,
}: CampaignListViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const STATUS_TABS: { value: StatusFilter; label: string }[] = [
    { value: "all",       label: "All"       },
    { value: "Active",    label: "Active"    },
    { value: "Paused",    label: "Paused"    },
    { value: "Completed", label: "Done"      },
    { value: "Inactive",  label: "Inactive"  },
  ];

  const filteredCampaigns = useMemo(() => {
    let result = campaigns;
    if (statusFilter !== "all") {
      result = result.filter((c) => {
        const s = String(c.status || "");
        if (statusFilter === "Completed") return s === "Completed" || s === "Finished";
        return s === statusFilter;
      });
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) => String(c.name || "").toLowerCase().includes(q));
    }
    return result;
  }, [campaigns, search, statusFilter]);

  // Auto-select top campaign when list loads or filters change
  useEffect(() => {
    if (!selectedCampaign && filteredCampaigns.length > 0) {
      onSelectCampaign(filteredCampaigns[0]);
    }
  }, [filteredCampaigns, selectedCampaign, onSelectCampaign]);

  return (
    <div className="flex h-full overflow-hidden gap-3" data-testid="campaign-list-view">

      {/* ── LEFT PANE ─────────────────────────────────────────────── */}
      <div className="w-[300px] shrink-0 flex flex-col rounded-xl bg-stone-100 dark:bg-stone-900/60 overflow-hidden shadow-sm">

        {/* Search */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search campaigns…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
              data-testid="campaign-list-search"
            />
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 px-3 pb-2 shrink-0 overflow-x-auto scrollbar-none">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                "shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                statusFilter === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
              data-testid={`campaign-filter-tab-${tab.value}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Count */}
        <div className="px-4 pb-1 shrink-0">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {loading ? "Loading…" : `${filteredCampaigns.length} campaign${filteredCampaigns.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <>
              {[1, 2, 3, 4, 5].map((i) => <ListRowSkeleton key={i} />)}
            </>
          ) : filteredCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Zap className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No campaigns found</p>
              {search && <p className="text-xs text-muted-foreground/70 mt-1">Try a different search</p>}
            </div>
          ) : (
            filteredCampaigns.map((campaign) => {
              const cid = campaign.id || campaign.Id;
              const isSelected = selectedCampaign
                ? (selectedCampaign.id || selectedCampaign.Id) === cid
                : false;

              const initials = (campaign.name || "?")
                .split(" ")
                .slice(0, 2)
                .map((w: string) => w[0]?.toUpperCase() ?? "")
                .join("");

              const leads = getCampaignLeads(campaign);
              const responseRate = getCampaignResponseRate(campaign);
              const accent = getStatusAccent(String(campaign.status || ""));
              const pillColors = getStatusPillColors(String(campaign.status || ""));

              return (
                <button
                  key={cid}
                  type="button"
                  onClick={() => onSelectCampaign(campaign)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors relative group",
                    "border-b border-border/40 last:border-0",
                    isSelected
                      ? "bg-primary/10 dark:bg-primary/15 border-l-[3px] border-l-primary"
                      : "hover:bg-stone-200/70 dark:hover:bg-white/5"
                  )}
                  data-testid={`campaign-list-row-${cid}`}
                >
                  {/* Status accent bar */}
                  <div className={cn("w-1 h-9 rounded-full shrink-0 transition-all", accent, !isSelected && "opacity-40 group-hover:opacity-70")} />

                  {/* Avatar */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{
                      background: String(campaign.status) === "Active"
                        ? "linear-gradient(135deg, #10b981, #059669)"
                        : String(campaign.status) === "Paused"
                        ? "linear-gradient(135deg, #f59e0b, #d97706)"
                        : String(campaign.status) === "Inactive" || String(campaign.status) === "Archived"
                        ? "linear-gradient(135deg, #94a3b8, #64748b)"
                        : "linear-gradient(135deg, #6366f1, #4f46e5)",
                    }}
                  >
                    {initials || <Zap className="w-3 h-3" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={cn("text-xs truncate leading-tight", isSelected ? "text-primary font-bold" : "text-foreground font-semibold")}>
                        {campaign.name || "Unnamed"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md", pillColors)}>
                        {campaign.status}
                      </span>
                      {leads > 0 && (
                        <span className="text-[10px] text-muted-foreground">{leads} leads</span>
                      )}
                      {responseRate > 0 && (
                        <span className="text-[10px] text-muted-foreground">{responseRate}% resp.</span>
                      )}
                    </div>
                  </div>

                  {/* Selected indicator */}
                  {isSelected && (
                    <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── RIGHT PANE ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden rounded-xl bg-background shadow-sm">
        {selectedCampaign ? (
          <CampaignDetailView
            campaign={selectedCampaign}
            metrics={metrics}
            onEdit={onEditCampaign}
            onToggleStatus={onToggleStatus}
          />
        ) : (
          <CampaignDetailViewEmpty />
        )}
      </div>
    </div>
  );
}
