/**
 * Color Picker Widget — dev tool for testing colors in real-time.
 * One category visible at a time; navigate with ← → arrows.
 * Floats on the right edge of the screen.
 */
import { useState, useEffect, useCallback, useRef, type PointerEvent as RPointerEvent } from "react";
import { X, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import {
  PIPELINE_HEX, LEAD_AVATAR_BG, refreshLeadAvatarColors,
  CAMPAIGN_STATUS_HEX, CAMPAIGN_AVATAR_BG,
  ACCOUNT_STATUS_HEX, ACCOUNT_AVATAR_BG,
  PROMPT_AVATAR_BG, PROMPT_AVATAR_TEXT,
  ROLE_AVATAR,
} from "@/lib/avatarUtils";
import { INVOICE_STATUS_COLORS, CONTRACT_STATUS_COLORS } from "@/features/billing/types";
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

/* ── Inline HSV Picker ── */

const SQ = 156;
const BAR_H = 13;

export function HsvPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(value));
  const sqRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHsv(hexToHsv(value)); }, [value]);

  const emit = useCallback((h: number, s: number, v: number) => {
    setHsv([h, s, v]);
    onChange(hsvToHex(h, s, v));
  }, [onChange]);

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
      <div
        ref={sqRef}
        className="relative cursor-crosshair rounded overflow-hidden"
        style={{ width: SQ, height: SQ }}
        onPointerDown={onSqDown}
        onPointerMove={(e) => { if (e.buttons > 0) handleSqPointer(e); }}
      >
        <div className="absolute inset-0" style={{ background: hueColor }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, #fff, transparent)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent, #000)" }} />
        <div
          className="absolute w-3 h-3 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: hsv[1] * SQ, top: (1 - hsv[2]) * SQ }}
        />
      </div>
      <div
        ref={barRef}
        className="relative cursor-pointer rounded-full overflow-hidden"
        style={{
          width: SQ, height: BAR_H,
          background: "linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))",
        }}
        onPointerDown={onBarDown}
        onPointerMove={(e) => { if (e.buttons > 0) handleBarPointer(e); }}
      >
        <div
          className="absolute top-0 bottom-0 w-2.5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)] -translate-x-1/2 pointer-events-none"
          style={{ left: (hsv[0] / 360) * SQ }}
        />
      </div>
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
    /* 1 ─ Surfaces & Text ───────────────────────────────── */
    {
      title: "Surfaces & Text",
      entries: [
        { label: "Background",  id: "bg",       type: "css", cssVars: ["--background", "--bg-main"] },
        { label: "Card",        id: "card",      type: "css", cssVars: ["--card"] },
        { label: "Card Hover",  id: "card-hov",  type: "css", cssVars: ["--card-hover"] },
        { label: "Muted",       id: "muted",     type: "css", cssVars: ["--muted", "--secondary", "--input"] },
        { label: "Popover",     id: "popover",   type: "css", cssVars: ["--popover"] },
        { label: "Input Bg",    id: "input-bg",  type: "css", cssVars: ["--input-bg"] },
        { label: "Foreground",  id: "fg",        type: "css", cssVars: ["--foreground", "--card-foreground", "--popover-foreground"] },
        { label: "Muted Text",  id: "muted-fg",  type: "css", cssVars: ["--muted-foreground"] },
        { label: "Border",      id: "border",    type: "css", cssVars: ["--border"] },
      ],
    },

    /* 2 ─ Brand Colors ──────────────────────────────────── */
    {
      title: "Brand Colors",
      entries: [
        { label: "Indigo",         id: "indigo",        type: "css", cssVars: ["--brand-indigo", "--brand-blue", "--primary", "--ring", "--sidebar-active", "--info"] },
        { label: "Yellow",         id: "yellow",        type: "css", cssVars: ["--brand-yellow"] },
        { label: "Deep Blue",      id: "deep-blue",     type: "css", cssVars: ["--brand-deep-blue"] },
        { label: "Soft Yellow",    id: "soft-yellow",   type: "css", cssVars: ["--brand-soft-yellow"] },
        { label: "Indian Yellow",  id: "indian-yellow", type: "css", cssVars: ["--brand-indian-yellow"] },
      ],
    },

    /* 3 ─ Highlights & Selections ───────────────────────── */
    {
      title: "Highlights & Selections",
      subtitle: "Active pills, selected cards, tabs",
      entries: [
        { label: "Active Pill / Tab",   id: "hl-active",   type: "css", cssVars: ["--highlight-active"] },
        { label: "Selected Card / Row", id: "hl-selected", type: "css", cssVars: ["--highlight-selected"] },
        { label: "Highlight Hover",     id: "hl-hover",    type: "css", cssVars: ["--highlight-hover"] },
      ],
    },

    /* 4 ─ Nav Sidebar ───────────────────────────────────── */
    {
      title: "Nav Sidebar",
      entries: [
        { label: "Sidebar Bg",      id: "sidebar-bg",      type: "css", cssVars: ["--sidebar-bg"] },
        { label: "Sidebar Text",    id: "sidebar-fg",      type: "css", cssVars: ["--sidebar-foreground"] },
        { label: "Nav Active",      id: "sidebar-active",  type: "css", cssVars: ["--sidebar-active"] },
        { label: "Nav Active Text", id: "sidebar-act-fg",  type: "css", cssVars: ["--sidebar-active-foreground"] },
      ],
    },

    /* 5 ─ Buttons & Pills ───────────────────────────────── */
    {
      title: "Buttons & Pills",
      subtitle: "Icon circles, toolbar pills, active state",
      entries: [
        { label: "Pill Active Bg",  id: "pill-bg",   type: "computed", computedGet: "--brand-indigo", computedAlpha: 0.1 },
        { label: "Pill Active Bdr", id: "pill-bdr",  type: "computed", computedGet: "--brand-indigo", computedAlpha: 0.5 },
        { label: "Btn Hover Bg",    id: "btn-hov",   type: "css", cssVars: ["--card"] },
        { label: "Btn Active Bg",   id: "btn-act",   type: "css", cssVars: ["--muted"] },
        { label: "Btn Icon Color",  id: "btn-text",  type: "css", cssVars: ["--muted-foreground"] },
      ],
    },

    /* 6 ─ Semantic ──────────────────────────────────────── */
    {
      title: "Semantic",
      entries: [
        { label: "Success",     id: "success",     type: "css", cssVars: ["--success"] },
        { label: "Destructive", id: "destructive", type: "css", cssVars: ["--destructive"] },
        { label: "Accent",      id: "accent",      type: "css", cssVars: ["--accent"] },
      ],
    },

    /* 7 ─ Campaigns ─────────────────────────────────────── */
    {
      title: "Campaigns",
      subtitle: "Status dots & card avatars",
      entries: [
        { label: "Active pill / tab",  id: "cp-pill",    type: "hslVar", hslRef: PAGE_ACCENTS, hslKey: "campaigns",   hslField: "active" },
        { label: "Selected card",      id: "cp-sel",     type: "hslVar", hslRef: PAGE_ACCENTS, hslKey: "campaigns",   hslField: "selected" },
        { label: "Card bg",            id: "cp-card",    type: "css", cssVars: ["--card"] },
        { label: "Active — dot",      id: "c-act-dot",  type: "map", mapRef: CAMPAIGN_STATUS_HEX, mapKey: "Active" },
        { label: "Paused — dot",      id: "c-pau-dot",  type: "map", mapRef: CAMPAIGN_STATUS_HEX, mapKey: "Paused" },
        { label: "Completed — dot",   id: "c-com-dot",  type: "map", mapRef: CAMPAIGN_STATUS_HEX, mapKey: "Completed" },
        { label: "Draft — dot",       id: "c-dra-dot",  type: "map", mapRef: CAMPAIGN_STATUS_HEX, mapKey: "Draft" },
        { label: "Inactive — dot",    id: "c-ina-dot",  type: "map", mapRef: CAMPAIGN_STATUS_HEX, mapKey: "Inactive" },
        { label: "Active — avatar",   id: "c-act-bg",   type: "map", mapRef: CAMPAIGN_AVATAR_BG,  mapKey: "Active" },
        { label: "Paused — avatar",   id: "c-pau-bg",   type: "map", mapRef: CAMPAIGN_AVATAR_BG,  mapKey: "Paused" },
        { label: "Completed — avatar",id: "c-com-bg",   type: "map", mapRef: CAMPAIGN_AVATAR_BG,  mapKey: "Completed" },
        { label: "Draft — avatar",    id: "c-dra-bg",   type: "map", mapRef: CAMPAIGN_AVATAR_BG,  mapKey: "Draft" },
      ],
    },

    /* 8 ─ Leads — Pipeline ──────────────────────────────── */
    {
      title: "Leads — Pipeline",
      subtitle: "Ring / dot / stripe colors per stage",
      entries: [
        { label: "Active pill / tab",  id: "lp-pill", type: "hslVar", hslRef: PAGE_ACCENTS, hslKey: "contacts",      hslField: "active" },
        { label: "Selected card",      id: "lp-sel",  type: "hslVar", hslRef: PAGE_ACCENTS, hslKey: "contacts",      hslField: "selected" },
        { label: "Card bg",            id: "lp-card", type: "css", cssVars: ["--card"] },
        { label: "New",                id: "p-new",   type: "pipeline", pipelineKey: "New" },
        { label: "Contacted",          id: "p-con",   type: "pipeline", pipelineKey: "Contacted" },
        { label: "Responded",          id: "p-res",   type: "pipeline", pipelineKey: "Responded" },
        { label: "Multiple Responses", id: "p-mul",   type: "pipeline", pipelineKey: "Multiple Responses" },
        { label: "Qualified",          id: "p-qua",   type: "pipeline", pipelineKey: "Qualified" },
        { label: "Booked",             id: "p-boo",   type: "pipeline", pipelineKey: "Booked" },
        { label: "Closed",             id: "p-clo",   type: "pipeline", pipelineKey: "Closed" },
        { label: "Lost",               id: "p-los",   type: "pipeline", pipelineKey: "Lost" },
        { label: "DND",                id: "p-dnd",   type: "pipeline", pipelineKey: "DND" },
      ],
    },

    /* 9 ─ Leads — Avatars ───────────────────────────────── */
    {
      title: "Leads — Avatars",
      subtitle: "Pastel bg colors on lead cards & inbox",
      entries: [
        { label: "Active pill / tab",  id: "la-pill", type: "hslVar", hslRef: PAGE_ACCENTS, hslKey: "contacts",      hslField: "active" },
        { label: "Selected card",      id: "la-sel",  type: "hslVar", hslRef: PAGE_ACCENTS, hslKey: "contacts",      hslField: "selected" },
        { label: "Card bg",            id: "la-card", type: "css", cssVars: ["--card"] },
        { label: "New",                id: "a-new",   type: "avatar", avatarKey: "New" },
        { label: "Contacted",          id: "a-con",   type: "avatar", avatarKey: "Contacted" },
        { label: "Responded",          id: "a-res",   type: "avatar", avatarKey: "Responded" },
        { label: "Multiple Responses", id: "a-mul",   type: "avatar", avatarKey: "Multiple Responses" },
        { label: "Qualified",          id: "a-qua",   type: "avatar", avatarKey: "Qualified" },
        { label: "Booked",             id: "a-boo",   type: "avatar", avatarKey: "Booked" },
        { label: "Closed",             id: "a-clo",   type: "avatar", avatarKey: "Closed" },
        { label: "Lost",               id: "a-los",   type: "avatar", avatarKey: "Lost" },
        { label: "DND",                id: "a-dnd",   type: "avatar", avatarKey: "DND" },
      ],
    },

    /* 10 ─ Chats ─────────────────────────────────────────── */
    {
      title: "Chats",
      subtitle: "Inbox thread avatars (uses lead stage colors)",
      entries: [
        { label: "Active pill / tab",  id: "ch-pill", type: "hslVar", hslRef: PAGE_ACCENTS, hslKey: "conversations", hslField: "active" },
        { label: "Selected thread",    id: "ch-sel",  type: "hslVar", hslRef: PAGE_ACCENTS, hslKey: "conversations", hslField: "selected" },
        { label: "Thread bg",          id: "ch-card", type: "css", cssVars: ["--card"] },
        { label: "Contacted avatar",   id: "ch-con", type: "avatar", avatarKey: "Contacted" },
        { label: "Responded avatar",   id: "ch-res", type: "avatar", avatarKey: "Responded" },
        { label: "Booked avatar",      id: "ch-boo", type: "avatar", avatarKey: "Booked" },
        { label: "Lost avatar",        id: "ch-los", type: "avatar", avatarKey: "Lost" },
        { label: "Unread badge",       id: "ch-badge", type: "css",  cssVars: ["--brand-indigo"] },
      ],
    },

    /* 11 ─ Calendar ─────────────────────────────────────── */
    {
      title: "Calendar",
      subtitle: "Event cards use lead stage colors",
      entries: [
        { label: "Active pill / tab",    id: "cal-pill",   type: "hslVar", hslRef: PAGE_ACCENTS, hslKey: "calendar",       hslField: "active" },
        { label: "Selected event card",  id: "cal-sel",    type: "hslVar", hslRef: PAGE_ACCENTS, hslKey: "calendar",       hslField: "selected" },
        { label: "Event card bg",        id: "cal-card",   type: "css",    cssVars: ["--card"] },
        { label: "Booked event avatar",  id: "cal-boo",    type: "avatar", avatarKey: "Booked" },
        { label: "Qualified avatar",     id: "cal-qua",    type: "avatar", avatarKey: "Qualified" },
        { label: "KPI call badge",       id: "cal-kpi",    type: "css",    cssVars: ["--brand-yellow"] },
      ],
    },

    /* 12 ─ Accounts ─────────────────────────────────────── */
    {
      title: "Accounts",
      subtitle: "Status dots & card avatars",
      entries: [
        { label: "Active pill / tab",  id: "acp-pill",   type: "hslVar", hslRef: PAGE_ACCENTS, hslKey: "accounts",      hslField: "active" },
        { label: "Selected card",      id: "acp-sel",    type: "hslVar", hslRef: PAGE_ACCENTS, hslKey: "accounts",      hslField: "selected" },
        { label: "Card bg",            id: "acp-card",   type: "css", cssVars: ["--card"] },
        { label: "Active — dot",     id: "ac-act-dot", type: "map", mapRef: ACCOUNT_STATUS_HEX, mapKey: "Active" },
        { label: "Trial — dot",      id: "ac-tri-dot", type: "map", mapRef: ACCOUNT_STATUS_HEX, mapKey: "Trial" },
        { label: "Inactive — dot",   id: "ac-ina-dot", type: "map", mapRef: ACCOUNT_STATUS_HEX, mapKey: "Inactive" },
        { label: "Suspended — dot",  id: "ac-sus-dot", type: "map", mapRef: ACCOUNT_STATUS_HEX, mapKey: "Suspended" },
        { label: "Active — avatar",  id: "ac-act-bg",  type: "map", mapRef: ACCOUNT_AVATAR_BG,  mapKey: "Active" },
        { label: "Trial — avatar",   id: "ac-tri-bg",  type: "map", mapRef: ACCOUNT_AVATAR_BG,  mapKey: "Trial" },
        { label: "Inactive — avatar",id: "ac-ina-bg",  type: "map", mapRef: ACCOUNT_AVATAR_BG,  mapKey: "Inactive" },
        { label: "Suspended — avatar",id:"ac-sus-bg",  type: "map", mapRef: ACCOUNT_AVATAR_BG,  mapKey: "Suspended" },
      ],
    },

    /* 13 ─ Billing — Invoices ───────────────────────────── */
    {
      title: "Billing — Invoices",
      subtitle: "Invoice status badge dots & backgrounds",
      entries: [
        { label: "Active pill / tab",  id: "bi-pill",     type: "hslVar", hslRef: PAGE_ACCENTS, hslKey: "invoices",      hslField: "active" },
        { label: "Selected row",       id: "bi-sel",      type: "hslVar", hslRef: PAGE_ACCENTS, hslKey: "invoices",      hslField: "selected" },
        { label: "Row bg",             id: "bi-card",     type: "css", cssVars: ["--card"] },
        { label: "Draft — dot",     id: "inv-dra-dot", type: "map", mapRef: INVOICE_STATUS_COLORS, mapKey: "Draft",     mapSubKey: "dot" },
        { label: "Sent — dot",      id: "inv-sen-dot", type: "map", mapRef: INVOICE_STATUS_COLORS, mapKey: "Sent",      mapSubKey: "dot" },
        { label: "Viewed — dot",    id: "inv-vie-dot", type: "map", mapRef: INVOICE_STATUS_COLORS, mapKey: "Viewed",    mapSubKey: "dot" },
        { label: "Paid — dot",      id: "inv-pai-dot", type: "map", mapRef: INVOICE_STATUS_COLORS, mapKey: "Paid",      mapSubKey: "dot" },
        { label: "Overdue — dot",   id: "inv-ove-dot", type: "map", mapRef: INVOICE_STATUS_COLORS, mapKey: "Overdue",   mapSubKey: "dot" },
        { label: "Cancelled — dot", id: "inv-can-dot", type: "map", mapRef: INVOICE_STATUS_COLORS, mapKey: "Cancelled", mapSubKey: "dot" },
        { label: "Draft — bg",      id: "inv-dra-bg",  type: "map", mapRef: INVOICE_STATUS_COLORS, mapKey: "Draft",     mapSubKey: "bg" },
        { label: "Sent — bg",       id: "inv-sen-bg",  type: "map", mapRef: INVOICE_STATUS_COLORS, mapKey: "Sent",      mapSubKey: "bg" },
        { label: "Paid — bg",       id: "inv-pai-bg",  type: "map", mapRef: INVOICE_STATUS_COLORS, mapKey: "Paid",      mapSubKey: "bg" },
        { label: "Overdue — bg",    id: "inv-ove-bg",  type: "map", mapRef: INVOICE_STATUS_COLORS, mapKey: "Overdue",   mapSubKey: "bg" },
      ],
    },

    /* 14 ─ Billing — Contracts ──────────────────────────── */
    {
      title: "Billing — Contracts",
      subtitle: "Contract status badge dots & backgrounds",
      entries: [
        { label: "Active pill / tab",  id: "bc-pill",     type: "hslVar", hslRef: PAGE_ACCENTS, hslKey: "contracts",     hslField: "active" },
        { label: "Selected row",       id: "bc-sel",      type: "hslVar", hslRef: PAGE_ACCENTS, hslKey: "contracts",     hslField: "selected" },
        { label: "Row bg",             id: "bc-card",     type: "css", cssVars: ["--card"] },
        { label: "Draft — dot",     id: "con-dra-dot", type: "map", mapRef: CONTRACT_STATUS_COLORS, mapKey: "Draft",     mapSubKey: "dot" },
        { label: "Sent — dot",      id: "con-sen-dot", type: "map", mapRef: CONTRACT_STATUS_COLORS, mapKey: "Sent",      mapSubKey: "dot" },
        { label: "Viewed — dot",    id: "con-vie-dot", type: "map", mapRef: CONTRACT_STATUS_COLORS, mapKey: "Viewed",    mapSubKey: "dot" },
        { label: "Signed — dot",    id: "con-sig-dot", type: "map", mapRef: CONTRACT_STATUS_COLORS, mapKey: "Signed",    mapSubKey: "dot" },
        { label: "Expired — dot",   id: "con-exp-dot", type: "map", mapRef: CONTRACT_STATUS_COLORS, mapKey: "Expired",   mapSubKey: "dot" },
        { label: "Cancelled — dot", id: "con-can-dot", type: "map", mapRef: CONTRACT_STATUS_COLORS, mapKey: "Cancelled", mapSubKey: "dot" },
        { label: "Signed — bg",     id: "con-sig-bg",  type: "map", mapRef: CONTRACT_STATUS_COLORS, mapKey: "Signed",    mapSubKey: "bg" },
        { label: "Expired — bg",    id: "con-exp-bg",  type: "map", mapRef: CONTRACT_STATUS_COLORS, mapKey: "Expired",   mapSubKey: "bg" },
      ],
    },

    /* 15 ─ Library ───────────────────────────────────────── */
    {
      title: "Library",
      subtitle: "Prompt status & avatar colors",
      entries: [
        { label: "Active pill / tab",  id: "lb-pill",     type: "hslVar", hslRef: PAGE_ACCENTS, hslKey: "prompt-library",   hslField: "active" },
        { label: "Selected card",      id: "lb-sel",      type: "hslVar", hslRef: PAGE_ACCENTS, hslKey: "prompt-library",   hslField: "selected" },
        { label: "Card bg",            id: "lb-card",     type: "css", cssVars: ["--card"] },
        { label: "Active — avatar",   id: "lib-act-bg",  type: "map", mapRef: PROMPT_AVATAR_BG,   mapKey: "Active" },
        { label: "Archived — avatar", id: "lib-arc-bg",  type: "map", mapRef: PROMPT_AVATAR_BG,   mapKey: "Archived" },
        { label: "Active — text",     id: "lib-act-tx",  type: "map", mapRef: PROMPT_AVATAR_TEXT, mapKey: "Active" },
        { label: "Archived — text",   id: "lib-arc-tx",  type: "map", mapRef: PROMPT_AVATAR_TEXT, mapKey: "Archived" },
      ],
    },

    /* 16 ─ Automations ───────────────────────────────────── */
    {
      title: "Automations",
      subtitle: "Log status colors (from semantic palette)",
      entries: [
        { label: "Active pill / tab",  id: "am-pill",  type: "hslVar", hslRef: PAGE_ACCENTS, hslKey: "automation-logs", hslField: "active" },
        { label: "Selected row",       id: "am-sel",   type: "hslVar", hslRef: PAGE_ACCENTS, hslKey: "automation-logs", hslField: "selected" },
        { label: "Row bg",             id: "am-card",  type: "css", cssVars: ["--card"] },
        { label: "Success",     id: "atm-suc", type: "css", cssVars: ["--success"] },
        { label: "Destructive", id: "atm-des", type: "css", cssVars: ["--destructive"] },
        { label: "Waiting",     id: "atm-wai", type: "css", cssVars: ["--brand-yellow"] },
        { label: "Retrying",    id: "atm-ret", type: "css", cssVars: ["--brand-indigo"] },
        { label: "Muted",       id: "atm-mut", type: "css", cssVars: ["--muted-foreground"] },
        { label: "Row hover",   id: "atm-hov", type: "css", cssVars: ["--card-hover"] },
      ],
    },

    /* 17 ─ Settings — Roles ──────────────────────────────── */
    {
      title: "Settings — Roles",
      subtitle: "User role avatar badge colors",
      entries: [
        { label: "Active pill / tab",  id: "sr-pill",   type: "css", cssVars: ["--highlight-active"] },
        { label: "Selected card",      id: "sr-sel",    type: "css", cssVars: ["--highlight-selected"] },
        { label: "Card bg",            id: "sr-card",   type: "css", cssVars: ["--card"] },
        { label: "Admin — bg",    id: "ro-adm-bg", type: "map", mapRef: ROLE_AVATAR, mapKey: "Admin",    mapSubKey: "bg" },
        { label: "Operator — bg", id: "ro-ope-bg", type: "map", mapRef: ROLE_AVATAR, mapKey: "Operator", mapSubKey: "bg" },
        { label: "Manager — bg",  id: "ro-man-bg", type: "map", mapRef: ROLE_AVATAR, mapKey: "Manager",  mapSubKey: "bg" },
        { label: "Agent — bg",    id: "ro-age-bg", type: "map", mapRef: ROLE_AVATAR, mapKey: "Agent",    mapSubKey: "bg" },
        { label: "Viewer — bg",   id: "ro-vie-bg", type: "map", mapRef: ROLE_AVATAR, mapKey: "Viewer",   mapSubKey: "bg" },
        { label: "Admin — text",  id: "ro-adm-tx", type: "map", mapRef: ROLE_AVATAR, mapKey: "Admin",    mapSubKey: "text" },
        { label: "Operator — text",id:"ro-ope-tx", type: "map", mapRef: ROLE_AVATAR, mapKey: "Operator", mapSubKey: "text" },
        { label: "Manager — text",id: "ro-man-tx", type: "map", mapRef: ROLE_AVATAR, mapKey: "Manager",  mapSubKey: "text" },
        { label: "Agent — text",  id: "ro-age-tx", type: "map", mapRef: ROLE_AVATAR, mapKey: "Agent",    mapSubKey: "text" },
        { label: "Viewer — text", id: "ro-vie-tx", type: "map", mapRef: ROLE_AVATAR, mapKey: "Viewer",   mapSubKey: "text" },
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
      style={{ width: 268, maxHeight: "calc(100vh - 70px)" }}
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
