/**
 * Color Picker Widget — dev tool for testing colors in real-time.
 * One category visible at a time; navigate with ← → arrows.
 * Floats on the right edge of the screen.
 */
import { useState, useEffect, useCallback } from "react";
import { X, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import {
  PIPELINE_HEX, LEAD_AVATAR_BG, refreshLeadAvatarColors,
  CAMPAIGN_STATUS_HEX, CAMPAIGN_AVATAR_BG,
  ACCOUNT_STATUS_HEX, ACCOUNT_AVATAR_BG,
  PROMPT_AVATAR_BG, PROMPT_AVATAR_TEXT,
  ROLE_AVATAR,
} from "@/lib/avatarUtils";
import { INVOICE_STATUS_COLORS, CONTRACT_STATUS_COLORS } from "@/features/billing/types";
import { STATUS_COLORS as TASK_STATUS_COLORS, PRIORITY_COLORS as TASK_PRIORITY_COLORS } from "@/features/tasks/types";
import { PAGE_ACCENTS } from "@/lib/pageAccents";

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

export function hexToHsv(hex: string): [number, number, number] {
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

export function hsvToHex(h: number, s: number, v: number): string {
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

/** Blend a hex color with white at a given alpha (simulates rgba on white bg) */
function blendWithWhite(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const blend = (c: number) => Math.round(c * alpha + 255 * (1 - alpha));
  const toHex = (n: number) => Math.min(255, n).toString(16).padStart(2, "0");
  return `#${toHex(blend(r))}${toHex(blend(g))}${toHex(blend(b))}`;
}

/* ── Inline HSV Slider Picker ── */

const SLIDER_CSS = `
  .hsv-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 10px; border-radius: 5px; outline: none; cursor: pointer; border: none; }
  .hsv-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: white; border: 2px solid rgba(0,0,0,0.28); box-shadow: 0 1px 3px rgba(0,0,0,0.25); cursor: pointer; }
  .hsv-slider::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: white; border: 2px solid rgba(0,0,0,0.28); box-shadow: 0 1px 3px rgba(0,0,0,0.25); cursor: pointer; }
`;

function SliderRow({
  label, display, value, min, max, gradient, onChange,
}: {
  label: string; display: string; value: number; min: number; max: number;
  gradient: string; onChange: (val: number) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        <span className="text-[9px] text-gray-400 tabular-nums">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={1}
        value={Math.round(value)}
        onChange={(e) => onChange(+e.target.value)}
        className="hsv-slider"
        style={{ background: gradient }}
      />
    </div>
  );
}

export function HsvPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(value));

  useEffect(() => { setHsv(hexToHsv(value)); }, [value]);

  const emit = useCallback((h: number, s: number, v: number) => {
    setHsv([h, s, v]);
    onChange(hsvToHex(h, s, v));
  }, [onChange]);

  const [h, s, v] = hsv;
  const hueGrad = "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)";
  const satGrad = `linear-gradient(to right,${hsvToHex(h, 0, v)},${hsvToHex(h, 1, v)})`;
  const blkGrad = `linear-gradient(to right,${hsvToHex(h, s, 1)},#000)`;
  const blackPct = Math.round((1 - v) * 100);

  return (
    <div className="flex flex-col gap-2.5 py-1.5 px-0.5" style={{ width: 156 }}>
      <style>{SLIDER_CSS}</style>
      <SliderRow
        label="Hue" display={`${Math.round(h)}°`}
        value={h} min={0} max={360} gradient={hueGrad}
        onChange={(val) => emit(val, s, v)}
      />
      <SliderRow
        label="Saturation" display={`${Math.round(s * 100)}%`}
        value={s * 100} min={0} max={100} gradient={satGrad}
        onChange={(val) => emit(h, val / 100, v)}
      />
      <SliderRow
        label="Black" display={`${blackPct}%`}
        value={blackPct} min={0} max={100} gradient={blkGrad}
        onChange={(val) => emit(h, s, 1 - val / 100)}
      />
    </div>
  );
}

/* ── Color entry types ── */

interface ColorEntry {
  label: string;
  id: string;
  type: "css" | "pipeline" | "avatar" | "computed" | "map" | "hslVar";
  cssVars?: string[];
  pipelineKey?: string;
  avatarKey?: string;
  /** computed: derives preview by blending base CSS var with white */
  computedGet?: string;
  computedAlpha?: number;
  /** map: directly reads/writes a mutable Record entry */
  mapRef?: Record<string, any>;
  mapKey?: string;
  /** if mapRef[mapKey] is an object, which sub-property holds the hex */
  mapSubKey?: string;
  /**
   * hslVar: reads/writes a bare HSL channel string ("50 100% 78%") stored
   * in a mutable PAGE_ACCENTS-style record. Use for per-page accent colors
   * that CrmShell applies as inline style CSS variable overrides.
   */
  hslRef?: Record<string, { active: string; selected: string }>;
  hslKey?: string;
  hslField?: "active" | "selected";
}

/* ── Category groups ── */

const G = COLOR_GROUPS();

function COLOR_GROUPS(): { title: string; subtitle?: string; entries: ColorEntry[] }[] {
  return [
    /* Theme — wine / gray / beige / white */
    {
      title: "Theme",
      subtitle: "Wine · gray · beige · white",
      entries: [
        { label: "Wine (accent)",   id: "wine",      type: "css", cssVars: ["--primary", "--accent", "--brand-indigo", "--brand-blue", "--brand-yellow", "--brand-soft-yellow", "--ring", "--sidebar-active", "--info", "--highlight-hover"] },
        { label: "Wine — selected", id: "wine-sel",  type: "css", cssVars: ["--highlight-active", "--highlight-selected"] },
        { label: "Page Background", id: "bg",        type: "css", cssVars: ["--bg-main"] },
        { label: "Card (beige)",    id: "card",      type: "css", cssVars: ["--card", "--card-hover", "--muted", "--popover"] },
        { label: "List Panel",      id: "panel-list", type: "css", cssVars: ["--panel-list-bg"] },
        { label: "Nav & Topbar",    id: "nav",       type: "css", cssVars: ["--sidebar-bg"] },
        { label: "Text",            id: "fg",        type: "css", cssVars: ["--foreground", "--card-foreground", "--popover-foreground", "--sidebar-foreground"] },
        { label: "Muted Text",      id: "muted-fg",  type: "css", cssVars: ["--muted-foreground"] },
        { label: "Border",          id: "border",    type: "css", cssVars: ["--border", "--input", "--input-bg", "--secondary"] },
      ],
    },

    /* Semantic — kept for functional states */
    {
      title: "Semantic",
      subtitle: "Success / error states",
      entries: [
        { label: "Success",     id: "success",     type: "css", cssVars: ["--success"] },
        { label: "Destructive", id: "destructive", type: "css", cssVars: ["--destructive"] },
      ],
    },
  ];
}

/* ── Read / write helpers ── */

function readEntryColor(entry: ColorEntry): string {
  const computed = getComputedStyle(document.documentElement);
  if (entry.type === "css" && entry.cssVars) {
    const val = computed.getPropertyValue(entry.cssVars[0]).trim();
    return val ? hslCssToHex(val) : "#888888";
  }
  if (entry.type === "pipeline" && entry.pipelineKey) {
    return PIPELINE_HEX[entry.pipelineKey] || "#888888";
  }
  if (entry.type === "avatar" && entry.avatarKey) {
    return LEAD_AVATAR_BG[entry.avatarKey] || "#888888";
  }
  if (entry.type === "computed" && entry.computedGet) {
    const val = computed.getPropertyValue(entry.computedGet).trim();
    const base = val ? hslCssToHex(val) : "#888888";
    return entry.computedAlpha != null ? blendWithWhite(base, entry.computedAlpha) : base;
  }
  if (entry.type === "map" && entry.mapRef && entry.mapKey) {
    const target = entry.mapRef[entry.mapKey];
    return (entry.mapSubKey ? target?.[entry.mapSubKey] : target) || "#888888";
  }
  if (entry.type === "hslVar" && entry.hslRef && entry.hslKey && entry.hslField) {
    const channels = entry.hslRef[entry.hslKey]?.[entry.hslField];
    return channels ? hslCssToHex(channels) : "#888888";
  }
  return "#888888";
}

function writeEntryColor(entry: ColorEntry, hex: string): void {
  if (entry.type === "css" && entry.cssVars) {
    const hsl = hexToHslCss(hex);
    for (const v of entry.cssVars) document.documentElement.style.setProperty(v, hsl);
  } else if (entry.type === "pipeline" && entry.pipelineKey) {
    PIPELINE_HEX[entry.pipelineKey] = hex;
  } else if (entry.type === "avatar" && entry.avatarKey) {
    LEAD_AVATAR_BG[entry.avatarKey] = hex;
  } else if (entry.type === "computed" && entry.computedGet) {
    document.documentElement.style.setProperty(entry.computedGet, hexToHslCss(hex));
  } else if (entry.type === "map" && entry.mapRef && entry.mapKey) {
    if (entry.mapSubKey) {
      if (!entry.mapRef[entry.mapKey]) entry.mapRef[entry.mapKey] = {};
      entry.mapRef[entry.mapKey][entry.mapSubKey] = hex;
    } else {
      entry.mapRef[entry.mapKey] = hex;
    }
  } else if (entry.type === "hslVar" && entry.hslRef && entry.hslKey && entry.hslField) {
    entry.hslRef[entry.hslKey][entry.hslField] = hexToHslCss(hex);
  }
  window.dispatchEvent(new Event("color-tester-update"));
}

function resetEntryColor(entry: ColorEntry, original: string): void {
  if (entry.type === "css" && entry.cssVars) {
    for (const v of entry.cssVars) document.documentElement.style.removeProperty(v);
  } else if (entry.type === "pipeline" && entry.pipelineKey) {
    PIPELINE_HEX[entry.pipelineKey] = original;
  } else if (entry.type === "avatar" && entry.avatarKey) {
    LEAD_AVATAR_BG[entry.avatarKey] = original;
  } else if (entry.type === "computed" && entry.computedGet) {
    document.documentElement.style.removeProperty(entry.computedGet);
  } else if (entry.type === "map" && entry.mapRef && entry.mapKey) {
    if (entry.mapSubKey && entry.mapRef[entry.mapKey]) {
      entry.mapRef[entry.mapKey][entry.mapSubKey] = original;
    } else {
      entry.mapRef[entry.mapKey] = original;
    }
  } else if (entry.type === "hslVar" && entry.hslRef && entry.hslKey && entry.hslField) {
    entry.hslRef[entry.hslKey][entry.hslField] = hexToHslCss(original);
  }
  window.dispatchEvent(new Event("color-tester-update"));
}

function readAllColors(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const group of G) {
    for (const entry of group.entries) {
      result[entry.id] = readEntryColor(entry);
    }
  }
  return result;
}

/* ── Main widget ── */

export function ColorPickerWidget({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [colors, setColors]     = useState<Record<string, string>>({});
  const [originals, setOriginals] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [catIdx, setCatIdx]     = useState(0);

  useEffect(() => {
    if (!open) return;
    const initial = readAllColors();
    setColors(initial);
    setOriginals(initial);
    setActiveId(null);
  }, [open]);

  /* Close picker when navigating away */
  const goTo = useCallback((idx: number) => {
    setCatIdx(idx);
    setActiveId(null);
  }, []);
  const prev = useCallback(() => goTo((catIdx - 1 + G.length) % G.length), [catIdx, goTo]);
  const next = useCallback(() => goTo((catIdx + 1) % G.length), [catIdx, goTo]);

  const handleChange = useCallback((entry: ColorEntry, hex: string) => {
    setColors((prev) => ({ ...prev, [entry.id]: hex }));
    writeEntryColor(entry, hex);
  }, []);

  const handleReset = useCallback(() => {
    for (const group of G) {
      for (const entry of group.entries) {
        const orig = originals[entry.id];
        if (orig) resetEntryColor(entry, orig);
      }
    }
    refreshLeadAvatarColors();
    const fresh = readAllColors();
    setColors(fresh);
    setOriginals(fresh);
    setActiveId(null);
  }, [originals]);

  if (!open) return null;

  const group = G[catIdx];

  return (
    <div
      className="fixed right-3 bottom-3 z-[9999] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
      style={{ width: 268, maxHeight: "calc(100dvh - 70px)" }}
    >
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center gap-1 border-b border-gray-100 px-2 py-1.5">
        {/* Prev arrow */}
        <button
          onClick={prev}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors shrink-0"
          title="Previous category"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        {/* Category name + index */}
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <span className="truncate text-[12px] font-semibold text-gray-900 leading-tight">
            {group.title}
          </span>
          <span className="text-[9px] font-medium text-gray-400 tabular-nums">
            {catIdx + 1} / {G.length}
          </span>
        </div>

        {/* Next arrow */}
        <button
          onClick={next}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors shrink-0"
          title="Next category"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        {/* Divider */}
        <div className="h-4 w-px bg-gray-200 mx-0.5 shrink-0" />

        {/* Reset */}
        <button onClick={handleReset} className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors shrink-0" title="Reset all colors">
          <RotateCcw className="h-3 w-3" />
        </button>
        {/* Close */}
        <button onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors shrink-0" title="Close">
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* ── Category dot nav ── */}
      <div className="flex shrink-0 items-center justify-center gap-0.5 px-2 py-1 border-b border-gray-100">
        {G.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="rounded-full transition-colors"
            style={{
              width: i === catIdx ? 16 : 6,
              height: 6,
              background: i === catIdx ? "#4F46E5" : "#D1D5DB",
            }}
            title={G[i].title}
          />
        ))}
      </div>

      {/* ── Subtitle ── */}
      {group.subtitle && (
        <div className="shrink-0 px-3 pt-1.5 pb-0.5">
          <p className="text-[9.5px] text-gray-400 leading-tight">{group.subtitle}</p>
        </div>
      )}

      {/* ── Scrollable entry list ── */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5 [scrollbar-width:thin]">
        <div className="space-y-0.5">
          {group.entries.map((entry) => {
            const hex = colors[entry.id] || "#888888";
            const isActive = activeId === entry.id;
            return (
              <div key={entry.id}>
                <div className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-50">
                  {/* Swatch */}
                  <button
                    className="h-6 w-6 shrink-0 rounded border border-gray-300 shadow-sm cursor-pointer"
                    style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#888888" }}
                    onClick={() => setActiveId(isActive ? null : entry.id)}
                    title={isActive ? "Close picker" : "Pick color"}
                  />
                  {/* Label */}
                  <span className="min-w-0 flex-1 truncate text-[11px] text-gray-700">{entry.label}</span>
                  {/* Hex input */}
                  <input
                    type="text"
                    value={hex.toUpperCase()}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (!val.startsWith("#")) val = "#" + val;
                      setColors((prev) => ({ ...prev, [entry.id]: val }));
                      if (/^#[0-9a-fA-F]{6}$/.test(val)) handleChange(entry, val.toLowerCase());
                    }}
                    onBlur={() => {
                      if (!/^#[0-9a-fA-F]{6}$/.test(colors[entry.id] || "")) {
                        setColors((prev) => ({ ...prev, [entry.id]: readEntryColor(entry) }));
                      }
                    }}
                    className="w-[62px] shrink-0 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    maxLength={7}
                  />
                </div>
                {/* Inline HSV picker */}
                {isActive && (
                  <div className="flex justify-center px-1 pb-1">
                    <HsvPicker
                      value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#888888"}
                      onChange={(h) => handleChange(entry, h)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
