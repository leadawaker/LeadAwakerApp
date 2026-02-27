import { useMemo, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  CalendarCheck,
  AlertTriangle,
  ChevronRight,
  Phone,
  MessageSquare,
} from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";

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
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function getLeadName(l: LeadRow): string {
  return (
    l.full_name ||
    l.full_name_1 ||
    l.name ||
    [l.first_name, l.last_name].filter(Boolean).join(" ") ||
    l.phone ||
    l.email ||
    `Lead #${l.id || l.Id}`
  );
}

function getLeadScore(l: LeadRow): number {
  return Number(l.lead_score ?? l.leadScore ?? l.Lead_Score ?? 0);
}

function getLastMessage(l: LeadRow): string {
  return l.last_message || l.last_message_received || l.last_reply || l.last_message_sent || "";
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
  if (diff > 1 && diff <= 6)
    return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateCompact(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (target.getTime() - today.getTime()) / 86400000;

  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff <= 6)
    return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getUrgency(dateStr: string | null): "now" | "today" | "week" | "info" {
  if (!dateStr) return "info";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "info";
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffH = diffMs / 3600000;

  if (diffH < 0) return "now"; // overdue or happening now
  if (diffH < 2) return "now"; // within 2 hours
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (today.getTime() === target.getTime()) return "today";
  return "week";
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

  /* ── Fetch leads ── */
  const params = new URLSearchParams();
  if (accountId) params.set("accountId", String(accountId));
  const qs = params.toString();

  const { data: allLeads = [], isLoading } = useQuery<LeadRow[]>({
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

  /* ── Build agenda items ── */
  const { upcomingCalls, takeoverLeads } = useMemo(() => {
    const now = new Date();
    const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59);

    const calls: AgendaItem[] = [];
    const takeovers: AgendaItem[] = [];

    for (const lead of allLeads) {
      const lid = lead.id || lead.Id;

      // Upcoming booked calls (today through end of week, plus overdue today)
      if (isBooked(lead)) {
        const bDate = getBookedDate(lead);
        if (bDate) {
          const d = new Date(bDate);
          if (!isNaN(d.getTime())) {
            // Show calls from start of today through end of week
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (d >= todayStart && d <= weekEnd) {
              calls.push({
                id: lid,
                type: "upcoming_call",
                name: getLeadName(lead),
                phone: lead.phone || null,
                email: lead.email || null,
                dateStr: bDate,
                dateLabel: formatDate(bDate),
                timeLabel: formatTime(bDate),
                urgency: getUrgency(bDate),
                campaignName: lead.campaign_name || lead.Campaign_name || undefined,
              });
            }
          }
        }
      }

      // AI flagged for manual takeover
      if (isTakeover(lead) && !isBooked(lead)) {
        takeovers.push({
          id: lid,
          type: "takeover",
          name: getLeadName(lead),
          phone: lead.phone || null,
          email: lead.email || null,
          dateStr: lead.updated_at || lead.Last_modified_time || null,
          dateLabel: "",
          timeLabel: "",
          urgency: "now",
          campaignName: lead.campaign_name || lead.Campaign_name || undefined,
          score: getLeadScore(lead),
          lastMessage: getLastMessage(lead),
        });
      }
    }

    // Sort calls: soonest first
    calls.sort((a, b) => {
      if (!a.dateStr || !b.dateStr) return 0;
      return new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime();
    });

    return { upcomingCalls: calls, takeoverLeads: takeovers };
  }, [allLeads]);

  const agendaCount = upcomingCalls.length + takeoverLeads.length;

  /* ── Navigation ── */
  const goToLead = useCallback(
    (leadId: number) => {
      setLocation(`${prefix}/leads?leadId=${leadId}`);
    },
    [prefix, setLocation],
  );

  const goToChat = useCallback(
    (leadId: number) => {
      setLocation(`${prefix}/chats?leadId=${leadId}`);
    },
    [prefix, setLocation],
  );

  return (
    <div className={cn("flex flex-col rounded-lg overflow-hidden", className)}>
      {/* Header */}
      {!hideHeader && (
        <div className="px-5 pt-4 pb-1 flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Up Next</span>
          {agendaCount > 0 && (
            <span className="text-[10px] font-semibold tabular-nums min-w-[18px] h-[18px] rounded-full inline-flex items-center justify-center px-1 bg-[#FCB803]/20 text-[#131B49]">
              {agendaCount}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <AgendaContent
          upcomingCalls={upcomingCalls}
          takeoverLeads={takeoverLeads}
          isLoading={isLoading}
          onClickLead={goToLead}
          onClickChat={goToChat}
        />
      </div>
    </div>
  );
}

/* ─── Agenda Content ──────────────────────────────────────────────────────── */

function AgendaContent({
  upcomingCalls,
  takeoverLeads,
  isLoading,
  onClickLead,
  onClickChat,
}: {
  upcomingCalls: AgendaItem[];
  takeoverLeads: AgendaItem[];
  isLoading: boolean;
  onClickLead: (id: number) => void;
  onClickChat: (id: number) => void;
}) {
  if (isLoading) {
    return (
      <div className="px-3 py-4 space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-card/60 animate-pulse" />
        ))}
      </div>
    );
  }

  if (upcomingCalls.length === 0 && takeoverLeads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
        <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-2.5">
          <CalendarCheck className="h-4.5 w-4.5 text-emerald-600" />
        </div>
        <p className="text-[13px] font-medium text-foreground">All clear</p>
        <p className="text-[12px] text-muted-foreground mt-0.5 max-w-[220px]">
          No upcoming calls or AI handoffs this week. The AI is handling things.
        </p>
      </div>
    );
  }

  return (
    <div className="px-2 pb-2 space-y-2">
      {/* Takeover alerts first — they're urgent */}
      {takeoverLeads.length > 0 && (
        <div className="space-y-1">
          <div className="px-2 pt-1.5 pb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600/70">
              AI Flagged for Manual Takeover
            </span>
          </div>
          {takeoverLeads.map((item) => (
            <TakeoverCard
              key={item.id}
              item={item}
              onClickChat={() => onClickChat(item.id)}
            />
          ))}
        </div>
      )}

      {/* Upcoming calls */}
      {upcomingCalls.length > 0 && (
        <div className="space-y-1">
          <div className="px-2 pt-1.5 pb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">
              Upcoming Calls
            </span>
          </div>
          {upcomingCalls.map((item) => (
            <CallCard
              key={item.id}
              item={item}
              onClickName={() => onClickLead(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Call Card — clean white card ─────────────────────────────────────────── */

function CallCard({ item, onClickName }: { item: AgendaItem; onClickName: () => void }) {
  const [hovered, setHovered] = useState(false);

  const dateRight = item.timeLabel
    ? `${item.timeLabel}${item.dateLabel && item.dateLabel !== "Today" ? ` · ${item.dateLabel}` : ""}`
    : item.dateLabel || "TBD";

  return (
    <div
      className="bg-white/90 rounded-xl px-3 py-2.5 flex items-center gap-2.5 transition-colors hover:bg-white"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Name (clickable) + Soon badge */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onClickName}
          className="text-[13px] font-medium text-foreground truncate leading-snug hover:underline text-left"
        >
          {item.name}
        </button>
        {item.urgency === "now" && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-[#FCB803] bg-[#FCB803]/15 rounded-full px-1.5 py-px">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#FCB803] opacity-60 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#FCB803]" />
            </span>
            Soon
          </span>
        )}
        {/* Phone — only visible on hover */}
        {hovered && item.phone && (
          <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
            <Phone className="h-3 w-3" />
            {item.phone}
          </span>
        )}
      </div>

      {/* Date on the right */}
      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 whitespace-nowrap">
        {dateRight}
      </span>
    </div>
  );
}

/* ─── Takeover Card — white card with name, score, last message ─────────── */

function TakeoverCard({
  item,
  onClickChat,
}: {
  item: AgendaItem;
  onClickChat: () => void;
}) {
  const score = item.score ?? 0;
  const lastMsg = item.lastMessage || "";
  const truncatedMsg = lastMsg.length > 80 ? lastMsg.slice(0, 80) + "…" : lastMsg;

  return (
    <button
      type="button"
      onClick={onClickChat}
      className="w-full text-left bg-white/90 rounded-xl px-3 py-2.5 transition-colors hover:bg-white group"
    >
      {/* Top row: name + score */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
          <span className="text-[13px] font-medium text-foreground truncate leading-snug">
            {item.name}
          </span>
        </div>
        {score > 0 && (
          <span className={cn(
            "text-[11px] font-bold tabular-nums shrink-0",
            score >= 70 ? "text-emerald-600" : score >= 40 ? "text-amber-600" : "text-red-500",
          )}>
            {score}
          </span>
        )}
      </div>

      {/* Last message preview */}
      {truncatedMsg && (
        <div className="flex items-start gap-1.5 mt-1">
          <MessageSquare className="h-3 w-3 text-muted-foreground/40 shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
            {truncatedMsg}
          </p>
        </div>
      )}

      {/* Hover hint */}
      <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[10px] font-medium text-brand-indigo">Open conversation</span>
        <ChevronRight className="h-3 w-3 text-brand-indigo" />
      </div>
    </button>
  );
}
