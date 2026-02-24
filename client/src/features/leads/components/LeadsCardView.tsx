import { useState, useMemo, useCallback, useRef, useEffect, type ReactNode } from "react";
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
  LayoutGrid,
  Plus,
  Trash2,
  RefreshCw,
  CalendarClock,
  FileText,
  MoreHorizontal,
  Pencil,
  ArrowRight,
  X,
  TrendingUp,
  ClipboardList,
} from "lucide-react";
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
import { IconBtn } from "@/components/ui/icon-btn";
import { useInteractions } from "@/hooks/useApiData";
import { sendMessage } from "@/features/conversations/api/conversationsApi";
import type { Interaction } from "@/types/models";

export type ViewMode = "list" | "table" | "kanban";

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
}

// ── Pipeline stages ────────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { key: "New",                short: "New" },
  { key: "Contacted",          short: "Contacted" },
  { key: "Responded",          short: "Responded" },
  { key: "Multiple Responses", short: "Multi" },
  { key: "Qualified",          short: "Qualified" },
  { key: "Booked",             short: "Booked ★" },
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
  Lost:                 { bg: "bg-red-500/10",     text: "text-red-700 dark:text-red-400",      dot: "bg-red-500",     badge: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800" },
  DND:                  { bg: "bg-zinc-500/10",    text: "text-zinc-600 dark:text-zinc-400",    dot: "bg-zinc-500",    badge: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700" },
};

// ── Pipeline stage hex colors (dots, lines, avatar tints) ─────────────────────
export const PIPELINE_HEX: Record<string, string> = {
  New:                  "#6B7280",
  Contacted:            "#5170FF",
  Responded:            "#14B8A6",
  "Multiple Responses": "#22C55E",
  Qualified:            "#84CC16",
  Booked:               "#FCB803",
  Lost:                 "#EF4444",
  DND:                  "#71717A",
};

// ── Status-based avatar colors — fully opaque pastels ────────────────────────
export function getStatusAvatarColor(status: string): { bg: string; text: string } {
  const solids: Record<string, { bg: string; text: string }> = {
    New:                  { bg: "#E5E7EB", text: "#374151" },
    Contacted:            { bg: "#DBEAFE", text: "#1D4ED8" },
    Responded:            { bg: "#CCFBF1", text: "#0F766E" },
    "Multiple Responses": { bg: "#DCFCE7", text: "#15803D" },
    Qualified:            { bg: "#ECFCCB", text: "#3F6212" },
    Booked:               { bg: "#FEF9C3", text: "#854D0E" },
    Lost:                 { bg: "#FEE2E2", text: "#991B1B" },
    DND:                  { bg: "#F4F4F5", text: "#52525B" },
  };
  return solids[status] ?? { bg: "#E5E7EB", text: "#374151" };
}

// ── Score color — blue (#5170FF) at 0 → yellow (#FCB803) at 100 ───────────────
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
function formatBookedDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

// ── Score Gauge — circular with 48 fine tick segments ────────────────────────
function ScoreDonut({ score }: { score: number }) {
  const cx = 60, cy = 60, r = 48;
  const numSegs = 48;
  const filledCount = Math.round((score / 100) * numSegs);
  const grade = getGrade(score);

  const segments = Array.from({ length: numSegs }, (_, i) => {
    const gapFrac = 0.20;
    const a0 = (i / numSegs) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((i + 1 - gapFrac) / numSegs) * 2 * Math.PI - Math.PI / 2;
    const x1 = (cx + r * Math.cos(a0)).toFixed(2);
    const y1 = (cy + r * Math.sin(a0)).toFixed(2);
    const x2 = (cx + r * Math.cos(a1)).toFixed(2);
    const y2 = (cy + r * Math.sin(a1)).toFixed(2);
    return { d: `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`, filled: i < filledCount };
  });

  return (
    <svg viewBox="0 0 120 120" className="w-full max-w-[148px] mx-auto">
      {segments.map(({ d, filled }, i) => (
        <path key={i} d={d} fill="none"
          stroke={filled ? "#14B8A6" : "rgba(0,0,0,0.08)"}
          strokeWidth={7} strokeLinecap="round"
        />
      ))}
      {/* Score number — slightly left of center */}
      <text x={50} y={58} textAnchor="middle"
        fontSize="30" fontWeight="900" fontFamily="inherit" fill="#111827" letterSpacing="-1">
        {score}
      </text>
      {/* Grade label — right of score */}
      <text x={81} y={48} textAnchor="middle"
        fontSize="9" fontWeight="600" fontFamily="inherit" fill="#9CA3AF" letterSpacing="0.8">
        Grade
      </text>
      <text x={81} y={62} textAnchor="middle"
        fontSize="18" fontWeight="800" fontFamily="inherit" fill="#374151">
        {grade}
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
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold", c.badge)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", c.dot ?? "bg-muted-foreground")} />
      {label}
    </span>
  );
}

// ── Pipeline progress — horizontal dot-line ──────────────────────────────────
function PipelineProgress({ status }: { status: string }) {
  const currentIndex = PIPELINE_STAGES.findIndex((s) => s.key === status);
  const isLost = LOST_STAGES.includes(status);
  const effectiveIndex = isLost ? -1 : currentIndex;

  return (
    <div className="w-full px-1">
      {/* Dot + label + connecting line — label sits directly below its dot */}
      <div className="flex items-start">
        {PIPELINE_STAGES.map((stage, i) => {
          const hex = PIPELINE_HEX[stage.key] || "#6B7280";
          const isPast = i < effectiveIndex;
          const isCurrent = i === effectiveIndex;

          return (
            <div key={stage.key} className="flex items-start flex-1" style={{ minWidth: 0 }}>
              {/* Dot + label column */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="h-[14px] flex items-center justify-center">
                  {isCurrent ? (
                    <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: hex, boxShadow: `0 0 0 3px ${hex}25, 0 0 8px ${hex}40` }} />
                  ) : isPast ? (
                    <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: hex }} />
                  ) : (
                    <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "transparent", border: "2px solid #D1D5DB" }} />
                  )}
                </div>
                <span
                  className="text-[8px] leading-none text-center"
                  style={{ color: isCurrent ? hex : "rgba(0,0,0,0.3)", fontWeight: isCurrent ? 700 : 500 }}
                >
                  {stage.short}
                </span>
              </div>
              {/* Connecting line to next dot */}
              {i < PIPELINE_STAGES.length - 1 && (
                <div
                  className="flex-1 mt-[6px]"
                  style={{
                    height: 2, minWidth: 4,
                    backgroundColor: isPast ? (PIPELINE_HEX[PIPELINE_STAGES[i + 1]?.key] || hex) : "#E5E7EB",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      {/* Lost/DND indicator */}
      {isLost && (
        <div
          className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-md"
          style={{ backgroundColor: `${PIPELINE_HEX[status]}15` }}
        >
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: PIPELINE_HEX[status] }} />
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
function ContactWidget({ lead }: { lead: Record<string, any> }) {
  const phone       = lead.phone || lead.Phone || "";
  const email       = lead.email || lead.Email || "";
  const company     = lead.company || lead.Company || lead.company_name || "";
  const firstName   = lead.first_name || lead.firstName || "";
  const lastName    = lead.last_name || lead.lastName || "";
  const jobTitle    = lead.job_title || lead.jobTitle || lead.title || "";
  const interaction = lead.lead_interaction || lead.interaction_summary || lead.ai_summary || lead.notes || "";
  const lastContact = lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at;

  const rows: { icon: ReactNode; label: string; value: string; copy?: string }[] = [
    firstName   && { icon: <UserIcon    className="h-3.5 w-3.5" />, label: "First Name",   value: firstName },
    lastName    && { icon: <UserIcon    className="h-3.5 w-3.5" />, label: "Last Name",    value: lastName },
    jobTitle    && { icon: <BookUser    className="h-3.5 w-3.5" />, label: "Job Title",    value: jobTitle },
    phone       && { icon: <Phone       className="h-3.5 w-3.5" />, label: "Phone",        value: phone,   copy: phone },
    email       && { icon: <Mail        className="h-3.5 w-3.5" />, label: "Email",        value: email,   copy: email },
    company     && { icon: <Users       className="h-3.5 w-3.5" />, label: "Company",      value: company },
    interaction && { icon: <MessageSquare className="h-3.5 w-3.5" />, label: "Interaction", value: interaction },
    lastContact && { icon: <CalendarClock className="h-3.5 w-3.5" />, label: "Last Contact", value: formatRelativeTime(lastContact) },
  ].filter(Boolean) as { icon: ReactNode; label: string; value: string; copy?: string }[];

  return (
    <div className="bg-white/60 rounded-xl p-4 flex flex-col gap-3 h-full">
      <p className="text-[17px] font-semibold font-heading text-foreground">Contact</p>
      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground/60 italic">No contact info</p>
      )}
      {rows.map((row) => (
        <div key={row.label} className="group/row flex items-center gap-2">
          <span className="text-foreground/70 shrink-0">{row.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-muted-foreground font-medium leading-none mb-0.5">{row.label}</div>
            <div className={cn("text-[12px] text-foreground truncate", row.label === "Phone" && "font-mono")}>
              {row.value}
            </div>
          </div>
          {row.copy && <CopyContactBtn value={row.copy} />}
        </div>
      ))}
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

// ── Score widget ───────────────────────────────────────────────────────────────
function ScoreWidget({ score, lead }: { score: number; lead?: Record<string, any> }) {
  const insights = lead && score > 0 ? buildInsights(lead, score) : [];

  if (score === 0) {
    return (
      <div className="bg-white/60 rounded-xl p-4 flex flex-col gap-3 h-full">
        <div className="flex items-center justify-between">
          <p className="text-[17px] font-semibold font-heading text-foreground">Lead Score</p>
          <div className="flex items-center gap-0.5">
            <button className="h-7 w-7 rounded-full hover:bg-black/5 flex items-center justify-center text-muted-foreground">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            <button className="h-7 w-7 rounded-full hover:bg-black/5 flex items-center justify-center text-muted-foreground">
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-[3px]">
          <p className="text-2xl font-black text-muted-foreground/25">—</p>
          <p className="text-[10px] text-muted-foreground/50">Not scored</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/50 rounded-xl p-4 flex flex-col gap-2 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <p className="text-[17px] font-semibold font-heading text-foreground">Lead Score</p>
        <div className="flex items-center gap-0.5">
          <button className="h-7 w-7 rounded-full hover:bg-black/5 flex items-center justify-center text-muted-foreground">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          <button className="h-7 w-7 rounded-full hover:bg-black/5 flex items-center justify-center text-muted-foreground">
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Donut + trend badge */}
      <div className="flex flex-col items-center gap-1.5 shrink-0">
        <ScoreDonut score={score} />
        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFF375] text-[11px] font-semibold text-foreground">
          <ArrowRight className="h-3 w-3" />
          Steady
        </div>
      </div>

      {/* Insight bullets */}
      {insights.length > 0 && (
        <div className="flex flex-col gap-2 mt-1 flex-1 min-h-0 overflow-hidden">
          {insights.map((ins, i) => (
            <div key={i} className="flex items-start gap-2">
              <svg className="h-3 w-3 shrink-0 mt-0.5" viewBox="0 0 12 12" fill="#14B8A6">
                <polygon points="6,1 12,11 0,11" />
              </svg>
              <p className="text-[11px] text-foreground/65 leading-tight">
                {ins.text} <span className="font-semibold text-foreground">{ins.value}</span>
              </p>
            </div>
          ))}
        </div>
      )}
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
          isAi ? "bg-amber-100 dark:bg-amber-900/40" : "bg-blue-100 dark:bg-blue-900/40"
        )}>
          {isAi
            ? <Bot className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            : <UserIcon className="h-3 w-3 text-blue-500 dark:text-blue-400" />
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
              ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100 rounded-tr-sm"
              : "bg-brand-blue text-white rounded-tr-sm"
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
function ConversationWidget({ lead }: { lead: Record<string, any> }) {
  const leadId = getLeadId(lead);
  const { interactions, loading, refresh } = useInteractions(undefined, leadId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sorted = useMemo(
    () => [...interactions].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")),
    [interactions]
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sorted.length]);

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

  return (
    <div className="flex flex-col h-full min-h-0">
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

      <div className="p-3 flex items-end gap-2 bg-card/95 rounded-b-xl shrink-0">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send)"
          rows={1}
          className="flex-1 text-[12px] bg-muted rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-blue/30 placeholder:text-muted-foreground/50"
          style={{ minHeight: "36px", maxHeight: "80px" }}
          data-testid="input-message-compose"
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          className="h-9 w-9 rounded-lg bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 disabled:opacity-40 shrink-0"
          title="Send message"
          data-testid="btn-send-message"
        >
          {sending
            ? <div className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <Send className="h-3.5 w-3.5 text-white" />
          }
        </button>
      </div>
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
        <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-amber-500 flex items-center justify-center shadow-md ring-2 ring-background">
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
  leadTags,
}: {
  lead: Record<string, any>;
  onClose: () => void;
  leadTags: { name: string; color: string }[];
}) {
  const name = getFullName(lead);
  const initials = getInitials(name);
  const status = getStatus(lead);
  const score = getScore(lead);
  const avatarColor = getStatusAvatarColor(status);
  const lastActivity = lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at;
  const sentiment = lead.ai_sentiment || lead.aiSentiment || "";
  const isBooked = status === "Booked";
  const ratingLabel = score >= 70 ? "Hot" : score >= 40 ? "Warm" : "Cold";

  return (
    <div className="relative flex flex-col h-full overflow-hidden">

      {/* ── Full-height gradient: vivid yellow top-left → beige mid → blue lower ── */}
      {/* Base: warm cream-white keeps transitions in a warm family */}
      <div className="absolute inset-0 bg-[#F8F3EB]" />
      {/* Top-right: bright white corner — expanded to full right edge */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_72%_56%_at_100%_0%,#FFFFFF_0%,rgba(255,255,255,0.80)_30%,transparent_60%)]" />
      {/* Soft pastel yellow — lighter, airier, bleeds wide across the top */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_80%_at_0%_0%,#FFF0A0_0%,#FFF7CC_40%,rgba(255,248,210,0.40)_64%,transparent_80%)]" />
      {/* Warm beige right side — picks up where yellow feathers out */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_62%_72%_at_100%_36%,rgba(241,218,162,0.62)_0%,transparent_64%)]" />
      {/* Golden-amber bridge — smooths the yellow → blue seam */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_92%_36%_at_48%_53%,rgba(210,188,130,0.22)_0%,transparent_72%)]" />
      {/* Blue raised higher — center of bloom at 88% vertical */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_98%_74%_at_50%_88%,rgba(105,170,255,0.60)_0%,transparent_74%)]" />
      {/* Upper blue fill — pushes blue into mid-panel at 60% */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_54%_at_54%_60%,rgba(165,205,255,0.38)_0%,transparent_66%)]" />

      {/* ── Header content ── */}
      <div className="shrink-0">
        {/* Content sits above gradients */}
        <div className="relative px-4 pt-6 pb-5 space-y-3">

          {/* Row 1: CRM action toolbar — topmost, outline/line-art style */}
          <div className="flex items-center gap-1 flex-wrap">
            <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-muted/50 transition-colors">
              <Check className="h-3 w-3" />
              Save
            </button>
            <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-muted/50 transition-colors">
              <Plus className="h-3 w-3" />
              New
            </button>
            <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-muted/50 transition-colors">
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
            <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-muted/50 transition-colors">
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
            <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-muted/50 transition-colors">
              <FileText className="h-3 w-3" />
              To PDF
            </button>
          </div>

          {/* Row 2: Avatar + Name */}
          <div className="flex items-start gap-3">

            {/* Avatar */}
            <div
              className="h-14 w-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
              style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
            >
              {initials}
            </div>

            {/* Name + badge row — badge left, meta right (same vertical line) */}
            <div className="flex-1 min-w-0 py-1">
              <h2 className="text-[27px] font-semibold font-heading text-foreground leading-tight truncate">
                {name}
              </h2>
              {/* Badge row: Lead tag + sentiment left | meta strip (centered-right) */}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {/* Left: Lead badge + sentiment + time */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded border border-border/50 text-[10px] font-medium text-muted-foreground">
                    Lead
                  </span>
                  {sentiment && (
                    <span className="text-[11px] text-foreground/60 font-medium">
                      {sentiment === "Positive" ? "😊" : sentiment === "Negative" ? "😞" : "😐"}
                      {" "}<span className="capitalize">{sentiment}</span>
                    </span>
                  )}
                  {lastActivity && (
                    <span className="text-[11px] text-foreground/50">{formatRelativeTime(lastActivity)}</span>
                  )}
                </div>
                {/* Meta: Source / Rating / Campaign / Owner — centered-right, no dividers */}
                <div className="flex items-center gap-[25px] ml-4">
                  <div>
                    <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Source</div>
                    <div className="text-[13px] font-bold text-foreground">{lead.source || lead.Source || "API"}</div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Rating</div>
                    <div className="text-[13px] font-bold text-foreground">{ratingLabel}</div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Campaign</div>
                    <div className="text-[13px] font-bold text-foreground truncate max-w-[90px]">{lead.Campaign || lead.campaign || "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: "rgba(0,0,0,0.08)", color: "#374151" }}
                    >
                      {getInitials(lead.Account || lead.account_name || "—")}
                    </div>
                    <div>
                      <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Owner</div>
                      <div className="text-[13px] font-bold text-foreground truncate max-w-[80px]">{lead.Account || lead.account_name || "—"}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Row 3: Tags */}
          {leadTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {leadTags.map((t) => <TagPill key={t.name} tag={t} />)}
            </div>
          )}

          {/* Row 4: Pipeline progress + booked date inline */}
          {status && (
            <div>
              {isBooked && lead.booked_call_date && (
                <div className="flex justify-end mb-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                    <CalendarClock className="h-3 w-3 text-amber-500" />
                    Booked · {formatBookedDate(lead.booked_call_date)}
                  </span>
                </div>
              )}
              <PipelineProgress status={status} />
            </div>
          )}
        </div>
      </div>

      {/* ── Body — 3-column layout: [Contact+Activity] | [Chat] | [Score+Notes] ── */}
      <div className="relative flex-1 overflow-hidden min-h-0 p-[3px] flex flex-col">
        <div className="flex-1 grid gap-[3px]" style={{ gridTemplateColumns: "1fr 1.4fr 1fr" }}>

            {/* Left column: Contact (top) + Activity (bottom) */}
            <div className="flex flex-col gap-[3px]">
              <div className="flex-1 min-h-0"><ContactWidget lead={lead} /></div>
              <div className="flex-1 min-h-0">
                <div className="bg-white/60 rounded-xl p-4 flex flex-col gap-3 h-full">
                  <p className="text-[17px] font-semibold font-heading text-foreground">Activity</p>
                  <div className="flex flex-col gap-2 mt-1">
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
              </div>
            </div>

            {/* Center column: Chat spanning full height */}
            <div className="bg-white/60 rounded-xl overflow-hidden flex flex-col">
              <div className="px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
                <p className="text-[17px] font-semibold font-heading text-foreground">Chat</p>
                <span className="text-[10px] text-muted-foreground/50 truncate max-w-[80px]">
                  {lead.phone || lead.Phone || ""}
                </span>
              </div>
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <ConversationWidget lead={lead} />
              </div>
            </div>

            {/* Right column: Lead Score (top) + Notes (bottom) */}
            <div className="flex flex-col gap-[3px]">
              <div className="flex-1 min-h-0"><ScoreWidget score={score} lead={lead} /></div>
              <div className="flex-1 min-h-0">
                <div className="bg-white/60 rounded-xl p-4 flex flex-col gap-3 h-full overflow-hidden">
                  <p className="text-[17px] font-semibold font-heading text-foreground">Notes</p>
                  {lead.notes || lead.Notes ? (
                    <p className="text-[12px] text-foreground/80 leading-relaxed overflow-hidden" style={{ display: "-webkit-box", WebkitLineClamp: 8, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {lead.notes || lead.Notes}
                    </p>
                  ) : (
                    <p className="text-[12px] text-muted-foreground/50 italic mt-1">No notes yet</p>
                  )}
                </div>
              </div>
            </div>

          </div>
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
}: {
  lead: Record<string, any>;
  isActive: boolean;
  onClick: () => void;
  leadTags: { name: string; color: string }[];
}) {
  const name = getFullName(lead);
  const initials = getInitials(name);
  const status = getStatus(lead);
  const score = getScore(lead);
  const phone = getPhone(lead);
  const lastMsg = getLastMessage(lead);
  const avatarColor = getStatusAvatarColor(status);
  const lastActivity = lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at;

  return (
    <div
      className={cn(
        "relative mx-[3px] my-0.5 rounded-xl cursor-pointer transition-colors",
        isActive ? "bg-[#FFF6C8]" : "bg-[#F1F1F1] hover:bg-[#FAFAFA]"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div className="px-2.5 pt-4 pb-2 flex flex-col gap-2">

        {/* Phone — absolute top-right corner */}
        {phone && (
          <div className="absolute top-3.5 right-2.5 group/phone z-10">
            <div className="h-[34px] w-[34px] rounded-full border border-foreground/25 flex items-center justify-center bg-transparent">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="absolute right-0 bottom-9 z-20 hidden group-hover/phone:block">
              <div className="bg-popover text-foreground text-[11px] px-2.5 py-1.5 rounded-lg shadow-md whitespace-nowrap">
                {phone}
              </div>
            </div>
          </div>
        )}

        {/* Top row: Avatar + Name/Status (pr-8 keeps text clear of phone icon) */}
        <div className="flex items-start gap-2 pr-8">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
            style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-[17px] font-semibold font-heading leading-tight truncate text-foreground">
              {name}
            </p>
            {status && (
              <p className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5">
                {status}
              </p>
            )}
          </div>
        </div>

        {/* Last message snippet */}
        {lastMsg && (
          <p className="text-[10px] text-muted-foreground truncate italic">
            {lastMsg}
          </p>
        )}

        {/* Bottom row: tags (left) | last updated (middle) | score (right) */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
            {leadTags.slice(0, 2).map((t) => (
              <span
                key={t.name}
                className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] font-medium bg-black/[0.06] text-foreground/55"
              >
                {t.name}
              </span>
            ))}
          </div>
          {lastActivity && (
            <span className="text-[10px] text-muted-foreground/70 shrink-0 tabular-nums">
              {formatRelativeTime(lastActivity)}
            </span>
          )}
          {score > 0 && (
            <div
              className="h-[34px] w-[34px] rounded-full flex items-center justify-center text-[9px] font-bold tabular-nums shrink-0"
              style={
                isActive
                  ? { backgroundColor: "#000", color: "#fff" }
                  : { backgroundColor: getScorePastelBg(score), color: getScoreDarkText(score) }
              }
            >
              {score}
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
          <div className="h-9 w-9 rounded-lg bg-foreground/10 shrink-0" />
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
}: {
  lead: Record<string, any>;
  onClose: () => void;
  leadTags: { name: string; color: string }[];
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
              className="h-10 w-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
              style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
            >
              {initials}
            </div>
            <div>
              <p className="text-[15px] font-semibold font-heading text-foreground leading-tight truncate max-w-[180px]">{name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{status || "—"}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-full border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
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
              className="h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
              style={{ backgroundColor: "rgba(0,0,0,0.08)", color: "#374151" }}
            >
              {getInitials(lead.Account || lead.account_name || "—")}
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
                ? "bg-[#FFF375] text-foreground"
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
            <ScoreWidget score={score} lead={lead} />
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
const VIEW_TABS: { id: ViewMode; label: string; icon: typeof List }[] = [
  { id: "list",   label: "List",   icon: List },
  { id: "table",  label: "Table",  icon: Table2 },
  { id: "kanban", label: "Kanban", icon: LayoutGrid },
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
}: LeadsCardViewProps) {
  const [currentPage, setCurrentPage]   = useState(0);
  const PAGE_SIZE = 20;

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
      <div className="flex flex-col bg-muted rounded-lg overflow-hidden w-[300px] flex-shrink-0">

        {/* ── Panel header: title + count badge ── */}
        <div className="px-3.5 pt-7 pb-1 shrink-0 flex items-center justify-between">
          <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">My Leads</h2>
          {/* Lead count — full-size circle button, same as other controls */}
          <span className="h-8 w-8 rounded-full border border-border/50 flex items-center justify-center text-[10px] font-semibold text-foreground tabular-nums shrink-0">
            {leads.length}
          </span>
        </div>

        {/* ── Controls row: tabs (left) + search/settings (right) — all on one line ── */}
        <div className="px-3 pt-1.5 pb-3 shrink-0 flex items-center justify-between gap-2">

          {/* Tab switchers */}
          <div className="flex items-center gap-1">
            {VIEW_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = viewMode === tab.id;
              return isActive ? (
                <button
                  key={tab.id}
                  onClick={() => onViewModeChange(tab.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFF375] text-foreground text-[12px] font-semibold"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ) : (
                <button
                  key={tab.id}
                  onClick={() => onViewModeChange(tab.id)}
                  title={tab.label}
                  className="h-6 w-6 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <Icon className="h-3 w-3" />
                </button>
              );
            })}
          </div>

          {/* Search + Settings — flat row, all buttons same height */}
          <div className="flex items-center gap-1.5 shrink-0">

            {/* Search popup */}
            <Popover open={searchOpen} onOpenChange={(open) => { onSearchOpenChange(open); if (!open) onListSearchChange(""); }}>
              <PopoverTrigger asChild>
                <IconBtn active={searchOpen || !!listSearch} title="Search leads">
                  <Search className="h-3.5 w-3.5" />
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
                <IconBtn active={hasNonDefaultControls} title="Group, Sort & Filter">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
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

        {/* Lead list — card list */}
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
              {flatItems
                .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
                .map((item, i) => {
                  const selectedId = selectedLead ? getLeadId(selectedLead) : null;
                  return item.kind === "header" ? (
                    <GroupHeader key={`h-${item.label}-${i}`} label={item.label} count={item.count} />
                  ) : (
                    <LeadListCard
                      key={getLeadId(item.lead)}
                      lead={item.lead}
                      isActive={selectedId === getLeadId(item.lead)}
                      onClick={() => onSelectLead(item.lead)}
                      leadTags={item.tags}
                    />
                  );
                })}
            </>
          )}
        </div>

        {/* Pagination footer */}
        {flatItems.length > PAGE_SIZE && (
          <div className="shrink-0 px-3 py-1 flex items-center justify-between gap-2 border-t border-border/20">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="icon-circle-md icon-circle-base disabled:opacity-30"
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
              className="icon-circle-md icon-circle-base disabled:opacity-30"
              title="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── RIGHT: Detail panel ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-card rounded-lg">
        {selectedLead ? (
          <LeadDetailView
            lead={selectedLead}
            onClose={onClose}
            leadTags={leadTagsInfo.get(getLeadId(selectedLead)) || []}
          />
        ) : (
          <EmptyDetailState leadsCount={leads.length} />
        )}
      </div>
    </div>
  );
}
