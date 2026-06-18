function TaskCardSkeleton() {
  return (
    <div
      className="animate-pulse flex flex-col gap-2"
      style={{ background: "var(--card)", borderRadius: "var(--r-button)", boxShadow: "var(--sh-raised-crisp)", padding: "5px 8px", flexShrink: 0 }}
    >
      <div className="h-3 w-3/4 rounded bg-primary/10" />
      <div className="h-2 w-1/2 rounded bg-primary/10" />
    </div>
  );
}

function BoardColumnSkeleton({ count }: { count: number }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 244, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 6px 12px", flexShrink: 0 }}>
        <span className="bg-primary/10" style={{ width: 9, height: 9, borderRadius: "50%" }} />
        <div className="h-3 w-24 rounded bg-primary/10 animate-pulse" />
        <div className="ml-auto h-3 w-5 rounded bg-primary/10 animate-pulse" />
      </div>
      <div
        className="neu-inset"
        style={{ flex: 1, minHeight: 0, borderRadius: "var(--r-card)", padding: 10, display: "flex", flexDirection: "column", gap: 10 }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse flex flex-col gap-2.5"
            style={{ background: "var(--card)", borderRadius: "var(--r-surface)", boxShadow: "var(--sh-raised-crisp)", padding: "13px 14px" }}
          >
            <div className="h-3.5 w-3/4 rounded bg-primary/10" />
            <div className="h-2.5 w-1/2 rounded bg-primary/10" />
            <div className="flex items-center gap-2 pt-1">
              <div className="h-[22px] w-[22px] rounded-full bg-primary/10" />
              <div className="h-2.5 w-12 rounded bg-primary/10" />
              <div className="ml-auto h-2.5 w-10 rounded bg-primary/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalDayColumnSkeleton({ cardCounts, firstCol }: { cardCounts: number; firstCol: boolean }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, borderLeft: firstCol ? "none" : "1px solid var(--line)" }}>
      {/* Day header */}
      <div style={{ padding: "5px 8px", flexShrink: 0, borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <div className="animate-pulse h-[22px] w-[22px] rounded-[var(--r-button)] bg-primary/10" />
        <div className="animate-pulse h-2 w-6 rounded bg-primary/10" />
      </div>
      {/* Day body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "hidden", padding: "8px 7px", display: "flex", flexDirection: "column", gap: 6 }}>
        {Array.from({ length: cardCounts }).map((_, i) => (
          <TaskCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

const CAL_DAY_CARDS = [1, 2, 0, 1, 2, 0, 1];

export default function TasksLoadingSkeleton() {
  const columns = [3, 2, 3, 2];
  return (
    <div className="tasks-merged" style={{ width: "100%" }}>
      <div className="tasks-merged__board">
        <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 14, padding: "16px 16px 6px", overflow: "hidden", background: "var(--bg)" }}>
          {columns.map((c, i) => (
            <BoardColumnSkeleton key={i} count={c} />
          ))}
        </div>
      </div>
      {/* Calendar — week columns matching TasksWeekCalendar */}
      <div className="tasks-merged__cal">
        <div
          style={{ flex: 1, width: "100%", minWidth: 0, background: "var(--bg-2)", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", borderRadius: "var(--r-card)", border: "1px solid var(--line)" }}
        >
          <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
            {CAL_DAY_CARDS.map((count, i) => (
              <CalDayColumnSkeleton key={i} cardCounts={count} firstCol={i === 0} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
