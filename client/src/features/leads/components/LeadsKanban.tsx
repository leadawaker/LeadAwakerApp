import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  XCircle,
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
  Booked: "Booked",
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
  Closed:               "#F59E0B",
  Lost:                 "#DC2626",
  DND:                  "#1a1a1a",
};
/** Text color on the stage icon circle */
const STAGE_ICON_TEXT: Record<string, string> = {
  Booked: "#131B49",
  Closed: "#1a1a1a",
  DND: "#ffffff",
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

/** Map a pipeline stage value to its i18n key suffix (e.g. "Multiple Responses" → "MultipleResponses") */
function stageKey(stage: string): string {
  return stage.replace(/\s+/g, "");
}

/* ─────────── Infinite scroll batch size ─────────── */
const COLUMN_BATCH_SIZE = 20;

/* ─────────── Score ring — SVG progress arc ─────────── */

const RING_SIZE   = 34;
const RING_STROKE = 2.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE * 2) / 2;
const RING_CIRC   = 2 * Math.PI * RING_RADIUS;

function ScoreRing({ score, status }: { score: number; status: string }) {
  const { t } = useTranslation("leads");
  const color  = PIPELINE_HEX[status] || "#6B7280";
  const offset = RING_CIRC * (1 - Math.max(0, Math.min(1, score / 100)));

  return (
    <div
      className="relative shrink-0"
      style={{ width: RING_SIZE, height: RING_SIZE }}
      data-testid="kanban-card-score"
      title={t("kanban.leadScore", { score })}
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

function formatRelativeDate(dateStr: string | null | undefined, t: (key: string, opts?: Record<string, any>) => string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      const h = Math.floor(diffMs / 3_600_000);
      return h === 0 ? t("relativeTime.justNow") : t("relativeTime.hoursAgo", { count: h });
    }
    if (diffDays === 1) return t("relativeTime.yesterday");
    if (diffDays < 7) return t("relativeTime.daysAgo", { count: diffDays });
    if (diffDays < 30) return t("relativeTime.weeksAgo", { count: Math.floor(diffDays / 7) });
    return t("relativeTime.monthsAgo", { count: Math.floor(diffDays / 30) });
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
  compactMode?: boolean;
  onMoveLead?: (leadId: number | string, newStage: string) => void | Promise<void>;
  /** Effective column width in px — drives card density */
  colWidth?: number;
}

function KanbanCardContent({
  lead,
  isDragging = false,
  isSelected = false,
  cardTags,
  showTagsAlways = false,
  compactMode = false,
  onMoveLead,
  colWidth = 280,
}: KanbanCardContentProps) {
  const { t } = useTranslation("leads");
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

  const isBookedStatus = status === "Booked";
  const isClosedStatus = status === "Closed";
  const bookedDate = lead.booked_call_date || lead.bookedCallDate;
  const bookedDatePassed = bookedDate ? new Date(bookedDate) < new Date() : false;
  const bookedDateStr = bookedDate
    ? new Date(bookedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;
  const isBookedToday = bookedDate
    ? new Date(bookedDate).toDateString() === new Date().toDateString()
    : false;

  // Closed/Booked action buttons (shared between compact and normal)
  const actionButtons = isBookedStatus && bookedDatePassed && (
    <div className="flex items-center gap-1">
      <button
        onClick={(e) => { e.stopPropagation(); onMoveLead?.(lead.Id || lead.id, "Closed"); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="h-5 w-5 rounded-full text-emerald-500 flex items-center justify-center hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
        title="Closed"
      >
        <CheckCircle2 className="h-4 w-4" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onMoveLead?.(lead.Id || lead.id, "Lost"); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="h-5 w-5 rounded-full text-red-400 flex items-center justify-center hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        title="Lost"
      >
        <XCircle className="h-4 w-4" />
      </button>
    </div>
  );

  // Score bar hidden for Booked (score=100) and Closed
  const showScoreBar = !isBookedStatus && !isClosedStatus && score > 0;

  // Compact density tiers — progressive avatar sizing
  const isUltraNarrow = compactMode && colWidth < 80;
  // Graduated avatar: none < 160, xs at 160, 24 at 200, 32 at 240
  const compactAvatarSize: number | "xs" | null = !compactMode ? null
    : colWidth < 160 ? null
    : colWidth < 200 ? "xs"
    : colWidth < 240 ? 24
    : 32;

  // Shared phone/email inline row (clickable)
  const contactRow = (phone || email) ? (
    <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground/70">
      {phone && (
        <a
          href={`tel:${phone}`}
          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(phone); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 truncate hover:text-foreground cursor-pointer"
          title="Click to copy"
        >
          <Phone className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{phone}</span>
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 truncate hover:text-foreground cursor-pointer"
        >
          <Mail className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{email}</span>
        </a>
      )}
    </div>
  ) : null;

  /* ── Ultra-narrow: avatar circle only with tooltip ── */
  if (isUltraNarrow) {
    return (
      <div
        className={cn(
          "flex items-center justify-center py-0.5",
          isDragging && "opacity-95"
        )}
        title={`${name}${score > 0 ? ` • ${score}pts` : ""}${phone ? ` • ${phone}` : ""}${email ? ` • ${email}` : ""}`}
      >
        <EntityAvatar
          name={name}
          bgColor={status === "DND" ? "#1a1a1a" : avatarColor.bg}
          textColor={(isClosedStatus || status === "DND") ? "#ffffff" : avatarColor.text}
          size={24}
          className={cn("shrink-0", isSelected && "ring-2 ring-brand-indigo")}
        />
      </div>
    );
  }

  /* ── Compact card ── */
  if (compactMode) {
    return (
      <div
        className={cn(
          "group/card relative rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)]",
          isSelected
            ? "bg-highlight-selected"
            : "bg-white dark:bg-card hover:bg-white dark:hover:bg-card",
          isDragging && "scale-[1.02] rotate-1 opacity-95"
        )}
      >
        <div className="px-2 py-1 flex flex-col gap-0">
          {/* Main row: [avatar center-aligned] | name+score stacked | last interaction */}
          <div className="flex items-center gap-1.5 min-w-0">
            {compactAvatarSize !== null && (
              <EntityAvatar
                name={name}
                bgColor={status === "DND" ? "#1a1a1a" : avatarColor.bg}
                textColor={(isClosedStatus || status === "DND") ? "#ffffff" : avatarColor.text}
                size={compactAvatarSize}
                className="shrink-0"
              />
            )}
            {/* Name + score + booked date stacked, center-aligned with avatar */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-1 min-w-0">
                <span
                  className="text-[12px] font-semibold leading-tight truncate text-foreground flex-1 min-w-0"
                  data-testid="kanban-card-name"
                >
                  {name}
                </span>
                {lastActivity && (
                  <span className={`text-[9px] tabular-nums leading-none shrink-0 ${getAgingTextClass(lastActivity)}`}>
                    {formatRelativeDate(lastActivity, t)}
                  </span>
                )}
              </div>
              {/* Score bar — under name */}
              {showScoreBar && (
                <div className="h-[3px] rounded-full bg-foreground/[0.06] overflow-hidden mt-0.5">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, score)}%`, backgroundColor: statusHex }} />
                </div>
              )}
              {/* Booked date under name, action buttons right-aligned */}
              {isBookedStatus && bookedDateStr && (
                <div className="flex items-center mt-0.5">
                  <span className={cn("text-[9px] tabular-nums leading-none", isBookedToday ? "text-amber-600 font-bold" : bookedDatePassed ? "text-red-500 font-medium" : "text-muted-foreground/60")}>
                    {isBookedToday ? `Today ${new Date(bookedDate).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}` : bookedDateStr}
                  </span>
                  {bookedDatePassed && <div className="ml-auto">{actionButtons}</div>}
                </div>
              )}
            </div>
          </div>

          {/* Hover-expanded: tags, phone, email */}
          <div className="overflow-hidden transition-[max-height,opacity] duration-200 ease-out max-h-0 opacity-0 group-hover/card:max-h-28 group-hover/card:opacity-100">
            <div className="pt-0.5 pb-0.5 flex flex-col gap-0.5">
              {visibleTags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {visibleTags.map((tg) => (
                    <span key={tg.name} className="inline-flex items-center px-1.5 py-0 rounded-full text-[8px] font-medium" style={{ backgroundColor: "rgba(0,0,0,0.07)", color: "rgba(0,0,0,0.45)" }}>
                      {tg.name}
                    </span>
                  ))}
                </div>
              )}
              {contactRow}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Normal card ── */
  return (
    <div
      className={cn(
        "group/card relative mx-0.5 my-0.5 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]",
        isSelected
          ? "bg-highlight-selected"
          : "bg-white dark:bg-card hover:bg-white dark:hover:bg-card",
        isDragging && "scale-[1.02] rotate-1 opacity-95"
      )}
    >
      {/* Last activity — absolute top-right (not in the name row) */}
      {lastActivity && (
        <span
          className={`absolute top-2 right-2.5 text-[10px] tabular-nums leading-none ${getAgingTextClass(lastActivity)}`}
          data-testid="kanban-card-last-activity"
        >
          {formatRelativeDate(lastActivity, t)}
        </span>
      )}

      <div className="px-2.5 pt-2 pb-1.5 flex flex-col gap-0.5">

        {/* Row 1: Avatar | Name+Score — center-aligned */}
        <div className="flex items-center gap-2">
          <EntityAvatar
            name={name}
            bgColor={status === "DND" ? "#1a1a1a" : avatarColor.bg}
            textColor={(isClosedStatus || status === "DND") ? "#ffffff" : avatarColor.text}
            className="shrink-0"
          />

          {/* Name + score stacked, center-aligned with avatar */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <p
              className="text-[15px] font-semibold font-heading leading-tight truncate text-foreground pr-12"
              data-testid="kanban-card-name"
            >
              {name}
            </p>
            {/* Score bar — starts at first letter of name */}
            {showScoreBar && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] font-bold tabular-nums shrink-0" style={{ color: statusHex }}>
                  {score}
                </span>
                <div className="flex-1 h-[3px] rounded-full bg-foreground/[0.06] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, score)}%`, backgroundColor: statusHex }} />
                </div>
              </div>
            )}
            {/* Booked date under name, action buttons right-aligned */}
            {isBookedStatus && bookedDateStr && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={cn("text-[10px] tabular-nums leading-none", isBookedToday ? "text-amber-600 font-bold" : bookedDatePassed ? "text-red-500 font-medium" : "text-muted-foreground/60")}>
                  {isBookedToday ? `Today ${new Date(bookedDate).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}` : bookedDateStr}
                </span>
                {bookedDatePassed && <div className="ml-auto">{actionButtons}</div>}
              </div>
            )}
          </div>
        </div>

        {/* Tags — always visible when showTagsAlways is on */}
        {showTagsAlways && visibleTags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mt-0.5">
            {visibleTags.map((tg) => (
              <span key={tg.name} className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.09)", color: "rgba(0,0,0,0.45)" }} data-testid="kanban-card-tags">
                {tg.name}
              </span>
            ))}
          </div>
        )}

        {/* Hover-expanded: tags (if not always-on) + phone + email */}
        <div className="overflow-hidden transition-[max-height,opacity] duration-200 ease-out max-h-0 opacity-0 group-hover/card:max-h-36 group-hover/card:opacity-100">
          <div className="pt-1 pb-0.5 flex flex-col gap-1">
            {!showTagsAlways && visibleTags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {visibleTags.map((tg) => (
                  <span key={tg.name} className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.09)", color: "rgba(0,0,0,0.45)" }} data-testid="kanban-card-tags">
                    {tg.name}
                  </span>
                ))}
              </div>
            )}
            {contactRow}
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
  compactMode,
  onMoveLead,
  colWidth,
}: {
  lead: any;
  cardTags?: { name: string; color: string }[];
  onCardClick?: (lead: any) => void;
  isSelected?: boolean;
  showTagsAlways?: boolean;
  compactMode?: boolean;
  onMoveLead?: (leadId: number | string, newStage: string) => void | Promise<void>;
  colWidth?: number;
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
        compactMode={compactMode}
        onMoveLead={onMoveLead}
        colWidth={colWidth}
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
  compactMode,
  useCompactCards,
  onMoveLead,
  colWidth,
}: {
  stage: string;
  leads: any[];
  leadTagsMap?: Map<number, { name: string; color: string }[]>;
  isCollapsed?: boolean;
  onToggleCollapse?: (stage: string) => void;
  onCardClick?: (lead: any) => void;
  selectedLeadId?: number | string;
  showTagsAlways?: boolean;
  /** Controls column layout (flex vs fixed) */
  compactMode?: boolean;
  /** Controls card density — derived from actual width */
  useCompactCards?: boolean;
  onMoveLead?: (leadId: number | string, newStage: string) => void | Promise<void>;
  colWidth?: number;
}) {
  const { t } = useTranslation("leads");
  const hex = PIPELINE_HEX[stage] || "#6B7280";
  const headerTextColor = hex;
  const iconBg = STAGE_ICON_BG[stage] || hex;
  const iconText = STAGE_ICON_TEXT[stage] || DEFAULT_ICON_TEXT;
  const StageIcon = STAGE_ICONS[stage] || AlertCircle;
  const { setNodeRef, isOver } = useDroppable({ id: `column-${stage}` });
  const isBookedStage = stage === "Booked";
  const isClosedStage = stage === "Closed";
  const isLostStage = stage === "Lost";
  const isDNDStage = stage === "DND";
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
          isLostStage ? "bg-red-50/80 dark:bg-red-950/15"
            : isClosedStage ? "bg-orange-50/80 dark:bg-orange-950/10"
            : "bg-muted"
        )}
        data-testid={`kanban-column-${stage}`}
        data-collapsed="true"
        title={`${t(`kanban.stageLabels.${stageKey(stage)}`)} (${leads.length})`}
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
            {t(`kanban.stageLabels.${stageKey(stage)}`)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg overflow-hidden h-full",
        isLostStage ? "bg-red-50 dark:bg-red-950/20"
          : isClosedStage ? "bg-orange-50 dark:bg-orange-950/15"
          : isBookedStage ? "bg-[#FFFBEB] dark:bg-[#1E1A0E]"
          : "bg-card",
        compactMode
          ? "flex-1 min-w-[60px]"
          : cn(
              "flex-shrink-0",
              isBookedStage
                ? "w-[calc(100vw-24px)] md:w-[300px] min-w-[calc(100vw-24px)] md:min-w-[280px] md:max-w-[320px] border-l-2 border-[#FCB803]/50 snap-start snap-always"
                : "w-[calc(100vw-24px)] md:w-[280px] min-w-[calc(100vw-24px)] md:min-w-[260px] md:max-w-[300px] snap-start snap-always",
            ),
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
          "flex items-center shrink-0 transition-shadow duration-150",
          useCompactCards ? "gap-1.5 px-2 py-1.5" : "gap-2 px-3 py-2.5",
          isBookedStage && "bg-[#FCB803]/10 dark:bg-[#FCB803]/[0.06]",
          isBodyScrolled && "shadow-[0_2px_6px_-1px_rgba(0,0,0,0.08)]"
        )}
        data-testid={`kanban-column-header-${stage}`}
      >
        {/* Stage icon circle */}
        <div
          className={cn("rounded-full flex items-center justify-center flex-shrink-0", useCompactCards ? "w-5 h-5" : "w-6 h-6")}
          style={{ backgroundColor: iconBg, color: iconText }}
        >
          <StageIcon className={useCompactCards ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </div>

        {/* Stage label — colored text only */}
        <span
          className={cn(
            "font-semibold truncate flex-1 flex items-center gap-1",
            useCompactCards ? "text-[12px]" : "text-sm",
            isBookedStage && !useCompactCards && "font-bold text-base",
          )}
          style={{ color: headerTextColor }}
        >
          {t(`kanban.stageLabels.${stageKey(stage)}`)}
          {isBookedStage && !useCompactCards && (
            <Star className="h-3.5 w-3.5 fill-[#FCB803] text-[#FCB803] shrink-0" />
          )}
        </span>

        {/* Count */}
        <span
          className={cn("font-semibold text-muted-foreground/70 tabular-nums flex-shrink-0", useCompactCards ? "text-[10px]" : "text-[11px]")}
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
              aria-label={`Empty stage: ${t(`kanban.stageLabels.${stageKey(stage)}`)}`}
            >
              {isOver ? (
                <>
                  <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center mb-2">
                    <ChevronRight className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">{t("kanban.dropHere")}</span>
                  <span className="text-xs text-muted-foreground/60 mt-1">
                    {t("kanban.moveLeadTo", { stage: t(`kanban.stageLabels.${stageKey(stage)}`) })}
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
                        {t(`kanban.emptyStates.${stageKey(stage)}.message`, config.message)}
                      </span>
                      <span className="text-[11px] text-muted-foreground/40 text-center leading-snug mt-1 max-w-[180px]">
                        {t(`kanban.emptyStates.${stageKey(stage)}.hint`, config.hint)}
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
              className={useCompactCards ? "flex flex-col gap-[3px]" : undefined}
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
                      compactMode={useCompactCards}
                      onMoveLead={onMoveLead}
                      colWidth={colWidth}
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
                    {t("kanban.loadMore", { count: Math.min(remainingCount, COLUMN_BATCH_SIZE) })}
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
  /** Compact mode: narrow cards showing only name + last activity, hover reveals score/phone/email */
  compactMode?: boolean;
}

/** Threshold: columns wider than this render full cards instead of compact */
const COMPACT_CARD_THRESHOLD = 260;

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
  compactMode,
}: LeadsKanbanProps) {
  const { t } = useTranslation("leads");
  const [localLeads, setLocalLeads]   = useState<any[]>(leads);
  const [activeLead, setActiveLead]   = useState<any | null>(null);
  const [isDraggingAny, setIsDraggingAny] = useState(false);
  const snapshotRef = useRef<any[]>([]);

  // ── Measure container width to auto-switch card density ──────────────
  // Use callback ref + ResizeObserver for instant updates on resize
  const boardRef = useRef<HTMLDivElement>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const boardCallbackRef = useCallback((node: HTMLDivElement | null) => {
    // Disconnect previous observer
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null; }
    boardRef.current = node;
    if (!node) return;
    // Set initial width synchronously
    setContainerWidth(node.getBoundingClientRect().width);
    // Observe for future resizes
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(node);
    roRef.current = ro;
  }, []);

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

  // ── Derive card density from actual column width ────────────────────
  // compactMode controls layout (flex-fill vs fixed scroll)
  // useCompactCards controls card rendering — auto-switches when columns are wide enough
  const visibleColumnCount = PIPELINE_STAGES.length - collapsedStages.size;
  const collapsedWidth = collapsedStages.size * 43; // 40px + 3px gap
  const rawColWidth = visibleColumnCount > 0
    ? (containerWidth - collapsedWidth - (PIPELINE_STAGES.length - 1) * 3) / visibleColumnCount
    : 0;
  // Use 200 as fallback before ResizeObserver fires to avoid ultra-narrow flash
  const effectiveColWidth = containerWidth > 0 ? rawColWidth : 200;
  const useCompactCards = compactMode && effectiveColWidth < COMPACT_CARD_THRESHOLD;

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
        title: t("kanban.leadMoved"),
        description: t("kanban.movedTo", { stage: t(`kanban.stageLabels.${stageKey(targetStage)}`) }),
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
            {t("kanban.undo")}
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
              title: t("kanban.moveFailed"),
              description: t("kanban.moveFailedDescription"),
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
        className="flex gap-[3px] overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory md:snap-none"
        style={{ overscrollBehaviorX: "contain" } as React.CSSProperties}
        data-testid="kanban-loading-skeleton"
      >
        {PIPELINE_STAGES.map((stage) => {
          const SkelIcon = STAGE_ICONS[stage] || AlertCircle;
          const skelBg = STAGE_ICON_BG[stage] || "#6B7280";
          return (
            <div
              key={stage}
              className="flex flex-col bg-card rounded-lg w-[calc(100vw-24px)] md:w-[280px] min-w-[calc(100vw-24px)] md:min-w-[260px] flex-shrink-0 snap-start snap-always"
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
                    className="mx-0.5 my-0.5 rounded-xl bg-white/70 dark:bg-white/[0.07] px-2.5 pt-2 pb-1.5 space-y-1.5 animate-pulse"
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
      {/* Horizontal scroll container — compact mode fills screen instead of scrolling */}
      <div
        ref={boardCallbackRef}
        className={cn(
          "flex h-full gap-[3px] pb-0",
          compactMode
            ? "overflow-hidden"
            : "overflow-x-auto scroll-smooth snap-x snap-mandatory md:snap-none",
        )}
        style={compactMode ? undefined : { overscrollBehaviorX: "contain" } as React.CSSProperties}
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
            compactMode={compactMode}
            useCompactCards={useCompactCards}
            onMoveLead={onLeadMove}
            colWidth={compactMode ? effectiveColWidth : 280}
          />
        ))}
      </div>

      {/* Ghost card that follows the cursor during drag */}
      <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
        {activeLead ? (
          <div className={useCompactCards ? "w-[180px]" : "w-[260px]"}>
            <KanbanCardContent
              lead={activeLead}
              isDragging
              cardTags={leadTagsMap?.get(Number(activeLead.Id || activeLead.id)) || []}
              compactMode={useCompactCards}
              onMoveLead={onLeadMove}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
