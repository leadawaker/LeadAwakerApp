import { useState, useMemo, useCallback, useRef, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { hapticSave, hapticDelete } from "@/lib/haptics";
import { useTheme } from "@/hooks/useTheme";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/ui/PullToRefreshIndicator";
import { createPortal } from "react-dom";
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
  CalendarClock,
  FileText,
  X,
  Calendar,
  TrendingUp,
  TrendingDown,
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
  RotateCcw,
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
  Play,
  Pause,
  StickyNote,
  Save,
  CheckCircle2,
} from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { updateLead, deleteLead, createLead } from "../api/leadsApi";
import { useLocation } from "wouter";
import { usePersistedState } from "@/hooks/usePersistedState";
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
import { GradientTester, GradientControlPoints, DEFAULT_LAYERS, layerToStyle, type GradientLayer } from "@/components/ui/gradient-tester";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useSession, type SessionUser } from "@/hooks/useSession";
import {
  useScoreBreakdown,
  useScoreHistory,
  TIER_COLORS,
  TIER_BAR_COLOR,
  TrendIcon,
  type ScoreHistoryPoint,
} from "@/hooks/useScoreBreakdown";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechTooltip, ResponsiveContainer,
} from "recharts";
import {
  Tooltip, TooltipTrigger, TooltipContent,
} from "@/components/ui/tooltip";

// ── Re-exports for backward compat — other files importing from LeadsCardView still work ──
export { getLeadStatusAvatarColor as getStatusAvatarColor, PIPELINE_HEX } from "@/lib/avatarUtils";

export type ViewMode = "list" | "table" | "pipeline";

// ── Score insight tag type ──────────────────────────────────────────────────
type ScoreInsight = { direction: "up" | "down"; label: string; column: "engagement" | "activity" | "funnel" };

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
  campaignsById?: Map<number, { name: string; accountId: number | null; bookingMode?: string | null }>;
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
    if (diffMs <= 0) return t("relativeTime.justNow");
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return t("relativeTime.justNow");
    if (diffMins < 60) return t("relativeTime.minutesAgo", { count: diffMins });
    const h = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) return t("relativeTime.hoursAgo", { count: h });
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

// ── Map variant statuses to their canonical pipeline stage ────────────────────
const STATUS_TO_STAGE: Record<string, string> = {};

// ── Pipeline progress — monochrome tube, icons+labels at left of each segment ─
function PipelineProgress({ status, skipBooked = false }: { status: string; skipBooked?: boolean }) {
  const { t } = useTranslation("leads");
  const { isDark } = useTheme();
  // Map variant statuses to canonical stage key
  let canonicalStatus = STATUS_TO_STAGE[status] ?? status;
  // Direct-booking campaigns: "Closed" is really "Booked" (final stage)
  if (skipBooked && canonicalStatus === "Closed") canonicalStatus = "Booked";
  const isTerminal = LOST_STAGES.includes(status);
  const tubeHeight = 46;

  // For direct-call campaigns, "Booked" is the final stage (no "Closed" after it)
  const stages = skipBooked ? PIPELINE_STAGES.filter((s) => s.key !== "Closed") : PIPELINE_STAGES;
  const stageCount = stages.length;

  const currentIndex = stages.findIndex((s) => s.key === canonicalStatus);

  // For terminal statuses (DND/Lost), anchor = the last normal stage before the exit.
  // The terminal icon replaces the stage right after the anchor (same slot, same position).
  const anchorIndex = isTerminal
    ? Math.min(TERMINAL_DEFAULT_ANCHOR[status] ?? 3, stageCount - 1)
    : currentIndex;
  // effectiveIndex = the slot whose icon gets the "current" treatment
  const effectiveIndex = isTerminal ? anchorIndex + 1 : Math.max(0, anchorIndex);

  // Sizes — current stage is slightly bigger
  const iconSizeBase = 30;
  const iconSizeCurrent = 36;
  const innerIconBase = 16;
  const innerIconCurrent = 20;

  // Monochrome: entire filled bar uses the status color (canonical for direct-booking remap)
  const activeHex = PIPELINE_HEX[canonicalStatus] || PIPELINE_HEX[status] || "#6B7280";
  const barHex = activeHex;

  // Animated fill — grows from 0 on mount, transitions smoothly between leads
  // New: no fill. Closed (last stage): full bar.
  // Others: bar extends 7% past the next icon so the fade trails smoothly into it.
  const isClosed = effectiveIndex === stageCount - 1;
  const isNew = effectiveIndex === 0 && !isTerminal;
  const nextIconPct = ((effectiveIndex + 1) / stageCount) * 100;
  const rawFillPct = isNew ? 0 : isClosed ? 100 : Math.min(100, nextIconPct + 7);
  const [displayFillPct, setDisplayFillPct] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setDisplayFillPct(rawFillPct), 20);
    return () => clearTimeout(id);
  }, [rawFillPct]);

  // Gradient: solid from start through the current icon, then smooth fade to transparent at end.
  // Current icon position within the fill bar.
  const iconPct = isNew ? 0 : isClosed ? 100 : Math.round((effectiveIndex / (effectiveIndex + 1)) * 100);
  const fillBackground = isNew
    ? "transparent"
    : isClosed
      ? barHex
      : `linear-gradient(to right, ${barHex} ${iconPct}%, transparent 100%)`;

  return (
    <div className="w-full">
      <div className="relative" style={{ height: tubeHeight + 14 }}>
        {/* Gray track underneath (full width) */}
        <div
          className="absolute rounded-full"
          style={{ left: 0, right: 0, top: "50%", transform: "translateY(-50%)", height: tubeHeight - 6, backgroundColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(55,55,55,0.16)" }}
        />

        {/* Animated fill bar — single bar with width transition for smooth per-lead transitions */}
        <div
          className="absolute overflow-hidden rounded-full"
          style={{ left: 0, right: 0, top: "50%", transform: "translateY(-50%)", height: tubeHeight }}
        >
          <div
            className="h-full transition-[width] duration-[500ms] ease-out"
            style={{
              width: `${displayFillPct}%`,
              background: fillBackground,
            }}
          />
        </div>

        {/* Stage icons + labels — at LEFT edge of each segment */}
        {stages.map((stage, i) => {
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
              className={cn("absolute z-10 items-center", isCurrent ? "flex" : "hidden lg:flex")}
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
                  backgroundColor: isDark ? "#243249" : "#fff",
                  border: isFuture
                    ? `1.5px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}`
                    : `2.5px solid ${activeHex}`,
                  boxShadow: isCurrent ? `0 0 0 3px ${activeHex}40` : "none",
                }}
              >
                <IconComponent
                  className="shrink-0"
                  style={{
                    width: innerSz,
                    height: innerSz,
                    color: isTerminalSlot ? activeHex : (isPast || isCurrent) ? (isDark ? "rgba(255,255,255,0.85)" : "#1F1F1F") : (isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.20)"),
                  }}
                />
              </div>
              {/* Label next to icon */}
              <span
                className="ml-2 font-bold tracking-wide leading-none whitespace-nowrap select-none capitalize"
                style={{
                  color: isCurrent ? "#FFFFFF" : isFuture ? (isDark ? "rgba(255,255,255,0.40)" : "#000000") : (isDark ? "rgba(255,255,255,0.80)" : "#1F1F1F"),
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
  const { isDark } = useTheme();
  const currentIndex = PIPELINE_STAGES.findIndex((s) => s.key === status);
  const isTerminal = LOST_STAGES.includes(status);
  const anchorIndex = isTerminal ? (TERMINAL_DEFAULT_ANCHOR[status] ?? 3) : currentIndex;
  const effectiveIndex = isTerminal ? anchorIndex + 1 : anchorIndex;
  const futureCount = Math.max(0, PIPELINE_STAGES.length - 1 - effectiveIndex);
  const locksToShow = Math.min(futureCount, 2);
  const activeHex = PIPELINE_HEX[status] || "#6B7280";
  const barHex = activeHex;
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
        style={{ border: `2px solid ${activeHex}`, boxShadow: `0 0 0 3px ${activeHex}30`, background: isDark ? "#243249" : "#fff" }}
      >
        <CurrentIcon style={{ width: 14, height: 14, color: activeHex }} />
        <span className="text-[11px] font-bold" style={{ color: activeHex }}>{currentStage}</span>
      </div>
      {Array.from({ length: locksToShow }).map((_, i) => (
        <div
          key={i}
          className="h-[28px] w-[28px] rounded-full flex items-center justify-center shrink-0"
          style={{ border: `1.5px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}`, background: isDark ? "#243249" : "#fff" }}
        >
          <Lock style={{ width: 12, height: 12, color: isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.20)" }} />
        </div>
      ))}
      <div className="flex-1 h-[8px] rounded-full" style={{ background: isDark ? "rgba(255,255,255,0.10)" : "rgba(55,55,55,0.10)" }} />
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

function ContactWidget({
  lead,
  onRefresh,
  accountLogo: accountLogoProp,
  campaignStickerUrl: campaignStickerUrlProp,
  tags,
  campaignsById,
}: {
  lead: Record<string, any>;
  onRefresh?: () => void;
  /** Pass from parent when already fetched to avoid duplicate API calls */
  accountLogo?: string | null;
  campaignStickerUrl?: string | null;
  /** Lead tags to display as pill badges in the Info tab */
  tags?: { name: string; color: string }[];
  /** Campaigns map (agency view only) for campaign assignment dropdown */
  campaignsById?: Map<number, { name: string; accountId: number | null; bookingMode?: string | null }>;
}) {
  const { t } = useTranslation("leads");
  const leadId      = getLeadId(lead);
  const phone       = lead.phone || lead.Phone || "";
  const email       = lead.email || lead.Email || "";
  const company     = lead.company || lead.Company || lead.company_name || "";
  const firstName   = lead.first_name || lead.firstName || "";
  const lastName    = lead.last_name || lead.lastName || "";
  const jobTitle    = lead.job_title || lead.jobTitle || lead.title || "";
  const createdAt   = lead.created_at || lead.CreatedAt || lead.createdAt || "";

  // Fetch only when parent doesn't supply the value (avoids duplicate requests
  // when ContactWidget is nested inside LeadDetailView which already fetches).
  const [logoFetched, setLogoFetched] = useState<string | null>(null);
  useEffect(() => {
    if (accountLogoProp !== undefined) return;
    const accountId = lead.Accounts_id || lead.account_id || lead.accounts_id;
    if (!accountId) { setLogoFetched(null); return; }
    let cancelled = false;
    apiFetch(`/api/accounts/${accountId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: any) => { if (!cancelled) setLogoFetched(data?.logo_url || null); })
      .catch(() => { if (!cancelled) setLogoFetched(null); });
    return () => { cancelled = true; };
  }, [accountLogoProp, lead.Accounts_id, lead.account_id, lead.accounts_id]);
  const accountLogo = accountLogoProp !== undefined ? accountLogoProp : logoFetched;

  const [stickerFetched, setStickerFetched] = useState<string | null>(null);
  useEffect(() => {
    if (campaignStickerUrlProp !== undefined) return;
    const cId = lead.Campaigns_id || lead.campaigns_id || lead.campaignsId;
    if (!cId) { setStickerFetched(null); return; }
    let cancelled = false;
    apiFetch(`/api/campaigns/${cId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: any) => {
        if (cancelled) return;
        const slug = data?.campaign_sticker || data?.campaignSticker;
        const sticker = slug ? CAMPAIGN_STICKERS.find(s => s.slug === slug) : undefined;
        setStickerFetched(sticker?.url || null);
      })
      .catch(() => { if (!cancelled) setStickerFetched(null); });
    return () => { cancelled = true; };
  }, [campaignStickerUrlProp, lead.Campaigns_id, lead.campaigns_id, lead.campaignsId]);
  const campaignStickerUrl = campaignStickerUrlProp !== undefined ? campaignStickerUrlProp : stickerFetched;

  // ── Campaign list filtered by lead's account (agency view only) ─────────
  const { isAgencyView } = useWorkspace();
  const leadAccountId = Number(lead.Accounts_id || lead.account_id || lead.accounts_id || 0);
  const accountCampaigns = useMemo(() => {
    if (!campaignsById || !leadAccountId) return [];
    return Array.from(campaignsById.entries())
      .filter(([, info]) => info.accountId === leadAccountId)
      .map(([id, info]) => ({ id, name: info.name }));
  }, [campaignsById, leadAccountId]);

  // ── Notes state ───────────────────────────────────────────────────────────
  const { toast: toastContact } = useToast();
  const currentNotes = lead.notes || lead.Notes || "";
  const [localNotes, setLocalNotes] = useState(currentNotes);
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const notesOriginalRef = useRef("");
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const notesMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const notesChunksRef = useRef<Blob[]>([]);
  const notesTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const n = lead.notes || lead.Notes || "";
    setLocalNotes(n);
    notesOriginalRef.current = n;
    setNotesDirty(false);
    setNotesSaved(false);
  }, [lead.id, lead.Id, lead.notes]);

  useEffect(() => {
    return () => {
      if (notesTimerRef.current) clearInterval(notesTimerRef.current);
      if (notesMediaRecorderRef.current) { try { notesMediaRecorderRef.current.stop(); } catch {} }
    };
  }, []);

  const handleNotesSave = useCallback(async () => {
    if (!leadId || !notesDirty || savingNotes) return;
    setSavingNotes(true);
    setNotesSaved(false);
    try {
      await updateLead(leadId, { notes: localNotes });
      notesOriginalRef.current = localNotes;
      setNotesDirty(false);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
      onRefresh?.();
    } catch { /* noop */ } finally {
      setSavingNotes(false);
    }
  }, [leadId, localNotes, notesDirty, savingNotes, onRefresh]);

  const startNotesVoice = useCallback(async () => {
    if (!leadId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm",
      });
      notesChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) notesChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(notesChunksRef.current, { type: mr.mimeType });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          setTranscribing(true);
          try {
            const httpRes = await apiFetch(`/api/leads/${leadId}/transcribe-voice`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audio_data: dataUrl, mime_type: mr.mimeType }),
            });
            const res = await httpRes.json() as any;
            if (!httpRes.ok || res.error) {
              const desc = res.error === "NO_GROQ_API_KEY" ? "Groq API key not configured." : res.detail || res.error || "Could not transcribe.";
              toastContact({ title: "Transcription failed", description: String(desc).slice(0, 200), variant: "destructive" });
              return;
            }
            if (res.transcription) {
              setLocalNotes((prev: string) => {
                const sep = prev.trim() ? "\n\n" : "";
                const next = prev + sep + res.transcription;
                setNotesDirty(next !== notesOriginalRef.current);
                return next;
              });
            }
          } catch {
            toastContact({ title: "Transcription failed", description: "Network error.", variant: "destructive" });
          } finally {
            setTranscribing(false);
          }
        };
        reader.readAsDataURL(blob);
      };
      mr.start(250);
      notesMediaRecorderRef.current = mr;
      setIsRecordingVoice(true);
      setRecordingSeconds(0);
      notesTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      toastContact({ title: "Microphone access denied", description: "Allow microphone access to record.", variant: "destructive" });
    }
  }, [leadId, toastContact]);

  const stopNotesVoice = useCallback(() => {
    if (notesTimerRef.current) { clearInterval(notesTimerRef.current); notesTimerRef.current = null; }
    notesMediaRecorderRef.current?.stop();
    notesMediaRecorderRef.current = null;
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  }, []);

  const status = getStatus(lead);
  const statusColors = STATUS_COLORS[status] ?? { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-zinc-400", badge: "bg-zinc-100 text-zinc-600 border-zinc-200" };

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
        {/* Company (read-only, show if present) */}
        {company && (
          <div className="py-2.5 border-b border-border/20 last:border-0 last:pb-0">
            <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block leading-none mb-1">
              {t("contact.company")}
            </span>
            <span className="text-[12px] font-semibold text-foreground leading-snug">{company}</span>
          </div>
        )}
        {/* Tags as pill badges */}
        {tags && tags.length > 0 && (
          <div className="py-2.5 border-b border-border/20 last:border-0 last:pb-0" data-testid="info-tab-tags">
            <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block leading-none mb-1">
              {t("detail.sections.tags", "Tags")}
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {tags.map((tag) => {
                const hex = resolveColor(tag.color);
                return (
                  <span
                    key={tag.name}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                    style={{ backgroundColor: `${hex}22`, color: hex, borderColor: `${hex}44` }}
                  >
                    {tag.name}
                  </span>
                );
              })}
            </div>
          </div>
        )}
        {/* Last activity removed — now a header metachip */}
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
        {/* Meta chips — stacked vertically under Created */}
        {(lead.source || lead.Source) && (
          <div className="py-2.5 border-b border-border/20 last:border-0 last:pb-0">
            <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block leading-none mb-1">{t("detailView.source")}</span>
            <span className="text-[12px] font-semibold text-foreground leading-snug">{lead.source || lead.Source}</span>
          </div>
        )}
        {/* Campaign assignment dropdown (agency view only) */}
        {isAgencyView && (
          <div className="py-2.5 border-b border-border/20 last:border-0 last:pb-0">
            <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block leading-none mb-1">
              {t("detail.fields.campaign")}
            </span>
            <select
              value={String(lead.Campaigns_id ?? lead.campaigns_id ?? lead.campaignsId ?? "")}
              onChange={async (e) => {
                const val = e.target.value;
                try {
                  await updateLead(leadId, { campaignsId: val ? Number(val) : (null as any) });
                  onRefresh?.();
                } catch { /* noop */ }
              }}
              className="text-[12px] bg-transparent border border-dashed border-border/60 rounded px-1.5 py-0.5 max-w-[160px] focus:outline-none focus:ring-1 focus:ring-brand-indigo/50 text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
            >
              <option value="">—</option>
              {accountCampaigns.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
        )}
      </div>

      {/* ── Team section (inline) ─────────────────────────────────────────── */}
      <div className="mt-4 pt-4 border-t border-border/20">
        <TeamWidget lead={lead} onRefresh={onRefresh} inline />
      </div>

      {/* ── Notes section ──────────────────────────────────────────────────── */}
      <div className="mt-4 pt-4 border-t border-border/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 flex items-center gap-1.5">
            <StickyNote className="h-3 w-3" />
            {t("detail.sections.notes")}
          </span>
          <div className="flex items-center gap-1.5">
            {transcribing ? (
              <div className="flex items-center gap-1 text-[10px] text-brand-indigo">
                <Loader2 className="h-3 w-3 animate-spin" />
              </div>
            ) : isRecordingVoice ? (
              <button
                onClick={stopNotesVoice}
                className="flex items-center gap-1 h-6 px-2 rounded-full bg-red-500/15 text-red-600 text-[11px] font-medium border border-red-300/60 hover:bg-red-500/25 transition-colors"
              >
                <Square className="h-2.5 w-2.5 fill-current" />
                {recordingSeconds}s
              </button>
            ) : (
              <button
                onClick={startNotesVoice}
                disabled={savingNotes || transcribing}
                className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-black/[0.125] text-muted-foreground hover:text-foreground hover:border-black/[0.175] transition-colors disabled:opacity-50"
                title="Record voice memo"
              >
                <Mic className="h-3.5 w-3.5" />
              </button>
            )}
            {notesDirty && !savingNotes && (
              <button
                onClick={handleNotesSave}
                className="inline-flex items-center gap-1 h-6 px-2 rounded-full border border-brand-indigo/30 text-brand-indigo text-[11px] font-medium hover:bg-brand-indigo/10 transition-colors"
              >
                <Save className="h-2.5 w-2.5" />
                {t("notes.save", "Save")}
              </button>
            )}
            {notesSaved && !savingNotes && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
            {savingNotes && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
        </div>
        <textarea
          value={localNotes}
          onChange={(e) => {
            setLocalNotes(e.target.value);
            setNotesDirty(e.target.value !== notesOriginalRef.current);
            setNotesSaved(false);
          }}
          onBlur={handleNotesSave}
          placeholder={t("notes.placeholder", "Add notes…")}
          rows={5}
          disabled={savingNotes || transcribing}
          className="w-full text-[12px] bg-transparent border-none px-0 py-0 resize-none focus:outline-none disabled:opacity-60 placeholder:text-foreground/25"
        />
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

  // ── Funnel column ─────────────────────────────────────────────────────────
  if (bookingConfirmed || status === "Booked") {
    out.push({ direction: "up", label: _t("score.insights.callBooked", "Call successfully booked"), column: "funnel" });
  } else if (status === "Qualified") {
    out.push({ direction: "up", label: _t("score.insights.leadQualified", "Lead is qualified"), column: "funnel" });
  } else if (status === "Multiple Responses") {
    out.push({ direction: "up", label: _t("score.insights.multipleResponses", "Multiple responses received"), column: "funnel" });
  } else if (status === "Responded") {
    out.push({ direction: "up", label: _t("score.insights.leadResponded", "Lead has responded"), column: "funnel" });
  }
  if (optedOut) {
    out.push({ direction: "down", label: _t("score.insights.leadOptedOut", "Lead opted out"), column: "funnel" });
  } else if (status === "DND") {
    out.push({ direction: "down", label: _t("score.insights.dndStatus", "Do-not-disturb status"), column: "funnel" });
  } else if (status === "Lost") {
    out.push({ direction: "down", label: _t("score.insights.leadLost", "Lead marked as lost"), column: "funnel" });
  }

  // ── Engagement column ─────────────────────────────────────────────────────
  if (sentimentRaw === "positive") {
    out.push({ direction: "up", label: _t("score.insights.positiveSentiment", "Positive sentiment detected"), column: "engagement" });
  } else if (sentimentRaw === "negative") {
    out.push({ direction: "down", label: _t("score.insights.negativeSentiment", "Negative sentiment detected"), column: "engagement" });
  } else if (sentimentRaw === "neutral") {
    out.push({ direction: "down", label: _t("score.insights.neutralSentiment", "Neutral sentiment detected"), column: "engagement" });
  }
  if (lastReceivedDays !== null) {
    if (lastReceivedDays < 1) {
      out.push({ direction: "up", label: _t("score.insights.repliedLast24h", "Replied in last 24h"), column: "engagement" });
    } else if (lastReceivedDays < 2) {
      out.push({ direction: "up", label: _t("score.insights.repliedWithin48h", "Replied within 48h"), column: "engagement" });
    } else if (lastReceivedDays < 7) {
      out.push({ direction: "up", label: _t("score.insights.repliedThisWeek", "Replied this week"), column: "engagement" });
    } else if (lastReceivedDays > 30) {
      out.push({ direction: "down", label: _t("score.insights.noReply30Days", "No reply in 30+ days"), column: "engagement" });
    } else if (lastReceivedDays > 14) {
      out.push({ direction: "down", label: _t("score.insights.quiet2Weeks", "Quiet for 2+ weeks"), column: "engagement" });
    }
  }

  // ── Activity column ───────────────────────────────────────────────────────
  if (received === 0 && sent > 0) {
    out.push({ direction: "down", label: _t("score.insights.noReplyYet", "Lead hasn't replied yet"), column: "activity" });
  } else if (received >= 4) {
    out.push({ direction: "up", label: _t("score.insights.highActivity", "High message activity"), column: "activity" });
  } else if (received >= 2) {
    out.push({ direction: "up", label: _t("score.insights.repliedMultiple", "Replied multiple times"), column: "activity" });
  }
  if (received > 0 && sent > 0 && received / sent >= 1.0) {
    out.push({ direction: "up", label: _t("score.insights.repliesMoreThanPinged", "Replies more than pinged"), column: "activity" });
  }
  if (bumps >= 3) {
    out.push({ direction: "down", label: _t("score.insights.manyFollowUps", "Many follow-ups sent"), column: "activity" });
  }

  return out.slice(0, 4);
}

// ── Score insight tag component ───────────────────────────────────────────────
function ScoreInsightTag({ insight, compact }: { insight: ScoreInsight; compact?: boolean }) {
  const isUp = insight.direction === "up";
  const iconSize = compact ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <div className={cn("flex items-center", compact ? "gap-2" : "gap-2.5 min-h-[38px]")}>
      {isUp
        ? <TrendingUp className={cn(iconSize, "text-blue-500 shrink-0")} />
        : <TrendingDown className={cn(iconSize, "text-gray-400 shrink-0")} />
      }
      <span className={cn("leading-snug text-foreground/80", compact ? "text-[12px]" : "text-[14px]")}>
        {insight.label}
      </span>
    </div>
  );
}

// ── Score history area chart ───────────────────────────────────────────────────
function ScoreHistoryChart({ data, tierColor, score, leadId }: {
  data: ScoreHistoryPoint[]; tierColor: string; score: number; leadId: number | null;
}) {
  const gradId = `sg-${leadId ?? "x"}`;

  const now = new Date();

  // Sort chronologically, keep all data points (timestamps, not just dates)
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

  // If fewer than 2 data points, synthesize a flat line at the current score
  if (sorted.length < 2) {
    const todayLabel = now.toLocaleDateString(undefined, { weekday: "short" });
    const yesterdayLabel = new Date(now.getTime() - 86_400_000).toLocaleDateString(undefined, { weekday: "short" });
    const chartData = [
      { label: yesterdayLabel, score: 0 },
      { label: todayLabel, score },
    ];
    return (
      <div className="w-full h-[130px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 14, right: 36, bottom: 0, left: -4 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={tierColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={tierColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "rgba(0,0,0,0.35)" }} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "rgba(0,0,0,0.3)" }} tickLine={false} axisLine={false} width={32} tickCount={4} />
            <Area
              type="monotone" dataKey="score" stroke={tierColor} strokeWidth={2}
              fill={`url(#${gradId})`} strokeDasharray="4 4"
              dot={(dotProps: any) => {
                const isLast = dotProps.index === chartData.length - 1;
                return (
                  <g key={dotProps.index}>
                    <circle cx={dotProps.cx} cy={dotProps.cy} r={isLast ? 4 : 2} fill={tierColor} stroke={isLast ? "white" : "none"} strokeWidth={isLast ? 2 : 0} opacity={isLast ? 1 : 0.4} />
                  </g>
                );
              }}
              isAnimationActive={true} animationBegin={100} animationDuration={600} animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Deduplicate consecutive same-score points ──
  // Keep: first occurrence of a new score, last occurrence before score changes, and always the last point.
  const deduped: typeof sorted = [];
  for (let i = 0; i < sorted.length; i++) {
    const prev = i > 0 ? sorted[i - 1].score : -1;
    const next = i < sorted.length - 1 ? sorted[i + 1].score : -1;
    const cur = sorted[i].score;
    const isFirst = cur !== prev;            // score just changed
    const isLast = cur !== next;             // score about to change
    const isVeryLast = i === sorted.length - 1;
    if (isFirst || isLast || isVeryLast) {
      deduped.push(sorted[i]);
    }
  }

  // ── Prepend a zero-origin point (1 minute before first real data point) ──
  const firstTs = new Date(deduped[0].date);
  const zeroDate = new Date(firstTs.getTime() - 60_000).toISOString();
  const withZero = [{ date: zeroDate, score: 0 }, ...deduped];

  const chartData = withZero.map((d, i) => {
    const ts = new Date(d.date);
    const diffMs = now.getTime() - ts.getTime();
    const diffDays = diffMs / 86_400_000;
    let label: string;
    if (diffDays < 1) {
      label = ts.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays <= 7) {
      label = ts.toLocaleDateString(undefined, { weekday: "short" });
    } else {
      label = ts.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
    // Mark whether this is the first point of a plateau (show label) vs a repeat (just dot)
    const prevScore = i > 0 ? withZero[i - 1].score : -1;
    const isNewScore = d.score !== prevScore;
    return { label, score: d.score, isNewScore };
  });

  return (
    <div className="w-full h-[140px] shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 20, right: 36, bottom: 0, left: -4 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tierColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={tierColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: "rgba(0,0,0,0.35)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: "rgba(0,0,0,0.3)" }}
            tickLine={false}
            axisLine={false}
            width={32}
            tickCount={4}
          />
          <RechTooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid rgba(0,0,0,0.08)",
              backgroundColor: "rgba(255,255,255,0.96)",
              fontSize: "11px",
              padding: "4px 8px",
              color: "#111",
            }}
            formatter={(v: number) => [`${v}/100`, "Score"]}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke={tierColor}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={(dotProps: any) => {
              const val = dotProps.payload.score;
              const { isNewScore } = dotProps.payload;
              const isLast = dotProps.index === chartData.length - 1;
              const isZero = dotProps.index === 0;
              // Zero-origin: small faded dot, no label
              if (isZero) {
                return (
                  <g key={dotProps.index}>
                    <circle cx={dotProps.cx} cy={dotProps.cy} r={2} fill={tierColor} opacity={0.4} />
                  </g>
                );
              }
              // Last point: just a prominent dot, no label (the big hero number above shows it)
              if (isLast) {
                return (
                  <g key={dotProps.index}>
                    <circle cx={dotProps.cx} cy={dotProps.cy} r={4} fill={tierColor} stroke="white" strokeWidth={2} />
                  </g>
                );
              }
              // Repeat of same score (plateau anchor): just a small dot, no label
              if (!isNewScore) {
                return (
                  <g key={dotProps.index}>
                    <circle cx={dotProps.cx} cy={dotProps.cy} r={2} fill={tierColor} opacity={0.5} />
                  </g>
                );
              }
              // First occurrence of a new score: dot + label
              const prevScore = dotProps.index > 0 ? chartData[dotProps.index - 1].score : 0;
              const wentUp = val >= prevScore;
              // For scores near 100, always label below to avoid cropping
              const labelY = val >= 90 ? dotProps.cy + 14 : (wentUp ? dotProps.cy - 10 : dotProps.cy + 14);
              return (
                <g key={dotProps.index}>
                  <circle cx={dotProps.cx} cy={dotProps.cy} r={2.5} fill={tierColor} />
                  <text
                    x={dotProps.cx}
                    y={labelY}
                    textAnchor="middle"
                    dominantBaseline="auto"
                    fill={tierColor}
                    style={{ fontSize: 10, fontWeight: 700 }}
                  >
                    {val}
                  </text>
                </g>
              );
            }}
            activeDot={{ r: 4, fill: tierColor, stroke: "white", strokeWidth: 2 }}
            isAnimationActive={true}
            animationBegin={100}
            animationDuration={600}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Dimension colors ──────────────────────────────────────────────────────────
const DIMENSION_COLORS: Record<string, string> = {
  Engagement: "#3B82F6", // blue
  Activity:   "#10B981", // green
  Funnel:     "#F59E0B", // amber
};
const DIMENSION_TOOLTIPS: Record<string, string> = {
  Engagement: "Measures how responsive and engaged the lead is: reply recency, sentiment, and interaction quality.",
  Activity:   "Tracks message volume and reply rates. Shows how actively the lead participates in the conversation.",
  Funnel:     "Reflects conversion progress: qualified status, booked calls, and pipeline stage advancement.",
};

// ── Card-view score context helpers ────────────────────────────────────────────
function cardEngagementContext(lead?: Record<string, any>): string {
  if (!lead) return "";
  const parts: string[] = [];
  const lastReceived = lead.lastMessageReceivedAt ?? lead.last_message_received_at;
  if (lastReceived) {
    const hours = (Date.now() - new Date(lastReceived).getTime()) / 3600000;
    if (hours < 1) parts.push("Replied just now");
    else if (hours < 24) parts.push(`Replied ${Math.round(hours)}h ago`);
    else {
      const days = Math.floor(hours / 24);
      parts.push(days === 1 ? "Replied yesterday" : `Replied ${days}d ago`);
      if (days >= 7) parts.push("Decaying");
    }
  } else {
    parts.push("No replies yet");
  }
  const sentiment = (lead.aiSentiment ?? lead.ai_sentiment ?? "").toString().toLowerCase();
  if (sentiment === "positive") parts.push("Positive");
  else if (sentiment === "negative") parts.push("Negative");

  const intentRaw = (lead.aiIntentSignals ?? lead.ai_intent_signals ?? "").toString();
  if (intentRaw) {
    const intents = intentRaw.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    const labels: Record<string, string> = {
      asked_pricing: "Asked pricing", mentioned_timeline: "Has timeline",
      requested_callback: "Wants callback", not_interested: "Not interested",
    };
    for (const intent of intents) {
      if (labels[intent]) { parts.push(labels[intent]); break; }
    }
  }
  const bumpStage = Number(lead.currentBumpStage ?? lead.current_bump_stage ?? 0);
  if (bumpStage >= 2) parts.push(`Bumped ${bumpStage}x`);
  return parts.join(" · ");
}

function cardActivityContext(lead?: Record<string, any>): string {
  if (!lead) return "";
  const received = Number(lead.messageCountReceived ?? lead.message_count_received ?? 0);
  const sent = Number(lead.messageCountSent ?? lead.message_count_sent ?? 0);
  const parts: string[] = [];
  parts.push(`${received} ${received === 1 ? "reply" : "replies"}`);
  if (sent > 0 && received > 0) {
    parts.push(`${Math.round((received / sent) * 100)}% rate`);
  }
  return parts.join(" · ");
}

const CARD_FUNNEL_HINTS: Record<string, string> = {
  New: "Waiting to contact",
  Queued: "Queued for outreach",
  Contacted: "Awaiting first reply",
  Responded: "Engage to qualify",
  "Multiple Responses": "Ready to qualify",
  Qualified: "Schedule a call",
  Booked: "Call scheduled",
  Closed: "Deal closed",
  DND: "Do not contact",
  Lost: "Lead lost",
};

function cardFunnelContext(lead?: Record<string, any>): string {
  if (!lead) return "";
  const status = lead.conversionStatus ?? lead.conversion_status ?? lead.Conversion_Status ?? "";
  return CARD_FUNNEL_HINTS[status] || status || "Not set";
}

// ── Compact sub-score bar (matches ContactSidebar pattern) ────────────────────
function ScoreBar({ label, value, max, color, context }: { label: string; value: number; max: number; color: string; context?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-foreground/80">{label}</span>
        <span className="text-[12px] font-bold tabular-nums text-foreground/70">
          {Math.round(value)}<span className="text-foreground/30">/{max}</span>
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {context && (
        <span className="text-[12px] text-muted-foreground leading-snug">{context}</span>
      )}
    </div>
  );
}

// ── Score column widget (horizontal bar + tooltip on hover) ───────────────────
function ScoreColumnWidget({ label, value, maxPts, insights, isBooked }: {
  label: string; value: number; maxPts: number;
  insights: ScoreInsight[]; isBooked?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, Math.round((value / maxPts) * 100)));
  const [displayPct, setDisplayPct] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setDisplayPct(pct), 20);
    return () => clearTimeout(id);
  }, [pct]);
  const barColor = DIMENSION_COLORS[label] ?? "#6366f1";
  const tooltipText = DIMENSION_TOOLTIPS[label];
  return (
    <div className="flex flex-col gap-1 w-full group/bar">
      {/* Label + percentage */}
      <div className="flex items-baseline justify-between">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground cursor-help border-b border-dotted border-muted-foreground/30">
              {label}
            </span>
          </TooltipTrigger>
          {tooltipText && (
            <TooltipContent side="top" className="max-w-[220px] text-[11px] leading-snug">
              {tooltipText}
            </TooltipContent>
          )}
        </Tooltip>
        <span className="text-[13px] font-semibold tabular-nums text-foreground/70">
          {Math.round(value)}<span className="text-foreground/30 text-[10px]">/{maxPts}</span>
          <span className="text-foreground/30 text-[10px] ml-1">({pct}%)</span>
        </span>
      </div>
      {/* Horizontal bar */}
      <div className="relative w-full h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className="absolute top-0 left-0 bottom-0 rounded-full transition-[width] duration-[450ms] ease-out"
          style={{ width: `${displayPct}%`, backgroundColor: barColor, boxShadow: `2px 0 8px ${barColor}50` }}
        />
        {isBooked && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] select-none">👑</div>
        )}
      </div>
      {/* Insights below */}
      {insights.length > 0 && (
        <div className="flex flex-wrap items-start gap-1 mt-0.5">
          {insights.map((ins, i) => <ScoreInsightTag key={i} insight={ins} compact />)}
        </div>
      )}
    </div>
  );
}

// ── Score widget with AI summary ──────────────────────────────────────────────
function ScoreWidget({ score, lead, status }: { score: number; lead?: Record<string, any>; status?: string }) {
  const { t } = useTranslation("leads");
  const leadId = lead?.Id || lead?.id;
  const { breakdown } = useScoreBreakdown(leadId ? Number(leadId) : null);
  const { history } = useScoreHistory(leadId ? Number(leadId) : null);
  const aiSummary = lead?.ai_summary || lead?.aiSummary || "";
  const memoryStr = lead?.ai_memory || lead?.aiMemory || "";
  let parsedSummary = "";
  if (!aiSummary && memoryStr) {
    try {
      const obj = typeof memoryStr === "string" ? JSON.parse(memoryStr) : memoryStr;
      parsedSummary = obj?.summary || obj?.notes || obj?.description || "";
    } catch { parsedSummary = ""; }
  }
  const summaryText = aiSummary || parsedSummary;
  const insights = lead ? buildScoreInsights(lead, t) : [];
  const tierColor = TIER_BAR_COLOR[breakdown?.tier ?? "Sleeping"];
  // Sub-scores are already pre-scaled: eng (max 30) + act (max 20) + funnel (max 50) = lead_score
  const engPts    = breakdown?.engagement_score ?? 0;
  const actPts    = breakdown?.activity_score ?? 0;
  const funnelPts = breakdown?.funnel_weight ?? 0;
  const isBooked  = status === "Booked";

  return (
    <div className="bg-white/50 dark:bg-white/[0.10] rounded-xl p-[21px] flex flex-col gap-3 h-full overflow-y-auto">
      {/* Header — title + time */}
      <div className="flex items-center justify-between shrink-0">
        <p className="text-[18px] font-semibold font-heading text-foreground">{t("score.title")}</p>
        {breakdown?.last_updated && (
          <span className="text-[10px] text-muted-foreground/50">
            {relativeTime(breakdown.last_updated)}
          </span>
        )}
      </div>

      {/* Score hero: big number right-aligned, tier badge to its left — hidden when score=0 */}
      {score > 0 && (
        <div className="flex items-center justify-end gap-2.5 shrink-0 pt-10 -mb-8 pr-1">
          {breakdown && (
            <span
              className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap", TIER_COLORS[breakdown.tier] ?? TIER_COLORS.Sleeping)}
              style={(breakdown.tier === "Hot" || breakdown.tier === "Awake") ? {
                boxShadow: `0 0 8px 2px ${breakdown.tier === "Hot" ? "rgba(239,68,68,0.4)" : "rgba(16,185,129,0.4)"}`,
              } : undefined}
            >
              {breakdown.tier}
            </span>
          )}
          <span className="text-5xl font-black tabular-nums leading-none">
            {score}
          </span>
        </div>
      )}

      {/* Score history chart + horizontal bars — hidden when score=0 */}
      {score > 0 && (
        <ScoreHistoryChart
          data={history}
          tierColor={tierColor}
          score={score}
          leadId={leadId ? Number(leadId) : null}
        />
      )}
      {breakdown && score > 0 && (
        <div className="flex flex-col gap-2.5 shrink-0 pt-2" style={{ marginLeft: 28, marginRight: 36 }}>
          <ScoreBar label="Engagement" value={engPts} max={30} color="#3B82F6" context={cardEngagementContext(lead)} />
          <ScoreBar label="Activity" value={actPts} max={20} color="#10B981" context={cardActivityContext(lead)} />
          <ScoreBar label="Funnel" value={funnelPts} max={50} color="#F59E0B" context={cardFunnelContext(lead)} />
        </div>
      )}

      {/* Score=0 empty state */}
      {score === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center">
          <span className="text-3xl">😴</span>
          <p className="text-[13px] font-medium text-muted-foreground/60">{t("score.noActivity", "No activity yet")}</p>
          <p className="text-[11px] text-muted-foreground/40">{t("score.noActivityHint", "Score will update as interactions happen")}</p>
        </div>
      )}

      {/* AI Summary — only shown for Booked status */}
      {status === "Booked" && summaryText ? (
        <div className="border-t border-border/20 pt-3 mt-1 flex-1 min-h-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Bot className="h-3 w-3 text-brand-indigo/60" />
            <p className="text-[10px] font-medium uppercase tracking-wider text-foreground/40">{t("detail.aiSummary")}</p>
          </div>
          <p className="text-[12px] text-foreground/75 leading-relaxed whitespace-pre-wrap">{summaryText}</p>
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
const AI_TRIGGERED_BY = new Set([
  "automation", "ai_conversation", "campaign_launcher",
  "bump_scheduler", "manual_bump_trigger",
  "inbound_handler", "booking_webhook", "booking_confirmation",
]);
function isAiMsg(item: Interaction): boolean {
  if ((item.ai_generated ?? item.aiGenerated) === true) return true;
  if ((item.is_bump ?? item.isBump) === true) return true;
  const triggeredBy = (item.triggered_by ?? item.triggeredBy ?? "").toLowerCase();
  if (AI_TRIGGERED_BY.has(triggeredBy)) return true;
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

// ── Mini voice memo player ──────────────────────────────────────────────────
const MINI_VM_BARS = 40;
function MiniVoiceMemoPlayer({ url, color = "#0ABFA3" }: { url: string; color?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const rafRef = useRef<number | null>(null);

  const startRaf = useCallback(() => {
    const tick = () => {
      const a = audioRef.current;
      if (!a) return;
      setCurrentTime(a.currentTime);
      if (!a.paused && !a.ended) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);
  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);
  useEffect(() => () => stopRaf(), [stopRaf]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onMeta = () => setDuration(isFinite(a.duration) ? a.duration : 0);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    if (isFinite(a.duration) && a.duration > 0) setDuration(a.duration);
    return () => { a.removeEventListener("loadedmetadata", onMeta); a.removeEventListener("durationchange", onMeta); };
  }, [url]);

  const [bars, setBars] = useState<number[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        if (cancelled) return;
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        ctx.close();
        if (cancelled) return;
        const channelData: Float32Array[] = [];
        for (let c = 0; c < decoded.numberOfChannels; c++) channelData.push(decoded.getChannelData(c));
        const samplesPerBar = Math.floor(decoded.length / MINI_VM_BARS);
        const heights = Array.from({ length: MINI_VM_BARS }, (_, i) => {
          const start = i * samplesPerBar;
          const end = Math.min(start + samplesPerBar, decoded.length);
          let sum = 0, count = 0;
          for (let s = start; s < end; s++) {
            let val = 0;
            for (const ch of channelData) val += ch[s];
            val /= channelData.length;
            sum += val * val; count++;
          }
          return count > 0 ? Math.sqrt(sum / count) : 0;
        });
        const maxRms = Math.max(...heights, 0.001);
        if (!cancelled) setBars(heights.map(v => Math.round(2 + (v / maxRms) * 16)));
      } catch {
        if (!cancelled) {
          const seed = url.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
          setBars(Array.from({ length: MINI_VM_BARS }, (_, i) => Math.round(2 + Math.abs(Math.sin((seed + i * 137.5) * 0.1)) * 16)));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  const fmt = (s: number) => (!isFinite(s) || isNaN(s) || s <= 0) ? "0:00" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); stopRaf(); }
    else { a.play().then(() => { setPlaying(true); startRaf(); }).catch(() => {}); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a) return;
    const dur = isFinite(a.duration) && a.duration > 0 ? a.duration : duration;
    if (!dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * dur;
    setCurrentTime(a.currentTime);
  };

  const liveTime = audioRef.current?.currentTime ?? currentTime;
  const liveDur = (audioRef.current && isFinite(audioRef.current.duration) && audioRef.current.duration > 0) ? audioRef.current.duration : duration;
  const playedCount = Math.round((liveDur > 0 ? liveTime / liveDur : 0) * MINI_VM_BARS);

  return (
    <div className="flex items-center gap-2" style={{ minWidth: 180, maxWidth: 240 }}>
      <audio ref={audioRef} src={url} preload="auto"
        onLoadedMetadata={() => { const a = audioRef.current; if (a && isFinite(a.duration)) setDuration(a.duration); }}
        onEnded={() => { setPlaying(false); stopRaf(); setCurrentTime(0); }}
      />
      <button type="button" onClick={toggle}
        className="h-8 w-8 rounded-full text-white flex items-center justify-center shrink-0 shadow-sm"
        style={{ backgroundColor: color }} aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="h-3.5 w-3.5 fill-white stroke-none" /> : <Play className="h-3.5 w-3.5 fill-white stroke-none ml-0.5" />}
      </button>
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <div className="flex items-center gap-[1px] cursor-pointer" style={{ height: 20 }} onClick={seek}>
          {bars === null
            ? Array.from({ length: MINI_VM_BARS }, (_, i) => <div key={i} className="shrink-0 animate-pulse" style={{ width: 2, height: 3, borderRadius: 1, backgroundColor: "rgba(160,160,160,0.25)" }} />)
            : bars.map((h, i) => <div key={i} className="shrink-0" style={{ width: 2, height: h, borderRadius: 1, backgroundColor: i < playedCount ? color : "rgba(160,160,160,0.35)", transition: "background-color 60ms linear" }} />)
          }
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] opacity-60 tabular-nums">{fmt(liveTime)}</span>
          <span className="text-[10px] opacity-60 tabular-nums">{fmt(liveDur)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Tag / status event chips (inline chat timeline) ──────────────────────────

const MINI_TAG_HEX: Record<string, string> = {
  yellow: "#EAB308", blue: "#3B82F6", green: "#22C55E", red: "#EF4444",
  purple: "#A855F7", orange: "#F97316", pink: "#EC4899", gray: "#6B7280",
};
const MINI_CONVERSION_STATUS_TAGS = new Set([
  "Booked", "Responded", "Multiple Responses", "Qualified", "Opted Out", "DNC",
]);
const MINI_STAGE_ICON: Record<string, React.ElementType> = {
  New: CircleDot, Contacted: Send, Responded: MessageSquare,
  "Multiple Responses": Users, Qualified: Star, Booked: Calendar,
  Closed: Check, Lost: AlertTriangle, DND: Ban,
};

function MiniTagEventChip({ tagName, tagColor, time, eventType }: { tagName: string; tagColor: string; time: string; eventType?: "added" | "removed" }) {
  const isRemoved = eventType === "removed";
  const iconColor = MINI_TAG_HEX[tagColor] ?? "#6B7280";
  return (
    <div className="flex justify-center py-3">
      <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium rounded-full px-3 py-1 select-none bg-white dark:bg-card text-foreground", isRemoved && "opacity-50")}>
        {isRemoved
          ? <X className="w-3 h-3" style={{ color: iconColor }} />
          : <TagIcon className="w-3 h-3" style={{ color: iconColor }} />
        }
        <span className={cn(isRemoved && "line-through")}>{tagName}</span>
        <span className="opacity-60">&middot;</span>
        <span className="opacity-60">{time}</span>
      </span>
    </div>
  );
}

function MiniStatusEventChip({ statusName, time }: { statusName: string; time: string }) {
  const StatusIcon = MINI_STAGE_ICON[statusName] ?? CircleDot;
  const hex = PIPELINE_HEX_UTIL[statusName] ?? "#6B7280";
  return (
    <div className="flex justify-center py-3">
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium rounded-full px-3 py-1 select-none bg-white dark:bg-card text-foreground">
        <StatusIcon className="w-3.5 h-3.5" style={{ color: hex }} />
        {statusName}
        <span className="opacity-50">&middot;</span>
        <span className="opacity-50">{time}</span>
      </span>
    </div>
  );
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
          "max-w-[80%] px-2.5 pt-1.5 pb-1 text-[13px] relative",
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
        {((item as any).type === "voice_note" || (item as any).Type === "voice_note") ? (() => {
          const content = item.content || (item as any).Content || "";
          const VOICE_PREFIX = "[Voice Note]: ";
          const transcription = content.startsWith(VOICE_PREFIX) ? content.slice(VOICE_PREFIX.length).trim() : content.trim();
          const attachRaw = item.attachment ?? (item as any).Attachment;
          const audioUrl = typeof attachRaw === "string" && attachRaw.startsWith("data:audio/") ? attachRaw : null;
          return (
            <div className="flex flex-col gap-1.5">
              {audioUrl
                ? <MiniVoiceMemoPlayer url={audioUrl} />
                : <div className="flex items-center gap-1.5 opacity-70"><Mic className="h-3.5 w-3.5 shrink-0" /><span className="text-[11px] font-medium uppercase tracking-wide">Voice note</span></div>
              }
              {transcription && <div className="whitespace-pre-wrap leading-relaxed break-words text-[12px] italic opacity-80">{transcription}</div>}
            </div>
          );
        })() : (
          <div className="whitespace-pre-wrap leading-relaxed break-words">{item.content || (item as any).Content || ""}</div>
        )}
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
function ConversationWidget({ lead, showHeader = false, readOnly = false }: { lead: Record<string, any>; showHeader?: boolean; readOnly?: boolean }) {
  const { t } = useTranslation("leads");
  const leadId = getLeadId(lead);
  const { interactions, loading, refresh } = useInteractions(undefined, leadId);
  const { isAgencyView } = useWorkspace();
  const [, setLocation] = useLocation();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showBypassConfirm, setShowBypassConfirm] = useState(false);
  const [showAiResumeConfirm, setShowAiResumeConfirm] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [tagEvents, setTagEvents] = useState<any[]>([]);
  useEffect(() => {
    if (!leadId) { setTagEvents([]); return; }
    let cancelled = false;
    apiFetch(`/api/leads/${leadId}/tag-events`)
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => { if (!cancelled) setTagEvents(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setTagEvents([]); });
    return () => { cancelled = true; };
  }, [leadId]);
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
      | { kind: "thread"; group: MiniThreadGroup; total: number; key: string }
      | { kind: "tag-event"; tagName: string; tagColor: string; time: string; key: string; eventType?: "added" | "removed" }
      | { kind: "status-event"; statusName: string; time: string; key: string };

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

    // Merge tag events into timeline (only when showTags is enabled)
    // Skip tags that predate the first message (stale from a demo-reset)
    let mergedTokens: Token[] = tokens;
    if (showTags && tagEvents.length > 0) {
      const firstMsgTs = sorted.length > 0
        ? new Date((sorted[0] as any).created_at ?? (sorted[0] as any).createdAt ?? 0).getTime()
        : 0;
      const sortedTe = [...tagEvents]
        .filter((te: any) => !te.created_at || !firstMsgTs || new Date(te.created_at).getTime() >= firstMsgTs)
        .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
      const mt: Token[] = [];
      let tei = 0;
      for (const tok of tokens) {
        if (tok.kind === "msg") {
          const msg = sorted[tok.msgIdx];
          const msgTs = new Date((msg as any).created_at ?? (msg as any).createdAt ?? 0).getTime();
          while (tei < sortedTe.length && new Date(sortedTe[tei].created_at).getTime() <= msgTs) {
            const te = sortedTe[tei];
            const timeStr = new Date(te.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            if (MINI_CONVERSION_STATUS_TAGS.has(te.tag_name) && te.event_type !== "removed") {
              mt.push({ kind: "status-event", statusName: te.tag_name, time: timeStr, key: `status-event-${te.id}` });
            } else {
              mt.push({ kind: "tag-event", tagName: te.tag_name, tagColor: te.tag_color, time: timeStr, key: `tag-event-${te.id}`, eventType: te.event_type });
            }
            tei++;
          }
        }
        mt.push(tok);
      }
      while (tei < sortedTe.length) {
        const te = sortedTe[tei];
        const timeStr = new Date(te.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        if (MINI_CONVERSION_STATUS_TAGS.has(te.tag_name) && te.event_type !== "removed") {
          mt.push({ kind: "status-event", statusName: te.tag_name, time: timeStr, key: `status-event-${te.id}` });
        } else {
          mt.push({ kind: "tag-event", tagName: te.tag_name, tagColor: te.tag_color, time: timeStr, key: `tag-event-${te.id}`, eventType: te.event_type });
        }
        tei++;
      }
      mergedTokens = mt;
    }

    // Second pass: collect same-sender runs and wrap them
    const items: React.ReactNode[] = [];
    let ti = 0;

    while (ti < mergedTokens.length) {
      const tok = mergedTokens[ti];

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
      if (tok.kind === "tag-event") {
        items.push(<MiniTagEventChip key={tok.key} tagName={tok.tagName} tagColor={tok.tagColor} time={tok.time} eventType={tok.eventType} />);
        ti++;
        continue;
      }
      if (tok.kind === "status-event") {
        items.push(<MiniStatusEventChip key={tok.key} statusName={tok.statusName} time={tok.time} />);
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
      while (lookahead < mergedTokens.length) {
        const lt = mergedTokens[lookahead];
        if (lt.kind === "date" || lt.kind === "thread" || lt.kind === "tag-event" || lt.kind === "status-event") {
          pendingSeparators.push({
            node: lt.kind === "date"
              ? <MiniDateSeparator key={lt.key} label={lt.label} />
              : lt.kind === "thread"
              ? <MiniThreadDivider key={lt.key} group={lt.group} total={lt.total} />
              : lt.kind === "status-event"
              ? <MiniStatusEventChip key={lt.key} statusName={lt.statusName} time={lt.time} />
              : <MiniTagEventChip key={lt.key} tagName={lt.tagName} tagColor={lt.tagColor} time={lt.time} eventType={lt.eventType} />,
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
  }, [sorted, leadName, leadAvatarColors, currentUser, showTags, tagEvents]);

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
            {/* Tag toggle button — only shown when lead has tag events */}
            {tagEvents.length > 0 && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowTags((v) => !v)}
                  className={cn(
                    "h-[34px] w-[34px] rounded-full border flex items-center justify-center transition-colors",
                    showTags
                      ? "border-brand-indigo/40 bg-brand-indigo/10 text-brand-indigo"
                      : "border-black/[0.125] text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                  title={showTags ? "Hide tags" : "Show tags"}
                >
                  <TagIcon className="h-3.5 w-3.5" />
                </button>
                {!showTags && (
                  <svg
                    className="absolute inset-0 pointer-events-none text-muted-foreground"
                    viewBox="0 0 34 34"
                    width="34"
                    height="34"
                  >
                    <line x1="8" y1="8" x2="26" y2="26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
              </div>
            )}
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
      {!readOnly && <div className="shrink-0 px-3 pb-3 pt-1">
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
      </div>}
    </div>
  );
}

// ── Team widget — users managing this lead's account ─────────────────────────
function TeamWidget({ lead, onRefresh, inline }: { lead: Record<string, any>; onRefresh?: () => void; inline?: boolean }) {
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

  const teamContent = (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className={cn(inline ? "text-[10px] font-medium uppercase tracking-wider text-foreground/40" : "text-[18px] font-semibold font-heading text-foreground")}>{t("team.title")}</p>
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
    </>
  );

  if (inline) return teamContent;

  return (
    <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-[21px] flex flex-col h-full overflow-y-auto">
      {teamContent}
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
    <div data-testid="activity-timeline" className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 md:p-8 flex flex-col h-full overflow-y-auto gap-6">
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
        <div data-testid="activity-timeline-empty" className="flex flex-col items-center justify-center text-center py-8 px-4 flex-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted mb-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">{t("activity.noRecentActivity")}</p>
          <p className="text-xs text-muted-foreground max-w-[240px] mt-1">
            {t("activity.emptyHint")}
          </p>
        </div>
      ) : (
        <div data-testid="activity-timeline-list" className="overflow-y-auto space-y-1 flex-1 min-h-0">
          {timeline.map((evt, i) => {
            const cfg = TIMELINE_ICON[evt.styleKey] ?? TIMELINE_ICON.inbound;
            const Icon = cfg.icon;
            return (
              <div
                key={`${evt.styleKey}-${i}`}
                data-testid={`activity-timeline-item`}
                data-activity-type={evt.styleKey}
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
  campaignsById,
  leadTags,
}: {
  lead: Record<string, any>;
  onClose: () => void;
  leadTags?: { name: string; color: string }[];
  onRefresh?: () => void;
  toolbarPrefix?: (opts: { isNarrow: boolean }) => React.ReactNode;
  campaignsById?: Map<number, { name: string; accountId: number | null; bookingMode?: string | null }>;
}) {
  const { t } = useTranslation("leads");
  const { toast } = useToast();
  const name        = getFullName(lead);
  const status      = getStatus(lead);
  const score       = getScore(lead);
  const avatarColor = getStatusAvatarColor(status);
  const leadId      = getLeadId(lead);

  const { breakdown: detailBreakdown } = useScoreBreakdown(leadId ? Number(leadId) : null);
  const tier = detailBreakdown?.tier ?? (score === 0 ? "Sleeping" : null);

  const [, navigate] = useLocation();

  // ── Responsive columns ─────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);
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
    let cancelled = false;
    apiFetch(`/api/accounts/${accountId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: any) => { if (!cancelled) setAccountLogo(data?.logo_url || null); })
      .catch(() => { if (!cancelled) setAccountLogo(null); });
    return () => { cancelled = true; };
  }, [lead.Accounts_id, lead.account_id, lead.accounts_id]);

  // ── Campaign sticker ──────────────────────────────────────────────────────
  const [campaignStickerUrl, setCampaignStickerUrl] = useState<string | null>(null);

  useEffect(() => {
    const cId = lead.Campaigns_id || lead.campaigns_id || lead.campaignsId;
    if (!cId) { setCampaignStickerUrl(null); return; }
    let cancelled = false;
    apiFetch(`/api/campaigns/${cId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: any) => {
        if (cancelled) return;
        const slug = data?.campaign_sticker || data?.campaignSticker;
        const sticker = slug ? CAMPAIGN_STICKERS.find(s => s.slug === slug) : undefined;
        setCampaignStickerUrl(sticker?.url || null);
      })
      .catch(() => { if (!cancelled) setCampaignStickerUrl(null); });
    return () => { cancelled = true; };
  }, [lead.Campaigns_id, lead.campaigns_id, lead.campaignsId]);

  // ── Campaign number (#N within same account, sorted by ID) ────────────────
  const campaignNumber = useMemo(() => {
    const cId = Number(lead.Campaigns_id || lead.campaigns_id || lead.campaignsId || 0);
    if (!cId || !campaignsById) return null;
    const info = campaignsById.get(cId);
    if (!info) return null;
    const sameAccount = Array.from(campaignsById.entries())
      .filter(([, c]) => c.accountId === info.accountId)
      .sort(([a], [b]) => a - b);
    const idx = sameAccount.findIndex(([id]) => id === cId);
    return idx >= 0 ? idx + 1 : null;
  }, [lead.Campaigns_id, lead.campaigns_id, lead.campaignsId, campaignsById]);

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
      hapticSave();
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
    hapticDelete();
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

  // ── Gradient tester (agency-only) ─────────────────────────────────────────
  const { isAgencyUser } = useWorkspace();
  const GRADIENT_KEY = "la:gradient:leads";
  const [savedGradient, setSavedGradient] = useState<GradientLayer[] | null>(() => {
    try { const raw = localStorage.getItem(GRADIENT_KEY); return raw ? JSON.parse(raw) as GradientLayer[] : null; } catch { return null; }
  });
  const [gradientTesterOpen, setGradientTesterOpen] = useState(false);
  const [gradientLayers, setGradientLayers] = useState<GradientLayer[]>(DEFAULT_LAYERS);
  const [gradientDragMode, setGradientDragMode] = useState(false);
  const updateGradientLayer = useCallback((id: number, patch: Partial<GradientLayer>) => {
    if (id === -1) { setGradientLayers(prev => [...prev, patch as GradientLayer]); return; }
    if (id === -2) { setGradientLayers(prev => prev.filter(l => l.id !== (patch as GradientLayer).id)); return; }
    setGradientLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }, []);
  const handleApplyGradient = useCallback(() => {
    localStorage.setItem(GRADIENT_KEY, JSON.stringify(gradientLayers));
    setSavedGradient(gradientLayers);
    setGradientTesterOpen(false);
  }, [gradientLayers]);
  const toggleGradientTester = useCallback(() => {
    setGradientTesterOpen(prev => {
      if (!prev && savedGradient) setGradientLayers(savedGradient);
      return !prev;
    });
  }, [savedGradient]);

  // ── Expand-on-hover button helpers ───────────────────────────────────────
  const xBtn = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
  const xSpan = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

  return (
    <div ref={panelRef} className="relative flex flex-col h-full overflow-hidden">

      {/* ── Full-height gradient ── */}
      {gradientTesterOpen ? (
        <>
          {gradientLayers.map(layer => {
            const style = layerToStyle(layer);
            return style ? <div key={layer.id} className="absolute inset-0" style={style} /> : null;
          })}
          {gradientDragMode && (
            <GradientControlPoints layers={gradientLayers} onUpdateLayer={updateGradientLayer} />
          )}
        </>
      ) : savedGradient ? (
        <>
          {savedGradient.map((layer: GradientLayer) => {
            const style = layerToStyle(layer);
            return style ? <div key={layer.id} className="absolute inset-0" style={style} /> : null;
          })}
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-popover dark:bg-background" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_79%_101%_at_42%_91%,rgba(255,102,17,0.4)_0%,transparent_69%)] dark:opacity-[0.08]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_200%_at_2%_2%,#f0ffb5_5%,transparent_30%)] dark:opacity-[0.08]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_73%_92%_at_69%_50%,rgba(255,191,135,0.38)_0%,transparent_66%)] dark:opacity-[0.08]" />
        </>
      )}

      {/* ── Fixed header (stays in place) ── */}
      <div className="relative shrink-0 z-10 px-4 pt-5 pb-3 space-y-6 max-w-[1386px] w-full mr-auto">

          {/* Toolbar */}
          <div className="flex items-center gap-1 flex-wrap">
            {toolbarPrefix?.({ isNarrow })}

            {/* Action buttons removed — available on Chats page only */}

            {/* Right-edge: Gradient + To PDF + Delete */}
            <div className="ml-auto flex items-center gap-1">
              {/* Gradient Tester (agency-only) */}
              {isAgencyUser && (
                <button
                  onClick={toggleGradientTester}
                  className={cn(xBtn, "hover:max-w-[120px]", gradientTesterOpen ? "border-indigo-200 text-indigo-600 bg-indigo-100" : "border-black/[0.125] text-foreground/60 hover:text-foreground")}
                  title="Gradient Tester"
                >
                  <Palette className="h-4 w-4 shrink-0" />
                  <span className={xSpan}>Gradient</span>
                </button>
              )}
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
                <span className="inline-flex items-center px-2 py-0.5 rounded border border-border/50 text-[10px] font-medium text-muted-foreground">Lead {leadId}</span>
                {tier && (
                  <span
                    className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold", TIER_COLORS[tier] ?? TIER_COLORS.Sleeping)}
                    style={(tier === "Hot" || tier === "Awake") ? {
                      boxShadow: `0 0 8px 2px ${tier === "Hot" ? "rgba(239,68,68,0.4)" : "rgba(16,185,129,0.4)"}`,
                    } : undefined}
                  >
                    {tier}
                  </span>
                )}
              </div>
            </div>
            {/* Metachips — absolute, centered on panel 2/3 boundary (66.67%) */}
            {(() => {
              const campName = lead.campaign_name || lead.Campaign || "";
              const acctName = lead.account_name || lead.Account || "";
              const hasAny = campName || acctName || lead.last_interaction_at || lead.last_message_received_at || lead.booked_call_date;
              if (!hasAny) return null;
              return (
              <div className="absolute -translate-x-1/2 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-8 whitespace-nowrap pointer-events-auto z-10" style={{ left: "66.67%" }}>
                {campName && (
                  <div className="flex items-center gap-1.5">
                    {campaignStickerUrl ? (
                      <img src={campaignStickerUrl} alt="" className="h-[38px] w-[38px] object-contain shrink-0" />
                    ) : (
                      <EntityAvatar
                        name={campName}
                        bgColor={getCampaignAvatarColor("Active").bg}
                        textColor={getCampaignAvatarColor("Active").text}
                        size={38}
                        className="shrink-0"
                      />
                    )}
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Campaign{campaignNumber ? ` #${campaignNumber}` : ""}</div>
                      <div className="text-[12px] font-bold text-foreground leading-none truncate max-w-[120px]">{campName}</div>
                    </div>
                  </div>
                )}
                {acctName && (
                  <div className="flex items-center gap-1.5">
                    {accountLogo ? (
                      <img src={accountLogo} alt="" className="h-[25px] w-[25px] rounded-full object-cover shrink-0" />
                    ) : (
                      <EntityAvatar
                        name={acctName}
                        bgColor="rgba(0,0,0,0.08)"
                        textColor="#374151"
                        size={25}
                        className="shrink-0"
                      />
                    )}
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Account</div>
                      <div className="text-[12px] font-bold text-foreground leading-none truncate max-w-[120px]">{acctName}</div>
                    </div>
                  </div>
                )}
                {(lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at) && (
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("contact.lastActivity", "Last Activity")}</div>
                    <div className="text-[12px] font-bold text-foreground leading-none">{formatRelativeTime(lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at, t)}</div>
                  </div>
                )}
                {(lead.booked_call_date || lead.bookedCallDate) && (
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("detail.fields.callDate", "Booked Call")}</div>
                    <div className="text-[12px] font-bold text-foreground leading-none">{formatBookedDate(lead.booked_call_date || lead.bookedCallDate)}</div>
                  </div>
                )}
              </div>
              );
            })()}
          </div>

          {/* Pipeline tube */}
          {status && (
            <div className="pt-2 pb-6">
              <div className="hidden md:block"><PipelineProgress status={status} skipBooked={(() => { const cId = lead.Campaigns_id ?? lead.campaigns_id ?? lead.campaignsId; const mode = cId && campaignsById?.get(Number(cId))?.bookingMode; return mode === "direct"; })()} /></div>
              <div className="md:hidden"><PipelineProgressCompact status={status} /></div>
            </div>
          )}
        </div>

      {/* ── Body — fills remaining viewport, columns scroll internally ── */}
      <div
        className="relative flex-1 -mt-[80px] pt-[83px] overflow-hidden min-h-0"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0px, black 83px)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0px, black 83px)",
        }}
      >
        <div ref={containerRef} className="p-[3px] h-full flex flex-col gap-[3px] max-w-[1386px] w-full mr-auto">
          <div className="grid gap-[3px] flex-1 min-h-0" style={{ gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr 1fr" }}>
            {/* Contact */}
            <div className="overflow-y-auto rounded-xl min-h-0">
              <ContactWidget lead={lead} onRefresh={onRefresh} accountLogo={accountLogo} campaignStickerUrl={campaignStickerUrl} campaignsById={campaignsById} />
            </div>
            {/* Chat */}
            <div className="overflow-hidden rounded-xl bg-white/60 dark:bg-white/[0.10] flex flex-col min-h-0">
              <ConversationWidget lead={lead} showHeader />
            </div>
            {/* Lead Score */}
            <div className="overflow-y-auto rounded-xl min-h-0">
              <ScoreWidget score={score} lead={lead} status={status} />
            </div>
          </div>
        </div>
      </div>

      {/* Gradient Tester floating panel (agency-only) */}
      {isAgencyUser && (
        <GradientTester
          open={gradientTesterOpen}
          onClose={() => setGradientTesterOpen(false)}
          layers={gradientLayers}
          onUpdateLayer={updateGradientLayer}
          onResetLayers={() => setGradientLayers(DEFAULT_LAYERS)}
          dragMode={gradientDragMode}
          onToggleDragMode={() => setGradientDragMode(prev => !prev)}
          onApply={handleApplyGradient}
        />
      )}

    </div>
  );
}

// ── Funnel weight from conversion status (client-side, mirrors server logic) ──
const CLIENT_FUNNEL_WEIGHTS: Record<string, number> = {
  New: 0, Contacted: 5, Responded: 15, "Multiple Responses": 25,
  Qualified: 35, Booked: 45, Closed: 50, DND: 0, Lost: 0,
};

// ── Score breakdown tube for list cards ────────────────────────────────────────
// Stacked pill bar: Engagement (blue) under Activity (green) under Funnel (orange)
// Score number displayed to the left
export const LIST_RING_SIZE = 34; // kept for backward compat (used by InlineTable import)

export function ListScoreRing({ score, status, lead }: { score: number; status: string; isActive?: boolean; lead?: Record<string, any> }) {
  const engScore = Number(lead?.engagement_score ?? lead?.engagementScore ?? 0);
  const actScore = Number(lead?.activity_score ?? lead?.activityScore ?? 0);
  const funnelScore = CLIENT_FUNNEL_WEIGHTS[status] ?? 0;

  // Sub-scores are already weighted (eng max 30, act max 20, funnel max 50 = 100)
  // But the raw engagement/activity from scorer are 0-100, need to scale
  const eng = Math.min(30, Math.round((engScore / 100) * 30));
  const act = Math.min(20, Math.round((actScore / 100) * 20));
  const funnel = funnelScore;

  const segments = [
    { label: "Engagement", value: eng },
    { label: "Activity",   value: act },
    { label: "Funnel",     value: funnel },
  ];
  const shades = ["#3B82F6", "#10B981", "#F59E0B"];

  // Cumulative widths for stacked pill effect
  const cumulativeWidths: number[] = [];
  let cumSum = 0;
  for (const seg of segments) {
    cumSum += seg.value;
    cumulativeWidths.push(cumSum);
  }
  const renderOrder = [2, 1, 0]; // bottom layer first

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-[10px] font-bold tabular-nums text-foreground/70 w-[18px] text-right">{score}</span>
      <div className="relative w-[60px] h-[8px] rounded-full bg-muted">
        {renderOrder.map((i) => {
          if (cumulativeWidths[i] === 0) return null;
          return (
            <div
              key={segments[i].label}
              className="absolute top-0 left-0 h-full transition-all duration-500"
              style={{
                width: `${cumulativeWidths[i]}%`,
                backgroundColor: shades[i],
                borderRadius: "9999px",
                zIndex: segments.length - i,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Lead list card ─────────────────────────────────────────────────────────────
const TRAY_WIDTH = 220; // Swipe-left action tray width in px (Feature #41)

function LeadListCard({
  lead,
  isActive,
  onClick,
  leadTags,
  showContactAlways = false,
  tagsColorful = false,
  hideTags = false,
  campaignsById,
  onOpenConversation,
  onQuickChangeStatus,
  onQuickAddNote,
  onQuickDelete,
}: {
  lead: Record<string, any>;
  isActive: boolean;
  onClick: () => void;
  leadTags: { name: string; color: string }[];
  showContactAlways?: boolean;
  tagsColorful?: boolean;
  hideTags?: boolean;
  campaignsById?: Map<number, { name: string; accountId: number | null; bookingMode?: string | null }>;
  /** Swipe right navigates here — navigates to Chats tab with this lead selected */
  onOpenConversation?: () => void;
  /** Swipe left quick actions (Feature #41) */
  onQuickChangeStatus?: () => void;
  onQuickAddNote?: () => void;
  onQuickDelete?: () => void;
}) {
  const { t } = useTranslation("leads");
  const { isDark } = useTheme();
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
  const statusColors = STATUS_COLORS[status] ?? { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-zinc-400", badge: "bg-zinc-100 text-zinc-600 border-zinc-200" };
  const cId = Number(lead.Campaigns_id || lead.campaigns_id || lead.campaignsId || 0);
  const campaignName = lead.Campaign || lead.campaign || lead.campaign_name || (cId && campaignsById?.get(cId)?.name) || "";
  const partialPhone = phone ? (phone.length > 9 ? phone.slice(0, 6) + "…" + phone.slice(-3) : phone) : "";
  const bookedCallDate = lead.booked_call_date || lead.bookedCallDate || null;
  const isPastCall = status === "Booked" && !!bookedCallDate && new Date(bookedCallDate) < new Date();

  // ── Swipe gestures: right → inbox, left → quick actions tray ────────────────
  const cardWrapRef     = useRef<HTMLDivElement>(null);
  const [swipeX, setSwipeX]               = useState(0);   // right swipe (0–90px)
  const [swipeLeft, setSwipeLeft]         = useState(0);   // left swipe  (0–TRAY_WIDTH)
  const [trayOpen, setTrayOpen]           = useState(false);
  const [isReleasing, setIsReleasing]     = useState(false);
  const [isReleasingLeft, setIsReleasingLeft] = useState(false);
  const [leftFlash, setLeftFlash]         = useState(false);
  // Refs so touch handlers see latest values without stale closure
  const trayOpenRef   = useRef(false);
  const swipeLeftRef  = useRef(0);
  const swipeTouchRef = useRef<{
    startX: number; startY: number;
    isHorizontal: boolean | null;
  } | null>(null);

  // Keep refs in sync
  useEffect(() => { trayOpenRef.current  = trayOpen;  }, [trayOpen]);
  useEffect(() => { swipeLeftRef.current = swipeLeft; }, [swipeLeft]);

  // Close tray when clicking outside the card (Feature #41)
  useEffect(() => {
    if (!trayOpen) return;
    const handleOutside = (e: MouseEvent) => {
      const el = cardWrapRef.current;
      if (el && !el.contains(e.target as Node)) {
        setIsReleasingLeft(true);
        setTrayOpen(false);
        setSwipeLeft(0);
        swipeLeftRef.current  = 0;
        trayOpenRef.current   = false;
      }
    };
    document.addEventListener("click", handleOutside);
    return () => document.removeEventListener("click", handleOutside);
  }, [trayOpen]);

  const closeTray = () => {
    setIsReleasingLeft(true);
    setTrayOpen(false);
    setSwipeLeft(0);
    swipeLeftRef.current = 0;
    trayOpenRef.current  = false;
  };

  useEffect(() => {
    const el = cardWrapRef.current;
    if (!el) return;

    const handleStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      swipeTouchRef.current = { startX: touch.clientX, startY: touch.clientY, isHorizontal: null };
      setIsReleasing(false);
      setIsReleasingLeft(false);
    };

    const handleMove = (e: TouchEvent) => {
      const s = swipeTouchRef.current;
      if (!s) return;
      const touch = e.touches[0];
      const dx    = touch.clientX - s.startX;
      const dy    = touch.clientY - s.startY;

      if (s.isHorizontal === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        s.isHorizontal = Math.abs(dx) > Math.abs(dy);
      }
      if (!s.isHorizontal) return;

      if (trayOpenRef.current) {
        // Tray is open — right swipe to close
        if (dx > 0) {
          e.preventDefault();
          const next = Math.max(0, TRAY_WIDTH - dx);
          setSwipeLeft(next);
          swipeLeftRef.current = next;
        }
        return;
      }

      if (dx > 0) {
        // Right swipe → inbox reveal
        e.preventDefault();
        setSwipeX(Math.min(dx * 0.55, 90));
      } else if (dx < 0) {
        // Left swipe → reveal action tray
        e.preventDefault();
        const next = Math.min(-dx * 0.85, TRAY_WIDTH);
        setSwipeLeft(next);
        swipeLeftRef.current = next;
      }
    };

    const handleEnd = (e: TouchEvent) => {
      const s = swipeTouchRef.current;
      swipeTouchRef.current = null;
      if (!s || s.isHorizontal !== true) return;

      const dx = e.changedTouches[0].clientX - s.startX;

      if (trayOpenRef.current) {
        // Tray was open — decide to close or stay open
        setIsReleasingLeft(true);
        if (dx > TRAY_WIDTH * 0.3) {
          setTrayOpen(false);
          setSwipeLeft(0);
          swipeLeftRef.current = 0;
          trayOpenRef.current  = false;
        } else {
          setSwipeLeft(TRAY_WIDTH);
          swipeLeftRef.current = TRAY_WIDTH;
        }
        return;
      }

      if (dx > 0) {
        // Right swipe end
        const cardWidth = el.offsetWidth || 350;
        setIsReleasing(true);
        setSwipeX(0);
        if (dx >= cardWidth * 0.4 && onOpenConversation) {
          setTimeout(onOpenConversation, 120);
        }
      } else {
        // Left swipe end — snap open or close tray
        setIsReleasingLeft(true);
        if (swipeLeftRef.current > TRAY_WIDTH * 0.35) {
          setTrayOpen(true);
          trayOpenRef.current  = true;
          setSwipeLeft(TRAY_WIDTH);
          swipeLeftRef.current = TRAY_WIDTH;
        } else if (dx < -10) {
          setLeftFlash(true);
          setTimeout(() => setLeftFlash(false), 300);
          setSwipeLeft(0);
          swipeLeftRef.current = 0;
        } else {
          setSwipeLeft(0);
          swipeLeftRef.current = 0;
        }
      }
    };

    el.addEventListener("touchstart",  handleStart, { passive: true  });
    el.addEventListener("touchmove",   handleMove,  { passive: false });
    el.addEventListener("touchend",    handleEnd,   { passive: true  });
    el.addEventListener("touchcancel", handleEnd,   { passive: true  });
    return () => {
      el.removeEventListener("touchstart",  handleStart);
      el.removeEventListener("touchmove",   handleMove);
      el.removeEventListener("touchend",    handleEnd);
      el.removeEventListener("touchcancel", handleEnd);
    };
  }, [onOpenConversation]);

  // Icon opacities
  const inboxIconOpacity = Math.min(swipeX / 45, 1);
  const trayIconOpacity  = Math.min(swipeLeft / (TRAY_WIDTH * 0.5), 1);
  // How many tray buttons: 4 if phone, 3 otherwise
  const trayButtonCount  = phone ? 4 : 3;
  const trayBtnW         = Math.floor(TRAY_WIDTH / trayButtonCount);

  return (
    <div
      ref={cardWrapRef}
      className="relative overflow-hidden rounded-xl max-md:rounded-[1.5rem]"
      data-testid={`swipe-card-${getLeadId(lead)}`}
    >
      {/* Inbox icon revealed behind card as it slides right (Feature #40) */}
      <div
        className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"
        style={{ opacity: inboxIconOpacity }}
        aria-hidden="true"
      >
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-brand-indigo/15">
          <MessageSquare className="h-4 w-4 text-brand-indigo" />
        </div>
      </div>

      {/* Action tray revealed behind card on left swipe (Feature #41) */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch overflow-hidden"
        style={{ width: TRAY_WIDTH, opacity: trayIconOpacity }}
        aria-hidden={!trayOpen}
      >
        {/* Change Status */}
        <button
          className="flex flex-col items-center justify-center gap-1 bg-brand-indigo text-white min-h-[44px] active:brightness-90"
          style={{ width: trayBtnW }}
          onClick={(e) => { e.stopPropagation(); onQuickChangeStatus?.(); closeTray(); }}
          data-testid="quick-action-change-status"
          aria-label="Change Status"
        >
          <TagIcon className="h-5 w-5" />
          <span className="text-[10px] font-semibold leading-none">Status</span>
        </button>
        {/* Add Note */}
        <button
          className="flex flex-col items-center justify-center gap-1 bg-amber-500 text-white min-h-[44px] active:brightness-90"
          style={{ width: trayBtnW }}
          onClick={(e) => { e.stopPropagation(); onQuickAddNote?.(); closeTray(); }}
          data-testid="quick-action-add-note"
          aria-label="Add Note"
        >
          <Pencil className="h-5 w-5" />
          <span className="text-[10px] font-semibold leading-none">Note</span>
        </button>
        {/* Call — only if lead has a phone number */}
        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex flex-col items-center justify-center gap-1 bg-emerald-500 text-white min-h-[44px] active:brightness-90"
            style={{ width: trayBtnW }}
            onClick={(e) => { e.stopPropagation(); closeTray(); }}
            data-testid="quick-action-call"
            aria-label="Call"
          >
            <Phone className="h-5 w-5" />
            <span className="text-[10px] font-semibold leading-none">Call</span>
          </a>
        )}
        {/* Delete */}
        <button
          className="flex flex-col items-center justify-center gap-1 bg-red-500 text-white min-h-[44px] active:brightness-90"
          style={{ width: trayBtnW }}
          onClick={(e) => { e.stopPropagation(); onQuickDelete?.(); closeTray(); }}
          data-testid="quick-action-delete"
          aria-label="Delete Lead"
        >
          <Trash2 className="h-5 w-5" />
          <span className="text-[10px] font-semibold leading-none">Delete</span>
        </button>
      </div>

      {/* Card — translates horizontally on swipe (right → inbox, left → tray) */}
      <div
        className={cn(
          "relative group/card cursor-pointer transition-colors",
          isActive ? "bg-highlight-selected" : "bg-card hover:bg-card-hover hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
          leftFlash && "bg-muted/60"
        )}
        style={{
          transform: `translateX(${swipeX - swipeLeft}px)`,
          transition: (isReleasing || isReleasingLeft) ? "transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)" : "none",
          zIndex: 1,
        }}
        onClick={trayOpen ? (e) => { e.stopPropagation(); closeTray(); } : onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") { if (trayOpen) closeTray(); else onClick(); } }}
        data-swipe-x={swipeX > 0 ? swipeX : undefined}
      >
      <div className={cn("px-2.5 flex flex-col gap-0.5", hideTags ? "pt-1.5 pb-1" : "pt-2 pb-1.5")}>

        {/* Main layout: [avatar + text] on left, [date + score] column on right */}
        <div className="flex items-stretch gap-2">
          <EntityAvatar
            name={name}
            bgColor={avatarColor.bg}
            textColor={avatarColor.text}
            className={cn("self-start mt-0.5 shrink-0", isPastCall && "opacity-40 grayscale")}
          />

          {/* Left: name + status */}
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-[18px] font-semibold font-heading leading-tight truncate text-foreground">
              {name}
            </p>
            <div className="flex flex-wrap items-center gap-1 mt-0.5">
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", (status === "New" || status === "Responded" || status === "Multiple Responses") && "animate-status-pulse")} style={{ backgroundColor: statusHex, color: statusHex }} />
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
                          : isDark
                            ? { backgroundColor: isActive ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }
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
                  <ListScoreRing score={score} status={status} isActive={isActive} lead={lead} />
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ── Mobile-only footer: status badge + phone + campaign + last activity ── */}
      <div className="lg:hidden px-3 pb-3 pt-0 flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border shrink-0",
              statusColors.badge
            )}>
              {t(`kanban.stageLabels.${status.replace(/ /g, "")}`, status)}
            </span>
            {isPastCall && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border/40 shrink-0">
                Past
              </span>
            )}
          </div>
          {lastActivity && (
            <span className="text-[11px] tabular-nums text-muted-foreground/60 shrink-0">
              {formatRelativeTime(lastActivity, t)}
            </span>
          )}
        </div>
        {isPastCall && (
          <button
            onClick={(e) => { e.stopPropagation(); onQuickChangeStatus?.(); }}
            className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-400/15 text-amber-600 dark:text-amber-400 border border-amber-400/30 hover:bg-amber-400/25 active:bg-amber-400/30 transition-colors"
            data-testid="past-call-follow-up"
          >
            <AlertTriangle className="h-3 w-3" />
            Follow Up?
          </button>
        )}
        {(partialPhone || campaignName) && (
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
            {partialPhone && (
              <span className="inline-flex items-center gap-1 shrink-0">
                <Phone className="h-3 w-3 shrink-0" />
                {partialPhone}
              </span>
            )}
            {campaignName && (
              <span className="inline-flex items-center gap-1 truncate">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{campaignName}</span>
              </span>
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
  const status     = getStatus(lead);
  const score      = getScore(lead);
  const avatarColor = getStatusAvatarColor(status);

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

// ── Mobile Notes Tab (Feature #38) ────────────────────────────────────────────
interface ParsedNote {
  date: string | null;
  content: string;
  rawTs: string | null;
}

function parseLegacyNotes(raw: string): ParsedNote[] {
  if (!raw || !raw.trim()) return [];
  // Split on blank lines to get individual note segments
  const segments = raw.split(/\n\n+/);
  return segments
    .map((seg): ParsedNote => {
      const trimmed = seg.trim();
      if (!trimmed) return null as any;
      // Match leading [date] prefix like [3/9/2024]
      const match = trimmed.match(/^\[([^\]]+)\]\s*/);
      if (match) {
        const dateStr = match[1];
        const content = trimmed.slice(match[0].length).trim();
        // Try to parse as a date
        const ts = new Date(dateStr);
        const isValidDate = !isNaN(ts.getTime());
        return {
          date: isValidDate
            ? ts.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
            : dateStr,
          content: content || trimmed,
          rawTs: isValidDate ? ts.toISOString() : dateStr,
        };
      }
      return { date: null, content: trimmed, rawTs: null };
    })
    .filter(Boolean)
    .reverse(); // most-recent first
}

function MobileNotesTab({
  lead,
  onRefresh,
}: {
  lead: Record<string, any>;
  onRefresh?: () => void;
}) {
  const { t } = useTranslation("leads");
  const { toast } = useToast();
  const leadId = lead.Id ?? lead.id ?? 0;
  const rawNotes = lead.notes || lead.Notes || "";

  const [adding, setAdding] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentUser = localStorage.getItem("leadawaker_user_name") || "Agent";

  useEffect(() => {
    if (adding && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [adding]);

  const notes = useMemo(() => parseLegacyNotes(rawNotes), [rawNotes]);

  const handleSave = useCallback(async () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const dateStamp = new Date().toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
      });
      const entry = `[${dateStamp}] ${trimmed}`;
      const updated = rawNotes.trim() ? `${rawNotes.trim()}\n\n${entry}` : entry;
      await updateLead(leadId, { notes: updated });
      setNoteText("");
      setAdding(false);
      onRefresh?.();
      toast({ title: t("notes.saved") });
    } catch {
      toast({ title: t("notes.save"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [noteText, rawNotes, leadId, onRefresh, toast, t]);

  const handleCancel = useCallback(() => {
    setNoteText("");
    setAdding(false);
  }, []);

  return (
    <div className="px-4 pt-4 pb-6 flex flex-col gap-3" data-testid="mobile-notes-tab">
      {/* Header row: title + Add Note button */}
      <div className="flex items-center justify-between">
        <p className="text-[17px] font-semibold font-heading text-foreground">
          {t("mobileDetail.tabs.notes")}
        </p>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-brand-indigo text-white text-[12px] font-medium active:scale-95 transition-transform"
            data-testid="mobile-add-note-btn"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("mobileDetail.notes.addNote", "Add Note")}
          </button>
        )}
      </div>

      {/* Inline Add Note form */}
      {adding && (
        <div
          className="rounded-xl border border-brand-indigo/40 bg-card p-3 flex flex-col gap-2"
          data-testid="mobile-add-note-form"
        >
          <textarea
            ref={textareaRef}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder={t("notes.placeholder")}
            rows={4}
            className="w-full resize-none rounded-lg bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            data-testid="mobile-add-note-input"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="h-8 px-3 rounded-full border border-border text-[12px] text-muted-foreground active:scale-95 transition-transform"
              data-testid="mobile-add-note-cancel"
            >
              {t("common.cancel", "Cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !noteText.trim()}
              className="h-8 px-3 rounded-full bg-brand-indigo text-white text-[12px] font-medium disabled:opacity-50 active:scale-95 transition-transform flex items-center gap-1"
              data-testid="mobile-add-note-save"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              {t("notes.save")}
            </button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {notes.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 py-12 text-center"
          data-testid="mobile-notes-empty"
        >
          <FileText className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-[14px] font-medium text-muted-foreground">
            {t("mobileDetail.notes.emptyTitle", "No notes yet")}
          </p>
          <p className="text-[12px] text-muted-foreground/60 max-w-[200px]">
            {t("mobileDetail.notes.emptyHint", "Tap «Add Note» to add the first note for this lead.")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3" data-testid="mobile-notes-list">
          {notes.map((note, idx) => (
            <div
              key={idx}
              className="rounded-xl bg-card border border-border/50 p-3 flex flex-col gap-1.5"
              data-testid="mobile-note-card"
            >
              {/* Author + Date row */}
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-[12px] font-semibold text-brand-indigo"
                  data-testid="mobile-note-author"
                >
                  {currentUser}
                </span>
                {note.date && (
                  <span
                    className="text-[11px] text-muted-foreground shrink-0"
                    data-testid="mobile-note-date"
                  >
                    {note.date}
                  </span>
                )}
              </div>
              {/* Content */}
              <p
                className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap"
                data-testid="mobile-note-content"
              >
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mobile full-screen lead detail panel (Feature #34) ────────────────────────
type MobileDetailTab = "info" | "chat";

function MobileLeadDetailPanel({
  lead,
  onBack,
  onRefresh,
}: {
  lead: Record<string, any>;
  onBack: () => void;
  onRefresh?: () => void;
}) {
  const { t } = useTranslation("leads");
  const [activeTab, setActiveTab] = useState<MobileDetailTab>("info");
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const name   = getFullName(lead);
  const status = getStatus(lead);
  const leadId = getLeadId(lead);
  const statusColors = STATUS_COLORS[status] ?? { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-zinc-400", badge: "bg-zinc-100 text-zinc-600 border-zinc-200" };

  // ── Tag events (needed for ActivityTimeline) ────────────────────────────────
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

  // Glassmorphism blur: activate when content is scrolled
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setIsScrolled(el.scrollTop > 2);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  });

  const MOBILE_TABS: { id: MobileDetailTab; label: string }[] = [
    { id: "info", label: t("mobileDetail.tabs.info") },
    { id: "chat", label: t("mobileDetail.tabs.chat") },
  ];

  // Shared glassmorphism style for sticky headers (blur(12px) saturate(1.2) per spec)
  const glassmorphismStyle: React.CSSProperties = {
    backgroundColor: isScrolled ? "hsl(var(--background) / 0.75)" : "hsl(var(--background))",
    backdropFilter: isScrolled ? "blur(12px) saturate(1.2)" : "none",
    WebkitBackdropFilter: isScrolled ? "blur(12px) saturate(1.2)" : "none",
    transition: "backdrop-filter 200ms ease, -webkit-backdrop-filter 200ms ease, background-color 200ms ease",
  };

  return createPortal(
    <motion.div
      variants={{
        initial: { x: "100%" },
        animate: { x: 0, transition: { type: "tween", duration: 0.3, ease: [0.0, 0.0, 0.2, 1] } },
        exit:    { x: "100%", transition: { type: "tween", duration: 0.3, ease: [0.4, 0.0, 1, 1] } },
      }}
      initial="initial"
      animate="animate"
      exit="exit"
      className="lg:hidden fixed inset-0 z-[200] flex flex-col bg-background"
      style={{ height: "100dvh" }}
    >
      {/* ── Sticky header: back + name + status badge ── */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border/20"
        style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 12px)", ...glassmorphismStyle }}
      >
        <button
          onClick={onBack}
          className="h-9 w-9 rounded-full border border-border/50 bg-card grid place-items-center shrink-0 active:scale-95 transition-transform touch-target"
          aria-label="Back to leads list"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[17px] font-semibold font-heading truncate">{name}</h2>
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0",
              statusColors.badge
            )}>
              {t(`kanban.stageLabels.${status.replace(/ /g, "")}`, status)}
            </span>
          </div>
          {(lead.campaign_name || lead.account_name) && (
            <div className="flex items-center gap-2 mt-0.5">
              {lead.campaign_name && (
                <span className="text-[10px] text-muted-foreground/60 truncate">{lead.campaign_name}</span>
              )}
              {lead.campaign_name && lead.account_name && (
                <span className="text-muted-foreground/30 text-[10px]">·</span>
              )}
              {lead.account_name && (
                <span className="text-[10px] text-muted-foreground/60 truncate">{lead.account_name}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Tab bar — also gets glassmorphism blur on scroll ── */}
      <div
        className="shrink-0 flex border-b border-border/20 relative"
        style={glassmorphismStyle}
      >
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`lead-tab-${tab.id}`}
            className={cn(
              "flex-1 py-3 min-h-[44px] text-[13px] font-medium transition-colors",
              activeTab === tab.id
                ? "text-brand-indigo"
                : "text-muted-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
        {/* Animated sliding indicator — uses transform, no transition-all */}
        <span
          className="absolute bottom-0 h-0.5 bg-brand-indigo rounded-full pointer-events-none"
          style={{
            width: `${100 / MOBILE_TABS.length}%`,
            transform: `translateX(${MOBILE_TABS.findIndex((t) => t.id === activeTab) * 100}%)`,
            transition: "transform 150ms ease",
          }}
        />
      </div>

      {/* ── Tab content (scrollable) ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={activeTab === "chat" ? "flex flex-col h-full" : undefined}
          >
            {activeTab === "info" && (
              <ContactWidget lead={lead} onRefresh={onRefresh} tags={tagEvents?.map(te => ({ name: te.name, color: te.color ?? "gray" }))} />
            )}
            {activeTab === "chat" && (
              <div data-testid="mobile-lead-chat" className="flex flex-col h-full">
                <ConversationWidget lead={lead} showHeader={false} readOnly />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>,
    document.body
  );
}

// ── Mobile simplified kanban stages (all stages including terminal) ────────────
const ALL_MOBILE_KANBAN_STAGES = [
  { key: "New",                short: "New"     },
  { key: "Contacted",          short: "Contact" },
  { key: "Responded",          short: "Respond" },
  { key: "Multiple Responses", short: "Multi"   },
  { key: "Qualified",          short: "Qualify" },
  { key: "Booked",             short: "Booked ★"},
  { key: "Closed",             short: "Closed"  },
  { key: "Lost",               short: "Lost"    },
  { key: "DND",                short: "DND"     },
] as const;

// ── Mobile simplified kanban (Feature #39) ─────────────────────────────────────
function MobileSimpleKanban({
  leads,
  leadTagsInfo,
  onSelectLead,
  onMobileViewChange,
}: {
  leads: Record<string, any>[];
  leadTagsInfo: Map<number, { name: string; color: string }[]>;
  onSelectLead: (lead: Record<string, any>) => void;
  onMobileViewChange?: (v: "list" | "detail") => void;
}) {
  const grouped = useMemo(() => {
    const groups: Record<string, Record<string, any>[]> = {};
    for (const stage of ALL_MOBILE_KANBAN_STAGES) groups[stage.key] = [];
    for (const lead of leads) {
      const status = getStatus(lead);
      if (groups[status] !== undefined) {
        groups[status].push(lead);
      } else {
        // Unknown status falls into "New"
        groups["New"].push(lead);
      }
    }
    return groups;
  }, [leads]);

  return (
    <div
      className="flex-1 min-h-0 overflow-x-auto"
      style={{ overscrollBehaviorX: "contain" } as React.CSSProperties}
      data-testid="mobile-simple-kanban"
    >
      <div
        className="flex h-full gap-[3px] px-[3px] pb-[3px]"
        style={{ minWidth: `${ALL_MOBILE_KANBAN_STAGES.length * 152}px` }}
      >
        {ALL_MOBILE_KANBAN_STAGES.map((stage) => {
          const stageLeads = grouped[stage.key] || [];
          const hex = PIPELINE_HEX[stage.key] || "#6B7280";

          return (
            <div
              key={stage.key}
              className="flex flex-col rounded-lg overflow-hidden flex-shrink-0 bg-card"
              style={{ width: "148px", minWidth: "148px" }}
              data-testid={`mobile-kanban-col-${stage.key}`}
            >
              {/* Column header */}
              <div
                className="px-2 py-1.5 flex items-center gap-1.5 shrink-0"
                style={{ borderBottom: `1px solid ${hex}25` }}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0 flex-shrink-0"
                  style={{ backgroundColor: hex }}
                />
                <span
                  className="text-[11px] font-semibold flex-1 truncate"
                  style={{ color: hex }}
                  data-testid={`mobile-kanban-stage-label-${stage.key}`}
                >
                  {stage.short}
                </span>
                <span
                  className="text-[11px] font-bold tabular-nums shrink-0 text-muted-foreground/70"
                  data-testid={`mobile-kanban-count-${stage.key}`}
                >
                  {stageLeads.length}
                </span>
              </div>

              {/* Lead cards */}
              <div className="flex-1 overflow-y-auto py-0.5 px-[3px] space-y-[2px]">
                {stageLeads.length === 0 ? (
                  <div className="py-3 flex items-center justify-center">
                    <span className="text-[9px] text-muted-foreground/30 select-none">Empty</span>
                  </div>
                ) : (
                  stageLeads.map((lead) => {
                    const name     = getFullName(lead);
                    const leadId   = getLeadId(lead);
                    const avatarCl = getStatusAvatarColor(getStatus(lead));
                    const shortNm  = name.length > 11 ? name.slice(0, 10) + "…" : name;
                    return (
                      <button
                        key={leadId}
                        className="w-full text-left flex items-center gap-1.5 rounded-lg bg-background/60 px-1.5 py-1 min-h-[44px] active:bg-brand-indigo/10 transition-colors"
                        data-testid={`mobile-kanban-card-${leadId}`}
                        onClick={() => {
                          onSelectLead(lead);
                          onMobileViewChange?.("detail");
                        }}
                      >
                        <EntityAvatar
                          name={name}
                          bgColor={avatarCl.bg}
                          textColor={avatarCl.text}
                          size={28}
                          className="shrink-0"
                        />
                        <span className="text-[10px] font-medium truncate text-foreground leading-tight">
                          {shortNm}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Pipeline stages list for filter sheet ─────────────────────────────────────
const ALL_LEAD_FILTER_STAGES = [
  "New", "Contacted", "Responded", "Multiple Responses",
  "Qualified", "Booked", "Closed", "Lost", "DND",
];

const LEAD_SORT_OPTIONS: { value: SortByOption; label: string }[] = [
  { value: "recent",     label: "Most Recent" },
  { value: "name_asc",   label: "Name A → Z" },
  { value: "name_desc",  label: "Name Z → A" },
  { value: "score_desc", label: "Score ↓" },
  { value: "score_asc",  label: "Score ↑" },
];

interface LeadFilterSheetApplyState {
  filterStatus: string[];
  filterTags: string[];
  sortBy: SortByOption;
  filterCampaign: string;
  filterAccount: string;
}

// ── Mobile Add Lead Form (Feature #45) ────────────────────────────────────────
function MobileAddLeadForm({
  open,
  onClose,
  onCreated,
  campaignsById,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (lead: Record<string, any>) => void;
  campaignsById?: Map<number, { name: string; accountId: number | null; bookingMode?: string | null }>;
}) {
  const { t } = useTranslation("leads");
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [phone,     setPhone]     = useState("");
  const [email,     setEmail]     = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [availableTags, setAvailableTags] = useState<{ id: number; name: string; color: string }[]>([]);
  const [errors, setErrors] = useState<{ firstName?: string; phone?: string }>({});

  useEffect(() => { setMounted(true); }, []);

  // Fetch tags when form opens
  useEffect(() => {
    if (!open) return;
    apiFetch("/api/tags")
      .then((r) => r.ok ? r.json() : [])
      .then((data: any[]) => {
        setAvailableTags(
          (Array.isArray(data) ? data : []).map((t: any) => ({
            id: t.id ?? t.Id ?? 0,
            name: t.name || t.Name || "",
            color: t.color || t.Color || "gray",
          })).filter((t) => t.id && t.name)
        );
      })
      .catch(() => setAvailableTags([]));
  }, [open]);

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setFirstName(""); setLastName(""); setPhone("");
      setEmail(""); setCampaignId(""); setSelectedTagIds([]);
      setErrors({});
    }
  }, [open]);

  const campaigns = useMemo(() => {
    if (!campaignsById) return [];
    return Array.from(campaignsById.entries()).map(([id, info]) => ({ id, name: info.name }));
  }, [campaignsById]);

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const validate = () => {
    const errs: { firstName?: string; phone?: string } = {};
    if (!firstName.trim()) errs.firstName = "First name is required";
    if (!phone.trim() && !email.trim()) errs.phone = "Phone or email is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        Conversion_Status: "New",
      };
      if (campaignId) payload.Campaigns_id = Number(campaignId);
      const newLead = await createLead(payload);
      const leadId = newLead?.id ?? newLead?.Id;
      // Apply tags sequentially
      if (leadId && selectedTagIds.length > 0) {
        for (const tagId of selectedTagIds) {
          await apiFetch(`/api/leads/${leadId}/tags`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tagId }),
          }).catch(() => {});
        }
      }
      toast({ title: "Lead created", description: `${firstName} ${lastName}`.trim() });
      onCreated(newLead);
      onClose();
    } catch {
      toast({ title: "Failed to create lead", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) return null;

  const inputCls = "w-full h-11 px-3 rounded-xl border border-border/50 bg-background text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-indigo/40 focus:border-brand-indigo transition-colors";
  const labelCls = "text-[10px] font-medium uppercase tracking-wider text-foreground/50 mb-1 block";

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="mobile-add-lead-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 z-[300] bg-black/50"
            onClick={onClose}
          />
          {/* Full-screen form panel */}
          <motion.div
            key="mobile-add-lead-form"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: [0.0, 0.0, 0.2, 1] }}
            data-testid="mobile-add-lead-form"
            className="lg:hidden fixed inset-x-0 bottom-0 z-[301] bg-background rounded-t-3xl border-t border-border/30 flex flex-col max-h-[92dvh]"
            style={{ paddingBottom: "calc(1.5rem + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))" }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-foreground/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-border/20">
              <h3 className="text-[17px] font-semibold font-heading">{t("toolbar.add", "Add Lead")}</h3>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-full bg-muted grid place-items-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable form body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
              {/* First name */}
              <div>
                <label className={labelCls}>{t("contact.firstName", "First Name")} <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); setErrors((p) => ({ ...p, firstName: undefined })); }}
                  placeholder="John"
                  autoComplete="given-name"
                  className={cn(inputCls, errors.firstName && "border-red-500 focus:border-red-500 focus:ring-red-500/40")}
                  data-testid="add-lead-first-name"
                />
                {errors.firstName && <p className="text-[11px] text-red-500 mt-1">{errors.firstName}</p>}
              </div>

              {/* Last name */}
              <div>
                <label className={labelCls}>{t("contact.lastName", "Last Name")}</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  autoComplete="family-name"
                  className={inputCls}
                  data-testid="add-lead-last-name"
                />
              </div>

              {/* Phone (tel keyboard) */}
              <div>
                <label className={labelCls}>{t("contact.phone", "Phone")}</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setErrors((p) => ({ ...p, phone: undefined })); }}
                  placeholder="+1 (555) 000-0000"
                  autoComplete="tel"
                  inputMode="tel"
                  className={cn(inputCls, errors.phone && "border-red-500 focus:border-red-500 focus:ring-red-500/40")}
                  data-testid="add-lead-phone"
                />
                {errors.phone && <p className="text-[11px] text-red-500 mt-1">{errors.phone}</p>}
              </div>

              {/* Email (email keyboard) */}
              <div>
                <label className={labelCls}>{t("contact.email", "Email")}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  autoComplete="email"
                  inputMode="email"
                  className={inputCls}
                  data-testid="add-lead-email"
                />
              </div>

              {/* Campaign selector */}
              {campaigns.length > 0 && (
                <div>
                  <label className={labelCls}>{t("detailView.campaign", "Campaign")}</label>
                  <select
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                    className={cn(inputCls, "appearance-none bg-background pr-8")}
                    data-testid="add-lead-campaign"
                  >
                    <option value="">No campaign</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tags multi-select (pill toggles) */}
              {availableTags.length > 0 && (
                <div>
                  <label className={labelCls}>{t("detail.sections.tags", "Tags")}</label>
                  <div className="flex flex-wrap gap-2 mt-1" data-testid="add-lead-tags">
                    {availableTags.map((tag) => {
                      const hex = resolveColor(tag.color);
                      const selected = selectedTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className={cn(
                            "inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold border transition-colors",
                            selected
                              ? "opacity-100"
                              : "opacity-50 hover:opacity-75"
                          )}
                          style={{
                            backgroundColor: selected ? `${hex}22` : "transparent",
                            color: hex,
                            borderColor: `${hex}${selected ? "66" : "44"}`,
                          }}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Submit button */}
            <div className="px-5 pt-3 shrink-0">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                data-testid="add-lead-submit"
                className={cn(
                  "w-full h-12 rounded-2xl text-[15px] font-semibold transition-opacity",
                  "bg-brand-indigo text-white",
                  submitting && "opacity-60 pointer-events-none"
                )}
              >
                {submitting ? "Creating…" : t("toolbar.add", "Add Lead")}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

interface LeadFilterBottomSheetProps {
  open: boolean;
  onClose: () => void;
  filterStatus: string[];
  filterTags: string[];
  sortBy: SortByOption;
  filterCampaign: string;
  filterAccount: string;
  allTags: { name: string; color: string }[];
  availableCampaigns: { id: string; name: string }[];
  availableAccounts: { id: string; name: string }[];
  onApply: (state: LeadFilterSheetApplyState) => void;
  onReset: () => void;
}

function LeadFilterBottomSheet({
  open, onClose,
  filterStatus, filterTags, sortBy, filterCampaign, filterAccount,
  allTags, availableCampaigns,
  onApply, onReset,
}: LeadFilterBottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [pendingStatus,   setPendingStatus]   = useState<string[]>([...filterStatus]);
  const [pendingTags,     setPendingTags]     = useState<string[]>([...filterTags]);
  const [pendingSort,     setPendingSort]     = useState<SortByOption>(sortBy);
  const [pendingCampaign, setPendingCampaign] = useState<string>(filterCampaign);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (open) {
      setPendingStatus([...filterStatus]);
      setPendingTags([...filterTags]);
      setPendingSort(sortBy);
      setPendingCampaign(filterCampaign);
    }
  }, [open, filterStatus, filterTags, sortBy, filterCampaign]);

  if (!mounted) return null;

  const toggleStatus = (s: string) =>
    setPendingStatus((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const toggleTag = (name: string) =>
    setPendingTags((prev) => prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]);

  const handleApply = () => {
    onApply({
      filterStatus:  pendingStatus,
      filterTags:    pendingTags,
      sortBy:        pendingSort,
      filterCampaign: pendingCampaign,
      filterAccount:  filterAccount, // unchanged from parent
    });
    onClose();
  };

  const handleReset = () => {
    onReset();
    onClose();
  };

  const activeCount =
    pendingStatus.length + pendingTags.length +
    (pendingCampaign ? 1 : 0) + (pendingSort !== "recent" ? 1 : 0);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="lead-filter-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 z-[300] bg-black/50"
            onClick={onClose}
          />
          {/* Sheet */}
          <motion.div
            key="lead-filter-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: [0.0, 0.0, 0.2, 1] }}
            data-testid="lead-filter-sheet"
            className="lg:hidden fixed inset-x-0 bottom-0 z-[301] bg-background rounded-t-3xl border-t border-border/30 flex flex-col max-h-[88dvh]"
            style={{ paddingBottom: "calc(1.5rem + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))" }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-foreground/20" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 pt-1 shrink-0">
              <h2 className="text-[17px] font-semibold text-foreground">
                Filters &amp; Sort
                {activeCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-brand-indigo text-white text-[10px] font-bold">
                    {activeCount}
                  </span>
                )}
              </h2>
              <button onClick={onClose} className="h-8 w-8 rounded-full bg-muted grid place-items-center" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-5">
              {/* Sort */}
              <div>
                <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sort By</p>
                <div className="flex flex-col gap-1">
                  {LEAD_SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={cn(
                        "flex items-center justify-between px-3 py-2.5 rounded-xl border text-[14px] min-h-[44px] transition-colors",
                        pendingSort === opt.value
                          ? "border-brand-indigo bg-brand-indigo/8 text-brand-indigo font-semibold"
                          : "border-border/40 text-foreground"
                      )}
                      onClick={() => setPendingSort(opt.value)}
                    >
                      <span>{opt.label}</span>
                      {pendingSort === opt.value && <Check className="h-4 w-4 text-brand-indigo" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status filter */}
              <div>
                <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pipeline Stage</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_LEAD_FILTER_STAGES.map((s) => {
                    const colors = STATUS_COLORS[s];
                    const active = pendingStatus.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() => toggleStatus(s)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-medium min-h-[36px] transition-colors",
                          active
                            ? (colors?.badge ?? "bg-brand-indigo/10 text-brand-indigo border-brand-indigo/30")
                            : "border-border/40 text-muted-foreground"
                        )}
                      >
                        {active && <Check className="h-3 w-3 shrink-0" />}
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Campaign filter */}
              {availableCampaigns.length > 0 && (
                <div>
                  <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Campaign</p>
                  <div className="flex flex-col gap-1">
                    <button
                      className={cn(
                        "flex items-center justify-between px-3 py-2.5 rounded-xl border text-[14px] min-h-[44px] transition-colors",
                        !pendingCampaign
                          ? "border-brand-indigo bg-brand-indigo/8 text-brand-indigo font-semibold"
                          : "border-border/40 text-foreground"
                      )}
                      onClick={() => setPendingCampaign("")}
                    >
                      <span>All Campaigns</span>
                      {!pendingCampaign && <Check className="h-4 w-4 text-brand-indigo" />}
                    </button>
                    {availableCampaigns.map((c) => (
                      <button
                        key={c.id}
                        className={cn(
                          "flex items-center justify-between px-3 py-2.5 rounded-xl border text-[14px] min-h-[44px] transition-colors",
                          pendingCampaign === c.id
                            ? "border-brand-indigo bg-brand-indigo/8 text-brand-indigo font-semibold"
                            : "border-border/40 text-foreground"
                        )}
                        onClick={() => setPendingCampaign(pendingCampaign === c.id ? "" : c.id)}
                      >
                        <span className="truncate text-left">{c.name}</span>
                        {pendingCampaign === c.id && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags filter */}
              {allTags.length > 0 && (
                <div>
                  <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => {
                      const hex    = resolveColor(tag.color);
                      const active = pendingTags.includes(tag.name);
                      return (
                        <button
                          key={tag.name}
                          onClick={() => toggleTag(tag.name)}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-medium min-h-[36px] transition-colors",
                            active ? "border-transparent text-white" : "border-border/40 text-muted-foreground"
                          )}
                          style={active ? { backgroundColor: hex } : undefined}
                        >
                          {!active && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />}
                          {active && <Check className="h-3 w-3 shrink-0" />}
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 flex gap-3 px-5 pt-3 border-t border-border/20">
              <button
                onClick={handleReset}
                className="flex-1 h-12 rounded-2xl border border-border/40 text-[15px] font-semibold text-muted-foreground active:bg-muted"
                data-testid="lead-filter-reset"
              >
                Reset
              </button>
              <button
                onClick={handleApply}
                className="flex-1 h-12 rounded-2xl bg-brand-indigo text-white text-[15px] font-semibold active:brightness-90"
                data-testid="lead-filter-apply"
              >
                Apply{activeCount > 0 && ` (${activeCount})`}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
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
  const [, setLocation] = useLocation();
  const { isAgencyUser } = useWorkspace();

  // ── Mobile kanban toggle (Feature #39): persisted preference ─────────────────
  const [mobileListMode, setMobileListMode] = usePersistedState<"list" | "kanban">(
    "mobile-leads-list-mode",
    "list",
    (v) => v === "list" || v === "kanban",
  );

  // ── Navigate to Conversations with this lead pre-selected (Feature #40) ──────
  const handleOpenConversation = useCallback((leadId: number | string) => {
    try {
      localStorage.setItem("selected-conversation-lead-id", String(leadId));
    } catch { /* ignore */ }
    const basePath = isAgencyUser ? "/agency" : "/subaccount";
    setLocation(`${basePath}/conversations`);
  }, [isAgencyUser, setLocation]);

  // ── Quick action tray state (Feature #41) ────────────────────────────────────
  const { toast } = useToast();
  const [quickActionLead, setQuickActionLead]         = useState<Record<string, any> | null>(null);
  const [quickActionType, setQuickActionType]         = useState<"status" | "note" | "delete" | null>(null);
  const [quickNoteText, setQuickNoteText]             = useState("");
  const [quickStatusPending, setQuickStatusPending]   = useState("");
  const [quickActionBusy, setQuickActionBusy]         = useState(false);

  const openQuickAction = useCallback((lead: Record<string, any>, type: "status" | "note" | "delete") => {
    setQuickActionLead(lead);
    setQuickActionType(type);
    if (type === "status") setQuickStatusPending(getStatus(lead));
    if (type === "note")   setQuickNoteText("");
  }, []);

  const closeQuickAction = useCallback(() => {
    setQuickActionLead(null);
    setQuickActionType(null);
    setQuickActionBusy(false);
  }, []);

  const handleQuickSaveStatus = useCallback(async () => {
    if (!quickActionLead || !quickStatusPending) return;
    setQuickActionBusy(true);
    try {
      await updateLead(getLeadId(quickActionLead), { pipeline_stage: quickStatusPending });
      onRefresh?.();
      toast({ title: "Status updated", description: `Moved to ${quickStatusPending}` });
      closeQuickAction();
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
      setQuickActionBusy(false);
    }
  }, [quickActionLead, quickStatusPending, onRefresh, toast, closeQuickAction]);

  const handleQuickSaveNote = useCallback(async () => {
    if (!quickActionLead || !quickNoteText.trim()) return;
    setQuickActionBusy(true);
    try {
      const existing   = quickActionLead.notes || quickActionLead.Notes || "";
      const dateStamp  = new Date().toLocaleDateString();
      const newNotes   = existing
        ? `${existing}\n\n[${dateStamp}] ${quickNoteText.trim()}`
        : `[${dateStamp}] ${quickNoteText.trim()}`;
      await updateLead(getLeadId(quickActionLead), { notes: newNotes });
      onRefresh?.();
      toast({ title: "Note added" });
      closeQuickAction();
    } catch {
      toast({ title: "Failed to add note", variant: "destructive" });
      setQuickActionBusy(false);
    }
  }, [quickActionLead, quickNoteText, onRefresh, toast, closeQuickAction]);

  const handleQuickConfirmDelete = useCallback(async () => {
    if (!quickActionLead) return;
    setQuickActionBusy(true);
    try {
      await deleteLead(getLeadId(quickActionLead));
      onRefresh?.();
      toast({ title: "Lead deleted" });
      closeQuickAction();
    } catch {
      toast({ title: "Failed to delete lead", variant: "destructive" });
      setQuickActionBusy(false);
    }
  }, [quickActionLead, onRefresh, toast, closeQuickAction]);

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
  const [cardAnimKey, setCardAnimKey] = useState(0);
  const PAGE_SIZE = 50;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Pull-to-refresh (mobile) ─────────────────────────────────────────────
  const { pullDistance: leadsPullDistance, isRefreshing: leadsIsRefreshing } = usePullToRefresh({
    containerRef: scrollContainerRef,
    onRefresh: async () => { onRefresh?.(); },
  });

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

  const [upcomingCallsOnly, setUpcomingCallsOnly] = useState<boolean>(() => {
    try { return localStorage.getItem("leads_upcoming_calls_only") === "true"; } catch {} return false;
  });
  useEffect(() => {
    try { localStorage.setItem("leads_upcoming_calls_only", String(upcomingCallsOnly)); } catch {}
  }, [upcomingCallsOnly]);

  // ── Local filter state: account & campaign ────────────────────────────────
  const [filterAccount, setFilterAccount] = useState<string>("");
  const [filterCampaign, setFilterCampaign] = useState<string>("");
  const [tagSearchInput, setTagSearchInput] = useState<string>("");

  // ── Mobile filter bottom sheet state (Feature #42) ───────────────────────
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [mobileAddOpen, setMobileAddOpen] = useState(false);

  const handleFilterApply = useCallback((state: LeadFilterSheetApplyState) => {
    if (state.sortBy !== sortBy) onSortByChange(state.sortBy);
    filterStatus.forEach((s) => { if (!state.filterStatus.includes(s)) onToggleFilterStatus(s); });
    state.filterStatus.forEach((s) => { if (!filterStatus.includes(s)) onToggleFilterStatus(s); });
    filterTags.forEach((tag) => { if (!state.filterTags.includes(tag)) onToggleFilterTag(tag); });
    state.filterTags.forEach((tag) => { if (!filterTags.includes(tag)) onToggleFilterTag(tag); });
    setFilterCampaign(state.filterCampaign);
    setFilterAccount(state.filterAccount);
  }, [sortBy, filterStatus, filterTags, onSortByChange, onToggleFilterStatus, onToggleFilterTag]);

  const handleFilterReset = useCallback(() => {
    filterStatus.forEach((s) => onToggleFilterStatus(s));
    filterTags.forEach((tag) => onToggleFilterTag(tag));
    setFilterAccount("");
    setFilterCampaign("");
    if (sortBy !== "recent") onSortByChange("recent");
  }, [filterStatus, filterTags, onToggleFilterStatus, onToggleFilterTag, sortBy, onSortByChange]);

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

    // 3d. Upcoming calls only — hides Booked leads whose call date has passed
    if (upcomingCallsOnly) {
      const now = new Date();
      filtered = filtered.filter((l) => {
        if (getStatus(l) !== "Booked") return true;
        const d = l.booked_call_date || l.bookedCallDate;
        if (!d) return true;
        return new Date(d) >= now;
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
  }, [leads, listSearch, groupBy, sortBy, filterStatus, filterTags, filterAccount, filterCampaign, leadTagsInfo, campaignsById, upcomingCallsOnly]);

  // Reset to page 0 whenever the filtered/sorted list changes + bump anim key to re-trigger entrance
  useEffect(() => { setCurrentPage(0); setCardAnimKey((k) => k + 1); }, [flatItems]);

  const isFilterActive     = filterStatus.length > 0 || filterTags.length > 0 || !!filterAccount || !!filterCampaign || upcomingCallsOnly;

  return (
    /* Outer shell: transparent — gaps between panels reveal stone-gray page background */
    <div className="relative flex h-full min-h-[600px] gap-[3px] max-w-[1729px] mx-auto w-full">

      {/* ── LEFT: Lead List ── muted panel (#E3E3E3) */}
      {/* On mobile: always visible (MobileLeadDetailPanel is a fixed overlay on top) */}
      <div className="flex flex-col bg-muted rounded-lg overflow-hidden w-full lg:w-[340px] lg:shrink-0">

        {/* ── Panel header: title + ViewTabBar ── */}
        <div className="pl-[17px] pr-3.5 pt-3 lg:pt-10 pb-1 lg:pb-3 shrink-0 flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-0">
          <div className="flex items-center justify-between w-full lg:w-[309px] lg:shrink-0">
            <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">{t("page.title")}</h2>
            <span className="hidden lg:block">
              <ViewTabBar tabs={viewTabs} activeId={viewMode} onTabChange={(id) => onViewModeChange(id as ViewMode)} variant="segment" />
            </span>
            {/* Mobile action buttons: filter + kanban toggle (Feature #42 + #39) */}
            <div className="lg:hidden flex items-center gap-1.5">
              {/* Filter button (Feature #42) */}
              <button
                className={cn(
                  "relative flex items-center justify-center h-8 w-8 rounded-lg border transition-colors shrink-0",
                  (isFilterActive || filterStatus.length > 0 || filterTags.length > 0)
                    ? "border-brand-indigo bg-brand-indigo/10 text-brand-indigo"
                    : "border-border/40 text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setFilterSheetOpen(true)}
                title="Filter leads"
                data-testid="mobile-leads-filter-button"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {isFilterActive && (
                  <span className="absolute -top-1 -right-1 h-3.5 w-3.5 flex items-center justify-center rounded-full bg-brand-indigo text-white text-[8px] font-bold">
                    {filterStatus.length + filterTags.length + (filterAccount ? 1 : 0) + (filterCampaign ? 1 : 0)}
                  </span>
                )}
              </button>
              {/* Kanban toggle (Feature #39) */}
              <button
                className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-lg border transition-colors shrink-0",
                  mobileListMode === "kanban"
                    ? "border-brand-indigo bg-brand-indigo/10 text-brand-indigo"
                    : "border-border/40 text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setMobileListMode(mobileListMode === "kanban" ? "list" : "kanban")}
                title={mobileListMode === "kanban" ? "Switch to list view" : "Switch to kanban view"}
                data-testid="mobile-kanban-toggle"
              >
                {mobileListMode === "kanban" ? <List className="h-3.5 w-3.5" /> : <Kanban className="h-3.5 w-3.5" />}
              </button>
              {/* Add Lead button (Feature #45) */}
              <button
                className="flex items-center justify-center h-8 w-8 rounded-lg border border-border/40 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                onClick={() => setMobileAddOpen(true)}
                title={t("toolbar.add", "Add Lead")}
                data-testid="mobile-add-lead-button"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {/* ViewTabBar below title on mobile */}
          <div className="lg:hidden">
            <ViewTabBar tabs={viewTabs} activeId={viewMode} onTabChange={(id) => onViewModeChange(id as ViewMode)} variant="segment" />
          </div>

          {/* Mobile search bar — Feature #43 */}
          <div className="lg:hidden px-1 pt-1 pb-0.5">
            <div
              className={cn(
                "flex items-center h-9 px-3 gap-2 rounded-lg border transition-colors",
                listSearch
                  ? "border-brand-indigo/40 text-brand-indigo bg-brand-indigo/5"
                  : "border-border/40 text-muted-foreground"
              )}
              data-testid="mobile-leads-search"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <input
                value={listSearch}
                onChange={(e) => onListSearchChange(e.target.value)}
                placeholder={t("toolbar.searchPlaceholder")}
                className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-foreground placeholder:text-muted-foreground/60"
                data-testid="mobile-leads-search-input"
              />
              {listSearch && (
                <button
                  type="button"
                  onClick={() => onListSearchChange("")}
                  data-testid="mobile-leads-search-clear"
                  className="shrink-0"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Upcoming calls filter chip — mobile only */}
        <div className="lg:hidden px-2 pb-1 flex gap-2">
          <button
            onClick={() => setUpcomingCallsOnly(!upcomingCallsOnly)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors",
              upcomingCallsOnly
                ? "bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/40"
                : "bg-card text-muted-foreground border-border/40 hover:border-amber-400/30"
            )}
            data-testid="upcoming-calls-filter-chip"
          >
            <Calendar className="h-3 w-3" />
            Upcoming calls
            {upcomingCallsOnly && <X className="h-3 w-3 ml-0.5" />}
          </button>
        </div>

        {/* Mobile simplified kanban view (Feature #39) — shown when kanban mode active on mobile */}
        {mobileListMode === "kanban" && (
          <div className="flex-1 min-h-0 overflow-hidden lg:hidden">
            <MobileSimpleKanban
              leads={leads}
              leadTagsInfo={leadTagsInfo}
              onSelectLead={onSelectLead}
              onMobileViewChange={onMobileViewChange}
            />
          </div>
        )}

        {/* Lead list — card list (pagination inside scroll area, below last card) */}
        <div ref={scrollContainerRef} className={cn("flex-1 overflow-y-auto px-[3px] pt-0 pb-[3px]", mobileListMode === "kanban" && "hidden lg:flex lg:flex-col")}>
          {/* Pull-to-refresh indicator — mobile only */}
          <PullToRefreshIndicator pullDistance={leadsPullDistance} isRefreshing={leadsIsRefreshing} />
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
              <div key={`anim-${cardAnimKey}-page-${currentPage}`} className="flex flex-col gap-[3px]">
                {flatItems
                  .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
                  .map((item, i) => {
                    const selectedId = selectedLead ? getLeadId(selectedLead) : null;
                    return item.kind === "header" ? (
                      <GroupHeader key={`h-${item.label}-${i}`} label={item.label} count={item.count} />
                    ) : (() => {
                      const lid = getLeadId(item.lead);
                      return (
                      <div key={lid} data-lead-id={lid} className={i < 15 ? "animate-card-enter" : undefined} style={i < 15 ? { animationDelay: `${Math.min(i, 15) * 30}ms` } : undefined}>
                        <LeadListCard
                          lead={item.lead}
                          isActive={selectedId === getLeadId(item.lead)}
                          onClick={() => { onSelectLead(item.lead); onMobileViewChange?.("detail"); }}
                          leadTags={item.tags}
                          showContactAlways={showContactAlways}
                          tagsColorful={tagsColorful}
                          hideTags={hideTags}
                          campaignsById={campaignsById}
                          onOpenConversation={() => handleOpenConversation(getLeadId(item.lead))}
                          onQuickChangeStatus={() => openQuickAction(item.lead, "status")}
                          onQuickAddNote={() => openQuickAction(item.lead, "note")}
                          onQuickDelete={() => openQuickAction(item.lead, "delete")}
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
                    className="icon-circle-lg icon-circle-base disabled:opacity-30 touch-target"
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
                    className="icon-circle-lg icon-circle-base disabled:opacity-30 touch-target"
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
      {/* Mobile full-screen detail overlay — only shown on mobile when a lead is selected */}
      <AnimatePresence>
        {mobileView === "detail" && selectedLead && (
          <MobileLeadDetailPanel
            key={String(getLeadId(selectedLead))}
            lead={selectedLead}
            onBack={() => {
              const returnTo = localStorage.getItem("leadawaker-returnto");
              if (returnTo) {
                localStorage.removeItem("leadawaker-returnto");
                setLocation(returnTo);
              } else {
                onMobileViewChange?.("list");
              }
            }}
            onRefresh={onRefresh}
          />
        )}
      </AnimatePresence>

      {/* Desktop detail panel — always hidden on mobile (mobile uses MobileLeadDetailPanel overlay) */}
      <div className={cn(
        "flex-1 flex-col min-w-0 overflow-hidden bg-card rounded-lg hidden lg:flex max-w-[1386px]"
      )}>
        {loading && !selectedLead ? (
          <SkeletonLeadPanel />
        ) : selectedLead ? (
          <LeadDetailView
            lead={selectedLead}
            onClose={onClose}
            leadTags={leadTagsInfo.get(getLeadId(selectedLead)) || []}
            onRefresh={onRefresh}
            campaignsById={campaignsById}
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

      {/* ── Quick action sheets (Feature #41) ──────────────────────────────── */}
      {createPortal(
        <AnimatePresence>
          {quickActionType && quickActionLead && (
            <>
              {/* Backdrop */}
              <motion.div
                key="quick-action-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-[400] bg-black/50 md:hidden"
                onClick={closeQuickAction}
              />
              {/* Sheet */}
              <motion.div
                key="quick-action-sheet"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "tween", duration: 0.25, ease: [0.0, 0.0, 0.2, 1] }}
                className="fixed inset-x-0 bottom-0 z-[401] bg-background rounded-t-3xl border-t border-border/30 md:hidden"
                style={{ paddingBottom: "calc(1rem + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))" }}
              >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-foreground/20" />
                </div>

                {/* ── Status Picker ── */}
                {quickActionType === "status" && (
                  <div className="px-5 pb-2">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-[17px] font-semibold">Change Status</h2>
                      <button onClick={closeQuickAction} className="h-8 w-8 rounded-full bg-muted grid place-items-center"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="flex flex-col gap-1.5 max-h-[50dvh] overflow-y-auto pb-2">
                      {ALL_LEAD_FILTER_STAGES.map((stage) => {
                        const colors = STATUS_COLORS[stage];
                        const active = quickStatusPending === stage;
                        return (
                          <button
                            key={stage}
                            className={cn(
                              "flex items-center justify-between px-4 py-3 rounded-2xl border text-[15px] min-h-[52px] transition-colors",
                              active
                                ? (colors?.badge ?? "bg-brand-indigo/10 text-brand-indigo border-brand-indigo/40")
                                : "border-border/40 text-foreground"
                            )}
                            onClick={() => setQuickStatusPending(stage)}
                          >
                            <span className="flex items-center gap-2.5">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PIPELINE_HEX[stage] || "#9ca3af" }} />
                              {stage}
                            </span>
                            {active && <Check className="h-5 w-5 text-brand-indigo shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-3 pt-3">
                      <button onClick={closeQuickAction} className="flex-1 h-12 rounded-2xl border border-border/40 text-[15px] font-semibold text-muted-foreground">Cancel</button>
                      <button
                        onClick={handleQuickSaveStatus}
                        disabled={quickActionBusy}
                        className="flex-1 h-12 rounded-2xl bg-brand-indigo text-white text-[15px] font-semibold disabled:opacity-60"
                        data-testid="quick-status-save"
                      >
                        {quickActionBusy ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Add Note ── */}
                {quickActionType === "note" && (
                  <div className="px-5 pb-2">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-[17px] font-semibold">Add Note</h2>
                      <button onClick={closeQuickAction} className="h-8 w-8 rounded-full bg-muted grid place-items-center"><X className="h-4 w-4" /></button>
                    </div>
                    <textarea
                      autoFocus
                      value={quickNoteText}
                      onChange={(e) => setQuickNoteText(e.target.value)}
                      placeholder="Note about this lead…"
                      rows={4}
                      className="w-full px-4 py-3 rounded-2xl border border-border/40 bg-muted/30 text-[15px] placeholder:text-muted-foreground/50 outline-none focus:border-brand-indigo/50 resize-none"
                      data-testid="quick-note-input"
                    />
                    <div className="flex gap-3 pt-3">
                      <button onClick={closeQuickAction} className="flex-1 h-12 rounded-2xl border border-border/40 text-[15px] font-semibold text-muted-foreground">Cancel</button>
                      <button
                        onClick={handleQuickSaveNote}
                        disabled={quickActionBusy || !quickNoteText.trim()}
                        className="flex-1 h-12 rounded-2xl bg-brand-indigo text-white text-[15px] font-semibold disabled:opacity-60"
                        data-testid="quick-note-save"
                      >
                        {quickActionBusy ? "Saving…" : "Save Note"}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Delete Confirm ── */}
                {quickActionType === "delete" && (
                  <div className="px-5 pb-2">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-[17px] font-semibold text-red-600">Delete Lead?</h2>
                      <button onClick={closeQuickAction} className="h-8 w-8 rounded-full bg-muted grid place-items-center"><X className="h-4 w-4" /></button>
                    </div>
                    <p className="text-[14px] text-muted-foreground mb-5">
                      Are you sure you want to delete <strong>{getFullName(quickActionLead)}</strong>? This cannot be undone.
                    </p>
                    <div className="flex gap-3">
                      <button onClick={closeQuickAction} className="flex-1 h-12 rounded-2xl border border-border/40 text-[15px] font-semibold text-muted-foreground">Cancel</button>
                      <button
                        onClick={handleQuickConfirmDelete}
                        disabled={quickActionBusy}
                        className="flex-1 h-12 rounded-2xl bg-red-500 text-white text-[15px] font-semibold disabled:opacity-60"
                        data-testid="quick-delete-confirm"
                      >
                        {quickActionBusy ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Lead filter bottom sheet (Feature #42) ─────────────────────────── */}
      <LeadFilterBottomSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filterStatus={filterStatus}
        filterTags={filterTags}
        sortBy={sortBy}
        filterCampaign={filterCampaign}
        filterAccount={filterAccount}
        allTags={allTags}
        availableCampaigns={availableCampaigns}
        availableAccounts={availableAccounts}
        onApply={handleFilterApply}
        onReset={handleFilterReset}
      />

      {/* ── Mobile Add Lead Form (Feature #45) ───────────────────────────────── */}
      <MobileAddLeadForm
        open={mobileAddOpen}
        onClose={() => setMobileAddOpen(false)}
        campaignsById={campaignsById}
        onCreated={(newLead) => {
          onRefresh?.();
          if (newLead?.id || newLead?.Id) {
            onSelectLead(newLead);
            onMobileViewChange?.("detail");
          }
        }}
      />
    </div>
  );
}
