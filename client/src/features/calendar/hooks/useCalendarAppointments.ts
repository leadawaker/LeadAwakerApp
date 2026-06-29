import { useMemo } from "react";
import { getHoursInTimezone, getMinutesInTimezone, toLocaleDateStringTz } from "@/features/leads/components/cardView/formatUtils";
import type { Appointment } from "@/features/calendar/lib/calendarDesign";
import {
  formatDate,
  getApptDateGroup,
  DATE_GROUP_ORDER,
  type ApptSortBy,
  type ApptGroupBy,
  type ApptFilterStatus,
} from "@/features/calendar/calendarPageUtils";

interface UseCalendarAppointmentsParams {
  leads: any[];
  isAgencyUser: boolean;
  currentAccountId: number;
  effectiveAccountFilter: number | "all";
  campaignId: number | "all";
  accounts: any[];
  t: (key: string) => string;
  searchQuery: string;
  apptFilterStatuses: ApptFilterStatus[];
  apptSortBy: ApptSortBy;
  apptGroupBy: ApptGroupBy;
  apptGroupDirection: "asc" | "desc";
}

export function useCalendarAppointments({
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
}: UseCalendarAppointmentsParams) {
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
          callDurationMinutes: Number(l.call_duration_minutes) || 30,
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

  return { appts, apptsByDate, sortedAppts, groupedAppts };
}
