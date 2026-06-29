import { Skeleton } from "@/components/ui/skeleton";
import type { ListPanelState } from "@/hooks/useListPanelState";

interface CalendarLoadingSkeletonProps {
  leftPanelState: ListPanelState;
}

export function CalendarLoadingSkeleton({ leftPanelState }: CalendarLoadingSkeletonProps) {
  return (
    <>
      {/*
        Mirrors DesktopCalendar real layout:
        - Root: flex column, background var(--bg), flush (no padding/gap)
        - TopToolbar: h-[60px], background var(--surface), top+bottom border
        - Body row: LEFT agenda panel (318px) | CENTER week grid (flex-1)
      */}
      <div
        className="h-full flex flex-col overflow-hidden"
        style={{ background: "var(--bg)" }}
        data-testid="page-calendar"
      >
        {/* TopToolbar shimmer — 60px, surface bg, serif title + seg + icon buttons */}
        <div
          className="shrink-0 flex items-center gap-4 px-3.5 border-t border-b border-border"
          style={{ height: 60, background: "var(--surface)" }}
        >
          {/* Serif page title */}
          <Skeleton className="h-5 w-28 rounded bg-primary/10" />
          {/* View toggle segment (Week / Month) */}
          <div className="flex items-center gap-1">
            <Skeleton className="h-7 w-14 rounded-full bg-primary/10" />
            <Skeleton className="h-7 w-16 rounded-full bg-primary/5" />
          </div>
          <div className="flex-1" />
          {/* Right-side icon buttons: weekends toggle, search bar, filter/sort/group/new */}
          <Skeleton className="h-8 w-8 rounded-[var(--r-button)] bg-primary/5" />
          <Skeleton className="h-8 w-44 rounded-[var(--r-button)] bg-primary/10" />
          <Skeleton className="h-8 w-8 rounded-[var(--r-button)] bg-primary/5" />
          <Skeleton className="h-8 w-8 rounded-[var(--r-button)] bg-primary/5" />
          <Skeleton className="h-8 w-8 rounded-[var(--r-button)] bg-primary/5" />
          <Skeleton className="h-8 w-8 rounded-[var(--r-button)] bg-primary/5" />
        </div>

        {/* Body row: agenda left panel + center week grid */}
        <div className="flex-1 min-h-0 flex overflow-hidden">

          {/* LEFT — agenda panel: width follows the persisted toolbar state
              (hidden on mobile regardless; full=318px, compact=64px icon rail, hidden=0) */}
          {leftPanelState === "hidden" ? null : leftPanelState === "compact" ? (
            <div
              className="hidden lg:flex flex-col shrink-0 items-center overflow-hidden"
              style={{ width: 64, background: "hsl(var(--panel-list-bg))", borderRight: "1px solid var(--line)" }}
            >
              <div className="flex flex-col items-center gap-2.5 py-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-9 rounded-full bg-primary/10" style={{ opacity: i === 0 ? 1 : 0.7 }} />
                ))}
              </div>
            </div>
          ) : (
            <div
              className="hidden lg:flex flex-col shrink-0 overflow-hidden"
              style={{ width: 318, background: "hsl(var(--panel-list-bg))", borderRight: "1px solid var(--line)" }}
            >
              {/* StatusTabs bar — 60px, matches HEADER_H */}
              <div
                className="shrink-0 flex items-center gap-1 px-2.5 border-b border-border"
                style={{ height: 60 }}
              >
                {/* Four status pill tabs */}
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-6 rounded-full bg-primary/10"
                    style={{ width: i === 0 ? 36 : i === 1 ? 52 : i === 2 ? 60 : 76 }}
                  />
                ))}
              </div>

              {/* AgendaList — rows of appointment cards */}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-0.5 px-2.5 py-2">
                {/* Group header label */}
                <div className="flex items-center gap-2 px-1.5 py-2">
                  <Skeleton className="h-2.5 w-16 rounded bg-primary/10" />
                  <div className="flex-1 h-px bg-border/40" />
                  <Skeleton className="h-2.5 w-4 rounded bg-primary/5" />
                </div>
                {/* AgendaCard rows — transparent bg, no active card on load (nothing selected yet) */}
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5"
                    style={{ borderRadius: "var(--r-surface)", background: "transparent" }}
                  >
                    {/* Lead avatar circle */}
                    <Skeleton className="h-9 w-9 rounded-[var(--r-surface)] bg-primary/10 shrink-0" />
                    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                      {/* Lead name */}
                      <Skeleton className="h-3 bg-primary/10 rounded" style={{ width: `${60 + (i % 3) * 12}%` }} />
                      {/* Campaign name */}
                      <Skeleton className="h-2.5 bg-primary/5 rounded" style={{ width: `${38 + (i % 2) * 15}%` }} />
                      {/* Time + status pill row */}
                      <div className="flex items-center gap-2 mt-0.5">
                        <Skeleton className="h-2.5 w-10 rounded bg-primary/10" />
                        {i === 1 && <Skeleton className="h-4 w-14 rounded bg-primary/5" />}
                      </div>
                    </div>
                    {/* Channel icon */}
                    <Skeleton className="h-3.5 w-3.5 rounded bg-primary/5 shrink-0" />
                  </div>
                ))}

                {/* Second group */}
                <div className="flex items-center gap-2 px-1.5 py-2 mt-1">
                  <Skeleton className="h-2.5 w-20 rounded bg-primary/10" />
                  <div className="flex-1 h-px bg-border/40" />
                  <Skeleton className="h-2.5 w-4 rounded bg-primary/5" />
                </div>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5"
                    style={{ borderRadius: "var(--r-surface)", background: "transparent" }}
                  >
                    <Skeleton className="h-9 w-9 rounded-[var(--r-surface)] bg-primary/5 shrink-0" />
                    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                      <Skeleton className="h-3 bg-primary/5 rounded" style={{ width: `${55 + (i % 3) * 10}%` }} />
                      <Skeleton className="h-2.5 bg-primary/5 rounded" style={{ width: `${40 + (i % 2) * 12}%` }} />
                      <Skeleton className="h-2.5 w-10 rounded bg-primary/5 mt-0.5" />
                    </div>
                    <Skeleton className="h-3.5 w-3.5 rounded bg-primary/5 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CENTER — week grid (default view) */}
          <div
            className="flex-1 min-w-0 flex flex-col overflow-hidden"
            style={{ background: "var(--bg-2)" }}
          >
            {/* CenterHeader — 60px, matches HEADER_H */}
            <div
              className="shrink-0 flex items-center justify-center gap-4 border-b border-border relative"
              style={{ height: 60 }}
            >
              {/* Today button (left) */}
              <div className="absolute left-3.5">
                <Skeleton className="h-7 w-14 rounded-[var(--r-button)] bg-primary/10" />
              </div>
              {/* Prev arrow */}
              <Skeleton className="h-[34px] w-[34px] rounded-[var(--r-button)] bg-primary/10" />
              {/* Serif date range label */}
              <Skeleton className="h-6 w-44 rounded bg-primary/10" />
              {/* Next arrow */}
              <Skeleton className="h-[34px] w-[34px] rounded-[var(--r-button)] bg-primary/10" />
              {/* KPI — meetings this week (right) */}
              <div className="absolute right-3.5 flex flex-col items-end gap-1">
                <Skeleton className="h-5 w-6 rounded bg-primary/10" />
                <Skeleton className="h-2 w-16 rounded bg-primary/5" />
              </div>
            </div>

            {/* WeekGrid day-header row (Mon–Sun, 7 cols) */}
            <div
              className="shrink-0 grid border-b border-border"
              style={{ gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))" }}
            >
              {/* Gutter cell */}
              <div />
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1.5 py-2.5 border-l border-border/40"
                >
                  {/* Day abbreviation label */}
                  <Skeleton className="h-2.5 w-8 rounded bg-primary/10" />
                  {/* Day number circle (today would be wine pill) */}
                  <Skeleton className="h-7 w-7 rounded-[var(--r-button)] bg-primary/10" />
                </div>
              ))}
            </div>

            {/* WeekGrid time rows — HOUR0=6 to HOUR1=21 = 15 spans */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {Array.from({ length: 15 }).map((_, i) => (
                <div
                  key={i}
                  className="grid border-b border-border/20"
                  style={{
                    gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))",
                    flex: "1 1 0",
                    minHeight: 36,
                  }}
                >
                  {/* Hour gutter label */}
                  <div className="flex items-start justify-end pr-2 pt-1">
                    <Skeleton className="h-2.5 w-8 rounded bg-primary/10" />
                  </div>
                  {/* 7 day columns */}
                  {Array.from({ length: 7 }).map((_, j) => (
                    <div key={j} className="border-l border-border/20" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
