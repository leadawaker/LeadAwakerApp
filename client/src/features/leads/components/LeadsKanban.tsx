import { useMemo, useState, useCallback, useEffect } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import {
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  AlertCircle,
  MapPin,
  Brain,
  Star,
  FileText,
  Activity,
  ArrowUpDown,
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

/* ─────────── Card content (reused by draggable card + drag overlay) ─────────── */

function KanbanCardContent({
  lead,
  isDragging = false,
}: {
  lead: any;
  isDragging?: boolean;
}) {
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
      className={cn(
        "rounded-xl border border-border bg-card p-3 shadow-sm transition-all duration-200",
        isDragging
          ? "shadow-xl ring-2 ring-brand-blue/40 opacity-95 rotate-1 scale-105"
          : "hover:shadow-md group"
      )}
    >
      {/* Header: Avatar + Name + Priority */}
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center text-xs font-bold flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate text-foreground">
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

/* ─────────── Sentiment color helper ─────────── */

function sentimentColor(sentiment: string | undefined) {
  switch (sentiment?.toLowerCase()) {
    case "positive":
      return "text-emerald-600 dark:text-emerald-400";
    case "negative":
      return "text-rose-600 dark:text-rose-400";
    case "neutral":
      return "text-amber-600 dark:text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

/* ─────────── Hover Popover Content ─────────── */

function LeadHoverPreview({ lead }: { lead: any }) {
  const name =
    lead.full_name ||
    `${lead.first_name || ""} ${lead.last_name || ""}`.trim() ||
    "Unknown";

  const email = lead.email || lead.Email;
  const phone = lead.phone;
  const source = lead.Source || lead.source;
  const notes = lead.notes;
  const sentiment = lead.ai_sentiment;
  const automationStatus = lead.automation_status;
  const bumpStage = lead.current_bump_stage;
  const msgSent = lead.message_count_sent;
  const msgReceived = lead.message_count_received;
  const score = lead.lead_score ?? lead.leadScore;

  const hasDetails =
    email ||
    phone ||
    source ||
    notes ||
    sentiment ||
    automationStatus ||
    bumpStage != null ||
    msgSent != null ||
    score != null;

  return (
    <div
      className="p-4 space-y-3 w-72"
      data-testid={`kanban-card-popover-${lead.Id || lead.id}`}
    >
      {/* Header */}
      <div className="border-b border-border/50 pb-2.5">
        <div className="font-semibold text-sm text-foreground">{name}</div>
        {lead.Account && lead.Account !== "Unknown Account" && (
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {lead.Account}
          </div>
        )}
      </div>

      {!hasDetails && (
        <p className="text-xs text-muted-foreground italic">
          No additional info available.
        </p>
      )}

      {/* Contact fields */}
      <div className="space-y-1.5">
        {email && (
          <div className="flex items-start gap-2 text-xs">
            <Mail className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground/70" />
            <span className="break-all text-foreground/90">{email}</span>
          </div>
        )}
        {phone && (
          <div className="flex items-center gap-2 text-xs">
            <Phone className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/70" />
            <span className="text-foreground/90">{phone}</span>
          </div>
        )}
        {source && (
          <div className="flex items-center gap-2 text-xs">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/70" />
            <span className="text-foreground/90">{source}</span>
          </div>
        )}
      </div>

      {/* Score + Sentiment row */}
      {(score != null || sentiment) && (
        <div className="flex items-center gap-3">
          {score != null && (
            <div className="flex items-center gap-1.5 text-xs">
              <Star className="h-3.5 w-3.5 text-brand-yellow" />
              <span className="font-medium text-foreground/90">
                Score: {score}
              </span>
            </div>
          )}
          {sentiment && (
            <div className="flex items-center gap-1.5 text-xs">
              <Brain className="h-3.5 w-3.5 text-muted-foreground/70" />
              <span className={cn("font-medium capitalize", sentimentColor(sentiment))}>
                {sentiment}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Activity stats */}
      {(msgSent != null || msgReceived != null || bumpStage != null) && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {(msgSent != null || msgReceived != null) && (
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5 opacity-70" />
              <span>
                {msgSent ?? 0} sent / {msgReceived ?? 0} rcvd
              </span>
            </div>
          )}
          {bumpStage != null && bumpStage > 0 && (
            <div className="flex items-center gap-1">
              <ArrowUpDown className="h-3.5 w-3.5 opacity-70" />
              <span>Bump {bumpStage}</span>
            </div>
          )}
        </div>
      )}

      {/* Automation status */}
      {automationStatus && (
        <div className="flex items-center gap-2 text-xs">
          <Activity className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/70" />
          <span className="text-foreground/80 capitalize">{automationStatus}</span>
        </div>
      )}

      {/* Notes */}
      {notes && (
        <div className="border-t border-border/50 pt-2.5">
          <div className="flex items-start gap-2 text-xs">
            <FileText className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground/70" />
            <p className="text-muted-foreground leading-relaxed line-clamp-4 italic">
              {notes}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── Draggable Card wrapper ─────────── */

function KanbanLeadCard({ lead, isDraggingAny }: { lead: any; isDraggingAny?: boolean }) {
  const leadId = String(lead.Id || lead.id);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: leadId,
    data: { lead },
  });

  return (
    <HoverCard openDelay={700} closeDelay={100}>
      <HoverCardTrigger asChild>
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
          <KanbanCardContent lead={lead} />
        </div>
      </HoverCardTrigger>
      {/* Only render popover when not in a drag session to avoid z-index conflicts */}
      {!isDraggingAny && (
        <HoverCardContent
          className="p-0 shadow-lg"
          side="right"
          align="start"
          sideOffset={8}
        >
          <LeadHoverPreview lead={lead} />
        </HoverCardContent>
      )}
    </HoverCard>
  );
}

/* ─────────── Droppable Column ─────────── */

function KanbanColumn({
  stage,
  leads,
  isDraggingAny,
}: {
  stage: string;
  leads: any[];
  isDraggingAny?: boolean;
}) {
  const styles = STAGE_STYLES[stage] || DEFAULT_STYLE;
  const { setNodeRef, isOver } = useDroppable({ id: `column-${stage}` });

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border min-w-[260px] w-[280px] max-w-[300px] flex-shrink-0 transition-colors duration-150",
        isOver
          ? styles.dragOver
          : cn(styles.bg, styles.border)
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
            leads.map((lead) => (
              <KanbanLeadCard
                key={lead.Id || lead.id}
                lead={lead}
                isDraggingAny={isDraggingAny}
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
  /** When set, used for context but stages are derived from lead data */
  campaignId?: string;
  /** Called when a card is dropped into a different column; triggers the API update */
  onLeadMove?: (leadId: number | string, newStage: string) => void;
  /** Extra map of tags per lead (not used in kanban but accepted for API compat) */
  leadTagsMap?: Map<number, { name: string; color: string }[]>;
}

export function LeadsKanban({ leads, loading, onLeadMove }: LeadsKanbanProps) {
  // Local optimistic copy of leads so visual updates are instant
  const [localLeads, setLocalLeads] = useState<any[]>(leads);
  const [activeLead, setActiveLead] = useState<any | null>(null);
  const [isDraggingAny, setIsDraggingAny] = useState(false);

  // Sync with parent when not dragging (covers initial load and external refreshes)
  useEffect(() => {
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
            isDraggingAny={isDraggingAny}
          />
        ))}
      </div>

      {/* Ghost card that follows the cursor during drag */}
      <DragOverlay dropAnimation={null}>
        {activeLead ? (
          <div className="w-[260px]">
            <KanbanCardContent lead={activeLead} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
