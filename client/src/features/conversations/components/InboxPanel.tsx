import { useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { SkeletonList } from "@/components/ui/skeleton";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { Inbox, BellDot } from "lucide-react";
import type { Thread, Lead, Interaction } from "../hooks/useConversationsData";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import {
  getStatus,
  getStatusAvatarColor,
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

// Group / Sort label maps are exported for use by the settings dropdown in Conversations.tsx
export const GROUP_LABELS: Record<ChatGroupBy, string> = {
  date:     "Date",
  status:   "Status",
  campaign: "Campaign",
  ai_human: "AI / Human",
  none:     "None",
};

export const SORT_LABELS: Record<ChatSortBy, string> = {
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
export type ChatGroupBy = "date" | "status" | "campaign" | "ai_human" | "none";
export type ChatSortBy = "newest" | "oldest" | "name_asc" | "name_desc";

interface InboxPanelProps {
  threads: Thread[];
  loading: boolean;
  selectedLeadId: number | null;
  onSelectLead: (id: number) => void;
  tab: "all" | "unread";
  onTabChange: (tab: "all" | "unread") => void;
  searchQuery: string;
  groupBy: ChatGroupBy;
  sortBy: ChatSortBy;
  filterStatus: string[];
  selectedCampaignId: number | "all";
  selectedAccountId?: number | "all";
  isAgencyUser?: boolean;
  onClearAll?: () => void;
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
  groupBy,
  sortBy,
  filterStatus,
  selectedCampaignId,
  selectedAccountId,
  isAgencyUser = false,
  onClearAll,
  className,
}: InboxPanelProps) {
  const hasNonDefaultControls =
    groupBy !== "date" ||
    sortBy !== "newest" ||
    filterStatus.length > 0 ||
    selectedCampaignId !== "all" ||
    (isAgencyUser && selectedAccountId !== "all");

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
    gap: 3,
    overscan: 5,
  });

  const totalUnread = threads.filter((t) => t.unread).length;

  const INBOX_TABS: TabDef[] = [
    { id: "all", label: "Inbox", icon: Inbox },
    {
      id: "unread",
      label: "Unread",
      icon: BellDot,
      badge: totalUnread > 0 ? (
        <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-brand-indigo text-white text-[9px] font-bold leading-none">
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
      {/* ── Panel header: title + Inbox/Unread text tabs ── */}
      <div className="pl-[17px] pr-3.5 pt-10 pb-3 shrink-0 flex items-center" data-testid="panel-inbox-head">
        <div className="flex items-center justify-between w-[309px] shrink-0">
          <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">Chats</h2>
          <ViewTabBar
            tabs={INBOX_TABS}
            activeId={tab}
            onTabChange={(id) => onTabChange(id as "all" | "unread")}
          />
        </div>
      </div>

      {/* ── Thread list ── */}
      <div ref={listContainerRef} className="flex-1 overflow-y-auto p-[3px]" data-testid="list-inbox">
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
              onAction={hasNonDefaultControls && onClearAll ? onClearAll : undefined}
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
                    <div className="sticky top-0 z-20 bg-muted px-3 pt-3 pb-3">
                      <div className="flex items-center gap-[10px]">
                        <div className="flex-1 h-px bg-foreground/15" />
                        <span className="text-[12px] font-bold text-foreground tracking-wide shrink-0">
                          {item.label}
                        </span>
                        <span className="text-foreground/20 shrink-0">–</span>
                        <span className="text-[12px] font-medium text-muted-foreground tabular-nums shrink-0">
                          {item.count}
                        </span>
                        <div className="flex-1 h-px bg-foreground/15" />
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
                  className="animate-fade-in"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${virtualRow.start}px)`,
                    animationDelay: `${Math.min(virtualRow.index, 15) * 30}ms`,
                  }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectLead(lead.id)}
                    onKeyDown={(e) => e.key === "Enter" && onSelectLead(lead.id)}
                    className={cn(
                      "relative rounded-xl cursor-pointer transition-colors",
                      active ? "bg-highlight-selected" : "bg-card hover:bg-card-hover"
                    )}
                    data-testid={`button-thread-${lead.id}`}
                  >
                    <div className="px-2.5 pt-2.5 pb-2 flex flex-col gap-1">

                      {/* Row 1: Avatar (+ unread badge) + Name + Status + Time */}
                      <div className="flex items-start gap-2">
                        {/* Avatar with unread badge overlay */}
                        <div className="relative shrink-0">
                          <EntityAvatar
                            name={`${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "?"}
                            bgColor={avatarColor.bg}
                            textColor={avatarColor.text}
                          />
                          {showUnreadBadge && (
                            <span
                              className={cn(
                                "absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] rounded-full bg-[#FCB803] text-[#131B49] text-[8px] font-bold flex items-center justify-center px-0.5",
                                active ? "shadow-[0_0_0_2px_var(--color-highlight-selected)]" : "shadow-[0_0_0_2px_var(--color-card)]"
                              )}
                            >
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                        </div>

                        {/* Name + conversion status */}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[16px] font-semibold font-heading leading-tight truncate text-foreground">
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

