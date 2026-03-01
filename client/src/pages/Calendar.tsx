import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLeads, useCampaigns } from "@/hooks/useApiData";
import { FiltersBar } from "@/components/crm/FiltersBar";
import { ChevronLeft, ChevronRight, AlertCircle, RefreshCw, X, Filter, Building2, ArrowUpDown, Layers, Check, SlidersHorizontal, Plus, Search, Phone, Mail, Grid3X3, Columns3, CalendarDays } from "lucide-react";
import { getLeadStatusAvatarColor } from "@/lib/avatarUtils";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { ContactSidebar } from "@/features/conversations/components/ContactSidebar";
import type { Lead as ConversationLead, Interaction } from "@/features/conversations/hooks/useConversationsData";
import { LeadDetailPanel } from "@/features/leads/components/LeadDetailPanel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { IconBtn } from "@/components/ui/icon-btn";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
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
import { apiFetch } from "@/lib/apiUtils";
import { BookedCallsKpi } from "@/components/crm/BookedCallsKpi";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useLocation } from "wouter";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatDate(date: Date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} - ${year}`;
}

type ViewMode = "month" | "week" | "day";

type Appointment = {
  id: number;
  lead_name: string;
  campaign_name: string | null;
  date: string;
  formattedDate: string;
  time: string;
  hour: number;
  minutes: number;
  status: string | undefined;
  calendar_link: string;
  no_show: boolean;
  re_scheduled_count: number;
  raw_booked_call_date: string;
  phone: string | null;
  email: string | null;
  callDurationMinutes: number;
  rawLead: Record<string, any>;
};

// ── View mode tab config ──────────────────────────────────────────────────────
const CALENDAR_TABS: TabDef[] = [
  { id: "month", label: "Month", icon: Grid3X3 },
  { id: "week",  label: "Week",  icon: Columns3 },
  { id: "day",   label: "Day",   icon: CalendarDays },
];

// ── Appointment date grouping ─────────────────────────────────────────────────
function getApptDateGroup(dateStr: string): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  // Parse the locale date string
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Later";
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (dDay.getTime() < today.getTime()) return "Past";
  if (dDay.getTime() === today.getTime()) return "Today";
  if (dDay.getTime() === tomorrow.getTime()) return "Tomorrow";
  if (dDay.getTime() < nextWeek.getTime()) return "This Week";
  return "Later";
}

const DATE_GROUP_ORDER = ["Today", "Tomorrow", "This Week", "Later", "Past"];

type ApptSortBy = "time" | "name" | "campaign" | "status";
type ApptGroupBy = "date" | "campaign" | "status" | "none";
type ApptFilterStatus = "no_show" | "rescheduled" | "confirmed";

const APPT_SORT_LABELS: Record<ApptSortBy, string> = {
  time: "Time",
  name: "Name A-Z",
  campaign: "Campaign",
  status: "Status",
};

const APPT_GROUP_LABELS: Record<ApptGroupBy, string> = {
  date: "Date",
  campaign: "Campaign",
  status: "Status",
  none: "None",
};

const APPT_FILTER_LABELS: Record<ApptFilterStatus, string> = {
  no_show: "No-Show",
  rescheduled: "Rescheduled",
  confirmed: "Confirmed",
};


// ── Draggable Booking Card ────────────────────────────────────────────────────
function DraggableBookingCard({
  appt,
  onClick,
  className,
  style,
  children,
}: {
  appt: Appointment;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `booking-${appt.id}`,
    data: { appt },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(e as any); } }}
      className={cn(className, isDragging && "opacity-30")}
      style={{ ...style, cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
      data-testid={`booking-card-${appt.id}`}
    >
      {children}
    </div>
  );
}

// ── Droppable Day Cell ────────────────────────────────────────────────────────
function DroppableDay({
  dateKey,
  children,
  className,
  onClick,
  onKeyDown,
  "aria-label": ariaLabel,
  "data-testid": dataTestId,
}: {
  dateKey: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-drop-${dateKey}`, data: { dateKey } });

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      aria-label={ariaLabel}
      className={cn(className, isOver && "ring-2 ring-inset ring-brand-indigo bg-brand-indigo/10")}
      data-testid={dataTestId}
    >
      {children}
    </div>
  );
}

// ── Droppable Time Slot ───────────────────────────────────────────────────────
function DroppableTimeSlot({
  dateKey,
  hour,
  hourHeight,
  className,
}: {
  dateKey: string;
  hour: number;
  hourHeight: number;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `timeslot-drop-${dateKey}-${hour}`,
    data: { dateKey, hour },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn("absolute left-0 right-0", className, isOver && "bg-brand-indigo/10")}
      style={{ top: hour * hourHeight, height: hourHeight }}
      data-testid={`timeslot-${dateKey}-${hour}`}
    />
  );
}

// ── Group header for appointment list ─────────────────────────────────────────
function ApptGroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="sticky top-0 z-20 bg-muted px-3 pt-3 pb-3">
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


// ── Appointment card (hover-expand, leads-style) ─────────────────────────────
function AppointmentCard({
  appt,
  isActive,
  onSelect,
  onSelectLead,
}: {
  appt: Appointment;
  isActive: boolean;
  onSelect: () => void;
  onSelectLead?: (lead: Record<string, any>) => void;
}) {
  const [editingDuration, setEditingDuration] = useState(false);
  const statusKey = appt.no_show ? "Lost" : (appt.status || "Contacted");
  const { bg: avatarBg, text: avatarText } = getLeadStatusAvatarColor(statusKey);

  const handleDurationChange = async (minutes: number) => {
    setEditingDuration(false);
    try {
      await apiFetch(`/api/leads/${appt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call_duration_minutes: minutes }),
      });
    } catch {}
  };

  return (
    <div
      className={cn(
        "group/card relative rounded-xl cursor-pointer",
        isActive ? "bg-highlight-selected" : "bg-card hover:bg-card-hover"
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      data-testid={`row-appt-${appt.id}`}
    >
      <div className="px-2.5 pt-2.5 pb-2 flex items-start gap-2">
        {/* Avatar */}
        <div
          className="shrink-0"
          data-testid={`appt-avatar-${appt.id}`}
        >
          <EntityAvatar
            name={appt.lead_name}
            bgColor={avatarBg}
            textColor={avatarText}
          />
        </div>

        {/* Name + campaign */}
        <div className="flex-1 min-w-0 pt-0.5">
          <p
            className={cn(
              "text-[16px] font-semibold font-heading leading-tight truncate",
              appt.no_show ? "text-red-600 dark:text-red-400" : "text-foreground"
            )}
            data-testid={`text-appt-name-${appt.id}`}
          >
            {appt.lead_name}
          </p>
          {appt.campaign_name && (
            <p className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5" data-testid={`text-appt-campaign-${appt.id}`}>
              {appt.campaign_name}
            </p>
          )}
        </div>

        {/* Right column: date / time / duration stacked */}
        <div className="shrink-0 flex flex-col items-end gap-0.5">
          <span className="text-[11px] text-muted-foreground tabular-nums leading-tight" data-testid={`date-${appt.id}`}>
            {appt.formattedDate}
          </span>
          <span className="text-[11px] font-bold tabular-nums leading-tight text-foreground" data-testid={`time-${appt.id}`}>
            {appt.time}
          </span>
          {editingDuration ? (
            <select
              autoFocus
              className="text-[10px] rounded border border-border/40 bg-popover px-1 py-0.5 cursor-pointer"
              defaultValue={appt.callDurationMinutes}
              onChange={(e) => handleDurationChange(Number(e.target.value))}
              onBlur={() => setEditingDuration(false)}
              onClick={(e) => e.stopPropagation()}
            >
              {[30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>{m}m</option>
              ))}
            </select>
          ) : (
            <span
              className="text-[10px] text-muted-foreground/60 cursor-pointer hover:text-foreground tabular-nums"
              onClick={(e) => { e.stopPropagation(); setEditingDuration(true); }}
              title="Edit duration"
              data-testid={`duration-${appt.id}`}
            >
              {appt.callDurationMinutes}m
            </span>
          )}
        </div>
      </div>

      {/* Hover-expand: contact info + rescheduled/no-show labels */}
      <div className="grid grid-rows-[0fr] group-hover/card:grid-rows-[1fr] transition-[grid-template-rows] duration-200 ease-out">
        <div className="overflow-hidden">
          <div className="px-2.5 pb-2.5 pt-1 flex flex-col gap-1.5 border-t border-border/20">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground truncate">{appt.phone || "\u2014"}</span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground truncate">{appt.email || "\u2014"}</span>
              </div>
            </div>
            {(appt.re_scheduled_count > 0 || appt.no_show) && (
              <div className="flex items-center gap-2.5">
                {appt.re_scheduled_count > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-amber-600"
                    data-testid={`reschedule-icon-${appt.id}`}
                  >
                    <RefreshCw className="h-3 w-3 shrink-0" />
                    <span className="text-[10px] font-semibold">Rescheduled x{appt.re_scheduled_count}</span>
                  </span>
                )}
                {appt.no_show && (
                  <span
                    className="inline-flex items-center gap-1 text-red-500"
                    data-testid={`no-show-icon-${appt.id}`}
                  >
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span className="text-[10px] font-semibold">No Show</span>
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


export default function CalendarPage() {
  const { currentAccountId, isAgencyUser, accounts } = useWorkspace();
  const { leads, loading: leadsLoading, refresh: refetchLeads } = useLeads();
  const { campaigns } = useCampaigns();
  const [campaignId, setCampaignId] = useState<number | "all">("all");
  const [calendarAccountFilter, setCalendarAccountFilter] = useState<number | "all">("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Appointment | null>(null);
  const timeGridRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [apptSortBy, setApptSortBy] = useState<ApptSortBy>("time");
  const [apptGroupBy, setApptGroupBy] = useState<ApptGroupBy>("date");
  const [apptFilterStatuses, setApptFilterStatuses] = useState<ApptFilterStatus[]>([]);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Lead detail panel state
  const [selectedLead, setSelectedLead] = useState<Record<string, any> | null>(null);
  const [fullProfileLead, setFullProfileLead] = useState<Record<string, any> | null>(null);
  const [selectedLeadTags, setSelectedLeadTags] = useState<{ name: string; color: string }[]>([]);

  // Recent messages for the ContactSidebar
  const [recentMessages, setRecentMessages] = useState<Interaction[]>([]);
  const [recentMessagesLoading, setRecentMessagesLoading] = useState(false);
  const [, goTo] = useLocation();

  // Book popover state
  const [bookPopoverOpen, setBookPopoverOpen] = useState(false);
  const [bookLeadSearch, setBookLeadSearch] = useState("");
  const [bookSelectedLead, setBookSelectedLead] = useState<Record<string, any> | null>(null);
  const [bookDate, setBookDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [bookTime, setBookTime] = useState("10:00");
  const [bookDuration, setBookDuration] = useState(60);
  const [bookSubmitting, setBookSubmitting] = useState(false);

  // Responsive
  const [viewportWidth, setViewportWidth] = useState(() => typeof window !== "undefined" ? window.innerWidth : 1024);
  const isMobile = viewportWidth < 640;
  const isTablet = viewportWidth >= 640 && viewportWidth < 1024;

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setViewportWidth(w);
      if (w < 640) setViewMode("day");
    };
    window.addEventListener("resize", handleResize);
    if (window.innerWidth < 640) setViewMode("day");
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // DnD state
  const [activeAppt, setActiveAppt] = useState<Appointment | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragToast, setDragToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (viewMode === "week" || viewMode === "day") {
      const id = requestAnimationFrame(() => {
        if (timeGridRef.current) {
          const now = new Date();
          const scrollPos = (now.getHours() * 60 + now.getMinutes()) * (80 / 60);
          timeGridRef.current.scrollTop = Math.max(0, scrollPos - 56 - 2 * 80);
        }
      });
      return () => cancelAnimationFrame(id);
    }
  }, [viewMode]);

  const todayStr = new Date().toLocaleDateString();

  const effectiveAccountFilter = isAgencyUser ? calendarAccountFilter : currentAccountId;

  const appts = useMemo((): Appointment[] => {
    if (!leads) return [];
    return leads
      .filter((l: any) => {
        if (!isAgencyUser) {
          return (l.account_id || l.accounts_id) === currentAccountId;
        }
        if (effectiveAccountFilter === "all") return true;
        return (l.account_id || l.accounts_id) === effectiveAccountFilter;
      })
      .filter((l: any) => (campaignId === "all" ? true : (l.campaign_id || l.campaigns_id) === campaignId))
      .filter((l: any) => Boolean(l.booked_call_date) && (l.conversion_status === "Booked" || l.Conversion_Status === "Booked"))
      .map((l: any) => {
        const d = new Date(l.booked_call_date as string);
        const firstName = l.first_name || "";
        const lastName = l.last_name || "";
        const fullName = l.full_name || (firstName || lastName ? `${firstName} ${lastName}`.trim() : "Unknown Lead");
        return {
          id: l.id,
          lead_name: fullName,
          campaign_name: l.campaign_name || null,
          date: d.toLocaleDateString(),
          formattedDate: formatDate(d),
          time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          hour: d.getHours(),
          minutes: d.getMinutes(),
          status: l.conversion_status,
          calendar_link: l.calendar_link || "https://cal.example.com/leadawaker",
          no_show: l.no_show === true || l.no_show === "true" || l.no_show === 1,
          re_scheduled_count: Number(l.re_scheduled_count) || 0,
          raw_booked_call_date: l.booked_call_date as string,
          phone: l.phone || l.Phone || null,
          email: l.email || l.Email || null,
          callDurationMinutes: Number(l.call_duration_minutes) || 60,
          rawLead: l,
        };
      })
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [leads, currentAccountId, isAgencyUser, effectiveAccountFilter, campaignId]);

  const [anchorDate, setAnchorDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });

  const month = useMemo(() => new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1), [anchorDate]);

  const days = useMemo(() => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(year, m, 1);
    const startDow = first.getDay();
    const gridStart = new Date(year, m, 1 - startDow);

    const out: { date: Date; count: number }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const key = d.toLocaleDateString();
      const count = appts.filter((a) => a.date === key).length;
      out.push({ date: d, count });
    }
    return out;
  }, [month, appts]);

  const weekDays = useMemo(() => {
    const startOfWeek = new Date(anchorDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);

    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      out.push(d);
    }
    return out;
  }, [anchorDate]);

  const appointmentsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return appts.filter((a) => a.date === selectedDate);
  }, [selectedDate, appts]);

  // Filtered + sorted appointments for left panel
  const sortedAppts = useMemo(() => {
    let source = selectedDate ? appointmentsForSelectedDate : appts;

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      source = source.filter((a) =>
        a.lead_name.toLowerCase().includes(q) ||
        (a.campaign_name || "").toLowerCase().includes(q)
      );
    }

    // Apply filters
    let filtered = source;
    if (apptFilterStatuses.length > 0) {
      filtered = source.filter((a) => {
        if (apptFilterStatuses.includes("no_show") && a.no_show) return true;
        if (apptFilterStatuses.includes("rescheduled") && a.re_scheduled_count > 0) return true;
        if (apptFilterStatuses.includes("confirmed") && !a.no_show && a.re_scheduled_count === 0) return true;
        return false;
      });
    }

    // Apply sort
    const sorted = [...filtered];
    switch (apptSortBy) {
      case "name":
        sorted.sort((a, b) => a.lead_name.localeCompare(b.lead_name));
        break;
      case "campaign":
        sorted.sort((a, b) => (a.campaign_name || "").localeCompare(b.campaign_name || ""));
        break;
      case "status":
        sorted.sort((a, b) => (a.status || "").localeCompare(b.status || ""));
        break;
      case "time":
      default:
        break; // already sorted by time
    }
    return sorted;
  }, [appts, selectedDate, appointmentsForSelectedDate, apptSortBy, apptFilterStatuses, searchQuery]);

  // Grouped appointments for left panel
  const groupedAppts = useMemo(() => {
    if (selectedDate && apptGroupBy === "date") {
      return [{ label: null as string | null, items: sortedAppts }];
    }

    switch (apptGroupBy) {
      case "none":
        return [{ label: null as string | null, items: sortedAppts }];
      case "campaign": {
        const buckets = new Map<string, Appointment[]>();
        for (const a of sortedAppts) {
          const key = a.campaign_name || "No Campaign";
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key)!.push(a);
        }
        return Array.from(buckets.entries()).map(([label, items]) => ({ label: label as string | null, items }));
      }
      case "status": {
        const buckets = new Map<string, Appointment[]>();
        for (const a of sortedAppts) {
          const key = a.no_show ? "No Show" : (a.status || "Unknown");
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key)!.push(a);
        }
        return Array.from(buckets.entries()).map(([label, items]) => ({ label: label as string | null, items }));
      }
      case "date":
      default: {
        const buckets = new Map<string, Appointment[]>();
        for (const a of sortedAppts) {
          const group = getApptDateGroup(a.raw_booked_call_date);
          if (!buckets.has(group)) buckets.set(group, []);
          buckets.get(group)!.push(a);
        }
        const result: { label: string | null; items: Appointment[] }[] = [];
        for (const key of DATE_GROUP_ORDER) {
          const items = buckets.get(key);
          if (items && items.length > 0) result.push({ label: key, items });
        }
        return result;
      }
    }
  }, [sortedAppts, selectedDate, apptGroupBy]);

  const totalApptCount = useMemo(() => {
    return sortedAppts.length;
  }, [sortedAppts]);

  // Auto-select first upcoming appointment when nothing is selected
  useEffect(() => {
    if (selectedBooking || sortedAppts.length === 0) return;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const firstUpcoming = sortedAppts.find((a) => new Date(a.raw_booked_call_date) >= now);
    if (firstUpcoming) setSelectedBooking(firstUpcoming);
    else setSelectedBooking(sortedAppts[0]);
  }, [sortedAppts]); // eslint-disable-line react-hooks/exhaustive-deps

  const bookFilteredLeads = useMemo(() => {
    if (!bookLeadSearch.trim()) return [];
    const q = bookLeadSearch.toLowerCase();
    return (leads || []).filter((l: any) => {
      const name = (l.full_name || `${l.first_name || ""} ${l.last_name || ""}`.trim() || "").toLowerCase();
      return name.includes(q);
    }).slice(0, 8) as Record<string, any>[];
  }, [leads, bookLeadSearch]);

  const handleDateClick = (dateStr: string) => {
    if (isDragging) return;
    setSelectedDate(prev => prev === dateStr ? null : dateStr);
  };

  const navigate = (direction: number) => {
    const next = new Date(anchorDate);
    if (viewMode === "month") {
      next.setMonth(anchorDate.getMonth() + direction);
    } else if (viewMode === "week") {
      next.setDate(anchorDate.getDate() + (direction * 7));
    } else {
      next.setDate(anchorDate.getDate() + direction);
    }
    setAnchorDate(next);
  };

  const viewLabel = useMemo(() => {
    if (viewMode === "month") return `${FULL_MONTHS[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
    if (viewMode === "week") {
      const start = weekDays[0];
      const end = weekDays[6];
      const sameMonth = start.getMonth() === end.getMonth();
      return sameMonth
        ? `${MONTHS[start.getMonth()]} ${start.getDate()} - ${end.getDate()}, ${end.getFullYear()}`
        : `${MONTHS[start.getMonth()]} ${start.getDate()} - ${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${FULL_MONTHS[anchorDate.getMonth()]} ${anchorDate.getDate()}, ${anchorDate.getFullYear()}`;
  }, [viewMode, anchorDate, weekDays]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const HOUR_H = 80;
  const LABEL_W = 56;

  const campaignOptions = useMemo(() => {
    const fromLeads = new Map<number, string>();
    for (const l of (leads || [])) {
      const lead = l as any;
      const accId = lead.account_id || lead.accounts_id;
      if (!isAgencyUser) {
        if (accId !== currentAccountId) continue;
      } else if (effectiveAccountFilter !== "all") {
        if (accId !== effectiveAccountFilter) continue;
      }
      if (!lead.booked_call_date) continue;
      const cid = lead.campaign_id || lead.campaigns_id;
      const cname = lead.campaign_name;
      if (cid && cname) {
        fromLeads.set(Number(cid), cname);
      }
    }

    const fromApi = (campaigns || []).filter((c: any) => {
      if (isAgencyUser && effectiveAccountFilter === "all") return true;
      const targetAccountId = isAgencyUser ? effectiveAccountFilter : currentAccountId;
      const accId = c.account_id || c.accounts_id || c.Accounts_id;
      return !accId || accId === targetAccountId;
    });

    const merged = new Map<number, any>();
    for (const c of fromApi) {
      merged.set(c.id, c);
    }
    for (const [cid, cname] of Array.from(fromLeads)) {
      if (!merged.has(cid)) {
        merged.set(cid, { id: cid, name: cname, status: null });
      }
    }

    return Array.from(merged.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [campaigns, currentAccountId, isAgencyUser, effectiveAccountFilter, leads]);

  const selectedCampaignName = useMemo(() => {
    if (campaignId === "all") return null;
    const found = campaignOptions.find((c: any) => c.id === campaignId);
    return found ? (found as any).name : null;
  }, [campaignId, campaignOptions]);

  const selectedAccountName = useMemo((): string => {
    if (calendarAccountFilter === "all") return "All Accounts";
    const acc = (accounts || []).find((a: any) => (a.id || a.Id) === calendarAccountFilter);
    return acc ? (String(acc.name || acc.Name || `Account ${calendarAccountFilter}`)) : `Account ${calendarAccountFilter}`;
  }, [calendarAccountFilter, accounts]);

  const handleAccountFilterChange = useCallback((accId: number | "all") => {
    setCalendarAccountFilter(accId);
    setCampaignId("all");
    setSelectedDate(null);
  }, []);

  const handleSelectLead = useCallback(async (lead: Record<string, any>) => {
    setSelectedLead(lead);
    try {
      const resp = await apiFetch(`/api/leads/${lead.id || lead.Id}/tags`);
      if (resp.ok) {
        const tags = await resp.json();
        setSelectedLeadTags(Array.isArray(tags) ? tags : []);
      }
    } catch {
      setSelectedLeadTags([]);
    }
  }, []);

  // Fetch recent messages when a lead is selected (for right panel)
  const activePanelLeadId = selectedBooking?.rawLead?.id ?? selectedBooking?.rawLead?.Id ?? selectedLead?.id ?? selectedLead?.Id ?? null;
  useEffect(() => {
    if (!activePanelLeadId) { setRecentMessages([]); return; }
    let cancelled = false;
    setRecentMessagesLoading(true);
    (async () => {
      try {
        const res = await apiFetch(`/api/interactions?leadId=${activePanelLeadId}`);
        if (!res.ok) { if (!cancelled) setRecentMessages([]); return; }
        const data = await res.json();
        const list: Interaction[] = Array.isArray(data) ? data : data?.list || [];
        const sorted = list.sort((a, b) =>
          (a.created_at ?? a.createdAt ?? "").localeCompare(b.created_at ?? b.createdAt ?? "")
        );
        if (!cancelled) setRecentMessages(sorted.slice(-20));
      } catch {
        if (!cancelled) setRecentMessages([]);
      } finally {
        if (!cancelled) setRecentMessagesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activePanelLeadId]);

  // Update lead handler for ContactSidebar
  const handleCalendarUpdateLead = useCallback(async (leadId: number, patch: Record<string, unknown>) => {
    await apiFetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }, []);

  const handleBookLead = useCallback(async () => {
    if (!bookSelectedLead || !bookDate || !bookTime) return;
    setBookSubmitting(true);
    try {
      const dt = new Date(`${bookDate}T${bookTime}`);
      await apiFetch(`/api/leads/${bookSelectedLead.id || bookSelectedLead.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booked_call_date: dt.toISOString(),
          conversion_status: "Booked",
          call_duration_minutes: bookDuration,
        }),
      });
      refetchLeads();
      setBookPopoverOpen(false);
      setBookSelectedLead(null);
      setBookLeadSearch("");
    } catch {}
    setBookSubmitting(false);
  }, [bookSelectedLead, bookDate, bookTime, bookDuration, refetchLeads]);

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const appt = event.active.data.current?.appt as Appointment | undefined;
    if (appt) {
      setActiveAppt(appt);
      setIsDragging(true);
      setSelectedBooking(null);
    }
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveAppt(null);
    setIsDragging(false);

    const { active, over } = event;
    if (!over) return;

    const appt = active.data.current?.appt as Appointment | undefined;
    if (!appt) return;

    const overData = over.data.current as { dateKey?: string; hour?: number } | undefined;
    const targetDateKey = overData?.dateKey as string | undefined;
    const targetHour = overData?.hour as number | undefined;

    if (!targetDateKey) return;

    const isTimeSlotDrop = targetHour !== undefined;
    const origDate = new Date(appt.raw_booked_call_date);
    const [monthPart, dayPart, yearPart] = targetDateKey.split("/").map(Number);

    let newDate: Date;
    if (isTimeSlotDrop) {
      newDate = new Date(yearPart, monthPart - 1, dayPart, targetHour, origDate.getMinutes(), origDate.getSeconds());
    } else {
      newDate = new Date(yearPart, monthPart - 1, dayPart, origDate.getHours(), origDate.getMinutes(), origDate.getSeconds());
    }

    if (isNaN(newDate.getTime())) return;

    const sameDate = appt.date === targetDateKey;
    const sameHour = !isTimeSlotDrop || appt.hour === targetHour;
    if (sameDate && sameHour) return;

    const newBookedCallDate = newDate.toISOString();
    const newRescheduledCount = appt.re_scheduled_count + 1;

    try {
      const resp = await apiFetch(`/api/leads/${appt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booked_call_date: newBookedCallDate,
          re_scheduled_count: newRescheduledCount,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as any).message || `HTTP ${resp.status}`);
      }

      if (typeof refetchLeads === "function") {
        refetchLeads();
      }

      const targetFormatted = isTimeSlotDrop
        ? `${formatDate(newDate)} at ${newDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : formatDate(newDate);
      setDragToast({ message: `${appt.lead_name} rescheduled to ${targetFormatted}`, type: "success" });
      setTimeout(() => setDragToast(null), 4000);
    } catch (err: any) {
      setDragToast({ message: `Failed to reschedule: ${err.message}`, type: "error" });
      setTimeout(() => setDragToast(null), 5000);
    }
  }, [refetchLeads]);

  const handleDragCancel = useCallback(() => {
    setActiveAppt(null);
    setIsDragging(false);
  }, []);

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (leadsLoading) {
    return (
      <CrmShell>
        <div className="space-y-4 py-4" data-testid="page-calendar">
          <div className="flex items-center justify-between px-2">
            <Skeleton className="h-8 w-40 rounded-lg" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-px rounded-2xl overflow-hidden">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={`h-${i}`} className="h-8 rounded-none" />
            ))}
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-none bg-card" />
            ))}
          </div>
        </div>
      </CrmShell>
    );
  }

  return (
    <CrmShell>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className={cn(
          "flex flex-col px-0 py-0 bg-transparent",
          isMobile || isTablet ? "h-auto overflow-y-auto" : "h-full overflow-hidden"
        )} data-testid="page-calendar">
          {/* Hidden legacy header */}
          <div className="flex items-center gap-4 mb-6 shrink-0 hidden">
            <h1 className="text-2xl font-extrabold tracking-tight" data-testid="text-title">Calendar</h1>
            <FiltersBar selectedCampaignId={campaignId} setSelectedCampaignId={setCampaignId} />
          </div>

          <div className={cn(
            "flex-1 min-h-0 gap-[3px]",
            isMobile || isTablet
              ? "flex flex-col overflow-y-auto"
              : (selectedBooking || selectedLead)
                ? "grid grid-cols-[340px_1fr_340px]"
                : "grid grid-cols-1 lg:grid-cols-[340px_1fr]"
          )} data-testid="layout-calendar">

            {/* ══════════════════════════════════════════════════════════════════
                RIGHT PANEL — Calendar views
               ══════════════════════════════════════════════════════════════════ */}
            <div className={cn(
              "bg-card overflow-hidden flex flex-col rounded-lg lg:order-2",
              isMobile || isTablet ? "min-h-[420px]" : "h-full"
            )} data-testid="calendar-main">

              {/* ── Toolbar ── */}
              <div className="px-3.5 pt-5 pb-2.5 flex flex-wrap items-center gap-2 shrink-0">
                {/* Date navigation */}
                <div className="flex items-center gap-1.5">
                  <button
                    className="h-9 w-9 rounded-full border border-black/[0.125] bg-transparent hover:bg-card inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                    onClick={() => navigate(-1)}
                    title="Previous"
                    data-testid="button-prev"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="text-2xl font-semibold font-heading text-foreground text-center leading-tight" data-testid="text-view-label">
                    {viewLabel}
                  </div>
                  <button
                    className="h-9 w-9 rounded-full border border-black/[0.125] bg-transparent hover:bg-card inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                    onClick={() => navigate(1)}
                    title="Next"
                    data-testid="button-next"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Today button */}
                <button
                  className="h-9 px-3 rounded-full border border-black/[0.125] bg-transparent text-[12px] font-medium hover:bg-card"
                  onClick={() => setAnchorDate(new Date())}
                  data-testid="button-today"
                  aria-label="Go to today"
                >
                  Today
                </button>

                {/* + New appointment */}
                <Popover open={bookPopoverOpen} onOpenChange={setBookPopoverOpen}>
                  <PopoverTrigger asChild>
                    <IconBtn className="!h-9 !w-9" title="New appointment"><Plus className="h-4 w-4" /></IconBtn>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0 overflow-hidden" align="end">
                    <div className="px-3 pt-3 pb-2 border-b border-border/30">
                      <h3 className="text-[13px] font-semibold font-heading">Book a Lead</h3>
                    </div>
                    <div className="p-3 space-y-2.5">
                      {/* Lead search */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search lead by name..."
                          value={bookLeadSearch}
                          onChange={(e) => { setBookLeadSearch(e.target.value); setBookSelectedLead(null); }}
                          className="w-full h-9 px-3 rounded-lg border border-border/55 bg-muted text-[12px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
                        />
                        {bookLeadSearch && !bookSelectedLead && bookFilteredLeads.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border/55 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                            {bookFilteredLeads.map((l: any) => (
                              <button
                                key={l.id || l.Id}
                                className="w-full px-3 py-2 text-left text-[12px] hover:bg-muted flex items-center gap-2"
                                onClick={() => { setBookSelectedLead(l); setBookLeadSearch(l.full_name || `${l.first_name || ""} ${l.last_name || ""}`.trim()); }}
                              >
                                <span className="truncate">{l.full_name || `${l.first_name || ""} ${l.last_name || ""}`.trim() || "Unknown"}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Date */}
                      <div className="flex gap-2">
                        <input type="date" value={bookDate} onChange={(e) => setBookDate(e.target.value)}
                          className="flex-1 h-9 px-2 rounded-lg border border-border/55 bg-muted text-[12px] focus:outline-none focus:ring-2 focus:ring-brand-indigo/30" />
                        <input type="time" value={bookTime} onChange={(e) => setBookTime(e.target.value)}
                          className="w-24 h-9 px-2 rounded-lg border border-border/55 bg-muted text-[12px] focus:outline-none focus:ring-2 focus:ring-brand-indigo/30" />
                      </div>
                      {/* Duration */}
                      <select value={bookDuration} onChange={(e) => setBookDuration(Number(e.target.value))}
                        className="w-full h-9 px-2 rounded-lg border border-border/55 bg-muted text-[12px] focus:outline-none cursor-pointer">
                        {[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                      </select>
                      {/* Submit */}
                      <button
                        onClick={handleBookLead}
                        disabled={!bookSelectedLead || !bookDate || bookSubmitting}
                        className="w-full h-9 rounded-full bg-brand-indigo text-white text-[12px] font-semibold hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        {bookSubmitting ? "Booking..." : "Book Appointment"}
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Search */}
                <IconBtn className="!h-9 !w-9" title="Search appointments" active={searchOpen} onClick={() => { setSearchOpen((p) => !p); if (searchOpen) setSearchQuery(""); }}>
                  <Search className="h-4 w-4" />
                </IconBtn>

                {/* Settings */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <IconBtn className="!h-9 !w-9" active={apptSortBy !== "time" || apptGroupBy !== "date" || apptFilterStatuses.length > 0 || calendarAccountFilter !== "all" || campaignId !== "all"} title="Group, Sort & Filter">
                      <SlidersHorizontal className="h-4 w-4" />
                    </IconBtn>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {/* Account filter — agency only */}
                    {isAgencyUser && (
                      <>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="text-[12px]">
                            <Building2 className="h-3.5 w-3.5 mr-2" />
                            Account
                            {calendarAccountFilter !== "all" && <span className="ml-auto text-[10px] text-brand-indigo font-medium truncate max-w-[72px]">{selectedAccountName}</span>}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-52 max-h-64 overflow-y-auto">
                            <DropdownMenuItem
                              className={cn("flex items-center px-3 py-2 text-[12px] font-medium rounded-lg cursor-pointer", calendarAccountFilter === "all" && "font-bold")}
                              onClick={() => handleAccountFilterChange("all")}
                              data-testid="account-filter-option-all"
                            >
                              All Accounts
                              {calendarAccountFilter === "all" && <Check className="h-3 w-3 ml-auto text-brand-indigo" />}
                            </DropdownMenuItem>
                            {(accounts || []).filter((a: any) => (a.id || a.Id) !== 1).length > 0 && (
                              <DropdownMenuSeparator />
                            )}
                            {(accounts || [])
                              .filter((a: any) => (a.id || a.Id) !== 1)
                              .map((acc: any) => {
                                const accId = acc.id || acc.Id;
                                return (
                                  <DropdownMenuItem
                                    key={accId}
                                    className={cn("flex items-center px-3 py-2 text-[12px] rounded-lg cursor-pointer", calendarAccountFilter === accId && "font-bold text-foreground")}
                                    onClick={() => handleAccountFilterChange(accId)}
                                    data-testid={`account-filter-option-${accId}`}
                                  >
                                    <span className="truncate">{acc.name || acc.Name}</span>
                                    {calendarAccountFilter === accId && <Check className="h-3 w-3 ml-auto text-brand-indigo shrink-0" />}
                                  </DropdownMenuItem>
                                );
                              })
                            }
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                      </>
                    )}

                    {/* Campaign filter */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-[12px]">
                        <Filter className="h-3.5 w-3.5 mr-2" />
                        Campaign
                        {campaignId !== "all" && <span className="ml-auto text-[10px] text-brand-indigo font-medium truncate max-w-[72px]">{selectedCampaignName ?? ""}</span>}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-52 max-h-64 overflow-y-auto">
                        <DropdownMenuItem
                          className={cn("flex items-center px-3 py-2 text-[12px] font-medium rounded-lg cursor-pointer", campaignId === "all" && "font-bold")}
                          onClick={() => setCampaignId("all")}
                          data-testid="campaign-filter-all"
                        >
                          All Campaigns
                          {campaignId === "all" && <Check className="h-3 w-3 ml-auto text-brand-indigo" />}
                        </DropdownMenuItem>
                        {campaignOptions.length > 0 && <DropdownMenuSeparator />}
                        {campaignOptions.map((c: any) => (
                          <DropdownMenuItem
                            key={c.id}
                            className={cn("flex items-center gap-2 px-3 py-2 text-[12px] rounded-lg cursor-pointer", campaignId === c.id && "font-bold text-brand-indigo")}
                            onClick={() => setCampaignId(c.id)}
                            data-testid={`campaign-filter-option-${c.id}`}
                          >
                            <span className="truncate flex-1">{c.name}</span>
                            {c.status && (
                              <span className={cn(
                                "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase shrink-0",
                                c.status === "Active" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                  : c.status === "Finished" ? "bg-muted/40 text-muted-foreground"
                                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              )}>
                                {c.status}
                              </span>
                            )}
                            {campaignId === c.id && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                          </DropdownMenuItem>
                        ))}
                        {campaignOptions.length === 0 && (
                          <div className="px-3 py-2 text-[12px] text-muted-foreground italic">No campaigns</div>
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-[12px]">
                        <Layers className="h-3.5 w-3.5 mr-2" />
                        Group
                        {apptGroupBy !== "date" && <span className="ml-auto text-[10px] text-brand-indigo font-medium">{APPT_GROUP_LABELS[apptGroupBy]}</span>}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-40">
                        {(["date", "campaign", "status", "none"] as ApptGroupBy[]).map((opt) => (
                          <DropdownMenuItem key={opt} onClick={() => setApptGroupBy(opt)} className={cn("text-[12px]", apptGroupBy === opt && "font-semibold text-brand-indigo")}>
                            {APPT_GROUP_LABELS[opt]}
                            {apptGroupBy === opt && <Check className="h-3 w-3 ml-auto" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-[12px]">
                        <ArrowUpDown className="h-3.5 w-3.5 mr-2" />
                        Sort
                        {apptSortBy !== "time" && <span className="ml-auto text-[10px] text-brand-indigo font-medium">{APPT_SORT_LABELS[apptSortBy]}</span>}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-44">
                        {(["time", "name", "campaign", "status"] as ApptSortBy[]).map((opt) => (
                          <DropdownMenuItem key={opt} onClick={() => setApptSortBy(opt)} className={cn("text-[12px]", apptSortBy === opt && "font-semibold text-brand-indigo")}>
                            {APPT_SORT_LABELS[opt]}
                            {apptSortBy === opt && <Check className="h-3 w-3 ml-auto" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-[12px]">
                        <Filter className="h-3.5 w-3.5 mr-2" />
                        Filter
                        {apptFilterStatuses.length > 0 && <span className="ml-auto text-[10px] text-brand-indigo font-medium">{apptFilterStatuses.length}</span>}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-48">
                        {(["no_show", "rescheduled", "confirmed"] as ApptFilterStatus[]).map((opt) => (
                          <DropdownMenuItem
                            key={opt}
                            onClick={(e) => { e.preventDefault(); setApptFilterStatuses((prev) => prev.includes(opt) ? prev.filter((s) => s !== opt) : [...prev, opt]); }}
                            className="flex items-center gap-2 text-[12px]"
                          >
                            <span className="flex-1">{APPT_FILTER_LABELS[opt]}</span>
                            {apptFilterStatuses.includes(opt) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    {(apptSortBy !== "time" || apptGroupBy !== "date" || apptFilterStatuses.length > 0 || calendarAccountFilter !== "all" || campaignId !== "all") && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { setApptSortBy("time"); setApptGroupBy("date"); setApptFilterStatuses([]); handleAccountFilterChange("all"); setCampaignId("all"); }} className="text-[12px] text-destructive">
                          Reset all settings
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Spacer */}
                <div className="flex-1 min-w-0" />

                {/* Inline Booked Calls KPI */}
                <BookedCallsKpi
                  variant="inline"
                  accountId={isAgencyUser ? (effectiveAccountFilter === "all" ? undefined : effectiveAccountFilter) : currentAccountId}
                />
              </div>

              {/* ── Month view ── */}
              {viewMode === "month" && (
                <>
                  <div className="grid grid-cols-7 text-xs text-center font-bold text-muted-foreground bg-muted/30 shrink-0" data-testid="row-dow">
                    {(() => {
                      const todayDow = new Date().getDay(); // 0=Sun
                      return ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d, i) => (
                        <div key={i} className={cn("px-3 py-3", (i === 0 || i === 6) && "bg-muted/10 opacity-70", i === todayDow && "text-brand-indigo")} data-testid={`dow-${i}`}>{d}</div>
                      ));
                    })()}
                  </div>
                  <div className="flex-1 grid grid-cols-7 overflow-y-auto" data-testid="grid-days">
                    {days.map((d, idx) => {
                      const inMonth = d.date.getMonth() === month.getMonth();
                      const isToday = d.date.toLocaleDateString() === todayStr;
                      const isSelected = selectedDate === d.date.toLocaleDateString();
                      const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6;
                      const dateKey = d.date.toLocaleDateString();
                      return (
                        <DroppableDay
                          key={idx}
                          dateKey={dateKey}
                          onClick={() => handleDateClick(dateKey)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDateClick(dateKey); } }}
                          aria-label={`Select ${dateKey}`}
                          className={cn(
                            "min-h-[100px] border-b border-r border-border/30 last:border-r-0 p-2 cursor-pointer hover:bg-muted/30 relative",
                            !inMonth && "bg-muted/5 opacity-40",
                            isWeekend && "bg-stone-200/30",
                            isSelected && "bg-brand-indigo/[0.08] z-10",
                            isToday && !isSelected && "bg-teal-600/5"
                          )}
                          data-testid={`day-${idx}`}
                        >
                          <div className="flex justify-between items-start">
                            <div className={cn(
                              "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
                              isToday ? "text-white bg-teal-600" : inMonth ? "text-foreground" : "text-muted-foreground"
                            )}>
                              {d.date.getDate()}
                            </div>
                          </div>
                          {d.count > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {appts.filter((a) => a.date === dateKey).slice(0, 2).map((a, ai) => {
                                const apptDate = new Date(a.raw_booked_call_date);
                                const todayStart = new Date(); todayStart.setHours(0,0,0,0);
                                const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);
                                const isPast = apptDate < todayStart;
                                const isToday = apptDate >= todayStart && apptDate < todayEnd;
                                const hoverRing = a.no_show ? "hover:ring-red-400" : isPast ? "hover:ring-muted-foreground/40" : isToday ? "hover:ring-teal-400" : "hover:ring-amber-400";
                                const pillColor = isPast
                                  ? "bg-muted/70 text-muted-foreground"
                                  : a.no_show
                                    ? "bg-red-600 text-white"
                                    : isToday
                                      ? "bg-teal-600 text-white"
                                      : "bg-amber-500 text-white";
                                return (
                                <DraggableBookingCard
                                  key={a.id}
                                  appt={a}
                                  onClick={(e) => { e.stopPropagation(); setSelectedBooking(a); }}
                                  className={cn("text-left overflow-hidden hover:ring-1 hover:ring-inset animate-pill-pop", hoverRing)}
                                  style={{ animationDelay: `${ai * 60}ms` }}
                                >
                                  <div className={cn(
                                    "h-9 px-2 rounded-full flex items-center gap-1.5 overflow-hidden",
                                    pillColor
                                  )}>
                                    <span className={cn("text-[9px] font-bold truncate flex-1 leading-none",
                                      isPast ? "text-muted-foreground" : "text-white"
                                    )} data-testid={`booking-lead-name-${a.id}`}>{a.lead_name}</span>
                                    <span className="text-[8px] font-medium shrink-0 tabular-nums leading-none opacity-80" data-testid={`booking-time-${a.id}`}>{a.time}</span>
                                  </div>
                                </DraggableBookingCard>
                                );
                              })}
                              {d.count > 2 && (
                                <div className="text-[8px] font-bold text-muted-foreground text-center">+{d.count - 2} more</div>
                              )}
                            </div>
                          )}
                        </DroppableDay>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── Week / Day time grid ── */}
              {(viewMode === "week" || viewMode === "day") && (() => {
                const gridDays = viewMode === "week" ? weekDays : [anchorDate];
                const totalH = 24 * HOUR_H;
                return (
                  <div ref={timeGridRef} className="flex-1 overflow-y-auto" data-testid="grid-time">

                    {/* Sticky day-header row */}
                    <div
                      className="sticky top-0 z-30 flex shrink-0 bg-muted border-b border-border/30"
                      style={{ height: 56 }}
                    >
                      <div className="shrink-0 border-r border-border/20" style={{ width: LABEL_W }} />
                      {gridDays.map((d, i) => {
                        const isToday = d.toLocaleDateString() === todayStr;
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        return (
                          <div key={i} className={cn(
                            "flex-1 flex flex-col items-center justify-center border-r border-border/20 last:border-r-0 gap-0.5",
                            isToday && "bg-teal-600/5",
                            isWeekend && "bg-muted/50"
                          )}>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                              {["SUN","MON","TUE","WED","THU","FRI","SAT"][d.getDay()]}
                            </span>
                            <span className={cn("text-lg font-black leading-none", isToday ? "text-teal-600" : "text-foreground")}>
                              {d.getDate()}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Time grid coordinate space */}
                    <div className="relative" style={{ height: totalH }}>
                      {/* Time labels */}
                      {hours.map(h => h > 0 ? (
                        <div
                          key={h}
                          className="absolute text-[10px] font-semibold text-muted-foreground leading-none pointer-events-none select-none"
                          style={{
                            top: h * HOUR_H,
                            width: LABEL_W,
                            transform: "translateY(-50%)",
                            textAlign: "right",
                            paddingRight: 8,
                          }}
                        >
                          {h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
                        </div>
                      ) : null)}

                      {/* Vertical separator */}
                      <div
                        className="absolute top-0 bottom-0 border-r border-border/20 pointer-events-none"
                        style={{ left: LABEL_W }}
                      />

                      {/* Day columns */}
                      <div className="absolute top-0 bottom-0 right-0 flex" style={{ left: LABEL_W }}>
                        {gridDays.map((d, i) => {
                          const isToday = d.toLocaleDateString() === todayStr;
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                          const dateKey = d.toLocaleDateString();
                          return (
                            <div key={i} className={cn(
                              "flex-1 relative border-r border-border/20 last:border-r-0",
                              isWeekend && "bg-stone-200/20",
                              isToday && "bg-teal-600/[0.03]"
                            )}>
                              {/* Gridlines */}
                              {hours.map(h => (
                                <div
                                  key={h}
                                  className="absolute left-0 right-0 border-t border-border/20 pointer-events-none"
                                  style={{ top: h * HOUR_H }}
                                />
                              ))}

                              {/* DnD drop zones */}
                              {hours.map(h => (
                                <DroppableTimeSlot key={h} dateKey={dateKey} hour={h} hourHeight={HOUR_H} />
                              ))}

                              {/* Current time line — always visible across all columns */}
                              <div
                                className="absolute left-0 right-0 z-20 pointer-events-none"
                                style={{ top: (currentTime.getHours() * 60 + currentTime.getMinutes()) * (HOUR_H / 60) }}
                              >
                                <div className={cn("absolute inset-x-0", isToday ? "border-t-2 border-teal-500" : "border-t border-teal-400/25")} />
                                {isToday && <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-teal-500" />}
                              </div>

                              {/* Appointment cards */}
                              {appts.filter(a => a.date === dateKey).map((a, ai) => {
                                const endTotalMin = a.hour * 60 + a.minutes + (a.callDurationMinutes || 60);
                                const eH = Math.floor(endTotalMin / 60) % 24;
                                const eM = endTotalMin % 60;
                                const eAmPm = eH >= 12 ? "PM" : "AM";
                                const eH12 = eH % 12 || 12;
                                const endStr = `${eH12}:${String(eM).padStart(2,"0")} ${eAmPm}`;
                                const apptDate = new Date(a.raw_booked_call_date);
                                const dayStart = new Date(); dayStart.setHours(0,0,0,0);
                                const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
                                const isPast = apptDate < dayStart;
                                const isApptToday = apptDate >= dayStart && apptDate < dayEnd;
                                const cardColor = isPast
                                  ? "bg-muted/70 text-muted-foreground hover:ring-muted-foreground/40"
                                  : a.no_show
                                    ? "bg-red-600 text-white hover:ring-red-400"
                                    : isApptToday
                                      ? "bg-teal-600 text-white hover:ring-teal-400"
                                      : "bg-amber-500 text-white hover:ring-amber-400";
                                return (
                                  <DraggableBookingCard
                                    key={a.id}
                                    appt={a}
                                    onClick={(e) => { e.stopPropagation(); setSelectedBooking(a); }}
                                    className={cn(
                                      "absolute left-1 right-1 px-2 py-1.5 rounded-xl shadow-sm z-10 hover:ring-2 overflow-hidden animate-pill-pop",
                                      cardColor
                                    )}
                                    style={{
                                      top: `${(a.hour * 60 + a.minutes) * (HOUR_H / 60)}px`,
                                      height: `${((a.callDurationMinutes || 60) / 60) * HOUR_H - 4}px`,
                                      animationDelay: `${ai * 60}ms`,
                                    }}
                                  >
                                    <div className="flex items-center gap-1 min-w-0">
                                      <div className={cn("text-[10px] font-bold truncate flex-1", isPast ? "text-muted-foreground" : "text-white")} data-testid={`booking-lead-name-${a.id}`}>{a.lead_name}</div>
                                    </div>
                                    <div className={cn("text-[9px] font-medium", isPast ? "text-muted-foreground/70" : "text-white/80")} data-testid={`booking-time-${a.id}`}>
                                      {a.time} — {endStr}
                                    </div>
                                  </DraggableBookingCard>
                                );
                              })}

                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Right detail panel — 3rd column (reuses ContactSidebar from Chats) */}
            {(selectedBooking || selectedLead) && (() => {
              const panelLead = (selectedBooking?.rawLead ?? selectedLead) as ConversationLead;
              const panelLeadId = panelLead?.id ?? panelLead?.Id;
              const fakeThread = panelLead ? {
                lead: panelLead,
                msgs: [] as Interaction[],
                last: undefined as Interaction | undefined,
                unread: false,
                unreadCount: 0,
              } : null;
              return (
                <div className="overflow-hidden flex flex-col lg:order-3 h-full">
                  <ContactSidebar
                    selected={fakeThread}
                    onClose={() => { setSelectedBooking(null); setSelectedLead(null); }}
                    onUpdateLead={handleCalendarUpdateLead}
                    className="flex"
                    recentMessages={recentMessages}
                    recentMessagesLoading={recentMessagesLoading}
                    onViewConversation={() => goTo(`/conversations?leadId=${panelLeadId}`)}
                  />
                </div>
              );
            })()}

            {/* ══════════════════════════════════════════════════════════════════
                LEFT PANEL — My Calendar (appointment list)
               ══════════════════════════════════════════════════════════════════ */}
            <div className={cn(
              "bg-muted flex flex-col overflow-hidden rounded-lg lg:order-1",
              isMobile || isTablet ? "min-h-[200px] max-h-[300px]" : "h-full"
            )} data-testid="calendar-list">

              {/* ── Panel header ── */}
              <div className="pl-[17px] pr-3.5 pt-10 pb-3 shrink-0 flex items-center">
                <div className="flex items-center justify-between w-[309px] shrink-0">
                  <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight" data-testid="text-list-title">
                    My Calendar
                  </h2>
                  <ViewTabBar
                    tabs={CALENDAR_TABS}
                    activeId={viewMode}
                    onTabChange={(id) => setViewMode(id as ViewMode)}
                  />
                </div>
              </div>

              {/* Subtitle */}
              {selectedDate && (
                <div className="px-3.5 pb-1 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                    {selectedDate}
                  </span>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="h-4 w-4 rounded-full hover:bg-card flex items-center justify-center text-muted-foreground"
                    title="Clear date filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}


              {/* ── Search bar (collapsible) ── */}
              {searchOpen && (
                <div className="px-3 pb-2 shrink-0">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search by name or campaign..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border/55 bg-card text-[12px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
                    data-testid="search-appointments-input"
                  />
                </div>
              )}

              {/* ── Appointment list ── */}
              <div className="flex-1 overflow-y-auto p-[3px]">
                {totalApptCount === 0 ? (
                  <div data-testid="empty-appts">
                    <DataEmptyState variant="calendar" compact />
                  </div>
                ) : (
                  <div className="flex flex-col gap-[3px]">
                    {groupedAppts.map((group, gi) => (
                      <div key={gi} className="flex flex-col gap-[3px]">
                        {group.label && (
                          <ApptGroupHeader label={group.label} count={group.items.length} />
                        )}
                        {group.items.map((a, ai) => (
                          <div key={a.id} className="animate-card-enter" style={{ animationDelay: `${Math.min(ai, 15) * 30}ms` }}>
                            <AppointmentCard
                              appt={a}
                              isActive={selectedBooking?.id === a.id}
                              onSelect={() => setSelectedBooking(a)}
                              onSelectLead={handleSelectLead}
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Lead full profile sheet */}
          {fullProfileLead && (
            <LeadDetailPanel
              lead={fullProfileLead}
              open={!!fullProfileLead}
              onClose={() => setFullProfileLead(null)}
            />
          )}

          {/* Drag Overlay */}
          <DragOverlay>
            {activeAppt ? (
              <div
                className={cn(
                  "px-2 py-1.5 rounded-xl shadow-xl opacity-90 min-w-[120px] max-w-[200px]",
                  activeAppt.no_show
                    ? "bg-red-600 text-white"
                    : "bg-[#4F46E5] text-white"
                )}
                data-testid="drag-overlay"
              >
                <div className="text-[10px] font-bold truncate text-white">
                  {activeAppt.lead_name}
                </div>
                <div className="text-[9px] font-medium text-white/80">
                  {activeAppt.time}
                </div>
              </div>
            ) : null}
          </DragOverlay>

          {/* Toast */}
          {dragToast && (
            <div
              className={cn(
                "fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-5 py-3 rounded-full shadow-2xl text-sm font-semibold flex items-center gap-2",
                dragToast.type === "success"
                  ? "bg-emerald-600 text-white"
                  : "bg-red-600 text-white"
              )}
              data-testid="drag-toast"
            >
              {dragToast.type === "success" ? (
                <RefreshCw className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              {dragToast.message}
            </div>
          )}
        </div>
      </DndContext>
    </CrmShell>
  );
}
