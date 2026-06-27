import { Globe, Facebook, Instagram, Hexagon, Zap, MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Visual metadata for each lead source: a lucide icon + the platform's brand
 * accent. Brand glyphs keep their own colors (raw brand hex is intentional here,
 * the same way the codebase hardcodes brand hex for Facebook/Instagram chips) so
 * sources stay recognizable; the bars themselves remain wine.
 */
export const SOURCE_META: Record<string, { icon: LucideIcon; color: string }> = {
  webForm: { icon: Globe, color: "var(--wine)" },
  facebook: { icon: Facebook, color: "#1877F2" },
  instagram: { icon: Instagram, color: "#E4405F" },
  hubspot: { icon: Hexagon, color: "#FF7A59" },
  zapier: { icon: Zap, color: "#FF4F00" },
  other: { icon: MoreHorizontal, color: "var(--mute)" },
};

export function sourceMeta(key: string) {
  return SOURCE_META[key] ?? SOURCE_META.other;
}
