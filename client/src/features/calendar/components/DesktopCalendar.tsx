// DesktopCalendar.tsx — wine/neumorphic Calendar at all breakpoints.
// Full-width top toolbar + three floating panels (agenda · week/month grid · detail).
// Fabricated metrics removed; AI summary and full conversation shown.
// Component groups live in sibling files: desktopCalendarShared (atoms/types),
// DesktopCalendarToolbar, DesktopCalendarWeek, DesktopCalendarMonthAgenda, DesktopCalendarDetail.
import { useState, useRef, useEffect } from "react";
import { useListPanelState } from "@/hooks/useListPanelState";
import { useListPanelFold } from "@/hooks/useListPanelFold";
import { ListPanelFooter } from "@/components/crm/ListPanelToggleButton";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileSheet } from "@/components/crm/mobile/MobileSheet";
import { usePersistedState } from "@/hooks/usePersistedState";
import { CARD_STYLE } from "../lib/calendarDesign";
import type { DesktopCalendarProps } from "./desktopCalendarShared";
import { TopToolbar, StatusTabs } from "./DesktopCalendarToolbar";
import { CenterHeader } from "./DesktopCalendarHeader";
import { WeekGrid } from "./DesktopCalendarWeek";
import { MonthGrid, AgendaList, CompactAgendaList } from "./DesktopCalendarMonthAgenda";
import { bookingLeadId, DetailPanel } from "./DesktopCalendarDetail";
import { BlockPanel } from "./BlockPanel";
import type { CalendarBlock } from "../hooks/useCalendarBlocks";
import { useBookingCallId } from "@/features/voiceCalls/api/voiceCallsApi";

export type { DesktopCalendarProps } from "./desktopCalendarShared";

/** One inset calendar well; the overlay keeps its inset shadow on top of the grid's backgrounds. */
function CalendarWell({ style, children }: { style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, borderRadius: "var(--r-surface)", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative", ...style }}>
      {children}
      <div style={{ position: "absolute", inset: 0, borderRadius: "var(--r-surface)", boxShadow: "var(--sh-inset-crisp)", pointerEvents: "none", zIndex: 20 }} />
    </div>
  );
}

// ── Wide split: week (left) + draggable gap + month (right), each in its own well ──
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
    <div ref={ref} style={{ flex: 1, minHeight: 0, display: "flex" }}>
      {/* Week side */}
      <CalendarWell style={{ flex: frac === 1 ? 1 : `0 0 calc(${frac * 100}% - 7px)`, display: frac === 0 ? "none" : "flex" }}>
        <WeekGrid {...p} />
      </CalendarWell>
      {/* Draggable gap with a short centered handle; collapses a side */}
      <div
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (dragging.current) updateFromX(e.clientX); }}
        onPointerUp={(e) => { dragging.current = false; try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} }}
        style={{ width: 14, flexShrink: 0, cursor: "col-resize", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", touchAction: "none" }}
        role="separator"
        aria-orientation="vertical"
      >
        <div style={{ width: 3, height: 50, borderRadius: 2, background: "var(--line-strong)" }} />
      </div>
      {/* Month side */}
      <CalendarWell style={{ display: frac === 1 ? "none" : "flex", background: "var(--surface)" }}>
        <MonthGrid {...p} />
      </CalendarWell>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Composition
// ════════════════════════════════════════════════════════════════════════════
const DETAIL_W = 372;
// A booking made on a call shows its player and transcript, which need the room.
const DETAIL_W_CALL = 500;

export function DesktopCalendar(props: DesktopCalendarProps) {
  const { state: leftPanelState } = useListPanelState();
  const isMobile = useIsMobile(1024);
  // List fold button: the agenda is full or small (never on mobile).
  useListPanelFold(!isMobile);
  const isPhone = useIsMobile(768);

  // Block panel (create / edit a busy block). Opened from the toolbar and the week grid;
  // it takes the right slot, or a MobileSheet on phones.
  const [blockPanel, setBlockPanel] = useState<{ block?: CalendarBlock } | null>(null);
  const p: DesktopCalendarProps = { ...props, onOpenBlockPanel: (block) => setBlockPanel({ block }) };
  const editBlock = blockPanel?.block;
  const canShowBlockPanel = !!blockPanel && !!p.accountId && (editBlock ? !!(p.onUpdateBlock && p.onDeleteBlock) : !!p.onCreateBlock);
  const blockPanelEl = canShowBlockPanel ? (
    <BlockPanel
      key={editBlock?.id ?? "new"}
      accountId={p.accountId!}
      block={editBlock}
      mobile={isPhone ? "inline" : "fullscreen"}
      className="w-full border-l-0"
      onClose={() => setBlockPanel(null)}
      onSave={editBlock
        ? async (data) => { await p.onUpdateBlock!(editBlock.id, data); setBlockPanel(null); }
        : async (data) => { await p.onCreateBlock!(data); setBlockPanel(null); }}
      onDelete={editBlock ? async () => { await p.onDeleteBlock!(editBlock.id); setBlockPanel(null); } : undefined}
    />
  ) : null;

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
  const compactAgenda = leftPanelState === "compact";
  const leftWidth = isMobile ? 0 : compactAgenda ? 64 : "var(--toolbar-w)";
  const leftPx = isMobile ? 0 : compactAgenda ? 64 : 348;
  const ultra = rootWidth >= 1700;
  const { data: bookingCallId } = useBookingCallId(bookingLeadId(p.selectedBooking));
  const detailW = bookingCallId ? DETAIL_W_CALL : DETAIL_W;

  return (
    <div ref={rootRef} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)" }} data-testid="calendar-desktop">
      <TopToolbar {...p} ultra={ultra} />
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 0, padding: 0, overflow: "hidden", position: "relative" }}>
        {/* LEFT — agenda (full | small); never shown on mobile */}
        {!isMobile && (
          <div className={compactAgenda ? "la-list-panel" : "la-list-panel la-list-panel--split"} style={{ ...CARD_STYLE, width: leftWidth, flexShrink: 0, background: "hsl(var(--panel-list-bg))", borderRadius: 0, borderRight: "1px solid var(--line)" }}>
            {compactAgenda ? (
              <>
                <CompactAgendaList {...p} />
                <ListPanelFooter compact />
              </>
            ) : (
              <>
                <StatusTabs {...p} />
                <AgendaList {...p} split />
                <ListPanelFooter />
              </>
            )}
          </div>
        )}
        {/* CENTER — calendar. Ultra-wide: week + month split */}
        <div className="la-list-panel" style={{ ...CARD_STYLE, flex: 1, minWidth: 0, marginRight: 14, borderRadius: 0, display: "flex", flexDirection: "column" }}>
          {p.viewMode === "list" && isMobile ? (
            // List view (mobile only — desktop already has the agenda in its left
            // panel). Full-height agenda of all appointments grouped by date, no
            // week-nav header (the list isn't week-scoped).
            <AgendaList {...p} />
          ) : (
            <>
              <CenterHeader {...p} ultra={ultra} />
              {/* Chart area — inset with rounded corners and breathing room */}
              {ultra ? (
                <div style={{ flex: 1, minHeight: 0, margin: 8, display: "flex", flexDirection: "column" }}><WeekMonthSplit {...p} /></div>
              ) : (
                <CalendarWell style={{ margin: 8 }}>{p.viewMode === "week" ? <WeekGrid {...p} /> : <MonthGrid {...p} />}</CalendarWell>
              )}
            </>
          )}
        </div>
        {/* RIGHT: block panel (create / edit busy block) takes the slot while open; phones use the sheet below */}
        {!isPhone && blockPanelEl ? (
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: Math.min(DETAIL_W, Math.max(280, rootWidth - leftPx - 24)), maxWidth: "92%", display: "flex", flexDirection: "column", background: "var(--card)", borderLeft: "1px solid var(--line)", boxShadow: "-12px 0 40px rgba(60,45,25,0.18)", zIndex: 30 }}>
            {blockPanelEl}
          </div>
        ) : !isMobile && p.selectedBooking && (
        /* RIGHT: detail, a floating slide-over, desktop/tablet only (mobile uses the bottom sheet below) */
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: Math.min(detailW, Math.max(280, rootWidth - leftPx - 24)), maxWidth: "92%", display: "flex", flexDirection: "column", background: "var(--bg)", borderLeft: "1px solid var(--line)", boxShadow: "-12px 0 40px rgba(60,45,25,0.18)", zIndex: 30 }}>
            <DetailPanel {...p} showClose />
          </div>
        )}
      </div>

      {/* Mobile detail — bottom sheet rising over the grid, drag down to close */}
      <MobileSheet open={!!p.selectedBooking} onClose={() => p.onSelectBooking(null)} data-testid="mobile-calendar-detail-sheet">
        {p.selectedBooking && <DetailPanel {...p} showClose />}
      </MobileSheet>

      {/* Phone block panel: bottom sheet, same pattern as the detail */}
      <MobileSheet open={isPhone && !!blockPanelEl} onClose={() => setBlockPanel(null)} data-testid="mobile-calendar-block-sheet">
        {isPhone && blockPanelEl}
      </MobileSheet>
    </div>
  );
}
