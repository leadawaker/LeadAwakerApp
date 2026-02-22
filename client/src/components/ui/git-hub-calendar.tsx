import { useMemo } from "react";
import { format, startOfWeek, addDays } from "date-fns";
import { cn } from "@/lib/utils";

export type ContributionDay = {
  date: string; // "YYYY-MM-DD"
  count: number;
};

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function GitHubCalendar({
  data,
  year,
  className,
}: {
  data: ContributionDay[];
  year?: number;
  className?: string;
}) {
  const targetYear = year ?? new Date().getFullYear();

  const { weeks, monthPositions } = useMemo(() => {
    const yearStart = new Date(targetYear, 0, 1);
    const yearEnd = new Date(targetYear, 11, 31);

    // Grid starts on the Sunday on or before Jan 1
    const gridStart = startOfWeek(yearStart, { weekStartsOn: 0 });

    const dateMap = new Map<string, number>();
    for (const d of data) dateMap.set(d.date, d.count);

    const weeks: Array<Array<{ date: Date; count: number; inYear: boolean }>> = [];
    let cur = new Date(gridStart);

    while (cur <= yearEnd) {
      const week: Array<{ date: Date; count: number; inYear: boolean }> = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(cur);
        const key = format(day, "yyyy-MM-dd");
        week.push({
          date: day,
          count: dateMap.get(key) ?? 0,
          inYear: day.getFullYear() === targetYear,
        });
        cur = addDays(cur, 1);
      }
      weeks.push(week);
    }

    // Find the first column index where each calendar month appears
    const monthPositions: Array<{ label: string; col: number }> = [];
    let lastMonth = -1;
    for (let col = 0; col < weeks.length; col++) {
      const day = weeks[col].find((d) => d.inYear);
      if (!day) continue;
      const m = day.date.getMonth();
      if (m !== lastMonth) {
        monthPositions.push({ label: MONTH_ABBR[m], col });
        lastMonth = m;
      }
    }

    return { weeks, monthPositions };
  }, [data, targetYear]);

  const getColor = (count: number): string => {
    if (count === 0) return "bg-muted/25";
    if (count === 1) return "bg-brand-blue/30";
    if (count <= 3) return "bg-brand-blue/55";
    if (count <= 5) return "bg-brand-blue/80";
    return "bg-brand-blue";
  };

  // Each cell is 13×13 px; gap between cells is 2px
  const CELL = 13;
  const GAP = 2;

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className="inline-flex flex-col" style={{ gap: 4 }}>
        {/* Month labels */}
        <div className="flex" style={{ paddingLeft: 30, gap: GAP }}>
          {weeks.map((_, col) => {
            const pos = monthPositions.find((m) => m.col === col);
            return (
              <div
                key={col}
                className="text-muted-foreground font-medium shrink-0 overflow-visible"
                style={{ width: CELL, fontSize: 9, whiteSpace: "nowrap" }}
              >
                {pos?.label ?? ""}
              </div>
            );
          })}
        </div>

        {/* Calendar body: day labels + week columns */}
        <div className="flex" style={{ gap: GAP }}>
          {/* Day-of-week labels (Sun=row0 … Sat=row6, only Mon/Wed/Fri shown) */}
          <div className="flex flex-col shrink-0" style={{ gap: GAP, width: 28 }}>
            {["", "Mon", "", "Wed", "", "Fri", ""].map((lbl, i) => (
              <div
                key={i}
                className="text-muted-foreground font-medium flex items-center justify-end"
                style={{ height: CELL, fontSize: 9, paddingRight: 4 }}
              >
                {lbl}
              </div>
            ))}
          </div>

          {/* Week columns */}
          <div className="flex" style={{ gap: GAP }}>
            {weeks.map((week, col) => (
              <div key={col} className="flex flex-col" style={{ gap: GAP }}>
                {week.map((day, row) => (
                  <div
                    key={row}
                    title={
                      day.inYear
                        ? `${format(day.date, "MMM d")}: ${day.count} booking${day.count !== 1 ? "s" : ""}`
                        : undefined
                    }
                    className={cn(
                      "rounded-[2px] shrink-0 transition-opacity",
                      day.inYear ? getColor(day.count) : "opacity-0"
                    )}
                    style={{ width: CELL, height: CELL }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div
          className="flex items-center"
          style={{ paddingLeft: 30, gap: 4, marginTop: 2 }}
        >
          <span
            className="text-muted-foreground font-medium"
            style={{ fontSize: 9 }}
          >
            Less
          </span>
          {[0, 1, 2, 4, 6].map((count, i) => (
            <div
              key={i}
              className={cn("rounded-[2px] shrink-0", getColor(count))}
              style={{ width: CELL, height: CELL }}
            />
          ))}
          <span
            className="text-muted-foreground font-medium"
            style={{ fontSize: 9 }}
          >
            More
          </span>
        </div>
      </div>
    </div>
  );
}
