// How the test panel shows the tools a receptionist ran: one tag (icon, tone, label key)
// per known tool, a neutral tag for any other, and the pure helpers that place tools
// between transcript lines and read "what she understood" from update_call_summary.
// No React: ToolTag.tsx draws the tag, the transcripts call the helpers.
import {
  CalendarCheck, CalendarClock, CalendarX, Car, ClipboardList, PhoneCall, PhoneOff, Search, Wrench,
  type LucideIcon,
} from "lucide-react";

export interface ToolTagSpec {
  /** Locale key under `test.tools.` (the tool's own name), or "other" for an unknown tool. */
  key: string;
  icon: LucideIcon;
  /** A full color token (never a raw color): the tag tints itself from it. */
  tone: string;
  known: boolean;
  /** The raw name humanized: the label of an unknown tool, the fallback of a known one. */
  label: string;
}

type Known = { icon: LucideIcon; tone: string };

const KNOWN: Record<string, Known> = {
  search_stock: { icon: Search, tone: "var(--stage-contacted)" },
  car_details: { icon: Car, tone: "var(--stage-responded)" },
  check_availability: { icon: CalendarClock, tone: "var(--stage-new)" },
  book_appointment: { icon: CalendarCheck, tone: "var(--good)" },
  cancel_appointment: { icon: CalendarX, tone: "var(--stage-lost)" },
  request_callback: { icon: PhoneCall, tone: "var(--stage-booked)" },
  update_call_summary: { icon: ClipboardList, tone: "var(--wine)" },
  end_call: { icon: PhoneOff, tone: "var(--mute)" },
};

const NEUTRAL: Known = { icon: Wrench, tone: "var(--mute)" };

/** "get_opening_hours", "getOpeningHours" and "get-opening-hours" all give "Get opening hours". */
export function humanizeTool(name: string): string {
  const words = (name ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-.\s]+/g, " ")
    .trim()
    .toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : "";
}

/** Case, spaces and a namespace ("functions.") do not change which tool it is. */
function bare(name: string): string {
  const n = (name ?? "").trim();
  return n.slice(n.lastIndexOf(".") + 1);
}
const normalize = (name: string): string => bare(name).toLowerCase();

export function toolTag(name: string): ToolTagSpec {
  const id = normalize(name);
  const hit = Object.prototype.hasOwnProperty.call(KNOWN, id) ? KNOWN[id] : null;
  const label = humanizeTool(bare(name));
  if (hit) return { key: id, icon: hit.icon, tone: hit.tone, known: true, label };
  return { key: "other", icon: NEUTRAL.icon, tone: NEUTRAL.tone, known: false, label };
}

// --- tools between transcript lines -------------------------------------------------

export type TimelineItem<T, U> =
  | { kind: "turn"; turn: T; key: number }
  | { kind: "tool"; tool: U; key: number };

/**
 * Review: tools sit between the turns around their `atS`. A tool at the same second as a
 * turn comes after it; tools before the first turn lead, tools after the last trail.
 * Turns keep their order, tools at one time keep theirs.
 */
export function insertToolsByTime<T extends { atS: number }, U extends { atS: number }>(
  turns: readonly T[], tools: readonly U[],
): TimelineItem<T, U>[] {
  const queue = tools.map((tool, key) => ({ tool, key })).sort((a, b) => a.tool.atS - b.tool.atS || a.key - b.key);
  const out: TimelineItem<T, U>[] = [];
  let q = 0;
  turns.forEach((turn, key) => {
    while (q < queue.length && queue[q].tool.atS < turn.atS) { out.push({ kind: "tool", ...queue[q] }); q++; }
    out.push({ kind: "turn", turn, key });
  });
  while (q < queue.length) { out.push({ kind: "tool", ...queue[q] }); q++; }
  return out;
}

/**
 * Live: a tool carries how many transcript lines existed when it fired (`afterLines`) and
 * sits right after them. Out-of-range counts clamp to the ends; same count keeps tool order.
 */
export function insertToolsAfterLines<T, U extends { afterLines: number }>(
  lines: readonly T[], tools: readonly U[],
): TimelineItem<T, U>[] {
  const at = (n: number) => Math.min(lines.length, Math.max(0, Number.isFinite(n) ? Math.floor(n) : lines.length));
  const queue = tools.map((tool, key) => ({ tool, key, at: at(tool.afterLines) })).sort((a, b) => a.at - b.at || a.key - b.key);
  const out: TimelineItem<T, U>[] = [];
  let q = 0;
  for (let i = 0; i <= lines.length; i++) {
    while (q < queue.length && queue[q].at <= i) { out.push({ kind: "tool", tool: queue[q].tool, key: queue[q].key }); q++; }
    if (i < lines.length) out.push({ kind: "turn", turn: lines[i], key: i });
  }
  return out;
}

// --- what she understood ---------------------------------------------------------------

export interface UnderstoodItem { intent: string; interest: string; notes: string }

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function itemOf(v: unknown): UnderstoodItem | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const intent = str(o.intent);
  return intent ? { intent, interest: str(o.interest), notes: str(o.notes) } : null;
}

/**
 * The recap inside an `update_call_summary` call: a list (`items`, as the GPT Live tool
 * sends it) or one flat intent / interest / notes. Args may arrive as a JSON string.
 */
export function understoodFromArgs(args: unknown): UnderstoodItem[] {
  let v = args;
  if (typeof v === "string") {
    try { v = JSON.parse(v); } catch { return []; }
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return [];
  const items = (v as Record<string, unknown>).items;
  if (Array.isArray(items)) return items.map(itemOf).filter((x): x is UnderstoodItem => x !== null);
  const flat = itemOf(v);
  return flat ? [flat] : [];
}

/** The newest update_call_summary that says something, or null. */
export function latestUnderstood(tools: readonly { name: string; args?: unknown; pending?: boolean }[]): UnderstoodItem[] | null {
  for (let i = tools.length - 1; i >= 0; i--) {
    if (normalize(tools[i].name) !== "update_call_summary") continue;
    const items = understoodFromArgs(tools[i].args);
    if (items.length) return items;
  }
  return null;
}
