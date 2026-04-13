import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2,
  List,
  Table2,
  Kanban,
  Clock,
  FileText,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Mail,
  Phone,
  Plus,
  Check,
  Globe,
  Linkedin,
  Paintbrush,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  MapPin,
  X,
  UserPlus,
  RefreshCw,
  Lightbulb,
  Sparkles,
  Target,
  CheckSquare,
  MessageSquare,
} from "lucide-react";
import { GradientTester, GradientControlPoints, layerToStyle, type GradientLayer } from "@/components/ui/gradient-tester";

/** Matches the hardcoded CSS fallback gradients for this page */
const PAGE_DEFAULT_LAYERS: GradientLayer[] = [
  { id: 0, label: "Base", enabled: true, type: "solid", solidColor: "#ffffff", ellipseW: 100, ellipseH: 100, posX: 50, posY: 50, colorStops: [] },
  { id: 1, label: "Pink-Yellow sweep", enabled: true, type: "linear", angle: 157, ellipseW: 100, ellipseH: 100, posX: 50, posY: 50, colorStops: [
    { color: "#fc3eff", opacity: 0.12, position: 0 },
    { color: "#f2e19b", opacity: 0.55, position: 100 },
  ]},
  { id: 2, label: "Warm corner BR", enabled: true, type: "radial", ellipseW: 148, ellipseH: 200, posX: 100, posY: 100, colorStops: [
    { color: "#ffc886", opacity: 0.4, position: 0 },
    { color: "#ffc886", opacity: 0, position: 80 },
  ]},
  { id: 3, label: "Purple corner TL", enabled: true, type: "radial", ellipseW: 200, ellipseH: 200, posX: 0, posY: 0, colorStops: [
    { color: "#9e8fff", opacity: 0.1, position: 0 },
    { color: "#9e8fff", opacity: 0, position: 80 },
  ]},
];

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ViewTabBar } from "@/components/ui/view-tab-bar";
import { SearchPill } from "@/components/ui/search-pill";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ProspectDetailView, ProspectDetailViewEmpty } from "./ProspectDetailView";
import { usePublishEntityData } from "@/contexts/PageEntityContext";
import { OUTREACH_HEX, OUTREACH_LABELS, OUTREACH_STATUSES, type OutreachStatus } from "./OutreachPipelineView";
import { ProspectCreatePanel } from "./ProspectCreatePanel";
import { getInitials, getAccountAvatarColor } from "@/lib/avatarUtils";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { SkeletonAccountPanel } from "@/components/ui/skeleton";
import { ProspectTasks } from "./ProspectTasks";
import { EmailComposeModal } from "./EmailComposeModal";
import { InteractionTimeline } from "./InteractionTimeline";
import { WhatsAppComposer } from "./WhatsAppComposer";
import { EnrichmentPanel } from "./EnrichmentPanel";
import { ProspectBusinessIdeas } from "./ProspectBusinessIdeas";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { OutreachTimeline } from "./OutreachTimeline";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProspectRow {
  [key: string]: any;
  Id?: number;
  id?: number;
  name?: string;
  company?: string;
  niche?: string;
  country?: string;
  city?: string;
  website?: string;
  phone?: string;
  email?: string;
  linkedin?: string;
  contact_name?: string;
  contact_role?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_linkedin?: string;
  contact2_name?: string;
  contact2_role?: string;
  contact2_email?: string;
  contact2_phone?: string;
  contact2_linkedin?: string;
  source?: string;
  status?: string;
  priority?: string;
  notes?: string;
  next_action?: string;
  action?: string;
  Accounts_id?: number;
  created_at?: string;
  updated_at?: string;
  photo_url?: string;
  headline?: string;
  connection_count?: number;
  follower_count?: number;
  top_post?: string;
  ai_summary?: string;
}

export interface NewProspectForm {
  name: string;
  company: string;
  niche: string;
  country: string;
  city: string;
  website: string;
  phone: string;
  email: string;
  linkedin: string;
  contact_name: string;
  contact_role: string;
  contact_email: string;
  contact_phone: string;
  contact_linkedin: string;
  contact2_name: string;
  contact2_role: string;
  contact2_email: string;
  contact2_phone: string;
  contact2_linkedin: string;
  source: string;
  status: string;
  priority: string;
  notes: string;
  next_action: string;
}

export type ProspectViewMode = "list" | "table" | "pipeline" | "followups" | "templates";
export type ProspectGroupBy = "status" | "niche" | "country" | "priority" | "date" | "none";
export type ProspectSortBy = "recent" | "name_asc" | "name_desc" | "priority";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getProspectId(p: ProspectRow): number {
  return p.Id ?? p.id ?? 0;
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

function getDateBucket(dateStr: string | null | undefined): string {
  if (!dateStr) return "Unknown";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Unknown";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This Week";
  if (diffDays < 30) return "This Month";
  if (diffDays < 90) return "Last 3 Months";
  return "Older";
}

const DATE_BUCKET_ORDER = ["Today", "Yesterday", "This Week", "This Month", "Last 3 Months", "Older", "Unknown"];

// ── Status colors ─────────────────────────────────────────────────────────────

const PROSPECT_STATUS_HEX: Record<string, string> = {
  New:              "#3B82F6",
  Contacted:        "#818CF8",
  Responded:        "#3ACBDF",
  "Call Booked":    "#31D35C",
  "Demo Given":     "#AED62E",
  "Proposal Sent":  "#F7BF0E",
  Lost:             "#DC2626",
  Archived:         "#64748B",
};

const PRIORITY_HEX: Record<string, string> = {
  Urgent: "#EF4444", urgent: "#EF4444",
  High:   "#F97316", high:   "#F97316",
  Medium: "#F59E0B", medium: "#F59E0B",
  Low:    "#9CA3AF", low:    "#9CA3AF",
};

const SIGNAL_FILLED: Record<string, number> = {
  low: 0, Low: 0, medium: 1, Medium: 1, high: 2, High: 2, urgent: 3, Urgent: 3,
};
const SIGNAL_COLOR: Record<string, string> = {
  low: "#9CA3AF", Low: "#9CA3AF",
  medium: "#F59E0B", Medium: "#F59E0B",
  high: "#F97316", High: "#F97316",
  urgent: "#EF4444", Urgent: "#EF4444",
};

function SignalBars({ priority }: { priority: string }) {
  const filled = SIGNAL_FILLED[priority] ?? 0;
  const color = SIGNAL_COLOR[priority] || "#9CA3AF";
  return (
    <div className="flex items-end gap-[2px]" title={priority || "No priority"}>
      {[5, 8, 11].map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-[1px]"
          style={{ height: `${h}px`, backgroundColor: i < filled ? color : "#D1D5DB" }}
        />
      ))}
    </div>
  );
}

const INLINE_STATUS_OPTIONS = ["New", "Contacted", "Responded", "Call Booked", "Demo Given", "Proposal Sent", "Lost", "Archived"];
const INLINE_PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

// ── Niche color palette (same as table view) ─────────────────────────────────

const NICHE_COLORS: { hex: string; bg: string; text: string }[] = [
  { hex: "#6366F1", bg: "#EEF2FF", text: "#4338CA" }, // indigo
  { hex: "#F59E0B", bg: "#FFFBEB", text: "#B45309" }, // amber
  { hex: "#10B981", bg: "#ECFDF5", text: "#047857" }, // emerald
  { hex: "#EC4899", bg: "#FDF2F8", text: "#BE185D" }, // pink
  { hex: "#8B5CF6", bg: "#F5F3FF", text: "#6D28D9" }, // violet
  { hex: "#14B8A6", bg: "#F0FDFA", text: "#0F766E" }, // teal
  { hex: "#F97316", bg: "#FFF7ED", text: "#C2410C" }, // orange
  { hex: "#3B82F6", bg: "#EFF6FF", text: "#1D4ED8" }, // blue
  { hex: "#EF4444", bg: "#FEF2F2", text: "#B91C1C" }, // red
  { hex: "#84CC16", bg: "#F7FEE7", text: "#4D7C0F" }, // lime
  { hex: "#06B6D4", bg: "#ECFEFF", text: "#0E7490" }, // cyan
  { hex: "#A855F7", bg: "#FAF5FF", text: "#7E22CE" }, // purple
];
const FALLBACK_NICHE_COLOR = { hex: "#94A3B8", bg: "#F1F5F9", text: "#475569" };

function buildNicheColorMap(niches: string[]): Map<string, typeof NICHE_COLORS[number]> {
  const sorted = Array.from(new Set(niches.map((n) => n.toLowerCase()))).sort();
  const map = new Map<string, typeof NICHE_COLORS[number]>();
  sorted.forEach((n, i) => map.set(n, NICHE_COLORS[i % NICHE_COLORS.length]));
  return map;
}

// ── Group / Sort metadata ─────────────────────────────────────────────────────

const GROUP_TKEYS: Record<ProspectGroupBy, string> = {
  status:   "group.status",
  niche:    "group.niche",
  country:  "group.country",
  priority: "group.priority",
  date:     "group.date",
  none:     "group.none",
};

const SORT_TKEYS: Record<ProspectSortBy, string> = {
  recent:    "sort.mostRecent",
  name_asc:  "sort.nameAZ",
  name_desc: "sort.nameZA",
  priority:  "sort.priority",
};

const STATUS_GROUP_ORDER = ["New", "Contacted", "In Progress", "Converted", "Archived"];
const STATUS_FILTER_OPTIONS = ["New", "Contacted", "In Progress", "Converted", "Archived"];

// ── View tab definitions ──────────────────────────────────────────────────────

const VIEW_TABS_CONFIG: { id: ProspectViewMode; tKey: string; icon: typeof List }[] = [
  { id: "list",      tKey: "views.list",      icon: List   },
  { id: "table",     tKey: "views.table",     icon: Table2 },
  { id: "pipeline",  tKey: "views.pipeline",  icon: Kanban },
  { id: "templates", tKey: "views.templates", icon: FileText },
];

// ── Virtual list item types ───────────────────────────────────────────────────

type VirtualListItem =
  | { kind: "header"; label: string; count: number }
  | { kind: "prospect"; prospect: ProspectRow };

// ── Prospect card ─────────────────────────────────────────────────────────────

function ProspectListCard({
  prospect,
  isActive,
  onClick,
  nicheColor,
}: {
  prospect: ProspectRow;
  isActive: boolean;
  onClick: () => void;
  nicheColor: { hex: string; bg: string; text: string };
}) {
  const { t } = useTranslation("prospects");
  const name = String(prospect.name || prospect.company || "");
  const company = String(prospect.company || "");
  const niche = String(prospect.niche || "");
  const status = String(prospect.status || "");
  const priority = String(prospect.priority || "");
  const statusHex = PROSPECT_STATUS_HEX[status] || "#94A3B8";
  const lastUpdated = prospect.updated_at || prospect.created_at;
  const website = String(prospect.website || "");
  const phone = String(prospect.phone || "");
  const email = String(prospect.email || "");
  const linkedin = String(prospect.linkedin || "");
  const source = String(prospect.source || "");

  const initials = getInitials(name);

  const hasHoverContent = !!(website || phone || email || linkedin || source);

  const outreachStatus = String(prospect.outreach_status || "new") as OutreachStatus;
  const followUpDate = prospect.next_follow_up_date ? new Date(prospect.next_follow_up_date as string) : null;
  const isOverdue = followUpDate ? followUpDate.getTime() < Date.now() : false;
  const contactSnippet = email || phone || "";
  const priorityColor = PRIORITY_HEX[priority] || "transparent";

  return (
    <div
      className={cn(
        "group rounded-xl cursor-pointer",
        "transition-[background-color,box-shadow] duration-150 ease-out",
        "hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
        isActive ? "bg-highlight-selected" : "bg-card hover:bg-card-hover"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      data-testid="prospect-mobile-card"
    >
      <div className="px-3 pt-3 pb-2.5 flex flex-col gap-1.5">

        {/* Top row: Avatar + Name + Date */}
        <div className="flex items-start gap-2.5">
          <EntityAvatar
            name={name}
            photoUrl={prospect.photo_url}
            bgColor={nicheColor.hex}
            textColor="#fff"
          />
          <div className="flex-1 min-w-0 pt-0.5">
            {/* Name + date */}
            <div className="flex items-start justify-between gap-1.5">
              <p className="text-[18px] font-semibold font-heading leading-tight truncate text-foreground">
                {name}
              </p>
              <div className="shrink-0 flex items-center gap-1.5 mt-1">
                {isOverdue && (
                  <span className="text-[9px] font-bold uppercase tracking-wide text-red-500">Overdue</span>
                )}
                {lastUpdated && (
                  <span className="text-[10px] text-muted-foreground/45 tabular-nums whitespace-nowrap">
                    {formatRelativeTime(lastUpdated)}
                  </span>
                )}
              </div>
            </div>
            {/* Status + Outreach + Niche tag + Priority dashes */}
            <div className="flex items-center justify-between gap-1 mt-[3px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: statusHex }}
                />
                <span className="text-[11px] text-muted-foreground truncate">{status || "New"}</span>
                {getProspectId(prospect) > 0 && (
                  <span className="text-[10px] font-semibold text-foreground/35 shrink-0">#{getProspectId(prospect)}</span>
                )}
                {outreachStatus !== "new" && (
                  <>
                    <span className="text-muted-foreground/30 shrink-0">·</span>
                    <span
                      className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1 text-white"
                      style={{ backgroundColor: OUTREACH_HEX[outreachStatus] || "#6B7280" }}
                    >
                      <span className="w-1 h-1 rounded-full bg-white/70 dark:bg-white/[0.07]" />
                      {OUTREACH_LABELS[outreachStatus] || outreachStatus.replace(/_/g, " ")}
                    </span>
                  </>
                )}
                {niche && outreachStatus === "new" && (
                  <>
                    <span className="text-muted-foreground/30 shrink-0">·</span>
                    <span
                      className="shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full text-white whitespace-nowrap"
                      style={{ backgroundColor: nicheColor.hex }}
                    >
                      {niche}
                    </span>
                  </>
                )}
              </div>
              {/* Priority signal bars */}
              <SignalBars priority={priority} />
            </div>
          </div>
        </div>

        {/* Last email activity */}
        {prospect.last_contacted_at && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
            <Mail className="h-3 w-3 shrink-0 text-muted-foreground/35" />
            <span>
              {prospect.contact_method === "email" ? "Emailed" : "Contacted"}{" "}
              {formatRelativeTime(prospect.last_contacted_at)}
            </span>
            {(prospect.follow_up_count ?? 0) > 1 && (
              <>
                <span className="text-muted-foreground/25">·</span>
                <span>{prospect.follow_up_count} follow-ups</span>
              </>
            )}
          </div>
        )}

        {/* Hover-reveal: website, phone, email, linkedin, source */}
        {hasHoverContent && (
          <div className="overflow-hidden max-h-0 opacity-0 group-hover:max-h-[80px] group-hover:opacity-100 transition-[max-height,opacity] duration-200 ease-out">
            <div className="flex flex-col gap-1.5 pt-1.5 border-t border-black/[0.06]">
              {/* Website + source */}
              {(website || source) && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {website && (
                    <span className="flex items-center gap-1 text-[10px] text-foreground/40 truncate">
                      <Globe className="h-3 w-3 shrink-0 text-muted-foreground/35" />
                      <span className="truncate">{website}</span>
                    </span>
                  )}
                  {website && source && (
                    <span className="text-[10px] text-foreground/25 shrink-0">&middot;</span>
                  )}
                  {source && (
                    <span className="text-[10px] text-foreground/40 truncate">{source}</span>
                  )}
                </div>
              )}
              {/* Email + phone + linkedin row */}
              {(email || phone || linkedin) && (
                <div className="flex items-center gap-3 min-w-0">
                  {email && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 truncate min-w-0">
                      <Mail className="h-3 w-3 shrink-0 text-muted-foreground/35" />
                      <span className="truncate">{email}</span>
                    </span>
                  )}
                  {phone && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 shrink-0">
                      <Phone className="h-3 w-3 shrink-0 text-muted-foreground/35" />
                      {phone}
                    </span>
                  )}
                  {linkedin && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 truncate min-w-0">
                      <Linkedin className="h-3 w-3 shrink-0 text-muted-foreground/35" />
                      <span className="truncate">{linkedin}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}


// ── Group header ──────────────────────────────────────────────────────────────

function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div data-group-header="true" className="sticky -top-[3px] z-20 bg-muted px-3 pt-[15px] pb-3">
      <div className="flex items-center gap-[10px]">
        <div className="flex-1 h-px bg-foreground/15" />
        <span className="text-[12px] font-bold text-foreground tracking-wide shrink-0">{label}</span>
        <span className="text-foreground/20 shrink-0">&ndash;</span>
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
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3.5 rounded-lg animate-pulse"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="h-10 w-10 rounded-full bg-foreground/10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-foreground/10 rounded-full w-2/3" />
            <div className="h-2.5 bg-foreground/8 rounded-full w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Accordion filter section ──────────────────────────────────────────────────

function FilterAccordionSection({
  label,
  activeCount,
  defaultOpen = false,
  children,
}: {
  label: string;
  activeCount: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || activeCount > 0);
  return (
    <div>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-muted/50 transition-colors duration-150"
      >
        {open
          ? <ChevronDown className="h-3 w-3 shrink-0" />
          : <ChevronRight className="h-3 w-3 shrink-0" />
        }
        <span className="flex-1 text-left font-medium">{label}</span>
        {activeCount > 0 && (
          <span className="h-4 min-w-4 px-1 rounded-full bg-brand-indigo text-white text-[9px] font-bold flex items-center justify-center shrink-0">
            {activeCount}
          </span>
        )}
      </button>
      {open && children}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProspectListViewProps {
  prospects: ProspectRow[];
  loading: boolean;
  selectedProspect: ProspectRow | null;
  onSelectProspect: (prospect: ProspectRow) => void;
  onAddProspect: () => void;
  onCreate: (data: NewProspectForm) => Promise<ProspectRow | void>;
  onSave: (field: string, value: string) => Promise<void>;
  onDelete: () => void;
  onToggleStatus: (prospect: ProspectRow) => void;
  // Lifted controls
  viewMode: ProspectViewMode;
  onViewModeChange: (v: ProspectViewMode) => void;
  listSearch: string;
  onListSearchChange: (v: string) => void;
  searchOpen: boolean;
  onSearchOpenChange: (v: boolean) => void;
  groupBy: ProspectGroupBy;
  onGroupByChange: (v: ProspectGroupBy) => void;
  sortBy: ProspectSortBy;
  onSortByChange: (v: ProspectSortBy) => void;
  filterNiche: string[];
  onToggleFilterNiche: (s: string) => void;
  filterStatus: string[];
  onToggleFilterStatus: (s: string) => void;
  filterCountry: string[];
  onToggleFilterCountry: (s: string) => void;
  filterPriority: string[];
  onToggleFilterPriority: (s: string) => void;
  filterSource: string[];
  onToggleFilterSource: (s: string) => void;
  hasNonDefaultControls: boolean;
  isGroupNonDefault: boolean;
  isSortNonDefault: boolean;
  onResetControls: () => void;
  onRefreshProspect?: () => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProspectListView({
  prospects,
  loading,
  selectedProspect,
  onSelectProspect,
  onAddProspect,
  onCreate,
  onSave,
  onDelete,
  onToggleStatus,
  viewMode,
  onViewModeChange,
  listSearch,
  onListSearchChange,
  searchOpen,
  onSearchOpenChange,
  groupBy,
  onGroupByChange,
  sortBy,
  onSortByChange,
  filterNiche,
  onToggleFilterNiche,
  filterStatus,
  onToggleFilterStatus,
  filterCountry,
  onToggleFilterCountry,
  filterPriority,
  onToggleFilterPriority,
  filterSource,
  onToggleFilterSource,
  hasNonDefaultControls,
  isGroupNonDefault,
  isSortNonDefault,
  onResetControls,
  onRefreshProspect,
}: ProspectListViewProps) {
  const { t } = useTranslation("prospects");
  const isNarrow = useIsMobile(1024); // below lg: show list OR detail, not both
  const [currentPage, setCurrentPage] = useState(0);

  const viewTabs = useMemo(
    () => VIEW_TABS_CONFIG.map((tab) => ({ ...tab, label: t(tab.tKey) })),
    [t]
  );
  const [panelMode, setPanelMode] = useState<"view" | "create">("view");
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [groupDirection, setGroupDirection] = useState<"asc" | "desc">("asc");
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(() => {
    try { return localStorage.getItem("prospects-left-panel-collapsed") === "true"; } catch { return false; }
  });
  const PAGE_SIZE = 25;

  // ── Email compose state ──────────────────────────────────────────────────
  const [emailComposeOpen, setEmailComposeOpen] = useState(false);
  const [replyContext, setReplyContext] = useState<{ messageId: string; threadId: string; subject: string } | null>(null);

  // ── Contact slot toggle (1 or 2) ───────────────────────────────────────────
  const [contactSlot, setContactSlot] = useState<1 | 2>(1);
  useEffect(() => setContactSlot(1), [selectedProspect?.id ?? selectedProspect?.Id]);

  // ── Publish selected prospect to AI chat context ──────────────────────────
  const publishEntity = usePublishEntityData();
  useEffect(() => {
    if (!selectedProspect) return;
    const pid = selectedProspect.Id ?? selectedProspect.id ?? 0;
    publishEntity({
      entityType: "prospect",
      entityId: pid,
      entityName: selectedProspect.company || selectedProspect.name || "Unknown Prospect",
      summary: {
        id: pid,
        company: selectedProspect.company,
        name: selectedProspect.name,
        contactName: selectedProspect.contact_name,
        contactRole: selectedProspect.contact_role,
        contactEmail: selectedProspect.contact_email,
        contactPhone: selectedProspect.contact_phone,
        email: selectedProspect.email,
        phone: selectedProspect.phone,
        website: selectedProspect.website,
        linkedin: selectedProspect.linkedin,
        niche: selectedProspect.niche,
        city: selectedProspect.city,
        country: selectedProspect.country,
        status: selectedProspect.status,
        priority: selectedProspect.priority,
        source: selectedProspect.source,
        notes: selectedProspect.notes,
        nextAction: selectedProspect.next_action,
        aiSummary: selectedProspect.ai_summary,
        headline: selectedProspect.headline,
      },
      updatedAt: Date.now(),
    });
  }, [selectedProspect, publishEntity]);

  // ── Gradient tester state ──────────────────────────────────────────────────
  const GRADIENT_KEY = "la:gradient:prospects";
  const [savedGradient, setSavedGradient] = useState<GradientLayer[] | null>(() => {
    try { const raw = localStorage.getItem(GRADIENT_KEY); return raw ? JSON.parse(raw) as GradientLayer[] : null; } catch { return null; }
  });
  const [gradientTesterOpen, setGradientTesterOpen] = useState(false);
  const [gradientLayers, setGradientLayers] = useState<GradientLayer[]>(savedGradient ?? PAGE_DEFAULT_LAYERS);
  const [gradientDragMode, setGradientDragMode] = useState(false);

  const updateGradientLayer = useCallback((id: number, patch: Partial<GradientLayer>) => {
    if (id === -1) { setGradientLayers(prev => [...prev, patch as GradientLayer]); return; }
    if (id === -2) { setGradientLayers(prev => prev.filter(l => l.id !== (patch as GradientLayer).id)); return; }
    setGradientLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }, []);
  const handleSaveGradient = useCallback(() => {
    localStorage.setItem(GRADIENT_KEY, JSON.stringify(gradientLayers));
    setSavedGradient(gradientLayers);
  }, [gradientLayers]);
  const handleApplyGradient = useCallback(() => {
    handleSaveGradient();
    setGradientTesterOpen(false);
  }, [handleSaveGradient]);
  const toggleGradientTester = useCallback(() => {
    if (!gradientTesterOpen) {
      try {
        const raw = localStorage.getItem(GRADIENT_KEY);
        if (raw) setGradientLayers(JSON.parse(raw) as GradientLayer[]);
        else setGradientLayers(PAGE_DEFAULT_LAYERS);
      } catch { /* keep current layers */ }
    }
    setGradientTesterOpen(prev => !prev);
  }, [gradientTesterOpen]);

  // ── Inline editing (contentEditable) ──────────────────────────────────────
  const [editingField, setEditingField] = useState<string | null>(null);
  const editRef = useRef<HTMLElement>(null);
  // Keep a ref to track original value for cancel
  const editOriginal = useRef("");

  const startEdit = useCallback((field: string, currentValue: string) => {
    setEditingField(field);
    editOriginal.current = currentValue;
  }, []);

  const commitEdit = useCallback(async (field: string, el: HTMLElement) => {
    const value = el.innerText.trim();
    setEditingField(null);
    if (value !== editOriginal.current) {
      await onSave(field, value);
    }
  }, [onSave]);

  const cancelEdit = useCallback(() => {
    if (editRef.current) editRef.current.innerText = editOriginal.current;
    setEditingField(null);
  }, []);

  /** Reusable editable span for text fields */
  const editableField = useCallback((
    field: string,
    value: string,
    placeholder: string,
    className: string,
  ) => (
    <span
      ref={editingField === field ? editRef as React.RefObject<HTMLSpanElement> : undefined}
      contentEditable
      suppressContentEditableWarning
      className={cn(
        className,
        "outline-none rounded px-1 -mx-1 transition-colors cursor-text",
        "focus:bg-white/80 dark:focus:bg-card/80 focus:ring-1 focus:ring-brand-blue/40",
        "hover:bg-black/[0.03]",
        !value && "text-muted-foreground/40 italic",
      )}
      onFocus={(e) => {
        startEdit(field, e.currentTarget.innerText.trim());
        // If it's showing placeholder, clear it on focus
        if (!value) e.currentTarget.innerText = "";
      }}
      onBlur={(e) => commitEdit(field, e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === "Escape") { cancelEdit(); e.currentTarget.blur(); }
      }}
    >
      {value || placeholder}
    </span>
  ), [editingField, startEdit, commitEdit, cancelEdit]);

  /** Editable multiline (notes, next action) */
  const editableMultiline = useCallback((
    field: string,
    value: string,
    placeholder: string,
    className: string,
  ) => (
    <div
      ref={editingField === field ? editRef as React.RefObject<HTMLDivElement> : undefined}
      contentEditable
      suppressContentEditableWarning
      className={cn(
        className,
        "outline-none rounded-lg px-2.5 py-1 -mx-2.5 transition-colors cursor-text whitespace-pre-wrap",
        "focus:bg-white/80 dark:focus:bg-card/80 focus:ring-1 focus:ring-brand-blue/40",
        "hover:bg-black/[0.03]",
        !value && "text-muted-foreground/40 italic",
      )}
      onFocus={(e) => {
        startEdit(field, e.currentTarget.innerText.trim());
        if (!value) e.currentTarget.innerText = "";
      }}
      onBlur={(e) => commitEdit(field, e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Escape") { cancelEdit(); e.currentTarget.blur(); }
      }}
    >
      {value || placeholder}
    </div>
  ), [editingField, startEdit, commitEdit, cancelEdit]);

  // For date/select fields we still need controlled state
  const [dateEditField, setDateEditField] = useState<string | null>(null);
  const [dateEditValue, setDateEditValue] = useState("");

  const startDateEdit = useCallback((field: string, currentValue: string) => {
    setDateEditField(field);
    setDateEditValue(currentValue);
  }, []);

  const commitDateEdit = useCallback(async () => {
    if (!dateEditField) return;
    const field = dateEditField;
    const value = dateEditValue;
    setDateEditField(null);
    await onSave(field, value);
  }, [dateEditField, dateEditValue, onSave]);

  // ── Photo upload ─────────────────────────────────────────────────────────
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoInputRef.current) photoInputRef.current.value = "";
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === "string") {
        await onSave("photo_url", reader.result);
      }
    };
    reader.readAsDataURL(file);
  }, [onSave]);

  const handleRemovePhoto = useCallback(async () => {
    await onSave("photo_url", "");
  }, [onSave]);

  // ── Convert to Account ────────────────────────────────────────────────────
  const [converting, setConverting] = useState(false);
  const handleConvertToAccount = useCallback(async () => {
    if (!selectedProspect || converting) return;
    const pid = selectedProspect.Id ?? selectedProspect.id ?? 0;
    setConverting(true);
    try {
      const { convertProspectToAccount } = await import("../api/prospectsApi");
      const result = await convertProspectToAccount(pid);
      // Refresh the prospect data in the list by triggering onSave with the new values
      await onSave("status", "Converted");
      await onSave("Accounts_id", String(result.account.id));
    } catch (err) {
      console.error("Convert to account failed", err);
    } finally {
      setConverting(false);
    }
  }, [selectedProspect, converting, onSave]);

  // Build flat grouped list
  const flatItems = useMemo((): VirtualListItem[] => {
    let filtered = prospects;

    // Text search
    if (listSearch.trim()) {
      const q = listSearch.toLowerCase();
      filtered = filtered.filter((p) =>
        String(p.name || "").toLowerCase().includes(q) ||
        String(p.company || "").toLowerCase().includes(q) ||
        String(p.niche || "").toLowerCase().includes(q) ||
        String(p.email || "").toLowerCase().includes(q) ||
        String(p.status || "").toLowerCase().includes(q)
      );
    }

    // Niche filter
    if (filterNiche.length > 0) {
      filtered = filtered.filter((p) => filterNiche.includes(String(p.niche || "")));
    }

    // Status filter
    if (filterStatus.length > 0) {
      filtered = filtered.filter((p) => filterStatus.includes(String(p.status || "")));
    }

    // Country filter
    if (filterCountry.length > 0) {
      filtered = filtered.filter((p) => filterCountry.includes(String(p.country || "")));
    }

    // Priority filter
    if (filterPriority.length > 0) {
      filtered = filtered.filter((p) => filterPriority.includes(String(p.priority || "")));
    }

    // Source filter
    if (filterSource.length > 0) {
      filtered = filtered.filter((p) => filterSource.includes(String(p.source || "")));
    }

    // Overdue filter
    if (filterOverdue) {
      const now = Date.now();
      filtered = filtered.filter((p) => {
        if (!p.next_follow_up_date) return false;
        return new Date(p.next_follow_up_date).getTime() < now;
      });
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name_asc":  return String(a.name || "").localeCompare(String(b.name || ""));
        case "name_desc": return String(b.name || "").localeCompare(String(a.name || ""));
        case "priority": {
          const prio: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
          return (prio[a.priority || "Medium"] ?? 2) - (prio[b.priority || "Medium"] ?? 2);
        }
        default: { // recent
          const da = a.updated_at || a.created_at || "";
          const db = b.updated_at || b.created_at || "";
          return db.localeCompare(da);
        }
      }
    });

    // No grouping
    if (groupBy === "none") {
      return filtered.map((p) => ({ kind: "prospect" as const, prospect: p }));
    }

    // Group
    const buckets = new Map<string, ProspectRow[]>();
    filtered.forEach((p) => {
      let key: string;
      switch (groupBy) {
        case "status":   key = String(p.status || "New"); break;
        case "niche":    key = String(p.niche || "Other"); break;
        case "country":  key = String(p.country || "Unknown"); break;
        case "priority": key = String(p.priority || "Medium"); break;
        case "date":     key = getDateBucket(p.updated_at || p.created_at); break;
        default:         key = String(p.status || "New"); break;
      }
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(p);
    });

    let orderedKeys: string[];
    if (groupBy === "status") {
      orderedKeys = STATUS_GROUP_ORDER.filter((k) => buckets.has(k))
        .concat(Array.from(buckets.keys()).filter((k) => !STATUS_GROUP_ORDER.includes(k)));
    } else if (groupBy === "priority") {
      orderedKeys = ["High", "Medium", "Low"].filter((k) => buckets.has(k))
        .concat(Array.from(buckets.keys()).filter((k) => !["High", "Medium", "Low"].includes(k)));
    } else if (groupBy === "date") {
      orderedKeys = DATE_BUCKET_ORDER.filter((k) => buckets.has(k));
    } else {
      // niche, country — alphabetical
      orderedKeys = Array.from(buckets.keys()).sort();
    }

    if (groupDirection === "desc") {
      orderedKeys = [...orderedKeys].reverse();
    }

    const result: VirtualListItem[] = [];
    orderedKeys.forEach((key) => {
      const group = buckets.get(key);
      if (!group || group.length === 0) return;
      result.push({ kind: "header", label: key, count: group.length });
      group.forEach((p) => result.push({ kind: "prospect", prospect: p }));
    });
    return result;
  }, [prospects, listSearch, filterNiche, filterStatus, filterCountry, filterPriority, filterSource, filterOverdue, sortBy, groupBy, groupDirection]);

  const totalProspects = flatItems.filter((i) => i.kind === "prospect").length;
  const maxPage = Math.max(0, Math.ceil(totalProspects / PAGE_SIZE) - 1);

  const paginatedItems = useMemo(() => {
    if (totalProspects <= PAGE_SIZE) return flatItems;
    let prospectCount = 0;
    const start = currentPage * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const result: VirtualListItem[] = [];
    let currentHeader: VirtualListItem | null = null;
    let headerCount = 0;
    for (const item of flatItems) {
      if (item.kind === "header") {
        currentHeader = item;
        headerCount = 0;
        continue;
      }
      if (prospectCount >= start && prospectCount < end) {
        if (currentHeader && headerCount === 0) result.push(currentHeader);
        result.push(item);
        headerCount++;
      }
      prospectCount++;
      if (prospectCount >= end) break;
    }
    return result;
  }, [flatItems, currentPage, totalProspects]);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(0); }, [listSearch, filterNiche, filterStatus, filterCountry, filterPriority, filterSource, groupBy, sortBy]);

  // Auto-select first prospect
  useEffect(() => {
    if (!selectedProspect && prospects.length > 0) {
      const first = flatItems.find((i) => i.kind === "prospect") as { kind: "prospect"; prospect: ProspectRow } | undefined;
      if (first) onSelectProspect(first.prospect);
    }
  }, [flatItems, selectedProspect, prospects.length, onSelectProspect]);

  // (mobile sheet removed — narrow screens now show detail inline like Leads page)

  const isFilterActive = filterNiche.length > 0 || filterStatus.length > 0 || filterCountry.length > 0 || filterPriority.length > 0 || filterSource.length > 0;

  // ── Niche color map (same as table view) ──────────────────────────────────
  const nicheColorMap = useMemo(() => {
    const niches = prospects.map((p) => String(p.niche || "")).filter(Boolean);
    return buildNicheColorMap(niches);
  }, [prospects]);
  const getNicheColor = (niche: string) => nicheColorMap.get(niche.toLowerCase()) ?? FALLBACK_NICHE_COLOR;

  // ── Available niches/countries for filter dropdown ──────────────────────────
  const availableNiches = useMemo(() => {
    const seen = new Set<string>();
    prospects.forEach((p) => { const v = String(p.niche || ""); if (v) seen.add(v); });
    return Array.from(seen).sort();
  }, [prospects]);

  const availableCountries = useMemo(() => {
    const seen = new Set<string>();
    prospects.forEach((p) => { const v = String(p.country || ""); if (v) seen.add(v); });
    return Array.from(seen).sort();
  }, [prospects]);

  const availableSources = useMemo(() => {
    const seen = new Set<string>();
    prospects.forEach((p) => { const v = String(p.source || ""); if (v) seen.add(v); });
    return Array.from(seen).sort();
  }, [prospects]);

  // ── Smooth scroll to selected card ────────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedProspect || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const run = () => {
      const id = getProspectId(selectedProspect);
      const el = container.querySelector(`[data-prospect-id="${id}"]`) as HTMLElement | null;
      if (!el) return;
      // Calculate card position relative to scroll container
      const containerTop = container.getBoundingClientRect().top;
      const cardTop = el.getBoundingClientRect().top;
      const relativeTop = cardTop - containerTop + container.scrollTop;
      // 48px buffer accounts for sticky group header height
      container.scrollTo({ top: Math.max(0, relativeTop - 48), behavior: "smooth" });
    };
    const raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [selectedProspect]);

  // ── Expand-on-hover button constants ────────────────────────────────────────
  const xBase    = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
  const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
  const xActive  = "border-brand-indigo text-brand-indigo";
  const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

  // ── Collapse left panel button (desktop only) ────────────────────────────────
  // ── Search pill — always visible ─────────────────────────────────────────────
  const searchPill = (
    <SearchPill
      value={listSearch}
      onChange={onListSearchChange}
      open={searchOpen}
      onOpenChange={onSearchOpenChange}
      placeholder={t("page.searchPlaceholder")}
      className="max-w-[180px]"
    />
  );

  // ── Toolbar prefix for the right panel ──────────────────────────────────────
  const toolbarPrefix = (
    <>
      {/* Filter (accordion sections: niche, status, country) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, isFilterActive ? xActive : xDefault, "hover:max-w-[100px]")}>
            <Filter className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.filter")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-[400px] overflow-y-auto">
          <FilterAccordionSection
            label={t("group.niche")}
            activeCount={filterNiche.length}
            defaultOpen={filterNiche.length > 0}
          >
            {availableNiches.map((s) => (
              <DropdownMenuItem
                key={`niche-${s}`}
                onClick={(e) => { e.preventDefault(); onToggleFilterNiche(s); }}
                className="flex items-center gap-2 text-[12px]"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: getNicheColor(s).hex }}
                />
                <span className="flex-1">{s}</span>
                {filterNiche.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
              </DropdownMenuItem>
            ))}
          </FilterAccordionSection>
          <FilterAccordionSection
            label={t("filter.status")}
            activeCount={filterStatus.length}
            defaultOpen={filterStatus.length > 0}
          >
            {STATUS_FILTER_OPTIONS.map((s) => (
              <DropdownMenuItem
                key={`status-${s}`}
                onClick={(e) => { e.preventDefault(); onToggleFilterStatus(s); }}
                className="flex items-center gap-2 text-[12px]"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: PROSPECT_STATUS_HEX[s] || "#94A3B8" }}
                />
                <span className="flex-1">{s}</span>
                {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
              </DropdownMenuItem>
            ))}
          </FilterAccordionSection>
          {availableCountries.length > 0 && (
            <FilterAccordionSection
              label={t("filter.country")}
              activeCount={filterCountry.length}
              defaultOpen={filterCountry.length > 0}
            >
              {availableCountries.map((s) => (
                <DropdownMenuItem
                  key={`country-${s}`}
                  onClick={(e) => { e.preventDefault(); onToggleFilterCountry(s); }}
                  className="flex items-center gap-2 text-[12px]"
                >
                  <MapPin className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  <span className="flex-1">{s}</span>
                  {filterCountry.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
              ))}
            </FilterAccordionSection>
          )}
          <FilterAccordionSection
            label={t("filter.priority")}
            activeCount={filterPriority.length}
            defaultOpen={filterPriority.length > 0}
          >
            {INLINE_PRIORITY_OPTIONS.map((s) => (
              <DropdownMenuItem
                key={`priority-${s}`}
                onClick={(e) => { e.preventDefault(); onToggleFilterPriority(s); }}
                className="flex items-center gap-2 text-[12px]"
              >
                <SignalBars priority={s} />
                <span className="flex-1 capitalize">{s}</span>
                {filterPriority.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
              </DropdownMenuItem>
            ))}
          </FilterAccordionSection>
          {availableSources.length > 0 && (
            <FilterAccordionSection
              label={t("filter.source")}
              activeCount={filterSource.length}
              defaultOpen={filterSource.length > 0}
            >
              {availableSources.map((s) => (
                <DropdownMenuItem
                  key={`source-${s}`}
                  onClick={(e) => { e.preventDefault(); onToggleFilterSource(s); }}
                  className="flex items-center gap-2 text-[12px]"
                >
                  <span className="flex-1">{s}</span>
                  {filterSource.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
              ))}
            </FilterAccordionSection>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => { e.preventDefault(); setFilterOverdue((v) => !v); }}
            className="flex items-center gap-2 text-[12px]"
          >
            <Clock className="h-3 w-3 text-red-500/60 shrink-0" />
            <span className="flex-1">{t("toolbar.overdue")}</span>
            {filterOverdue && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
          </DropdownMenuItem>
          {isFilterActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { onResetControls(); setFilterOverdue(false); }} className="text-[12px] text-muted-foreground">
                {t("toolbar.clearAllFilters")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, isSortNonDefault ? xActive : xDefault, "hover:max-w-[100px]")}>
            <ArrowUpDown className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.sort")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          {([
            { key: "recent", label: t("sort.mostRecent"), asc: null, desc: null },
            { key: "name", label: t("sort.name"), asc: "name_asc" as ProspectSortBy, desc: "name_desc" as ProspectSortBy },
            { key: "priority", label: t("sort.priority"), asc: null, desc: null },
          ] as { key: string; label: string; asc: ProspectSortBy | null; desc: ProspectSortBy | null }[]).map((group) => {
            const isActive = group.asc && group.desc
              ? sortBy === group.asc || sortBy === group.desc
              : sortBy === (group.key as ProspectSortBy);
            const activeDir: "asc" | "desc" = sortBy === group.asc ? "asc" : "desc";
            return (
              <DropdownMenuItem
                key={group.key}
                onSelect={(e) => {
                  e.preventDefault();
                  if (!isActive) {
                    onSortByChange(group.desc ?? (group.key as ProspectSortBy));
                  }
                }}
                className="text-[12px] flex items-center gap-2"
              >
                <span className={cn("flex-1", isActive && "font-semibold !text-brand-indigo")}>{group.label}</span>
                {isActive && group.asc && group.desc && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSortByChange(group.asc!); }}
                      className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", activeDir === "asc" ? "text-brand-indigo" : "text-foreground/30")}
                      title="Ascending"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSortByChange(group.desc!); }}
                      className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", activeDir === "desc" ? "text-brand-indigo" : "text-foreground/30")}
                      title="Descending"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Group */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, isGroupNonDefault ? xActive : xDefault, "hover:max-w-[100px]")}>
            <Layers className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.group")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          {(Object.keys(GROUP_TKEYS) as ProspectGroupBy[]).map((opt) => (
            <DropdownMenuItem
              key={opt}
              onSelect={(e) => { e.preventDefault(); onGroupByChange(opt); }}
              className="text-[12px] flex items-center gap-2"
            >
              <span className={cn("flex-1", groupBy === opt && "font-semibold !text-brand-indigo")}>{t(GROUP_TKEYS[opt])}</span>
              {groupBy === opt && opt !== "none" && (
                <>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setGroupDirection("asc"); }}
                    className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", groupDirection === "asc" ? "text-brand-indigo" : "text-foreground/30")}
                    title="Ascending"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setGroupDirection("desc"); }}
                    className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", groupDirection === "desc" ? "text-brand-indigo" : "text-foreground/30")}
                    title="Descending"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </>
              )}
              {groupBy === opt && opt === "none" && <Check className="h-3 w-3" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* +Add */}
      <button
        className={cn(xBase, xDefault, "hover:max-w-[80px]")}
        onClick={() => setPanelMode("create")}
      >
        <Plus className="h-4 w-4 shrink-0" />
        <span className={xSpan}>{t("toolbar.add")}</span>
      </button>

    </>
  );

  return (
    <div className="flex h-full gap-[3px]" data-testid="prospect-list-view">

      {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
      <div className={cn(
        "flex-col bg-muted rounded-lg overflow-hidden",
        leftPanelCollapsed
          ? cn(isNarrow && selectedProspect ? "hidden" : "flex", "lg:hidden")
          : cn("w-full lg:w-[340px] lg:shrink-0", isNarrow && selectedProspect ? "hidden" : "flex")
      )}>

        {/* Scrollable area: header + toolbar + prospect list */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">

        {/* Header: title + ViewTabBar */}
        <div className="pl-[17px] pr-3.5 pt-3 md:pt-10 pb-3 flex items-center">
          <div className="flex items-center justify-between w-full md:w-[309px] md:shrink-0">
            <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">{t("page.title")}</h2>
            <ViewTabBar
              tabs={viewTabs}
              activeId={viewMode}
              onTabChange={(id) => onViewModeChange(id as ProspectViewMode)}
              variant="segment"
            />
          </div>
        </div>

        {/* List toolbar: search + create + sort + filter + group */}
        <div className="px-2 pb-2 flex items-center gap-1">
          {searchPill}
          {toolbarPrefix}
        </div>

        {/* Prospect list */}
        <div className="p-[3px]">
          {loading ? (
            <ListSkeleton />
          ) : paginatedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Building2 className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">{t("page.noProspectsFound")}</p>
              {listSearch && <p className="text-xs text-muted-foreground/70 mt-1">{t("page.tryDifferentSearch")}</p>}
            </div>
          ) : (
            <div className="flex flex-col">
              {(() => {
                // Group items into sections: each section = header + its prospect items
                // This ensures sticky headers push each other off as you scroll
                const sections: { header?: VirtualListItem; items: { item: VirtualListItem; idx: number }[] }[] = [];
                let currentSection: { header?: VirtualListItem; items: { item: VirtualListItem; idx: number }[] } = { items: [] };
                paginatedItems.forEach((item, idx) => {
                  if (item.kind === "header") {
                    if (currentSection.header || currentSection.items.length > 0) {
                      sections.push(currentSection);
                    }
                    currentSection = { header: item, items: [] };
                  } else {
                    currentSection.items.push({ item, idx });
                  }
                });
                if (currentSection.header || currentSection.items.length > 0) {
                  sections.push(currentSection);
                }

                return sections.map((section, si) => (
                  <div key={section.header && section.header.kind === "header" ? `g-${section.header.label}` : `g-${si}`}>
                    {section.header && section.header.kind === "header" && (
                      <GroupHeader label={section.header.label} count={section.header.count} />
                    )}
                    <div className="flex flex-col gap-[3px] px-0">
                      {section.items.map(({ item, idx }) => {
                        if (item.kind !== "prospect") return null;
                        const pid = getProspectId(item.prospect);
                        const isSelected = selectedProspect ? getProspectId(selectedProspect) === pid : false;
                        return (
                          <div key={pid || idx} data-prospect-id={pid} className="animate-card-enter" style={{ animationDelay: `${Math.min(idx, 15) * 30}ms` }}>
                            <ProspectListCard
                              prospect={item.prospect}
                              isActive={isSelected}
                              onClick={() => onSelectProspect(item.prospect)}
                              nicheColor={getNicheColor(String(item.prospect.niche || ""))}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
        </div>

        {/* Pagination footer */}
        {totalProspects > PAGE_SIZE && (
          <div className="h-[18px] px-3 py-1 border-t border-border/20 flex items-center justify-between shrink-0">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              {t("toolbar.previous")}
            </button>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {currentPage * PAGE_SIZE + 1}&ndash;{Math.min((currentPage + 1) * PAGE_SIZE, totalProspects)} {t("toolbar.of")} {totalProspects}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(maxPage, p + 1))}
              disabled={currentPage >= maxPage}
              className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              {t("toolbar.next")}
            </button>
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL — 3-column layout ──────────────────────────── */}
      <div className={cn(
        "flex-1 flex-col overflow-hidden rounded-lg",
        isNarrow && !selectedProspect ? "hidden" : "flex"
      )}>
        {panelMode === "create" ? (
          <ProspectCreatePanel
            onCreate={async (data) => {
              const created = await onCreate(data);
              setPanelMode("view");
              if (created) onSelectProspect(created);
            }}
            onClose={() => setPanelMode("view")}
          />
        ) : loading && !selectedProspect ? (
          <SkeletonAccountPanel />
        ) : selectedProspect ? (
          <div className="relative flex flex-col h-full overflow-hidden rounded-lg">

            {/* ── Gradient background ── */}
            {gradientTesterOpen ? (
              <>
                {gradientLayers.map(layer => {
                  const style = layerToStyle(layer);
                  return style ? <div key={layer.id} className="absolute inset-0 dark:opacity-[0.08]" style={style} /> : null;
                })}
                {gradientDragMode && (
                  <GradientControlPoints layers={gradientLayers} onUpdateLayer={updateGradientLayer} />
                )}
              </>
            ) : savedGradient ? (
              <>
                {savedGradient.map((layer: GradientLayer) => {
                  const style = layerToStyle(layer);
                  return style ? <div key={layer.id} className="absolute inset-0 dark:opacity-[0.08]" style={style} /> : null;
                })}
              </>
            ) : (
              <>
                <div className="absolute inset-0 bg-white dark:bg-background" />
                <div className="absolute inset-0 dark:opacity-[0.08] bg-[linear-gradient(157deg,rgba(252,62,255,0.12)_0%,rgba(242,225,155,0.55)_100%)]" />
                <div className="absolute inset-0 dark:opacity-[0.08] bg-[radial-gradient(ellipse_148%_200%_at_100%_100%,rgba(255,200,134,0.4)_0%,transparent_80%)]" />
                <div className="absolute inset-0 dark:opacity-[0.08] bg-[radial-gradient(ellipse_200%_200%_at_0%_0%,rgba(158,143,255,0.1)_0%,transparent_80%)]" />
              </>
            )}

            {/* ── Header ── */}
            <div className="shrink-0 relative z-10">
              <div className="relative px-4 pt-3 md:pt-1 pb-4 md:pb-6 space-y-1">
                {/* Back button (mobile) + collapse button (desktop) + gradient tester */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    {isNarrow && (
                      <button
                        onClick={() => (onSelectProspect as unknown as (v: null) => void)(null)}
                        className="h-9 w-9 rounded-full border border-black/[0.125] bg-background grid place-items-center shrink-0 mr-2"
                      >
                        <span className="text-sm">←</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const next = !leftPanelCollapsed;
                        setLeftPanelCollapsed(next);
                        try { localStorage.setItem("prospects-left-panel-collapsed", String(next)); } catch {}
                      }}
                      className="hidden lg:grid h-9 w-9 rounded-full border border-black/[0.125] place-items-center shrink-0 text-foreground/60 hover:text-foreground transition-colors"
                      title={leftPanelCollapsed ? "Show list" : "Hide list"}
                    >
                      {leftPanelCollapsed ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                    </button>
                    {/* Gradient Tester toggle */}
                    <button
                      onClick={toggleGradientTester}
                      className={cn(
                        "h-7 w-7 rounded-md border grid place-items-center shrink-0",
                        gradientTesterOpen
                          ? "border-indigo-200 text-indigo-600 bg-indigo-100"
                          : "border-black/[0.125] text-foreground/50 hover:text-foreground hover:bg-black/[0.04]"
                      )}
                      title="Gradient Tester"
                    >
                      <Paintbrush className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Name + badges */}
                <div className="flex items-start gap-3">
                  {/* Photo circle — click to upload */}
                  <div className="relative group/photo shrink-0">
                    <div
                      className="h-[72px] w-[72px] rounded-full flex items-center justify-center text-xl font-bold overflow-hidden cursor-pointer"
                      style={selectedProspect.photo_url ? {} : { backgroundColor: getNicheColor(String(selectedProspect.niche || "")).hex, color: "#fff" }}
                      onClick={() => photoInputRef.current?.click()}
                      title={t("detail.clickToUploadPhoto")}
                    >
                      {selectedProspect.photo_url ? (
                        <img src={selectedProspect.photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        getInitials(selectedProspect.name || selectedProspect.company || "") || <Building2 className="w-5 h-5" />
                      )}
                    </div>
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity cursor-pointer pointer-events-none">
                      <Camera className="w-5 h-5 text-white" />
                    </div>
                    {selectedProspect.photo_url && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemovePhoto(); }}
                        title={t("detail.removePhoto")}
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-white dark:bg-card border border-black/[0.125] flex items-center justify-center text-foreground/50 hover:text-red-500 hover:border-red-300 transition-colors z-10 opacity-0 group-hover/photo:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoFile}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight truncate">
                        {selectedProspect.name || selectedProspect.company || ""}
                      </h2>
                      {(selectedProspect.email || selectedProspect.contact_email || selectedProspect.contact2_email) && (
                        <button
                          onClick={() => setEmailComposeOpen(true)}
                          className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-brand-indigo text-white text-[11px] font-medium hover:bg-brand-indigo/90 transition-colors"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {t("emailCompose.sendEmail")}
                        </button>
                      )}
                    </div>
                    {/* Outreach / Niche / Priority — all on one row, clickable */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {/* Outreach status + duration + advance/lost buttons */}
                      {(() => {
                        const key = (selectedProspect.outreach_status || "new") as OutreachStatus;
                        const hex = OUTREACH_HEX[key] || "#6B7280";
                        const label = OUTREACH_LABELS[key] || key.replace(/_/g, " ");
                        const currentIdx = OUTREACH_STATUSES.indexOf(key);
                        const canAdvance = currentIdx >= 0 && currentIdx < OUTREACH_STATUSES.length - 2;
                        const isTerminal = key === "deal_closed" || key === "lost";
                        const nextStatus = canAdvance ? OUTREACH_STATUSES[currentIdx + 1] : null;
                        const stageDate = key === "new"
                          ? selectedProspect.created_at
                          : (selectedProspect.last_contacted_at || selectedProspect.first_contacted_at || selectedProspect.created_at);
                        const daysInStage = stageDate ? Math.floor((Date.now() - new Date(stageDate).getTime()) / 86400000) : null;
                        return (
                          <div className="inline-flex items-center gap-1">
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/90 dark:bg-card/90 backdrop-blur-sm border border-black/[0.06] dark:border-white/[0.08]"
                              style={{ color: hex }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hex }} />
                              {label}
                              {daysInStage !== null && (
                                <span className="opacity-50 tabular-nums ml-0.5">{daysInStage}d</span>
                              )}
                            </span>
                            {!isTerminal && nextStatus && (
                              <button
                                onClick={() => onSave("outreach_status", nextStatus)}
                                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/90 dark:bg-card/90 backdrop-blur-sm border border-black/[0.06] dark:border-white/[0.08] hover:border-black/[0.15] dark:hover:border-white/[0.15] transition-colors"
                                title={`Advance to ${OUTREACH_LABELS[nextStatus] || nextStatus}`}
                              >
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              </button>
                            )}
                            {key !== "lost" && (
                              <button
                                onClick={() => onSave("outreach_status", "lost")}
                                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/90 dark:bg-card/90 backdrop-blur-sm border border-black/[0.06] dark:border-white/[0.08] hover:border-red-300 dark:hover:border-red-500/30 transition-colors"
                                title="Mark as lost"
                              >
                                <X className="h-3 w-3 text-muted-foreground/50 hover:text-red-500" />
                              </button>
                            )}
                          </div>
                        );
                      })()}
                      {selectedProspect.niche && (
                        <button
                          onClick={() => onToggleFilterNiche(String(selectedProspect.niche))}
                          className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/90 dark:bg-card/90 backdrop-blur-sm border border-black/[0.06] dark:border-white/[0.08] hover:border-black/[0.15] dark:hover:border-white/[0.15] transition-colors cursor-pointer"
                          style={{ color: getNicheColor(String(selectedProspect.niche)).hex }}
                          title="Filter by this niche"
                        >
                          {selectedProspect.niche}
                        </button>
                      )}
                      {/* Priority dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="inline-flex items-center px-2 py-1 rounded-full bg-white/90 dark:bg-card/90 backdrop-blur-sm border border-black/[0.06] dark:border-white/[0.08] hover:border-black/[0.15] dark:hover:border-white/[0.15] transition-colors cursor-pointer">
                            <SignalBars priority={String(selectedProspect.priority || "")} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-36">
                          {INLINE_PRIORITY_OPTIONS.map((p) => (
                            <DropdownMenuItem key={p} onClick={() => onSave("priority", p)} className={cn("text-[12px] capitalize flex items-center gap-2", String(selectedProspect.priority) === p && "font-semibold")}>
                              <SignalBars priority={p} />
                              {p}
                              {String(selectedProspect.priority) === p && <Check className="h-3 w-3 ml-auto" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 3-column body (Contact | Enrichment | Actions) ── */}
            <div className="flex-1 min-h-0 overflow-hidden px-1.5 pb-1.5 pt-3 relative z-10 flex flex-col md:flex-row gap-1.5">

              {/* Panel 1: Contact */}
              <div className="flex-1 min-w-0 min-h-0 overflow-hidden bg-white/60 dark:bg-card/60 backdrop-blur-sm rounded-lg flex flex-col">
                {/* Fixed top section */}
                <div className="p-3 pb-0 flex flex-col gap-2 shrink-0">
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Contact</h4>
                  <div className="group/field flex items-center gap-2 rounded-md px-1 -mx-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover/field:text-muted-foreground/70 transition-colors" />
                    {editableField("city", String(selectedProspect.city || ""), "Add location", "text-[12px] text-muted-foreground flex-1 min-w-0")}
                  </div>
                  <div className="group/field flex items-center gap-2 rounded-md px-1 -mx-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover/field:text-muted-foreground/70 transition-colors" />
                    {editableField("website", String(selectedProspect.website || ""), "Add website", "text-[12px] text-brand-indigo flex-1 min-w-0")}
                  </div>
                  <div className="h-px bg-border/30" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Contact</h4>
                      <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-muted/40">
                        {([1, 2] as const).map((slot) => (
                          <button
                            key={slot}
                            onClick={() => setContactSlot(slot)}
                            className={cn(
                              "text-[10px] font-semibold w-5 h-5 rounded flex items-center justify-center transition-all",
                              contactSlot === slot
                                ? "bg-white dark:bg-card shadow-sm text-foreground"
                                : "text-muted-foreground/50 hover:text-muted-foreground"
                            )}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                    {selectedProspect.Accounts_id ? (
                      <a href={`/accounts`} onClick={(e) => { e.preventDefault(); localStorage.setItem("selectedAccountId", String(selectedProspect.Accounts_id)); window.location.href = "/accounts"; }} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors cursor-pointer">
                        <Building2 className="h-3 w-3" />
                        Account #{selectedProspect.Accounts_id}
                      </a>
                    ) : (
                      <button onClick={handleConvertToAccount} disabled={converting} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50">
                        <Plus className="h-3 w-3" />
                        Create Account
                      </button>
                    )}
                  </div>
                  {(() => {
                    const nameKey = contactSlot === 1 ? "contact_name" : "contact2_name";
                    const roleKey = contactSlot === 1 ? "contact_role" : "contact2_role";
                    const emailKey = contactSlot === 1 ? "contact_email" : "contact2_email";
                    const phoneKey = contactSlot === 1 ? "contact_phone" : "contact2_phone";
                    const linkedinKey = contactSlot === 1 ? "contact_linkedin" : "contact2_linkedin";
                    return (
                      <div className="flex flex-col gap-2">
                        {editableField(nameKey, String(selectedProspect[nameKey] || ""), "Add name", "text-[13px] font-medium text-foreground")}
                        {editableField(roleKey, String(selectedProspect[roleKey] || ""), "Add role", "text-[11px] text-muted-foreground")}
                        <div className="group/field flex items-center gap-2 rounded-md px-1 -mx-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover/field:text-muted-foreground/70 transition-colors" />
                          {editableField(emailKey, String(selectedProspect[emailKey] || ""), "Add email", "text-[12px] text-brand-indigo flex-1 min-w-0")}
                        </div>
                        <div className="group/field flex items-center gap-2 rounded-md px-1 -mx-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover/field:text-muted-foreground/70 transition-colors" />
                          {editableField(phoneKey, String(selectedProspect[phoneKey] || ""), "Add phone", "text-[12px] text-foreground flex-1 min-w-0")}
                        </div>
                        <div className="group/field flex items-center gap-2 rounded-md px-1 -mx-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors">
                          <Linkedin className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover/field:text-muted-foreground/70 transition-colors" />
                          {editableField(linkedinKey, String(selectedProspect[linkedinKey] || ""), "Add LinkedIn", "text-[12px] text-brand-indigo flex-1 min-w-0")}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="h-px bg-border/30" />
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Source</h4>
                  {editableField("source", String(selectedProspect.source || ""), "Add source", "text-[12px] text-muted-foreground")}
                </div>

                {/* Scrollable collapsible sections */}
                <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-6 scroll-fade-bottom">
                  <CollapsibleSection id="contact-ideas" title={t("sections.offerIdeas")} icon={Lightbulb} hasData={!!selectedProspect.offer_ideas}>
                    <ProspectBusinessIdeas offerIdeas={selectedProspect.offer_ideas} compact prospectId={selectedProspect.Id || selectedProspect.id} onRefresh={onRefreshProspect} />
                  </CollapsibleSection>

                  <CollapsibleSection id="contact-notes" title={t("sections.notes")} icon={FileText} hasData={!!selectedProspect.notes}>
                    {editableMultiline("notes", String(selectedProspect.notes || ""), "No notes yet", "text-[12px] leading-relaxed text-foreground")}
                  </CollapsibleSection>
                </div>
              </div>

              {/* Panel 2: Enrichment */}
              <div className="flex-1 min-w-0 min-h-0 overflow-hidden bg-white/60 dark:bg-card/60 backdrop-blur-sm rounded-lg">
                <EnrichmentPanel prospect={selectedProspect} onRefresh={onRefreshProspect} />
              </div>

              {/* Panel 3: Actions */}
              <div className="flex-1 min-w-0 min-h-0 overflow-hidden bg-white/70 dark:bg-card/70 backdrop-blur-sm rounded-lg flex flex-col">
                <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-6 scroll-fade-bottom">
                  <CollapsibleSection id="actions-next" title={t("sections.nextAction")} icon={Target} hasData={!!selectedProspect.next_action}>
                    {editableMultiline("next_action", String(selectedProspect.next_action || ""), "No next action set", "text-[13px] leading-relaxed text-foreground")}
                  </CollapsibleSection>

                  <CollapsibleSection id="actions-emails" title={t("sections.emails")} icon={Mail} hasData>
                    <InteractionTimeline
                      prospectId={selectedProspect.Id ?? selectedProspect.id ?? 0}
                      onReply={(ctx) => {
                        setReplyContext(ctx);
                        setEmailComposeOpen(true);
                      }}
                    />
                  </CollapsibleSection>

                  <CollapsibleSection id="actions-whatsapp" title={t("sections.whatsApp")} icon={MessageSquare} hasData>
                    <WhatsAppComposer
                      prospectId={selectedProspect.Id ?? selectedProspect.id ?? 0}
                      prospectPhone={selectedProspect.phone || selectedProspect.contact_phone || null}
                    />
                  </CollapsibleSection>

                  <CollapsibleSection id="actions-interactions" title={t("sections.interactions")} icon={Clock} hasData>
                    <OutreachTimeline prospectId={selectedProspect.Id ?? selectedProspect.id ?? 0} />
                  </CollapsibleSection>

                  <CollapsibleSection id="actions-tasks" title={t("sections.tasks")} icon={CheckSquare} hasData>
                    <ProspectTasks prospectCompanyName={selectedProspect.company || ""} compact />
                  </CollapsibleSection>

                  {/* Pipeline info (not collapsible) */}
                  {selectedProspect.outreach_status && selectedProspect.outreach_status !== "new" && (
                    <>
                      <div className="h-px bg-border/30 mt-3" />
                      <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-gradient-to-br from-brand-indigo/[0.04] to-transparent border border-brand-indigo/[0.08] mt-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">Pipeline Stage</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: OUTREACH_HEX[(selectedProspect.outreach_status as OutreachStatus)] || "#6B7280" }}
                          />
                          <span className="text-[13px] font-medium text-foreground capitalize">{selectedProspect.outreach_status.replace(/_/g, " ")}</span>
                        </div>
                        {selectedProspect.first_contacted_at && (
                          <span className="text-[10px] text-muted-foreground">First contact: {new Date(selectedProspect.first_contacted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

            </div>

          </div>
        ) : (
          <ProspectDetailViewEmpty />
        )}
      </div>

      {/* Email compose modal */}
      {selectedProspect && (
        <EmailComposeModal
          open={emailComposeOpen}
          onOpenChange={(open) => {
            setEmailComposeOpen(open);
            if (!open) setReplyContext(null);
          }}
          prospect={selectedProspect}
          replyTo={replyContext || undefined}
        />
      )}

      {/* Mobile detail sheet removed — narrow screens now show detail inline */}

      {/* Gradient Tester floating panel */}
      <GradientTester
        open={gradientTesterOpen}
        onClose={() => setGradientTesterOpen(false)}
        layers={gradientLayers}
        onUpdateLayer={updateGradientLayer}
        onResetLayers={() => setGradientLayers(PAGE_DEFAULT_LAYERS)}
        dragMode={gradientDragMode}
        onToggleDragMode={() => setGradientDragMode(prev => !prev)}
        onSave={handleSaveGradient}
        onApply={handleApplyGradient}
      />
    </div>
  );
}
