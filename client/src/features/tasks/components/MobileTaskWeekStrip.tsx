import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { dueToISO } from "./MobileTaskListCard";
import type { Task } from "../types";

interface Props {
  tasks: Task[];
  todayISO: string;
  categoryMap: Map<number, any>;
  onSelect: (id: number) => void;
}

const DOW_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

// Matches STATUS_EDGE in TasksWeekCalendar.tsx / TasksBoardCard.tsx (desktop).
const STATUS_EDGE: Record<string, string> = {
  todo:        "var(--mute)",
  in_progress: "var(--stage-contacted)",
  waiting:     "var(--warn)",
  done:        "var(--good)",
  cancelled:   "var(--stage-lost)",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * MobileTaskWeekStrip — a 7-day Mon→Sun strip plotting tasks on their due date.
 * Rendered below the mobile kanban; tapping a task chip opens its detail panel.
 */
export default function MobileTaskWeekStrip({ tasks, todayISO, categoryMap, onSelect }: Props) {
  const { t } = useTranslation("tasks");

  const days = useMemo(() => {
    const [ty, tm, td] = todayISO.split("-").map(Number);
    const today = new Date(Date.UTC(ty, tm - 1, td));
    const dow = (today.getUTCDay() + 6) % 7; // 0 = Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.UTC(ty, tm - 1, td - dow + i));
      const iso = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
      return { iso, dateNum: d.getUTCDate(), isToday: iso === todayISO, key: DOW_KEYS[i] };
    });
  }, [todayISO]);

  // Auto-scroll so today's column sits at the left edge (no manual scrolling to
  // reach "now"). Today's index in the Mon→Sun strip equals its weekday offset.
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const todayIdx = days.findIndex((d) => d.isToday);
    if (todayIdx <= 0) { el.scrollLeft = 0; return; }
    el.scrollLeft = todayIdx * 132; // column width, no gap (border-separated like desktop)
  }, [days]);

  const byDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const tk of tasks) {
      const iso = dueToISO(tk.dueDate);
      if (!iso) continue;
      (map[iso] ??= []).push(tk);
    }
    return map;
  }, [tasks]);

  return (
    <div style={{ padding: "4px 14px 0" }} data-testid="mobile-tasks-week">
      <div className="row" style={{ gap: 9, padding: "0 4px 11px" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-soft)", fontWeight: 700 }}>
          {t("views.week", "This Week")}
        </span>
      </div>
      {/* Card wrapper — same bg-2 + line border + r-card as desktop's TasksWeekCalendar container */}
      <div style={{ background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
        <div ref={stripRef} style={{ display: "flex", overflowX: "auto", scrollbarWidth: "none" }}>
        {days.map((day, i) => {
          const items = byDay[day.iso] ?? [];
          return (
            <div key={day.iso} style={{ flex: "0 0 132px", display: "flex", flexDirection: "column", borderLeft: i === 0 ? "none" : "1px solid var(--line)" }}>
              {/* Header — date number gets the same wine circle + raised-crisp badge as desktop's today marker */}
              <div className="row" style={{ gap: 6, padding: "8px 8px 9px", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--line)" }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  minWidth: 20, height: 20, borderRadius: "var(--r-button)",
                  fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700,
                  color: day.isToday ? "var(--paper)" : "var(--ink)",
                  background: day.isToday ? "var(--wine)" : "transparent",
                  boxShadow: day.isToday ? "var(--sh-raised-crisp)" : "none",
                }}>
                  {day.dateNum}
                </span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: day.isToday ? "var(--wine)" : "var(--mute-2)", fontWeight: 700 }}>
                  {t(`weekdaysShort.${day.key}`, day.key.charAt(0).toUpperCase() + day.key.slice(1))}
                </span>
              </div>
              {/* Body — flat with a subtle tint for today, matching desktop's DayColumn */}
              <div style={{ flex: 1, padding: 8, display: "flex", flexDirection: "column", gap: 7, minHeight: 96, background: day.isToday ? "rgba(94,34,48,0.045)" : "transparent" }}>
                {items.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 60, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute-2)" }}>—</div>
                ) : (
                  items.map((task) => {
                    const done = task.status === "done";
                    const edgeColor = STATUS_EDGE[task.status ?? "todo"] ?? "var(--mute)";
                    const cat = task.categoryId ? categoryMap.get(task.categoryId) ?? null : null;
                    return (
                      <button
                        key={task.id}
                        onClick={() => onSelect(task.id)}
                        data-testid={`week-task-${task.id}`}
                        style={{
                          textAlign: "left", border: "none", cursor: "pointer", width: "100%",
                          background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", borderRadius: "var(--r-button)",
                          borderLeft: `3px solid ${edgeColor}`,
                          padding: "7px 9px", display: "flex", flexDirection: "column", gap: 3,
                          transition: "box-shadow 120ms",
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", textDecoration: done ? "line-through" : "none", opacity: done ? 0.55 : 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</span>
                        {cat?.name && (
                          <span style={{ fontFamily: "var(--mono)", fontSize: 8, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--mute-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.name}</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
