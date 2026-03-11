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
  /** If provided, steps 0..currentStepIndex are colored (gradient), rest are gray */
  currentStepIndex?: number;
  className?: string;
  /** Automation type id — selects the matching color palette */
  automationTypeId?: string;
}

// ── Dark mode detection ───────────────────────────────────────────────────────
function isDarkMode(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

// ── Per-type gradient palettes: near-black → mid → accent ────────────────────
type ColorStop = { t: number; r: number; g: number; b: number };

const TYPE_COLOR_STOPS: Record<string, ColorStop[]> = {
  ai_conversation: [
    { t: 0,   r: 10,  g: 10,  b: 10  }, // near-black
    { t: 0.5, r: 91,  g: 33,  b: 182 }, // violet-800
    { t: 1.0, r: 139, g: 92,  b: 246 }, // violet-500
  ],
  inbound: [
    { t: 0,   r: 10,  g: 10,  b: 10  }, // near-black
    { t: 0.5, r: 17,  g: 94,  b: 89  }, // teal-800
    { t: 1.0, r: 20,  g: 184, b: 166 }, // teal-500
  ],
  booking: [
    { t: 0,   r: 10,  g: 10,  b: 10  }, // near-black
    { t: 0.5, r: 6,   g: 78,  b: 59  }, // emerald-800
    { t: 1.0, r: 52,  g: 211, b: 153 }, // emerald-400
  ],
  scheduler: [
    { t: 0,   r: 10,  g: 10,  b: 10  }, // near-black
    { t: 0.5, r: 51,  g: 65,  b: 85  }, // slate-700
    { t: 1.0, r: 148, g: 163, b: 184 }, // slate-400
  ],
  campaign: [
    { t: 0,   r: 10,  g: 10,  b: 10  }, // near-black
    { t: 0.5, r: 154, g: 52,  b: 18  }, // orange-800
    { t: 1.0, r: 249, g: 115, b: 22  }, // orange-500
  ],
  analytics: [
    { t: 0,   r: 10,  g: 10,  b: 10  }, // near-black
    { t: 0.5, r: 21,  g: 94,  b: 117 }, // cyan-800
    { t: 1.0, r: 6,   g: 182, b: 212 }, // cyan-500
  ],
  tasks: [
    { t: 0,   r: 10,  g: 10,  b: 10  }, // near-black
    { t: 0.5, r: 55,  g: 48,  b: 163 }, // indigo-800
    { t: 1.0, r: 99,  g: 102, b: 241 }, // indigo-500
  ],
  messaging: [
    { t: 0,   r: 10,  g: 10,  b: 10  }, // near-black
    { t: 0.5, r: 7,   g: 89,  b: 133 }, // sky-800
    { t: 1.0, r: 14,  g: 165, b: 233 }, // sky-500
  ],
  error_handler: [
    { t: 0,   r: 10,  g: 10,  b: 10  }, // near-black
    { t: 0.5, r: 159, g: 18,  b: 57  }, // rose-800
    { t: 1.0, r: 244, g: 63,  b: 94  }, // rose-500
  ],
  scoring: [
    { t: 0,   r: 10,  g: 10,  b: 10  }, // near-black
    { t: 0.5, r: 146, g: 64,  b: 14  }, // amber-800
    { t: 1.0, r: 245, g: 158, b: 11  }, // amber-500
  ],
};

const DEFAULT_STOPS: ColorStop[] = [
  { t: 0,   r: 10,  g: 10,  b: 10  }, // near-black
  { t: 0.5, r: 30,  g: 64,  b: 175 }, // blue-800
  { t: 1.0, r: 59,  g: 130, b: 246 }, // blue-500
];

// ── Position-based gradient ───────────────────────────────────────────────────
export function getGradientColor(index: number, total: number, typeId?: string): string {
  const stops = (typeId && TYPE_COLOR_STOPS[typeId]) ? TYPE_COLOR_STOPS[typeId] : DEFAULT_STOPS;
  const t = total <= 1 ? 1 : index / (total - 1);
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].t && t <= stops[i + 1].t) {
      lo = stops[i]; hi = stops[i + 1]; break;
    }
  }
  const seg = (hi.t - lo.t) === 0 ? 1 : (t - lo.t) / (hi.t - lo.t);
  const r = Math.round(lo.r + (hi.r - lo.r) * seg);
  const g = Math.round(lo.g + (hi.g - lo.g) * seg);
  const b = Math.round(lo.b + (hi.b - lo.b) * seg);
  return `rgb(${r},${g},${b})`;
}

// ── Status → Color mapping (used when no currentStepIndex is provided) ────────
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
export function ExecutionProgressBar({ steps, compact, currentStepIndex, className, automationTypeId }: ExecutionProgressBarProps) {
  const dark = isDarkMode();
  const useGradient = currentStepIndex !== undefined;
  const emptyColor = dark ? "#374151" : "#E5E7EB";

  return (
    <div
      className={cn(
        compact ? "h-3" : "h-4",
        "rounded-full overflow-hidden flex gap-px",
        className,
      )}
    >
      {steps.map((step, i) => {
        let color: string;
        if (useGradient) {
          color = i <= currentStepIndex! ? getGradientColor(i, steps.length, automationTypeId) : emptyColor;
        } else {
          color = getStatusColor(step.status, dark);
        }
        return (
          <div
            key={i}
            style={{ flex: 1, minWidth: 4, backgroundColor: color }}
            title={`${step.stepName} — ${formatTime(step.executionTimeMs)}`}
          />
        );
      })}
    </div>
  );
}
