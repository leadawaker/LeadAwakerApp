// DesktopCalendar.tsx — wine/neumorphic Calendar at all breakpoints.
// Full-width top toolbar + three floating panels (agenda · week/month grid · detail).
// Fabricated metrics removed; real lead score, AI summary, and full conversation shown.
import { useMemo, useState, useRef, useEffect, type CSSProperties } from "react";
import type { TFunction } from "i18next";
import {
  ChevronLeft, ChevronRight, Clock, Video, Phone, Mail, Check,
  Calendar as CalIcon, CalendarDays, Filter, ArrowUpDown, ArrowUp, ArrowDown, Layers, Plus,
  PanelLeft, PanelLeftClose, X, MoreVertical, RefreshCw, XCircle, Search,
  Info, AlertCircle, Target, ShieldQuestion, ArrowRight, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useListPanelState, type ListPanelState } from "@/hooks/useListPanelState";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileSheet } from "@/components/crm/mobile/MobileSheet";
import { MobileListHeader, MobileTabSeg, MobileDrawerOption, MobileDrawerSubheading, DrawerMainButton } from "@/components/crm/mobile/MobileListHeader";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useSession } from "@/hooks/useSession";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { getLeadStatusAvatarColor } from "@/lib/avatarUtils";
import {
  computeMiniMsgMeta, groupMiniMessagesByThread, isAiMsg,
  MiniLeadRunWrapper, MiniAgentRunWrapper, MiniBotRunWrapper,
} from "@/features/leads/components/cardView/MiniChat";
import type { MiniMsgMeta } from "@/features/leads/components/cardView/types";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import type { Interaction } from "@/features/conversations/hooks/useConversationsData";
import {
  type Appointment, CARD_STYLE, HEADER_H, HOUR0, HOUR1, SPAN, PX_PER_HOUR,
  statusMetaOf, statusKeyOf, channelOf, apptHm, endClockOf, dateKeyOf,
} from "../lib/calendarDesign";
import { ScoreArcDonut } from "@/features/leads/components/cardView/atoms";
import { PipelineLeadPanel } from "@/features/leads/components/cardView/PipelineLeadPanel";
import { AiSummaryView } from "@/components/crm/AiSummaryView";
import { BookAppointmentPopover } from "./BookAppointmentPopover";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]; // indexed by Date.getDay()
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday-first column order (getDay values)
const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const isWeekendDay = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

type ApptSortBy = "time_asc" | "time_desc" | "name_asc" | "name_desc" | "campaign_asc" | "campaign_desc" | "status_asc" | "status_desc";
type ApptGroupBy = "date" | "campaign" | "status" | "none";
type ApptFilterStatus = "no_show" | "rescheduled" | "confirmed";

const SORT_GROUPS: { key: string; label: string; asc: ApptSortBy; desc: ApptSortBy }[] = [
  { key: "time", label: "sort.time", asc: "time_asc", desc: "time_desc" },
  { key: "name", label: "sort.nameAZ", asc: "name_asc", desc: "name_desc" },
  { key: "campaign", label: "sort.campaign", asc: "campaign_asc", desc: "campaign_desc" },
  { key: "status", label: "sort.status", asc: "status_asc", desc: "status_desc" },
];
const GROUP_KEYS: Record<ApptGroupBy, string> = { date: "group.date", campaign: "group.campaign", status: "group.status", none: "group.none" };
const FILTER_KEYS: Record<ApptFilterStatus, string> = { no_show: "filter.noShow", rescheduled: "filter.rescheduled", confirmed: "filter.confirmed" };

const NAV_BTN: CSSProperties = {
  width: 34, height: 34, borderRadius: "var(--r-button)", border: "none", cursor: "pointer",
  background: "var(--bg)", display: "flex",
  alignItems: "center", justifyContent: "center", color: "var(--mute)",
  transition: "transform 80ms, box-shadow 80ms",
  boxShadow: "var(--sh-raised-crisp)",
};

function NavBtn({ onClick, children, style, forcePressed, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode; forcePressed?: boolean }) {
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
function emitCalSwipe(dir: -1 | 1) {
  window.dispatchEvent(new CustomEvent(CAL_SWIPE_EVENT, { detail: { dir } }));
}
function useSwipeFlash() {
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
function CalSettingRow({ icon, label, active, onClick, "data-testid": testId }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void; "data-testid"?: string }) {
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
const MONO: CSSProperties = { fontFamily: "var(--mono)" };
const SERIF: CSSProperties = { fontFamily: "var(--serif)" };

// AI summary section definitions
type SummaryKey = "situation" | "pain" | "goal" | "objection" | "nextStep";
const SUMMARY_ICONS: Record<SummaryKey, React.ReactNode> = {
  situation: <Info className="h-3 w-3" />,
  pain: <AlertCircle className="h-3 w-3" />,
  goal: <Target className="h-3 w-3" />,
  objection: <ShieldQuestion className="h-3 w-3" />,
  nextStep: <ArrowRight className="h-3 w-3" />,
};
const SUMMARY_KEYS: SummaryKey[] = ["situation", "pain", "goal", "objection", "nextStep"];

function parseAiSummary(raw: string | null | undefined): { key: SummaryKey; text: string }[] | string | null {
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
  apptListRef: React.RefObject<HTMLDivElement>;
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
}

// Toolbar dropdown trigger (wine soft icon button)
function toolBtnClass(active: boolean) {
  return cn("la-btn la-btn--soft la-btn--icon", active && "!text-[var(--wine)]");
}

// Calendar settings popover — availability overlay toggle + business hours +
// hide weekends. Reached via the gear button in the top toolbar.
function CalendarSettingsPopover({ p }: { p: DesktopCalendarProps }) {
  const { t } = p;
  const active = !!p.showAvailability || p.hideWeekends;
  const hourOptions: number[] = [];
  for (let h = HOUR0; h <= HOUR1; h++) hourOptions.push(h);
  const fmtHour = (h: number) => `${h === 0 ? 12 : h <= 12 ? h : h - 12}${h < 12 ? "am" : "pm"}`;
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "7px 0" }}>
      <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{label}</span>
      {children}
    </div>
  );
  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button onClick={onClick} aria-pressed={on} style={{
      width: 38, height: 22, borderRadius: 999, flexShrink: 0, position: "relative", cursor: "pointer",
      background: on ? "var(--wine)" : "var(--mute-2)", transition: "background 130ms", border: "none",
    }}>
      <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: "50%", background: "var(--paper)", transition: "left 130ms", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
    </button>
  );
  const selectStyle: React.CSSProperties = { fontSize: 12, padding: "4px 8px", borderRadius: "var(--r-button)" };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={toolBtnClass(active)} title={t("design.settings.title", { defaultValue: "Calendar settings" })}>
          <Settings className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div style={{ ...MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)", fontWeight: 700, marginBottom: 4 }}>
          {t("design.settings.title", { defaultValue: "Calendar settings" })}
        </div>
        {p.setShowAvailability && (
          <Row label={t("design.settings.availability", { defaultValue: "Show availability" })}>
            <Toggle on={!!p.showAvailability} onClick={() => p.setShowAvailability!(!p.showAvailability)} />
          </Row>
        )}
        {p.showAvailability && p.setAvailStart && p.setAvailEnd && (
          <Row label={t("design.settings.hours", { defaultValue: "Business hours" })}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <select className="neu-input" style={selectStyle} value={p.availStart ?? 9} onChange={(e) => p.setAvailStart!(Number(e.target.value))}>
                {hourOptions.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
              </select>
              <span style={{ color: "var(--mute-2)", fontSize: 11 }}>–</span>
              <select className="neu-input" style={selectStyle} value={p.availEnd ?? 17} onChange={(e) => p.setAvailEnd!(Number(e.target.value))}>
                {hourOptions.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
              </select>
            </div>
          </Row>
        )}
        <div className="rule" style={{ margin: "6px 0" }} />
        <Row label={t("design.weekends.hide", { defaultValue: "Hide weekends" })}>
          <Toggle on={p.hideWeekends} onClick={() => p.setHideWeekends(!p.hideWeekends)} />
        </Row>
      </PopoverContent>
    </Popover>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Top toolbar (title · view toggle · collapse button · search/sort/filter/group/new)
// ════════════════════════════════════════════════════════════════════════════
function TopToolbar(p: DesktopCalendarProps) {
  const { t } = p;
  const isMobile = useIsMobile(768);
  const weekKeys = useMemo(() => new Set(p.weekDays.map(dateKeyOf)), [p.weekDays]);
  const meetingsThisWeek = useMemo(() => p.appts.filter((a) => weekKeys.has(a.date)).length, [p.appts, weekKeys]);
  const activeMonth = p.month.getMonth();

  // Shared action controls (icon buttons + dropdowns), reused by the desktop
  // and mobile toolbar layouts so behavior never drifts between the two.
  const actionsMenu = p.selectedBooking ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="la-btn la-btn--soft la-btn--icon" title={t("design.detail.actions")}><MoreVertical className="h-4 w-4" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-[12px] p-0">
          <ReschedulePopover
            ev={p.selectedBooking}
            onReschedule={p.onReschedule}
            t={t}
            trigger={
              <button className="flex items-center gap-2 w-full px-2 py-1.5 text-[12px] text-left hover:bg-muted/50 rounded">
                <RefreshCw className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {t("design.detail.reschedule")}
              </button>
            }
          />
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => p.selectedBooking && p.onCancelCall(p.selectedBooking.id)}
          className="text-[12px] flex items-center gap-2 text-destructive focus:text-destructive"
        >
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          {t("design.detail.cancelCall")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const filterMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={toolBtnClass(p.apptFilterStatuses.length > 0)} title={t("filter.label")}><Filter className="h-4 w-4" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {(["no_show", "rescheduled", "confirmed"] as ApptFilterStatus[]).map((opt) => (
          <DropdownMenuItem
            key={opt}
            onSelect={(e) => { e.preventDefault(); p.setApptFilterStatuses(p.apptFilterStatuses.includes(opt) ? p.apptFilterStatuses.filter((s) => s !== opt) : [...p.apptFilterStatuses, opt]); }}
            className="flex items-center gap-2 text-[12px]"
          >
            <span className="flex-1">{t(FILTER_KEYS[opt])}</span>
            {p.apptFilterStatuses.includes(opt) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const sortMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={toolBtnClass(p.apptSortBy !== "time_desc")} title={t("sort.label")}><ArrowUpDown className="h-4 w-4" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {SORT_GROUPS.map((g) => {
          const isActive = p.apptSortBy === g.asc || p.apptSortBy === g.desc;
          const dir: "asc" | "desc" = p.apptSortBy === g.asc ? "asc" : "desc";
          return (
            <DropdownMenuItem key={g.key} onSelect={(e) => { e.preventDefault(); p.setApptSortBy(isActive ? p.apptSortBy : g.desc); }} className="text-[12px] flex items-center gap-2">
              <span className={cn("flex-1", isActive && "font-semibold !text-brand-indigo")}>{t(g.label)}</span>
              {isActive && (
                <>
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); p.setApptSortBy(g.asc); }} className={cn("p-0.5 rounded hover:bg-muted/60", dir === "asc" ? "text-brand-indigo" : "text-foreground/30")} aria-label={t("a11y.sortAscending")}><ArrowUp className="h-3 w-3" /></button>
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); p.setApptSortBy(g.desc); }} className={cn("p-0.5 rounded hover:bg-muted/60", dir === "desc" ? "text-brand-indigo" : "text-foreground/30")} aria-label={t("a11y.sortDescending")}><ArrowDown className="h-3 w-3" /></button>
                </>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const groupMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={toolBtnClass(p.apptGroupBy !== "date")} title={t("group.label")}><Layers className="h-4 w-4" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {(["date", "campaign", "status", "none"] as ApptGroupBy[]).map((opt) => (
          <DropdownMenuItem key={opt} onSelect={(e) => { e.preventDefault(); p.setApptGroupBy(opt); }} className="text-[12px] flex items-center gap-2">
            <span className={cn("flex-1", p.apptGroupBy === opt && "font-semibold !text-brand-indigo")}>{t(GROUP_KEYS[opt])}</span>
            {p.apptGroupBy === opt && opt !== "none" && (
              <>
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); p.setApptGroupDirection("asc"); }} className={cn("p-0.5 rounded hover:bg-muted/60", p.apptGroupDirection === "asc" ? "text-brand-indigo" : "text-foreground/30")} aria-label={t("a11y.sortAscending")}><ArrowUp className="h-3 w-3" /></button>
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); p.setApptGroupDirection("desc"); }} className={cn("p-0.5 rounded hover:bg-muted/60", p.apptGroupDirection === "desc" ? "text-brand-indigo" : "text-foreground/30")} aria-label={t("a11y.sortDescending")}><ArrowDown className="h-3 w-3" /></button>
              </>
            )}
            {p.apptGroupBy === opt && opt === "none" && <Check className="h-3 w-3" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const bookButton = (
    <BookAppointmentPopover
      leads={p.leads}
      refetchLeads={p.refetchLeads}
      trigger={<button className="la-btn la-btn--soft la-btn--icon" title={t("book.newAppointment")}><Plus className="h-4 w-4" /></button>}
    />
  );

  if (isMobile) {
    const mobileFilterPanel = (
      <>
        <MobileDrawerSubheading>{t("filter.label")}</MobileDrawerSubheading>
        {(["no_show", "rescheduled", "confirmed"] as ApptFilterStatus[]).map((opt) => (
          <MobileDrawerOption
            key={opt}
            label={t(FILTER_KEYS[opt])}
            selected={p.apptFilterStatuses.includes(opt)}
            onClick={() => p.setApptFilterStatuses(p.apptFilterStatuses.includes(opt) ? p.apptFilterStatuses.filter((s) => s !== opt) : [...p.apptFilterStatuses, opt])}
          />
        ))}
      </>
    );
    const mobileSortPanel = (
      <>
        {SORT_GROUPS.map((g) => {
          const isAsc = p.apptSortBy === g.asc;
          const isDesc = p.apptSortBy === g.desc;
          const isActive = isAsc || isDesc;
          return (
            <MobileDrawerOption
              key={g.key}
              label={t(g.label)}
              selected={isActive}
              onClick={() => p.setApptSortBy(isActive ? (isAsc ? g.desc : g.asc) : g.desc)}
            />
          );
        })}
      </>
    );
    const mobileGroupPanel = (
      <>
        {(["date", "campaign", "status", "none"] as ApptGroupBy[]).map((opt) => (
          <MobileDrawerOption
            key={opt}
            label={t(GROUP_KEYS[opt])}
            selected={p.apptGroupBy === opt}
            onClick={() => p.setApptGroupBy(opt)}
          />
        ))}
      </>
    );
    return (
      <MobileListHeader
        title={t("title")}
        tabSwitcher={(
          <MobileTabSeg
            tabs={(["week", "month", "list"] as const).map((k) => ({ id: k, label: t(`views.${k}`) }))}
            activeId={p.viewMode}
            onChange={(id) => p.setViewMode(id as "week" | "month" | "list")}
          />
        )}
        searchValue={p.searchQuery}
        onSearchChange={p.setSearchQuery}
        searchPlaceholder={t("search.placeholder")}
        filterPanel={mobileFilterPanel}
        filterActive={p.apptFilterStatuses.length > 0}
        sortPanel={mobileSortPanel}
        sortActive={p.apptSortBy !== "time_desc"}
        groupPanel={mobileGroupPanel}
        groupActive={p.apptGroupBy !== "date"}
        leftActions={(
          <>
            {p.setShowAvailability && (
              <DrawerMainButton
                label={t("mobile.availability", "Availability")}
                icon={Clock}
                active={!!p.showAvailability}
                variant="solid"
                onClick={() => p.setShowAvailability!(!p.showAvailability)}
              />
            )}
            <DrawerMainButton
              label={t("mobile.weekends", "Weekends")}
              icon={CalendarDays}
              active={p.hideWeekends}
              variant="solid"
              onClick={() => p.setHideWeekends(!p.hideWeekends)}
            />
          </>
        )}
      />
    );
  }

  return (
    <div style={{ height: 60, flexShrink: 0, padding: "0 14px", background: "var(--surface)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 18 }}>
      <span style={{ ...SERIF, fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em" }}>{t("title")}</span>

      {/* Week / Month + collapse button immediately after */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {!p.ultra && (
          <div className="la-seg">
            {(["week", "month"] as const).map((k) => (
              <button key={k} onClick={() => p.setViewMode(k)} className={cn("la-seg-btn", k === p.viewMode && "on")}>
                {t(`views.${k}`)}
              </button>
            ))}
          </div>
        )}
        {p.onCyclePanel && (
          <button
            className="la-btn la-btn--soft la-btn--icon"
            onClick={p.onCyclePanel}
            title={p.leftPanelState === "full" ? t("design.panel.minimize") : p.leftPanelState === "compact" ? t("design.panel.hide") : t("design.panel.show")}
          >
            {p.leftPanelState === "hidden" ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        )}
        {/* Meetings-this-week KPI — always next to the fold button */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginLeft: 4 }}>
          <span style={{ ...SERIF, fontSize: 20, color: "var(--ink)", lineHeight: 1, letterSpacing: "-0.02em" }}>{meetingsThisWeek}</span>
          <span style={{ ...MONO, fontSize: 7.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute)" }}>{t("design.kpi.meetings")}</span>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Search / Filter / Sort / Group / New — top-right */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* Appointment actions (reschedule / cancel) — only with a selection */}
        {actionsMenu}

        {/* Calendar settings — availability overlay, business hours, hide weekends */}
        <CalendarSettingsPopover p={p} />

        {/* Search */}
        <div style={{ position: "relative" }}>
          <input
            className="neu-input"
            placeholder={t("search.placeholder")}
            value={p.searchQuery}
            onChange={e => p.setSearchQuery(e.target.value)}
            style={{ paddingLeft: 32, paddingTop: 0, paddingBottom: 0, height: 32, fontSize: 12, width: 190 }}
          />
          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--mute-2)", display: "flex", pointerEvents: "none" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          </span>
          {p.searchQuery && (
            <button onClick={() => p.setSearchQuery("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--mute-2)", display: "flex", padding: 0 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {filterMenu}
        {sortMenu}
        {groupMenu}
        {bookButton}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LEFT — status filter tabs + agenda list
// ════════════════════════════════════════════════════════════════════════════
function StatusTabs(p: DesktopCalendarProps) {
  const { t } = p;
  const counts = useMemo(() => ({
    all: p.appts.length,
    booked: p.appts.filter((a) => statusKeyOf(a) === "booked").length,
    noshow: p.appts.filter((a) => a.no_show).length,
    rescheduled: p.appts.filter((a) => statusKeyOf(a) === "rescheduled").length,
  }), [p.appts]);

  const active: "all" | "booked" | "noshow" | "rescheduled" =
    p.apptFilterStatuses.length === 0 ? "all"
    : p.apptFilterStatuses.length === 1
      ? (p.apptFilterStatuses[0] === "no_show" ? "noshow" : p.apptFilterStatuses[0] === "rescheduled" ? "rescheduled" : "booked")
      : "all";

  const set = (k: "all" | "booked" | "noshow" | "rescheduled") => {
    if (k === "all") p.setApptFilterStatuses([]);
    else if (k === "booked") p.setApptFilterStatuses(["confirmed"]);
    else if (k === "noshow") p.setApptFilterStatuses(["no_show"]);
    else p.setApptFilterStatuses(["rescheduled"]);
  };

  const tabs: [typeof active, string, number][] = [
    ["all", t("design.tabs.all"), counts.all],
    ["booked", t("design.tabs.booked"), counts.booked],
    ["noshow", t("design.tabs.noshow"), counts.noshow],
    ["rescheduled", t("design.tabs.rescheduled"), counts.rescheduled],
  ];

  return (
    <div style={{ height: HEADER_H, flexShrink: 0, padding: "0 10px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 3 }}>
      {tabs.map(([k, label, count]) => {
        const on = k === active;
        return (
          <button key={k} onClick={() => set(k)} style={{
            display: "flex", alignItems: "center", gap: 5, padding: "6px 8px", borderRadius: "var(--r-button)", border: "none", cursor: "pointer",
            background: on ? "var(--wine)" : "transparent", color: on ? "var(--paper)" : "var(--mute)",
            ...MONO, fontSize: 8.5, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: on ? 700 : 500, whiteSpace: "nowrap", transition: "color 120ms, background 120ms",
          }}>
            {label}
            <span style={{ ...MONO, fontSize: 8, fontWeight: 700, color: on ? "var(--paper)" : "var(--mute-2)", opacity: on ? 0.85 : 1 }}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function AgendaCard({ ev, active, onClick, t }: { ev: Appointment; active: boolean; onClick: () => void; t: TFunction }) {
  const sm = statusMetaOf(ev, t);
  const statusKey = ev.no_show ? "Lost" : (ev.status || "Contacted");
  const av = getLeadStatusAvatarColor(statusKey);
  const initials = ev.lead_name.split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
  const isMobile = useIsMobile(768);
  const avatarSize = isMobile ? 40 : 36;
  const nameFontSize = isMobile ? 15 : 13;
  const cardStyle: React.CSSProperties = isMobile
    ? {
        position: "relative", cursor: "pointer",
        borderRadius: "var(--list-card-radius-mobile)", padding: "11px 12px 11px 14px",
        background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)",
        borderLeft: active ? "3px solid var(--wine)" : "3px solid transparent",
        transition: "border-color 130ms", display: "flex", gap: 11, alignItems: "center",
      }
    : {
        position: "relative", cursor: "pointer", borderRadius: "var(--r-surface)", padding: "11px 12px 11px 14px",
        background: active ? "var(--card)" : "transparent", boxShadow: active ? "var(--sh-raised-crisp)" : "none",
        transition: "box-shadow 130ms, background 130ms", display: "flex", gap: 11, alignItems: "center",
      };
  return (
    <div onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onClick()} style={cardStyle}>
      {!isMobile && active && <div style={{ position: "absolute", left: 0, top: 11, bottom: 11, width: 3, background: "var(--wine)", borderRadius: "0 3px 3px 0" }} />}
      <div style={{ width: avatarSize, height: avatarSize, borderRadius: "var(--r-surface)", background: av.bg, color: av.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, flexShrink: 0, boxShadow: "var(--sh-raised-crisp)" }}>{initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: nameFontSize, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.lead_name}</div>
        {ev.campaign_name && <div style={{ fontSize: 10.5, color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{ev.campaign_name}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <span style={{ ...MONO, fontSize: 9.5, color: "var(--ink-soft)", display: "inline-flex", alignItems: "center", gap: 4 }}><Clock className="h-3 w-3" />{ev.time}</span>
          {sm.key !== "booked" && <span style={{ ...MONO, fontSize: 7.5, letterSpacing: "0.1em", textTransform: "uppercase", color: sm.color, background: sm.tint, borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>{sm.label}</span>}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
        <span style={{ color: "var(--mute-2)", display: "flex" }}>{channelOf(ev) === "phone" ? <Phone className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}</span>
        {ev.leadScore > 0 && <ScoreArcDonut score={ev.leadScore} />}
      </div>
    </div>
  );
}

function AgendaList(p: DesktopCalendarProps) {
  const { t } = p;
  if (!p.groupedAppts.length || p.groupedAppts.every((g) => g.items.length === 0)) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mute-2)", ...MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>{t("design.detail.noMeetings")}</div>;
  }
  return (
    <div ref={p.apptListRef} style={{ flex: 1, overflowY: "auto", padding: "6px 16px 16px" }}>
      {p.groupedAppts.map((g, gi) => (
        <div key={gi} data-group-wrapper style={{ marginBottom: 8 }}>
          {g.label && (
            <div data-group-header style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 2px 6px" }}>
              <span style={{ ...MONO, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-soft)", fontWeight: 700 }}>{g.label}</span>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
              <span style={{ ...MONO, fontSize: 9, color: "var(--mute-2)" }}>{g.items.length}</span>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {g.items.map((a) => (
              <div key={a.id} data-appt-id={a.id}>
                <AgendaCard ev={a} active={p.selectedBooking?.id === a.id} onClick={() => p.onSelectBooking(a)} t={t} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CENTER — week / month grid + header (with meetings-this-week KPI)
// ════════════════════════════════════════════════════════════════════════════
function CenterHeader(p: DesktopCalendarProps) {
  const { t } = p;
  const isMobile = useIsMobile(768);
  const weekKeys = useMemo(() => new Set(p.weekDays.map(dateKeyOf)), [p.weekDays]);
  const meetingsThisWeek = useMemo(() => p.appts.filter((a) => weekKeys.has(a.date)).length, [p.appts, weekKeys]);
  const activeMonth = p.month.getMonth();
  const flashDir = useSwipeFlash();

  // Today button: inset shadow when viewing the current week/month, plain raised when navigated away.
  const now = new Date();
  const onTodayView = p.viewMode === "month"
    ? (p.month.getMonth() === now.getMonth() && p.month.getFullYear() === now.getFullYear())
    : p.weekDays.some((d) => dateKeyOf(d) === p.todayStr);
  const todayBtnStyle: CSSProperties = onTodayView
    ? { boxShadow: "var(--sh-inset-crisp)" }
    : { boxShadow: "var(--sh-raised-crisp)" };

  const monthButtons = (
    <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 1, minWidth: 0, overflow: "hidden" }}>
      {MONTH_KEYS.map((mk, i) => {
        const on = i === activeMonth;
        return (
          <button
            key={mk}
            onClick={() => p.onSelectMonth(i)}
            style={{
              ...MONO, fontSize: 8.5, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 700,
              padding: "4px 6px", borderRadius: "var(--r-button)", cursor: "pointer", whiteSpace: "nowrap",
              background: on ? "var(--bg)" : "transparent",
              boxShadow: on ? "var(--sh-inset-super-crisp)" : "none",
              border: on ? "1px solid transparent" : "1px solid var(--line)",
              color: on ? "var(--wine)" : "var(--mute-2)",
            }}
          >
            {t(`months.short.${mk}`)}
          </button>
        );
      })}
    </div>
  );

  // Ultra-wide: date nav sits next to Today (left), week-only stepping, month buttons on right.
  if (p.ultra) {
    return (
      <div style={{ height: HEADER_H, flexShrink: 0, padding: "0 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 12 }}>
        <NavBtn onClick={() => p.onRefresh?.()} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></NavBtn>
        <button onClick={p.onToday} className="la-btn la-btn--soft" style={todayBtnStyle}>{t("navigation.today")}</button>
        <NavBtn onClick={() => p.onNavigateWeek(-1)} aria-label={t("navigation.previous")} forcePressed={flashDir === -1}><ChevronLeft className="h-5 w-5" /></NavBtn>
        <span style={{ ...SERIF, fontSize: 26, color: "var(--ink)", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{p.weekLabel}</span>
        <NavBtn onClick={() => p.onNavigateWeek(1)} aria-label={t("navigation.next")} forcePressed={flashDir === 1}><ChevronRight className="h-5 w-5" /></NavBtn>
        <div style={{ flex: 1 }} />
        {monthButtons}
      </div>
    );
  }

  // Mobile: single-row layout — [Today] ‹ Date › [KPI]
  if (isMobile) {
    return (
      <div style={{ flexShrink: 0, borderBottom: "1px solid var(--line)", padding: "8px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Today button — left edge */}
          <button onClick={p.onToday} className="la-btn la-btn--soft la-btn--sm" style={{ flexShrink: 0, ...todayBtnStyle }}>{t("navigation.today")}</button>
          {/* Prev arrow */}
          <NavBtn onClick={() => p.onNavigate(-1)} aria-label={t("navigation.previous")} style={{ flexShrink: 0 }} forcePressed={flashDir === -1}><ChevronLeft className="h-5 w-5" /></NavBtn>
          {/* Date label — centered, fills remaining space */}
          <span style={{ ...SERIF, fontSize: 19, color: "var(--ink)", letterSpacing: "-0.01em", textAlign: "center", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.viewLabel}</span>
          {/* Next arrow */}
          <NavBtn onClick={() => p.onNavigate(1)} aria-label={t("navigation.next")} style={{ flexShrink: 0 }} forcePressed={flashDir === 1}><ChevronRight className="h-5 w-5" /></NavBtn>
          {/* Meetings-this-week KPI — right edge: big number + 3-line stacked label */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <span style={{ ...SERIF, fontSize: 28, color: "var(--ink)", lineHeight: 1, letterSpacing: "-0.02em" }}>{meetingsThisWeek}</span>
            <span style={{ ...MONO, fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute)", lineHeight: 1.15, display: "flex", flexDirection: "column" }}>
              {t("design.kpi.meetings").split(" ").map((w, i) => <span key={i}>{w}</span>)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: HEADER_H, flexShrink: 0, padding: "0 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", gap: 16, position: "relative" }}>
      {/* Refresh + Today — left-anchored */}
      <div style={{ position: "absolute", left: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <NavBtn onClick={() => p.onRefresh?.()} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></NavBtn>
        <button onClick={p.onToday} className="la-btn la-btn--soft" style={todayBtnStyle}>{t("navigation.today")}</button>
      </div>
      <NavBtn onClick={() => p.onNavigate(-1)} aria-label={t("navigation.previous")} forcePressed={flashDir === -1}><ChevronLeft className="h-5 w-5" /></NavBtn>
      <span style={{ ...SERIF, fontSize: 28, color: "var(--ink)", letterSpacing: "-0.01em", minWidth: 200, textAlign: "center", whiteSpace: "nowrap" }}>{p.viewLabel}</span>
      <NavBtn onClick={() => p.onNavigate(1)} aria-label={t("navigation.next")} forcePressed={flashDir === 1}><ChevronRight className="h-5 w-5" /></NavBtn>
      {/* Month buttons — always visible, right-aligned in header */}
      <div style={{ position: "absolute", right: 14 }}>
        {monthButtons}
      </div>
    </div>
  );
}

function WeekEvent({ ev, dayIdx, nCols, active, onClick, t }: { ev: Appointment; dayIdx: number; nCols: number; active: boolean; onClick: (e: React.MouseEvent) => void; t: TFunction }) {
  const sm = statusMetaOf(ev, t);
  const startH = Math.min(Math.max(apptHm(ev), HOUR0), HOUR1);
  const topPct = ((startH - HOUR0) / SPAN) * 100;
  const hPct = Math.max(((ev.callDurationMinutes || 60) / 60 / SPAN) * 100, 1.5);
  const left = `calc(56px + (100% - 56px) * ${dayIdx} / ${nCols} + 3px)`;
  const width = `calc((100% - 56px) / ${nCols} - 6px)`;
  const faded = ev.no_show;
  // no-show events get a pale gold border instead of wine
  const borderColor = ev.no_show ? "var(--warn)" : "var(--wine-soft)";
  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute", top: `${topPct}%`, height: `${hPct}%`, left, width,
        background: active ? "var(--wine)" : "var(--card)", borderRadius: "var(--r-button)",
        borderLeft: `3px solid ${active ? "var(--wine-soft)" : borderColor}`,
        boxShadow: active ? "var(--sh-raised-medium)" : "var(--sh-raised-crisp)",
        padding: "5px 8px", transition: "box-shadow 120ms", opacity: faded ? 0.62 : 1,
        cursor: "pointer", overflow: "hidden",
      }}
      data-testid={`booking-card-${ev.id}`}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: active ? "var(--paper)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textDecoration: faded ? "line-through" : "none" }}>{ev.lead_name}</span>
      </div>
      {ev.campaign_name && <div style={{ fontSize: 9.5, color: active ? "rgba(255,250,240,0.82)" : "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{ev.campaign_name}</div>}
      <div style={{ ...MONO, fontSize: 8, color: active ? "rgba(255,250,240,0.7)" : "var(--mute-2)", marginTop: 2 }}>{ev.time}{sm.key !== "booked" ? ` · ${sm.label}` : ""}</div>
    </div>
  );
}

// Dims time outside business hours and shades connected-calendar busy intervals.
// The un-shaded area inside the business-hours band = bookable free windows.
function AvailabilityOverlay({ p, days, nCols }: { p: DesktopCalendarProps; days: Date[]; nCols: number }) {
  const availStart = Math.max(HOUR0, Math.min(p.availStart ?? 9, HOUR1));
  const availEnd = Math.max(availStart, Math.min(p.availEnd ?? 17, HOUR1));
  const pct = (h: number) => ((h - HOUR0) / SPAN) * 100;
  const colLeft = (di: number) => `calc(56px + (100% - 56px) * ${di} / ${nCols})`;
  const colWidth = `calc((100% - 56px) / ${nCols})`;

  // Bucket busy slots by local day key.
  const byDay = new Map<string, { s: number; e: number }[]>();
  for (const slot of p.busySlots ?? []) {
    const start = new Date(slot.start), end = new Date(slot.end);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;
    const key = dateKeyOf(start);
    const s = start.getHours() + start.getMinutes() / 60;
    const e = end.getHours() + end.getMinutes() / 60;
    const arr = byDay.get(key) ?? [];
    arr.push({ s, e });
    byDay.set(key, arr);
  }

  const stripeStyle = "repeating-linear-gradient(45deg, rgba(60,45,25,0.068), rgba(60,45,25,0.068) 4px, transparent 4px, transparent 14px)";
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
      {/* business-hours dim bands (before open / after close) — diagonal stripe */}
      {availStart > HOUR0 && (
        <div style={{ position: "absolute", top: 0, height: `${pct(availStart)}%`, left: 56, right: 0, background: stripeStyle }} />
      )}
      {availEnd < HOUR1 && (
        <div style={{ position: "absolute", top: `${pct(availEnd)}%`, bottom: 0, left: 56, right: 0, background: stripeStyle }} />
      )}
      {/* busy blocks per day */}
      {days.map((d, di) => {
        const slots = byDay.get(dateKeyOf(d)) ?? [];
        return slots.map((b, i) => {
          const s = Math.max(b.s, HOUR0), e = Math.min(b.e, HOUR1);
          if (e <= s) return null;
          return (
            <div key={`${di}-${i}`} title="Busy" style={{
              position: "absolute", top: `${pct(s)}%`, height: `${Math.max(pct(e) - pct(s), 1.2)}%`,
              left: `calc(${colLeft(di)} + 2px)`, width: `calc(${colWidth} - 4px)`,
              borderRadius: "var(--r-flush)",
              background: "repeating-linear-gradient(45deg, rgba(94,34,48,0.10), rgba(94,34,48,0.10) 5px, rgba(94,34,48,0.04) 5px, rgba(94,34,48,0.04) 10px)",
              border: "1px solid rgba(94,34,48,0.12)",
            }} />
          );
        });
      })}
    </div>
  );
}

function WeekGrid(p: DesktopCalendarProps) {
  const { t } = p;
  const days = useMemo(
    () => p.weekDays.filter((d) => !p.hideWeekends || !isWeekendDay(d)),
    [p.weekDays, p.hideWeekends],
  );
  const nCols = days.length || 1;
  const hours: number[] = [];
  for (let h = HOUR0; h <= HOUR1; h++) hours.push(h);
  const gridCols = `56px repeat(${nCols}, minmax(0, 1fr))`;
  const nowH = p.currentTime.getHours() + p.currentTime.getMinutes() / 60;
  const nowPct = nowH >= HOUR0 && nowH <= HOUR1 ? ((nowH - HOUR0) / SPAN) * 100 : null;
  const todayIdx = days.findIndex((d) => dateKeyOf(d) === p.todayStr);

  // On tall screens show from 7:30am; on shorter screens start exactly at 9am
  // so 5pm remains visible without scrolling.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const totalH = SPAN * PX_PER_HOUR;
    const startHour = el.clientHeight >= 800 ? 7.5 : 9;
    el.scrollTop = ((startHour - HOUR0) / SPAN) * totalH;
  }, []);

  // Drag-to-navigate (horizontal swipe on the grid — pointer events for desktop)
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);
  const onGridPointerDown = (e: React.PointerEvent) => { dragOrigin.current = { x: e.clientX, y: e.clientY }; };
  const onGridPointerUp = (e: React.PointerEvent) => {
    if (!dragOrigin.current) return;
    const dx = e.clientX - dragOrigin.current.x;
    const dy = e.clientY - dragOrigin.current.y;
    dragOrigin.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 80) { const dir = dx < 0 ? 1 : -1; emitCalSwipe(dir); p.onNavigate(dir); }
  };

  // Touch swipe — mobile only. pan-y lets the scroll container handle vertical
  // scroll; we only intercept a clearly horizontal gesture (dx > 50, dy < 60).
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) touchOrigin.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchOrigin.current) return;
    const t = e.changedTouches[0];
    if (!t) { touchOrigin.current = null; return; }
    const dx = t.clientX - touchOrigin.current.x;
    const dy = t.clientY - touchOrigin.current.y;
    touchOrigin.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 60) { const dir = dx < 0 ? 1 : -1; emitCalSwipe(dir); p.onNavigate(dir); }
  };

  return (
    <div
      style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--bg)", touchAction: "pan-y" }}
      onPointerDown={onGridPointerDown}
      onPointerUp={onGridPointerUp}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Day header row */}
      <div style={{ display: "grid", gridTemplateColumns: gridCols, borderBottom: "1px solid var(--line-strong)", flexShrink: 0 }}>
        <div />
        {days.map((d) => {
          const iso = dateKeyOf(d), isToday = iso === p.todayStr;
          return (
            <div key={iso} style={{ padding: "9px 6px 11px", textAlign: "center", borderLeft: "1px solid var(--line-strong)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {isToday ? (
                <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3, background: "var(--wine)", borderRadius: "var(--r-surface)", padding: "4px 8px" }}>
                  <div style={{ ...MONO, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--paper)", fontWeight: 700 }}>{t(`days.short.${DAY_KEYS[d.getDay()]}`)}</div>
                  <div style={{ ...SERIF, fontSize: 22, color: "var(--paper)", lineHeight: 1 }}>{d.getDate()}</div>
                </div>
              ) : (
                <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ ...MONO, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)", fontWeight: 700 }}>{t(`days.short.${DAY_KEYS[d.getDay()]}`)}</div>
                  <div style={{ ...SERIF, fontSize: 22, color: "var(--ink)", lineHeight: 1 }}>{d.getDate()}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scrollable body — starts at 9am, 83px per hour row */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ minHeight: `${SPAN * PX_PER_HOUR}px`, position: "relative" }}>
          {/* vertical separators + today tint */}
          <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: gridCols }}>
            <div />
            {days.map((d) => {
              const iso = dateKeyOf(d), isToday = iso === p.todayStr;
              return <div key={iso} style={{ borderLeft: "1px solid var(--line-strong)", background: isToday ? "rgba(94,34,48,0.04)" : "transparent" }} />;
            })}
          </div>
          {/* horizontal hour lines + half-hour dashed lines + gutter labels */}
          {hours.map((h, i) => {
            const pct = (i / SPAN) * 100;
            const halfPct = ((i + 0.5) / SPAN) * 100;
            return (
              <div key={h}>
                {i > 0 && <div style={{ position: "absolute", top: `${pct}%`, left: 56, right: 0, borderTop: "1px solid var(--line-strong)" }} />}
                {i < SPAN && <div style={{ position: "absolute", top: `${halfPct}%`, left: 56, right: 0, borderTop: "1px dashed var(--line-strong)", opacity: 0.5 }} />}
                <div style={{ position: "absolute", top: `calc(${pct}% - 7px)`, left: 0, width: 50, textAlign: "right", ...MONO, fontSize: 13, color: "var(--mute-2)" }}>{h <= 12 ? h : h - 12}{h < 12 ? "am" : "pm"}</div>
              </div>
            );
          })}
          {/* availability overlay: dim outside business hours + shade busy time */}
          {p.showAvailability && <AvailabilityOverlay p={p} days={days} nCols={nCols} />}
          {/* events */}
          {days.map((d, di) => {
            const iso = dateKeyOf(d);
            return (p.apptsByDate.get(iso) ?? []).map((e) => (
              <WeekEvent key={e.id} ev={e} dayIdx={di} nCols={nCols} active={p.selectedBooking?.id === e.id} onClick={(ev) => { ev.stopPropagation(); p.onSelectBooking(e); }} t={t} />
            ));
          })}
          {/* current-time line */}
          {nowPct != null && (
            <div style={{ position: "absolute", top: `${nowPct}%`, left: 56, right: 0, height: 0, borderTop: "1.5px solid var(--wine)", zIndex: 5, pointerEvents: "none" }}>
              <span style={{ position: "absolute", left: -4, top: -4, width: 8, height: 8, borderRadius: "50%", background: "var(--wine)", boxShadow: "0 0 0 3px rgba(94,34,48,0.18)" }} />
              {todayIdx >= 0 && <span style={{ position: "absolute", left: `calc(100% * ${todayIdx + 1} / ${nCols})`, top: -9, ...MONO, fontSize: 11, fontWeight: 700, color: "var(--paper)", background: "var(--wine)", borderRadius: 4, padding: "2px 6px", transform: "translateX(calc(-100% - 6px))" }}>{p.currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MonthGrid(p: DesktopCalendarProps) {
  const { t } = p;
  const m = p.month.getMonth();
  // Only highlight the *real* current week, and only while viewing the *current*
  // month — never the same week-row replicated across other months.
  const nowDate = new Date();
  const isCurrentMonth = p.month.getMonth() === nowDate.getMonth() && p.month.getFullYear() === nowDate.getFullYear();
  const visibleDows = DOW_ORDER.filter((dow) => !p.hideWeekends || (dow !== 0 && dow !== 6));
  const nCols = visibleDows.length;
  const colTemplate = `repeat(${nCols},1fr)`;
  const filterCell = (c: { date: Date }) => !p.hideWeekends || !isWeekendDay(c.date);
  const todayDow = new Date().getDay();

  const weeks: { date: Date; count: number }[][] = [];
  for (let i = 0; i < p.days.length; i += 7) weeks.push(p.days.slice(i, i + 7).filter(filterCell));

  // Touch swipe to navigate months on mobile
  const monthTouchOrigin = useRef<{ x: number; y: number } | null>(null);
  const onMonthTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) monthTouchOrigin.current = { x: touch.clientX, y: touch.clientY };
  };
  const onMonthTouchEnd = (e: React.TouchEvent) => {
    if (!monthTouchOrigin.current) return;
    const touch = e.changedTouches[0];
    if (!touch) { monthTouchOrigin.current = null; return; }
    const dx = touch.clientX - monthTouchOrigin.current.x;
    const dy = touch.clientY - monthTouchOrigin.current.y;
    monthTouchOrigin.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 60) { const dir = dx < 0 ? 1 : -1; emitCalSwipe(dir); p.onNavigate(dir); }
  };

  return (
    <div
      style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--surface)", touchAction: "pan-y" }}
      onTouchStart={onMonthTouchStart}
      onTouchEnd={onMonthTouchEnd}
    >
      {/* Weekday header — +4px font, bold today's column */}
      <div style={{ display: "grid", gridTemplateColumns: colTemplate, borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
        {visibleDows.map((dow, i) => {
          const isToday = dow === todayDow;
          return (
            <div key={dow} style={{ padding: "10px 0", textAlign: "center", ...MONO, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: isToday ? "var(--wine)" : "var(--mute-2)", fontWeight: 700, borderLeft: i ? "1px solid var(--line)" : "none" }}>{t(`days.short.${DAY_KEYS[dow]}`)}</div>
          );
        })}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((wk, wi) => {
          // Highlight only the week containing today, and only in the current month.
          const isCurrentWeek = isCurrentMonth && wk.some((c) => dateKeyOf(c.date) === p.todayStr);
          return (
          <div key={wi} style={{ display: "grid", gridTemplateColumns: colTemplate, borderTop: isCurrentWeek ? "1px solid var(--wine)" : "1px solid transparent", borderBottom: isCurrentWeek ? "1px solid var(--wine)" : "1px solid transparent", background: isCurrentWeek ? "transparent" : "rgba(60,45,25,0.02)" }}>
            {wk.map((cell, di) => {
              const iso = dateKeyOf(cell.date), inMonth = cell.date.getMonth() === m, isToday = iso === p.todayStr;
              const items = p.apptsByDate.get(iso) ?? [];
              return (
                <div
                  key={iso}
                  role="button"
                  tabIndex={0}
                  aria-label={t("selectDate", { date: iso })}
                  style={{ borderLeft: di ? "1px solid var(--line)" : "none", padding: "7px 8px", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 3, background: isToday ? "rgba(94,34,48,0.03)" : "transparent", opacity: inMonth ? 1 : 0.38 }}
                >
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 24, height: 24, borderRadius: "var(--r-button)", ...SERIF, fontSize: 18, fontWeight: isToday ? 700 : 400, color: isToday ? "var(--paper)" : "var(--ink-soft)", background: isToday ? "var(--wine)" : "transparent" }}>{cell.date.getDate()}</span>
                  </div>
                  {items.slice(0, 4).map((e) => {
                    const active = p.selectedBooking?.id === e.id;
                    // No-show events use a pale gold dot; normal uses wine
                    const dotColor = e.no_show ? "var(--warn)" : active ? "var(--paper)" : "var(--wine)";
                    return (
                      <div key={e.id} onClick={(ev) => { ev.stopPropagation(); p.onSelectBooking(e); }} style={{
                        cursor: "pointer", borderRadius: "var(--r-flush)", padding: "3px 7px", display: "flex", alignItems: "center", gap: 6,
                        background: active ? "var(--wine)" : "var(--card)", boxShadow: "var(--sh-raised-crisp)",
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 10.5, color: active ? "var(--paper)" : "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.time.replace(/:00/, "")} {e.lead_name.split(" ")[0]}</span>
                      </div>
                    );
                  })}
                  {items.length > 4 && <span style={{ ...MONO, fontSize: 8.5, color: "var(--mute-2)", paddingLeft: 7 }}>{t("appointment.more", { count: items.length - 4 })}</span>}
                </div>
              );
            })}
          </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// RIGHT — meeting detail
// ════════════════════════════════════════════════════════════════════════════
function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ ...MONO, fontSize: 8.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}><span style={{ color: "var(--mute)", display: "flex" }}>{icon}</span>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)", overflowWrap: "anywhere", wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

// Reschedule popover (inline mini date/time form)
function ReschedulePopover({ ev, onReschedule, t, trigger }: { ev: Appointment; onReschedule: (id: number, d: Date) => Promise<void>; t: TFunction; trigger: React.ReactNode }) {
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

// Leads-chat conversation thread — reuses the Leads card-view rendering pipeline
// (computeMiniMsgMeta + groupMiniMessagesByThread + run wrappers). The wrappers
// internally render MiniChatBubble, which has the `content || Content` fallback
// that fixes the previously-blank message text.
function ConversationThread({ msgs, leadName, leadAvatarColors }: {
  msgs: Interaction[];
  leadName: string;
  leadAvatarColors: { bgColor: string; textColor: string };
}) {
  const session = useSession();
  const currentUser = session.status === "authenticated" ? session.user : null;

  const items = useMemo(() => {
    if (msgs.length === 0) return [];
    const all = msgs as any[];
    const metas = computeMiniMsgMeta(all);
    const idxOf = new Map<any, number>();
    all.forEach((mm, i) => idxOf.set(mm, i));

    const senderOf = (mm: any): "inbound" | "ai" | "human" =>
      String(mm.direction || "").toLowerCase() !== "outbound" ? "inbound" : isAiMsg(mm) ? "ai" : "human";

    const out: React.ReactNode[] = [];
    const groups = groupMiniMessagesByThread(all);
    for (const group of groups) {
      const gmsgs = group.msgs;
      let i = 0;
      while (i < gmsgs.length) {
        const sk = senderOf(gmsgs[i]);
        const runMsgs: any[] = [];
        const runMetas: MiniMsgMeta[] = [];
        const startIdx = idxOf.get(gmsgs[i]) ?? i;
        while (i < gmsgs.length && senderOf(gmsgs[i]) === sk) {
          runMsgs.push(gmsgs[i]);
          runMetas.push(metas[idxOf.get(gmsgs[i]) ?? 0]);
          i++;
        }
        if (sk === "human") {
          out.push(<MiniAgentRunWrapper key={`h-${startIdx}`} msgs={runMsgs} metas={runMetas} leadName={leadName} leadAvatarColors={leadAvatarColors} currentUser={currentUser} />);
        } else if (sk === "inbound") {
          out.push(<MiniLeadRunWrapper key={`l-${startIdx}`} msgs={runMsgs} metas={runMetas} leadName={leadName} leadAvatarColors={leadAvatarColors} />);
        } else {
          out.push(<MiniBotRunWrapper key={`b-${startIdx}`} msgs={runMsgs} metas={runMetas} leadName={leadName} leadAvatarColors={leadAvatarColors} />);
        }
      }
    }
    return out;
  }, [msgs, leadName, leadAvatarColors, currentUser]);

  return <div className="flex flex-col">{items}</div>;
}

function DetailPanel(p: DesktopCalendarProps) {
  const { t } = p;
  const ev = p.selectedBooking;
  if (!ev) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mute-2)", ...MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>{t("design.detail.selectMeeting")}</div>;
  }

  // Reuse the pipeline lead panel for the full lead view (same as the Leads
  // pipeline). Falls back to the calendar-specific layout if no lead is linked.
  if (ev.rawLead) {
    return (
      <PipelineLeadPanel
        lead={ev.rawLead}
        onRefresh={p.onRefresh}
        accountTimezone={ev.timezone}
        onClose={() => p.onSelectBooking(null)}
      />
    );
  }

  const sm = statusMetaOf(ev, t);
  const av = getLeadStatusAvatarColor(ev.no_show ? "Lost" : (ev.status || "Contacted"));
  const aiSummaryRaw = ev.rawLead?.ai_summary ?? ev.rawLead?.aiSummary ?? null;
  const summary = parseAiSummary(aiSummaryRaw);

  return (
    <>
      <div style={{ height: HEADER_H, flexShrink: 0, padding: "0 10px 0 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {/* Identity — avatar + name, opens the Leads page on click */}
        <button
          onClick={p.onOpenInLead}
          title={t("design.detail.openInLead")}
          style={{ display: "flex", gap: 11, alignItems: "center", flex: 1, minWidth: 0, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
        >
          <div style={{ width: 38, height: 38, borderRadius: "var(--r-surface)", background: av.bg, color: av.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, flexShrink: 0, boxShadow: "var(--sh-raised-crisp)" }}>{ev.lead_name.split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...SERIF, fontSize: 18, color: "var(--ink)", lineHeight: 1.15, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.lead_name}</div>
            {ev.campaign_name && <div style={{ fontSize: 11, color: "var(--mute)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.campaign_name}</div>}
          </div>
        </button>
        {p.showClose && (
          <NavBtn onClick={() => p.onSelectBooking(null)} style={{ flexShrink: 0 }} title={t("design.detail.close")} aria-label={t("design.detail.close")}><X className="h-3.5 w-3.5" /></NavBtn>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* status banner */}
        {sm.key !== "booked" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: "var(--r-surface)", background: sm.tint, border: `1px solid ${sm.color}33` }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: sm.color }} />
            <span style={{ ...MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: sm.color, fontWeight: 700 }}>{sm.label}</span>
          </div>
        )}

        {/* facts — white raised panel */}
        <div style={{ background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", borderRadius: "var(--r-card)", padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 12, rowGap: 14 }}>
          <Fact icon={<CalIcon className="h-3.5 w-3.5" />} label={t("design.detail.date")} value={ev.formattedDate} />
          <Fact icon={channelOf(ev) === "phone" ? <Phone className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />} label={t("design.detail.channel")} value={channelOf(ev) === "phone" ? t("design.detail.phone") : t("design.detail.googleMeet")} />
          <Fact icon={<Clock className="h-3.5 w-3.5" />} label={t("design.detail.time")} value={`${ev.time} – ${endClockOf(ev)}`} />
          <Fact icon={<Phone className="h-3.5 w-3.5" />} label={t("design.detail.phone")} value={ev.phone || "—"} />
          <Fact icon={<Mail className="h-3.5 w-3.5" />} label={t("design.detail.email")} value={ev.email || "—"} />
          {/* Lead score replaces fake attendance */}
          <div>
            <div style={{ ...MONO, fontSize: 8.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 5 }}>{t("design.detail.leadScore")}</div>
            {ev.leadScore > 0 ? (
              <ScoreArcDonut score={ev.leadScore} />
            ) : (
              <span style={{ fontSize: 12, color: "var(--mute-2)" }}>—</span>
            )}
          </div>
        </div>

        {/* AI summary — real data, JSON sections or plain text fallback */}
        {summary && (
          <div>
            <div style={{ ...MONO, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--wine)", fontWeight: 700, marginBottom: 9 }}>{t("design.detail.aiSummary")}</div>
            {typeof summary === "string" ? (
              <AiSummaryView text={summary} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {summary.map((sec) => (
                  <div key={sec.key} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1, background: "var(--wine-tint)", color: "var(--wine)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {SUMMARY_ICONS[sec.key as SummaryKey] ?? <Info className="h-3 w-3" />}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ ...MONO, fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute)", fontWeight: 700, marginBottom: 2 }}>
                        {t(`design.detail.summary.${sec.key}`, { defaultValue: sec.key })}
                      </div>
                      <span style={{ fontSize: 12, lineHeight: 1.5, color: "var(--ink-soft)" }}>{sec.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Full conversation thread — admin/owner only */}
        {p.canSeeConversation && p.recentMessages.length > 0 && (
          <div>
            <div style={{ marginBottom: 9 }}>
              <span style={{ ...MONO, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--mute)", fontWeight: 700 }}>{t("design.detail.conversation")}</span>
            </div>
            <ConversationThread
              msgs={p.recentMessages}
              leadName={ev.lead_name}
              leadAvatarColors={{ bgColor: av.bg, textColor: av.text }}
            />
          </div>
        )}
      </div>
    </>
  );
}

// ── Compact agenda (minimized panel — avatars only) ──────────────────────────
function CompactAgendaList(p: DesktopCalendarProps) {
  const items = useMemo(() => p.groupedAppts.flatMap((g) => g.items), [p.groupedAppts]);
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "8px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
      {items.map((a) => {
        const av = getLeadStatusAvatarColor(a.no_show ? "Lost" : (a.status || "Contacted"));
        const initials = a.lead_name.split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
        const active = p.selectedBooking?.id === a.id;
        return (
          <button
            key={a.id}
            onClick={() => p.onSelectBooking(a)}
            title={`${a.lead_name} · ${a.time}`}
            style={{
              width: 40, height: 40, borderRadius: "var(--r-surface)", border: "none", cursor: "pointer",
              background: av.bg, color: av.text, display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, flexShrink: 0,
              boxShadow: active ? "var(--sh-raised-medium)" : "var(--sh-raised-crisp)",
              outline: active ? "2px solid var(--wine)" : "none", outlineOffset: 1,
            }}
          >
            {initials}
          </button>
        );
      })}
    </div>
  );
}

// ── Ultra-wide split: week (left) + draggable divider + month (right, darker) ──
function WeekMonthSplit(p: DesktopCalendarProps) {
  const [frac, setFrac] = usePersistedState<number>(
    "calendar-week-month-split",
    0.5,
    (v) => typeof v === "number" && v >= 0 && v <= 1,
  );
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromX = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    let f = (clientX - rect.left) / rect.width;
    if (f < 0.08) f = 0;
    else if (f > 0.92) f = 1;
    else f = Math.max(0, Math.min(1, f));
    setFrac(f);
  };

  return (
    <div ref={ref} style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
      {/* Week side */}
      <div style={{ width: `${frac * 100}%`, minWidth: 0, display: frac === 0 ? "none" : "flex", flexDirection: "column", minHeight: 0 }}>
        <WeekGrid {...p} />
      </div>
      {/* Draggable divider — 8px gap with a short centered handle; collapses a side */}
      <div
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (dragging.current) updateFromX(e.clientX); }}
        onPointerUp={(e) => { dragging.current = false; try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} }}
        style={{ width: 8, flexShrink: 0, cursor: "col-resize", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", touchAction: "none" }}
        role="separator"
        aria-orientation="vertical"
      >
        <div style={{ width: 3, height: 50, borderRadius: 2, background: "var(--line-strong)" }} />
      </div>
      {/* Month side — lighter surface to distinguish from week side */}
      <div style={{ flex: 1, minWidth: 0, display: frac === 1 ? "none" : "flex", flexDirection: "column", minHeight: 0, background: "var(--surface)" }}>
        <MonthGrid {...p} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Composition
// ════════════════════════════════════════════════════════════════════════════
const DETAIL_W = 372;

export function DesktopCalendar(p: DesktopCalendarProps) {
  const { state: leftPanelState, cycle } = useListPanelState();
  const isMobile = useIsMobile(1024);

  const rootRef = useRef<HTMLDivElement>(null);
  const [rootWidth, setRootWidth] = useState(0);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setRootWidth(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The agenda rail and the cycle-panel toggle don't make sense on a phone —
  // mobile always gets the full-width week/month grid with detail in a bottom sheet.
  const effectiveLeftPanelState: ListPanelState = isMobile ? "hidden" : leftPanelState;
  const leftWidth = effectiveLeftPanelState === "hidden" ? 0 : effectiveLeftPanelState === "compact" ? 64 : 318;
  const ultra = rootWidth >= 1700;

  return (
    <div ref={rootRef} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)" }} data-testid="calendar-desktop">
      <TopToolbar {...p} leftPanelState={effectiveLeftPanelState} onCyclePanel={isMobile ? undefined : cycle} ultra={ultra} />
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 0, padding: 0, overflow: "hidden", position: "relative" }}>
        {/* LEFT — agenda (full | minimized | hidden); never shown on mobile */}
        {effectiveLeftPanelState !== "hidden" && (
          <div style={{ ...CARD_STYLE, width: leftWidth, flexShrink: 0, background: "hsl(var(--panel-list-bg))", borderRadius: 0, borderRight: "1px solid var(--line)" }}>
            {effectiveLeftPanelState === "compact" ? (
              <CompactAgendaList {...p} />
            ) : (
              <>
                <StatusTabs {...p} />
                <AgendaList {...p} />
              </>
            )}
          </div>
        )}
        {/* CENTER — calendar. Ultra-wide: week + month split */}
        <div style={{ ...CARD_STYLE, flex: 1, minWidth: 0, background: "var(--bg)", borderRadius: 0, display: "flex", flexDirection: "column" }}>
          {p.viewMode === "list" && isMobile ? (
            // List view (mobile only — desktop already has the agenda in its left
            // panel). Full-height agenda of all appointments grouped by date, no
            // week-nav header (the list isn't week-scoped).
            <AgendaList {...p} />
          ) : (
            <>
              <CenterHeader {...p} ultra={ultra} />
              {/* Chart area — inset with rounded corners and breathing room */}
              <div style={{ flex: 1, minHeight: 0, margin: 8, borderRadius: "var(--r-surface)", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
                {ultra
                  ? <WeekMonthSplit {...p} />
                  : p.viewMode === "week" ? <WeekGrid {...p} /> : <MonthGrid {...p} />}
                {/* Overlay so inset shadow renders on top of child backgrounds */}
                <div style={{ position: "absolute", inset: 0, borderRadius: "var(--r-surface)", boxShadow: "var(--sh-inset-crisp)", pointerEvents: "none", zIndex: 20 }} />
              </div>
            </>
          )}
        </div>
        {/* RIGHT — detail: floating slide-over, desktop/tablet only (mobile uses the bottom sheet below) */}
        {!isMobile && p.selectedBooking && (
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: Math.min(DETAIL_W, Math.max(280, rootWidth - leftWidth - 24)), maxWidth: "92%", display: "flex", flexDirection: "column", background: "var(--bg)", borderLeft: "1px solid var(--line)", boxShadow: "-12px 0 40px rgba(60,45,25,0.18)", zIndex: 30 }}>
            <DetailPanel {...p} showClose />
          </div>
        )}
      </div>

      {/* Mobile detail — bottom sheet rising over the grid, drag down to close */}
      <MobileSheet open={!!p.selectedBooking} onClose={() => p.onSelectBooking(null)} data-testid="mobile-calendar-detail-sheet">
        {p.selectedBooking && <DetailPanel {...p} showClose />}
      </MobileSheet>
    </div>
  );
}
