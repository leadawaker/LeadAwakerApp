import { useState, useMemo, useCallback, useRef, useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Phone,
  Mail,
  Users,
  BookUser,
  MessageSquare,
  Copy,
  Check,
  Send,
  Bot,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Layers,
  ArrowUpDown,
  Filter,
  List,
  Table2,
  Plus,
  Trash2,
  RefreshCw,
  CalendarClock,
  FileText,
  X,
  Calendar,
  TrendingUp,
  ClipboardList,
  ExternalLink,
  Building2,
  Tag as TagIcon,
  Lock,
  Unlock,
  Shield,
  AlertTriangle,
  Ban,
  Pencil,
  Star,
  Activity,
  Clock,
  Zap,
  ArrowRight,
  CircleDot,
} from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { updateLead, deleteLead } from "../api/leadsApi";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import { IconBtn } from "@/components/ui/icon-btn";
import { useInteractions } from "@/hooks/useApiData";
import { sendMessage } from "@/features/conversations/api/conversationsApi";
import type { Interaction } from "@/types/models";
import { resolveColor } from "@/features/tags/types";

export type ViewMode = "list" | "table";

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

interface LeadsCardViewProps {
  leads: Record<string, any>[];
  loading: boolean;
  selectedLead: Record<string, any> | null;
  onSelectLead: (lead: Record<string, any>) => void;
  onClose: () => void;
  leadTagsInfo: Map<number, { name: string; color: string }[]>;
  onRefresh?: () => void;
  // Lifted search/filter/sort state
  listSearch: string;
  groupBy: GroupByOption;
  sortBy: SortByOption;
  filterStatus: string[];
  filterTags: string[];
  // View tab switching
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  // Search popup
  searchOpen: boolean;
  onSearchOpenChange: (v: boolean) => void;
  onListSearchChange: (v: string) => void;
  // Group / Sort / Filter setters
  onGroupByChange: (v: GroupByOption) => void;
  onSortByChange: (v: SortByOption) => void;
  onToggleFilterStatus: (s: string) => void;
  onToggleFilterTag: (t: string) => void;
  allTags: { name: string; color: string }[];
  hasNonDefaultControls: boolean;
  isGroupNonDefault: boolean;
  isSortNonDefault: boolean;
  onResetControls: () => void;
  onCreateLead?: () => void;
}

// ── Pipeline stages ────────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { key: "New",                short: "New" },
  { key: "Contacted",          short: "Contacted" },
  { key: "Responded",          short: "Responded" },
  { key: "Multiple Responses", short: "Multi" },
  { key: "Qualified",          short: "Qualified" },
  { key: "Booked",             short: "Booked ★" },
  { key: "Closed",             short: "Closed" },
];
const LOST_STAGES = ["Lost", "DND"];

// ── Status colour map ──────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string; badge: string }> = {
  New:                  { bg: "bg-blue-500/10",    text: "text-blue-700 dark:text-blue-400",    dot: "bg-blue-500",    badge: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" },
  Contacted:            { bg: "bg-indigo-500/10",  text: "text-indigo-700 dark:text-indigo-400", dot: "bg-indigo-500",  badge: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800" },
  Responded:            { bg: "bg-violet-500/10",  text: "text-violet-700 dark:text-violet-400", dot: "bg-violet-500",  badge: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800" },
  "Multiple Responses": { bg: "bg-purple-500/10",  text: "text-purple-700 dark:text-purple-400", dot: "bg-purple-500",  badge: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800" },
  Qualified:            { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400",dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
  Booked:               { bg: "bg-amber-400/15",   text: "text-amber-700 dark:text-amber-400",  dot: "bg-amber-500",   badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
  Closed:               { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400",dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
  Lost:                 { bg: "bg-red-500/10",     text: "text-red-700 dark:text-red-400",      dot: "bg-red-500",     badge: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800" },
  DND:                  { bg: "bg-zinc-500/10",    text: "text-zinc-600 dark:text-zinc-400",    dot: "bg-zinc-500",    badge: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700" },
};

// ── Pipeline stage hex colors — exact match to LeadsKanban.tsx ────────────────
export const PIPELINE_HEX: Record<string, string> = {
  New:                  "#1a3a6f",
  Contacted:            "#2d5aa8",
  Responded:            "#1E90FF",
  "Multiple Responses": "#17A398",
  Qualified:            "#10b981",
  Booked:               "#FCB803",
  Closed:               "#10b981",
  Lost:                 "#ef4444",
  DND:                  "#71717A",
};

// ── Status-based avatar colors — tinted to match PIPELINE_HEX palette ────────
export function getStatusAvatarColor(status: string): { bg: string; text: string } {
  // Colors derived from the Kanban PIPELINE_HEX palette for visual consistency
  const solids: Record<string, { bg: string; text: string }> = {
    New:                  { bg: "#c8d8f7", text: "#1a3a6f" },   // dark navy tint (New = deep blue)
    Contacted:            { bg: "#c5d7f5", text: "#1e3f7a" },   // brand blue tint
    Responded:            { bg: "#b8dcff", text: "#0a4d8e" },   // dodger-blue tint
    "Multiple Responses": { bg: "#b3ede8", text: "#0b5c55" },   // teal tint
    Qualified:            { bg: "#a7f3d0", text: "#065f46" },   // emerald tint
    Booked:               { bg: "#fde68a", text: "#78350f" },   // amber/brand-yellow tint
    Closed:               { bg: "#a7f3d0", text: "#065f46" },   // emerald tint
    Lost:                 { bg: "#fecaca", text: "#991b1b" },   // red tint
    DND:                  { bg: "#e4e4e7", text: "#52525b" },   // zinc tint
  };
  return solids[status] ?? { bg: "#c8d8f7", text: "#1a3a6f" };
}

// ── Score color — blue (#4F46E5) at 0 → yellow (#FCB803) at 100 ───────────────
function getScoreColor(score: number): string {
  const t = Math.max(0, Math.min(1, score / 100));
  const h = Math.round(229 - t * (229 - 45));
  const s = Math.round(100 - t * 3);
  const l = Math.round(66 - t * 16);
  return `hsl(${h}, ${s}%, ${l}%)`;
}
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
function getGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

// ── Date group label ───────────────────────────────────────────────────────────
function getDateGroupLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return "No Activity";
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
    if (diff <= 0)  return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7)   return "This Week";
    if (diff < 30)  return "This Month";
    if (diff < 90)  return "Last 3 Months";
    return "Older";
  } catch { return "No Activity"; }
}

// ── Virtual list item union type ───────────────────────────────────────────────
export type VirtualListItem =
  | { kind: "header"; label: string; count: number }
  | { kind: "lead"; lead: Record<string, any>; tags: { name: string; color: string }[] };

// ── Helpers ───────────────────────────────────────────────────────────────────
export function getLeadId(lead: Record<string, any>): number {
  return lead.Id ?? lead.id ?? 0;
}
export function getFullName(lead: Record<string, any>): string {
  return lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
}
export function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}
export function getScore(lead: Record<string, any>): number {
  return Number(lead.lead_score ?? lead.leadScore ?? lead.Lead_Score ?? 0);
}
export function getStatus(lead: Record<string, any>): string {
  return lead.conversion_status || lead.Conversion_Status || "";
}

// ── Avatar pastel palette ─────────────────────────────────────────────────────
const AVATAR_PASTELS = [
  { bg: "#C8D8FF", text: "#3B5BDB" },
  { bg: "#FFD9C0", text: "#C05621" },
  { bg: "#C8F2C2", text: "#276749" },
  { bg: "#FFC8C8", text: "#9B2C2C" },
  { bg: "#E0C8FF", text: "#6B21A8" },
  { bg: "#FFF2C0", text: "#92400E" },
  { bg: "#C8F2F2", text: "#1A7F7F" },
  { bg: "#FFD9E8", text: "#9D174D" },
];
function getAvatarPastel(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_PASTELS[Math.abs(hash) % AVATAR_PASTELS.length];
}
function getPhone(lead: Record<string, any>): string {
  return lead.phone || lead.Phone || "";
}
function getLastMessage(lead: Record<string, any>): string {
  return lead.last_message || lead.last_message_received || lead.last_reply || lead.last_message_sent || "";
}
function getLastMessageSender(lead: Record<string, any>): string {
  const received = lead.last_message_received || lead.last_reply || "";
  const sent = lead.last_message_sent || "";
  const last = lead.last_message || "";
  // If the last message matches the inbound field → from lead → show nothing
  if (received && (last === received || (!last && !sent))) return "";
  // Outbound → AI (most outbound in this system is AI-driven)
  if (sent || last) return "AI";
  return "";
}
function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      const h = Math.floor(diffMs / 3_600_000);
      return h === 0 ? "Just now" : `${h}h ago`;
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  } catch { return ""; }
}
function formatMsgTime(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}
function formatTagTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}
function formatBookedDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

// ── Score Arc — half-circle gauge (9 o'clock → top → 3 o'clock) ─────────────
function ScoreArc({ score, status }: { score: number; status?: string }) {
  const cx = 100, cy = 95, r = 72, sw = 18;
  const fillColor = (status && PIPELINE_HEX[status]) || "#4F46E5";
  const grade = getGrade(score);

  // Background track: semicircle from left to right, going counterclockwise through the top
  const bgPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`;

  // Score fill: arc from left to score position
  let fillPath = "";
  if (score > 0) {
    if (score >= 100) {
      fillPath = bgPath;
    } else {
      const angleDeg = 180 - (score / 100) * 180;
      const endX = (cx + r * Math.cos((angleDeg * Math.PI) / 180)).toFixed(2);
      const endY = (cy - r * Math.sin((angleDeg * Math.PI) / 180)).toFixed(2);
      fillPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${endX} ${endY}`;
    }
  }

  return (
    <svg viewBox="0 10 200 100" className="w-full max-w-[180px] mx-auto">
      {/* Track */}
      <path d={bgPath} fill="none" stroke="#E5E7EB" strokeWidth={sw} strokeLinecap="round" />
      {/* Fill */}
      {fillPath && (
        <path d={fillPath} fill="none" stroke={fillColor} strokeWidth={sw} strokeLinecap="round" />
      )}
      {/* Score number */}
      <text x={cx} y={cy - 24} textAnchor="middle"
        fontSize="38" fontWeight="900" fontFamily="inherit" fill="#111827" letterSpacing="-2">
        {score}
      </text>
      {/* Grade label */}
      <text x={cx} y={cy - 6} textAnchor="middle"
        fontSize="10" fontWeight="700" fontFamily="inherit" fill="#9CA3AF" letterSpacing="1">
        {grade} GRADE
      </text>
    </svg>
  );
}

// ── Copy button ────────────────────────────────────────────────────────────────
function CopyContactBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── Status badge (light, for header) ─────────────────────────────────────────
function StatusBadge({ label }: { label: string }) {
  const c = STATUS_COLORS[label] ?? { badge: "bg-muted text-muted-foreground border-border" };
  const hex = PIPELINE_HEX[label];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold", c.badge)}>
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={hex ? { backgroundColor: hex } : {}}
      />
      {label}
    </span>
  );
}

// ── Per-stage icon map ────────────────────────────────────────────────────────
const STAGE_ICON: Record<string, React.ElementType> = {
  New: CircleDot,
  Contacted: Send,
  Responded: MessageSquare,
  "Multiple Responses": Users,
  Qualified: Star,
  Booked: Calendar,
  Closed: Check,
};

// ── Pipeline progress — monochrome tube, icons+labels at left of each segment ─
function PipelineProgress({ status }: { status: string }) {
  const currentIndex = PIPELINE_STAGES.findIndex((s) => s.key === status);
  const isLost = LOST_STAGES.includes(status);
  const effectiveIndex = isLost ? -1 : currentIndex;
  const tubeHeight = 26;
  const stageCount = PIPELINE_STAGES.length;

  // Sizes — current stage is slightly bigger
  const iconSizeBase = 28;
  const iconSizeCurrent = 34;
  const innerIconBase = 14;
  const innerIconCurrent = 18;

  // Monochrome: ALL filled segments use the current stage's color
  const activeHex = PIPELINE_HEX[status] || "#6B7280";
  // Paler bar so icons pop — append alpha for ~69% opacity
  const barHex = `${activeHex}B0`;

  return (
    <div className="w-full" style={{ padding: `0 ${iconSizeCurrent / 2 + 2}px` }}>
      <div className="relative" style={{ height: tubeHeight + 14 }}>
        {/* Gray track underneath (full width) */}
        <div
          className="absolute rounded-full"
          style={{ left: 0, right: 0, top: "50%", transform: "translateY(-50%)", height: tubeHeight, backgroundColor: "rgba(55,55,55,0.18)" }}
        />

        {/* Colored segments on top — paler activeHex */}
        <div
          className="absolute overflow-hidden rounded-full"
          style={{ left: 0, right: 0, top: "50%", transform: "translateY(-50%)", height: tubeHeight }}
        >
          <div className="relative flex w-full h-full">
            {PIPELINE_STAGES.map((stage, i) => {
              const isPast = i < effectiveIndex;
              const isCurrent = i === effectiveIndex;

              let bg: string;
              if (isPast) {
                bg = barHex;
              } else if (isCurrent) {
                bg = `linear-gradient(to right, ${barHex} 0%, ${barHex} 30%, transparent 100%)`;
              } else {
                bg = "transparent";
              }

              return (
                <div
                  key={stage.key}
                  className="h-full"
                  style={{ flex: 1, background: bg }}
                />
              );
            })}
          </div>
        </div>

        {/* Stage icons + labels — at LEFT edge of each segment */}
        {PIPELINE_STAGES.map((stage, i) => {
          const isPast = i < effectiveIndex;
          const isCurrent = i === effectiveIndex;
          const isFuture = i > effectiveIndex;

          const IconComponent = (isPast || isCurrent)
            ? (STAGE_ICON[stage.key] || CircleDot)
            : Lock;

          const pct = (i / stageCount) * 100;
          const sz = isCurrent ? iconSizeCurrent : iconSizeBase;
          const innerSz = isCurrent ? innerIconCurrent : innerIconBase;

          return (
            <div
              key={`icon-${stage.key}`}
              className="absolute z-10 flex items-center"
              style={{
                left: `${pct}%`,
                top: "50%",
                transform: `translate(-${sz / 2}px, -50%)`,
              }}
            >
              {/* Icon circle */}
              <div
                className="flex items-center justify-center rounded-full shrink-0"
                style={{
                  width: sz,
                  height: sz,
                  backgroundColor: isFuture
                    ? "rgba(210,210,210,0.95)"
                    : activeHex,
                  border: isFuture
                    ? "1.5px solid rgba(0,0,0,0.08)"
                    : `2px solid ${activeHex}`,
                  boxShadow: isCurrent ? `0 0 0 3px ${activeHex}25` : "none",
                }}
              >
                <IconComponent
                  className="shrink-0"
                  style={{
                    width: innerSz,
                    height: innerSz,
                    color: (isPast || isCurrent) ? "#fff" : "rgba(0,0,0,0.25)",
                  }}
                />
              </div>
              {/* Label next to icon */}
              <span
                className="ml-1 font-bold uppercase tracking-wide leading-none whitespace-nowrap select-none"
                style={{
                  color: (isPast || isCurrent) ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.40)",
                  fontSize: isCurrent ? "11px" : "8px",
                }}
              >
                {stage.short}
              </span>
            </div>
          );
        })}
      </div>

      {/* Lost/DND chip */}
      {isLost && (
        <div
          className="flex items-center gap-1.5 mt-2.5 px-2.5 py-1.5 rounded-lg"
          style={{ backgroundColor: `${PIPELINE_HEX[status]}15` }}
        >
          {status === "DND" ? <Ban className="h-3 w-3" style={{ color: PIPELINE_HEX[status] }} /> : <AlertTriangle className="h-3 w-3" style={{ color: PIPELINE_HEX[status] }} />}
          <span className="text-[10px] font-bold" style={{ color: PIPELINE_HEX[status] }}>{status}</span>
        </div>
      )}
    </div>
  );
}

// ── Tag pill ──────────────────────────────────────────────────────────────────
const TAG_COLOR_MAP: Record<string, string> = {
  red:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  green:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  blue:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  yellow: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  gray:   "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400",
};
function TagPill({ tag }: { tag: { name: string; color: string } }) {
  const cls = TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.gray;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold", cls)}>
      {tag.name}
    </span>
  );
}

// ── Contact widget ─────────────────────────────────────────────────────────────
// ── Inline edit field ──────────────────────────────────────────────────────────
function InlineEditField({ value, field, leadId, onSaved, type = "text" }: {
  value: string;
  field: string;
  leadId: number;
  onSaved?: () => void;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);
  useEffect(() => { setDraft(value); }, [value]);

  const save = useCallback(async () => {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    try {
      await updateLead(leadId, { [field]: draft });
      onSaved?.();
    } catch { setDraft(value); } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [draft, value, field, leadId, onSaved]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        className="w-full text-[12px] font-semibold bg-white/80 border border-brand-indigo/30 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-brand-indigo/40 text-foreground"
      />
    );
  }

  return (
    <div className="group/edit flex items-center gap-1 min-w-0 cursor-text" onClick={() => setEditing(true)}>
      <span className={cn("text-[12px] font-semibold text-foreground leading-snug truncate", type === "tel" && "font-mono")}>
        {value || <span className="text-foreground/25 font-normal italic">—</span>}
      </span>
      {value && (
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          className="opacity-0 group-hover/edit:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity text-muted-foreground hover:text-foreground shrink-0"
          title="Edit"
        >
          <Pencil className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

function ContactWidget({ lead, onRefresh }: { lead: Record<string, any>; onRefresh?: () => void }) {
  const leadId      = getLeadId(lead);
  const phone       = lead.phone || lead.Phone || "";
  const email       = lead.email || lead.Email || "";
  const company     = lead.company || lead.Company || lead.company_name || "";
  const firstName   = lead.first_name || lead.firstName || "";
  const lastName    = lead.last_name || lead.lastName || "";
  const jobTitle    = lead.job_title || lead.jobTitle || lead.title || "";
  const createdAt   = lead.created_at || lead.CreatedAt || lead.createdAt || "";

  const editableRows: { label: string; value: string; field: string; copy?: boolean; type?: string }[] = [
    { label: "First Name",  value: firstName, field: "first_name" },
    { label: "Last Name",   value: lastName,  field: "last_name" },
    { label: "Phone",       value: phone,     field: "phone", copy: true, type: "tel" },
    { label: "Email",       value: email,     field: "email", copy: true, type: "email" },
    { label: "Job Title",   value: jobTitle,  field: "job_title" },
    { label: "Company",     value: company,   field: "company" },
  ];

  return (
    <div className="bg-white/60 rounded-xl p-4 flex flex-col h-full overflow-y-auto">
      <p className="text-[17px] font-semibold font-heading text-foreground mb-3">Contact</p>
      <div className="flex flex-col">
        {editableRows.map((row) => (
          <div key={row.label} className="py-2.5 border-b border-border/20 last:border-0 last:pb-0">
            <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block leading-none mb-1">
              {row.label}
            </span>
            <div className="min-h-[1.125rem] flex items-center gap-1">
              <div className="flex-1 min-w-0">
                <InlineEditField
                  value={row.value}
                  field={row.field}
                  leadId={leadId}
                  onSaved={onRefresh}
                  type={row.type}
                />
              </div>
              {row.copy && row.value && <CopyContactBtn value={row.value} />}
            </div>
          </div>
        ))}
        {/* Created (read-only) */}
        {createdAt && (
          <div className="py-2.5 border-b border-border/20 last:border-0 last:pb-0">
            <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block leading-none mb-1">
              Created
            </span>
            <div className="min-h-[1.125rem]">
              <span className="text-[12px] font-semibold text-foreground leading-snug">
                {formatRelativeTime(createdAt)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Score insights builder ─────────────────────────────────────────────────────
function buildInsights(lead: Record<string, any>, score: number): { text: string; value: string }[] {
  const out: { text: string; value: string }[] = [];

  const status = getStatus(lead);
  if (status) out.push({ text: "Pipeline stage is", value: status });

  const lastActivity = lead.last_interaction_at || lead.last_message_received_at || lead.created_at;
  if (lastActivity) {
    try {
      const days = Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86_400_000);
      const label = days === 0 ? "today" : days === 1 ? "yesterday" : days < 7 ? "this week" : days < 30 ? "this month" : "over a month ago";
      out.push({ text: "Last interaction was", value: label });
    } catch {}
  }

  const source = lead.source || lead.Source;
  if (source) out.push({ text: "Lead source is", value: source });

  const campaign = lead.Campaign || lead.campaign || lead.campaign_name;
  if (campaign && campaign !== "—") out.push({ text: "Active campaign is", value: campaign });

  const bump = lead.bump_stage;
  if (bump !== undefined && bump !== null && Number(bump) > 0) {
    out.push({ text: "Bump sequence at stage", value: String(bump) });
  }

  if (out.length < 3) {
    const potential = score >= 70 ? "high potential" : score >= 40 ? "moderate" : "needs nurturing";
    out.push({ text: "Lead potential is", value: potential });
  }

  return out.slice(0, 4);
}

// ── Score widget with AI summary ──────────────────────────────────────────────
function ScoreWidget({ score, lead, status }: { score: number; lead?: Record<string, any>; status?: string }) {
  const aiSummary = lead?.ai_summary || lead?.aiSummary || "";
  // Fall back to ai_memory parsed summary if no ai_summary
  const memoryStr = lead?.ai_memory || lead?.aiMemory || "";
  let parsedSummary = "";
  if (!aiSummary && memoryStr) {
    try {
      const obj = typeof memoryStr === "string" ? JSON.parse(memoryStr) : memoryStr;
      parsedSummary = obj?.summary || obj?.notes || obj?.description || "";
    } catch { parsedSummary = ""; }
  }
  const summaryText = aiSummary || parsedSummary;

  if (score === 0) {
    return (
      <div className="bg-white/60 rounded-xl p-4 flex flex-col gap-3 h-full overflow-y-auto">
        <p className="text-[17px] font-semibold font-heading text-foreground">Lead Score</p>
        <div className="flex-1 flex flex-col items-center justify-center gap-[3px]">
          <p className="text-2xl font-black text-muted-foreground/25">—</p>
          <p className="text-[10px] text-muted-foreground/50">Not scored</p>
        </div>
        {summaryText && status === "Booked" && (
          <div className="border-t border-border/20 pt-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 mb-1.5">AI Summary</p>
            <p className="text-[12px] text-foreground/75 leading-relaxed">{summaryText}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white/50 rounded-xl p-4 flex flex-col gap-2 h-full overflow-y-auto">
      <p className="text-[17px] font-semibold font-heading text-foreground shrink-0">Lead Score</p>

      {/* Arc gauge */}
      <div className="flex flex-col items-center shrink-0">
        <ScoreArc score={score} status={status} />
      </div>

      {/* AI Summary — only shown for Booked status */}
      {status === "Booked" && summaryText ? (
        <div className="border-t border-border/20 pt-3 mt-1 flex-1 min-h-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Bot className="h-3 w-3 text-brand-indigo/60" />
            <p className="text-[10px] font-medium uppercase tracking-wider text-foreground/40">AI Summary</p>
          </div>
          <p className="text-[12px] text-foreground/75 leading-relaxed">{summaryText}</p>
        </div>
      ) : status === "Booked" ? (
        <div className="border-t border-border/20 pt-3 mt-1 flex-1 min-h-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 mb-1.5">AI Summary</p>
          <p className="text-[11px] text-muted-foreground/50 italic">No AI summary generated yet</p>
        </div>
      ) : null}
    </div>
  );
}

// ── Chat bubble ────────────────────────────────────────────────────────────────
function isAiMsg(item: Interaction): boolean {
  if (item.ai_generated) return true;
  if (item.is_bump) return true;
  if ((item.triggered_by || item.triggeredBy) === "Automation") return true;
  const who = ((item.Who ?? item.who) || "").toLowerCase();
  return ["ai", "bot", "automation"].includes(who);
}

function ChatBubble({ item }: { item: Interaction }) {
  const outbound = item.direction === "Outbound";
  const isAi = isAiMsg(item);
  const ts = item.created_at || item.createdAt || "";

  return (
    <div className={cn("flex gap-2", outbound ? "flex-row-reverse" : "flex-row")} data-testid={`row-interaction-${item.id}`}>
      {!outbound && (
        <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
          <UserIcon className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        </div>
      )}
      {outbound && (
        <div className={cn(
          "h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          isAi ? "bg-brand-indigo/15" : "bg-emerald-900/20"
        )}>
          {isAi
            ? <Bot className="h-3 w-3 text-brand-indigo" />
            : <UserIcon className="h-3 w-3 text-emerald-800" />
          }
        </div>
      )}

      <div className={cn("flex flex-col gap-0.5 max-w-[75%]", outbound ? "items-end" : "items-start")}>
        {outbound && (
          <div className="text-[9px] text-muted-foreground/70 flex items-center gap-1">
            {isAi ? "AI" : "Agent"} · {item.type || "WhatsApp"}
          </div>
        )}
        <div className={cn(
          "rounded-2xl px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap",
          outbound
            ? isAi
              ? "bg-brand-indigo text-white rounded-tr-sm"
              : "bg-[#166534] text-white rounded-tr-sm"
            : "bg-muted/70 text-foreground dark:bg-muted/50 rounded-tl-sm"
        )}>
          {item.content || item.Content || ""}
        </div>
        <div className="text-[10px] text-muted-foreground/60 tabular-nums">{formatMsgTime(ts)}</div>
      </div>
    </div>
  );
}

// ── Conversation widget ────────────────────────────────────────────────────────
function ConversationWidget({ lead, showHeader = false }: { lead: Record<string, any>; showHeader?: boolean }) {
  const leadId = getLeadId(lead);
  const { interactions, loading, refresh } = useInteractions(undefined, leadId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showBypassConfirm, setShowBypassConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sorted = useMemo(
    () => [...interactions].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")),
    [interactions]
  );

  // Scroll to bottom whenever messages change or a new lead is selected
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sorted.length, leadId]);

  const handleSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setDraft("");
    setSending(true);
    try {
      const accountsId = Number(lead.account_id || lead.accounts_id || lead.Accounts_id || 0);
      await sendMessage({
        leadsId: leadId,
        accountsId,
        content,
        type: "WhatsApp",
        direction: "Outbound",
        status: "sent",
        who: "Agent",
      });
      await refresh();
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setSending(false);
    }
  }, [draft, sending, leadId, lead, refresh]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const [refreshing, setRefreshing] = useState(false);
  const handleRefreshChat = useCallback(async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setTimeout(() => setRefreshing(false), 600); }
  }, [refresh]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header with refresh */}
      {showHeader && (
        <div className="px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
          <p className="text-[17px] font-semibold font-heading text-foreground">Chat</p>
          <button
            onClick={handleRefreshChat}
            className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh messages"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>
        </div>
      )}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0"
        data-testid="list-interactions"
      >
        {loading ? (
          <div className="flex flex-col gap-2 py-4">
            {[70, 50, 80, 55].map((w, i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "flex-row-reverse" : "flex-row")}>
                <div
                  className="h-8 rounded-2xl bg-muted/60 animate-pulse"
                  style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }}
                />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No messages yet</p>
            <p className="text-[11px] text-muted-foreground/60">Messages will appear here once outreach begins</p>
          </div>
        ) : (
          sorted.map((item) => <ChatBubble key={item.id} item={item} />)
        )}
      </div>

      <div className="shrink-0 px-3 pb-3 pt-2 rounded-b-xl">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (draft.trim()) setShowBypassConfirm(true);
              }
            }}
            placeholder="Type a message… (Enter to send)"
            rows={1}
            className="flex-1 text-[12px] bg-[#F6F6F6] rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-blue/30 placeholder:text-muted-foreground/40"
            style={{ minHeight: "36px", maxHeight: "80px" }}
            data-testid="input-message-compose"
          />
          <div className="relative">
            <button
              onClick={() => { if (draft.trim()) setShowBypassConfirm(true); }}
              disabled={!draft.trim() || sending}
              className="h-10 w-10 rounded-lg bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 disabled:opacity-40 shrink-0"
              title="Send message"
              data-testid="btn-send-message"
            >
              {sending
                ? <div className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Send className="h-3.5 w-3.5 text-white" />}
            </button>
            {/* Bypass AI confirmation tooltip */}
            {showBypassConfirm && (
              <div className="absolute bottom-12 right-0 z-50 w-52 bg-white rounded-xl shadow-lg border border-border/40 p-3 space-y-2">
                <p className="text-[11px] font-semibold text-foreground">Bypass AI for this message?</p>
                <p className="text-[10px] text-muted-foreground/70 leading-snug">This will send as a human takeover and pause the AI agent.</p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setShowBypassConfirm(false); handleSend(); }}
                    className="flex-1 px-2 py-1.5 rounded-lg bg-gray-900 text-white text-[11px] font-semibold hover:bg-gray-800 transition-colors"
                  >
                    Yes, send
                  </button>
                  <button
                    onClick={() => setShowBypassConfirm(false)}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-border/50 text-[11px] font-medium text-foreground hover:bg-muted/50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Team widget — users managing this lead's account ─────────────────────────
function TeamWidget({ lead, onRefresh }: { lead: Record<string, any>; onRefresh?: () => void }) {
  const accountId = lead.Accounts_id || lead.account_id || lead.accounts_id;
  const leadId = lead.Id ?? lead.id ?? 0;
  const [users, setUsers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const teamMemberIds: number[] = useMemo(() => {
    const raw = lead.team_members || lead.teamMembers;
    if (!raw) return [];
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed.map(Number) : [];
    } catch { return []; }
  }, [lead.team_members, lead.teamMembers]);

  useEffect(() => {
    if (!accountId) { setUsers([]); setAllUsers([]); setLoading(false); return; }
    setLoading(true);
    apiFetch("/api/users")
      .then(async (r) => {
        const data = r.ok ? await r.json() : [];
        const list = Array.isArray(data) ? data : data?.list || [];
        setAllUsers(list);
        const relevant = list.filter((u: any) => {
          const role = u.role || u.Role || "";
          const uAccountId = u.Accounts_id || u.accounts_id || u.account_id;
          const uid = u.id || u.Id;
          if (teamMemberIds.includes(Number(uid))) return true;
          if (role === "Admin" || role === "Operator") return true;
          if (role === "Manager" && Number(uAccountId) === Number(accountId)) return true;
          return false;
        });
        setUsers(relevant);
      })
      .catch(() => { setUsers([]); setAllUsers([]); })
      .finally(() => setLoading(false));
  }, [accountId, teamMemberIds]);

  const handleAddMember = useCallback(async (userId: number) => {
    const newIds = Array.from(new Set([...teamMemberIds, userId]));
    try {
      await updateLead(leadId, { team_members: JSON.stringify(newIds) });
      onRefresh?.();
    } catch { /* noop */ }
    setAddOpen(false);
  }, [teamMemberIds, leadId, onRefresh]);

  const handleRemoveMember = useCallback(async (userId: number) => {
    const newIds = teamMemberIds.filter((id) => id !== userId);
    try {
      await updateLead(leadId, { team_members: JSON.stringify(newIds) });
      onRefresh?.();
    } catch { /* noop */ }
  }, [teamMemberIds, leadId, onRefresh]);

  const availableToAdd = allUsers.filter((u: any) => {
    const uid = u.id || u.Id;
    // Only users of this account (or agency-wide Admin/Operator) can be added
    const uAccountId = u.Accounts_id || u.accounts_id || u.account_id;
    const uRole = u.role || u.Role || "";
    const isAccountMatch = Number(uAccountId) === Number(accountId) || uRole === "Admin" || uRole === "Operator";
    if (!isAccountMatch) return false;
    return !users.some((existing: any) => (existing.id || existing.Id) === uid);
  });

  const roleColors: Record<string, { bg: string; text: string }> = {
    Admin:    { bg: "#EDE9FE", text: "#6D28D9" },
    Operator: { bg: "#DBEAFE", text: "#2563EB" },
    Manager:  { bg: "#D1FAE5", text: "#065F46" },
  };

  return (
    <div className="bg-white/60 rounded-xl p-4 flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[17px] font-semibold font-heading text-foreground">Team</p>
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <button className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-2" sideOffset={4}>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 px-2 py-1">Add team member</p>
            {availableToAdd.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/50 px-2 py-2">No more users available</p>
            ) : (
              <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                {availableToAdd.map((u: any) => {
                  const uName = u.full_name_1 || u.fullName1 || u.fullName || u.full_name || u.name || u.email || u.Email || "Unknown";
                  const uRole = u.role || u.Role || "";
                  return (
                    <button
                      key={u.id || u.Id}
                      onClick={() => handleAddMember(u.id || u.Id)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/60 text-left transition-colors"
                    >
                      <span className="text-[12px] font-medium text-foreground truncate">{uName}</span>
                      <span className="text-[9px] text-muted-foreground/60 uppercase">{uRole}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
      {loading ? (
        <div className="flex flex-col gap-3 py-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2.5 animate-pulse">
              <div className="h-9 w-9 rounded-full bg-foreground/10" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-foreground/10 rounded w-2/3" />
                <div className="h-2.5 bg-foreground/8 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <p className="text-[12px] text-muted-foreground/50 italic mt-1">No team members assigned</p>
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((u: any) => {
            const name = u.full_name_1 || u.fullName1 || u.fullName || u.full_name || u.name || u.email || u.Email || "Unknown";
            const role = u.role || u.Role || "";
            const email = u.email || u.Email || "";
            const avatarUrl = u.avatar_url || u.avatarUrl || "";
            const initials = name.split(" ").map((w: string) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
            const rc = roleColors[role] || { bg: "#F4F4F5", text: "#52525B" };
            return (
              <div key={u.id || u.Id || name} className="flex items-center gap-2.5">
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 overflow-hidden"
                  style={{ backgroundColor: rc.bg, color: rc.text }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-foreground leading-tight truncate">{name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: rc.bg, color: rc.text }}
                    >
                      {role}
                    </span>
                    {email && (
                      <span className="text-[10px] text-muted-foreground/60 truncate">{email}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Notes widget (click-to-edit) ─────────────────────────────────────────────
function NotesWidget({ lead, onRefresh }: { lead: Record<string, any>; onRefresh?: () => void }) {
  const leadId = lead.Id ?? lead.id ?? 0;
  const currentNotes = lead.notes || lead.Notes || "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentNotes);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(currentNotes); }, [currentNotes]);
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editing]);

  const save = useCallback(async () => {
    if (draft === currentNotes) { setEditing(false); return; }
    setSaving(true);
    try {
      await updateLead(leadId, { notes: draft });
      onRefresh?.();
    } catch { setDraft(currentNotes); } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [draft, currentNotes, leadId, onRefresh]);

  return (
    <div className="bg-white/60 rounded-xl p-4 flex flex-col gap-3 min-h-full">
      <p className="text-[17px] font-semibold font-heading text-foreground">Notes</p>
      {editing ? (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setDraft(currentNotes); setEditing(false); }
          }}
          rows={8}
          className="text-[12px] bg-white/70 border border-brand-indigo/30 rounded-lg px-2 py-1.5 w-full resize-none focus:outline-none focus:ring-1 focus:ring-brand-indigo/40 flex-1"
        />
      ) : currentNotes ? (
        <p
          className="text-[12px] text-foreground/80 leading-relaxed cursor-text hover:bg-muted/30 rounded-lg px-1 py-0.5 -mx-1 transition-colors"
          onClick={() => setEditing(true)}
        >
          {currentNotes}
        </p>
      ) : (
        <p
          className="text-[12px] text-muted-foreground/50 italic mt-1 cursor-text hover:bg-muted/30 rounded-lg px-1 py-0.5 -mx-1 transition-colors"
          onClick={() => setEditing(true)}
        >
          Click to add notes...
        </p>
      )}
    </div>
  );
}

// ── Activity timeline widget ────────────────────────────────────────────────
function ActivityTimeline({ lead, tagEvents }: {
  lead: Record<string, any>;
  tagEvents: { name: string; color?: string; appliedAt?: string }[];
}) {
  const { interactions, loading } = useInteractions(undefined, getLeadId(lead));
  const status = getStatus(lead);

  // Build a unified timeline from interactions + tags + status events
  const timeline = useMemo(() => {
    const events: { ts: string; type: string; label: string; detail?: string; icon: React.ElementType; color: string }[] = [];

    // Tag events
    tagEvents.forEach((evt) => {
      events.push({
        ts: evt.appliedAt || "",
        type: "tag",
        label: `Tag "${evt.name}" applied`,
        icon: TagIcon,
        color: resolveColor(evt.color),
      });
    });

    // Status-based events
    if (status === "Booked") {
      const bookedDate = lead.booked_call_date || lead.bookedCallDate || "";
      events.push({
        ts: bookedDate || lead.updated_at || "",
        type: "booked",
        label: "Call Booked",
        detail: bookedDate ? `Scheduled for ${formatMsgTime(bookedDate)}` : undefined,
        icon: Calendar,
        color: "#FCB803",
      });
    }

    if (status === "DND") {
      events.push({
        ts: lead.updated_at || "",
        type: "dnd",
        label: "Do Not Disturb",
        detail: lead.dnc_reason || "Lead requested no contact",
        icon: Ban,
        color: "#EF4444",
      });
    }

    if (lead.opted_out) {
      events.push({
        ts: lead.updated_at || "",
        type: "optout",
        label: "Opted Out",
        detail: lead.dnc_reason || undefined,
        icon: Shield,
        color: "#EF4444",
      });
    }

    // Interaction events (last 10)
    const sortedInteractions = [...interactions]
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
      .slice(0, 10);

    sortedInteractions.forEach((item) => {
      const isAi = isAiMsg(item);
      const outbound = item.direction === "Outbound";
      const content = (item.content || item.Content || "").substring(0, 60);

      if (item.is_bump) {
        events.push({
          ts: item.created_at || "",
          type: "bump",
          label: `AI Follow-up #${item.bump_stage || ""}`,
          detail: content ? `"${content}…"` : undefined,
          icon: Zap,
          color: "#4F46E5",
        });
      } else {
        events.push({
          ts: item.created_at || "",
          type: outbound ? "outbound" : "inbound",
          label: outbound ? (isAi ? "AI Message Sent" : "Agent Message Sent") : "Lead Replied",
          detail: content ? `"${content}${(item.content || item.Content || "").length > 60 ? "…" : ""}"` : undefined,
          icon: outbound ? (isAi ? Bot : UserIcon) : MessageSquare,
          color: outbound ? (isAi ? "#4F46E5" : "#166534") : "#10B981",
        });
      }
    });

    // Sort by timestamp desc
    events.sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
    return events;
  }, [interactions, tagEvents, status, lead]);

  return (
    <div className="bg-white/60 rounded-xl p-4 flex flex-col h-full overflow-y-auto">
      <p className="text-[17px] font-semibold font-heading text-foreground mb-3">Activity</p>
      {loading ? (
        <div className="flex flex-col gap-3 py-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-2.5 animate-pulse">
              <div className="h-6 w-6 rounded-full bg-foreground/10 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-foreground/10 rounded w-3/4" />
                <div className="h-2.5 bg-foreground/8 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : timeline.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-center flex-1">
          <Activity className="h-6 w-6 text-muted-foreground/30" />
          <p className="text-[11px] text-muted-foreground/50">No activity yet</p>
        </div>
      ) : (
        <div className="relative flex flex-col gap-0">
          {/* Vertical line */}
          <div className="absolute left-[11px] top-3 bottom-3 w-[1.5px] bg-border/25" />

          {timeline.map((evt, i) => {
            const Icon = evt.icon;
            return (
              <div key={`${evt.type}-${i}`} className="relative flex items-start gap-2.5 py-2">
                <div
                  className="relative z-10 h-[22px] w-[22px] rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${evt.color}18`, border: `1.5px solid ${evt.color}40` }}
                >
                  <Icon className="h-2.5 w-2.5" style={{ color: evt.color }} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-[11px] font-semibold text-foreground leading-tight">{evt.label}</p>
                  {evt.detail && (
                    <p className="text-[10px] text-muted-foreground/65 leading-snug mt-0.5 truncate">{evt.detail}</p>
                  )}
                  {evt.ts && (
                    <p className="text-[9px] text-muted-foreground/45 mt-0.5 tabular-nums">{formatMsgTime(evt.ts)}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyDetailState({ leadsCount }: { leadsCount: number }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="relative">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 flex items-center justify-center ring-1 ring-amber-200/50 dark:ring-amber-800/30">
          <BookUser className="h-10 w-10 text-amber-400 dark:text-amber-500" />
        </div>
        <div className="absolute -top-2 -right-2 h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center shadow-md ring-2 ring-background">
          <span className="text-[10px] font-bold text-white">{leadsCount > 99 ? "99+" : leadsCount}</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">Select a lead</p>
        <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">
          Click any lead in the list to see their profile, score, and messages.
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-amber-500 dark:text-amber-400 font-medium">
        <span>← Choose from the list</span>
      </div>
    </div>
  );
}

// ── Full lead detail view ──────────────────────────────────────────────────────
export function LeadDetailView({
  lead,
  onClose,
  onRefresh,
}: {
  lead: Record<string, any>;
  onClose: () => void;
  leadTags?: { name: string; color: string }[];
  onRefresh?: () => void;
}) {
  const name        = getFullName(lead);
  const initials    = getInitials(name);
  const status      = getStatus(lead);
  const score       = getScore(lead);
  const avatarColor = getStatusAvatarColor(status);
  const leadId      = getLeadId(lead);
  const lastActivity = lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at;
  const sentiment    = lead.ai_sentiment || lead.aiSentiment || "";
  const bookedDate   = lead.booked_call_date || lead.bookedCallDate || "";
  const ratingLabel  = score >= 70 ? "Hot" : score >= 40 ? "Warm" : "Cold";

  const [, navigate] = useLocation();

  // ── Responsive columns ─────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const [widgetTab, setWidgetTab] = useState<"contact" | "chat" | "score">("contact");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsNarrow(entry.contentRect.width < 820);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Tag events — fetch junction rows + full tag list, merge by ID ──────────
  const [tagEvents, setTagEvents] = useState<{ name: string; color?: string; appliedAt?: string }[]>([]);

  useEffect(() => {
    if (!leadId) { setTagEvents([]); return; }
    Promise.all([
      apiFetch(`/api/leads/${leadId}/tags`).then((r) => r.ok ? r.json() : []),
      apiFetch(`/api/tags`).then((r) => r.ok ? r.json() : []),
    ]).then(([junctionRows, allTagsData]: [any[], any[]]) => {
      const tagById = new Map<number, any>(
        (Array.isArray(allTagsData) ? allTagsData : []).map((t: any) => [t.id ?? t.Id, t])
      );
      const arr = Array.isArray(junctionRows) ? junctionRows : [];
      setTagEvents(arr.map((e: any) => {
        const tid = e.tagsId ?? e.Tags_id;
        const tag = tagById.get(Number(tid));
        return {
          name:      tag?.name  || tag?.Name  || `Tag #${tid ?? "?"}`,
          color:     tag?.color || tag?.Color || "gray",
          appliedAt: e.created_at ?? e.CreatedAt ?? null,
        };
      }));
    }).catch(() => setTagEvents([]));
  }, [leadId]);

  // ── Account logo ───────────────────────────────────────────────────────────
  const [accountLogo, setAccountLogo] = useState<string | null>(null);

  useEffect(() => {
    const accountId = lead.Accounts_id || lead.account_id || lead.accounts_id;
    if (!accountId) { setAccountLogo(null); return; }
    apiFetch(`/api/accounts/${accountId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: any) => setAccountLogo(data?.logo_url || null))
      .catch(() => setAccountLogo(null));
  }, [lead.Accounts_id, lead.account_id, lead.accounts_id]);

  // ── Edit mode ──────────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const startEdit = useCallback(() => {
    setEditFields({
      full_name: getFullName(lead),
      source:    lead.source || lead.Source || "",
    });
    setIsEditing(true);
  }, [lead]);

  const handleSaveEdit = useCallback(async () => {
    setSaving(true);
    try {
      await updateLead(leadId, editFields);
      setIsEditing(false);
      onRefresh?.();
    } catch { /* noop */ } finally {
      setSaving(false);
    }
  }, [leadId, editFields, onRefresh]);

  // ── Delete confirm ─────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteLead(leadId);
      onClose();
      onRefresh?.();
    } catch { /* noop */ } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  }, [leadId, onClose, onRefresh]);

  // ── PDF print ─────────────────────────────────────────────────────────────
  const panelRef = useRef<HTMLDivElement>(null);
  const handlePdf = useCallback(() => {
    const id = `__pdf_panel_${leadId}`;
    if (panelRef.current) panelRef.current.id = id;
    const style = document.createElement("style");
    style.id = "__pdf_print_style__";
    style.textContent = `
      @media print {
        body > * { display: none !important; }
        #${id} { display: flex !important; position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; overflow: hidden !important; z-index: 9999 !important; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.getElementById("__pdf_print_style__")?.remove(), 1200);
  }, [leadId]);

  // ── Booked date navigation ─────────────────────────────────────────────────
  const handleBookedClick = useCallback(() => {
    const prefix = window.location.pathname.startsWith("/subaccount") ? "/subaccount" : "/agency";
    navigate(`${prefix}/calendar`);
  }, [navigate]);

  // ── Toolbar button styles ─────────────────────────────────────────────────
  const toolBtn = "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition-colors";
  const toolBtnDefault = "border-border/60 bg-transparent text-foreground hover:bg-muted/50";
  const toolBtnActive  = "border-brand-indigo/50 bg-brand-indigo/10 text-brand-indigo";
  const toolBtnDanger  = "border-red-300 bg-red-50 text-red-600 hover:bg-red-100";

  // Status color helpers
  const statusBadge = STATUS_COLORS[status] ?? { badge: "bg-muted text-muted-foreground border-border" };

  return (
    <div ref={panelRef} className="relative flex flex-col h-full overflow-hidden">

      {/* ── Full-height gradient ── */}
      <div className="absolute inset-0 bg-[#F8F3EB]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_72%_56%_at_100%_0%,#FFFFFF_0%,rgba(255,255,255,0.80)_30%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_80%_at_0%_0%,#F5E4B5_0%,rgba(245,228,181,0.60)_40%,rgba(245,228,181,0.25)_64%,transparent_80%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_62%_72%_at_100%_36%,rgba(241,218,162,0.62)_0%,transparent_64%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_98%_74%_at_50%_88%,rgba(105,170,255,0.60)_0%,transparent_74%)]" />

      {/* ── Scrollable content ── */}
      <div className="relative flex-1 overflow-y-auto">

        {/* ── Header ── */}
        <div className="shrink-0 px-4 pt-5 pb-3 space-y-3">

          {/* Toolbar */}
          <div className="flex items-center gap-1 flex-wrap">
            {isEditing ? (
              <>
                <button onClick={handleSaveEdit} disabled={saving} className={cn(toolBtn, toolBtnActive)}>
                  <Check className="h-3 w-3" />{saving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setIsEditing(false)} className={cn(toolBtn, toolBtnDefault)}>
                  <X className="h-3 w-3" />Cancel
                </button>
              </>
            ) : (
              <>
                <button onClick={startEdit} className={cn(toolBtn, toolBtnDefault)}>
                  <FileText className="h-3 w-3" />Edit
                </button>
                {deleteConfirm ? (
                  <div className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-red-200 bg-red-50">
                    <span className="text-[11px] text-red-600 font-medium">Delete lead?</span>
                    <button onClick={handleDelete} disabled={deleting} className="text-[11px] font-bold text-red-600 hover:text-red-700 px-1">{deleting ? "…" : "Yes"}</button>
                    <button onClick={() => setDeleteConfirm(false)} className="text-[11px] text-muted-foreground hover:text-foreground px-1">No</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(true)} className={cn(toolBtn, toolBtnDefault)}>
                    <Trash2 className="h-3 w-3" />Delete
                  </button>
                )}
                <button onClick={handlePdf} className={cn(toolBtn, toolBtnDefault)}>
                  <FileText className="h-3 w-3" />To PDF
                </button>
              </>
            )}
          </div>

          {/* Avatar + Name + Tags + Info row (merged onto one line) */}
          <div className="flex items-start gap-3">
            <div
              className="h-[65px] w-[65px] rounded-full flex items-center justify-center text-[22px] font-bold shrink-0 overflow-hidden"
              style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
            >
              {initials}
            </div>

            <div className="flex-1 min-w-0 py-1">
              {isEditing ? (
                <input
                  value={editFields.full_name ?? ""}
                  onChange={(e) => setEditFields((f) => ({ ...f, full_name: e.target.value }))}
                  className="text-[24px] font-semibold font-heading bg-white/70 border border-brand-indigo/30 rounded-lg px-2 py-0.5 w-full focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
                />
              ) : (
                <h2 className="text-[27px] font-semibold font-heading text-foreground leading-tight truncate">{name}</h2>
              )}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded border border-border/50 text-[10px] font-medium text-muted-foreground">Lead</span>
                {sentiment && (
                  <span className="text-[11px] text-foreground/60 font-medium">
                    {sentiment === "Positive" ? "😊" : sentiment === "Negative" ? "😞" : "😐"}{" "}
                    <span className="capitalize">{sentiment}</span>
                  </span>
                )}
                {tagEvents.map((evt, i) => {
                  const hex = resolveColor(evt.color);
                  return (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                      style={{ backgroundColor: `${hex}20`, color: hex }}
                    >
                      <TagIcon className="h-2.5 w-2.5" />{evt.name}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Info items — centered, double gap */}
            <div className="flex items-start gap-10 shrink-0 pt-2 pl-6 flex-wrap">
              <div>
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-1">Source</div>
                {isEditing ? (
                  <input
                    value={editFields.source ?? ""}
                    onChange={(e) => setEditFields((f) => ({ ...f, source: e.target.value }))}
                    className="text-[12px] font-bold bg-white/70 border border-brand-indigo/30 rounded px-1.5 py-0.5 w-20 focus:outline-none"
                  />
                ) : (
                  <div className="text-[12px] font-bold text-foreground">{lead.source || lead.Source || "API"}</div>
                )}
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-1">Rating</div>
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3" style={{ color: ratingLabel === "Hot" ? "#EF4444" : ratingLabel === "Warm" ? "#F59E0B" : "#6B7280" }} />
                  <span className="text-[12px] font-bold text-foreground">{ratingLabel}</span>
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-1">Campaign</div>
                <div className="text-[12px] font-bold text-foreground truncate max-w-[100px]">
                  {lead.Campaign || lead.campaign || lead.campaign_name || "—"}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-1">Owner</div>
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
                    style={accountLogo ? {} : { backgroundColor: "rgba(0,0,0,0.08)", color: "#374151" }}
                  >
                    {accountLogo
                      ? <img src={accountLogo} alt="account" className="h-full w-full object-cover" />
                      : <Building2 className="h-2.5 w-2.5" />}
                  </div>
                  <span className="text-[12px] font-bold text-foreground truncate max-w-[90px]">{lead.Account || lead.account_name || "—"}</span>
                </div>
              </div>
              {bookedDate && (
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-1">Booked</div>
                  <button
                    onClick={handleBookedClick}
                    className="text-[12px] font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                  >
                    <Calendar className="h-3 w-3" />{formatBookedDate(bookedDate)}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Pipeline tube */}
          {status && <PipelineProgress status={status} />}
        </div>

        {/* ── Body — 3x2 widget grid matching Accounts page (each 48vh) ── */}
        <div ref={containerRef} className="p-[3px] flex flex-col gap-[3px]">

          {/* Row 1 */}
          <div className="grid gap-[3px]" style={{ gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr 1fr" }}>
            {/* Contact */}
            <div className="overflow-y-auto rounded-xl" style={{ height: "48vh" }}>
              <ContactWidget lead={lead} onRefresh={onRefresh} />
            </div>
            {/* Chat (top of middle column) */}
            <div className="overflow-hidden rounded-xl bg-white/60 flex flex-col" style={{ height: "48vh" }}>
              <ConversationWidget lead={lead} showHeader />
            </div>
            {/* Lead Score */}
            <div className="overflow-y-auto rounded-xl" style={{ height: "48vh" }}>
              <ScoreWidget score={score} lead={lead} status={status} />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid gap-[3px]" style={{ gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr 1fr" }}>
            {/* Activity Timeline */}
            <div className="overflow-y-auto rounded-xl" style={{ height: "48vh" }}>
              <ActivityTimeline lead={lead} tagEvents={tagEvents} />
            </div>
            {/* Team */}
            <div className="overflow-y-auto rounded-xl" style={{ height: "48vh" }}>
              <TeamWidget lead={lead} onRefresh={onRefresh} />
            </div>
            {/* Notes (click-to-edit) */}
            <div className="overflow-y-auto rounded-xl" style={{ height: "48vh" }}>
              <NotesWidget lead={lead} onRefresh={onRefresh} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Score ring for list cards (mirrors LeadsKanban ScoreRing) ──────────────────
export const LIST_RING_SIZE   = 34;
export const LIST_RING_STROKE = 2.5;
const LIST_RING_RADIUS = (LIST_RING_SIZE - LIST_RING_STROKE * 2) / 2;
const LIST_RING_CIRC   = 2 * Math.PI * LIST_RING_RADIUS;

export function ListScoreRing({ score, status }: { score: number; status: string }) {
  const color  = PIPELINE_HEX[status] || "#6B7280";
  const offset = LIST_RING_CIRC * (1 - Math.max(0, Math.min(1, score / 100)));
  return (
    <div className="relative shrink-0" style={{ width: LIST_RING_SIZE, height: LIST_RING_SIZE }}>
      <svg
        width={LIST_RING_SIZE} height={LIST_RING_SIZE}
        className="absolute inset-0"
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={LIST_RING_SIZE / 2} cy={LIST_RING_SIZE / 2} r={LIST_RING_RADIUS}
          fill="none" stroke={color} strokeOpacity={0.15} strokeWidth={LIST_RING_STROKE}
        />
        <circle
          cx={LIST_RING_SIZE / 2} cy={LIST_RING_SIZE / 2} r={LIST_RING_RADIUS}
          fill="none" stroke={color} strokeWidth={LIST_RING_STROKE}
          strokeDasharray={LIST_RING_CIRC} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold tabular-nums" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

// ── Lead list card ─────────────────────────────────────────────────────────────
function LeadListCard({
  lead,
  isActive,
  onClick,
  leadTags,
  showTagsAlways = false,
}: {
  lead: Record<string, any>;
  isActive: boolean;
  onClick: () => void;
  leadTags: { name: string; color: string }[];
  showTagsAlways?: boolean;
}) {
  const name        = getFullName(lead);
  const initials    = getInitials(name);
  const status      = getStatus(lead);
  const score       = getScore(lead);
  const phone       = getPhone(lead);
  const email       = lead.email || lead.Email || "";
  const lastMsg     = getLastMessage(lead);
  const avatarColor = getStatusAvatarColor(status);
  const statusHex   = PIPELINE_HEX[status] || "#6B7280";
  const lastActivity = lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at;
  const visibleTags = leadTags.slice(0, 3);

  return (
    <div
      className={cn(
        "relative group/card mx-[3px] my-0.5 rounded-xl cursor-pointer transition-colors",
        isActive ? "bg-[#FFF1C8]" : "bg-[#F4F4F4] hover:bg-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div className="px-2.5 pt-2 pb-1.5 flex flex-col gap-0.5">

        {/* Row 1: Avatar | Name + status dot | ScoreRing + lastActivity */}
        <div className="flex items-start gap-2">
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 mt-0.5"
            style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
          >
            {initials}
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-[13px] font-semibold font-heading leading-tight truncate text-foreground">
              {name}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: statusHex }} />
              <span className="text-[10px] text-muted-foreground/65 truncate">{status}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-0.5 shrink-0">
            {score > 0 && <ListScoreRing score={score} status={status} />}
            {lastActivity && (
              <span className="text-[10px] tabular-nums leading-none text-muted-foreground/60">
                {formatRelativeTime(lastActivity)}
              </span>
            )}
          </div>
        </div>

        {/* Hover-expanded (or always-on when showTagsAlways): lastMessage → tags → phone/email */}
        <div className={cn(
          "overflow-hidden transition-all duration-200 ease-out",
          showTagsAlways
            ? "max-h-36 opacity-100"
            : "max-h-0 opacity-0 group-hover/card:max-h-36 group-hover/card:opacity-100"
        )}>
          <div className="pt-1.5 pb-0.5 flex flex-col gap-1.5">
            {lastMsg && (
              <p className="text-[11px] text-muted-foreground/65 truncate leading-snug">
                {lastMsg}
              </p>
            )}
            {visibleTags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {visibleTags.map((t) => {
                  const hex = resolveColor(t.color);
                  return (
                    <span
                      key={t.name}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ backgroundColor: `${hex}20`, color: hex }}
                    >
                      <TagIcon className="h-2.5 w-2.5" />{t.name}
                    </span>
                  );
                })}
              </div>
            )}
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

// ── Group header ───────────────────────────────────────────────────────────────
function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="sticky top-0 z-20 bg-muted px-3 pt-1.5 pb-1.5">
      <div className="flex items-center gap-0">
        {/* Left line */}
        <div className="flex-1 h-px bg-foreground/15 mx-[8px]" />
        {/* Label */}
        <span className="text-[10px] font-bold text-foreground/55 uppercase tracking-widest shrink-0">{label}</span>
        <span className="ml-1 text-[9px] text-muted-foreground/45 font-semibold shrink-0">{count}</span>
        {/* Right line */}
        <div className="flex-1 h-px bg-foreground/15 mx-[8px]" />
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ListSkeleton() {
  return (
    <div className="space-y-0 p-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3.5 rounded-lg animate-pulse"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="h-10 w-10 rounded-lg bg-foreground/10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-foreground/10 rounded-full w-2/3" />
            <div className="h-2.5 bg-foreground/8 rounded-full w-1/2" />
            <div className="h-2 bg-foreground/6 rounded-full w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Group / sort option types ──────────────────────────────────────────────────
export type GroupByOption = "date" | "status" | "campaign" | "tag" | "none";
export type SortByOption  = "recent" | "name_asc" | "name_desc" | "score_desc" | "score_asc";

export const GROUP_LABELS: Record<GroupByOption, string> = {
  date:     "Date",
  status:   "Status",
  campaign: "Campaign",
  tag:      "Tag",
  none:     "None",
};
export const SORT_LABELS: Record<SortByOption, string> = {
  recent:     "Most Recent",
  name_asc:   "Name A → Z",
  name_desc:  "Name Z → A",
  score_desc: "Score ↓",
  score_asc:  "Score ↑",
};
const STATUS_GROUP_ORDER = ["New", "Contacted", "Responded", "Multiple Responses", "Qualified", "Booked", "Lost", "DND"];
const DATE_GROUP_ORDER   = ["Today", "Yesterday", "This Week", "This Month", "Last 3 Months", "Older", "No Activity"];

// ── Kanban detail panel (tabbed, compact) ─────────────────────────────────────
const KANBAN_TABS = [
  { id: "chat",     label: "Chat",     icon: MessageSquare },
  { id: "contact",  label: "Contact",  icon: Phone },
  { id: "score",    label: "Score",    icon: TrendingUp },
  { id: "activity", label: "Activity", icon: ClipboardList },
  { id: "notes",    label: "Notes",    icon: FileText },
] as const;
type KanbanTab = (typeof KANBAN_TABS)[number]["id"];

export function KanbanDetailPanel({
  lead,
  onClose,
  leadTags,
  onOpenFullProfile,
}: {
  lead: Record<string, any>;
  onClose: () => void;
  leadTags: { name: string; color: string }[];
  onOpenFullProfile?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<KanbanTab>("chat");

  const name       = getFullName(lead);
  const initials   = getInitials(name);
  const status     = getStatus(lead);
  const score      = getScore(lead);
  const avatarColor = getStatusAvatarColor(status);
  const ratingLabel = score >= 70 ? "Hot" : score >= 40 ? "Warm" : "Cold";

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card rounded-lg">

      {/* ── Header: avatar + name + X ── */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border/20">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="h-[72px] w-[72px] rounded-full flex items-center justify-center text-xl font-bold shrink-0"
              style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
            >
              {initials}
            </div>
            <div>
              <p className="text-[15px] font-semibold font-heading text-foreground leading-tight truncate max-w-[180px]">{name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{status || "—"}</p>
            </div>
          </div>
          {onOpenFullProfile && (
            <button
              onClick={onOpenFullProfile}
              title="Open full lead profile"
              className="flex items-center gap-1 text-[11px] font-medium text-brand-blue/80 hover:text-brand-blue transition-colors px-2 py-1 rounded-lg hover:bg-brand-blue/5 shrink-0 mt-1"
            >
              <span>Full profile</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={onClose}
            className="icon-circle-lg icon-circle-base shrink-0"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Meta: Source / Rating / Campaign / Owner — all left-aligned */}
        <div className="flex items-start gap-5 flex-wrap">
          <div>
            <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Source</div>
            <div className="text-[12px] font-bold text-foreground">{lead.source || lead.Source || "API"}</div>
          </div>
          <div>
            <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Rating</div>
            <div className="text-[12px] font-bold text-foreground">{ratingLabel}</div>
          </div>
          <div>
            <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Campaign</div>
            <div className="text-[12px] font-bold text-foreground truncate max-w-[90px]">{lead.Campaign || lead.campaign || "—"}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(0,0,0,0.08)", color: "#374151" }}
            >
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Owner</div>
              <div className="text-[12px] font-bold text-foreground truncate max-w-[80px]">{lead.Account || lead.account_name || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="shrink-0 px-2 pt-2 pb-1 flex items-center gap-1">
        {KANBAN_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium",
              activeTab === id
                ? "bg-[#FFE35B] text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Active widget ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "chat" && <ConversationWidget lead={lead} />}
        {activeTab === "contact" && (
          <div className="h-full overflow-y-auto p-3">
            <ContactWidget lead={lead} />
          </div>
        )}
        {activeTab === "score" && (
          <div className="h-full overflow-y-auto p-3">
            <ScoreWidget score={score} lead={lead} status={status} />
          </div>
        )}
        {activeTab === "activity" && (
          <div className="h-full overflow-y-auto p-4">
            <p className="text-[15px] font-semibold font-heading text-foreground mb-3">Activity</p>
            <div className="flex flex-col gap-2">
              {[
                { label: "Messages sent",      value: String(lead.message_count_sent ?? lead.messageCountSent ?? "—") },
                { label: "Messages received",  value: String(lead.message_count_received ?? lead.messageCountReceived ?? "—") },
                { label: "Total interactions", value: String(lead.interaction_count ?? lead.interactionCount ?? "—") },
                { label: "Last active",        value: formatRelativeTime(lead.last_interaction_at || lead.last_message_received_at) || "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                  <span className="text-[12px] font-semibold text-foreground tabular-nums">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === "notes" && (
          <div className="h-full overflow-y-auto p-4">
            <p className="text-[15px] font-semibold font-heading text-foreground mb-3">Notes</p>
            {lead.notes || lead.Notes ? (
              <p className="text-[12px] text-foreground/80 leading-relaxed">
                {lead.notes || lead.Notes}
              </p>
            ) : (
              <p className="text-[12px] text-muted-foreground/50 italic">No notes yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
const VIEW_TABS: TabDef[] = [
  { id: "list",   label: "List",   icon: List },
  { id: "table",  label: "Table",  icon: Table2 },
];

export function LeadsCardView({
  leads,
  loading,
  selectedLead,
  onSelectLead,
  onClose,
  leadTagsInfo,
  onRefresh,
  listSearch,
  groupBy,
  sortBy,
  filterStatus,
  filterTags,
  viewMode,
  onViewModeChange,
  searchOpen,
  onSearchOpenChange,
  onListSearchChange,
  onGroupByChange,
  onSortByChange,
  onToggleFilterStatus,
  onToggleFilterTag,
  allTags,
  hasNonDefaultControls,
  isGroupNonDefault,
  isSortNonDefault,
  onResetControls,
  onCreateLead,
}: LeadsCardViewProps) {
  const [currentPage, setCurrentPage]   = useState(0);
  const PAGE_SIZE = 50;

  const [showTagsAlways, setShowTagsAlways] = useState<boolean>(() => {
    try { return localStorage.getItem("list_tags_always_show") === "true"; } catch {} return false;
  });
  useEffect(() => {
    try { localStorage.setItem("list_tags_always_show", String(showTagsAlways)); } catch {}
  }, [showTagsAlways]);

  const flatItems = useMemo((): VirtualListItem[] => {
    // 1. Text search
    let filtered = leads;
    if (listSearch.trim()) {
      const q = listSearch.toLowerCase();
      filtered = filtered.filter((l) =>
        String(l.full_name || "").toLowerCase().includes(q) ||
        String(l.first_name || "").toLowerCase().includes(q) ||
        String(l.last_name || "").toLowerCase().includes(q) ||
        String(l.email || "").toLowerCase().includes(q) ||
        String(l.phone || "").toLowerCase().includes(q)
      );
    }

    // 2. Status filter
    if (filterStatus.length > 0) {
      filtered = filtered.filter((l) => filterStatus.includes(getStatus(l)));
    }

    // 3. Tag filter
    if (filterTags.length > 0) {
      filtered = filtered.filter((l) => {
        const tags = leadTagsInfo.get(getLeadId(l)) || [];
        return filterTags.some((ft) => tags.some((t) => t.name === ft));
      });
    }

    // 4. Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name_asc":   return getFullName(a).localeCompare(getFullName(b));
        case "name_desc":  return getFullName(b).localeCompare(getFullName(a));
        case "score_desc": return getScore(b) - getScore(a);
        case "score_asc":  return getScore(a) - getScore(b);
        default: { // recent
          const da = a.last_interaction_at || a.last_message_received_at || a.created_at || "";
          const db = b.last_interaction_at || b.last_message_received_at || b.created_at || "";
          return db.localeCompare(da);
        }
      }
    });

    // 5. Group and flatten
    if (groupBy === "none") {
      return filtered.map((l) => ({ kind: "lead", lead: l, tags: leadTagsInfo.get(getLeadId(l)) || [] }));
    }

    const buckets = new Map<string, Record<string, any>[]>();

    filtered.forEach((l) => {
      let key: string;
      if (groupBy === "date") {
        const d = l.last_interaction_at || l.last_message_received_at || l.last_message_sent_at || null;
        key = getDateGroupLabel(d);
      } else if (groupBy === "status") {
        key = getStatus(l) || "Unknown";
      } else if (groupBy === "campaign") {
        key = l.Campaign || l.campaign || l.campaign_name || "No Campaign";
      } else {
        const tags = leadTagsInfo.get(getLeadId(l)) || [];
        key = tags[0]?.name || "Untagged";
      }
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(l);
    });

    // Sort bucket keys
    const allBucketKeys = Array.from(buckets.keys());
    const orderedKeys = groupBy === "status"
      ? STATUS_GROUP_ORDER.filter((k) => buckets.has(k)).concat(allBucketKeys.filter((k) => !STATUS_GROUP_ORDER.includes(k)))
      : groupBy === "date"
      ? DATE_GROUP_ORDER.filter((k) => buckets.has(k))
      : allBucketKeys.sort();

    const result: VirtualListItem[] = [];
    orderedKeys.forEach((key) => {
      const group = buckets.get(key);
      if (!group || group.length === 0) return;
      result.push({ kind: "header", label: key, count: group.length });
      group.forEach((l) => result.push({ kind: "lead", lead: l, tags: leadTagsInfo.get(getLeadId(l)) || [] }));
    });

    return result;
  }, [leads, listSearch, groupBy, sortBy, filterStatus, filterTags, leadTagsInfo]);

  // Reset to page 0 whenever the filtered/sorted list changes
  useEffect(() => { setCurrentPage(0); }, [flatItems]);

  const isFilterActive     = filterStatus.length > 0 || filterTags.length > 0;

  return (
    /* Outer shell: transparent — gaps between panels reveal stone-gray page background */
    <div className="flex h-full min-h-[600px] overflow-hidden gap-[3px]">

      {/* ── LEFT: Lead List ── muted panel (#E3E3E3) */}
      <div className="flex flex-col bg-muted rounded-lg overflow-hidden w-[340px] flex-shrink-0">

        {/* ── Panel header: title + count ── */}
        <div className="px-3.5 pt-5 pb-1 shrink-0 flex items-center justify-between">
          <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">My Leads</h2>
          <span className="w-10 text-center text-[12px] font-medium text-muted-foreground tabular-nums">{leads.length}</span>
        </div>

        {/* ── Controls row: tabs (left) + search/settings (right) — all on one line ── */}
        <div className="px-3 pt-1.5 pb-3 shrink-0 flex items-center justify-between gap-2">

          {/* Tab switchers */}
          <ViewTabBar tabs={VIEW_TABS} activeId={viewMode} onTabChange={(id) => onViewModeChange(id as ViewMode)} />

          {/* Search + Settings — flat row, all buttons same height */}
          <div className="flex items-center gap-1.5 shrink-0">

            {/* + New Lead */}
            <IconBtn title="New lead" onClick={onCreateLead}>
              <Plus className="h-4 w-4" />
            </IconBtn>

            {/* Search popup */}
            <Popover open={searchOpen} onOpenChange={(open) => { onSearchOpenChange(open); if (!open) onListSearchChange(""); }}>
              <PopoverTrigger asChild>
                <IconBtn active={searchOpen || !!listSearch} title="Search leads">
                  <Search className="h-4 w-4" />
                </IconBtn>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-2" sideOffset={4}>
                <input
                  value={listSearch}
                  onChange={(e) => onListSearchChange(e.target.value)}
                  placeholder="Search leads..."
                  autoFocus
                  className="w-full h-8 px-3 rounded-lg bg-muted/60 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-blue/30 placeholder:text-muted-foreground/60"
                />
              </PopoverContent>
            </Popover>

            {/* Settings dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconBtn active={hasNonDefaultControls || showTagsAlways} title="Group, Sort & Filter">
                  <SlidersHorizontal className="h-4 w-4" />
                </IconBtn>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-[12px]">
                    <Layers className="h-3.5 w-3.5 mr-2" />
                    Group
                    {isGroupNonDefault && <span className="ml-auto text-[10px] text-brand-blue font-medium">{GROUP_LABELS[groupBy]}</span>}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-40">
                    {(["date", "status", "campaign", "tag", "none"] as GroupByOption[]).map((opt) => (
                      <DropdownMenuItem key={opt} onClick={() => onGroupByChange(opt)} className={cn("text-[12px]", groupBy === opt && "font-semibold text-brand-blue")}>
                        {GROUP_LABELS[opt]}
                        {groupBy === opt && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-[12px]">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-2" />
                    Sort
                    {isSortNonDefault && <span className="ml-auto text-[10px] text-brand-blue font-medium">{SORT_LABELS[sortBy]}</span>}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-44">
                    {(["recent", "name_asc", "name_desc", "score_desc", "score_asc"] as SortByOption[]).map((opt) => (
                      <DropdownMenuItem key={opt} onClick={() => onSortByChange(opt)} className={cn("text-[12px]", sortBy === opt && "font-semibold text-brand-blue")}>
                        {SORT_LABELS[opt]}
                        {sortBy === opt && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-[12px]">
                    <Filter className="h-3.5 w-3.5 mr-2" />
                    Filter Status
                    {filterStatus.length > 0 && <span className="ml-auto text-[10px] text-brand-blue font-medium">{filterStatus.length}</span>}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48 max-h-60 overflow-y-auto">
                    {STATUS_GROUP_ORDER.map((s) => (
                      <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); onToggleFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PIPELINE_HEX[s] ?? "#6B7280" }} />
                        <span className="flex-1">{s}</span>
                        {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-blue shrink-0" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {allTags.length > 0 && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="text-[12px]">
                      <Filter className="h-3.5 w-3.5 mr-2" />
                      Filter Tags
                      {filterTags.length > 0 && <span className="ml-auto text-[10px] text-brand-blue font-medium">{filterTags.length}</span>}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-44 max-h-60 overflow-y-auto">
                      {allTags.map((t) => (
                        <DropdownMenuItem key={t.name} onClick={(e) => { e.preventDefault(); onToggleFilterTag(t.name); }} className="flex items-center gap-2 text-[12px]">
                          <span className="flex-1">{t.name}</span>
                          {filterTags.includes(t.name) && <Check className="h-3 w-3 text-brand-blue shrink-0" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowTagsAlways((v) => !v)}
                  className="flex items-center gap-2 text-[12px]"
                >
                  <TagIcon className="h-3.5 w-3.5 mr-0.5 shrink-0" />
                  <span className="flex-1">Show Tags Always</span>
                  {showTagsAlways && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>

                {hasNonDefaultControls && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onResetControls} className="text-[12px] text-destructive">
                      Reset all settings
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Lead list — card list (pagination inside scroll area, below last card) */}
        <div className="flex-1 overflow-y-auto pt-0 pb-2">
          {loading ? (
            <ListSkeleton />
          ) : flatItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                {listSearch || isFilterActive ? "No leads match your filters" : "No leads found"}
              </p>
            </div>
          ) : (
            <>
              <motion.div
                key={`page-${currentPage}`}
                variants={staggerContainerVariants}
                initial="hidden"
                animate="visible"
                custom={Math.min(flatItems.length - currentPage * PAGE_SIZE, PAGE_SIZE)}
              >
                {flatItems
                  .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
                  .map((item, i) => {
                    const selectedId = selectedLead ? getLeadId(selectedLead) : null;
                    return item.kind === "header" ? (
                      <motion.div key={`h-${item.label}-${i}`} variants={staggerItemVariants}>
                        <GroupHeader label={item.label} count={item.count} />
                      </motion.div>
                    ) : (
                      <motion.div key={getLeadId(item.lead)} variants={staggerItemVariants}>
                        <LeadListCard
                          lead={item.lead}
                          isActive={selectedId === getLeadId(item.lead)}
                          onClick={() => onSelectLead(item.lead)}
                          leadTags={item.tags}
                          showTagsAlways={showTagsAlways}
                        />
                      </motion.div>
                    );
                  })}
              </motion.div>

              {/* Pagination — below last card, inside scroll area */}
              {flatItems.length > PAGE_SIZE && (
                <div className="px-3 py-3 mt-2 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className="icon-circle-lg icon-circle-base disabled:opacity-30"
                    title="Previous page"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[10px] text-muted-foreground tabular-nums text-center leading-tight">
                    {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, flatItems.length)}
                    {" "}<span className="text-muted-foreground/50">of {flatItems.length}</span>
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={(currentPage + 1) * PAGE_SIZE >= flatItems.length}
                    className="icon-circle-lg icon-circle-base disabled:opacity-30"
                    title="Next page"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── RIGHT: Detail panel ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-card rounded-lg">
        {selectedLead ? (
          <LeadDetailView
            lead={selectedLead}
            onClose={onClose}
            leadTags={leadTagsInfo.get(getLeadId(selectedLead)) || []}
            onRefresh={onRefresh}
          />
        ) : (
          <EmptyDetailState leadsCount={leads.length} />
        )}
      </div>
    </div>
  );
}
