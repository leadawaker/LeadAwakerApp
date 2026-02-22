import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLeads, useCampaigns } from "@/hooks/useApiData";
import { FiltersBar } from "@/components/crm/FiltersBar";
import { ChevronLeft, ChevronRight, ChevronDown, AlertCircle, RefreshCw, X, Clock, User, Megaphone, Calendar, ExternalLink, Filter, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { apiFetch } from "@/lib/apiUtils";
import { GitHubCalendar, type ContributionDay } from "@/components/ui/git-hub-calendar";
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatDate(date: Date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} - ${year}`;
}

type ViewMode = "year" | "month" | "week" | "day";

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
      className={cn(className, isOver && "ring-2 ring-inset ring-primary bg-primary/10")}
      data-testid={dataTestId}
    >
      {children}
    </div>
  );
}

// ── Droppable Time Slot — absolutely positioned in the shared coordinate space
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
      className={cn("absolute left-0 right-0", className, isOver && "bg-primary/10")}
      style={{ top: hour * hourHeight, height: hourHeight }}
      data-testid={`timeslot-${dateKey}-${hour}`}
    />
  );
}

export default function CalendarPage() {
  const { currentAccountId, isAgencyUser, accounts } = useWorkspace();
  const { leads, loading: leadsLoading, refresh: refetchLeads } = useLeads();
  const { campaigns } = useCampaigns();
  const [campaignId, setCampaignId] = useState<number | "all">("all");
  // Account filter state — only used for agency/admin users; client users always see their own account
  const [calendarAccountFilter, setCalendarAccountFilter] = useState<number | "all">("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Appointment | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const timeGridRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentTime, setCurrentTime] = useState(new Date());

  // Responsive: track viewport width to adjust layout and default view
  const [viewportWidth, setViewportWidth] = useState(() => typeof window !== "undefined" ? window.innerWidth : 1024);
  const isMobile = viewportWidth < 640;
  const isTablet = viewportWidth >= 640 && viewportWidth < 1024;

  // Auto-switch view mode based on viewport width
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setViewportWidth(w);
      // On mobile, force day view for usability
      if (w < 640) {
        setViewMode("day");
      }
    };
    window.addEventListener("resize", handleResize);
    // Run once on mount
    if (window.innerWidth < 640) {
      setViewMode("day");
    }
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

  // Auto-scroll to current time when entering week/day view
  useEffect(() => {
    if (viewMode === "week" || viewMode === "day") {
      const id = requestAnimationFrame(() => {
        if (timeGridRef.current) {
          const now = new Date();
          const scrollPos = (now.getHours() * 60 + now.getMinutes()) * (80 / 60);
          timeGridRef.current.scrollTop = Math.max(0, scrollPos - 56 - 2 * 80); // account for sticky header + 2 hrs above
        }
      });
      return () => cancelAnimationFrame(id);
    }
  }, [viewMode]);

  const todayStr = new Date().toLocaleDateString();

  // Effective account filter:
  // - Agency users: use calendarAccountFilter ("all" = show all accounts, or specific account id)
  // - Client users: always locked to their own currentAccountId
  const effectiveAccountFilter = isAgencyUser ? calendarAccountFilter : currentAccountId;

  const appts = useMemo((): Appointment[] => {
    if (!leads) return [];
    return leads
      .filter((l: any) => {
        if (!isAgencyUser) {
          // Client users always see only their account
          return (l.account_id || l.accounts_id) === currentAccountId;
        }
        // Agency users: "all" shows all accounts, otherwise filter by selected account
        if (effectiveAccountFilter === "all") return true;
        return (l.account_id || l.accounts_id) === effectiveAccountFilter;
      })
      .filter((l: any) => (campaignId === "all" ? true : (l.campaign_id || l.campaigns_id) === campaignId))
      .filter((l: any) => Boolean(l.booked_call_date))
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
    const startDow = (first.getDay() + 6) % 7;
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
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
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

  const handleDateClick = (dateStr: string) => {
    if (isDragging) return; // don't select while dragging
    setSelectedDate(prev => prev === dateStr ? null : dateStr);
  };

  const handleBookingCardClick = (e: React.MouseEvent, booking: Appointment) => {
    if (isDragging) return;
    e.stopPropagation();
    setSelectedBooking(booking);
    setPopoverOpen(true);
  };

  const handleClosePopover = () => {
    setPopoverOpen(false);
    setSelectedBooking(null);
  };

  const navigate = (direction: number) => {
    const next = new Date(anchorDate);
    if (viewMode === "year") {
      next.setFullYear(anchorDate.getFullYear() + direction);
    } else if (viewMode === "month") {
      next.setMonth(anchorDate.getMonth() + direction);
    } else if (viewMode === "week") {
      next.setDate(anchorDate.getDate() + (direction * 7));
    } else {
      next.setDate(anchorDate.getDate() + direction);
    }
    setAnchorDate(next);
  };

  const viewLabel = useMemo(() => {
    if (viewMode === "year") return String(anchorDate.getFullYear());
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

  // Time grid layout constants — shared by labels, gridlines, appointments, drop zones
  const HOUR_H = 80; // px per hour (all positioned elements use this)
  const LABEL_W = 56; // px for the time gutter on the left

  // ── Yearly view data ────────────────────────────────────────────────────────
  const yearlyData = useMemo((): ContributionDay[] => {
    const targetYear = anchorDate.getFullYear();
    const countMap = new Map<string, number>();
    for (const a of appts) {
      const d = new Date(a.raw_booked_call_date);
      if (d.getFullYear() !== targetYear) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }
    return Array.from(countMap.entries()).map(([date, count]) => ({ date, count }));
  }, [appts, anchorDate]);

  const yearlyStats = useMemo(() => {
    const targetYear = anchorDate.getFullYear();
    const yearAppts = appts.filter(
      (a) => new Date(a.raw_booked_call_date).getFullYear() === targetYear
    );
    const activeDays = yearlyData.filter((d) => d.count > 0).length;
    const monthCounts = Array(12).fill(0) as number[];
    yearAppts.forEach((a) => {
      monthCounts[new Date(a.raw_booked_call_date).getMonth()]++;
    });
    const maxMonthCount = Math.max(0, ...monthCounts);
    const bestMonthIdx = maxMonthCount > 0 ? monthCounts.indexOf(maxMonthCount) : -1;
    return {
      total: yearAppts.length,
      activeDays,
      bestMonth: bestMonthIdx >= 0 ? FULL_MONTHS[bestMonthIdx] : "—",
    };
  }, [appts, anchorDate, yearlyData]);

  // Build campaign options from all leads in scope (account-filtered, not campaign-filtered)
  // so we don't create a circular dependency with the campaignId filter.
  const campaignOptions = useMemo(() => {
    // Collect unique campaign ids+names from account-filtered leads that have bookings
    const fromLeads = new Map<number, string>();
    for (const l of (leads || [])) {
      const lead = l as any;
      const accId = lead.account_id || lead.accounts_id;
      // Filter leads by effective account filter
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

    // Merge with known campaigns from API that belong to this account (or have no account)
    const fromApi = (campaigns || []).filter((c: any) => {
      if (isAgencyUser && effectiveAccountFilter === "all") return true;
      const targetAccountId = isAgencyUser ? effectiveAccountFilter : currentAccountId;
      const accId = c.account_id || c.accounts_id || c.Accounts_id;
      return !accId || accId === targetAccountId;
    });

    // Build unified list: prefer API data (has full info incl. status), supplement with leads data
    const merged = new Map<number, any>();
    for (const c of fromApi) {
      merged.set(c.id, c);
    }
    // Add campaigns found in leads that aren't already in the API list
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

  // Account filter computed display name (for admin toolbar)
  const selectedAccountName = useMemo((): string => {
    if (calendarAccountFilter === "all") return "All Accounts";
    const acc = (accounts || []).find((a: any) => (a.id || a.Id) === calendarAccountFilter);
    return acc ? (String(acc.name || acc.Name || `Account ${calendarAccountFilter}`)) : `Account ${calendarAccountFilter}`;
  }, [calendarAccountFilter, accounts]);

  // When account filter changes, reset campaign filter (campaign may not belong to new account)
  const handleAccountFilterChange = useCallback((accId: number | "all") => {
    setCalendarAccountFilter(accId);
    setCampaignId("all");
    setSelectedDate(null);
  }, []);

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const appt = event.active.data.current?.appt as Appointment | undefined;
    if (appt) {
      setActiveAppt(appt);
      setIsDragging(true);
      // Close any open popover
      setPopoverOpen(false);
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

    // Determine if this is a time-slot drop (has hour) or day drop
    const isTimeSlotDrop = targetHour !== undefined;

    // Parse the original date+time
    const origDate = new Date(appt.raw_booked_call_date);

    // Parse the target date from the locale string key (e.g. "2/25/2026")
    const [monthPart, dayPart, yearPart] = targetDateKey.split("/").map(Number);

    let newDate: Date;
    if (isTimeSlotDrop) {
      // Time slot drop: update both date and hour, keep original minutes/seconds
      newDate = new Date(yearPart, monthPart - 1, dayPart, targetHour, origDate.getMinutes(), origDate.getSeconds());
    } else {
      // Day drop: keep original time (hour/min/sec), change only date
      newDate = new Date(yearPart, monthPart - 1, dayPart, origDate.getHours(), origDate.getMinutes(), origDate.getSeconds());
    }

    if (isNaN(newDate.getTime())) return;

    // Check if anything actually changed
    const sameDate = appt.date === targetDateKey;
    const sameHour = !isTimeSlotDrop || appt.hour === targetHour;
    if (sameDate && sameHour) return; // dropped on same date+time

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

      // Refetch to sync with server
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

  if (leadsLoading) {
    return (
      <CrmShell>
        <div className="space-y-4 py-4" data-testid="page-calendar">
          {/* Calendar header skeleton */}
          <div className="flex items-center justify-between px-2">
            <Skeleton className="h-8 w-40 rounded-lg" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
          {/* Calendar grid skeleton */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-2xl overflow-hidden border border-border">
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
          "flex flex-col px-0 py-0 bg-transparent pb-4",
          isMobile || isTablet ? "h-auto overflow-y-auto" : "h-full overflow-hidden"
        )} data-testid="page-calendar">
          <div className="flex items-center gap-4 mb-6 shrink-0 hidden">
            <h1 className="text-2xl font-extrabold tracking-tight" data-testid="text-title">Calendar</h1>
            <FiltersBar selectedCampaignId={campaignId} setSelectedCampaignId={setCampaignId} />
          </div>

          <div className={cn(
            "flex-1 min-h-0 gap-4",
            isMobile || isTablet
              ? "flex flex-col overflow-y-auto"
              : "grid grid-cols-1 lg:grid-cols-[380px_1fr]"
          )} data-testid="layout-calendar">
            <div className={cn(
              "border border-border bg-card shadow-sm overflow-hidden flex flex-col rounded-2xl lg:order-2",
              isMobile || isTablet ? "min-h-[420px]" : "h-full"
            )} data-testid="calendar-main">
              <div className="p-3 md:p-4 border-b border-border flex flex-wrap items-center justify-between gap-2 shrink-0">
                {/* LEFT: view mode + date navigation */}
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  <div
                    className="flex rounded-xl border border-border overflow-hidden"
                    data-testid="view-tab-strip"
                  >
                    {(["year", "month", "week", "day"] as ViewMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={cn(
                          "px-3 py-1.5 text-sm font-semibold transition-colors border-r border-border last:border-r-0",
                          viewMode === mode
                            ? "bg-brand-blue text-white"
                            : "bg-muted/10 hover:bg-muted/30 text-foreground"
                        )}
                        data-testid={`button-view-${mode}`}
                      >
                        {mode === "year"
                          ? "Yearly"
                          : mode === "month"
                          ? "Monthly"
                          : mode === "week"
                          ? "Weekly"
                          : "Daily"}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-muted/20">
                    <button
                      className="h-6 w-6 rounded-lg hover:bg-muted/30 flex items-center justify-center transition-colors"
                      onClick={() => navigate(-1)}
                      data-testid="button-prev"
                      aria-label="Previous"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className={cn("font-bold text-sm text-center", isMobile ? "min-w-[100px]" : "min-w-[140px]")} data-testid="text-view-label">
                      {viewLabel}
                    </div>
                    <button
                      className="h-6 w-6 rounded-lg hover:bg-muted/30 flex items-center justify-center transition-colors"
                      onClick={() => navigate(1)}
                      data-testid="button-next"
                      aria-label="Next"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    className="px-3 py-1.5 rounded-xl border border-border bg-muted/20 text-sm font-medium hover:bg-muted/40 transition-colors"
                    onClick={() => setAnchorDate(new Date())}
                    data-testid="button-today"
                    aria-label="Go to today"
                  >
                    Today
                  </button>
                </div>

                {/* RIGHT: account + campaign filters */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Account filter dropdown — agency/admin users only */}
                  {isAgencyUser && (
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-semibold transition-colors",
                            calendarAccountFilter !== "all"
                              ? "border-brand-yellow/50 bg-brand-yellow/10 text-foreground hover:bg-brand-yellow/20"
                              : "border-border bg-muted/20 hover:bg-muted/30"
                          )}
                          data-testid="button-account-filter"
                        >
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {!isMobile && <span className="max-w-[120px] truncate">{selectedAccountName}</span>}
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="z-[100] min-w-[200px] bg-background border border-border rounded-xl shadow-xl p-1 max-h-64 overflow-y-auto"
                          sideOffset={5}
                          align="end"
                          data-testid="account-filter-dropdown"
                        >
                          <DropdownMenu.Item
                            className={cn(
                              "flex items-center px-3 py-2 text-sm font-medium rounded-lg cursor-pointer hover:bg-muted/50 outline-none",
                              calendarAccountFilter === "all" && "bg-muted/30 font-bold"
                            )}
                            onClick={() => handleAccountFilterChange("all")}
                            data-testid="account-filter-option-all"
                          >
                            All Accounts
                          </DropdownMenu.Item>
                          {(accounts || []).filter((a: any) => (a.id || a.Id) !== 1).length > 0 && (
                            <DropdownMenu.Separator className="h-px bg-border my-1" />
                          )}
                          {(accounts || [])
                            .filter((a: any) => (a.id || a.Id) !== 1)
                            .map((acc: any) => {
                              const accId = acc.id || acc.Id;
                              return (
                                <DropdownMenu.Item
                                  key={accId}
                                  className={cn(
                                    "flex items-center px-3 py-2 text-sm font-medium rounded-lg cursor-pointer hover:bg-muted/50 outline-none",
                                    calendarAccountFilter === accId && "bg-brand-yellow/10 font-bold text-foreground"
                                  )}
                                  onClick={() => handleAccountFilterChange(accId)}
                                  data-testid={`account-filter-option-${accId}`}
                                >
                                  <span className="truncate">{acc.name || acc.Name}</span>
                                </DropdownMenu.Item>
                              );
                            })
                          }
                          {(accounts || []).filter((a: any) => (a.id || a.Id) !== 1).length === 0 && (
                            <div className="px-3 py-2 text-sm text-muted-foreground italic">No accounts</div>
                          )}
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  )}

                  {/* Campaign filter dropdown */}
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-semibold transition-colors",
                          campaignId !== "all"
                            ? "border-brand-blue bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20"
                            : "border-border bg-muted/20 hover:bg-muted/30"
                        )}
                        data-testid="button-campaign-filter"
                      >
                        <Filter className="h-3.5 w-3.5" />
                        {!isMobile && (
                          <span className="max-w-[120px] truncate">
                            {selectedCampaignName ?? "All Campaigns"}
                          </span>
                        )}
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="z-[100] min-w-[200px] bg-background border border-border rounded-xl shadow-xl p-1"
                        sideOffset={5}
                        align="end"
                        data-testid="campaign-filter-dropdown"
                      >
                        <DropdownMenu.Item
                          className={cn(
                            "flex items-center px-3 py-2 text-sm font-medium rounded-lg cursor-pointer hover:bg-muted/50 outline-none",
                            campaignId === "all" && "bg-muted/30 font-bold"
                          )}
                          onClick={() => setCampaignId("all")}
                          data-testid="campaign-filter-all"
                        >
                          All Campaigns
                        </DropdownMenu.Item>
                        {campaignOptions.length > 0 && (
                          <DropdownMenu.Separator className="h-px bg-border my-1" />
                        )}
                        {campaignOptions.map((c: any) => (
                          <DropdownMenu.Item
                            key={c.id}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer hover:bg-muted/50 outline-none",
                              campaignId === c.id && "bg-brand-blue/10 font-bold text-brand-blue"
                            )}
                            onClick={() => setCampaignId(c.id)}
                            data-testid={`campaign-filter-option-${c.id}`}
                          >
                            <span className="truncate">{c.name}</span>
                            {c.status && (
                              <span className={cn(
                                "ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase shrink-0",
                                c.status === "Active" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                  : c.status === "Finished" ? "bg-muted/40 text-muted-foreground"
                                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              )}>
                                {c.status}
                              </span>
                            )}
                          </DropdownMenu.Item>
                        ))}
                        {campaignOptions.length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground italic">No campaigns</div>
                        )}
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
              </div>

              {viewMode === "year" && (
                <div
                  className="flex-1 overflow-y-auto p-4 md:p-6"
                  data-testid="view-year"
                >
                  {/* Summary stats */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-muted/10 rounded-xl p-4 text-center border border-border/30">
                      <div
                        className="text-3xl font-black text-brand-blue"
                        data-testid="stat-total-bookings"
                      >
                        {yearlyStats.total}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 font-medium uppercase tracking-wider">
                        Total Bookings
                      </div>
                    </div>
                    <div className="bg-muted/10 rounded-xl p-4 text-center border border-border/30">
                      <div
                        className="text-3xl font-black text-foreground"
                        data-testid="stat-active-days"
                      >
                        {yearlyStats.activeDays}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 font-medium uppercase tracking-wider">
                        Active Days
                      </div>
                    </div>
                    <div className="bg-muted/10 rounded-xl p-4 text-center border border-border/30">
                      <div
                        className="text-xl font-black text-foreground truncate"
                        data-testid="stat-best-month"
                      >
                        {yearlyStats.bestMonth}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 font-medium uppercase tracking-wider">
                        Busiest Month
                      </div>
                    </div>
                  </div>

                  {/* Booking activity heatmap */}
                  <div className="bg-muted/5 rounded-xl p-4 border border-border/40">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                      {anchorDate.getFullYear()} Booking Activity
                    </div>
                    <GitHubCalendar
                      data={yearlyData}
                      year={anchorDate.getFullYear()}
                    />
                  </div>
                </div>
              )}

              {viewMode === "month" && (
                <>
                  <div className="grid grid-cols-7 text-xs text-center font-bold text-muted-foreground border-b border-border bg-muted/5 shrink-0" data-testid="row-dow">
                    {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d, i) => (
                      <div key={i} className={cn("px-3 py-3", (i >= 5) && "bg-muted/10 opacity-70")} data-testid={`dow-${i}`}>{d}</div>
                    ))}
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
                            "min-h-[100px] border-b border-r border-border/60 last:border-r-0 p-2 cursor-pointer transition-colors hover:bg-muted/30 relative",
                            !inMonth && "bg-muted/5 opacity-40",
                            isWeekend && inMonth && "bg-muted/10 opacity-80",
                            isSelected && "bg-primary/5 ring-2 ring-inset ring-primary z-10",
                            isToday && !isSelected && "bg-primary/5"
                          )}
                          data-testid={`day-${idx}`}
                        >
                          <div className="flex justify-between items-start">
                            <div className={cn(
                              "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
                              isToday ? "text-primary bg-primary/10" : inMonth ? "text-foreground" : "text-muted-foreground"
                            )}>
                              {d.date.getDate()}
                            </div>
                          </div>
                          {d.count > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {appts.filter((a) => a.date === dateKey).slice(0, 2).map((a) => (
                                <DraggableBookingCard
                                  key={a.id}
                                  appt={a}
                                  onClick={(e) => handleBookingCardClick(e, a)}
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-left overflow-hidden relative hover:ring-1 hover:ring-inset transition-all",
                                    a.no_show
                                      ? "bg-red-500/15 border-l-2 border-red-500 hover:ring-red-400"
                                      : "bg-brand-blue/15 border-l-2 border-brand-blue hover:ring-brand-blue"
                                  )}
                                >
                                  <div className="flex items-center gap-0.5">
                                    <div className={cn("text-[9px] font-bold truncate leading-tight flex-1", a.no_show ? "text-red-600 dark:text-red-400" : "text-brand-deep-blue dark:text-brand-blue")} data-testid={`booking-lead-name-${a.id}`}>{a.lead_name}</div>
                                    {a.no_show && (
                                      <span className="inline-flex items-center justify-center shrink-0 w-3 h-3 rounded-full bg-red-500 text-white text-[6px] font-black leading-none" data-testid={`no-show-badge-${a.id}`} title="No Show">!</span>
                                    )}
                                    {a.re_scheduled_count > 0 && (
                                      <span className="inline-flex items-center justify-center shrink-0 min-w-[12px] h-3 px-0.5 rounded-full bg-amber-500 text-white text-[6px] font-black leading-none" data-testid={`rescheduled-badge-${a.id}`} title={`Rescheduled ${a.re_scheduled_count}x`}>{a.re_scheduled_count}</span>
                                    )}
                                  </div>
                                  {a.campaign_name && (
                                    <div className="text-[8px] text-muted-foreground truncate leading-tight" data-testid={`booking-campaign-${a.id}`}>{a.campaign_name}</div>
                                  )}
                                  <div className={cn("text-[8px] font-medium leading-tight", a.no_show ? "text-red-500" : "text-brand-blue")} data-testid={`booking-time-${a.id}`}>{a.time}</div>
                                </DraggableBookingCard>
                              ))}
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

              {(viewMode === "week" || viewMode === "day") && (() => {
                const days = viewMode === "week" ? weekDays : [anchorDate];
                const totalH = 24 * HOUR_H;
                return (
                  <div ref={timeGridRef} className="flex-1 overflow-y-auto" data-testid="grid-time">

                    {/* ── Sticky day-header row ──────────────────────────────── */}
                    <div
                      className="sticky top-0 z-30 flex shrink-0 bg-background/95 backdrop-blur-sm border-b border-border/50"
                      style={{ height: 56 }}
                    >
                      {/* Corner gutter (aligns with time label column below) */}
                      <div className="shrink-0 border-r border-border/30" style={{ width: LABEL_W }} />
                      {/* Day name + number headers */}
                      {days.map((d, i) => {
                        const isToday = d.toLocaleDateString() === todayStr;
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        return (
                          <div key={i} className={cn(
                            "flex-1 flex flex-col items-center justify-center border-r border-border/30 last:border-r-0 gap-0.5",
                            isToday && "bg-primary/5",
                            isWeekend && "bg-muted/5"
                          )}>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                              {["SUN","MON","TUE","WED","THU","FRI","SAT"][d.getDay()]}
                            </span>
                            <span className={cn("text-xl font-black leading-none", isToday ? "text-primary" : "text-foreground")}>
                              {d.getDate()}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* ── Single shared coordinate space ─────────────────────── */}
                    {/* Every element uses: top = h * HOUR_H (or proportional) */}
                    <div className="relative" style={{ height: totalH }}>

                      {/* Time labels — at EXACTLY h * HOUR_H, centered on the gridline */}
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

                      {/* Vertical separator between gutter and day columns */}
                      <div
                        className="absolute top-0 bottom-0 border-r border-border/30 pointer-events-none"
                        style={{ left: LABEL_W }}
                      />

                      {/* Day columns — same coordinate space, offset by LABEL_W */}
                      <div className="absolute top-0 bottom-0 right-0 flex" style={{ left: LABEL_W }}>
                        {days.map((d, i) => {
                          const isToday = d.toLocaleDateString() === todayStr;
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                          const dateKey = d.toLocaleDateString();
                          return (
                            <div key={i} className={cn(
                              "flex-1 relative border-r border-border/30 last:border-r-0",
                              isWeekend && "bg-muted/[0.03]"
                            )}>

                              {/* Horizontal gridlines — top = h * HOUR_H (same formula as labels) */}
                              {hours.map(h => (
                                <div
                                  key={h}
                                  className="absolute left-0 right-0 border-t border-border/25 pointer-events-none"
                                  style={{ top: h * HOUR_H }}
                                />
                              ))}

                              {/* DnD drop zones — absolute, top = h * HOUR_H, height = HOUR_H */}
                              {hours.map(h => (
                                <DroppableTimeSlot key={h} dateKey={dateKey} hour={h} hourHeight={HOUR_H} />
                              ))}

                              {/* Current-time indicator — top = minutes_elapsed * (HOUR_H/60) */}
                              {isToday && (
                                <div
                                  className="absolute left-0 right-0 z-30 pointer-events-none"
                                  style={{ top: (currentTime.getHours() * 60 + currentTime.getMinutes()) * (HOUR_H / 60) }}
                                >
                                  <div className="absolute inset-x-0 border-t-2 border-red-500" />
                                  <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-red-500" />
                                </div>
                              )}

                              {/* Appointment cards — same position formula as indicator */}
                              {appts.filter(a => a.date === dateKey).map(a => (
                                <DraggableBookingCard
                                  key={a.id}
                                  appt={a}
                                  onClick={(e) => handleBookingCardClick(e, a)}
                                  className={cn(
                                    "absolute left-1 right-1 px-2 py-1.5 rounded-lg shadow-sm z-10 hover:ring-2 transition-all overflow-hidden",
                                    a.no_show
                                      ? "bg-red-500/10 border-l-4 border-red-500 hover:ring-red-400"
                                      : "bg-brand-blue/10 border-l-4 border-brand-blue hover:ring-brand-blue"
                                  )}
                                  style={{
                                    top: `${(a.hour * 60 + a.minutes) * (HOUR_H / 60)}px`,
                                    height: `${HOUR_H - 4}px`,
                                  }}
                                >
                                  <div className="flex items-center gap-1 min-w-0">
                                    <div className={cn("text-[10px] font-bold truncate flex-1", a.no_show ? "text-red-600 dark:text-red-400" : "text-brand-deep-blue dark:text-brand-blue")} data-testid={`booking-lead-name-${a.id}`}>{a.lead_name}</div>
                                    {a.no_show && (
                                      <span className="shrink-0 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center" data-testid={`no-show-badge-${a.id}`} title="No Show">!</span>
                                    )}
                                    {a.re_scheduled_count > 0 && (
                                      <span className="shrink-0 min-w-[16px] h-4 px-0.5 rounded-full bg-amber-500 text-white text-[8px] font-black flex items-center justify-center" data-testid={`rescheduled-badge-${a.id}`} title={`Rescheduled ${a.re_scheduled_count}x`}>{a.re_scheduled_count}</span>
                                    )}
                                  </div>
                                  {a.campaign_name && (
                                    <div className="text-[8px] text-muted-foreground truncate" data-testid={`booking-campaign-${a.id}`}>{a.campaign_name}</div>
                                  )}
                                  <div className={cn("text-[9px] font-medium", a.no_show ? "text-red-500" : "text-brand-blue")} data-testid={`booking-time-${a.id}`}>{a.time}</div>
                                </DraggableBookingCard>
                              ))}

                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className={cn(
              "bg-card flex flex-col overflow-hidden rounded-2xl border border-border shadow-sm lg:order-1",
              isMobile || isTablet ? "min-h-[200px] max-h-[300px]" : "h-full"
            )} data-testid="calendar-list">
              <div className="p-4 border-b border-border bg-muted/5 shrink-0">
                <div className="font-semibold text-sm" data-testid="text-list-title">
                  {selectedDate ? `Appointments for ${selectedDate}` : "Upcoming Appointments"}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1" data-testid="text-list-sub">
                  Timeline overview
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-border">
                {(selectedDate ? appointmentsForSelectedDate : appts).length === 0 ? (
                  <div data-testid="empty-appts">
                    <DataEmptyState variant="calendar" compact />
                  </div>
                ) : (
                  (selectedDate ? appointmentsForSelectedDate : appts).map((a) => (
                    <div key={a.id} className={cn("p-4 hover:bg-muted/20 transition-colors", a.no_show && "bg-red-500/5")} data-testid={`row-appt-${a.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <div className={cn("font-bold text-sm truncate", a.no_show && "text-red-600 dark:text-red-400")} data-testid={`text-appt-name-${a.id}`}>{a.lead_name}</div>
                            {a.no_show && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-black leading-none shrink-0" data-testid={`no-show-badge-${a.id}`}>
                                <AlertCircle className="w-2.5 h-2.5" />
                                NO-SHOW
                              </span>
                            )}
                            {a.re_scheduled_count > 0 && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black leading-none shrink-0" data-testid={`rescheduled-badge-${a.id}`}>
                                <RefreshCw className="w-2.5 h-2.5" />
                                {a.re_scheduled_count}x
                              </span>
                            )}
                          </div>
                          {a.campaign_name && (
                            <div className="text-[10px] text-muted-foreground truncate mt-0.5" data-testid={`text-appt-campaign-${a.id}`}>{a.campaign_name}</div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded uppercase", a.no_show ? "bg-red-500/10 text-red-500" : "bg-brand-blue/10 text-brand-blue")}>{a.time}</span>
                            <span className="text-[10px] text-muted-foreground font-medium">{a.formattedDate}</span>
                          </div>
                        </div>
                        <a
                          href={a.calendar_link}
                          className="h-7 px-3 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-bold flex items-center transition-colors"
                          target="_blank"
                          rel="noreferrer"
                          data-testid={`link-appt-${a.id}`}
                        >
                          VIEW CAL
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Booking Detail Popover */}
          {popoverOpen && selectedBooking && (
            <>
              {/* Backdrop to close on outside click */}
              <div
                className="fixed inset-0 z-[200]"
                onClick={handleClosePopover}
                aria-hidden="true"
              />
              {/* Popover Panel */}
              <div
                ref={popoverRef}
                className="fixed z-[201] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] bg-popover border border-border rounded-2xl shadow-2xl p-0 overflow-hidden"
                data-testid="booking-detail-popover"
                role="dialog"
                aria-label="Booking details"
              >
                {/* Header */}
                <div className={cn(
                  "p-4 pb-3 flex items-start justify-between gap-3",
                  selectedBooking.no_show ? "bg-red-500/10 border-b border-red-500/20" : "bg-brand-blue/10 border-b border-brand-blue/20"
                )}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={cn("font-bold text-base truncate", selectedBooking.no_show ? "text-red-600 dark:text-red-400" : "text-foreground")} data-testid="popover-lead-name">
                        {selectedBooking.lead_name}
                      </div>
                      {selectedBooking.no_show && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-black shrink-0" data-testid="popover-no-show-badge">
                          <AlertCircle className="w-2.5 h-2.5" />
                          NO-SHOW
                        </span>
                      )}
                      {selectedBooking.re_scheduled_count > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black shrink-0" data-testid="popover-rescheduled-badge">
                          <RefreshCw className="w-2.5 h-2.5" />
                          {selectedBooking.re_scheduled_count}x
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-semibold">Booking Details</div>
                  </div>
                  <button
                    onClick={handleClosePopover}
                    className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted/40 text-muted-foreground transition-colors shrink-0 -mt-0.5 -mr-0.5"
                    aria-label="Close popover"
                    data-testid="popover-close-button"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                  {/* Campaign */}
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                      <Megaphone className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Campaign</div>
                      <div className="text-sm font-medium text-foreground" data-testid="popover-campaign">
                        {selectedBooking.campaign_name || <span className="text-muted-foreground italic">Unknown campaign</span>}
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Status</div>
                      <div className="text-sm font-medium" data-testid="popover-status">
                        {selectedBooking.no_show ? (
                          <span className="text-red-600 dark:text-red-400 font-bold">No Show</span>
                        ) : selectedBooking.status ? (
                          <span className="capitalize">{String(selectedBooking.status).replace(/_/g, ' ')}</span>
                        ) : (
                          <span className="text-muted-foreground italic">Not set</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Time */}
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Time</div>
                      <div className="text-sm font-bold text-brand-blue" data-testid="popover-time">{selectedBooking.time}</div>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Date</div>
                      <div className="text-sm font-medium text-foreground" data-testid="popover-date">{selectedBooking.formattedDate}</div>
                    </div>
                  </div>

                  {/* Reschedule count (if applicable) */}
                  {selectedBooking.re_scheduled_count > 0 && (
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                        <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Rescheduled</div>
                        <div className="text-sm font-medium text-amber-600 dark:text-amber-400" data-testid="popover-rescheduled-count">
                          {selectedBooking.re_scheduled_count}x
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer actions */}
                <div className="px-4 pb-4">
                  <a
                    href={selectedBooking.calendar_link}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-bold transition-colors"
                    data-testid="popover-calendar-link"
                    onClick={handleClosePopover}
                  >
                    <ExternalLink className="w-4 h-4" />
                    View in Calendar
                  </a>
                </div>
              </div>
            </>
          )}

          {/* Drag Overlay - ghost card shown while dragging */}
          <DragOverlay>
            {activeAppt ? (
              <div
                className={cn(
                  "px-2 py-1.5 rounded-lg shadow-xl border-l-4 opacity-90 min-w-[120px] max-w-[200px]",
                  activeAppt.no_show
                    ? "bg-red-500/30 border-red-500"
                    : "bg-brand-blue/30 border-brand-blue"
                )}
                data-testid="drag-overlay"
              >
                <div className={cn("text-[10px] font-bold truncate", activeAppt.no_show ? "text-red-700 dark:text-red-300" : "text-brand-deep-blue dark:text-brand-blue")}>
                  {activeAppt.lead_name}
                </div>
                <div className={cn("text-[9px] font-medium", activeAppt.no_show ? "text-red-500" : "text-brand-blue")}>
                  {activeAppt.time}
                </div>
              </div>
            ) : null}
          </DragOverlay>

          {/* Toast notification for drag-and-drop result */}
          {dragToast && (
            <div
              className={cn(
                "fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold flex items-center gap-2 transition-all",
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
