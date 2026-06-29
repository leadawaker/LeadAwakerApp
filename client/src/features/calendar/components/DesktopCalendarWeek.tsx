// DesktopCalendarWeek.tsx — week-view grid: time-grid events, availability /
// busy overlay, and the WeekGrid container (with the edit-block dialog).
import { useMemo, useState, useRef, useEffect } from "react";
import type { TFunction } from "i18next";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  type Appointment, HOUR0, HOUR1, SPAN, PX_PER_HOUR,
  statusMetaOf, apptHm, dateKeyOf,
} from "../lib/calendarDesign";
import { AddBlockForm } from "./AddBlockForm";
import type { CalendarBlock } from "../hooks/useCalendarBlocks";
import {
  type DesktopCalendarProps, MONO, SERIF, DAY_KEYS, isWeekendDay, emitCalSwipe,
} from "./desktopCalendarShared";

export function WeekEvent({ ev, dayIdx, nCols, active, onClick, t }: { ev: Appointment; dayIdx: number; nCols: number; active: boolean; onClick: (e: React.MouseEvent) => void; t: TFunction }) {
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
function AvailabilityOverlay({ p, days, nCols, onEditBlock }: {
  p: DesktopCalendarProps;
  days: Date[];
  nCols: number;
  onEditBlock?: (block: CalendarBlock) => void;
}) {
  const { t } = p;
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

  // Bucket manual blocks by local day key.
  const blocksByDay = new Map<string, { s: number; e: number; allDay: boolean; label: string | null; block: CalendarBlock }[]>();
  for (const block of p.blocks ?? []) {
    const start = new Date(block.startsAt), end = new Date(block.endsAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;
    // A block may span multiple calendar dates — add it to each relevant day.
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    const last = new Date(end);
    last.setHours(23, 59, 59, 999);
    while (cur <= last) {
      const key = dateKeyOf(cur);
      const s = cur.toDateString() === start.toDateString() ? (start.getHours() + start.getMinutes() / 60) : 0;
      const e = cur.toDateString() === end.toDateString() ? (end.getHours() + end.getMinutes() / 60) : 24;
      const arr = blocksByDay.get(key) ?? [];
      arr.push({ s, e, allDay: block.allDay, label: block.label, block });
      blocksByDay.set(key, arr);
      cur.setDate(cur.getDate() + 1);
    }
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
      {/* connected-calendar busy blocks per day */}
      {days.map((d, di) => {
        const slots = byDay.get(dateKeyOf(d)) ?? [];
        return slots.map((b, i) => {
          const s = Math.max(b.s, HOUR0), e = Math.min(b.e, HOUR1);
          if (e <= s) return null;
          return (
            <div key={`${di}-busy-${i}`} title="Busy" style={{
              position: "absolute", top: `${pct(s)}%`, height: `${Math.max(pct(e) - pct(s), 1.2)}%`,
              left: `calc(${colLeft(di)} + 2px)`, width: `calc(${colWidth} - 4px)`,
              borderRadius: "var(--r-flush)",
              background: "repeating-linear-gradient(45deg, rgba(94,34,48,0.10), rgba(94,34,48,0.10) 5px, rgba(94,34,48,0.04) 5px, rgba(94,34,48,0.04) 10px)",
              border: "1px solid rgba(94,34,48,0.12)",
            }} />
          );
        });
      })}
      {/* Manual busy blocks — distinct styling (solid wine-tinted, pointer events enabled) */}
      {days.map((d, di) => {
        const manualSlots = blocksByDay.get(dateKeyOf(d)) ?? [];
        return manualSlots.map((b, i) => {
          const rawS = b.allDay ? HOUR0 : b.s;
          const rawE = b.allDay ? HOUR1 : b.e;
          const s = Math.max(rawS, HOUR0);
          const e = Math.min(rawE, HOUR1);
          if (e <= s) return null;
          const heightPct = Math.max(pct(e) - pct(s), 1.5);
          const tiny = heightPct < 6;
          return (
            <div
              key={`${di}-block-${i}`}
              title={b.label ?? "Busy block"}
              onClick={onEditBlock ? () => onEditBlock(b.block) : undefined}
              style={{
                position: "absolute",
                top: `${pct(s)}%`,
                height: `${heightPct}%`,
                left: `calc(${colLeft(di)} + 3px)`,
                width: `calc(${colWidth} - 6px)`,
                borderRadius: "var(--r-flush)",
                background: "rgba(94,34,48,0.13)",
                border: "1.5px solid rgba(94,34,48,0.30)",
                borderLeft: "3px solid rgba(94,34,48,0.55)",
                pointerEvents: onEditBlock ? "auto" : "none",
                cursor: onEditBlock ? "pointer" : "default",
                overflow: "hidden",
                display: "flex",
                alignItems: "flex-start",
                padding: tiny ? "0 4px" : "2px 4px",
              }}
            >
              {!tiny && (
                <span style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(94,34,48,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.4 }}>
                  {b.label ?? t("blocks.busyBlock")}
                </span>
              )}
            </div>
          );
        });
      })}
    </div>
  );
}

export function WeekGrid(p: DesktopCalendarProps) {
  const { t } = p;
  const [editingBlock, setEditingBlock] = useState<CalendarBlock | null>(null);
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
    <>
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
          {/* Blocks always render; connected-calendar shade only when showAvailability is on */}
          {(p.showAvailability || (p.blocks && p.blocks.length > 0)) && (
            <AvailabilityOverlay
              p={p.showAvailability ? p : { ...p, busySlots: [] }}
              days={days}
              nCols={nCols}
              onEditBlock={(block) => setEditingBlock(block)}
            />
          )}
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
    {/* Edit-block dialog — Dialog uses a Portal so it's never clipped by the scroll container */}
    {editingBlock && p.onUpdateBlock && p.onDeleteBlock && p.accountId && (
      <Dialog open={!!editingBlock} onOpenChange={(open) => { if (!open) setEditingBlock(null); }}>
        <DialogContent className="w-72 p-4 max-w-[calc(100vw-32px)]">
          <AddBlockForm
            accountId={p.accountId}
            block={editingBlock}
            onClose={() => setEditingBlock(null)}
            onSave={async (data) => { await p.onUpdateBlock!(editingBlock.id, data); setEditingBlock(null); }}
            onDelete={async () => { await p.onDeleteBlock!(editingBlock.id); setEditingBlock(null); }}
          />
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}
