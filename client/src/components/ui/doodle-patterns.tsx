import type React from "react";

/**
 * Seamless doodle patterns for chat background overlays.
 * All patterns are black-stroke Illustrator SVGs served from /public/patterns/.
 * Rendered with mix-blend-mode controlled by the user; opacity + invert filter for color.
 */

// 42 patterns — IDs 1 through 42
type PatternNum =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20
  | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30
  | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40
  | 41 | 42;

export type DoodlePatternId = `doodle-${PatternNum}`;

export interface DoodlePattern {
  id: DoodlePatternId;
  name: string;
  url: string;
}

export const DOODLE_PATTERNS: DoodlePattern[] = Array.from({ length: 42 }, (_, i) => ({
  id: `doodle-${i + 1}` as DoodlePatternId,
  name: `Pattern ${i + 1}`,
  url: `/patterns/pattern-${i + 1}.svg`,
}));

export interface DoodleOverlayStyle extends React.CSSProperties {
  backgroundImage: string;
  backgroundRepeat: string;
  backgroundSize: string;
  mixBlendMode: React.CSSProperties["mixBlendMode"];
  opacity: number;
  filter: string;
}

/**
 * All CSS mix-blend-mode values, grouped for readability.
 *
 * For "preserve gradient color + darken":  use "darken"
 *   - Where strokes are black → those pixels win (darkening only)
 *   - Where strokes are white → gradient shows through untouched
 *   - Hue & saturation of gradient are 100% preserved
 *
 * For "classic photo-like depth":  use "multiply"
 * For "lightening/highlight look": use "screen" or "color-dodge"
 */
export const BLEND_MODES = [
  // Darkening group
  "darken",
  "multiply",
  "color-burn",
  // Lightening group
  "lighten",
  "screen",
  "color-dodge",
  // Contrast group
  "overlay",
  "soft-light",
  "hard-light",
  // Inversion group
  "difference",
  "exclusion",
  // Component group
  "hue",
  "saturation",
  "color",
  "luminosity",
  // Passthrough
  "normal",
] as const;

/**
 * Returns the full inline style for the doodle overlay div.
 * color 0–100 → opacity 0–0.8.
 * strokeColor 0 = black strokes (no invert), 100 = white strokes (full invert).
 * blendMode: any CSS mix-blend-mode value.
 */
export function getDoodleStyle(
  patternId: DoodlePatternId,
  color: number,
  size: number,
  strokeColor: number = 0,
  blendMode: string = "overlay",
): DoodleOverlayStyle {
  const meta = DOODLE_PATTERNS.find((p) => p.id === patternId) ?? DOODLE_PATTERNS[0];
  const clampedStroke = Math.max(0, Math.min(100, strokeColor));
  return {
    backgroundImage: `url("${meta.url}")`,
    backgroundRepeat: "repeat",
    backgroundSize: `${size}px auto`,
    mixBlendMode: blendMode as React.CSSProperties["mixBlendMode"],
    opacity: (Math.max(0, Math.min(100, color)) / 100) * 0.8,
    filter: clampedStroke > 0 ? `invert(${clampedStroke}%)` : "none",
  };
}

/** Extract the 1-based pattern number from a DoodlePatternId. */
export function patternIdToNumber(id: DoodlePatternId): number {
  return parseInt(id.replace("doodle-", ""), 10);
}

/** Build a DoodlePatternId from a 1-based pattern number (clamped 1–42). */
export function numberToPatternId(n: number): DoodlePatternId {
  return `doodle-${Math.max(1, Math.min(42, Math.round(n)))}` as DoodlePatternId;
}
