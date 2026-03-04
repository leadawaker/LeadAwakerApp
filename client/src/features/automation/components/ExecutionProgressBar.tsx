import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
export interface ProgressBarStep {
  stepName: string;
  status: string;
  executionTimeMs: number | null;
}

interface ExecutionProgressBarProps {
  steps: ProgressBarStep[];
  compact?: boolean;
  className?: string;
}

// ── Dark mode detection (mirrors avatarUtils.isDarkMode) ─────────────────────
function isDarkMode(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

// ── Status → Color mapping ───────────────────────────────────────────────────
const STATUS_COLORS_LIGHT: Record<string, string> = {
  success:  "#10B981",
  failed:   "#F43F5E",
  error:    "#F43F5E",
  skipped:  "#D1D5DB",
  waiting:  "#F59E0B",
  retrying: "#6366F1",
  started:  "#3B82F6",
};

const STATUS_COLORS_DARK: Record<string, string> = {
  success:  "#059669",
  failed:   "#E11D48",
  error:    "#E11D48",
  skipped:  "#4B5563",
  waiting:  "#D97706",
  retrying: "#4F46E5",
  started:  "#2563EB",
};

function getStatusColor(status: string, dark: boolean): string {
  const map = dark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;
  return map[status.toLowerCase()] ?? (dark ? "#4B5563" : "#D1D5DB");
}

// ── Time formatting ──────────────────────────────────────────────────────────
function formatTime(ms: number | null): string {
  if (ms === null) return "\u2014";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ── Component ────────────────────────────────────────────────────────────────
export function ExecutionProgressBar({ steps, compact, className }: ExecutionProgressBarProps) {
  const dark = isDarkMode();

  return (
    <div
      className={cn(
        compact ? "h-1.5" : "h-2",
        "rounded-full overflow-hidden flex gap-px",
        className,
      )}
    >
      {steps.map((step, i) => (
        <div
          key={i}
          style={{ flex: 1, minWidth: 4, backgroundColor: getStatusColor(step.status, dark) }}
          title={`${step.stepName} \u2014 ${step.status} (${formatTime(step.executionTimeMs)})`}
        />
      ))}
    </div>
  );
}
