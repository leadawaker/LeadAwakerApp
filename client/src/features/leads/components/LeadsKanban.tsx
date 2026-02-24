import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  MeasuringStrategy,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import { getEventCoordinates } from "@dnd-kit/utilities";

/** Snaps the ghost card's center to the cursor so it tracks right under the pointer */
const snapCenterToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (draggingNodeRect && activatorEvent) {
    const coords = getEventCoordinates(activatorEvent);
    if (!coords) return transform;
    return {
      ...transform,
      x: transform.x + draggingNodeRect.width / 2 - (coords.x - draggingNodeRect.left),
      y: transform.y + draggingNodeRect.height / 2 - (coords.y - draggingNodeRect.top),
    };
  }
  return transform;
};
import { cn } from "@/lib/utils";
import { getStatusAvatarColor } from "./LeadsCardView";
import {
  Phone,
  ChevronLeft,
  ChevronRight,
  Users,
  PhoneCall,
  MessageCircle,
  MessageSquare,
  Star,
  Trophy,
  BanIcon,
  HeartCrack,
  AlertCircle,
} from "lucide-react";

/* ─────────── Pipeline column configuration ─────────── */

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

/** Hex color for each pipeline stage — used for title text and the stage dot */
const PIPELINE_HEX: Record<string, string> = {
  New:                  "#6B7280",
  Contacted:            "#5170FF",
  Responded:            "#14B8A6",
  "Multiple Responses": "#22C55E",
  Qualified:            "#84CC16",
  Booked:               "#FCB803",
  Lost:                 "#EF4444",
  DND:                  "#71717A",
};

/* ─────────── Contextual empty state messages per pipeline stage ─────────── */

type EmptyStateConfig = {
  message: string;
  hint: string;
  icon: React.FC<{ className?: string }>;
};

const STAGE_EMPTY_STATES: Record<string, EmptyStateConfig> = {
  New:                  { message: "No new leads yet",          hint: "Import contacts or add a lead to get started",            icon: Users        },
  Contacted:            { message: "No contacted leads",         hint: "Reach out to new leads to move them here",                icon: PhoneCall    },
  Responded:            { message: "No leads have responded",    hint: "Keep following up — responses will appear here",          icon: MessageCircle },
  "Multiple Responses": { message: "No active conversations",    hint: "Engage with your contacted leads to build dialogue",      icon: MessageSquare },
  Qualified:            { message: "No qualified leads yet",     hint: "Qualify promising conversations to fill this stage",      icon: Star         },
  Booked:               { message: "No calls booked yet",        hint: "This is your north-star goal — keep pushing!",           icon: Trophy       },
  Lost:                 { message: "No lost leads",              hint: "Great! All your leads are still in the pipeline",         icon: HeartCrack   },
  DND:                  { message: "No leads on DND",            hint: "Leads who opt out will appear here",                      icon: BanIcon      },
};

const DEFAULT_EMPTY_STATE: EmptyStateConfig = {
  message: "No leads in this stage",
  hint: "Drag leads here to move them into this stage",
  icon: AlertCircle,
};

/* ─────────── Infinite scroll batch size ─────────── */
const COLUMN_BATCH_SIZE = 20;

/* ─────────── Score color helpers (same as LeadsCardView) ─────────── */

function getScorePastelBg(score: number): string {
  const t = Math.max(0, Math.min(1, score / 100));
  const h = Math.round(229 - t * (229 - 45));
  return `hsl(${h}, 55%, 88%)`;
}

function getScoreDarkText(score: number): string {
  const t = Math.max(0, Math.min(1, score / 100));
  const h = Math.round(229 - t * (229 - 45));
  return `hsl(${h}, 75%, 36%)`;
}

/* ─────────── Data helpers ─────────── */

function getFullName(lead: any): string {
  return lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
}

function getInitials(name: string): string {
  return name.split(" ").map((w: string) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

function getScore(lead: any): number {
  return Number(lead.lead_score ?? lead.leadScore ?? lead.Lead_Score ?? 0);
}

function getStatus(lead: any): string {
  return lead.conversion_status || lead.Conversion_Status || "New";
}

function getPhone(lead: any): string {
  return lead.phone || lead.Phone || "";
}

function getLastMessage(lead: any): string {
  return lead.last_message || lead.last_message_received || lead.last_reply || lead.last_message_sent || "";
}

function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      const h = Math.floor(diffMs / 3_600_000);
      return h === 0 ? "Now" : `${h}h ago`;
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  } catch {
    return "";
  }
}

/* ─────────── Card content — matches LeadListCard from LeadsCardView ─────────── */

interface KanbanCardContentProps {
  lead: any;
  isDragging?: boolean;
  isSelected?: boolean;
  cardTags?: { name: string; color: string }[];
}

function KanbanCardContent({
  lead,
  isDragging = false,
  isSelected = false,
  cardTags,
}: KanbanCardContentProps) {
  const name       = getFullName(lead);
  const initials   = getInitials(name);
  const status     = getStatus(lead);
  const score      = getScore(lead);
  const phone      = getPhone(lead);
  const lastMsg    = getLastMessage(lead);
  const avatarColor  = getStatusAvatarColor(status);
  const lastActivity = lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at;
  const visibleTags  = (cardTags || []).slice(0, 2);

  return (
    <div
      className={cn(
        "relative mx-0.5 my-0.5 rounded-xl transition-colors",
        isSelected
          ? "bg-[#FFF6C8]"
          : "bg-white hover:bg-white",
        isDragging && "scale-[1.02] rotate-1 opacity-95"
      )}
    >
      <div className="px-2.5 pt-2.5 pb-2 flex flex-col gap-1.5">

        {/* Phone icon — absolute top-right with tooltip on hover */}
        {phone && (
          <div className="absolute top-2.5 right-2.5 group/phone z-10">
            <div className="h-7 w-7 rounded-full border border-border/50 flex items-center justify-center bg-background/40">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="absolute right-0 bottom-9 z-20 hidden group-hover/phone:block">
              <div className="bg-popover text-foreground text-[11px] px-2.5 py-1.5 rounded-lg shadow-md whitespace-nowrap">
                {phone}
              </div>
            </div>
          </div>
        )}

        {/* Row 1: Avatar + Name */}
        <div className="flex items-start gap-2 pr-8">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
            style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p
              className="text-[13px] font-semibold font-heading leading-tight truncate text-foreground"
              data-testid="kanban-card-name"
            >
              {name}
            </p>
          </div>
        </div>

        {/* Row 2: Last message snippet */}
        {lastMsg && (
          <p className="text-[10px] text-muted-foreground truncate italic">
            {lastMsg}
          </p>
        )}

        {/* Row 3: Tags (left) | Time (middle) | Score circle (right) */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
            {visibleTags.map((t) => (
              <span
                key={t.name}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/[0.06] text-foreground/55"
                data-testid="kanban-card-tags"
              >
                {t.name}
              </span>
            ))}
          </div>

          {lastActivity && (
            <span
              className="text-[10px] text-muted-foreground/70 shrink-0 tabular-nums"
              data-testid="kanban-card-last-activity"
            >
              {formatRelativeDate(lastActivity)}
            </span>
          )}

          {score > 0 && (
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-bold tabular-nums shrink-0"
              style={
                isSelected
                  ? { backgroundColor: "#000", color: "#fff" }
                  : { backgroundColor: getScorePastelBg(score), color: getScoreDarkText(score) }
              }
              data-testid="kanban-card-score"
              title={`Lead score: ${score}`}
            >
              {score}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

/* ─────────── Draggable Card wrapper ─────────── */

function KanbanLeadCard({
  lead,
  cardTags,
  onCardClick,
  isSelected,
}: {
  lead: any;
  cardTags?: { name: string; color: string }[];
  onCardClick?: (lead: any) => void;
  isSelected?: boolean;
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
      onClick={(e) => { e.stopPropagation(); onCardClick?.(lead); }}
      className={cn(
        "cursor-grab active:cursor-grabbing touch-none select-none",
        isDragging && "opacity-30"
      )}
    >
      <KanbanCardContent
        lead={lead}
        cardTags={cardTags}
        isSelected={isSelected}
      />
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
  onCardClick,
  selectedLeadId,
}: {
  stage: string;
  leads: any[];
  leadTagsMap?: Map<number, { name: string; color: string }[]>;
  isCollapsed?: boolean;
  onToggleCollapse?: (stage: string) => void;
  onCardClick?: (lead: any) => void;
  selectedLeadId?: number | string;
}) {
  const hex = PIPELINE_HEX[stage] || "#6B7280";
  const { setNodeRef, isOver } = useDroppable({ id: `column-${stage}` });
  const isBookedStage = stage === "Booked";

  /* ── Infinite scroll state ── */
  const [visibleCount, setVisibleCount] = useState(COLUMN_BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(COLUMN_BATCH_SIZE);
  }, [stage, leads.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || visibleCount >= leads.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + COLUMN_BATCH_SIZE, leads.length));
        }
      },
      { threshold: 0, rootMargin: "80px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, leads.length]);

  const visibleLeads    = leads.slice(0, visibleCount);
  const hasMore         = visibleCount < leads.length;
  const remainingCount  = leads.length - visibleCount;

  /* ── Collapsed state ── */
  if (isCollapsed) {
    return (
      <div
        className="flex flex-col items-center bg-muted rounded-lg w-10 flex-shrink-0 cursor-pointer select-none"
        data-testid={`kanban-column-${stage}`}
        data-collapsed="true"
        title={`${STAGE_LABELS[stage] ?? stage} (${leads.length}) — click to expand`}
        onClick={() => onToggleCollapse?.(stage)}
      >
        <div className="py-2 flex items-center justify-center w-full">
          <ChevronRight
            className="h-4 w-4 text-muted-foreground"
            data-testid={`kanban-column-expand-${stage}`}
          />
        </div>
        <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: hex }} />
        <div className="flex-1 flex items-center justify-center py-3">
          <span
            className="font-semibold text-[11px]"
            style={{
              color: hex,
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              transform: "rotate(180deg)",
              whiteSpace: "nowrap",
            }}
          >
            {STAGE_LABELS[stage] ?? stage}
          </span>
        </div>
        <span
          className="mb-2 text-[10px] font-semibold text-muted-foreground/70 tabular-nums"
          data-testid={`kanban-column-count-${stage}`}
        >
          {leads.length}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-card rounded-lg flex-shrink-0 overflow-hidden snap-start snap-always h-full",
        isBookedStage
          ? "min-w-[280px] w-[300px] max-w-[320px]"
          : "min-w-[260px] w-[280px] max-w-[300px]",
        isOver && "ring-2 ring-inset ring-border/40"
      )}
      data-testid={`kanban-column-${stage}`}
      data-stage={stage}
      data-collapsed="false"
      data-visible-count={visibleCount}
      data-total-count={leads.length}
    >
      {/* Column Header — only the text is colored */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 shrink-0"
        data-testid={`kanban-column-header-${stage}`}
      >
        {/* Stage color dot */}
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: hex }} />

        {/* Stage label — colored text only */}
        <span
          className={cn("font-semibold text-sm truncate flex-1", isBookedStage && "font-bold")}
          style={{ color: hex }}
        >
          {STAGE_LABELS[stage] ?? stage}
          {isBookedStage && (
            <span className="ml-1 text-[10px] font-bold tracking-wide">★</span>
          )}
        </span>

        {/* Count */}
        <span
          className="text-[11px] font-semibold text-muted-foreground/70 tabular-nums flex-shrink-0"
          data-testid={`kanban-column-count-${stage}`}
        >
          {leads.length}
        </span>

        {/* Collapse button */}
        <button
          onClick={() => onToggleCollapse?.(stage)}
          data-testid={`kanban-column-collapse-${stage}`}
          title="Collapse column"
          className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-background/40 flex-shrink-0"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Column Body — drop target covers the list area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div ref={setNodeRef} className="px-[3px] pb-2 min-h-[80px]">
          {leads.length === 0 ? (
            <div
              className={cn(
                "flex flex-col items-center justify-center py-10 px-3 rounded-lg select-none",
                isOver
                  ? "bg-background/30"
                  : "text-muted-foreground/40"
              )}
              data-testid={`kanban-column-empty-${stage}`}
              aria-label={`Empty stage: ${STAGE_LABELS[stage] ?? stage}`}
            >
              {isOver ? (
                <>
                  <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center mb-2">
                    <ChevronRight className="h-5 w-5 text-muted-foreground rotate-[-90deg]" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">Drop here</span>
                  <span className="text-xs text-muted-foreground/60 mt-1">
                    Move lead to {STAGE_LABELS[stage] ?? stage}
                  </span>
                </>
              ) : (
                (() => {
                  const config = STAGE_EMPTY_STATES[stage] || DEFAULT_EMPTY_STATE;
                  const Icon = config.icon;
                  return (
                    <>
                      <div className="h-10 w-10 rounded-full bg-muted/40 flex items-center justify-center mb-3">
                        <Icon className="h-5 w-5 text-muted-foreground/40" />
                      </div>
                      <span
                        className="text-xs font-medium text-muted-foreground/60 text-center leading-snug"
                        data-testid={`kanban-empty-message-${stage}`}
                      >
                        {config.message}
                      </span>
                      <span className="text-[11px] text-muted-foreground/40 text-center leading-snug mt-1 max-w-[180px]">
                        {config.hint}
                      </span>
                    </>
                  );
                })()
              )}
            </div>
          ) : (
            <>
              {visibleLeads.map((lead) => {
                const leadId   = Number(lead.Id || lead.id);
                const cardTags = leadTagsMap?.get(leadId) || [];
                const isSelected = selectedLeadId !== undefined &&
                  (lead.Id ?? lead.id) === selectedLeadId;
                return (
                  <KanbanLeadCard
                    key={lead.Id || lead.id}
                    lead={lead}
                    cardTags={cardTags}
                    onCardClick={onCardClick}
                    isSelected={isSelected}
                  />
                );
              })}

              {/* Sentinel for infinite scroll */}
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
      </div>
    </div>
  );
}

/* ─────────── Main Kanban Board ─────────── */

interface LeadsKanbanProps {
  leads: any[];
  loading?: boolean;
  campaignId?: string;
  onLeadMove?: (leadId: number | string, newStage: string) => void | Promise<void>;
  leadTagsMap?: Map<number, { name: string; color: string }[]>;
  onCardClick?: (lead: Record<string, any>) => void;
  selectedLeadId?: number | string;
}

export function LeadsKanban({
  leads,
  loading,
  onLeadMove,
  leadTagsMap,
  onCardClick,
  selectedLeadId,
}: LeadsKanbanProps) {
  const [localLeads, setLocalLeads]   = useState<any[]>(leads);
  const [activeLead, setActiveLead]   = useState<any | null>(null);
  const [isDraggingAny, setIsDraggingAny] = useState(false);
  const snapshotRef = useRef<any[]>([]);

  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("kanban_collapsed_stages");
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch { /* ignore */ }
    return new Set<string>();
  });

  const toggleColumnCollapse = useCallback((stage: string) => {
    setCollapsedStages((prev) => {
      const next = new Set(prev);
      next.has(stage) ? next.delete(stage) : next.add(stage);
      try {
        localStorage.setItem("kanban_collapsed_stages", JSON.stringify(Array.from(next)));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isDraggingAny) setLocalLeads(leads);
  }, [leads, isDraggingAny]);

  const groupedLeads = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const stage of PIPELINE_STAGES) groups[stage] = [];
    for (const lead of localLeads) {
      const status = lead.conversion_status || lead.Conversion_Status || "New";
      if (groups[status]) {
        groups[status].push(lead);
      } else {
        groups["New"].push(lead);
      }
    }
    return groups;
  }, [localLeads]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const lead = event.active.data.current?.lead ?? null;
      setActiveLead(lead);
      setIsDraggingAny(true);
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

      const targetStage = String(over.id).replace(/^column-/, "");
      if (!PIPELINE_STAGES.includes(targetStage as (typeof PIPELINE_STAGES)[number])) return;

      const draggedId   = String(active.id);
      const draggedLead = localLeads.find((l) => String(l.Id || l.id) === draggedId);
      if (!draggedLead) return;

      const currentStage = draggedLead.conversion_status || draggedLead.Conversion_Status || "New";
      if (currentStage === targetStage) return;

      snapshotRef.current = [...localLeads];

      setLocalLeads((prev) =>
        prev.map((l) =>
          String(l.Id || l.id) === draggedId
            ? { ...l, conversion_status: targetStage, Conversion_Status: targetStage }
            : l
        )
      );

      const result = onLeadMove?.(draggedLead.Id ?? draggedLead.id, targetStage);
      if (result instanceof Promise) {
        result.catch(() => setLocalLeads(snapshotRef.current));
      }
    },
    [localLeads, onLeadMove]
  );

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div
        className="flex gap-[3px] overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory"
        style={{ overscrollBehaviorX: "contain" } as React.CSSProperties}
        data-testid="kanban-loading-skeleton"
      >
        {PIPELINE_STAGES.map((stage) => (
          <div
            key={stage}
            className="flex flex-col bg-muted rounded-lg min-w-[260px] w-[280px] flex-shrink-0 snap-start snap-always"
            data-testid="kanban-skeleton-column"
          >
            {/* Header skeleton */}
            <div className="px-3 py-2.5 flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: PIPELINE_HEX[stage] || "#6B7280", opacity: 0.4 }}
              />
              <div className="h-3.5 bg-foreground/10 animate-pulse rounded flex-1 max-w-[5rem]" />
              <div className="h-3 w-5 bg-foreground/8 animate-pulse rounded shrink-0" />
            </div>
            {/* Card skeletons */}
            <div className="px-[3px] pb-2 space-y-0">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="mx-0.5 my-0.5 rounded-xl bg-[#F1F1F1] px-2.5 pt-2.5 pb-2 space-y-2 animate-pulse"
                  data-testid="kanban-skeleton-card"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="flex items-center gap-2 pr-8">
                    <div className="w-8 h-8 rounded-full bg-foreground/10 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-foreground/10 rounded-full w-3/4" />
                      <div className="h-2.5 bg-foreground/8 rounded-full w-1/2" />
                    </div>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <div className="h-4 w-12 bg-foreground/8 rounded-full" />
                    <div className="h-4 w-14 bg-foreground/8 rounded-full" />
                    <div className="ml-auto h-7 w-7 rounded-full bg-foreground/10" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Horizontal scroll container */}
      <div
        className="flex h-full gap-[3px] overflow-x-auto pb-0 scroll-smooth snap-x snap-mandatory"
        style={{ overscrollBehaviorX: "contain" } as React.CSSProperties}
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
            onCardClick={onCardClick}
            selectedLeadId={selectedLeadId}
          />
        ))}
      </div>

      {/* Ghost card that follows the cursor during drag */}
      <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
        {activeLead ? (
          <div className="w-[260px]">
            <KanbanCardContent
              lead={activeLead}
              isDragging
              cardTags={leadTagsMap?.get(Number(activeLead.Id || activeLead.id)) || []}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
