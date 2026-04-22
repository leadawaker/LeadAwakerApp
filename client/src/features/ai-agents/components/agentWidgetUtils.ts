// ─── Widget resize/drag constants, interfaces, and helper functions ───────────

export const WIDGET_SIZE_KEY = "leadawaker_widget_size";
export const DEFAULT_WIDTH = 400;
export const DEFAULT_HEIGHT = 560;
export const MIN_WIDTH = 320;
export const MIN_HEIGHT = 400;
export const MAX_WIDTH = 800;
export const MAX_HEIGHT = 900;

export const WIDGET_POS_KEY = "leadawaker_widget_pos";
export const DEFAULT_RIGHT = 24;
export const DEFAULT_BOTTOM = 24;

export interface WidgetPos { right: number; bottom: number }
export interface WidgetSize { width: number; height: number }

export function loadWidgetPos(): WidgetPos {
  try {
    const raw = localStorage.getItem(WIDGET_POS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WidgetPos;
      return { right: parsed.right, bottom: parsed.bottom };
    }
  } catch { /* ignore */ }
  return { right: DEFAULT_RIGHT, bottom: DEFAULT_BOTTOM };
}

export function saveWidgetPos(pos: WidgetPos) {
  localStorage.setItem(WIDGET_POS_KEY, JSON.stringify(pos));
}

export function clampPos(pos: WidgetPos, widgetW: number, widgetH: number): WidgetPos {
  const maxRight = Math.max(0, window.innerWidth - widgetW);
  const maxBottom = Math.max(0, window.innerHeight - widgetH);
  return {
    right: Math.max(0, Math.min(maxRight, pos.right)),
    bottom: Math.max(0, Math.min(maxBottom, pos.bottom)),
  };
}

export function loadWidgetSize(): WidgetSize {
  try {
    const raw = localStorage.getItem(WIDGET_SIZE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WidgetSize;
      return {
        width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parsed.width)),
        height: Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, parsed.height)),
      };
    }
  } catch { /* ignore */ }
  return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
}

export function saveWidgetSize(size: WidgetSize) {
  localStorage.setItem(WIDGET_SIZE_KEY, JSON.stringify(size));
}

// ─── Dock mode (right-side dock) ──────────────────────────────────────────────
export const WIDGET_DOCK_ENABLED_KEY = "leadawaker_agent_dock_enabled";
export const WIDGET_DOCK_WIDTH_KEY = "leadawaker_agent_dock_width";
export const DOCK_DEFAULT_WIDTH = 420;
export const DOCK_MIN_WIDTH = 320;
export const DOCK_MAX_WIDTH = 1280;
export const DOCK_BREAKPOINT_PX = 768;

export function loadDockEnabled(): boolean {
  try {
    return localStorage.getItem(WIDGET_DOCK_ENABLED_KEY) === "true";
  } catch { return false; }
}

export function saveDockEnabled(enabled: boolean) {
  try { localStorage.setItem(WIDGET_DOCK_ENABLED_KEY, enabled ? "true" : "false"); } catch {}
}

export function loadDockWidth(): number {
  try {
    const raw = localStorage.getItem(WIDGET_DOCK_WIDTH_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n)) return Math.max(DOCK_MIN_WIDTH, Math.min(DOCK_MAX_WIDTH, n));
    }
  } catch {}
  return DOCK_DEFAULT_WIDTH;
}

export function saveDockWidth(width: number) {
  try { localStorage.setItem(WIDGET_DOCK_WIDTH_KEY, String(width)); } catch {}
}
