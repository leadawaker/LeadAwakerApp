import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  List,
  Table2,
  Megaphone,
  Building2,
} from "lucide-react";
import type { Campaign, CampaignMetricsHistory } from "@/types/models";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import { cn } from "@/lib/utils";
import { CampaignDetailView, CampaignDetailViewEmpty } from "./CampaignDetailView";
import { getInitials, getCampaignAvatarColor, CAMPAIGN_STATUS_HEX } from "@/lib/avatarUtils";
import type {
  CampaignViewMode,
  CampaignGroupBy,
  CampaignSortBy,
} from "../pages/CampaignsPage";

// ── Helpers ──────────────────────────────────────────────────────────────────
function getCampaignId(c: Campaign): number {
  return c.id || (c as any).Id || 0;
}

function getLeadCount(c: Campaign): number {
  return Number(c.total_leads_targeted ?? (c as any).Leads ?? 0);
}

function getResponseRate(c: Campaign): number {
  return Number(c.response_rate_percent ?? 0);
}

const STATUS_GROUP_ORDER = ["Active", "Paused", "Completed", "Finished", "Draft", "Inactive", "Archived"];

// ── View tab definitions ────────────────────────────────────────────────────
const VIEW_TABS: TabDef[] = [
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
  const initials = getInitials(name);
  const status = String(campaign.status || "");
  const avatarColor = getCampaignAvatarColor(status);
  const leads = getLeadCount(campaign);
  const responseRate = getResponseRate(campaign);
  const bookings = Number(campaign.bookings_generated ?? 0);
  const accountName = campaign.account_name || "";
  const accountLogo = (campaign as any).account_logo_url || "";
  const statusHex = CAMPAIGN_STATUS_HEX[status] || "#6B7280";

  return (
    <div
      className={cn(
        "group relative rounded-xl cursor-pointer transition-shadow",
        isActive ? "bg-highlight-selected" : "bg-card hover:bg-card-hover hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div className="px-2.5 pt-3.5 pb-2.5 flex flex-col gap-2">

        {/* Top row: Avatar + Name + Booked circle */}
        <div className="flex items-center gap-2.5">
          {/* Avatar: account logo with indigo overlay, or initials fallback */}
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 overflow-hidden relative"
            style={accountLogo ? {} : { backgroundColor: avatarColor.bg, color: avatarColor.text }}
          >
            {accountLogo ? (
              <>
                <img src={accountLogo} alt="" className="h-full w-full object-cover" />
                {/* Indigo overlay */}
                <div className="absolute inset-0 rounded-full bg-brand-indigo/40 mix-blend-multiply" />
              </>
            ) : (
              initials
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-semibold font-heading leading-tight truncate text-foreground">
              {name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: statusHex }}
              />
              <span className="text-[11px] text-muted-foreground leading-none">{status || "Unknown"}</span>
            </div>
            {accountName && (
              <div className="flex items-center gap-1 mt-1">
                <Building2 className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0" />
                <span className="text-[11px] font-medium text-foreground/65 truncate">{accountName}</span>
              </div>
            )}
          </div>

          {/* Booked count circle — always visible */}
          <div
            className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
              bookings > 0
                ? "bg-[#FCB803]/20 text-[#131B49]"
                : "bg-foreground/5 text-muted-foreground/40"
            )}
            title={`${bookings} booked`}
          >
            <span className="text-[13px] font-bold tabular-nums leading-none">{bookings}</span>
          </div>
        </div>

        {/* Hover-only metrics strip: Leads + Response */}
        <div className={cn(
          "grid grid-cols-2 gap-px rounded-lg overflow-hidden transition-opacity",
          "opacity-0 max-h-0 group-hover:opacity-100 group-hover:max-h-[40px]",
          "transition-[opacity,max-height] duration-200",
          isActive && "opacity-100 max-h-[40px]",
          isActive ? "bg-[#EFE4A0]/60" : "bg-foreground/8"
        )}>
          {[
            { label: "Leads", value: leads > 0 ? leads.toLocaleString() : "—" },
            { label: "Response", value: responseRate > 0 ? `${responseRate}%` : "—" },
          ].map((stat) => (
            <div
              key={stat.label}
              className={cn(
                "flex flex-col items-center py-1.5",
                isActive ? "bg-highlight-selected" : "bg-card group-hover:bg-card-hover"
              )}
            >
              <span className="text-[13px] font-bold tabular-nums text-foreground leading-tight">{stat.value}</span>
              <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wide mt-0.5">{stat.label}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

// ── Group header ─────────────────────────────────────────────────────────────
function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="sticky top-0 z-20 bg-muted px-3 pt-3 pb-3">
      <div className="flex items-center gap-[10px]">
        <div className="flex-1 h-px bg-foreground/15" />
        <span className="text-[12px] font-bold text-foreground tracking-wide shrink-0">{label}</span>
        <span className="text-foreground/20 shrink-0">–</span>
        <span className="text-[12px] font-medium text-muted-foreground tabular-nums shrink-0">{count}</span>
        <div className="flex-1 h-px bg-foreground/15" />
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
          <div className="h-10 w-10 rounded-full bg-foreground/10 shrink-0" />
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
  onSave: (id: number, patch: Record<string, unknown>) => Promise<void>;
  onCreateCampaign: () => void;
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
  filterAccount?: string;
  onFilterAccountChange?: (a: string) => void;
  availableAccounts?: string[];
  hasNonDefaultControls: boolean;
  isGroupNonDefault: boolean;
  isSortNonDefault: boolean;
  onResetControls: () => void;
  onRefresh?: () => void;
  onDelete?: (id: number) => Promise<void>;
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
  onSave,
  onCreateCampaign,
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
  filterAccount = "",
  onFilterAccountChange,
  availableAccounts = [],
  hasNonDefaultControls,
  isGroupNonDefault,
  isSortNonDefault,
  onResetControls,
  onRefresh,
  onDelete,
}: CampaignListViewProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 20;

  // Active filter state
  const isFilterActive = filterStatus.length > 0 || !!filterAccount;

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

    // 2b. Account filter
    if (filterAccount) {
      filtered = filtered.filter((c) => String(c.account_name || "") === filterAccount);
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
  }, [campaigns, listSearch, filterStatus, filterAccount, sortBy, groupBy]);

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
  useEffect(() => { setCurrentPage(0); }, [listSearch, filterStatus, filterAccount, groupBy, sortBy]);

  // ── Responsive compact layout for right panel ─────────────────────────────
  // Right panel is flex-1. Compact (stacked) when < 700px wide.
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const [isDetailCompact, setIsDetailCompact] = useState(true);

  useEffect(() => {
    const el = rightPanelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setIsDetailCompact(entry.contentRect.width < 700);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auto-select first campaign
  useEffect(() => {
    if (!selectedCampaign && campaigns.length > 0) {
      const firstCampaign = flatItems.find((i) => i.kind === "campaign") as { kind: "campaign"; campaign: Campaign } | undefined;
      if (firstCampaign) onSelectCampaign(firstCampaign.campaign);
    }
  }, [flatItems, selectedCampaign, campaigns.length, onSelectCampaign]);

  return (
    <div className="flex h-full gap-[3px]" data-testid="campaign-list-view">

      {/* ── LEFT PANEL: campaign list ─────────────────────────────────── */}
      <div className="w-[340px] shrink-0 flex flex-col bg-muted rounded-lg overflow-hidden">

        {/* Header: title + ViewTabBar (309px rigid wrapper) — NO buttons */}
        <div className="pl-[17px] pr-3.5 pt-10 pb-3 shrink-0 flex items-center">
          <div className="flex items-center justify-between w-[309px] shrink-0">
            <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">Campaigns</h2>
            <ViewTabBar tabs={VIEW_TABS} activeId={viewMode} onTabChange={(id) => onViewModeChange(id as CampaignViewMode)} />
          </div>
        </div>

        {/* Campaign list */}
        <div className="flex-1 overflow-y-auto p-[3px]">
          {loading ? (
            <ListSkeleton />
          ) : paginatedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Megaphone className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No campaigns found</p>
              {listSearch && <p className="text-xs text-muted-foreground/70 mt-1">Try a different search</p>}
            </div>
          ) : (
            <div
              key={`page-${currentPage}`}
              className="flex flex-col gap-[3px]"
            >
              {paginatedItems.map((item, idx) => {
                if (item.kind === "header") {
                  return (
                    <div key={`h-${item.label}`}>
                      <GroupHeader label={item.label} count={item.count} />
                    </div>
                  );
                }
                const cid = getCampaignId(item.campaign);
                const isSelected = selectedCampaign
                  ? getCampaignId(selectedCampaign) === cid
                  : false;
                return (
                  <div key={cid || idx} className="animate-card-enter" style={{ animationDelay: `${Math.min(idx, 15) * 30}ms` }}>
                    <CampaignListCard
                      campaign={item.campaign}
                      isActive={isSelected}
                      onClick={() => onSelectCampaign(item.campaign)}
                    />
                  </div>
                );
              })}
            </div>
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

      {/* ── RIGHT PANEL: toolbar + detail view ──────────────────────── */}
      <div ref={rightPanelRef} className="flex-1 flex flex-col overflow-hidden rounded-lg">

        {/* Detail view */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {selectedCampaign ? (
            <CampaignDetailView
              campaign={selectedCampaign}
              metrics={metrics}
              allCampaigns={campaigns}
              onToggleStatus={onToggleStatus}
              onSave={onSave}
              onRefresh={onRefresh}
              onDelete={onDelete}
              compact={isDetailCompact}
              onCreateCampaign={onCreateCampaign}
              listSearch={listSearch}
              onListSearchChange={onListSearchChange}
              searchOpen={searchOpen}
              onSearchOpenChange={onSearchOpenChange}
              sortBy={sortBy}
              onSortByChange={onSortByChange}
              isSortNonDefault={isSortNonDefault}
              filterStatus={filterStatus}
              onToggleFilterStatus={onToggleFilterStatus}
              filterAccount={filterAccount}
              onFilterAccountChange={onFilterAccountChange}
              isFilterActive={isFilterActive}
              groupBy={groupBy}
              onGroupByChange={onGroupByChange}
              isGroupNonDefault={isGroupNonDefault}
              availableAccounts={availableAccounts}
              onResetControls={onResetControls}
            />
          ) : (
            <CampaignDetailViewEmpty />
          )}
        </div>
      </div>
    </div>
  );
}
