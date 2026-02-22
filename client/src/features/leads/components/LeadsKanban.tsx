import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  User,
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  AlertCircle,
} from "lucide-react";

/* ─────────── Pipeline column configuration ─────────── */

// DB values for Conversion_Status field
const PIPELINE_STAGES = [
  "New",
  "Contacted",
  "Responded",
  "Multiple Responses",
  "Qualified",
  "Booked",
  "Lost",
  "DND",
] as const;

// Display labels for each pipeline stage (may differ from DB value)
const STAGE_LABELS: Record<string, string> = {
  New: "New",
  Contacted: "Contacted",
  Responded: "Responded",
  "Multiple Responses": "Multiple Responses",
  Qualified: "Qualified",
  Booked: "Call Booked",
  Lost: "Lost",
  DND: "DND",
};

const STAGE_STYLES: Record<
  string,
  { bg: string; border: string; badge: string; dot: string }
> = {
  New: {
    bg: "bg-blue-50/50 dark:bg-blue-950/20",
    border: "border-blue-200/50 dark:border-blue-800/30",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  Contacted: {
    bg: "bg-amber-50/50 dark:bg-amber-950/20",
    border: "border-amber-200/50 dark:border-amber-800/30",
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  Responded: {
    bg: "bg-violet-50/50 dark:bg-violet-950/20",
    border: "border-violet-200/50 dark:border-violet-800/30",
    badge:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  "Multiple Responses": {
    bg: "bg-indigo-50/50 dark:bg-indigo-950/20",
    border: "border-indigo-200/50 dark:border-indigo-800/30",
    badge:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    dot: "bg-indigo-500",
  },
  Qualified: {
    bg: "bg-emerald-50/50 dark:bg-emerald-950/20",
    border: "border-emerald-200/50 dark:border-emerald-800/30",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  Booked: {
    bg: "bg-brand-yellow/5 dark:bg-brand-yellow/10",
    border: "border-brand-yellow/30 dark:border-brand-yellow/20",
    badge:
      "bg-brand-yellow/15 text-brand-yellow dark:bg-brand-yellow/20 dark:text-brand-yellow",
    dot: "bg-brand-yellow",
  },
  Lost: {
    bg: "bg-zinc-50/50 dark:bg-zinc-900/20",
    border: "border-zinc-200/50 dark:border-zinc-700/30",
    badge: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-400",
    dot: "bg-zinc-400",
  },
  DND: {
    bg: "bg-rose-50/50 dark:bg-rose-950/20",
    border: "border-rose-200/50 dark:border-rose-800/30",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    dot: "bg-rose-500",
  },
};

const DEFAULT_STYLE = {
  bg: "bg-muted/30",
  border: "border-border/50",
  badge: "bg-muted text-muted-foreground",
  dot: "bg-muted-foreground",
};

/* ─────────── Priority badge colors ─────────── */

function priorityColor(priority: string | undefined) {
  switch (priority?.toLowerCase()) {
    case "urgent":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "high":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "medium":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "low":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/* ─────────── Format date helper ─────────── */

function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  } catch {
    return "";
  }
}

/* ─────────── Kanban Card ─────────── */

function KanbanLeadCard({ lead }: { lead: any }) {
  const initials =
    lead.Image ||
    `${(lead.first_name || "").charAt(0)}${(lead.last_name || "").charAt(0)}`.toUpperCase() ||
    "?";

  const lastActivity =
    lead.last_interaction_at ||
    lead.last_message_received_at ||
    lead.last_message_sent_at;

  return (
    <div
      className="rounded-xl border border-border bg-card p-3 shadow-sm hover:shadow-md transition-all duration-200 cursor-default group"
      data-testid={`kanban-card-${lead.Id || lead.id}`}
    >
      {/* Header: Avatar + Name + Priority */}
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center text-xs font-bold flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate text-foreground">
            {lead.full_name || `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "Unknown"}
          </div>
          {lead.Account && lead.Account !== "Unknown Account" && (
            <div className="text-[11px] text-muted-foreground truncate">
              {lead.Account}
            </div>
          )}
        </div>
        {lead.priority && (
          <Badge
            className={cn(
              "text-[10px] px-1.5 py-0 h-5 font-medium border-0 flex-shrink-0",
              priorityColor(lead.priority)
            )}
          >
            {lead.priority}
          </Badge>
        )}
      </div>

      {/* Contact Info */}
      <div className="mt-2 space-y-1">
        {lead.email && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Mail className="h-3 w-3 flex-shrink-0 opacity-50" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Phone className="h-3 w-3 flex-shrink-0 opacity-50" />
            <span className="truncate">{lead.phone}</span>
          </div>
        )}
      </div>

      {/* Footer: Interactions + Last activity */}
      <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {(lead.Interactions > 0 || lead.message_count_sent > 0) && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3 opacity-50" />
              {lead.Interactions || lead.message_count_sent || 0}
            </span>
          )}
          {lead.booked_call_date && (
            <span className="flex items-center gap-1 text-brand-yellow">
              <Calendar className="h-3 w-3" />
              Booked
            </span>
          )}
        </div>
        {lastActivity && (
          <span className="text-[10px] text-muted-foreground/70">
            {formatRelativeDate(lastActivity)}
          </span>
        )}
      </div>

      {/* Notes preview (if any) */}
      {lead.notes && (
        <div className="mt-2 text-[11px] text-muted-foreground/80 line-clamp-2 italic">
          {lead.notes}
        </div>
      )}
    </div>
  );
}

/* ─────────── Kanban Column ─────────── */

function KanbanColumn({
  stage,
  leads,
}: {
  stage: string;
  leads: any[];
}) {
  const styles = STAGE_STYLES[stage] || DEFAULT_STYLE;

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border min-w-[260px] w-[280px] max-w-[300px] flex-shrink-0",
        styles.bg,
        styles.border
      )}
      data-testid={`kanban-column-${stage}`}
    >
      {/* Column Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/30">
        <div className={cn("w-2 h-2 rounded-full flex-shrink-0", styles.dot)} />
        <span className="font-semibold text-sm text-foreground truncate">
          {STAGE_LABELS[stage] ?? stage}
        </span>
        <Badge
          className={cn(
            "ml-auto text-[11px] px-2 py-0 h-5 font-semibold border-0 rounded-md",
            styles.badge
          )}
        >
          {leads.length}
        </Badge>
      </div>

      {/* Column Body */}
      <ScrollArea className="flex-1 max-h-[calc(100vh-260px)]">
        <div className="p-2 space-y-2">
          {leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
              <AlertCircle className="h-5 w-5 mb-1.5" />
              <span className="text-xs">No leads</span>
            </div>
          ) : (
            leads.map((lead) => (
              <KanbanLeadCard
                key={lead.Id || lead.id}
                lead={lead}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ─────────── Main Kanban Board ─────────── */

interface LeadsKanbanProps {
  leads: any[];
  loading?: boolean;
  /** When a campaign is selected, show only stages present for that campaign */
  campaignId?: string;
}

export function LeadsKanban({ leads, loading, campaignId }: LeadsKanbanProps) {
  // Determine which pipeline stages to display.
  // When a campaign is selected, derive stages from the actual leads in that
  // campaign (keeping PIPELINE_STAGES order). This lets the board adapt to
  // campaigns that only use a subset of the standard stages.
  // When no campaign is selected, fall back to all standard stages.
  const activeStages = useMemo((): string[] => {
    if (!campaignId) {
      // No campaign filter — show every standard stage (including empties)
      return [...PIPELINE_STAGES];
    }

    // Collect the unique conversion_status values present in the filtered leads
    const usedStages = new Set(
      leads.map(
        (lead) => lead.conversion_status || lead.Conversion_Status || "New"
      )
    );

    // Keep PIPELINE_STAGES order; only include stages that have leads
    const filtered = (PIPELINE_STAGES as readonly string[]).filter((s) =>
      usedStages.has(s)
    );

    // If the campaign has no leads yet, fall back to all stages so the board
    // doesn't appear broken
    return filtered.length > 0 ? filtered : [...PIPELINE_STAGES];
  }, [campaignId, leads]);

  // Group leads by conversion_status
  const groupedLeads = useMemo(() => {
    const groups: Record<string, any[]> = {};

    // Initialize only the active stages
    for (const stage of activeStages) {
      groups[stage] = [];
    }

    // Distribute leads into their pipeline stages
    for (const lead of leads) {
      const status = lead.conversion_status || lead.Conversion_Status || "New";
      if (groups[status] !== undefined) {
        groups[status].push(lead);
      } else if (groups["New"] !== undefined) {
        // Unknown status falls back to "New" (if it is an active stage)
        groups["New"].push(lead);
      }
    }

    return groups;
  }, [leads, activeStages]);

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-4 px-1">
        {PIPELINE_STAGES.slice(0, 5).map((stage) => {
          const styles = STAGE_STYLES[stage] || DEFAULT_STYLE;
          return (
            <div
              key={stage}
              className={cn(
                "flex flex-col rounded-xl border min-w-[260px] w-[280px] flex-shrink-0 animate-pulse",
                styles.bg,
                styles.border
              )}
            >
              <div className="px-3 py-2.5 border-b border-border/30">
                <div className="h-4 bg-muted rounded w-20" />
              </div>
              <div className="p-2 space-y-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border bg-card p-3 space-y-2"
                  >
                    <div className="flex gap-2">
                      <div className="w-8 h-8 rounded-lg bg-muted" />
                      <div className="flex-1 space-y-1">
                        <div className="h-3.5 bg-muted rounded w-3/4" />
                        <div className="h-2.5 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                    <div className="h-2.5 bg-muted rounded w-full" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="flex gap-3 overflow-x-auto pb-4 px-1 -mx-1"
      data-testid="kanban-board"
      data-campaign-id={campaignId || "all"}
    >
      {activeStages.map((stage) => (
        <KanbanColumn
          key={stage}
          stage={stage}
          leads={groupedLeads[stage] || []}
        />
      ))}
    </div>
  );
}
