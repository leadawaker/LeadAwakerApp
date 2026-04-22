import { RefObject } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { Hand } from "lucide-react";
import { SkeletonList } from "@/components/ui/skeleton";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { PullToRefreshIndicator } from "@/components/ui/PullToRefreshIndicator";
import { getStatus, getStatusAvatarColor, formatRelativeTime } from "../../utils/conversationHelpers";
import type { ChatGroupBy, InboxTab, VirtualItem, Thread } from "./types";
import { getLastMessageDisplay, getLeadTagNames } from "./helpers";

interface ThreadListProps {
  tab: InboxTab;
  loading: boolean;
  sorted: Thread[];
  searchQuery: string;
  hasNonDefaultControls: boolean;
  onClearAll?: () => void;
  groupBy: ChatGroupBy;
  activeGroupLabel: { label: string; count: number } | null;
  listContainerRef: RefObject<HTMLDivElement | null>;
  convoPullDistance: number;
  convoIsRefreshing: boolean;
  threadVirtualizer: Virtualizer<HTMLDivElement, Element>;
  virtualItems: VirtualItem[];
  selectedLeadId: number | null;
  onSelectLead: (id: number) => void;
}

export function ThreadList({
  tab,
  loading,
  sorted,
  searchQuery,
  hasNonDefaultControls,
  onClearAll,
  groupBy,
  activeGroupLabel,
  listContainerRef,
  convoPullDistance,
  convoIsRefreshing,
  threadVirtualizer,
  virtualItems,
  selectedLeadId,
  onSelectLead,
}: ThreadListProps) {
  return (
    <div className={cn("flex-1 min-h-0 relative", tab === "prospects" && "hidden")}>
      {/* Sticky group header overlay — absolute so it doesn't push content down */}
      {groupBy !== "none" && !loading && sorted.length > 0 && activeGroupLabel && (
        <div className="absolute top-0 left-0 right-0 z-20 bg-muted px-3 pt-3 pb-3 pointer-events-none">
          <div className="flex items-center gap-[10px]">
            <div className="flex-1 h-px bg-foreground/15" />
            <span className="text-[12px] font-bold text-foreground tracking-wide shrink-0">
              {activeGroupLabel.label}
            </span>
            <span className="text-foreground/20 shrink-0">{"\u2013"}</span>
            <span className="text-[12px] font-medium text-muted-foreground tabular-nums shrink-0">
              {activeGroupLabel.count}
            </span>
            <div className="flex-1 h-px bg-foreground/15" />
          </div>
        </div>
      )}
      <div ref={listContainerRef} className="h-full overflow-y-auto" data-testid="list-inbox">
        <PullToRefreshIndicator pullDistance={convoPullDistance} isRefreshing={convoIsRefreshing} />
        <div className="p-[3px]">
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

                // Group header
                if (item.type === "header") {
                  return (
                    <div
                      key={`header-${item.label}`}
                      data-index={virtualRow.index}
                      data-group-label={item.label}
                      data-group-count={item.count}
                      ref={threadVirtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        paddingBottom: 3,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div className="px-3 pt-3 pb-3">
                        <div className="flex items-center gap-[10px]">
                          <div className="flex-1 h-px bg-foreground/15" />
                          <span className="text-[12px] font-bold text-foreground tracking-wide shrink-0">{item.label}</span>
                          <span className="text-foreground/20 shrink-0">{"\u2013"}</span>
                          <span className="text-[12px] font-medium text-muted-foreground tabular-nums shrink-0">{item.count}</span>
                          <div className="flex-1 h-px bg-foreground/15" />
                        </div>
                      </div>
                    </div>
                  );
                }

                // Thread card
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
                      paddingBottom: 3,
                      transform: `translateY(${virtualRow.start}px)`,
                      animationDelay: `${Math.min(virtualRow.index, 12) * 25}ms`,
                    }}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectLead(lead.id)}
                      onKeyDown={(e) => e.key === "Enter" && onSelectLead(lead.id)}
                      className={cn(
                        "relative rounded-xl cursor-pointer transition-colors min-h-[64px]",
                        active ? "bg-highlight-selected" : "bg-card hover:bg-card-hover"
                      )}
                      data-testid={`button-thread-${lead.id}`}
                      data-thread-id={lead.id}
                    >
                      <div className="px-2.5 pt-2.5 pb-2 flex flex-col gap-1">
                        <div className="flex items-start gap-2">
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

                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[16px] font-semibold font-heading leading-tight truncate text-foreground">
                                {lead.full_name ||
                                  `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() ||
                                  "Unknown"}
                              </p>
                              {lead.manual_takeover && (
                                <Hand className="w-3 h-3 text-amber-500 shrink-0" />
                              )}
                              {lastTs && (
                                <span className="text-[10px] text-muted-foreground/70 shrink-0 tabular-nums">
                                  {formatRelativeTime(lastTs)}
                                </span>
                              )}
                            </div>
                            {status && groupBy !== "status" && (
                              <p className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5 flex items-center gap-1">
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: avatarColor.bg }}
                                />
                                {status}
                              </p>
                            )}
                            {lastContent && (
                              <p className="text-[13px] text-muted-foreground truncate leading-snug mt-1">
                                {lastContent}
                              </p>
                            )}
                            {tags.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                {tags.slice(0, 3).map((t) => (
                                  <span
                                    key={t}
                                    className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] font-medium"
                                    style={{
                                      backgroundColor: active ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.09)",
                                      color: "rgba(0,0,0,0.45)",
                                    }}
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
