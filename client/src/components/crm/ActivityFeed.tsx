import { useCallback } from "react";
import { useLocation } from "wouter";
import {
  MessageSquare,
  Send,
  Phone,
  ArrowRight,
  Bot,
  UserCheck,
  Activity,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useActivityFeed,
  type ActivityItem,
  type ActivityIcon,
} from "@/hooks/useActivityFeed";
import { useWorkspace } from "@/hooks/useWorkspace";

/* ─── Icon mapping ─────────────────────────────────────────────── */

const ICON_CONFIG: Record<
  ActivityIcon,
  { icon: typeof MessageSquare; color: string; bg: string }
> = {
  message: {
    icon: MessageSquare,
    color: "text-brand-indigo",
    bg: "bg-brand-indigo/10",
  },
  phone: {
    icon: Phone,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  bot: {
    icon: Bot,
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  user: {
    icon: UserCheck,
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  arrow: {
    icon: ArrowRight,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
};

/** Refine the icon based on event type for more precision */
function getIconForItem(item: ActivityItem) {
  if (item.type === "message_sent" && item.icon !== "bot") {
    return { icon: Send, color: "text-muted-foreground", bg: "bg-muted/60" };
  }
  if (item.type === "status_change" && item.title.includes("Lost")) {
    return { icon: ArrowRight, color: "text-red-500", bg: "bg-red-50" };
  }
  return ICON_CONFIG[item.icon] ?? ICON_CONFIG.message;
}

/* ─── Skeleton loader ──────────────────────────────────────────── */

function ActivityFeedSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
        >
          <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5 pt-0.5">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <Skeleton className="h-3 w-8 shrink-0 mt-1" />
        </div>
      ))}
    </div>
  );
}

/* ─── Empty state ──────────────────────────────────────────────── */

function ActivityFeedEmpty({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-12 px-6",
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted mb-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">
        No recent activity
      </p>
      <p className="text-xs text-muted-foreground max-w-[240px] mt-1">
        Activity from the last 7 days will appear here as leads interact with
        your campaigns.
      </p>
    </div>
  );
}

/* ─── Single activity row ──────────────────────────────────────── */

function ActivityRow({
  item,
  compact,
  onClick,
}: {
  item: ActivityItem;
  compact?: boolean;
  onClick?: () => void;
}) {
  const iconCfg = getIconForItem(item);
  const Icon = iconCfg.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-start gap-2.5 bg-white/90 dark:bg-card/90 rounded-xl transition-colors",
        compact ? "px-2 py-1.5" : "px-2.5 py-2",
        "hover:bg-white dark:hover:bg-card",
        onClick && "cursor-pointer",
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "shrink-0 flex items-center justify-center rounded-lg",
          compact ? "h-7 w-7" : "h-8 w-8",
          iconCfg.bg,
        )}
      >
        <Icon className={cn("h-4 w-4", iconCfg.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "font-medium text-foreground leading-snug truncate",
            compact ? "text-[12px]" : "text-[13px]",
          )}
        >
          {item.title}
        </p>
        {item.description && (
          <p
            className={cn(
              "text-muted-foreground truncate mt-0.5",
              compact ? "text-[11px]" : "text-[12px]",
            )}
          >
            {item.description}
          </p>
        )}
      </div>

      {/* Timestamp */}
      <span
        className={cn(
          "text-muted-foreground tabular-nums shrink-0 mt-0.5",
          compact ? "text-[10px]" : "text-[11px]",
        )}
      >
        {relativeTime(item.timestamp)}
      </span>
    </button>
  );
}

/* ─── Pagination bar ───────────────────────────────────────────── */

function PaginationBar({
  page,
  totalPages,
  total,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="shrink-0 flex items-center justify-between pt-2 border-t border-border/20 mt-1">
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 1}
        className="icon-circle-lg icon-circle-base disabled:opacity-30 disabled:pointer-events-none"
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-[11px] font-medium text-muted-foreground tabular-nums select-none">
        {page} / {totalPages}
        <span className="text-muted-foreground/50 ml-1.5">({total})</span>
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={page >= totalPages}
        className="icon-circle-lg icon-circle-base disabled:opacity-30 disabled:pointer-events-none"
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ─── Main component ───────────────────────────────────────────── */

export interface ActivityFeedProps {
  accountId?: number;
  className?: string;
  compact?: boolean;
}

export function ActivityFeed({
  accountId,
  className,
  compact = false,
}: ActivityFeedProps) {
  const [, setLocation] = useLocation();
  const { isAgencyUser } = useWorkspace();

  const { items, total, totalPages, page, loading, error, nextPage, prevPage } =
    useActivityFeed({
      accountId,
      pageSize: 25,
      enabled: true,
    });

  const handleItemClick = useCallback(
    (item: ActivityItem) => {
      if (!item.leadId) return;
      const prefix = isAgencyUser ? "/agency" : "/subaccount";
      try { localStorage.setItem("selected-lead-id", String(item.leadId)); } catch {}
      setLocation(`${prefix}/leads`);
    },
    [isAgencyUser, setLocation],
  );

  if (loading) {
    return (
      <div className={cn("flex flex-col", className)}>
        <ActivityFeedSkeleton count={compact ? 4 : 6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center justify-center py-8 px-4", className)}>
        <p className="text-xs text-muted-foreground">
          Could not load activity feed.
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={cn("flex flex-col", className)}>
        <ActivityFeedEmpty compact={compact} />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Scrollable items */}
      <div className="overflow-y-auto space-y-1 flex-1 min-h-0">
        {items.map((item, i) => (
          <ActivityRow
            key={`${item.type}-${item.leadId}-${item.timestamp}-${i}`}
            item={item}
            compact={compact}
            onClick={item.leadId ? () => handleItemClick(item) : undefined}
          />
        ))}
      </div>

      {/* Pagination — moved to bottom */}
      {total > 25 && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          onPrev={prevPage}
          onNext={nextPage}
        />
      )}
    </div>
  );
}
