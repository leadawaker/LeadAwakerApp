/**
 * Persistent storage for per-slot gradient layers.
 * Each slot ("social1"–"social4") stores a GradientLayer[] in localStorage.
 * Falls back to built-in defaults when no saved data exists.
 */
import { useState, useEffect } from "react";
import type { GradientLayer } from "@/components/ui/gradient-tester";

const SLOT_EVENT = "chat-bg-slot-changed";
const slotKey = (slot: string) => `chat-bg-layers-${slot}`;

export const SLOT_DEFAULTS: Record<string, GradientLayer[]> = {
  social1: [
    {
      id: 0, label: "Base", enabled: true, type: "solid", solidColor: "#ffffff",
      ellipseW: 100, ellipseH: 100, posX: 50, posY: 50, colorStops: [],
    },
    {
      id: 1, label: "Gradient", enabled: true, type: "linear", angle: 151,
      ellipseW: 100, ellipseH: 100, posX: 50, posY: 50,
      colorStops: [
        { color: "#63f185", opacity: 0.24, position: 0 },
        { color: "#fff377", opacity: 0.30, position: 80 },
      ],
    },
  ],
  social2: [
    {
      id: 0, label: "Base", enabled: true, type: "solid", solidColor: "#ffffff",
      ellipseW: 100, ellipseH: 100, posX: 50, posY: 50, colorStops: [],
    },
    {
      id: 1, label: "Green top-right", enabled: true, type: "radial",
      ellipseW: 200, ellipseH: 132, posX: 96, posY: 12,
      colorStops: [
        { color: "#d1ff9e", opacity: 0.62, position: 0 },
        { color: "#000000", opacity: 0,    position: 64 },
      ],
    },
    {
      id: 2, label: "Cyan bottom-left", enabled: true, type: "radial",
      ellipseW: 151, ellipseH: 142, posX: 0, posY: 100,
      colorStops: [
        { color: "#6ed4d8", opacity: 1,    position: 0 },
        { color: "#000000", opacity: 0,    position: 69 },
      ],
    },
    {
      id: 3, label: "Mint top-left", enabled: true, type: "radial",
      ellipseW: 130, ellipseH: 126, posX: 0, posY: 0,
      colorStops: [
        { color: "#a5ffcb", opacity: 1,    position: 0 },
        { color: "#000000", opacity: 0,    position: 60 },
      ],
    },
    {
      id: 4, label: "Yellow bottom-right", enabled: true, type: "radial",
      ellipseW: 183, ellipseH: 155, posX: 100, posY: 100,
      colorStops: [
        { color: "#d9d980", opacity: 0.50, position: 0 },
        { color: "#000000", opacity: 0,    position: 66 },
      ],
    },
  ],
  social3: [
    {
      id: 0, label: "Base", enabled: true, type: "solid", solidColor: "#ffffff",
      ellipseW: 100, ellipseH: 100, posX: 50, posY: 50, colorStops: [],
    },
  ],
  social4: [
    {
      id: 0, label: "Base", enabled: true, type: "solid", solidColor: "#ffffff",
      ellipseW: 100, ellipseH: 100, posX: 50, posY: 50, colorStops: [],
    },
  ],
};

/** Dark-mode gradient defaults for each slot */
export const SLOT_DARK_DEFAULTS: Record<string, GradientLayer[]> = {
  social1: [
    {
      id: 0, label: "Base", enabled: true, type: "solid", solidColor: "#ffffff",
      ellipseW: 100, ellipseH: 100, posX: 50, posY: 50, colorStops: [],
    },
    {
      id: 1, label: "Gradient", enabled: true, type: "linear", angle: 185,
      ellipseW: 100, ellipseH: 100, posX: 50, posY: 50,
      colorStops: [
        { color: "#211900", opacity: 1, position: 0 },
        { color: "#130000", opacity: 1, position: 100 },
      ],
    },
  ],
  social2: [
    {
      id: 0, label: "Base", enabled: true, type: "solid", solidColor: "#ffffff",
      ellipseW: 100, ellipseH: 100, posX: 50, posY: 50, colorStops: [],
    },
    {
      id: 1, label: "Gradient", enabled: true, type: "linear", angle: 270,
      ellipseW: 100, ellipseH: 100, posX: 50, posY: 50,
      colorStops: [
        { color: "#000629", opacity: 0.85, position: 0 },
        { color: "#002515", opacity: 1, position: 100 },
      ],
    },
  ],
  social3: [
    {
      id: 0, label: "Base", enabled: true, type: "solid", solidColor: "#ffffff",
      ellipseW: 100, ellipseH: 100, posX: 50, posY: 50, colorStops: [],
    },
    {
      id: 1, label: "Gradient", enabled: true, type: "linear", angle: 185,
      ellipseW: 100, ellipseH: 100, posX: 50, posY: 50,
      colorStops: [
        { color: "#002102", opacity: 1, position: 0 },
        { color: "#0a0024", opacity: 1, position: 100 },
      ],
    },
  ],
  social4: [
    {
      id: 0, label: "Base", enabled: true, type: "solid", solidColor: "#ffffff",
      ellipseW: 100, ellipseH: 100, posX: 50, posY: 50, colorStops: [],
    },
    {
      id: 1, label: "Gradient", enabled: true, type: "linear", angle: 126,
      ellipseW: 100, ellipseH: 100, posX: 50, posY: 50,
      colorStops: [
        { color: "#001121", opacity: 1, position: 0 },
        { color: "#140d00", opacity: 1, position: 100 },
      ],
    },
  ],
};

export function getSlotLayers(slot: string, isDark = false): GradientLayer[] {
  if (isDark) {
    return SLOT_DARK_DEFAULTS[slot] ?? SLOT_DARK_DEFAULTS.social1;
  }
  try {
    const raw = localStorage.getItem(slotKey(slot));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return SLOT_DEFAULTS[slot] ?? SLOT_DEFAULTS.social1;
}

export function saveSlotLayers(slot: string, layers: GradientLayer[]): void {
  localStorage.setItem(slotKey(slot), JSON.stringify(layers));
  window.dispatchEvent(new CustomEvent(SLOT_EVENT, { detail: slot }));
}

/** React hook — re-renders when the given slot's layers change. */
export function useBgSlotLayers(slot: string, isDark = false): GradientLayer[] {
  const [layers, setLayers] = useState<GradientLayer[]>(() => getSlotLayers(slot, isDark));

  useEffect(() => {
    setLayers(getSlotLayers(slot, isDark));
  }, [slot, isDark]);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === slot) setLayers(getSlotLayers(slot, isDark));
    };
    window.addEventListener(SLOT_EVENT, handler);
    return () => window.removeEventListener(SLOT_EVENT, handler);
  }, [slot, isDark]);

  return layers;
}
