import { useState, useMemo, useCallback, useRef, useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn, relativeTime } from "@/lib/utils";
import {
  Phone,
  Mail,
  Users,
  BookUser,
  MessageSquare,
  Copy,
  Check,
  CheckCheck,
  Send,
  Bot,
  Smile,
  Paperclip,
  Mic,
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
  Kanban,
  Maximize2,
  Eye,
  EyeOff,
  Palette,
  ChevronDown,
  Square,
  Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
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
import { SearchPill } from "@/components/ui/search-pill";
import { useInteractions, useInteractionsPaginated } from "@/hooks/useApiData";
import { sendMessage } from "@/features/conversations/api/conversationsApi";
import type { Interaction } from "@/types/models";
import { resolveColor } from "@/features/tags/types";
import { getLeadStatusAvatarColor, getCampaignAvatarColor, PIPELINE_HEX as PIPELINE_HEX_UTIL, getInitials as getInitialsUtil } from "@/lib/avatarUtils";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { CAMPAIGN_STICKERS } from "@/assets/campaign-stickers/index";
import { SkeletonLeadPanel } from "@/components/ui/skeleton";
import { renderRichText } from "@/lib/richTextUtils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useSession, type SessionUser } from "@/hooks/useSession";

// ── Re-exports for backward compat — other files importing from LeadsCardView still work ──
export { getLeadStatusAvatarColor as getStatusAvatarColor, PIPELINE_HEX } from "@/lib/avatarUtils";

export type ViewMode = "list" | "table" | "pipeline";

// ── Score insight tag type ──────────────────────────────────────────────────
type ScoreInsight = { direction: "up" | "down"; label: string };

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
  mobileView?: "list" | "detail";
  onMobileViewChange?: (v: "list" | "detail") => void;
  accountsById?: Map<number, string>;
  campaignsById?: Map<number, { name: string; accountId: number | null }>;
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

// PIPELINE_HEX moved to @/lib/avatarUtils — re-exported above for backward compat
const PIPELINE_HEX = PIPELINE_HEX_UTIL;

// getStatusAvatarColor moved to @/lib/avatarUtils as getLeadStatusAvatarColor — re-exported above
const getStatusAvatarColor = getLeadStatusAvatarColor;

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
function getDateGroupLabel(dateStr: string | null | undefined, t: (key: string) => string): string {
  if (!dateStr) return t("time.noActivity");
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
    if (diff <= 0)  return t("time.today");
    if (diff === 1) return t("time.yesterday");
    if (diff < 7)   return t("time.thisWeek");
    if (diff < 30)  return t("time.thisMonth");
    if (diff < 90)  return t("time.last3Months");
    return t("time.older");
  } catch { return t("time.noActivity"); }
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
  return getInitialsUtil(name);
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
function formatRelativeTime(dateStr: string | null | undefined, t: (key: string, opts?: Record<string, any>) => string): string {
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
  } catch { return ""; }
}
// ── Date helpers (matching ChatPanel) ─────────────────────────────────────────
function getDateKey(ts: string | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toDateString();
}
function formatDateLabel(ts: string, t: (key: string) => string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - msgDay.getTime()) / 86_400_000);
  if (diff === 0) return t("time.today");
  if (diff === 1) return t("time.yesterday");
  return d.toLocaleDateString([], { month: "long", day: "numeric" });
}
function formatBubbleTime(ts: string | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

  // Background track: semicircle from left to right, arcing upward through the top
  const bgPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  // Score fill: arc from left to score position (sweep-flag=1 → clockwise = upward)
  let fillPath = "";
  if (score > 0) {
    if (score >= 100) {
      fillPath = bgPath;
    } else {
      const angleRad = ((score / 100) * 180 * Math.PI) / 180;
      const endX = (cx - r * Math.cos(angleRad)).toFixed(2);
      const endY = (cy - r * Math.sin(angleRad)).toFixed(2);
      fillPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${endX} ${endY}`;
    }
  }

  return (
    <svg viewBox="0 0 200 115" className="w-full max-w-[200px] mx-auto">
      {/* Track */}
      <path d={bgPath} fill="none" stroke="#E5E7EB" strokeWidth={sw} strokeLinecap="round" />
      {/* Fill */}
      {fillPath && (
        <path d={fillPath} fill="none" stroke={fillColor} strokeWidth={sw} strokeLinecap="round" />
      )}
      {/* Score number — baseline aligned with arc base */}
      <text x={cx} y={cy + 6} textAnchor="middle"
        fontSize="38" fontWeight="900" fontFamily="inherit" fill="#111827" letterSpacing="-2">
        {score}
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

// ── Default anchor stage for terminal statuses ───────────────────────────────
// DND typically happens at Responded or Multi; Lost similarly.
// "Multiple Responses" (index 3) is the default anchor for both.
const TERMINAL_DEFAULT_ANCHOR: Record<string, number> = {
  DND:  3, // after "Multiple Responses"
  Lost: 3,
};

// ── Pipeline progress — monochrome tube, icons+labels at left of each segment ─
function PipelineProgress({ status }: { status: string }) {
  const { t } = useTranslation("leads");
  const currentIndex = PIPELINE_STAGES.findIndex((s) => s.key === status);
  const isTerminal = LOST_STAGES.includes(status);
  const tubeHeight = 46;
  const stageCount = PIPELINE_STAGES.length;

  // For terminal statuses (DND/Lost), anchor = the last normal stage before the exit.
  // The terminal icon replaces the stage right after the anchor (same slot, same position).
  const anchorIndex = isTerminal
    ? (TERMINAL_DEFAULT_ANCHOR[status] ?? 3)
    : currentIndex;
  // effectiveIndex = the slot whose icon gets the "current" treatment
  const effectiveIndex = isTerminal ? anchorIndex + 1 : anchorIndex;

  // Sizes — current stage is slightly bigger
  const iconSizeBase = 30;
  const iconSizeCurrent = 36;
  const innerIconBase = 16;
  const innerIconCurrent = 20;

  // Monochrome: entire filled bar uses the status color
  const activeHex = PIPELINE_HEX[status] || "#6B7280";
  const barHex = `${activeHex}B0`;

  return (
    <div className="w-full">
      <div className="relative" style={{ height: tubeHeight + 14 }}>
        {/* Gray track underneath (full width) — multiply blend, 6px slimmer than color bar */}
        <div
          className="absolute rounded-full"
          style={{ left: 0, right: 0, top: "50%", transform: "translateY(-50%)", height: tubeHeight - 6, backgroundColor: "rgba(55,55,55,0.160)", mixBlendMode: "multiply" }}
        />

        {/* Colored segments on top */}
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
                bg = `linear-gradient(to right, ${barHex} 0%, ${barHex} 45%, transparent 100%)`;
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

          // For the terminal slot, show DND/Lost icon instead of the normal stage icon
          const isTerminalSlot = isTerminal && i === effectiveIndex;

          const IconComponent = isTerminalSlot
            ? (status === "DND" ? Ban : AlertTriangle)
            : (isPast || isCurrent)
              ? (STAGE_ICON[stage.key] || CircleDot)
              : Lock;

          const pct = (i / stageCount) * 100;
          const sz = isCurrent ? iconSizeCurrent : iconSizeBase;
          const innerSz = isCurrent ? innerIconCurrent : innerIconBase;

          // Terminal slot label shows "DND" or "Lost" instead of the stage name
          const label = isTerminalSlot
            ? t(`kanban.stageLabels.${status}`, status)
            : t(`kanban.stageLabels.${stage.key.replace(/ /g, "")}`, stage.short);

          return (
            <div
              key={`icon-${stage.key}`}
              className="absolute z-10 flex items-center"
              style={{
                left: `${pct}%`,
                top: "50%",
                transform: i === 0 ? "translate(15px, -50%)" : `translate(calc(15px - ${sz / 2}px), -50%)`,
              }}
            >
              {/* Icon circle */}
              <div
                className="flex items-center justify-center rounded-full shrink-0"
                style={{
                  width: sz,
                  height: sz,
                  backgroundColor: "#fff",
                  border: isFuture
                    ? "1.5px solid rgba(0,0,0,0.12)"
                    : `2.5px solid ${activeHex}`,
                  boxShadow: isCurrent ? `0 0 0 3px ${activeHex}40` : "none",
                }}
              >
                <IconComponent
                  className="shrink-0"
                  style={{
                    width: innerSz,
                    height: innerSz,
                    color: isTerminalSlot ? activeHex : (isPast || isCurrent) ? "#1F1F1F" : "rgba(0,0,0,0.20)",
                  }}
                />
              </div>
              {/* Label next to icon */}
              <span
                className="ml-2 font-bold tracking-wide leading-none whitespace-nowrap select-none capitalize"
                style={{
                  color: isCurrent ? "#FFFFFF" : isFuture ? "#000000" : "#1F1F1F",
                  fontSize: isCurrent ? "11px" : "8px",
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Pipeline progress — compact version for mobile ─────────────────────────
function PipelineProgressCompact({ status }: { status: string }) {
  const { t } = useTranslation("leads");
  const currentIndex = PIPELINE_STAGES.findIndex((s) => s.key === status);
  const isTerminal = LOST_STAGES.includes(status);
  const anchorIndex = isTerminal ? (TERMINAL_DEFAULT_ANCHOR[status] ?? 3) : currentIndex;
  const effectiveIndex = isTerminal ? anchorIndex + 1 : anchorIndex;
  const futureCount = Math.max(0, PIPELINE_STAGES.length - 1 - effectiveIndex);
  const locksToShow = Math.min(futureCount, 2);
  const activeHex = PIPELINE_HEX[status] || "#6B7280";
  const barHex = `${activeHex}B0`;
  const currentStageKey = isTerminal ? status : (PIPELINE_STAGES[effectiveIndex]?.key ?? status);
  const currentStage = t(`kanban.stageLabels.${currentStageKey.replace(/ /g, "")}`, currentStageKey);
  const CurrentIcon = isTerminal
    ? (status === "DND" ? Ban : AlertTriangle)
    : (STAGE_ICON[PIPELINE_STAGES[effectiveIndex]?.key] || CircleDot);
  const filledPct = effectiveIndex > 0
    ? `${(effectiveIndex / (PIPELINE_STAGES.length - 1)) * 100}%`
    : "0%";

  return (
    <div className="flex items-center gap-2 w-full">
      {effectiveIndex > 0 && (
        <div
          className="h-[8px] rounded-full shrink-0"
          style={{ width: filledPct, maxWidth: "30%", background: barHex }}
        />
      )}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shrink-0"
        style={{ border: `2px solid ${activeHex}`, boxShadow: `0 0 0 3px ${activeHex}30`, background: "#fff" }}
      >
        <CurrentIcon style={{ width: 14, height: 14, color: activeHex }} />
        <span className="text-[11px] font-bold" style={{ color: activeHex }}>{currentStage}</span>
      </div>
      {Array.from({ length: locksToShow }).map((_, i) => (
        <div
          key={i}
          className="h-[28px] w-[28px] rounded-full flex items-center justify-center shrink-0"
          style={{ border: "1.5px solid rgba(0,0,0,0.12)", background: "#fff" }}
        >
          <Lock style={{ width: 12, height: 12, color: "rgba(0,0,0,0.20)" }} />
        </div>
      ))}
      <div className="flex-1 h-[8px] rounded-full" style={{ background: "rgba(55,55,55,0.10)" }} />
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
        className="w-full text-[12px] font-semibold bg-white/80 dark:bg-white/[0.08] border border-brand-indigo/30 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-brand-indigo/40 text-foreground"
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
  const { t } = useTranslation("leads");
  const leadId      = getLeadId(lead);
  const phone       = lead.phone || lead.Phone || "";
  const email       = lead.email || lead.Email || "";
  const company     = lead.company || lead.Company || lead.company_name || "";
  const firstName   = lead.first_name || lead.firstName || "";
  const lastName    = lead.last_name || lead.lastName || "";
  const jobTitle    = lead.job_title || lead.jobTitle || lead.title || "";
  const createdAt   = lead.created_at || lead.CreatedAt || lead.createdAt || "";

  const editableRows: { label: string; value: string; field: string; copy?: boolean; type?: string }[] = [
    { label: t("contact.firstName"),  value: firstName, field: "first_name" },
    { label: t("contact.lastName"),   value: lastName,  field: "last_name" },
    { label: t("contact.phone"),      value: phone,     field: "phone", copy: true, type: "tel" },
    { label: t("contact.email"),      value: email,     field: "email", copy: true, type: "email" },
  ];

  return (
    <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-[21px] flex flex-col h-full overflow-y-auto">
      <p className="text-[18px] font-semibold font-heading text-foreground mb-3">{t("contact.title")}</p>
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
              {t("contact.created")}
            </span>
            <div className="min-h-[1.125rem]">
              <span className="text-[12px] font-semibold text-foreground leading-snug">
                {formatRelativeTime(createdAt, t)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Score insights builder ─────────────────────────────────────────────────────
function buildInsights(lead: Record<string, any>, score: number, t?: (key: string) => string): { text: string; value: string }[] {
  const out: { text: string; value: string }[] = [];
  const _t = (key: string, fallback: string) => t ? t(key) : fallback;

  const status = getStatus(lead);
  if (status) out.push({ text: _t("score.insights.pipelineStageIs", "Pipeline stage is"), value: status });

  const lastActivity = lead.last_interaction_at || lead.last_message_received_at || lead.created_at;
  if (lastActivity) {
    try {
      const days = Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86_400_000);
      const label = days === 0 ? "today" : days === 1 ? "yesterday" : days < 7 ? "this week" : days < 30 ? "this month" : "over a month ago";
      out.push({ text: _t("score.insights.lastInteractionWas", "Last interaction was"), value: label });
    } catch {}
  }

  const source = lead.source || lead.Source;
  if (source) out.push({ text: _t("score.insights.leadSourceIs", "Lead source is"), value: source });

  const campaign = lead.Campaign || lead.campaign || lead.campaign_name;
  if (campaign && campaign !== "—") out.push({ text: _t("score.insights.activeCampaignIs", "Active campaign is"), value: campaign });

  const bump = lead.bump_stage;
  if (bump !== undefined && bump !== null && Number(bump) > 0) {
    out.push({ text: _t("score.insights.bumpSequenceAtStage", "Bump sequence at stage"), value: String(bump) });
  }

  if (out.length < 3) {
    const potential = score >= 70
      ? _t("score.insights.highPotential", "high potential")
      : score >= 40
        ? _t("score.insights.moderate", "moderate")
        : _t("score.insights.needsNurturing", "needs nurturing");
    out.push({ text: _t("score.insights.leadPotentialIs", "Lead potential is"), value: potential });
  }

  return out.slice(0, 4);
}

// ── Score insights — scripted rules tied to the real scoring formula ──────────
// Formula: Lead Score = 40% Funnel + 30% Engagement + 30% Activity
function buildScoreInsights(lead: Record<string, any>, t?: (key: string) => string): ScoreInsight[] {
  const out: ScoreInsight[] = [];

  const status = (lead.conversion_status || lead.Conversion_Status || "").toString();
  const sentimentRaw = (lead.ai_sentiment || lead.aiSentiment || "").toString().toLowerCase();
  const received = Number(lead.message_count_received ?? lead.messageCountReceived ?? 0);
  const sent = Number(lead.message_count_sent ?? lead.messageCountSent ?? 0);
  const bumps = Number(lead.current_bump_stage ?? lead.currentBumpStage ?? 0);
  const optedOut = !!(lead.opted_out ?? lead.optedOut);
  const bookingConfirmed = !!(lead.booking_confirmed_at_ || lead.bookingConfirmedAt);

  const now = Date.now();
  const lastReceivedAt = lead.last_message_received_at || lead.lastMessageReceivedAt;
  const lastReceivedMs = lastReceivedAt ? new Date(lastReceivedAt).getTime() : null;
  const lastReceivedDays = lastReceivedMs !== null ? (now - lastReceivedMs) / 86_400_000 : null;

  // ── Positive factors (funnel stage — 40% weight) ─────────────────────────
  const _t = (key: string, fallback: string) => t ? t(key) : fallback;

  if (bookingConfirmed || status === "Booked") {
    out.push({ direction: "up", label: _t("score.insights.callBooked", "Call successfully booked") });
  } else if (status === "Qualified") {
    out.push({ direction: "up", label: _t("score.insights.leadQualified", "Lead is qualified") });
  } else if (status === "Multiple Responses") {
    out.push({ direction: "up", label: _t("score.insights.multipleResponses", "Multiple responses received") });
  } else if (status === "Responded") {
    out.push({ direction: "up", label: _t("score.insights.leadResponded", "Lead has responded") });
  }

  // ── Negative factors (funnel stage) ──────────────────────────────────────
  if (optedOut) {
    out.push({ direction: "down", label: _t("score.insights.leadOptedOut", "Lead opted out") });
  } else if (status === "DND") {
    out.push({ direction: "down", label: _t("score.insights.dndStatus", "Do-not-disturb status") });
  } else if (status === "Lost") {
    out.push({ direction: "down", label: _t("score.insights.leadLost", "Lead marked as lost") });
  }

  // ── Sentiment (engagement score ±10) ─────────────────────────────────────
  if (sentimentRaw === "positive") {
    out.push({ direction: "up", label: _t("score.insights.positiveSentiment", "Positive sentiment detected") });
  } else if (sentimentRaw === "negative") {
    out.push({ direction: "down", label: _t("score.insights.negativeSentiment", "Negative sentiment detected") });
  } else if (sentimentRaw === "neutral") {
    out.push({ direction: "down", label: _t("score.insights.neutralSentiment", "Neutral sentiment detected") });
  }

  // ── Recency tiers (engagement score +5/+10/+20, exclusive) ───────────────
  if (lastReceivedDays !== null) {
    if (lastReceivedDays < 1) {
      out.push({ direction: "up", label: _t("score.insights.repliedLast24h", "Replied in last 24h") });
    } else if (lastReceivedDays < 2) {
      out.push({ direction: "up", label: _t("score.insights.repliedWithin48h", "Replied within 48h") });
    } else if (lastReceivedDays < 7) {
      out.push({ direction: "up", label: _t("score.insights.repliedThisWeek", "Replied this week") });
    } else if (lastReceivedDays > 30) {
      out.push({ direction: "down", label: _t("score.insights.noReply30Days", "No reply in 30+ days") });
    } else if (lastReceivedDays > 14) {
      out.push({ direction: "down", label: _t("score.insights.quiet2Weeks", "Quiet for 2+ weeks") });
    }
  }

  // ── Message count / activity score ───────────────────────────────────────
  if (received === 0 && sent > 0) {
    out.push({ direction: "down", label: _t("score.insights.noReplyYet", "Lead hasn't replied yet") });
  } else if (received >= 4) {
    out.push({ direction: "up", label: _t("score.insights.highActivity", "High message activity") });
  } else if (received >= 2) {
    out.push({ direction: "up", label: _t("score.insights.repliedMultiple", "Replied multiple times") });
  }

  // Reply ratio >= 1.0 (activity score +30)
  if (received > 0 && sent > 0 && received / sent >= 1.0) {
    out.push({ direction: "up", label: _t("score.insights.repliesMoreThanPinged", "Replies more than pinged") });
  }

  // ── Bump stage (many follow-ups = diminishing returns) ───────────────────
  if (bumps >= 3) {
    out.push({ direction: "down", label: _t("score.insights.manyFollowUps", "Many follow-ups sent") });
  }

  return out.slice(0, 4);
}

// ── Score insight tag component ───────────────────────────────────────────────
function ScoreInsightTag({ insight }: { insight: ScoreInsight }) {
  const isUp = insight.direction === "up";
  const color = isUp ? "#6da611" : "#d66c42";
  return (
    <div className="flex items-center gap-2.5 min-h-[34px]">
      {/* Circle outline button — no fill, gray border, colored triangle inside */}
      <span className="shrink-0 w-[34px] h-[34px] rounded-full border border-black/[0.125] flex items-center justify-center">
        <svg
          width="20"
          height="20"
          viewBox="0 0 14 13"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ transform: isUp ? "none" : "scaleY(-1)" }}
        >
          <path d="M7 1 L13.5 12 H0.5 Z" fill={color} />
          {isUp ? (
            <polyline
              points="4.5,7.5 6.2,9.5 9.5,5.5"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ) : (
            <>
              <line x1="5" y1="6" x2="9" y2="10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="9" y1="6" x2="5" y2="10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </>
          )}
        </svg>
      </span>
      {/* Label text */}
      <span className="text-[12px] text-foreground/80 leading-snug">{insight.label}</span>
    </div>
  );
}

// ── Score widget with AI summary ──────────────────────────────────────────────
function ScoreWidget({ score, lead, status }: { score: number; lead?: Record<string, any>; status?: string }) {
  const { t } = useTranslation("leads");
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
    const zeroInsights = lead ? buildScoreInsights(lead, t) : [];
    return (
      <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-[21px] flex flex-col gap-3 h-full overflow-y-auto">
        <p className="text-[18px] font-semibold font-heading text-foreground">{t("score.title")}</p>
        <div className="flex flex-col items-center gap-[3px] shrink-0">
          <p className="text-2xl font-black text-muted-foreground/25">—</p>
          <p className="text-[10px] text-muted-foreground/50">{t("score.notScored")}</p>
        </div>
        {zeroInsights.length > 0 && (
          <div className="flex flex-col gap-2 shrink-0">
            {zeroInsights.map((ins, i) => (
              <ScoreInsightTag key={i} insight={ins} />
            ))}
          </div>
        )}
        {summaryText && status === "Booked" && (
          <div className="border-t border-border/20 pt-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 mb-1.5">{t("detail.aiSummary")}</p>
            <p className="text-[12px] text-foreground/75 leading-relaxed">{summaryText}</p>
          </div>
        )}
      </div>
    );
  }

  const insights = lead ? buildScoreInsights(lead, t) : [];

  return (
    <div className="bg-white/50 dark:bg-white/[0.10] rounded-xl p-[21px] flex flex-col gap-2 h-full overflow-y-auto">
      <p className="text-[18px] font-semibold font-heading text-foreground shrink-0">{t("score.title")}</p>

      {/* Arc gauge */}
      <div className="flex flex-col items-center shrink-0">
        <ScoreArc score={score} status={status} />
      </div>

      {/* Score insight tags */}
      {insights.length > 0 && (
        <div className="flex flex-col gap-2 mt-1 shrink-0">
          {insights.map((ins, i) => (
            <ScoreInsightTag key={i} insight={ins} />
          ))}
        </div>
      )}

      {/* AI Summary — only shown for Booked status */}
      {status === "Booked" && summaryText ? (
        <div className="border-t border-border/20 pt-3 mt-1 flex-1 min-h-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Bot className="h-3 w-3 text-brand-indigo/60" />
            <p className="text-[10px] font-medium uppercase tracking-wider text-foreground/40">{t("detail.aiSummary")}</p>
          </div>
          <p className="text-[12px] text-foreground/75 leading-relaxed">{summaryText}</p>
        </div>
      ) : status === "Booked" ? (
        <div className="border-t border-border/20 pt-3 mt-1 flex-1 min-h-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 mb-1.5">{t("detail.aiSummary")}</p>
          <p className="text-[11px] text-muted-foreground/50 italic">{t("detail.noAiSummary")}</p>
        </div>
      ) : null}
    </div>
  );
}

// ── Message type detection (matches ChatPanel) ───────────────────────────────
function isAiMsg(item: Interaction): boolean {
  if (item.ai_generated === true) return true;
  if (item.is_bump === true) return true;
  if ((item.triggered_by ?? item.triggeredBy) === "Automation") return true;
  const who = (item.Who ?? item.who ?? "").toLowerCase();
  if (who === "ai" || who === "bot" || who === "automation") return true;
  if (/^bump\s*\d/.test(who)) return true;
  if (who === "start") return true;
  return false;
}

function isHumanAgentMsg(item: Interaction): boolean {
  if (String(item.direction || "").toLowerCase() !== "outbound") return false;
  return !isAiMsg(item);
}

// ── Sender run tracking (matches ChatPanel) ──────────────────────────────────
type MiniSenderKey = "inbound" | "ai" | "human";

interface MiniMsgMeta {
  senderKey: MiniSenderKey;
  isFirstInRun: boolean;
  isLastInRun: boolean;
}

function computeMiniMsgMeta(msgs: Interaction[]): MiniMsgMeta[] {
  const result: MiniMsgMeta[] = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const sk: MiniSenderKey = String(m.direction || "").toLowerCase() !== "outbound"
      ? "inbound"
      : isAiMsg(m) ? "ai" : "human";
    const prevSk: MiniSenderKey | "" = i > 0
      ? (String(msgs[i - 1].direction || "").toLowerCase() !== "outbound" ? "inbound" : isAiMsg(msgs[i - 1]) ? "ai" : "human")
      : "";
    const nextSk: MiniSenderKey | "" = i < msgs.length - 1
      ? (String(msgs[i + 1].direction || "").toLowerCase() !== "outbound" ? "inbound" : isAiMsg(msgs[i + 1]) ? "ai" : "human")
      : "";
    result.push({
      senderKey: sk,
      isFirstInRun: sk !== prevSk,
      isLastInRun: sk !== nextSk,
    });
  }
  return result;
}

// ── Thread grouping (matches ChatPanel) ──────────────────────────────────────
interface MiniThreadGroup {
  threadId: string;
  threadIndex: number;
  msgs: Interaction[];
}

const MINI_THREAD_GAP_MS = 2 * 60 * 60 * 1000;

function groupMiniMessagesByThread(msgs: Interaction[]): MiniThreadGroup[] {
  if (msgs.length === 0) return [];
  const groups: MiniThreadGroup[] = [];
  let currentGroup: MiniThreadGroup | null = null;
  let groupIndex = 0;

  function getThreadKey(m: Interaction): string | null {
    const tid = m.conversation_thread_id ?? m.conversationThreadId;
    if (tid) return `thread-${tid}`;
    if (m.bump_number != null) return `bump-${m.bump_number}`;
    if (m.is_bump && m.Who) return `bump-who-${m.Who.toLowerCase().replace(/\s+/g, "-")}`;
    return null;
  }

  let lastTimestamp: number | null = null;
  for (const m of msgs) {
    const key = getThreadKey(m);
    const ts = m.created_at || m.createdAt;
    const currentTimestamp = ts ? new Date(ts).getTime() : null;
    let startNew = false;
    if (!currentGroup) {
      startNew = true;
    } else if (key !== null) {
      if (key !== currentGroup.threadId) startNew = true;
    } else {
      if (currentTimestamp !== null && lastTimestamp !== null && currentTimestamp - lastTimestamp > MINI_THREAD_GAP_MS) startNew = true;
    }
    if (startNew) {
      const tid: string = key ?? `session-${groupIndex}`;
      currentGroup = { threadId: tid, threadIndex: groupIndex++, msgs: [] };
      groups.push(currentGroup);
    }
    currentGroup!.msgs.push(m);
    if (currentTimestamp !== null) lastTimestamp = currentTimestamp;
  }
  return groups;
}

function formatMiniThreadLabel(group: MiniThreadGroup, total: number): string {
  const { threadId, threadIndex } = group;
  if (threadId.startsWith("bump-who-")) {
    const who = threadId.replace("bump-who-", "").replace(/-/g, " ");
    return who.charAt(0).toUpperCase() + who.slice(1);
  }
  if (threadId.startsWith("bump-")) return `Bump ${threadId.replace("bump-", "")}`;
  if (threadId.startsWith("thread-")) {
    const id = threadId.replace("thread-", "");
    return id.length > 12 ? `Thread ${threadIndex + 1}` : `Thread ${id}`;
  }
  if (total === 1) return "Conversation";
  return `Conversation ${threadIndex + 1}`;
}

// ── Mini date separator (matches ChatPanel DateSeparator) ────────────────────
function MiniDateSeparator({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-3">
      <span className="text-[11px] font-medium text-foreground/50 bg-black/[0.06] rounded-full px-3 py-0.5 select-none">
        {label}
      </span>
    </div>
  );
}

// ── Mini thread divider (matches ChatPanel ThreadDivider) ────────────────────
function MiniThreadDivider({ group, total }: { group: MiniThreadGroup; total: number }) {
  const label = formatMiniThreadLabel(group, total);
  const firstMsg = group.msgs[0];
  const ts = firstMsg?.created_at || firstMsg?.createdAt;
  const time = ts ? formatBubbleTime(ts) : null;
  const isBump = group.threadId.startsWith("bump-");
  return (
    <div className="flex justify-center my-3">
      <span className={cn(
        "text-[11px] font-semibold rounded-full px-3 py-1 select-none",
        isBump ? "bg-amber-100 text-amber-700" : "bg-indigo-50 text-brand-indigo",
      )}>
        {label}{time ? ` · ${time}` : ""}
      </span>
    </div>
  );
}

// ── Mini avatars (matching ChatPanel, scaled to 32px) ────────────────────────
function MiniAgentAvatar({ currentUser }: { currentUser: SessionUser | null }) {
  const displayName = currentUser?.fullName || "You";
  const photoUrl = currentUser?.avatarUrl ?? null;
  return (
    <EntityAvatar
      name={displayName}
      photoUrl={photoUrl}
      bgColor="#4F46E5"
      textColor="#ffffff"
      size={32}
      className="shrink-0"
    />
  );
}

function MiniBotAvatar() {
  return (
    <div className="h-8 w-8 shrink-0">
      <img src="/6. Favicon.svg" alt="AI" className="h-full w-full object-contain" />
    </div>
  );
}

// ── Run wrappers with sticky bottom avatars (matching ChatPanel) ─────────────
function MiniAgentRunWrapper({ msgs, metas, leadName, leadAvatarColors, currentUser }: {
  msgs: Interaction[];
  metas: MiniMsgMeta[];
  leadName: string;
  leadAvatarColors: { bgColor: string; textColor: string };
  currentUser: SessionUser | null;
}) {
  return (
    <div className="flex justify-end gap-1">
      <div className="flex flex-col min-w-0 flex-1">
        {msgs.map((m, i) => (
          <MiniChatBubble key={m.id ?? i} item={m} meta={metas[i]} leadName={leadName} leadAvatarColors={leadAvatarColors} suppressAvatar />
        ))}
      </div>
      <div className="w-8 shrink-0 self-end sticky bottom-0">
        <MiniAgentAvatar currentUser={currentUser} />
      </div>
    </div>
  );
}

function MiniLeadRunWrapper({ msgs, metas, leadName, leadAvatarColors }: {
  msgs: Interaction[];
  metas: MiniMsgMeta[];
  leadName: string;
  leadAvatarColors: { bgColor: string; textColor: string };
}) {
  return (
    <div className="flex justify-start gap-1">
      <div className="w-8 shrink-0 self-end sticky bottom-0">
        <EntityAvatar
          name={leadName || "?"}
          bgColor={leadAvatarColors.bgColor}
          textColor={leadAvatarColors.textColor}
          size={32}
        />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        {msgs.map((m, i) => (
          <MiniChatBubble key={m.id ?? i} item={m} meta={metas[i]} leadName={leadName} leadAvatarColors={leadAvatarColors} suppressAvatar />
        ))}
      </div>
    </div>
  );
}

function MiniBotRunWrapper({ msgs, metas, leadName, leadAvatarColors }: {
  msgs: Interaction[];
  metas: MiniMsgMeta[];
  leadName: string;
  leadAvatarColors: { bgColor: string; textColor: string };
}) {
  return (
    <div className="flex justify-end gap-1">
      <div className="flex flex-col min-w-0 flex-1">
        {msgs.map((m, i) => (
          <MiniChatBubble key={m.id ?? i} item={m} meta={metas[i]} leadName={leadName} leadAvatarColors={leadAvatarColors} suppressAvatar />
        ))}
      </div>
      <div className="w-8 shrink-0 self-end sticky bottom-0">
        <MiniBotAvatar />
      </div>
    </div>
  );
}

// ── Mini delivery status icon (matches ChatPanel MessageStatusIcon) ──────────
function MiniStatusIcon({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "sending") return <span className="inline-flex items-center"><Clock className="w-2.5 h-2.5 animate-pulse opacity-70" /></span>;
  if (s === "read") return <span className="inline-flex items-center text-sky-300"><CheckCheck className="w-2.5 h-2.5" /></span>;
  if (s === "delivered") return <span className="inline-flex items-center opacity-80"><CheckCheck className="w-2.5 h-2.5" /></span>;
  if (s === "sent") return <span className="inline-flex items-center opacity-60"><Check className="w-2.5 h-2.5" /></span>;
  return null;
}

// ── Chat bubble (matches ChatPanel — 45% width, time-only, suppressAvatar) ───
function MiniChatBubble({ item, meta, leadName, leadAvatarColors, suppressAvatar = false }: {
  item: Interaction;
  meta: MiniMsgMeta;
  leadName: string;
  leadAvatarColors: { bgColor: string; textColor: string };
  suppressAvatar?: boolean;
}) {
  const outbound = String(item.direction || "").toLowerCase() === "outbound";
  const inbound = !outbound;
  const aiMsg = outbound && isAiMsg(item);
  const humanAgentMsg = outbound && isHumanAgentMsg(item);
  const rawTs = item.created_at ?? item.createdAt ?? null;
  const time = formatBubbleTime(rawTs);
  const statusNorm = ((item as any).status ?? "").toLowerCase();
  const { isLastInRun } = meta;

  const bubbleRadius = inbound
    ? isLastInRun ? "rounded-sm rounded-bl-none" : "rounded-sm"
    : isLastInRun ? "rounded-sm rounded-br-none" : "rounded-sm";

  return (
    <div
      className={cn("flex items-end gap-1 my-0.5", outbound ? "justify-end" : "justify-start")}
      data-testid={`row-interaction-${item.id}`}
    >
      {/* Lead avatar — left side (only when NOT suppressed by wrapper) */}
      {inbound && !suppressAvatar && isLastInRun && (
        <EntityAvatar name={leadName || "?"} bgColor={leadAvatarColors.bgColor} textColor={leadAvatarColors.textColor} size={32} className="shrink-0" />
      )}
      {inbound && !suppressAvatar && !isLastInRun && <div className="w-8 shrink-0" />}

      {/* Bubble — 45% max-width, time-only, ChatPanel colors + hard-light outline */}
      <div
        className={cn(
          "max-w-[45%] px-2.5 pt-1.5 pb-1 text-[13px] relative",
          bubbleRadius,
          inbound && "bg-white dark:bg-card text-gray-900 dark:text-foreground",
          aiMsg && "bg-[#f2f5ff] dark:bg-[#1e2340] text-gray-900 dark:text-foreground",
          humanAgentMsg && "bg-[#f1fff5] dark:bg-[#1a2e1f] text-gray-900 dark:text-foreground",
        )}
      >
        {/* Light drop shadow */}
        <div
          className={cn("absolute inset-0 pointer-events-none", bubbleRadius)}
          style={{
            boxShadow: (inbound || aiMsg || humanAgentMsg)
              ? "0 2px 2px rgba(0,0,0,0.08)"
              : "none",
          }}
        />
        <div className="whitespace-pre-wrap leading-relaxed break-words">{item.content || item.Content || ""}</div>
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <span className="text-[10px] leading-none select-none" style={{ color: "#888" }}>
            {time || (rawTs ? rawTs.toString().slice(11, 16) : "")}
          </span>
          {outbound && <MiniStatusIcon status={statusNorm} />}
        </div>
      </div>

      {/* Outbound avatars — right side (only when NOT suppressed by wrapper) */}
      {aiMsg && !suppressAvatar && isLastInRun && <MiniBotAvatar />}
      {aiMsg && !suppressAvatar && !isLastInRun && <div className="w-8 shrink-0" />}
      {humanAgentMsg && !suppressAvatar && isLastInRun && <MiniAgentAvatar currentUser={null} />}
      {humanAgentMsg && !suppressAvatar && !isLastInRun && <div className="w-8 shrink-0" />}
    </div>
  );
}

// ── Conversation widget (ChatPanel-style with run wrappers + separators) ─────
function ConversationWidget({ lead, showHeader = false }: { lead: Record<string, any>; showHeader?: boolean }) {
  const { t } = useTranslation("leads");
  const leadId = getLeadId(lead);
  const { interactions, loading, refresh } = useInteractions(undefined, leadId);
  const { isAgencyView } = useWorkspace();
  const [, setLocation] = useLocation();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showBypassConfirm, setShowBypassConfirm] = useState(false);
  const [showAiResumeConfirm, setShowAiResumeConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const session = useSession();
  const currentUser: SessionUser | null = session.status === "authenticated" ? session.user : null;
  const isHumanTakeover = Boolean(lead.manual_takeover || lead.manualTakeover);

  const sorted = useMemo(
    () => [...interactions].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")),
    [interactions]
  );

  const leadName = lead.full_name || `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || t("detailView.newLead");
  const leadAvatarColors = useMemo(() => {
    const status = lead.Conversion_Status || lead.conversion_status || "";
    const colors = getLeadStatusAvatarColor(status);
    return { bgColor: colors.bg, textColor: colors.text };
  }, [lead.Conversion_Status, lead.conversion_status]);

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

  const [refreshing, setRefreshing] = useState(false);
  const handleRefreshChat = useCallback(async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setTimeout(() => setRefreshing(false), 600); }
  }, [refresh]);

  const handleAiResume = useCallback(async () => {
    setShowAiResumeConfirm(false);
    try {
      await updateLead(leadId, { manual_takeover: false });
      await refresh();
    } catch (err) {
      console.error("Failed to resume AI", err);
    }
  }, [leadId, refresh]);

  // Build structured render list: date separators + thread dividers + sender-run wrappers
  const chatItems = useMemo(() => {
    if (sorted.length === 0) return null;

    const threadGroups = groupMiniMessagesByThread(sorted);
    const globalMetas = computeMiniMsgMeta(sorted);

    type Token =
      | { kind: "msg"; msgIdx: number }
      | { kind: "date"; label: string; key: string }
      | { kind: "thread"; group: MiniThreadGroup; total: number; key: string };

    const tokens: Token[] = [];
    let lastDateKey = "";
    let flatIdx = 0;

    for (let gi = 0; gi < threadGroups.length; gi++) {
      const group = threadGroups[gi];
      const isMeaningfulThread = group.threadId.startsWith("bump-") || group.threadId.startsWith("thread-");

      for (let mi = 0; mi < group.msgs.length; mi++) {
        const m = group.msgs[mi];
        const ts = m.created_at ?? m.createdAt;
        const dk = getDateKey(ts);

        if (dk && dk !== lastDateKey) {
          if (mi === 0 && isMeaningfulThread) {
            tokens.push({ kind: "thread", group, total: threadGroups.length, key: group.threadId });
          }
          if (ts) tokens.push({ kind: "date", label: formatDateLabel(ts, t), key: `date-${gi}-${mi}` });
          lastDateKey = dk;
        } else if (mi === 0 && isMeaningfulThread) {
          tokens.push({ kind: "thread", group, total: threadGroups.length, key: group.threadId });
        }

        tokens.push({ kind: "msg", msgIdx: flatIdx });
        flatIdx++;
      }
    }

    // Second pass: collect same-sender runs and wrap them
    const items: React.ReactNode[] = [];
    let ti = 0;

    while (ti < tokens.length) {
      const tok = tokens[ti];

      if (tok.kind === "date") {
        items.push(<MiniDateSeparator key={tok.key} label={tok.label} />);
        ti++;
        continue;
      }
      if (tok.kind === "thread") {
        items.push(<MiniThreadDivider key={tok.key} group={tok.group} total={tok.total} />);
        ti++;
        continue;
      }

      const firstMsg = sorted[tok.msgIdx];
      const senderType: MiniSenderKey = String(firstMsg.direction || "").toLowerCase() !== "outbound"
        ? "inbound"
        : isAiMsg(firstMsg) ? "ai" : "human";

      const runMsgs: Interaction[] = [];
      const runMetas: MiniMsgMeta[] = [];
      const runStartIdx = tok.msgIdx;
      const pendingSeparators: { node: React.ReactNode }[] = [];

      let lookahead = ti;
      while (lookahead < tokens.length) {
        const lt = tokens[lookahead];
        if (lt.kind === "date" || lt.kind === "thread") {
          pendingSeparators.push({
            node: lt.kind === "date"
              ? <MiniDateSeparator key={lt.key} label={lt.label} />
              : <MiniThreadDivider key={lt.key} group={lt.group} total={lt.total} />,
          });
          lookahead++;
          continue;
        }
        const m = sorted[lt.msgIdx];
        const sk: MiniSenderKey = String(m.direction || "").toLowerCase() !== "outbound"
          ? "inbound"
          : isAiMsg(m) ? "ai" : "human";
        if (sk !== senderType) break;
        runMsgs.push(m);
        runMetas.push(globalMetas[lt.msgIdx]);
        pendingSeparators.length = 0;
        lookahead++;
      }
      ti = lookahead;

      const trailingSeparators = pendingSeparators.map(p => p.node);

      if (senderType === "human") {
        items.push(
          <MiniAgentRunWrapper
            key={`run-${runMsgs[0]?.id ?? runStartIdx}`}
            msgs={runMsgs}
            metas={runMetas}
            leadName={leadName}
            leadAvatarColors={leadAvatarColors}
            currentUser={currentUser}
          />
        );
      } else if (senderType === "inbound") {
        items.push(
          <MiniLeadRunWrapper
            key={`lead-run-${runMsgs[0]?.id ?? runStartIdx}`}
            msgs={runMsgs}
            metas={runMetas}
            leadName={leadName}
            leadAvatarColors={leadAvatarColors}
          />
        );
      } else {
        items.push(
          <MiniBotRunWrapper
            key={`bot-run-${runMsgs[0]?.id ?? runStartIdx}`}
            msgs={runMsgs}
            metas={runMetas}
            leadName={leadName}
            leadAvatarColors={leadAvatarColors}
          />
        );
      }

      items.push(...trailingSeparators);
    }

    return items;
  }, [sorted, leadName, leadAvatarColors, currentUser]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header with refresh + open-in-chats */}
      {showHeader && (
        <div className="px-[21px] pt-[21px] pb-2 flex items-center justify-between shrink-0 relative z-10">
          <p className="text-[18px] font-semibold font-heading text-foreground">{t("chat.title")}</p>
          <div className="flex items-center gap-1">
            {/* Let AI continue — only when human has taken over */}
            {isHumanTakeover && <Popover open={showAiResumeConfirm} onOpenChange={setShowAiResumeConfirm}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="group relative inline-flex items-center justify-center h-[34px] w-[34px] rounded-full border border-black/[0.125] hover:border-brand-indigo shrink-0 overflow-hidden transition-[width,border-color] duration-200 hover:w-[130px]"
                  aria-label={t("chat.letAiContinue")}
                >
                  <img src="/6. Favicon.svg" alt="AI" className="h-5 w-5 shrink-0 absolute left-[6px]" />
                  <span className="whitespace-nowrap pl-7 pr-2 text-[11px] font-medium text-brand-indigo opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    {t("chat.letAiContinue")}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                side="bottom"
                sideOffset={6}
                className="w-auto p-3 shadow-md border border-black/[0.08] bg-white dark:bg-popover rounded-xl"
              >
                <p className="text-[12px] text-foreground/70 mb-2.5 max-w-[200px]">
                  AI will resume this conversation. You can take over again anytime.
                </p>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAiResumeConfirm(false)}
                    className="text-[12px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/60 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAiResume}
                    className="text-[12px] font-medium text-white bg-brand-indigo hover:bg-brand-indigo/90 px-3 py-1 rounded-md transition-colors"
                  >
                    Confirm
                  </button>
                </div>
              </PopoverContent>
            </Popover>}
            <button
              onClick={() => {
                localStorage.setItem("selected-conversation-lead-id", String(leadId));
                setLocation(`${isAgencyView ? "/agency" : "/subaccount"}/conversations`);
              }}
              className="h-[34px] w-[34px] rounded-full border border-black/[0.125] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title={t("chat.openInChats")}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleRefreshChat}
              className="h-[34px] w-[34px] rounded-full border border-black/[0.125] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Refresh messages"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            </button>
          </div>
        </div>
      )}

      {/* Messages scroll area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 pb-2 min-h-0 -mt-[12px] pt-[15px]"
        data-testid="list-interactions"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0px, black 15px)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0px, black 15px)",
        }}
      >
        {loading ? (
          <div className="flex flex-col gap-2 py-4">
            {[70, 50, 80, 55].map((w, i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "flex-row-reverse" : "flex-row")}>
                <div
                  className="h-8 rounded-sm bg-muted/60 animate-pulse"
                  style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }}
                />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">{t("chat.noMessages")}</p>
            <p className="text-[11px] text-muted-foreground/60">{t("chat.noMessagesHint")}</p>
          </div>
        ) : chatItems}
      </div>

      {/* Compose area — ChatPanel style: white bar with border + shadow */}
      <div className="shrink-0 px-3 pb-3 pt-1">
        <div className="flex items-end gap-1.5 bg-white dark:bg-card rounded-lg border border-black/[0.1] shadow-sm px-2.5 py-1.5">
          <button
            type="button"
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground shrink-0 transition-colors"
            title="Emoji"
            onClick={() => textareaRef.current?.focus()}
          >
            <Smile className="h-5 w-5" />
          </button>

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
            placeholder={t("chat.typePlaceholder")}
            rows={1}
            className="flex-1 text-[13px] bg-transparent resize-none focus:outline-none placeholder:text-muted-foreground/50 leading-5"
            style={{ minHeight: "28px", maxHeight: "80px" }}
            data-testid="input-message-compose"
          />

          <button
            type="button"
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground shrink-0 transition-colors"
            title="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <div className="relative">
            {draft.trim() ? (
              <button
                type="button"
                onClick={() => { if (draft.trim()) setShowBypassConfirm(true); }}
                disabled={sending}
                className="h-8 w-8 rounded-full bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 disabled:opacity-40 shrink-0 transition-colors"
                title="Send message"
                data-testid="btn-send-message"
              >
                {sending
                  ? <div className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Send className="h-3.5 w-3.5 text-white" />}
              </button>
            ) : (
              <button
                type="button"
                className="h-8 w-8 rounded-full bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 disabled:opacity-40 shrink-0 transition-colors"
                title="Record voice message"
              >
                <Mic className="h-4 w-4 text-white" />
              </button>
            )}

            {showBypassConfirm && (
              <div className="absolute bottom-10 right-0 z-50 w-52 bg-white dark:bg-popover rounded-xl shadow-lg border border-border/40 p-3 space-y-2">
                <p className="text-[11px] font-semibold text-foreground">Bypass AI for this message?</p>
                <p className="text-[10px] text-muted-foreground/70 leading-snug">This will send as a human takeover and pause the AI agent.</p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setShowBypassConfirm(false); handleSend(); }}
                    className="flex-1 px-2 py-1.5 rounded-lg bg-brand-indigo text-white text-[11px] font-semibold hover:bg-brand-indigo/90 transition-colors"
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
  const { t } = useTranslation("leads");
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
    <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-[21px] flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[18px] font-semibold font-heading text-foreground">{t("team.title")}</p>
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <button className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-2" sideOffset={4}>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 px-2 py-1">{t("team.addTeamMember")}</p>
            {availableToAdd.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/50 px-2 py-2">{t("team.noMoreUsers")}</p>
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

// ── Notes widget (click-to-edit + voice memo + AI notes) ─────────────────────
function NotesWidget({ lead, onRefresh }: { lead: Record<string, any>; onRefresh?: () => void }) {
  const { t } = useTranslation("leads");
  const leadId = lead.Id ?? lead.id ?? 0;
  const currentNotes = lead.notes || lead.Notes || "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentNotes);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [transcribing, setTranscribing] = useState(false);

  const { toast } = useToast();

  useEffect(() => { setDraft(currentNotes); }, [currentNotes]);
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editing]);
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current) { try { mediaRecorderRef.current.stop(); } catch {} }
    };
  }, []);

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

  const startVoiceRecording = useCallback(async () => {
    if (!leadId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm",
      });
      recordingChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordingChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordingChunksRef.current, { type: mr.mimeType });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          setTranscribing(true);
          try {
            console.log("[voice] Sending audio:", dataUrl.length, "chars, mime:", mr.mimeType);
            const httpRes = await apiFetch(`/api/leads/${leadId}/transcribe-voice`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audio_data: dataUrl, mime_type: mr.mimeType }),
            });
            const res = await httpRes.json() as any;
            if (!httpRes.ok || res.error) {
              const desc = res.error === "NO_GROQ_API_KEY"
                ? "Groq API key not configured."
                : res.detail || res.error || "Could not transcribe audio. Try again.";
              console.error("[voice] Transcription error:", res);
              toast({ title: "Transcription failed", description: String(desc).slice(0, 200), variant: "destructive" });
              return;
            }
            if (res.transcription) {
              setDraft((prev: string) => {
                const sep = prev.trim() ? "\n\n" : "";
                return prev + sep + res.transcription;
              });
              setEditing(true);
            }
          } catch {
            toast({ title: "Transcription failed", description: "Network error. Try again.", variant: "destructive" });
          } finally {
            setTranscribing(false);
          }
        };
        reader.readAsDataURL(blob);
      };
      mr.start(250);
      mediaRecorderRef.current = mr;
      setIsRecordingVoice(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      toast({ title: "Microphone access denied", description: "Allow microphone access to record voice memos.", variant: "destructive" });
    }
  }, [leadId, toast]);

  const stopVoiceRecording = useCallback(() => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  }, []);

  return (
    <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-[21px] flex flex-col gap-3 min-h-full">
      {/* Header row: title + voice memo button */}
      <div className="flex items-center justify-between">
        <p className="text-[18px] font-semibold font-heading text-foreground">{t("detail.sections.notes")}</p>
        <div className="flex items-center gap-1.5">
          {transcribing ? (
            <div className="flex items-center gap-1.5 text-[10px] text-brand-indigo">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("chat.transcribing")}
            </div>
          ) : isRecordingVoice ? (
            <button
              onClick={stopVoiceRecording}
              className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-red-500/15 text-red-600 text-[12px] font-medium border border-red-300/60 hover:bg-red-500/25 transition-colors"
              title={t("notes.stopRecording")}
            >
              <Square className="h-3 w-3 fill-current" />
              {recordingSeconds}s
            </button>
          ) : (
            <button
              onClick={startVoiceRecording}
              disabled={saving || transcribing}
              className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-black/[0.125] text-muted-foreground hover:text-foreground hover:border-black/[0.175] transition-colors disabled:opacity-50"
              title="Record voice memo (transcribe to text)"
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Manual notes: click-to-edit */}
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
          className="text-[12px] bg-white/70 dark:bg-white/[0.07] border border-brand-indigo/30 rounded-lg px-2 py-1.5 w-full resize-none focus:outline-none focus:ring-1 focus:ring-brand-indigo/40 flex-1"
        />
      ) : currentNotes ? (
        <p
          className="text-[12px] text-foreground/80 leading-relaxed cursor-text hover:bg-muted/30 rounded-lg px-1 py-0.5 -mx-1 transition-colors"
          onClick={() => setEditing(true)}
        >
          {renderRichText(currentNotes)}
        </p>
      ) : (
        <p
          className="text-[12px] text-muted-foreground/50 italic mt-1 cursor-text hover:bg-muted/30 rounded-lg px-1 py-0.5 -mx-1 transition-colors"
          onClick={() => setEditing(true)}
        >
          {t("activity.clickToAddNotes")}
        </p>
      )}

    </div>
  );
}

// ── Activity timeline widget ────────────────────────────────────────────────

const TIMELINE_ICON: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  bump:           { icon: Zap,            color: "text-brand-indigo",                             bg: "bg-brand-indigo/10" },
  outbound_ai:    { icon: Bot,            color: "text-brand-indigo",                             bg: "bg-brand-indigo/10" },
  outbound_agent: { icon: UserIcon,       color: "text-emerald-700 dark:text-emerald-400",        bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  inbound:        { icon: MessageSquare,  color: "text-emerald-600 dark:text-emerald-400",        bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  booked:         { icon: Calendar,       color: "text-amber-500 dark:text-amber-400",            bg: "bg-amber-50 dark:bg-amber-950/30" },
  dnd:            { icon: Ban,            color: "text-red-500 dark:text-red-400",                bg: "bg-red-50 dark:bg-red-950/30" },
  optout:         { icon: Shield,         color: "text-red-500 dark:text-red-400",                bg: "bg-red-50 dark:bg-red-950/30" },
  tag:            { icon: TagIcon,        color: "text-violet-600 dark:text-violet-400",          bg: "bg-violet-50 dark:bg-violet-950/30" },
};

type TimelineEvent = { ts: string; styleKey: string; label: string; detail?: string };

function ActivityTimeline({ lead, tagEvents }: {
  lead: Record<string, any>;
  tagEvents: { name: string; color?: string; appliedAt?: string }[];
}) {
  const { t } = useTranslation("leads");
  const leadId = getLeadId(lead);
  const { interactions, total, totalPages, page, loading, error, nextPage, prevPage } =
    useInteractionsPaginated(leadId, 15);
  const status = getStatus(lead);

  // Build a unified timeline from interactions + tags + status events
  const timeline = useMemo(() => {
    const events: TimelineEvent[] = [];

    // Tag/status events only on page 1 (avoid repeating on every page)
    if (page === 1) {
      tagEvents.forEach((evt) => {
        events.push({
          ts: evt.appliedAt || "",
          styleKey: "tag",
          label: t("activity.tagApplied", { name: evt.name }),
        });
      });

      if (status === "Booked") {
        const bookedDate = lead.booked_call_date || lead.bookedCallDate || "";
        events.push({
          ts: bookedDate || lead.updated_at || "",
          styleKey: "booked",
          label: t("activity.callBooked"),
          detail: bookedDate ? t("activity.scheduledFor", { date: formatMsgTime(bookedDate) }) : undefined,
        });
      }

      if (status === "DND") {
        events.push({
          ts: lead.updated_at || "",
          styleKey: "dnd",
          label: t("activity.doNotDisturb"),
          detail: lead.dnc_reason || t("activity.leadRequestedNoContact"),
        });
      }

      if (lead.opted_out) {
        events.push({
          ts: lead.updated_at || "",
          styleKey: "optout",
          label: t("activity.optedOut"),
          detail: lead.dnc_reason || undefined,
        });
      }
    }

    // Interaction events (already paginated & sorted by server)
    interactions.forEach((item) => {
      const isAi = isAiMsg(item);
      const outbound = String(item.direction || "").toLowerCase() === "outbound";
      const raw = item.content || item.Content || "";
      const content = raw.substring(0, 120);
      const ellipsis = raw.length > 120 ? "…" : "";

      if (item.is_bump) {
        events.push({
          ts: item.created_at || "",
          styleKey: "bump",
          label: `AI Follow-up #${item.bump_stage || ""}`,
          detail: content ? `"${content}${ellipsis}"` : undefined,
        });
      } else {
        events.push({
          ts: item.created_at || "",
          styleKey: outbound ? (isAi ? "outbound_ai" : "outbound_agent") : "inbound",
          label: outbound ? (isAi ? "AI Message Sent" : "Agent Message Sent") : "Lead Replied",
          detail: content ? `"${content}${ellipsis}"` : undefined,
        });
      }
    });

    events.sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
    return events;
  }, [interactions, tagEvents, status, lead, page]);

  return (
    <div className="bg-card/75 rounded-xl p-4 md:p-8 flex flex-col h-full overflow-y-auto gap-6">
      <span className="text-[18px] font-semibold font-heading leading-tight text-foreground shrink-0">{t("activity.title")}</span>

      {loading ? (
        <div className="space-y-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-2.5 bg-white/90 dark:bg-card/90 rounded-xl px-2 py-1.5">
              <div className="h-7 w-7 rounded-lg bg-muted animate-pulse shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5 pt-0.5">
                <div className="h-3.5 w-3/5 bg-muted animate-pulse rounded" />
                <div className="h-3 w-4/5 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-3 w-8 bg-muted animate-pulse rounded shrink-0 mt-1" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-8 px-4 flex-1">
          <p className="text-xs text-muted-foreground">{t("activity.loadError")}</p>
        </div>
      ) : timeline.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-8 px-4 flex-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted mb-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">{t("activity.noRecentActivity")}</p>
          <p className="text-xs text-muted-foreground max-w-[240px] mt-1">
            {t("activity.emptyHint")}
          </p>
        </div>
      ) : (
        <div className="overflow-y-auto space-y-1 flex-1 min-h-0">
          {timeline.map((evt, i) => {
            const cfg = TIMELINE_ICON[evt.styleKey] ?? TIMELINE_ICON.inbound;
            const Icon = cfg.icon;
            return (
              <div
                key={`${evt.styleKey}-${i}`}
                className="w-full flex items-start gap-2.5 bg-white/90 dark:bg-card/90 rounded-xl px-2 py-1.5 transition-colors hover:bg-white dark:hover:bg-card"
              >
                <div className={cn("shrink-0 flex items-center justify-center rounded-lg h-7 w-7", cfg.bg)}>
                  <Icon className={cn("h-4 w-4", cfg.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-foreground leading-snug truncate">{evt.label}</p>
                  {evt.detail && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{evt.detail}</p>
                  )}
                </div>
                {evt.ts && (
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 mt-0.5">
                    {relativeTime(evt.ts)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > 15 && (
        <div className="shrink-0 flex items-center justify-between pt-2 border-t border-border/20 mt-1">
          <button
            type="button"
            onClick={prevPage}
            disabled={page <= 1}
            className="icon-circle-lg icon-circle-base disabled:opacity-30 disabled:pointer-events-none"
            aria-label={t("detailView.previousPage")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums select-none">
            {page} / {totalPages}
            <span className="text-muted-foreground/50 ml-1.5">({total})</span>
          </span>
          <button
            type="button"
            onClick={nextPage}
            disabled={page >= totalPages}
            className="icon-circle-lg icon-circle-base disabled:opacity-30 disabled:pointer-events-none"
            aria-label={t("detailView.nextPage")}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
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
  toolbarPrefix,
}: {
  lead: Record<string, any>;
  onClose: () => void;
  leadTags?: { name: string; color: string }[];
  onRefresh?: () => void;
  toolbarPrefix?: (opts: { isNarrow: boolean }) => React.ReactNode;
}) {
  const { t } = useTranslation("leads");
  const name        = getFullName(lead);
  const initials    = getInitials(name);
  const status      = getStatus(lead);
  const score       = getScore(lead);
  const avatarColor = getStatusAvatarColor(status);
  const leadId      = getLeadId(lead);
  const lastActivity = lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at;
  const bookedDate   = lead.booked_call_date || lead.bookedCallDate || "";
  const ratingKey    = score >= 70 ? "hot" : score >= 40 ? "warm" : "cold";
  const ratingLabel  = score >= 70 ? t("detailView.hot") : score >= 40 ? t("detailView.warm") : t("detailView.cold");

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

  // ── Campaign sticker ──────────────────────────────────────────────────────
  const [campaignStickerUrl, setCampaignStickerUrl] = useState<string | null>(null);

  useEffect(() => {
    const cId = lead.Campaigns_id || lead.campaigns_id || lead.campaignsId;
    if (!cId) { setCampaignStickerUrl(null); return; }
    apiFetch(`/api/campaigns/${cId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: any) => {
        const slug = data?.campaign_sticker || data?.campaignSticker;
        if (slug) {
          const sticker = CAMPAIGN_STICKERS.find(s => s.slug === slug);
          setCampaignStickerUrl(sticker?.url || null);
        } else {
          setCampaignStickerUrl(null);
        }
      })
      .catch(() => setCampaignStickerUrl(null));
  }, [lead.Campaigns_id, lead.campaigns_id, lead.campaignsId]);

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

  // ── Expand-on-hover button helpers ───────────────────────────────────────
  const xBtn = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
  const xSpan = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

  // Status color helpers
  const statusBadge = STATUS_COLORS[status] ?? { badge: "bg-muted text-muted-foreground border-border" };

  return (
    <div ref={panelRef} className="relative flex flex-col h-full overflow-hidden">

      {/* ── Full-height gradient ── */}
      <>
        <div className="absolute inset-0 bg-popover dark:bg-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_79%_101%_at_42%_91%,rgba(255,102,17,0.4)_0%,transparent_69%)] dark:opacity-[0.08]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_200%_at_2%_2%,#f0ffb5_5%,transparent_30%)] dark:opacity-[0.08]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_73%_92%_at_69%_50%,rgba(255,191,135,0.38)_0%,transparent_66%)] dark:opacity-[0.08]" />
      </>

      {/* ── Fixed header (stays in place) ── */}
      <div className="relative shrink-0 z-10 px-4 pt-5 pb-3 space-y-6">

          {/* Toolbar */}
          <div className="flex items-center gap-1 flex-wrap">
            {toolbarPrefix?.({ isNarrow })}

            {/* Right-edge: To PDF + Delete */}
            <div className="ml-auto flex items-center gap-1">
              {/* To PDF */}
              <button onClick={handlePdf} className={cn(xBtn, "hover:max-w-[110px] border-black/[0.125] text-foreground/60 hover:text-foreground")}>
                <span className="relative inline-flex h-4 w-4 shrink-0">
                  <FileText className="h-4 w-4" />
                  <span className="absolute bottom-[1px] left-0 right-0 flex justify-center text-[5px] font-black leading-none">PDF</span>
                </span>
                <span className={xSpan}>{t("detailView.toPdf")}</span>
              </button>

              {/* Delete */}
              {deleteConfirm ? (
                <div className="inline-flex items-center gap-1 px-2 py-1.5 rounded-full border border-red-200 bg-red-50">
                  <span className="text-[11px] text-red-600 font-medium">{t("detailView.deleteLead")}</span>
                  <button onClick={handleDelete} disabled={deleting} className="text-[11px] font-bold text-red-600 hover:text-red-700 px-1">{deleting ? "…" : t("confirm.yes")}</button>
                  <button onClick={() => setDeleteConfirm(false)} className="text-[11px] text-muted-foreground hover:text-foreground px-1">{t("confirm.no")}</button>
                </div>
              ) : (
                <button onClick={() => setDeleteConfirm(true)} className={cn(xBtn, "hover:max-w-[110px] border-red-300/60 text-red-400 hover:border-red-400 hover:text-red-600")}>
                  <Trash2 className="h-4 w-4 shrink-0" />
                  <span className={xSpan}>{t("detailView.delete")}</span>
                </button>
              )}
            </div>
          </div>

          {/* Avatar + Name + Tags + Info row (merged onto one line) */}
          <div className="relative flex items-start gap-3">
            <EntityAvatar
              name={name}
              bgColor={avatarColor.bg}
              textColor={avatarColor.text}
              size={65}
              className="overflow-hidden"
            />

            <div className="flex-1 min-w-0 py-1">
              {isEditing ? (
                <input
                  value={editFields.full_name ?? ""}
                  onChange={(e) => setEditFields((f) => ({ ...f, full_name: e.target.value }))}
                  onBlur={handleSaveEdit}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setIsEditing(false); }}
                  autoFocus
                  className="text-[24px] font-semibold font-heading bg-white/70 dark:bg-white/[0.07] border border-brand-indigo/30 rounded-lg px-2 py-0.5 w-full focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
                />
              ) : (
                <div className="group/name flex items-center gap-2 cursor-text" onClick={startEdit}>
                  <h2 className="text-[18px] md:text-[27px] font-semibold font-heading text-foreground leading-tight truncate">{name}</h2>
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(); }}
                    className="opacity-0 group-hover/name:opacity-100 p-1 rounded hover:bg-muted/50 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
                    title="Edit name"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded border border-border/50 text-[10px] font-medium text-muted-foreground">Lead</span>
                {tagEvents.map((evt, i) => {
                  const hex = resolveColor(evt.color);
                  return (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                      style={{ backgroundColor: `${hex}40`, color: hex }}
                    >
                      {evt.name}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Info chips — centered on right edge of col 2 (same formula as Campaign panel) */}
            <div className="hidden md:flex items-center gap-10 pointer-events-auto z-10 absolute -translate-x-1/2 bottom-[15px]" style={{ left: "calc(66.67% - 5px)" }}>
              {bookedDate && (
                <div className="whitespace-nowrap">
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-1">{t("detailView.booked")}</div>
                  <button
                    onClick={handleBookedClick}
                    className="text-[12px] font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                  >
                    <Calendar className="h-3 w-3 shrink-0" />{formatBookedDate(bookedDate)}
                  </button>
                </div>
              )}
              <div>
                <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-1">{t("detailView.source")}</div>
                {isEditing ? (
                  <input
                    value={editFields.source ?? ""}
                    onChange={(e) => setEditFields((f) => ({ ...f, source: e.target.value }))}
                    className="text-[11px] font-bold bg-white/70 dark:bg-white/[0.07] border border-brand-indigo/30 rounded px-1.5 py-0.5 w-20 focus:outline-none"
                  />
                ) : (
                  <div className="text-[11px] font-bold text-foreground">{lead.source || lead.Source || "API"}</div>
                )}
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-1">{t("detailView.rating")}</div>
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3" style={{ color: ratingKey === "hot" ? "#EF4444" : ratingKey === "warm" ? "#F59E0B" : "#6B7280" }} />
                  <span className="text-[11px] font-bold text-foreground">{ratingLabel}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {campaignStickerUrl ? (
                  <img src={campaignStickerUrl} alt="" className="h-[45px] w-[45px] object-contain shrink-0" />
                ) : (
                  <EntityAvatar
                    name={lead.Campaign || lead.campaign || lead.campaign_name || "?"}
                    bgColor={getCampaignAvatarColor("Active").bg}
                    textColor={getCampaignAvatarColor("Active").text}
                    size={45}
                    className="shrink-0"
                  />
                )}
                <div>
                  <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-1">{t("detailView.campaign")}</div>
                  <div className="text-[11px] font-bold text-foreground truncate max-w-[120px]">
                    {lead.Campaign || lead.campaign || lead.campaign_name || "—"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
                  style={accountLogo ? {} : { backgroundColor: "rgba(0,0,0,0.08)", color: "#374151" }}
                >
                  {accountLogo
                    ? <img src={accountLogo} alt={t("detail.fields.account")} className="h-full w-full object-cover" />
                    : <Building2 className="h-4 w-4" />}
                </div>
                <div>
                  <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("detailView.owner")}</div>
                  <span className="text-[11px] font-bold text-foreground truncate max-w-[90px]">{lead.Account || lead.account_name || "—"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Info chips — mobile row (appears below name row) */}
          <div className="md:hidden flex items-center gap-5 flex-wrap">
            {bookedDate && (
              <div className="whitespace-nowrap">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-1">{t("detailView.booked")}</div>
                <button
                  onClick={handleBookedClick}
                  className="text-[12px] font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                >
                  <Calendar className="h-3 w-3 shrink-0" />{formatBookedDate(bookedDate)}
                </button>
              </div>
            )}
            <div>
              <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-1">{t("detailView.source")}</div>
              {isEditing ? (
                <input
                  value={editFields.source ?? ""}
                  onChange={(e) => setEditFields((f) => ({ ...f, source: e.target.value }))}
                  className="text-[11px] font-bold bg-white/70 dark:bg-white/[0.07] border border-brand-indigo/30 rounded px-1.5 py-0.5 w-20 focus:outline-none"
                />
              ) : (
                <div className="text-[11px] font-bold text-foreground">{lead.source || lead.Source || "API"}</div>
              )}
            </div>
            <div>
              <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-1">{t("detailView.rating")}</div>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3" style={{ color: ratingKey === "hot" ? "#EF4444" : ratingKey === "warm" ? "#F59E0B" : "#6B7280" }} />
                <span className="text-[11px] font-bold text-foreground">{ratingLabel}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {campaignStickerUrl ? (
                <img src={campaignStickerUrl} alt="" className="h-[45px] w-[45px] object-contain shrink-0" />
              ) : (
                <EntityAvatar
                  name={lead.Campaign || lead.campaign || lead.campaign_name || "?"}
                  photoUrl={accountLogo || undefined}
                  bgColor={getCampaignAvatarColor("Active").bg}
                  textColor={getCampaignAvatarColor("Active").text}
                  size={40}
                  className="shrink-0"
                />
              )}
              <div>
                <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-1">{t("detailView.campaign")}</div>
                <div className="text-[11px] font-bold text-foreground truncate max-w-[120px]">
                  {lead.Campaign || lead.campaign || lead.campaign_name || "—"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
                style={accountLogo ? {} : { backgroundColor: "rgba(0,0,0,0.08)", color: "#374151" }}
              >
                {accountLogo
                  ? <img src={accountLogo} alt={t("detail.fields.account")} className="h-full w-full object-cover" />
                  : <Building2 className="h-4 w-4" />}
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("detailView.owner")}</div>
                <span className="text-[11px] font-bold text-foreground truncate max-w-[90px]">{lead.Account || lead.account_name || "—"}</span>
              </div>
            </div>
          </div>

          {/* Pipeline tube */}
          {status && (
            <div className="pt-2 pb-6">
              <div className="hidden md:block"><PipelineProgress status={status} /></div>
              <div className="md:hidden"><PipelineProgressCompact status={status} /></div>
            </div>
          )}
        </div>

      {/* ── Scrollable body with small fade ── */}
      <div
        className="relative flex-1 -mt-[80px] pt-[83px] overflow-y-auto"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0px, black 83px)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0px, black 83px)",
        }}
      >
        {/* ── Body — 3x2 widget grid matching Accounts page (each 48vh) ── */}
        <div ref={containerRef} className="p-[3px] flex flex-col gap-[3px]">

          {/* Row 1 */}
          <div className="grid gap-[3px]" style={{ gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr 1fr" }}>
            {/* Contact */}
            <div className="overflow-y-auto rounded-xl" style={{ height: isNarrow ? "auto" : 620, minHeight: isNarrow ? 280 : undefined }}>
              <ContactWidget lead={lead} onRefresh={onRefresh} />
            </div>
            {/* Chat (top of middle column) */}
            <div className="overflow-hidden rounded-xl bg-white/60 dark:bg-white/[0.10] flex flex-col" style={{ height: isNarrow ? "auto" : 620, minHeight: isNarrow ? 320 : undefined }}>
              <ConversationWidget lead={lead} showHeader />
            </div>
            {/* Lead Score */}
            <div className="overflow-y-auto rounded-xl" style={{ height: isNarrow ? "auto" : 620, minHeight: isNarrow ? 280 : undefined }}>
              <ScoreWidget score={score} lead={lead} status={status} />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid gap-[3px]" style={{ gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr 1fr" }}>
            {/* Activity Timeline */}
            <div className="overflow-y-auto rounded-xl" style={{ height: isNarrow ? "auto" : 620, minHeight: isNarrow ? 280 : undefined }}>
              <ActivityTimeline lead={lead} tagEvents={tagEvents} />
            </div>
            {/* Team */}
            <div className="overflow-y-auto rounded-xl" style={{ height: isNarrow ? "auto" : 620, minHeight: isNarrow ? 280 : undefined }}>
              <TeamWidget lead={lead} onRefresh={onRefresh} />
            </div>
            {/* Notes (click-to-edit) */}
            <div className="overflow-y-auto rounded-xl" style={{ height: isNarrow ? "auto" : 620, minHeight: isNarrow ? 280 : undefined }}>
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

export function ListScoreRing({ score, status, isActive }: { score: number; status: string; isActive?: boolean }) {
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
          fill="none" stroke="#D1D1D1" strokeOpacity={0.3} strokeWidth={LIST_RING_STROKE}
        />
        <circle
          cx={LIST_RING_SIZE / 2} cy={LIST_RING_SIZE / 2} r={LIST_RING_RADIUS}
          fill="none" stroke={isActive ? "#555555" : "#D1D1D1"} strokeWidth={LIST_RING_STROKE}
          strokeDasharray={LIST_RING_CIRC} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold tabular-nums text-foreground/70">{score}</span>
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
  showContactAlways = false,
  tagsColorful = false,
  hideTags = false,
}: {
  lead: Record<string, any>;
  isActive: boolean;
  onClick: () => void;
  leadTags: { name: string; color: string }[];
  showContactAlways?: boolean;
  tagsColorful?: boolean;
  hideTags?: boolean;
}) {
  const { t } = useTranslation("leads");
  const name        = getFullName(lead);
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
        "relative group/card rounded-xl cursor-pointer transition-colors",
        isActive ? "bg-highlight-selected" : "bg-card hover:bg-card-hover hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div className={cn("px-2.5 flex flex-col gap-0.5", hideTags ? "pt-1.5 pb-1" : "pt-2 pb-1.5")}>

        {/* Main layout: [avatar + text] on left, [date + score] column on right */}
        <div className="flex items-stretch gap-2">
          <EntityAvatar
            name={name}
            bgColor={avatarColor.bg}
            textColor={avatarColor.text}
            className="self-start mt-0.5 shrink-0"
          />

          {/* Left: name + status */}
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-[18px] font-semibold font-heading leading-tight truncate text-foreground">
              {name}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: statusHex }} />
              <span className="text-[10px] text-muted-foreground/65 truncate">{t(`kanban.stageLabels.${status.replace(/ /g, "")}`, status)}</span>
            </div>

            {/* Tags + contact — collapses when hideTags, expands on hover */}
            <div className={cn(
              "overflow-hidden transition-[max-height,opacity] duration-200 ease-out",
              hideTags
                ? "max-h-0 opacity-0 group-hover/card:max-h-24 group-hover/card:opacity-100"
                : "max-h-24 opacity-100"
            )}>
              {visibleTags.length > 0 && (
                <div className="relative z-10 flex items-center gap-1 flex-wrap mt-1">
                  {visibleTags.map((t) => {
                    const hex = resolveColor(t.color);
                    return (
                      <span
                        key={t.name}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={tagsColorful
                          ? { backgroundColor: `${hex}20`, color: hex }
                          : { backgroundColor: isActive ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.09)", color: "rgba(0,0,0,0.45)" }
                        }
                      >
                        {t.name}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className={cn(
                "overflow-hidden transition-[max-height,opacity] duration-200 ease-out",
                showContactAlways
                  ? "max-h-12 opacity-100"
                  : "max-h-0 opacity-0 group-hover/card:max-h-12 group-hover/card:opacity-100"
              )}>
                {(phone || email) && (
                  <div className="pt-1 pb-0.5 flex items-center gap-2.5 text-[10px] text-muted-foreground/70">
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

          {/* Right column: date on top, score ring on bottom */}
          {(lastActivity || score > 0) && (
            <div className="shrink-0 flex flex-col items-end justify-between">
              {lastActivity && (
                <span className="text-[10px] tabular-nums leading-none text-muted-foreground/60 pt-0.5">
                  {formatRelativeTime(lastActivity, t)}
                </span>
              )}
              {score > 0 && (
                <div className="mt-auto pt-1">
                  <ListScoreRing score={score} status={status} isActive={isActive} />
                </div>
              )}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

// ── Group header ───────────────────────────────────────────────────────────────
function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div data-group-header="true" className="sticky top-0 z-30 bg-muted px-3 pt-3 pb-3">
      <div className="flex items-center gap-[10px]">
        <div className="flex-1 h-px bg-foreground/15" />
        <span className="text-[12px] font-bold text-foreground tracking-wide shrink-0">{label}</span>
        <span className="text-foreground/20 shrink-0">–</span>
        <span className="text-[12px] font-medium text-muted-foreground tabular-nums shrink-0">{count}</span>
        <div className="flex-1 h-px bg-foreground/15" />
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

// GROUP_LABELS and SORT_LABELS are now computed inside LeadsCardView with t()
const STATUS_GROUP_ORDER = ["New", "Contacted", "Responded", "Multiple Responses", "Qualified", "Booked", "Lost", "DND"];
// DATE_GROUP_ORDER is now computed inside LeadsCardView with t() as dateGroupOrder

// ── Kanban detail panel (tabbed, compact) ─────────────────────────────────────
type KanbanTab = "chat" | "contact" | "score" | "activity" | "notes";

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
  const { t } = useTranslation("leads");
  const [activeTab, setActiveTab] = useState<KanbanTab>("chat");

  const kanbanTabs: { id: KanbanTab; label: string; icon: typeof MessageSquare }[] = [
    { id: "chat",     label: t("conversations.title"), icon: MessageSquare },
    { id: "contact",  label: t("contact.title"),       icon: Phone },
    { id: "score",    label: t("score.title"),          icon: TrendingUp },
    { id: "activity", label: t("detail.sections.activity"), icon: ClipboardList },
    { id: "notes",    label: t("detail.sections.notes"),    icon: FileText },
  ];

  const name       = getFullName(lead);
  const initials   = getInitials(name);
  const status     = getStatus(lead);
  const score      = getScore(lead);
  const avatarColor = getStatusAvatarColor(status);
  const ratingLabel = score >= 70 ? t("detailView.hot") : score >= 40 ? t("detailView.warm") : t("detailView.cold");

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card rounded-lg">

      {/* ── Header: avatar + name + X ── */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border/20">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <EntityAvatar
              name={name}
              bgColor={avatarColor.bg}
              textColor={avatarColor.text}
              size={72}
            />
            <div>
              <p className="text-[18px] font-semibold font-heading text-foreground leading-tight truncate max-w-[180px]">{name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{status || "—"}</p>
            </div>
          </div>
          {onOpenFullProfile && (
            <button
              onClick={onOpenFullProfile}
              title="Open full lead profile"
              className="flex items-center gap-1 text-[11px] font-medium text-brand-indigo/80 hover:text-brand-indigo transition-colors px-2 py-1 rounded-lg hover:bg-brand-indigo/5 shrink-0 mt-1"
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
            <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("detailView.source")}</div>
            <div className="text-[12px] font-bold text-foreground">{lead.source || lead.Source || "API"}</div>
          </div>
          <div>
            <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("detailView.rating")}</div>
            <div className="text-[12px] font-bold text-foreground">{ratingLabel}</div>
          </div>
          <div>
            <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("detailView.campaign")}</div>
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
              <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("detailView.owner")}</div>
              <div className="text-[12px] font-bold text-foreground truncate max-w-[80px]">{lead.Account || lead.account_name || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="shrink-0 px-2 pt-2 pb-1 flex items-center gap-1">
        {kanbanTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium",
              activeTab === id
                ? "bg-highlight-active text-foreground"
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
          <div className="h-full overflow-hidden">
            <ActivityTimeline lead={lead} tagEvents={leadTags} />
          </div>
        )}
        {activeTab === "notes" && (
          <div className="h-full overflow-y-auto p-4">
            <p className="text-[18px] font-semibold font-heading text-foreground mb-3">{t("detail.sections.notes")}</p>
            {lead.notes || lead.Notes ? (
              <p className="text-[12px] text-foreground/80 leading-relaxed">
                {renderRichText(lead.notes || lead.Notes || "")}
              </p>
            ) : (
              <p className="text-[12px] text-muted-foreground/50 italic">{t("activity.clickToAddNotes")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

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
  mobileView = "list",
  onMobileViewChange,
  accountsById,
  campaignsById,
}: LeadsCardViewProps) {
  const { t } = useTranslation("leads");

  const viewTabs: TabDef[] = [
    { id: "list",     label: t("viewTabs.list"),     icon: List   },
    { id: "table",    label: t("viewTabs.table"),    icon: Table2 },
    { id: "pipeline", label: t("viewTabs.pipeline"), icon: Kanban },
  ];

  const groupLabels: Record<GroupByOption, string> = {
    date:     t("sort.mostRecent"),
    status:   t("group.status"),
    campaign: t("group.campaign"),
    tag:      t("detail.sections.tags"),
    none:     t("group.none"),
  };
  const sortLabels: Record<SortByOption, string> = {
    recent:     t("sort.mostRecent"),
    name_asc:   t("sort.nameAZ"),
    name_desc:  t("sort.nameZA"),
    score_desc: t("sort.scoreDown"),
    score_asc:  t("sort.scoreUp"),
  };
  const dateGroupOrder = [t("time.today"), t("time.yesterday"), t("time.thisWeek"), t("time.thisMonth"), t("time.last3Months"), t("time.older"), t("time.noActivity")];

  const [currentPage, setCurrentPage]   = useState(0);
  const PAGE_SIZE = 50;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Track which card IDs have been rendered before — only animate genuinely new cards
  const seenCardIds = useRef<Set<number>>(new Set());

  // Shared scroll helper — finds the card in the DOM and positions it just below its group header.
  const scrollToLead = useCallback((id: number, behavior: ScrollBehavior) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-lead-id="${id}"]`) as HTMLElement | null;
    if (!el) return;
    let headerHeight = 0;
    let sibling = el.previousElementSibling;
    while (sibling) {
      if (sibling.getAttribute("data-group-header") === "true") {
        headerHeight = (sibling as HTMLElement).offsetHeight;
        break;
      }
      sibling = sibling.previousElementSibling;
    }
    const cardTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTo({ top: cardTop - headerHeight - 3, behavior });
  }, []);

  // Initial load: snap to the selected card instantly (no slide-down artifact).
  const initialScrollDoneRef = useRef(false);
  useEffect(() => {
    if (!selectedLead || initialScrollDoneRef.current) return;
    const id = getLeadId(selectedLead);
    // Use setTimeout so the card is in the DOM before we query it
    const t = window.setTimeout(() => {
      initialScrollDoneRef.current = true;
      scrollToLead(id, "instant");
    }, 0);
    return () => window.clearTimeout(t);
  }, [selectedLead, scrollToLead]);

  // On card click: smooth-scroll the newly selected card to the top.
  const prevSelectedIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!selectedLead) return;
    const id = getLeadId(selectedLead);
    if (prevSelectedIdRef.current === null) { prevSelectedIdRef.current = id; return; }
    if (prevSelectedIdRef.current === id) return;
    prevSelectedIdRef.current = id;
    const capturedId = id;
    window.setTimeout(() => scrollToLead(capturedId, "smooth"), 0);
  }, [selectedLead, scrollToLead]);

  const [showContactAlways, setShowContactAlways] = useState<boolean>(() => {
    try { return localStorage.getItem("list_contact_always_show") === "true"; } catch {} return false;
  });
  useEffect(() => {
    try { localStorage.setItem("list_contact_always_show", String(showContactAlways)); } catch {}
  }, [showContactAlways]);

  const [tagsColorful, setTagsColorful] = useState<boolean>(() => {
    try { return localStorage.getItem("list_tags_colorful") === "true"; } catch {} return false;
  });
  useEffect(() => {
    try { localStorage.setItem("list_tags_colorful", String(tagsColorful)); } catch {}
  }, [tagsColorful]);

  const [hideTags, setHideTags] = useState<boolean>(() => {
    try { return localStorage.getItem("list_tags_hidden") === "true"; } catch {} return false;
  });
  useEffect(() => {
    try { localStorage.setItem("list_tags_hidden", String(hideTags)); } catch {}
  }, [hideTags]);

  // ── Local filter state: account & campaign ────────────────────────────────
  const [filterAccount, setFilterAccount] = useState<string>("");
  const [filterCampaign, setFilterCampaign] = useState<string>("");
  const [tagSearchInput, setTagSearchInput] = useState<string>("");

  // Derive available accounts from leads + accountsById map
  const availableAccounts = useMemo(() => {
    if (!accountsById || accountsById.size === 0) return [];
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    leads.forEach((l) => {
      const id = String(l.Accounts_id || l.account_id || l.accounts_id || "");
      if (id && !seen.has(id)) {
        seen.add(id);
        const name = accountsById.get(Number(id)) || `Account ${id}`;
        result.push({ id, name });
      }
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [leads, accountsById]);

  // Derive available campaigns from leads + campaignsById map, cascading with account filter
  const availableCampaigns = useMemo(() => {
    const campaignIds = new Set<number>();
    leads.forEach((l) => {
      if (filterAccount && String(l.Accounts_id || l.account_id || l.accounts_id || "") !== filterAccount) return;
      const cId = Number(l.Campaigns_id || l.campaigns_id || l.campaignsId || 0);
      if (cId) campaignIds.add(cId);
    });
    const result: { id: string; name: string }[] = [];
    campaignIds.forEach((cId) => {
      const info = campaignsById?.get(cId);
      result.push({ id: String(cId), name: info?.name || `Campaign ${cId}` });
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [leads, campaignsById, filterAccount]);

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

    // 3b. Account filter
    if (filterAccount) {
      filtered = filtered.filter((l) =>
        String(l.Accounts_id || l.account_id || l.accounts_id || "") === filterAccount
      );
    }

    // 3c. Campaign filter (by ID)
    if (filterCampaign) {
      filtered = filtered.filter((l) =>
        String(l.Campaigns_id || l.campaigns_id || l.campaignsId || "") === filterCampaign
      );
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
        key = getDateGroupLabel(d, t);
      } else if (groupBy === "status") {
        key = getStatus(l) || "Unknown";
      } else if (groupBy === "campaign") {
        const cId = Number(l.Campaigns_id || l.campaigns_id || l.campaignsId || 0);
        key = (cId && campaignsById?.get(cId)?.name) || l.Campaign || l.campaign || l.campaign_name || t("group.noCampaign");
      } else {
        const tags = leadTagsInfo.get(getLeadId(l)) || [];
        key = tags[0]?.name || t("group.untagged");
      }
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(l);
    });

    // Sort bucket keys
    const allBucketKeys = Array.from(buckets.keys());
    const orderedKeys = groupBy === "status"
      ? STATUS_GROUP_ORDER.filter((k) => buckets.has(k)).concat(allBucketKeys.filter((k) => !STATUS_GROUP_ORDER.includes(k)))
      : groupBy === "date"
      ? dateGroupOrder.filter((k) => buckets.has(k))
      : allBucketKeys.sort();

    const result: VirtualListItem[] = [];
    orderedKeys.forEach((key) => {
      const group = buckets.get(key);
      if (!group || group.length === 0) return;
      const headerLabel = groupBy === "status"
        ? t(`kanban.stageLabels.${key.replace(/ /g, "")}`, key)
        : key;
      result.push({ kind: "header", label: headerLabel, count: group.length });
      group.forEach((l) => result.push({ kind: "lead", lead: l, tags: leadTagsInfo.get(getLeadId(l)) || [] }));
    });

    return result;
  }, [leads, listSearch, groupBy, sortBy, filterStatus, filterTags, filterAccount, filterCampaign, leadTagsInfo, campaignsById]);

  // Reset to page 0 whenever the filtered/sorted list changes
  useEffect(() => { setCurrentPage(0); }, [flatItems]);

  const isFilterActive     = filterStatus.length > 0 || filterTags.length > 0 || !!filterAccount || !!filterCampaign;

  return (
    /* Outer shell: transparent — gaps between panels reveal stone-gray page background */
    <div className="relative flex h-full min-h-[600px] gap-[3px]">

      {/* ── LEFT: Lead List ── muted panel (#E3E3E3) */}
      <div className={cn(
        "flex-col bg-muted rounded-lg overflow-hidden w-full md:w-[340px] md:shrink-0",
        mobileView === "detail" ? "hidden md:flex" : "flex"
      )}>

        {/* ── Panel header: title + ViewTabBar ── */}
        <div className="pl-[17px] pr-3.5 pt-3 md:pt-10 pb-1 md:pb-3 shrink-0 flex flex-col gap-2 md:flex-row md:items-center md:gap-0">
          <div className="flex items-center justify-between w-full md:w-[309px] md:shrink-0">
            <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">{t("page.title")}</h2>
            <span className="hidden md:block">
              <ViewTabBar tabs={viewTabs} activeId={viewMode} onTabChange={(id) => onViewModeChange(id as ViewMode)} variant="segment" />
            </span>
          </div>
          {/* ViewTabBar below title on mobile */}
          <div className="md:hidden">
            <ViewTabBar tabs={viewTabs} activeId={viewMode} onTabChange={(id) => onViewModeChange(id as ViewMode)} variant="segment" />
          </div>
        </div>


        {/* Lead list — card list (pagination inside scroll area, below last card) */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-[3px] pt-0 pb-[3px]">
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
              <div key={`page-${currentPage}`} className="flex flex-col gap-[3px]">
                {flatItems
                  .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
                  .map((item, i) => {
                    const selectedId = selectedLead ? getLeadId(selectedLead) : null;
                    return item.kind === "header" ? (
                      <GroupHeader key={`h-${item.label}-${i}`} label={item.label} count={item.count} />
                    ) : (() => {
                      const lid = getLeadId(item.lead);
                      const isNew = !seenCardIds.current.has(lid);
                      if (isNew) seenCardIds.current.add(lid);
                      return (
                      <div key={lid} data-lead-id={lid} className={isNew ? "animate-card-enter" : undefined} style={isNew ? { animationDelay: `${Math.min(i, 15) * 30}ms` } : undefined}>
                        <LeadListCard
                          lead={item.lead}
                          isActive={selectedId === getLeadId(item.lead)}
                          onClick={() => { onSelectLead(item.lead); onMobileViewChange?.("detail"); }}
                          leadTags={item.tags}
                          showContactAlways={showContactAlways}
                          tagsColorful={tagsColorful}
                          hideTags={hideTags}
                        />
                      </div>
                      );
                    })()
                  })}

              </div>

              {/* Pagination — below last card, inside scroll area */}
              {flatItems.length > PAGE_SIZE && (
                <div className="px-3 py-3 mt-2 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className="icon-circle-lg icon-circle-base disabled:opacity-30"
                    title={t("detailView.previousPage")}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[10px] text-muted-foreground tabular-nums text-center leading-tight">
                    {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, flatItems.length)}
                    {" "}<span className="text-muted-foreground/50">{t("detailView.of")} {flatItems.length}</span>
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={(currentPage + 1) * PAGE_SIZE >= flatItems.length}
                    className="icon-circle-lg icon-circle-base disabled:opacity-30"
                    title={t("detailView.nextPage")}
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
      <div className={cn(
        "flex-1 flex-col min-w-0 overflow-hidden bg-card rounded-lg",
        mobileView === "list" ? "hidden md:flex" : "flex mobile-panel-enter"
      )}>
        {loading && !selectedLead ? (
          <SkeletonLeadPanel />
        ) : selectedLead ? (
          <LeadDetailView
            lead={selectedLead}
            onClose={onClose}
            leadTags={leadTagsInfo.get(getLeadId(selectedLead)) || []}
            onRefresh={onRefresh}
            toolbarPrefix={() => {
              const xBtn = (active: boolean, maxW: string) => cn(
                "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0",
                "transition-[max-width,color,border-color] duration-200 max-w-9", maxW,
                active ? "border-brand-indigo text-brand-indigo" : "border-black/[0.125] text-foreground/60 hover:text-foreground"
              );
              const xSpan = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";
              return (
                <>
                  {/* Back to list — mobile only */}
                  <button
                    onClick={() => onMobileViewChange?.("list")}
                    className="md:hidden h-9 w-9 rounded-full border border-black/[0.125] bg-background grid place-items-center shrink-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {/* +Add */}
                  <button onClick={onCreateLead} className={xBtn(false, "hover:max-w-[90px]")} title={t("detailView.newLead")}>
                    <Plus className="h-4 w-4 shrink-0" />
                    <span className={xSpan}>{t("toolbar.add")}</span>
                  </button>

                  {/* Search — always extended, no fill */}
                  <SearchPill
                    value={listSearch}
                    onChange={onListSearchChange}
                    open={searchOpen}
                    onOpenChange={onSearchOpenChange}
                    placeholder={t("toolbar.searchPlaceholder")}
                  />

                  {/* Group */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={xBtn(isGroupNonDefault, "hover:max-w-[115px]")} title={t("toolbar.group")}>
                        <Layers className="h-4 w-4 shrink-0" />
                        <span className={xSpan}>{t("toolbar.group")}</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      {(["date", "status", "campaign", "tag", "none"] as GroupByOption[]).map((opt) => (
                        <DropdownMenuItem key={opt} onClick={() => onGroupByChange(opt)} className={cn("text-[12px]", groupBy === opt && "font-semibold text-brand-indigo")}>
                          {groupLabels[opt]}
                          {groupBy === opt && <Check className="h-3 w-3 ml-auto" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Sort */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={xBtn(isSortNonDefault, "hover:max-w-[100px]")} title={t("toolbar.sort")}>
                        <ArrowUpDown className="h-4 w-4 shrink-0" />
                        <span className={xSpan}>{t("toolbar.sort")}</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {(["recent", "name_asc", "name_desc", "score_desc", "score_asc"] as SortByOption[]).map((opt) => (
                        <DropdownMenuItem key={opt} onClick={() => onSortByChange(opt)} className={cn("text-[12px]", sortBy === opt && "font-semibold text-brand-indigo")}>
                          {sortLabels[opt]}
                          {sortBy === opt && <Check className="h-3 w-3 ml-auto" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={xBtn(isFilterActive, "hover:max-w-[110px]")} title={t("toolbar.filter")}>
                        <Filter className="h-4 w-4 shrink-0" />
                        <span className={xSpan}>{t("toolbar.filter")}</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      {/* Status — submenu */}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
                          <span className="flex-1">{t("group.status")}</span>
                          {filterStatus.length > 0 && (
                            <span className="text-[10px] tabular-nums text-brand-indigo font-semibold">{filterStatus.length}</span>
                          )}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-48">
                          {STATUS_GROUP_ORDER.map((s) => (
                            <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); onToggleFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PIPELINE_HEX[s] ?? "#6B7280" }} />
                              <span className="flex-1">{t("kanban.stageLabels." + s.replace(/ /g, ""))}</span>
                              {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      {/* Account — submenu */}
                      {availableAccounts.length > 0 && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
                            <span className="flex-1">{t("detail.fields.account")}</span>
                            {filterAccount && <span className="text-[10px] text-brand-indigo font-semibold">1</span>}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-48">
                            <DropdownMenuItem
                              onClick={(e) => { e.preventDefault(); setFilterAccount(""); setFilterCampaign(""); }}
                              className={cn("text-[12px]", !filterAccount && "font-semibold text-brand-indigo")}
                            >
                              {t("filters.allAccounts")}
                              {!filterAccount && <Check className="h-3 w-3 ml-auto text-brand-indigo" />}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {availableAccounts.map((a) => (
                              <DropdownMenuItem
                                key={a.id}
                                onClick={(e) => { e.preventDefault(); if (filterAccount === a.id) { setFilterAccount(""); } else { setFilterAccount(a.id); setFilterCampaign(""); } }}
                                className={cn("text-[12px]", filterAccount === a.id && "font-semibold text-brand-indigo")}
                              >
                                <span className="flex-1 truncate">{a.name}</span>
                                {filterAccount === a.id && <Check className="h-3 w-3 ml-auto text-brand-indigo shrink-0" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )}

                      {/* Campaign — submenu (cascading: scoped to selected account) */}
                      {availableCampaigns.length > 0 && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
                            <span className="flex-1">{t("detailView.campaign")}</span>
                            {filterCampaign && <span className="text-[10px] text-brand-indigo font-semibold">1</span>}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-52 max-h-64 overflow-y-auto">
                            <DropdownMenuItem
                              onClick={(e) => { e.preventDefault(); setFilterCampaign(""); }}
                              className={cn("text-[12px]", !filterCampaign && "font-semibold text-brand-indigo")}
                            >
                              {t("filters.allCampaigns")}
                              {!filterCampaign && <Check className="h-3 w-3 ml-auto text-brand-indigo" />}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {availableCampaigns.map((c) => (
                              <DropdownMenuItem
                                key={c.id}
                                onClick={(e) => { e.preventDefault(); setFilterCampaign(filterCampaign === c.id ? "" : c.id); }}
                                className={cn("text-[12px]", filterCampaign === c.id && "font-semibold text-brand-indigo")}
                              >
                                <span className="flex-1 truncate">{c.name}</span>
                                {filterCampaign === c.id && <Check className="h-3 w-3 ml-auto text-brand-indigo shrink-0" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )}

                      {/* Tags — search-based */}
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("toolbar.tags")}</div>
                      <div className="px-2 pb-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={tagSearchInput}
                          onChange={(e) => setTagSearchInput(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter" && tagSearchInput.trim()) {
                              const match = allTags.find((t) => t.name.toLowerCase() === tagSearchInput.trim().toLowerCase());
                              if (match) { onToggleFilterTag(match.name); setTagSearchInput(""); }
                            }
                          }}
                          placeholder={t("detailView.searchTagName")}
                          className="w-full h-7 px-2 rounded-md border border-black/[0.1] bg-muted/30 text-[11px] placeholder:text-muted-foreground/50 outline-none focus:border-brand-indigo/40"
                        />
                      </div>
                      {(() => {
                        const q = tagSearchInput.trim().toLowerCase();
                        const filtered = q ? allTags.filter((t) => t.name.toLowerCase().includes(q)) : [];
                        const shown = filterTags.length > 0 && !q
                          ? allTags.filter((t) => filterTags.includes(t.name))
                          : filtered.slice(0, 8);
                        return shown.map((t) => (
                          <DropdownMenuItem key={t.name} onClick={(e) => { e.preventDefault(); onToggleFilterTag(t.name); }} className="flex items-center gap-2 text-[12px]">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: resolveColor(t.color) }} />
                            <span className="flex-1 truncate">{t.name}</span>
                            {filterTags.includes(t.name) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                          </DropdownMenuItem>
                        ));
                      })()}

                      {/* Reset */}
                      {isFilterActive && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => {
                            filterStatus.forEach((s) => onToggleFilterStatus(s));
                            filterTags.forEach((t) => onToggleFilterTag(t));
                            setFilterAccount("");
                            setFilterCampaign("");
                            setTagSearchInput("");
                          }} className="text-[12px] text-destructive">
                            Clear all filters
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Tags display settings */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={xBtn(tagsColorful || hideTags || showContactAlways, "hover:max-w-[100px]")} title={t("toolbar.tags")}>
                        <TagIcon className="h-4 w-4 shrink-0" />
                        <span className={xSpan}>{t("toolbar.tags")}</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => setTagsColorful((v) => !v)} className="flex items-center gap-2 text-[12px]">
                        <Palette className="h-3.5 w-3.5 mr-0.5 shrink-0" /><span className="flex-1">Tag Color</span>
                        {tagsColorful && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setHideTags((v) => !v)} className="flex items-center gap-2 text-[12px]">
                        {hideTags
                          ? <EyeOff className="h-3.5 w-3.5 mr-0.5 shrink-0" />
                          : <Eye className="h-3.5 w-3.5 mr-0.5 shrink-0" />
                        }
                        <span className="flex-1">Hide Tags</span>
                        {hideTags && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setShowContactAlways((v) => !v)} className="flex items-center gap-2 text-[12px]">
                        <Phone className="h-3.5 w-3.5 mr-0.5 shrink-0" /><span className="flex-1">Show Phone & Email</span>
                        {showContactAlways && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />
                </>
              );
            }}
          />
        ) : (
          <EmptyDetailState leadsCount={leads.length} />
        )}
      </div>
    </div>
  );
}
