import type { ProspectRow } from "./prospectRows";
import type { SeenMap } from "./personaSeen";

// Pure: joins the Demos page's prospect rows to the persona cards, and works out
// each card's activity dot. `import type` only, so it loads in tests.

/** Card keys for the two special cards. Never valid persona niches (niches are slugs). */
export const NO_PERSONA_KEY = "__no_persona__";
export const WEBSITE_KEY = "__website__";
export type SpecialKey = typeof NO_PERSONA_KEY | typeof WEBSITE_KEY;

export function isSpecialKey(key: string | null | undefined): key is SpecialKey {
  return key === NO_PERSONA_KEY || key === WEBSITE_KEY;
}

export interface PersonaRowSplit {
  /** Persona niche to its rows. Only niches that have rows have an entry. */
  byNiche: Map<string, ProspectRow[]>;
  noPersona: ProspectRow[];
  website: ProspectRow[];
}

/**
 * Website first: a row with publicDemo goes to `website` whatever its clientNiche.
 * Else clientNiche (trimmed) that is one of `niches` goes to that persona.
 * Else (empty, or a persona that no longer exists) goes to `noPersona`.
 * Input order is kept inside every bucket.
 */
export function splitRowsByPersona(rows: ProspectRow[], niches: Iterable<string>): PersonaRowSplit {
  const known = new Set(niches);
  const split: PersonaRowSplit = { byNiche: new Map(), noPersona: [], website: [] };
  for (const r of rows) {
    const niche = r.clientNiche.trim();
    if (r.publicDemo) split.website.push(r);
    else if (known.has(niche)) {
      const bucket = split.byNiche.get(niche);
      if (bucket) bucket.push(r);
      else split.byNiche.set(niche, [r]);
    } else split.noPersona.push(r);
  }
  return split;
}

/** A card's rows: the special buckets by key, else byNiche; [] when none. */
export function rowsForKey(split: PersonaRowSplit, key: string): ProspectRow[] {
  if (key === NO_PERSONA_KEY) return split.noPersona;
  if (key === WEBSITE_KEY) return split.website;
  return split.byNiche.get(key) ?? [];
}

export const ACTIVITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export type ActivityDot = "reply" | "open" | null;

function time(iso: string | null | undefined): number | null {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : null;
}

/** True when `iso` is inside the window ending at `now` and after `seen` (null = never seen). */
function unseenRecent(iso: string | null, seen: number | null, now: number): boolean {
  const t = time(iso);
  return t !== null && now - t <= ACTIVITY_WINDOW_MS && (seen === null || t > seen);
}

/**
 * "reply" when any row has lastReplyAt inside the window (now - t <= ACTIVITY_WINDOW_MS, inclusive)
 * and after seenAt; else "open" when any row has lastOpenAt inside the window and after seenAt; else null.
 * A missing or unparseable seenAt means never seen. Unparseable row times are ignored.
 */
export function activityDot(rows: ProspectRow[], seenAt: string | null | undefined, now: number): ActivityDot {
  const seen = time(seenAt);
  if (rows.some((r) => unseenRecent(r.lastReplyAt, seen, now))) return "reply";
  if (rows.some((r) => unseenRecent(r.lastOpenAt, seen, now))) return "open";
  return null;
}

/** Card key to its dot, only for keys whose dot is not null. Keys: every niche in `niches`, then NO_PERSONA_KEY, WEBSITE_KEY. */
export function activityDots(split: PersonaRowSplit, niches: Iterable<string>, seen: SeenMap, now: number): Map<string, ActivityDot> {
  const dots = new Map<string, ActivityDot>();
  for (const key of [...niches, NO_PERSONA_KEY, WEBSITE_KEY]) {
    const dot = activityDot(rowsForKey(split, key), seen[key], now);
    if (dot) dots.set(key, dot);
  }
  return dots;
}

export interface ProspectSummary {
  prospects: number;
  /** Rows with replies > 0. */
  replied: number;
  /** Rows opened with no reply. */
  opened: number;
}

export function prospectSummary(rows: ProspectRow[]): ProspectSummary {
  const replied = rows.filter((r) => r.replies > 0).length;
  return { prospects: rows.length, replied, opened: rows.filter((r) => r.opened && r.replies === 0).length };
}

/**
 * The special cards the list shows, No persona first. A card needs rows; the persona filters
 * (search, category, language, source) hide both, since neither card has those traits; with
 * Needs follow-up on, a card needs an unseen dot, or to be the one that is open.
 */
export function visibleSpecialKeys(
  split: PersonaRowSplit,
  dots: ReadonlyMap<string, ActivityDot>,
  opts: { filtersActive: boolean; followUp: boolean; selected: string | null },
): SpecialKey[] {
  if (opts.filtersActive) return [];
  const keys: SpecialKey[] = [NO_PERSONA_KEY, WEBSITE_KEY];
  return keys.filter(
    (key) => rowsForKey(split, key).length > 0 && (!opts.followUp || dots.has(key) || opts.selected === key),
  );
}
