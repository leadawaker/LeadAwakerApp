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
  ChevronRight,
  MapPin,
  X,
} from "lucide-react";
import { GradientTester, GradientControlPoints, DEFAULT_LAYERS, layerToStyle, type GradientLayer } from "@/components/ui/gradient-tester";
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
import { OUTREACH_HEX, OUTREACH_LABELS, type OutreachStatus } from "./OutreachPipelineView";
import { ProspectCreatePanel } from "./ProspectCreatePanel";
import { getInitials, getAccountAvatarColor } from "@/lib/avatarUtils";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { SkeletonAccountPanel } from "@/components/ui/skeleton";

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
  conversation_starters?: string;
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
export type ProspectGroupBy = "status" | "niche" | "country" | "priority" | "none";
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

// ── Status colors ─────────────────────────────────────────────────────────────

const PROSPECT_STATUS_HEX: Record<string, string> = {
  New:          "#3B82F6", // blue
  Contacted:    "#F59E0B", // amber
  "In Progress": "#6366F1", // indigo
  Converted:    "#10B981", // emerald
  Archived:     "#64748B", // slate
};

const PRIORITY_HEX: Record<string, string> = {
  High:   "#EF4444",
  Medium: "#F59E0B",
  Low:    "#94A3B8",
};

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
  { id: "followups", tKey: "views.followups", icon: Clock },
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
      <div className="px-3 pt-3 pb-2.5 flex flex-col gap-2">

        {/* Top row: Avatar + Name + Niche badge */}
        <div className="flex items-start gap-2.5">
          <EntityAvatar
            name={name}
            photoUrl={prospect.photo_url}
            bgColor={nicheColor.hex}
            textColor="#fff"
          />
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-start justify-between gap-1.5">
              <p className="text-[18px] font-semibold font-heading leading-tight truncate text-foreground">
                {name}
              </p>
              {niche && (
                <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-black/[0.07] text-foreground/40 mt-0.5 whitespace-nowrap">
                  {niche}
                </span>
              )}
            </div>
            {/* Status dot + label + Priority + last updated */}
            <div className="flex items-center justify-between gap-1 mt-[3px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: statusHex }}
                />
                <span className="text-[11px] text-muted-foreground truncate">{status || "New"}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {priority && (
                  <span
                    className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1"
                    style={{
                      backgroundColor: `${PRIORITY_HEX[priority] || "#94A3B8"}18`,
                      color: PRIORITY_HEX[priority] || "#94A3B8",
                    }}
                  >
                    <span className="w-[8px] h-[2.5px] rounded-full" style={{ backgroundColor: PRIORITY_HEX[priority] || "#94A3B8" }} />
                    {priority}
                  </span>
                )}
                {lastUpdated && (
                  <span className="text-[10px] text-muted-foreground/45 tabular-nums">
                    {formatRelativeTime(lastUpdated)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

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
  onCreate: (data: NewProspectForm) => Promise<void>;
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
  hasNonDefaultControls: boolean;
  isGroupNonDefault: boolean;
  isSortNonDefault: boolean;
  onResetControls: () => void;
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
  hasNonDefaultControls,
  isGroupNonDefault,
  isSortNonDefault,
  onResetControls,
}: ProspectListViewProps) {
  const { t } = useTranslation("prospects");
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState(0);

  const viewTabs = useMemo(
    () => VIEW_TABS_CONFIG.map((tab) => ({ ...tab, label: t(tab.tKey) })),
    [t]
  );
  const [panelMode, setPanelMode] = useState<"view" | "create">("view");
  const PAGE_SIZE = 25;

  // ── Gradient tester state ──────────────────────────────────────────────────
  const [gradientTesterOpen, setGradientTesterOpen] = useState(false);
  const [gradientLayers, setGradientLayers] = useState<GradientLayer[]>(DEFAULT_LAYERS);
  const [gradientDragMode, setGradientDragMode] = useState(false);

  const updateGradientLayer = useCallback((id: number, patch: Partial<GradientLayer>) => {
    if (id === -1) { setGradientLayers(prev => [...prev, patch as GradientLayer]); return; }
    if (id === -2) { setGradientLayers(prev => prev.filter(l => l.id !== (patch as GradientLayer).id)); return; }
    setGradientLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }, []);

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
    } else {
      // niche, country — alphabetical
      orderedKeys = Array.from(buckets.keys()).sort();
    }

    const result: VirtualListItem[] = [];
    orderedKeys.forEach((key) => {
      const group = buckets.get(key);
      if (!group || group.length === 0) return;
      result.push({ kind: "header", label: key, count: group.length });
      group.forEach((p) => result.push({ kind: "prospect", prospect: p }));
    });
    return result;
  }, [prospects, listSearch, filterNiche, filterStatus, filterCountry, sortBy, groupBy]);

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
  useEffect(() => { setCurrentPage(0); }, [listSearch, filterNiche, filterStatus, filterCountry, groupBy, sortBy]);

  // Auto-select first prospect
  useEffect(() => {
    if (!selectedProspect && prospects.length > 0) {
      const first = flatItems.find((i) => i.kind === "prospect") as { kind: "prospect"; prospect: ProspectRow } | undefined;
      if (first) onSelectProspect(first.prospect);
    }
  }, [flatItems, selectedProspect, prospects.length, onSelectProspect]);

  const isFilterActive = filterNiche.length > 0 || filterStatus.length > 0 || filterCountry.length > 0;

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

  // ── Toolbar prefix for the right panel ──────────────────────────────────────
  const toolbarPrefix = (
    <>
      {/* +Add */}
      <button
        className={cn(xBase, xDefault, "hover:max-w-[80px]")}
        onClick={() => setPanelMode("create")}
      >
        <Plus className="h-4 w-4 shrink-0" />
        <span className={xSpan}>{t("toolbar.add")}</span>
      </button>

      {/* Search */}
      <SearchPill
        value={listSearch}
        onChange={onListSearchChange}
        open={searchOpen}
        onOpenChange={onSearchOpenChange}
        placeholder={t("page.searchPlaceholder")}
      />

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, isSortNonDefault ? xActive : xDefault, "hover:max-w-[100px]")}>
            <ArrowUpDown className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.sort")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("toolbar.sortBy")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.keys(SORT_TKEYS) as ProspectSortBy[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => onSortByChange(opt)} className={cn("text-[12px]", sortBy === opt && "font-semibold text-brand-indigo")}>
              {t(SORT_TKEYS[opt])}
              {sortBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

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
          {isFilterActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onResetControls} className="text-[12px] text-muted-foreground">
                {t("toolbar.clearAllFilters")}
              </DropdownMenuItem>
            </>
          )}
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
        <DropdownMenuContent align="start" className="w-44">
          {(Object.keys(GROUP_TKEYS) as ProspectGroupBy[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => onGroupByChange(opt)} className={cn("text-[12px]", groupBy === opt && "font-semibold text-brand-indigo")}>
              {t(GROUP_TKEYS[opt])}
              {groupBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Gradient Tester toggle */}
      <button
        onClick={() => setGradientTesterOpen(prev => !prev)}
        className={cn(xBase, "hover:max-w-[100px]", gradientTesterOpen ? "border-indigo-200 text-indigo-600 bg-indigo-100" : xDefault)}
        title="Gradient Tester"
      >
        <Paintbrush className="h-4 w-4 shrink-0" />
        <span className={xSpan}>Style</span>
      </button>
    </>
  );

  return (
    <div className="flex h-full gap-[3px]" data-testid="prospect-list-view">

      {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
      <div className={cn(
        "flex-col bg-muted rounded-lg overflow-hidden",
        "w-full md:w-[340px] md:shrink-0",
        isMobile && selectedProspect ? "hidden" : "flex"
      )}>

        {/* Header: title + ViewTabBar */}
        <div className="pl-[17px] pr-3.5 pt-3 md:pt-10 pb-3 shrink-0 flex items-center">
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

        {/* Prospect list */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-[3px]">
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
        isMobile && !selectedProspect ? "hidden" : "flex mobile-panel-enter"
      )}>
        {panelMode === "create" ? (
          <ProspectCreatePanel
            onCreate={async (data) => { await onCreate(data); setPanelMode("view"); }}
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
                  return style ? <div key={layer.id} className="absolute inset-0" style={style} /> : null;
                })}
                {gradientDragMode && (
                  <GradientControlPoints layers={gradientLayers} onUpdateLayer={updateGradientLayer} />
                )}
              </>
            ) : (
              <>
                <div className="absolute inset-0 bg-[#ffffff]" />
                <div className="absolute inset-0 bg-[linear-gradient(157deg,rgba(252,62,255,0.12)_0%,rgba(242,225,155,0.55)_100%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_148%_200%_at_100%_100%,rgba(255,200,134,0.4)_0%,transparent_80%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_200%_at_0%_0%,rgba(158,143,255,0.1)_0%,transparent_80%)]" />
              </>
            )}

            {/* ── Header ── */}
            <div className="shrink-0 relative z-10">
              <div className="relative px-4 pt-6 pb-4 md:pb-6 space-y-3">
                {/* Toolbar row */}
                <div className="flex items-center gap-1">
                  {isMobile && (
                    <button
                      onClick={() => (onSelectProspect as unknown as (v: null) => void)(null)}
                      className="h-9 w-9 rounded-full border border-black/[0.125] bg-background grid place-items-center shrink-0 mr-2"
                    >
                      <span className="text-sm">←</span>
                    </button>
                  )}
                  {toolbarPrefix}
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
                    <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight truncate">
                      {selectedProspect.name || selectedProspect.company || ""}
                    </h2>
                    {/* Outreach status / Niche / Priority — all on one row */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {selectedProspect.outreach_status && (() => {
                        const key = (selectedProspect.outreach_status || "new") as OutreachStatus;
                        const hex = OUTREACH_HEX[key] || "#6B7280";
                        const label = OUTREACH_LABELS[key] || key.replace(/_/g, " ");
                        return (
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold"
                            style={{ backgroundColor: `${hex}20`, color: hex }}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hex }} />
                            {label}
                          </span>
                        );
                      })()}
                      {selectedProspect.niche && (
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: getNicheColor(String(selectedProspect.niche)).hex + "18", color: getNicheColor(String(selectedProspect.niche)).hex }}
                        >
                          {selectedProspect.niche}
                        </span>
                      )}
                      {selectedProspect.priority && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/[0.07] text-foreground/50">
                          {selectedProspect.priority}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 3-column body ── */}
            <div className="flex-1 min-h-0 flex gap-[3px] px-[3px] pb-[3px] pt-3 overflow-hidden relative z-10">

              {/* Column 1: Contact Info */}
              <div className="w-full md:w-1/3 md:shrink-0 overflow-y-auto bg-white/60 dark:bg-card/60 backdrop-blur-sm rounded-lg p-4 flex flex-col gap-4">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Contact</h4>

                {/* Location */}
                {selectedProspect.city && (
                  <span className="text-[12px] text-muted-foreground">{selectedProspect.city}{selectedProspect.country ? `, ${selectedProspect.country}` : ""}</span>
                )}

                {/* Website */}
                {selectedProspect.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                    <a href={selectedProspect.website.startsWith("http") ? selectedProspect.website : `https://${selectedProspect.website}`} target="_blank" rel="noopener noreferrer" className="text-[12px] text-brand-indigo hover:underline truncate">{selectedProspect.website}</a>
                  </div>
                )}

                {/* Outreach stage */}
                {selectedProspect.outreach_status && selectedProspect.outreach_status !== "new" && (
                  <span className="text-[10px] font-medium text-muted-foreground/60 capitalize">{selectedProspect.outreach_status.replace(/_/g, " ")}</span>
                )}

                {/* Divider */}
                <div className="h-px bg-border/30" />

                {/* Primary contact */}
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Primary Contact</h4>
                <div className="flex flex-col gap-1.5">
                  {selectedProspect.contact_name && (
                    <span className="text-[13px] font-medium text-foreground">{selectedProspect.contact_name}</span>
                  )}
                  {selectedProspect.contact_role && (
                    <span className="text-[11px] text-muted-foreground">{selectedProspect.contact_role}</span>
                  )}
                  {selectedProspect.contact_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                      <a href={`mailto:${selectedProspect.contact_email}`} className="text-[12px] text-brand-indigo hover:underline truncate">{selectedProspect.contact_email}</a>
                    </div>
                  )}
                  {selectedProspect.contact_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                      <a href={`tel:${selectedProspect.contact_phone}`} className="text-[12px] text-foreground hover:underline">{selectedProspect.contact_phone}</a>
                    </div>
                  )}
                  {selectedProspect.contact_linkedin && (
                    <div className="flex items-center gap-2">
                      <Linkedin className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                      <a href={selectedProspect.contact_linkedin} target="_blank" rel="noopener noreferrer" className="text-[12px] text-brand-indigo hover:underline truncate">{selectedProspect.contact_linkedin.replace(/.*linkedin\.com\/in\//, "").replace(/\/$/, "")}</a>
                    </div>
                  )}
                  {!selectedProspect.contact_name && !selectedProspect.contact_email && !selectedProspect.contact_phone && (
                    <span className="text-[12px] text-muted-foreground/40 italic">No contact info yet</span>
                  )}
                </div>

                {/* Secondary contact */}
                {(selectedProspect.contact2_name || selectedProspect.contact2_email) && (
                  <>
                    <div className="h-px bg-border/30" />
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Second Contact</h4>
                    <div className="flex flex-col gap-1.5">
                      {selectedProspect.contact2_name && <span className="text-[13px] font-medium text-foreground">{selectedProspect.contact2_name}</span>}
                      {selectedProspect.contact2_role && <span className="text-[11px] text-muted-foreground">{selectedProspect.contact2_role}</span>}
                      {selectedProspect.contact2_email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                          <a href={`mailto:${selectedProspect.contact2_email}`} className="text-[12px] text-brand-indigo hover:underline truncate">{selectedProspect.contact2_email}</a>
                        </div>
                      )}
                      {selectedProspect.contact2_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                          <span className="text-[12px] text-foreground">{selectedProspect.contact2_phone}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Source */}
                {selectedProspect.source && (
                  <>
                    <div className="h-px bg-border/30" />
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Source</h4>
                    <span className="text-[12px] text-muted-foreground">{selectedProspect.source}</span>
                  </>
                )}
              </div>

              {/* Column 2: Enrichment & Notes */}
              <div className="hidden md:flex w-1/3 shrink-0 overflow-y-auto bg-white/60 dark:bg-card/60 backdrop-blur-sm rounded-lg p-4 flex-col gap-3">

                {/* LinkedIn Enrichment */}
                {(selectedProspect.ai_summary || selectedProspect.headline) ? (
                  <>
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">{t("sections.enrichment")}</h4>

                    {selectedProspect.headline && (
                      <p className="text-[13px] font-medium text-foreground">{selectedProspect.headline}</p>
                    )}

                    {(selectedProspect.connection_count || selectedProspect.follower_count) && (
                      <div className="flex gap-4">
                        {selectedProspect.connection_count && (
                          <span className="text-[11px] text-muted-foreground">
                            <span className="font-semibold text-foreground">{Number(selectedProspect.connection_count).toLocaleString()}</span> {t("fields.connectionCount").toLowerCase()}
                          </span>
                        )}
                        {selectedProspect.follower_count && (
                          <span className="text-[11px] text-muted-foreground">
                            <span className="font-semibold text-foreground">{Number(selectedProspect.follower_count).toLocaleString()}</span> {t("fields.followerCount").toLowerCase()}
                          </span>
                        )}
                      </div>
                    )}

                    {selectedProspect.ai_summary && (
                      <>
                        <div className="h-px bg-border/30" />
                        <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">{t("fields.aiSummary")}</h4>
                        <p className="text-[12px] text-foreground leading-relaxed">{selectedProspect.ai_summary}</p>
                      </>
                    )}

                    {selectedProspect.top_post && (
                      <>
                        <div className="h-px bg-border/30" />
                        <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">{t("fields.topPost")}</h4>
                        <p className="text-[12px] text-foreground/70 leading-relaxed italic">{selectedProspect.top_post}</p>
                      </>
                    )}

                    {selectedProspect.conversation_starters && (
                      <>
                        <div className="h-px bg-border/30" />
                        <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">{t("fields.conversationStarters")}</h4>
                        <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap">{selectedProspect.conversation_starters}</p>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">{t("sections.enrichment")}</h4>
                    <p className="text-[12px] text-muted-foreground/40 italic">{t("fields.notEnriched")}</p>
                  </>
                )}

                {/* Notes */}
                <div className="h-px bg-border/30" />
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">{t("sections.notes")}</h4>
                {selectedProspect.notes ? (
                  <p className="text-[12px] text-foreground whitespace-pre-wrap leading-relaxed">{selectedProspect.notes}</p>
                ) : (
                  <p className="text-[12px] text-muted-foreground/40 italic">No notes yet</p>
                )}
              </div>

              {/* Column 3: Actions & Follow-up */}
              <div className="hidden md:flex w-1/3 shrink-0 overflow-y-auto bg-white/60 dark:bg-card/60 backdrop-blur-sm rounded-lg p-4 flex-col gap-3">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Next Action</h4>

                {selectedProspect.next_action ? (
                  <p className="text-[13px] text-foreground leading-relaxed">{selectedProspect.next_action}</p>
                ) : (
                  <p className="text-[12px] text-muted-foreground/40 italic">No next action set</p>
                )}

                {/* Follow-up info */}
                <div className="h-px bg-border/30" />
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Follow-up</h4>
                {selectedProspect.next_follow_up_date ? (
                  <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                      <span className={cn("text-[13px] font-medium", new Date(selectedProspect.next_follow_up_date) < new Date() ? "text-red-500" : "text-foreground")}>
                        {new Date(selectedProspect.next_follow_up_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {new Date(selectedProspect.next_follow_up_date) < new Date() && (
                        <span className="text-[9px] font-bold text-red-500 uppercase">Overdue</span>
                      )}
                    </div>
                    {selectedProspect.follow_up_count != null && Number(selectedProspect.follow_up_count) > 0 && (
                      <span className="text-[11px] text-muted-foreground">{selectedProspect.follow_up_count} follow-up{Number(selectedProspect.follow_up_count) > 1 ? "s" : ""} sent</span>
                    )}
                  </div>
                ) : (
                  <p className="text-[12px] text-muted-foreground/40 italic">No follow-up scheduled</p>
                )}

                {/* Tasks placeholder */}
                <div className="h-px bg-border/30" />
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Tasks</h4>
                <div className="flex flex-col items-center justify-center text-center py-4">
                  <p className="text-[12px] text-muted-foreground/40 italic">No tasks yet</p>
                </div>

                {/* Interactions */}
                <div className="h-px bg-border/30" />
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Interactions</h4>

                {/* Pipeline info */}
                {selectedProspect.outreach_status && selectedProspect.outreach_status !== "new" && (
                  <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-muted/50">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">Pipeline Stage</span>
                    <span className="text-[13px] font-medium text-foreground capitalize">{selectedProspect.outreach_status.replace(/_/g, " ")}</span>
                    {selectedProspect.first_contacted_at && (
                      <span className="text-[10px] text-muted-foreground">First contact: {new Date(selectedProspect.first_contacted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                    )}
                    {selectedProspect.follow_up_count != null && Number(selectedProspect.follow_up_count) > 0 && (
                      <span className="text-[10px] text-muted-foreground">Follow-ups: {selectedProspect.follow_up_count}</span>
                    )}
                  </div>
                )}

                <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
                  <Mail className="h-6 w-6 text-muted-foreground/20 mb-1.5" />
                  <p className="text-[11px] text-muted-foreground/40">Interactions will appear here</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <ProspectDetailViewEmpty toolbarPrefix={toolbarPrefix} />
        )}
      </div>

      {/* Gradient Tester floating panel */}
      <GradientTester
        open={gradientTesterOpen}
        onClose={() => setGradientTesterOpen(false)}
        layers={gradientLayers}
        onUpdateLayer={updateGradientLayer}
        onResetLayers={() => setGradientLayers(DEFAULT_LAYERS)}
        dragMode={gradientDragMode}
        onToggleDragMode={() => setGradientDragMode(prev => !prev)}
      />
    </div>
  );
}
