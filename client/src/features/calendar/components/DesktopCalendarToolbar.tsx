// DesktopCalendarToolbar.tsx — top toolbar, calendar-settings popover, status
// filter tabs, and the center week/month header (with meetings-this-week KPI).
import { useMemo, useState } from "react";
import {
  Clock, Check,
  Calendar as CalIcon, CalendarDays, Filter, ArrowUpDown, ArrowUp, ArrowDown, Layers, Plus,
  PanelLeft, PanelLeftClose, MoreVertical, RefreshCw, XCircle, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileListHeader, MobileTabSeg, MobileDrawerOption, MobileDrawerSubheading, DrawerMainButton } from "@/components/crm/mobile/MobileListHeader";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  HEADER_H, HOUR0, HOUR1,
  statusKeyOf, dateKeyOf,
} from "../lib/calendarDesign";
import { BookAppointmentPopover } from "./BookAppointmentPopover";
import { AddBlockForm } from "./AddBlockForm";
import {
  type DesktopCalendarProps, type ApptFilterStatus, type ApptGroupBy,
  MONO, SERIF, SORT_GROUPS, GROUP_KEYS, FILTER_KEYS,
  NavBtn, toolBtnClass, ReschedulePopover,
} from "./desktopCalendarShared";

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
export function TopToolbar(p: DesktopCalendarProps) {
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

  const [blockPopoverOpen, setBlockPopoverOpen] = useState(false);
  const addBlockButton = p.onCreateBlock && p.accountId ? (
    <Popover open={blockPopoverOpen} onOpenChange={setBlockPopoverOpen}>
      <PopoverTrigger asChild>
        <button className="la-btn la-btn--soft" title={t("blocks.addBlock")} style={{ gap: 6, paddingLeft: 10, paddingRight: 12, fontSize: 12, fontWeight: 600 }}>
          <CalIcon className="h-3.5 w-3.5" />
          {t("blocks.addBlock")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4">
        <AddBlockForm
          accountId={p.accountId!}
          onClose={() => setBlockPopoverOpen(false)}
          onSave={async (data) => { await p.onCreateBlock!(data); setBlockPopoverOpen(false); }}
        />
      </PopoverContent>
    </Popover>
  ) : null;

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
        {addBlockButton}
        {bookButton}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LEFT — status filter tabs + agenda list
// ════════════════════════════════════════════════════════════════════════════
export function StatusTabs(p: DesktopCalendarProps) {
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
