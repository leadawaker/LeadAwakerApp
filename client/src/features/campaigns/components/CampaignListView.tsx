import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search,
  Zap,
  List,
  Table2,
  SlidersHorizontal,
  Layers,
  ArrowUpDown,
  Filter,
  X,
  Megaphone,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Campaign, CampaignMetricsHistory } from "@/types/models";
import { cn } from "@/lib/utils";
import { CampaignDetailView, CampaignDetailViewEmpty } from "./CampaignDetailView";
import type {
  CampaignViewMode,
  CampaignGroupBy,
  CampaignSortBy,
} from "../pages/CampaignsPage";

// ── Campaign status → avatar pastel colors ────────────────────────────────────
const CAMPAIGN_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Active:    { bg: "#DCFCE7", text: "#15803D" },
  Paused:    { bg: "#FEF3C7", text: "#92400E" },
  Completed: { bg: "#DBEAFE", text: "#1D4ED8" },
  Finished:  { bg: "#DBEAFE", text: "#1D4ED8" },
  Inactive:  { bg: "#F4F4F5", text: "#52525B" },
  Archived:  { bg: "#F4F4F5", text: "#52525B" },
  Draft:     { bg: "#E5E7EB", text: "#374151" },
};

function getCampaignAvatarColor(status: string): { bg: string; text: string } {
  return CAMPAIGN_STATUS_COLORS[status] ?? { bg: "#E5E7EB", text: "#374151" };
}

// ── Status dot hex colors ────────────────────────────────────────────────────
const CAMPAIGN_STATUS_HEX: Record<string, string> = {
  Active:    "#22C55E",
  Paused:    "#F59E0B",
  Completed: "#3B82F6",
  Finished:  "#3B82F6",
  Inactive:  "#94A3B8",
  Archived:  "#94A3B8",
  Draft:     "#6B7280",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function getCampaignId(c: Campaign): number {
  return c.id || (c as any).Id || 0;
}

function getCampaignInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

function getLeadCount(c: Campaign): number {
  return Number(c.total_leads_targeted ?? (c as any).Leads ?? 0);
}

function getResponseRate(c: Campaign): number {
  return Number(c.response_rate_percent ?? 0);
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      const h = Math.floor(diffMs / 3_600_000);
      return h === 0 ? "Just now" : `${h}h ago`;
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  } catch { return ""; }
}

// ── Group/Sort labels ────────────────────────────────────────────────────────
const GROUP_LABELS: Record<CampaignGroupBy, string> = {
  status:  "Status",
  account: "Account",
  type:    "Type",
  none:    "None",
};
const SORT_LABELS: Record<CampaignSortBy, string> = {
  recent:        "Most Recent",
  name_asc:      "Name A → Z",
  name_desc:     "Name Z → A",
  leads_desc:    "Most Leads",
  response_desc: "Best Response",
};

const STATUS_GROUP_ORDER = ["Active", "Paused", "Completed", "Finished", "Draft", "Inactive", "Archived"];
const STATUS_FILTER_OPTIONS = ["Active", "Paused", "Completed", "Inactive", "Draft"];

// ── View tab definitions ────────────────────────────────────────────────────
const VIEW_TABS: { id: CampaignViewMode; label: string; icon: typeof List }[] = [
  { id: "list",  label: "List",  icon: List },
  { id: "table", label: "Table", icon: Table2 },
];

// ── Virtual list item types ──────────────────────────────────────────────────
type VirtualListItem =
  | { kind: "header"; label: string; count: number }
  | { kind: "campaign"; campaign: Campaign };

// ── Campaign card ────────────────────────────────────────────────────────────
function CampaignListCard({
  campaign,
  isActive,
  onClick,
}: {
  campaign: Campaign;
  isActive: boolean;
  onClick: () => void;
}) {
  const name = String(campaign.name || "Unnamed Campaign");
  const initials = getCampaignInitials(name);
  const status = String(campaign.status || "");
  const avatarColor = getCampaignAvatarColor(status);
  const leads = getLeadCount(campaign);
  const responseRate = getResponseRate(campaign);
  const lastUpdated = (campaign as any).updated_at || (campaign as any).nc_updated_at || (campaign as any).created_at;
  const accountName = campaign.account_name || "";
  const statusHex = CAMPAIGN_STATUS_HEX[status] || "#6B7280";

  return (
    <div
      className={cn(
        "relative mx-[3px] my-0.5 rounded-xl cursor-pointer transition-colors",
        isActive ? "bg-[#FFF6C8]" : "bg-[#F1F1F1] hover:bg-[#FAFAFA]"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div className="px-2.5 pt-4 pb-2 flex flex-col gap-2">

        {/* Top row: Avatar + Name/Status */}
        <div className="flex items-start gap-2">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
            style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-[17px] font-semibold font-heading leading-tight truncate text-foreground">
              {name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground leading-tight"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: statusHex }}
                />
                {status || "Unknown"}
              </span>
              {leads > 0 && (
                <span className="text-[10px] text-muted-foreground/70">· {leads} leads</span>
              )}
              {responseRate > 0 && (
                <span className="text-[10px] text-muted-foreground/70">· {responseRate}%</span>
              )}
            </div>
          </div>
        </div>

        {/* Description snippet */}
        {campaign.description && (
          <p className="text-[10px] text-muted-foreground truncate italic">
            {campaign.description}
          </p>
        )}

        {/* Bottom row: account (left) | time (middle) | lead count circle (right) */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
            {accountName && (
              <span className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] font-medium bg-black/[0.06] text-foreground/55">
                {accountName}
              </span>
            )}
            {campaign.type && (
              <span className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] font-medium bg-black/[0.06] text-foreground/55">
                {campaign.type}
              </span>
            )}
          </div>
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground/70 shrink-0 tabular-nums">
              {formatRelativeTime(lastUpdated)}
            </span>
          )}
          <div
            className="h-[34px] w-[34px] rounded-full flex items-center justify-center text-[9px] font-bold tabular-nums shrink-0"
            style={
              isActive
                ? { backgroundColor: "#000", color: "#fff" }
                : { backgroundColor: `${statusHex}20`, color: statusHex }
            }
          >
            {leads > 0 ? leads : "—"}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Group header ─────────────────────────────────────────────────────────────
function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="sticky top-0 z-20 bg-muted px-3 pt-1.5 pb-1.5">
      <div className="flex items-center gap-0">
        <div className="flex-1 h-px bg-foreground/15 mx-[8px]" />
        <span className="text-[10px] font-bold text-foreground/55 uppercase tracking-widest shrink-0">{label}</span>
        <span className="ml-1 text-[9px] text-muted-foreground/45 font-semibold shrink-0">{count}</span>
        <div className="flex-1 h-px bg-foreground/15 mx-[8px]" />
      </div>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function ListSkeleton() {
  return (
    <div className="space-y-0 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3.5 rounded-lg animate-pulse"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="h-9 w-9 rounded-full bg-foreground/10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-foreground/10 rounded-full w-2/3" />
            <div className="h-2.5 bg-foreground/8 rounded-full w-1/2" />
          </div>
        </div>
      ))}
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
  // Lifted controls
  viewMode: CampaignViewMode;
  onViewModeChange: (v: CampaignViewMode) => void;
  listSearch: string;
  onListSearchChange: (v: string) => void;
  searchOpen: boolean;
  onSearchOpenChange: (v: boolean) => void;
  groupBy: CampaignGroupBy;
  onGroupByChange: (v: CampaignGroupBy) => void;
  sortBy: CampaignSortBy;
  onSortByChange: (v: CampaignSortBy) => void;
  filterStatus: string[];
  onToggleFilterStatus: (s: string) => void;
  hasNonDefaultControls: boolean;
  isGroupNonDefault: boolean;
  isSortNonDefault: boolean;
  onResetControls: () => void;
}

// ── Main component ──────────────────────────────────────────────────────────
export function CampaignListView({
  campaigns,
  metrics,
  loading,
  selectedCampaign,
  onSelectCampaign,
  onEditCampaign,
  onToggleStatus,
  viewMode,
  onViewModeChange,
  listSearch,
  onListSearchChange,
  searchOpen,
  onSearchOpenChange,
  groupBy,
  onGroupByChange,
  sortBy,
  onSortByChange,
  filterStatus,
  onToggleFilterStatus,
  hasNonDefaultControls,
  isGroupNonDefault,
  isSortNonDefault,
  onResetControls,
}: CampaignListViewProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 20;

  // Build flat grouped list
  const flatItems = useMemo((): VirtualListItem[] => {
    // 1. Text search
    let filtered = campaigns;
    if (listSearch.trim()) {
      const q = listSearch.toLowerCase();
      filtered = filtered.filter((c) =>
        String(c.name || "").toLowerCase().includes(q) ||
        String(c.description || "").toLowerCase().includes(q) ||
        String(c.account_name || "").toLowerCase().includes(q)
      );
    }

    // 2. Status filter
    if (filterStatus.length > 0) {
      filtered = filtered.filter((c) => {
        const s = String(c.status || "");
        return filterStatus.includes(s) || (filterStatus.includes("Completed") && s === "Finished");
      });
    }

    // 3. Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name_asc":      return String(a.name || "").localeCompare(String(b.name || ""));
        case "name_desc":     return String(b.name || "").localeCompare(String(a.name || ""));
        case "leads_desc":    return getLeadCount(b) - getLeadCount(a);
        case "response_desc": return getResponseRate(b) - getResponseRate(a);
        default: { // recent
          const da = (a as any).updated_at || (a as any).nc_updated_at || (a as any).created_at || "";
          const db = (b as any).updated_at || (b as any).nc_updated_at || (b as any).created_at || "";
          return db.localeCompare(da);
        }
      }
    });

    // 4. Group
    if (groupBy === "none") {
      return filtered.map((c) => ({ kind: "campaign" as const, campaign: c }));
    }

    const buckets = new Map<string, Campaign[]>();
    filtered.forEach((c) => {
      let key: string;
      if (groupBy === "status") {
        const s = String(c.status || "");
        key = s === "Finished" ? "Completed" : s || "Unknown";
      } else if (groupBy === "account") {
        key = String(c.account_name || "No Account");
      } else {
        key = String(c.type || "No Type");
      }
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(c);
    });

    // Order groups
    let orderedKeys: string[];
    if (groupBy === "status") {
      orderedKeys = STATUS_GROUP_ORDER.filter((k) => buckets.has(k))
        .concat(Array.from(buckets.keys()).filter((k) => !STATUS_GROUP_ORDER.includes(k)));
    } else {
      orderedKeys = Array.from(buckets.keys()).sort();
    }

    const result: VirtualListItem[] = [];
    orderedKeys.forEach((key) => {
      const group = buckets.get(key);
      if (!group || group.length === 0) return;
      result.push({ kind: "header", label: key, count: group.length });
      group.forEach((c) => result.push({ kind: "campaign", campaign: c }));
    });

    return result;
  }, [campaigns, listSearch, filterStatus, sortBy, groupBy]);

  // Paginate
  const totalCampaigns = flatItems.filter((i) => i.kind === "campaign").length;
  const maxPage = Math.max(0, Math.ceil(totalCampaigns / PAGE_SIZE) - 1);

  const paginatedItems = useMemo(() => {
    if (totalCampaigns <= PAGE_SIZE) return flatItems;

    let campaignCount = 0;
    const start = currentPage * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const result: VirtualListItem[] = [];
    let currentHeader: VirtualListItem | null = null;
    let headerCount = 0;

    for (const item of flatItems) {
      if (item.kind === "header") {
        currentHeader = item;
        headerCount = 0;
        continue;
      }
      if (campaignCount >= start && campaignCount < end) {
        if (currentHeader && headerCount === 0) {
          result.push(currentHeader);
        }
        result.push(item);
        headerCount++;
      }
      campaignCount++;
      if (campaignCount >= end) break;
    }
    return result;
  }, [flatItems, currentPage, totalCampaigns]);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(0); }, [listSearch, filterStatus, groupBy, sortBy]);

  // Auto-select first campaign
  useEffect(() => {
    if (!selectedCampaign && campaigns.length > 0) {
      const firstCampaign = flatItems.find((i) => i.kind === "campaign") as { kind: "campaign"; campaign: Campaign } | undefined;
      if (firstCampaign) onSelectCampaign(firstCampaign.campaign);
    }
  }, [flatItems, selectedCampaign, campaigns.length, onSelectCampaign]);

  // Active filter / sort / group state booleans for button highlights
  const isFilterActive = filterStatus.length > 0;

  return (
    <div className="flex h-full gap-[3px]" data-testid="campaign-list-view">

      {/* ── LEFT PANEL: campaign list ─────────────────────────────────── */}
      <div className="w-[300px] shrink-0 flex flex-col bg-muted rounded-lg overflow-hidden">

        {/* Header: title + count badge */}
        <div className="px-3.5 pt-7 pb-1 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">My Campaigns</h2>
            <span className="h-8 w-8 rounded-full border border-border/50 flex items-center justify-center text-[10px] font-semibold tabular-nums text-muted-foreground shrink-0">
              {totalCampaigns}
            </span>
          </div>
        </div>

        {/* Controls row: tabs (left) + search & settings (right) */}
        <div className="px-3 pt-1.5 pb-3 shrink-0 flex items-center justify-between gap-2">
          {/* Tab buttons */}
          <div className="flex items-center gap-1">
            {VIEW_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = viewMode === tab.id;
              return isActive ? (
                <button
                  key={tab.id}
                  onClick={() => onViewModeChange(tab.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFF375] text-foreground text-[12px] font-semibold"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ) : (
                <button
                  key={tab.id}
                  onClick={() => onViewModeChange(tab.id)}
                  title={tab.label}
                  className="h-8 w-8 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>

          {/* Right controls: search + settings */}
          <div className="flex items-center gap-1">
            {/* Search popover */}
            <Popover open={searchOpen} onOpenChange={onSearchOpenChange}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "h-8 w-8 rounded-full border flex items-center justify-center transition-colors",
                    listSearch
                      ? "border-brand-blue/40 text-brand-blue"
                      : "border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  )}
                  title="Search"
                >
                  <Search className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                align="end"
                className="w-56 p-2"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search campaigns..."
                    value={listSearch}
                    onChange={(e) => onListSearchChange(e.target.value)}
                    className="w-full pl-7 pr-7 py-1.5 text-[12px] rounded-md border border-border bg-popover placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-brand-blue/50"
                  />
                  {listSearch && (
                    <button
                      onClick={() => onListSearchChange("")}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Settings dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "h-8 w-8 rounded-full border flex items-center justify-center transition-colors",
                    hasNonDefaultControls
                      ? "border-brand-blue/40 text-brand-blue"
                      : "border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  )}
                  title="Settings"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {/* Group sub-menu */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Layers className="h-3.5 w-3.5 mr-2" />
                    <span>Group</span>
                    {isGroupNonDefault && <span className="ml-auto text-[10px] text-brand-blue font-semibold">{GROUP_LABELS[groupBy]}</span>}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {(Object.keys(GROUP_LABELS) as CampaignGroupBy[]).map((g) => (
                      <DropdownMenuItem
                        key={g}
                        onClick={() => onGroupByChange(g)}
                        className={cn(groupBy === g && "font-bold text-brand-blue")}
                      >
                        {GROUP_LABELS[g]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Sort sub-menu */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowUpDown className="h-3.5 w-3.5 mr-2" />
                    <span>Sort</span>
                    {isSortNonDefault && <span className="ml-auto text-[10px] text-brand-blue font-semibold">{SORT_LABELS[sortBy].split(" ")[0]}</span>}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {(Object.keys(SORT_LABELS) as CampaignSortBy[]).map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => onSortByChange(s)}
                        className={cn(sortBy === s && "font-bold text-brand-blue")}
                      >
                        {SORT_LABELS[s]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Filter sub-menu */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Filter className="h-3.5 w-3.5 mr-2" />
                    <span>Filter Status</span>
                    {isFilterActive && <span className="ml-auto text-[10px] text-brand-blue font-semibold">{filterStatus.length}</span>}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {STATUS_FILTER_OPTIONS.map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={(e) => {
                          e.preventDefault();
                          onToggleFilterStatus(s);
                        }}
                        className="flex items-center gap-2"
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: CAMPAIGN_STATUS_HEX[s] || "#6B7280" }}
                        />
                        <span className={cn(filterStatus.includes(s) && "font-bold text-brand-blue")}>{s}</span>
                        {filterStatus.includes(s) && <span className="ml-auto text-brand-blue">✓</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Reset */}
                {hasNonDefaultControls && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onResetControls} className="text-muted-foreground">
                      Reset to defaults
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Campaign list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <ListSkeleton />
          ) : paginatedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Megaphone className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No campaigns found</p>
              {listSearch && <p className="text-xs text-muted-foreground/70 mt-1">Try a different search</p>}
            </div>
          ) : (
            paginatedItems.map((item, idx) => {
              if (item.kind === "header") {
                return <GroupHeader key={`h-${item.label}`} label={item.label} count={item.count} />;
              }
              const cid = getCampaignId(item.campaign);
              const isSelected = selectedCampaign
                ? getCampaignId(selectedCampaign) === cid
                : false;
              return (
                <CampaignListCard
                  key={cid || idx}
                  campaign={item.campaign}
                  isActive={isSelected}
                  onClick={() => onSelectCampaign(item.campaign)}
                />
              );
            })
          )}
        </div>

        {/* Pagination footer */}
        {totalCampaigns > PAGE_SIZE && (
          <div className="h-[18px] px-3 py-1 border-t border-border/20 flex items-center justify-between shrink-0">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              Previous
            </button>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, totalCampaigns)} of {totalCampaigns}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(maxPage, p + 1))}
              disabled={currentPage >= maxPage}
              className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL: detail view ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden rounded-lg">
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
