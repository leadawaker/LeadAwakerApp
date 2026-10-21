// Pure rules behind studio tags on the client: the CSS token for each palette color, the tags an
// idea or script carries (in the account's tag order), toggling one, and the next color for a new tag.
import { TAG_COLORS, type TagColor } from "@shared/socialStudio";
import type { TagView } from "../api/tagsApi";

export const TAG_COLOR_VAR: Record<TagColor, string> = {
  wine: "var(--wine)",
  good: "var(--good)",
  warn: "var(--warn)",
  blue: "var(--stage-contacted)",
  teal: "var(--stage-responded)",
  plum: "var(--stage-new)",
  brick: "var(--stage-lost)",
  sand: "var(--stage-qualified)",
};

/** The tags behind these ids, in the order of the account's list; unknown ids are skipped. */
export function tagsFor(ids: readonly number[], tags: readonly TagView[]): TagView[] {
  const set = new Set(ids);
  return tags.filter((t) => set.has(t.id));
}

export function toggleTagId(ids: readonly number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/** The least used palette color, so new tags spread over the palette. */
export function nextTagColor(tags: readonly TagView[]): TagColor {
  const count = (c: TagColor) => tags.filter((t) => t.color === c).length;
  return TAG_COLORS.reduce((best, c) => (count(c) < count(best) ? c : best), TAG_COLORS[0]);
}

/** An existing tag with this name, ignoring case and extra spaces. */
export function findTagByName(tags: readonly TagView[], name: string): TagView | undefined {
  const key = name.replace(/\s+/g, " ").trim().toLowerCase();
  return tags.find((t) => t.name.toLowerCase() === key);
}
