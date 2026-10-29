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
  ShieldBan,
  CalendarClock,
  CalendarX,
  PhoneCall,
  PhoneOff,
  Newspaper,
  Reply,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationStream, notificationGroupKey } from "@/hooks/useNotificationStream";
import { setPersistedSelection } from "@/hooks/usePersistedSelection";
import { leadPath } from "@/lib/leadLink";

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

// Tones map to theme tokens only, so the panel follows dark mode.
const TONE = {
  primary: "bg-primary/10 text-primary",
  warn:    "bg-[var(--warn-tint)] text-[var(--warn)]",
  danger:  "bg-destructive/10 text-destructive",
  success: "bg-success/10 text-success",
  muted:   "bg-muted text-muted-foreground",
} as const;

const TYPE_CONFIG: Record<string, { icon: typeof Bell; tone: keyof typeof TONE }> = {
  // ── Granular types (from SSE backend) ──────────────────────────────────
  task_assigned:               { icon: ClipboardList, tone: "primary" },
  task_due_soon:               { icon: Clock,         tone: "warn" },
  task_overdue:                { icon: AlertTriangle, tone: "danger" },
  booking_confirmed:           { icon: CalendarCheck, tone: "success" },
  booking_reminder:            { icon: Clock,         tone: "warn" },
  lead_responded:              { icon: MessageSquare, tone: "primary" },
  lead_manual_takeover:        { icon: Hand,          tone: "warn" },
  critical_automation_failure: { icon: AlertOctagon,  tone: "danger" },
  campaign_finished:           { icon: Flag,          tone: "success" },
  voice_abuse:                 { icon: ShieldBan,     tone: "danger" },
  // Client alerts (specs/client-recaps)
  booking_rescheduled:         { icon: CalendarClock, tone: "warn" },
  booking_cancelled:           { icon: CalendarX,     tone: "danger" },
  callback_requested:          { icon: PhoneCall,     tone: "warn" },
  daily_recap:                 { icon: Newspaper,     tone: "primary" },
  client_reply:                { icon: Reply,         tone: "primary" },
  // A question the AI's knowledge base does not answer (light, bell only)
  unanswered_question:         { icon: HelpCircle,    tone: "muted" },
  // A caller hung up right after the opener (opt-in alert, light, bell only)
  caller_hung_up:              { icon: PhoneOff,      tone: "muted" },

  // ── Legacy broad types (existing API) ──────────────────────────────────
  message:    { icon: MessageSquare, tone: "primary" },
  takeover:   { icon: Hand,          tone: "warn" },
  booking:    { icon: Phone,         tone: "success" },
  campaign:   { icon: Flag,          tone: "success" },
  task:       { icon: ClipboardList, tone: "primary" },
  system:     { icon: Info,          tone: "muted" },
  escalation: { icon: Headphones,    tone: "warn" },
  automation: { icon: Workflow,      tone: "danger" },
};

// Identical notifications (same type, title and link) inside one day group
// collapse into a single row with a count, newest first.
interface NotificationRow {
  head: Notification;
  ids: number[];
  unreadIds: number[];
}

function collapseDuplicates(items: Notification[]): NotificationRow[] {
  const rows = new Map<string, NotificationRow>();
  for (const n of items) {
    const key = `${notificationGroupKey(n)}::${n.link ?? ""}`;
    const row = rows.get(key);
    if (row) {
      row.ids.push(n.id);
      if (isUnread(n)) row.unreadIds.push(n.id);
    } else {
      rows.set(key, { head: n, ids: [n.id], unreadIds: isUnread(n) ? [n.id] : [] });
    }
  }
  return Array.from(rows.values());
}

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
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "messages" | "tasks" | "bookings" | "system">("all");

  // ── SSE hook (real-time notifications via SSE + polling) ───────────────
  // live: false, CrmShell owns the SSE stream and the toasts; this reads the shared cache.
  const stream = useNotificationStream({ live: false });

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
    booking_reminder: "bookings",
    booking_rescheduled: "bookings",
    booking_cancelled: "bookings",
    callback_requested: "messages",
    caller_hung_up: "messages",
    client_reply: "messages",
    unanswered_question: "messages",
    daily_recap: "system",
    campaign: "system",
    campaign_finished: "system",
    system: "system",
    escalation: "system",
    automation: "system",
    critical_automation_failure: "system",
    voice_abuse: "system",
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
  const handleDelete = useCallback((e: React.MouseEvent, ids: number[]) => {
    e.stopPropagation();
    ids.forEach((id) => stream.deleteNotification(id));
  }, [stream]);

  // ── Delete all notifications ───────────────────────────────────────────
  const handleDeleteAll = useCallback(() => {
    stream.deleteAllNotifications();
  }, [stream]);

  // ── Click handler ───────────────────────────────────────────────────────
  const handleNotificationClick = useCallback((n: Notification, unreadIds: number[] = isUnread(n) ? [n.id] : []) => {
    // Mark as read (every collapsed duplicate too)
    unreadIds.forEach((id) => handleMarkAsRead(id));
    onClose();

    // A lead-scoped notification always preselects the lead, regardless of
    // which page the link ultimately points to (leads, calendar, etc.). Uses
    // setPersistedSelection (not a raw localStorage write) so pages already
    // mounted on-screen pick up the new selection immediately, not just on
    // a fresh navigation.
    if (n.leadId) {
      setPersistedSelection("selected-lead-id", n.leadId);
    }

    if (n.link) {
      // Some notifications (from the automations engine, including older rows
      // created before the link format was fixed) encode an id as a path segment
      // or query param — no such routes exist, they're deep links into the list
      // page's persisted selection instead.
      const rawPath = n.link.replace(/^\/platform/, "");
      const idPatterns: { re: RegExp; entity: "leads" | "tasks" | "campaigns" }[] = [
        { re: /^\/leads\/(\d+)$/, entity: "leads" },
        { re: /^\/(?:conversations|chat)\?lead=(\d+)$/, entity: "leads" },
        { re: /^\/tasks\/(\d+)$/, entity: "tasks" },
        { re: /^\/campaigns\/(\d+)$/, entity: "campaigns" },
      ];
      const matched = idPatterns
        .map(({ re, entity }) => ({ entity, match: rawPath.match(re) }))
        .find(({ match }) => match);
      if (matched) {
        setPersistedSelection(`selected-${matched.entity.slice(0, -1)}-id`, matched.match![1]);
        // A lead opens in its one home: Chats with the lead selected.
        setLocation(matched.entity === "leads" ? leadPath(matched.match![1]) : `/platform/${matched.entity}`);
        return;
      }
      // The engine links lead events to the retired /leads page: open the lead itself.
      if (n.leadId && rawPath === "/leads") {
        setLocation(leadPath(n.leadId));
        return;
      }
      // A booking made on a phone call links to that call (client alerts).
      const call = rawPath.match(/^\/voice-calls\?call=([^&#]+)$/);
      if (call) {
        setPersistedSelection("selected-voice-call-id", decodeURIComponent(call[1]));
        setLocation("/platform/voice-calls");
        return;
      }
      // Legacy typo: old "critical_automation_failure" rows link to "/automations"
      if (rawPath === "/automations") {
        setLocation("/platform/automation-logs");
        return;
      }
      const dest = n.link.startsWith("/platform") ? n.link : `/platform${n.link}`;
      setLocation(dest);
    } else if (n.leadId) {
      // No explicit link: open the lead in its one home.
      setLocation(leadPath(n.leadId));
    }
  }, [handleMarkAsRead, onClose, setLocation]);

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
                  className="text-xs text-primary hover:text-primary/80 font-medium transition-colors duration-150 disabled:opacity-50"
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
                className="text-xs text-muted-foreground hover:text-destructive font-medium transition-colors duration-150"
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
                "relative h-7 px-3 rounded-full text-xs font-medium border transition-[background-color,color,border-color] duration-150",
                filter === f
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              {f === "all" ? t("notifications.all") : t("notifications.unread")}
              {f === "unread" && unreadCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tabular-nums">
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
                "h-6 px-2.5 rounded-full text-[11px] font-medium border transition-[background-color,color,border-color] duration-150",
                typeFilter === tf
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60"
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
              <div className="absolute inset-0 rounded-full border-2 border-primary/10" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
            </div>
            <span className="text-xs text-muted-foreground/60">{t("notifications.loading", "Loading...")}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
            <div className="relative mb-4">
              <div className="h-12 w-12 rounded-[var(--r-card)] bg-muted flex items-center justify-center">
                <BellOff className="h-5 w-5 text-muted-foreground/60" />
              </div>
            </div>
            <p className="text-sm font-semibold text-foreground/80">{t("notifications.allCaughtUp")}</p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px] leading-relaxed">
              {filter === "unread" ? t("notifications.noUnread") : t("notifications.noNotifications")}
            </p>
          </div>
        ) : (
          <div className="px-2 pb-2">
            {grouped.map(({ group, items: groupItems }) => (
              <div key={group}>
                {/* Group header */}
                <div className="px-2 pt-3 pb-1.5 flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground/70">
                    {group === "Today" ? t("time.today")
                      : group === "Yesterday" ? t("time.yesterday")
                      : group === "This Week" ? t("time.thisWeek")
                      : t("notifications.older")}
                  </span>
                  <div className="flex-1 h-px bg-border/30" />
                </div>

                {/* Rows (identical notifications collapsed, see collapseDuplicates) */}
                <div className="flex flex-col gap-1">
                <AnimatePresence initial={false}>
                {collapseDuplicates(groupItems).map(({ head: n, ids, unreadIds }) => {
                  const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
                  const Icon = config.icon;
                  const isClickable = !!(n.link || n.leadId);
                  const unread = unreadIds.length > 0;

                  return (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleNotificationClick(n, unreadIds)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNotificationClick(n, unreadIds); }}
                      className={cn(
                        "group relative w-full text-left px-2.5 py-2.5 min-h-[44px] flex items-start gap-3 rounded-[var(--r-surface)]",
                        "transition-[background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        unread ? "bg-primary/[0.04]" : "",
                        isClickable
                          ? "hover:bg-muted/60 active:bg-muted cursor-pointer"
                          : "cursor-default"
                      )}
                      data-testid={`card-notification-${n.id}`}
                    >
                      {/* Icon */}
                      <div className={cn(
                        "h-9 w-9 rounded-[var(--r-surface)] flex items-center justify-center shrink-0",
                        TONE[config.tone],
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={cn(
                              "text-sm leading-snug truncate",
                              unread ? "font-semibold text-foreground" : "font-medium text-foreground/70"
                            )}
                            data-testid={`text-notification-title-${n.id}`}
                          >
                            {n.title}
                          </span>
                          {ids.length > 1 && (
                            <span className="shrink-0 rounded-full bg-muted px-1.5 py-px font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                              {ids.length}&times;
                            </span>
                          )}
                        </div>
                        {n.body && (
                          <p
                            className={cn(
                              "text-xs line-clamp-2 leading-relaxed mt-0.5",
                              unread ? "text-muted-foreground" : "text-muted-foreground/70"
                            )}
                            data-testid={`text-notification-desc-${n.id}`}
                          >
                            {n.body}
                          </p>
                        )}
                        <span
                          className="block text-[11px] text-muted-foreground/60 mt-1 tabular-nums"
                          data-testid={`text-notification-at-${n.id}`}
                        >
                          {timeAgo(n.createdAt, t)}
                        </span>
                      </div>

                      {/* Unread dot, swaps for delete on hover (desktop) */}
                      <div className="shrink-0 flex items-center justify-center h-9 w-7">
                        {unread && (
                          <span className="hidden md:block h-2 w-2 rounded-full bg-primary md:group-hover:hidden" aria-hidden />
                        )}
                        <button
                          onClick={(e) => handleDelete(e, ids)}
                          className={cn(
                            "p-1.5 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-[color,background-color,opacity] duration-150 focus:opacity-100",
                            unread ? "md:hidden md:group-hover:block" : "md:opacity-0 md:group-hover:opacity-100"
                          )}
                          aria-label={t("notifications.delete")}
                          data-testid={`button-delete-notification-${n.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
                </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
