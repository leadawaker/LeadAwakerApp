// DesktopCalendar.tsx — wine/neumorphic Calendar at all breakpoints.
// Full-width top toolbar + three floating panels (agenda · week/month grid · detail).
// Fabricated metrics removed; real lead score, AI summary, and full conversation shown.
import { useMemo, useState, useRef, useEffect, type CSSProperties } from "react";
import type { TFunction } from "i18next";
import {
  ChevronLeft, ChevronRight, Maximize2, Clock, Video, Phone, Check,
  Calendar as CalIcon, Filter, ArrowUpDown, ArrowUp, ArrowDown, Layers, Plus,
  PanelLeft, PanelLeftClose, X, MoreVertical, RefreshCw, XCircle,
  Info, AlertCircle, Target, ShieldQuestion, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useListPanelState, type ListPanelState } from "@/hooks/useListPanelState";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { getLeadStatusAvatarColor } from "@/lib/avatarUtils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import type { Interaction } from "@/features/conversations/hooks/useConversationsData";
import {
  type Appointment, CARD_STYLE, HEADER_H, HOUR0, HOUR1, SPAN,
  statusMetaOf, statusKeyOf, channelOf, apptHm, endClockOf, dateKeyOf,
} from "../lib/calendarDesign";
import { ScoreArcDonut } from "@/features/leads/components/cardView/atoms";
import { BookAppointmentPopover } from "./BookAppointmentPopover";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

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
  background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", display: "flex",
  alignItems: "center", justifyContent: "center", color: "var(--mute)",
};
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
  viewMode: "week" | "month";
  setViewMode: (v: "week" | "month") => void;
  onNavigate: (dir: number) => void;
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
}

// Toolbar dropdown trigger (wine soft icon button)
function toolBtnClass(active: boolean) {
  return cn("la-btn la-btn--soft la-btn--icon", active && "!text-[var(--wine)]");
}

// ════════════════════════════════════════════════════════════════════════════
// Top toolbar (title · view toggle · collapse button · search/sort/filter/group/new)
// ════════════════════════════════════════════════════════════════════════════
function TopToolbar(p: DesktopCalendarProps) {
  const { t } = p;

  return (
    <div style={{ height: 60, flexShrink: 0, padding: "0 14px", background: "var(--surface)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 18 }}>
      <span style={{ ...SERIF, fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em" }}>{t("title")}</span>

      {/* Week / Month + collapse button immediately after */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="la-seg">
          {(["week", "month"] as const).map((k) => (
            <button key={k} onClick={() => p.setViewMode(k)} className={cn("la-seg-btn", k === p.viewMode && "on")}>
              {t(`views.${k}`)}
            </button>
          ))}
        </div>
        {p.onCyclePanel && (
          <button
            className="la-btn la-btn--soft la-btn--icon"
            onClick={p.onCyclePanel}
            title={p.leftPanelState === "full" ? t("design.panel.minimize") : p.leftPanelState === "compact" ? t("design.panel.hide") : t("design.panel.show")}
          >
            {p.leftPanelState === "hidden" ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Search / Filter / Sort / Group / New — top-right */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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

        <BookAppointmentPopover
          leads={p.leads}
          refetchLeads={p.refetchLeads}
          trigger={<button className="la-btn la-btn--soft la-btn--icon" title={t("book.newAppointment")}><Plus className="h-4 w-4" /></button>}
        />
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
  return (
    <div onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onClick()} style={{
      position: "relative", cursor: "pointer", borderRadius: "var(--r-surface)", padding: "11px 12px 11px 14px",
      background: active ? "var(--card)" : "transparent", boxShadow: active ? "var(--sh-raised-crisp)" : "none",
      transition: "box-shadow 130ms, background 130ms", display: "flex", gap: 11, alignItems: "center",
    }}>
      {active && <div style={{ position: "absolute", left: 0, top: 11, bottom: 11, width: 3, background: "var(--wine)", borderRadius: "0 3px 3px 0" }} />}
      <div style={{ width: 36, height: 36, borderRadius: "var(--r-surface)", background: av.bg, color: av.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.lead_name}</div>
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
    <div ref={p.apptListRef} style={{ flex: 1, overflowY: "auto", padding: "6px 9px 16px" }}>
      {p.groupedAppts.map((g, gi) => (
        <div key={gi} data-group-wrapper style={{ marginBottom: 4 }}>
          {g.label && (
            <div data-group-header style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 6px 5px" }}>
              <span style={{ ...MONO, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-soft)", fontWeight: 700 }}>{g.label}</span>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
              <span style={{ ...MONO, fontSize: 9, color: "var(--mute-2)" }}>{g.items.length}</span>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
  const weekKeys = useMemo(() => new Set(p.weekDays.map(dateKeyOf)), [p.weekDays]);
  const meetingsThisWeek = useMemo(() => p.appts.filter((a) => weekKeys.has(a.date)).length, [p.appts, weekKeys]);

  return (
    <div style={{ height: HEADER_H, flexShrink: 0, padding: "0 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", gap: 16, position: "relative" }}>
      <button onClick={p.onToday} className="la-btn la-btn--soft" style={{ position: "absolute", left: 14 }}>{t("navigation.today")}</button>
      <button onClick={() => p.onNavigate(-1)} style={NAV_BTN} aria-label={t("navigation.previous")}><ChevronLeft className="h-4 w-4" /></button>
      <span style={{ ...SERIF, fontSize: 24, color: "var(--ink)", letterSpacing: "-0.01em", minWidth: 200, textAlign: "center", whiteSpace: "nowrap" }}>{p.viewLabel}</span>
      <button onClick={() => p.onNavigate(1)} style={NAV_BTN} aria-label={t("navigation.next")}><ChevronRight className="h-4 w-4" /></button>
      {/* Meetings this week — right-aligned in header */}
      <div style={{ position: "absolute", right: 14, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <span style={{ ...SERIF, fontSize: 22, color: "var(--ink)", lineHeight: 1, letterSpacing: "-0.02em" }}>{meetingsThisWeek}</span>
        <span style={{ ...MONO, fontSize: 7.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute)", lineHeight: 1.3 }}>{t("design.kpi.meetings")}</span>
      </div>
    </div>
  );
}

function WeekEvent({ ev, dayIdx, active, onClick, t }: { ev: Appointment; dayIdx: number; active: boolean; onClick: (e: React.MouseEvent) => void; t: TFunction }) {
  const sm = statusMetaOf(ev, t);
  const startH = Math.min(Math.max(apptHm(ev), HOUR0), HOUR1);
  const topPct = ((startH - HOUR0) / SPAN) * 100;
  const hPct = Math.max(((ev.callDurationMinutes || 60) / 60 / SPAN) * 100, 4.2);
  const left = `calc(56px + (100% - 56px) * ${dayIdx} / 7 + 3px)`;
  const width = `calc((100% - 56px) / 7 - 6px)`;
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

function WeekGrid(p: DesktopCalendarProps) {
  const { t } = p;
  const hours: number[] = [];
  for (let h = HOUR0; h <= HOUR1; h++) hours.push(h);
  const gridCols = "56px repeat(7, minmax(0, 1fr))";
  const nowH = p.currentTime.getHours() + p.currentTime.getMinutes() / 60;
  const nowPct = nowH >= HOUR0 && nowH <= HOUR1 ? ((nowH - HOUR0) / SPAN) * 100 : null;
  const todayIdx = p.weekDays.findIndex((d) => dateKeyOf(d) === p.todayStr);

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Day header row */}
      <div style={{ display: "grid", gridTemplateColumns: gridCols, borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
        <div />
        {p.weekDays.map((d) => {
          const iso = dateKeyOf(d), isToday = iso === p.todayStr;
          return (
            <div key={iso} style={{ padding: "9px 6px 11px", textAlign: "center", borderLeft: "1px solid var(--line)" }}>
              <div style={{ ...MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: isToday ? "var(--wine)" : "var(--mute-2)", fontWeight: 700 }}>{t(`days.short.${DAY_KEYS[d.getDay()]}`)}</div>
              <div style={{ marginTop: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 30, height: 30, borderRadius: "var(--r-button)", ...SERIF, fontSize: 18, color: isToday ? "var(--paper)" : "var(--ink)", background: isToday ? "var(--wine)" : "transparent", boxShadow: isToday ? "var(--sh-raised-crisp)" : "none" }}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>

      {/* Body — % positioned events */}
      <div style={{ flex: 1, position: "relative", minHeight: 0, overflow: "hidden" }}>
        {/* vertical separators + today tint */}
        <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: gridCols }}>
          <div />
          {p.weekDays.map((d) => {
            const iso = dateKeyOf(d), isToday = iso === p.todayStr;
            return <div key={iso} style={{ borderLeft: "1px solid var(--line)", background: isToday ? "rgba(94,34,48,0.022)" : "transparent" }} />;
          })}
        </div>
        {/* horizontal hour lines + gutter labels */}
        {hours.map((h, i) => {
          const pct = (i / SPAN) * 100;
          return (
            <div key={h}>
              {i > 0 && <div style={{ position: "absolute", top: `${pct}%`, left: 56, right: 0, borderTop: "1px solid var(--line)" }} />}
              <div style={{ position: "absolute", top: `calc(${pct}% - 6px)`, left: 0, width: 50, textAlign: "right", ...MONO, fontSize: 8.5, color: "var(--mute-2)" }}>{h <= 12 ? h : h - 12}{h < 12 ? "a" : "p"}</div>
            </div>
          );
        })}
        {/* events */}
        {p.weekDays.map((d, di) => {
          const iso = dateKeyOf(d);
          return (p.apptsByDate.get(iso) ?? []).map((e) => (
            <WeekEvent key={e.id} ev={e} dayIdx={di} active={p.selectedBooking?.id === e.id} onClick={(ev) => { ev.stopPropagation(); p.onSelectBooking(e); }} t={t} />
          ));
        })}
        {/* current-time line */}
        {nowPct != null && (
          <div style={{ position: "absolute", top: `${nowPct}%`, left: 56, right: 0, height: 0, borderTop: "1.5px solid var(--wine)", zIndex: 5, pointerEvents: "none" }}>
            <span style={{ position: "absolute", left: -4, top: -4, width: 8, height: 8, borderRadius: "50%", background: "var(--wine)", boxShadow: "0 0 0 3px rgba(94,34,48,0.18)" }} />
            {todayIdx >= 0 && <span style={{ position: "absolute", left: `calc((100% - 0px) * ${todayIdx} / 7)`, top: -7, ...MONO, fontSize: 8, fontWeight: 700, color: "var(--paper)", background: "var(--wine)", borderRadius: 4, padding: "1px 5px", transform: "translateX(6px)" }}>{p.currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function MonthGrid(p: DesktopCalendarProps) {
  const { t } = p;
  const m = p.month.getMonth();
  const weeks: { date: Date; count: number }[][] = [];
  for (let i = 0; i < p.days.length; i += 7) weeks.push(p.days.slice(i, i + 7));

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
        {DAY_KEYS.map((dk, i) => (
          <div key={dk} style={{ padding: "10px 0", textAlign: "center", ...MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)", fontWeight: 700, borderLeft: i ? "1px solid var(--line)" : "none" }}>{t(`days.short.${dk}`)}</div>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((wk, wi) => (
          <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: wi < weeks.length - 1 ? "1px solid var(--line)" : "none" }}>
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
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 24, height: 24, borderRadius: "var(--r-button)", ...SERIF, fontSize: 14, fontWeight: isToday ? 700 : 400, color: isToday ? "var(--paper)" : "var(--ink-soft)", background: isToday ? "var(--wine)" : "transparent" }}>{cell.date.getDate()}</span>
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
        ))}
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
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)" }}>{value}</div>
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

function DetailPanel(p: DesktopCalendarProps) {
  const { t } = p;
  const ev = p.selectedBooking;
  if (!ev) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mute-2)", ...MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>{t("design.detail.selectMeeting")}</div>;
  }
  const sm = statusMetaOf(ev, t);
  const av = getLeadStatusAvatarColor(ev.no_show ? "Lost" : (ev.status || "Contacted"));
  const aiSummaryRaw = ev.rawLead?.ai_summary ?? ev.rawLead?.aiSummary ?? null;
  const summary = parseAiSummary(aiSummaryRaw);

  return (
    <>
      <div style={{ height: HEADER_H, flexShrink: 0, padding: "0 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {/* Kebab menu: reschedule + cancel */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button style={NAV_BTN} title="More actions"><MoreVertical className="h-3.5 w-3.5" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {/* Reschedule — uses its own popover, so we close the dropdown and open it */}
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-[12px] p-0"
              >
                <ReschedulePopover
                  ev={ev}
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
                onSelect={() => p.onCancelCall(ev.id)}
                className="text-[12px] flex items-center gap-2 text-destructive focus:text-destructive"
              >
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                {t("design.detail.cancelCall")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => { const leadId = ev.rawLead?.id ?? ev.rawLead?.Id; if (leadId) { try { localStorage.setItem("selected-lead-id", String(leadId)); localStorage.setItem("leadawaker-returnto", "/platform/calendar"); } catch {} window.location.href = "/platform/contacts"; } }} style={NAV_BTN} title={t("design.detail.openInLead")}><Maximize2 className="h-3.5 w-3.5" /></button>
          {p.showClose && (
            <button onClick={() => p.onSelectBooking(null)} style={NAV_BTN} title={t("design.detail.close")} aria-label={t("design.detail.close")}><X className="h-3.5 w-3.5" /></button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* identity */}
        <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "var(--r-surface)", background: av.bg, color: av.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{ev.lead_name.split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...SERIF, fontSize: 23, color: "var(--ink)", lineHeight: 1.1, letterSpacing: "-0.01em" }}>{ev.lead_name}</div>
            {ev.campaign_name && <div style={{ fontSize: 12, color: "var(--mute)", marginTop: 2 }}>{ev.campaign_name}</div>}
          </div>
        </div>

        {/* status banner */}
        {sm.key !== "booked" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: "var(--r-surface)", background: sm.tint, border: `1px solid ${sm.color}33` }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: sm.color }} />
            <span style={{ ...MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: sm.color, fontWeight: 700 }}>{sm.label}</span>
          </div>
        )}

        {/* facts */}
        <div style={{ background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", borderRadius: "var(--r-card)", padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 12, rowGap: 14 }}>
          <Fact icon={<CalIcon className="h-3.5 w-3.5" />} label={t("design.detail.date")} value={ev.formattedDate} />
          <Fact icon={channelOf(ev) === "phone" ? <Phone className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />} label={t("design.detail.channel")} value={channelOf(ev) === "phone" ? t("design.detail.phone") : t("design.detail.googleMeet")} />
          <Fact icon={<Clock className="h-3.5 w-3.5" />} label={t("design.detail.time")} value={`${ev.time} – ${endClockOf(ev)}`} />
          {/* Lead score replaces fake attendance */}
          <div>
            <div style={{ ...MONO, fontSize: 8.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 5 }}>{t("design.detail.leadScore")}</div>
            {ev.leadScore > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ScoreArcDonut score={ev.leadScore} />
                <span style={{ ...MONO, fontSize: 10, color: "var(--ink-soft)" }}>{ev.leadScore}</span>
              </div>
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
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-soft)" }}>{summary}</p>
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
              <span style={{ ...MONO, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--mute)", fontWeight: 700 }}>{t("design.detail.conversation")}</span>
              <button onClick={p.onOpenInLead} style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, ...MONO, fontSize: 8.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--wine)", fontWeight: 700 }}>{t("design.detail.openInLead")}<ChevronRight className="h-2.5 w-2.5" /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {p.recentMessages.map((m, i) => {
                const isIn = (m.direction || "").toLowerCase() === "inbound";
                return (
                  <div key={i} style={{
                    alignSelf: isIn ? "flex-start" : "flex-end", maxWidth: "88%",
                    background: isIn ? "var(--surface)" : "var(--wine-tint)",
                    border: isIn ? "1px solid var(--line)" : "1px solid var(--wine-glow)",
                    borderRadius: isIn ? "3px 12px 12px 12px" : "12px 3px 12px 12px", padding: "8px 11px",
                  }}>
                    <div style={{ ...MONO, fontSize: 7.5, letterSpacing: "0.12em", textTransform: "uppercase", color: isIn ? "var(--good)" : "var(--wine)", fontWeight: 700, marginBottom: 3 }}>{isIn ? ev.lead_name.split(" ")[0] : t("design.detail.aiAgent")}</div>
                    <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: "var(--ink-soft)" }}>{m.content}</p>
                  </div>
                );
              })}
            </div>
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

// ════════════════════════════════════════════════════════════════════════════
// Composition
// ════════════════════════════════════════════════════════════════════════════
const DETAIL_W = 372;

export function DesktopCalendar(p: DesktopCalendarProps) {
  const { state: leftPanelState, cycle } = useListPanelState();

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

  const leftWidth = leftPanelState === "hidden" ? 0 : leftPanelState === "compact" ? 64 : 318;
  const narrow = rootWidth > 0 && rootWidth - leftWidth - DETAIL_W < 500;

  return (
    <div ref={rootRef} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)" }} data-testid="calendar-desktop">
      <TopToolbar {...p} leftPanelState={leftPanelState} onCyclePanel={cycle} />
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 0, padding: 0, overflow: "hidden", position: "relative" }}>
        {/* LEFT — agenda (full | minimized | hidden) */}
        {leftPanelState !== "hidden" && (
          <div style={{ ...CARD_STYLE, width: leftWidth, flexShrink: 0, background: "hsl(var(--panel-list-bg))", borderRadius: 0, borderRight: "1px solid var(--line)" }}>
            {leftPanelState === "compact" ? (
              <CompactAgendaList {...p} />
            ) : (
              <>
                <StatusTabs {...p} />
                <AgendaList {...p} />
              </>
            )}
          </div>
        )}
        {/* CENTER — calendar (no rounded corners, flush edges) */}
        <div style={{ ...CARD_STYLE, flex: 1, minWidth: 0, background: "var(--bg-2)", borderRadius: 0 }}>
          <CenterHeader {...p} />
          {p.viewMode === "week" ? <WeekGrid {...p} /> : <MonthGrid {...p} />}
        </div>
        {/* RIGHT — detail: inline column or floating popup when narrow */}
        {narrow ? (
          p.selectedBooking && (
            <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: Math.min(DETAIL_W, Math.max(280, rootWidth - leftWidth - 24)), maxWidth: "92%", display: "flex", flexDirection: "column", background: "var(--bg)", borderLeft: "1px solid var(--line)", boxShadow: "-12px 0 40px rgba(60,45,25,0.18)", zIndex: 30 }}>
              <DetailPanel {...p} showClose />
            </div>
          )
        ) : (
          <div style={{ ...CARD_STYLE, width: DETAIL_W, flexShrink: 0, borderRadius: 0, marginLeft: "auto" }}>
            <DetailPanel {...p} />
          </div>
        )}
      </div>
    </div>
  );
}
