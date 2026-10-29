import { Skeleton } from "@/components/ui/skeleton";
import type { ListPanelState } from "@/hooks/useListPanelState";
import { HEADER_H, PX_PER_HOUR } from "../lib/calendarDesign";

interface CalendarLoadingSkeletonProps {
  leftPanelState: ListPanelState;
}

// Mirrors DesktopCalendar (non-ultra width, week view):
//  - TopToolbar: 60px surface bar. Title · Week/Month seg · panel button ·
//    "N appointments this week" | settings · search · filter · sort · group · new
//  - LEFT (318px): StatusTabs (4 small tabs + counts) above grouped agenda cards
//    (raised avatar square · name · campaign · time | channel icon + score ring)
//  - CENTER on the page ground: CenterHeader (refresh + Today | ‹ date › | month
//    strip) above the week grid, drawn inside an inset rounded card (margin 8).

const RAISED_BTN: React.CSSProperties = { background: "var(--bg)", boxShadow: "var(--sh-raised-crisp)", borderRadius: "var(--r-button)" };
const VISIBLE_HOURS = 10;

function ToolIcon() {
  return <div className="h-8 w-8 shrink-0 flex items-center justify-center" style={RAISED_BTN}><Skeleton className="h-3.5 w-3.5 rounded bg-primary/10" /></div>;
}

function AgendaRowSkeleton({ i, faint }: { i: number; faint?: boolean }) {
  const tone = faint ? "bg-primary/5" : "bg-primary/10";
  return (
    <div className="flex items-center gap-[11px]" style={{ padding: "11px 12px 11px 14px" }}>
      <Skeleton className={`h-9 w-9 shrink-0 rounded-[var(--r-surface)] ${tone}`} style={{ boxShadow: "var(--sh-raised-crisp)" }} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Skeleton className={`h-3 rounded ${tone}`} style={{ width: `${55 + (i % 3) * 12}%` }} />
        <Skeleton className="h-2.5 rounded bg-primary/5 mt-1.5" style={{ width: `${62 + (i % 2) * 14}%` }} />
        <div className="flex items-center gap-2 mt-2">
          <Skeleton className={`h-2.5 w-12 rounded ${tone}`} />
          {i % 3 === 1 && <Skeleton className="h-3 w-12 rounded bg-primary/5" />}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <Skeleton className="h-3.5 w-3.5 rounded bg-primary/5" />
        <Skeleton className={`h-6 w-6 rounded-full ${tone}`} />
      </div>
    </div>
  );
}

function GroupHeaderSkeleton({ w }: { w: number }) {
  return (
    <div className="flex items-center gap-2" style={{ padding: "11px 2px 6px" }}>
      <Skeleton className="h-2.5 rounded bg-primary/10" style={{ width: w }} />
      <div className="flex-1 h-px" style={{ background: "var(--line)" }} />
      <Skeleton className="h-2.5 w-4 rounded bg-primary/5" />
    </div>
  );
}

export function CalendarLoadingSkeleton({ leftPanelState }: CalendarLoadingSkeletonProps) {
  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: "var(--bg)" }} data-testid="page-calendar">
      {/* TopToolbar */}
      <div className="shrink-0 flex items-center px-3.5" style={{ height: 60, gap: 18, background: "var(--surface)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <Skeleton className="h-5 w-24 rounded bg-primary/10" />
        <div className="flex items-center gap-2">
          {/* Week / Month: main pill tabs (la-seg--main), selected one solid wine */}
          <div className="la-seg la-seg--main">
            <Skeleton className="h-8 w-[64px] rounded-[var(--r-pill)]" style={{ background: "var(--wine)", opacity: 0.55 }} />
            <Skeleton className="h-8 w-[68px] rounded-[var(--r-pill)] bg-primary/5" />
          </div>
          <div className="hidden md:flex items-baseline gap-1.5 ml-1">
            <Skeleton className="h-5 w-4 rounded bg-primary/10" />
            <Skeleton className="h-2 w-28 rounded bg-primary/5" />
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <ToolIcon />
          <div className="hidden md:flex h-8 w-[190px] items-center gap-2 px-3" style={{ background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", borderRadius: "var(--r-button)" }}>
            <Skeleton className="h-3 w-3 rounded-full bg-primary/10" />
            <Skeleton className="h-2.5 w-28 rounded bg-primary/5" />
          </div>
          <ToolIcon />
          <ToolIcon />
          <ToolIcon />
          <ToolIcon />
        </div>
      </div>

      {/* Body row */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* LEFT — agenda panel; width follows the persisted panel state */}
        {leftPanelState === "hidden" ? null : leftPanelState === "compact" ? (
          <div className="hidden lg:flex flex-col shrink-0 items-center overflow-hidden" style={{ width: 64, background: "hsl(var(--panel-list-bg))", borderRight: "1px solid var(--line)" }}>
            <div className="flex flex-col items-center gap-2.5 py-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-9 rounded-[var(--r-surface)] bg-primary/10" style={{ boxShadow: "var(--sh-raised-crisp)", opacity: i === 0 ? 1 : 0.7 }} />
              ))}
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex flex-col shrink-0 overflow-hidden" style={{ width: 318, background: "hsl(var(--panel-list-bg))", borderRight: "1px solid var(--line)" }}>
            {/* StatusTabs: All (active, wine) · Booked · No-show · Rescheduled */}
            <div className="shrink-0 flex items-center gap-[3px] px-2.5" style={{ height: HEADER_H, borderBottom: "1px solid var(--line)" }}>
              <Skeleton className="h-[22px] w-12 rounded-[var(--r-button)]" style={{ background: "var(--wine)", opacity: 0.55 }} />
              {[58, 62, 86].map((w, i) => (
                <Skeleton key={i} className="h-2.5 mx-2 rounded bg-primary/10" style={{ width: w - 16 }} />
              ))}
            </div>
            {/* AgendaList */}
            <div className="flex-1 min-h-0 overflow-hidden" style={{ padding: "6px 16px 16px" }}>
              <GroupHeaderSkeleton w={64} />
              <AgendaRowSkeleton i={0} />
              <div className="mt-2"><GroupHeaderSkeleton w={36} /></div>
              <div className="flex flex-col gap-2">
                {Array.from({ length: 6 }).map((_, i) => <AgendaRowSkeleton key={i} i={i + 1} faint={i > 2} />)}
              </div>
            </div>
          </div>
        )}

        {/* CENTER — on the page ground */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden" style={{ background: "var(--bg)" }}>
          {/* CenterHeader */}
          <div className="shrink-0 relative flex items-center justify-center gap-4 px-3.5" style={{ height: HEADER_H, borderBottom: "1px solid var(--line)" }}>
            <div className="absolute left-3.5 flex items-center gap-2">
              <div className="h-[34px] w-[34px] flex items-center justify-center" style={RAISED_BTN}><Skeleton className="h-4 w-4 rounded-full bg-primary/10" /></div>
              <div className="h-[30px] w-[60px] flex items-center justify-center" style={{ ...RAISED_BTN, boxShadow: "var(--sh-inset-crisp)" }}><Skeleton className="h-2.5 w-9 rounded bg-primary/10" /></div>
            </div>
            <div className="h-[34px] w-[34px] shrink-0" style={RAISED_BTN} />
            <Skeleton className="h-7 w-[200px] rounded bg-primary/10" />
            <div className="h-[34px] w-[34px] shrink-0" style={RAISED_BTN} />
            {/* Month strip (Jan–Dec), current month inset */}
            <div className="absolute right-3.5 hidden xl:flex items-center gap-[3px]">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-[22px] w-[30px] flex items-center justify-center"
                  style={i === new Date().getMonth()
                    ? { borderRadius: "var(--r-button)", background: "var(--bg)", boxShadow: "var(--sh-inset-super-crisp)" }
                    : { borderRadius: "var(--r-button)", border: "1px solid var(--line)" }}>
                  <Skeleton className="h-1.5 w-4 rounded bg-primary/10" />
                </div>
              ))}
            </div>
          </div>

          {/* Week grid inside the inset rounded card */}
          <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden" style={{ margin: 8, borderRadius: "var(--r-surface)" }}>
            {/* Day header row */}
            <div className="shrink-0 grid" style={{ gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))", borderBottom: "1px solid var(--line-strong)" }}>
              <div />
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-[5px]" style={{ padding: "16px 6px 18px", borderLeft: "1px solid var(--line-strong)" }}>
                  <Skeleton className="h-3 w-8 rounded bg-primary/10" />
                  <Skeleton className="h-[22px] w-7 rounded bg-primary/10" />
                </div>
              ))}
            </div>
            {/* Hour rows (the real grid opens scrolled to 9am, 83px per hour) */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {Array.from({ length: VISIBLE_HOURS }).map((_, i) => (
                <div key={i} className="grid relative" style={{ gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))", height: PX_PER_HOUR, borderTop: i > 0 ? "1px solid var(--line-strong)" : undefined }}>
                  <div className="flex justify-end pr-2 pt-1.5">
                    <Skeleton className="h-2.5 w-7 rounded bg-primary/10" />
                  </div>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <div key={j} style={{ borderLeft: "1px solid var(--line-strong)" }} />
                  ))}
                  <div className="absolute left-14 right-0" style={{ top: "50%", borderTop: "1px dashed var(--line-strong)", opacity: 0.5 }} />
                </div>
              ))}
            </div>
            {/* Inset overlay, same as the real chart card */}
            <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: "var(--r-surface)", boxShadow: "var(--sh-inset-crisp)", zIndex: 20 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
