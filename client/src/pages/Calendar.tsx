import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useTranslation } from "react-i18next";
import { CrmShell } from "@/components/crm/CrmShell";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLeads } from "@/hooks/useApiData";
import { AlertCircle, RefreshCw } from "lucide-react";
import type { Interaction } from "@/features/conversations/hooks/useConversationsData";
import { useLocation } from "wouter";
import { DesktopCalendar } from "@/features/calendar/components/DesktopCalendar";
import { apiFetch } from "@/lib/apiUtils";
import { useFKeyScrollToSelected } from "@/hooks/useFKeyScrollToSelected";
import { useListPanelState } from "@/hooks/useListPanelState";
import { dateKeyOf, type Appointment } from "@/features/calendar/lib/calendarDesign";
import { useCalendarFreeBusy } from "@/features/calendar/hooks/useCalendarFreeBusy";
import { useCalendarWorkingHours } from "@/features/calendar/hooks/useCalendarWorkingHours";
import { useCalendarBlocks } from "@/features/calendar/hooks/useCalendarBlocks";
import { useCalendarAppointments } from "@/features/calendar/hooks/useCalendarAppointments";
import { CalendarLoadingSkeleton } from "@/features/calendar/components/CalendarLoadingSkeleton";
import {
  MONTH_KEYS,
  FULL_MONTH_KEYS,
  type ViewMode,
  type ApptSortBy,
  type ApptGroupBy,
  type ApptFilterStatus,
} from "@/features/calendar/calendarPageUtils";

export default function CalendarPage() {
  const { t } = useTranslation("calendar");

  const { currentAccountId, isAgencyUser, accounts, isAdmin, isOwner } = useWorkspace();
  const canSeeConversation = isAdmin || isOwner;

  const { leads, loading: leadsLoading, error: leadsError, refresh: refetchLeads } = useLeads(currentAccountId > 0 ? currentAccountId : undefined);
  const { state: leftPanelState } = useListPanelState();
  const [campaignId] = useState<number | "all">("all");
  const [calendarAccountFilter, setCalendarAccountFilter] = useState<number | "all">(
    isAgencyUser && currentAccountId > 0 ? currentAccountId : "all"
  );
  const [selectedBooking, setSelectedBooking] = useState<Appointment | null>(null);
  const apptListRef = useRef<HTMLDivElement>(null);

  // Scroll to selected appointment card
  useEffect(() => {
    if (!selectedBooking || !apptListRef.current) return;
    const container = apptListRef.current;
    const run = () => {
      const el = container.querySelector(`[data-appt-id="${selectedBooking.id}"]`) as HTMLElement | null;
      if (!el) return;
      const groupWrapper = el.closest("[data-group-wrapper]");
      const header = groupWrapper?.querySelector("[data-group-header]") as HTMLElement | null;
      const headerHeight = header ? header.offsetHeight : 0;
      const cardTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      container.scrollTo({ top: cardTop - headerHeight - 3, behavior: "smooth" });
    };
    const raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [selectedBooking]);

  useFKeyScrollToSelected({
    containerRef: apptListRef,
    selectedId: selectedBooking?.id ?? null,
    getSelector: (id) => `[data-appt-id="${id}"]`,
  });

  const [viewMode, setViewMode] = usePersistedState<ViewMode>(
    "calendar-view-mode",
    "week",
    (v) => ["month", "week"].includes(v as string),
  );
  const [currentTime, setCurrentTime] = useState(new Date());
  const [apptSortBy, setApptSortBy] = useState<ApptSortBy>("time_desc");
  const [apptGroupBy, setApptGroupBy] = useState<ApptGroupBy>("date");
  const [apptGroupDirection, setApptGroupDirection] = useState<"asc" | "desc">("asc");
  const [apptFilterStatuses, setApptFilterStatuses] = useState<ApptFilterStatus[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hideWeekends, setHideWeekends] = usePersistedState<boolean>("calendar-hide-weekends", false);
  // Availability overlay (free/busy from connected calendars) — default on.
  const [showAvailability, setShowAvailability] = usePersistedState<boolean>("calendar-show-availability", true);

  const [recentMessages, setRecentMessages] = useState<Interaction[]>([]);
  const [recentMessagesLoading, setRecentMessagesLoading] = useState(false);
  const [, goTo] = useLocation();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = new Intl.DateTimeFormat("en-CA").format(new Date());

  // Sync account filter when agency switcher changes
  useEffect(() => {
    if (isAgencyUser) setCalendarAccountFilter(currentAccountId > 0 ? currentAccountId : "all");
  }, [currentAccountId, isAgencyUser]);

  const effectiveAccountFilter = isAgencyUser ? calendarAccountFilter : currentAccountId;

  const { appts, apptsByDate, groupedAppts } = useCalendarAppointments({
    leads,
    isAgencyUser,
    currentAccountId,
    effectiveAccountFilter,
    campaignId,
    accounts,
    t,
    searchQuery,
    apptFilterStatuses,
    apptSortBy,
    apptGroupBy,
    apptGroupDirection,
  });

  const [anchorDate, setAnchorDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });

  const month = useMemo(() => new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1), [anchorDate]);

  const days = useMemo(() => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(year, m, 1);
    const startDow = (first.getDay() + 6) % 7; // Monday-first grid
    const gridStart = new Date(year, m, 1 - startDow);
    const out: { date: Date; count: number }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const key = dateKeyOf(d);
      const count = apptsByDate.get(key)?.length ?? 0;
      out.push({ date: d, count });
    }
    return out;
  }, [month, apptsByDate]);

  const weekDays = useMemo(() => {
    const startOfWeek = new Date(anchorDate);
    const day = startOfWeek.getDay();
    const diff = (day + 6) % 7; // Monday-first week
    startOfWeek.setDate(startOfWeek.getDate() - diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });
  }, [anchorDate]);

  // Free/busy from connected calendars for the visible week (per-account).
  const freeBusyAccountId = typeof effectiveAccountFilter === "number" && effectiveAccountFilter > 0
    ? effectiveAccountFilter : undefined;
  const fbWindow = useMemo(() => {
    const min = new Date(weekDays[0]); min.setHours(0, 0, 0, 0);
    const max = new Date(weekDays[6]); max.setHours(23, 59, 59, 999);
    return { min: min.toISOString(), max: max.toISOString() };
  }, [weekDays]);
  const { busy: rawBusySlots, refresh: refreshFreeBusy } = useCalendarFreeBusy(freeBusyAccountId, fbWindow.min, fbWindow.max);
  const workingHours = useCalendarWorkingHours(freeBusyAccountId);
  const { blocks, createBlock, updateBlock, deleteBlock } = useCalendarBlocks(freeBusyAccountId, fbWindow.min, fbWindow.max);

  // Strip busy slots that are already represented by a LeadAwaker appointment card.
  // Pushed events (Google/Outlook) would otherwise appear as both a card and a grey block.
  const busySlots = useMemo(() => {
    if (!rawBusySlots.length || !appts.length) return rawBusySlots;
    return rawBusySlots.filter((slot) => {
      const s = new Date(slot.start).getTime();
      const e = new Date(slot.end).getTime();
      return !appts.some((a) => {
        const as = new Date(a.raw_booked_call_date).getTime();
        const ae = as + a.callDurationMinutes * 60_000;
        return s < ae && e > as;
      });
    });
  }, [rawBusySlots, appts]);

  // Breadcrumb
  const { setCrumb } = useBreadcrumb();
  useEffect(() => {
    setCrumb(selectedBooking?.lead_name ?? null);
    return () => setCrumb(null);
  }, [selectedBooking, setCrumb]);

  // Fetch full interaction thread when a booking is selected
  const activePanelLeadId = selectedBooking?.rawLead?.id ?? selectedBooking?.rawLead?.Id ?? null;
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
        if (!cancelled) setRecentMessages(sorted);
      } catch {
        if (!cancelled) setRecentMessages([]);
      } finally {
        if (!cancelled) setRecentMessagesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activePanelLeadId]);

  const handleOpenInLead = useCallback(() => {
    const lead = selectedBooking?.rawLead;
    const leadId = lead?.id ?? lead?.Id;
    if (leadId == null) return;
    try {
      localStorage.setItem("selected-lead-id", String(leadId));
      localStorage.setItem("leadawaker-returnto", "/platform/calendar");
    } catch {}
    goTo("/platform/contacts");
  }, [selectedBooking, goTo]);

  const navigate = (direction: number) => {
    const next = new Date(anchorDate);
    if (viewMode === "month") next.setMonth(anchorDate.getMonth() + direction);
    else next.setDate(anchorDate.getDate() + direction * 7);
    setAnchorDate(next);
  };

  const viewLabel = useMemo(() => {
    if (viewMode === "month") return `${t(`months.full.${FULL_MONTH_KEYS[anchorDate.getMonth()]}`)} ${anchorDate.getFullYear()}`;
    const start = weekDays[0], end = weekDays[6];
    const sameMonth = start.getMonth() === end.getMonth();
    return sameMonth
      ? `${t(`months.short.${MONTH_KEYS[start.getMonth()]}`)} ${start.getDate()} - ${end.getDate()}, ${end.getFullYear()}`
      : `${t(`months.short.${MONTH_KEYS[start.getMonth()]}`)} ${start.getDate()} - ${t(`months.short.${MONTH_KEYS[end.getMonth()]}`)} ${end.getDate()}, ${end.getFullYear()}`;
  }, [viewMode, anchorDate, weekDays, t]);

  // Week label + week-only nav + absolute month selector (used by the ultra-wide split)
  const weekLabel = useMemo(() => {
    const start = weekDays[0], end = weekDays[6];
    const sameMonth = start.getMonth() === end.getMonth();
    return sameMonth
      ? `${t(`months.short.${MONTH_KEYS[start.getMonth()]}`)} ${start.getDate()} - ${end.getDate()}, ${end.getFullYear()}`
      : `${t(`months.short.${MONTH_KEYS[start.getMonth()]}`)} ${start.getDate()} - ${t(`months.short.${MONTH_KEYS[end.getMonth()]}`)} ${end.getDate()}, ${end.getFullYear()}`;
  }, [weekDays, t]);

  const navigateWeek = (direction: number) => {
    const next = new Date(anchorDate);
    next.setDate(anchorDate.getDate() + direction * 7);
    setAnchorDate(next);
  };

  const selectMonth = (monthIndex: number) => {
    setAnchorDate(new Date(anchorDate.getFullYear(), monthIndex, 1));
  };

  // Reschedule a booking (PATCH booked_call_date + re_scheduled_count)
  const handleReschedule = useCallback(async (apptId: number, newDate: Date) => {
    const appt = appts.find(a => a.id === apptId);
    if (!appt) return;
    await apiFetch(`/api/leads/${apptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        previous_booked_call_date: appt.raw_booked_call_date,
        booked_call_date: newDate.toISOString(),
        re_scheduled_count: appt.re_scheduled_count + 1,
      }),
    });
    refetchLeads();
  }, [appts, refetchLeads]);

  // Cancel call (clears booked_call_date, reverts status to Contacted)
  const handleCancelCall = useCallback(async (apptId: number) => {
    await apiFetch(`/api/leads/${apptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booked_call_date: null, conversion_status: "Contacted" }),
    });
    refetchLeads();
    setSelectedBooking(null);
  }, [refetchLeads]);

  // ── Error state ──────────────────────────────────────────────────────────────
  if (leadsError && !leadsLoading && leads.length === 0) {
    return (
      <CrmShell>
        <div className="flex-1 min-h-0 flex items-center justify-center p-8" data-testid="page-calendar-error">
          <div className="max-w-md w-full rounded-lg border border-destructive/30 bg-destructive/5 px-5 py-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground">{t("errors.failedToLoad")}</div>
              <div className="text-xs text-muted-foreground mt-0.5 break-words">{leadsError.message}</div>
              <button
                type="button"
                onClick={() => refetchLeads()}
                className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-brand-indigo text-white text-xs font-semibold hover:brightness-110"
                data-testid="button-retry-leads"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t("errors.retry")}
              </button>
            </div>
          </div>
        </div>
      </CrmShell>
    );
  }

  // ── Loading skeleton — only on initial load, not on manual refresh ───────────
  if (leadsLoading && leads.length === 0) {
    return (
      <CrmShell>
        <CalendarLoadingSkeleton leftPanelState={leftPanelState} />
      </CrmShell>
    );
  }

  return (
    <CrmShell>
      <div className="flex flex-col h-full overflow-hidden" data-testid="page-calendar">
        <DesktopCalendar
          t={t}
          appts={appts}
          apptsByDate={apptsByDate}
          groupedAppts={groupedAppts}
          weekDays={weekDays}
          days={days}
          month={month}
          todayStr={todayStr}
          viewLabel={viewLabel}
          weekLabel={weekLabel}
          viewMode={viewMode}
          setViewMode={setViewMode}
          onNavigate={navigate}
          onNavigateWeek={navigateWeek}
          onSelectMonth={selectMonth}
          hideWeekends={hideWeekends}
          setHideWeekends={setHideWeekends}
          busySlots={busySlots}
          showAvailability={showAvailability}
          setShowAvailability={setShowAvailability}
          availStart={workingHours.start}
          availEnd={workingHours.end}
          onRefresh={() => { refetchLeads(); refreshFreeBusy(); }}
          onToday={() => setAnchorDate(new Date())}
          selectedBooking={selectedBooking}
          onSelectBooking={setSelectedBooking}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          searchOpen={searchOpen} setSearchOpen={setSearchOpen}
          apptSortBy={apptSortBy} setApptSortBy={setApptSortBy}
          apptGroupBy={apptGroupBy} setApptGroupBy={setApptGroupBy}
          apptGroupDirection={apptGroupDirection} setApptGroupDirection={setApptGroupDirection}
          apptFilterStatuses={apptFilterStatuses} setApptFilterStatuses={setApptFilterStatuses}
          leads={leads} refetchLeads={refetchLeads}
          recentMessages={recentMessages} recentMessagesLoading={recentMessagesLoading}
          onOpenInLead={handleOpenInLead}
          onCloseDetail={() => setSelectedBooking(null)}
          currentTime={currentTime}
          apptListRef={apptListRef}
          canSeeConversation={canSeeConversation}
          onReschedule={handleReschedule}
          onCancelCall={handleCancelCall}
          blocks={blocks}
          accountId={freeBusyAccountId}
          onCreateBlock={freeBusyAccountId ? async (data) => { await createBlock({ ...data, accountId: freeBusyAccountId }); } : undefined}
          onUpdateBlock={freeBusyAccountId ? async (id, data) => { await updateBlock(id, data); } : undefined}
          onDeleteBlock={freeBusyAccountId ? async (id) => { await deleteBlock(id, freeBusyAccountId); } : undefined}
        />
      </div>
    </CrmShell>
  );
}
