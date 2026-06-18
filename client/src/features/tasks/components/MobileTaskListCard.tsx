// MobileTaskListCard.tsx — mobile Tasks primitives (agenda row + board card)
// Restyled to match the migration reference (mobile-tasks.jsx) using the
// design-system.css tokens. Self-contained primitives reused by TasksPage's
// mobile branch: avatars, status pill, checkbox, due label, group bar.
import type { Task, TaskCategory } from "@shared/schema";
import { PRIORITY_COLORS, STATUS_COLORS, type TaskPriority, type TaskStatus } from "../types";

// ── Date helpers (UTC, mirrors the reference) ────────────────────────────────
const MT_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MT_DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toISODate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
export function dueToISO(due: Date | string | null | undefined): string | null {
  if (!due) return null;
  const d = new Date(due as any);
  if (isNaN(d.getTime())) return null;
  return toISODate(d);
}
export function mtParse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function dayDiff(iso: string, todayISO: string): number {
  return Math.round((mtParse(iso).getTime() - mtParse(todayISO).getTime()) / 86400000);
}

// Localised relative-date label. `labels` carries today/tomorrow/yesterday from i18n.
export function formatDue(
  iso: string,
  todayISO: string,
  labels: { today: string; tomorrow: string; yesterday: string },
): string {
  const days = dayDiff(iso, todayISO);
  if (days === 0) return labels.today;
  if (days === 1) return labels.tomorrow;
  if (days === -1) return labels.yesterday;
  const d = mtParse(iso);
  return `${MT_DOW[d.getUTCDay()]} ${MT_MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

// ── Initials ─────────────────────────────────────────────────────────────────
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Deterministic wine-family avatar colour from a name string.
const AVATAR_COLORS = ["#5E2230", "#3D2A66", "#2F5E4A", "#5E4A22", "#7A2E3E"];
export function avatarColor(name: string | null | undefined): string {
  if (!name) return "var(--mute)";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ── Avatar ───────────────────────────────────────────────────────────────────
export function MTAvatar({ name, size = 26 }: { name: string | null | undefined; size?: number }) {
  return (
    <span
      title={name ?? ""}
      style={{
        width: size,
        height: size,
        borderRadius: "var(--r-pill)",
        flexShrink: 0,
        background: avatarColor(name),
        color: "#fff",
        boxShadow: "var(--sh-raised-crisp)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--mono)",
        fontSize: size * 0.36,
        fontWeight: 700,
      }}
    >
      {initials(name)}
    </span>
  );
}

// ── Status pill ──────────────────────────────────────────────────────────────
export function MTStatusPill({ status, label }: { status: TaskStatus; label: string }) {
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.todo;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: "var(--r-pill)",
        background: "var(--surface)",
        color,
        boxShadow: "var(--sh-raised-crisp)",
        fontFamily: "var(--mono)",
        fontSize: 9,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontWeight: 700,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}

// ── Checkbox ─────────────────────────────────────────────────────────────────
function MTCheckGlyph({ s = 13 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 5 5 9-12" />
    </svg>
  );
}

export function MTCheckbox({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      style={{
        width: 24,
        height: 24,
        flexShrink: 0,
        borderRadius: "var(--r-flush)",
        cursor: "pointer",
        padding: 0,
        border: "none",
        background: on ? "var(--good)" : "var(--bg)",
        boxShadow: on ? "var(--sh-raised-crisp)" : "var(--sh-inset-crisp)",
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {on && <MTCheckGlyph />}
    </button>
  );
}

// ── Due label ────────────────────────────────────────────────────────────────
function MTClock({ s = 11 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function MTDue({
  iso,
  todayISO,
  labels,
}: {
  iso: string;
  todayISO: string;
  labels: { today: string; tomorrow: string; yesterday: string };
}) {
  const days = dayDiff(iso, todayISO);
  const overdue = days < 0;
  const soon = days === 0;
  return (
    <span
      style={{
        fontFamily: "var(--mono)",
        fontSize: 10,
        fontWeight: overdue || soon ? 700 : 400,
        color: overdue ? "var(--stage-lost)" : soon ? "var(--wine)" : "var(--mute)",
      }}
    >
      {formatDue(iso, todayISO, labels)}
    </span>
  );
}

// ── Group header bar ─────────────────────────────────────────────────────────
export function MTGroupBar({ label, count, accent }: { label: string; count: number; accent?: string | null }) {
  return (
    <div className="row" style={{ gap: 9, padding: "14px 2px 6px", position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg)', boxShadow: '0 -8px 0 8px var(--bg)' }}>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: accent || "var(--ink-soft)",
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 9,
          color: "var(--mute-2)",
          background: "var(--card)",
          boxShadow: "var(--sh-raised-crisp)",
          borderRadius: "var(--r-pill)",
          padding: "1px 8px",
        }}
      >
        {count}
      </span>
      <div className="rule" style={{ flex: 1 }} />
    </div>
  );
}

// ── Shared props ─────────────────────────────────────────────────────────────
interface RowProps {
  task: Task;
  category: TaskCategory | null;
  todayISO: string;
  dueLabels: { today: string; tomorrow: string; yesterday: string };
  onClick: () => void;
  onToggle: () => void;
}

// ── Agenda row (full-width touch card) ───────────────────────────────────────
export default function MobileTaskListCard({ task, category, todayISO, dueLabels, onClick, onToggle }: RowProps) {
  const priority = (task.priority ?? "medium") as TaskPriority;
  const status = (task.status ?? "todo") as TaskStatus;
  const done = status === "done";
  const catColor = category?.color || "var(--mute-2)";
  const dueISO = dueToISO(task.dueDate);

  return (
    <div
      onClick={onClick}
      data-testid="mobile-task-card"
      style={{
        width: "100%",
        textAlign: "left",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: "12px 14px",
        borderRadius: "var(--r-card)",
        minHeight: 60,
        borderLeft: `3px solid ${catColor}`,
        background: "var(--surface)",
        boxShadow: "var(--sh-raised-crisp)",
      }}
    >
      <MTCheckbox on={done} onToggle={onToggle} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: done ? "var(--mute-2)" : "var(--ink)",
            textDecoration: done ? "line-through" : "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {task.emoji ? `${task.emoji} ` : ""}
          {task.title}
        </div>
        <div className="row" style={{ gap: 9, marginTop: 4 }}>
          <span className="row" style={{ gap: 5 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.medium,
                flexShrink: 0,
              }}
            />
            {dueISO && <MTDue iso={dueISO} todayISO={todayISO} labels={dueLabels} />}
          </span>
        </div>
      </div>
      {task.assigneeName && <MTAvatar name={task.assigneeName} size={26} />}
    </div>
  );
}

// ── Board card (compact) ─────────────────────────────────────────────────────
export function MobileTaskBoardCard({ task, category, todayISO, dueLabels, onClick }: Omit<RowProps, "onToggle">) {
  const priority = (task.priority ?? "medium") as TaskPriority;
  const status = (task.status ?? "todo") as TaskStatus;
  const done = status === "done";
  const catColor = category?.color || "var(--mute-2)";
  const dueISO = dueToISO(task.dueDate);

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="mobile-task-board-card"
      style={{
        width: "100%",
        textAlign: "left",
        border: "none",
        cursor: "pointer",
        background: "var(--card)",
        borderRadius: "var(--r-surface)",
        padding: "12px 13px",
        borderLeft: `3px solid ${catColor}`,
        boxShadow: "var(--sh-raised-crisp)",
        display: "block",
      }}
    >
      <div className="row" style={{ alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink)",
            textDecoration: done ? "line-through" : "none",
            lineHeight: 1.3,
          }}
        >
          {task.emoji ? `${task.emoji} ` : ""}
          {task.title}
        </span>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.medium,
            flexShrink: 0,
            marginTop: 5,
          }}
        />
      </div>
      <div className="row" style={{ justifyContent: "space-between", gap: 8, marginTop: 11 }}>
        <span className="row" style={{ gap: 6, minWidth: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: catColor, flexShrink: 0 }} />
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 8.5,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--mute)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {category?.name || ""}
          </span>
        </span>
        <span className="row" style={{ gap: 7, flexShrink: 0 }}>
          {dueISO && (
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)" }}>
              {formatDue(dueISO, todayISO, dueLabels)}
            </span>
          )}
          {task.assigneeName && <MTAvatar name={task.assigneeName} size={22} />}
        </span>
      </div>
    </button>
  );
}
