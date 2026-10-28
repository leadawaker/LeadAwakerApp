import { useEffect, useMemo, useState } from "react";
import type { DemoClientSummary } from "@/features/campaigns/api/demoClientsApi";
import type { PersonaFilters } from "@/features/campaigns/components/clients/personaFilters";
import {
  activityDots,
  followUpCount,
  splitRowsByPersona,
  type ActivityDot,
  type PersonaRowSplit,
} from "../../personaDemos";
import type { SeenMap } from "../../personaSeen";
import type { ProspectRow } from "../../prospectRows";

export interface PersonaActivity {
  split: PersonaRowSplit;
  /** Non-null dots only; its keys are the Needs follow-up set. */
  dots: Map<string, ActivityDot>;
  followUp: ReadonlySet<string>;
  /** The Needs follow-up toggle's number: the cards with an unseen dot that the list shows under the current search and filters. */
  followUpCount: number;
}

const NO_CLIENTS: DemoClientSummary[] = [];
const NO_ROWS: ProspectRow[] = [];
/** The dots age out (a reply leaves the 7-day window) while the page sits open: look again this often. */
const TICK_MS = 60 * 1000;

/**
 * Every prospect row filed under its persona (or No persona / Website visitors), and which cards
 * have unseen recent activity. While the persona list is `loading` nothing is filed yet (every
 * row would look like No persona and inflate the counts); a list that failed to load counts as
 * empty, so the rows still show under No persona. The result keeps its identity until its inputs
 * change or the minute ticks, so `followUp` is safe to hand to ClientsTab as `onlyNiches`.
 */
export function usePersonaActivity(
  rows: ProspectRow[],
  clients: DemoClientSummary[] | undefined,
  seen: SeenMap,
  filters: PersonaFilters,
  loading: boolean,
): PersonaActivity {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const list = clients ?? NO_CLIENTS;
  const waiting = loading && clients === undefined;
  const split = useMemo(
    () => splitRowsByPersona(waiting ? NO_ROWS : rows, list.map((c) => c.niche)),
    [rows, list, waiting],
  );
  return useMemo(() => {
    const dots = activityDots(split, list.map((c) => c.niche), seen, now);
    return { split, dots, followUp: new Set(dots.keys()), followUpCount: followUpCount(list, split, dots, filters) };
  }, [split, list, seen, now, filters]);
}
