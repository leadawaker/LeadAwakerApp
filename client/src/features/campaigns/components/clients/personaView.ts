/**
 * How the persona list is ordered and grouped: newest first, in category
 * sections (default) or in date sections. Pure, and `import type` only from the
 * api file (which reads `import.meta.env`), so node:test can run it.
 */
import { groupByDate } from "@/features/voiceCalls/dateGroups";
import type { DemoClientSummary } from "../../api/demoClientsApi";

export type GroupBy = "category" | "date";

/** Key of the synthetic bucket for personas with no category. Not a label, so a real category may be named "Uncategorized". */
export const UNCATEGORIZED_KEY = "__uncategorized__";

/** Nothing open: small cards side by side. A persona open: the vertical list, narrowed beside its editor. */
export type ListLayout = "cards" | "rows";

export function listLayout(selectedNiche: string | null): ListLayout {
  return selectedNiche ? "rows" : "cards";
}

export function parseGroupBy(raw: string | null | undefined): GroupBy {
  return raw === "date" ? "date" : "category";
}

type Dated = Pick<DemoClientSummary, "createdAt" | "updatedAt">;

/** When a persona was saved, else when it last changed, else "" (old curated rows have neither). */
export function personaDate(c: Dated): string {
  return c.createdAt || c.updatedAt || "";
}

function time(c: Dated): number {
  const t = Date.parse(personaDate(c));
  return Number.isFinite(t) ? t : -Infinity;
}

/** Newest first, undated last, ties by name. Returns a new array. */
export function sortNewest<T extends Dated & Pick<DemoClientSummary, "niche">>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const x = time(a);
    const y = time(b);
    if (x !== y) return y > x ? 1 : -1;
    return a.niche.localeCompare(b.niche);
  });
}

export interface PersonaGroup {
  /** A stable identity for React and for expanding state; never shown. */
  key: string;
  kind: "category" | "date";
  /** The category name; null for the uncategorized bucket and for date groups. */
  category: string | null;
  uncategorized: boolean;
  /** Date groups: a relative key ("today") or "YYYY-MM" or "unknown". */
  dateKey: string | null;
  /** Date groups that are months: "October 2026" in the UI locale. */
  monthLabel: string | null;
  items: DemoClientSummary[];
}

export function groupPersonas(
  items: DemoClientSummary[],
  by: GroupBy,
  opts: { now?: Date; timeZone?: string; locale?: string } = {},
): PersonaGroup[] {
  const sorted = sortNewest(items);

  if (by === "date") {
    return groupByDate(sorted, personaDate, opts).map((g) => ({
      key: g.key,
      kind: "date" as const,
      category: null,
      uncategorized: false,
      dateKey: g.key,
      monthLabel: g.monthLabel,
      items: g.items,
    }));
  }

  const byCategory = new Map<string, DemoClientSummary[]>();
  for (const c of sorted) {
    const key = (c.category ?? "").trim();
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(c);
  }
  const named: PersonaGroup[] = Array.from(byCategory.keys())
    .filter((k) => k !== "")
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      key: name, kind: "category" as const, category: name, uncategorized: false,
      dateKey: null, monthLabel: null, items: byCategory.get(name)!,
    }));
  const none = byCategory.get("");
  if (none?.length) {
    named.push({
      key: UNCATEGORIZED_KEY, kind: "category", category: null, uncategorized: true,
      dateKey: null, monthLabel: null, items: none,
    });
  }
  return named;
}

/** "26 Oct", with the year ("3 Mar 2025") when it is not the current one; "" for no usable date. */
export function formatPersonaDate(iso: string, now: Date, locale: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  }).format(d);
}

/**
 * Whether the list offers Delete: a saved persona only. The curated niche packs
 * are read by real campaigns and a live persona belongs to a client's receptionist
 * (the same two guards as ClientActionsMenu and the server's delete route).
 */
export function canDeletePersona(c: Pick<DemoClientSummary, "isDemoClient" | "isLive">): boolean {
  return c.isDemoClient === true && !c.isLive;
}
