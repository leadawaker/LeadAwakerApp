// desktopCalendarShared.tsx — shared constants, types, atoms, and small helpers
// used across the DesktopCalendar component group (toolbar, week, month/agenda,
// detail, and the orchestrator).
import { useState, useEffect, type CSSProperties } from "react";
import type { TFunction } from "i18next";
import {
  Clock, Check, RefreshCw, Info, AlertCircle, Target, ShieldQuestion, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListPanelState } from "@/hooks/useListPanelState";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import type { Interaction } from "@/features/conversations/hooks/useConversationsData";
import type { Appointment } from "../lib/calendarDesign";
import type { CalendarBlock } from "../hooks/useCalendarBlocks";

export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]; // indexed by Date.getDay()
export const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday-first column order (getDay values)
export const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export const isWeekendDay = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

export type ApptSortBy = "time_asc" | "time_desc" | "name_asc" | "name_desc" | "campaign_asc" | "campaign_desc" | "status_asc" | "status_desc";
export type ApptGroupBy = "date" | "campaign" | "status" | "none";
export type ApptFilterStatus = "no_show" | "rescheduled" | "confirmed";

export const SORT_GROUPS: { key: string; label: string; asc: ApptSortBy; desc: ApptSortBy }[] = [
  { key: "time", label: "sort.time", asc: "time_asc", desc: "time_desc" },
  { key: "name", label: "sort.nameAZ", asc: "name_asc", desc: "name_desc" },
  { key: "campaign", label: "sort.campaign", asc: "campaign_asc", desc: "campaign_desc" },
  { key: "status", label: "sort.status", asc: "status_asc", desc: "status_desc" },
];
export const GROUP_KEYS: Record<ApptGroupBy, string> = { date: "group.date", campaign: "group.campaign", status: "group.status", none: "group.none" };
export const FILTER_KEYS: Record<ApptFilterStatus, string> = { no_show: "filter.noShow", rescheduled: "filter.rescheduled", confirmed: "filter.confirmed" };

const NAV_BTN: CSSProperties = {
  width: 34, height: 34, borderRadius: "var(--r-button)", border: "none", cursor: "pointer",
  background: "var(--bg)", display: "flex",
  alignItems: "center", justifyContent: "center", color: "var(--mute)",
  transition: "transform 80ms, box-shadow 80ms",
  boxShadow: "var(--sh-raised-crisp)",
};

export function NavBtn({ onClick, children, style, forcePressed, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode; forcePressed?: boolean }) {
  const [pressed, setPressed] = useState(false);
  const isPressed = pressed || forcePressed;
  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{ ...NAV_BTN, transition: "transform 140ms, box-shadow 140ms", transform: isPressed ? "scale(0.91)" : "scale(1)", boxShadow: isPressed ? "var(--sh-inset-crisp)" : "var(--sh-raised-crisp)", ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Brief inset "press" flash on the prev/next arrows when the grid is swiped.
 *  Grids dispatch `la-cal-swipe` with { dir }; -1 = prev, 1 = next. */
const CAL_SWIPE_EVENT = "la-cal-swipe";
export function emitCalSwipe(dir: -1 | 1) {
  window.dispatchEvent(new CustomEvent(CAL_SWIPE_EVENT, { detail: { dir } }));
}
export function useSwipeFlash() {
  const [flashDir, setFlashDir] = useState<-1 | 1 | null>(null);
  useEffect(() => {
    const onSwipe = (e: Event) => {
      const dir = (e as CustomEvent<{ dir: -1 | 1 }>).detail?.dir;
      if (dir !== -1 && dir !== 1) return;
      setFlashDir(dir);
      window.setTimeout(() => setFlashDir((cur) => (cur === dir ? null : cur)), 240);
    };
    window.addEventListener(CAL_SWIPE_EVENT, onSwipe);
    return () => window.removeEventListener(CAL_SWIPE_EVENT, onSwipe);
  }, []);
  return flashDir;
}

/** A labeled (icon + text) calendar action/toggle row for the mobile settings sheet. */
export function CalSettingRow({ icon, label, active, onClick, "data-testid": testId }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void; "data-testid"?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%",
        padding: "13px 14px", borderRadius: "var(--r-button)", border: "none", cursor: "pointer",
        background: "var(--surface)",
        boxShadow: active ? "var(--sh-inset-crisp)" : "var(--sh-raised-crisp)",
        color: "var(--ink)", fontSize: 14.5, fontWeight: 600, textAlign: "left",
      }}
    >
      <span style={{ color: active ? "var(--wine)" : "var(--mute)", display: "flex" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {active && <Check className="h-4 w-4" style={{ color: "var(--wine)" }} />}
    </button>
  );
}
export const MONO: CSSProperties = { fontFamily: "var(--mono)" };
export const SERIF: CSSProperties = { fontFamily: "var(--serif)" };

// AI summary section definitions
export type SummaryKey = "situation" | "pain" | "goal" | "objection" | "nextStep";
export const SUMMARY_ICONS: Record<SummaryKey, React.ReactNode> = {
  situation: <Info className="h-3 w-3" />,
  pain: <AlertCircle className="h-3 w-3" />,
  goal: <Target className="h-3 w-3" />,
  objection: <ShieldQuestion className="h-3 w-3" />,
  nextStep: <ArrowRight className="h-3 w-3" />,
};
export const SUMMARY_KEYS: SummaryKey[] = ["situation", "pain", "goal", "objection", "nextStep"];

export function parseAiSummary(raw: string | null | undefined): { key: SummaryKey; text: string }[] | string | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const valid = parsed.filter((x: any) => x && typeof x.key === "string" && typeof x.text === "string");
      if (valid.length > 0) return valid;
    }
    if (typeof parsed === "object" && parsed !== null) {
      const keys: SummaryKey[] = ["situation", "pain", "goal", "objection", "nextStep"];
      const sections = keys.map(k => ({ key: k, text: parsed[k] || "" })).filter(s => s.text);
      if (sections.length > 0) return sections;
    }
  } catch {}
  return raw; // plain text fallback
}

export interface DesktopCalendarProps {
  t: TFunction;
  appts: Appointment[];
  apptsByDate: Map<string, Appointment[]>;
  groupedAppts: { label: string | null; items: Appointment[] }[];
  weekDays: Date[];
  days: { date: Date; count: number }[];
  month: Date;
  todayStr: string;
  viewLabel: string;
  weekLabel: string;
  viewMode: "week" | "month" | "list";
  setViewMode: (v: "week" | "month" | "list") => void;
  onNavigate: (dir: number) => void;
  onNavigateWeek: (dir: number) => void;
  onSelectMonth: (monthIndex: number) => void;
  hideWeekends: boolean;
  setHideWeekends: (v: boolean) => void;
  onToday: () => void;
  selectedBooking: Appointment | null;
  onSelectBooking: (a: Appointment | null) => void;
  // toolbar controls
  searchQuery: string; setSearchQuery: (v: string) => void;
  searchOpen: boolean; setSearchOpen: (v: boolean) => void;
  apptSortBy: ApptSortBy; setApptSortBy: (v: ApptSortBy) => void;
  apptGroupBy: ApptGroupBy; setApptGroupBy: (v: ApptGroupBy) => void;
  apptGroupDirection: "asc" | "desc"; setApptGroupDirection: (v: "asc" | "desc") => void;
  apptFilterStatuses: ApptFilterStatus[]; setApptFilterStatuses: (v: ApptFilterStatus[]) => void;
  leads: any[] | undefined; refetchLeads: () => void;
  // detail
  recentMessages: Interaction[]; recentMessagesLoading: boolean;
  onOpenInLead: () => void; onCloseDetail: () => void;
  currentTime: Date;
  apptListRef: React.RefObject<HTMLDivElement | null>;
  // conversation visibility gate (admin/owner only)
  canSeeConversation: boolean;
  // reschedule / cancel handlers
  onReschedule: (apptId: number, newDate: Date) => Promise<void>;
  onCancelCall: (apptId: number) => Promise<void>;
  narrow?: boolean;
  // panel fold (left agenda) + popup detail mode — injected by composition root
  leftPanelState?: ListPanelState;
  onCyclePanel?: () => void;
  showClose?: boolean;
  // ultra-wide (>= 1700px): week + month shown side by side, toggle hidden
  ultra?: boolean;
  // Availability overlay (free/busy from the account's connected calendars).
  // busySlots are merged busy intervals (ISO); free windows are the gaps within
  // the business-hours band [availStart, availEnd).
  busySlots?: { start: string; end: string }[];
  showAvailability?: boolean;
  setShowAvailability?: (v: boolean) => void;
  availStart?: number;
  availEnd?: number;
  setAvailStart?: (v: number) => void;
  setAvailEnd?: (v: number) => void;
  onRefresh?: () => void;
  // Manual busy blocks
  blocks?: CalendarBlock[];
  accountId?: number;
  onCreateBlock?: (data: { date: string; startTime?: string; endTime?: string; allDay: boolean; label?: string }) => Promise<void>;
  onUpdateBlock?: (id: number, data: { date?: string; startTime?: string; endTime?: string; allDay?: boolean; label?: string }) => Promise<void>;
  onDeleteBlock?: (id: number) => Promise<void>;
}

// Toolbar dropdown trigger (wine soft icon button)
export function toolBtnClass(active: boolean) {
  return cn("la-btn la-btn--soft la-btn--icon", active && "!text-[var(--wine)]");
}

export function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ ...MONO, fontSize: 8.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}><span style={{ color: "var(--mute)", display: "flex" }}>{icon}</span>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)", overflowWrap: "anywhere", wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

// Reschedule popover (inline mini date/time form)
export function ReschedulePopover({ ev, onReschedule, t, trigger }: { ev: Appointment; onReschedule: (id: number, d: Date) => Promise<void>; t: TFunction; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(ev.date);
  const [time, setTime] = useState(ev.time);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const [h, min] = time.split(":").map(Number);
      const [y, mo, d] = date.split("-").map(Number);
      const newDate = new Date(y, mo - 1, d, h, min ?? 0, 0);
      await onReschedule(ev.id, newDate);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-3" style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "var(--r-card)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ ...MONO, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--wine)", fontWeight: 700 }}>{t("design.detail.reschedule")}</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="neu-input" style={{ height: 32, fontSize: 12, paddingLeft: 10, paddingRight: 6 }} />
          <input type="time" value={time} onChange={e => setTime(e.target.value)}
            className="neu-input" style={{ height: 32, fontSize: 12, paddingLeft: 10, paddingRight: 6 }} />
          <button
            onClick={submit} disabled={saving}
            style={{ height: 32, borderRadius: "var(--r-button)", border: "none", cursor: "pointer", background: "var(--wine-grad)", color: "var(--paper)", ...MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? <RefreshCw className="h-3 w-3 mx-auto animate-spin" /> : t("design.detail.reschedule")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
