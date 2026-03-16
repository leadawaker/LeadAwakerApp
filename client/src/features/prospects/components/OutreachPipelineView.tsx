import { useMemo, useCallback, useState, useRef, useEffect } from "react";
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
  type DragStartEvent,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import { getEventCoordinates } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { getInitials } from "@/lib/avatarUtils";
import {
  Phone,
  Mail,
  Globe,
  Linkedin,
  Clock,
  ChevronRight,
  Zap,
  Send,
  MessageSquareReply,
  CalendarCheck,
  Presentation,
  FileText,
  Handshake,
  Trophy,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { updateProspect } from "../api/prospectsApi";
import type { ProspectRow } from "../components/ProspectListView";

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

// ── Outreach pipeline stages ────────────────────────────────────────
export const OUTREACH_STATUSES = [
  "new",
  "contacted",
  "responded",
  "call_booked",
  "demo_given",
  "proposal_sent",
  "negotiating",
  "deal_closed",
  "lost",
] as const;

export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export const OUTREACH_LABELS: Record<OutreachStatus, string> = {
  new: "New",
  contacted: "Contacted",
  responded: "Responded",
  call_booked: "Call Booked",
  demo_given: "Demo Given",
  proposal_sent: "Proposal Sent",
  negotiating: "Negotiating",
  deal_closed: "Deal Closed",
  lost: "Lost",
};

// ── Rainbow color progression (cold → warm) ────────────────────────
export const OUTREACH_HEX: Record<OutreachStatus, string> = {
  new:            "#6B7280",
  contacted:      "#7A73FF",
  responded:      "#3ACBDF",
  call_booked:    "#31D35C",
  demo_given:     "#AED62E",
  proposal_sent:  "#F7BF0E",
  negotiating:    "#F97316",
  deal_closed:            "#FFFFFF",
  lost:           "#DC2626",
};

// ── Avatar colors per stage (light mode) ────────────────────────────
const PROSPECT_AVATAR_BG: Record<OutreachStatus, string> = {
  new:            "#C9C9C9",
  contacted:      "#BBB9FF",
  responded:      "#B9E7EF",
  call_booked:    "#AFE3BB",
  demo_given:     "#D6E8A3",
  proposal_sent:  "#FFDB74",
  negotiating:    "#FDDCB5",
  deal_closed:            "#F0F0F0",
  lost:           "#F5BFBF",
};

const PROSPECT_AVATAR_TEXT: Record<OutreachStatus, string> = {
  new:            "#374151",
  contacted:      "#2E3A6B",
  responded:      "#0F5F5A",
  call_booked:    "#166534",
  demo_given:     "#3F6212",
  proposal_sent:  "#78350F",
  negotiating:    "#7C2D12",
  deal_closed:            "#374151",
  lost:           "#991B1B",
};

// ── Avatar colors per stage (dark mode) ─────────────────────────────
const PROSPECT_AVATAR_BG_DARK: Record<OutreachStatus, string> = {
  new:            "#2A2D33",
  contacted:      "#272547",
  responded:      "#1A3338",
  call_booked:    "#1A3325",
  demo_given:     "#283314",
  proposal_sent:  "#33290A",
  negotiating:    "#33200A",
  deal_closed:            "#2A2D33",
  lost:           "#3D1A1A",
};

const PROSPECT_AVATAR_TEXT_DARK: Record<OutreachStatus, string> = {
  new:            "#9CA3AF",
  contacted:      "#BBB9FF",
  responded:      "#7CDCE8",
  call_booked:    "#6AE87C",
  demo_given:     "#B5E050",
  proposal_sent:  "#FFD54F",
  negotiating:    "#FDBA74",
  deal_closed:            "#E0E0E0",
  lost:           "#F48A8A",
};

function isDarkMode(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

function getProspectAvatarColor(stage: OutreachStatus): { bg: string; text: string } {
  if (isDarkMode()) {
    return { bg: PROSPECT_AVATAR_BG_DARK[stage] ?? "#2A2D33", text: PROSPECT_AVATAR_TEXT_DARK[stage] ?? "#9CA3AF" };
  }
  return { bg: PROSPECT_AVATAR_BG[stage] ?? "#C9C9C9", text: PROSPECT_AVATAR_TEXT[stage] ?? "#374151" };
}

// ── Stage icons ─────────────────────────────────────────────────────
const STAGE_ICONS: Record<OutreachStatus, LucideIcon> = {
  new:            Zap,
  contacted:      Send,
  responded:      MessageSquareReply,
  call_booked:    CalendarCheck,
  demo_given:     Presentation,
  proposal_sent:  FileText,
  negotiating:    Handshake,
  deal_closed:            Trophy,
  lost:           XCircle,
};

/** Icon circle bg — same as hex except won gets dark bg for contrast */
const STAGE_ICON_BG: Record<OutreachStatus, string> = {
  new:            "#6B7280",
  contacted:      "#7A73FF",
  responded:      "#3ACBDF",
  call_booked:    "#31D35C",
  demo_given:     "#AED62E",
  proposal_sent:  "#F7BF0E",
  negotiating:    "#F97316",
  deal_closed:            "#1a1a1a",
  lost:           "#DC2626",
};
const STAGE_ICON_TEXT: Record<string, string> = {
  proposal_sent: "#131B49",
  demo_given: "#1a1a1a",
};
const DEFAULT_ICON_TEXT = "#ffffff";

// ── Niche badge colors ──────────────────────────────────────────────
const NICHE_COLORS: Record<string, string> = {
  Solar: "#F59E0B",
  "Insurance / Mortgage": "#3B82F6",
  "Legal / Personal Injury": "#6B7280",
  "Life Coaching": "#8B5CF6",
  "Renovation / Home Improvement": "#EC4899",
  "Data Analysis / B2B": "#10B981",
};

// ── Card stagger animation variants ─────────────────────────────────
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

// ── Sort options ────────────────────────────────────────────────────
type SortMode = "default" | "name-asc" | "name-desc" | "priority";

function sortProspects(prospects: ProspectRow[], mode: SortMode): ProspectRow[] {
  if (mode === "default") return prospects;
  const sorted = [...prospects];
  switch (mode) {
    case "name-asc":
      sorted.sort((a, b) => (a.name || a.company || "").localeCompare(b.name || b.company || ""));
      break;
    case "name-desc":
      sorted.sort((a, b) => (b.name || b.company || "").localeCompare(a.name || a.company || ""));
      break;
    case "priority": {
      const prio: Record<string, number> = { high: 0, medium: 1, low: 2 };
      sorted.sort((a, b) => (prio[a.priority || "low"] ?? 2) - (prio[b.priority || "low"] ?? 2));
      break;
    }
  }
  return sorted;
}

// ── Infinite scroll batch size ──────────────────────────────────────
const COLUMN_BATCH_SIZE = 20;

/* ─────────── Card content ─────────── */

function ProspectCardContent({
  prospect,
  isDragging = false,
}: {
  prospect: ProspectRow;
  isDragging?: boolean;
}) {
  const stage = (prospect.outreach_status || "new") as OutreachStatus;
  const avatarColor = getProspectAvatarColor(stage);
  const companyName = prospect.company || prospect.name || "Unnamed";
  const nicheColor = NICHE_COLORS[prospect.niche || ""] || "#6B7280";
  const hasFollowUp = prospect.next_follow_up_date;
  const isOverdue = hasFollowUp && new Date(prospect.next_follow_up_date) < new Date();
  const isDealClosed = stage === "deal_closed";

  return (
    <div
      className={cn(
        "group/card relative mx-0.5 my-0.5 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]",
        "bg-white dark:bg-card hover:bg-white dark:hover:bg-card",
        isDragging && "scale-[1.02] rotate-1 opacity-95"
      )}
    >
      <div className="px-2.5 pt-2 pb-1.5 flex flex-col gap-0.5">

        {/* Row 1: Avatar + Company name + priority */}
        <div className="flex items-center gap-2">
          <EntityAvatar
            name={companyName}
            photoUrl={prospect.photo_url}
            bgColor={isDealClosed ? "#1a1a1a" : avatarColor.bg}
            textColor={isDealClosed ? "#ffffff" : avatarColor.text}
            className="shrink-0"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1.5">
              <span
                className="text-[15px] font-semibold font-heading leading-tight truncate text-foreground flex-1 min-w-0"
                data-testid="prospect-card-name"
              >
                {companyName}
              </span>
              {prospect.priority === "high" && (
                <span className="text-[9px] font-bold text-red-500 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-full shrink-0 uppercase tracking-wide">
                  High
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Niche badge */}
        {prospect.niche && (
          <div>
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-block"
              style={{
                backgroundColor: `${nicheColor}15`,
                color: nicheColor,
              }}
            >
              {prospect.niche}
            </span>
          </div>
        )}

        {/* Contact name + city */}
        {(prospect.contact_name || prospect.city) && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {prospect.contact_name && (
              <span className="truncate">{prospect.contact_name}</span>
            )}
            {prospect.contact_name && prospect.city && (
              <span className="text-muted-foreground/30">|</span>
            )}
            {prospect.city && (
              <span className="truncate text-muted-foreground/60">{prospect.city}</span>
            )}
          </div>
        )}

        {/* Follow-up date */}
        {hasFollowUp && (
          <div>
            <div
              className={cn(
                "flex items-center gap-1 text-[10px]",
                isOverdue ? "text-red-500 font-medium" : "text-muted-foreground/60"
              )}
            >
              <Clock className="h-3 w-3" />
              <span>
                {new Date(prospect.next_follow_up_date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
              {isOverdue && <span className="text-[9px]">overdue</span>}
            </div>
          </div>
        )}

        {/* Follow-up count */}
        {(prospect.follow_up_count ?? 0) > 0 && (
          <div>
            <span className="text-[10px] text-muted-foreground/50">
              {prospect.follow_up_count}x follow-up
            </span>
          </div>
        )}

        {/* Hover-expanded: phone, email, website, linkedin */}
        <div className="overflow-hidden transition-[max-height,opacity] duration-200 ease-out max-h-0 opacity-0 group-hover/card:max-h-36 group-hover/card:opacity-100">
          <div className="pt-1 pb-0.5 flex flex-col gap-0.5 text-[10px] text-muted-foreground/70">
            {(prospect.phone || prospect.contact_phone) && (
              <span className="inline-flex items-center gap-1 truncate">
                <Phone className="h-3 w-3 shrink-0" />
                {prospect.phone || prospect.contact_phone}
              </span>
            )}
            {(prospect.email || prospect.contact_email) && (
              <span className="inline-flex items-center gap-1 truncate">
                <Mail className="h-3 w-3 shrink-0" />
                {prospect.email || prospect.contact_email}
              </span>
            )}
            {prospect.website && (
              <span className="inline-flex items-center gap-1 truncate">
                <Globe className="h-3 w-3 shrink-0" />
                {prospect.website}
              </span>
            )}
            {(prospect.linkedin || prospect.contact_linkedin) && (
              <span className="inline-flex items-center gap-1 truncate">
                <Linkedin className="h-3 w-3 shrink-0" />
                {prospect.linkedin || prospect.contact_linkedin}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Draggable Card wrapper ─────────── */

function DraggableProspectCard({
  prospect,
  onClick,
}: {
  prospect: ProspectRow;
  onClick?: () => void;
}) {
  const prospectId = String(prospect.Id ?? prospect.id ?? 0);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: prospectId,
    data: { prospect },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-testid={`prospect-card-${prospectId}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "cursor-grab active:cursor-grabbing touch-none select-none",
        isDragging && "opacity-30"
      )}
    >
      <ProspectCardContent prospect={prospect} />
    </div>
  );
}

/* ─────────── Droppable Column ─────────── */

function PipelineColumn({
  status,
  prospects,
  isCollapsed,
  onToggleCollapse,
  onSelectProspect,
  compactMode = false,
}: {
  status: OutreachStatus;
  prospects: ProspectRow[];
  isCollapsed?: boolean;
  onToggleCollapse?: (status: OutreachStatus) => void;
  onSelectProspect?: (p: ProspectRow) => void;
  compactMode?: boolean;
}) {
  const hex = OUTREACH_HEX[status];
  const headerTextColor = status === "deal_closed" ? "#1a1a1a" : hex;
  const iconBg = STAGE_ICON_BG[status];
  const iconText = STAGE_ICON_TEXT[status] || DEFAULT_ICON_TEXT;
  const StageIcon = STAGE_ICONS[status];
  const label = OUTREACH_LABELS[status];
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: { type: "column", status },
  });

  const isDealClosedStage = status === "deal_closed";
  const isDarkColumn = status === "lost";
  const [isBodyScrolled, setIsBodyScrolled] = useState(false);

  // Infinite scroll state
  const [visibleCount, setVisibleCount] = useState(COLUMN_BATCH_SIZE);
  useEffect(() => {
    setVisibleCount(COLUMN_BATCH_SIZE);
  }, [status, prospects.length]);

  const visibleProspects = prospects.slice(0, visibleCount);
  const hasMore = visibleCount < prospects.length;
  const remainingCount = prospects.length - visibleCount;

  /* ── Collapsed state ── */
  if (isCollapsed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center rounded-lg w-10 min-w-[40px] flex-shrink-0 cursor-pointer select-none h-full overflow-hidden",
          isDarkColumn ? "bg-[#C5C5C5] dark:bg-[#1A1520]" : "bg-muted"
        )}
        data-testid={`prospect-column-${status}`}
        data-collapsed="true"
        title={`${label} (${prospects.length})`}
        onClick={() => onToggleCollapse?.(status)}
      >
        <div className="pt-2 pb-1 flex flex-col items-center gap-1.5 w-full">
          <ChevronRight
            className="h-3.5 w-3.5 text-muted-foreground shrink-0"
          />
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: iconBg, color: iconText }}
          >
            <StageIcon className="h-3 w-3" />
          </div>
          <span
            className="text-[10px] font-bold tabular-nums shrink-0"
            style={{ color: status === "deal_closed" ? "#1a1a1a" : hex }}
          >
            {prospects.length}
          </span>
        </div>
        <div className="flex-1 flex items-start pt-1">
          <span
            className="font-semibold text-[11px]"
            style={{
              color: status === "deal_closed" ? "#1a1a1a" : hex,
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              transform: "rotate(180deg)",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg overflow-hidden h-full",
        compactMode
          ? "flex-1 min-w-[60px]"
          : "flex-shrink-0 w-[calc(100vw-24px)] md:w-[280px] min-w-[calc(100vw-24px)] md:min-w-[260px] md:max-w-[300px] snap-start snap-always",
        isDarkColumn
          ? "bg-[#C5C5C5] dark:bg-[#1A1520]"
          : isDealClosedStage
            ? "bg-[#FFFBEB] dark:bg-[#1E1A0E]"
            : "bg-card",
        isOver && `ring-2 ring-inset`
      )}
      style={isOver ? { "--tw-ring-color": hex } as React.CSSProperties : undefined}
      data-testid={`prospect-column-${status}`}
      data-collapsed="false"
    >
      {/* Column Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2.5 shrink-0 transition-shadow duration-150",
          isDealClosedStage && "bg-[#F7BF0E]/10 dark:bg-[#F7BF0E]/[0.06]",
          isBodyScrolled && "shadow-[0_2px_6px_-1px_rgba(0,0,0,0.08)]"
        )}
      >
        {/* Collapse chevron */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse?.(status);
          }}
          className="h-4 w-4 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
          title="Collapse column"
        >
          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
        </button>

        {/* Stage icon circle */}
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: iconBg, color: iconText }}
        >
          <StageIcon className="h-3.5 w-3.5" />
        </div>

        {/* Stage label */}
        <span
          className="font-semibold truncate flex-1 text-sm"
          style={{ color: headerTextColor }}
        >
          {label}
        </span>

        {/* Count badge */}
        <span className="font-semibold text-muted-foreground/70 tabular-nums flex-shrink-0 text-[11px]">
          {prospects.length}
        </span>
      </div>

      {/* Column Body — drop target */}
      <div
        className={cn("flex-1 overflow-y-auto min-h-0", isOver && "bg-brand-indigo/[0.04]")}
        onScroll={(e) => setIsBodyScrolled(e.currentTarget.scrollTop > 2)}
      >
        <div ref={setNodeRef} className="px-[3px] pb-2 min-h-[80px]">
          {prospects.length === 0 ? (
            <div
              className={cn(
                "flex flex-col items-center justify-center py-10 px-3 rounded-lg select-none",
                isOver ? "bg-background/30" : "text-muted-foreground/40"
              )}
            >
              {isOver ? (
                <>
                  <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center mb-2">
                    <ChevronRight className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">Drop here</span>
                  <span className="text-xs text-muted-foreground/60 mt-1">
                    Move prospect to {label}
                  </span>
                </>
              ) : (
                <>
                  <div className="h-10 w-10 rounded-full bg-muted/40 flex items-center justify-center mb-3">
                    <StageIcon className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground/60 text-center leading-snug">
                    No prospects
                  </span>
                  <span className="text-[11px] text-muted-foreground/40 text-center leading-snug mt-1 max-w-[180px]">
                    Drag prospects here to move them to {label}
                  </span>
                </>
              )}
            </div>
          ) : (
            <motion.div
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              custom={visibleProspects.length}
            >
              {visibleProspects.map((p) => (
                <motion.div key={p.Id ?? p.id} variants={staggerItemVariants}>
                  <DraggableProspectCard
                    prospect={p}
                    onClick={() => onSelectProspect?.(p)}
                  />
                </motion.div>
              ))}

              {/* Load more button */}
              {hasMore && (
                <div className="py-2 px-1">
                  <button
                    onClick={() =>
                      setVisibleCount((prev) =>
                        Math.min(prev + COLUMN_BATCH_SIZE, prospects.length)
                      )
                    }
                    className="w-full h-8 rounded-lg text-xs font-medium text-muted-foreground border border-border/50 bg-transparent hover:bg-card hover:text-foreground transition-colors"
                  >
                    Show {Math.min(remainingCount, COLUMN_BATCH_SIZE)} more
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

/* ─────────── Main pipeline view ─────────── */

interface OutreachPipelineViewProps {
  prospects: ProspectRow[];
  searchQuery: string;
  onSelectProspect?: (p: ProspectRow) => void;
  onRefresh?: () => void;
  // Toolbar state lifted to page level
  pipelineSearch?: string;
  pipelineSortBy?: "name-asc" | "name-desc" | "priority" | null;
  pipelineFilterHasPhone?: boolean;
  pipelineFilterHasEmail?: boolean;
  pipelineFilterNiche?: string[];
  pipelineFilterCountry?: string[];
  compactMode?: boolean;
  onCollapsedChange?: (hasCollapsed: boolean) => void;
  expandAllRef?: React.MutableRefObject<(() => void) | null>;
  foldThresholdRef?: React.MutableRefObject<((n: number) => void) | null>;
}

export default function OutreachPipelineView({
  prospects,
  searchQuery,
  onSelectProspect,
  onRefresh,
  pipelineSearch = "",
  pipelineSortBy = null,
  pipelineFilterHasPhone = false,
  pipelineFilterHasEmail = false,
  pipelineFilterNiche = [],
  pipelineFilterCountry = [],
  compactMode = false,
  onCollapsedChange,
  expandAllRef,
  foldThresholdRef,
}: OutreachPipelineViewProps) {
  const [activeProspect, setActiveProspect] = useState<ProspectRow | null>(null);
  const [isDraggingAny, setIsDraggingAny] = useState(false);
  const [localProspects, setLocalProspects] = useState<ProspectRow[]>(prospects);

  // ── Collapsed columns state ────────────────────────────────────────
  const [collapsedStages, setCollapsedStages] = useState<Set<OutreachStatus>>(() => {
    try {
      const stored = localStorage.getItem("prospects_pipeline_collapsed");
      if (stored) return new Set(JSON.parse(stored) as OutreachStatus[]);
    } catch { /* ignore */ }
    return new Set<OutreachStatus>();
  });

  const toggleColumnCollapse = useCallback((status: OutreachStatus) => {
    setCollapsedStages((prev) => {
      const next = new Set(prev);
      next.has(status) ? next.delete(status) : next.add(status);
      try {
        localStorage.setItem("prospects_pipeline_collapsed", JSON.stringify(Array.from(next)));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Notify parent of collapsed state changes
  const hasCollapsed = collapsedStages.size > 0;
  useEffect(() => {
    onCollapsedChange?.(hasCollapsed);
  }, [hasCollapsed, onCollapsedChange]);

  // Expose expand all and fold threshold actions to parent
  useEffect(() => {
    if (expandAllRef) {
      expandAllRef.current = () => {
        setCollapsedStages(new Set());
        try { localStorage.removeItem("prospects_pipeline_collapsed"); } catch {}
      };
    }
  }, [expandAllRef]);

  useEffect(() => {
    if (foldThresholdRef) {
      foldThresholdRef.current = (threshold: number) => {
        // This will be called after columns are computed, so we use a timeout
        setCollapsedStages((prev) => {
          const next = new Set<OutreachStatus>();
          OUTREACH_STATUSES.forEach((status) => {
            const count = localProspects.filter((p) => (p.outreach_status || "new") === status).length;
            if (count <= threshold) next.add(status);
          });
          try { localStorage.setItem("prospects_pipeline_collapsed", JSON.stringify(Array.from(next))); } catch {}
          return next;
        });
      };
    }
  }, [foldThresholdRef, localProspects]);

  // Sync local prospects from parent
  useEffect(() => {
    if (!isDraggingAny) setLocalProspects(prospects);
  }, [prospects, isDraggingAny]);

  // Combine parent searchQuery with pipeline search from toolbar
  const effectiveSearch = (searchQuery || pipelineSearch).trim().toLowerCase();

  // Only show active pipeline columns (hide won/lost/negotiating when empty)
  const activeStatuses = useMemo(() => {
    const hasItems = new Set<string>();
    localProspects.forEach((p) => hasItems.add(p.outreach_status || "new"));
    return OUTREACH_STATUSES.filter(
      (s) => !["deal_closed", "lost", "negotiating"].includes(s) || hasItems.has(s)
    );
  }, [localProspects]);

  const columns = useMemo(() => {
    let source = effectiveSearch
      ? localProspects.filter((p) => {
          const haystack = [p.name, p.company, p.niche, p.contact_name, p.city]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(effectiveSearch);
        })
      : [...localProspects];

    // Apply pipeline filters from toolbar
    if (pipelineFilterHasPhone) {
      source = source.filter((p) => p.phone || p.contact_phone);
    }
    if (pipelineFilterHasEmail) {
      source = source.filter((p) => p.email || p.contact_email);
    }
    if (pipelineFilterNiche.length > 0) {
      source = source.filter((p) => pipelineFilterNiche.includes(String(p.niche || "")));
    }
    if (pipelineFilterCountry.length > 0) {
      source = source.filter((p) => pipelineFilterCountry.includes(String(p.country || "")));
    }

    const grouped: Record<OutreachStatus, ProspectRow[]> = {
      new: [],
      contacted: [],
      responded: [],
      call_booked: [],
      demo_given: [],
      proposal_sent: [],
      negotiating: [],
      deal_closed: [],
      lost: [],
    };

    for (const p of source) {
      const s = (p.outreach_status || "new") as OutreachStatus;
      if (grouped[s]) grouped[s].push(p);
      else grouped.new.push(p);
    }

    // Apply sort from toolbar
    const effectiveSortMode: SortMode = pipelineSortBy || "default";
    for (const key of Object.keys(grouped) as OutreachStatus[]) {
      grouped[key] = sortProspects(grouped[key], effectiveSortMode);
    }

    return activeStatuses.map((s) => ({
      status: s,
      prospects: grouped[s],
    }));
  }, [localProspects, effectiveSearch, activeStatuses, pipelineSortBy, pipelineFilterHasPhone, pipelineFilterHasEmail, pipelineFilterNiche, pipelineFilterCountry]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const prospect = event.active.data.current?.prospect ?? null;
      setActiveProspect(prospect);
      setIsDraggingAny(true);
      setLocalProspects(prospects);
    },
    [prospects]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveProspect(null);
      setIsDraggingAny(false);
      if (!over) return;

      const targetStatus = String(over.id).replace(/^column-/, "") as OutreachStatus;
      if (!OUTREACH_STATUSES.includes(targetStatus)) return;

      const draggedId = String(active.id);
      const prospect = localProspects.find(
        (p) => String(p.Id ?? p.id) === draggedId
      );
      if (!prospect) return;

      const currentStatus = (prospect.outreach_status || "new") as OutreachStatus;
      if (currentStatus === targetStatus) return;

      // Optimistic update
      setLocalProspects((prev) =>
        prev.map((p) =>
          String(p.Id ?? p.id) === draggedId
            ? { ...p, outreach_status: targetStatus }
            : p
        )
      );

      try {
        const prospectId = prospect.Id ?? prospect.id ?? 0;
        await updateProspect(prospectId, { outreach_status: targetStatus });
        onRefresh?.();
      } catch (err) {
        console.error("Failed to update outreach status", err);
        // Revert optimistic update
        setLocalProspects(prospects);
      }
    },
    [localProspects, prospects, onRefresh]
  );

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Pipeline Board ── */}
      <DndContext
        sensors={sensors}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          className="flex h-full gap-[3px] pb-0 overflow-x-auto scroll-smooth snap-x snap-mandatory md:snap-none flex-1 min-h-0"
          style={{ overscrollBehaviorX: "contain" } as React.CSSProperties}
          data-testid="outreach-pipeline-board"
        >
          {columns.map((col) => (
            <PipelineColumn
              key={col.status}
              status={col.status}
              prospects={col.prospects}
              isCollapsed={collapsedStages.has(col.status)}
              onToggleCollapse={toggleColumnCollapse}
              onSelectProspect={onSelectProspect}
              compactMode={compactMode}
            />
          ))}
        </div>

        {/* Ghost card that follows the cursor during drag */}
        <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
          {activeProspect ? (
            <div className="w-[260px]">
              <ProspectCardContent prospect={activeProspect} isDragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
