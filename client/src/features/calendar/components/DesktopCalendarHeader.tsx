// DesktopCalendarHeader.tsx — center week/month header with date navigation and
// the meetings-this-week KPI. Extracted from DesktopCalendarToolbar to keep files <500 lines.
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { HEADER_H, dateKeyOf } from "../lib/calendarDesign";
import {
  type DesktopCalendarProps,
  MONO, SERIF, MONTH_KEYS,
  NavBtn, useSwipeFlash,
} from "./desktopCalendarShared";

export function CenterHeader(p: DesktopCalendarProps) {
  const { t } = p;
  const isMobile = useIsMobile(768);
  const weekKeys = useMemo(() => new Set(p.weekDays.map(dateKeyOf)), [p.weekDays]);
  const meetingsThisWeek = useMemo(() => p.appts.filter((a) => weekKeys.has(a.date)).length, [p.appts, weekKeys]);
  const activeMonth = p.month.getMonth();
  const flashDir = useSwipeFlash();

  // Month pills live in normal flow, in a slot that shrinks when the header is tight.
  // When the pills' natural width no longer fits the slot they are hidden (never overlap the title).
  const pillSlotRef = useRef<HTMLDivElement>(null);
  const pillInnerRef = useRef<HTMLDivElement>(null);
  const [pillsFit, setPillsFit] = useState(true);
  useEffect(() => {
    const slot = pillSlotRef.current;
    const inner = pillInnerRef.current;
    if (!slot || !inner) return;
    const measure = () => setPillsFit(inner.offsetWidth <= slot.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(slot);
    return () => ro.disconnect();
  }, []);

  // Today button: inset shadow when viewing the current week/month, plain raised when navigated away.
  const now = new Date();
  const onTodayView = p.viewMode === "month"
    ? (p.month.getMonth() === now.getMonth() && p.month.getFullYear() === now.getFullYear())
    : p.weekDays.some((d) => dateKeyOf(d) === p.todayStr);
  const todayBtnStyle: React.CSSProperties = onTodayView
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

  // Ultra-wide: Refresh and Today left, the date centered on the panel, week-only stepping, month buttons right.
  if (p.ultra) {
    return (
      <div style={{ height: HEADER_H, flexShrink: 0, padding: "0 14px", borderBottom: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <NavBtn onClick={() => p.onRefresh?.()} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></NavBtn>
          <button onClick={p.onToday} className="la-btn la-btn--soft" style={todayBtnStyle}>{t("navigation.today")}</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <NavBtn onClick={() => p.onNavigateWeek(-1)} aria-label={t("navigation.previous")} forcePressed={flashDir === -1}><ChevronLeft className="h-5 w-5" /></NavBtn>
          <span style={{ ...SERIF, fontSize: 26, color: "var(--ink)", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{p.weekLabel}</span>
          <NavBtn onClick={() => p.onNavigateWeek(1)} aria-label={t("navigation.next")} forcePressed={flashDir === 1}><ChevronRight className="h-5 w-5" /></NavBtn>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", minWidth: 0 }}>{monthButtons}</div>
      </div>
    );
  }

  // Mobile: single-row layout — [Today] ‹ Date › [KPI]
  if (isMobile) {
    return (
      <div style={{ flexShrink: 0, borderBottom: "1px solid var(--line)", padding: "8px 16px 8px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Today button — left edge */}
          <button onClick={p.onToday} className="la-btn la-btn--soft la-btn--sm" style={{ flexShrink: 0, ...todayBtnStyle }}>{t("navigation.today")}</button>
          {/* Prev arrow */}
          <NavBtn onClick={() => p.onNavigate(-1)} aria-label={t("navigation.previous")} style={{ flexShrink: 0 }} forcePressed={flashDir === -1}><ChevronLeft className="h-5 w-5" /></NavBtn>
          {/* Date label — centered, fills remaining space */}
          <span style={{ ...SERIF, fontSize: 17, color: "var(--ink)", letterSpacing: "-0.01em", textAlign: "center", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.viewLabel}</span>
          {/* Next arrow */}
          <NavBtn onClick={() => p.onNavigate(1)} aria-label={t("navigation.next")} style={{ flexShrink: 0 }} forcePressed={flashDir === 1}><ChevronRight className="h-5 w-5" /></NavBtn>
          {/* Meetings-this-week KPI — right edge: big number + 3-line stacked label */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, marginLeft: 2 }}>
            <span style={{ ...SERIF, fontSize: 24, color: "var(--ink)", lineHeight: 1, letterSpacing: "-0.02em" }}>{meetingsThisWeek}</span>
            <span style={{ ...MONO, fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mute)", lineHeight: 1.2, maxWidth: 76, whiteSpace: "normal" }}>
              {t("design.kpi.meetings")}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: HEADER_H, flexShrink: 0, padding: "0 14px", borderBottom: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 16, position: "relative" }}>
      {/* Refresh + Today — left-anchored */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <NavBtn onClick={() => p.onRefresh?.()} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></NavBtn>
        <button onClick={p.onToday} className="la-btn la-btn--soft" style={todayBtnStyle}>{t("navigation.today")}</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <NavBtn onClick={() => p.onNavigate(-1)} aria-label={t("navigation.previous")} forcePressed={flashDir === -1}><ChevronLeft className="h-5 w-5" /></NavBtn>
        <span style={{ ...SERIF, fontSize: 28, color: "var(--ink)", letterSpacing: "-0.01em", minWidth: 200, textAlign: "center", whiteSpace: "nowrap" }}>{p.viewLabel}</span>
        <NavBtn onClick={() => p.onNavigate(1)} aria-label={t("navigation.next")} forcePressed={flashDir === 1}><ChevronRight className="h-5 w-5" /></NavBtn>
      </div>
      {/* Month buttons — in flow, right-aligned; hidden (not overlapping) when they don't fit */}
      <div ref={pillSlotRef} style={{ minWidth: 0, display: "flex", justifyContent: "flex-end", overflow: "hidden" }}>
        <div ref={pillInnerRef} style={{ flexShrink: 0, visibility: pillsFit ? "visible" : "hidden" }}>
          {monthButtons}
        </div>
      </div>
    </div>
  );
}
