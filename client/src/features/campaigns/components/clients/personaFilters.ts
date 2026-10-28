/**
 * The Personas page's filters, as pure functions so the rules are tested apart
 * from the list that shows them. `import type` only: this module must load
 * without the api file (which reads `import.meta.env`).
 */
import type { DemoClientSummary, DemoLang } from "../../api/demoClientsApi";

export type LangFilter = "all" | DemoLang;
export type SourceFilter = "all" | "website" | "manual";

export interface PersonaFilters {
  /** Matches niche, label, company name and category, ignoring case. */
  search: string;
  /** A category name; "" means any. */
  category: string;
  lang: LangFilter;
  source: SourceFilter;
}

export const DEFAULT_PERSONA_FILTERS: PersonaFilters = { search: "", category: "", lang: "all", source: "all" };

/**
 * `extraTexts` is more text the search also looks in (the Demos page passes a persona's
 * prospects: first names and companies). The other filters ignore it.
 */
export function personaMatches(c: DemoClientSummary, f: PersonaFilters, extraTexts: readonly string[] = []): boolean {
  if (f.lang !== "all" && !c.languages.includes(f.lang)) return false;
  if (f.source !== "all" && c.source !== f.source) return false;
  if (f.category && (c.category ?? "").trim() !== f.category) return false;
  const q = f.search.trim().toLowerCase();
  if (!q) return true;
  return (
    c.niche.toLowerCase().includes(q) ||
    c.label.toLowerCase().includes(q) ||
    c.companyName.toLowerCase().includes(q) ||
    (c.category ?? "").toLowerCase().includes(q) ||
    extraTexts.some((v) => v.toLowerCase().includes(q))
  );
}

/** True when any filter narrows the list (a padded search does not count). */
export function hasActiveFilters(f: PersonaFilters): boolean {
  return Boolean(f.search.trim()) || f.category !== "" || f.lang !== "all" || f.source !== "all";
}

/** True when a filter other than the search narrows the list: the dot on the topbar's Filter button (the search field shows its own query). */
export function hasMenuFilters(f: PersonaFilters): boolean {
  return f.category !== "" || f.lang !== "all" || f.source !== "all";
}

/** The category names in use, sorted, without blanks: the options of the category select. */
export function personaCategories(clients: DemoClientSummary[]): string[] {
  const names = new Set(clients.map((c) => (c.category ?? "").trim()).filter(Boolean));
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

/** How many personas each language filter would keep, over the whole library. */
export function languageCounts(clients: DemoClientSummary[]): Record<LangFilter, number> {
  const counts: Record<LangFilter, number> = { all: clients.length, en: 0, nl: 0, pt: 0 };
  for (const c of clients) for (const l of c.languages) counts[l] += 1;
  return counts;
}
