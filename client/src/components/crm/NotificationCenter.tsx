import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { apiRequest } from "@/lib/queryClient";
import {
  X,
  Bell,
  MessageSquare,
  AlertTriangle,
  Phone,
  Flag,
  CheckSquare,
  Info,
  Check,
  BellOff,
  Headphones,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  lead_id: number | null;
  user_id: number;
  account_id: number | null;
  read: boolean;
  link: string | null;
  created_at: string;
}

interface NotificationsResponse {
  items: Notification[];
  unreadCount: number;
  totalCount: number;
}

// ─── Icon map ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bgColor: string }> = {
  message:  { icon: MessageSquare,  color: "text-brand-indigo",       bgColor: "bg-brand-indigo/10" },
  takeover: { icon: AlertTriangle,  color: "text-orange-500",         bgColor: "bg-orange-500/10" },
  booking:  { icon: Phone,          color: "text-[#FCB803]",          bgColor: "bg-[#FCB803]/10" },
  campaign: { icon: Flag,           color: "text-emerald-500",        bgColor: "bg-emerald-500/10" },
  task:     { icon: CheckSquare,    color: "text-brand-indigo",       bgColor: "bg-brand-indigo/10" },
  system:     { icon: Info,           color: "text-muted-foreground",   bgColor: "bg-muted/30" },
  escalation: { icon: Headphones,    color: "text-orange-600",         bgColor: "bg-orange-100/60" },
};

// ─── Time helpers ──────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

type TimeGroup = "Today" | "Yesterday" | "This Week" | "Older";

function getTimeGroup(dateStr: string): TimeGroup {
  const now = new Date();
  const d = new Date(dateStr);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const weekStart = new Date(todayStart.getTime() - 6 * 86_400_000);

  if (d >= todayStart) return "Today";
  if (d >= yesterdayStart) return "Yesterday";
  if (d >= weekStart) return "This Week";
  return "Older";
}

function groupNotifications(items: Notification[]): { group: TimeGroup; items: Notification[] }[] {
  const order: TimeGroup[] = ["Today", "Yesterday", "This Week", "Older"];
  const map = new Map<TimeGroup, Notification[]>();
  for (const g of order) map.set(g, []);
  for (const n of items) {
    const g = getTimeGroup(n.created_at);
    map.get(g)!.push(n);
  }
  return order.filter(g => map.get(g)!.length > 0).map(g => ({ group: g, items: map.get(g)! }));
}

// ─── Component ─────────────────────────────────────────────────────────────

export function NotificationCenter({
  open,
  onClose,
  onUnreadCountChange,
}: {
  open: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}) {
  const [, setLocation] = useLocation();
  const { isAgencyView } = useWorkspace();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  // ── Fetch notifications ─────────────────────────────────────────────────
  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["/api/notifications", filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (filter === "unread") params.set("unread", "true");
      const res = await apiFetch(`/api/notifications?${params}`);
      if (!res.ok) return { items: [], unreadCount: 0, totalCount: 0 };
      return res.json() as Promise<NotificationsResponse>;
    },
    refetchInterval: open ? 30_000 : false,
    staleTime: 15_000,
    enabled: open,
  });

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  // Push unread count to parent
  useEffect(() => {
    if (onUnreadCountChange && data) {
      onUnreadCountChange(data.unreadCount);
    }
  }, [data?.unreadCount, onUnreadCountChange]);

  // ── Mark single as read ─────────────────────────────────────────────────
  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
    },
  });

  // ── Mark all as read ────────────────────────────────────────────────────
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
    },
  });

  // ── Click handler ───────────────────────────────────────────────────────
  const handleNotificationClick = useCallback((n: Notification) => {
    // Mark as read
    if (!n.read) {
      markReadMutation.mutate(n.id);
    }
    // Navigate if there's a link
    if (n.link) {
      onClose();
      setLocation(n.link);
    } else if (n.lead_id) {
      // Default: navigate to leads with the lead preselected
      sessionStorage.setItem("pendingLeadId", String(n.lead_id));
      onClose();
      const base = isAgencyView ? "/agency" : "/subaccount";
      setLocation(`${base}/leads`);
    }
  }, [markReadMutation, onClose, setLocation, isAgencyView]);

  const grouped = useMemo(() => groupNotifications(items), [items]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-[400px] sm:max-w-[400px] p-0 flex flex-col gap-0 bg-popover"
      >
        <SheetHeader className="px-5 pt-5 pb-3 space-y-0 border-b border-border/30">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-semibold" data-testid="text-notifications-title">
              Notifications
            </SheetTitle>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="text-xs text-brand-indigo hover:text-brand-indigo/80 font-medium transition-colors disabled:opacity-50"
                data-testid="button-mark-all-read"
              >
                <div className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Mark all read
                </div>
              </button>
            )}
          </div>
          <SheetDescription className="sr-only">Notification center</SheetDescription>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 pt-2.5">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "h-7 px-3 rounded-full text-xs font-medium transition-colors",
                filter === "all"
                  ? "bg-card border border-border/55 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={cn(
                "h-7 px-3 rounded-full text-xs font-medium transition-colors",
                filter === "unread"
                  ? "bg-card border border-border/55 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              Unread
              {unreadCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-brand-indigo text-white text-[10px] font-bold">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          </div>
        </SheetHeader>

        {/* ── List ── */}
        <div className="flex-1 overflow-y-auto" data-testid="list-notifications">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-5 w-5 border-2 border-brand-indigo/30 border-t-brand-indigo rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <BellOff className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground/80">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">
                {filter === "unread" ? "No unread notifications." : "No notifications yet."}
              </p>
            </div>
          ) : (
            <div className="py-1">
              {grouped.map(({ group, items: groupItems }) => (
                <div key={group}>
                  {/* Group header */}
                  <div className="px-5 pt-3 pb-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                      {group}
                    </span>
                  </div>

                  {/* Items */}
                  {groupItems.map((n) => {
                    const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
                    const Icon = config.icon;
                    const isClickable = !!(n.link || n.lead_id);

                    return (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={cn(
                          "w-full text-left px-5 py-3 flex items-start gap-3 transition-colors",
                          isClickable
                            ? "hover:bg-muted/30 cursor-pointer"
                            : "cursor-default",
                          !n.read && "bg-brand-indigo/[0.03]"
                        )}
                        data-testid={`card-notification-${n.id}`}
                      >
                        {/* Icon */}
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                          config.bgColor
                        )}>
                          <Icon className={cn("h-4 w-4", config.color)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <span
                              className={cn(
                                "text-sm leading-snug line-clamp-1",
                                !n.read ? "font-semibold text-foreground" : "font-medium text-foreground/80"
                              )}
                              data-testid={`text-notification-title-${n.id}`}
                            >
                              {n.title}
                            </span>
                            {!n.read && (
                              <span
                                className="h-2 w-2 rounded-full bg-brand-indigo shrink-0 mt-1.5"
                                aria-label="Unread"
                              />
                            )}
                          </div>
                          {n.body && (
                            <p
                              className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed"
                              data-testid={`text-notification-desc-${n.id}`}
                            >
                              {n.body}
                            </p>
                          )}
                          <span
                            className="text-[11px] text-muted-foreground/60 mt-1 block"
                            data-testid={`text-notification-at-${n.id}`}
                          >
                            {timeAgo(n.created_at)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
