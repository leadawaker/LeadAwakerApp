import type { Task } from "@shared/schema";
import {
  PhoneForwarded,
  Phone,
  ClipboardCheck,
  Settings,
  Pencil,
  type LucideIcon,
} from "lucide-react";

// Re-export the DB type
export type { Task };

// ─── Status ──────────────────────────────────────────────────────────
export const TASK_STATUSES = ["todo", "in_progress", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

export const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "#6B7280",
  in_progress: "#3B82F6",
  done: "#10B981",
  cancelled: "#9CA3AF",
};

// ─── Priority ────────────────────────────────────────────────────────
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "#9CA3AF",
  medium: "#3B82F6",
  high: "#F59E0B",
  urgent: "#EF4444",
};

// ─── Task Type ───────────────────────────────────────────────────────
export const TASK_TYPES = ["follow_up", "call", "review", "admin", "custom"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: "follow_up", label: "Follow Up" },
  { value: "call", label: "Call" },
  { value: "review", label: "Review" },
  { value: "admin", label: "Admin" },
  { value: "custom", label: "Custom" },
];

export const TYPE_ICONS: Record<TaskType, LucideIcon> = {
  follow_up: PhoneForwarded,
  call: Phone,
  review: ClipboardCheck,
  admin: Settings,
  custom: Pencil,
};

// ─── Tags ───────────────────────────────────────────────────────
export const TASK_TAG_PRESETS = [
  // Development
  "Frontend", "Backend", "Database", "API", "DevOps",
  // Design
  "Design", "UI/UX", "Branding",
  // Business
  "Marketing", "Sales", "Support", "Finance",
  // General
  "Bug", "Feature", "Docs", "Research", "Urgent", "Review",
] as const;

export type TaskTag = (typeof TASK_TAG_PRESETS)[number];

/** Tag color palette — maps each tag to a [bg, text] pair for light mode.
 *  Dark mode inverts opacity automatically via dark: variants in the component. */
export const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  Frontend:   { bg: "#DBEAFE", text: "#1E40AF" },  // blue
  Backend:    { bg: "#D1FAE5", text: "#065F46" },  // emerald
  Database:   { bg: "#FEF3C7", text: "#92400E" },  // amber
  API:        { bg: "#E0E7FF", text: "#3730A3" },  // indigo
  DevOps:     { bg: "#F3E8FF", text: "#6B21A8" },  // purple
  Design:     { bg: "#FCE7F3", text: "#9D174D" },  // pink
  "UI/UX":    { bg: "#FDF2F8", text: "#BE185D" },  // rose
  Branding:   { bg: "#FFF7ED", text: "#C2410C" },  // orange
  Marketing:  { bg: "#ECFDF5", text: "#047857" },  // green
  Sales:      { bg: "#EFF6FF", text: "#1D4ED8" },  // blue-700
  Support:    { bg: "#F0FDF4", text: "#15803D" },  // green-700
  Finance:    { bg: "#FFFBEB", text: "#B45309" },  // amber-700
  Bug:        { bg: "#FEE2E2", text: "#991B1B" },  // red
  Feature:    { bg: "#DBEAFE", text: "#1E3A8A" },  // blue-900
  Docs:       { bg: "#F1F5F9", text: "#475569" },  // slate
  Research:   { bg: "#EDE9FE", text: "#5B21B6" },  // violet
  Urgent:     { bg: "#FEE2E2", text: "#DC2626" },  // red-600
  Review:     { bg: "#FEF9C3", text: "#854D0E" },  // yellow
};

export const TAG_COLORS_DARK: Record<string, { bg: string; text: string }> = {
  Frontend:   { bg: "rgba(59,130,246,0.15)", text: "#93C5FD" },
  Backend:    { bg: "rgba(16,185,129,0.15)", text: "#6EE7B7" },
  Database:   { bg: "rgba(245,158,11,0.15)", text: "#FCD34D" },
  API:        { bg: "rgba(99,102,241,0.15)", text: "#A5B4FC" },
  DevOps:     { bg: "rgba(139,92,246,0.15)", text: "#C4B5FD" },
  Design:     { bg: "rgba(236,72,153,0.15)", text: "#F9A8D4" },
  "UI/UX":    { bg: "rgba(244,114,182,0.15)", text: "#FBCFE8" },
  Branding:   { bg: "rgba(249,115,22,0.15)", text: "#FDBA74" },
  Marketing:  { bg: "rgba(5,150,105,0.15)",  text: "#6EE7B7" },
  Sales:      { bg: "rgba(29,78,216,0.15)",  text: "#93C5FD" },
  Support:    { bg: "rgba(21,128,61,0.15)",  text: "#86EFAC" },
  Finance:    { bg: "rgba(180,83,9,0.15)",   text: "#FCD34D" },
  Bug:        { bg: "rgba(220,38,38,0.15)",  text: "#FCA5A5" },
  Feature:    { bg: "rgba(30,58,138,0.15)",  text: "#93C5FD" },
  Docs:       { bg: "rgba(100,116,139,0.15)",text: "#CBD5E1" },
  Research:   { bg: "rgba(91,33,182,0.15)",  text: "#C4B5FD" },
  Urgent:     { bg: "rgba(220,38,38,0.2)",   text: "#FCA5A5" },
  Review:     { bg: "rgba(202,138,4,0.15)",  text: "#FDE68A" },
};

/** Priority badge colors — [bg, text] for pill display on cards */
export const PRIORITY_BADGE: Record<TaskPriority, { bg: string; text: string; bgDark: string; textDark: string }> = {
  low:    { bg: "#F1F5F9", text: "#64748B", bgDark: "rgba(100,116,139,0.15)", textDark: "#94A3B8" },
  medium: { bg: "#DBEAFE", text: "#2563EB", bgDark: "rgba(37,99,235,0.15)",   textDark: "#93C5FD" },
  high:   { bg: "#FEF3C7", text: "#D97706", bgDark: "rgba(217,119,6,0.15)",   textDark: "#FCD34D" },
  urgent: { bg: "#FEE2E2", text: "#DC2626", bgDark: "rgba(220,38,38,0.2)",    textDark: "#FCA5A5" },
};

/** Parse tags JSON string from DB into array */
export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((t: unknown) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

// ─── View Mode ──────────────────────────────────────────────────────
export const VIEW_MODES = ["kanban", "table", "gantt"] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

// ─── Sort / Filter / Group ───────────────────────────────────────────
export const SORT_OPTIONS = [
  { value: "due_date_asc", label: "Due date (earliest)" },
  { value: "due_date_desc", label: "Due date (latest)" },
  { value: "priority_desc", label: "Priority (highest)" },
  { value: "priority_asc", label: "Priority (lowest)" },
  { value: "category_asc", label: "Category A-Z" },
  { value: "category_desc", label: "Category Z-A" },
  { value: "id_asc", label: "ID (lowest)" },
  { value: "id_desc", label: "ID (highest)" },
  { value: "created_desc", label: "Newest first" },
  { value: "created_asc", label: "Oldest first" },
  { value: "title_asc", label: "Title A-Z" },
  { value: "title_desc", label: "Title Z-A" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export const GROUP_OPTIONS = [
  { value: "none", label: "No grouping" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "taskType", label: "Type" },
  { value: "category", label: "Category" },
  { value: "assigneeName", label: "Assignee" },
  { value: "accountName", label: "Account" },
] as const;

export type GroupOption = (typeof GROUP_OPTIONS)[number]["value"];

// ─── Helpers ─────────────────────────────────────────────────────────
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const STATUS_RANK: Record<string, number> = { todo: 0, in_progress: 1, done: 2, cancelled: 3 };

export function sortTasks(tasks: Task[], sort: SortOption): Task[] {
  const copy = [...tasks];
  switch (sort) {
    case "due_date_asc":
      return copy.sort((a, b) => new Date(a.dueDate ?? "9999").getTime() - new Date(b.dueDate ?? "9999").getTime());
    case "due_date_desc":
      return copy.sort((a, b) => new Date(b.dueDate ?? 0).getTime() - new Date(a.dueDate ?? 0).getTime());
    case "priority_desc":
      return copy.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9));
    case "priority_asc":
      return copy.sort((a, b) => (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0));
    case "category_asc":
      return copy.sort((a, b) => ((a as any).categoryId ?? 999) - ((b as any).categoryId ?? 999));
    case "category_desc":
      return copy.sort((a, b) => ((b as any).categoryId ?? 0) - ((a as any).categoryId ?? 0));
    case "id_asc":
      return copy.sort((a, b) => a.id - b.id);
    case "id_desc":
      return copy.sort((a, b) => b.id - a.id);
    case "created_desc":
      return copy.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    case "created_asc":
      return copy.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
    case "title_asc":
      return copy.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
    case "title_desc":
      return copy.sort((a, b) => (b.title ?? "").localeCompare(a.title ?? ""));
    default:
      return copy;
  }
}

export function groupTasks(tasks: Task[], groupBy: GroupOption): Map<string, Task[]> {
  if (groupBy === "none") return new Map([["All", tasks]]);
  const map = new Map<string, Task[]>();
  if (groupBy === "category") {
    for (const t of tasks) {
      const key = String((t as any).categoryId ?? "Unassigned");
      const arr = map.get(key);
      if (arr) arr.push(t);
      else map.set(key, [t]);
    }
    return map;
  }
  for (const t of tasks) {
    const key = String((t as any)[groupBy] ?? "Unassigned");
    const arr = map.get(key);
    if (arr) arr.push(t);
    else map.set(key, [t]);
  }
  // Sort group keys by rank if status/priority
  if (groupBy === "status") {
    return new Map(Array.from(map.entries()).sort(([a], [b]) => (STATUS_RANK[a] ?? 9) - (STATUS_RANK[b] ?? 9)));
  }
  if (groupBy === "priority") {
    return new Map(Array.from(map.entries()).sort(([a], [b]) => (PRIORITY_RANK[a] ?? 9) - (PRIORITY_RANK[b] ?? 9)));
  }
  return map;
}
