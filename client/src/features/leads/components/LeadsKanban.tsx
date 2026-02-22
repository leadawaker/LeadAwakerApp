import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  AlertCircle,
  SmilePlus,
  Frown,
  Meh,
  ChevronLeft,
  ChevronRight,
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
  { bg: string; border: string; badge: string; dot: string; dragOver: string }
> = {
  New: {
    bg: "bg-blue-50/50 dark:bg-blue-950/20",
    border: "border-blue-200/50 dark:border-blue-800/30",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    dot: "bg-blue-500",
    dragOver:
      "bg-blue-100/70 dark:bg-blue-900/40 border-blue-400/60 dark:border-blue-600/50",
  },
  Contacted: {
    bg: "bg-amber-50/50 dark:bg-amber-950/20",
    border: "border-amber-200/50 dark:border-amber-800/30",
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    dot: "bg-amber-500",
    dragOver:
      "bg-amber-100/70 dark:bg-amber-900/40 border-amber-400/60 dark:border-amber-600/50",
  },
  Responded: {
    bg: "bg-violet-50/50 dark:bg-violet-950/20",
    border: "border-violet-200/50 dark:border-violet-800/30",
    badge:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    dot: "bg-violet-500",
    dragOver:
      "bg-violet-100/70 dark:bg-violet-900/40 border-violet-400/60 dark:border-violet-600/50",
  },
  "Multiple Responses": {
    bg: "bg-indigo-50/50 dark:bg-indigo-950/20",
    border: "border-indigo-200/50 dark:border-indigo-800/30",
    badge:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    dot: "bg-indigo-500",
    dragOver:
      "bg-indigo-100/70 dark:bg-indigo-900/40 border-indigo-400/60 dark:border-indigo-600/50",
  },
  Qualified: {
    bg: "bg-emerald-50/50 dark:bg-emerald-950/20",
    border: "border-emerald-200/50 dark:border-emerald-800/30",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
    dragOver:
      "bg-emerald-100/70 dark:bg-emerald-900/40 border-emerald-400/60 dark:border-emerald-600/50",
  },
  Booked: {
    bg: "bg-brand-yellow/5 dark:bg-brand-yellow/10",
    border: "border-brand-yellow/30 dark:border-brand-yellow/20",
    badge:
      "bg-brand-yellow/15 text-brand-yellow dark:bg-brand-yellow/20 dark:text-brand-yellow",
    dot: "bg-brand-yellow",
    dragOver: "bg-brand-yellow/20 dark:bg-brand-yellow/25 border-brand-yellow/60",
  },
  Lost: {
    bg: "bg-zinc-50/50 dark:bg-zinc-900/20",
    border: "border-zinc-200/50 dark:border-zinc-700/30",
    badge: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-400",
    dot: "bg-zinc-400",
    dragOver:
      "bg-zinc-100/70 dark:bg-zinc-800/40 border-zinc-400/60 dark:border-zinc-600/50",
  },
  DND: {
    bg: "bg-rose-50/50 dark:bg-rose-950/20",
    border: "border-rose-200/50 dark:border-rose-800/30",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    dot: "bg-rose-500",
    dragOver:
      "bg-rose-100/70 dark:bg-rose-900/40 border-rose-400/60 dark:border-rose-600/50",
  },
};

const DEFAULT_STYLE = {
  bg: "bg-muted/30",
  border: "border-border/50",
  badge: "bg-muted text-muted-foreground",
  dot: "bg-muted-foreground",
  dragOver: "bg-muted/60 border-border",
};

/* ─────────── Infinite scroll batch size ─────────── */
/** Number of leads initially rendered per column, and loaded per scroll batch */
const COLUMN_BATCH_SIZE = 20;

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

/* ─────────── Score badge color helper ─────────── */

function scoreBadgeClass(score: number) {
  if (score >= 70)
    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (score >= 40)
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
}

/* ─────────── Sentiment indicator helper ─────────── */

type SentimentInfo = {
  label: string;
  icon: React.ReactNode;
  cls: string;
};

function getSentimentInfo(sentiment: string | null | undefined): SentimentInfo | null {
  if (!sentiment) return null;
  const lower = sentiment.toLowerCase();
  if (
    lower.includes("positive") ||
    lower === "good" ||
    lower === "happy"
  ) {
    return {
      label: "Positive",
      icon: <SmilePlus className="h-3 w-3" />,
      cls: "text-green-600 dark:text-green-400",
    };
  }
  if (
    lower.includes("negative") ||
    lower === "bad" ||
    lower === "angry" ||
    lower === "frustrated"
  ) {
    return {
      label: "Negative",
      icon: <Frown className="h-3 w-3" />,
      cls: "text-red-500 dark:text-red-400",
    };
  }
  if (lower.includes("neutral") || lower === "ok" || lower === "okay") {
    return {
      label: "Neutral",
      icon: <Meh className="h-3 w-3" />,
      cls: "text-muted-foreground",
    };
  }
  // Show whatever value is present as a non-null fallback
  return {
    label: sentiment,
    icon: <Meh className="h-3 w-3" />,
    cls: "text-muted-foreground",
  };
}

/* ─────────── Tag chip color helper ─────────── */

function tagBgStyle(color: string | undefined): React.CSSProperties {
  if (!color || color === "gray") return {};
  if (color.startsWith("#")) {
    return { backgroundColor: color + "30", borderColor: color + "60" };
  }
  // Named colors via color-mix for light tint
  return {
    backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
  };
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

/* ─────────── Card content (reused by draggable card + drag overlay) ─────────── */

interface KanbanCardContentProps {
  lead: any;
  isDragging?: boolean;
  cardTags?: { name: string; color: string }[];
}

function KanbanCardContent({
  lead,
  isDragging = false,
  cardTags,
}: KanbanCardContentProps) {
  const initials =
    lead.Image ||
    `${(lead.first_name || "").charAt(0)}${(lead.last_name || "").charAt(0)}`.toUpperCase() ||
    "?";

  const lastActivity =
    lead.last_interaction_at ||
    lead.last_message_received_at ||
    lead.last_message_sent_at;

  // Score from lead data (0-100)
  const score = Number(lead.lead_score ?? lead.leadScore ?? lead.Lead_Score ?? 0);
  const hasScore = score > 0;

  // Sentiment
  const sentimentRaw = lead.ai_sentiment || lead.aiSentiment || lead.Ai_Sentiment;
  const sentiment = getSentimentInfo(sentimentRaw);

  // Tags (passed from parent via leadTagsMap lookup)
  const tags = cardTags || [];
  const visibleTags = tags.slice(0, 3);
  const extraTagCount = Math.max(0, tags.length - 3);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-3 shadow-sm transition-all duration-200",
        isDragging
          ? "shadow-xl ring-2 ring-brand-blue/40 opacity-95 rotate-1 scale-105"
          : "hover:shadow-md group"
      )}
    >
      {/* Header: Avatar + Name + Score badge */}
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center text-xs font-bold flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="font-semibold text-sm truncate text-foreground"
            data-testid="kanban-card-name"
          >
            {lead.full_name ||
              `${lead.first_name || ""} ${lead.last_name || ""}`.trim() ||
              "Unknown"}
          </div>
          {lead.Account && lead.Account !== "Unknown Account" && (
            <div className="text-[11px] text-muted-foreground truncate">
              {lead.Account}
            </div>
          )}
        </div>

        {/* Score badge (color-coded: green ≥70, yellow 40-69, red <40) */}
        {hasScore && (
          <Badge
            className={cn(
              "text-[10px] px-1.5 py-0 h-5 font-semibold border-0 flex-shrink-0 tabular-nums",
              scoreBadgeClass(score)
            )}
            data-testid="kanban-card-score"
            title={`Lead score: ${score}`}
          >
            {score}
          </Badge>
        )}

        {/* Priority badge (only shown if no score, to avoid clutter) */}
        {!hasScore && lead.priority && (
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

      {/* Contact Info: Phone (required per feature spec) */}
      <div className="mt-2 space-y-1">
        {lead.email && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Mail className="h-3 w-3 flex-shrink-0 opacity-50" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
            data-testid="kanban-card-phone"
          >
            <Phone className="h-3 w-3 flex-shrink-0 opacity-50" />
            <span className="truncate">{lead.phone}</span>
          </div>
        )}
      </div>

      {/* Tags: colored chips (up to 3 visible, rest as "+N" badge) */}
      {visibleTags.length > 0 && (
        <div
          className="mt-2 flex flex-wrap gap-1"
          data-testid="kanban-card-tags"
        >
          {visibleTags.map((tag) => (
            <span
              key={tag.name}
              className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium border border-border/40"
              style={tagBgStyle(tag.color)}
              title={tag.name}
            >
              {tag.name}
            </span>
          ))}
          {extraTagCount > 0 && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground"
              title={`${extraTagCount} more tag${extraTagCount > 1 ? "s" : ""}`}
            >
              +{extraTagCount}
            </span>
          )}
        </div>
      )}

      {/* Footer: Interactions + sentiment + Last activity date */}
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
          {/* Sentiment indicator */}
          {sentiment && (
            <span
              className={cn("flex items-center gap-0.5", sentiment.cls)}
              data-testid="kanban-card-sentiment"
              title={`Sentiment: ${sentiment.label}`}
            >
              {sentiment.icon}
              <span className="text-[10px]">{sentiment.label}</span>
            </span>
          )}
        </div>

        {/* Last interaction date */}
        {lastActivity && (
          <span
            className="text-[10px] text-muted-foreground/70"
            data-testid="kanban-card-last-activity"
          >
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

/* ─────────── Draggable Card wrapper ─────────── */

function KanbanLeadCard({
  lead,
  cardTags,
}: {
  lead: any;
  cardTags?: { name: string; color: string }[];
}) {
  const leadId = String(lead.Id || lead.id);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: leadId,
    data: { lead },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-testid={`kanban-card-${leadId}`}
      className={cn(
        "cursor-grab active:cursor-grabbing touch-none select-none",
        isDragging && "opacity-30"
      )}
    >
      <KanbanCardContent lead={lead} cardTags={cardTags} />
    </div>
  );
}

/* ─────────── Droppable Column ─────────── */

function KanbanColumn({
  stage,
  leads,
  leadTagsMap,
  isCollapsed,
  onToggleCollapse,
}: {
  stage: string;
  leads: any[];
  leadTagsMap?: Map<number, { name: string; color: string }[]>;
  isCollapsed?: boolean;
  onToggleCollapse?: (stage: string) => void;
}) {
  const styles = STAGE_STYLES[stage] || DEFAULT_STYLE;
  const { setNodeRef, isOver } = useDroppable({ id: `column-${stage}` });

  /* ── Infinite scroll state ── */
  // visibleCount tracks how many leads to render; expands as user scrolls
  const [visibleCount, setVisibleCount] = useState(COLUMN_BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when the column's lead list changes (e.g. campaign switch, filter)
  useEffect(() => {
    setVisibleCount(COLUMN_BATCH_SIZE);
  }, [stage, leads.length]);

  // IntersectionObserver: when the bottom sentinel enters the viewport, load the next batch
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || visibleCount >= leads.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + COLUMN_BATCH_SIZE, leads.length));
        }
      },
      // Trigger 80px before the sentinel actually reaches the viewport bottom for smooth UX
      { threshold: 0, rootMargin: "80px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, leads.length]);

  // Only render the first `visibleCount` leads for performance
  const visibleLeads = leads.slice(0, visibleCount);
  const hasMore = visibleCount < leads.length;
  const remainingCount = leads.length - visibleCount;

  /* ── Collapsed / minimal indicator ── */
  if (isCollapsed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center rounded-xl border w-10 flex-shrink-0 transition-all duration-200 cursor-pointer select-none",
          cn(styles.bg, styles.border)
        )}
        data-testid={`kanban-column-${stage}`}
        data-collapsed="true"
        title={`${STAGE_LABELS[stage] ?? stage} (${leads.length}) — click to expand`}
        onClick={() => onToggleCollapse?.(stage)}
      >
        {/* Expand chevron */}
        <div className="py-2 flex items-center justify-center w-full">
          <ChevronRight
            className="h-4 w-4 text-muted-foreground"
            data-testid={`kanban-column-expand-${stage}`}
          />
        </div>

        {/* Color dot */}
        <div className={cn("w-2 h-2 rounded-full flex-shrink-0 mt-1", styles.dot)} />

        {/* Stage label — rotated vertically */}
        <div className="flex-1 flex items-center justify-center py-3">
          <span
            className="font-semibold text-[11px] text-foreground"
            style={{
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              transform: "rotate(180deg)",
              whiteSpace: "nowrap",
            }}
          >
            {STAGE_LABELS[stage] ?? stage}
          </span>
        </div>

        {/* Count badge */}
        <Badge
          className={cn(
            "mb-2 text-[10px] px-1 py-0 h-5 font-semibold border-0 rounded-md",
            styles.badge
          )}
          data-testid={`kanban-column-count-${stage}`}
        >
          {leads.length}
        </Badge>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border min-w-[260px] w-[280px] max-w-[300px] flex-shrink-0 transition-all duration-200",
        isOver ? styles.dragOver : cn(styles.bg, styles.border)
      )}
      data-testid={`kanban-column-${stage}`}
      data-collapsed="false"
      data-visible-count={visibleCount}
      data-total-count={leads.length}
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
          data-testid={`kanban-column-count-${stage}`}
        >
          {leads.length}
        </Badge>

        {/* Collapse button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 ml-1 flex-shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => onToggleCollapse?.(stage)}
          data-testid={`kanban-column-collapse-${stage}`}
          title="Collapse column"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Column Body – the ref is on the inner div so the drop target covers the list area */}
      <ScrollArea className="flex-1 max-h-[calc(100vh-260px)]">
        <div ref={setNodeRef} className="p-2 space-y-2 min-h-[80px]">
          {leads.length === 0 ? (
            <div
              className={cn(
                "flex flex-col items-center justify-center py-8 rounded-lg text-muted-foreground/50 transition-colors duration-150",
                isOver && "bg-white/20 dark:bg-white/5"
              )}
            >
              <AlertCircle className="h-5 w-5 mb-1.5" />
              <span className="text-xs">{isOver ? "Drop here" : "No leads"}</span>
            </div>
          ) : (
            <>
              {visibleLeads.map((lead) => {
                const leadId = Number(lead.Id || lead.id);
                const cardTags = leadTagsMap?.get(leadId) || [];
                return (
                  <KanbanLeadCard
                    key={lead.Id || lead.id}
                    lead={lead}
                    cardTags={cardTags}
                  />
                );
              })}

              {/* Sentinel element: when it enters the viewport the next batch loads */}
              {hasMore && (
                <div
                  ref={sentinelRef}
                  data-testid={`kanban-column-sentinel-${stage}`}
                  className="py-2 flex items-center justify-center text-xs text-muted-foreground/60 select-none"
                  aria-label={`Loading more leads – ${remainingCount} remaining`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                    <span className="ml-1">{remainingCount} more</span>
                  </span>
                </div>
              )}
            </>
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
  /** Optional campaign ID filter (accepted for compat with LeadsTable) */
  campaignId?: string;
  /** Called when a card is dropped into a different column; triggers the API update */
  onLeadMove?: (leadId: number | string, newStage: string) => void;
  /** Tag info map passed from LeadsTable: leadId → [{name, color}] */
  leadTagsMap?: Map<number, { name: string; color: string }[]>;
}

export function LeadsKanban({
  leads,
  loading,
  onLeadMove,
  leadTagsMap,
}: LeadsKanbanProps) {
  // Local optimistic copy of leads so visual updates are instant
  const [localLeads, setLocalLeads] = useState<any[]>(leads);
  const [activeLead, setActiveLead] = useState<any | null>(null);
  const [isDraggingAny, setIsDraggingAny] = useState(false);

  // Collapsed column state (persisted in localStorage)
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("kanban_collapsed_stages");
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch {
      // ignore parse errors
    }
    return new Set<string>();
  });

  const toggleColumnCollapse = useCallback((stage: string) => {
    setCollapsedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) {
        next.delete(stage);
      } else {
        next.add(stage);
      }
      try {
        localStorage.setItem("kanban_collapsed_stages", JSON.stringify([...next]));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  // Sync with parent when not dragging (covers initial load and external refreshes)
  useMemo(() => {
    if (!isDraggingAny) {
      setLocalLeads(leads);
    }
  }, [leads, isDraggingAny]);

  const groupedLeads = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const stage of PIPELINE_STAGES) groups[stage] = [];

    for (const lead of localLeads) {
      const status =
        lead.conversion_status || lead.Conversion_Status || "New";
      if (groups[status]) {
        groups[status].push(lead);
      } else {
        groups["New"].push(lead);
      }
    }

    return groups;
  }, [localLeads]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const lead = event.active.data.current?.lead ?? null;
      setActiveLead(lead);
      setIsDraggingAny(true);
      // Snapshot parent leads so local state is fresh for this drag session
      setLocalLeads(leads);
    },
    [leads]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveLead(null);
      setIsDraggingAny(false);

      if (!over) return;

      // over.id == "column-{stage}"
      const targetStage = String(over.id).replace(/^column-/, "");
      if (!PIPELINE_STAGES.includes(targetStage as (typeof PIPELINE_STAGES)[number])) return;

      const draggedId = String(active.id);
      const draggedLead = localLeads.find(
        (l) => String(l.Id || l.id) === draggedId
      );
      if (!draggedLead) return;

      const currentStage =
        draggedLead.conversion_status ||
        draggedLead.Conversion_Status ||
        "New";

      if (currentStage === targetStage) return; // same column – no-op

      // Optimistic UI update
      setLocalLeads((prev) =>
        prev.map((l) =>
          String(l.Id || l.id) === draggedId
            ? {
                ...l,
                conversion_status: targetStage,
                Conversion_Status: targetStage,
              }
            : l
        )
      );

      // Persist via parent callback → API
      onLeadMove?.(draggedLead.Id ?? draggedLead.id, targetStage);
    },
    [localLeads, onLeadMove]
  );

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
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex gap-3 overflow-x-auto pb-4 px-1 -mx-1"
        data-testid="kanban-board"
      >
        {PIPELINE_STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            leads={groupedLeads[stage]}
            leadTagsMap={leadTagsMap}
            isCollapsed={collapsedStages.has(stage)}
            onToggleCollapse={toggleColumnCollapse}
          />
        ))}
      </div>

      {/* Ghost card that follows the cursor during drag */}
      <DragOverlay dropAnimation={null}>
        {activeLead ? (
          <div className="w-[260px]">
            <KanbanCardContent
              lead={activeLead}
              isDragging
              cardTags={
                leadTagsMap?.get(Number(activeLead.Id || activeLead.id)) || []
              }
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
