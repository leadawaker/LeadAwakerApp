/**
 * Color Picker Widget — temporary dev tool for testing colors in real-time.
 * Floats on the right edge of the screen. Click any swatch to open an inline
 * HSV picker (saturation/brightness square + hue bar) — no intermediate step.
 */
import { useState, useEffect, useCallback, useRef, type PointerEvent as RPointerEvent } from "react";
import { X, RotateCcw } from "lucide-react";
import { PIPELINE_HEX, LEAD_AVATAR_BG, LEAD_AVATAR_TEXT, refreshLeadAvatarColors } from "@/lib/avatarUtils";

/* ── Color math ── */

function hslCssToHex(hslStr: string): string {
  const parts = hslStr.trim().split(/\s+/);
  if (parts.length < 3) return "#888888";
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHslCss(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Hex → HSV (h 0-360, s 0-1, v 0-1) */
function hexToHsv(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

/** HSV → Hex */
function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/* ── Inline HSV Picker ── */

const SQ = 160; // square size
const BAR_H = 14; // hue bar height

function HsvPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(value));
  const sqRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Sync if external value changes
  useEffect(() => { setHsv(hexToHsv(value)); }, [value]);

  const emit = useCallback((h: number, s: number, v: number) => {
    setHsv([h, s, v]);
    onChange(hsvToHex(h, s, v));
  }, [onChange]);

  /* ── Square drag (saturation x, brightness y) ── */
  const handleSqPointer = useCallback((e: RPointerEvent<HTMLDivElement>) => {
    const rect = sqRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    emit(hsv[0], x, 1 - y);
  }, [emit, hsv]);

  const onSqDown = useCallback((e: RPointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleSqPointer(e);
  }, [handleSqPointer]);

  /* ── Hue bar drag ── */
  const handleBarPointer = useCallback((e: RPointerEvent<HTMLDivElement>) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    emit(x * 360, hsv[1], hsv[2]);
  }, [emit, hsv]);

  const onBarDown = useCallback((e: RPointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleBarPointer(e);
  }, [handleBarPointer]);

  const hueColor = `hsl(${hsv[0]}, 100%, 50%)`;

  return (
    <div className="flex flex-col gap-1.5 py-1.5">
      {/* SV Square */}
      <div
        ref={sqRef}
        className="relative cursor-crosshair rounded-md overflow-hidden"
        style={{ width: SQ, height: SQ }}
        onPointerDown={onSqDown}
        onPointerMove={(e) => { if (e.buttons > 0) handleSqPointer(e); }}
      >
        {/* Base hue layer */}
        <div className="absolute inset-0" style={{ background: hueColor }} />
        {/* White → transparent (left to right = low saturation → high) */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, #fff, transparent)" }} />
        {/* Transparent → black (top to bottom = high value → low) */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent, #000)" }} />
        {/* Cursor */}
        <div
          className="absolute w-3 h-3 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: hsv[1] * SQ, top: (1 - hsv[2]) * SQ }}
        />
      </div>

      {/* Hue bar */}
      <div
        ref={barRef}
        className="relative cursor-pointer rounded-full overflow-hidden"
        style={{
          width: SQ,
          height: BAR_H,
          background: "linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))",
        }}
        onPointerDown={onBarDown}
        onPointerMove={(e) => { if (e.buttons > 0) handleBarPointer(e); }}
      >
        {/* Hue cursor */}
        <div
          className="absolute top-0 bottom-0 w-2.5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)] -translate-x-1/2 pointer-events-none"
          style={{ left: (hsv[0] / 360) * SQ }}
        />
      </div>
    </div>
  );
}

/* ── Color definitions ── */

interface ColorEntry {
  label: string;
  id: string;
  type: "css" | "pipeline" | "avatar";
  cssVars?: string[];
  pipelineKey?: string;
  avatarKey?: string;
}

const COLOR_GROUPS: { title: string; entries: ColorEntry[] }[] = [
  {
    title: "Surfaces",
    entries: [
      { label: "Background", id: "bg", type: "css", cssVars: ["--background", "--bg-main", "--sidebar-bg"] },
      { label: "Card", id: "card", type: "css", cssVars: ["--card"] },
      { label: "Card Hover", id: "card-hover", type: "css", cssVars: ["--card-hover"] },
      { label: "Muted", id: "muted", type: "css", cssVars: ["--muted", "--secondary", "--input"] },
      { label: "Popover", id: "popover", type: "css", cssVars: ["--popover"] },
      { label: "Input Bg", id: "input-bg", type: "css", cssVars: ["--input-bg"] },
    ],
  },
  {
    title: "Text & Borders",
    entries: [
      { label: "Foreground", id: "fg", type: "css", cssVars: ["--foreground", "--card-foreground", "--popover-foreground"] },
      { label: "Muted Text", id: "muted-fg", type: "css", cssVars: ["--muted-foreground"] },
      { label: "Border", id: "border", type: "css", cssVars: ["--border"] },
    ],
  },
  {
    title: "Brand",
    entries: [
      { label: "Indigo", id: "indigo", type: "css", cssVars: ["--brand-indigo", "--brand-blue", "--primary", "--ring", "--sidebar-active", "--info"] },
      { label: "Yellow", id: "yellow", type: "css", cssVars: ["--brand-yellow"] },
      { label: "Deep Blue", id: "deep-blue", type: "css", cssVars: ["--brand-deep-blue"] },
      { label: "Soft Yellow", id: "soft-yellow", type: "css", cssVars: ["--brand-soft-yellow"] },
      { label: "Indian Yellow", id: "indian-yellow", type: "css", cssVars: ["--brand-indian-yellow"] },
    ],
  },
  {
    title: "Highlights",
    entries: [
      { label: "Active", id: "hl-active", type: "css", cssVars: ["--highlight-active"] },
      { label: "Selected", id: "hl-selected", type: "css", cssVars: ["--highlight-selected"] },
      { label: "Hover", id: "hl-hover", type: "css", cssVars: ["--highlight-hover"] },
    ],
  },
  {
    title: "Semantic",
    entries: [
      { label: "Destructive", id: "destructive", type: "css", cssVars: ["--destructive"] },
      { label: "Success", id: "success", type: "css", cssVars: ["--success"] },
      { label: "Accent", id: "accent", type: "css", cssVars: ["--accent"] },
    ],
  },
  {
    title: "Pipeline Status",
    entries: [
      { label: "New", id: "p-new", type: "pipeline", pipelineKey: "New" },
      { label: "Contacted", id: "p-contacted", type: "pipeline", pipelineKey: "Contacted" },
      { label: "Responded", id: "p-responded", type: "pipeline", pipelineKey: "Responded" },
      { label: "Multi Resp.", id: "p-multi", type: "pipeline", pipelineKey: "Multiple Responses" },
      { label: "Qualified", id: "p-qualified", type: "pipeline", pipelineKey: "Qualified" },
      { label: "Booked", id: "p-booked", type: "pipeline", pipelineKey: "Booked" },
      { label: "Closed", id: "p-closed", type: "pipeline", pipelineKey: "Closed" },
      { label: "Lost", id: "p-lost", type: "pipeline", pipelineKey: "Lost" },
      { label: "DND", id: "p-dnd", type: "pipeline", pipelineKey: "DND" },
    ],
  },
  {
    title: "Lead Avatars (pastel bg)",
    entries: [
      { label: "New", id: "a-new", type: "avatar", avatarKey: "New" },
      { label: "Contacted", id: "a-contacted", type: "avatar", avatarKey: "Contacted" },
      { label: "Responded", id: "a-responded", type: "avatar", avatarKey: "Responded" },
      { label: "Multi Resp.", id: "a-multi", type: "avatar", avatarKey: "Multiple Responses" },
      { label: "Qualified", id: "a-qualified", type: "avatar", avatarKey: "Qualified" },
      { label: "Booked", id: "a-booked", type: "avatar", avatarKey: "Booked" },
      { label: "Closed", id: "a-closed", type: "avatar", avatarKey: "Closed" },
      { label: "Lost", id: "a-lost", type: "avatar", avatarKey: "Lost" },
      { label: "DND", id: "a-dnd", type: "avatar", avatarKey: "DND" },
    ],
  },
];

/* ── Helpers ── */

function readCurrentColors(): Record<string, string> {
  const computed = getComputedStyle(document.documentElement);
  const result: Record<string, string> = {};
  for (const group of COLOR_GROUPS) {
    for (const entry of group.entries) {
      if (entry.type === "css" && entry.cssVars) {
        const val = computed.getPropertyValue(entry.cssVars[0]).trim();
        result[entry.id] = val ? hslCssToHex(val) : "#888888";
      } else if (entry.type === "pipeline" && entry.pipelineKey) {
        result[entry.id] = PIPELINE_HEX[entry.pipelineKey] || "#888888";
      } else if (entry.type === "avatar" && entry.avatarKey) {
        result[entry.id] = LEAD_AVATAR_BG[entry.avatarKey] || "#888888";
      }
    }
  }
  return result;
}

/* ── Main widget ── */

export function ColorPickerWidget({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [colors, setColors] = useState<Record<string, string>>({});
  const [originals, setOriginals] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const initial = readCurrentColors();
    setColors(initial);
    setOriginals(initial);
    setActiveId(null);
  }, [open]);

  const handleChange = useCallback((id: string, hex: string) => {
    setColors((prev) => ({ ...prev, [id]: hex }));
    for (const group of COLOR_GROUPS) {
      const entry = group.entries.find((e) => e.id === id);
      if (!entry) continue;
      if (entry.type === "css" && entry.cssVars) {
        const hsl = hexToHslCss(hex);
        for (const cssVar of entry.cssVars) {
          document.documentElement.style.setProperty(cssVar, hsl);
        }
      } else if (entry.type === "pipeline" && entry.pipelineKey) {
        PIPELINE_HEX[entry.pipelineKey] = hex;
      } else if (entry.type === "avatar" && entry.avatarKey) {
        LEAD_AVATAR_BG[entry.avatarKey] = hex;
      }
      break;
    }
    // Notify React tree to re-render with updated JS-based colors
    window.dispatchEvent(new Event("color-tester-update"));
  }, []);

  const handleReset = useCallback(() => {
    for (const group of COLOR_GROUPS) {
      for (const entry of group.entries) {
        if (entry.type === "css" && entry.cssVars) {
          for (const cssVar of entry.cssVars) {
            document.documentElement.style.removeProperty(cssVar);
          }
        } else if (entry.type === "pipeline" && entry.pipelineKey && originals[entry.id]) {
          PIPELINE_HEX[entry.pipelineKey] = originals[entry.id];
        } else if (entry.type === "avatar" && entry.avatarKey) {
          // Will be recalculated below
        }
      }
    }
    // Recalculate pastel avatars from (restored) pipeline colors
    refreshLeadAvatarColors();
    const fresh = readCurrentColors();
    setColors(fresh);
    setOriginals(fresh);
    setActiveId(null);
  }, [originals]);

  if (!open) return null;

  return (
    <div
      className="fixed right-3 bottom-3 z-[9999] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
      style={{ width: 272, maxHeight: "calc(100vh - 70px)" }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-3 py-2">
        <span className="text-[13px] font-semibold text-gray-900">Color Tester</span>
        <div className="flex items-center gap-1">
          <button onClick={handleReset} className="rounded p-1 hover:bg-gray-100" title="Reset all colors">
            <RotateCcw className="h-3.5 w-3.5 text-gray-500" />
          </button>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100" title="Close">
            <X className="h-3.5 w-3.5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-2 [scrollbar-width:thin]">
        {COLOR_GROUPS.map((group) => (
          <div key={group.title} className="mb-3 last:mb-0">
            <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {group.entries.map((entry) => {
                const hex = colors[entry.id] || "#888888";
                const isActive = activeId === entry.id;
                return (
                  <div key={entry.id}>
                    <div className="flex items-center gap-2 px-1 py-0.5">
                      {/* Swatch — click to toggle inline picker */}
                      <button
                        className="h-7 w-7 shrink-0 rounded-md border border-gray-300 shadow-sm cursor-pointer"
                        style={{ backgroundColor: hex }}
                        onClick={() => setActiveId(isActive ? null : entry.id)}
                        title={isActive ? "Close picker" : "Open picker"}
                      />
                      {/* Label */}
                      <span className="min-w-[65px] truncate text-[11px] text-gray-700">{entry.label}</span>
                      {/* Hex input */}
                      <input
                        type="text"
                        value={hex.toUpperCase()}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (!val.startsWith("#")) val = "#" + val;
                          setColors((prev) => ({ ...prev, [entry.id]: val }));
                          if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                            handleChange(entry.id, val.toLowerCase());
                          }
                        }}
                        onBlur={() => {
                          const val = colors[entry.id] || "#888888";
                          if (!/^#[0-9a-fA-F]{6}$/.test(val)) {
                            const fresh = readCurrentColors();
                            setColors((prev) => ({ ...prev, [entry.id]: fresh[entry.id] }));
                          }
                        }}
                        className="min-w-0 flex-1 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        maxLength={7}
                      />
                    </div>
                    {/* Inline HSV picker */}
                    {isActive && (
                      <div className="px-1 flex justify-center">
                        <HsvPicker
                          value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#888888"}
                          onChange={(h) => handleChange(entry.id, h)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
