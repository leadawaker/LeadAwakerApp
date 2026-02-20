import { useState } from "react";
import { cn } from "@/lib/utils";
import { SkeletonList } from "@/components/ui/skeleton";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { ArrowDownUp, ChevronDown, SlidersHorizontal, Bot, User, LayoutList } from "lucide-react";
import type { Thread, Lead, AiStateFilter, SortOrder } from "../hooks/useConversationsData";

function initialsFor(lead: Lead) {
  const a = (lead.first_name ?? "").slice(0, 1);
  const b = (lead.last_name ?? "").slice(0, 1);
  return `${a}${b}`.toUpperCase() || "?";
}

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
  /** Campaign filter state */
  selectedCampaignId: number | "all";
  onCampaignChange: (id: number | "all") => void;
  /** AI/Human state filter */
  aiStateFilter: AiStateFilter;
  onAiStateFilterChange: (v: AiStateFilter) => void;
  /** Available campaigns for filter dropdown */
  campaigns?: Campaign[];
  /** Available accounts (agency view only) */
  accounts?: Account[];
  /** Current selected account (agency view) */
  selectedAccountId?: number | "all";
  onAccountChange?: (id: number | "all") => void;
  /** Whether the current user is an agency user */
  isAgencyUser?: boolean;
  /** Set of lead IDs that have been opened/read this session */
  readLeadIds?: Set<number>;
  /** Current sort order */
  sortOrder?: SortOrder;
  onSortOrderChange?: (order: SortOrder) => void;
  className?: string;
}

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
  aiStateFilter,
  onAiStateFilterChange,
  campaigns = [],
  accounts = [],
  selectedAccountId,
  onAccountChange,
  isAgencyUser = false,
  readLeadIds = new Set(),
  sortOrder = "newest",
  onSortOrderChange,
  className,
}: InboxPanelProps) {
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters =
    selectedCampaignId !== "all" ||
    aiStateFilter !== "all" ||
    (isAgencyUser && selectedAccountId !== "all");

  // When in "unread" tab, also exclude threads that have been opened this session
  // (the hook filters by t.unread but doesn't know which leads were opened in this session)
  const displayThreads =
    tab === "unread"
      ? threads.filter((t) => t.unread && !readLeadIds.has(t.lead.id))
      : threads;

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col h-full transition-all duration-250 ease-out",
        className,
      )}
      data-testid="panel-inbox"
    >
      {/* Header: tabs + filter toggle */}
      <div className="p-4 border-b border-border shrink-0" data-testid="panel-inbox-head">
        <div className="flex items-center justify-between gap-4 mb-2" data-testid="row-inbox-tabs">
          <div className="flex items-center gap-4">
            <button
              onClick={() => onTabChange("all")}
              className={cn(
                "text-sm font-bold transition-colors pb-1 border-b-2",
                tab === "all"
                  ? "text-foreground border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground",
              )}
              data-testid="button-tab-all"
            >
              Inbox
            </button>
            <button
              onClick={() => onTabChange("unread")}
              className={cn(
                "text-sm font-bold transition-colors pb-1 border-b-2 flex items-center gap-1.5",
                tab === "unread"
                  ? "text-foreground border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground",
              )}
              data-testid="button-tab-unread"
            >
              Unread
              {(() => {
                const totalUnread = threads.filter(
                  (t) => t.unread && !readLeadIds.has(t.lead.id)
                ).length;
                return totalUnread > 0 ? (
                  <span className="min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                ) : null;
              })()}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Sort order dropdown */}
            {onSortOrderChange && (
              <div className="relative" data-testid="sort-order-wrapper">
                <div className="flex items-center">
                  <ArrowDownUp className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
                  <select
                    value={sortOrder}
                    onChange={(e) => onSortOrderChange(e.target.value as SortOrder)}
                    className={cn(
                      "appearance-none h-8 pl-7 pr-6 rounded-lg border text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/30 transition-colors cursor-pointer",
                      sortOrder !== "newest"
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "border-border text-muted-foreground bg-background hover:text-foreground hover:bg-muted/20",
                    )}
                    data-testid="select-sort-order"
                    aria-label="Sort conversations"
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="unread">Unread first</option>
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            )}

            {/* Filter toggle button */}
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors",
                showFilters || hasActiveFilters
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/20",
              )}
              data-testid="button-toggle-filters"
              aria-label="Toggle filters"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {hasActiveFilters && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </button>
          </div>
        </div>

        {/* Expandable filter panel */}
        {showFilters && (
          <div
            className="mt-2 space-y-2 pb-2"
            data-testid="row-inbox-filters"
          >
            {/* Account filter (agency only) */}
            {isAgencyUser && accounts.length > 0 && onAccountChange && (
              <div data-testid="filter-account">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold block mb-1">
                  Account
                </label>
                <div className="relative">
                  <select
                    value={selectedAccountId === "all" ? "all" : String(selectedAccountId)}
                    onChange={(e) =>
                      onAccountChange(
                        e.target.value === "all" ? "all" : Number(e.target.value),
                      )
                    }
                    className="w-full appearance-none h-9 pl-3 pr-8 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="select-filter-account"
                  >
                    <option value="all">All Accounts</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            )}

            {/* Campaign filter */}
            <div data-testid="filter-campaign">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold block mb-1">
                Campaign
              </label>
              <div className="relative">
                <select
                  value={selectedCampaignId === "all" ? "all" : String(selectedCampaignId)}
                  onChange={(e) =>
                    onCampaignChange(
                      e.target.value === "all" ? "all" : Number(e.target.value),
                    )
                  }
                  className="w-full appearance-none h-9 pl-3 pr-8 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="select-filter-campaign"
                >
                  <option value="all">All Campaigns</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* AI / Human state filter */}
            <div data-testid="filter-ai-state">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold block mb-1">
                Conversation handled by
              </label>
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(
                  [
                    { value: "all", label: "All", icon: LayoutList },
                    { value: "ai", label: "AI", icon: Bot },
                    { value: "human", label: "Human", icon: User },
                  ] as const
                ).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onAiStateFilterChange(value)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 h-8 text-xs font-semibold transition-colors",
                      aiStateFilter === value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/20",
                    )}
                    data-testid={`button-ai-state-${value}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Search box */}
        <div className="mt-2">
          <input
            className="h-10 w-full rounded-xl border border-border bg-muted/20 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Search contacts…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            data-testid="input-inbox-search"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" data-testid="list-inbox">
        {loading ? (
          <SkeletonList count={6} />
        ) : (
          <div className="flex flex-col">
            {displayThreads.map(({ lead, last, unread, unreadCount }) => {
              const active = selectedLeadId === lead.id;
              // Show unread count badge if thread has unread messages and hasn't been opened this session
              const showUnreadBadge = unread && !readLeadIds.has(lead.id);
              return (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => onSelectLead(lead.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 transition-colors",
                    active ? "bg-primary/5" : "hover:bg-muted/20",
                  )}
                  data-testid={`button-thread-${lead.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "h-9 w-9 rounded-full grid place-items-center text-xs font-bold border shrink-0",
                        active
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-muted/30 text-foreground border-border",
                      )}
                    >
                      {initialsFor(lead)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold truncate">
                          {lead.full_name ||
                            `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() ||
                            "Unknown"}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* AI/Human state badge */}
                          {lead.manual_takeover ? (
                            <span
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              title="Human takeover"
                            >
                              Human
                            </span>
                          ) : (
                            <span
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                              title="AI managed"
                            >
                              AI
                            </span>
                          )}
                          <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {last
                              ? new Date(last.created_at ?? last.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <div className="text-xs text-muted-foreground truncate">
                          {last ? (last.content ?? last.Content ?? "") : "No messages yet."}
                        </div>
                        {showUnreadBadge && (
                          <span
                            className="min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1 shrink-0"
                            data-testid={`badge-unread-${lead.id}`}
                            title={`${unreadCount} unread message${unreadCount !== 1 ? "s" : ""}`}
                          >
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {displayThreads.length === 0 && !loading && (
              <DataEmptyState
                variant={searchQuery ? "search" : "conversations"}
                compact
              />
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-3 text-xs text-muted-foreground shrink-0" data-testid="text-inbox-foot">
        {displayThreads.length} threads
      </div>
    </section>
  );
}
