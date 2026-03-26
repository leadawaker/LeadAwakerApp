import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  RotateCcw,
  PlayCircle,
} from "lucide-react";
import type { ExecutionGroup } from "./hooks/useExecutionGroups";

// ── Status config ────────────────────────────────────────────────────────────
export const STATUS_CONFIG: Record<string, { color: string; icon: any }> = {
  success:  { color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/30 dark:border-emerald-800/50", icon: CheckCircle2 },
  failed:   { color: "text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-900/30 dark:border-rose-800/50", icon: XCircle },
  skipped:  { color: "text-muted-foreground bg-muted/50 border-border", icon: AlertCircle },
  waiting:  { color: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/30 dark:border-amber-800/50", icon: Clock },
  retrying: { color: "text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-900/30 dark:border-indigo-800/50", icon: RotateCcw },
  started:  { color: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/30 dark:border-blue-800/50", icon: PlayCircle },
  error:    { color: "text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-900/30 dark:border-rose-800/50", icon: XCircle },
};

export const STATUS_OPTIONS = [
  { value: "all", labelKey: "filters.allStatuses" },
  { value: "success", labelKey: "filters.success" },
  { value: "failed", labelKey: "filters.failed" },
];

export const STATUS_ICON_HEX: Record<string, string> = {
  success:  "#10B981",
  failed:   "#F43F5E",
  skipped:  "#9CA3AF",
  waiting:  "#F59E0B",
  retrying: "#6366F1",
  started:  "#3B82F6",
  error:    "#F43F5E",
};

export const AUTOMATION_TYPE_COLORS: Record<string, string> = {
  ai_conversation: "text-violet-600 dark:text-violet-400",
  inbound:         "text-teal-600 dark:text-teal-400",
  booking:         "text-emerald-600 dark:text-emerald-400",
  scheduler:       "text-slate-500 dark:text-slate-400",
  campaign:        "text-orange-600 dark:text-orange-400",
  analytics:       "text-cyan-600 dark:text-cyan-400",
  tasks:           "text-indigo-600 dark:text-indigo-400",
  messaging:       "text-sky-600 dark:text-sky-400",
  error_handler:   "text-rose-600 dark:text-rose-400",
  scoring:         "text-amber-600 dark:text-amber-400",
  generic:         "text-muted-foreground",
};

// ── Column definitions ───────────────────────────────────────────────────────
export interface LogColumn { key: string; label: string; width: number; align?: "left" | "right" }

export const COLUMNS_STEPS: LogColumn[] = [
  { key: "expand",    label: "",                    width: 36  },
  { key: "id",        label: "columns.id",          width: 44  },
  { key: "createdAt", label: "columns.createdAt",   width: 130 },
  { key: "status",    label: "",                    width: 36  },
  { key: "workflow",  label: "columns.workflow",    width: 185 },
  { key: "pipeline",  label: "columns.pipeline",    width: 240 },
  { key: "execTime",  label: "columns.execTime",    width: 70  },
  { key: "duration",  label: "columns.duration",    width: 65  },
  { key: "lead",      label: "columns.lead",        width: 160 },
  { key: "campaign",  label: "columns.campaign",    width: 150 },
  { key: "account",   label: "columns.account",     width: 150 },
];

export const COLUMNS_EXECUTIONS: LogColumn[] = [
  { key: "id",        label: "columns.id",          width: 44  },
  { key: "createdAt", label: "columns.createdAt",   width: 130 },
  { key: "status",    label: "",                    width: 36  },
  { key: "workflow",  label: "columns.workflow",    width: 185 },
  { key: "pipeline",  label: "columns.pipeline",    width: 240 },
  { key: "lead",      label: "columns.lead",        width: 160 },
  { key: "campaign",  label: "columns.campaign",    width: 150 },
  { key: "account",   label: "columns.account",     width: 150 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
export function formatExecutionTime(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const num = Number(ms);
  if (isNaN(num)) return "—";
  if (num < 1000) return `${Math.round(num)}ms`;
  return `${(num / 1000).toFixed(2)}s`;
}

export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null) return null;
  const num = Number(seconds);
  if (isNaN(num)) return null;
  return `${num.toFixed(1)}s`;
}

export function formatJson(raw: string | null | undefined): string {
  if (!raw) return "";
  try { return JSON.stringify(JSON.parse(raw), null, 2); }
  catch { return raw; }
}

export function getGroupCurrentStepIdx(group: ExecutionGroup): number {
  const { steps, overallStatus } = group;
  if (overallStatus === "success") return steps.length - 1;
  const failedIdx = steps.findIndex(s => s.status === "failed" || s.status === "error");
  if (failedIdx >= 0) return failedIdx;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].status !== "waiting") return i;
  }
  return 0;
}

export function getLeadName(lead: any): string | null {
  if (!lead) return null;
  const first = lead.firstName || lead.first_name || "";
  const last = lead.lastName || lead.last_name || "";
  const full = [first, last].filter(Boolean).join(" ");
  return full || lead.name || lead.Name || lead.full_name || null;
}
