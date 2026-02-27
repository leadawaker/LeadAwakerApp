import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
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
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { getLeadStatusAvatarColor, getInitials as getInitialsUtil, PIPELINE_HEX as PIPELINE_HEX_UTIL } from "@/lib/avatarUtils";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import {
  Phone,
  Mail,
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
  Zap,
  TrendingUp,
  ArrowUpRight,
  CheckCircle2,
  Calendar as CalendarIcon,
  Target,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/* ── Card stagger animation variants ── */
const staggerContainerVariants = {
  hidden: {},
  visible: (count: number) => ({
    transition: {
      staggerChildren: Math.min(1 / Math.max(count, 1), 0.08),
    },
  }),
};
const staggerItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

/* ─────────── Pipeline column configuration ─────────── */

const PIPELINE_STAGES = [
  "New",
  "Contacted",
  "Responded",
  "Multiple Responses",
  "Qualified",
  "Booked",
  "Closed",
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
  Closed: "Closed",
  Lost: "Lost",
  DND: "DND",
};

// PIPELINE_HEX moved to @/lib/avatarUtils
const PIPELINE_HEX = PIPELINE_HEX_UTIL;

/** Icon for each pipeline stage — matches dashboard sales pipeline */
const STAGE_ICONS: Record<string, LucideIcon> = {
  New:                  Zap,
  Contacted:            MessageSquare,
  Responded:            TrendingUp,
  "Multiple Responses": ArrowUpRight,
  Qualified:            CheckCircle2,
  Booked:               CalendarIcon,
  Closed:               ShieldCheck,
  Lost:                 HeartCrack,
  DND:                  Target,
};

/** Background fill color for stage icon circles */
const STAGE_ICON_BG: Record<string, string> = {
  New:                  "#6B7280",
  Contacted:            "#4F46E5",
  Responded:            "#14B8A6",
  "Multiple Responses": "#22C55E",
  Qualified:            "#84CC16",
  Booked:               "#FCB803",
  Closed:               "#10b981",
  Lost:                 "#ef4444",
  DND:                  "#71717A",
};
/** Text color on the stage icon circle */
const STAGE_ICON_TEXT: Record<string, string> = {
  Booked: "#131B49",
};
const DEFAULT_ICON_TEXT = "#ffffff";

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
  Closed:               { message: "No closed deals yet",        hint: "Completed bookings will appear here",                    icon: Trophy       },
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

/* ─────────── Score ring — SVG progress arc ─────────── */

const RING_SIZE   = 34;
const RING_STROKE = 2.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE * 2) / 2;
const RING_CIRC   = 2 * Math.PI * RING_RADIUS;

function ScoreRing({ score, status }: { score: number; status: string }) {
  const color  = PIPELINE_HEX[status] || "#6B7280";
  const offset = RING_CIRC * (1 - Math.max(0, Math.min(1, score / 100)));

  return (
    <div
      className="relative shrink-0"
      style={{ width: RING_SIZE, height: RING_SIZE }}
      data-testid="kanban-card-score"
      title={`Lead score: ${score}`}
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        className="absolute inset-0"
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* track */}
        <circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeOpacity={0.15}
          strokeWidth={RING_STROKE}
        />
        {/* progress arc */}
        <circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={RING_STROKE}
          strokeDasharray={RING_CIRC}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold tabular-nums" style={{ color }}>
          {score}
        </span>
      </div>
    </div>
  );
}

/* ─────────── Data helpers ─────────── */

function getFullName(lead: any): string {
  return lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
}

// getInitials moved to @/lib/avatarUtils
const getInitials = getInitialsUtil;

function getScore(lead: any): number {
  return Number(lead.lead_score ?? lead.leadScore ?? lead.Lead_Score ?? 0);
}

function getStatus(lead: any): string {
  return lead.conversion_status || lead.Conversion_Status || "New";
}

function getPhone(lead: any): string {
  return lead.phone || lead.Phone || "";
}

function getEmail(lead: any): string {
  return lead.email || lead.Email || "";
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

function getAgingTextClass(dateStr: string | null | undefined): string {
  if (!dateStr) return "text-muted-foreground/60";
  try {
    const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
    if (diffDays > 20) return "text-red-400/80";
    if (diffDays > 6) return "text-amber-500/80";
  } catch { /* ignore */ }
  return "text-muted-foreground/60";
}

/* ─────────── Card content — matches LeadListCard from LeadsCardView ─────────── */

interface KanbanCardContentProps {
  lead: any;
  isDragging?: boolean;
  isSelected?: boolean;
  cardTags?: { name: string; color: string }[];
  showTagsAlways?: boolean;
}

function KanbanCardContent({
  lead,
  isDragging = false,
  isSelected = false,
  cardTags,
  showTagsAlways = false,
}: KanbanCardContentProps) {
  const name        = getFullName(lead);
  const initials    = getInitials(name);
  const status      = getStatus(lead);
  const score       = getScore(lead);
  const phone       = getPhone(lead);
  const email       = getEmail(lead);
  const lastMessage = getLastMessage(lead);
  const avatarColor = getLeadStatusAvatarColor(status);
  const statusHex   = PIPELINE_HEX[status] || "#6B7280";
  const lastActivity = lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at;
  const visibleTags  = (cardTags || []).slice(0, 3);

  return (
    <div
      className={cn(
        "group/card relative mx-0.5 my-0.5 rounded-xl transition-shadow duration-150",
        isSelected
          ? "bg-highlight-selected"
          : "bg-white hover:bg-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
        isDragging && "scale-[1.02] rotate-1 opacity-95"
      )}
    >
      <div className="px-2.5 pt-2 pb-1.5 flex flex-col gap-0.5">

        {/* Row 1: Avatar | Name + status | Right: ScoreRing + lastActivity */}
        <div className="flex items-start gap-2">
          {/* Avatar */}
          <EntityAvatar
            name={name}
            bgColor={avatarColor.bg}
            textColor={avatarColor.text}
            className="mt-0.5"
          />

          {/* Name + conversion status dot */}
          <div className="flex-1 min-w-0 pt-0.5">
            <p
              className="text-[16px] font-semibold font-heading leading-tight truncate text-foreground"
              data-testid="kanban-card-name"
            >
              {name}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: statusHex }}
              />
              <span className="text-[10px] text-muted-foreground/65 truncate">{status}</span>
            </div>
          </div>

          {/* Right column: ScoreRing (top) + lastActivity (below) */}
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            {score > 0 && <ScoreRing score={score} status={status} />}
            {lastActivity && (
              <span
                className={`text-[10px] tabular-nums leading-none ${getAgingTextClass(lastActivity)}`}
                data-testid="kanban-card-last-activity"
              >
                {formatRelativeDate(lastActivity)}
              </span>
            )}
          </div>
        </div>

        {/* Hover-expanded (or always-on when showTagsAlways): last message → tags → phone/email */}
        <div className={cn(
          "overflow-hidden transition-[max-height,opacity] duration-200 ease-out",
          showTagsAlways
            ? "max-h-36 opacity-100"
            : "max-h-0 opacity-0 group-hover/card:max-h-36 group-hover/card:opacity-100"
        )}>
          <div className="pt-1.5 pb-0.5 flex flex-col gap-1.5">

            {/* Last message — one truncated line */}
            {lastMessage && (
              <p
                className="text-[11px] text-muted-foreground/65 truncate leading-snug"
                data-testid="kanban-card-last-message"
              >
                {lastMessage}
              </p>
            )}

            {/* Tags */}
            {visibleTags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {visibleTags.map((t) => (
                  <span
                    key={t.name}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium bg-black/[0.06] text-foreground/55"
                    data-testid="kanban-card-tags"
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            )}

            {/* Phone + email */}
            {(phone || email) && (
              <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground/70">
                {phone && (
                  <span className="inline-flex items-center gap-1 truncate">
                    <Phone className="h-3 w-3 shrink-0" />
                    {phone}
                  </span>
                )}
                {email && (
                  <span className="inline-flex items-center gap-1 truncate">
                    <Mail className="h-3 w-3 shrink-0" />
                    {email}
                  </span>
                )}
              </div>
            )}
          </div>
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
  showTagsAlways,
}: {
  lead: any;
  cardTags?: { name: string; color: string }[];
  onCardClick?: (lead: any) => void;
  isSelected?: boolean;
  showTagsAlways?: boolean;
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
        showTagsAlways={showTagsAlways}
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
  showTagsAlways,
}: {
  stage: string;
  leads: any[];
  leadTagsMap?: Map<number, { name: string; color: string }[]>;
  isCollapsed?: boolean;
  onToggleCollapse?: (stage: string) => void;
  onCardClick?: (lead: any) => void;
  selectedLeadId?: number | string;
  showTagsAlways?: boolean;
}) {
  const hex = PIPELINE_HEX[stage] || "#6B7280";
  const iconBg = STAGE_ICON_BG[stage] || hex;
  const iconText = STAGE_ICON_TEXT[stage] || DEFAULT_ICON_TEXT;
  const StageIcon = STAGE_ICONS[stage] || AlertCircle;
  const { setNodeRef, isOver } = useDroppable({ id: `column-${stage}` });
  const isBookedStage = stage === "Booked";
  const isDarkColumn = stage === "Lost" || stage === "DND";
  const [isBodyScrolled, setIsBodyScrolled] = useState(false);

  /* ── Infinite scroll state ── */
  const [visibleCount, setVisibleCount] = useState(COLUMN_BATCH_SIZE);

  useEffect(() => {
    setVisibleCount(COLUMN_BATCH_SIZE);
  }, [stage, leads.length]);

  // Load more is triggered by button click — no IntersectionObserver needed

  const visibleLeads    = leads.slice(0, visibleCount);
  const hasMore         = visibleCount < leads.length;
  const remainingCount  = leads.length - visibleCount;

  /* ── Collapsed state ── */
  if (isCollapsed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center rounded-lg w-10 min-w-[40px] flex-shrink-0 cursor-pointer select-none h-full overflow-hidden",
          isDarkColumn ? "bg-[#C5C5C5]" : "bg-muted"
        )}
        data-testid={`kanban-column-${stage}`}
        data-collapsed="true"
        title={`${STAGE_LABELS[stage] ?? stage} (${leads.length}) — click to expand`}
        onClick={() => onToggleCollapse?.(stage)}
      >
        {/* Top section: expand arrow + icon + title + count — all at the TOP */}
        <div className="pt-2 pb-1 flex flex-col items-center gap-1.5 w-full">
          <ChevronRight
            className="h-3.5 w-3.5 text-muted-foreground shrink-0"
            data-testid={`kanban-column-expand-${stage}`}
          />
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: iconBg, color: iconText }}
          >
            <StageIcon className="h-3 w-3" />
          </div>
          <span
            className="text-[10px] font-bold tabular-nums shrink-0"
            style={{ color: hex }}
            data-testid={`kanban-column-count-${stage}`}
          >
            {leads.length}
          </span>
        </div>
        <div className="flex-1 flex items-start pt-1">
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
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg flex-shrink-0 overflow-hidden h-full",
        isDarkColumn ? "bg-[#C5C5C5]" : isBookedStage ? "bg-[#FFFBEB]" : "bg-card",
        isBookedStage
          ? "min-w-[280px] w-[300px] max-w-[320px] border-l-2 border-[#FCB803]/50"
          : "min-w-[260px] w-[280px] max-w-[300px]",
        isOver && "ring-2 ring-inset ring-brand-indigo/50"
      )}
      data-testid={`kanban-column-${stage}`}
      data-stage={stage}
      data-collapsed="false"
      data-visible-count={visibleCount}
      data-total-count={leads.length}
    >
      {/* Column Header — icon + label */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2.5 shrink-0 transition-shadow duration-150",
          isBookedStage && "bg-[#FCB803]/10",
          isBodyScrolled && "shadow-[0_2px_6px_-1px_rgba(0,0,0,0.08)]"
        )}
        data-testid={`kanban-column-header-${stage}`}
      >
        {/* Stage icon circle */}
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: iconBg, color: iconText }}
        >
          <StageIcon className="h-3.5 w-3.5" />
        </div>

        {/* Stage label — colored text only */}
        <span
          className={cn("font-semibold text-sm truncate flex-1 flex items-center gap-1", isBookedStage && "font-bold text-base")}
          style={{ color: hex }}
        >
          {STAGE_LABELS[stage] ?? stage}
          {isBookedStage && (
            <Star className="h-3.5 w-3.5 fill-[#FCB803] text-[#FCB803] shrink-0" />
          )}
        </span>

        {/* Count — sits at the right edge now that collapse button is removed */}
        <span
          className="text-[11px] font-semibold text-muted-foreground/70 tabular-nums flex-shrink-0"
          data-testid={`kanban-column-count-${stage}`}
        >
          {leads.length}
        </span>
      </div>

      {/* Column Body — drop target covers the list area */}
      <div
        className={cn("flex-1 overflow-y-auto min-h-0", isOver && "bg-brand-indigo/[0.04]")}
        onScroll={(e) => setIsBodyScrolled(e.currentTarget.scrollTop > 2)}
      >
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
                    <ChevronRight className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
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
                        <Icon className="h-4 w-4 text-muted-foreground/40" />
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
            <motion.div
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              custom={visibleLeads.length}
            >
              {visibleLeads.map((lead) => {
                const leadId   = Number(lead.Id || lead.id);
                const cardTags = leadTagsMap?.get(leadId) || [];
                const isSelected = selectedLeadId !== undefined &&
                  (lead.Id ?? lead.id) === selectedLeadId;
                return (
                  <motion.div key={lead.Id || lead.id} variants={staggerItemVariants}>
                    <KanbanLeadCard
                      lead={lead}
                      cardTags={cardTags}
                      onCardClick={onCardClick}
                      isSelected={isSelected}
                      showTagsAlways={showTagsAlways}
                    />
                  </motion.div>
                );
              })}

              {/* Load more button */}
              {hasMore && (
                <div className="py-2 px-1">
                  <button
                    onClick={() =>
                      setVisibleCount((prev) =>
                        Math.min(prev + COLUMN_BATCH_SIZE, leads.length)
                      )
                    }
                    data-testid={`kanban-column-load-more-${stage}`}
                    className="w-full h-8 rounded-lg text-xs font-medium text-muted-foreground border border-border/50 bg-transparent hover:bg-card hover:text-foreground transition-colors"
                  >
                    Load {Math.min(remainingCount, COLUMN_BATCH_SIZE)} more
                  </button>
                </div>
              )}
            </motion.div>
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
  /** Fold action from parent: { type, seq } — seq increments trigger the action */
  foldAction?: { type: "expand-all" | "fold-empty" | "fold-threshold"; threshold?: number; seq: number };
  /** Reports whether any columns are currently collapsed */
  onCollapsedChange?: (hasAny: boolean) => void;
  /** When true, tags/message/contact info are always visible on cards (not just on hover) */
  showTagsAlways?: boolean;
}

export function LeadsKanban({
  leads,
  loading,
  onLeadMove,
  leadTagsMap,
  onCardClick,
  selectedLeadId,
  foldAction,
  onCollapsedChange,
  showTagsAlways,
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

  // Report collapsed state to parent
  useEffect(() => {
    onCollapsedChange?.(collapsedStages.size > 0);
  }, [collapsedStages, onCollapsedChange]);

  // React to fold actions from parent
  const lastFoldSeqRef = useRef(0);
  useEffect(() => {
    if (!foldAction || foldAction.seq === 0 || foldAction.seq === lastFoldSeqRef.current) return;
    lastFoldSeqRef.current = foldAction.seq;

    if (foldAction.type === "expand-all") {
      setCollapsedStages((prev) => {
        if (prev.size === 0) return prev;
        try { localStorage.setItem("kanban_collapsed_stages", "[]"); } catch {}
        return new Set<string>();
      });
    } else if (foldAction.type === "fold-empty") {
      // Fold all stages that have 0 leads
      setCollapsedStages((_prev) => {
        const emptyStages = new Set<string>();
        for (const stage of PIPELINE_STAGES) {
          const stageLeads = localLeads.filter((l) => {
            const s = l.conversion_status || l.Conversion_Status || "New";
            return s === stage;
          });
          if (stageLeads.length === 0) emptyStages.add(stage);
        }
        try { localStorage.setItem("kanban_collapsed_stages", JSON.stringify(Array.from(emptyStages))); } catch {}
        return emptyStages;
      });
    } else if (foldAction.type === "fold-threshold") {
      // Fold all stages with this many leads or fewer (≤ threshold)
      const threshold = foldAction.threshold ?? 0;
      setCollapsedStages((_prev) => {
        const stagesToFold = new Set<string>();
        for (const stage of PIPELINE_STAGES) {
          const count = localLeads.filter((l) => {
            const s = l.conversion_status || l.Conversion_Status || "New";
            return s === stage;
          }).length;
          if (count <= threshold) stagesToFold.add(stage);
        }
        try { localStorage.setItem("kanban_collapsed_stages", JSON.stringify(Array.from(stagesToFold))); } catch {}
        return stagesToFold;
      });
    }
  }, [foldAction, localLeads]);

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

      const movedLeadId = draggedLead.Id ?? draggedLead.id;
      const originalStage = currentStage;
      let undoUsed = false;

      const { dismiss: dismissUndoToast } = toast({
        title: "Lead moved",
        description: `Moved to ${STAGE_LABELS[targetStage] ?? targetStage}`,
        duration: 4000,
        action: (
          <ToastAction
            altText="Undo"
            onClick={() => {
              undoUsed = true;
              dismissUndoToast();
              setLocalLeads(snapshotRef.current);
              onLeadMove?.(movedLeadId, originalStage);
            }}
          >
            Undo
          </ToastAction>
        ),
      });

      const result = onLeadMove?.(movedLeadId, targetStage);
      if (result instanceof Promise) {
        result.catch(() => {
          if (!undoUsed) {
            dismissUndoToast();
            setLocalLeads(snapshotRef.current);
            toast({
              title: "Couldn't move lead",
              description: "Status reverted — check your connection",
              variant: "destructive",
              duration: 4000,
            });
          }
        });
      }
    },
    [localLeads, onLeadMove]
  );

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div
        className="flex gap-[3px] overflow-x-auto pb-4 scroll-smooth"
        style={{ overscrollBehaviorX: "contain" } as React.CSSProperties}
        data-testid="kanban-loading-skeleton"
      >
        {PIPELINE_STAGES.map((stage) => {
          const SkelIcon = STAGE_ICONS[stage] || AlertCircle;
          const skelBg = STAGE_ICON_BG[stage] || "#6B7280";
          return (
            <div
              key={stage}
              className="flex flex-col bg-card rounded-lg min-w-[260px] w-[280px] flex-shrink-0 "
              data-testid="kanban-skeleton-column"
            >
              {/* Header skeleton */}
              <div className="px-3 py-2.5 flex items-center gap-2">
                <div
                  className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center opacity-40"
                  style={{ backgroundColor: skelBg }}
                >
                  <SkelIcon className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="h-3.5 bg-foreground/10 animate-pulse rounded flex-1 max-w-[5rem]" />
                <div className="h-3 w-5 bg-foreground/8 animate-pulse rounded shrink-0" />
              </div>
              {/* Card skeletons */}
              <div className="px-[3px] pb-2 space-y-0">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="mx-0.5 my-0.5 rounded-xl bg-white/70 px-2.5 pt-2 pb-1.5 space-y-1.5 animate-pulse"
                    data-testid="kanban-skeleton-card"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-foreground/10 shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-foreground/10 rounded-full w-3/4" />
                        <div className="h-2 bg-foreground/8 rounded-full w-1/2" />
                      </div>
                      <div className="h-10 w-10 rounded-full bg-foreground/10 shrink-0" />
                    </div>
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
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Horizontal scroll container */}
      <div
        className="flex h-full gap-[3px] overflow-x-auto pb-0 scroll-smooth"
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
            showTagsAlways={showTagsAlways}
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
