import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  MessageSquare,
  AlertTriangle,
  AlertOctagon,
  Phone,
  Flag,
  Clock,
  ClipboardList,
  CalendarCheck,
  Hand,
  Info,
  Check,
  BellOff,
  Headphones,
  Workflow,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useNotificationStream } from "@/hooks/useNotificationStream";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  leadId?: number | null;
  userId?: number;
  accountId?: number | null;
  read?: boolean;
  link: string | null;
  createdAt: string;
}

function isUnread(n: Notification): boolean {
  return !n.read;
}

// ─── Icon map ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bgColor: string; borderColor: string }> = {
  // ── New granular types (from SSE backend) ──────────────────────────────
  task_assigned:                { icon: ClipboardList,  color: "text-brand-indigo",       bgColor: "bg-brand-indigo/10",  borderColor: "border-l-brand-indigo" },
  task_due_soon:                { icon: Clock,          color: "text-amber-500",          bgColor: "bg-amber-500/10",     borderColor: "border-l-amber-500" },
  task_overdue:                 { icon: AlertTriangle,  color: "text-red-500",            bgColor: "bg-red-500/10",       borderColor: "border-l-red-500" },
  booking_confirmed:            { icon: CalendarCheck,  color: "text-[#FCB803]",          bgColor: "bg-[#FCB803]/10",     borderColor: "border-l-[#FCB803]" },
  lead_responded:               { icon: MessageSquare,  color: "text-brand-indigo",       bgColor: "bg-brand-indigo/10",  borderColor: "border-l-brand-indigo" },
  lead_manual_takeover:         { icon: Hand,           color: "text-orange-500",         bgColor: "bg-orange-500/10",    borderColor: "border-l-orange-500" },
  critical_automation_failure:  { icon: AlertOctagon,   color: "text-rose-600",           bgColor: "bg-rose-500/10",      borderColor: "border-l-rose-600" },
  campaign_finished:            { icon: Flag,           color: "text-emerald-500",        bgColor: "bg-emerald-500/10",   borderColor: "border-l-emerald-500" },

  // ── Legacy broad types (existing API) ──────────────────────────────────
  message:    { icon: MessageSquare,  color: "text-brand-indigo",       bgColor: "bg-brand-indigo/10",  borderColor: "border-l-brand-indigo" },
  takeover:   { icon: Hand,           color: "text-orange-500",         bgColor: "bg-orange-500/10",    borderColor: "border-l-orange-500" },
  booking:    { icon: Phone,          color: "text-[#FCB803]",          bgColor: "bg-[#FCB803]/10",     borderColor: "border-l-[#FCB803]" },
  campaign:   { icon: Flag,           color: "text-emerald-500",        bgColor: "bg-emerald-500/10",   borderColor: "border-l-emerald-500" },
  task:       { icon: ClipboardList,  color: "text-brand-indigo",       bgColor: "bg-brand-indigo/10",  borderColor: "border-l-brand-indigo" },
  system:     { icon: Info,           color: "text-muted-foreground",   bgColor: "bg-muted/30",         borderColor: "border-l-muted-foreground/40" },
  escalation: { icon: Headphones,     color: "text-orange-600",         bgColor: "bg-orange-100/60",    borderColor: "border-l-orange-600" },
  automation: { icon: Workflow,       color: "text-rose-500",           bgColor: "bg-rose-500/10",      borderColor: "border-l-rose-500" },
};

// ─── Time helpers ──────────────────────────────────────────────────────────

function timeAgo(dateStr: string, t: TFunction): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return t("time.justNow");
  if (diffMin < 60) return t("time.minutesAgo", { count: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t("time.hoursAgo", { count: diffHr });
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return t("time.yesterday");
  if (diffDay < 7) return t("time.daysAgo", { count: diffDay });
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
    const g = getTimeGroup(n.createdAt);
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
  const { t } = useTranslation("crm");
  const [, setLocation] = useLocation();
  const { isAgencyView } = useWorkspace();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "messages" | "tasks" | "bookings" | "system">("all");

  // ── SSE hook (real-time notifications via SSE + polling) ───────────────
  const stream = useNotificationStream();

  // ── Data from SSE hook ─────────────────────────────────────────────────
  const allItems = stream.notifications;
  const isLoading = false; // Hook handles its own fetching; empty state shown naturally

  // Type filter mapping: which notification types belong to each category
  const TYPE_FILTER_MAP: Record<string, "messages" | "tasks" | "bookings" | "system"> = {
    message: "messages",
    lead_responded: "messages",
    takeover: "messages",
    lead_manual_takeover: "messages",
    task: "tasks",
    task_assigned: "tasks",
    task_due_soon: "tasks",
    task_overdue: "tasks",
    booking: "bookings",
    booking_confirmed: "bookings",
    campaign: "system",
    campaign_finished: "system",
    system: "system",
    escalation: "system",
    automation: "system",
    critical_automation_failure: "system",
  };

  // Client-side filter + cap at 50 items
  const items = useMemo(() => {
    const limited = allItems.slice(0, 50);
    let filtered = limited;
    if (filter === "unread") filtered = filtered.filter(n => isUnread(n));
    if (typeFilter !== "all") {
      filtered = filtered.filter(n => (TYPE_FILTER_MAP[n.type] || "system") === typeFilter);
    }
    return filtered;
  }, [allItems, filter, typeFilter]);

  const unreadCount = stream.unreadCount;

  // Push unread count to parent
  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [unreadCount, onUnreadCountChange]);

  // ── Mark single as read ─────────────────────────────────────────────────
  const handleMarkAsRead = useCallback((id: number) => {
    stream.markAsRead(id);
  }, [stream]);

  // ── Mark all as read ────────────────────────────────────────────────────
  const handleMarkAllAsRead = useCallback(() => {
    stream.markAllAsRead();
  }, [stream]);

  // ── Delete notification ───────────────────────────────────────────────
  const handleDelete = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    stream.deleteNotification(id);
  }, [stream]);

  // ── Delete all notifications ───────────────────────────────────────────
  const handleDeleteAll = useCallback(() => {
    stream.deleteAllNotifications();
  }, [stream]);

  // ── Click handler ───────────────────────────────────────────────────────
  const handleNotificationClick = useCallback((n: Notification) => {
    // Mark as read
    if (isUnread(n)) {
      handleMarkAsRead(n.id);
    }
    // Navigate if there's a link
    if (n.link) {
      onClose();
      setLocation(n.link);
    } else if (n.leadId) {
      // Default: navigate to leads with the lead preselected
      sessionStorage.setItem("pendingLeadId", String(n.leadId));
      onClose();
      const base = isAgencyView ? "/agency" : "/subaccount";
      setLocation(`${base}/leads`);
    }
  }, [handleMarkAsRead, onClose, setLocation, isAgencyView]);

  const grouped = useMemo(() => groupNotifications(items), [items]);

  return (
    <div className="flex flex-col">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 border-b border-border/30">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold tracking-tight" data-testid="text-notifications-title">
            {t("notifications.title")}
          </span>
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  onClick={handleMarkAllAsRead}
                  disabled={false}
                  className="text-xs text-brand-indigo hover:text-brand-indigo/80 font-medium transition-colors duration-150 disabled:opacity-50"
                  data-testid="button-mark-all-read"
                >
                  <div className="flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    {t("notifications.markAllRead")}
                  </div>
                </motion.button>
              )}
            </AnimatePresence>
            {allItems.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="text-xs text-muted-foreground hover:text-red-500 font-medium transition-colors duration-150"
                data-testid="button-clear-all"
              >
                <div className="flex items-center gap-1">
                  <Trash2 className="h-3 w-3" />
                  {t("notifications.clearAll")}
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 pt-2.5">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "relative h-7 px-3 rounded-full text-xs font-medium transition-all duration-200",
                filter === f
                  ? "bg-brand-indigo/10 text-brand-indigo border border-brand-indigo/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              {f === "all" ? t("notifications.all") : t("notifications.unread")}
              {f === "unread" && unreadCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-brand-indigo text-white text-[10px] font-bold tabular-nums">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Type filter chips */}
        <div className="flex items-center gap-1 pt-2 flex-wrap">
          {(["all", "messages", "tasks", "bookings", "system"] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTypeFilter(tf)}
              className={cn(
                "h-6 px-2.5 rounded-full text-[11px] font-medium transition-all duration-200",
                typeFilter === tf
                  ? "bg-brand-indigo/10 text-brand-indigo border border-brand-indigo/20"
                  : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/40"
              )}
            >
              {tf === "all" ? t("notifications.filterAll")
                : tf === "messages" ? t("notifications.filterMessages")
                : tf === "tasks" ? t("notifications.filterTasks")
                : tf === "bookings" ? t("notifications.filterBookings")
                : t("notifications.filterSystem")}
            </button>
          ))}
        </div>

        {/* Showing latest count */}
        {allItems.length >= 50 && (
          <p className="text-[11px] text-muted-foreground/50 pt-1.5">
            {t("notifications.showingLatest", { count: 50 })}
          </p>
        )}
      </div>

      {/* ── List ── */}
      <div className="md:max-h-[640px] md:overflow-y-auto" data-testid="list-notifications">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 rounded-full border-2 border-brand-indigo/10" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-indigo animate-spin" />
            </div>
            <span className="text-xs text-muted-foreground/60">{t("notifications.loading", "Loading...")}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
            <div className="relative mb-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-muted/80 to-muted/30 flex items-center justify-center border border-border/20">
                <BellOff className="h-6 w-6 text-muted-foreground/40" />
              </div>
              {/* Subtle decorative ring */}
              <div className="absolute -inset-1.5 rounded-[18px] border border-dashed border-border/20 pointer-events-none" />
            </div>
            <p className="text-sm font-semibold text-foreground/80">{t("notifications.allCaughtUp")}</p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px] leading-relaxed">
              {filter === "unread" ? t("notifications.noUnread") : t("notifications.noNotifications")}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {grouped.map(({ group, items: groupItems }, groupIdx) => (
              <div key={group}>
                {/* Group header */}
                <div className="px-4 pt-3 pb-1.5 flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                    {group === "Today" ? t("time.today")
                      : group === "Yesterday" ? t("time.yesterday")
                      : group === "This Week" ? t("time.thisWeek")
                      : t("notifications.older")}
                  </span>
                  <div className="flex-1 h-px bg-border/20" />
                </div>

                {/* Items */}
                <AnimatePresence initial={false}>
                {groupItems.map((n, itemIdx) => {
                  const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
                  const Icon = config.icon;
                  const isClickable = !!(n.link || n.leadId);

                  return (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                      transition={{ duration: 0.2, delay: Math.min((groupIdx * 3 + itemIdx) * 0.03, 0.3) }}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleNotificationClick(n)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNotificationClick(n); }}
                      className={cn(
                        "group w-full text-left px-4 py-3 min-h-[44px] flex items-start gap-3",
                        "border-l-2 transition-all duration-200",
                        isClickable
                          ? "hover:bg-muted/30 active:bg-muted/40 cursor-pointer"
                          : "cursor-default",
                        isUnread(n)
                          ? cn("bg-brand-indigo/[0.05]", config.borderColor)
                          : "border-l-transparent"
                      )}
                      data-testid={`card-notification-${n.id}`}
                    >
                      {/* Icon */}
                      <div className={cn(
                        "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-transform duration-150",
                        config.bgColor,
                        isClickable && "group-hover:scale-105"
                      )}>
                        <Icon className={cn("h-4 w-4", config.color)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <span
                            className={cn(
                              "text-sm leading-snug line-clamp-1",
                              isUnread(n) ? "font-semibold text-foreground" : "font-normal text-foreground/75"
                            )}
                            data-testid={`text-notification-title-${n.id}`}
                          >
                            {n.title}
                          </span>
                          {isUnread(n) && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="h-2 w-2 rounded-full bg-brand-indigo shrink-0 mt-1.5 shadow-[0_0_6px_rgba(99,102,241,0.4)]"
                              aria-label="Unread"
                            />
                          )}
                        </div>
                        {n.body && (
                          <p
                            className={cn(
                              "text-xs mt-0.5 line-clamp-2 leading-relaxed",
                              isUnread(n) ? "text-muted-foreground" : "text-muted-foreground/60"
                            )}
                            data-testid={`text-notification-desc-${n.id}`}
                          >
                            {n.body}
                          </p>
                        )}
                        <span
                          className="text-[11px] text-muted-foreground/50 mt-1 block tabular-nums"
                          data-testid={`text-notification-at-${n.id}`}
                        >
                          {timeAgo(n.createdAt, t)}
                        </span>
                      </div>

                      {/* Delete button — always visible on mobile, hover on desktop */}
                      <button
                        onClick={(e) => handleDelete(e, n.id)}
                        className="shrink-0 mt-0.5 p-1.5 rounded-md text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                        aria-label={t("notifications.delete")}
                        data-testid={`button-delete-notification-${n.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  );
                })}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
