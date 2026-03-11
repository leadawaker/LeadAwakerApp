import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Megaphone,
  Building2,
  Filter,
  Check,
  X,
  ArrowUpDown,
  LayoutDashboard,
  Settings2,
} from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/ui/PullToRefreshIndicator";
import type { Campaign, CampaignMetricsHistory } from "@/types/models";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import { cn } from "@/lib/utils";
import { CampaignDetailView, CampaignDetailViewEmpty } from "./CampaignDetailView";
import { MobileCampaignDetailPanel } from "./MobileCampaignDetailPanel";
import { SkeletonCampaignPanel } from "@/components/ui/skeleton";
import { getInitials, getCampaignAvatarColor, CAMPAIGN_STATUS_HEX } from "@/lib/avatarUtils";
import { CAMPAIGN_STICKERS } from "@/assets/campaign-stickers/index";
import { useIsMobile } from "@/hooks/useIsMobile";
import type {
  CampaignDetailTab,
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

// ── Detail tab definitions (keys resolved at render time via t()) ────────────
const DETAIL_TAB_DEFS = [
  { id: "summary",        labelKey: "tabs.summary",        icon: LayoutDashboard },
  { id: "configurations", labelKey: "tabs.configurations", icon: Settings2 },
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
  const { t } = useTranslation("campaigns");
  const name = String(campaign.name || t("detail.unnamed"));
  const initials = getInitials(name);
  const status = String(campaign.status || "");
  const avatarColor = getCampaignAvatarColor(status);
  const leads = getLeadCount(campaign);
  const responseRate = getResponseRate(campaign);
  const bookings = Number(campaign.bookings_generated ?? 0);
  const accountName = campaign.account_name || "";
  const accountLogo = (campaign as any).account_logo_url || "";
  const statusHex = CAMPAIGN_STATUS_HEX[status] || "#6B7280";
  const campaignStickerSlug = campaign.campaign_sticker ?? null;
  const campaignSticker = campaignStickerSlug
    ? CAMPAIGN_STICKERS.find(s => s.slug === campaignStickerSlug) ?? null
    : null;
  const campaignStickerSize = Math.min(Number((campaign as any).campaign_sticker_size ?? 70), 70);
  const isGrayscale = status === "Inactive";
  const isDraft = status === "Draft";
  const isPaused = status === "Paused";
  const createdAt: string | null = (campaign as any).createdAt ?? (campaign as any).created_at ?? null;
  const startAt: string | null = campaign.start_date ?? createdAt;
  const daysRunning = (status === "Active" && startAt)
    ? Math.max(0, Math.floor((Date.now() - new Date(startAt).getTime()) / 86_400_000))
    : null;
  const createdLabel = daysRunning !== null
    ? `Running ${daysRunning}d`
    : createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
    : null;

  return (
    <div
      className={cn(
        "group relative rounded-3xl md:rounded-xl cursor-pointer transition-shadow overflow-hidden",
        isActive ? "bg-highlight-selected" : "bg-card hover:bg-card-hover hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
      )}

      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div className="px-2.5 pt-3.5 pb-2.5 flex flex-col gap-2">

        {/* Top row: Avatar + Name */}
        <div className="flex items-center gap-2.5">
          {/* Avatar: sticker (no circle) > account logo > initials */}
          {campaignSticker ? (
            <div className="flex items-center justify-center shrink-0" style={{ width: campaignStickerSize, height: campaignStickerSize }}>
              <img
                src={campaignSticker.url}
                alt=""
                className="object-contain w-full h-full"
                style={{ filter:
                  isGrayscale ? "grayscale(1) opacity(0.45)"
                  : isDraft ? "grayscale(1) sepia(1) hue-rotate(185deg) saturate(4) brightness(0.9) opacity(0.6)"
                  : isPaused ? "sepia(1) saturate(2) hue-rotate(-5deg) brightness(0.85) opacity(0.6)"
                  : `hue-rotate(${campaign.campaign_hue ?? 0}deg)`
                }}
              />
            </div>
          ) : accountLogo ? (
            <div className="h-10 w-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 overflow-hidden relative">
              <img
                src={accountLogo}
                alt=""
                className="h-full w-full object-cover"
                style={
                  isGrayscale ? { filter: "grayscale(1)" }
                  : isDraft ? { filter: "grayscale(1)" }
                  : isPaused ? { filter: "grayscale(0.5)" }
                  : undefined
                }
              />
              {!isGrayscale && !isPaused && !isDraft && <div className="absolute inset-0 rounded-full bg-brand-indigo/40 mix-blend-multiply" />}
              {isDraft && <div className="absolute inset-0 rounded-full" style={{ backgroundColor: "rgba(80,100,220,0.35)", mixBlendMode: "color" }} />}
              {isPaused && <div className="absolute inset-0 rounded-full" style={{ backgroundColor: "rgba(200,160,40,0.55)", mixBlendMode: "color" }} />}
            </div>
          ) : (
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
              style={
                isGrayscale ? { backgroundColor: "#D0D0D0", color: "#888888" }
                : isPaused ? { backgroundColor: "#C8B86A", color: "#6B5A1E", filter: "grayscale(0.5) sepia(0.3) saturate(1.2)" }
                : isDraft ? { backgroundColor: "#BFCFFF", color: "#3B4FA0" }
                : { backgroundColor: avatarColor.bg, color: avatarColor.text }
              }
            >
              {initials}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-[18px] font-semibold font-heading leading-tight truncate text-foreground">
              {name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                style={{ backgroundColor: `${statusHex}18`, color: statusHex }}
              >
                <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: statusHex }} />
                {t(`statusLabels.${status}`, status) || t("statusLabels.Unknown")}
              </span>
            </div>
            {accountName && (
              <div className="flex items-center gap-1 mt-1">
                <Building2 className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0" />
                <span className="text-[11px] font-medium text-foreground/65 truncate">{accountName}</span>
              </div>
            )}
          </div>

        </div>

        {/* Metrics strip: always visible on mobile, hover-only on desktop */}
        <div className={cn(
          "opacity-100 max-h-[64px] md:opacity-0 md:max-h-0 md:group-hover:opacity-100 md:group-hover:max-h-[64px]",
          "transition-[opacity,max-height] duration-200 flex flex-col gap-1"
        )}>
          {/* Metrics strip */}
          <div className={cn(
            "grid grid-cols-3 gap-px rounded-lg overflow-hidden",
            isActive ? "bg-[#EFE4A0]/60" : "bg-foreground/8"
          )}>
            {([
              { label: t("card.leads"),    value: leads > 0        ? leads.toLocaleString()   : "—", isBooked: false },
              { label: t("card.response"), value: responseRate > 0 ? `${responseRate}%`        : "—", isBooked: false },
              { label: t("card.booked"),   value: bookings > 0     ? bookings.toLocaleString() : "—", isBooked: true  },
            ] as const).map((stat) => (
              <div
                key={stat.label}
                className={cn(
                  "flex flex-col items-center py-1.5",
                  isActive ? "bg-highlight-selected" : "bg-card group-hover:bg-card-hover"
                )}
              >
                <span className={cn(
                  "font-bold tabular-nums leading-tight",
                  stat.isBooked && bookings > 0
                    ? "text-[15px] text-emerald-600 dark:text-emerald-400"
                    : "text-[13px] text-foreground"
                )}>{stat.value}</span>
                <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wide mt-0.5">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* Date row */}
          {createdLabel && (
            <div className="flex items-center gap-1 px-1">
              <span className="text-[10px] text-muted-foreground/70 tabular-nums">{daysRunning !== null ? createdLabel : t("card.started", { date: createdLabel })}</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Group header ─────────────────────────────────────────────────────────────
function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div data-group-header="true" className="sticky top-0 z-20 bg-muted px-3 pt-3 pb-3">
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

// ── Filter bottom sheet ───────────────────────────────────────────────────────
const SORT_FILTER_OPTIONS: { value: CampaignSortBy; optKey: string }[] = [
  { value: "recent",        optKey: "sortOptions.recent" },
  { value: "name_asc",      optKey: "sortOptions.nameAsc" },
  { value: "name_desc",     optKey: "sortOptions.nameDesc" },
  { value: "leads_desc",    optKey: "sortOptions.leadsDesc" },
  { value: "response_desc", optKey: "sortOptions.responseDesc" },
];

const STATUS_FILTER_OPTIONS = ["Active", "Paused", "Draft", "Completed", "Inactive"];

const STATUS_COLOR: Record<string, string> = {
  Active:    "#22c55e",
  Paused:    "#f59e0b",
  Completed: "#3b82f6",
  Draft:     "#9ca3af",
  Inactive:  "#9ca3af",
};

interface CampaignFilterBottomSheetProps {
  open: boolean;
  onClose: () => void;
  sortBy: CampaignSortBy;
  onSortByChange: (v: CampaignSortBy) => void;
  filterStatus: string[];
  onFilterStatusSet: (v: string[]) => void;
  onReset: () => void;
}

function CampaignFilterBottomSheet({
  open,
  onClose,
  sortBy,
  onSortByChange,
  filterStatus,
  onFilterStatusSet,
  onReset,
}: CampaignFilterBottomSheetProps) {
  const { t } = useTranslation("campaigns");
  const [mounted, setMounted] = useState(false);

  // Pending state — only commits when Apply is pressed
  const [pendingSortBy, setPendingSortBy] = useState<CampaignSortBy>(sortBy);
  const [pendingStatus, setPendingStatus] = useState<string[]>([...filterStatus]);

  // Sync pending state when sheet opens
  useEffect(() => {
    if (open) {
      setPendingSortBy(sortBy);
      setPendingStatus([...filterStatus]);
    }
  }, [open, sortBy, filterStatus]);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const toggleStatus = (s: string) => {
    setPendingStatus((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const handleApply = () => {
    onSortByChange(pendingSortBy);
    onFilterStatusSet(pendingStatus);
    onClose();
  };

  const handleReset = () => {
    setPendingSortBy("recent");
    setPendingStatus([]);
    onReset();
    onClose();
  };

  const isModified = pendingStatus.length > 0 || pendingSortBy !== "recent";

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="campaign-filter-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 z-[300] bg-black/50"
            onClick={onClose}
          />

          {/* Bottom sheet panel */}
          <motion.div
            key="campaign-filter-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: [0.0, 0.0, 0.2, 1] }}
            data-testid="campaign-filter-sheet"
            className="md:hidden fixed inset-x-0 bottom-0 z-[301] bg-background rounded-t-3xl border-t border-border/30 flex flex-col max-h-[85dvh]"
            style={{ paddingBottom: "calc(1.5rem + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))" }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-foreground/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 pt-1 shrink-0">
              <h2 className="text-[17px] font-semibold text-foreground">
                {t("toolbar.filter")}
                {isModified && (
                  <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-brand-indigo text-white text-[10px] font-bold">
                    {pendingStatus.length + (pendingSortBy !== "recent" ? 1 : 0)}
                  </span>
                )}
              </h2>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label={t("toolbar.cancel")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 space-y-5 min-h-0">
              {/* Sort section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {t("toolbar.sortBy")}
                  </h3>
                </div>
                <div className="space-y-1">
                  {SORT_FILTER_OPTIONS.map(({ value, optKey }) => (
                    <button
                      key={value}
                      onClick={() => setPendingSortBy(value)}
                      className={cn(
                        "w-full flex items-center justify-between min-h-[44px] px-4 rounded-2xl text-[14px] font-medium transition-colors",
                        pendingSortBy === value
                          ? "bg-brand-indigo/10 text-brand-indigo"
                          : "bg-card text-foreground/80 hover:bg-muted"
                      )}
                    >
                      <span>{t(optKey)}</span>
                      {pendingSortBy === value && (
                        <Check className="h-4 w-4 text-brand-indigo shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status filter section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {t("filter.status")}
                  </h3>
                </div>
                <div className="space-y-1">
                  {STATUS_FILTER_OPTIONS.map((status) => {
                    const active = pendingStatus.includes(status);
                    return (
                      <button
                        key={status}
                        onClick={() => toggleStatus(status)}
                        className={cn(
                          "w-full flex items-center gap-3 min-h-[44px] px-4 rounded-2xl text-[14px] font-medium transition-colors",
                          active
                            ? "bg-brand-indigo/10 text-brand-indigo"
                            : "bg-card text-foreground/80 hover:bg-muted"
                        )}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: STATUS_COLOR[status] ?? "#9ca3af" }}
                        />
                        <span className="flex-1 text-left">
                          {t(`statusLabels.${status}`, status)}
                        </span>
                        {active && (
                          <Check className="h-4 w-4 text-brand-indigo shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer: Reset + Apply */}
            <div className="px-5 pt-4 flex items-center gap-3 shrink-0">
              <button
                onClick={handleReset}
                className="flex-1 min-h-[44px] rounded-2xl border border-border/50 text-[14px] font-semibold text-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
              >
                {t("filter.reset")}
              </button>
              <button
                onClick={handleApply}
                className="flex-1 min-h-[44px] rounded-2xl bg-brand-indigo text-white text-[14px] font-semibold hover:opacity-90 transition-opacity"
              >
                {t("filter.apply")}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
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
  onDuplicate?: (campaign: Campaign) => Promise<void>;
  // Detail tab (controls right panel content)
  detailTab: CampaignDetailTab;
  onDetailTabChange: (tab: CampaignDetailTab) => void;
  // Lifted controls
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
  onFilterStatusSet?: (v: string[]) => void;
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
  onDuplicate,
  detailTab,
  onDetailTabChange,
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
  onFilterStatusSet,
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
  const { t } = useTranslation("campaigns");
  const isMobile768 = useIsMobile(768);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const DETAIL_TABS: TabDef[] = useMemo(() =>
    DETAIL_TAB_DEFS.map((tab) => ({ ...tab, label: t(tab.labelKey) })),
  [t]);

  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 20;
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

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
      const headerLabel = groupBy === "status" ? t(`statusLabels.${key}`, key) : key;
      result.push({ kind: "header", label: headerLabel, count: group.length });
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

  // Auto-select: handled by CampaignsPage — do NOT auto-select here (causes override)

  // ── Smooth scroll to selected card (§29) ────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Track which campaign IDs have been rendered before — only animate genuinely new cards
  const seenCardIds = useRef<Set<number>>(new Set());

  // ── Pull-to-refresh (mobile) ─────────────────────────────────────────────
  const { pullDistance, isRefreshing } = usePullToRefresh({
    containerRef: scrollContainerRef,
    onRefresh: async () => { onRefresh?.(); },
    enabled: isMobile768,
  });
  useEffect(() => {
    if (!selectedCampaign || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const run = () => {
      const id = getCampaignId(selectedCampaign);
      const el = container.querySelector(`[data-campaign-id="${id}"]`) as HTMLElement | null;
      if (!el) return;
      let headerHeight = 0;
      let sibling = el.previousElementSibling;
      while (sibling) {
        if (sibling.getAttribute("data-group-header") === "true") {
          headerHeight = (sibling as HTMLElement).offsetHeight;
          break;
        }
        sibling = sibling.previousElementSibling;
      }
      const cardTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      container.scrollTo({ top: cardTop - headerHeight - 3, behavior: "smooth" });
    };
    const raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [selectedCampaign]);

  return (
    <div className="flex h-full gap-[3px]" data-testid="campaign-list-view">

      {/* ── LEFT PANEL: campaign list ─────────────────────────────────── */}
      <div className={cn(
        "w-full md:w-[340px] md:shrink-0 flex-col bg-muted rounded-lg overflow-hidden",
        mobileView === "detail" ? "hidden md:flex" : "flex"
      )}>

        {/* Header: title + Detail Tab Bar */}
        <div className="pl-[17px] pr-3.5 pt-3 md:pt-10 pb-1 md:pb-3 shrink-0 flex flex-col gap-2 md:flex-row md:items-center md:gap-0">
          <div className="flex items-center justify-between w-full md:w-[309px]">
            <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">{t("title")}</h2>
            <span className="hidden md:block">
              <ViewTabBar tabs={DETAIL_TABS} activeId={detailTab} onTabChange={(id) => onDetailTabChange(id as CampaignDetailTab)} variant="segment" />
            </span>
          </div>
          {/* Mobile: Detail tabs + Filter button row */}
          <div className="md:hidden flex items-center gap-2">
            <div className="flex-1">
              <ViewTabBar tabs={DETAIL_TABS} activeId={detailTab} onTabChange={(id) => onDetailTabChange(id as CampaignDetailTab)} variant="segment" />
            </div>
            {/* Filter button — shows active badge when filters are active */}
            <button
              onClick={() => setFilterSheetOpen(true)}
              data-testid="campaign-filter-btn"
              className={cn(
                "relative flex items-center gap-1.5 min-h-[44px] px-3 rounded-full border text-[12px] font-medium transition-colors shrink-0",
                isFilterActive || isSortNonDefault
                  ? "border-brand-indigo text-brand-indigo bg-brand-indigo/8"
                  : "border-border/50 text-foreground/60 hover:text-foreground hover:border-border"
              )}
              aria-label={t("toolbar.filter")}
            >
              <Filter className="h-3.5 w-3.5 shrink-0" />
              <span>{t("toolbar.filter")}</span>
              {(isFilterActive || isSortNonDefault) && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-brand-indigo text-white text-[9px] font-bold flex items-center justify-center">
                  {filterStatus.length + (isSortNonDefault ? 1 : 0)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Campaign list */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-[3px]">
          {/* Pull-to-refresh indicator — mobile only */}
          <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
          {loading ? (
            <ListSkeleton />
          ) : paginatedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Megaphone className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">{t("empty.noCampaignsFound")}</p>
              {listSearch && <p className="text-xs text-muted-foreground/70 mt-1">{t("empty.tryDifferentSearch")}</p>}
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
                const isNew = !seenCardIds.current.has(cid);
                if (isNew && cid) seenCardIds.current.add(cid);
                return (
                  <div key={cid || idx} data-campaign-id={cid} className={isNew ? "animate-card-enter" : undefined} style={isNew ? { animationDelay: `${Math.min(idx, 8) * 50}ms` } : undefined}>
                    <CampaignListCard
                      campaign={item.campaign}
                      isActive={isSelected}
                      onClick={() => {
                        onSelectCampaign(item.campaign);
                        if (isMobile768) {
                          setMobilePanelOpen(true);
                        } else {
                          setMobileView("detail");
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination footer */}
        {totalCampaigns > PAGE_SIZE && (
          <div className="h-9 md:h-[18px] px-3 py-1 border-t border-border/20 flex items-center justify-between shrink-0">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 touch-target"
            >
              {t("pagination.previous")}
            </button>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {t("pagination.rangeOf", { start: currentPage * PAGE_SIZE + 1, end: Math.min((currentPage + 1) * PAGE_SIZE, totalCampaigns), total: totalCampaigns })}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(maxPage, p + 1))}
              disabled={currentPage >= maxPage}
              className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 touch-target"
            >
              {t("pagination.next")}
            </button>
          </div>
        )}
      </div>

      {/* ── MOBILE FULL-SCREEN DETAIL PANEL (< 768px) ──────────────── */}
      <MobileCampaignDetailPanel
        campaign={selectedCampaign}
        metrics={metrics}
        open={mobilePanelOpen}
        onBack={() => setMobilePanelOpen(false)}
      />

      {/* ── MOBILE FILTER BOTTOM SHEET (< 768px) ────────────────────── */}
      <CampaignFilterBottomSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        sortBy={sortBy}
        onSortByChange={onSortByChange}
        filterStatus={filterStatus}
        onFilterStatusSet={onFilterStatusSet ?? ((v) => {
          // Fallback: diff against current filterStatus and toggle each
          const toAdd = v.filter((s) => !filterStatus.includes(s));
          const toRemove = filterStatus.filter((s) => !v.includes(s));
          toAdd.forEach((s) => onToggleFilterStatus(s));
          toRemove.forEach((s) => onToggleFilterStatus(s));
        })}
        onReset={onResetControls}
      />

      {/* ── RIGHT PANEL: toolbar + detail view (desktop only) ───────── */}
      <div ref={rightPanelRef} className={cn(
        "flex-1 flex-col overflow-hidden rounded-lg",
        mobileView === "list" ? "hidden md:flex" : "flex mobile-panel-enter"
      )}>

        {/* Detail view */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {loading && !selectedCampaign ? (
            <SkeletonCampaignPanel />
          ) : selectedCampaign ? (
            <CampaignDetailView
              campaign={selectedCampaign}
              metrics={metrics}
              allCampaigns={campaigns}
              onToggleStatus={onToggleStatus}
              onSave={onSave}
              onRefresh={onRefresh}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              compact={isDetailCompact}
              onCreateCampaign={onCreateCampaign}
              activeTab={detailTab}
              onActiveTabChange={onDetailTabChange}
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
              onBack={() => setMobileView("list")}
            />
          ) : (
            <CampaignDetailViewEmpty />
          )}
        </div>
      </div>
    </div>
  );
}
