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
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

/* ─── Relative timestamp ───────────────────────────────────────── */

function relativeTime(isoString: string | null): string {
  if (!isoString) return "";
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return "just now";

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
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
        "w-full text-left flex items-start gap-3 rounded-lg transition-colors",
        compact ? "px-2.5 py-2" : "px-3 py-2.5",
        "hover:bg-card hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)]",
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

/* ─── Main component ───────────────────────────────────────────── */

export interface ActivityFeedProps {
  accountId?: number;
  limit?: number;
  className?: string;
  compact?: boolean;
}

export function ActivityFeed({
  accountId,
  limit = 50,
  className,
  compact = false,
}: ActivityFeedProps) {
  const [, setLocation] = useLocation();
  const { isAgencyUser } = useWorkspace();

  const { items, hasMore, loading, loadingMore, error, loadMore } =
    useActivityFeed({
      accountId,
      limit,
      enabled: true,
    });

  const handleItemClick = useCallback(
    (item: ActivityItem) => {
      if (!item.leadId) return;
      const prefix = isAgencyUser ? "/agency" : "/subaccount";
      setLocation(`${prefix}/leads?leadId=${item.leadId}`);
    },
    [isAgencyUser, setLocation],
  );

  if (loading) {
    return (
      <div className={cn("", className)}>
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
      <div className={className}>
        <ActivityFeedEmpty compact={compact} />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Items */}
      <div className="space-y-0.5">
        {items.map((item, i) => (
          <ActivityRow
            key={`${item.type}-${item.leadId}-${item.timestamp}-${i}`}
            item={item}
            compact={compact}
            onClick={item.leadId ? () => handleItemClick(item) : undefined}
          />
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2 pb-1">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className={cn(
              "h-8 px-4 rounded-full text-[12px] font-medium",
              "text-muted-foreground hover:text-foreground hover:bg-card",
              "transition-colors inline-flex items-center gap-1.5",
              "disabled:opacity-50",
            )}
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </>
            ) : (
              "Load more"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
