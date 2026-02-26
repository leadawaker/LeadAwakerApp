import { useState, useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { SkeletonList } from "@/components/ui/skeleton";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { IconBtn } from "@/components/ui/icon-btn";
import { Search, SlidersHorizontal, Layers, ArrowUpDown, Filter, Check, Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Thread, Lead, Interaction } from "../hooks/useConversationsData";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import {
  initialsFor,
  getStatus,
  getStatusAvatarColor,
  PIPELINE_STATUSES,
  PIPELINE_HEX,
  formatRelativeTime,
} from "../utils/conversationHelpers";

function getLeadTagNames(lead: Lead): string[] {
  const raw = lead.tags;
  if (!raw) return [];
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return []; }
  }
  if (Array.isArray(raw)) {
    return raw.map((t: any) => typeof t === "string" ? t : t?.name ?? "").filter(Boolean);
  }
  return [];
}

function getLastMessageDisplay(last: Interaction | undefined): string {
  if (!last) return "";
  const content = last.content ?? last.Content ?? "";
  const attachment = last.attachment ?? last.Attachment;
  if (attachment && !content) {
    if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)/i.test(attachment)) return "Image";
    if (/\.(mp4|mov|avi|webm)/i.test(attachment)) return "Video";
    if (/\.(mp3|wav|ogg|aac)/i.test(attachment)) return "Audio";
    return "File";
  }
  return content;
}

// ── Group / Sort types ─────────────────────────────────────────────────────────
type ChatGroupBy = "date" | "status" | "campaign" | "ai_human" | "none";
type ChatSortBy = "newest" | "oldest" | "name_asc" | "name_desc";

const GROUP_LABELS: Record<ChatGroupBy, string> = {
  date:     "Date",
  status:   "Status",
  campaign: "Campaign",
  ai_human: "AI / Human",
  none:     "None",
};

const SORT_LABELS: Record<ChatSortBy, string> = {
  newest:    "Most Recent",
  oldest:    "Oldest First",
  name_asc:  "Name A \u2192 Z",
  name_desc: "Name Z \u2192 A",
};


const STATUS_GROUP_ORDER = ["New", "Contacted", "Responded", "Multiple Responses", "Qualified", "Booked", "Closed", "Lost", "DND"];

// ── Date group helpers ─────────────────────────────────────────────────────────
function getDateGroupLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return "No Activity";
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
    if (diff <= 0)  return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7)   return "This Week";
    if (diff < 30)  return "This Month";
    if (diff < 90)  return "Last 3 Months";
    return "Older";
  } catch { return "No Activity"; }
}

const DATE_GROUP_ORDER = ["Today", "Yesterday", "This Week", "This Month", "Last 3 Months", "Older", "No Activity"];

// ── Virtual list item type ─────────────────────────────────────────────────────
type VirtualItem =
  | { type: "header"; label: string; count: number }
  | { type: "thread"; thread: Thread };

// ── Types ──────────────────────────────────────────────────────────────────────
interface Campaign {
  id: number;
  name: string;
  accounts_id?: number;
  Accounts_id?: number;
}

interface Account {
  id: number;
  name: string;
}

interface InboxPanelProps {
  threads: Thread[];
  loading: boolean;
  selectedLeadId: number | null;
  onSelectLead: (id: number) => void;
  tab: "all" | "unread";
  onTabChange: (tab: "all" | "unread") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCampaignId: number | "all";
  onCampaignChange: (id: number | "all") => void;
  campaigns?: Campaign[];
  accounts?: Account[];
  selectedAccountId?: number | "all";
  onAccountChange?: (id: number | "all") => void;
  isAgencyUser?: boolean;
  onClearFilters?: () => void;
  onNewConversation?: () => void;
  className?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────
export function InboxPanel({
  threads,
  loading,
  selectedLeadId,
  onSelectLead,
  tab,
  onTabChange,
  searchQuery,
  onSearchChange,
  selectedCampaignId,
  onCampaignChange,
  campaigns = [],
  accounts = [],
  selectedAccountId,
  onAccountChange,
  isAgencyUser = false,
  onClearFilters,
  onNewConversation,
  className,
}: InboxPanelProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Local group / sort / filter state
  const [groupBy, setGroupBy] = useState<ChatGroupBy>("date");
  const [sortBy, setSortBy] = useState<ChatSortBy>("newest");
  const [filterStatus, setFilterStatus] = useState<string[]>([]);

  const isGroupNonDefault = groupBy !== "date";
  const isSortNonDefault = sortBy !== "newest";
  const hasNonDefaultControls =
    isGroupNonDefault ||
    isSortNonDefault ||
    filterStatus.length > 0 ||
    selectedCampaignId !== "all" ||
    (isAgencyUser && selectedAccountId !== "all");

  const handleToggleFilterStatus = (status: string) => {
    setFilterStatus((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const handleResetControls = () => {
    setGroupBy("date");
    setSortBy("newest");
    setFilterStatus([]);
    onCampaignChange("all");
    if (isAgencyUser && onAccountChange) onAccountChange("all");
  };

  const handleClearAll = () => {
    handleResetControls();
    onSearchChange("");
    onTabChange("all");
    if (onClearFilters) onClearFilters();
  };

  // When in "unread" tab, show only threads the hook marked as unread
  const tabFiltered =
    tab === "unread"
      ? threads.filter((t) => t.unread)
      : threads;

  // Apply local status filter
  const statusFiltered = useMemo(() => {
    if (filterStatus.length === 0) return tabFiltered;
    return tabFiltered.filter((t) => filterStatus.includes(getStatus(t.lead)));
  }, [tabFiltered, filterStatus]);

  // Apply local sort
  const sorted = useMemo(() => {
    return [...statusFiltered].sort((a, b) => {
      switch (sortBy) {
        case "oldest": {
          const aT = a.last?.created_at ?? a.last?.createdAt ?? "";
          const bT = b.last?.created_at ?? b.last?.createdAt ?? "";
          return aT.localeCompare(bT);
        }
        case "name_asc": {
          const aName = a.lead.full_name || `${a.lead.first_name ?? ""} ${a.lead.last_name ?? ""}`;
          const bName = b.lead.full_name || `${b.lead.first_name ?? ""} ${b.lead.last_name ?? ""}`;
          return aName.localeCompare(bName);
        }
        case "name_desc": {
          const aName = a.lead.full_name || `${a.lead.first_name ?? ""} ${a.lead.last_name ?? ""}`;
          const bName = b.lead.full_name || `${b.lead.first_name ?? ""} ${b.lead.last_name ?? ""}`;
          return bName.localeCompare(aName);
        }
        default: {
          const aT = a.last?.created_at ?? a.last?.createdAt ?? "";
          const bT = b.last?.created_at ?? b.last?.createdAt ?? "";
          return bT.localeCompare(aT);
        }
      }
    });
  }, [statusFiltered, sortBy]);

  // Build virtualised item list with group headers
  const virtualItems = useMemo((): VirtualItem[] => {
    if (sorted.length === 0) return [];

    if (groupBy === "none") {
      return sorted.map((t) => ({ type: "thread" as const, thread: t }));
    }

    const buckets = new Map<string, Thread[]>();
    for (const t of sorted) {
      let key: string;
      switch (groupBy) {
        case "date":
          key = getDateGroupLabel(t.last?.created_at ?? t.last?.createdAt);
          break;
        case "status":
          key = getStatus(t.lead) || "Unknown";
          break;
        case "campaign":
          key = t.lead.Campaign ?? t.lead.campaign_name ?? t.lead.campaign ?? "No Campaign";
          break;
        case "ai_human":
          key = t.lead.manual_takeover ? "Human" : "AI";
          break;
        default:
          key = "Unknown";
      }
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(t);
    }

    // Order bucket keys
    let orderedKeys: string[];
    if (groupBy === "date") {
      orderedKeys = DATE_GROUP_ORDER.filter((k) => buckets.has(k));
    } else if (groupBy === "status") {
      orderedKeys = STATUS_GROUP_ORDER.filter((k) => buckets.has(k)).concat(
        Array.from(buckets.keys()).filter((k) => !STATUS_GROUP_ORDER.includes(k))
      );
    } else {
      orderedKeys = Array.from(buckets.keys()).sort();
    }

    const items: VirtualItem[] = [];
    for (const key of orderedKeys) {
      const group = buckets.get(key);
      if (!group?.length) continue;
      items.push({ type: "header", label: key, count: group.length });
      for (const t of group) {
        items.push({ type: "thread", thread: t });
      }
    }
    return items;
  }, [sorted, groupBy]);

  const listContainerRef = useRef<HTMLDivElement>(null);
  const threadVirtualizer = useVirtualizer({
    count: virtualItems.length,
    getScrollElement: () => listContainerRef.current,
    estimateSize: (i) => (virtualItems[i]?.type === "header" ? 32 : 88),
    overscan: 5,
  });

  const totalUnread = threads.filter((t) => t.unread).length;

  const INBOX_TABS: TabDef[] = [
    { id: "all", label: "Inbox" },
    {
      id: "unread",
      label: "Unread",
      badge: totalUnread > 0 ? (
        <span className="min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
          {totalUnread > 99 ? "99+" : totalUnread}
        </span>
      ) : undefined,
    },
  ];

  return (
    <section
      className={cn(
        "flex flex-col bg-muted rounded-lg overflow-hidden h-full",
        className,
      )}
      data-testid="panel-inbox"
    >
      {/* ── Panel header: title + count ── */}
      <div className="px-3.5 pt-5 pb-1 shrink-0 flex items-center justify-between" data-testid="panel-inbox-head">
        <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">My Chats</h2>
        <span className="w-10 text-center text-[12px] font-medium text-muted-foreground tabular-nums">{threads.length}</span>
      </div>

      {/* ── Controls row: tabs (left) + search/settings (right) ── */}
      <div className="px-3 pt-1.5 pb-3 shrink-0 flex items-center justify-between gap-2">
        {/* Tab switchers — Inbox / Unread */}
        <ViewTabBar tabs={INBOX_TABS} activeId={tab} onTabChange={(id) => onTabChange(id as "all" | "unread")} />

        {/* Search + Settings buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* New conversation */}
          <IconBtn title="New Conversation" onClick={onNewConversation}>
            <Plus className="h-4 w-4" />
          </IconBtn>

          {/* Search popup */}
          <Popover open={searchOpen} onOpenChange={(open) => { setSearchOpen(open); if (!open) onSearchChange(""); }}>
            <PopoverTrigger asChild>
              <IconBtn active={searchOpen || !!searchQuery} title="Search contacts">
                <Search className="h-4 w-4" />
              </IconBtn>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2" sideOffset={4}>
              <input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search contacts..."
                autoFocus
                className="w-full h-8 px-3 rounded-lg bg-muted/60 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-indigo/30 placeholder:text-muted-foreground/60"
              />
            </PopoverContent>
          </Popover>

          {/* Settings */}
          <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DropdownMenuTrigger asChild>
              <IconBtn
                active={settingsOpen || hasNonDefaultControls}
                title="Group, Sort & Filter"
                data-testid="button-toggle-filters"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </IconBtn>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {/* Group */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-[12px]">
                  <Layers className="h-3.5 w-3.5 mr-2" />
                  Group
                  {isGroupNonDefault && <span className="ml-auto text-[10px] text-brand-indigo font-medium">{GROUP_LABELS[groupBy]}</span>}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-40">
                  {(Object.keys(GROUP_LABELS) as ChatGroupBy[]).map((opt) => (
                    <DropdownMenuItem key={opt} onClick={() => setGroupBy(opt)} className={cn("text-[12px]", groupBy === opt && "font-semibold text-brand-indigo")}>
                      {GROUP_LABELS[opt]}
                      {groupBy === opt && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Sort */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-[12px]">
                  <ArrowUpDown className="h-3.5 w-3.5 mr-2" />
                  Sort
                  {isSortNonDefault && <span className="ml-auto text-[10px] text-brand-indigo font-medium">{SORT_LABELS[sortBy]}</span>}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44">
                  {(Object.keys(SORT_LABELS) as ChatSortBy[]).map((opt) => (
                    <DropdownMenuItem key={opt} onClick={() => setSortBy(opt)} className={cn("text-[12px]", sortBy === opt && "font-semibold text-brand-indigo")}>
                      {SORT_LABELS[opt]}
                      {sortBy === opt && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              {/* Filter Status */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-[12px]">
                  <Filter className="h-3.5 w-3.5 mr-2" />
                  Filter Status
                  {filterStatus.length > 0 && <span className="ml-auto text-[10px] text-brand-indigo font-medium">{filterStatus.length}</span>}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48 max-h-60 overflow-y-auto">
                  {PIPELINE_STATUSES.map((s) => (
                    <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); handleToggleFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PIPELINE_HEX[s] ?? "#6B7280" }} />
                      <span className="flex-1">{s}</span>
                      {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Account filter (agency only) */}
              {isAgencyUser && accounts.length > 0 && onAccountChange && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="text-[12px]">
                      Account
                      {selectedAccountId !== "all" && (
                        <span className="ml-auto text-[10px] text-brand-indigo font-medium truncate max-w-[80px]">
                          {accounts.find((a) => a.id === selectedAccountId)?.name ?? ""}
                        </span>
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-44 max-h-60 overflow-y-auto">
                      <DropdownMenuItem onClick={() => onAccountChange("all")} className={cn("text-[12px]", selectedAccountId === "all" && "font-semibold text-brand-indigo")}>
                        All Accounts
                        {selectedAccountId === "all" && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                      {accounts.map((a) => (
                        <DropdownMenuItem key={a.id} onClick={() => onAccountChange(a.id)} className={cn("text-[12px]", selectedAccountId === a.id && "font-semibold text-brand-indigo")}>
                          {a.name}
                          {selectedAccountId === a.id && <Check className="h-3 w-3 ml-auto" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              )}

              {/* Campaign filter */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-[12px]">
                  Campaign
                  {selectedCampaignId !== "all" && (
                    <span className="ml-auto text-[10px] text-brand-indigo font-medium truncate max-w-[80px]">
                      {campaigns.find((c) => c.id === selectedCampaignId)?.name ?? ""}
                    </span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44 max-h-60 overflow-y-auto">
                  <DropdownMenuItem onClick={() => onCampaignChange("all")} className={cn("text-[12px]", selectedCampaignId === "all" && "font-semibold text-brand-indigo")}>
                    All Campaigns
                    {selectedCampaignId === "all" && <Check className="h-3 w-3 ml-auto" />}
                  </DropdownMenuItem>
                  {campaigns.map((c) => (
                    <DropdownMenuItem key={c.id} onClick={() => onCampaignChange(c.id)} className={cn("text-[12px]", selectedCampaignId === c.id && "font-semibold text-brand-indigo")}>
                      {c.name}
                      {selectedCampaignId === c.id && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Reset */}
              {hasNonDefaultControls && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleResetControls} className="text-[12px] text-destructive">
                    Reset all settings
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Thread list ── */}
      <div ref={listContainerRef} className="flex-1 overflow-y-auto pt-0 pb-2" data-testid="list-inbox">
        {loading ? (
          <SkeletonList count={6} />
        ) : sorted.length === 0 ? (
          searchQuery ? (
            <DataEmptyState
              variant="search"
              title="No conversations found"
              description={`No conversations match "${searchQuery}".`}
              compact
              data-testid="empty-state-search"
            />
          ) : hasNonDefaultControls || tab === "unread" ? (
            <DataEmptyState
              variant="search"
              title={tab === "unread" ? "All caught up!" : "No matches"}
              description={
                tab === "unread"
                  ? "You have no unread conversations right now."
                  : "No conversations match the selected filters."
              }
              actionLabel={hasNonDefaultControls ? "Clear filters" : undefined}
              onAction={hasNonDefaultControls ? handleClearAll : undefined}
              compact
              data-testid="empty-state-filtered"
            />
          ) : (
            <DataEmptyState
              variant="conversations"
              compact
              data-testid="empty-state-no-conversations"
            />
          )
        ) : (
          <div style={{ height: `${threadVirtualizer.getTotalSize()}px`, position: "relative" }}>
            {threadVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = virtualItems[virtualRow.index];
              if (!item) return null;

              // ── Group header — centered label with lines ──
              if (item.type === "header") {
                return (
                  <div
                    key={`header-${item.label}`}
                    data-index={virtualRow.index}
                    ref={threadVirtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="sticky top-0 z-20 bg-muted px-3 pt-1.5 pb-1.5">
                      <div className="flex items-center gap-0">
                        <div className="flex-1 h-px bg-foreground/15 mx-[8px]" />
                        <span className="text-[10px] font-bold text-foreground/55 uppercase tracking-widest shrink-0">
                          {item.label}
                        </span>
                        <span className="ml-1 text-[9px] text-muted-foreground/45 font-semibold shrink-0">
                          {item.count}
                        </span>
                        <div className="flex-1 h-px bg-foreground/15 mx-[8px]" />
                      </div>
                    </div>
                  </div>
                );
              }

              // ── Thread card ──
              const { lead, last, unread, unreadCount } = item.thread;
              const active = selectedLeadId === lead.id;
              const showUnreadBadge = unread;
              const status = getStatus(lead);
              const avatarColor = getStatusAvatarColor(status);
              const lastContent = getLastMessageDisplay(last);
              const lastTs = last?.created_at ?? last?.createdAt;
              const tags = getLeadTagNames(lead);

              return (
                <div
                  key={lead.id}
                  data-index={virtualRow.index}
                  ref={threadVirtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectLead(lead.id)}
                    onKeyDown={(e) => e.key === "Enter" && onSelectLead(lead.id)}
                    className={cn(
                      "relative mx-[3px] my-0.5 rounded-xl cursor-pointer transition-colors",
                      active ? "bg-[#FFF1C8]" : "bg-white hover:bg-[#FAFAFA]"
                    )}
                    data-testid={`button-thread-${lead.id}`}
                  >
                    <div className="px-2.5 pt-2.5 pb-2 flex flex-col gap-1">

                      {/* Row 1: Avatar (+ unread badge) + Name + Status + Time */}
                      <div className="flex items-start gap-2">
                        {/* Avatar with unread badge overlay */}
                        <div className="relative shrink-0">
                          <div
                            className="h-10 w-10 rounded-full flex items-center justify-center text-[13px] font-bold"
                            style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
                          >
                            {initialsFor(lead)}
                          </div>
                          {showUnreadBadge && (
                            <span
                              className={cn(
                                "absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] rounded-full bg-[#FCB803] text-[#131B49] text-[8px] font-bold flex items-center justify-center px-0.5",
                                active ? "shadow-[0_0_0_2px_#FFF1C8]" : "shadow-[0_0_0_2px_#F1F1F1]"
                              )}
                            >
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                        </div>

                        {/* Name + conversion status */}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[13px] font-semibold font-heading leading-tight truncate text-foreground">
                              {lead.full_name ||
                                `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() ||
                                "Unknown"}
                            </p>
                            {lastTs && (
                              <span className="text-[10px] text-muted-foreground/70 shrink-0 tabular-nums">
                                {formatRelativeTime(lastTs)}
                              </span>
                            )}
                          </div>
                          {/* Conversion status — hide when grouped by status */}
                          {status && groupBy !== "status" && (
                            <p className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5">
                              {status}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Row 2: Last message — bigger, italic, truncated */}
                      {lastContent && (
                        <p className="text-[13px] text-muted-foreground truncate italic leading-snug">
                          {lastContent}
                        </p>
                      )}

                      {/* Row 3: Tags */}
                      {tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {tags.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] font-medium bg-black/[0.06] text-foreground/55"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

