// DesktopCalendar.tsx — wine/neumorphic Calendar at all breakpoints.
// Full-width top toolbar + three floating panels (agenda · week/month grid · detail).
// Fabricated metrics removed; real lead score, AI summary, and full conversation shown.
// Component groups live in sibling files: desktopCalendarShared (atoms/types),
// DesktopCalendarToolbar, DesktopCalendarWeek, DesktopCalendarMonthAgenda, DesktopCalendarDetail.
import { useState, useRef, useEffect } from "react";
import { useListPanelState, type ListPanelState } from "@/hooks/useListPanelState";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileSheet } from "@/components/crm/mobile/MobileSheet";
import { usePersistedState } from "@/hooks/usePersistedState";
import { CARD_STYLE } from "../lib/calendarDesign";
import type { DesktopCalendarProps } from "./desktopCalendarShared";
import { TopToolbar, StatusTabs } from "./DesktopCalendarToolbar";
import { CenterHeader } from "./DesktopCalendarHeader";
import { WeekGrid } from "./DesktopCalendarWeek";
import { MonthGrid, AgendaList, CompactAgendaList } from "./DesktopCalendarMonthAgenda";
import { DetailPanel } from "./DesktopCalendarDetail";

export type { DesktopCalendarProps } from "./desktopCalendarShared";

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
