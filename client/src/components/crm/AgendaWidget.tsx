import { useMemo, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  CalendarCheck, Phone, Check, Calendar, Mail,
  X, AlertTriangle,
} from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getInitials, getLeadStatusAvatarColor } from "@/lib/avatarUtils";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type LeadRow = Record<string, any>;

type AgendaItem = {
  id: number;
  type: "upcoming_call" | "takeover";
  name: string;
  phone?: string | null;
  email?: string | null;
  dateStr: string | null;
  dateLabel: string;
  timeLabel: string;
  urgency: "now" | "today" | "week" | "info";
  campaignName?: string;
  score?: number;
  lastMessage?: string;
  conversionStatus?: string;
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function getLeadName(l: LeadRow): string {
  return (
    l.full_name || l.full_name_1 || l.name ||
    [l.first_name, l.last_name].filter(Boolean).join(" ") ||
    l.phone || l.email || `Lead #${l.id || l.Id}`
  );
}

function getBookedDate(l: LeadRow): string | null {
  return l.booked_call_date || l.Booked_call_date || null;
}

function isBooked(l: LeadRow): boolean {
  const s = (l.conversion_status || l.Conversion_Status || "").toLowerCase();
  return s === "booked" || s === "call booked";
}

function isTakeover(l: LeadRow): boolean {
  return !!(l.manual_takeover ?? false);
}

function getLastMessage(l: LeadRow): string {
  return l.last_message || l.last_message_received || l.last_reply || l.last_message_sent || "";
}

function getLeadScore(l: LeadRow): number {
  return Number(l.lead_score ?? l.leadScore ?? l.Lead_Score ?? 0);
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (target.getTime() - today.getTime()) / 86400000;

  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff <= 6) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getUrgency(dateStr: string | null): "now" | "today" | "week" | "info" {
  if (!dateStr) return "info";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "info";
  const diffH = (d.getTime() - Date.now()) / 3600000;
  if (diffH < 2) return "now";
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const targetMid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (todayMid.getTime() === targetMid.getTime()) return "today";
  return "week";
}

function relativeTime(isoString: string | null): string {
  if (!isoString) return "";
  const now = Date.now();
  const then = new Date(isoString).getTime();
  if (isNaN(then)) return "";
  const diffMs = now - then;
  if (diffMs < 0) return "just now";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export interface AgendaWidgetProps {
  accountId?: number;
  className?: string;
  hideHeader?: boolean;
}

export function AgendaWidget({ accountId, className, hideHeader }: AgendaWidgetProps) {
  const [, setLocation] = useLocation();
  const { isAgencyUser } = useWorkspace();
  const prefix = isAgencyUser ? "/agency" : "/subaccount";

  // ── Leads query ──────────────────────────────────────────────────────────
  const params = new URLSearchParams();
  if (accountId) params.set("accountId", String(accountId));
  const qs = params.toString();

  const { data: allLeads = [], isLoading: leadsLoading } = useQuery<LeadRow[]>({
    queryKey: ["/api/leads", "agenda-widget", accountId],
    queryFn: async () => {
      const res = await apiFetch(`/api/leads${qs ? `?${qs}` : ""}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data?.list || data?.data || [];
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  // (Activity feed query removed — CRM Updates are now static feature announcements)

  // ── Build agenda items ───────────────────────────────────────────────────
  const { upcomingCalls, takeoverLeads } = useMemo(() => {
    const now = new Date();
    const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59);
    const calls: AgendaItem[] = [];
    const takeovers: AgendaItem[] = [];

    for (const lead of allLeads) {
      const lid = lead.id || lead.Id;
      const convStatus = lead.conversion_status || lead.Conversion_Status || "";

      if (isBooked(lead)) {
        const bDate = getBookedDate(lead);
        if (bDate) {
          const d = new Date(bDate);
          if (!isNaN(d.getTime())) {
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (d >= todayStart && d <= weekEnd) {
              calls.push({
                id: lid, type: "upcoming_call",
                name: getLeadName(lead),
                phone: lead.phone || null, email: lead.email || null,
                dateStr: bDate, dateLabel: formatDate(bDate), timeLabel: formatTime(bDate),
                urgency: getUrgency(bDate),
                campaignName: lead.campaign_name || lead.Campaign_name || undefined,
                conversionStatus: convStatus,
              });
            }
          }
        }
      }

      if (isTakeover(lead) && !isBooked(lead)) {
        takeovers.push({
          id: lid, type: "takeover",
          name: getLeadName(lead),
          phone: lead.phone || null, email: lead.email || null,
          dateStr: lead.updated_at || lead.Last_modified_time || null,
          dateLabel: "", timeLabel: "", urgency: "now",
          campaignName: lead.campaign_name || lead.Campaign_name || undefined,
          score: getLeadScore(lead), lastMessage: getLastMessage(lead),
          conversionStatus: convStatus,
        });
      }
    }

    calls.sort((a, b) => {
      if (!a.dateStr || !b.dateStr) return 0;
      return new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime();
    });

    return { upcomingCalls: calls, takeoverLeads: takeovers };
  }, [allLeads]);

  // ── Takeover dismiss (optimistic local + API) ──────────────────────────
  const [dismissedTakeovers, setDismissedTakeovers] = useState<Set<number>>(new Set);

  const dismissTakeover = useCallback(async (leadId: number) => {
    setDismissedTakeovers((prev) => new Set(prev).add(leadId));
    try {
      await apiFetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual_takeover: false }),
      });
    } catch { /* will reappear on next refetch if API fails */ }
  }, []);

  const visibleTakeovers = useMemo(
    () => takeoverLeads.filter((t) => !dismissedTakeovers.has(t.id)),
    [takeoverLeads, dismissedTakeovers],
  );

  const agendaCount = upcomingCalls.length + visibleTakeovers.length;

  // ── Navigation ────────────────────────────────────────────────────────────
  const goToLead = useCallback((leadId: number) => {
    try { localStorage.setItem("selected-lead-id", String(leadId)); } catch {}
    setLocation(`${prefix}/leads`);
  }, [prefix, setLocation]);

  const goToCalendar = useCallback(() => {
    setLocation(`${prefix}/calendar`);
  }, [prefix, setLocation]);

  const goToChat = useCallback((leadId: number) => {
    try { localStorage.setItem("selected-conversation-lead-id", String(leadId)); } catch {}
    setLocation(`${prefix}/conversations`);
  }, [prefix, setLocation]);

  return (
    <div className={cn("flex flex-col rounded-lg overflow-hidden", className)}>
      {!hideHeader && (
        <div className="px-5 pt-4 pb-1 flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Up Next
          </span>
          {agendaCount > 0 && (
            <span className="text-[10px] font-semibold tabular-nums min-w-[18px] h-[18px] rounded-full inline-flex items-center justify-center px-1 bg-[#FCB803]/20 text-[#131B49]">
              {agendaCount}
            </span>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        <AgendaContent
          upcomingCalls={upcomingCalls}
          takeoverLeads={visibleTakeovers}
          isLoading={leadsLoading}
          onClickLead={goToLead}
          onClickCalendar={goToCalendar}
          onClickChat={goToChat}
          onDismissTakeover={dismissTakeover}
        />
      </div>
    </div>
  );
}

/* ─── Agenda Content ──────────────────────────────────────────────────────── */

function AgendaContent({
  upcomingCalls, takeoverLeads, isLoading,
  onClickLead, onClickCalendar, onClickChat, onDismissTakeover,
}: {
  upcomingCalls: AgendaItem[];
  takeoverLeads: AgendaItem[];
  isLoading: boolean;
  onClickLead: (id: number) => void;
  onClickCalendar: () => void;
  onClickChat: (id: number) => void;
  onDismissTakeover: (id: number) => void;
}) {
  if (isLoading) {
    return (
      <div className="px-3 py-4 space-y-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[96px] rounded-xl bg-card/60 animate-pulse" />
        ))}
      </div>
    );
  }

  const hasAnything = upcomingCalls.length > 0 || takeoverLeads.length > 0;

  if (!hasAnything) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
        <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-2.5">
          <CalendarCheck className="h-4 w-4 text-emerald-600" />
        </div>
        <p className="text-[13px] font-medium text-foreground">All clear</p>
        <p className="text-[12px] text-muted-foreground mt-0.5 max-w-[220px]">
          No upcoming calls or AI handoffs this week.
        </p>
      </div>
    );
  }

  const [activeCall, ...restCalls] = upcomingCalls;

  return (
    <div className="pb-2 pt-1 flex flex-col gap-1.5">

      {/* ── Booked calls ── */}
      {activeCall && (
        <ActiveCallCard
          item={activeCall}
          onClickLead={() => onClickLead(activeCall.id)}
          onClickCalendar={onClickCalendar}
        />
      )}
      {restCalls.map((item, idx) => (
        <UpcomingCallCard
          key={item.id}
          item={item}
          stepNumber={idx + 2}
          onClick={() => onClickLead(item.id)}
        />
      ))}

      {/* ── AI Takeover — single container card ── */}
      {takeoverLeads.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-card px-4 pt-3.5 pb-3.5 flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-orange-500/80" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-500/80">
              AI Flagged
            </span>
          </div>
          {takeoverLeads.map((item) => (
            <TakeoverCard
              key={item.id}
              item={item}
              onClickLead={() => onClickLead(item.id)}
              onClickChat={() => onClickChat(item.id)}
              onDismiss={() => onDismissTakeover(item.id)}
            />
          ))}
        </div>
      )}

    </div>
  );
}

/* ─── Lead Avatar Circle ─────────────────────────────────────────────────── */

function LeadAvatar({
  name, status, size = 34, onClick, showAlert,
}: {
  name: string; status?: string; size?: number; onClick?: () => void; showAlert?: boolean;
}) {
  const colors = getLeadStatusAvatarColor(status || "");
  const initials = getInitials(name);
  const circle = (
    <div
      className="shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold leading-none"
      style={{ width: size, height: size, backgroundColor: colors.bg, color: colors.text }}
    >
      {initials}
    </div>
  );

  const wrapper = (inner: React.ReactNode) => (
    <div className={cn("relative shrink-0", showAlert && "group/avatar")}>
      {inner}
      {showAlert && (
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity pointer-events-none">
          <AlertTriangle className="h-2.5 w-2.5 text-white" />
        </div>
      )}
    </div>
  );

  if (onClick) {
    return wrapper(
      <button
        type="button"
        onClick={onClick}
        className="shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold leading-none hover:opacity-80 transition-opacity"
        style={{ width: size, height: size, backgroundColor: colors.bg, color: colors.text }}
      >
        {initials}
      </button>
    );
  }
  return showAlert ? wrapper(circle) : circle;
}

/* ─── Active Call Card ───────────────────────────────────────────────────── */

function ActiveCallCard({
  item, onClickLead, onClickCalendar,
}: {
  item: AgendaItem;
  onClickLead: () => void;
  onClickCalendar: () => void;
}) {
  const [showPhone, setShowPhone] = useState(false);

  const dueLabel = item.timeLabel
    ? `${item.timeLabel}${item.dateLabel && item.dateLabel !== "Today" ? ` · ${item.dateLabel}` : ""}`
    : item.dateLabel || "TBD";

  return (
    <div className="rounded-xl px-4 pt-3.5 pb-3.5 flex flex-col gap-1" style={{ backgroundColor: "#FFF28F" }}>

      {/* Row 1: "Booked Call" title + calendar icon top-right */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">
            Booked Call
          </span>
          {item.urgency === "now" && (
            <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wide text-amber-700 bg-amber-200/70 rounded-full px-1.5 py-px">
              Soon
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClickCalendar}
          className="shrink-0 inline-flex items-center gap-1.5 text-foreground/50 hover:text-foreground/75 transition-colors"
          title="Open calendar"
        >
          <span className="text-[13px] font-semibold">{dueLabel}</span>
          <div className="w-[34px] h-[34px] rounded-full border border-black/[0.125] flex items-center justify-center bg-transparent">
            <Calendar className="h-4 w-4" />
          </div>
        </button>
      </div>

      {/* Row 2: avatar + lead name */}
      <div className="flex items-center gap-2">
        <LeadAvatar name={item.name} status={item.conversionStatus} size={34} onClick={onClickLead} />
        <button
          type="button"
          onClick={onClickLead}
          className="text-[14px] font-semibold text-foreground leading-snug hover:underline text-left truncate flex-1 min-w-0"
        >
          {item.name}
        </button>
      </div>

      {/* Row 3: action buttons — compact, aligned left */}
      <div className="flex items-center gap-2 pt-0.5 relative">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPhone((v) => !v)}
            className="w-[100px] h-9 rounded-full border border-black/[0.2] bg-black text-white inline-flex items-center justify-center gap-2 text-[12px] font-medium hover:bg-black/80 transition-colors"
          >
            <Phone className="h-4 w-4" />
            Call
          </button>
          {showPhone && item.phone && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-30">
              <div className="bg-foreground text-background text-[11px] font-medium px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                {item.phone}
              </div>
              <div className="w-2 h-2 bg-foreground rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1" />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClickLead}
          className="w-[100px] h-9 rounded-full border border-black/[0.125] bg-transparent text-foreground/60 inline-flex items-center justify-center gap-2 text-[12px] font-medium hover:border-black/[0.2] hover:text-foreground transition-colors"
        >
          <Check className="h-4 w-4" />
          Complete
        </button>
      </div>
    </div>
  );
}

/* ─── Upcoming Call Card ─────────────────────────────────────────────────── */

function UpcomingCallCard({
  item, stepNumber, onClick,
}: {
  item: AgendaItem;
  stepNumber: number;
  onClick: () => void;
}) {
  const dueLabel = item.timeLabel
    ? `${item.timeLabel}${item.dateLabel && item.dateLabel !== "Today" ? ` · ${item.dateLabel}` : ""}`
    : item.dateLabel || "TBD";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl bg-card hover:bg-white dark:hover:bg-card px-3 py-2 flex items-center gap-2.5 transition-colors group"
    >
      <LeadAvatar name={item.name} status={item.conversionStatus} size={34} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[12px] font-medium text-foreground/70 truncate group-hover:text-foreground transition-colors">
            {item.name}
          </span>
          <span className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground/55 tabular-nums whitespace-nowrap">
            <Calendar className="h-3 w-3" />
            {dueLabel}
          </span>
        </div>
        <p className="text-[11px] text-foreground/35 mt-0.5 leading-snug">
          Booked call · #{stepNumber}
        </p>
      </div>
    </button>
  );
}

/* ─── Takeover Card ── inside container card ──────────────────────────────── */

function TakeoverCard({
  item, onClickLead, onClickChat, onDismiss,
}: {
  item: AgendaItem;
  onClickLead: () => void;
  onClickChat: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-start gap-2.5 group/takeover py-1">
      <LeadAvatar name={item.name} status={item.conversionStatus} size={34} onClick={onClickLead} />

      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={onClickLead}
          className="text-[12px] font-medium text-foreground truncate hover:underline text-left block"
        >
          {item.name}
        </button>
        <div className="flex items-center gap-1.5 mt-px">
          <span className="inline-flex text-[9px] font-bold uppercase tracking-wide text-orange-500 bg-orange-50 rounded-full px-1.5 py-px shrink-0">
            Takeover needed
          </span>
          {item.dateStr && (
            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
              {relativeTime(item.dateStr)}
            </span>
          )}
        </div>
        {item.lastMessage && (
          <p className="text-[11px] text-foreground/40 mt-0.5 truncate leading-snug">
            {item.lastMessage}
          </p>
        )}
      </div>

      {/* Mail icon (far right) with dismiss X badge on top-right corner */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={onClickChat}
          className="w-9 h-9 rounded-full border border-black/[0.125] bg-transparent flex items-center justify-center text-foreground/50 hover:text-foreground hover:border-black/[0.2] transition-colors"
          title="Open conversation"
        >
          <Mail className="h-4 w-4" />
        </button>
        {/* Dismiss X — small circle badge on top-right of Mail button */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full bg-foreground/10 hover:bg-red-100 flex items-center justify-center text-foreground/30 hover:text-red-500 transition-colors opacity-0 group-hover/takeover:opacity-100"
          title="Dismiss takeover"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}


