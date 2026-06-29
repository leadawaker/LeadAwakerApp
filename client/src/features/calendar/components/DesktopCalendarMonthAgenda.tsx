// DesktopCalendarMonthAgenda.tsx — month grid + the left-rail agenda list
// (full agenda cards + the compact avatars-only minimized variant).
import { useMemo, useRef } from "react";
import type { TFunction } from "i18next";
import { Clock, Phone, Video } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { getLeadStatusAvatarColor } from "@/lib/avatarUtils";
import {
  type Appointment,
  statusMetaOf, channelOf, dateKeyOf,
} from "../lib/calendarDesign";
import { ScoreArcDonut } from "@/features/leads/components/cardView/atoms";
import {
  type DesktopCalendarProps, MONO, SERIF, DAY_KEYS, DOW_ORDER, isWeekendDay, emitCalSwipe,
} from "./desktopCalendarShared";

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

export function AgendaList(p: DesktopCalendarProps) {
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

export function MonthGrid(p: DesktopCalendarProps) {
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

// ── Compact agenda (minimized panel — avatars only) ──────────────────────────
export function CompactAgendaList(p: DesktopCalendarProps) {
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
