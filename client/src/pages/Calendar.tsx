import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useTranslation } from "react-i18next";
import { CrmShell } from "@/components/crm/CrmShell";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLeads } from "@/hooks/useApiData";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Interaction } from "@/features/conversations/hooks/useConversationsData";
import { useLocation } from "wouter";
import { DesktopCalendar } from "@/features/calendar/components/DesktopCalendar";
import { apiFetch } from "@/lib/apiUtils";
import { getHoursInTimezone, getMinutesInTimezone, toLocaleDateStringTz } from "@/features/leads/components/cardView/formatUtils";
import { useFKeyScrollToSelected } from "@/hooks/useFKeyScrollToSelected";
import { dateKeyOf, type Appointment } from "@/features/calendar/lib/calendarDesign";

const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const FULL_MONTH_KEYS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function formatDate(date: Date, tFn: (key: string) => string) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = tFn(`months.short.${MONTH_KEYS[date.getMonth()]}`);
  const year = date.getFullYear();
  return `${day} ${month} - ${year}`;
}

type ViewMode = "month" | "week";

type ApptSortBy = "time_asc" | "time_desc" | "name_asc" | "name_desc" | "campaign_asc" | "campaign_desc" | "status_asc" | "status_desc";
type ApptGroupBy = "date" | "campaign" | "status" | "none";
type ApptFilterStatus = "no_show" | "rescheduled" | "confirmed";

type DateGroupKey = "past" | "today" | "tomorrow" | "thisWeek" | "later";

function getApptDateGroup(dateStr: string): DateGroupKey {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "later";
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (dDay.getTime() < today.getTime()) return "past";
  if (dDay.getTime() === today.getTime()) return "today";
  if (dDay.getTime() === tomorrow.getTime()) return "tomorrow";
  if (dDay.getTime() < nextWeek.getTime()) return "thisWeek";
  return "later";
}

const DATE_GROUP_ORDER: DateGroupKey[] = ["today", "tomorrow", "thisWeek", "later", "past"];

export default function CalendarPage() {
  const { t } = useTranslation("calendar");

  const { currentAccountId, isAgencyUser, accounts, isAdmin, isOwner } = useWorkspace();
  const canSeeConversation = isAdmin || isOwner;

  const { leads, loading: leadsLoading, error: leadsError, refresh: refetchLeads } = useLeads(currentAccountId > 0 ? currentAccountId : undefined);
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

  const appts = useMemo((): Appointment[] => {
    if (!leads) return [];
    return leads
      .filter((l: any) => {
        if (!isAgencyUser) return (l.account_id || l.accounts_id) === currentAccountId;
        if (effectiveAccountFilter === "all") return true;
        return (l.account_id || l.accounts_id) === effectiveAccountFilter;
      })
      .filter((l: any) => campaignId === "all" ? true : (l.campaign_id || l.campaigns_id) === campaignId)
      .filter((l: any) => {
        const callDate = l.booked_call_date || l.booking_confirmed_at || l.bookingConfirmedAt;
        return Boolean(callDate) && (l.conversion_status === "Booked" || l.Conversion_Status === "Booked");
      })
      .map((l: any) => {
        const rawDate = l.booked_call_date || l.booking_confirmed_at || l.bookingConfirmedAt;
        const d = new Date(rawDate as string);
        const firstName = l.first_name || "";
        const lastName = l.last_name || "";
        const fullName = l.full_name || (firstName || lastName ? `${firstName} ${lastName}`.trim() : t("appointment.unknownLead"));
        const aid = l.account_id || l.accounts_id;
        const tz = accounts.find((a: any) => a.id === Number(aid))?.timezone as string | undefined;
        return {
          id: l.id,
          lead_name: fullName,
          campaign_name: l.campaign_name || null,
          date: toLocaleDateStringTz(d, tz),
          formattedDate: formatDate(d, t),
          time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", ...(tz ? { timeZone: tz } : {}) }),
          hour: getHoursInTimezone(d, tz),
          minutes: getMinutesInTimezone(d, tz),
          status: l.conversion_status,
          calendar_link: l.calendar_link || "https://cal.example.com/leadawaker",
          no_show: l.no_show === true || l.no_show === "true" || l.no_show === 1,
          re_scheduled_count: Number(l.re_scheduled_count) || 0,
          raw_booked_call_date: (l.booked_call_date || l.booking_confirmed_at || l.bookingConfirmedAt) as string,
          raw_previous_booked_call_date: (l.previous_booked_call_date || l.previousBookedCallDate || null) as string | null,
          phone: l.phone || l.Phone || null,
          email: l.email || l.Email || null,
          callDurationMinutes: Number(l.call_duration_minutes) || 60,
          rawLead: l,
          timezone: tz || undefined,
          leadScore: Number(l.lead_score) || 0,
        };
      })
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [leads, currentAccountId, isAgencyUser, effectiveAccountFilter, campaignId, t, accounts]);

  // Indexed by date for O(1) grid lookups
  const apptsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appts) {
      if (!map.has(a.date)) map.set(a.date, []);
      map.get(a.date)!.push(a);
    }
    return map;
  }, [appts]);

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

  // Filtered + sorted appointments
  const sortedAppts = useMemo(() => {
    let source = appts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      source = source.filter((a) => a.lead_name.toLowerCase().includes(q) || (a.campaign_name || "").toLowerCase().includes(q));
    }
    let filtered = source;
    if (apptFilterStatuses.length > 0) {
      filtered = source.filter((a) => {
        if (apptFilterStatuses.includes("no_show") && a.no_show) return true;
        if (apptFilterStatuses.includes("rescheduled") && a.re_scheduled_count > 0) return true;
        if (apptFilterStatuses.includes("confirmed") && !a.no_show && a.re_scheduled_count === 0) return true;
        return false;
      });
    }
    const sorted = [...filtered];
    switch (apptSortBy) {
      case "name_asc": sorted.sort((a, b) => a.lead_name.localeCompare(b.lead_name)); break;
      case "name_desc": sorted.sort((a, b) => b.lead_name.localeCompare(a.lead_name)); break;
      case "campaign_asc": sorted.sort((a, b) => (a.campaign_name || "").localeCompare(b.campaign_name || "")); break;
      case "campaign_desc": sorted.sort((a, b) => (b.campaign_name || "").localeCompare(a.campaign_name || "")); break;
      case "status_asc": sorted.sort((a, b) => (a.status || "").localeCompare(b.status || "")); break;
      case "status_desc": sorted.sort((a, b) => (b.status || "").localeCompare(a.status || "")); break;
      case "time_asc": sorted.sort((a, b) => new Date(a.raw_booked_call_date).getTime() - new Date(b.raw_booked_call_date).getTime()); break;
      default: break;
    }
    return sorted;
  }, [appts, apptSortBy, apptFilterStatuses, searchQuery]);

  // Grouped appointments for left panel
  const groupedAppts = useMemo(() => {
    switch (apptGroupBy) {
      case "none":
        return [{ label: null as string | null, items: sortedAppts }];
      case "campaign": {
        const buckets = new Map<string, Appointment[]>();
        for (const a of sortedAppts) {
          const key = a.campaign_name || t("filter.noCampaign");
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key)!.push(a);
        }
        const entries = Array.from(buckets.entries()).map(([label, items]) => ({ label: label as string | null, items }));
        return apptGroupDirection === "desc" ? entries.reverse() : entries;
      }
      case "status": {
        const buckets = new Map<string, Appointment[]>();
        for (const a of sortedAppts) {
          const key = a.no_show ? t("appointment.noShow") : (a.status || "Unknown");
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key)!.push(a);
        }
        const entries = Array.from(buckets.entries()).map(([label, items]) => ({ label: label as string | null, items }));
        return apptGroupDirection === "desc" ? entries.reverse() : entries;
      }
      case "date":
      default: {
        const buckets = new Map<string, Appointment[]>();
        for (const a of sortedAppts) {
          const group = getApptDateGroup(a.raw_booked_call_date);
          if (!buckets.has(group)) buckets.set(group, []);
          buckets.get(group)!.push(a);
        }
        const orderedKeys = apptGroupDirection === "desc" ? [...DATE_GROUP_ORDER].reverse() : DATE_GROUP_ORDER;
        const result: { label: string | null; items: Appointment[] }[] = [];
        for (const key of orderedKeys) {
          const items = buckets.get(key);
          if (items && items.length > 0) result.push({ label: t(`dateGroups.${key}`), items });
        }
        return result;
      }
    }
  }, [sortedAppts, apptGroupBy, apptGroupDirection, t]);

  // On first load: select the next upcoming call within the displayed week only.
  // If no upcoming call falls in this week, leave nothing selected.
  const didInitSelectRef = useRef(false);
  useEffect(() => {
    if (didInitSelectRef.current || sortedAppts.length === 0) return;
    didInitSelectRef.current = true;
    const weekKeys = new Set(weekDays.map(dateKeyOf));
    const now = new Date();
    const upcoming = sortedAppts
      .filter((a) => weekKeys.has(a.date) && new Date(a.raw_booked_call_date) >= now)
      .sort((a, b) => new Date(a.raw_booked_call_date).getTime() - new Date(b.raw_booked_call_date).getTime());
    setSelectedBooking(upcoming[0] ?? null);
  }, [sortedAppts, weekDays]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (leadsLoading) {
    return (
      <CrmShell>
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-[3px] p-0" data-testid="page-calendar">
          <div className="hidden lg:flex bg-card rounded-lg flex-col overflow-hidden">
            <div className="px-3.5 pt-5 pb-1 flex items-center justify-between shrink-0">
              <Skeleton className="h-5 w-24 rounded bg-primary/10" />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden px-[3px] flex flex-col gap-[3px]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 bg-card rounded-lg px-3 py-2.5">
                  <Skeleton className="h-9 w-9 rounded-full bg-primary/10 shrink-0" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-3/4 rounded bg-primary/10" />
                    <Skeleton className="h-3 w-1/2 rounded bg-primary/10" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card rounded-lg flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/[0.06] shrink-0">
              <Skeleton className="h-5 w-40 rounded bg-primary/10" />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-black/[0.04]" style={{ height: '52px' }}>
                  <div className="flex items-start justify-end pr-2 pt-1">
                    <Skeleton className="h-3 w-10 rounded bg-primary/10" />
                  </div>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <div key={j} className="border-l border-black/[0.04]" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
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
        />
      </div>
    </CrmShell>
  );
}
